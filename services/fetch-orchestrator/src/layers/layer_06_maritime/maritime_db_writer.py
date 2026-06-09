"""Maritime DB Writer

Handles database write operations for maritime layer: sources, vessels, positions.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
import sys

if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# Default for local dev - always use env var in production
DEFAULT_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://god_eyes:god_eyes_dev_password@localhost:5432/god_eyes_dev"
)

LAYER_ID = "layer_06_maritime"
SOURCE_ID = "aisstream"


def connect_db(database_url: str = DEFAULT_DATABASE_URL) -> Any:
    """Connect to PostgreSQL database."""
    import psycopg
    from psycopg.rows import dict_row
    return psycopg.connect(database_url, row_factory=dict_row)


def ensure_source_exists(conn: Any, source_id: str = SOURCE_ID) -> None:
    """Ensure maritime_sources has an entry for AISStream."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO maritime_sources (
                source_id, layer_id, source_family, source_type, display_name, coverage, is_active, config_json
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s
            )
            ON CONFLICT (source_id) DO NOTHING
            """,
            [
                source_id,
                LAYER_ID,
                "ais",
                "websocket",
                "AISStream",
                "global",
                True,
                json.dumps({"subscription": "global"})
            ]
        )
        conn.commit()


def insert_fetch_run(
    conn: Any,
    run_id: str,
    run_mode: str,
    started_at: datetime,
    total_messages: int = 0,
    position_messages: int = 0,
    static_messages: int = 0,
    unique_mmsi_count: int = 0,
    raw_path: str | None = None,
    status: str = "running",
) -> str | None:
    """Insert a fetch run record, return run UUID."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO maritime_fetch_runs (
                source_id, layer_id, run_id, run_mode, started_at, total_messages,
                position_messages, static_messages, unique_mmsi_count, raw_path, status
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            ON CONFLICT (source_id, run_id) DO UPDATE
            SET status = EXCLUDED.status, total_messages = EXCLUDED.total_messages
            RETURNING id
            """,
            [
                SOURCE_ID,
                LAYER_ID,
                run_id,
                run_mode,
                started_at,
                total_messages,
                position_messages,
                static_messages,
                unique_mmsi_count,
                raw_path,
                status,
            ]
        )
        row = cur.fetchone()
        conn.commit()
        return row["id"] if row else None


def update_fetch_run(
    conn: Any,
    run_id: str,
    ended_at: datetime,
    duration_seconds: float,
    total_messages: int,
    position_messages: int,
    static_messages: int,
    unique_mmsi_count: int,
    status: str = "completed",
) -> None:
    """Update fetch run with completion stats."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE maritime_fetch_runs
            SET ended_at = %s, duration_seconds = %s, total_messages = %s,
                position_messages = %s, static_messages = %s, unique_mmsi_count = %s,
                status = %s
            WHERE source_id = %s AND run_id = %s
            """,
            [
                ended_at,
                duration_seconds,
                total_messages,
                position_messages,
                static_messages,
                unique_mmsi_count,
                status,
                SOURCE_ID,
                run_id,
            ]
        )
        conn.commit()


def upsert_vessel(
    conn: Any,
    mmsi: int,
    source_id: str = SOURCE_ID,
    source_object_id: str | None = None,
    imo: int | None = None,
    callsign: str | None = None,
    vessel_name: str | None = None,
    vessel_type_code: int | None = None,
    vessel_type: str | None = None,
    destination: str | None = None,
    eta_month: int | None = None,
    eta_day: int | None = None,
    eta_hour: int | None = None,
    eta_minute: int | None = None,
    eta_display: str | None = None,
    draught_meters: float | None = None,
    dimension_a: float | None = None,
    dimension_b: float | None = None,
    dimension_c: float | None = None,
    dimension_d: float | None = None,
    length_meters: float | None = None,
    width_meters: float | None = None,
    last_position_at: datetime | None = None,
    last_received_at: datetime | None = None,
    raw_evidence_uri: str | None = None,
    provider_metadata: dict | None = None,
) -> None:
    """Upsert a vessel record."""
    if source_object_id is None:
        source_object_id = str(mmsi)
    dedupe_key = f"{source_id}:{mmsi}"
    
    # Clamp ETA values to valid ranges (DB constraints)
    if eta_month is not None and not (1 <= eta_month <= 12):
        eta_month = None
    if eta_day is not None and not (1 <= eta_day <= 31):
        eta_day = None
    if eta_hour is not None and not (0 <= eta_hour <= 23):
        eta_hour = None
    if eta_minute is not None and not (0 <= eta_minute <= 59):
        eta_minute = None

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO maritime_vessels (
                source_id, layer_id, source_family, source_object_id, mmsi, dedupe_key,
                imo, callsign, vessel_name, vessel_type_code, vessel_type,
                destination, eta_month, eta_day, eta_hour, eta_minute, eta_display,
                draught_meters, dimension_a, dimension_b, dimension_c, dimension_d,
                length_meters, width_meters, last_position_at, last_received_at,
                raw_evidence_uri, provider_metadata
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s
            )
            ON CONFLICT (source_id, mmsi) DO UPDATE SET
                imo = COALESCE(EXCLUDED.imo, maritime_vessels.imo),
                callsign = COALESCE(EXCLUDED.callsign, maritime_vessels.callsign),
                vessel_name = COALESCE(EXCLUDED.vessel_name, maritime_vessels.vessel_name),
                vessel_type_code = COALESCE(EXCLUDED.vessel_type_code, maritime_vessels.vessel_type_code),
                vessel_type = COALESCE(EXCLUDED.vessel_type, maritime_vessels.vessel_type),
                destination = COALESCE(EXCLUDED.destination, maritime_vessels.destination),
                eta_month = COALESCE(EXCLUDED.eta_month, maritime_vessels.eta_month),
                eta_day = COALESCE(EXCLUDED.eta_day, maritime_vessels.eta_day),
                eta_hour = COALESCE(EXCLUDED.eta_hour, maritime_vessels.eta_hour),
                eta_minute = COALESCE(EXCLUDED.eta_minute, maritime_vessels.eta_minute),
                eta_display = COALESCE(EXCLUDED.eta_display, maritime_vessels.eta_display),
                draught_meters = COALESCE(EXCLUDED.draught_meters, maritime_vessels.draught_meters),
                dimension_a = COALESCE(EXCLUDED.dimension_a, maritime_vessels.dimension_a),
                dimension_b = COALESCE(EXCLUDED.dimension_b, maritime_vessels.dimension_b),
                dimension_c = COALESCE(EXCLUDED.dimension_c, maritime_vessels.dimension_c),
                dimension_d = COALESCE(EXCLUDED.dimension_d, maritime_vessels.dimension_d),
                length_meters = COALESCE(EXCLUDED.length_meters, maritime_vessels.length_meters),
                width_meters = COALESCE(EXCLUDED.width_meters, maritime_vessels.width_meters),
                last_position_at = COALESCE(EXCLUDED.last_position_at, maritime_vessels.last_position_at),
                last_received_at = GREATEST(EXCLUDED.last_received_at, maritime_vessels.last_received_at),
                raw_evidence_uri = COALESCE(EXCLUDED.raw_evidence_uri, maritime_vessels.raw_evidence_uri),
                provider_metadata = maritime_vessels.provider_metadata || EXCLUDED.provider_metadata,
                updated_at = NOW()
            """,
            [
                source_id,
                LAYER_ID,
                "ais",
                source_object_id,
                mmsi,
                dedupe_key,
                imo,
                callsign,
                vessel_name,
                vessel_type_code,
                vessel_type,
                destination,
                eta_month,
                eta_day,
                eta_hour,
                eta_minute,
                eta_display,
                draught_meters,
                dimension_a,
                dimension_b,
                dimension_c,
                dimension_d,
                length_meters,
                width_meters,
                last_position_at,
                last_received_at,
                raw_evidence_uri,
                json.dumps(provider_metadata or {}),
            ]
        )
        conn.commit()


