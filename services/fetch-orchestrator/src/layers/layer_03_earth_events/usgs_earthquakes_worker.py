"""USGS Earth Events Fetcher — WO-072.

Fetches earthquake data from USGS Earthquake Hazards Program GeoJSON feed.

Usage:
    python services/fetch-orchestrator/src/layers/layer_03_earth_events/usgs_earthquakes_worker.py

    python services/fetch-orchestrator/src/layers/layer_03_earth_events/usgs_earthquakes_worker.py --persist

Source: https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson

No API key required. No token required.
"""

from __future__ import annotations

import argparse
import io
import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Fix Windows console encoding for Unicode (only when run directly, not in pytest)
if sys.platform == "win32" and "pytest" not in sys.modules:
    try:
        import codecs
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    except Exception:
        pass  # Ignore if already redirected or fails

REPO_ROOT = Path(__file__).resolve().parents[5]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

sys.path.insert(0, str(REPO_ROOT / "services" / "fetch-orchestrator" / "src" / "layers" / "layer_03_earth_events"))

from earth_events_db import (
    DEFAULT_DATABASE_URL,
    connect_db,
    upsert_earth_event,
    append_to_history,
    get_latest_count,
    get_history_count,
    LAYER_ID,
    SOURCE_ID,
)

USGS_FEED_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson"
DEFAULT_USER_AGENT = "GodEyes/0.1 (earth-events-fetcher; +https://github.com/god-eyes)"


