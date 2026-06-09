"""AISStream WebSocket Client

Handles connection to AISStream WebSocket, subscription, and message streaming.
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Any, AsyncIterator

import websockets

# AISStream configuration
AISSTREAM_WS_URL = "wss://stream.aisstream.io/v0/stream"
AISSTREAM_API_KEY_ENV = "AISSTREAM_API_KEY"


class AISStreamClient:
    """Client for AISStream WebSocket API."""

    def __init__(
        self,
        bounding_boxes: list[list[list[float]]] | None = None,
        message_types: list[str] | None = None,
        mmsi_filter: list[str] | None = None,
    ):
        """Initialize AISStream client.

        Args:
            bounding_boxes: List of bounding boxes. Each box is [[lat1, lon1], [lat2, lon2]].
                           Defaults to global [[-90, -180], [90, 180]].
            message_types: Message types to filter. Defaults to ["PositionReport", "ShipStaticData"].
            mmsi_filter: Specific MMSI values to filter.
        """
        self.bounding_boxes = bounding_boxes or [[[-90, -180], [90, 180]]]
        self.message_types = message_types or ["PositionReport", "ShipStaticData"]
        self.mmsi_filter = mmsi_filter

    def _get_api_key(self) -> str:
        """Read API key from environment."""
        import os

        api_key = os.environ.get(AISSTREAM_API_KEY_ENV)
        if not api_key:
            raise ValueError(
                f"{AISSTREAM_API_KEY_ENV} environment variable is not set. "
                "Please set it before running this script."
            )
        return api_key

    def build_subscription(self, api_key: str) -> dict[str, Any]:
        """Build subscription payload.

        Note: API key is included in payload but should never be logged or stored.
        """
        sub: dict[str, Any] = {
            "APIKey": api_key,
            "BoundingBoxes": self.bounding_boxes,
        }

        if self.message_types:
            sub["FilterMessageTypes"] = self.message_types

        if self.mmsi_filter:
            sub["FiltersShipMMSI"] = self.mmsi_filter

        return sub

    async def stream_messages(
        self,
        max_messages: int | None = None,
        max_duration_seconds: float | None = None,
    ) -> AsyncIterator[dict[str, Any]]:
        """Connect to AISStream and yield messages.

        Args:
            max_messages: Maximum messages to receive before stopping.
            max_duration_seconds: Maximum seconds to run before stopping.

        Yields:
            Dictionary with received_at timestamp and raw AISStream message.
        """
        api_key = self._get_api_key()
        subscription = self.build_subscription(api_key)

        async with websockets.connect(AISSTREAM_WS_URL) as ws:
            # Send subscription immediately (within 3 second requirement)
            await ws.send(json.dumps(subscription))

            # Start receiving messages
            start_time = asyncio.get_event_loop().time()
            message_count = 0

            async for raw_message in ws:
                try:
                    data = json.loads(raw_message)
                    received_at = datetime.now(timezone.utc).isoformat()

                    # Wrap with received_at timestamp
                    wrapped = {
                        "received_at": received_at,
                        **data,
                    }

                    message_count += 1
                    yield wrapped

                    # Check limits
                    if max_messages and message_count >= max_messages:
                        break

                    if max_duration_seconds:
                        elapsed = asyncio.get_event_loop().time() - start_time
                        if elapsed >= max_duration_seconds:
                            break

                except json.JSONDecodeError:
                    # Skip invalid messages, don't yield
                    continue