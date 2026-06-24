"""Subprocess management for GOD EYES Data Runner.

Handles starting, streaming logs, restarting, and stopping child processes
for both continuous and interval job modes.
"""

from __future__ import annotations

import subprocess
import sys
import threading
import time
from dataclasses import dataclass, field
from typing import IO

from data_runner.jobs import JobDef, RestartPolicy


@dataclass
class ProcessHandle:
    job: JobDef
    proc: subprocess.Popen | None = None
    thread: threading.Thread | None = None
    start_time: float = 0.0
    restart_count: int = 0
    last_exit_code: int | None = None
    last_ok_time: float = 0.0
    last_error: str = ""
    stopping: bool = False


class ProcessManager:
    """Manages running child processes for the data runner."""

    def __init__(self) -> None:
        self._handles: dict[str, ProcessHandle] = {}
        self._lock = threading.Lock()

    def start_continuous(self, job: JobDef) -> ProcessHandle:
        with self._lock:
            if job.job_id in self._handles:
                h = self._handles[job.job_id]
                if h.proc and h.proc.poll() is None:
                    return h
            handle = ProcessHandle(job=job, start_time=time.time())
            self._handles[job.job_id] = handle
            t = threading.Thread(
                target=self._run_continuous, args=(handle,), daemon=True
            )
            handle.thread = t
            t.start()
            return handle

    def _run_continuous(self, handle: ProcessHandle) -> None:
        job = handle.job
        while not handle.stopping:
            if handle.restart_count > job.max_restarts:
                _log(job.job_id, f"max restarts ({job.max_restarts}) reached, stopping")
                break

            backoff = min(
                job.backoff_base ** handle.restart_count,
                job.backoff_max,
            )
            if handle.restart_count > 0:
                _log(job.job_id, f"restarting in {backoff:.0f}s (attempt {handle.restart_count + 1})")
                _interruptible_sleep(backoff, lambda: handle.stopping)
                if handle.stopping:
                    break

            _log(job.job_id, "starting")
            handle.start_time = time.time()
            try:
                proc = subprocess.Popen(
                    job.command,
                    cwd=job.cwd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                )
                handle.proc = proc
                _stream_output(job.job_id, proc.stdout)
                proc.wait()
                exit_code = proc.returncode
                handle.last_exit_code = exit_code
                elapsed = time.time() - handle.start_time
                if exit_code == 0:
                    handle.last_ok_time = time.time()
                    _log(job.job_id, f"exited 0 ({elapsed:.0f}s)")
                    if job.restart_policy == RestartPolicy.ALWAYS:
                        handle.restart_count += 1
                        continue
                    break
                else:
                    _log(job.job_id, f"exited {exit_code} ({elapsed:.0f}s)")
                    if job.restart_policy in (RestartPolicy.ALWAYS, RestartPolicy.ON_FAILURE):
                        handle.restart_count += 1
                        continue
                    break
            except Exception as exc:
                handle.last_error = str(exc)
                _log(job.job_id, f"error: {exc}")
                if job.restart_policy in (RestartPolicy.ALWAYS, RestartPolicy.ON_FAILURE):
                    handle.restart_count += 1
                    continue
                break

    def run_once(self, job: JobDef, timeout: int = 0) -> tuple[int, str]:
        """Run a job once and return (exit_code, combined_output)."""
        _log(job.job_id, "running once")
        try:
            effective_timeout = timeout or job.timeout_seconds or 300
            proc = subprocess.Popen(
                job.command,
                cwd=job.cwd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
            try:
                stdout, _ = proc.communicate(timeout=effective_timeout)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
                _log(job.job_id, f"killed after {effective_timeout}s timeout")
                return -1, f"timeout after {effective_timeout}s"

            output = stdout or ""
            _log(job.job_id, f"exited {proc.returncode}")
            return proc.returncode, output
        except Exception as exc:
            _log(job.job_id, f"error: {exc}")
            return -1, str(exc)

    def stop_all(self, grace_seconds: float = 5.0) -> None:
        with self._lock:
            for h in self._handles.values():
                h.stopping = True
            procs = [
                (h.job.job_id, h.proc)
                for h in self._handles.values()
                if h.proc and h.proc.poll() is None
            ]
        for name, proc in procs:
            _log(name, "stopping")
            try:
                proc.terminate()
            except Exception:
                pass

        deadline = time.time() + grace_seconds
        with self._lock:
            procs_to_kill = [
                (h.job.job_id, h.proc)
                for h in self._handles.values()
                if h.proc and h.proc.poll() is None
            ]
        remaining = deadline - time.time()
        if procs_to_kill and remaining > 0:
            _interruptible_sleep(remaining, lambda: False)

        with self._lock:
            procs_to_kill = [
                (h.job.job_id, h.proc)
                for h in self._handles.values()
                if h.proc and h.proc.poll() is None
            ]
        for name, proc in procs_to_kill:
            _log(name, "force killing")
            try:
                proc.kill()
            except Exception:
                pass

    def get_status(self, job_id: str) -> ProcessHandle | None:
        with self._lock:
            return self._handles.get(job_id)

    def get_all_statuses(self) -> dict[str, ProcessHandle]:
        with self._lock:
            return dict(self._handles)


def _log(job_id: str, msg: str) -> None:
    print(f"[{job_id}] {msg}", flush=True)


def _stream_output(job_id: str, stream: IO[str] | None) -> None:
    if stream is None:
        return
    for line in stream:
        print(f"[{job_id}] {line.rstrip()}", flush=True)


def _interruptible_sleep(seconds: float, should_stop: callable) -> None:
    deadline = time.time() + seconds
    step = 0.5
    while time.time() < deadline:
        if should_stop():
            break
        remaining = deadline - time.time()
        time.sleep(min(step, max(remaining, 0.1)))