def fetch_usgs_geojson(timeout: int = 30) -> dict[str, Any] | None:
    """Fetch USGS GeoJSON feed with timeout protection."""
    req = urllib.request.Request(USGS_FEED_URL, headers={"User-Agent": DEFAULT_USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            data = json.loads(raw)
            return data
    except urllib.error.HTTPError as exc:
        print(f"[FETCH] HTTP error {exc.code}: {exc.reason}")
        return None
    except urllib.error.URLError as exc:
        print(f"[FETCH] URL error: {exc.reason}")
        return None
    except json.JSONDecodeError as exc:
        print(f"[FETCH] Invalid JSON: {exc}")
        return None
    except Exception as exc:
        print(f"[FETCH] Error: {exc}")
        return None


def validate_geojson(data: dict[str, Any]) -> bool:
    """Validate response is a GeoJSON FeatureCollection."""
    if not isinstance(data, dict):
        return False
    if data.get("type") != "FeatureCollection":
        return False
    if "features" not in data:
        return False
    return True


def normalize_usgs_feature(feature: dict[str, Any]) -> dict[str, Any] | None:
    """Normalize USGS feature to internal Earth Events shape."""
    try:
        props = feature.get("properties", {})
        geom = feature.get("geometry", {})
        coords = geom.get("coordinates", [])

        # Geometry: [longitude, latitude, depth]
        lon = coords[0] if len(coords) > 0 else None
        lat = coords[1] if len(coords) > 1 else None
        depth = coords[2] if len(coords) > 2 else None

        if lon is None or lat is None:
            return None

        # Convert timestamps (milliseconds to datetime)
        observed_ts = props.get("time")
        updated_ts = props.get("updated")
        
        observed_at = (
            datetime.fromtimestamp(observed_ts / 1000, tz=timezone.utc)
            if observed_ts else datetime.now(timezone.utc)
        )
        updated_at = (
            datetime.fromtimestamp(updated_ts / 1000, tz=timezone.utc)
            if updated_ts else datetime.now(timezone.utc)
        )
        fetched_at = datetime.now(timezone.utc)

        # Build useful properties JSON (excluding large nested structures)
        useful_props = {
            "mag": props.get("mag"),
            "magType": props.get("magType"),
            "place": props.get("place"),
            "type": props.get("type"),
            "alert": props.get("alert"),
            "tz": props.get("tz"),
            "felt": props.get("felt"),
            "cdi": props.get("cdi"),
            "mmi": props.get("mmi"),
            "sig": props.get("sig"),
            "tsunami": props.get("tsunami"),
            "url": props.get("url"),
            "detail": props.get("detail"),
            "type": props.get("type"),
            "title": props.get("title"),
            "status": props.get("status"),
        }

        return {
            "layer_id": LAYER_ID,
            "source_id": SOURCE_ID,
            "source_object_id": str(feature.get("id", "")),
            "event_type": "earthquake",
            "magnitude": props.get("mag"),
            "magnitude_type": props.get("magType"),
            "depth_km": depth,
            "place": props.get("place"),
            "alert_level": props.get("alert"),
            "significance": props.get("sig"),
            "tsunami": props.get("tsunami", 0) == 1,
            "geometry_wkt": f"POINT({lon} {lat})",
            "source_url": props.get("url"),
            "observed_at": observed_at,
            "updated_at": updated_at,
            "fetched_at": fetched_at,
            "properties_json": useful_props,
        }
    except Exception as e:
        print(f"[NORMALIZE] Error: {e}")
        return None


def run_fetcher(
    dry_run: bool = True,
    database_url: str | None = None,
    show_raw: bool = False,
) -> dict[str, Any]:
    """Run the USGS Earth Events fetcher."""
    db_url = database_url or DEFAULT_DATABASE_URL

    result = {
        "source": USGS_FEED_URL,
        "features_fetched": 0,
        "features_valid": 0,
        "features_normalized": 0,
        "written_latest": 0,
        "written_history": 0,
        "skipped_older": 0,
        "errors": [],
    }

    print(f"[FETCH] Fetching USGS earthquake data from:\n  {USGS_FEED_URL}")

    data = fetch_usgs_geojson()
    if data is None:
        result["errors"].append("Failed to fetch data")
        print("[FETCH] FAILED: Could not fetch USGS data")
        return result

    if not validate_geojson(data):
        result["errors"].append("Invalid GeoJSON response")
        print("[FETCH] FAILED: Response is not a valid GeoJSON FeatureCollection")
        return result

    features = data.get("features", [])
    result["features_fetched"] = len(features)
    print(f"[FETCH] Fetched {len(features)} features")

    # Normalize features
    normalized = []
    for feat in features:
        norm = normalize_usgs_feature(feat)
        if norm:
            normalized.append(norm)

    result["features_valid"] = len(normalized)
    print(f"[FETCH] Normalized {len(normalized)} valid earthquake events")

    if show_raw and normalized:
        print("\n[SAMPLE] First normalized record:")
        sample = normalized[0]
        print(f"  source_object_id: {sample['source_object_id']}")
        print(f"  place: {sample['place']}")
        print(f"  magnitude: {sample['magnitude']}")
        print(f"  depth_km: {sample['depth_km']}")
        print(f"  observed_at: {sample['observed_at']}")
        print(f"  geometry: {sample['geometry_wkt']}")

    if dry_run:
        print("\n[DRY-RUN] Would process the following:")
        for i, evt in enumerate(normalized[:5]):
            print(f"  {i+1}. {evt['place']} | mag={evt['magnitude']} | {evt['observed_at']}")
        if len(normalized) > 5:
            print(f"  ... and {len(normalized) - 5} more")
        print("\n[DRY-RUN] Use --persist to write to database")
        result["features_normalized"] = len(normalized)
        return result

    # Persist mode
    print(f"\n[PERSIST] Connecting to database...")
    try:
        conn = connect_db(db_url)
    except Exception as e:
        result["errors"].append(f"DB connection failed: {e}")
        print(f"[PERSIST] ERROR: Could not connect to database: {e}")
        return result

    # Get initial counts
    before_latest = get_latest_count(conn)
    before_history = get_history_count(conn)
    print(f"[PERSIST] Before: latest={before_latest}, history={before_history}")

    try:
        for evt in normalized:
            # Upsert into latest
            event_id, is_new_or_updated = upsert_earth_event(
                conn=conn,
                layer_id=evt["layer_id"],
                source_id=evt["source_id"],
                source_object_id=evt["source_object_id"],
                event_type=evt["event_type"],
                magnitude=evt["magnitude"],
                magnitude_type=evt["magnitude_type"],
                depth_km=evt["depth_km"],
                place=evt["place"],
                alert_level=evt["alert_level"],
                significance=evt["significance"],
                tsunami=evt["tsunami"],
                geometry_wkt=evt["geometry_wkt"],
                source_url=evt["source_url"],
                observed_at=evt["observed_at"],
                updated_at=evt["updated_at"],
                fetched_at=evt["fetched_at"],
                properties_json=evt["properties_json"],
            )

            if is_new_or_updated:
                result["written_latest"] += 1
                # Append to history
                append_to_history(
                    conn=conn,
                    layer_id=evt["layer_id"],
                    source_id=evt["source_id"],
                    source_object_id=evt["source_object_id"],
                    event_type=evt["event_type"],
                    magnitude=evt["magnitude"],
                    depth_km=evt["depth_km"],
                    place=evt["place"],
                    alert_level=evt["alert_level"],
                    geometry_wkt=evt["geometry_wkt"],
                    source_url=evt["source_url"],
                    observed_at=evt["observed_at"],
                    updated_at=evt["updated_at"],
                    fetched_at=evt["fetched_at"],
                    properties_json=evt["properties_json"],
                )
                result["written_history"] += 1
            else:
                result["skipped_older"] += 1

        # Get final counts
        after_latest = get_latest_count(conn)
        after_history = get_history_count(conn)

        print(f"[PERSIST] After: latest={after_latest}, history={after_history}")
        print(f"[PERSIST] New/updated in latest: {result['written_latest']}")
        print(f"[PERSIST] Appended to history: {result['written_history']}")
        print(f"[PERSIST] Skipped (older): {result['skipped_older']}")
        print("[PERSIST] Done.")

    except Exception as e:
        result["errors"].append(str(e))
        print(f"[PERSIST] ERROR: {e}")
    finally:
        conn.close()

    result["features_normalized"] = len(normalized)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(
        description="USGS Earth Events Fetcher — fetch earthquake GeoJSON and persist"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=True,
        help="Do not write to database (default)",
    )
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
        "--show-raw",
        action="store_true",
        help="Print sample normalized records",
    )
    args = parser.parse_args()

    if not args.persist:
        print("[WORKER] Defaulting to dry-run mode (use --persist to write to DB)")
        args.dry_run = True
    else:
        args.dry_run = False

    result = run_fetcher(
        dry_run=args.dry_run,
        database_url=args.database_url,
        show_raw=args.show_raw,
    )

    print("\n[SUMMARY]")
    print(f"  Features fetched: {result['features_fetched']}")
    print(f"  Features normalized: {result['features_normalized']}")
    if not args.dry_run:
        print(f"  Written to latest: {result['written_latest']}")
        print(f"  Appended to history: {result['written_history']}")
        print(f"  Skipped (older): {result['skipped_older']}")

    if result["errors"]:
        print(f"  Errors: {result['errors']}")
        sys.exit(1)


if __name__ == "__main__":
    main()