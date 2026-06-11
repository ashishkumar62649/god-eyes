"""GDACS fetcher orchestration for Layer 08 News & OSINT.

Wraps the GDACS client and provides helper extraction for proof summaries.
Does not normalize into final database shape.
"""

from __future__ import annotations

from typing import Any

from layers.layer_08_news_osint.gdacs_client import fetch_gdacs
from layers.layer_08_news_osint.news_source_types import GdacsEventSummary, GdacsRawResult

LAYER_ID = "layer_08_news_osint"


def fetch_gdacs_events(
    *,
    eventtype: str = "ALL",
    alertlevel: str = "ALL",
    timeout: int = 30,
    fetch_client: str = "auto",
) -> GdacsRawResult:
    """Fetch raw GDACS events. Returns GdacsRawResult with raw GeoJSON payload."""
    return fetch_gdacs(
        eventtype=eventtype,
        alertlevel=alertlevel,
        timeout=timeout,
        fetch_client=fetch_client,
    )


def extract_event_summary(feature: dict[str, Any]) -> GdacsEventSummary:
    """Extract proof-level summary fields from one GeoJSON feature."""
    props = feature.get("properties") or {}
    geo = feature.get("geometry") or {}
    coords = geo.get("coordinates")

    lat: float | None = None
    lon: float | None = None
    if isinstance(coords, list) and len(coords) >= 2:
        try:
            lon = float(coords[0])
            lat = float(coords[1])
        except (TypeError, ValueError):
            pass

    resources = props.get("resources") or {}

    return GdacsEventSummary(
        event_id=str(props.get("eventid", "")) or None,
        event_type=props.get("eventtype"),
        alert_level=props.get("alertlevel"),
        country=props.get("country"),
        latitude=lat,
        longitude=lon,
        report_url=resources.get("report"),
        details_url=resources.get("details"),
        geometry_url=resources.get("geometry"),
    )


def summarise_events(result: GdacsRawResult) -> dict[str, Any]:
    """Produce proof-level aggregate summary from a GdacsRawResult."""
    features = result.raw_payload.get("features") or []
    summaries = [extract_event_summary(f) for f in features]

    alert_counts: dict[str, int] = {}
    type_counts: dict[str, int] = {}
    coords_count = 0

    for s in summaries:
        key_a = s.alert_level or "UNKNOWN"
        alert_counts[key_a] = alert_counts.get(key_a, 0) + 1
        key_t = s.event_type or "UNKNOWN"
        type_counts[key_t] = type_counts.get(key_t, 0) + 1
        if s.latitude is not None and s.longitude is not None:
            coords_count += 1

    return {
        "source_id": result.source_id,
        "endpoint_url": result.endpoint_url,
        "fetched_at": result.fetched_at,
        "item_count": result.item_count,
        "items_with_coordinates": coords_count,
        "alert_level_counts": alert_counts,
        "event_type_counts": type_counts,
    }
