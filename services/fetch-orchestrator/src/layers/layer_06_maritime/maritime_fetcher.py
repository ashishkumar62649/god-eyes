"""Maritime Fetcher

Orchestrates AISStream fetching using the client and raw storage modules.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .aisstream_client import AISStreamClient
from .maritime_raw_storage import MaritimeRawStorage


class MaritimeFetcher:
    """Orchestrates maritime AIS data fetching."""

    DEFAULT_MAX_MESSAGES = 100
    DEFAULT_MAX_DURATION = 60.0
    DEFAULT_MESSAGE_TYPES = ["PositionReport", "ShipStaticData"]
    DEFAULT_BBOX = [[[-90, -180], [90, 180]]]

    def __init__(
        self,
        output_root: Path | None = None,
        bounding_boxes: list[list[list[float]]] | None = None,
        message_types: list[str] | None = None,
    ):
        """Initialize fetcher.

        Args:
            output_root: Root directory for raw output.
            bounding_boxes: Bounding boxes for subscription.
            message_types: Message types to filter.
        """
        self.storage = MaritimeRawStorage(output_root)
        self.bounding_boxes = bounding_boxes or self.DEFAULT_BBOX
        self.message_types = message_types or self.DEFAULT_MESSAGE_TYPES

    def run_proof(
        self,
        max_messages: int = DEFAULT_MAX_MESSAGES,
        max_duration_seconds: float = DEFAULT_MAX_DURATION,
    ) -> dict[str, Any]:
        """Run proof mode: capture messages and save outputs.

        Args:
            max_messages: Maximum messages to capture.
            max_duration_seconds: Maximum duration in seconds.

        Returns:
            Run metadata dictionary.
        """
        return asyncio.run(self._run_fetch(max_messages, max_duration_seconds))

    def run_raw_capture(
        self,
        max_messages: int | None = None,
        max_duration_seconds: float | None = None,
    ) -> dict[str, Any]:
        """Run raw capture mode with configurable limits.

        Args:
            max_messages: Maximum messages (None = unlimited until duration).
            max_duration_seconds: Maximum duration in seconds.

        Returns:
            Run metadata dictionary.
        """
        return asyncio.run(self._run_fetch(max_messages, max_duration_seconds))

    def inspect_cache(self, run_dir: Path) -> dict[str, Any]:
        """Inspect existing raw cache and generate summary.

        Args:
            run_dir: Path to run directory to inspect.

        Returns:
            Inspection summary dictionary.
        """
        messages = self.storage.read_messages(run_dir)
        metadata = self.storage.read_metadata(run_dir)

        # Compute statistics
        stats = self._compute_message_stats(messages)

        return {
            "run_dir": str(run_dir),
            "run_id": run_dir.name,
            "message_count": len(messages),
            "unique_mmsi_count": stats["unique_mmsi_count"],
            "message_type_counts": stats["message_type_counts"],
            "observed_fields": self._extract_observed_fields(messages),
            "file_sizes": self.storage.get_file_sizes(run_dir),
            "metadata": metadata,
        }

    async def _run_fetch(
        self,
        max_messages: int | None,
        max_duration_seconds: float | None,
    ) -> dict[str, Any]:
        """Internal fetch runner."""
        # Create run directory
        run_dir = self.storage.create_run_directory()
        started_at = datetime.now(timezone.utc)

        # Initialize client
        client = AISStreamClient(
            bounding_boxes=self.bounding_boxes,
            message_types=self.message_types,
        )

        # Track statistics
        stats = {
            "started_at": started_at.isoformat(),
            "message_count": 0,
            "unique_mmsi": set(),
            "message_types": {},
            "errors": [],
        }

        # Capture messages
        try:
            async for message in client.stream_messages(
                max_messages=max_messages,
                max_duration_seconds=max_duration_seconds,
            ):
                # Write to raw file
                self.storage.write_message(run_dir, message)

                # Update statistics
                stats["message_count"] += 1

                # Extract MMSI
                mmsi = message.get("MetaData", {}).get("MMSI")
                if mmsi:
                    stats["unique_mmsi"].add(mmsi)

                # Track message types
                msg_type = message.get("MessageType", "Unknown")
                stats["message_types"][msg_type] = stats["message_types"].get(msg_type, 0) + 1

        except Exception as e:
            stats["errors"].append(str(e))

        # Finalize
        ended_at = datetime.now(timezone.utc)
        duration = (ended_at - started_at).total_seconds()
        stats["ended_at"] = ended_at.isoformat()
        stats["duration_seconds"] = duration

        # Write outputs
        self._write_outputs(run_dir, stats)

        return self._build_metadata(run_dir, stats)

    def _write_outputs(self, run_dir: Path, stats: dict[str, Any]) -> None:
        """Write all output files."""
        # Write metadata
        metadata = self._build_metadata(run_dir, stats)
        self.storage.write_metadata(run_dir, metadata)

        # Write preview
        messages = self.storage.read_messages(run_dir)
        preview = self._build_preview(run_dir, messages)
        self.storage.write_preview(run_dir, preview)

        # Write observed fields
        observed = self._extract_observed_fields(messages)
        self.storage.write_observed_fields(run_dir, observed)

    def _build_metadata(self, run_dir: Path, stats: dict[str, Any]) -> dict[str, Any]:
        """Build metadata dictionary."""
        return {
            "layer_id": "layer_06_maritime",
            "source_id": "aisstream",
            "run_id": run_dir.name,
            "started_at": stats["started_at"],
            "ended_at": stats["ended_at"],
            "duration_seconds": stats.get("duration_seconds", 0),
            "message_count": stats["message_count"],
            "unique_mmsi_count": len(stats["unique_mmsi"]),
            "message_type_counts": stats["message_types"],
            "subscription_bbox_used": str(self.bounding_boxes),
            "subscription_message_types_used": self.message_types,
            "errors": stats.get("errors", []),
            "status": "success" if stats["message_count"] > 0 else "fail",
        }

    def _build_preview(self, run_dir: Path, messages: list[dict]) -> dict[str, Any]:
        """Build preview with first 10 messages."""
        preview_messages = []

        for msg in messages[:10]:
            preview = {
                "received_at": msg.get("received_at"),
                "message_type": msg.get("MessageType"),
                "mmsi": msg.get("MetaData", {}).get("MMSI"),
                "ship_name": msg.get("MetaData", {}).get("ShipName"),
            }

            # Extract position fields from nested Message
            if "Message" in msg and isinstance(msg["Message"], dict):
                for key in msg["Message"]:
                    inner = msg["Message"][key]
                    if isinstance(inner, dict):
                        preview["latitude"] = inner.get("Latitude")
                        preview["longitude"] = inner.get("Longitude")
                        preview["speed"] = inner.get("Sog")
                        preview["course"] = inner.get("Cog")
                        preview["heading"] = inner.get("TrueHeading")
                        break

            preview_messages.append(preview)

        return {
            "source_id": "aisstream",
            "layer_id": "layer_06_maritime",
            "run_id": run_dir.name,
            "preview_count": len(preview_messages),
            "messages": preview_messages,
        }

    def _extract_observed_fields(self, messages: list[dict]) -> dict[str, Any]:
        """Extract observed fields from messages."""
        message_types = set()
        top_level_fields = set()
        nested_fields: dict[str, set] = {}
        metadata_fields = set()

        for msg in messages:
            if "MessageType" in msg:
                message_types.add(msg["MessageType"])

            for key in msg:
                if key not in ("Message", "MetaData"):
                    top_level_fields.add(key)

            if "MetaData" in msg and isinstance(msg["MetaData"], dict):
                for key in msg["MetaData"]:
                    metadata_fields.add(key)

            if "Message" in msg and isinstance(msg["Message"], dict):
                for msg_type, msg_data in msg["Message"].items():
                    if msg_type not in nested_fields:
                        nested_fields[msg_type] = set()
                    if isinstance(msg_data, dict):
                        for key in msg_data:
                            nested_fields[msg_type].add(key)

        return {
            "message_types_observed": sorted(message_types),
            "top_level_fields": sorted(top_level_fields),
            "nested_fields_by_message_type": {k: sorted(v) for k, v in nested_fields.items()},
            "metadata_fields": sorted(metadata_fields),
            "fields_different_from_expected": [],
            "missing_fields": [],
            "unexpected_fields": [],
        }

    def _compute_message_stats(self, messages: list[dict]) -> dict[str, Any]:
        """Compute statistics from messages."""
        unique_mmsi = set()
        message_type_counts: dict[str, int] = {}

        for msg in messages:
            mmsi = msg.get("MetaData", {}).get("MMSI")
            if mmsi:
                unique_mmsi.add(mmsi)

            msg_type = msg.get("MessageType", "Unknown")
            message_type_counts[msg_type] = message_type_counts.get(msg_type, 0) + 1

        return {
            "unique_mmsi_count": len(unique_mmsi),
            "message_type_counts": message_type_counts,
        }