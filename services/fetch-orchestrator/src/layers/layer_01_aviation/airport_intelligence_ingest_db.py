"""Airport Intelligence Ingest Worker DB helper.

This module provides DB operations for persisting airport intelligence data.

Tables written:
- airport_source_links (upsert)
- airport_intelligence_modules (upsert)
- airport_derived_intelligence (upsert)
- airport_capacity_profiles (upsert, conditional)
- airport_traffic_metrics (upsert, conditional)

Tables read:
- aviation_airports (identity resolution)
- airport_public_profiles (existing profile cache)
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any
from uuid import UUID

REPO_ROOT = Path(__file__).resolve().parents[5]
import sys

if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

DEFAULT_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://god_eyes:god_eyes_dev_password@localhost:5432/god_eyes_dev"
)

LAYER_ID = "layer_01_aviation"
DEFAULT_SOURCE_ID = "airport_intelligence_ingest"


def safe_json_dumps(data: Any) -> str:
    """Serialize data to JSON, handling UUID, datetime, date, Decimal, etc."""
    def serialize_value(obj: Any) -> Any:
        if isinstance(obj, UUID):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return str(obj)
        if isinstance(obj, bytes):
            return obj.decode("utf-8", errors="replace")
        if isinstance(obj, set):
            return list(obj)
        if isinstance(obj, tuple):
            return list(obj)
        if isinstance(obj, dict):
            return {k: serialize_value(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [serialize_value(item) for item in obj]
        if hasattr(obj, "__dict__"):
            return serialize_value(obj.__dict__)
        return obj
    return json.dumps(serialize_value(data))


def connect_db(database_url: str = DEFAULT_DATABASE_URL) -> Any:
    import psycopg
    from psycopg.rows import dict_row
    return psycopg.connect(database_url, row_factory=dict_row)


def resolve_airport_identity(conn: Any, airport_id: str) -> dict[str, Any] | None:
    """Resolve airport identity from aviation_airports table."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, source_id, source_airport_id, ident, iata_code,
                   name, iso_country, municipality, latitude_deg, longitude_deg,
                   wikipedia_link, elevation_ft, scheduled_service,
                   gps_code, local_code, home_link
            FROM aviation_airports
            WHERE id = %s
            """,
            [airport_id]
        )
        row = cur.fetchone()
        return dict(row) if row else None


def resolve_airport_by_ident(conn: Any, airport_ident: str) -> dict[str, Any] | None:
    """Resolve airport by ICAO code."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, source_id, source_airport_id, ident, iata_code,
                   name, iso_country, municipality, latitude_deg, longitude_deg,
                   wikipedia_link, elevation_ft, scheduled_service
            FROM aviation_airports
            WHERE ident = %s
            LIMIT 1
            """,
            [airport_ident]
        )
        row = cur.fetchone()
        return dict(row) if row else None


def get_existing_public_profile(conn: Any, airport_id: str) -> dict[str, Any] | None:
    """Get existing airport_public_profiles record for an airport."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, airport_id, layer_id, source_id, source_airport_id,
                   airport_ident, profile_status, cache_state,
                   fetched_at, profile_payload, profile_summary
            FROM airport_public_profiles
            WHERE airport_id = %s
            LIMIT 1
            """,
            [airport_id]
        )
        row = cur.fetchone()
        return dict(row) if row else None


def get_runway_data(conn: Any, airport_ident: str) -> list[dict[str, Any]]:
    """Get runway data for an airport from aviation_runways table.

    Falls back to empty list if table doesn't exist or query fails.
    """
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT airport_ident, length_ft, width_ft, surface, lighted, closed,
                       le_latitude_deg, le_longitude_deg, he_latitude_deg, he_longitude_deg
                FROM aviation_runways
                WHERE airport_ident = %s
                ORDER BY length_ft DESC
                """,
                [airport_ident]
            )
            rows = cur.fetchall()
            return [dict(row) for row in rows]
    except Exception:
        return []


