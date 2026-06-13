"""Orchestration for Layer 07 Weather fetcher.

Modes:
    proof     – fetch WO-WEATHER-S proof coordinates only (7 cities)
    dry_run   – generate grid/batches without API calls
    fetch     – fetch one or more batches (requires explicit allow_full_grid for all)

Full 5° global fetch only executes when allow_full_grid=True.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from layers.layer_07_weather.open_meteo_client import (
    CURRENT_VARIABLES,
    HOURLY_VARIABLES,
    fetch_weather_batch,
)
from layers.layer_07_weather.weather_grid import (
    batch_coordinates,
    generate_grid,
    get_proof_coordinates,
    grid_summary,
)
from layers.layer_07_weather import weather_raw_storage as storage

SOURCE_ID = "open-meteo"
LAYER_ID = "layer_07_weather"
MAX_CONSECUTIVE_FAILURES = 3


def _proof_coords_as_grid() -> list[dict[str, Any]]:
    return [
        {"latitude": c["latitude"], "longitude": c["longitude"]}
        for c in get_proof_coordinates()
    ]


def run_dry_run(
    grid_spacing: int = 5,
    batch_size: int = 50,
    forecast_days: int = 3,
) -> dict[str, Any]:
    """Generate grid and batches without any API calls."""
    summary = grid_summary(grid_spacing, batch_size)
    return {
        "mode": "dry_run",
        "grid_spacing_deg": grid_spacing,
        "batch_size": batch_size,
        "forecast_days": forecast_days,
        **summary,
        "api_calls_made": 0,
        "raw_files_written": False,
    }


def run_fetch(
    *,
    proof: bool = False,
    grid_spacing: int = 5,
    batch_size: int = 50,
    forecast_days: int = 3,
    max_batches: int | None = None,
    allow_full_grid: bool = False,
    raw_base: str | Path = "raw",
) -> dict[str, Any]:
    """Run a fetch.

    - proof=True: fetch proof coordinates only (7 cities, 1 batch).
    - allow_full_grid=True: allow fetching all grid batches.
    - max_batches: cap number of batches fetched.
    Without proof or allow_full_grid, refuses to run a full global fetch.
    """
    if proof:
        coords = _proof_coords_as_grid()
        forecast_days = min(forecast_days, 3)
    else:
        if not allow_full_grid and max_batches is None:
            raise RuntimeError(
                "Full grid fetch requires --allow-full-grid. "
                "Use --max-batches N for a safe partial run."
            )
        coords = generate_grid(grid_spacing)

    batches = batch_coordinates(coords, batch_size)
    if max_batches is not None:
        batches = batches[:max_batches]

    now = datetime.now(timezone.utc)
    run_id = storage.make_run_id(now)
    run_dir = storage.run_directory(run_id, base=raw_base, dt=now)
    run_dir.mkdir(parents=True, exist_ok=True)

    stats = {
        "total_planned_coords": len(coords),
        "total_planned_batches": len(batches),
        "requests_attempted": 0,
        "requests_succeeded": 0,
        "requests_failed": 0,
        "coords_requested": 0,
    }

    all_batches_data: list[list[Any]] = []
    all_request_metas: list[dict[str, Any]] = []
    t_start = time.monotonic()
    consecutive_failures = 0

    for i, batch in enumerate(batches):
        lats = [c["latitude"] for c in batch]
        lons = [c["longitude"] for c in batch]
        stats["requests_attempted"] += 1
        try:
            result = fetch_weather_batch(
                lats, lons,
                forecast_days=forecast_days,
                batch_index=i,
            )
            data = result["data"]
            meta = result["request_meta"]
            storage.save_batch(run_dir, i, data)
            all_batches_data.append(data)
            all_request_metas.append(meta)
            stats["requests_succeeded"] += 1
            stats["coords_requested"] += len(lats)
            consecutive_failures = 0
        except Exception as exc:  # noqa: BLE001
            stats["requests_failed"] += 1
            consecutive_failures += 1
            print(f"  [WARN] Batch {i + 1} failed: {exc}")
            if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                print(f"  [STOP] {MAX_CONSECUTIVE_FAILURES} consecutive failures — aborting fetch.")
                break

    elapsed = time.monotonic() - t_start

    run_metadata = {
        "source_id": SOURCE_ID,
        "layer_id": LAYER_ID,
        "fetch_run_id": run_id,
        "mode": "proof" if proof else "fetch",
        "fetch_started_at": now.isoformat(),
        "fetch_completed_at": datetime.now(timezone.utc).isoformat(),
        "grid_spacing_deg": grid_spacing if not proof else None,
        "batch_size": batch_size,
        "forecast_days": forecast_days,
        "current_variables": CURRENT_VARIABLES,
        "hourly_variables": HOURLY_VARIABLES,
        **stats,
        "elapsed_seconds": round(elapsed, 2),
        "status": "SUCCESS" if stats["requests_failed"] == 0 else "PARTIAL",
    }

    storage.save_metadata(run_dir, run_metadata)
    if all_batches_data:
        storage.save_preview(run_dir, all_batches_data)
        storage.save_observed_fields(run_dir, all_batches_data)
    storage.save_fetch_report(run_dir, run_metadata)

    return {**run_metadata, "raw_dir": str(run_dir)}
