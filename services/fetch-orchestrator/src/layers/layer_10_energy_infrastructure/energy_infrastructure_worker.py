"""Energy Infrastructure Worker — Layer 10 fetching/normalize/persist CLI.

The worker is the single entry point for the Layer 10 energy
infrastructure pipeline. It supports the staged pipeline
(``--download-only`` / ``--normalize-only`` / ``--persist-from-cache``)
and a one-shot ``--direct`` mode (download → normalize → optional
persist) used by the WRI dry-run smoke tests.

Usage examples:

  # 1) WRI: download only, no provider call after the first run
  python energy_infrastructure_worker.py \\
      --source wri_global_power_plant_database \\
      --download-only \\
      --cache-dir E:\\god-eyes-data\\energy \\
      --max-features 10

  # 2) WRI: normalize only (reads raw cache, no network)
  python energy_infrastructure_worker.py \\
      --source wri_global_power_plant_database \\
      --normalize-only \\
      --cache-dir E:\\god-eyes-data\\energy \\
      --max-features 10

  # 3) WRI: persist from cache (in-memory DB, no real writes)
  python energy_infrastructure_worker.py \\
      --source wri_global_power_plant_database \\
      --persist-from-cache \\
      --cache-dir E:\\god-eyes-data\\energy \\
      --max-features 10 \\
      --dry-run

  # 4) OSM: tiny bbox, no giant global query
  python energy_infrastructure_worker.py \\
      --source osm_energy_infrastructure \\
      --country GB \\
      --bbox "-6.5,49.5,1.5,61.0" \\
      --download-only \\
      --cache-dir E:\\god-eyes-data\\energy

The worker never prints the ``DATABASE_URL`` and never logs secrets.
"""

from __future__ import annotations

import argparse
import io
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

if sys.platform == "win32" and "pytest" not in sys.modules:
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    except Exception:
        pass

REPO_ROOT = Path(__file__).resolve().parents[5]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

sys.path.insert(0, str(Path(__file__).resolve().parent))

from energy_sources import (
    CANONICAL_SOURCES,
    LAYER_ID,
    SOURCE_GEM,
    SOURCE_OSM,
    SOURCE_WRI,
    get_source_config,
)
from energy_infrastructure_db import (
    DEFAULT_DATABASE_URL,
    connect_db,
    describe_db,
    get_feature_count,
    is_in_memory_connection,
    persist_features,
)
from energy_normalizer import (
    describe_normalizer,
    normalize_gem_records,
    normalize_osm_elements,
    normalize_wri_records,
)
from gem_energy_client import (
    DEFAULT_MOCK_GROUPS,
    LICENSE_BLOCKED_MESSAGE,
    describe_gem,
    fetch_gem,
)
from osm_energy_client import (
    DEFAULT_ENERGY_KEYS,
    describe_osm,
    fetch_osm,
)
from source_cache import (
    SourceCache,
    records_from_csv_text,
    resolve_cache_dir,
    utcnow_iso,
)
from wri_power_plants_client import (
    describe_wri,
    fetch_wri,
)

DEFAULT_MAX_FEATURES = 1000


# --------------------------------------------------------------------- helpers


def _resolve_source(source: str | None) -> str:
    """Return the canonical source id (or default to WRI)."""
    if not source:
        return SOURCE_WRI
    src = source.strip().lower()
    aliases = {
        "wri": SOURCE_WRI,
        "wri_global_power_plant_database": SOURCE_WRI,
        "osm": SOURCE_OSM,
        "osm_energy_infrastructure": SOURCE_OSM,
        "overpass": SOURCE_OSM,
        "gem": SOURCE_GEM,
        "global_energy_monitor_energy": SOURCE_GEM,
        "global_energy_monitor": SOURCE_GEM,
    }
    if src in CANONICAL_SOURCES:
        return src
    if src in aliases:
        return aliases[src]
    raise ValueError(
        f"Unknown source {source!r}; valid: {list(CANONICAL_SOURCES)}"
    )


