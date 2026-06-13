"""GDELT Event Export normalizer for Layer 08 News & OSINT.

Transforms raw GDELT event rows into a common normalized event shape.
Does not write to database. Returns plain dicts suitable for JSON serialisation.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

# Source identity
SOURCE_ID = "gdelt_event_export"
SOURCE_FAMILY = "global_event"
CONTENT_TYPE = "event"
SOURCE_DOMAIN = "gdeltproject.org"
ATTRIBUTION = "GDELT — Global Database of Events, Language, and Tone (https://www.gdeltproject.org/)"

LAYER_ID = "layer_08_news_osint"

# QuadClass to category mapping
_QUADCLASS_CATEGORY_MAP: dict[str, str] = {
    "1": "diplomacy",  # Verbal cooperation
    "2": "cooperation",  # Material cooperation
    "3": "conflict",  # Verbal conflict
    "4": "conflict",  # Material conflict
}

# QuadClass to severity mapping (conservative)
_QUADCLASS_SEVERITY_MAP: dict[str, str] = {
    "1": "low",  # Verbal cooperation
    "2": "medium",  # Material cooperation
    "3": "medium",  # Verbal conflict
    "4": "high",  # Material conflict
}

# EventRootCode to subcategory mapping (CAMEO root codes)
_EVENTROOT_SUBCATEGORY_MAP: dict[str, str] = {
    "01": "statement",
    "02": "appeal_request",
    "03": "intent_cooperation",
    "04": "consultation",
    "05": "diplomatic_cooperation",
    "06": "material_cooperation",
    "07": "aid",
    "08": "yield_concede",
    "09": "investigation",
    "10": "demand",
    "11": "disapproval",
    "12": "rejection",
    "13": "threat",
    "14": "protest",
    "15": "force_posture",
    "16": "reduce_relations",
    "17": "coercion",
    "18": "assault",
    "19": "fight",
    "20": "mass_violence",
}

# EventRootCode to severity override (violent events)
_EVENTROOT_SEVERITY_MAP: dict[str, str] = {
    "18": "high",  # Assault
    "19": "critical",  # Fight
    "20": "critical",  # Mass violence
    "17": "high",  # Coercion
    "15": "high",  # Force posture
    "13": "medium",  # Threat
}


def _map_quadclass_to_label(quad_class: str) -> str:
    """Map QuadClass number to human-readable label."""
    labels = {
        "1": "Verbal Cooperation",
        "2": "Material Cooperation",
        "3": "Verbal Conflict",
        "4": "Material Conflict",
    }
    return labels.get(quad_class, "Unknown")


def _map_category(quad_class: str | None) -> str:
    """Map QuadClass to category."""
    if not quad_class:
        return "unknown"
    return _QUADCLASS_CATEGORY_MAP.get(quad_class, "unknown")


def _map_subcategory(event_root_code: str | None) -> str:
    """Map EventRootCode to subcategory."""
    if not event_root_code:
        return "unknown"
    # Take first 2 digits for root code
    root = event_root_code[:2]
    return _EVENTROOT_SUBCATEGORY_MAP.get(root, "unknown")


def _map_severity(quad_class: str | None, event_root_code: str | None) -> str:
    """Map QuadClass and EventRootCode to severity."""
    # First check EventRootCode for violent events
    if event_root_code:
        root = event_root_code[:2]
        if root in _EVENTROOT_SEVERITY_MAP:
            return _EVENTROOT_SEVERITY_MAP[root]
    
    # Fall back to QuadClass
    if quad_class:
        return _QUADCLASS_SEVERITY_MAP.get(quad_class, "unknown")
    return "unknown"


def _make_title(row: dict[str, Any]) -> str:
    """Create descriptive title from structured fields."""
    actor1 = row.get("actor1_name", "").strip()
    actor2 = row.get("actor2_name", "").strip()
    event_code = row.get("event_code", "").strip()
    country = row.get("action_geo_country_code", "").strip()
    location = row.get("action_geo_full_name", "").strip()
    quad_class = row.get("quad_class", "").strip()
    quad_label = _map_quadclass_to_label(quad_class)
    
    # Build title based on available info
    if actor1 or actor2:
        actors = []
        if actor1:
            actors.append(actor1)
        if actor2:
            actors.append(actor2)
        if country:
            return f"GDELT event {event_code} involving {' and '.join(actors)} in {country}"
        return f"GDELT event {event_code} involving {' and '.join(actors)}"
    
    if location:
        return f"GDELT {quad_label.lower()} event in {location}"
    
    if country:
        return f"GDELT {quad_label.lower()} event in {country}"
    
    return f"GDELT event {event_code}"


def _make_summary(row: dict[str, Any]) -> str:
    """Create short summary from structured fields."""
    event_code = row.get("event_code", "").strip()
    event_root = row.get("event_root_code", "").strip()
    quad_class = row.get("quad_class", "").strip()
    quad_label = _map_quadclass_to_label(quad_class)
    actor1 = row.get("actor1_name", "").strip()
    actor2 = row.get("actor2_name", "").strip()
    location = row.get("action_geo_full_name", "").strip()
    country = row.get("action_geo_country_code", "").strip()
    domain = row.get("source_domain", "").strip()
    
    parts = []
    parts.append(f"EventCode: {event_code}")
    parts.append(f"Type: {quad_label}")
    
    if actor1 or actor2:
        actors = []
        if actor1:
            actors.append(actor1)
        if actor2:
            actors.append(actor2)
        parts.append(f"Actors: {' | '.join(actors)}")
    
    if location:
        parts.append(f"Location: {location}")
    elif country:
        parts.append(f"Country: {country}")
    
    if domain:
        parts.append(f"Source: {domain}")
    
    return " | ".join(parts)


def _validate_coordinates(lat_str: str | None, lon_str: str | None) -> tuple[bool, float | None, float | None]:
    """Validate and parse coordinates."""
    if not lat_str or not lon_str:
        return False, None, None
    
    try:
        lat = float(lat_str.strip())
        lon = float(lon_str.strip())
    except (ValueError, TypeError):
        return False, None, None
    
    if -90 <= lat <= 90 and -180 <= lon <= 180:
        return True, lat, lon
    return False, None, None


def _determine_location_confidence(row: dict[str, Any], has_coords: bool) -> str:
    """Determine location confidence level."""
    if not has_coords:
        country = row.get("action_geo_country_code", "").strip()
        if country and len(country) <= 3:
            return "country_level"
        return "unknown"
    
    # Has valid coordinates - check if we have location name
    location = row.get("action_geo_full_name", "").strip()
    if location:
        return "city_level"  # Approximate - GDELT doesn't distinguish exact vs city
    return "exact_coordinate"


def normalize_gdelt_row(row: dict[str, Any], fetched_at: datetime | None = None) -> dict[str, Any]:
    """Normalize a single GDELT event row.
    
    Args:
        row: Dictionary with GDELT row fields from fetcher
        fetched_at: Timestamp when data was fetched
    
    Returns:
        Normalized event dictionary
    """
    fetched_at = fetched_at or datetime.now(timezone.utc)
    
    # Extract key fields
    global_event_id = row.get("global_event_id", "").strip()
    sql_date = row.get("sql_date", "").strip()
    event_code = row.get("event_code", "").strip()
    event_base_code = row.get("event_base_code", "").strip()
    event_root_code = row.get("event_root_code", "").strip()
    quad_class = row.get("quad_class", "").strip()
    source_url = row.get("source_url", "").strip()
    source_domain = row.get("source_domain", "").strip()
    action_geo_lat = row.get("action_geo_lat")
    action_geo_long = row.get("action_geo_long")
    action_geo_country = row.get("action_geo_country_code", "").strip()
    action_geo_full = row.get("action_geo_full_name", "").strip()
    goldstein_scale = row.get("goldstein_scale", "").strip()
    num_mentions = row.get("num_mentions", "").strip()
    num_sources = row.get("num_sources", "").strip()
    num_articles = row.get("num_articles", "").strip()
    avg_tone = row.get("avg_tone", "").strip()
    actor1_name = row.get("actor1_name", "").strip()
    actor2_name = row.get("actor2_name", "").strip()
    date_added = row.get("date_added", "").strip()
    
    # Validate coordinates
    has_valid_coords, lat, lon = _validate_coordinates(action_geo_lat, action_geo_long)
    
    # Determine marker readiness
    marker_ready = (
        bool(global_event_id) and
        bool(source_url) and
        has_valid_coords
    )
    
    # Map fields
    category = _map_category(quad_class)
    subcategory = _map_subcategory(event_root_code)
    severity = _map_severity(quad_class, event_root_code)
    location_confidence = _determine_location_confidence(row, has_valid_coords)
    
    # Build dedupe key
    dedupe_key = f"gdelt_event_export:{global_event_id}"
    
    # Build title and summary
    title = _make_title(row)
    summary = _make_summary(row)
    
    # Parse date
    published_at = None
    if sql_date:
        try:
            published_at = datetime.strptime(sql_date, "%Y%m%d").replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    
    # Build normalized record
    normalized = {
        # Core identity
        "item_id": None,  # Assigned by DB
        "layer_id": LAYER_ID,
        "source_id": SOURCE_ID,
        "source_family": SOURCE_FAMILY,
        "source_event_id": global_event_id,
        "dedupe_key": dedupe_key,
        
        # Content
        "title": title,
        "summary": summary,
        "category": category,
        "subcategory": subcategory,
        
        # Severity
        "severity": severity,
        
        # Location
        "country_code": action_geo_country if len(action_geo_country) <= 3 else None,
        "location_name": action_geo_full or None,
        "latitude": lat,
        "longitude": lon,
        "has_coordinates": has_valid_coords,
        "marker_ready": marker_ready,
        "geometry_type": "Point" if has_valid_coords else None,
        "location_confidence": location_confidence,
        
        # Timestamps
        "published_at": published_at.isoformat() if published_at else None,
        "source_updated_at": date_added if date_added else None,
        "fetched_at": fetched_at.isoformat(),
        
        # Attribution
        "source_url": source_url,
        "source_domain": source_domain,
        "attribution": ATTRIBUTION,
        
        # Provider metadata (preserved for internal use)
        "provider_metadata": {
            "global_event_id": global_event_id,
            "sql_date": sql_date,
            "event_code": event_code,
            "event_base_code": event_base_code,
            "event_root_code": event_root_code,
            "quad_class": quad_class,
            "quad_class_label": _map_quadclass_to_label(quad_class),
            "goldstein_scale": goldstein_scale,
            "num_mentions": num_mentions,
            "num_sources": num_sources,
            "num_articles": num_articles,
            "avg_tone": avg_tone,
            "actor1_name": actor1_name,
            "actor2_name": actor2_name,
            "action_geo_type": row.get("action_geo_type", "").strip(),
            "action_geo_full_name": action_geo_full,
            "action_geo_country_code": action_geo_country,
            "date_added": date_added,
        },
    }
    
    return normalized


def normalize_gdelt_payload(
    rows: list[dict[str, Any]],
    fetched_at: datetime | None = None
) -> dict[str, Any]:
    """Normalize a batch of GDELT event rows.
    
    Args:
        rows: List of raw GDELT row dictionaries from fetcher
        fetched_at: Timestamp when data was fetched
    
    Returns:
        Summary dictionary with normalized items and statistics
    """
    fetched_at = fetched_at or datetime.now(timezone.utc)
    
    normalized_items = []
    category_counts: dict[str, int] = {}
    subcategory_counts: dict[str, int] = {}
    severity_counts: dict[str, int] = {}
    location_confidence_counts: dict[str, int] = {}
    marker_ready_count = 0
    list_only_count = 0
    has_source_url_count = 0
    
    for row in rows:
        normalized = normalize_gdelt_row(row, fetched_at)
        normalized_items.append(normalized)
        
        # Count statistics
        cat = normalized.get("category", "unknown")
        category_counts[cat] = category_counts.get(cat, 0) + 1
        
        subcat = normalized.get("subcategory", "unknown")
        subcategory_counts[subcat] = subcategory_counts.get(subcat, 0) + 1
        
        sev = normalized.get("severity", "unknown")
        severity_counts[sev] = severity_counts.get(sev, 0) + 1
        
        loc_conf = normalized.get("location_confidence", "unknown")
        location_confidence_counts[loc_conf] = location_confidence_counts.get(loc_conf, 0) + 1
        
        if normalized.get("marker_ready"):
            marker_ready_count += 1
        else:
            list_only_count += 1
        
        if normalized.get("source_url"):
            has_source_url_count += 1
    
    return {
        "source_id": SOURCE_ID,
        "layer_id": LAYER_ID,
        "fetched_at": fetched_at.isoformat(),
        "raw_row_count": len(rows),
        "normalized_items": normalized_items,
        "normalized_count": len(normalized_items),
        "marker_ready_count": marker_ready_count,
        "list_only_count": list_only_count,
        "category_counts": category_counts,
        "subcategory_counts": subcategory_counts,
        "severity_counts": severity_counts,
        "location_confidence_counts": location_confidence_counts,
        "source_url_count": has_source_url_count,
    }