def upsert_source_link(
    conn: Any,
    airport_id: UUID | str,
    source_type: str,
    source_name: str,
    source_url: str | None = None,
    source_entity_id: str | None = None,
    source_license: str | None = None,
    source_license_url: str | None = None,
    attribution_text: str | None = None,
    module_key: str | None = None,
    confidence_label: str | None = None,
    confidence_score: float | None = None,
    is_primary: bool = False,
    metadata: dict[str, Any] | None = None,
) -> UUID:
    """Upsert an airport source link.

    Uses INSERT with ON CONFLICT DO NOTHING, then UPDATE to refresh values.
    This works with the partial unique indexes in the schema.
    """
    now = datetime.now(timezone.utc)
    metadata_json = safe_json_dumps(metadata) if metadata else None

    with conn.cursor() as cur:
        cur.execute("SAVEPOINT before_insert")
        try:
            cur.execute(
                """
                INSERT INTO airport_source_links (
                    airport_id, module_key, source_type, source_name,
                    source_url, source_entity_id, source_license, source_license_url,
                    attribution_text, retrieved_at, last_checked_at,
                    confidence_label, confidence_score, is_primary, metadata
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                ON CONFLICT DO NOTHING
                """,
                [
                    airport_id,
                    module_key,
                    source_type,
                    source_name,
                    source_url,
                    source_entity_id,
                    source_license,
                    source_license_url,
                    attribution_text,
                    now,
                    now,
                    confidence_label,
                    confidence_score,
                    is_primary,
                    metadata_json,
                ]
            )
            cur.execute("RELEASE SAVEPOINT before_insert")
        except Exception:
            cur.execute("ROLLBACK TO SAVEPOINT before_insert")
            cur.execute("RELEASE SAVEPOINT before_insert")

        cur.execute(
            """
            UPDATE airport_source_links SET
                source_url = COALESCE(%s, source_url),
                source_name = COALESCE(%s, source_name),
                attribution_text = COALESCE(%s, attribution_text),
                last_checked_at = %s,
                confidence_label = COALESCE(%s, confidence_label),
                confidence_score = COALESCE(%s, confidence_score),
                is_primary = %s,
                metadata = COALESCE(%s, metadata),
                updated_at = NOW()
            WHERE airport_id = %s
              AND source_type = %s
              AND source_entity_id IS NOT DISTINCT FROM %s
            RETURNING id
            """,
            [
                source_url,
                source_name,
                attribution_text,
                now,
                confidence_label,
                confidence_score,
                is_primary,
                metadata_json,
                airport_id,
                source_type,
                source_entity_id,
            ]
        )
        row = cur.fetchone()
        if row:
            conn.commit()
            return row["id"]

        cur.execute(
            """
            SELECT id FROM airport_source_links
            WHERE airport_id = %s AND source_type = %s
              AND source_entity_id IS NOT DISTINCT FROM %s
            LIMIT 1
            """,
            [airport_id, source_type, source_entity_id]
        )
        row = cur.fetchone()
        conn.commit()
        return row["id"]