def _print_banner(args: argparse.Namespace, source: str) -> None:
    print(f"[WORKER] Layer 10 Energy Infrastructure Fetcher")
    print(f"  Layer:  {LAYER_ID}")
    print(f"  Source: {source}")
    cfg = get_source_config(source)
    print(f"  Name:   {cfg.name}")
    print(f"  License: {cfg.license_name} (verified={cfg.license_verified})")
    if args.cache_dir:
        print(f"  Cache:  {args.cache_dir}")
    if args.bbox:
        print(f"  BBox:   {args.bbox}")
    if args.country:
        print(f"  Country: {args.country}")
    if args.region:
        print(f"  Region: {args.region}")
    if args.category:
        print(f"  Category filter: {args.category}")
    if args.max_features is not None:
        print(f"  Max features: {args.max_features}")
    if args.dry_run:
        print("  Mode:   DRY-RUN (no DB writes)")
    print()


# --------------------------------------------------------------------- modes


def run_download_only(args: argparse.Namespace) -> dict[str, Any]:
    """Download raw artifacts only. No normalization, no DB writes."""
    source = _resolve_source(args.source)
    _print_banner(args, source)
    cache = SourceCache(args.cache_dir)

    result: dict[str, Any] = {
        "source": source,
        "groups_requested": [],
        "groups_succeeded": [],
        "groups_failed": [],
        "raw_files_written": [],
        "errors": [],
        "record_count": 0,
        "license_verified": get_source_config(source).license_verified,
    }

    if source == SOURCE_WRI:
        groups = ["latest"]
        result["groups_requested"] = list(groups)
        csv_text = args.csv_text  # None unless --csv-text was provided
        fetch_result = fetch_wri(csv_text=csv_text)
        if not fetch_result["ok"]:
            err = fetch_result.get("error") or "WRI download failed"
            print(f"[FETCH] FAILED: {err}")
            result["groups_failed"].append("latest")
            result["errors"].append(err)
            cache.write_overall_manifest(
                source=source,
                groups_requested=groups,
                groups_succeeded=[],
                groups_failed=result["groups_failed"],
                raw_files=[],
                normalized_files=[],
                fetched_at=fetch_result.get("fetched_at"),
                normalized_at=None,
                feature_count=0,
                errors=result["errors"],
            )
            return result

        # Apply max-features early as a row cap to keep caches small.
        records = fetch_result["raw_records"]
        if args.max_features is not None and len(records) > args.max_features:
            records = records[: args.max_features]
            fetch_result["raw_records"] = records
            # Re-emit CSV text for the truncated set so disk + envelope match.
            header_keys = list(records[0].keys()) if records else []
            lines: list[str] = []
            if header_keys:
                lines.append(_csv_line(header_keys))
            for rec in records:
                lines.append(_csv_line([rec.get(k, "") for k in header_keys]))
            fetch_result["csv_text"] = "\n".join(lines) + "\n"

        raw_result = cache.write_raw_group(
            source=source,
            group="latest",
            raw_text=fetch_result["csv_text"],
            records=[dict(r) for r in fetch_result["raw_records"]],
            fetched_at=fetch_result.get("fetched_at"),
        )
        result["groups_succeeded"].append("latest")
        result["raw_files_written"].append(str(raw_result.raw_json_path) if raw_result.raw_json_path else "")
        result["record_count"] = raw_result.record_count
        print(f"  OK: {raw_result.record_count} records -> {raw_result.raw_json_path}")

    elif source == SOURCE_OSM:
        group = args.region or args.country or (
            args.bbox.replace(" ", "").replace(",", "_") if args.bbox else "global"
        )
        result["groups_requested"] = [group]
        fetch_result = fetch_osm(
            csv_text=args.csv_text,
            bbox=args.bbox,
            country=args.country,
            region=args.region,
            allow_global=args.allow_global,
            max_features=args.max_features,
        )
        if not fetch_result["ok"]:
            err = fetch_result.get("error") or "OSM fetch failed"
            print(f"[FETCH] FAILED: {err}")
            result["groups_failed"].append(group)
            result["errors"].append(err)
            cache.write_overall_manifest(
                source=source,
                groups_requested=[group],
                groups_succeeded=[],
                groups_failed=result["groups_failed"],
                raw_files=[],
                normalized_files=[],
                fetched_at=fetch_result.get("fetched_at"),
                normalized_at=None,
                feature_count=0,
                errors=result["errors"],
            )
            return result

        if args.max_features is not None:
            fetch_result["elements"] = fetch_result["elements"][: args.max_features]

        raw_result = cache.write_raw_group(
            source=source,
            group=group,
            raw_text=fetch_result["raw_text"],
            records=fetch_result["elements"],
            fetched_at=fetch_result.get("fetched_at"),
        )
        result["groups_succeeded"].append(group)
        result["raw_files_written"].append(str(raw_result.raw_json_path) if raw_result.raw_json_path else "")
        result["record_count"] = raw_result.record_count
        print(f"  OK: {raw_result.record_count} elements -> {raw_result.raw_json_path}")

    elif source == SOURCE_GEM:
        group = args.region or "mock_default"
        result["groups_requested"] = [group]
        fetch_result = fetch_gem(
            group=group,
            mock_records=args.gem_mock_records,
            mock_path=args.gem_mock_path,
            csv_text=args.csv_text,
        )
        if not fetch_result["ok"]:
            err = fetch_result.get("error") or LICENSE_BLOCKED_MESSAGE
            print(f"[FETCH] FAILED: {err}")
            result["groups_failed"].append(group)
            result["errors"].append(err)
            cache.write_overall_manifest(
                source=source,
                groups_requested=[group],
                groups_succeeded=[],
                groups_failed=result["groups_failed"],
                raw_files=[],
                normalized_files=[],
                fetched_at=fetch_result.get("fetched_at"),
                normalized_at=None,
                feature_count=0,
                errors=result["errors"],
            )
            return result

        records = fetch_result["records"]
        if args.max_features is not None:
            records = records[: args.max_features]
            fetch_result["records"] = records
            fetch_result["raw_text"] = json.dumps(records)

        raw_result = cache.write_raw_group(
            source=source,
            group=group,
            raw_text=fetch_result["raw_text"],
            records=records,
            fetched_at=fetch_result.get("fetched_at"),
        )
        result["groups_succeeded"].append(group)
        result["raw_files_written"].append(str(raw_result.raw_json_path) if raw_result.raw_json_path else "")
        result["record_count"] = raw_result.record_count
        print(f"  OK: {raw_result.record_count} records -> {raw_result.raw_json_path}")
        result["license_verified"] = fetch_result.get("license_verified", False)
    else:
        raise ValueError(f"Unhandled source: {source}")

    print(f"\n[DOWNLOAD-ONLY] Succeeded: {result['groups_succeeded']}")
    if result["groups_failed"]:
        print(f"[DOWNLOAD-ONLY] Failed:    {result['groups_failed']}")
    cache.write_overall_manifest(
        source=source,
        groups_requested=result["groups_requested"],
        groups_succeeded=result["groups_succeeded"],
        groups_failed=result["groups_failed"],
        raw_files=result["raw_files_written"],
        normalized_files=[],
        fetched_at=utcnow_iso(),
        normalized_at=None,
        feature_count=result["record_count"],
        errors=result["errors"],
    )
    return result


