"""Tests for GOD EYES Data Runner logic.

Focused unit tests for the job registry, process management, scheduler,
and CLI entry point. Does not require a live database or running workers.

Run from repo root:
    python -m pytest tests/data/test_god_eyes_data_runner.py -v
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

_repo_root = Path(__file__).resolve().parents[2]
_runner_src = _repo_root / "services" / "fetch-orchestrator" / "src"
if str(_runner_src) not in sys.path:
    sys.path.insert(0, str(_runner_src))

from data_runner.jobs import (
    JobDef,
    JobMode,
    RestartPolicy,
    build_command_display,
    filter_jobs,
    get_job,
    get_registry,
    validate_job_env,
)
from data_runner.processes import ProcessManager
from data_runner.scheduler import Runner
from data_runner.main import main as runner_main, build_parser


# ---------------------------------------------------------------------------
# Job registry tests
# ---------------------------------------------------------------------------


class TestJobRegistry:
    def test_registry_returns_list(self):
        registry = get_registry()
        assert isinstance(registry, list)
        assert len(registry) >= 5

    def test_registry_rejects_duplicate_ids(self):
        """The registry must never contain duplicate job_id values."""
        registry = get_registry()
        ids = [j.job_id for j in registry]
        assert len(ids) == len(set(ids)), f"Duplicate IDs: {[i for i in ids if ids.count(i) > 1]}"

    def test_get_job_returns_job(self):
        job = get_job("aviation_live_aircraft")
        assert job is not None
        assert job.job_id == "aviation_live_aircraft"
        assert job.layer_id == "layer_01_aviation"

    def test_get_job_unknown_returns_none(self):
        assert get_job("nonexistent_job") is None

    def test_aviation_is_continuous(self):
        job = get_job("aviation_live_aircraft")
        assert job is not None
        assert job.mode == JobMode.CONTINUOUS
        assert job.enabled is True
        assert job.interval_seconds == 5

    def test_earth_events_is_interval(self):
        job = get_job("earth_events")
        assert job is not None
        assert job.mode == JobMode.INTERVAL
        assert job.interval_seconds == 120

    def test_weather_is_interval(self):
        job = get_job("weather")
        assert job is not None
        assert job.mode == JobMode.INTERVAL
        assert job.interval_seconds == 600

    def test_news_osint_is_interval(self):
        job = get_job("news_osint")
        assert job is not None
        assert job.mode == JobMode.INTERVAL
        assert job.interval_seconds == 300

    def test_space_satellites_is_interval(self):
        job = get_job("space_satellites")
        assert job is not None
        assert job.mode == JobMode.INTERVAL
        assert job.interval_seconds == 120

    def test_borders_boundaries_is_manual(self):
        job = get_job("borders_boundaries")
        assert job is not None
        assert job.mode == JobMode.MANUAL
        assert job.enabled is False

    def test_energy_infrastructure_is_manual(self):
        job = get_job("energy_infrastructure")
        assert job is not None
        assert job.mode == JobMode.MANUAL
        assert job.enabled is False


# ---------------------------------------------------------------------------
# Environment validation tests
# ---------------------------------------------------------------------------


class TestEnvValidation:
    def test_missing_required_env_disables_job(self):
        job = JobDef(
            job_id="test_missing",
            layer_id="test",
            description="test",
            command=["echo"],
            cwd=".",
            mode=JobMode.INTERVAL,
            required_env=("NONEXISTENT_VAR_XYZ_12345",),
        )
        ok, reason = validate_job_env(job)
        assert ok is False
        assert "NONEXISTENT_VAR_XYZ_12345" in reason

    def test_present_required_env_passes(self):
        job = JobDef(
            job_id="test_present",
            layer_id="test",
            description="test",
            command=["echo"],
            cwd=".",
            mode=JobMode.INTERVAL,
            required_env=("PATH",),
        )
        ok, reason = validate_job_env(job)
        assert ok is True
        assert reason == ""

    def test_no_required_env_passes(self):
        job = JobDef(
            job_id="test_no_req",
            layer_id="test",
            description="test",
            command=["echo"],
            cwd=".",
            mode=JobMode.INTERVAL,
        )
        ok, reason = validate_job_env(job)
        assert ok is True

    def test_empty_env_value_fails(self):
        job = JobDef(
            job_id="test_empty",
            layer_id="test",
            description="test",
            command=["echo"],
            cwd=".",
            mode=JobMode.INTERVAL,
            required_env=("EMPTY_TEST_VAR_99999",),
        )
        with patch.dict(os.environ, {"EMPTY_TEST_VAR_99999": ""}):
            ok, reason = validate_job_env(job)
            assert ok is False
            assert "EMPTY_TEST_VAR_99999" in reason


# ---------------------------------------------------------------------------
# Command display (no secrets) tests
# ---------------------------------------------------------------------------


class TestCommandDisplay:
    def test_secret_values_are_masked(self):
        job = JobDef(
            job_id="test_mask",
            layer_id="test",
            description="test",
            command=["python", "worker.py", "--api-key", "super_secret_123", "--password", "hunter2"],
            cwd=".",
            mode=JobMode.INTERVAL,
        )
        display = build_command_display(job)
        assert "super_secret_123" not in display
        assert "hunter2" not in display
        assert "***" in display

    def test_normal_args_preserved(self):
        job = JobDef(
            job_id="test_normal",
            layer_id="test",
            description="test",
            command=["python", "worker.py", "--persist", "--loop"],
            cwd=".",
            mode=JobMode.INTERVAL,
        )
        display = build_command_display(job)
        assert "python worker.py --persist --loop" == display


# ---------------------------------------------------------------------------
# Filter tests
# ---------------------------------------------------------------------------


class TestFilterJobs:
    def test_filter_by_ids(self):
        result = filter_jobs(["aviation_live_aircraft", "weather"])
        ids = [j.job_id for j in result]
        assert "aviation_live_aircraft" in ids
        assert "weather" in ids
        assert len(result) == 2

    def test_filter_excludes_disabled_by_default(self):
        result = filter_jobs()
        ids = [j.job_id for j in result]
        assert "borders_boundaries" not in ids
        assert "energy_infrastructure" not in ids

    def test_filter_include_disabled(self):
        result = filter_jobs(include_disabled=True)
        ids = [j.job_id for j in result]
        assert "borders_boundaries" in ids
        assert "energy_infrastructure" in ids

    def test_filter_empty_ids_returns_all_enabled(self):
        result = filter_jobs([])
        enabled = [j for j in get_registry() if j.enabled]
        assert len(result) == len(enabled)


# ---------------------------------------------------------------------------
# Process manager tests
# ---------------------------------------------------------------------------


class TestProcessManager:
    def test_run_once_echo(self):
        pm = ProcessManager()
        job = JobDef(
            job_id="test_echo",
            layer_id="test",
            description="echo test",
            command=[sys.executable, "-c", "print('hello runner')"],
            cwd=str(_repo_root),
            mode=JobMode.INTERVAL,
            timeout_seconds=10,
        )
        code, output = pm.run_once(job, timeout=10)
        assert code == 0
        assert "hello runner" in output

    def test_run_once_failure_returns_nonzero(self):
        pm = ProcessManager()
        job = JobDef(
            job_id="test_fail",
            layer_id="test",
            description="fail test",
            command=[sys.executable, "-c", "import sys; sys.exit(1)"],
            cwd=str(_repo_root),
            mode=JobMode.INTERVAL,
            timeout_seconds=10,
        )
        code, output = pm.run_once(job, timeout=10)
        assert code == 1

    def test_run_once_timeout(self):
        pm = ProcessManager()
        job = JobDef(
            job_id="test_timeout",
            layer_id="test",
            description="timeout test",
            command=[sys.executable, "-c", "import time; time.sleep(30)"],
            cwd=str(_repo_root),
            mode=JobMode.INTERVAL,
            timeout_seconds=2,
        )
        code, output = pm.run_once(job, timeout=2)
        assert code == -1
        assert "timeout" in output.lower()


# ---------------------------------------------------------------------------
# CLI / argparse tests
# ---------------------------------------------------------------------------


class TestCLI:
    def test_list_jobs_exits_zero(self, capsys):
        rc = runner_main(["--list-jobs"])
        assert rc == 0
        captured = capsys.readouterr()
        assert "aviation_live_aircraft" in captured.out

    def test_dry_run_exits_zero(self, capsys):
        rc = runner_main(["--dry-run"])
        assert rc == 0
        captured = capsys.readouterr()
        assert "DRY RUN" in captured.out

    def test_run_once_exits_zero(self, capsys):
        rc = runner_main(["--run-once", "--jobs", "earth_events,weather,news_osint"])
        assert rc == 0

    def test_parser_defaults(self):
        parser = build_parser()
        args = parser.parse_args([])
        assert args.list_jobs is False
        assert args.dry_run is False
        assert args.run_once is False
        assert args.jobs is None
        assert args.profile == "local-dev"
        assert args.include_disabled is False
        assert args.status_interval == 30.0

    def test_parser_with_jobs(self):
        parser = build_parser()
        args = parser.parse_args(["--jobs", "aviation_live_aircraft,weather"])
        assert args.jobs == "aviation_live_aircraft,weather"


# ---------------------------------------------------------------------------
# Scheduler dry-run test
# ---------------------------------------------------------------------------


class TestSchedulerDryRun:
    def test_runner_dry_run_prints_commands(self, capsys):
        runner = Runner(dry_run=True)
        rc = runner.run()
        assert rc == 0
        captured = capsys.readouterr()
        assert "DRY RUN" in captured.out
        assert "aviation_live_aircraft" in captured.out

    def test_runner_run_once_interval_jobs(self, capsys):
        runner = Runner(
            run_once=True,
            job_ids=["earth_events"],
        )
        rc = runner.run()
        assert rc == 0
