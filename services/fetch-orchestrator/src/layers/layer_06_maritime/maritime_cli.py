"""Maritime Fetcher CLI

Terminal wrapper for maritime fetcher. For development/manual validation only.
"""

import argparse
import sys
from pathlib import Path

# Determine source root: services/fetch-orchestrator/src
# maritime_cli.py is at: .../layers/layer_06_maritime/maritime_cli.py
# So parents[2] = src, parents[3] = fetch-orchestrator, parents[4] = services
_this_file = Path(__file__).resolve()
_services_src = _this_file.parents[2]

# Add to sys.path if not already present
if str(_services_src) not in sys.path:
    sys.path.insert(0, str(_services_src))

from layers.layer_06_maritime.maritime_fetcher import MaritimeFetcher


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

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    # Parse message types
    message_types = args.message_types.split(",") if hasattr(args, "message_types") else None

    # Initialize fetcher
    fetcher = MaritimeFetcher(
        output_root=getattr(args, "output_root", None),
        message_types=message_types,
    )

    if args.command == "proof":
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
        result = fetcher.inspect_cache(args.input_run_dir)
        print("\n=== CACHE INSPECTION ===")
        print(f"Run: {result['run_id']}")
        print(f"Messages: {result['message_count']}")
        print(f"Unique MMSI: {result['unique_mmsi_count']}")
        print(f"Types: {result['message_type_counts']}")
        print(f"Observed fields: {result['observed_fields']['message_types_observed']}")
        print(f"File sizes: {result['file_sizes']}")
        return


if __name__ == "__main__":
    main()