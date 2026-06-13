"""Raw storage for Layer 08 GDELT Event Export fetcher.

Saves files under:
    tmp/layer_08_news_osint/gdelt/YYYYMMDDHHMMSS/

These paths are local-only and must never be committed.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def make_export_dir_id(dt: datetime | None = None) -> str:
    dt = dt or datetime.now(timezone.utc)
    return dt.strftime("%Y%m%d%H%M%S")


def export_directory(export_timestamp: str, base: str | Path = "tmp") -> Path:
    """Create directory path for a GDELT export.
    
    Args:
        export_timestamp: GDELT export timestamp (e.g., "20260613111500")
        base: Base directory (default: tmp)
    
    Returns:
        Path like tmp/layer_08_news_osint/gdelt/20260613111500/
    """
    return (
        Path(base)
        / "layer_08_news_osint"
        / "gdelt"
        / export_timestamp
    )


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def save_raw_rows(export_dir: Path, filename: str, rows: list[dict[str, Any]]) -> str:
    """Save parsed rows as JSON. Returns file path string."""
    path = export_dir / filename
    _write_json(path, rows)
    return str(path)


def save_proof_summary(export_dir: Path, summary: dict[str, Any]) -> str:
    """Save proof summary JSON. Returns file path string."""
    path = export_dir / "proof_summary.json"
    _write_json(path, summary)
    return str(path)


def save_fetch_metadata(export_dir: Path, metadata: dict[str, Any]) -> str:
    """Save fetch metadata JSON. Returns file path string."""
    path = export_dir / "fetch_metadata.json"
    _write_json(path, metadata)
    return str(path)