def run_normalize_only(args: argparse.Namespace) -> dict[str, Any]:
    """Read raw cache, normalize, write JSONL. No provider calls, no DB writes."""
    source = _resolve_source(args.source)
    _print_banner(args, source)
    cache = SourceCache(args.cache_dir)

    result: dict[str, Any] = {
        "source": source,
        "groups": [],
        "features_normalized": 0,
        "skipped": 0,
        "errors": [],
    }

    groups = cache.list_cached_groups(source)
    if not groups:
        msg = f"No raw cache for {source}; run --download-only first"
        print(f"[NORMALIZE-ONLY] {msg}")
        result["errors"].append(msg)
        return result

    if args.max_features is not None:
        result["max_features"] = args.max_features

    all_features: list[dict[str, Any]] = []
    for group in groups:
        envelope = cache.read_raw_group(source, group)
        if envelope is None:
            result["errors"].append(f"Failed to read {source}/{group}")
            continue
        records = envelope.get("records") or []
        if not records:
            result["errors"].append(f"Empty raw cache for {source}/{group}")
            continue

        if source == SOURCE_WRI:
            features = normalize_wri_records(records)
        elif source == SOURCE_OSM:
            features = normalize_osm_elements(records)
        elif source == SOURCE_GEM:
            features = normalize_gem_records(records)
        else:
            features = []

        if args.category:
            features = [f for f in features if f.get("category") == args.category]

        print(
            f"[NORMALIZE] {source}/{group}: "
            f"{len(records)} raw -> {len(features)} canonical"
        )
        all_features.extend(features)
        result["groups"].append(group)

    if args.max_features is not None and len(all_features) > args.max_features:
        all_features = all_features[: args.max_features]
        print(f"[NORMALIZE-ONLY] Truncated to {args.max_features} features")

    manifest = cache.write_normalized(
        features=all_features,
        groups=result["groups"],
        source=source,
        errors=result["errors"],
    )

    result["features_normalized"] = len(all_features)
    result["manifest_path"] = manifest.get("features_path")
    print(f"\n[NORMALIZE-ONLY] Features: {result['features_normalized']}")
    print(f"[NORMALIZE-ONLY] Manifest: {manifest.get('features_path')}")
    return result


