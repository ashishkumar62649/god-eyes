"""CLI proof command for Layer 08 News & OSINT — GDACS fetcher.

Usage:
    python -m layers.layer_08_news_osint --source gdacs --proof
    python -m layers.layer_08_news_osint --source gdacs --proof --normalize
    python -m layers.layer_08_news_osint --source gdacs --proof --fetch-client auto --normalize
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone


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

    print()
    print("  (output saved locally under tmp/ — not committed)")

    return 0 if summary["item_count"] > 0 else 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="layer_08_news_osint",
        description="Layer 08 News & OSINT CLI",
    )
    parser.add_argument("--source", required=True, choices=["gdacs"], help="Source to use")
    parser.add_argument("--proof", action="store_true", help="Run proof fetch")
    parser.add_argument("--normalize", action="store_true", help="Also normalize fetched data")
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
