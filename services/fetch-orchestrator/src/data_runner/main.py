"""CLI entry point for GOD EYES Data Runner.

Usage:
    python services/fetch-orchestrator/src/god_eyes_data_runner.py
    python services/fetch-orchestrator/src/god_eyes_data_runner.py --list-jobs
    python services/fetch-orchestrator/src/god_eyes_data_runner.py --dry-run
    python services/fetch-orchestrator/src/god_eyes_data_runner.py --run-once
    python services/fetch-orchestrator/src/god_eyes_data_runner.py --jobs aviation_live_aircraft,weather
    python services/fetch-orchestrator/src/god_eyes_data_runner.py --profile local-dev
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

_runner_src = Path(__file__).resolve().parent
if str(_runner_src) not in sys.path:
    sys.path.insert(0, str(_runner_src))

from data_runner.jobs import (
    JobMode,
    filter_jobs,
    get_registry,
    build_command_display,
)
from data_runner.scheduler import Runner


def _check_startup_env() -> list[str]:
    warnings = []
    db_url = os.environ.get("DATABASE_URL", "").strip()
    if not db_url:
        warnings.append("DATABASE_URL is not set — DB-writing jobs will fail")
    return warnings


def cmd_list_jobs(args: argparse.Namespace) -> int:
    jobs = get_registry()
    print(f"\n{'GOD EYES Data Runner — Job Registry':^70s}")
    print(f"{'=' * 70}")
    print(f"  {'Job':<28s} {'Layer':<28s} {'Mode':<12s} {'Enabled'}")
    print(f"  {'-'*28} {'-'*28} {'-'*12} {'-'*7}")

    for j in jobs:
        enabled_str = "yes" if j.enabled else "no"
        if j.mode == JobMode.MANUAL:
            enabled_str = "manual"
        print(f"  {j.job_id:<28s} {j.layer_id:<28s} {j.mode.value:<12s} {enabled_str}")

    print(f"\n  Total: {len(jobs)} jobs")
    enabled = [j for j in jobs if j.enabled]
    print(f"  Enabled: {len(enabled)}")
    print()
    return 0


def cmd_run(args: argparse.Namespace) -> int:
    warnings = _check_startup_env()
    for w in warnings:
        print(f"WARNING: {w}")

    job_ids = None
    if args.jobs:
        job_ids = [j.strip() for j in args.jobs.split(",") if j.strip()]

    runner = Runner(
        job_ids=job_ids,
        dry_run=args.dry_run,
        run_once=args.run_once,
        include_disabled=args.include_disabled,
        status_interval=args.status_interval,
    )
    return runner.run()


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="god_eyes_data_runner",
        description="GOD EYES Data Runner — keep all data pipelines fresh",
    )
    p.add_argument(
        "--list-jobs", action="store_true",
        help="List all registered jobs and exit",
    )
    p.add_argument(
        "--dry-run", action="store_true",
        help="Print commands without executing",
    )
    p.add_argument(
        "--run-once", action="store_true",
        help="Run each interval job once and exit",
    )
    p.add_argument(
        "--jobs", type=str, default=None,
        help="Comma-separated job IDs to run (default: all enabled)",
    )
    p.add_argument(
        "--profile", type=str, default="local-dev",
        help="Profile name (reserved for future use; currently always local-dev)",
    )
    p.add_argument(
        "--include-disabled", action="store_true",
        help="Include disabled/manual jobs when running",
    )
    p.add_argument(
        "--status-interval", type=float, default=30.0,
        help="Seconds between status prints (default: 30)",
    )
    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.list_jobs:
        return cmd_list_jobs(args)
    return cmd_run(args)


if __name__ == "__main__":
    sys.exit(main())
