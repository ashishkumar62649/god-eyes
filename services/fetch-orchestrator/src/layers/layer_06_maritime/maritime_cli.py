"""Maritime Fetcher CLI

Terminal wrapper for maritime fetcher. For development/manual validation only.
"""

import argparse
import sys
from pathlib import Path

# Determine source root: services/fetch-orchestrator/src
_this_file = Path(__file__).resolve()
_services_src = _this_file.parents[2]

if str(_services_src) not in sys.path:
    sys.path.insert(0, str(_services_src))

from layers.layer_06_maritime.maritime_fetcher import MaritimeFetcher
from layers.layer_06_maritime.maritime_normalizer import normalize_from_cache
from layers.layer_06_maritime.maritime_ingestion import MaritimeIngestion


def main():
    parser = argparse.ArgumentParser(
        description="Maritime AIS fetcher CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # Proof mode
    proof_parser = subparsers.add_parser("proof", help="Run proof mode capture")
    proof_parser.add_argument(
        "--max-messages", type=int, default=100, help="Max messages (default: 100)"
    )
    proof_parser.add_argument(
        "--duration-seconds", type=float, default=60, help="Max duration (default: 60)"
    )
    proof_parser.add_argument(
        "--output-root", type=Path, help="Output root directory"
    )
    proof_parser.add_argument(
        "--message-types", default="PositionReport,ShipStaticData", help="Message types"
    )

    # Raw capture mode
    capture_parser = subparsers.add_parser("raw-capture", help="Run raw capture mode")
    capture_parser.add_argument(
        "--max-messages", type=int, help="Max messages (None = unlimited)"
    )
    capture_parser.add_argument(
        "--duration-seconds", type=float, default=300, help="Max duration (default: 300)"
    )
    capture_parser.add_argument(
        "--output-root", type=Path, help="Output root directory"
    )
    capture_parser.add_argument(
        "--message-types", default="PositionReport,ShipStaticData", help="Message types"
    )

    # Inspect cache mode
    inspect_parser = subparsers.add_parser("inspect-cache", help="Inspect existing cache")
    inspect_parser.add_argument(
        "input_run_dir", type=Path, help="Run directory to inspect"
    )

    # Normalize from cache mode
    normalize_parser = subparsers.add_parser("normalize-from-cache", help="Normalize raw messages")
    normalize_parser.add_argument(
        "input_path", type=Path, help="Run directory or raw_messages.jsonl file"
    )
    normalize_parser.add_argument(
        "--output-dir", type=Path, help="Output directory (default: normalized/ subdirectory)"
    )

    # Ingest from cache mode
    ingest_cache_parser = subparsers.add_parser(
        "ingest-from-cache", help="Normalize cached messages and write to DB"
    )
    ingest_cache_parser.add_argument(
        "input_path", type=Path, help="Run directory or raw_messages.jsonl file"
    )
    ingest_cache_parser.add_argument(
        "--run-id", type=str, help="Optional run ID for fetch_runs table"
    )
    ingest_cache_parser.add_argument(
        "--dry-run", action="store_true", help="Normalize but don't write to DB"
    )
    ingest_cache_parser.add_argument(
        "--database-url", type=str, help="PostgreSQL connection URL"
    )

    # Live ingest proof mode
    live_ingest_parser = subparsers.add_parser(
        "live-ingest-proof", help="Connect to AISStream, capture, normalize, write to DB"
    )
    live_ingest_parser.add_argument(
        "--max-messages", type=int, default=50, help="Max messages (default: 50)"
    )
    live_ingest_parser.add_argument(
        "--duration-seconds", type=float, default=60, help="Max duration (default: 60)"
    )
    live_ingest_parser.add_argument(
        "--output-root", type=Path, help="Output root directory for raw files"
    )
    live_ingest_parser.add_argument(
        "--dry-run", action="store_true", help="Capture and normalize but don't write to DB"
    )
    live_ingest_parser.add_argument(
        "--database-url", type=str, help="PostgreSQL connection URL"
    )

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    if args.command == "proof":
        message_types = args.message_types.split(",") if args.message_types else None
        fetcher = MaritimeFetcher(
            output_root=args.output_root,
            message_types=message_types,
        )
        result = fetcher.run_proof(
            max_messages=args.max_messages,
            max_duration_seconds=args.duration_seconds,
        )
        print("\n=== PROOF COMPLETE ===")
        print(f"Messages: {result['message_count']}")
        print(f"Unique MMSI: {result['unique_mmsi_count']}")
        print(f"Duration: {result['duration_seconds']:.1f}s")
        print(f"Types: {result['message_type_counts']}")
        print(f"Status: {result['status']}")
        return

    if args.command == "raw-capture":
        message_types = args.message_types.split(",") if args.message_types else None
        fetcher = MaritimeFetcher(
            output_root=args.output_root,
            message_types=message_types,
        )
        result = fetcher.run_raw_capture(
            max_messages=args.max_messages,
            max_duration_seconds=args.duration_seconds,
        )
        print("\n=== CAPTURE COMPLETE ===")
        print(f"Messages: {result['message_count']}")
        print(f"Unique MMSI: {result['unique_mmsi_count']}")
        print(f"Duration: {result['duration_seconds']:.1f}s")
        print(f"Types: {result['message_type_counts']}")
        print(f"Status: {result['status']}")
        return

    if args.command == "inspect-cache":
        fetcher = MaritimeFetcher()
        result = fetcher.inspect_cache(args.input_run_dir)
        print("\n=== CACHE INSPECTION ===")
        print(f"Run: {result['run_id']}")
        print(f"Messages: {result['message_count']}")
        print(f"Unique MMSI: {result['unique_mmsi_count']}")
        print(f"Types: {result['message_type_counts']}")
        print(f"Observed fields: {result['observed_fields']['message_types_observed']}")
        print(f"File sizes: {result['file_sizes']}")
        return

    if args.command == "normalize-from-cache":
        result = normalize_from_cache(args.input_path, args.output_dir)
        print("\n=== NORMALIZATION COMPLETE ===")
        print(f"Raw messages read: {result['raw_messages_read']}")
        print(f"Positions normalized: {result['position_normalized']}")
        print(f"Static normalized: {result['static_normalized']}")
        print(f"Joined vessels: {result['joined_vessels']}")
        print(f"Skipped: {result['skipped_invalid']}")
        print(f"\nOutput directory: {result['output_dir']}")
        return

    if args.command == "ingest-from-cache":
        ingestion = MaritimeIngestion(
            database_url=args.database_url,
            dry_run=args.dry_run,
        )
        try:
            result = ingestion.ingest_from_cache(args.input_path, run_id=args.run_id)
            print("\n=== INGEST FROM CACHE COMPLETE ===")
            print(f"Raw messages read: {result['raw_messages_read']}")
            print(f"Positions normalized: {result['positions_normalized']}")
            print(f"Static normalized: {result['static_normalized']}")
            if not args.dry_run:
                print(f"Vessels upserted: {result['vessels_upserted']}")
                print(f"Positions upserted: {result['positions_upserted']}")
                print(f"History rows inserted: {result['history_rows_inserted']}")
                print(f"Raw refs inserted: {result['raw_refs_inserted']}")
            else:
                print("(dry-run - no database writes)")
            if result.get("errors"):
                print(f"\nErrors: {result['errors']}")
        finally:
            ingestion.close()
        return

    if args.command == "live-ingest-proof":
        if not args.dry_run and not args.database_url:
            import os
            # Check if we have a database URL
            if not os.getenv("DATABASE_URL"):
                print("WARNING: No DATABASE_URL set. Use --dry-run or set DATABASE_URL")
                print("Running in dry-run mode...")
                args.dry_run = True

        ingestion = MaritimeIngestion(
            database_url=args.database_url,
            dry_run=args.dry_run,
        )
        try:
            result = ingestion.ingest_live(
                max_messages=args.max_messages,
                max_duration_seconds=args.duration_seconds,
                output_root=args.output_root,
            )
            print("\n=== LIVE INGEST PROOF COMPLETE ===")
            print(f"Run ID: {result.get('run_id', 'N/A')}")
            print(f"Messages captured: {result.get('fetch_result', {}).get('message_count', 0)}")
            print(f"Unique MMSI: {result.get('fetch_result', {}).get('unique_mmsi_count', 0)}")
            print(f"Positions normalized: {result['positions_normalized']}")
            print(f"Static normalized: {result['static_normalized']}")
            if not args.dry_run:
                print(f"Vessels upserted: {result['vessels_upserted']}")
                print(f"Positions upserted: {result['positions_upserted']}")
                print(f"History rows inserted: {result['history_rows_inserted']}")
                print(f"Raw refs inserted: {result['raw_refs_inserted']}")
            else:
                print("(dry-run - no database writes)")
            if result.get("errors"):
                print(f"\nErrors: {result['errors']}")
        finally:
            ingestion.close()
        return


if __name__ == "__main__":
    main()