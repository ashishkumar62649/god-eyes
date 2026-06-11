"""Typed result objects for Layer 08 News & OSINT fetchers."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class GdacsRawResult:
    """Raw result returned by the GDACS client."""

    source_id: str
    endpoint_url: str
    fetched_at: str
    item_count: int
    raw_payload: dict[str, Any]


@dataclass
class GdacsEventSummary:
    """Lightweight proof summary extracted from one GeoJSON feature."""

    event_id: str | None
    event_type: str | None
    alert_level: str | None
    country: str | None
    latitude: float | None
    longitude: float | None
    report_url: str | None
    details_url: str | None
    geometry_url: str | None