def upsert_intelligence_module(
    conn: Any,
    airport_id: UUID | str,
    module_key: str,
    module_status: str,
    cache_state: str = "fresh",
    cache_ttl_seconds: int = 2592000,
    confidence_label: str | None = None,
    confidence_score: float | None = None,
    data_payload: dict[str, Any] | None = None,
    summary_payload: dict[str, Any] | None = None,
    source_summary: dict[str, Any] | None = None,
    error_code: str | None = None,
    error_message: str | None = None,
) -> UUID:
    """Upsert an airport intelligence module."""
    now = datetime.now(timezone.utc)
    stale_at = datetime.fromtimestamp(now.timestamp() + cache_ttl_seconds, tz=timezone.utc)
    expires_at = datetime.fromtimestamp(now.timestamp() + int(cache_ttl_seconds * 1.5), tz=timezone.utc)

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO airport_intelligence_modules (
                airport_id, module_key, module_status, cache_state,
                cache_ttl_seconds, confidence_label, confidence_score,
                data_payload, summary_payload, source_summary,
                error_code, error_message,
                fetched_at, stale_at, expires_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            ON CONFLICT (airport_id, module_key) DO UPDATE SET
                module_status = EXCLUDED.module_status,
                cache_state = EXCLUDED.cache_state,
                confidence_label = EXCLUDED.confidence_label,
                confidence_score = EXCLUDED.confidence_score,
                data_payload = EXCLUDED.data_payload,
                summary_payload = EXCLUDED.summary_payload,
                source_summary = EXCLUDED.source_summary,
                error_code = EXCLUDED.error_code,
                error_message = EXCLUDED.error_message,
                fetched_at = EXCLUDED.fetched_at,
                stale_at = EXCLUDED.stale_at,
                expires_at = EXCLUDED.expires_at,
                updated_at = NOW()
            RETURNING id
            """,
            [
                airport_id,
                module_key,
                module_status,
                cache_state,
                cache_ttl_seconds,
                confidence_label,
                confidence_score,
                safe_json_dumps(data_payload) if data_payload else None,
                safe_json_dumps(summary_payload) if summary_payload else None,
                safe_json_dumps(source_summary) if source_summary else None,
                error_code,
                error_message,
                now,
                stale_at,
                expires_at,
            ]
        )
        row = cur.fetchone()
        conn.commit()
        return row["id"]


def upsert_derived_intelligence(
    conn: Any,
    airport_id: UUID | str,
    module_id: UUID | str | None = None,
    capacity_profile_id: UUID | str | None = None,
    intelligence_status: str = "no_data",
    airport_class: str | None = None,
    traffic_scale: str | None = None,
    capacity_scale: str | None = None,
    runway_capability: str | None = None,
    operating_role: str | None = None,
    capability_tags: list[str] | None = None,
    risk_flags: list[str] | None = None,
    source_flags: list[str] | None = None,
    confidence_score: float | None = None,
    longest_runway_ft: int | None = None,
    runway_count: int | None = None,
    intelligence_summary: str | None = None,
    capability_summary: str | None = None,
    traffic_summary: str | None = None,
    capacity_summary: str | None = None,
    source_summary: dict[str, Any] | None = None,
    input_snapshot: dict[str, Any] | None = None,
    data_payload: dict[str, Any] | None = None,
) -> UUID:
    """Upsert airport derived intelligence."""
    now = datetime.now(timezone.utc)
    stale_at = datetime.fromtimestamp(now.timestamp() + 86400 * 30, tz=timezone.utc)
    expires_at = datetime.fromtimestamp(now.timestamp() + 86400 * 45, tz=timezone.utc)

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO airport_derived_intelligence (
                airport_id, module_id, capacity_profile_id,
                intelligence_status, airport_class, traffic_scale, capacity_scale,
                runway_capability, operating_role,
                capability_tags, risk_flags, source_flags,
                confidence_score, longest_runway_ft, runway_count,
                intelligence_summary, capability_summary, traffic_summary, capacity_summary,
                source_summary, input_snapshot, data_payload,
                generated_at, stale_at, expires_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            ON CONFLICT (airport_id) DO UPDATE SET
                module_id = EXCLUDED.module_id,
                capacity_profile_id = EXCLUDED.capacity_profile_id,
                intelligence_status = EXCLUDED.intelligence_status,
                airport_class = EXCLUDED.airport_class,
                traffic_scale = EXCLUDED.traffic_scale,
                capacity_scale = EXCLUDED.capacity_scale,
                runway_capability = EXCLUDED.runway_capability,
                operating_role = EXCLUDED.operating_role,
                capability_tags = EXCLUDED.capability_tags,
                risk_flags = EXCLUDED.risk_flags,
                source_flags = EXCLUDED.source_flags,
                confidence_score = EXCLUDED.confidence_score,
                longest_runway_ft = EXCLUDED.longest_runway_ft,
                runway_count = EXCLUDED.runway_count,
                intelligence_summary = EXCLUDED.intelligence_summary,
                capability_summary = EXCLUDED.capability_summary,
                traffic_summary = EXCLUDED.traffic_summary,
                capacity_summary = EXCLUDED.capacity_summary,
                source_summary = EXCLUDED.source_summary,
                input_snapshot = EXCLUDED.input_snapshot,
                data_payload = EXCLUDED.data_payload,
                generated_at = EXCLUDED.generated_at,
                stale_at = EXCLUDED.stale_at,
                expires_at = EXCLUDED.expires_at,
                updated_at = NOW()
            RETURNING id
            """,
            [
                airport_id,
                module_id,
                capacity_profile_id,
                intelligence_status,
                airport_class,
                traffic_scale,
                capacity_scale,
                runway_capability,
                operating_role,
                capability_tags or [],
                risk_flags or [],
                source_flags or [],
                confidence_score,
                longest_runway_ft,
                runway_count,
                intelligence_summary,
                capability_summary,
                traffic_summary,
                capacity_summary,
                safe_json_dumps(source_summary) if source_summary else None,
                safe_json_dumps(input_snapshot) if input_snapshot else None,
                safe_json_dumps(data_payload) if data_payload else None,
                now,
                stale_at,
                expires_at,
            ]
        )
        row = cur.fetchone()
        conn.commit()
        return row["id"]


