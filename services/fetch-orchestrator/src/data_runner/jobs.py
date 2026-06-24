"""Job registry for GOD EYES Data Runner.

Defines all available data pipeline jobs, their modes, intervals, required
environment variables, and restart policies. The registry is the single
source of truth for what the runner can execute.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any


class JobMode(str, Enum):
    CONTINUOUS = "continuous"
    INTERVAL = "interval"
    STARTUP_ONCE = "startup_once"
    MANUAL = "manual"


class RestartPolicy(str, Enum):
    ALWAYS = "always"
    ON_FAILURE = "on_failure"
    NEVER = "never"


@dataclass(frozen=True)
class JobDef:
    job_id: str
    layer_id: str
    description: str
    command: list[str]
    cwd: str
    mode: JobMode
    enabled: bool = True
    interval_seconds: int = 0
    required_env: tuple[str, ...] = ()
    optional_env: tuple[str, ...] = ()
    restart_policy: RestartPolicy = RestartPolicy.ON_FAILURE
    timeout_seconds: int = 0
    max_restarts: int = 5
    backoff_base: float = 2.0
    backoff_max: float = 120.0


def _repo_root() -> Path:
    # jobs.py is at services/fetch-orchestrator/src/data_runner/jobs.py
    # parents: [data_runner, src, fetch-orchestrator, services, god-eyes]
    return Path(__file__).resolve().parents[4]


def _src_root() -> Path:
    # services/fetch-orchestrator/src
    return Path(__file__).resolve().parents[1]


def _build_default_jobs() -> list[JobDef]:
    root = _repo_root()
    src = _src_root()
    layer_dir = src / "layers"

    python = "python"

    jobs: list[JobDef] = []

    # --- 1. aviation_live_aircraft (continuous) ---
    jobs.append(JobDef(
        job_id="aviation_live_aircraft",
        layer_id="layer_01_aviation",
        description="Live aircraft from Airplanes.live — 5s loop",
        command=[
            python,
            str(layer_dir / "layer_01_aviation" / "aviation_live_aircraft_worker.py"),
            "--source-mode", "global-web-json",
            "--loop",
            "--interval-seconds", "5",
            "--history-every-n-cycles", "12",
            "--persist",
        ],
        cwd=str(root),
        mode=JobMode.CONTINUOUS,
        interval_seconds=5,
        restart_policy=RestartPolicy.ALWAYS,
        max_restarts=20,
        backoff_base=2.0,
        backoff_max=60.0,
    ))

    # --- 2. earth_events (interval) ---
    jobs.append(JobDef(
        job_id="earth_events",
        layer_id="layer_03_earth_events",
        description="USGS earthquakes — refresh every 120s",
        command=[
            python,
            str(layer_dir / "layer_03_earth_events" / "usgs_earthquakes_worker.py"),
            "--persist",
        ],
        cwd=str(root),
        mode=JobMode.INTERVAL,
        interval_seconds=120,
        restart_policy=RestartPolicy.ON_FAILURE,
    ))

    # --- 3. weather (interval) ---
    jobs.append(JobDef(
        job_id="weather",
        layer_id="layer_07_weather",
        description="Open-Meteo weather — proof grid refresh every 600s",
        command=[
            python,
            "-m", "layers.layer_07_weather.weather_cli",
            "fetch",
            "--proof",
            "--forecast-days", "3",
        ],
        cwd=str(src),
        mode=JobMode.INTERVAL,
        interval_seconds=600,
        restart_policy=RestartPolicy.ON_FAILURE,
    ))

    # --- 4. news_osint (interval) ---
    jobs.append(JobDef(
        job_id="news_osint",
        layer_id="layer_08_news_osint",
        description="GDACS disaster events — refresh every 300s",
        command=[
            python,
            "-m", "layers.layer_08_news_osint",
            "--source", "gdacs",
            "--proof",
            "--normalize",
            "--ingest-db",
        ],
        cwd=str(src),
        mode=JobMode.INTERVAL,
        interval_seconds=300,
        restart_policy=RestartPolicy.ON_FAILURE,
    ))

    # --- 5. space_satellites (interval — position refresh) ---
    jobs.append(JobDef(
        job_id="space_satellites",
        layer_id="layer_05_space_satellites",
        description="Satellite positions — recompute from cached TLEs every 120s",
        command=[
            python,
            str(layer_dir / "layer_05_space_satellites" / "space_satellites_worker.py"),
            "--refresh-positions-from-cache",
            "--persist-from-cache",
            "--cache-dir", str(root.parent / "god-eyes-data" / "space"),
        ],
        cwd=str(root),
        mode=JobMode.INTERVAL,
        interval_seconds=120,
        restart_policy=RestartPolicy.ON_FAILURE,
    ))

    # --- 6. maritime (disabled unless AISSTREAM_API_KEY) ---
    has_ais = bool(os.environ.get("AISSTREAM_API_KEY", "").strip())
    jobs.append(JobDef(
        job_id="maritime",
        layer_id="layer_06_maritime",
        description="AIS live vessel ingest — requires AISSTREAM_API_KEY",
        command=[
            python,
            str(layer_dir / "layer_06_maritime" / "maritime_cli.py"),
            "live-ingest-proof",
            "--max-messages", "100",
            "--duration-seconds", "60",
        ],
        cwd=str(root),
        mode=JobMode.INTERVAL if has_ais else JobMode.MANUAL,
        enabled=has_ais,
        interval_seconds=300,
        required_env=("AISSTREAM_API_KEY",),
        restart_policy=RestartPolicy.ON_FAILURE,
    ))

    # --- 7. borders_boundaries (manual) ---
    jobs.append(JobDef(
        job_id="borders_boundaries",
        layer_id="layer_02_borders_boundaries",
        description="Natural Earth admin-0 outlines — static, run manually",
        command=[
            python,
            str(layer_dir / "layer_02_borders_boundaries" / "natural_earth_admin0_ingest.py"),
        ],
        cwd=str(root),
        mode=JobMode.MANUAL,
        enabled=False,
    ))

    # --- 8. energy_infrastructure (manual) ---
    jobs.append(JobDef(
        job_id="energy_infrastructure",
        layer_id="layer_10_energy_infrastructure",
        description="Power plants/substations — slow source, run manually",
        command=[
            python,
            str(layer_dir / "layer_10_energy_infrastructure" / "energy_infrastructure_worker.py"),
            "--direct",
            "--source", "wri_global_power_plant_database",
            "--dry-run",
        ],
        cwd=str(root),
        mode=JobMode.MANUAL,
        enabled=False,
    ))

    return jobs


_REGISTRY: list[JobDef] | None = None


def get_registry() -> list[JobDef]:
    global _REGISTRY
    if _REGISTRY is None:
        _REGISTRY = _build_default_jobs()
        ids = [j.job_id for j in _REGISTRY]
        dupes = [i for i in ids if ids.count(i) > 1]
        if dupes:
            raise ValueError(f"Duplicate job IDs in registry: {set(dupes)}")
    return list(_REGISTRY)


def get_job(job_id: str) -> JobDef | None:
    for j in get_registry():
        if j.job_id == job_id:
            return j
    return None


def filter_jobs(
    job_ids: list[str] | None = None,
    include_disabled: bool = False,
) -> list[JobDef]:
    registry = get_registry()
    result = []
    for j in registry:
        if job_ids and j.job_id not in job_ids:
            continue
        if not include_disabled and not j.enabled:
            continue
        result.append(j)
    return result


def validate_job_env(job: JobDef) -> tuple[bool, str]:
    """Check required env vars. Returns (ok, reason)."""
    missing = []
    for var in job.required_env:
        val = os.environ.get(var, "").strip()
        if not val:
            missing.append(var)
    if missing:
        return False, f"missing required env: {', '.join(missing)}"
    return True, ""


SECRET_FLAGS = {"--api-key", "--password", "--secret", "--token", "--access-key", "--minio-secret-key"}


def build_command_display(job: JobDef) -> str:
    """Return a safe display string for the command (no secrets).

    Masks values that follow known secret flags, and masks any token
    that itself contains secret-related keywords.
    """
    parts: list[str] = []
    skip_next = False
    for p in job.command:
        if skip_next:
            parts.append("***")
            skip_next = False
            continue
        low = p.lower()
        if p in SECRET_FLAGS or any(low.startswith(f + "=") for f in SECRET_FLAGS):
            parts.append(p.split("=", 1)[0] if "=" in p else p)
            skip_next = True
            continue
        if any(kw in low for kw in ("key", "secret", "password", "token")):
            parts.append("***")
            continue
        parts.append(p)
    return " ".join(parts)
