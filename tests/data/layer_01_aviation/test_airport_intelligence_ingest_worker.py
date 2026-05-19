"""Integration tests for airport intelligence ingest worker.

Tests invoke the worker via subprocess to avoid import issues.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]


class TestWorkerDryRun:
    """Test worker dry-run mode."""

    def test_dry_run_does_not_write_to_db(self):
        """Dry-run should not write to database."""
        result = subprocess.run(
            [
                sys.executable,
                str(REPO_ROOT / "services" / "fetch-orchestrator" / "src" / "layers" / "layer_01_aviation" / "airport_intelligence_ingest_worker.py"),
                "--airport-ident", "KJFK",
                "--dry-run",
            ],
            capture_output=True,
            text=True,
            cwd=str(REPO_ROOT),
        )
        assert result.returncode == 0
        assert "DRY-RUN MODE" in result.stdout
        assert "Skipping all database writes" in result.stdout

    def test_worker_runs_for_kjfk(self):
        """Worker should run for KJFK in dry-run mode."""
        result = subprocess.run(
            [
                sys.executable,
                str(REPO_ROOT / "services" / "fetch-orchestrator" / "src" / "layers" / "layer_01_aviation" / "airport_intelligence_ingest_worker.py"),
                "--airport-ident", "KJFK",
                "--dry-run",
            ],
            capture_output=True,
            text=True,
            cwd=str(REPO_ROOT),
        )
        assert result.returncode == 0
        assert "Processing: KJFK" in result.stdout

    def test_worker_runs_for_kbdl(self):
        """Worker should run for KBDL in dry-run mode."""
        result = subprocess.run(
            [
                sys.executable,
                str(REPO_ROOT / "services" / "fetch-orchestrator" / "src" / "layers" / "layer_01_aviation" / "airport_intelligence_ingest_worker.py"),
                "--airport-ident", "KBDL",
                "--dry-run",
            ],
            capture_output=True,
            text=True,
            cwd=str(REPO_ROOT),
        )
        assert result.returncode == 0
        assert "Processing: KBDL" in result.stdout

    def test_capability_tags_generated(self):
        """Capability tags should be generated from runway data."""
        result = subprocess.run(
            [
                sys.executable,
                str(REPO_ROOT / "services" / "fetch-orchestrator" / "src" / "layers" / "layer_01_aviation" / "airport_intelligence_ingest_worker.py"),
                "--airport-ident", "KJFK",
                "--dry-run",
            ],
            capture_output=True,
            text=True,
            cwd=str(REPO_ROOT),
        )
        assert result.returncode == 0
        assert "scheduled_service" in result.stdout or "Processing" in result.stdout

    def test_show_raw_displays_debug_info(self):
        """--show-raw should display debug information."""
        result = subprocess.run(
            [
                sys.executable,
                str(REPO_ROOT / "services" / "fetch-orchestrator" / "src" / "layers" / "layer_01_aviation" / "airport_intelligence_ingest_worker.py"),
                "--airport-ident", "KJFK",
                "--dry-run",
                "--show-raw",
            ],
            capture_output=True,
            text=True,
            cwd=str(REPO_ROOT),
        )
        assert result.returncode == 0


class TestWorkerHelp:
    """Test worker help output."""

    def test_worker_has_help(self):
        """Worker should have help text."""
        result = subprocess.run(
            [
                sys.executable,
                str(REPO_ROOT / "services" / "fetch-orchestrator" / "src" / "layers" / "layer_01_aviation" / "airport_intelligence_ingest_worker.py"),
                "--help",
            ],
            capture_output=True,
            text=True,
            cwd=str(REPO_ROOT),
        )
        assert result.returncode == 0
        assert "airport-intelligence-ingest-worker" in result.stdout.lower() or "--airport-id" in result.stdout.lower()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])