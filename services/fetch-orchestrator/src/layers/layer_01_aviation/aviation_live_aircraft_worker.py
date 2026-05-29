"""Airplanes.live Live Aircraft Worker — WO-079C + WO-079F.

Fetches live aircraft data from Airplanes.live REST API v2 or
the experimental globe web JSON snapshot.

Usage (REST mode - default):
    python services/fetch-orchestrator/src/layers/layer_01_aviation/aviation_live_aircraft_worker.py --persist

Usage (global web JSON mode):
    python services/fetch-orchestrator/src/layers/layer_01_aviation/aviation_live_aircraft_worker.py \
        --source-mode global-web-json --persist

Usage with loop mode:
    python services/fetch-orchestrator/src/layers/layer_01_aviation/aviation_live_aircraft_worker.py \
        --source-mode global-web-json --loop --interval-seconds 5 --persist
"""

from __future__ import annotations

import argparse
import gzip
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

from aviation_live_aircraft_db import (
    DEFAULT_DATABASE_URL,
    connect_db,
    insert_raw_batch,
    upsert_latest_aircraft,
    insert_observation,
    upsert_live_snapshot,
)

BASE_URL = "http://api.airplanes.live/v2"
GLOBAL_WEB_JSON_URL = "https://globe.airplanes.live/data/aircraft.json.gz"
DEFAULT_SOURCE_ID = "airplanes_live_v2"
GLOBAL_WEB_JSON_SOURCE_ID = "airplanes_live_global_web_json"
LAYER_ID = "layer_01_aviation"

# Staleness thresholds (seconds)
STALE_ACTIVE_THRESHOLD = 30
STALE_FADE_THRESHOLD = 90
STALE_PURGE_THRESHOLD = 300

DEFAULT_TIMEOUT = 20
RATE_LIMIT_SECONDS = 1.0
GLOBAL_WEB_JSON_MIN_INTERVAL_SECONDS = 5
GLOBAL_WEB_JSON_DEFAULT_INTERVAL_SECONDS = 5
GLOBAL_WEB_JSON_BACKOFF_SECONDS = 30
GLOBAL_WEB_JSON_RETRY_STATUSES = {403, 429, 500, 502, 503, 504}


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


def is_gzip_magic(data: bytes) -> bool:
    """Detect if data starts with gzip magic bytes (0x1f 0x8b)."""
    return len(data) >= 2 and data[0] == 0x1f and data[1] == 0x8b


def fetch_global_web_json(timeout: int = DEFAULT_TIMEOUT) -> tuple[dict[str, Any] | None, int | None, str | None]:
    """Fetch the global web JSON snapshot from Airplanes.live globe."""
    # Append cache buster timestamp
    cache_buster = int(time.time() * 1000)
    url = f"{GLOBAL_WEB_JSON_URL}?_={cache_buster}"
    
    headers = {
        "User-Agent": "GodEyes/1.0 (aviation-fetcher; global-web-json-adapter)",
        "Referer": "https://globe.airplanes.live/",
        "Origin": "https://globe.airplanes.live",
    }
    req = urllib.request.Request(url, headers=headers)
    
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            status = resp.status
            
            # Handle gzip compression
            if is_gzip_magic(raw):
                raw = gzip.decompress(raw)
            
            data = json.loads(raw)
            return data, status, None
    except urllib.error.HTTPError as exc:
        return None, exc.code, str(exc)
    except urllib.error.URLError as exc:
        return None, None, str(exc)
    except gzip.BadGzipFile:
        # Not gzip, try as plain JSON
        try:
            data = json.loads(raw)
            return data, 200, None
        except json.JSONDecodeError:
            return None, None, "Invalid JSON after gzip decompression"
    except json.JSONDecodeError as exc:
        return None, None, f"JSON decode error: {exc}"
    except Exception as exc:
        return None, None, str(exc)


