"""CLI proof command for Layer 08 News & OSINT — GDACS fetcher.

Usage:
    python -m layers.layer_08_news_osint --source gdacs --proof
    python -m layers.layer_08_news_osint --source gdacs --proof --normalize
    python -m layers.layer_08_news_osint --source gdacs --proof --normalize --ingest-db
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _require_database_url() -> str:
    db_url = os.environ.get("DATABASE_URL", "").strip()
    if not db_url:
        print(
            "ERROR: DATABASE_URL environment variable is not set.\n"
            "  Set it to your local PostGIS connection string, for example:\n"
            "  $env:DATABASE_URL='postgresql://god_eyes:god_eyes_dev_password@localhost:5432/god_eyes_dev'",
            file=sys.stderr,
        )
        sys.exit(1)
    return db_url


def _connect_db(database_url: str) -> Any:
    import psycopg
    from psycopg.rows import dict_row
    return psycopg.connect(database_url, row_factory=dict_row)


def _save_ingestion_summary(run_dir: Path, summary: dict[str, Any]) -> str:
    path = run_dir / "gdacs_ingestion_summary.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(summary, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
    return str(path)


def _run_gdacs_proof(args: argparse.Namespace) -> int:
    from layers.layer_08_news_osint.gdacs_fetcher import fetch_gdacs_events, summarise_events
    from layers.layer_08_news_osint import gdacs_raw_storage as storage

    print("=== Layer 08 News & OSINT — GDACS Proof Fetch ===")
    print(f"  eventtype   : {args.eventtype}")
    print(f"  alertlevel  : {args.alertlevel}")
    print(f"  fetch-client: {args.fetch_client}")
    print(f"  timeout     : {args.timeout}s")
    print()

    try:
        result = fetch_gdacs_events(
            eventtype=args.eventtype,
            alertlevel=args.alertlevel,
            timeout=args.timeout,
            fetch_client=args.fetch_client,
        )
    except Exception as exc:
        print(f"FAILED: {exc}", file=sys.stderr)
        return 1

    summary = summarise_events(result)

    print(f"  source      : {summary['source_id']}")
    print(f"  endpoint    : {summary['endpoint_url']}")
    print(f"  items fetched          : {summary['item_count']}")
    print(f"  items with coordinates : {summary['items_with_coordinates']}")
    print()
    print("  Alert level counts:")
    for k, v in sorted(summary["alert_level_counts"].items()):
        print(f"    {k}: {v}")
    print()
    print("  Event type counts:")
    for k, v in sorted(summary["event_type_counts"].items()):
        print(f"    {k}: {v}")

    now = datetime.now(timezone.utc)
    run_id = storage.make_run_id(now)
    run_dir = storage.run_directory(run_id, dt=now)

    raw_path = storage.save_raw_events(run_dir, result.raw_payload)
    summary_path = storage.save_proof_summary(run_dir, summary)

    print()
    print(f"  raw output  : {raw_path}")
    print(f"  summary     : {summary_path}")

    norm_result = None
    if getattr(args, "normalize", False):
        from layers.layer_08_news_osint.gdacs_normalizer import normalize_gdacs_payload

        norm_result = normalize_gdacs_payload(
            result.raw_payload,
            fetched_at=result.fetched_at,
            raw_evidence_uri=raw_path,
        )

        norm_path = storage.save_normalized_events(run_dir, norm_result)
        norm_summary_path = storage.save_normalized_summary(run_dir, norm_result)

        print()
        print("  --- Normalization ---")
        print(f"  total features    : {norm_result['total_features']}")
        print(f"  normalized items  : {norm_result['normalized_items']}")
        print(f"  marker-ready      : {norm_result['marker_ready_items']}")
        print(f"  skipped           : {norm_result['skipped_items']}")
        print()
        print("  Geometry type counts:")
        for k, v in sorted(norm_result["geometry_type_counts"].items()):
            print(f"    {k}: {v}")
        print()
        print("  Severity counts:")
        for k, v in sorted(norm_result["alert_level_counts"].items()):
            print(f"    {k}: {v}")
        print()
        print("  Event type counts:")
        for k, v in sorted(norm_result["event_type_counts"].items()):
            print(f"    {k}: {v}")
        print()
        print(f"  normalized output  : {norm_path}")
        print(f"  normalized summary : {norm_summary_path}")

    if getattr(args, "ingest_db", False):
        if norm_result is None:
            print(
                "ERROR: --ingest-db requires --normalize to be specified as well.",
                file=sys.stderr,
            )
            return 1
        return _run_gdacs_ingest_db(args, result, norm_result, run_dir, run_id)

    print()
    print("  (output saved locally under tmp/ — not committed)")

    return 0 if summary["item_count"] > 0 else 1


def _run_gdacs_ingest_db(
    args: argparse.Namespace,
    result: Any,
    norm_result: dict[str, Any],
    run_dir: Path,
    run_id: str,
) -> int:
    """Run fetch + normalize + DB ingest and print the full proof summary."""
    from database.ingestion.layers.layer_08_news_osint.gdacs_db_ingestion import (
        complete_fetch_run,
        create_fetch_run,
        ingest_gdacs_items,
    )

    print()
    print("  --- Database Ingestion ---")

    db_url = _require_database_url()
    conn = _connect_db(db_url)

    try:
        create_fetch_run(conn, run_id)
        conn.commit()
        print(f"  fetch_run_id  : {run_id}")
        print(f"  status        : running")
    except Exception as exc:
        conn.rollback()
        print(f"  FAILED to create fetch run: {exc}", file=sys.stderr)
        conn.close()
        return 1

    try:
        ingest_result = ingest_gdacs_items(
            conn,
            norm_result["items"],
            fetch_run_id=run_id,
            fetched_at=result.fetched_at,
        )
    except Exception as exc:
        conn.rollback()
        try:
            complete_fetch_run(
                conn, run_id,
                status="failed",
                fetched_item_count=result.item_count,
                normalized_item_count=norm_result["normalized_items"],
                marker_ready_count=norm_result["marker_ready_items"],
                skipped_item_count=norm_result["skipped_items"],
                error_message=str(exc)[:500],
            )
            conn.commit()
        except Exception:
            conn.rollback()
        print(f"  FAILED during ingestion: {exc}", file=sys.stderr)
        conn.close()
        return 1

    status = "success"
    if ingest_result["errors"]:
        status = "partial"

    complete_fetch_run(
        conn, run_id,
        status=status,
        fetched_item_count=result.item_count,
        normalized_item_count=norm_result["normalized_items"],
        marker_ready_count=norm_result["marker_ready_items"],
        skipped_item_count=norm_result["skipped_items"],
        raw_output_uri=str(run_dir / "gdacs_events.json"),
        normalized_output_uri=str(run_dir / "gdacs_normalized.json"),
        provider_metadata={
            "event_type_counts": norm_result.get("event_type_counts", {}),
            "alert_level_counts": norm_result.get("alert_level_counts", {}),
            "geometry_type_counts": norm_result.get("geometry_type_counts", {}),
        },
    )
    conn.commit()

    # Gather geometry and severity breakdowns from norm_result
    geo_counts = norm_result.get("geometry_type_counts", {})
    severity_counts: Counter[str] = Counter()
    event_type_counts: Counter[str] = Counter()
    for item in norm_result["items"]:
        severity_counts[item.get("severity", "unknown")] += 1
        event_type_counts[item.get("provider_metadata", {}).get("eventtype", "unknown")] += 1

    point_count = geo_counts.get("Point", 0)
    linestring_count = geo_counts.get("LineString", 0)
    polygon_count = geo_counts.get("Polygon", 0)

    # Count DB table rows
    db_counts = _count_db_tables(conn)

    # Build and save ingestion summary
    ingestion_summary: dict[str, Any] = {
        "source": "gdacs",
        "fetch_run_id": run_id,
        "status": status,
        "fetched_count": result.item_count,
        "normalized_count": norm_result["normalized_items"],
        "inserted_latest": ingest_result["inserted_latest"],
        "updated_latest": ingest_result["updated_latest"],
        "unchanged_latest": ingest_result["unchanged_latest"],
        "history_rows_inserted": ingest_result["history_rows_inserted"],
        "raw_refs_inserted": ingest_result["raw_refs_inserted"],
        "marker_ready_count": norm_result["marker_ready_items"],
        "point_count": point_count,
        "linestring_count": linestring_count,
        "polygon_count": polygon_count,
        "severity_breakdown": dict(severity_counts),
        "event_type_breakdown": dict(event_type_counts),
        "db_table_counts": db_counts,
        "raw_output_path": str(run_dir / "gdacs_events.json"),
        "normalized_output_path": str(run_dir / "gdacs_normalized.json"),
        "ingestion_errors": ingest_result["errors"],
    }

    summary_path = _save_ingestion_summary(run_dir, ingestion_summary)

    conn.close()

    # Print full proof summary
    print()
    print(f"  source                : gdacs")
    print(f"  fetch_run_id          : {run_id}")
    print(f"  status                : {status}")
    print(f"  fetched count         : {result.item_count}")
    print(f"  normalized count      : {norm_result['normalized_items']}")
    print(f"  inserted latest       : {ingest_result['inserted_latest']}")
    print(f"  updated latest        : {ingest_result['updated_latest']}")
    print(f"  unchanged latest      : {ingest_result['unchanged_latest']}")
    print(f"  history rows inserted : {ingest_result['history_rows_inserted']}")
    print(f"  raw refs inserted     : {ingest_result['raw_refs_inserted']}")
    print(f"  marker-ready count    : {norm_result['marker_ready_items']}")
    print(f"  Point count           : {point_count}")
    print(f"  LineString count      : {linestring_count}")
    print(f"  Polygon count         : {polygon_count}")
    print()
    print("  Severity breakdown:")
    for k, v in sorted(severity_counts.items()):
        print(f"    {k}: {v}")
    print()
    print("  Event type breakdown:")
    for k, v in sorted(event_type_counts.items()):
        print(f"    {k}: {v}")
    print()
    print("  Database table counts after ingest:")
    for table, count in sorted(db_counts.items()):
        print(f"    {table}: {count}")
    print()
    print(f"  raw output path           : {run_dir / 'gdacs_events.json'}")
    print(f"  normalized output path    : {run_dir / 'gdacs_normalized.json'}")
    print(f"  ingestion summary path    : {summary_path}")

    if ingest_result["errors"]:
        print()
        print("  Ingestion errors:")
        for err in ingest_result["errors"]:
            print(f"    - {err}")

    print()
    print("  (output saved locally under tmp/ — not committed)")

    return 0 if status == "success" else 1


def _count_db_tables(conn: Any) -> dict[str, int]:
    """Count rows in the four news tables."""
    tables = [
        "news_fetch_runs",
        "news_items_latest",
        "news_item_history",
        "news_raw_message_refs",
    ]
    counts: dict[str, int] = {}
    for table in tables:
        with conn.cursor() as cursor:
            cursor.execute(f"SELECT count(*) AS cnt FROM {table}")
            row = cursor.fetchone()
            counts[table] = row["cnt"] if isinstance(row, dict) else row[0]
    return counts


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="layer_08_news_osint",
        description="Layer 08 News & OSINT CLI",
    )
    parser.add_argument("--source", required=True, choices=["gdacs"], help="Source to use")
    parser.add_argument("--proof", action="store_true", help="Run proof fetch")
    parser.add_argument("--normalize", action="store_true", help="Also normalize fetched data")
    parser.add_argument("--ingest-db", dest="ingest_db", action="store_true",
                        help="Ingest normalized data into local database")
    parser.add_argument("--eventtype", default="ALL", help="GDACS event type filter")
    parser.add_argument("--alertlevel", default="ALL", help="GDACS alert level filter")
    parser.add_argument("--timeout", type=int, default=30, help="Request timeout in seconds")
    parser.add_argument(
        "--fetch-client",
        dest="fetch_client",
        default="auto",
        choices=["urllib", "curl", "auto"],
        help="HTTP client to use",
    )
    parser.add_argument("--keep-raw", action="store_true", help="Keep raw output (no-op, always kept)")

    args = parser.parse_args(argv)

    if args.source == "gdacs" and args.proof:
        return _run_gdacs_proof(args)

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
