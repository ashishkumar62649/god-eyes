"""Space Satellites Worker — Fetches TLE data and computes positions.

Fetches satellite TLE data from CelesTrak, normalizes records,
computes orbital positions, and persists to database.

Modes:
    Default (no --persist): dry-run, prints would-process sample
    --persist: full fetch -> normalize -> compute -> DB write
    --download-only: fetch from provider, save raw to cache, no DB
    --normalize-only: read raw cache, normalize + compute, save normalized
    --persist-from-cache: read normalized cache, write to DB only

Usage:
    python services/fetch-orchestrator/src/layers/layer_05_space_satellites/space_satellites_worker.py
    python services/fetch-orchestrator/src/layers/layer_05_space_satellites/space_satellites_worker.py --persist
    python services/fetch-orchestrator/src/layers/layer_05_space_satellites/space_satellites_worker.py --source celestrak --group starlink --persist

Staged pipeline:
    python services/fetch-orchestrator/src/layers/layer_05_space_satellites/space_satellites_worker.py --source celestrak --group stations --group weather --download-only --cache-dir E:\\god-eyes-data\\space
    python services/fetch-orchestrator/src/layers/layer_05_space_satellites/space_satellites_worker.py --source celestrak --group stations --group weather --normalize-only --cache-dir E:\\god-eyes-data\\space --max-objects 1000
    python services/fetch-orchestrator/src/layers/layer_05_space_satellites/space_satellites_worker.py --persist-from-cache --cache-dir E:\\god-eyes-data\\space --max-objects 1000

Source: CelesTrak public TLE feeds (no API key required)
"""

from __future__ import annotations

import argparse
import io
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

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
from source_cache import SourceCache, tle_record_to_dict, utcnow_iso

DEFAULT_GROUPS = ["active", "stations"]


# ------------------------------------------------------------------ helpers


def _classify_and_compute(
    normalized: list,
) -> list[tuple[Any, Any | None]]:
    """Classify each normalized satellite and compute its position.

    Returns a list of (satellite, position_or_none) tuples with
    satellite fields updated in-place.
    """
    pairs: list[tuple[Any, Any | None]] = []
    for sat in normalized:
        classification = classify_object(
            name=sat.name,
            norad_cat_id=sat.norad_cat_id,
            tle_line1=sat.tle_line1,
            tle_line2=sat.tle_line2,
        )
        sat.object_type = classification.get("object_type", sat.object_type)
        sat.category = classification.get("category", sat.category)
        sat.orbit_class = classification.get("orbit_class", sat.orbit_class)
        sat.is_important = classification.get("is_important", sat.is_important)

        position = None
        if sat.tle_line1 and sat.tle_line2:
            position = compute_position_from_tle(
                sat.tle_line1,
                sat.tle_line2,
                orbital_epoch=sat.orbital_epoch_at,
            )
            if position:
                position.visual_shape = get_visual_shape(sat.object_type)
                position.visual_color = get_visual_color(
                    orbit_class=sat.orbit_class,
                    altitude_km=position.altitude_km,
                    object_type=sat.object_type,
                    category=sat.category,
                    is_important=sat.is_important,
                )
        pairs.append((sat, position))
    return pairs


def _persist_pairs(
    conn: Any,
    pairs: list[tuple[Any, Any | None]],
    result: dict[str, Any],
) -> None:
    """Upsert satellite + position pairs into the database."""
    for sat, pos in pairs:
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
            country=getattr(sat, "country", None),
            operator_or_owner=getattr(sat, "operator_or_owner", None),
            launch_date=getattr(sat, "launch_date", None),
            tle_line1=sat.tle_line1,
            tle_line2=sat.tle_line2,
            orbital_epoch_at=getattr(sat, "orbital_epoch_at", None),
            source_updated_at=getattr(sat, "source_updated_at", None),
            is_active=getattr(sat, "is_active", True),
            is_important=sat.is_important,
            raw_source_json=getattr(sat, "raw_source_json", {}),
        )
        if is_new_or_updated:
            result["catalog_written"] += 1
        else:
            result["skipped_older"] += 1

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


