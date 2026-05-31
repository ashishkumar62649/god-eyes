"""Space Satellites Worker — Fetches TLE data and computes positions.

Fetches satellite TLE data from CelesTrak, normalizes records,
computes orbital positions, and persists to database.

Usage:
    python services/fetch-orchestrator/src/layers/layer_05_space_satellites/space_satellites_worker.py
    
    python services/fetch-orchestrator/src/layers/layer_05_space_satellites/space_satellites_worker.py --persist
    
    python services/fetch-orchestrator/src/layers/layer_05_space_satellites/space_satellites_worker.py --source celestrak --group starlink --persist

Source: CelesTrak public TLE feeds (no API key required)
"""

from __future__ import annotations

import argparse
import io
import sys
from datetime import datetime, timezone
from pathlib import Path

# Fix Windows console encoding
if sys.platform == "win32" and "pytest" not in sys.modules:
    try:
        import codecs
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    except Exception:
        pass

REPO_ROOT = Path(__file__).resolve().parents[5]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

sys.path.insert(0, str(REPO_ROOT / "services" / "fetch-orchestrator" / "src" / "layers" / "layer_05_space_satellites"))

from celestrak_client import fetch_tle_group, CELESTRAK_GROUPS, get_group_display_name
from tle_parser import normalize_records, LAYER_ID, SOURCE_ID
from classification import classify_object, get_visual_shape, get_visual_color
from orbit_propagation import compute_position_from_tle
from space_satellites_db import (
    DEFAULT_DATABASE_URL,
    connect_db,
    upsert_satellite,
    upsert_position,
    get_satellite_count,
    get_position_count,
)

# Default groups to fetch for MVP
DEFAULT_GROUPS = ["active", "stations"]


