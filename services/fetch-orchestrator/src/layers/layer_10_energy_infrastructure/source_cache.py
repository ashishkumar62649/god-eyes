"""Source Cache — Staged ingestion cache for Layer 10 Energy Infrastructure.

Provides a local filesystem cache that supports the staged ingestion
pipeline:

  download-only  -> raw/   (raw CSV / Overpass JSON / GEM mock records)
  normalize-only -> normalized/  (canonical energy infrastructure JSONL)
  persist-from-cache -> database writes only

The cache is intended to live OUTSIDE the repository (e.g.
``E:\\god-eyes-data\\energy\\layer_10_energy_infrastructure``) so that raw
provider responses can be kept on disk without polluting the repo.

Layout produced under ``<cache-dir>/layer_10_energy_infrastructure``::

    raw/
      <source>/
        <group-or-region>/
          latest.<ext>     # raw provider artifact (csv/json)
          latest.json      # envelope: metadata + record list
    normalized/
      latest/
        features.jsonl     # one normalized feature per line
        manifest.json      # summary of the normalize run
    manifests/
      latest.json          # latest overall pipeline manifest
"""

from __future__ import annotations

import csv
import io
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Layer identity — kept consistent with energy_infrastructure_db / contract.
LAYER_ID = "layer_10_energy_infrastructure"
DEFAULT_SOURCE = "wri_global_power_plant_database"

# Raw file extension per canonical source_id.
RAW_EXTENSIONS: dict[str, str] = {
    "wri_global_power_plant_database": "csv",
    "osm_energy_infrastructure": "json",
    "global_energy_monitor_energy": "json",
}


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
    """Result of attempting to download a single source group/region."""

    source: str
    group: str
    ok: bool
    raw_path: Path | None
    raw_json_path: Path | None
    record_count: int
    error: str | None
    fetched_at: str


class SourceCache:
    """Filesystem cache for staged Layer 10 ingestion.

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
        raw_extension: str | None = None,
    ) -> RawGroupResult:
        """Persist a raw provider artifact and a JSON envelope for a group.

        Args:
            source: Source identifier (e.g. ``"wri_global_power_plant_database"``).
            group: Group/region identifier (e.g. ``"latest"``, ``"europe"``).
            raw_text: Verbatim provider payload (CSV, JSON text, etc.).
            records: Parsed records as plain dicts.
            fetched_at: ISO 8601 UTC timestamp; defaults to "now".
            raw_extension: File extension for the raw artifact. Defaults
                to the canonical extension for the source (``csv`` for
                WRI, ``json`` for OSM/GEM).

        Returns:
            ``RawGroupResult`` describing what was written.
        """
        ts = fetched_at or utcnow_iso()
        ext = raw_extension or RAW_EXTENSIONS.get(source, "txt")
        group_dir = self.raw_group_dir(source, group)
        group_dir.mkdir(parents=True, exist_ok=True)

        raw_path = group_dir / f"latest.{ext}"
        json_path = group_dir / "latest.json"

        if raw_text:
            raw_path.write_text(raw_text, encoding="utf-8")

        envelope = {
            "layer_id": LAYER_ID,
            "source": source,
            "group": group,
            "fetched_at": ts,
            "record_count": len(records),
            "raw_path": str(raw_path) if raw_text else None,
            "records": records,
        }
        json_path.write_text(safe_json_dumps(envelope), encoding="utf-8")

        return RawGroupResult(
            source=source,
            group=group,
            ok=True,
            raw_path=raw_path if raw_text else None,
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
            raw_path=None,
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

    def read_raw_text(
        self,
        source: str,
        group: str,
    ) -> str | None:
        """Read the verbatim raw provider text (CSV/JSON) if present."""
        ext = RAW_EXTENSIONS.get(source, "txt")
        raw_path = self.raw_group_dir(source, group) / f"latest.{ext}"
        if not raw_path.exists():
            return None
        try:
            return raw_path.read_text(encoding="utf-8")
        except OSError:
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
        features: list[dict[str, Any]],
        groups: list[str],
        source: str,
        errors: list[str] | None = None,
    ) -> dict[str, Any]:
        """Persist normalized features + manifest to ``normalized/latest/``.

        Args:
            features: One dict per normalized feature.
            groups: Group identifiers included in this normalize run.
            source: Source identifier.
            errors: Optional list of non-fatal error messages.

        Returns:
            The manifest dictionary that was written to disk.
        """
        self.normalized_dir.mkdir(parents=True, exist_ok=True)

        feat_path = self.normalized_dir / "features.jsonl"
        manifest_path = self.normalized_dir / "manifest.json"

        feat_path.write_text(
            "\n".join(safe_json_dumps(f) for f in features) + "\n",
            encoding="utf-8",
        )

        manifest = {
            "layer_id": LAYER_ID,
            "source": source,
            "groups": groups,
            "normalized_at": utcnow_iso(),
            "feature_count": len(features),
            "features_path": str(feat_path),
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

    def read_normalized_features(self) -> list[dict[str, Any]]:
        """Read the ``features.jsonl`` file (one record per line)."""
        feat_path = self.normalized_dir / "features.jsonl"
        if not feat_path.exists():
            return []
        out: list[dict[str, Any]] = []
        for line in feat_path.read_text(encoding="utf-8").splitlines():
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
        feature_count: int,
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
                "features": feature_count,
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


def records_from_csv_text(csv_text: str) -> list[dict[str, Any]]:
    """Parse a CSV payload into a list of plain dicts.

    The first row is treated as the header. Empty lines and values
    that fail to coerce are skipped without raising.
    """
    if not csv_text:
        return []
    reader = csv.DictReader(io.StringIO(csv_text))
    out: list[dict[str, Any]] = []
    for row in reader:
        if not row:
            continue
        cleaned: dict[str, Any] = {}
        for k, v in row.items():
            if k is None:
                continue
            cleaned[k] = "" if v is None else v
        out.append(cleaned)
    return out


def resolve_cache_dir(value: str | os.PathLike[str] | None) -> Path:
    """Resolve and create a cache directory provided via CLI."""
    if not value:
        raise ValueError("cache-dir is required")
    p = Path(value).expanduser().resolve()
    p.mkdir(parents=True, exist_ok=True)
    return p