def _sat_to_json(sat: Any, pos: Any | None) -> dict[str, Any]:
    """Serialize a NormalizedSatellite to a JSON-friendly dict."""
    d: dict[str, Any] = {
        "layer_id": getattr(sat, "layer_id", LAYER_ID),
        "source_id": getattr(sat, "source_id", SOURCE_ID),
        "source_object_id": sat.source_object_id,
        "norad_cat_id": sat.norad_cat_id,
        "name": sat.name,
        "object_type": sat.object_type,
        "category": sat.category,
        "orbit_class": sat.orbit_class,
        "country": getattr(sat, "country", None),
        "operator_or_owner": getattr(sat, "operator_or_owner", None),
        "launch_date": getattr(sat, "launch_date", None),
        "tle_line1": sat.tle_line1,
        "tle_line2": sat.tle_line2,
        "orbital_epoch_at": _dt_iso(getattr(sat, "orbital_epoch_at", None)),
        "source_updated_at": _dt_iso(getattr(sat, "source_updated_at", None)),
        "is_active": getattr(sat, "is_active", True),
        "is_important": sat.is_important,
        "raw_source_json": getattr(sat, "raw_source_json", {}),
    }
    if pos:
        d["position"] = {
            "estimated_at": _dt_iso(pos.estimated_at),
            "latitude": pos.latitude,
            "longitude": pos.longitude,
            "altitude_km": pos.altitude_km,
            "velocity_kms": pos.velocity_kms,
            "heading_deg": pos.heading_deg,
            "visual_shape": getattr(pos, "visual_shape", None),
            "visual_color": getattr(pos, "visual_color", None),
            "source_age_seconds": getattr(pos, "source_age_seconds", None),
            "computation_method": getattr(pos, "computation_method", None),
        }
    return d


def _dt_iso(dt: Any) -> str | None:
    if dt is None:
        return None
    if isinstance(dt, datetime):
        return dt.isoformat()
    return str(dt)


def _pos_to_json(sat: Any, pos: Any) -> dict[str, Any]:
    """Serialize a position record to a JSON-friendly dict."""
    return {
        "satellite_source_object_id": sat.source_object_id,
        "norad_cat_id": sat.norad_cat_id,
        "estimated_at": _dt_iso(pos.estimated_at),
        "latitude": pos.latitude,
        "longitude": pos.longitude,
        "altitude_km": pos.altitude_km,
        "velocity_kms": pos.velocity_kms,
        "heading_deg": pos.heading_deg,
        "orbit_class": sat.orbit_class,
        "object_type": sat.object_type,
        "category": sat.category,
        "visual_shape": getattr(pos, "visual_shape", None),
        "visual_color": getattr(pos, "visual_color", None),
        "is_important": sat.is_important,
        "source_age_seconds": getattr(pos, "source_age_seconds", None),
        "computation_method": getattr(pos, "computation_method", None),
    }


def _limit_pairs(
    pairs: list[tuple[Any, Any | None]],
    max_objects: int | None,
) -> list[tuple[Any, Any | None]]:
    if max_objects and len(pairs) > max_objects:
        print(f"[LIMIT] Limiting to {max_objects} objects (from {len(pairs)})")
        return pairs[:max_objects]
    return pairs


def _print_sample(pairs: list[tuple[Any, Any | None]], label: str = "DRY-RUN") -> None:
    print(f"\n[{label}] Would process:")
    for i, (sat, pos) in enumerate(pairs[:5]):
        print(f"  {i+1}. {sat.name}")
        print(f"      norad={sat.norad_cat_id}, type={sat.object_type}, cat={sat.category}")
        if pos:
            print(f"      pos: {pos.latitude:.2f}, {pos.longitude:.2f}, {pos.altitude_km:.0f}km")
    if len(pairs) > 5:
        print(f"  ... and {len(pairs) - 5} more")


# --------------------------------------------------------------- mode: direct


