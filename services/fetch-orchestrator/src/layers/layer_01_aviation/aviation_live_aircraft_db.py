"""Airplanes.live DB helper for aircraft persistence.

Provides DB operations for raw batches, latest aircraft, and observations.
"""

from __future__ import annotations

import json
import os
from datetime import datetime
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

LAYER_ID = "layer_01_aviation"


def connect_db(database_url: str = DEFAULT_DATABASE_URL) -> Any:
    import psycopg
    from psycopg.rows import dict_row
    return psycopg.connect(database_url, row_factory=dict_row)


def insert_raw_batch(
    conn: Any,
    source_id: str,
    endpoint: str,
    fetch_params: dict[str, Any],
    fetched_at: datetime,
    http_status: int | None = None,
    aircraft_count: int | None = None,
    source_now_ts: float | None = None,
    source_ctime_ts: float | None = None,
    source_ptime_ms: float | None = None,
    raw_sample: list | None = None,
    error_message: str | None = None,
) -> None:
    """Insert a raw batch record into aviation_aircraft_raw_batches."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO aviation_aircraft_raw_batches (
                source_id, layer_id, endpoint, fetch_params, fetched_at,
                http_status, aircraft_count, source_now_ts, source_ctime_ts,
                source_ptime_ms, raw_sample, error_message
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s
            )
            """,
            [
                source_id,
                LAYER_ID,
                endpoint,
                json.dumps(fetch_params),
                fetched_at,
                http_status,
                aircraft_count,
                source_now_ts,
                source_ctime_ts,
                source_ptime_ms,
                json.dumps(raw_sample) if raw_sample else None,
                error_message,
            ]
        )
        conn.commit()


def upsert_latest_aircraft(
    conn: Any,
    source_id: str,
    aircraft: dict[str, Any],
) -> None:
    """Upsert aircraft into aviation_aircraft_latest.
    
    Updates only when incoming observed_at is newer than existing.
    Preserves first_seen_at, updates last_seen_at.
    """
    source_object_id = aircraft.get("source_object_id")
    if not source_object_id:
        return

    lat = aircraft.get("lat")
    lon = aircraft.get("lon")
    geom = None
    if lat is not None and lon is not None:
        geom = f"SRID=4326;POINT({lon} {lat})"

    observed_at = aircraft.get("observed_at")
    received_at = aircraft.get("received_at", datetime.now())
    stale_after = aircraft.get("stale_after")

    raw_json = json.dumps(aircraft.get("raw_json")) if aircraft.get("raw_json") else None

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO aviation_aircraft_latest (
                source_id, source_object_id, layer_id,
                callsign, registration, aircraft_type,
                db_flags, is_military, is_interesting, is_pia, is_ladd,
                source_message_type,
                lat, lon, geom,
                altitude_baro_ft, altitude_geom_ft, on_ground,
                ground_speed_kt, track_deg, heading_mag_deg, heading_true_deg,
                vertical_rate_fpm, geom_rate_fpm,
                squawk, emergency,
                seen_seconds, seen_pos_seconds,
                observed_at, received_at, stale_after,
                first_seen_at, last_seen_at,
                raw_json
            ) VALUES (
                %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s,
                %s, %s, ST_GeomFromText(%s, 4326),
                %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s,
                %s, %s,
                %s, %s,
                %s, %s, %s,
                %s, %s,
                %s
            )
            ON CONFLICT (source_id, source_object_id) DO UPDATE SET
                callsign = EXCLUDED.callsign,
                registration = EXCLUDED.registration,
                aircraft_type = EXCLUDED.aircraft_type,
                db_flags = EXCLUDED.db_flags,
                is_military = EXCLUDED.is_military,
                is_interesting = EXCLUDED.is_interesting,
                is_pia = EXCLUDED.is_pia,
                is_ladd = EXCLUDED.is_ladd,
                source_message_type = EXCLUDED.source_message_type,
                lat = EXCLUDED.lat,
                lon = EXCLUDED.lon,
                geom = EXCLUDED.geom,
                altitude_baro_ft = EXCLUDED.altitude_baro_ft,
                altitude_geom_ft = EXCLUDED.altitude_geom_ft,
                on_ground = EXCLUDED.on_ground,
                ground_speed_kt = EXCLUDED.ground_speed_kt,
                track_deg = EXCLUDED.track_deg,
                heading_mag_deg = EXCLUDED.heading_mag_deg,
                heading_true_deg = EXCLUDED.heading_true_deg,
                vertical_rate_fpm = EXCLUDED.vertical_rate_fpm,
                geom_rate_fpm = EXCLUDED.geom_rate_fpm,
                squawk = EXCLUDED.squawk,
                emergency = EXCLUDED.emergency,
                seen_seconds = EXCLUDED.seen_seconds,
                seen_pos_seconds = EXCLUDED.seen_pos_seconds,
                observed_at = EXCLUDED.observed_at,
                received_at = EXCLUDED.received_at,
                stale_after = EXCLUDED.stale_after,
                last_seen_at = EXCLUDED.last_seen_at,
                raw_json = EXCLUDED.raw_json
            WHERE aviation_aircraft_latest.observed_at < EXCLUDED.observed_at
            """,
            [
                source_id,
                source_object_id,
                LAYER_ID,
                aircraft.get("callsign"),
                aircraft.get("registration"),
                aircraft.get("aircraft_type"),
                aircraft.get("db_flags"),
                aircraft.get("is_military", False),
                aircraft.get("is_interesting", False),
                aircraft.get("is_pia", False),
                aircraft.get("is_ladd", False),
                aircraft.get("source_message_type"),
                lat,
                lon,
                geom,
                aircraft.get("altitude_baro_ft"),
                aircraft.get("altitude_geom_ft"),
                aircraft.get("on_ground"),
                aircraft.get("ground_speed_kt"),
                aircraft.get("track_deg"),
                aircraft.get("heading_mag_deg"),
                aircraft.get("heading_true_deg"),
                aircraft.get("vertical_rate_fpm"),
                aircraft.get("geom_rate_fpm"),
                aircraft.get("squawk"),
                aircraft.get("emergency"),
                aircraft.get("seen_seconds"),
                aircraft.get("seen_pos_seconds"),
                observed_at,
                received_at,
                stale_after,
                received_at,
                received_at,
                raw_json,
            ]
        )
        conn.commit()


def insert_observation(
    conn: Any,
    source_id: str,
    aircraft: dict[str, Any],
) -> None:
    """Insert observation into aviation_aircraft_observations.
    
    Uses ON CONFLICT DO NOTHING for deduplication.
    """
    source_object_id = aircraft.get("source_object_id")
    if not source_object_id:
        return

    lat = aircraft.get("lat")
    lon = aircraft.get("lon")
    if lat is None or lon is None:
        return

    geom = f"SRID=4326;POINT({lon} {lat})"

    observed_at = aircraft.get("observed_at")
    received_at = aircraft.get("received_at", datetime.now())

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO aviation_aircraft_observations (
                source_id, source_object_id, layer_id,
                lat, lon, geom,
                altitude_baro_ft, altitude_geom_ft, on_ground,
                ground_speed_kt, track_deg, vertical_rate_fpm,
                callsign, squawk, emergency,
                is_military, is_pia, is_ladd,
                observed_at, received_at
            ) VALUES (
                %s, %s, %s,
                %s, %s, ST_GeomFromText(%s, 4326),
                %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s
            )
            ON CONFLICT DO NOTHING
            """,
            [
                source_id,
                source_object_id,
                LAYER_ID,
                lat,
                lon,
                geom,
                aircraft.get("altitude_baro_ft"),
                aircraft.get("altitude_geom_ft"),
                aircraft.get("on_ground"),
                aircraft.get("ground_speed_kt"),
                aircraft.get("track_deg"),
                aircraft.get("vertical_rate_fpm"),
                aircraft.get("callsign"),
                aircraft.get("squawk"),
                aircraft.get("emergency"),
                aircraft.get("is_military"),
                aircraft.get("is_pia"),
                aircraft.get("is_ladd"),
                observed_at,
                received_at,
            ]
        )
        conn.commit()


