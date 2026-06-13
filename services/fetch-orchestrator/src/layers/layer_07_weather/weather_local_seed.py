"""Dev-only local seed workflow for Layer 07 Weather proof data.

Fetches a small proof dataset (7 cities) from Open-Meteo, normalizes it,
and ingests it into the local PostGIS database for manual UI review.

Usage:
    python -m layers.layer_07_weather.weather_local_seed --proof --current-only
    python -m layers.layer_07_weather.weather_local_seed --proof --current-only --dry-run
    python -m layers.layer_07_weather.weather_local_seed --proof --current-only --skip-fetch
    python -m layers.layer_07_weather.weather_local_seed --proof --current-only --fetch-client curl

Environment:
    DATABASE_URL  -- required, postgres://... (password never printed)

Safety:
    - Default mode: proof only (7 cities). No full grid path.
    - Raw files are local-only, untracked, must not be committed.
    - Script fails clearly on missing DATABASE_URL or missing tables.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Any

from layers.layer_07_weather.open_meteo_client import (
    fetch_weather_batch,
    fetch_weather_batch_via_curl,
    fetch_weather_current_only,
    fetch_weather_current_only_via_curl,
)
from layers.layer_07_weather.weather_grid import get_proof_coordinates
from layers.layer_07_weather import weather_raw_storage as storage
from layers.layer_07_weather.weather_normalizer import normalize_open_meteo_batch

REQUIRED_TABLES = (
    "weather_sources",
    "weather_locations",
    "weather_observations_latest",
    "weather_observation_history",
)

EXPECTED_SOURCE_COUNT = 1


def _print_summary(d: dict[str, Any]) -> None:
    for k, v in d.items():
        print(f"  {k}: {v}")


def validate_env() -> str:
    """Return DATABASE_URL or exit with clear error."""
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        print("ERROR: DATABASE_URL environment variable is not set.", file=sys.stderr)
        print("  Set it to your local PostGIS connection string.", file=sys.stderr)
        sys.exit(1)
    return url


def connect_to_db(database_url: str) -> Any:
    """Connect to PostGIS and validate required tables exist."""
    try:
        import psycopg2
    except ImportError:
        print("ERROR: psycopg2 is required. pip install psycopg2-binary", file=sys.stderr)
        sys.exit(1)

    try:
        conn = psycopg2.connect(database_url)
    except Exception as exc:
        print(f"ERROR: Could not connect to database: {exc}", file=sys.stderr)
        sys.exit(1)

    with conn.cursor() as cur:
        cur.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = ANY(%s)",
            (list(REQUIRED_TABLES),),
        )
        found = {row[0] for row in cur.fetchall()}

    missing = [t for t in REQUIRED_TABLES if t not in found]
    if missing:
        print(f"ERROR: Missing database tables: {', '.join(missing)}", file=sys.stderr)
        print("  Run the Layer 07 Weather migration first.", file=sys.stderr)
        conn.close()
        sys.exit(1)

    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM weather_sources")
        source_count = cur.fetchone()[0]
    if source_count < EXPECTED_SOURCE_COUNT:
        print(
            f"ERROR: weather_sources has {source_count} row(s), expected >= {EXPECTED_SOURCE_COUNT}.",
            file=sys.stderr,
        )
        conn.close()
        sys.exit(1)

    return conn


# ---------------------------------------------------------------------------
# Fetch phase
# ---------------------------------------------------------------------------

def fetch_proof_data(
    forecast_days: int,
    raw_base: str | Path = "raw",
    fetch_client: str = "urllib",
    current_only: bool = False,
) -> dict[str, Any]:
    """Fetch proof coordinates from Open-Meteo. Returns batch data + metadata."""
    coords = get_proof_coordinates()
    lats = [c["latitude"] for c in coords]
    lons = [c["longitude"] for c in coords]

    now = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
    run_id = storage.make_run_id(now)
    run_dir = storage.run_directory(run_id, base=raw_base, dt=now)
    run_dir.mkdir(parents=True, exist_ok=True)

    if current_only:
        if fetch_client == "curl":
            print("  Using curl.exe (IPv4/TLS1.2/HTTP1.1), current-only...")
            result = fetch_weather_current_only_via_curl(lats, lons, batch_index=0)
        else:
            result = fetch_weather_current_only(lats, lons, batch_index=0)
    else:
        if fetch_client == "curl":
            print("  Using curl.exe (IPv4/TLS1.2/HTTP1.1) fallback...")
            result = fetch_weather_batch_via_curl(lats, lons, forecast_days=forecast_days, batch_index=0)
        else:
            result = fetch_weather_batch(lats, lons, forecast_days=forecast_days, batch_index=0)

    data = result["data"]
    request_meta = result["request_meta"]
    raw_path = storage.save_batch(run_dir, 0, data)

    return {
        "batch_data": data,
        "request_meta": request_meta,
        "raw_path": raw_path,
        "run_dir": run_dir,
        "coords": coords,
        "run_id": run_id,
    }


def load_raw_data(raw_root: str = "raw") -> dict[str, Any]:
    """Load the most recent raw batch run from disk."""
    raw_base = Path(raw_root) / "layer_07_weather" / "open-meteo"
    if not raw_base.exists():
        print(f"ERROR: No raw data found at {raw_base}", file=sys.stderr)
        sys.exit(1)

    runs = sorted(raw_base.glob("*/*/*/run_*"))
    if not runs:
        print(f"ERROR: No fetch runs found in {raw_base}", file=sys.stderr)
        sys.exit(1)

    latest_run = runs[-1]
    batches_dir = latest_run / "batches"
    if not batches_dir.exists():
        print(f"ERROR: No batches directory in {latest_run}", file=sys.stderr)
        sys.exit(1)

    batch_files = sorted(batches_dir.glob("batch_*.json"))
    if not batch_files:
        print(f"ERROR: No batch files in {batches_dir}", file=sys.stderr)
        sys.exit(1)

    import json
    all_data = []
    for bf in batch_files:
        data = json.loads(bf.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            data = [data]
        all_data.extend(data)

    return {
        "batch_data": all_data,
        "raw_path": str(batch_files[0]),
        "run_dir": latest_run,
        "coords": get_proof_coordinates(),
        "run_id": latest_run.name,
    }


# ---------------------------------------------------------------------------
# Normalize phase
# ---------------------------------------------------------------------------

def normalize_data(
    batch_data: list[dict[str, Any]],
    coords: list[dict[str, Any]],
    raw_evidence_uri: str | None = None,
) -> list[dict[str, Any]]:
    """Normalize raw batch data into observation dicts."""
    return normalize_open_meteo_batch(
        batch_data, coords, raw_evidence_uri=raw_evidence_uri,
    )


# ---------------------------------------------------------------------------
# Ingest phase
# ---------------------------------------------------------------------------

def ingest_observations(
    conn: Any,
    normalized: list[dict[str, Any]],
    *,
    dry_run: bool = False,
    current_only: bool = False,
    skip_fetch_run: bool = False,
) -> dict[str, Any]:
    """Ingest normalized observations into the database."""
    from database.ingestion.layers.layer_07_weather import weather_ingestion

    all_observations: list[dict[str, Any]] = []
    for group in normalized:
        current = group.get("current")
        if current is not None:
            all_observations.append(current)
        if not current_only:
            for hourly in group.get("hourly", []):
                all_observations.append(hourly)

    if not all_observations:
        return {"observations_ingested": 0}

    if dry_run:
        return {"observations_ingested": len(all_observations), "dry_run": True}

    fetch_run = None
    raw_refs: list[dict[str, Any]] = []
    if not skip_fetch_run:
        from datetime import datetime, timezone

        run_id = f"local_seed_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"
        fetch_run = {
            "fetch_run_id": run_id,
            "source_id": "open-meteo",
            "grid_resolution": "proof",
            "total_cells": len(all_observations),
            "successful_cells": len(all_observations),
            "failed_cells": 0,
            "fetch_started_at": datetime.now(timezone.utc).isoformat(),
            "status": "completed",
        }

    weather_ingestion.ingest_weather_observations(
        conn, all_observations, fetch_run=fetch_run, raw_refs=raw_refs or None,
    )

    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM weather_observations_latest")
        latest_count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM weather_observation_history")
        history_count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM weather_locations")
        location_count = cur.fetchone()[0]

    return {
        "observations_ingested": len(all_observations),
        "latest_rows": latest_count,
        "history_rows": history_count,
        "location_rows": location_count,
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="weather_local_seed",
        description="Dev-only local seed for Layer 07 Weather proof data",
    )
    p.add_argument(
        "--proof", action="store_true", default=True,
        help="Use proof coordinates only (7 cities). Default and only safe mode.",
    )
    p.add_argument(
        "--current-only", action="store_true", default=False,
        help="Fetch and ingest current observations only (no hourly). Recommended for local proof.",
    )
    p.add_argument(
        "--forecast-days", type=int, default=1,
        help="Number of forecast days when not using --current-only (default: 1)",
    )
    p.add_argument(
        "--dry-run", action="store_true",
        help="Fetch and normalize only. Do not write to the database.",
    )
    p.add_argument(
        "--keep-raw", action="store_true",
        help="Keep raw files on disk after ingestion.",
    )
    p.add_argument(
        "--raw-root", type=str, default="raw",
        help="Root directory for raw file storage (default: raw)",
    )
    p.add_argument(
        "--skip-fetch", action="store_true",
        help="Skip fetching. Use most recent raw files from disk.",
    )
    p.add_argument(
        "--fetch-client", type=str, default="urllib",
        choices=["urllib", "curl"],
        help="HTTP client for fetching (default: urllib). Use 'curl' for Windows TLS/IPv6 issues.",
    )
    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    database_url = validate_env()
    conn = connect_to_db(database_url)

    mode_label = "current-only proof" if args.current_only else "proof"
    print(f"=== Layer 07 Weather — Local Proof Seed ({mode_label}) ===\n")

    try:
        if args.skip_fetch:
            print("[1/4] Loading raw data from disk...")
            raw = load_raw_data(args.raw_root)
        else:
            print("[1/4] Fetching proof data from Open-Meteo...")
            raw = fetch_proof_data(
                args.forecast_days,
                args.raw_root,
                args.fetch_client,
                current_only=args.current_only,
            )
        batch_data = raw["batch_data"]
        coords = raw["coords"]
        raw_uri = raw["raw_path"]
        run_dir = raw["run_dir"]
        print(f"  Fetched {len(batch_data)} coordinate responses.\n")
    except SystemExit:
        raise
    except Exception as exc:
        print(f"FAILED during fetch: {exc}", file=sys.stderr)
        return 1

    try:
        print("[2/4] Normalizing observations...")
        normalized = normalize_data(batch_data, coords, raw_uri)
        current_count = sum(1 for g in normalized if g.get("current") is not None)
        hourly_count = sum(len(g.get("hourly", [])) for g in normalized)
        if args.current_only:
            print(f"  Normalized: {current_count} current observations (hourly skipped).\n")
        else:
            print(f"  Normalized: {current_count} current, {hourly_count} hourly.\n")
    except Exception as exc:
        print(f"FAILED during normalization: {exc}", file=sys.stderr)
        return 1

    if args.dry_run:
        ingest_count = current_count if args.current_only else current_count + hourly_count
        print("[3/4] Dry run — skipping database ingest.\n")
        print("[4/4] Summary:\n")
        _print_summary({
            "mode": f"dry_run ({'current-only' if args.current_only else 'full'})",
            "locations_fetched": len(coords),
            "current_observations_normalized": current_count,
            **({"hourly_observations_normalized": hourly_count} if not args.current_only else {}),
            "observations_would_ingest": ingest_count,
            "raw_dir": str(run_dir),
        })
        print("\nDry run complete. No database changes made.")
        return 0

    try:
        print("[3/4] Ingesting into database...")
        result = ingest_observations(
            conn, normalized,
            dry_run=False,
            current_only=args.current_only,
            skip_fetch_run=False,
        )
        print(f"  Ingested: {result['observations_ingested']} observations.\n")
    except Exception as exc:
        print(f"FAILED during ingestion: {exc}", file=sys.stderr)
        conn.close()
        return 1

    print("[4/4] Summary:\n")
    summary: dict[str, Any] = {
        "mode": "current-only proof" if args.current_only else "proof",
        "locations_fetched": len(coords),
        "current_observations_normalized": current_count,
        "current_observations_ingested": result["observations_ingested"],
        "latest_row_count": result.get("latest_rows"),
        "history_row_count": result.get("history_rows"),
        "raw_dir": str(run_dir),
    }
    if not args.current_only:
        summary["hourly_observations_normalized"] = hourly_count
        summary["forecast_days"] = args.forecast_days
    _print_summary(summary)

    if not args.keep_raw:
        print("\nRaw files are local-only and untracked.")
        print("Use --keep-raw to retain them on disk.")

    conn.close()
    print("\nDone. Weather markers should now be visible on the globe.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