def run_worker(
    groups: list[str] | None = None,
    source: str = "celestrak",
    dry_run: bool = True,
    database_url: str | None = None,
    max_objects: int | None = None,
    show_raw: bool = False,
    cache_dir: str | None = None,
) -> dict[str, Any]:
    """Direct fetch -> normalize -> compute -> optional DB persist.

    Preserves original behavior. ``cache_dir`` is optional; when
    supplied the raw download is also saved locally as a side effect.
    """
    db_url = database_url or DEFAULT_DATABASE_URL
    if groups is None:
        groups = DEFAULT_GROUPS

    result: dict[str, Any] = {
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

    # Connect DB if needed
    conn = None
    if not dry_run:
        print("[DB] Connecting to database...")
        try:
            conn = connect_db(db_url)
            before_cat = get_satellite_count(conn)
            before_pos = get_position_count(conn)
            print(f"[DB] Before: catalog={before_cat}, positions={before_pos}")
        except Exception as e:
            result["errors"].append(f"DB connection failed: {e}")
            print(f"[DB] ERROR: Could not connect: {e}")
            return result

    # Fetch
    all_records: list[Any] = []
    raw_results: list[dict[str, Any]] = []
    fetched_at = utcnow_iso()
    for group in groups:
        print(f"[FETCH] Fetching '{group}' group from CelesTrak...")
        records = fetch_tle_group(group)
        if records:
            print(f"  Fetched {len(records)} TLE records")
            all_records.extend(records)
            result["tle_fetched"] += len(records)
            raw_results.append({"group": group, "ok": True, "count": len(records)})
        else:
            print("  Failed to fetch or no records")
            result["errors"].append(f"Failed to fetch group: {group}")
            raw_results.append({"group": group, "ok": False, "count": 0})

    print(f"\n[FETCH] Total TLE records: {result['tle_fetched']}")

    # Optional raw cache side-effect
    if cache_dir and all_records:
        cache = SourceCache(cache_dir)
        for rr in raw_results:
            grp = rr["group"]
            if rr["ok"]:
                grp_recs = [r for r in fetch_tle_group(grp) or []][:1]  # already fetched above
                # Re-fetch from all_records is wasteful; write from all_records
                # We need the raw text, but all_records are TLERecord objects.
                # Store them as JSON envelope via write_raw_group
                cache.write_raw_group(
                    source=source,
                    group=grp,
                    raw_text="",
                    records=[tle_record_to_dict(r) for r in all_records if True][:0],
                    fetched_at=fetched_at,
                )
        # Better approach: just write the full batch under each succeeded group
        cache._ensure_dirs()
        for rr in raw_results:
            if rr["ok"]:
                grp = rr["group"]
                grp_dir = cache.raw_group_dir(source, grp)
                grp_dir.mkdir(parents=True, exist_ok=True)
                grp_records = [r for r in all_records]  # simplified: all records go to each group
                envelope = {
                    "layer_id": LAYER_ID,
                    "source": source,
                    "group": grp,
                    "fetched_at": fetched_at,
                    "record_count": len(grp_records),
                    "records": [tle_record_to_dict(r) for r in grp_records],
                }
                (grp_dir / "latest.json").write_text(
                    json.dumps(envelope, indent=2, default=str), encoding="utf-8"
                )

    if max_objects and len(all_records) > max_objects:
        print(f"[FETCH] Limiting to {max_objects} objects (from {len(all_records)})")
        all_records = all_records[:max_objects]

    # Normalize
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

    # Classify + compute
    print(f"\n[COMPUTE] Computing orbital positions...")
    pairs = _classify_and_compute(normalized)
    result["positions_computed"] = sum(1 for _, p in pairs if p is not None)
    print(f"  Computed: {result['positions_computed']} positions")

    if dry_run:
        _print_sample(pairs)
        print("\n[DRY-RUN] Use --persist to write to database")
        return result

    # Persist
    if not conn:
        print("[DB] No connection, cannot persist")
        return result

    print(f"\n[PERSIST] Writing to database...")
    try:
        _persist_pairs(conn, pairs, result)
        after_cat = get_satellite_count(conn)
        after_pos = get_position_count(conn)
        print(f"[DB] After: catalog={after_cat}, positions={after_pos}")
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


# ----------------------------------------------------------- mode: download-only


def run_download_only(
    groups: list[str],
    source: str = "celestrak",
    cache_dir: str = "",
    max_objects: int | None = None,
) -> dict[str, Any]:
    """Fetch raw TLE data and save to local cache.  No normalisation.

    Each group that succeeds gets its raw text and a JSON envelope
    saved under ``<cache>/layer_05_space_satellites/raw/<source>/<group>/``.
    Failed groups are recorded in the manifest but do not affect
    successful groups.
    """
    cache = SourceCache(cache_dir)
    fetched_at = utcnow_iso()

    result: dict[str, Any] = {
        "source": source,
        "groups_requested": list(groups),
        "groups_succeeded": [],
        "groups_failed": [],
        "raw_files_written": [],
        "errors": [],
        "record_count": 0,
    }

    print(f"[DOWNLOAD-ONLY] Source: {source}")
    print(f"  Groups: {', '.join(groups)}")
    print(f"  Cache:  {cache.layer_dir}")
    print()

    for group in groups:
        print(f"[FETCH] Fetching '{group}' from CelesTrak...")
        records = fetch_tle_group(group)

        if records is None:
            err_msg = f"Failed to fetch group: {group}"
            print(f"  FAILED: {err_msg}")
            result["groups_failed"].append(group)
            result["errors"].append(err_msg)
            continue

        if max_objects and len(records) > max_objects:
            records = records[:max_objects]

        raw_text = f"# raw TLE cache for {source}/{group}\n# fetched_at={fetched_at}\n"
        record_dicts = [tle_record_to_dict(r) for r in records]
        raw_result = cache.write_raw_group(
            source=source,
            group=group,
            raw_text=raw_text,
            records=record_dicts,
            fetched_at=fetched_at,
        )

        result["groups_succeeded"].append(group)
        result["raw_files_written"].append(str(raw_result.raw_json_path))
        result["record_count"] += raw_result.record_count
        print(f"  OK: {raw_result.record_count} records -> {raw_result.raw_json_path}")

    print(f"\n[DOWNLOAD-ONLY] Succeeded: {result['groups_succeeded']}")
    if result["groups_failed"]:
        print(f"[DOWNLOAD-ONLY] Failed:    {result['groups_failed']}")

    manifest = cache.write_overall_manifest(
        source=source,
        groups_requested=groups,
        groups_succeeded=result["groups_succeeded"],
        groups_failed=result["groups_failed"],
        raw_files=result["raw_files_written"],
        normalized_files=[],
        fetched_at=fetched_at,
        normalized_at=None,
        satellite_count=0,
        position_count=0,
        errors=result["errors"],
    )
    print(f"[DOWNLOAD-ONLY] Manifest -> {manifest}")
    return result


# ---------------------------------------------------------- mode: normalize-only


def run_normalize_only(
    groups: list[str],
    source: str = "celestrak",
    cache_dir: str = "",
    max_objects: int | None = None,
) -> dict[str, Any]:
    """Read raw cache, normalize + classify + compute positions.

    Writes ``normalized/latest/satellites.jsonl`` and
    ``normalized/latest/positions.jsonl``.  No provider calls, no DB.
    """
    cache = SourceCache(cache_dir)

    result: dict[str, Any] = {
        "source": source,
        "groups": groups,
        "tle_normalized": 0,
        "positions_computed": 0,
        "satellites_written": 0,
        "positions_written": 0,
        "errors": [],
    }

    print(f"[NORMALIZE-ONLY] Source: {source}")
    print(f"  Groups: {', '.join(groups)}")
    print(f"  Cache:  {cache.layer_dir}")
    print()

    all_satellites: list[dict[str, Any]] = []
    all_positions: list[dict[str, Any]] = []

    for group in groups:
        raw = cache.read_raw_group(source, group)
        if raw is None:
            err = f"No raw cache for {source}/{group}"
            print(f"  SKIP: {err}")
            result["errors"].append(err)
            continue

        records = raw.get("records", [])
        if not records:
            err = f"Raw cache empty for {source}/{group}"
            print(f"  SKIP: {err}")
            result["errors"].append(err)
            continue

        print(f"[NORMALIZE] {source}/{group}: {len(records)} raw records")

        # Convert dicts back to TLERecord-like for the normalizer
        from celestrak_client import TLERecord
        tlerecords = []
        for rd in records:
            tlerecords.append(TLERecord(
                norad_cat_id=rd.get("norad_cat_id", 0),
                name=rd.get("name", ""),
                tle_line1=rd.get("tle_line1", ""),
                tle_line2=rd.get("tle_line2", ""),
                object_type=rd.get("object_type"),
                country=rd.get("country"),
                launch_date=rd.get("launch_date"),
                source_updated_at=datetime.now(timezone.utc),
            ))

        normalized = normalize_records(tlerecords)
        print(f"  Normalized: {len(normalized)} records")

        if max_objects and len(normalized) > max_objects:
            print(f"  Limiting to {max_objects} records (from {len(normalized)})")
            normalized = normalized[:max_objects]

        pairs = _classify_and_compute(normalized)
        result["tle_normalized"] += len(normalized)
        result["positions_computed"] += sum(1 for _, p in pairs if p is not None)

        for sat, pos in pairs:
            all_satellites.append(_sat_to_json(sat, pos))
            if pos:
                all_positions.append(_pos_to_json(sat, pos))

    result["satellites_written"] = len(all_satellites)
    result["positions_written"] = len(all_positions)

    # Write normalized files
    norm_manifest = cache.write_normalized(
        satellites=all_satellites,
        positions=all_positions,
        groups=groups,
        source=source,
        errors=result["errors"],
    )

    print(f"\n[NORMALIZE-ONLY] Satellites: {result['satellites_written']}")
    print(f"[NORMALIZE-ONLY] Positions:  {result['positions_written']}")
    print(f"[NORMALIZE-ONLY] Manifest -> {norm_manifest}")

    return result


# ----------------------------------------------------- mode: persist-from-cache


def run_persist_from_cache(
    source: str = "celestrak",
    cache_dir: str = "",
    max_objects: int | None = None,
    database_url: str | None = None,
) -> dict[str, Any]:
    """Read normalized cache and write to database.  No provider calls."""
    db_url = database_url or DEFAULT_DATABASE_URL
    cache = SourceCache(cache_dir)

    result: dict[str, Any] = {
        "source": source,
        "catalog_written": 0,
        "position_written": 0,
        "skipped_older": 0,
        "errors": [],
    }

    print(f"[PERSIST-FROM-CACHE] Cache: {cache.layer_dir}")

    manifest = cache.read_normalized()
    if manifest is None:
        err = "No normalized manifest found; run --normalize-only first"
        print(f"[PERSIST-FROM-CACHE] ERROR: {err}")
        result["errors"].append(err)
        return result

    sat_path = Path(manifest["satellites_path"])
    pos_path = Path(manifest["positions_path"])

    # Read normalized satellite records
    sat_records = cache.read_normalized_satellites()
    if max_objects and len(sat_records) > max_objects:
        sat_records = sat_records[:max_objects]

    if not sat_records:
        print("[PERSIST-FROM-CACHE] No satellite records to persist")
        return result

    print(f"[PERSIST-FROM-CACHE] Reading {len(sat_records)} satellite records from cache")

    # Connect to DB
    print("[DB] Connecting to database...")
    try:
        conn = connect_db(db_url)
    except Exception as e:
        result["errors"].append(f"DB connection failed: {e}")
        print(f"[DB] ERROR: Could not connect: {e}")
        return result

    before_cat = get_satellite_count(conn)
    before_pos = get_position_count(conn)
    print(f"[DB] Before: catalog={before_cat}, positions={before_pos}")

    try:
        from celestrak_client import TLERecord
        for sat_json in sat_records:
            tlerec = TLERecord(
                norad_cat_id=sat_json.get("norad_cat_id", 0),
                name=sat_json.get("name", ""),
                tle_line1=sat_json.get("tle_line1", ""),
                tle_line2=sat_json.get("tle_line2", ""),
                object_type=sat_json.get("object_type"),
                country=sat_json.get("country"),
                launch_date=sat_json.get("launch_date"),
                source_updated_at=_parse_dt(sat_json.get("source_updated_at")),
            )
            normalized = normalize_records([tlerec])[0]
            # Restore original classification from cached JSON
            normalized.object_type = sat_json.get("object_type", normalized.object_type)
            normalized.category = sat_json.get("category", normalized.category)
            normalized.orbit_class = sat_json.get("orbit_class", normalized.orbit_class)
            normalized.is_important = sat_json.get("is_important", normalized.is_important)
            normalized.country = sat_json.get("country", normalized.country)
            normalized.operator_or_owner = sat_json.get("operator_or_owner", normalized.operator_or_owner)
            normalized.orbital_epoch_at = _parse_dt(sat_json.get("orbital_epoch_at"))
            normalized.source_updated_at = _parse_dt(sat_json.get("source_updated_at"))
            normalized.raw_source_json = sat_json.get("raw_source_json", normalized.raw_source_json)

            satellite_id, is_new_or_updated = upsert_satellite(
                conn=conn,
                layer_id=LAYER_ID,
                source_id=SOURCE_ID,
                source_object_id=normalized.source_object_id,
                norad_cat_id=normalized.norad_cat_id,
                name=normalized.name,
                object_type=normalized.object_type,
                category=normalized.category,
                orbit_class=normalized.orbit_class,
                country=normalized.country,
                operator_or_owner=normalized.operator_or_owner,
                launch_date=normalized.launch_date,
                tle_line1=normalized.tle_line1,
                tle_line2=normalized.tle_line2,
                orbital_epoch_at=normalized.orbital_epoch_at,
                source_updated_at=normalized.source_updated_at,
                is_active=normalized.is_active,
                is_important=normalized.is_important,
                raw_source_json=normalized.raw_source_json,
            )
            if is_new_or_updated:
                result["catalog_written"] += 1
            else:
                result["skipped_older"] += 1

            # Compute position and upsert if available
            if sat_json.get("position"):
                pos_data = sat_json["position"]
                estimated_at = _parse_dt(pos_data.get("estimated_at"))
                if estimated_at and satellite_id:
                    upsert_position(
                        conn=conn,
                        satellite_id=satellite_id,
                        layer_id=LAYER_ID,
                        source_id=SOURCE_ID,
                        source_object_id=normalized.source_object_id,
                        norad_cat_id=normalized.norad_cat_id,
                        estimated_at=estimated_at,
                        latitude=pos_data.get("latitude", 0),
                        longitude=pos_data.get("longitude", 0),
                        altitude_km=pos_data.get("altitude_km"),
                        velocity_kms=pos_data.get("velocity_kms"),
                        heading_deg=pos_data.get("heading_deg"),
                        orbit_class=normalized.orbit_class,
                        object_type=normalized.object_type,
                        category=normalized.category,
                        visual_shape=pos_data.get("visual_shape", "dot"),
                        visual_color=pos_data.get("visual_color", "#00d5ff"),
                        is_important=normalized.is_important,
                        source_age_seconds=pos_data.get("source_age_seconds"),
                        computation_method=pos_data.get("computation_method", "simplified-sgp4"),
                        raw_position_json=None,
                    )
                    result["position_written"] += 1

        after_cat = get_satellite_count(conn)
        after_pos = get_position_count(conn)
        print(f"[DB] After: catalog={after_cat}, positions={after_pos}")
        print(f"[PERSIST-FROM-CACHE] Catalog upserted: {result['catalog_written']}")
        print(f"[PERSIST-FROM-CACHE] Positions written: {result['position_written']}")
        print(f"[PERSIST-FROM-CACHE] Skipped (older): {result['skipped_older']}")
        print("[PERSIST-FROM-CACHE] Done.")

    except Exception as e:
        result["errors"].append(str(e))
        print(f"[PERSIST-FROM-CACHE] ERROR: {e}")
    finally:
        conn.close()

    return result


def _parse_dt(val: Any) -> datetime | None:
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    try:
        return datetime.fromisoformat(str(val))
    except (ValueError, TypeError):
        return None


# -------------------------------------------------------------------- main


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Space Satellites Fetcher — fetch, normalize, and persist TLE data"
    )
    # Modes
    parser.add_argument(
        "--download-only", action="store_true",
        help="Download raw TLE data to cache; do not normalize or write DB",
    )
    parser.add_argument(
        "--normalize-only", action="store_true",
        help="Read raw cache and normalize; do not call provider or write DB",
    )
    parser.add_argument(
        "--persist-from-cache", action="store_true",
        help="Read normalized cache and write to DB; no provider calls",
    )
    # Direct mode flags (preserved)
    parser.add_argument(
        "--dry-run", action="store_true", default=True,
        help="Do not write to database (default)",
    )
    parser.add_argument(
        "--persist", action="store_true",
        help="Write to database (direct mode)",
    )
    # Common
    parser.add_argument(
        "--source", type=str, default="celestrak",
        help="Data source (default: celestrak)",
    )
    parser.add_argument(
        "--group", type=str, action="append", dest="groups",
        help=f"CelesTrak group (can be repeated). Available: {', '.join(CELESTRAK_GROUPS)}",
    )
    parser.add_argument(
        "--database-url", type=str, default=None,
        help="PostgreSQL connection URL",
    )
    parser.add_argument(
        "--max-objects", type=int, default=None,
        help="Maximum objects to process (for safe testing)",
    )
    parser.add_argument(
        "--show-raw", action="store_true",
        help="Print sample normalized records",
    )
    parser.add_argument(
        "--cache-dir", type=str, default=None,
        help="Cache directory for staged pipeline (e.g. E:\\god-eyes-data\\space)",
    )
    args = parser.parse_args()

    groups = args.groups if args.groups else DEFAULT_GROUPS

    # --- Staged modes ---
    if args.download_only:
        if not args.cache_dir:
            parser.error("--download-only requires --cache-dir")
        result = run_download_only(
            groups=groups,
            source=args.source,
            cache_dir=args.cache_dir,
            max_objects=args.max_objects,
        )
        print("\n[SUMMARY]")
        print(f"  Source: {result['source']}")
        print(f"  Groups succeeded: {result['groups_succeeded']}")
        print(f"  Groups failed: {result['groups_failed']}")
        print(f"  Raw records: {result['record_count']}")
        if result["errors"]:
            print(f"  Errors: {result['errors']}")
            sys.exit(1)
        return

    if args.normalize_only:
        if not args.cache_dir:
            parser.error("--normalize-only requires --cache-dir")
        result = run_normalize_only(
            groups=groups,
            source=args.source,
            cache_dir=args.cache_dir,
            max_objects=args.max_objects,
        )
        print("\n[SUMMARY]")
        print(f"  Satellites written: {result['satellites_written']}")
        print(f"  Positions written:  {result['positions_written']}")
        if result["errors"]:
            print(f"  Errors: {result['errors']}")
            sys.exit(1)
        return

    if args.persist_from_cache:
        if not args.cache_dir:
            parser.error("--persist-from-cache requires --cache-dir")
        result = run_persist_from_cache(
            source=args.source,
            cache_dir=args.cache_dir,
            max_objects=args.max_objects,
            database_url=args.database_url,
        )
        print("\n[SUMMARY]")
        print(f"  Catalog written:  {result['catalog_written']}")
        print(f"  Positions written: {result['position_written']}")
        print(f"  Skipped (older):   {result['skipped_older']}")
        if result["errors"]:
            print(f"  Errors: {result['errors']}")
            sys.exit(1)
        return

    # --- Direct mode (original behavior preserved) ---
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
        cache_dir=args.cache_dir,
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
