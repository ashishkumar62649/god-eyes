"""Earth Events DB operations for WO-072.

Provides database operations for persisting earthquake events
to earth_events_latest and earth_events_history tables.
"""

from __future__ import annotations

import json
import os
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

LAYER_ID = "layer_03_earth_events"
SOURCE_ID = "usgs_earthquakes"


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


def get_existing_event(
    conn: Any,
    source_object_id: str
) -> dict[str, Any] | None:
    """Get existing event from latest table by source_object_id."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, source_id, source_object_id, updated_at
            FROM earth_events_latest
            WHERE source_id = %s AND source_object_id = %s
            """,
            [SOURCE_ID, source_object_id]
        )
        row = cur.fetchone()
        return dict(row) if row else None


def upsert_earth_event(
    conn: Any,
    layer_id: str,
    source_id: str,
    source_object_id: str,
    event_type: str,
    magnitude: float | None,
    magnitude_type: str | None,
    depth_km: float | None,
    place: str | None,
    alert_level: str | None,
    significance: int | None,
    tsunami: bool,
    geometry_wkt: str,
    source_url: str | None,
    observed_at: datetime,
    updated_at: datetime,
    fetched_at: datetime,
    properties_json: dict[str, Any],
) -> tuple[str, bool]:
    """Upsert earth event into latest table.
    
    Returns (event_id, is_new_or_updated) tuple.
    Does not overwrite newer records with older updated_at.
    """
    now = datetime.now(timezone.utc)
    props_json = safe_json_dumps(properties_json)

    # Check existing record
    existing = get_existing_event(conn, source_object_id)
    is_new = existing is None

    if not is_new:
        # Compare updated_at - don't overwrite if incoming is older
        existing_updated = existing.get("updated_at")
        if existing_updated and updated_at < existing_updated:
            return existing["id"], False

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO earth_events_latest (
                layer_id, source_id, source_object_id, event_type,
                magnitude, magnitude_type, depth_km, place, alert_level,
                significance, tsunami, geometry, source_url,
                observed_at, updated_at, fetched_at, properties_json
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                ST_GeomFromText(%s, 4326), %s, %s, %s, %s, %s
            )
            ON CONFLICT (source_id, source_object_id) DO UPDATE SET
                event_type = EXCLUDED.event_type,
                magnitude = EXCLUDED.magnitude,
                magnitude_type = EXCLUDED.magnitude_type,
                depth_km = EXCLUDED.depth_km,
                place = EXCLUDED.place,
                alert_level = EXCLUDED.alert_level,
                significance = EXCLUDED.significance,
                tsunami = EXCLUDED.tsunami,
                geometry = EXCLUDED.geometry,
                source_url = EXCLUDED.source_url,
                observed_at = EXCLUDED.observed_at,
                updated_at = NOW(),
                fetched_at = EXCLUDED.fetched_at,
                properties_json = EXCLUDED.properties_json
            RETURNING id
            """,
            [
                layer_id, source_id, source_object_id, event_type,
                magnitude, magnitude_type, depth_km, place, alert_level,
                significance, tsunami, geometry_wkt, source_url,
                observed_at, updated_at, fetched_at, props_json
            ]
        )
        row = cur.fetchone()
        conn.commit()
        return row["id"], True


def append_to_history(
    conn: Any,
    layer_id: str,
    source_id: str,
    source_object_id: str,
    event_type: str,
    magnitude: float | None,
    depth_km: float | None,
    place: str | None,
    alert_level: str | None,
    geometry_wkt: str,
    source_url: str | None,
    observed_at: datetime,
    updated_at: datetime,
    fetched_at: datetime,
    properties_json: dict[str, Any],
) -> str:
    """Append a record to earth_events_history table."""
    now = datetime.now(timezone.utc)
    props_json = safe_json_dumps(properties_json)

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO earth_events_history (
                layer_id, source_id, source_object_id, event_type,
                magnitude, depth_km, place, alert_level,
                geometry, source_url, observed_at, updated_at, fetched_at, properties_json
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s,
                ST_GeomFromText(%s, 4326), %s, %s, %s, %s, %s
            )
            RETURNING id
            """,
            [
                layer_id, source_id, source_object_id, event_type,
                magnitude, depth_km, place, alert_level,
                geometry_wkt, source_url, observed_at, updated_at, fetched_at, props_json
            ]
        )
        row = cur.fetchone()
        conn.commit()
        return row["id"]


def get_latest_count(conn: Any) -> int:
    """Get count of records in earth_events_latest."""
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) as cnt FROM earth_events_latest")
        return cur.fetchone()["cnt"]


def get_history_count(conn: Any) -> int:
    """Get count of records in earth_events_history."""
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) as cnt FROM earth_events_history")
        return cur.fetchone()["cnt"]