def extract_aircraft_from_global_json(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Extract aircraft array from global web JSON response.
    
    Supports both 'aircraft' and 'ac' keys.
    """
    if not isinstance(data, dict):
        return []
    return data.get("aircraft") or data.get("ac") or []


def run_worker(
    include_endpoints: list[str] | None = None,
    lat: float | None = None,
    lon: float | None = None,
    radius_nm: int = 250,
    timeout: int = DEFAULT_TIMEOUT,
    persist: bool = False,
    database_url: str | None = None,
    source_id: str = DEFAULT_SOURCE_ID,
    source_mode: str = "rest",
) -> dict[str, Any]:
    """Run the Airplanes.live fetcher worker.
    
    Args:
        source_mode: Either "rest" (default official API) or "global-web-json" (globe snapshot)
    """
    db_url = database_url or os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)
    
    # Handle global web JSON mode
    if source_mode == "global-web-json":
        return run_global_web_json_worker(
            timeout=timeout,
            persist=persist,
            database_url=db_url,
        )

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


def run_global_web_json_worker(
    timeout: int = DEFAULT_TIMEOUT,
    persist: bool = False,
    database_url: str | None = None,
) -> dict[str, Any]:
    """Run the Airplanes.live global web JSON snapshot fetcher."""
    db_url = database_url or os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)
    
    # Use global web JSON source ID
    source_id = GLOBAL_WEB_JSON_SOURCE_ID
    
    if persist:
        print("[WORKER] GLOBAL-WEB-JSON MODE: Will write to database")
    else:
        print("[WORKER] GLOBAL-WEB-JSON MODE: DRY-RUN - No database writes")

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
        print(f"[WORKER] Fetching global web JSON snapshot...")
        
        data, status, error = fetch_global_web_json(timeout)

        if error:
            print(f"[WORKER] ERROR fetching global web JSON: {error}")
            result["errors"].append({"endpoint": "/data/aircraft.json.gz", "error": error, "http_status": status})
            if conn:
                try:
                    insert_raw_batch(
                        conn, source_id, "/data/aircraft.json.gz", 
                        None, received_at,
                        http_status=status, aircraft_count=0,
                        error_message=error,
                        fetch_params={"sourceMode": "global-web-json"}
                    )
                except Exception as db_err:
                    print(f"[WORKER] ERROR recording failed batch: {db_err}")
            return result

        if not data or not isinstance(data, dict):
            print("[WORKER] ERROR: Invalid global web JSON response")
            result["errors"].append({"endpoint": "/data/aircraft.json.gz", "error": "Invalid response"})
            return result

        # Extract aircraft array
        aircraft_list = extract_aircraft_from_global_json(data)
        aircraft_count = len(aircraft_list)
        print(f"[WORKER] Global web JSON: {aircraft_count} aircraft")

        # Extract timing metadata from payload
        source_now = data.get("now")
        source_messages = data.get("messages")

        # Log raw batch
        if conn:
            try:
                raw_sample = aircraft_list[:5] if aircraft_list else []
                insert_raw_batch(
                    conn, source_id, "/data/aircraft.json.gz",
                    None, received_at,
                    http_status=status, aircraft_count=aircraft_count,
                    source_now_ts=source_now,
                    error_message=None,
                    fetch_params={"sourceMode": "global-web-json", "messages": source_messages}
                )
            except Exception as db_err:
                print(f"[WORKER] ERROR recording raw batch: {db_err}")

        result["endpoints_processed"].append("/data/aircraft.json.gz")
        result["aircraft_processed"] = aircraft_count

        # Determine observed_at from payload or local time
        observed_at = received_at
        if source_now is not None:
            try:
                observed_at = datetime.fromtimestamp(source_now, tz=timezone.utc)
            except (ValueError, OSError):
                pass  # Fall back to received_at

        # Normalize and persist each aircraft
        for raw_ac in aircraft_list:
            # Adjust observed_at based on seen seconds
            seen = raw_ac.get("seen")
            seen_seconds = _safe_float(seen)
            final_observed_at = observed_at
            if seen_seconds is not None and seen_seconds > 0:
                final_observed_at = observed_at - timedelta(seconds=seen_seconds)
            
            # Create a modified received_at for normalization
            normalized = normalize_aircraft(raw_ac, final_observed_at)
            if not normalized:
                continue

            has_position = normalized.get("lat") is not None and normalized.get("lon") is not None

            if has_position:
                result["aircraft_valid_position"] += 1

            if persist and conn:
                try:
                    # Use original source_id for API compatibility
                    upsert_latest_aircraft(conn, DEFAULT_SOURCE_ID, normalized)
                except Exception as db_err:
                    print(f"[WORKER] ERROR upserting latest: {db_err}")

                if has_position:
                    try:
                        insert_observation(conn, DEFAULT_SOURCE_ID, normalized)
                    except Exception as db_err:
                        print(f"[WORKER] ERROR inserting observation: {db_err}")

        # Publish live snapshot for WebSocket/API (WO-080A)
        if persist and conn and result["aircraft_processed"] > 0:
            try:
                # Build compact aircraft payload
                compact_aircraft = []
                valid_count = 0
                for raw_ac in aircraft_list:
                    hex_val = raw_ac.get("hex")
                    if not hex_val:
                        continue
                    
                    lat_raw = raw_ac.get("lat")
                    lon_raw = raw_ac.get("lon")
                    lat = lon = None
                    has_pos = False
                    if lat_raw is not None and lon_raw is not None:
                        try:
                            lat = float(lat_raw)
                            lon = float(lon_raw)
                            has_pos = True
                        except (ValueError, TypeError):
                            pass
                    
                    if has_pos:
                        valid_count += 1
                    
                    # Calculate observed_at from seen
                    seen = raw_ac.get("seen")
                    seen_seconds = _safe_float(seen)
                    aircraft_observed_at = observed_at
                    if seen_seconds is not None and seen_seconds > 0:
                        aircraft_observed_at = observed_at - timedelta(seconds=seen_seconds)
                    
                    stale_after = aircraft_observed_at + timedelta(seconds=STALE_FADE_THRESHOLD)
                    
                    compact_aircraft.append({
                        "id": hex_val,
                        "sourceObjectId": hex_val,
                        "callsign": raw_ac.get("flight", "").strip() if raw_ac.get("flight") else None,
                        "lat": lat,
                        "lon": lon,
                        "altitudeFt": raw_ac.get("alt_baro") if not isinstance(raw_ac.get("alt_baro"), str) else None,
                        "speedKt": raw_ac.get("gs"),
                        "trackDeg": raw_ac.get("track"),
                        "headingDeg": raw_ac.get("true_heading") or raw_ac.get("mag_heading"),
                        "verticalRateFpm": raw_ac.get("baro_rate"),
                        "onGround": raw_ac.get("alt_baro") == "ground" if raw_ac.get("alt_baro") else False,
                        "aircraftType": raw_ac.get("t"),
                        "registration": raw_ac.get("r"),
                        "observedAt": aircraft_observed_at.isoformat() if aircraft_observed_at else None,
                        "receivedAt": received_at.isoformat() if received_at else None,
                        "staleAfter": stale_after.isoformat() if stale_after else None,
                    })
                
                # Create snapshot metadata
                snapshot_time = observed_at if source_now is None else datetime.fromtimestamp(source_now, tz=timezone.utc)
                snapshot_id = f"snap_{int(time.time() * 1000)}"
                
                snapshot_metadata = {
                    "sourceMode": "global-web-json",
                    "upstream": "globe.airplanes.live/data/aircraft.json.gz",
                    "caveat": "experimental/dev globe web JSON source; no SLA/completeness claims",
                    "messages": source_messages,
                }
                
                upsert_live_snapshot(
                    conn=conn,
                    source_id=DEFAULT_SOURCE_ID,
                    source_name="Airplanes.live REST API v2",
                    snapshot_id=snapshot_id,
                    snapshot_time=snapshot_time,
                    aircraft_count=result["aircraft_processed"],
                    valid_position_count=valid_count,
                    aircraft_json=compact_aircraft,
                    metadata=snapshot_metadata,
                )
                print(f"[WORKER] Published live snapshot: {valid_count} aircraft with positions")
            except Exception as snap_err:
                print(f"[WORKER] ERROR publishing snapshot: {snap_err}")

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
    parser.add_argument(
        "--source-mode",
        type=str,
        choices=["rest", "global-web-json"],
        default="rest",
        help="Source mode: rest (official API) or global-web-json (globe snapshot)",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run one cycle and exit (default for rest mode)",
    )
    parser.add_argument(
        "--loop",
        action="store_true",
        help="Run continuously in a loop",
    )
    parser.add_argument(
        "--interval-seconds",
        type=int,
        default=GLOBAL_WEB_JSON_DEFAULT_INTERVAL_SECONDS,
        help="Interval between cycles in seconds (default: 5 for global-web-json, min 5)",
    )
    args = parser.parse_args()

    # Validate interval for global-web-json
    if args.source_mode == "global-web-json" and args.interval_seconds < GLOBAL_WEB_JSON_MIN_INTERVAL_SECONDS:
        print(f"[WORKER] WARNING: interval {args.interval_seconds}s < min {GLOBAL_WEB_JSON_MIN_INTERVAL_SECONDS}s, using minimum")
        args.interval_seconds = GLOBAL_WEB_JSON_MIN_INTERVAL_SECONDS

    # Determine run mode
    run_once = args.once
    run_loop = args.loop
    
    # Default behavior: run once for rest, run once for global-web-json unless --loop specified
    if not run_once and not run_loop:
        run_once = True

    if args.source_mode == "rest":
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
            source_mode=args.source_mode,
        )
    else:
        # Global web JSON mode
        if run_loop:
            print("[WORKER] WARNING: global-web-json uses Airplanes.live globe web data. Polling every 5s may be blocked or rate-limited. Use only where permitted.")
        
        cycle_count = 0
        consecutive_failures = 0
        try:
            while True:
                cycle_count += 1
                print(f"[WORKER] === Cycle {cycle_count} ===")
                
                try:
                    result = run_worker(
                        timeout=args.timeout_seconds,
                        persist=args.persist,
                        database_url=args.database_url,
                        source_mode=args.source_mode,
                    )
                    
                    # Check for failure/backoff condition
                    if result.get("errors"):
                        last_error = result["errors"][-1]
                        error_msg = last_error.get("error", "")
                        # Check HTTP status in errors if available
                        http_status = last_error.get("http_status")
                        
                        should_backoff = False
                        if http_status in GLOBAL_WEB_JSON_RETRY_STATUSES:
                            should_backoff = True
                        elif "403" in error_msg or "429" in error_msg:
                            should_backoff = True
                        
                        if should_backoff:
                            consecutive_failures += 1
                            print(f"[WORKER] ERROR: Got retryable status, backing off {GLOBAL_WEB_JSON_BACKOFF_SECONDS}s (failure {consecutive_failures})")
                            time.sleep(GLOBAL_WEB_JSON_BACKOFF_SECONDS)
                            continue
                    
                    # Success - reset failure counter
                    consecutive_failures = 0
                    
                except KeyboardInterrupt:
                    print("[WORKER] Interrupted by user, exiting...")
                    break
                
                if not run_loop:
                    break
                    
                print(f"[WORKER] Sleeping {args.interval_seconds}s until next cycle...")
                time.sleep(args.interval_seconds)
        except KeyboardInterrupt:
            print("[WORKER] Interrupted by user, exiting cleanly...")


if __name__ == "__main__":
    main()