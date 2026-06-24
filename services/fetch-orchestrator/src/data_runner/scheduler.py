"""Scheduler for GOD EYES Data Runner.

Runs interval-based jobs on their configured cadence, manages continuous
jobs, runs startup_once jobs, and prints periodic status tables.
"""

from __future__ import annotations

import signal
import sys
import time
from typing import Any

from data_runner.jobs import JobDef, JobMode, filter_jobs, validate_job_env
from data_runner.processes import ProcessManager


class Runner:
    def __init__(
        self,
        job_ids: list[str] | None = None,
        dry_run: bool = False,
        run_once: bool = False,
        include_disabled: bool = False,
        status_interval: float = 30.0,
    ) -> None:
        self._job_filter = job_ids
        self._dry_run = dry_run
        self._run_once = run_once
        self._include_disabled = include_disabled
        self._status_interval = status_interval
        self._pm = ProcessManager()
        self._shutdown = False
        self._interval_next_run: dict[str, float] = {}
        self._interval_jobs: list[JobDef] = []

    def run(self) -> int:
        jobs = filter_jobs(self._job_filter, include_disabled=self._include_disabled)
        if not jobs:
            print("No jobs to run.")
            return 0

        enabled = [j for j in jobs if j.enabled]
        disabled = [j for j in jobs if not j.enabled]

        print(f"\nGOD EYES Data Runner — {len(enabled)} enabled, {len(disabled)} disabled\n")

        if self._dry_run:
            self._print_dry_run(jobs)
            return 0

        self._validate_and_disable(jobs)
        enabled = [j for j in jobs if j.enabled]

        self._install_signal_handlers()

        startup_once = [j for j in enabled if j.mode == JobMode.STARTUP_ONCE]
        continuous = [j for j in enabled if j.mode == JobMode.CONTINUOUS]
        self._interval_jobs = [j for j in enabled if j.mode == JobMode.INTERVAL]

        for j in startup_once:
            self._run_startup_once(j)

        for j in continuous:
            self._pm.start_continuous(j)

        now = time.time()
        for j in self._interval_jobs:
            self._interval_next_run[j.job_id] = now

        if self._run_once:
            self._run_all_interval_once()
            self._pm.stop_all()
            return 0

        self._print_status(enabled)
        last_status = time.time()

        try:
            while not self._shutdown:
                now = time.time()
                for j in self._interval_jobs:
                    if self._shutdown:
                        break
                    if now >= self._interval_next_run.get(j.job_id, 0):
                        self._run_interval_job(j)
                        self._interval_next_run[j.job_id] = now + j.interval_seconds

                if now - last_status >= self._status_interval:
                    self._print_status(enabled)
                    last_status = now

                time.sleep(1)
        except KeyboardInterrupt:
            pass
        finally:
            print("\nShutting down...")
            self._pm.stop_all()
            self._print_shutdown_summary()
        return 0

    def _validate_and_disable(self, jobs: list[JobDef]) -> None:
        for j in jobs:
            if not j.enabled:
                continue
            ok, reason = validate_job_env(j)
            if not ok:
                print(f"[{j.job_id}] DISABLED — {reason}")
                j.enabled = False

    def _run_startup_once(self, job: JobDef) -> None:
        if self._dry_run:
            print(f"[{job.job_id}] would run once: {job.command}")
            return
        print(f"[{job.job_id}] startup_once — running")
        code, _ = self._pm.run_once(job)
        if code == 0:
            print(f"[{job.job_id}] startup_once — done")
        else:
            print(f"[{job.job_id}] startup_once — failed (exit {code})")

    def _run_interval_job(self, job: JobDef) -> None:
        print(f"[{job.job_id}] interval — running")
        code, _ = self._pm.run_once(job)
        if code == 0:
            print(f"[{job.job_id}] interval — ok")
        else:
            print(f"[{job.job_id}] interval — failed (exit {code}), will retry next interval")

    def _run_all_interval_once(self) -> None:
        for j in self._interval_jobs:
            self._run_interval_job(j)

    def _print_dry_run(self, jobs: list[JobDef]) -> None:
        print("DRY RUN — commands that would execute:\n")
        for j in jobs:
            status = "enabled" if j.enabled else "DISABLED"
            if j.mode == JobMode.MANUAL:
                status = "manual"
            print(f"  {j.job_id:<30s} {status:<10s} mode={j.mode.value}")
            print(f"    {j.description}")
            if j.mode == JobMode.INTERVAL:
                print(f"    interval: {j.interval_seconds}s")
            print(f"    command:  {' '.join(j.command)}")
            print(f"    cwd:      {j.cwd}")
            print()

    def _print_status(self, jobs: list[JobDef]) -> None:
        now = time.time()
        print(f"\n{'GOD EYES Data Runner':^70s}")
        print(f"{'=' * 70}")
        print(f"  {'Job':<28s} {'Mode':<12s} {'Status':<12s} {'Info'}")
        print(f"  {'-'*28} {'-'*12} {'-'*12} {'-'*20}")

        for j in jobs:
            if not j.enabled:
                reason = ""
                if j.required_env:
                    missing = [v for v in j.required_env if not __import__('os').environ.get(v, '').strip()]
                    if missing:
                        reason = f"missing {missing[0]}"
                mode_str = j.mode.value if j.mode != JobMode.MANUAL else "manual"
                print(f"  {j.job_id:<28s} {mode_str:<12s} {'disabled':<12s} {reason}")
                continue

            if j.mode == JobMode.MANUAL:
                print(f"  {j.job_id:<28s} {'manual':<12s} {'static':<12s} {j.description}")
                continue

            if j.mode == JobMode.STARTUP_ONCE:
                print(f"  {j.job_id:<28s} {'once':<12s} {'done':<12s} startup_once")
                continue

            handle = self._pm.get_status(j.job_id)
            if j.mode == JobMode.CONTINUOUS:
                if handle and handle.proc and handle.proc.poll() is None:
                    elapsed = now - handle.start_time
                    print(f"  {j.job_id:<28s} {'continuous':<12s} {'running':<12s} {elapsed:.0f}s elapsed")
                else:
                    print(f"  {j.job_id:<28s} {'continuous':<12s} {'stopped':<12s}")
            elif j.mode == JobMode.INTERVAL:
                next_run = self._interval_next_run.get(j.job_id, now)
                remaining = max(0, next_run - now)
                if remaining > 60:
                    info = f"next run {remaining/60:.0f}m"
                else:
                    info = f"next run {remaining:.0f}s"
                print(f"  {j.job_id:<28s} {'interval':<12s} {'sleeping':<12s} {info}")

        print()

    def _install_signal_handlers(self) -> None:
        def handler(signum: int, frame: Any) -> None:
            self._shutdown = True

        try:
            signal.signal(signal.SIGINT, handler)
            signal.signal(signal.SIGTERM, handler)
        except (OSError, ValueError):
            pass

    def _print_shutdown_summary(self) -> None:
        statuses = self._pm.get_all_statuses()
        print("\nShutdown summary:")
        for jid, h in statuses.items():
            if h.proc is None:
                continue
            ec = h.last_exit_code
            if ec is None:
                print(f"  {jid}: terminated")
            elif ec == 0:
                print(f"  {jid}: exited 0 (restarts: {h.restart_count})")
            else:
                print(f"  {jid}: exited {ec} (restarts: {h.restart_count})")
        print()