# WO-080A: Live Aircraft Snapshot Publisher

SNAPSHOT_NOTIFY_CHANNEL = "aviation_live_aircraft_snapshot"


def upsert_live_snapshot(
    conn: Any,
    source_id: str,
    source_name: str,
    snapshot_id: str,
    snapshot_time: datetime,
    aircraft_count: int,
    valid_position_count: int,
    aircraft_json: dict[str, Any],
    metadata: dict[str, Any],
) -> None:
    """Upsert live aircraft snapshot for WebSocket/API consumption.
    
    Only one latest row per source_id is stored.
    Publishes NOTIFY after successful write.
    """
    now = datetime.now()
    aircraft_json_str = json.dumps(aircraft_json)
    metadata_str = json.dumps(metadata)
    
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO aviation_aircraft_live_snapshots (
                source_id,
                source_name,
                snapshot_id,
                snapshot_time,
                received_at,
                aircraft_count,
                valid_position_count,
                aircraft_json,
                metadata,
                updated_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            ON CONFLICT (source_id) DO UPDATE SET
                source_name = EXCLUDED.source_name,
                snapshot_id = EXCLUDED.snapshot_id,
                snapshot_time = EXCLUDED.snapshot_time,
                received_at = EXCLUDED.received_at,
                aircraft_count = EXCLUDED.aircraft_count,
                valid_position_count = EXCLUDED.valid_position_count,
                aircraft_json = EXCLUDED.aircraft_json,
                metadata = EXCLUDED.metadata,
                updated_at = EXCLUDED.updated_at
            """,
            [
                source_id,
                source_name,
                snapshot_id,
                snapshot_time,
                now,
                aircraft_count,
                valid_position_count,
                aircraft_json_str,
                metadata_str,
                now,
            ]
        )
        conn.commit()
    
    # Publish NOTIFY after successful write
    notify_payload = json.dumps({
        "sourceId": source_id,
        "snapshotId": snapshot_id,
        "snapshotTime": snapshot_time.isoformat() if snapshot_time else None,
        "aircraftCount": aircraft_count,
        "validPositionCount": valid_position_count,
    })
    
    with conn.cursor() as cur:
        cur.execute(
            "SELECT pg_notify(%s, %s)",
            [SNAPSHOT_NOTIFY_CHANNEL, notify_payload]
        )
        conn.commit()