"""Energy Infrastructure Normalizer (Layer 10).

Converts per-source records (WRI CSV rows, OSM Overpass elements,
GEM mock records) into a single canonical feature schema that maps
1:1 onto the ``energy_infrastructure`` DB table.

The normalizer is the only place that:

* Decides ``geometry_type`` (``point`` / ``line`` / ``polygon``).
* Builds the GeoJSON ``geometry_geojson`` blob and computes the
  ``centroid_lat`` / ``centroid_lon`` and ``bbox_geojson`` (if any).
* Validates coordinates and rejects invalid/empty geometries.
* Trims every field to a value the DB constraint will accept.
"""

from __future__ import annotations

import math
from typing import Any, Iterable

from energy_sources import (
    CANONICAL_FEATURE_TYPES,
    CATEGORY_VALUES,
    FUEL_TYPE_VALUES,
    GEOMETRY_TYPE_VALUES,
    LAYER_ID,
    PIPELINE_PRODUCT_VALUES,
    SOURCE_GEM,
    SOURCE_OSM,
    SOURCE_WRI,
    STATUS_VALUES,
    TERMINAL_TYPE_VALUES,
)
from gem_energy_client import classify_gem_record
from osm_energy_client import classify_osm_tags
from wri_power_plants_client import coerce_row, wri_row_to_feature_dict

MAX_VALID_LAT = 90.0
MIN_VALID_LAT = -90.0
MAX_VALID_LON = 180.0
MIN_VALID_LON = -180.0


# --------------------------------------------------------------------- utils


def _safe_str(value: Any, *, max_len: int | None = None) -> str | None:
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    if max_len is not None and len(s) > max_len:
        s = s[:max_len]
    return s


def _safe_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    return f


def _safe_positive_float(value: Any) -> float | None:
    f = _safe_float(value)
    if f is None or f < 0:
        return None
    return f


def _enum(value: Any, allow: Iterable[str], default: str = "unknown") -> str:
    if value is None:
        return default
    s = str(value).strip().lower()
    if s in allow:
        return s
    return default


def _coerce_lat_lon(lat: Any, lon: Any) -> tuple[float, float] | None:
    """Return a valid (lat, lon) pair or ``None`` for invalid values."""
    a = _safe_float(lat)
    b = _safe_float(lon)
    if a is None or b is None:
        return None
    if not (MIN_VALID_LAT <= a <= MAX_VALID_LAT and MIN_VALID_LON <= b <= MAX_VALID_LON):
        return None
    return (a, b)


# --------------------------------------------------------------------- geometry


def point_geometry(lat: float, lon: float) -> dict[str, Any]:
    return {"type": "Point", "coordinates": [lon, lat]}


def line_geometry(coords: list[tuple[float, float]]) -> dict[str, Any] | None:
    cleaned = [
        [float(lon), float(lat)]
        for lat, lon in coords
        if MIN_VALID_LAT <= lat <= MAX_VALID_LAT and MIN_VALID_LON <= lon <= MAX_VALID_LON
    ]
    if len(cleaned) < 2:
        return None
    return {"type": "LineString", "coordinates": cleaned}


def polygon_geometry(rings: list[list[tuple[float, float]]]) -> dict[str, Any] | None:
    cleaned_rings: list[list[list[float]]] = []
    for ring in rings:
        if not ring:
            continue
        cleaned = [
            [float(lon), float(lat)]
            for lat, lon in ring
            if MIN_VALID_LAT <= lat <= MAX_VALID_LAT and MIN_VALID_LON <= lon <= MAX_VALID_LON
        ]
        if len(cleaned) < 4:
            continue
        # Ensure the ring is closed.
        if cleaned[0] != cleaned[-1]:
            cleaned.append(cleaned[0])
        cleaned_rings.append(cleaned)
    if not cleaned_rings:
        return None
    return {"type": "Polygon", "coordinates": cleaned_rings}