def upsert_position_latest(
    conn: Any,
    mmsi: int,
    latitude: float,
    longitude: float,
    source_id: str = SOURCE_ID,
    source_object_id: str | None = None,
    speed_over_ground: float | None = None,
    course_over_ground: float | None = None,
    true_heading: int | None = None,
    navigation_status: int | None = None,
    navigation_status_text: str | None = None,
    position_accuracy: bool | None = None,
    ais_timestamp_second: int | None = None,
    metadata_time_utc: str | None = None,
    received_at: datetime | None = None,
    raw_evidence_uri: str | None = None,
    provider_metadata: dict | None = None,
) -> None:
    """Upsert latest position for a vessel."""
    if source_object_id is None:
        source_object_id = str(mmsi)
    dedupe_key = f"{source_id}:{mmsi}"

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO maritime_positions_latest (
                source_id, layer_id, source_family, source_object_id, mmsi, dedupe_key,
                latitude, longitude, speed_over_ground, course_over_ground,
                true_heading, navigation_status, navigation_status_text,
                position_accuracy, ais_timestamp_second, metadata_time_utc,
                received_at, raw_evidence_uri, provider_metadata
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s
            )
            ON CONFLICT (source_id, mmsi) DO UPDATE SET
                latitude = EXCLUDED.latitude,
                longitude = EXCLUDED.longitude,
                speed_over_ground = EXCLUDED.speed_over_ground,
                course_over_ground = EXCLUDED.course_over_ground,
                true_heading = EXCLUDED.true_heading,
                navigation_status = EXCLUDED.navigation_status,
                navigation_status_text = EXCLUDED.navigation_status_text,
                position_accuracy = EXCLUDED.position_accuracy,
                ais_timestamp_second = EXCLUDED.ais_timestamp_second,
                metadata_time_utc = EXCLUDED.metadata_time_utc,
                received_at = EXCLUDED.received_at,
                raw_evidence_uri = EXCLUDED.raw_evidence_uri,
                provider_metadata = maritime_positions_latest.provider_metadata || EXCLUDED.provider_metadata,
                updated_at = NOW()
            """,
            [
                source_id,
                LAYER_ID,
                "ais",
                source_object_id,
                mmsi,
                dedupe_key,
                latitude,
                longitude,
                speed_over_ground,
                course_over_ground,
                true_heading,
                navigation_status,
                navigation_status_text,
                position_accuracy,
                ais_timestamp_second,
                metadata_time_utc,
                received_at,
                raw_evidence_uri,
                json.dumps(provider_metadata or {}),
            ]
        )
        conn.commit()


def insert_position_history(
    conn: Any,
    mmsi: int,
    latitude: float,
    longitude: float,
    source_id: str = SOURCE_ID,
    source_object_id: str | None = None,
    speed_over_ground: float | None = None,
    course_over_ground: float | None = None,
    true_heading: int | None = None,
    navigation_status: int | None = None,
    ais_timestamp_second: int | None = None,
    metadata_time_utc: str | None = None,
    received_at: datetime | None = None,
    raw_evidence_uri: str | None = None,
) -> None:
    """Insert a position history record."""
    if source_object_id is None:
        source_object_id = str(mmsi)

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO maritime_position_history (
                source_id, layer_id, source_family, source_object_id, mmsi,
                latitude, longitude, speed_over_ground, course_over_ground,
                true_heading, navigation_status, ais_timestamp_second,
                metadata_time_utc, received_at, raw_evidence_uri
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s
            )
            """,
            [
                source_id,
                LAYER_ID,
                "ais",
                source_object_id,
                mmsi,
                latitude,
                longitude,
                speed_over_ground,
                course_over_ground,
                true_heading,
                navigation_status,
                ais_timestamp_second,
                metadata_time_utc,
                received_at,
                raw_evidence_uri,
            ]
        )
        conn.commit()


