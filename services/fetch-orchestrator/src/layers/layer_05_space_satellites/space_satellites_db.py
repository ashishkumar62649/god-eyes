"""Space Satellites DB — Database operations for Layer 05.

Provides database operations for persisting satellite catalog records
and computed positions to space_satellites and space_satellite_positions_latest tables.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[5]
import sys

if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

DEFAULT_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://god_eyes:god_eyes_dev_password@localhost:5432/god_eyes_dev"
)

LAYER_ID = "layer_05_space_satellites"
SOURCE_ID = "celestrak"


def safe_json_dumps(data: Any) -> str:
    """Serialize data to JSON, handling datetime, Decimal, etc."""
    def serialize_value(obj: Any) -> Any:
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return str(obj)
        if isinstance(obj, bytes):
            return obj.decode("utf-8", errors="replace")
        if isinstance(obj, dict):
            return {k: serialize_value(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [serialize_value(item) for item in obj]
        return obj
    return json.dumps(serialize_value(data))


def connect_db(database_url: str = DEFAULT_DATABASE_URL) -> Any:
    import psycopg
    from psycopg.rows import dict_row
    return psycopg.connect(database_url, row_factory=dict_row)


def get_existing_satellite(
    conn: Any,
    source_id: str,
    source_object_id: str,
) -> dict[str, Any] | None:
    """Get existing satellite from catalog by source_id + source_object_id."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, source_id, source_object_id, norad_cat_id, 
                   first_seen_at, last_seen_at, updated_at
            FROM space_satellites
            WHERE source_id = %s AND source_object_id = %s
            """,
            [source_id, source_object_id]
        )
        row = cur.fetchone()
        return dict(row) if row else None


def upsert_satellite(
    conn: Any,
    layer_id: str,
    source_id: str,
    source_object_id: str,
    norad_cat_id: int | None,
    name: str,
    object_type: str,
    category: str,
    orbit_class: str,
    country: str | None,
    operator_or_owner: str | None,
    launch_date: str | None,
    tle_line1: str | None,
    tle_line2: str | None,
    orbital_epoch_at: datetime | None,
    source_updated_at: datetime | None,
    is_active: bool,
    is_important: bool,
    raw_source_json: dict[str, Any],
) -> tuple[str, bool]:
    """Upsert satellite into space_satellites catalog.
    
    Returns (satellite_id, is_new_or_updated) tuple.
    Preserves first_seen_at, only updates last_seen_at.
    Does not overwrite newer records with older data.
    """
    now = datetime.now(timezone.utc)
    raw_json = safe_json_dumps(raw_source_json)
    launch_date_val = None
    if launch_date:
        # Try to parse launch date (format: YYYY-MM or YYYY-MM-DD or YYYY-MM[A-Z])
        try:
            if len(launch_date) >= 7:
                launch_date_val = datetime.strptime(launch_date[:7], "%Y-%m").date()
        except ValueError:
            pass

    # Check existing record
    existing = get_existing_satellite(conn, source_id, source_object_id)
    is_new = existing is None

    if not is_new:
        # Compare timestamps - don't overwrite if incoming is older
        existing_updated = existing.get("updated_at")
        if existing_updated and source_updated_at:
            # If existing record has been updated more recently than our source
            if existing_updated > source_updated_at:
                return existing["id"], False

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO space_satellites (
                layer_id, source_id, source_object_id, norad_cat_id,
                name, object_type, category, orbit_class,
                country, operator_or_owner, launch_date,
                tle_line1, tle_line2, orbital_epoch_at, source_updated_at,
                first_seen_at, last_seen_at,
                is_active, is_important, raw_source_json
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            ON CONFLICT (source_id, source_object_id) DO UPDATE SET
                norad_cat_id = EXCLUDED.norad_cat_id,
                name = EXCLUDED.name,
                object_type = EXCLUDED.object_type,
                category = EXCLUDED.category,
                orbit_class = EXCLUDED.orbit_class,
                country = COALESCE(EXCLUDED.country, space_satellites.country),
                operator_or_owner = COALESCE(EXCLUDED.operator_or_owner, space_satellites.operator_or_owner),
                launch_date = COALESCE(EXCLUDED.launch_date, space_satellites.launch_date),
                tle_line1 = EXCLUDED.tle_line1,
                tle_line2 = EXCLUDED.tle_line2,
                orbital_epoch_at = EXCLUDED.orbital_epoch_at,
                source_updated_at = EXCLUDED.source_updated_at,
                last_seen_at = EXCLUDED.last_seen_at,
                is_active = EXCLUDED.is_active,
                is_important = EXCLUDED.is_important,
                raw_source_json = EXCLUDED.raw_source_json,
                updated_at = NOW()
            RETURNING id
            """,
            [
                layer_id, source_id, source_object_id, norad_cat_id,
                name, object_type, category, orbit_class,
                country, operator_or_owner, launch_date_val,
                tle_line1, tle_line2, orbital_epoch_at, source_updated_at,
                now if is_new else existing["first_seen_at"],  # Preserve first_seen_at
                now,  # Always update last_seen_at
                is_active, is_important, raw_json
            ]
        )
        row = cur.fetchone()
        conn.commit()
        return row["id"], True