def compute_centroid(geometry: dict[str, Any]) -> tuple[float, float] | None:
    """Return ``(lat, lon)`` centroid for a Point/LineString/Polygon."""
    gtype = geometry.get("type")
    coords = geometry.get("coordinates")
    if not coords or not isinstance(coords, list):
        return None

    if gtype == "Point":
        return _avg_points([[float(coords[1]), float(coords[0])]])

    if gtype == "LineString":
        return _avg_points([[float(lat), float(lon)] for lon, lat in coords])

    if gtype == "Polygon":
        ring = coords[0]
        return _avg_points([[float(lat), float(lon)] for lon, lat in ring])

    if gtype == "MultiPolygon":
        if not coords or not coords[0]:
            return None
        ring = coords[0][0]
        return _avg_points([[float(lat), float(lon)] for lon, lat in ring])

    return None


def _avg_points(points: list[list[float]]) -> tuple[float, float] | None:
    if not points:
        return None
    total_lat = 0.0
    total_lon = 0.0
    n = 0
    for lat, lon in points:
        try:
            lat_f = float(lat)
            lon_f = float(lon)
        except (TypeError, ValueError):
            continue
        if not (MIN_VALID_LAT <= lat_f <= MAX_VALID_LAT and MIN_VALID_LON <= lon_f <= MAX_VALID_LON):
            continue
        total_lat += lat_f
        total_lon += lon_f
        n += 1
    if n == 0:
        return None
    return (round(total_lat / n, 6), round(total_lon / n, 6))


def compute_bbox(geometry: dict[str, Any]) -> dict[str, Any] | None:
    """Return a Polygon GeoJSON bbox for the geometry, or ``None`` for points."""
    gtype = geometry.get("type")
    coords = geometry.get("coordinates")
    if not coords or not isinstance(coords, list):
        return None
    if gtype == "Point":
        return None

    lats: list[float] = []
    lons: list[float] = []
    if gtype == "LineString":
        for lon, lat in coords:
            lats.append(float(lat))
            lons.append(float(lon))
    elif gtype == "Polygon":
        for ring in coords:
            for lon, lat in ring:
                lats.append(float(lat))
                lons.append(float(lon))
    elif gtype == "MultiPolygon":
        for poly in coords:
            for ring in poly:
                for lon, lat in ring:
                    lats.append(float(lat))
                    lons.append(float(lon))
    else:
        return None

    if not lats:
        return None
    south = min(lats)
    north = max(lats)
    west = min(lons)
    east = max(lons)
    return polygon_geometry(
        [[(south, west), (north, west), (north, east), (south, east), (south, west)]]
    )


# --------------------------------------------------------------------- WRI


