"""Airport Layout Features Normalizer — converts runway data to layout features.

This normalizer reads from aviation_runways table and produces layout feature
records for airport_layout_features table.

Canonical decisions enforced here:
  - When aviation_runways.closed is true, set is_active = false
  - When aviation_runways.closed is false/null, set is_active = true
  - Preserve closed value in raw_metadata and feature_subtype
  - Do not create fake geometry
  - Existing active runway behavior must remain unchanged
"""

from __future__ import annotations

import sys
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[5]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

LAYER_ID = "layer_01_aviation"
SOURCE_TYPE = "ourairports"
SOURCE_NAME = "OurAirports Dataset"


@dataclass
class LayoutFeatureGeometry:
    type: str
    coordinates: list[float]


@dataclass
class NormalizedLayoutFeature:
    airport_id: str
    layer_id: str
    feature_type: str
    feature_subtype: str | None
    feature_name: str | None
    source_type: str
    source_name: str | None
    source_url: str | None
    source_object_id: str
    source_entity_id: str | None
    geometry: str
    geometry_type: str
    centroid: str | None
    bbox: str | None
    confidence_label: str
    confidence_score: float | None
    rank: int
    is_primary: bool
    is_active: bool
    fetched_at: datetime
    last_checked_at: datetime | None
    expires_at: datetime | None
    content_hash: str | None
    raw_metadata: dict[str, Any]
    diagnostics: dict[str, Any]


def build_runway_feature_name(le_ident: str | None, he_ident: str | None) -> str | None:
    if le_ident and he_ident:
        return f"{le_ident}/{he_ident}"
    if le_ident:
        return le_ident
    if he_ident:
        return he_ident
    return None


def build_runway_geometry(
    le_lat: float | None,
    le_lon: float | None,
    he_lat: float | None,
    he_lon: float | None,
) -> str | None:
    if le_lat is None or le_lon is None or he_lat is None or he_lon is None:
        return None
    return f"LINESTRING({le_lon} {le_lat}, {he_lon} {he_lat})"


def build_runway_centroid(
    le_lat: float | None,
    le_lon: float | None,
    he_lat: float | None,
    he_lon: float | None,
) -> str | None:
    if le_lat is None or le_lon is None or he_lat is None or he_lon is None:
        return None
    mid_lat = (le_lat + he_lat) / 2
    mid_lon = (le_lon + he_lon) / 2
    return f"POINT({mid_lon} {mid_lat})"


def build_runway_bbox(
    le_lat: float | None,
    le_lon: float | None,
    he_lat: float | None,
    he_lon: float | None,
) -> str | None:
    if le_lat is None or le_lon is None or he_lat is None or he_lon is None:
        return None
    min_lon = min(le_lon, he_lon)
    max_lon = max(le_lon, he_lon)
    min_lat = min(le_lat, he_lat)
    max_lat = max(le_lat, he_lat)
    return f"POLYGON(({min_lon} {min_lat}, {max_lon} {min_lat}, {max_lon} {max_lat}, {min_lon} {max_lat}, {min_lon} {min_lat}))"


def normalize_runway_to_layout_feature(
    runway: dict[str, Any],
    airport_id: str,
) -> NormalizedLayoutFeature | None:
    source_object_id = runway.get("source_runway_id")
    if not source_object_id:
        return None

    le_lat = runway.get("le_latitude_deg")
    le_lon = runway.get("le_longitude_deg")
    he_lat = runway.get("he_latitude_deg")
    he_lon = runway.get("he_longitude_deg")

    geometry = build_runway_geometry(le_lat, le_lon, he_lat, he_lon)
    if not geometry:
        return None

    closed = runway.get("closed", False)
    is_active = not closed

    feature_name = build_runway_feature_name(
        runway.get("le_ident"),
        runway.get("he_ident"),
    )

    raw_metadata = {
        "closed": closed,
        "length_ft": runway.get("length_ft"),
        "width_ft": runway.get("width_ft"),
        "surface": runway.get("surface"),
        "lighted": runway.get("lighted"),
        "le_ident": runway.get("le_ident"),
        "le_latitude_deg": le_lat,
        "le_longitude_deg": le_lon,
        "le_elevation_ft": runway.get("le_elevation_ft"),
        "le_heading_degT": runway.get("le_heading_degT"),
        "le_displaced_threshold_ft": runway.get("le_displaced_threshold_ft"),
        "he_ident": runway.get("he_ident"),
        "he_latitude_deg": he_lat,
        "he_longitude_deg": he_lon,
        "he_elevation_ft": runway.get("he_elevation_ft"),
        "he_heading_degT": runway.get("he_heading_degT"),
        "he_displaced_threshold_ft": runway.get("he_displaced_threshold_ft"),
    }

    diagnostics = {
        "normalized_at": datetime.now(timezone.utc).isoformat(),
        "source": "aviation_runways",
    }

    return NormalizedLayoutFeature(
        airport_id=airport_id,
        layer_id=LAYER_ID,
        feature_type="runway",
        feature_subtype="closed" if closed else "active",
        feature_name=feature_name,
        source_type=SOURCE_TYPE,
        source_name=SOURCE_NAME,
        source_url=None,
        source_object_id=source_object_id,
        source_entity_id=None,
        geometry=geometry,
        geometry_type="line",
        centroid=build_runway_centroid(le_lat, le_lon, he_lat, he_lon),
        bbox=build_runway_bbox(le_lat, le_lon, he_lat, he_lon),
        confidence_label="high" if not closed else "medium",
        confidence_score=0.95 if not closed else 0.7,
        rank=50 if not closed else 150,
        is_primary=not closed,
        is_active=is_active,
        fetched_at=datetime.now(timezone.utc),
        last_checked_at=None,
        expires_at=None,
        content_hash=None,
        raw_metadata=raw_metadata,
        diagnostics=diagnostics,
    )


def normalize_runways(
    runways: list[dict[str, Any]],
    airport_id: str,
) -> list[NormalizedLayoutFeature]:
    features = []
    for runway in runways:
        feature = normalize_runway_to_layout_feature(runway, airport_id)
        if feature:
            features.append(feature)
    return features


def feature_to_db_record(feature: NormalizedLayoutFeature) -> dict[str, Any]:
    result = asdict(feature)
    result["fetched_at"] = feature.fetched_at.isoformat()
    if feature.last_checked_at:
        result["last_checked_at"] = feature.last_checked_at.isoformat()
    if feature.expires_at:
        result["expires_at"] = feature.expires_at.isoformat()
    return result