def upsert_position(
    conn: Any,
    satellite_id: str,
    layer_id: str,
    source_id: str,
    source_object_id: str,
    norad_cat_id: int | None,
    estimated_at: datetime,
    latitude: float,
    longitude: float,
    altitude_km: float | None,
    velocity_kms: float | None,
    heading_deg: float | None,
    orbit_class: str,
    object_type: str,
    category: str,
    visual_shape: str,
    visual_color: str,
    is_important: bool,
    source_age_seconds: int | None,
    computation_method: str,
    raw_position_json: dict[str, Any] | None,
) -> str:
    """Upsert latest position into space_satellite_positions_latest.
    
    Returns position ID.
    """
    raw_json = safe_json_dumps(raw_position_json) if raw_position_json else "{}"

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO space_satellite_positions_latest (
                satellite_id, layer_id, source_id, source_object_id, norad_cat_id,
                estimated_at, latitude, longitude, altitude_km,
                velocity_kms, heading_deg,
                orbit_class, object_type, category,
                visual_shape, visual_color, is_important,
                source_age_seconds, computation_method, raw_position_json
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            ON CONFLICT (satellite_id) DO UPDATE SET
                source_id = EXCLUDED.source_id,
                source_object_id = EXCLUDED.source_object_id,
                norad_cat_id = EXCLUDED.norad_cat_id,
                estimated_at = EXCLUDED.estimated_at,
                latitude = EXCLUDED.latitude,
                longitude = EXCLUDED.longitude,
                altitude_km = EXCLUDED.altitude_km,
                velocity_kms = EXCLUDED.velocity_kms,
                heading_deg = EXCLUDED.heading_deg,
                orbit_class = EXCLUDED.orbit_class,
                object_type = EXCLUDED.object_type,
                category = EXCLUDED.category,
                visual_shape = EXCLUDED.visual_shape,
                visual_color = EXCLUDED.visual_color,
                is_important = EXCLUDED.is_important,
                source_age_seconds = EXCLUDED.source_age_seconds,
                computation_method = EXCLUDED.computation_method,
                raw_position_json = EXCLUDED.raw_position_json,
                updated_at = NOW()
            RETURNING satellite_id
            """,
            [
                satellite_id, layer_id, source_id, source_object_id, norad_cat_id,
                estimated_at, latitude, longitude, altitude_km,
                velocity_kms, heading_deg,
                orbit_class, object_type, category,
                visual_shape, visual_color, is_important,
                source_age_seconds, computation_method, raw_json
            ]
        )
        row = cur.fetchone()
        conn.commit()
        return row["satellite_id"]


def get_satellite_count(conn: Any) -> int:
    """Get count of satellites in catalog."""
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) as cnt FROM space_satellites")
        return cur.fetchone()["cnt"]


def get_position_count(conn: Any) -> int:
    """Get count of positions in latest table."""
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) as cnt FROM space_satellite_positions_latest")
        return cur.fetchone()["cnt"]