def run_persist_from_cache(args: argparse.Namespace) -> dict[str, Any]:
    """Read normalized cache, upsert to DB. No provider calls."""
    source = _resolve_source(args.source)
    _print_banner(args, source)
    cache = SourceCache(args.cache_dir)

    result: dict[str, Any] = {
        "source": source,
        "inserted": 0,
        "updated": 0,
        "skipped": 0,
        "errors": 0,
        "total": 0,
        "dry_run": args.dry_run,
    }

    features = cache.read_normalized_features()
    if not features:
        msg = "No normalized cache; run --normalize-only first"
        print(f"[PERSIST-FROM-CACHE] {msg}")
        result["error"] = msg
        return result

    if args.category:
        features = [f for f in features if f.get("category") == args.category]
    if args.max_features is not None and len(features) > args.max_features:
        features = features[: args.max_features]
    result["total"] = len(features)
    print(f"[PERSIST-FROM-CACHE] {result['total']} features to process")

    if args.dry_run:
        # Just count what would be written; the in-memory mock still
        # provides parameter-validation guarantees.
        conn = _connect_for_persist(args)
        try:
            summary = persist_features(conn, features, dry_run=True)
        finally:
            try:
                conn.close()
            except Exception:
                pass
        result.update(summary)
        print(
            f"[PERSIST-FROM-CACHE] DRY-RUN inserted={summary['inserted']} "
            f"updated={summary['updated']} errors={summary['errors']}"
        )
        return result

    conn = _connect_for_persist(args)
    try:
        before = get_feature_count(conn)
        print(f"[DB] Before: count={before}")
        summary = persist_features(conn, features, dry_run=False)
        after = get_feature_count(conn)
        print(f"[DB] After:  count={after}")
        result.update(summary)
        result["before_count"] = before
        result["after_count"] = after
        print(
            f"[PERSIST-FROM-CACHE] inserted={summary['inserted']} "
            f"updated={summary['updated']} errors={summary['errors']}"
        )
    finally:
        try:
            conn.close()
        except Exception:
            pass
    return result


def _connect_for_persist(args: argparse.Namespace) -> Any:
    if args.in_memory_db:
        from energy_infrastructure_db import EnergyInfrastructureInMemoryConnection
        return EnergyInfrastructureInMemoryConnection()
    return connect_db(args.database_url or DEFAULT_DATABASE_URL)


# A tiny flag the dry-run branch can read without spinning up a
# throwaway connection (kept module-level to make the intent obvious).
is_in_memory_connection_only = False


