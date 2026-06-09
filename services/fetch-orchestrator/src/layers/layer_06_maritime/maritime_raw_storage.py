"""Maritime Raw Storage

Handles reading and writing raw AIS messages to disk.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class MaritimeRawStorage:
    """Handles raw AIS message storage to disk."""

    LAYER_ID = "layer_06_maritime"
    SOURCE_ID = "aisstream"

    def __init__(self, output_root: Path | None = None):
        """Initialize raw storage.

        Args:
            output_root: Root directory for raw output. Defaults to raw/layer_06_maritime/aisstream/
        """
        self.output_root = output_root or Path("raw") / self.LAYER_ID / self.SOURCE_ID

    def create_run_directory(self, timestamp: datetime | None = None) -> Path:
        """Create directory for a fetch run.

        Args:
            timestamp: Run timestamp. Defaults to now (UTC).

        Returns:
            Path to run directory.
        """
        ts = timestamp or datetime.now(timezone.utc)
        run_dir = self.output_root / ts.strftime("%Y/%m/%d") / f"run_{ts.strftime('%Y%m%dT%H%M%SZ')}"
        run_dir.mkdir(parents=True, exist_ok=True)
        return run_dir

    def write_message(self, run_dir: Path, message: dict[str, Any]) -> None:
        """Write a single message to raw_messages.jsonl.

        Args:
            run_dir: Run directory path.
            message: Message dictionary to write.
        """
        raw_messages_path = run_dir / "raw_messages.jsonl"
        with open(raw_messages_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(message) + "\n")

    def write_metadata(self, run_dir: Path, metadata: dict[str, Any]) -> None:
        """Write metadata.json file.

        Args:
            run_dir: Run directory path.
            metadata: Metadata dictionary.
        """
        metadata_path = run_dir / "metadata.json"
        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)

    def write_preview(self, run_dir: Path, preview: dict[str, Any]) -> None:
        """Write preview.json file.

        Args:
            run_dir: Run directory path.
            preview: Preview dictionary.
        """
        preview_path = run_dir / "preview.json"
        with open(preview_path, "w", encoding="utf-8") as f:
            json.dump(preview, f, indent=2)

    def write_observed_fields(self, run_dir: Path, fields: dict[str, Any]) -> None:
        """Write observed_fields.json file.

        Args:
            run_dir: Run directory path.
            fields: Observed fields dictionary.
        """
        fields_path = run_dir / "observed_fields.json"
        with open(fields_path, "w", encoding="utf-8") as f:
            json.dump(fields, f, indent=2)

    def read_messages(self, run_dir: Path) -> list[dict[str, Any]]:
        """Read all messages from raw_messages.jsonl.

        Args:
            run_dir: Run directory path.

        Returns:
            List of message dictionaries.
        """
        raw_messages_path = run_dir / "raw_messages.jsonl"
        messages = []

        if not raw_messages_path.exists():
            return messages

        with open(raw_messages_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    messages.append(json.loads(line))

        return messages

    def read_metadata(self, run_dir: Path) -> dict[str, Any] | None:
        """Read metadata.json.

        Args:
            run_dir: Run directory path.

        Returns:
            Metadata dictionary or None if not found.
        """
        metadata_path = run_dir / "metadata.json"

        if not metadata_path.exists():
            return None

        with open(metadata_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def list_run_directories(self, root: Path | None = None) -> list[Path]:
        """List all run directories under root.

        Args:
            root: Root directory to search. Defaults to output_root.

        Returns:
            List of run directory paths sorted by name (newest first).
        """
        search_root = root or self.output_root
        if not search_root.exists():
            return []

        runs = []
        for path in search_root.rglob("run_*"):
            if path.is_dir():
                runs.append(path)

        return sorted(runs, reverse=True)

    def get_file_sizes(self, run_dir: Path) -> dict[str, int]:
        """Get file sizes in run directory.

        Args:
            run_dir: Run directory path.

        Returns:
            Dictionary of filename to size in bytes.
        """
        sizes = {}
        for f in run_dir.iterdir():
            if f.is_file():
                sizes[f.name] = f.stat().st_size
        return sizes