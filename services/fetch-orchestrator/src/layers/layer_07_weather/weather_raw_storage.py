"""Raw storage helper for Layer 07 Weather.

Saves raw Open-Meteo batch responses and run metadata to disk.
Files are local-only and must never be committed.

Path pattern:
    raw/layer_07_weather/open-meteo/{yyyy}/{mm}/{dd}/{fetch_run_id}/
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SOURCE_ATTRIBUTION = (
    "Weather data provided by Open-Meteo (https://open-meteo.com/) under CC-BY 4.0 licence."
)


def make_run_id(dt: datetime | None = None) -> str:
    dt = dt or datetime.now(timezone.utc)
    return f"run_{dt.strftime('%Y%m%dT%H%M%SZ')}"


def run_directory(run_id: str, base: str | Path = "raw", dt: datetime | None = None) -> Path:
    dt = dt or datetime.now(timezone.utc)
    return (
        Path(base)
        / "layer_07_weather"
        / "open-meteo"
        / dt.strftime("%Y")
        / dt.strftime("%m")
        / dt.strftime("%d")
        / run_id
    )


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def save_batch(run_dir: Path, batch_index: int, response_data: list[Any]) -> str:
    """Save one batch response. Returns raw_evidence_uri string."""
    filename = f"batch_{batch_index + 1:03d}.json"
    path = run_dir / "batches" / filename
    _write_json(path, response_data)
    return str(path)


def save_metadata(run_dir: Path, metadata: dict[str, Any]) -> str:
    path = run_dir / "metadata.json"
    payload = {**metadata, "source_attribution": SOURCE_ATTRIBUTION}
    _write_json(path, payload)
    return str(path)


def save_observed_fields(run_dir: Path, batches_data: list[list[Any]]) -> str:
    """Collect all top-level field names seen across all batch items."""
    observed: dict[str, set[str]] = {}
    for batch in batches_data:
        for item in batch:
            if not isinstance(item, dict):
                continue
            for key, val in item.items():
                if key not in observed:
                    observed[key] = set()
                if isinstance(val, dict):
                    observed[key].update(val.keys())
                elif isinstance(val, list):
                    observed[key].add(f"list[{len(val)}]")
                else:
                    observed[key].add(type(val).__name__)
    serialisable = {k: sorted(v) for k, v in observed.items()}
    path = run_dir / "observed_fields.json"
    _write_json(path, serialisable)
    return str(path)


def save_preview(run_dir: Path, batches_data: list[list[Any]], max_items: int = 3) -> str:
    """Save a small sanitised preview (first N items across batches)."""
    items: list[Any] = []
    for batch in batches_data:
        items.extend(batch)
        if len(items) >= max_items:
            break
    items = items[:max_items]

    preview = []
    for item in items:
        if not isinstance(item, dict):
            preview.append(item)
            continue
        p: dict[str, Any] = {}
        for key in ("latitude", "longitude", "elevation", "timezone",
                    "timezone_abbreviation", "utc_offset_seconds", "location_id"):
            if key in item:
                p[key] = item[key]
        if "current" in item:
            p["current"] = item["current"]
        if "hourly" in item:
            h = item["hourly"]
            p["hourly_time_count"] = len(h.get("time", []))
            for k in list(h.keys())[:2]:
                if k != "time":
                    p[f"hourly_{k}_sample"] = h[k][:3] if isinstance(h[k], list) else h[k]
        preview.append(p)

    path = run_dir / "preview.json"
    _write_json(path, preview)
    return str(path)


def save_fetch_report(run_dir: Path, summary: dict[str, Any]) -> str:
    lines = ["# Fetch Report\n"]
    for k, v in summary.items():
        lines.append(f"- **{k}**: {v}")
    path = run_dir / "fetch_report.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return str(path)
