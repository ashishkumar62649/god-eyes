"""Space-Track Normalizer — Convert raw GP records to canonical Layer 05 form.

Maps Space-Track ``satcat`` (General Perturbations) records into the
canonical NormalizedSatellite shape used by the rest of the Layer 05
pipeline. The normalizer is intentionally tolerant of missing fields
and never raises on individual record failures — malformed records
are reported as errors in the normalize manifest.

Canonical field mapping (Space-Track field -> canonical field):
    NORAD_CAT_ID         -> norad_cat_id
    OBJECT_NAME          -> name
    OBJECT_ID            -> source_object_id
    OBJECT_TYPE          -> object_type (normalised)
    COUNTRY_CODE         -> country
    LAUNCH_DATE          -> launch_date
    DECAY_DATE           -> (used to set is_active)
    INCLINATION          -> orbit_class (heuristic, fallback to tle_parser)
    PERIOD               -> (used in orbit_class heuristic if available)
    SEMI_MAJOR_AXIS      -> (used in orbit_class heuristic if available)
    ECCENTRICITY         -> (stored in raw_source_json only)
    MEAN_MOTION          -> (used in orbit_class heuristic)
    TLE_LINE1 / TLE_LINE2 -> tle_line1 / tle_line2
    EPOCH                -> orbital_epoch_at
    RCS                  -> (radar cross-section, stored in raw_source_json)
    SITE                 -> (launch site, stored in raw_source_json)
    COMMENT              -> (raw comment, stored in raw_source_json)
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from classification import classify_object, get_visual_shape, get_visual_color
from orbit_propagation import compute_position_from_tle


# Internal canonical source id used uniformly regardless of CLI spelling.
SOURCE_ID_CANONICAL = "space_track"

# Object-type mapping: Space-Track OBJECT_TYPE -> canonical object_type.
OBJECT_TYPE_MAP: dict[str, str] = {
    "PAYLOAD": "satellite",
    "DEBRIS": "debris",
    "ROCKET BODY": "rocket_body",
    "TBA": "unknown",
    "UNKNOWN": "unknown",
}


def _safe_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        try:
            return int(float(value))
        except (ValueError, TypeError):
            return None


def _safe_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def _parse_dt(value: Any) -> datetime | None:
    """Parse a datetime-like value to a UTC-aware datetime.

    The returned datetime always carries ``tzinfo=timezone.utc``. Naive
    datetimes are attached to UTC; offset-aware datetimes are converted
    to UTC. ``None`` is returned for empty / unparseable input.

    Space-Track ``EPOCH`` is emitted as a full ISO-8601 timestamp like
    ``1970-03-31T00:50:24.429408`` (no timezone suffix). Parsing that
    via ``datetime.fromisoformat`` yields a naive datetime; if it is
    then passed to ``compute_position_from_tle`` alongside the
    UTC-aware ``datetime.now(timezone.utc)`` target time, the
    subtraction raises ``TypeError: can't subtract offset-naive and
    offset-aware datetimes``. This helper guarantees the result is
    always UTC-aware so downstream math is safe.
    """
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    s = str(value).strip()
    if not s:
        return None
    # Try ISO-8601 first (with or without timezone suffix).
    try:
        dt = datetime.fromisoformat(s)
    except (ValueError, TypeError):
        dt = None
    if dt is not None:
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    # Fall back to date-only formats.
    for fmt in ("%Y-%m-%d", "%Y-%m", "%Y/%m/%d"):
        try:
            return datetime.strptime(s[: len(fmt) + 2], fmt).replace(tzinfo=timezone.utc)
        except (ValueError, TypeError):
            continue
    return None


def _map_object_type(raw: str | None) -> str:
    if not raw:
        return "unknown"
    key = str(raw).strip().upper()
    return OBJECT_TYPE_MAP.get(key, "unknown")


def _is_active(decay_date: datetime | None) -> bool:
    return decay_date is None


def _orbit_class_from_means(mean_motion: float | None) -> str | None:
    """Translate mean motion (rev/day) to an orbit class."""
    if mean_motion is None:
        return None
    if mean_motion > 14.0:
        return "vleo"
    if mean_motion > 10.0:
        return "leo"
    if mean_motion > 2.0:
        return "meo"
    if 0.9 <= mean_motion <= 1.1:
        return "geo"
    if mean_motion < 0.9:
        return "heo"
    return "unknown"


def normalize_space_track_record(
    record: dict[str, Any],
    fetched_at: str | None = None,
) -> dict[str, Any] | None:
    """Normalize one Space-Track GP record to a canonical satellite dict.

    Returns ``None`` if the record is malformed (missing norad_cat_id or
    name). All other failures are reflected in the returned dict under
    ``raw_source_json['_warnings']`` so they can be surfaced via the
    normalize manifest.
    """
    warnings: list[str] = []

    norad = _safe_int(record.get("NORAD_CAT_ID"))
    name = record.get("OBJECT_NAME")
    if not norad or not name:
        return None

    name = str(name).strip()
    if not name:
        return None

    raw_obj_type = record.get("OBJECT_TYPE")
    object_type = _map_object_type(raw_obj_type)
    decay_dt = _parse_dt(record.get("DECAY_DATE"))
    is_active = _is_active(decay_dt)

    # Run the same classifier as the TLE pipeline for visual/category/importance.
    classification = classify_object(
        name=name,
        norad_cat_id=norad,
        tle_line1=record.get("TLE_LINE1"),
        tle_line2=record.get("TLE_LINE2"),
    )

    category = classification.get("category", "unknown")
    is_important = classification.get("is_important", False)

    # Prefer TLE-derived orbit class if TLE present, else mean-motion heuristic.
    tle_line1 = record.get("TLE_LINE1") or ""
    tle_line2 = record.get("TLE_LINE2") or ""
    if tle_line1 and tle_line2:
        orbit_class = classification.get("orbit_class", "unknown")
    else:
        mean_motion = _safe_float(record.get("MEAN_MOTION"))
        oc = _orbit_class_from_means(mean_motion)
        orbit_class = oc or classification.get("orbit_class", "unknown")
        if not tle_line1 or not tle_line2:
            warnings.append("missing_tle_lines")

    # Epoch from EPOCH (if present) or from TLE line 1.
    epoch_dt = _parse_dt(record.get("EPOCH"))
    if epoch_dt is None and tle_line1:
        try:
            from tle_parser import parse_tle_epoch
            epoch_dt = parse_tle_epoch(tle_line1)
        except Exception:
            epoch_dt = None

    country = record.get("COUNTRY_CODE")
    launch_date_raw = record.get("LAUNCH_DATE")
    launch_date_str = None
    if launch_date_raw:
        try:
            launch_date_str = str(launch_date_raw).strip()[:10]
        except Exception:
            launch_date_str = None

    visual_shape = get_visual_shape(object_type)
    visual_color = get_visual_color(
        orbit_class=orbit_class,
        object_type=object_type,
        category=category,
        is_important=is_important,
    )

    raw_source_json: dict[str, Any] = {
        "provider": "space-track",
        "norad_cat_id": norad,
        "object_id": record.get("OBJECT_ID"),
        "intl_designator": record.get("INTLDES"),
        "object_type_raw": raw_obj_type,
        "country": country,
        "launch_date": launch_date_str,
        "decay_date": decay_dt.isoformat() if decay_dt else None,
        "rcs": record.get("RCS"),
        "launch_site": record.get("SITE"),
        "comment": record.get("COMMENT"),
        "period_min": _safe_float(record.get("PERIOD")),
        "inclination_deg": _safe_float(record.get("INCLINATION")),
        "eccentricity": _safe_float(record.get("ECCENTRICITY")),
        "mean_motion": _safe_float(record.get("MEAN_MOTION")),
        "semi_major_axis_km": _safe_float(record.get("SEMI_MAJOR_AXIS")),
        "perigee_km": _safe_float(record.get("PERIGEE")),
        "apogee_km": _safe_float(record.get("APOGEE")),
        "file": record.get("FILE"),
    }
    if warnings:
        raw_source_json["_warnings"] = warnings

    # Build position if TLE is present.
    position: dict[str, Any] | None = None
    if tle_line1 and tle_line2:
        try:
            pos = compute_position_from_tle(
                tle_line1,
                tle_line2,
                orbital_epoch=epoch_dt,
            )
        except Exception as exc:
            pos = None
            warnings.append(f"position_compute_error: {exc}")
        if pos:
            pos_visual_shape = get_visual_shape(object_type)
            pos_visual_color = get_visual_color(
                orbit_class=orbit_class,
                altitude_km=pos.altitude_km,
                object_type=object_type,
                category=category,
                is_important=is_important,
            )
            position = {
                "estimated_at": pos.estimated_at.isoformat() if pos.estimated_at else None,
                "latitude": pos.latitude,
                "longitude": pos.longitude,
                "altitude_km": pos.altitude_km,
                "velocity_kms": pos.velocity_kms,
                "heading_deg": pos.heading_deg,
                "visual_shape": pos_visual_shape,
                "visual_color": pos_visual_color,
                "source_age_seconds": pos.source_age_seconds,
                "computation_method": pos.computation_method,
            }

    sat: dict[str, Any] = {
        "layer_id": "layer_05_space_satellites",
        "source_id": SOURCE_ID_CANONICAL,
        "source_object_id": str(norad),
        "norad_cat_id": norad,
        "name": name,
        "object_type": object_type,
        "category": category,
        "orbit_class": orbit_class,
        "country": country,
        "operator_or_owner": None,
        "launch_date": launch_date_str,
        "tle_line1": tle_line1 or None,
        "tle_line2": tle_line2 or None,
        "orbital_epoch_at": epoch_dt.isoformat() if epoch_dt else None,
        "source_updated_at": fetched_at or datetime.now(timezone.utc).isoformat(),
        "is_active": is_active,
        "is_important": is_important,
        "visual_shape": visual_shape,
        "visual_color": visual_color,
        "raw_source_json": raw_source_json,
    }
    if position:
        sat["position"] = position
    return sat


def normalize_space_track_records(
    records: list[dict[str, Any]],
    fetched_at: str | None = None,
) -> tuple[list[dict[str, Any]], list[str]]:
    """Normalize a list of Space-Track records.

    Returns (normalized_records, error_messages). Malformed records
    are skipped and their identifiers reported in error_messages.
    """
    normalized: list[dict[str, Any]] = []
    errors: list[str] = []
    for idx, record in enumerate(records):
        try:
            sat = normalize_space_track_record(record, fetched_at=fetched_at)
        except Exception as exc:
            errors.append(f"record[{idx}]: normalization failed: {exc}")
            continue
        if sat is None:
            errors.append(f"record[{idx}]: missing norad_cat_id or name")
            continue
        normalized.append(sat)
    return normalized, errors