def run_worker(
    groups: list[str] | None = None,
    source: str = "celestrak",
    dry_run: bool = True,
    database_url: str | None = None,
    max_objects: int | None = None,
    show_raw: bool = False,
) -> dict[str, Any]:
    """Run the Space Satellites fetcher worker.
    
    Args:
        groups: List of CelesTrak groups to fetch (default: active, stations)
        source: Source identifier (default: celestrak)
        dry_run: If True, don't write to database
        database_url: PostgreSQL connection URL
        max_objects: Maximum objects to process (for safe testing)
        show_raw: If True, print sample normalized records
        
    Returns:
        Result dictionary with statistics
    """
    db_url = database_url or DEFAULT_DATABASE_URL
    
    if groups is None:
        groups = DEFAULT_GROUPS
        
    result = {
        "source": source,
        "groups": groups,
        "tle_fetched": 0,
        "tle_normalized": 0,
        "positions_computed": 0,
        "catalog_written": 0,
        "position_written": 0,
        "skipped_older": 0,
        "errors": [],
    }
    
    print(f"[WORKER] Space Satellites Fetcher")
    print(f"  Source: {source}")
    print(f"  Groups: {', '.join(groups)}")
    print(f"  Mode: {'DRY-RUN' if dry_run else 'PERSIST'}")
    print()
    
    # Connect to database if not dry-run
    conn = None
    if not dry_run:
        print(f"[DB] Connecting to database...")
        try:
            conn = connect_db(db_url)
            before_catalog = get_satellite_count(conn)
            before_positions = get_position_count(conn)
            print(f"[DB] Before: catalog={before_catalog}, positions={before_positions}")
        except Exception as e:
            result["errors"].append(f"DB connection failed: {e}")
            print(f"[DB] ERROR: Could not connect: {e}")
            return result
    
    # Fetch TLE data for each group
    all_records = []
    for group in groups:
        print(f"[FETCH] Fetching '{group}' group from CelesTrak...")
        records = fetch_tle_group(group)
        
        if records:
            print(f"  Fetched {len(records)} TLE records")
            all_records.extend(records)
            result["tle_fetched"] += len(records)
        else:
            print(f"  Failed to fetch or no records")
            result["errors"].append(f"Failed to fetch group: {group}")
    
    print(f"\n[FETCH] Total TLE records: {result['tle_fetched']}")
    
    # Limit if requested
    if max_objects and len(all_records) > max_objects:
        print(f"[FETCH] Limiting to {max_objects} objects (from {len(all_records)})")
        all_records = all_records[:max_objects]
    
    # Normalize records
    print(f"\n[NORMALIZE] Normalizing {len(all_records)} TLE records...")
    normalized = normalize_records(all_records)
    result["tle_normalized"] = len(normalized)
    print(f"  Normalized: {len(normalized)} satellite records")
    
    if show_raw and normalized:
        print("\n[SAMPLE] First normalized record:")
        s = normalized[0]
        print(f"  norad_cat_id: {s.norad_cat_id}")
        print(f"  name: {s.name}")
        print(f"  object_type: {s.object_type}")
        print(f"  category: {s.category}")
        print(f"  orbit_class: {s.orbit_class}")
        print(f"  is_important: {s.is_important}")
    
    # Compute positions and classify
    print(f"\n[COMPUTE] Computing orbital positions...")
    for sat in normalized:
        classification = classify_object(
            name=sat.name,
            norad_cat_id=sat.norad_cat_id,
            tle_line1=sat.tle_line1,
            tle_line2=sat.tle_line2,
        )
        
        # Add classification to satellite
        sat.object_type = classification.get("object_type", sat.object_type)
        sat.category = classification.get("category", sat.category)
        sat.orbit_class = classification.get("orbit_class", sat.orbit_class)
        sat.is_important = classification.get("is_important", sat.is_important)
        
        # Compute position from TLE
        if sat.tle_line1 and sat.tle_line2:
            position = compute_position_from_tle(
                sat.tle_line1,
                sat.tle_line2,
                orbital_epoch=sat.orbital_epoch_at,
            )
            
            if position:
                result["positions_computed"] += 1
                
                # Add visual properties
                position.visual_shape = get_visual_shape(sat.object_type)
                position.visual_color = get_visual_color(
                    orbit_class=sat.orbit_class,
                    altitude_km=position.altitude_km,
                    object_type=sat.object_type,
                    category=sat.category,
                    is_important=sat.is_important,
                )
                
                # Store position on satellite for DB write
                sat._position = position
    
    print(f"  Computed: {result['positions_computed']} positions")
    
    if dry_run:
        print("\n[DRY-RUN] Would process:")
        for i, sat in enumerate(normalized[:5]):
            pos = getattr(sat, "_position", None)
            print(f"  {i+1}. {sat.name}")
            print(f"      norad={sat.norad_cat_id}, type={sat.object_type}, cat={sat.category}")
            if pos:
                print(f"      pos: {pos.latitude:.2f}, {pos.longitude:.2f}, {pos.altitude_km:.0f}km")
        if len(normalized) > 5:
            print(f"  ... and {len(normalized) - 5} more")
        print("\n[DRY-RUN] Use --persist to write to database")
        return result
    
    # Persist to database
    if not conn:
        print("[DB] No connection, cannot persist")
        return result
    
    print(f"\n[PERSIST] Writing to database...")
    
    try:
        for sat in normalized:
            # Upsert satellite catalog
            satellite_id, is_new_or_updated = upsert_satellite(
                conn=conn,
                layer_id=LAYER_ID,
                source_id=SOURCE_ID,
                source_object_id=sat.source_object_id,
                norad_cat_id=sat.norad_cat_id,
                name=sat.name,
                object_type=sat.object_type,
                category=sat.category,
                orbit_class=sat.orbit_class,
                country=sat.country,
                operator_or_owner=sat.operator_or_owner,
                launch_date=sat.launch_date,
                tle_line1=sat.tle_line1,
                tle_line2=sat.tle_line2,
                orbital_epoch_at=sat.orbital_epoch_at,
                source_updated_at=sat.source_updated_at,
                is_active=sat.is_active,
                is_important=sat.is_important,
                raw_source_json=sat.raw_source_json,
            )
            
            if is_new_or_updated:
                result["catalog_written"] += 1
            else:
                result["skipped_older"] += 1
            
            # Upsert position if computed
            pos = getattr(sat, "_position", None)
            if pos and satellite_id:
                upsert_position(
                    conn=conn,
                    satellite_id=satellite_id,
                    layer_id=LAYER_ID,
                    source_id=SOURCE_ID,
                    source_object_id=sat.source_object_id,
                    norad_cat_id=sat.norad_cat_id,
                    estimated_at=pos.estimated_at,
                    latitude=pos.latitude,
                    longitude=pos.longitude,
                    altitude_km=pos.altitude_km,
                    velocity_kms=pos.velocity_kms,
                    heading_deg=pos.heading_deg,
                    orbit_class=sat.orbit_class,
                    object_type=sat.object_type,
                    category=sat.category,
                    visual_shape=pos.visual_shape,
                    visual_color=pos.visual_color,
                    is_important=sat.is_important,
                    source_age_seconds=pos.source_age_seconds,
                    computation_method=pos.computation_method,
                    raw_position_json=pos.raw_position_json,
                )
                result["position_written"] += 1
        
        # Get final counts
        after_catalog = get_satellite_count(conn)
        after_positions = get_position_count(conn)
        
        print(f"[DB] After: catalog={after_catalog}, positions={after_positions}")
        print(f"[PERSIST] Catalog upserted: {result['catalog_written']}")
        print(f"[PERSIST] Positions written: {result['position_written']}")
        print(f"[PERSIST] Skipped (older): {result['skipped_older']}")
        print("[PERSIST] Done.")
        
    except Exception as e:
        result["errors"].append(str(e))
        print(f"[PERSIST] ERROR: {e}")
    finally:
        if conn:
            conn.close()
    
    return result


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Space Satellites Fetcher — fetch TLE data and persist"
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
        "--source",
        type=str,
        default="celestrak",
        help="Data source (default: celestrak)",
    )
    parser.add_argument(
        "--group",
        type=str,
        action="append",
        dest="groups",
        help=f"CelesTrak group to fetch (can be repeated). Available: {', '.join(CELESTRAK_GROUPS)}",
    )
    parser.add_argument(
        "--database-url",
        type=str,
        default=None,
        help="PostgreSQL connection URL",
    )
    parser.add_argument(
        "--max-objects",
        type=int,
        default=None,
        help="Maximum objects to process (for safe testing)",
    )
    parser.add_argument(
        "--show-raw",
        action="store_true",
        help="Print sample normalized records",
    )
    args = parser.parse_args()
    
    # Set groups
    groups = args.groups if args.groups else DEFAULT_GROUPS
    
    # Determine dry-run mode
    if not args.persist:
        print("[WORKER] Defaulting to dry-run mode (use --persist to write to DB)")
        dry_run = True
    else:
        dry_run = False
    
    result = run_worker(
        groups=groups,
        source=args.source,
        dry_run=dry_run,
        database_url=args.database_url,
        max_objects=args.max_objects,
        show_raw=args.show_raw,
    )
    
    print("\n[SUMMARY]")
    print(f"  Groups processed: {', '.join(result['groups'])}")
    print(f"  TLE records fetched: {result['tle_fetched']}")
    print(f"  TLE records normalized: {result['tle_normalized']}")
    print(f"  Positions computed: {result['positions_computed']}")
    if not dry_run:
        print(f"  Catalog written: {result['catalog_written']}")
        print(f"  Positions written: {result['position_written']}")
        print(f"  Skipped (older): {result['skipped_older']}")
    
    if result["errors"]:
        print(f"  Errors: {result['errors']}")
        sys.exit(1)


if __name__ == "__main__":
    main()