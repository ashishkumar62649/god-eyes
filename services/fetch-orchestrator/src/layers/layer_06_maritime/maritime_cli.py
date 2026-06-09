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


if __name__ == "__main__":
    main()