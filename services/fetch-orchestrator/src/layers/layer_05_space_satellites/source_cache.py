"""Source Cache — Staged ingestion cache for Layer 05 satellite source data.

Provides a local filesystem cache that supports the staged ingestion
pipeline:

  download-only  -> raw/   (raw TLE text + JSON envelopes)
  normalize-only -> normalized/  (canonical satellite + position JSONL)
  persist-from-cache -> database writes only

The cache is intended to live OUTSIDE the repository (e.g.
``E:\\god-eyes-data\\space\\layer_05_space_satellites``) so that raw
provider responses can be kept on disk without polluting the repo.

Layout produced under ``<cache-dir>/layer_05_space_satellites``::

    raw/
      <source>/
        <group>/
          latest.tle        # raw text from the provider
          latest.json       # envelope: metadata + record list
    normalized/
      latest/
        satellites.jsonl   # one normalized satellite per line
        positions.jsonl    # one computed position per line
        manifest.json      # summary of the normalize run
    manifests/
      latest.json          # latest overall pipeline manifest
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Layer identity — kept consistent with tle_parser / space_satellites_db.
LAYER_ID = "layer_05_space_satellites"
DEFAULT_SOURCE = "celestrak"


def utcnow_iso() -> str:
    """Return current UTC time as an ISO 8601 string."""
    return datetime.now(timezone.utc).isoformat()


def safe_json_dumps(data: Any) -> str:
    """Serialize data to JSON, handling datetime, etc."""
    def serialize_value(obj: Any) -> Any:
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, dict):
            return {k: serialize_value(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [serialize_value(item) for item in obj]
        return obj

    return json.dumps(serialize_value(data))


@dataclass
class RawGroupResult:
    """Result of attempting to download a single source group."""
    source: str
    group: str
    ok: bool
    raw_text_path: Path | None
    raw_json_path: Path | None
    record_count: int
    error: str | None
    fetched_at: str


class SourceCache:
    """Filesystem cache for staged Layer 05 ingestion.

    The cache directory is expected to live outside the repository.
    All writes are local-runtime data and must not be committed.
    """

    def __init__(self, cache_dir: str | Path) -> None:
        self.cache_dir = Path(cache_dir).resolve()
        self.layer_dir = self.cache_dir / LAYER_ID
        self.raw_dir = self.layer_dir / "raw"
        self.normalized_dir = self.layer_dir / "normalized" / "latest"
        self.manifests_dir = self.layer_dir / "manifests"
        self._ensure_dirs()

    def _ensure_dirs(self) -> None:
        for d in (self.raw_dir, self.normalized_dir, self.manifests_dir):
            d.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------ raw

    def raw_group_dir(self, source: str, group: str) -> Path:
        """Directory where raw artifacts for a (source, group) pair live."""
        return self.raw_dir / source / group

    def write_raw_group(
        self,
        source: str,
        group: str,
        raw_text: str,
        records: list[dict[str, Any]],
        fetched_at: str | None = None,
    ) -> RawGroupResult:
        """Persist the raw TLE text and a JSON envelope for a group.

        Args:
            source: Source identifier (e.g. "celestrak").
            group: Group identifier (e.g. "stations").
            raw_text: Verbatim TLE text returned by the provider.
            records: Parsed TLE records as plain dicts.
            fetched_at: ISO 8601 UTC timestamp; defaults to "now".

        Returns:
            ``RawGroupResult`` describing what was written.
        """
        ts = fetched_at or utcnow_iso()
        group_dir = self.raw_group_dir(source, group)
        group_dir.mkdir(parents=True, exist_ok=True)

        tle_path = group_dir / "latest.tle"
        json_path = group_dir / "latest.json"

        tle_path.write_text(raw_text, encoding="utf-8")

        envelope = {
            "layer_id": LAYER_ID,
            "source": source,
            "group": group,
            "fetched_at": ts,
            "record_count": len(records),
            "records": records,
        }
        json_path.write_text(safe_json_dumps(envelope), encoding="utf-8")

        return RawGroupResult(
            source=source,
            group=group,
            ok=True,
            raw_text_path=tle_path,
            raw_json_path=json_path,
            record_count=len(records),
            error=None,
            fetched_at=ts,
        )

    def record_raw_failure(
        self,
        source: str,
        group: str,
        error: str,
        fetched_at: str | None = None,
    ) -> RawGroupResult:
        """Record a failed group fetch without writing any raw artifact."""
        ts = fetched_at or utcnow_iso()
        return RawGroupResult(
            source=source,
            group=group,
            ok=False,
            raw_text_path=None,
            raw_json_path=None,
            record_count=0,
            error=error,
            fetched_at=ts,
        )

    def read_raw_group(
        self,
        source: str,
        group: str,
    ) -> dict[str, Any] | None:
        """Read the raw JSON envelope for a (source, group) pair.

        Returns ``None`` if the raw file does not exist.
        """
        json_path = self.raw_group_dir(source, group) / "latest.json"
        if not json_path.exists():
            return None
        try:
            return json.loads(json_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            print(f"[CACHE] Failed to read raw cache {json_path}: {exc}")
            return None

    def list_cached_groups(self, source: str) -> list[str]:
        """List group names that have a raw cache for the given source."""
        src_dir = self.raw_dir / source
        if not src_dir.exists():
            return []
        groups: list[str] = []
        for entry in sorted(src_dir.iterdir()):
            if entry.is_dir() and (entry / "latest.json").exists():
                groups.append(entry.name)
        return groups

    # ----------------------------------------------------------- normalized

    def write_normalized(
        self,
        satellites: list[dict[str, Any]],
        positions: list[dict[str, Any]],
        groups: list[str],
        source: str,
        errors: list[str] | None = None,
    ) -> dict[str, Any]:
        """Persist normalized records + manifest to ``normalized/latest/``.

        Args:
            satellites: One dict per satellite in normalized form.
            positions: One dict per computed position.
            groups: Group identifiers included in this normalize run.
            source: Source identifier.
            errors: Optional list of non-fatal error messages.

        Returns:
            The manifest dictionary that was written to disk.
        """
        self.normalized_dir.mkdir(parents=True, exist_ok=True)

        sat_path = self.normalized_dir / "satellites.jsonl"
        pos_path = self.normalized_dir / "positions.jsonl"
        manifest_path = self.normalized_dir / "manifest.json"

        sat_path.write_text(
            "\n".join(safe_json_dumps(s) for s in satellites) + "\n",
            encoding="utf-8",
        )
        pos_path.write_text(
            "\n".join(safe_json_dumps(p) for p in positions) + "\n",
            encoding="utf-8",
        )

        manifest = {
            "layer_id": LAYER_ID,
            "source": source,
            "groups": groups,
            "normalized_at": utcnow_iso(),
            "satellite_count": len(satellites),
            "position_count": len(positions),
            "satellites_path": str(sat_path),
            "positions_path": str(pos_path),
            "errors": errors or [],
        }
        manifest_path.write_text(safe_json_dumps(manifest), encoding="utf-8")
        return manifest

    def read_normalized(self) -> dict[str, Any] | None:
        """Read the latest normalized manifest, if it exists."""
        manifest_path = self.normalized_dir / "manifest.json"
        if not manifest_path.exists():
            return None
        try:
            return json.loads(manifest_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None

    def read_normalized_satellites(self) -> list[dict[str, Any]]:
        """Read the satellites.jsonl file (one record per line)."""
        sat_path = self.normalized_dir / "satellites.jsonl"
        if not sat_path.exists():
            return []
        out: list[dict[str, Any]] = []
        for line in sat_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        return out

    def read_normalized_positions(self) -> list[dict[str, Any]]:
        """Read the positions.jsonl file (one record per line)."""
        pos_path = self.normalized_dir / "positions.jsonl"
        if not pos_path.exists():
            return []
        out: list[dict[str, Any]] = []
        for line in pos_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        return out

    # ---------------------------------------------------------- manifests

    def write_overall_manifest(
        self,
        *,
        source: str,
        groups_requested: list[str],
        groups_succeeded: list[str],
        groups_failed: list[str],
        raw_files: list[str],
        normalized_files: list[str],
        fetched_at: str | None,
        normalized_at: str | None,
        satellite_count: int,
        position_count: int,
        errors: list[str] | None = None,
    ) -> Path:
        """Write the top-level ``manifests/latest.json`` summary."""
        manifest = {
            "layer_id": LAYER_ID,
            "source": source,
            "groups_requested": groups_requested,
            "groups_succeeded": groups_succeeded,
            "groups_failed": groups_failed,
            "raw_files_written": raw_files,
            "normalized_files_written": normalized_files,
            "fetched_at": fetched_at,
            "normalized_at": normalized_at,
            "record_counts": {
                "satellites": satellite_count,
                "positions": position_count,
            },
            "errors": errors or [],
        }
        out_path = self.manifests_dir / "latest.json"
        out_path.write_text(safe_json_dumps(manifest), encoding="utf-8")
        return out_path

    def read_overall_manifest(self) -> dict[str, Any] | None:
        """Read the most recent overall manifest, if present."""
        path = self.manifests_dir / "latest.json"
        if not path.exists():
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None


# --------------------------------------------------------------------- utils

def tle_record_to_dict(record: Any) -> dict[str, Any]:
    """Convert a TLERecord (or similar dataclass) to a plain dict.

    Datetimes are serialized to ISO 8601 strings so the JSON envelope
    stays plain text.
    """
    if isinstance(record, dict):
        return record
    if hasattr(record, "__dict__"):
        out: dict[str, Any] = {}
        for k, v in vars(record).items():
            if isinstance(v, datetime):
                out[k] = v.isoformat()
            else:
                out[k] = v
        return out
    raise TypeError(f"Cannot convert {type(record)!r} to dict for cache")


def resolve_cache_dir(value: str | os.PathLike[str] | None) -> Path:
    """Resolve and create a cache directory provided via CLI."""
    if not value:
        raise ValueError("cache-dir is required")
    p = Path(value).expanduser().resolve()
    p.mkdir(parents=True, exist_ok=True)
    return p
