"""GDACS normalizer for Layer 08 News & OSINT.

Transforms raw GDACS GeoJSON features into a common normalized event shape.
Does not write to database. Returns plain dicts suitable for JSON serialisation.
"""

from __future__ import annotations

from typing import Any

SOURCE_ID = "gdacs"
SOURCE_FAMILY = "disaster_alert"
CONTENT_TYPE = "event"
SOURCE_DOMAIN = "gdacs.org"
ATTRIBUTION = "GDACS — Global Disaster Alert and Coordination System (https://www.gdacs.org/)"

_EVENT_TYPE_MAP: dict[str, str] = {
    "EQ": "earthquake",
    "FL": "flood",
    "TC": "tropical_cyclone",
    "DR": "drought",
    "VO": "volcano",
    "WF": "wildfire",
}

_ALERT_SEVERITY_MAP: dict[str, str] = {
    "red": "critical",
    "orange": "high",
    "green": "medium",
}


def _map_event_type(code: str | None) -> tuple[str, str]:
    """Return (category, subcategory) for a GDACS event type code."""
    if not code:
        return "disaster", "unknown"
    return "disaster", _EVENT_TYPE_MAP.get(code.upper(), "unknown")


def _map_severity(alert_level: str | None) -> str:
    if not alert_level:
        return "unknown"
    return _ALERT_SEVERITY_MAP.get(alert_level.lower(), "unknown")


def _make_title(props: dict[str, Any], event_type_label: str, country: str | None) -> str:
    for field in ("humanReadable", "title", "name"):
        val = props.get(field)
        if val and isinstance(val, str) and val.strip() and val.strip().lower() != "no title":
            return val.strip()
    label = event_type_label.replace("_", " ").capitalize()
    if country:
        return f"{label} alert in {country}"
    if event_type_label != "unknown":
        return f"{label} alert"
    return "GDACS disaster alert"


def _extract_point_coords(geometry: dict[str, Any] | None) -> tuple[float | None, float | None]:
    """Return (lat, lon) only for Point geometry. GeoJSON order is [lon, lat]."""
    if not geometry or geometry.get("type") != "Point":
        return None, None
    coords = geometry.get("coordinates")
    if not isinstance(coords, list) or len(coords) < 2:
        return None, None
    try:
        lon = float(coords[0])
        lat = float(coords[1])
    except (TypeError, ValueError):
        return None, None
    return lat, lon


def _dedupe_key(props: dict[str, Any]) -> str:
    event_id = props.get("eventid", "")
    episode_id = props.get("episodeid", "")
    event_type = props.get("eventtype", "")
    return f"gdacs:{event_id}:{episode_id}:{event_type}"


def normalize_gdacs_feature(
    feature: dict[str, Any],
    fetched_at: str,
    raw_evidence_uri: str | None = None,
) -> dict[str, Any] | None:
    """Normalize one GeoJSON feature. Returns None if feature is critically malformed."""
    if not isinstance(feature, dict):
        return None

    props = feature.get("properties") or {}
    geometry = feature.get("geometry")
    geo_type = geometry.get("type") if isinstance(geometry, dict) else None

    event_type_code = props.get("eventtype")
    category, subcategory = _map_event_type(event_type_code)
    _, event_type_label = _map_event_type(event_type_code)

    country = props.get("country") or props.get("countryname")
    title = _make_title(props, event_type_label, country)
    summary = props.get("description") or props.get("htmldescription") or None

    lat, lon = _extract_point_coords(geometry)
    is_point = geo_type == "Point" and lat is not None and lon is not None
    has_coordinates = is_point
    marker_ready = is_point

    location: dict[str, Any] = {
        "geometry_type": geo_type,
        "geo_source": "provided" if is_point else "none",
        "confidence": "exact_coordinate" if is_point else "unknown",
        "country_name": country or None,
        "country_code": props.get("iso3") or props.get("countrycode") or None,
        "latitude": lat,
        "longitude": lon,
    }

    resources = props.get("resources") or {}
    source_url = (
        resources.get("report")
        or resources.get("details")
        or f"https://www.gdacs.org/report.aspx?eventtype={event_type_code}&eventid={props.get('eventid', '')}"
    )

    event_id = props.get("eventid")
    source_object_id = str(event_id) if event_id is not None else None

    published_at = props.get("fromdate") or props.get("from") or props.get("date") or fetched_at
    updated_at = props.get("todate") or props.get("to") or None

    provider_metadata: dict[str, Any] = {
        "eventid": event_id,
        "episodeid": props.get("episodeid"),
        "eventtype": event_type_code,
        "alertlevel": props.get("alertlevel"),
        "geometry_type": geo_type,
        "report_url": resources.get("report"),
        "details_url": resources.get("details"),
        "geometry_url": resources.get("geometry"),
    }

    return {
        "source_id": SOURCE_ID,
        "source_family": SOURCE_FAMILY,
        "source_object_id": source_object_id,
        "source_url": source_url,
        "title": title,
        "summary": summary,
        "content_type": CONTENT_TYPE,
        "published_at": published_at,
        "updated_at": updated_at,
        "fetched_at": fetched_at,
        "location": location,
        "category": category,
        "subcategory": subcategory,
        "severity": _map_severity(props.get("alertlevel")),
        "source_domain": SOURCE_DOMAIN,
        "raw_evidence_uri": raw_evidence_uri,
        "attribution": ATTRIBUTION,
        "has_coordinates": has_coordinates,
        "marker_ready": marker_ready,
        "dedupe_key": _dedupe_key(props),
        "provider_metadata": provider_metadata,
    }


def normalize_gdacs_payload(
    payload: dict[str, Any],
    fetched_at: str,
    raw_evidence_uri: str | None = None,
) -> dict[str, Any]:
    """Normalize all features in a GDACS GeoJSON payload.

    Returns a result dict with:
        items              – list of normalized event dicts
        total_features     – int
        normalized_items   – int
        marker_ready_items – int
        skipped_items      – int
        geometry_type_counts
        alert_level_counts
        event_type_counts
    """
    features = payload.get("features") or []
    items: list[dict[str, Any]] = []
    skipped = 0
    geo_counts: dict[str, int] = {}
    alert_counts: dict[str, int] = {}
    type_counts: dict[str, int] = {}

    for feature in features:
        try:
            norm = normalize_gdacs_feature(feature, fetched_at, raw_evidence_uri)
        except Exception:  # noqa: BLE001
            skipped += 1
            continue

        if norm is None:
            skipped += 1
            continue

        items.append(norm)

        geo_key = norm["location"].get("geometry_type") or "unknown"
        geo_counts[geo_key] = geo_counts.get(geo_key, 0) + 1

        alert_key = norm["provider_metadata"].get("alertlevel") or "UNKNOWN"
        alert_counts[alert_key] = alert_counts.get(alert_key, 0) + 1

        type_key = norm["provider_metadata"].get("eventtype") or "UNKNOWN"
        type_counts[type_key] = type_counts.get(type_key, 0) + 1

    marker_ready = sum(1 for i in items if i["marker_ready"])

    return {
        "items": items,
        "total_features": len(features),
        "normalized_items": len(items),
        "marker_ready_items": marker_ready,
        "skipped_items": skipped,
        "geometry_type_counts": geo_counts,
        "alert_level_counts": alert_counts,
        "event_type_counts": type_counts,
    }