# --------------------------------------------------------------------- CLI


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Layer 10 Energy Infrastructure fetcher/normalize/persist worker"
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--download-only", action="store_true", help="Download raw data only")
    mode.add_argument("--normalize-only", action="store_true", help="Normalize cached raw data only")
    mode.add_argument("--persist-from-cache", action="store_true", help="Persist cached normalized data to DB")
    mode.add_argument("--direct", action="store_true", help="Download -> normalize -> (optional) persist in one shot")

    parser.add_argument(
        "--source",
        default=SOURCE_WRI,
        help="Source id: wri_global_power_plant_database | osm_energy_infrastructure | global_energy_monitor_energy",
    )
    parser.add_argument("--category", default=None, help="Filter by canonical category")
    parser.add_argument("--country", default=None, help="ISO 3166-1 alpha-2 country code (OSM only)")
    parser.add_argument("--region", default=None, help="Free-form region label (OSM/GEM)")
    parser.add_argument("--bbox", default=None, help="Bounding box 'west,south,east,north' (OSM only)")
    parser.add_argument("--allow-global", action="store_true", help="Test mode: allow global OSM queries (not for production)")
    parser.add_argument("--max-features", type=int, default=DEFAULT_MAX_FEATURES, help="Maximum features processed")
    parser.add_argument("--cache-dir", default=None, help="Cache root directory (e.g. E:\\god-eyes-data\\energy)")
    parser.add_argument("--dry-run", action="store_true", help="Do not write to the database")

    # Internal / test-only knobs.
    parser.add_argument("--csv-text", default=None, help="Test-only: inject CSV / JSON text instead of downloading")
    parser.add_argument("--gem-mock-records", default=None, help="Test-only: JSON list of GEM mock records")
    parser.add_argument("--gem-mock-path", default=None, help="Test-only: path to a JSON file of GEM mock records")
    parser.add_argument("--in-memory-db", action="store_true", help="Test-only: use an in-memory DB mock")
    parser.add_argument("--database-url", default=None, help="PostgreSQL URL (env-only preferred; never printed)")

    return parser


def _coerce_gem_mock_records(value: str | None) -> list[dict[str, Any]] | None:
    if not value:
        return None
    parsed = json.loads(value)
    if not isinstance(parsed, list):
        raise ValueError("--gem-mock-records must be a JSON list")
    return [p for p in parsed if isinstance(p, dict)]


def main(argv: list[str] | None = None) -> int:
    parser = build_arg_parser()
    args = parser.parse_args(argv)

    # Normalize the GEM mock records arg if provided.
    if args.gem_mock_records:
        try:
            args.gem_mock_records = _coerce_gem_mock_records(args.gem_mock_records)
        except (ValueError, json.JSONDecodeError) as exc:
            print(f"[ERROR] --gem-mock-records invalid: {exc}")
            return 2

    # Default to --download-only if no mode is given, so a bare
    # invocation still produces a cache envelope (no DB writes).
    if not (args.download_only or args.normalize_only or args.persist_from_cache or args.direct):
        args.download_only = True

    # Cache-dir is required for every mode.
    if not args.cache_dir:
        print("[ERROR] --cache-dir is required")
        return 2
    try:
        resolve_cache_dir(args.cache_dir)
    except Exception as exc:
        print(f"[ERROR] cache-dir: {exc}")
        return 2

    if args.direct:
        dl = run_download_only(args)
        if dl.get("groups_failed"):
            print("[DIRECT] Download had failures; normalize will skip those groups")
        return _run_direct_persist(args) if not dl.get("groups_failed") else 1

    if args.download_only:
        dl = run_download_only(args)
        if dl.get("groups_failed") or dl.get("record_count", 0) == 0:
            return 1
        return 0
    if args.normalize_only:
        res = run_normalize_only(args)
        if res.get("errors") or res.get("features_normalized", 0) == 0:
            return 1
        return 0
    if args.persist_from_cache:
        res = run_persist_from_cache(args)
        if res.get("error") or res.get("errors", 0) > 0:
            return 1
        return 0

    return 0


def _run_direct_persist(args: argparse.Namespace) -> int:
    """After a successful download, normalize + persist immediately."""
    norm = run_normalize_only(args)
    if norm.get("errors"):
        print(f"[DIRECT] Normalize reported {len(norm['errors'])} non-fatal errors")
    res = run_persist_from_cache(args)
    if res.get("error") or res.get("errors", 0) > 0:
        return 1
    return 0


def _csv_line(values: list[Any]) -> str:
    out: list[str] = []
    for v in values:
        if v is None:
            out.append("")
            continue
        s = str(v)
        if any(c in s for c in [",", "\n", '"']):
            s = '"' + s.replace('"', '""') + '"'
        out.append(s)
    return ",".join(out)


# Re-export helpers for tests.
__all__ = [
    "build_arg_parser",
    "main",
    "run_download_only",
    "run_normalize_only",
    "run_persist_from_cache",
    "_resolve_source",
]


if __name__ == "__main__":
    raise SystemExit(main())
