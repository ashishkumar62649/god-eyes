"""Airplanes.live Live Aircraft Worker — WO-079C.

Fetches live aircraft data from Airplanes.live REST API v2.
Supports /mil, /ladd, /pia, and /point endpoints.

Usage (dry-run):
    python services/fetch-orchestrator/src/layers/layer_01_aviation/airplanes_live_worker.py

Usage (persist):
    python services/fetch-orchestrator/src/layers/layer_01_aviation/airplanes_live_worker.py --persist

Usage (with point endpoint):
    python services/fetch-orchestrator/src/layers/layer_01_aviation/airplanes_live_worker.py \
        --include mil,ladd,pia,point --lat 28.6139 --lon 77.2090 --radius-nm 250
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[5]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

sys.path.insert(0, str(REPO_ROOT / "services" / "fetch-orchestrator" / "src" / "layers" / "layer_01_aviation"))

from airplanes_live_db import (
    DEFAULT_DATABASE_URL,
    connect_db,
    insert_raw_batch,
    upsert_latest_aircraft,
    insert_observation,
)

BASE_URL = "http://api.airplanes.live/v2"
DEFAULT_SOURCE_ID = "airplanes_live_v2"
LAYER_ID = "layer_01_aviation"

# Staleness thresholds (seconds)
STALE_ACTIVE_THRESHOLD = 30
STALE_FADE_THRESHOLD = 90
STALE_PURGE_THRESHOLD = 300

DEFAULT_TIMEOUT = 20
RATE_LIMIT_SECONDS = 1.0


def parse_db_flags(flags: int | None) -> dict[str, bool]:
    """Parse dbFlags into boolean flags."""
    if flags is None:
        return {"is_military": False, "is_interesting": False, "is_pia": False, "is_ladd": False}
    return {
        "is_military": bool(flags & 1),
        "is_interesting": bool(flags & 2),
        "is_pia": bool(flags & 4),
        "is_ladd": bool(flags & 8),
    }


def normalize_altitude(alt: Any) -> tuple[float | None, bool]:
    """Normalize altitude, handling 'ground' string."""
    if alt is None:
        return None, False
    if isinstance(alt, str):
        if alt.lower() == "ground":
            return None, True
        try:
            return float(alt), False
        except (ValueError, TypeError):
            return None, False
    try:
        return float(alt), False
    except (ValueError, TypeError):
        return None, False


def normalize_aircraft(raw: dict[str, Any], received_at: datetime) -> dict[str, Any] | None:
    """Normalize Airplanes.live aircraft record to internal schema."""
    hex_val = raw.get("hex")
    if not hex_val:
        return None

    alt_baro_raw = raw.get("alt_baro")
    alt_baro, on_ground = normalize_altitude(alt_baro_raw)

    alt_geom_raw = raw.get("alt_geom")
    alt_geom = None
    try:
        if alt_geom_raw is not None:
            alt_geom = float(alt_geom_raw)
    except (ValueError, TypeError):
        pass

    db_flags_val = raw.get("dbFlags")
    flags = parse_db_flags(db_flags_val if isinstance(db_flags_val, int) else None)

    flight = raw.get("flight")
    callsign = flight.strip() if flight and isinstance(flight, str) else None

    seen = raw.get("seen")
    seen_seconds = None
    try:
        if seen is not None:
            seen_seconds = float(seen)
    except (ValueError, TypeError):
        pass

    observed_at = received_at
    if seen_seconds is not None:
        observed_at = received_at.replace(microsecond=0)
        observed_at = received_at - timedelta(seconds=seen_seconds) if seen_seconds > 0 else received_at

    lat_raw = raw.get("lat")
    lon_raw = raw.get("lon")
    lat = None
    lon = None
    if lat_raw is not None and lon_raw is not None:
        try:
            lat = float(lat_raw)
            lon = float(lon_raw)
        except (ValueError, TypeError):
            lat = None
            lon = None

    return {
        "source_object_id": hex_val,
        "callsign": callsign,
        "registration": raw.get("r"),
        "aircraft_type": raw.get("t"),
        "db_flags": db_flags_val,
        "is_military": flags["is_military"],
        "is_interesting": flags["is_interesting"],
        "is_pia": flags["is_pia"],
        "is_ladd": flags["is_ladd"],
        "source_message_type": raw.get("type"),
        "lat": lat,
        "lon": lon,
        "altitude_baro_ft": alt_baro,
        "altitude_geom_ft": alt_geom,
        "on_ground": on_ground,
        "ground_speed_kt": _safe_float(raw.get("gs")),
        "track_deg": _safe_float(raw.get("track")),
        "heading_mag_deg": _safe_float(raw.get("mag_heading")),
        "heading_true_deg": _safe_float(raw.get("true_heading")),
        "vertical_rate_fpm": _safe_float(raw.get("baro_rate")),
        "geom_rate_fpm": _safe_float(raw.get("geom_rate")),
        "squawk": raw.get("squawk"),
        "emergency": raw.get("emergency"),
        "seen_seconds": seen_seconds,
        "seen_pos_seconds": _safe_float(raw.get("seen_pos")),
        "observed_at": observed_at,
        "received_at": received_at,
        "stale_after": observed_at.replace(microsecond=0) + timedelta(seconds=STALE_FADE_THRESHOLD),
        "raw_json": raw,
    }


def _safe_float(val: Any) -> float | None:
    """Safely convert value to float."""
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def fetch_endpoint(endpoint: str, timeout: int = DEFAULT_TIMEOUT) -> tuple[dict[str, Any] | None, int | None, str | None]:
    """Fetch a single Airplanes.live endpoint."""
    url = f"{BASE_URL}/{endpoint}"
    req = urllib.request.Request(url, headers={"User-Agent": "GodEyes/1.0 (aviation-fetcher)"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            data = json.loads(raw)
            return data, resp.status, None
    except urllib.error.HTTPError as exc:
        return None, exc.code, str(exc)
    except urllib.error.URLError as exc:
        return None, None, str(exc)
    except json.JSONDecodeError as exc:
        return None, None, f"JSON decode error: {exc}"
    except Exception as exc:
        return None, None, str(exc)


def run_worker(
    include_endpoints: list[str] | None = None,
    lat: float | None = None,
    lon: float | None = None,
    radius_nm: int = 250,
    timeout: int = DEFAULT_TIMEOUT,
    persist: bool = False,
    database_url: str | None = None,
    source_id: str = DEFAULT_SOURCE_ID,
) -> dict[str, Any]:
    """Run the Airplanes.live fetcher worker."""
    db_url = database_url or os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)

    if persist:
        print("[WORKER] PERSIST MODE: Will write to database")
    else:
        print("[WORKER] DRY-RUN MODE: No database writes will be performed")

    if include_endpoints is None:
        include_endpoints = ["mil", "ladd", "pia", "point"]

    # Validate point endpoint requirements
    endpoints_to_fetch = []
    skip_point = False
    for ep in include_endpoints:
        if ep == "point":
            if lat is None or lon is None:
                print("[WORKER] WARNING: /point endpoint included but lat/lon not provided. Skipping point endpoint.")
                skip_point = True
                continue
            if radius_nm > 250:
                print(f"[WORKER] WARNING: Radius {radius_nm}nm exceeds 250nm limit. Capping to 250nm.")
                radius_nm = 250
            endpoints_to_fetch.append(f"point/{lat}/{lon}/{radius_nm}")
        else:
            endpoints_to_fetch.append(ep)

    if skip_point and not endpoints_to_fetch:
        print("[WORKER] ERROR: No endpoints to fetch after skipping point")
        return {"error": "No endpoints to fetch", "endpoints_processed": [], "aircraft_processed": 0}

    conn = None
    if persist:
        try:
            conn = connect_db(db_url)
        except Exception as e:
            print(f"[WORKER] ERROR: Could not connect to database: {e}")
            return {"error": f"DB connection failed: {e}", "endpoints_processed": [], "aircraft_processed": 0}

    received_at = datetime.now(timezone.utc)
    result = {
        "source_id": source_id,
        "layer_id": LAYER_ID,
        "endpoints_processed": [],
        "aircraft_processed": 0,
        "aircraft_valid_position": 0,
        "errors": [],
    }

    try:
        for endpoint in endpoints_to_fetch:
            print(f"[WORKER] Fetching: /{endpoint}")
            time.sleep(RATE_LIMIT_SECONDS)

            data, status, error = fetch_endpoint(endpoint, timeout)

            if error:
                print(f"[WORKER] ERROR fetching /{endpoint}: {error}")
                result["errors"].append({"endpoint": endpoint, "error": error})
                if conn:
                    try:
                        insert_raw_batch(
                            conn, source_id, endpoint, {}, received_at,
                            http_status=status, aircraft_count=0,
                            error_message=error
                        )
                    except Exception as db_err:
                        print(f"[WORKER] ERROR recording failed batch: {db_err}")
                continue

            if not data or not isinstance(data, dict):
                print(f"[WORKER] ERROR: Invalid response for /{endpoint}")
                result["errors"].append({"endpoint": endpoint, "error": "Invalid response"})
                continue

            aircraft_list = data.get("aircraft", [])
            aircraft_count = len(aircraft_list)
            print(f"[WORKER] /{endpoint}: {aircraft_count} aircraft")

            # Extract timing metadata
            source_now = data.get("now")
            source_ctime = data.get("ctime")
            source_ptime = data.get("ptime")

            if conn:
                try:
                    raw_sample = aircraft_list[:5] if aircraft_list else []
                    insert_raw_batch(
                        conn, source_id, endpoint, {}, received_at,
                        http_status=status, aircraft_count=aircraft_count,
                        source_now_ts=source_now, source_ctime_ts=source_ctime,
                        source_ptime_ms=source_ptime, raw_sample=raw_sample
                    )
                except Exception as db_err:
                    print(f"[WORKER] ERROR recording raw batch: {db_err}")

            result["endpoints_processed"].append(endpoint)
            result["aircraft_processed"] += aircraft_count

            # Normalize and persist aircraft
            for raw_ac in aircraft_list:
                normalized = normalize_aircraft(raw_ac, received_at)
                if not normalized:
                    continue

                has_position = normalized.get("lat") is not None and normalized.get("lon") is not None

                if has_position:
                    result["aircraft_valid_position"] += 1

                if persist and conn:
                    try:
                        upsert_latest_aircraft(conn, source_id, normalized)
                    except Exception as db_err:
                        print(f"[WORKER] ERROR upserting latest: {db_err}")

                    if has_position:
                        try:
                            insert_observation(conn, source_id, normalized)
                        except Exception as db_err:
                            print(f"[WORKER] ERROR inserting observation: {db_err}")

        print(f"[WORKER] Done. Processed {result['aircraft_processed']} aircraft, "
              f"{result['aircraft_valid_position']} with valid position")

    except Exception as e:
        error_msg = str(e)
        print(f"[WORKER] ERROR: {error_msg}")
        result["errors"].append({"error": error_msg})
    finally:
        if conn:
            conn.close()

    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Airplanes.live Live Aircraft Worker")
    parser.add_argument(
        "--persist",
        action="store_true",
        help="Write to database (required for persistence)",
    )
    parser.add_argument(
        "--database-url",
        type=str,
        default=None,
        help="PostgreSQL connection URL",
    )
    parser.add_argument(
        "--include",
        type=str,
        default="mil,ladd,pia,point",
        help="Comma-separated endpoints to include (default: mil,ladd,pia,point)",
    )
    parser.add_argument(
        "--lat",
        type=float,
        default=None,
        help="Latitude for point endpoint",
    )
    parser.add_argument(
        "--lon",
        type=float,
        default=None,
        help="Longitude for point endpoint",
    )
    parser.add_argument(
        "--radius-nm",
        type=int,
        default=250,
        help="Radius in nautical miles for point endpoint (max 250)",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=int,
        default=DEFAULT_TIMEOUT,
        help="Request timeout in seconds",
    )
    parser.add_argument(
        "--skip-point",
        action="store_true",
        help="Skip point endpoint even if included in --include",
    )
    parser.add_argument(
        "--source-id",
        type=str,
        default=DEFAULT_SOURCE_ID,
        help="Source ID for this fetcher",
    )
    args = parser.parse_args()

    include_list = [e.strip() for e in args.include.split(",") if e.strip()]

    if args.skip_point:
        include_list = [e for e in include_list if e != "point"]

    run_worker(
        include_endpoints=include_list,
        lat=args.lat,
        lon=args.lon,
        radius_nm=args.radius_nm,
        timeout=args.timeout_seconds,
        persist=args.persist,
        database_url=args.database_url,
        source_id=args.source_id,
    )


if __name__ == "__main__":
    main()