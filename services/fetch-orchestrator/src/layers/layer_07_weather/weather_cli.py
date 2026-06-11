"""CLI entry point for Layer 07 Weather fetcher.

Usage:
    python -m layers.layer_07_weather.weather_cli proof
    python -m layers.layer_07_weather.weather_cli dry-run [--grid-spacing N] [--batch-size N]
    python -m layers.layer_07_weather.weather_cli fetch --proof [--forecast-days N]
    python -m layers.layer_07_weather.weather_cli fetch --grid-spacing N --batch-size N --max-batches N [--allow-full-grid]
    python -m layers.layer_07_weather.weather_cli inspect-cache
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def _print_summary(d: dict) -> None:
    for k, v in d.items():
        if k not in ("current_variables", "hourly_variables", "response_headers"):
            print(f"  {k}: {v}")


def cmd_proof(args: argparse.Namespace) -> int:
    from layers.layer_07_weather.weather_fetcher import run_fetch
    print("=== Layer 07 Weather — Proof Fetch ===")
    print("Fetching WO-WEATHER-S proof coordinates (7 cities, forecast_days=1)...")
    try:
        result = run_fetch(proof=True, forecast_days=1)
    except Exception as exc:
        print(f"FAILED: {exc}", file=sys.stderr)
        return 1
    _print_summary(result)
    print(f"\nStatus : {result.get('status')}")
    print(f"Raw dir: {result.get('raw_dir')}")
    return 0 if result.get("requests_failed", 0) == 0 else 1


def cmd_dry_run(args: argparse.Namespace) -> int:
    from layers.layer_07_weather.weather_fetcher import run_dry_run
    from layers.layer_07_weather.weather_grid import grid_summary
    print("=== Layer 07 Weather — Dry Run ===")
    result = run_dry_run(
        grid_spacing=args.grid_spacing,
        batch_size=args.batch_size,
        forecast_days=args.forecast_days,
    )
    _print_summary(result)
    print("\nNo API calls made. No files written.")
    return 0


def cmd_fetch(args: argparse.Namespace) -> int:
    from layers.layer_07_weather.weather_fetcher import run_fetch
    if args.proof:
        print("=== Layer 07 Weather — Fetch (proof mode) ===")
        try:
            result = run_fetch(proof=True, forecast_days=args.forecast_days)
        except Exception as exc:
            print(f"FAILED: {exc}", file=sys.stderr)
            return 1
    else:
        if not args.allow_full_grid and args.max_batches is None:
            print(
                "ERROR: Full grid fetch requires --allow-full-grid.\n"
                "       Use --max-batches N for a safe partial run.",
                file=sys.stderr,
            )
            return 1
        print("=== Layer 07 Weather — Fetch ===")
        try:
            result = run_fetch(
                proof=False,
                grid_spacing=args.grid_spacing,
                batch_size=args.batch_size,
                forecast_days=args.forecast_days,
                max_batches=args.max_batches,
                allow_full_grid=args.allow_full_grid,
            )
        except Exception as exc:
            print(f"FAILED: {exc}", file=sys.stderr)
            return 1

    _print_summary(result)
    print(f"\nStatus : {result.get('status')}")
    print(f"Raw dir: {result.get('raw_dir')}")
    return 0 if result.get("requests_failed", 0) == 0 else 1


def cmd_inspect_cache(args: argparse.Namespace) -> int:
    base = Path("raw/layer_07_weather/open-meteo")
    if not base.exists():
        print("No raw cache found at", base)
        return 0
    runs = sorted(base.glob("*/*/*/run_*"))
    if not runs:
        print("No fetch runs found in", base)
        return 0
    print(f"=== Layer 07 Weather — Cache ({len(runs)} run(s)) ===")
    for run_dir in runs[-5:]:  # show last 5
        meta_path = run_dir / "metadata.json"
        if meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
                print(f"\n  Run : {run_dir.name}")
                for k in ("mode", "fetch_started_at", "requests_succeeded",
                          "requests_failed", "coords_requested", "status"):
                    if k in meta:
                        print(f"    {k}: {meta[k]}")
            except Exception:
                print(f"  Run: {run_dir.name} (unreadable metadata)")
        else:
            print(f"  Run: {run_dir.name} (no metadata)")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="weather_cli", description="Layer 07 Weather CLI")
    sub = p.add_subparsers(dest="command", required=True)

    sub.add_parser("proof", help="Fetch WO-WEATHER-S proof coordinates")

    dr = sub.add_parser("dry-run", help="Generate grid without API calls")
    dr.add_argument("--grid-spacing", type=int, default=5)
    dr.add_argument("--batch-size", type=int, default=50)
    dr.add_argument("--forecast-days", type=int, default=3)

    fe = sub.add_parser("fetch", help="Fetch weather data")
    fe.add_argument("--proof", action="store_true", help="Fetch proof coordinates only")
    fe.add_argument("--grid-spacing", type=int, default=5)
    fe.add_argument("--batch-size", type=int, default=50)
    fe.add_argument("--forecast-days", type=int, default=3)
    fe.add_argument("--max-batches", type=int, default=None)
    fe.add_argument("--allow-full-grid", action="store_true",
                    help="Required to fetch all grid batches without --max-batches")

    sub.add_parser("inspect-cache", help="Inspect existing raw cache")

    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    dispatch = {
        "proof": cmd_proof,
        "dry-run": cmd_dry_run,
        "fetch": cmd_fetch,
        "inspect-cache": cmd_inspect_cache,
    }
    return dispatch[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