def normalize_wri_records(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convert WRI client output into canonical features.

    Accepts either raw WRI dicts (as parsed by ``parse_wri_csv``) or
    already-shaped feature dicts (as emitted by
    ``wri_power_plants_client.wri_row_to_feature_dict``). Rows missing
    required fields or with invalid coordinates are silently skipped.
    """
    out: list[dict[str, Any]] = []
    for rec in records:
        if not isinstance(rec, dict):
            continue
        if "latitude" in rec and "longitude" in rec and "feature_type" in rec:
            # Already a feature dict from wri_row_to_feature_dict.
            row_dict = rec
        else:
            row_dict = _to_wri_row_dict(rec)
        row = coerce_row(row_dict)
        if row is None:
            continue
        feat = wri_row_to_feature_dict(row)
        canonical = _canonicalize_wri_feature(feat)
        if canonical is not None:
            out.append(canonical)
    return out


def _to_wri_row_dict(rec: dict[str, Any]) -> dict[str, Any]:
    """Best-effort adaptation of a WRI client output to a WRI row dict.

    Accepts either a coerced ``WRIRow`` (dict form) or a feature dict
    already shaped by ``wri_row_to_feature_dict``. Always returns a
    dict with the WRI field names the normalizer consumes.
    """
    if "latitude" in rec and "longitude" in rec and "gppd_idnr" not in rec:
        # Already a feature dict.
        return {
            "gppd_idnr": rec.get("source_object_id") or rec.get("gppd_idnr"),
            "name": rec.get("name"),
            "country": rec.get("country"),
            "capacity_mw": rec.get("capacity_mw"),
            "latitude": rec.get("latitude"),
            "longitude": rec.get("longitude"),
            "primary_fuel": rec.get("fuel_type") or rec.get("primary_fuel"),
            "commissioning_year": (rec.get("source_metadata") or {}).get(
                "commissioning_year"
            ),
            "owner": rec.get("operator") or rec.get("owner"),
            "source": (rec.get("source_metadata") or {}).get("source_field"),
            "url": rec.get("source_url"),
            "geolocation_source": (rec.get("source_metadata") or {}).get(
                "geolocation_source"
            ),
        }
    return rec


def _canonicalize_wri_feature(feat: dict[str, Any]) -> dict[str, Any] | None:
    """Build the final canonical record for a WRI power plant."""
    ll = _coerce_lat_lon(feat.get("latitude"), feat.get("longitude"))
    if ll is None:
        return None
    lat, lon = ll
    geometry = point_geometry(lat, lon)
    centroid = compute_centroid(geometry)
    if centroid is None:
        return None
    return _build_canonical_record(
        source_id=feat.get("source_id") or SOURCE_WRI,
        source_object_id=str(feat.get("source_object_id") or "").strip(),
        feature_type=feat.get("feature_type") or "power_plant",
        category=feat.get("category") or "other_power",
        name=feat.get("name"),
        operator=feat.get("operator"),
        owner=feat.get("owner"),
        country=feat.get("country"),
        status=feat.get("status"),
        fuel_type=feat.get("fuel_type"),
        capacity_mw=feat.get("capacity_mw"),
        voltage_kv=None,
        pipeline_product=None,
        pipeline_length_km=None,
        terminal_type=None,
        geometry=geometry,
        centroid=centroid,
        bbox=None,
        source_confidence=feat.get("source_confidence") or 0.9,
        raw_source_json=feat.get("raw") or feat,
    )


# --------------------------------------------------------------------- OSM


def normalize_osm_elements(elements: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convert OSM Overpass elements into canonical features."""
    out: list[dict[str, Any]] = []
    for el in elements:
        feat = _osm_element_to_feature(el)
        if feat is not None:
            out.append(feat)
    return out


def _osm_element_to_feature(el: dict[str, Any]) -> dict[str, Any] | None:
    if not isinstance(el, dict):
        return None
    el_type = el.get("type")
    el_id = el.get("id")
    if el_id is None:
        return None
    tags = el.get("tags") or {}
    cls = classify_osm_tags(tags)
    if cls["feature_type"] not in CANONICAL_FEATURE_TYPES:
        return None

    name = _safe_str(tags.get("name"), max_len=512)
    operator = _safe_str(tags.get("operator"), max_len=256)
    owner = _safe_str(tags.get("owner"), max_len=256) or operator
    country = _safe_str(tags.get("country"), max_len=8)
    if country:
        country = country.upper()[:2]

    voltage_kv = None
    if cls["feature_type"] in {"substation", "transmission_line"}:
        voltage_kv = _safe_positive_float(cls.get("voltage_kv"))

    pipeline_product = None
    pipeline_length_km = None
    if cls["feature_type"] in {"oil_pipeline", "gas_pipeline"}:
        pipeline_product = _enum(
            cls.get("pipeline_product"), PIPELINE_PRODUCT_VALUES, default="unknown"
        )
        pipeline_length_km = _safe_positive_float(tags.get("length"))

    geometry: dict[str, Any] | None = None
    geometry_type = "point"
    if el_type == "node":
        ll = _coerce_lat_lon(el.get("lat"), el.get("lon"))
        if ll is None:
            return None
        lat, lon = ll
        geometry = point_geometry(lat, lon)
        geometry_type = "point"
    elif el_type == "way":
        geom = el.get("geometry")
        coords: list[tuple[float, float]] = []
        if isinstance(geom, list) and geom:
            for pt in geom:
                if not isinstance(pt, dict):
                    continue
                ll = _coerce_lat_lon(pt.get("lat"), pt.get("lon"))
                if ll is None:
                    continue
                coords.append(ll)
        if len(coords) >= 2:
            geometry = line_geometry(coords)
            geometry_type = "line"
        else:
            return None
    elif el_type == "relation":
        # Conservative: use the first member's center as a point. A full
        # multipolygon decoder is out of scope for the current build.
        members = el.get("members") or []
        center = _relation_center(members)
        if center is None:
            return None
        geometry = point_geometry(*center)
        geometry_type = "point"
    else:
        return None

    if geometry is None:
        return None
    centroid = compute_centroid(geometry)
    if centroid is None:
        return None
    bbox = compute_bbox(geometry) if geometry_type != "point" else None

    source_object_id = f"{el_type}/{el_id}"
    raw = dict(tags)
    raw["_osm_type"] = el_type
    raw["_osm_id"] = el_id

    return _build_canonical_record(
        source_id=SOURCE_OSM,
        source_object_id=source_object_id,
        feature_type=cls["feature_type"],
        category=cls.get("category") or "unknown",
        name=name,
        operator=operator,
        owner=owner,
        country=country,
        status="operational" if tags.get("disused") != "yes" else "decommissioned",
        fuel_type=cls.get("fuel_type") if cls["feature_type"] == "power_plant" else None,
        capacity_mw=None,
        voltage_kv=voltage_kv,
        pipeline_product=pipeline_product,
        pipeline_length_km=pipeline_length_km,
        terminal_type=None,
        geometry=geometry,
        centroid=centroid,
        bbox=bbox,
        source_confidence=0.7,
        raw_source_json=raw,
    )


def _relation_center(members: list[dict[str, Any]]) -> tuple[float, float] | None:
    for member in members:
        if not isinstance(member, dict):
            continue
        ll = _coerce_lat_lon(member.get("lat"), member.get("lon"))
        if ll is not None:
            return ll
    return None


# --------------------------------------------------------------------- GEM


def normalize_gem_records(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convert GEM records (real or mock) into canonical features."""
    out: list[dict[str, Any]] = []
    for rec in records:
        feat = _gem_record_to_feature(rec)
        if feat is not None:
            out.append(feat)
    return out


def _gem_record_to_feature(rec: dict[str, Any]) -> dict[str, Any] | None:
    if not isinstance(rec, dict):
        return None
    cls = classify_gem_record(rec)
    if cls["feature_type"] not in CANONICAL_FEATURE_TYPES:
        return None

    source_object_id = (
        str(rec.get("id") or rec.get("gem_id") or rec.get("object_id") or "").strip()
    )
    if not source_object_id:
        return None

    name = _safe_str(rec.get("name") or rec.get("project"), max_len=512)
    operator = _safe_str(rec.get("operator"), max_len=256)
    owner = _safe_str(rec.get("owner"), max_len=256) or operator
    country = _normalize_gem_country(rec.get("country") or rec.get("countries"))
    status = _enum(rec.get("status"), STATUS_VALUES, default="unknown")

    length_km = _safe_positive_float(rec.get("length_km") or rec.get("length"))
    pipeline_product = None
    if cls["feature_type"] in {"oil_pipeline", "gas_pipeline"}:
        pipeline_product = _enum(
            cls.get("pipeline_product"), PIPELINE_PRODUCT_VALUES, default="unknown"
        )
    terminal_type = None
    if cls["feature_type"] in {"lng_terminal", "oil_terminal", "gas_terminal"}:
        terminal_type = _enum(cls.get("terminal_type"), TERMINAL_TYPE_VALUES, default="unknown")

    geometry, geometry_type = _gem_geometry(rec)
    if geometry is None:
        return None
    centroid = compute_centroid(geometry)
    if centroid is None:
        return None
    bbox = compute_bbox(geometry) if geometry_type != "point" else None

    raw = dict(rec)
    return _build_canonical_record(
        source_id=SOURCE_GEM,
        source_object_id=source_object_id,
        feature_type=cls["feature_type"],
        category=cls.get("category") or "unknown",
        name=name,
        operator=operator,
        owner=owner,
        country=country,
        status=status,
        fuel_type=None,
        capacity_mw=_safe_positive_float(rec.get("capacity_mw")),
        voltage_kv=None,
        pipeline_product=pipeline_product,
        pipeline_length_km=length_km,
        terminal_type=terminal_type,
        geometry=geometry,
        centroid=centroid,
        bbox=bbox,
        source_confidence=0.8,
        raw_source_json=raw,
    )


def _gem_country_alpha2(country: Any) -> str | None:
    if not country:
        return None
    s = str(country).strip().upper()
    if len(s) >= 2:
        return s[:2]
    return None


def _normalize_gem_country(country: Any) -> str | None:
    if country is None:
        return None
    if isinstance(country, list) and country:
        return _gem_country_alpha2(country[0])
    if isinstance(country, str):
        # Comma-separated list of ISO codes.
        if "," in country:
            return _gem_country_alpha2(country.split(",")[0])
        if ";" in country:
            return _gem_country_alpha2(country.split(";")[0])
        return _gem_country_alpha2(country)
    return _gem_country_alpha2(country)


def _gem_geometry(rec: dict[str, Any]) -> tuple[dict[str, Any] | None, str]:
    """Extract geometry + geometry_type from a GEM record.

    Supports GeoJSON ``geometry`` directly, ``lat``/``lon`` points, and
    ``route`` arrays of [lon, lat] pairs.
    """
    geom = rec.get("geometry")
    if isinstance(geom, dict) and geom.get("type"):
        gtype = geom.get("type")
        if gtype == "Point":
            coords = geom.get("coordinates") or []
            if len(coords) >= 2:
                ll = _coerce_lat_lon(coords[1], coords[0])
                if ll is not None:
                    return point_geometry(*ll), "point"
        elif gtype == "LineString":
            coords = geom.get("coordinates") or []
            pts: list[tuple[float, float]] = []
            for c in coords:
                if isinstance(c, (list, tuple)) and len(c) >= 2:
                    ll = _coerce_lat_lon(c[1], c[0])
                    if ll is not None:
                        pts.append(ll)
            line = line_geometry(pts)
            if line is not None:
                return line, "line"
        elif gtype == "Polygon":
            rings = []
            for ring in geom.get("coordinates") or []:
                pts = []
                for c in ring:
                    if isinstance(c, (list, tuple)) and len(c) >= 2:
                        ll = _coerce_lat_lon(c[1], c[0])
                        if ll is not None:
                            pts.append(ll)
                rings.append(pts)
            poly = polygon_geometry(rings)
            if poly is not None:
                return poly, "polygon"

    lat = rec.get("lat") or rec.get("latitude")
    lon = rec.get("lon") or rec.get("lng") or rec.get("longitude")
    if lat is not None and lon is not None:
        ll = _coerce_lat_lon(lat, lon)
        if ll is not None:
            return point_geometry(*ll), "point"

    route = rec.get("route") or rec.get("coordinates")
    if isinstance(route, list) and route:
        pts = []
        for c in route:
            if isinstance(c, (list, tuple)) and len(c) >= 2:
                ll = _coerce_lat_lon(c[1], c[0])
                if ll is not None:
                    pts.append(ll)
        line = line_geometry(pts)
        if line is not None:
            return line, "line"

    return (None, "point")


# --------------------------------------------------------------------- common


def _build_canonical_record(
    *,
    source_id: str,
    source_object_id: str,
    feature_type: str,
    category: str,
    name: str | None,
    operator: str | None,
    owner: str | None,
    country: str | None,
    status: str | None,
    fuel_type: str | None,
    capacity_mw: float | None,
    voltage_kv: float | None,
    pipeline_product: str | None,
    pipeline_length_km: float | None,
    terminal_type: str | None,
    geometry: dict[str, Any],
    centroid: tuple[float, float],
    bbox: dict[str, Any] | None,
    source_confidence: float | None,
    raw_source_json: dict[str, Any] | None,
) -> dict[str, Any] | None:
    if not source_object_id:
        return None
    if feature_type not in CANONICAL_FEATURE_TYPES:
        return None
    if category not in CATEGORY_VALUES:
        category = "unknown"

    geometry_type = geometry.get("type")
    if geometry_type == "Point":
        canonical_geometry_type = "point"
    elif geometry_type == "LineString":
        canonical_geometry_type = "line"
    elif geometry_type == "Polygon":
        canonical_geometry_type = "polygon"
    else:
        return None
    if canonical_geometry_type not in GEOMETRY_TYPE_VALUES:
        return None

    # Make sure status / fuel_type / pipeline_product / terminal_type are
    # all enum-valid (the DB will reject unknown values).
    status_norm = _enum(status, STATUS_VALUES, default="unknown") if status else None
    fuel_norm = _enum(fuel_type, FUEL_TYPE_VALUES, default="unknown") if fuel_type else None
    product_norm = (
        _enum(pipeline_product, PIPELINE_PRODUCT_VALUES, default="unknown")
        if pipeline_product
        else None
    )
    term_norm = (
        _enum(terminal_type, TERMINAL_TYPE_VALUES, default="unknown")
        if terminal_type
        else None
    )
    if capacity_mw is not None:
        capacity_mw = _safe_positive_float(capacity_mw)
    if voltage_kv is not None:
        voltage_kv = _safe_positive_float(voltage_kv)
    if pipeline_length_km is not None:
        pipeline_length_km = _safe_positive_float(pipeline_length_km)
    if source_confidence is not None:
        cf = _safe_float(source_confidence)
        if cf is not None:
            source_confidence = max(0.0, min(1.0, cf))

    return {
        "layer_id": LAYER_ID,
        "source_id": source_id,
        "source_object_id": source_object_id,
        "feature_type": feature_type,
        "category": category,
        "geometry_type": canonical_geometry_type,
        "name": name,
        "operator": operator,
        "owner": owner,
        "country": country[:2].upper() if country else None,
        "status": status_norm,
        "fuel_type": fuel_norm,
        "capacity_mw": capacity_mw,
        "voltage_kv": voltage_kv,
        "pipeline_product": product_norm,
        "pipeline_length_km": pipeline_length_km,
        "terminal_type": term_norm,
        "geometry_geojson": geometry,
        "centroid_lat": centroid[0],
        "centroid_lon": centroid[1],
        "bbox_geojson": bbox,
        "source_confidence": source_confidence,
        "source_updated_at": None,
        "raw_source_json": raw_source_json or {},
    }


# --------------------------------------------------------------------- misc


def validate_geometry(geometry: dict[str, Any]) -> bool:
    """Return True if the geometry is non-empty and has valid coordinates."""
    if not isinstance(geometry, dict):
        return False
    gtype = geometry.get("type")
    coords = geometry.get("coordinates")
    if not coords or not isinstance(coords, list):
        return False
    if gtype == "Point":
        return (
            len(coords) >= 2
            and MIN_VALID_LAT <= float(coords[1]) <= MAX_VALID_LAT
            and MIN_VALID_LON <= float(coords[0]) <= MAX_VALID_LON
        )
    if gtype == "LineString":
        return len(coords) >= 2
    if gtype == "Polygon":
        return bool(coords) and all(len(ring) >= 4 for ring in coords)
    return False


def describe_normalizer() -> dict[str, Any]:
    """JSON-friendly description of the normalizer (for the worker banner)."""
    return {
        "layer_id": LAYER_ID,
        "supported_sources": [SOURCE_WRI, SOURCE_OSM, SOURCE_GEM],
        "geometry_types": sorted(GEOMETRY_TYPE_VALUES),
        "feature_types": sorted(CANONICAL_FEATURE_TYPES),
    }
