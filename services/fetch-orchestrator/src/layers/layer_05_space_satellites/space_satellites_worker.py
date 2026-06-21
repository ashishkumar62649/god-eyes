"""Space Satellites Worker — Fetches TLE data and computes positions.

Fetches satellite TLE data from CelesTrak, normalizes records,
computes orbital positions, and persists to database.

Modes:
    Default (no --persist): dry-run, prints would-process sample
    --persist: full fetch -> normalize -> compute -> DB write
    --download-only: fetch from provider, save raw to cache, no DB
    --normalize-only: read raw cache, normalize + compute, save normalized
    --persist-from-cache: read normalized cache, write to DB only
    --refresh-positions-from-cache: recompute positions from cached TLEs
        and write them to the DB. No provider calls, no catalog upserts.
        Use on a 1-5 min cadence between TLE refreshes.

Propagator selection (--propagator):
    auto (default): sgp4 if python-sgp4 is installed, else simplified
    sgp4:           high-fidelity SGP4 propagation; raises if missing
    simplified-fallback: always-available display-grade math

Usage:
    python space_satellites_worker.py
    python space_satellites_worker.py --persist
    python space_satellites_worker.py --source celestrak --group starlink --persist
    python space_satellites_worker.py --print-sync-plan

Staged pipeline:
    python space_satellites_worker.py --source celestrak --group stations --group weather --download-only --cache-dir E:\\god-eyes-data\\space
    python space_satellites_worker.py --source celestrak --group stations --group weather --normalize-only --cache-dir E:\\god-eyes-data\\space --max-objects 1000
    python space_satellites_worker.py --persist-from-cache --cache-dir E:\\god-eyes-data\\space --max-objects 1000
    python space_satellites_worker.py --refresh-positions-from-cache --cache-dir E:\\god-eyes-data\\space

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
from tle_parser import normalize_records, LAYER_ID
from classification import classify_object, get_visual_shape, get_visual_color
from orbit_propagation import (
    compute_position_from_tle,
    get_propagation_engine,
    sgp4_import_error,
    ENGINE_SGP4,
    ENGINE_SIMPLIFIED,
)
from space_satellites_db import (
    DEFAULT_DATABASE_URL,
    connect_db,
    upsert_satellite,
    upsert_position,
    get_satellite_count,
    get_position_count,
    get_existing_norad_ids,
    get_existing_norad_to_id,
)
from source_cache import SourceCache, tle_record_to_dict, utcnow_iso
from space_track_client import (
    SpaceTrackClient,
    SpaceTrackAuthError,
    SpaceTrackHTTPError,
    has_space_track_credentials,
    get_missing_env_vars,
    create_space_track_client,
    SPACE_TRACK_GROUPS,
)
from space_track_normalizer import (
    normalize_space_track_records,
    SOURCE_ID_CANONICAL as SPACE_TRACK_SOURCE_ID,
)

# Default groups for the CelesTrak direct pipeline.
DEFAULT_GROUPS = ["active", "stations"]

# Source identifier used for CelesTrak (matches existing SOURCE_ID).
CELESTRAK_SOURCE_ID = "celestrak"

# Accepted CLI spellings for Space-Track.
SPACE_TRACK_SOURCE_ALIASES = {"space-track", "space_track"}


def normalize_source_id(source: str) -> str:
    """Normalize a CLI source string to the canonical source id."""
    if source in SPACE_TRACK_SOURCE_ALIASES:
        return SPACE_TRACK_SOURCE_ID
    return source


def is_space_track_source(source: str) -> bool:
    return normalize_source_id(source) == SPACE_TRACK_SOURCE_ID


# ------------------------------------------------------------------ helpers


def _classify_and_compute(
    normalized: list,
    engine: str | None = None,
) -> list[tuple[Any, Any | None]]:
    """Classify each normalized satellite and compute its position.

    Returns a list of (satellite, position_or_none) tuples with
    satellite fields updated in-place.

    ``engine`` selects the orbital propagator: ``"auto"`` (default),
    ``"sgp4"`` (require the python-sgp4 package), or
    ``"simplified-fallback"``.
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
                engine=engine,
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
    source_id: str | None = None,
) -> None:
    """Upsert satellite + position pairs into the database.

    ``source_id`` overrides the source_id stored on the satellite. If
    ``None``, the satellite's own ``source_id`` is used (allowing
    multiple source pipelines to coexist, e.g. celestrak and space_track).
    """
    for sat, pos in pairs:
        sat_source_id = source_id or getattr(sat, "source_id", CELESTRAK_SOURCE_ID)
        satellite_id, is_new_or_updated = upsert_satellite(
            conn=conn,
            layer_id=LAYER_ID,
            source_id=sat_source_id,
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
                source_id=sat_source_id,
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
        "source_id": getattr(sat, "source_id", CELESTRAK_SOURCE_ID),
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
    engine: str | None = None,
) -> dict[str, Any]:
    """Direct fetch -> normalize -> compute -> optional DB persist.

    Preserves original behavior. ``cache_dir`` is optional; when
    supplied the raw download is also saved locally as a side effect.

    ``engine`` selects the orbital propagator: ``"auto"`` (default),
    ``"sgp4"`` (require the python-sgp4 package), or
    ``"simplified-fallback"``.
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
    print(f"  Propagator: {engine or 'auto'} (resolved: {get_propagation_engine()})")
    sgp4_err = sgp4_import_error()
    if engine in ("auto", ENGINE_SGP4) and sgp4_err is not None:
        print(f"  Note: 'sgp4' package unavailable ({sgp4_err}); using simplified-fallback.")
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
    pairs = _classify_and_compute(normalized, engine=engine)
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


def run_download_space_track(
    groups: list[str],
    cache_dir: str = "",
    max_objects: int | None = None,
) -> dict[str, Any]:
    """Download-only mode for Space-Track.

    Authenticates using env vars, fetches the full catalog response,
    and writes the raw provider response (records) to the local cache.
    No normalization, no DB writes, no retries.
    """
    cache = SourceCache(cache_dir)
    fetched_at = utcnow_iso()

    result: dict[str, Any] = {
        "source": SPACE_TRACK_SOURCE_ID,
        "groups_requested": list(groups),
        "groups_succeeded": [],
        "groups_failed": [],
        "raw_files_written": [],
        "errors": [],
        "record_count": 0,
    }

    print(f"[DOWNLOAD-ONLY] Source: space-track")
    print(f"  Groups: {', '.join(groups)}")
    print(f"  Cache:  {cache.layer_dir}")
    print()

    # Credentials check (env var names only)
    if not has_space_track_credentials():
        missing = get_missing_env_vars()
        err_msg = (
            f"Space-Track credentials missing; set env vars: {missing}"
        )
        print(f"[FETCH] {err_msg}")
        result["errors"].append(err_msg)
        result["groups_failed"] = list(groups)
        # Still write a manifest with the failure so the run is recorded
        cache.write_overall_manifest(
            source=SPACE_TRACK_SOURCE_ID,
            groups_requested=groups,
            groups_succeeded=[],
            groups_failed=list(groups),
            raw_files=[],
            normalized_files=[],
            fetched_at=fetched_at,
            normalized_at=None,
            satellite_count=0,
            position_count=0,
            errors=result["errors"],
        )
        return result

    try:
        client = create_space_track_client()
    except Exception as exc:
        err_msg = f"Space-Track client init failed: {exc}"
        print(f"[FETCH] {err_msg}")
        result["errors"].append(err_msg)
        result["groups_failed"] = list(groups)
        cache.write_overall_manifest(
            source=SPACE_TRACK_SOURCE_ID,
            groups_requested=groups,
            groups_succeeded=[],
            groups_failed=list(groups),
            raw_files=[],
            normalized_files=[],
            fetched_at=fetched_at,
            normalized_at=None,
            satellite_count=0,
            position_count=0,
            errors=result["errors"],
        )
        return result

    if not client.is_authenticated:
        err_msg = "Space-Track authentication failed (no session cookies)"
        print(f"[FETCH] {err_msg}")
        result["errors"].append(err_msg)
        result["groups_failed"] = list(groups)
        cache.write_overall_manifest(
            source=SPACE_TRACK_SOURCE_ID,
            groups_requested=groups,
            groups_succeeded=[],
            groups_failed=list(groups),
            raw_files=[],
            normalized_files=[],
            fetched_at=fetched_at,
            normalized_at=None,
            satellite_count=0,
            position_count=0,
            errors=result["errors"],
        )
        return result

    for group in groups:
        print(f"[FETCH] Fetching '{group}' from Space-Track...")
        try:
            records = client.fetch_gp_records(groups=[group])
        except SpaceTrackAuthError as exc:
            err_msg = f"Space-Track auth error for '{group}': {exc}"
            print(f"  FAILED: {err_msg}")
            result["groups_failed"].append(group)
            result["errors"].append(err_msg)
            continue
        except SpaceTrackHTTPError as exc:
            err_msg = f"Space-Track HTTP {exc.status} for '{group}': {exc.reason}"
            print(f"  FAILED: {err_msg}")
            result["groups_failed"].append(group)
            result["errors"].append(err_msg)
            continue
        except Exception as exc:
            err_msg = f"Space-Track error for '{group}': {exc}"
            print(f"  FAILED: {err_msg}")
            result["groups_failed"].append(group)
            result["errors"].append(err_msg)
            continue

        if max_objects and len(records) > max_objects:
            records = records[:max_objects]

        raw_text = (
            f"# raw Space-Track cache for {group}\n"
            f"# fetched_at={fetched_at}\n"
            f"# record_count={len(records)}\n"
        )
        raw_result = cache.write_raw_group(
            source=SPACE_TRACK_SOURCE_ID,
            group=group,
            raw_text=raw_text,
            records=records,
            fetched_at=fetched_at,
        )
        result["groups_succeeded"].append(group)
        result["raw_files_written"].append(str(raw_result.raw_json_path))
        result["record_count"] += raw_result.record_count
        print(f"  OK: {raw_result.record_count} records -> {raw_result.raw_json_path}")

    print(f"\n[DOWNLOAD-ONLY] Succeeded: {result['groups_succeeded']}")
    if result["groups_failed"]:
        print(f"[DOWNLOAD-ONLY] Failed:    {result['groups_failed']}")

    cache.write_overall_manifest(
        source=SPACE_TRACK_SOURCE_ID,
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
    return result


def run_download_only(
    groups: list[str],
    source: str = "celestrak",
    cache_dir: str = "",
    max_objects: int | None = None,
) -> dict[str, Any]:
    """Fetch raw data and save to local cache.  No normalisation.

    Dispatches to CelesTrak or Space-Track fetcher based on ``source``.
    Each group that succeeds gets its raw text and a JSON envelope
    saved under ``<cache>/layer_05_space_satellites/raw/<source>/<group>/``.
    Failed groups are recorded in the manifest but do not affect
    successful groups.
    """
    canonical_source = normalize_source_id(source)

    # Space-Track dispatch
    if is_space_track_source(canonical_source):
        return run_download_space_track(
            groups=groups,
            cache_dir=cache_dir,
            max_objects=max_objects,
        )

    cache = SourceCache(cache_dir)
    fetched_at = utcnow_iso()

    result: dict[str, Any] = {
        "source": canonical_source,
        "groups_requested": list(groups),
        "groups_succeeded": [],
        "groups_failed": [],
        "raw_files_written": [],
        "errors": [],
        "record_count": 0,
    }

    print(f"[DOWNLOAD-ONLY] Source: {canonical_source}")
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

        raw_text = f"# raw TLE cache for {canonical_source}/{group}\n# fetched_at={fetched_at}\n"
        record_dicts = [tle_record_to_dict(r) for r in records]
        raw_result = cache.write_raw_group(
            source=canonical_source,
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
        source=canonical_source,
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


def run_normalize_space_track(
    groups: list[str],
    cache_dir: str = "",
    max_objects: int | None = None,
    engine: str | None = None,
) -> dict[str, Any]:
    """Normalize-only mode for Space-Track.

    Reads raw Space-Track cache files, normalizes records into
    canonical Layer 05 satellite records, computes positions where
    TLE is available, writes normalized JSONL files. No provider
    calls, no DB writes.
    """
    cache = SourceCache(cache_dir)

    result: dict[str, Any] = {
        "source": SPACE_TRACK_SOURCE_ID,
        "groups": groups,
        "tle_normalized": 0,
        "positions_computed": 0,
        "satellites_written": 0,
        "positions_written": 0,
        "errors": [],
    }

    print(f"[NORMALIZE-ONLY] Source: space-track")
    print(f"  Groups: {', '.join(groups)}")
    print(f"  Cache:  {cache.layer_dir}")
    print(f"  Propagator: {engine or 'auto'} (resolved: {get_propagation_engine()})")
    sgp4_err = sgp4_import_error()
    if engine in ("auto", ENGINE_SGP4) and sgp4_err is not None:
        print(f"  Note: 'sgp4' package unavailable ({sgp4_err}); using simplified-fallback.")
    print()

    all_satellites: list[dict[str, Any]] = []
    all_positions: list[dict[str, Any]] = []

    for group in groups:
        raw = cache.read_raw_group(SPACE_TRACK_SOURCE_ID, group)
        if raw is None:
            err = f"No raw cache for space-track/{group}"
            print(f"  SKIP: {err}")
            result["errors"].append(err)
            continue

        records = raw.get("records", [])
        if not records:
            err = f"Raw cache empty for space-track/{group}"
            print(f"  SKIP: {err}")
            result["errors"].append(err)
            continue

        print(f"[NORMALIZE] space-track/{group}: {len(records)} raw records")

        fetched_at = raw.get("fetched_at")
        normalized, errors = normalize_space_track_records(records, fetched_at=fetched_at, engine=engine)
        if errors:
            for e in errors:
                result["errors"].append(f"{group}: {e}")
        print(f"  Normalized: {len(normalized)} records (errors: {len(errors)})")

        if max_objects and len(normalized) > max_objects:
            print(f"  Limiting to {max_objects} records (from {len(normalized)})")
            normalized = normalized[:max_objects]

        for sat in normalized:
            all_satellites.append(sat)
            pos = sat.get("position")
            if pos:
                all_positions.append(pos)
            else:
                # No TLE-derived position; still append an empty placeholder
                # so positions.jsonl line count is consistent per sat if desired
                pass

        result["tle_normalized"] += len(normalized)
        result["positions_computed"] += sum(1 for s in normalized if s.get("position"))

    result["satellites_written"] = len(all_satellites)
    result["positions_written"] = len(all_positions)

    norm_manifest = cache.write_normalized(
        satellites=all_satellites,
        positions=all_positions,
        groups=groups,
        source=SPACE_TRACK_SOURCE_ID,
        errors=result["errors"],
    )

    print(f"\n[NORMALIZE-ONLY] Satellites: {result['satellites_written']}")
    print(f"[NORMALIZE-ONLY] Positions:  {result['positions_written']}")
    print(f"[NORMALIZE-ONLY] Manifest -> {norm_manifest}")
    return result


def run_normalize_only(
    groups: list[str],
    source: str = "celestrak",
    cache_dir: str = "",
    max_objects: int | None = None,
    engine: str | None = None,
) -> dict[str, Any]:
    """Read raw cache, normalize + classify + compute positions.

    Writes ``normalized/latest/satellites.jsonl`` and
    ``normalized/latest/positions.jsonl``.  No provider calls, no DB.

    ``engine`` selects the orbital propagator: ``"auto"`` (default),
    ``"sgp4"`` (require the python-sgp4 package), or
    ``"simplified-fallback"``.
    """
    canonical_source = normalize_source_id(source)

    if is_space_track_source(canonical_source):
        return run_normalize_space_track(
            groups=groups,
            cache_dir=cache_dir,
            max_objects=max_objects,
            engine=engine,
        )

    cache = SourceCache(cache_dir)

    result: dict[str, Any] = {
        "source": canonical_source,
        "groups": groups,
        "tle_normalized": 0,
        "positions_computed": 0,
        "satellites_written": 0,
        "positions_written": 0,
        "errors": [],
    }

    print(f"[NORMALIZE-ONLY] Source: {canonical_source}")
    print(f"  Groups: {', '.join(groups)}")
    print(f"  Cache:  {cache.layer_dir}")
    print(f"  Propagator: {engine or 'auto'} (resolved: {get_propagation_engine()})")
    sgp4_err = sgp4_import_error()
    if engine in ("auto", ENGINE_SGP4) and sgp4_err is not None:
        print(f"  Note: 'sgp4' package unavailable ({sgp4_err}); using simplified-fallback.")
    print()

    all_satellites: list[dict[str, Any]] = []
    all_positions: list[dict[str, Any]] = []

    for group in groups:
        raw = cache.read_raw_group(canonical_source, group)
        if raw is None:
            err = f"No raw cache for {canonical_source}/{group}"
            print(f"  SKIP: {err}")
            result["errors"].append(err)
            continue

        records = raw.get("records", [])
        if not records:
            err = f"Raw cache empty for {canonical_source}/{group}"
            print(f"  SKIP: {err}")
            result["errors"].append(err)
            continue

        print(f"[NORMALIZE] {canonical_source}/{group}: {len(records)} raw records")

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

        pairs = _classify_and_compute(normalized, engine=engine)
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
        source=canonical_source,
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
    missing_only: bool = False,
    refresh_positions: bool = False,
    engine: str | None = None,
) -> dict[str, Any]:
    """Read normalized cache and write to database.  No provider calls.

    Args:
        source: Source identifier (celestrak, space-track, space_track).
        cache_dir: Cache directory.
        max_objects: Limit records to process (for safe testing).
        database_url: PostgreSQL connection URL.
        missing_only: When True, filter out any NORAD catalog IDs
            that already exist in DB across all sources. Used by
            Space-Track gap-fill to avoid duplicating CelesTrak rows.
        refresh_positions: When True, recompute positions from the
            cached TLEs at the current wall-clock time, instead of
            reusing the positions stored in the normalized cache.
            This is the right mode for periodic re-positioning when
            the TLE catalog has not been refreshed.
        engine: Propagator to use when ``refresh_positions`` is True.
            ``"auto"`` (default) picks sgp4 if installed, otherwise
            the simplified fallback.

    Behavior:
        - When missing_only is False: every record is upserted into
          the catalog and (if a position is cached) a latest position
          is written.
        - When missing_only is True: only NORAD IDs not already in the
          DB are inserted as new catalog rows. However, positions are
          still written/updated for ALL records, using the existing
          ``satellite_id`` for the skipped NORADs. This ensures
          Space-Track gap-fill can populate latest positions for
          satellites CelesTrak already has catalog rows for.
    """
    canonical_source = normalize_source_id(source)
    db_url = database_url or DEFAULT_DATABASE_URL
    cache = SourceCache(cache_dir)

    result: dict[str, Any] = {
        "source": canonical_source,
        "catalog_written": 0,
        "position_written": 0,
        "position_backfilled_existing_norad": 0,
        "skipped_older": 0,
        "skipped_existing": 0,
        "existing_norad_count": 0,
        "missing_norad_count": 0,
        "errors": [],
        "refresh_positions": refresh_positions,
        "propagator": get_propagation_engine(),
    }

    print(f"[PERSIST-FROM-CACHE] Cache: {cache.layer_dir}")
    if missing_only:
        print(f"[PERSIST-FROM-CACHE] Mode:  MISSING-ONLY (dedupe by NORAD ID, position backfill enabled)")
    if refresh_positions:
        print(f"[PERSIST-FROM-CACHE] Mode:  REFRESH-POSITIONS (recompute from cached TLEs)")
        print(f"[PERSIST-FROM-CACHE] Propagator: {engine or 'auto'} (resolved: {get_propagation_engine()})")
        sgp4_err = sgp4_import_error()
        if engine in ("auto", ENGINE_SGP4) and sgp4_err is not None:
            print(f"  Note: 'sgp4' package unavailable ({sgp4_err}); using simplified-fallback.")

    manifest = cache.read_normalized()
    if manifest is None:
        err = "No normalized manifest found; run --normalize-only first"
        print(f"[PERSIST-FROM-CACHE] ERROR: {err}")
        result["errors"].append(err)
        return result

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

    # Pre-load existing NORAD IDs if missing-only mode
    existing_norad_ids: set[int] = set()
    existing_norad_to_id: dict[int, str] = {}
    if missing_only:
        existing_norad_to_id = get_existing_norad_to_id(conn)
        existing_norad_ids = set(existing_norad_to_id.keys())
        result["existing_norad_count"] = len(existing_norad_ids)
        print(f"[PERSIST-FROM-CACHE] Existing NORAD IDs in DB: {len(existing_norad_ids)}")

    # Pre-classify records by catalog action if missing-only
    records_for_catalog_insert: list[dict[str, Any]] = []
    records_for_position_only: list[dict[str, Any]] = []  # skipped for catalog but still get positions
    if missing_only:
        for sat_json in sat_records:
            norad = sat_json.get("norad_cat_id")
            if norad is None:
                records_for_catalog_insert.append(sat_json)
                continue
            try:
                norad_int = int(norad)
            except (ValueError, TypeError):
                records_for_catalog_insert.append(sat_json)
                continue
            if norad_int in existing_norad_ids:
                result["skipped_existing"] += 1
                records_for_position_only.append(sat_json)
            else:
                records_for_catalog_insert.append(sat_json)
        result["missing_norad_count"] = len(records_for_catalog_insert)
        print(
            f"[PERSIST-FROM-CACHE] Missing NORAD IDs: {result['missing_norad_count']} "
            f"(skipped existing: {result['skipped_existing']}, "
            f"will backfill positions for: {len(records_for_position_only)})"
        )
    else:
        records_for_catalog_insert = list(sat_records)

    # Cache: map NORAD -> satellite_id as we insert, so position loop can use it.
    norad_to_satellite_id: dict[int, str] = dict(existing_norad_to_id)

    def _persist_one(sat_json: dict[str, Any], allow_catalog: bool) -> str | None:
        """Upsert one record. If allow_catalog is False, only update the
        position for an existing satellite row (matched by NORAD).

        Returns the satellite_id, or None if the record was skipped
        (older than DB, or allow_catalog is False and NORAD missing).
        """
        from celestrak_client import TLERecord
        tlerec = TLERecord(
            norad_cat_id=sat_json.get("norad_cat_id", 0),
            name=sat_json.get("name", ""),
            tle_line1=sat_json.get("tle_line1"),
            tle_line2=sat_json.get("tle_line2"),
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

        sat_source_id = sat_json.get("source_id") or canonical_source

        if allow_catalog:
            satellite_id, is_new_or_updated = upsert_satellite(
                conn=conn,
                layer_id=LAYER_ID,
                source_id=sat_source_id,
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
        else:
            # Position-only path: look up existing satellite_id by NORAD
            norad = normalized.norad_cat_id
            if norad is None:
                return None
            try:
                norad_int = int(norad)
            except (ValueError, TypeError):
                return None
            satellite_id = norad_to_satellite_id.get(norad_int)
            if not satellite_id:
                return None
        return satellite_id

    def _write_position(sat_json: dict[str, Any], satellite_id: str) -> bool:
        """Write the cached (or freshly recomputed) position for the given satellite."""
        sat_source_id = sat_json.get("source_id") or canonical_source
        source_object_id = str(
            sat_json.get("source_object_id") or sat_json.get("norad_cat_id") or ""
        )
        norad_cat_id = sat_json.get("norad_cat_id")

        if refresh_positions:
            # Recompute at the current wall-clock time using the cached
            # TLE. Useful for periodic re-positioning without re-fetching
            # from the provider. Requires a valid TLE pair.
            tle_line1 = sat_json.get("tle_line1")
            tle_line2 = sat_json.get("tle_line2")
            if not (tle_line1 and tle_line2):
                # Fall back to cached position if we somehow lost the TLE.
                if not sat_json.get("position"):
                    return False
            else:
                try:
                    orbital_epoch = _parse_dt(sat_json.get("orbital_epoch_at"))
                    pos = compute_position_from_tle(
                        tle_line1,
                        tle_line2,
                        orbital_epoch=orbital_epoch,
                        engine=engine,
                    )
                except Exception as exc:
                    result["errors"].append(
                        f"position_recompute_error norad={norad_cat_id}: {exc}"
                    )
                    return False
                if pos is None:
                    return False
                try:
                    upsert_position(
                        conn=conn,
                        satellite_id=satellite_id,
                        layer_id=LAYER_ID,
                        source_id=sat_source_id,
                        source_object_id=source_object_id,
                        norad_cat_id=norad_cat_id,
                        estimated_at=pos.estimated_at,
                        latitude=pos.latitude,
                        longitude=pos.longitude,
                        altitude_km=pos.altitude_km if pos.altitude_km is not None and pos.altitude_km >= 0 else 0.0,
                        velocity_kms=pos.velocity_kms,
                        heading_deg=pos.heading_deg,
                        orbit_class=sat_json.get("orbit_class", "unknown"),
                        object_type=sat_json.get("object_type", "unknown"),
                        category=sat_json.get("category", "unknown"),
                        visual_shape=getattr(pos, "visual_shape", None) or sat_json.get("position", {}).get("visual_shape", "dot"),
                        visual_color=getattr(pos, "visual_color", None) or sat_json.get("position", {}).get("visual_color", "#00d5ff"),
                        is_important=sat_json.get("is_important", False),
                        source_age_seconds=pos.source_age_seconds,
                        computation_method=pos.computation_method,
                        raw_position_json=None,
                    )
                    return True
                except Exception as exc:
                    result["errors"].append(
                        f"position_write_error norad={norad_cat_id}: {exc}"
                    )
                    return False

        if not sat_json.get("position"):
            return False
        pos_data = sat_json["position"]
        estimated_at = _parse_dt(pos_data.get("estimated_at"))
        if not (estimated_at and satellite_id):
            return False
        # Defensive: the DB schema requires altitude_km >= 0. Cached
        # positions from a prior run may have a slightly negative value
        # (e.g. simplified-SGP4 edge case). Clamp to 0 at the write
        # boundary so a single bad row can't abort the whole run.
        altitude_km = pos_data.get("altitude_km")
        if altitude_km is not None and altitude_km < 0:
            altitude_km = 0.0
        try:
            upsert_position(
                conn=conn,
                satellite_id=satellite_id,
                layer_id=LAYER_ID,
                source_id=sat_source_id,
                source_object_id=source_object_id,
                norad_cat_id=norad_cat_id,
                estimated_at=estimated_at,
                latitude=pos_data.get("latitude", 0),
                longitude=pos_data.get("longitude", 0),
                altitude_km=altitude_km,
                velocity_kms=pos_data.get("velocity_kms"),
                heading_deg=pos_data.get("heading_deg"),
                orbit_class=sat_json.get("orbit_class", "unknown"),
                object_type=sat_json.get("object_type", "unknown"),
                category=sat_json.get("category", "unknown"),
                visual_shape=pos_data.get("visual_shape", "dot"),
                visual_color=pos_data.get("visual_color", "#00d5ff"),
                is_important=sat_json.get("is_important", False),
                source_age_seconds=pos_data.get("source_age_seconds"),
                computation_method=pos_data.get("computation_method", "simplified-sgp4"),
                raw_position_json=None,
            )
            return True
        except Exception as exc:
            result["errors"].append(f"position_write_error norad={sat_json.get('norad_cat_id')}: {exc}")
            return False

    try:
        # Pass 1: insert catalog rows for missing NORADs, and write their positions
        for sat_json in records_for_catalog_insert:
            sat_id = _persist_one(sat_json, allow_catalog=True)
            if not sat_id:
                continue
            norad = sat_json.get("norad_cat_id")
            if norad is not None:
                try:
                    norad_to_satellite_id[int(norad)] = sat_id
                except (ValueError, TypeError):
                    pass
            if _write_position(sat_json, sat_id):
                result["position_written"] += 1

        # Pass 2: position backfill for existing NORADs (only in missing-only mode)
        if missing_only:
            for sat_json in records_for_position_only:
                sat_id = _persist_one(sat_json, allow_catalog=False)
                if not sat_id:
                    continue
                if _write_position(sat_json, sat_id):
                    result["position_written"] += 1
                    result["position_backfilled_existing_norad"] += 1

        after_cat = get_satellite_count(conn)
        after_pos = get_position_count(conn)
        print(f"[DB] After: catalog={after_cat}, positions={after_pos}")
        print(f"[PERSIST-FROM-CACHE] Catalog upserted: {result['catalog_written']}")
        print(f"[PERSIST-FROM-CACHE] Positions written: {result['position_written']}")
        if missing_only:
            print(
                f"[PERSIST-FROM-CACHE] Positions backfilled (existing NORAD): "
                f"{result['position_backfilled_existing_norad']}"
            )
        print(f"[PERSIST-FROM-CACHE] Skipped (older): {result['skipped_older']}")
        if missing_only:
            print(f"[PERSIST-FROM-CACHE] Skipped (existing NORAD): {result['skipped_existing']}")
            print(f"[PERSIST-FROM-CACHE] Existing NORAD count: {result['existing_norad_count']}")
            print(f"[PERSIST-FROM-CACHE] Missing NORAD count: {result['missing_norad_count']}")
        print("[PERSIST-FROM-CACHE] Done.")

    except Exception as e:
        result["errors"].append(str(e))
        print(f"[PERSIST-FROM-CACHE] ERROR: {e}")
    finally:
        conn.close()

    return result

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

    # Pre-load existing NORAD IDs if missing-only mode
    existing_norad_ids: set[int] = set()
    if missing_only:
        existing_norad_ids = get_existing_norad_ids(conn)
        result["existing_norad_count"] = len(existing_norad_ids)
        print(f"[PERSIST-FROM-CACHE] Existing NORAD IDs in DB: {len(existing_norad_ids)}")

    # Pre-filter records by NORAD existence if missing-only
    if missing_only:
        kept: list[dict[str, Any]] = []
        for sat_json in sat_records:
            norad = sat_json.get("norad_cat_id")
            if norad is None:
                kept.append(sat_json)
                continue
            try:
                norad_int = int(norad)
            except (ValueError, TypeError):
                kept.append(sat_json)
                continue
            if norad_int in existing_norad_ids:
                result["skipped_existing"] += 1
                continue
            kept.append(sat_json)
        result["missing_norad_count"] = len(kept)
        print(
            f"[PERSIST-FROM-CACHE] Missing NORAD IDs: {result['missing_norad_count']} "
            f"(skipped existing: {result['skipped_existing']})"
        )
        sat_records = kept
        if not sat_records:
            print("[PERSIST-FROM-CACHE] No missing NORAD records to insert")
            conn.close()
            return result

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

            # Use the source_id from the normalized JSON if present, else default
            sat_source_id = sat_json.get("source_id") or canonical_source

            satellite_id, is_new_or_updated = upsert_satellite(
                conn=conn,
                layer_id=LAYER_ID,
                source_id=sat_source_id,
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
                        source_id=sat_source_id,
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
        if missing_only:
            print(f"[PERSIST-FROM-CACHE] Skipped (existing NORAD): {result['skipped_existing']}")
            print(f"[PERSIST-FROM-CACHE] Existing NORAD count: {result['existing_norad_count']}")
            print(f"[PERSIST-FROM-CACHE] Missing NORAD count: {result['missing_norad_count']}")
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


def print_sync_plan() -> None:
    """Print the recommended incremental sync cadence for Layer 05.

    Documented in WO-082C4 so operators have a single source of truth
    for how often each stage of the pipeline should run. The numbers
    are targets, not hard requirements; treat them as starting points
    and tune against the rendered product.

    Cadence summary (most-frequent first):
        1. Frontend render: smooth / every animation frame (~16 ms).
           Layer 05 positions are interpolated client-side between
           DB updates; the server-side cadence only needs to be
           "fast enough that motion looks continuous."
        2. WebSocket broadcast: 1-5 s. The API streams position
           deltas; the render cadence is decoupled from the SGP4
           compute cadence by the WS layer.
        3. Position recompute from cached TLEs: 60-300 s. SGP4
           propagation against a recent TLE is cheap; recomputing
           every minute gives ~0.001 deg sub-second ground track
           drift on LEO. Triggered by the scheduler; does not call
           any upstream provider.
        4. Provider fetch (CelesTrak / Space-Track): 2-24 h. TLE
           epochs age quickly on LEO, but the operators typically
           refresh every few hours. The full Space-Track catalog
           (60k+ objects) is bulky, so do not run it every minute.
    """
    print("[SYNC-PLAN] Recommended Layer 05 incremental sync cadence")
    print("  - Frontend render:   smooth (~16 ms; client-side interp)")
    print("  - WS broadcast:      1-5 s (position deltas to subscribers)")
    print("  - Position recompute: 60-300 s (sgp4 from cached TLEs, no provider)")
    print("  - Provider fetch:    2-24 h (CelesTrak / Space-Track full pull)")
    print()
    print("  Practical rollout for this build:")
    print("    1. Bootstrap full catalog once via --download-only /")
    print("       --normalize-only / --persist-from-cache (one-time).")
    print("    2. Run --refresh-positions-from-cache every 1-5 min to")
    print("       keep the latest-position table fresh without hitting")
    print("       the provider. The 67k+ row scan is O(seconds) with")
    print("       python-sgp4; the simplified fallback is O(minutes).")
    print("    3. Re-run --normalize-only + --persist-from-cache every")
    print("       2-24 h to pick up new TLEs from the provider.")
    print("    4. The frontend subscribes via WS; no direct DB read.")


def run_refresh_positions_from_cache(
    source: str = "celestrak",
    cache_dir: str = "",
    max_objects: int | None = None,
    database_url: str | None = None,
    engine: str | None = None,
) -> dict[str, Any]:
    """Recompute positions from cached TLEs and write them to the DB.

    No provider calls, no catalog upserts, no re-normalization. Use
    this on a 1-5 min cadence to keep ``space_satellite_positions``
    fresh between TLE refreshes.

    ``engine`` selects the propagator: ``"auto"`` (default),
    ``"sgp4"`` (requires the python-sgp4 package), or
    ``"simplified-fallback"``.

    Returns a result dict with counters and any errors encountered.
    """
    canonical_source = normalize_source_id(source)
    db_url = database_url or DEFAULT_DATABASE_URL
    cache = SourceCache(cache_dir)

    result: dict[str, Any] = {
        "source": canonical_source,
        "propagator": get_propagation_engine(),
        "engine_requested": engine or "auto",
        "positions_recomputed": 0,
        "positions_written": 0,
        "skipped_no_tle": 0,
        "skipped_no_satellite_id": 0,
        "skipped_existing": 0,
        "errors": [],
    }

    print(f"[REFRESH-POSITIONS] Cache: {cache.layer_dir}")
    print(f"[REFRESH-POSITIONS] Propagator: {engine or 'auto'} (resolved: {get_propagation_engine()})")
    sgp4_err = sgp4_import_error()
    if engine in ("auto", ENGINE_SGP4) and sgp4_err is not None:
        print(f"  Note: 'sgp4' package unavailable ({sgp4_err}); using simplified-fallback.")

    sat_records = cache.read_normalized_satellites()
    if not sat_records:
        err = "No normalized satellite cache found; run --normalize-only first."
        print(f"[REFRESH-POSITIONS] ERROR: {err}")
        result["errors"].append(err)
        return result
    if max_objects and len(sat_records) > max_objects:
        sat_records = sat_records[:max_objects]
    print(f"[REFRESH-POSITIONS] Reading {len(sat_records)} satellite records from cache")

    print("[DB] Connecting to database...")
    try:
        conn = connect_db(db_url)
    except Exception as e:
        result["errors"].append(f"DB connection failed: {e}")
        print(f"[DB] ERROR: Could not connect: {e}")
        return result

    norad_to_satellite_id = get_existing_norad_to_id(conn)
    print(f"[DB] Existing satellite_id map size: {len(norad_to_satellite_id)}")
    before_pos = get_position_count(conn)
    print(f"[DB] Positions before: {before_pos}")

    now = datetime.now(timezone.utc)
    try:
        for sat_json in sat_records:
            norad = sat_json.get("norad_cat_id")
            tle_line1 = sat_json.get("tle_line1")
            tle_line2 = sat_json.get("tle_line2")
            if not (tle_line1 and tle_line2):
                result["skipped_no_tle"] += 1
                continue
            try:
                norad_int = int(norad) if norad is not None else None
            except (ValueError, TypeError):
                norad_int = None
            satellite_id = norad_to_satellite_id.get(norad_int) if norad_int is not None else None
            if not satellite_id:
                result["skipped_no_satellite_id"] += 1
                continue
            try:
                orbital_epoch = _parse_dt(sat_json.get("orbital_epoch_at"))
                pos = compute_position_from_tle(
                    tle_line1,
                    tle_line2,
                    orbital_epoch=orbital_epoch,
                    target_time=now,
                    engine=engine,
                )
            except Exception as exc:
                result["errors"].append(
                    f"recompute_error norad={norad}: {exc}"
                )
                continue
            if pos is None:
                continue
            result["positions_recomputed"] += 1
            sat_source_id = sat_json.get("source_id") or canonical_source
            source_object_id = str(
                sat_json.get("source_object_id") or sat_json.get("norad_cat_id") or ""
            )
            try:
                upsert_position(
                    conn=conn,
                    satellite_id=satellite_id,
                    layer_id=LAYER_ID,
                    source_id=sat_source_id,
                    source_object_id=source_object_id,
                    norad_cat_id=norad,
                    estimated_at=pos.estimated_at,
                    latitude=pos.latitude,
                    longitude=pos.longitude,
                    altitude_km=pos.altitude_km if pos.altitude_km is not None and pos.altitude_km >= 0 else 0.0,
                    velocity_kms=pos.velocity_kms,
                    heading_deg=pos.heading_deg,
                    orbit_class=sat_json.get("orbit_class", "unknown"),
                    object_type=sat_json.get("object_type", "unknown"),
                    category=sat_json.get("category", "unknown"),
                    visual_shape=getattr(pos, "visual_shape", None) or "dot",
                    visual_color=getattr(pos, "visual_color", None) or "#00d5ff",
                    is_important=sat_json.get("is_important", False),
                    source_age_seconds=pos.source_age_seconds,
                    computation_method=pos.computation_method,
                    raw_position_json=None,
                )
                result["positions_written"] += 1
            except Exception as exc:
                result["errors"].append(
                    f"position_write_error norad={norad}: {exc}"
                )
        after_pos = get_position_count(conn)
        print(f"[DB] Positions after:  {after_pos} (delta: {after_pos - before_pos})")
        print(f"[REFRESH-POSITIONS] Recomputed: {result['positions_recomputed']}")
        print(f"[REFRESH-POSITIONS] Written:    {result['positions_written']}")
        if result["skipped_no_tle"]:
            print(f"[REFRESH-POSITIONS] Skipped (no TLE): {result['skipped_no_tle']}")
        if result["skipped_no_satellite_id"]:
            print(
                f"[REFRESH-POSITIONS] Skipped (no satellite_id in DB): "
                f"{result['skipped_no_satellite_id']}"
            )
        if result["errors"]:
            print(f"[REFRESH-POSITIONS] Errors: {len(result['errors'])} (first 5): {result['errors'][:5]}")
            sys.exit(1)
        print("[REFRESH-POSITIONS] Done.")
    except Exception as e:
        result["errors"].append(str(e))
        print(f"[REFRESH-POSITIONS] ERROR: {e}")
    finally:
        conn.close()

    return result


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
    parser.add_argument(
        "--refresh-positions-from-cache", action="store_true",
        help=(
            "Recompute positions from cached TLEs and write them to the DB. "
            "No provider calls, no catalog upserts. Use on a 1-5 min cadence "
            "to keep latest positions fresh between TLE refreshes."
        ),
    )
    parser.add_argument(
        "--propagator", type=str, default=None,
        choices=["auto", ENGINE_SGP4, ENGINE_SIMPLIFIED],
        help=(
            "Select the orbital propagator: 'auto' picks sgp4 if installed, "
            "otherwise the simplified fallback. 'sgp4' requires the "
            "python-sgp4 package and raises if it is missing. "
            "'simplified-fallback' is the always-available display-grade math."
        ),
    )
    parser.add_argument(
        "--print-sync-plan", action="store_true",
        help="Print the recommended incremental sync cadence and exit.",
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
    parser.add_argument(
        "--missing-only", action="store_true",
        help=(
            "Gap-fill mode: persist-from-cache only inserts objects whose "
            "NORAD ID is not already in the DB. Avoids duplicating CelesTrak "
            "rows when running a Space-Track full-catalog fetch."
        ),
    )
    args = parser.parse_args()

    # Normalize source ID early (celestrak / space-track / space_track)
    canonical_source = normalize_source_id(args.source)
    is_st = is_space_track_source(canonical_source)

    # For Space-Track, default group is "all" if none provided
    if is_st and not args.groups:
        groups = ["all"]
    elif args.groups:
        groups = args.groups
    else:
        groups = DEFAULT_GROUPS

    # --- Info ---
    if args.print_sync_plan:
        print_sync_plan()
        return

    # --- Staged modes ---
    if args.download_only:
        if not args.cache_dir:
            parser.error("--download-only requires --cache-dir")
        result = run_download_only(
            groups=groups,
            source=canonical_source,
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
            source=canonical_source,
            cache_dir=args.cache_dir,
            max_objects=args.max_objects,
            engine=args.propagator,
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
            source=canonical_source,
            cache_dir=args.cache_dir,
            max_objects=args.max_objects,
            database_url=args.database_url,
            missing_only=args.missing_only,
            refresh_positions=args.refresh_positions_from_cache,
            engine=args.propagator,
        )
        print("\n[SUMMARY]")
        print(f"  Source: {result['source']}")
        print(f"  Catalog written:   {result['catalog_written']}")
        print(f"  Positions written: {result['position_written']}")
        if args.refresh_positions_from_cache:
            print(f"  Positions mode:    REFRESH (recomputed from cached TLEs)")
            print(f"  Propagator used:   {result['propagator']}")
        if args.missing_only:
            print(f"  Positions backfilled (existing NORAD): {result['position_backfilled_existing_norad']}")
        print(f"  Skipped (older):   {result['skipped_older']}")
        if args.missing_only:
            print(f"  Skipped (existing NORAD): {result['skipped_existing']}")
            print(f"  Existing NORAD count: {result['existing_norad_count']}")
            print(f"  Missing NORAD count:  {result['missing_norad_count']}")
        if result["errors"]:
            print(f"  Errors: {result['errors']}")
            sys.exit(1)
        return

    if args.refresh_positions_from_cache:
        if not args.cache_dir:
            parser.error("--refresh-positions-from-cache requires --cache-dir")
        result = run_refresh_positions_from_cache(
            source=canonical_source,
            cache_dir=args.cache_dir,
            max_objects=args.max_objects,
            database_url=args.database_url,
            engine=args.propagator,
        )
        print("\n[SUMMARY]")
        print(f"  Source: {result['source']}")
        print(f"  Propagator used:    {result['propagator']}")
        print(f"  Positions recomputed: {result['positions_recomputed']}")
        print(f"  Positions written:  {result['positions_written']}")
        if result["skipped_no_tle"]:
            print(f"  Skipped (no TLE):   {result['skipped_no_tle']}")
        if result["skipped_no_satellite_id"]:
            print(f"  Skipped (no satellite_id in DB): {result['skipped_no_satellite_id']}")
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
        source=canonical_source,
        dry_run=dry_run,
        database_url=args.database_url,
        max_objects=args.max_objects,
        show_raw=args.show_raw,
        cache_dir=args.cache_dir,
        engine=args.propagator,
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