def upsert_capacity_profile(
    conn: Any,
    airport_id: UUID | str,
    module_id: UUID | str | None = None,
    primary_source_link_id: UUID | str | None = None,
    annual_passenger_capacity: int | None = None,
    capacity_status: str = "no_data",
    capacity_basis: str | None = None,
    confidence_label: str | None = None,
    confidence_score: float | None = None,
    capacity_year: int | None = None,
    notes: str | None = None,
    data_payload: dict[str, Any] | None = None,
    source_summary: dict[str, Any] | None = None,
) -> UUID | None:
    """Upsert airport capacity profile. Returns None if no source-backed capacity data."""
    if annual_passenger_capacity is None and capacity_status in ("ok", "stale"):
        return None

    now = datetime.now(timezone.utc)
    stale_at = datetime.fromtimestamp(now.timestamp() + 86400 * 30, tz=timezone.utc)
    expires_at = datetime.fromtimestamp(now.timestamp() + 86400 * 45, tz=timezone.utc)

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO airport_capacity_profiles (
                airport_id, module_id, primary_source_link_id,
                annual_passenger_capacity, capacity_status, capacity_basis,
                confidence_label, confidence_score, capacity_year, notes,
                data_payload, source_summary,
                retrieved_at, fetched_at, stale_at, expires_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            ON CONFLICT (airport_id) DO UPDATE SET
                module_id = EXCLUDED.module_id,
                primary_source_link_id = EXCLUDED.primary_source_link_id,
                annual_passenger_capacity = EXCLUDED.annual_passenger_capacity,
                capacity_status = EXCLUDED.capacity_status,
                capacity_basis = EXCLUDED.capacity_basis,
                confidence_label = EXCLUDED.confidence_label,
                confidence_score = EXCLUDED.confidence_score,
                capacity_year = EXCLUDED.capacity_year,
                notes = EXCLUDED.notes,
                data_payload = EXCLUDED.data_payload,
                source_summary = EXCLUDED.source_summary,
                retrieved_at = EXCLUDED.retrieved_at,
                fetched_at = EXCLUDED.fetched_at,
                stale_at = EXCLUDED.stale_at,
                expires_at = EXCLUDED.expires_at,
                updated_at = NOW()
            RETURNING id
            """,
            [
                airport_id,
                module_id,
                primary_source_link_id,
                annual_passenger_capacity,
                capacity_status,
                capacity_basis,
                confidence_label,
                confidence_score,
                capacity_year,
                notes,
                safe_json_dumps(data_payload) if data_payload else None,
                safe_json_dumps(source_summary) if source_summary else None,
                now,
                now,
                stale_at,
                expires_at,
            ]
        )
        row = cur.fetchone()
        conn.commit()
        return row["id"]


def upsert_traffic_metric(
    conn: Any,
    airport_id: UUID | str,
    metric_type: str,
    period_year: int,
    metric_value: float,
    metric_unit: str,
    traffic_status: str = "ok",
    module_id: UUID | str | None = None,
    primary_source_link_id: UUID | str | None = None,
    confidence_label: str | None = None,
    confidence_score: float | None = None,
    notes: str | None = None,
    data_payload: dict[str, Any] | None = None,
    source_summary: dict[str, Any] | None = None,
) -> UUID | None:
    """Upsert airport traffic metric. Returns None if year not provided."""
    if period_year is None:
        return None

    now = datetime.now(timezone.utc)
    stale_at = datetime.fromtimestamp(now.timestamp() + 86400 * 30, tz=timezone.utc)
    expires_at = datetime.fromtimestamp(now.timestamp() + 86400 * 45, tz=timezone.utc)

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO airport_traffic_metrics (
                airport_id, module_id, primary_source_link_id,
                metric_type, period_type, period_year,
                metric_value, metric_unit, traffic_status,
                confidence_label, confidence_score, notes,
                data_payload, source_summary,
                retrieved_at, fetched_at, stale_at, expires_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            ON CONFLICT (airport_id, metric_type, period_type, period_year)
            DO UPDATE SET
                module_id = EXCLUDED.module_id,
                primary_source_link_id = EXCLUDED.primary_source_link_id,
                metric_value = EXCLUDED.metric_value,
                metric_unit = EXCLUDED.metric_unit,
                traffic_status = EXCLUDED.traffic_status,
                confidence_label = EXCLUDED.confidence_label,
                confidence_score = EXCLUDED.confidence_score,
                notes = EXCLUDED.notes,
                data_payload = EXCLUDED.data_payload,
                source_summary = EXCLUDED.source_summary,
                retrieved_at = EXCLUDED.retrieved_at,
                fetched_at = EXCLUDED.fetched_at,
                stale_at = EXCLUDED.stale_at,
                expires_at = EXCLUDED.expires_at,
                updated_at = NOW()
            RETURNING id
            """,
            [
                airport_id,
                module_id,
                primary_source_link_id,
                metric_type,
                "annual",
                period_year,
                metric_value,
                metric_unit,
                traffic_status,
                confidence_label,
                confidence_score,
                notes,
                safe_json_dumps(data_payload) if data_payload else None,
                safe_json_dumps(source_summary) if source_summary else None,
                now,
                now,
                stale_at,
                expires_at,
            ]
        )
        row = cur.fetchone()
        conn.commit()
        return row["id"]


def get_intelligence_modules(conn: Any, airport_id: str) -> list[dict[str, Any]]:
    """Get existing intelligence modules for an airport."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, module_key, module_status, cache_state,
                   confidence_label, confidence_score, fetched_at
            FROM airport_intelligence_modules
            WHERE airport_id = %s
            """,
            [airport_id]
        )
        rows = cur.fetchall()
        return [dict(row) for row in rows]


def get_source_links(conn: Any, airport_id: str) -> list[dict[str, Any]]:
    """Get existing source links for an airport."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, source_type, source_name, source_url, source_entity_id,
                   confidence_label, confidence_score, is_primary
            FROM airport_source_links
            WHERE airport_id = %s
            """,
            [airport_id]
        )
        rows = cur.fetchall()
        return [dict(row) for row in rows]