def insert_raw_message_ref(
    conn: Any,
    message_type: str,
    raw_evidence_uri: str,
    received_at: datetime,
    fetch_run_id: Any = None,
    mmsi: int | None = None,
    source_object_id: str | None = None,
    provider_metadata: dict | None = None,
) -> None:
    """Insert a raw message reference for audit trail."""
    if source_object_id is None and mmsi is not None:
        source_object_id = str(mmsi)

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO maritime_raw_message_refs (
                source_id, layer_id, source_family, fetch_run_id,
                source_object_id, mmsi, message_type, raw_evidence_uri,
                received_at, provider_metadata
            ) VALUES (
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s
            )
            """,
            [
                SOURCE_ID,
                LAYER_ID,
                "ais",
                fetch_run_id,
                source_object_id,
                mmsi,
                message_type,
                raw_evidence_uri,
                received_at,
                json.dumps(provider_metadata or {}),
            ]
        )
        conn.commit()


def ensure_minimal_vessel_for_position(
    conn: Any,
    mmsi: int,
    source_id: str = SOURCE_ID,
    raw_evidence_uri: str | None = None,
    received_at: datetime | None = None,
) -> None:
    """Ensure a minimal vessel row exists when position arrives without static data."""
    source_object_id = str(mmsi)
    dedupe_key = f"{source_id}:{mmsi}"

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO maritime_vessels (
                source_id, layer_id, source_family, source_object_id, mmsi, dedupe_key,
                last_received_at, raw_evidence_uri
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s
            )
            ON CONFLICT (source_id, mmsi) DO UPDATE SET
                last_received_at = GREATEST(EXCLUDED.last_received_at, maritime_vessels.last_received_at),
                raw_evidence_uri = COALESCE(EXCLUDED.raw_evidence_uri, maritime_vessels.raw_evidence_uri)
            """,
            [
                source_id,
                LAYER_ID,
                "ais",
                source_object_id,
                mmsi,
                dedupe_key,
                received_at,
                raw_evidence_uri,
            ]
        )
        conn.commit()