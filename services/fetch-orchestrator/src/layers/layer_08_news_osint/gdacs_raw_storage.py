"""Raw storage for Layer 08 GDACS fetcher.

Saves files under:
    tmp/layer_08_news_osint/gdacs/YYYY/MM/DD/run_<timestamp>/

These paths are local-only and must never be committed.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def make_run_id(dt: datetime | None = None) -> str:
    dt = dt or datetime.now(timezone.utc)
    return f"run_{dt.strftime('%Y%m%dT%H%M%SZ')}"


def run_directory(run_id: str, base: str | Path = "tmp", dt: datetime | None = None) -> Path:
    dt = dt or datetime.now(timezone.utc)
    return (
        Path(base)
        / "layer_08_news_osint"
        / "gdacs"
        / dt.strftime("%Y")
        / dt.strftime("%m")
        / dt.strftime("%d")
        / run_id
    )


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def save_raw_events(run_dir: Path, raw_payload: dict[str, Any]) -> str:
    """Save full raw GeoJSON response. Returns file path string."""
    path = run_dir / "gdacs_events.json"
    _write_json(path, raw_payload)
    return str(path)


def save_proof_summary(run_dir: Path, summary: dict[str, Any]) -> str:
    """Save proof summary JSON. Returns file path string."""
    path = run_dir / "gdacs_summary.json"
    _write_json(path, summary)
    return str(path)


def save_normalized_events(run_dir: Path, normalized_result: dict[str, Any]) -> str:
    """Save normalized events list. Returns file path string."""
    path = run_dir / "gdacs_normalized.json"
    _write_json(path, normalized_result["items"])
    return str(path)


def save_normalized_summary(run_dir: Path, normalized_result: dict[str, Any]) -> str:
    """Save normalized run summary (counts, breakdowns). Returns file path string."""
    path = run_dir / "gdacs_normalized_summary.json"
    summary = {k: v for k, v in normalized_result.items() if k != "items"}
    _write_json(path, summary)
    return str(path)
