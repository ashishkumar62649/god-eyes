"""Airport Public Profile Worker DB helper.

This module provides minimal DB operations for the worker to persist profiles.
Uses psycopg3 directly (synchronous) matching the pattern from other services.

Tables:
- aviation_airports (read-only, for identity resolution)
- airport_public_profiles (upsert)
- airport_public_profile_versions (insert)
- airport_public_profile_fetch_runs (insert/update)
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID

REPO_ROOT = Path(__file__).resolve().parents[5]
import sys

if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

DEFAULT_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/god_eyes"
)

LAYER_ID = "layer_01_aviation"
DEFAULT_SOURCE_ID = "airport_public_enrichment"


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
                   wikipedia_link
            FROM aviation_airports
            WHERE id = %s
            """,
            [airport_id]
        )
        row = cur.fetchone()
        if not row:
            return None
        return dict(row)


def get_existing_profile(conn: Any, airport_id: str) -> dict[str, Any] | None:
    """Get existing airport_public_profiles record for an airport."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, airport_id, layer_id, source_id, source_airport_id,
                   airport_ident, profile_status, cache_state,
                   stale_at, expires_at, fetched_at,
                   profile_payload, profile_summary, source_attribution,
                   current_version_id, latest_fetch_run_id
            FROM airport_public_profiles
            WHERE airport_id = %s
            LIMIT 1
            """,
            [airport_id]
        )
        row = cur.fetchone()
        return dict(row) if row else None


def create_fetch_run(
    conn: Any,
    profile_id: UUID | None,
    source_airport_id: str,
    airport_ident: str | None,
    run_type: str = "lazy_fetch",
    run_status: str = "queued",
) -> UUID:
    """Create a new fetch_run record and return its ID."""
    idempotency_key = f"{source_airport_id}_{run_type}_{datetime.now(timezone.utc).isoformat()}"
    in_progress_key = f"{source_airport_id}_{run_type}_running"

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO airport_public_profile_fetch_runs (
                profile_id, layer_id, source_id, source_airport_id, airport_ident,
                run_type, run_status, idempotency_key, in_progress_key, started_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            RETURNING id
            """,
            [
                profile_id,
                LAYER_ID,
                DEFAULT_SOURCE_ID,
                source_airport_id,
                airport_ident,
                run_type,
                run_status,
                idempotency_key,
                in_progress_key,
            ]
        )
        row = cur.fetchone()
        conn.commit()
        return row["id"]


def update_fetch_run_completed(
    conn: Any,
    fetch_run_id: UUID,
    run_status: str = "completed",
    error_message: str | None = None,
    wikipedia_page_title: str | None = None,
    wikipedia_revision_id: str | None = None,
    wikidata_qid: str | None = None,
    records_examined: int = 1,
    content_changed: bool = True,
    produced_version_id: UUID | None = None,
) -> None:
    """Mark fetch_run as completed (or failed)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE airport_public_profile_fetch_runs
            SET run_status = %s,
                completed_at = NOW(),
                duration_ms = EXTRACT(MILLISECONDS FROM (NOW() - started_at))::INTEGER,
                error_message = %s,
                wikipedia_page_title = %s,
                wikipedia_revision_id = %s,
                wikidata_qid = %s,
                records_examined = %s,
                content_changed = %s,
                produced_version_id = %s
            WHERE id = %s
            """,
            [
                run_status,
                error_message,
                wikipedia_page_title,
                wikipedia_revision_id,
                wikidata_qid,
                records_examined,
                content_changed,
                produced_version_id,
                fetch_run_id,
            ]
        )
        conn.commit()


def get_next_queued_fetch_run(conn: Any) -> dict[str, Any] | None:
    """Get the next queued fetch_run to process."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT fr.id, fr.profile_id, fr.source_airport_id, fr.airport_ident,
                   fr.run_type, fr.run_status, fr.started_at,
                   p.airport_id
            FROM airport_public_profile_fetch_runs fr
            LEFT JOIN airport_public_profiles p ON fr.profile_id = p.id
            WHERE fr.run_status IN ('queued', 'running')
            AND (fr.lock_expires_at IS NULL OR fr.lock_expires_at < NOW())
            ORDER BY fr.started_at ASC
            LIMIT 1
            """
        )
        row = cur.fetchone()
        return dict(row) if row else None


def lock_fetch_run(conn: Any, fetch_run_id: UUID) -> bool:
    """Lock a fetch_run to prevent concurrent processing."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE airport_public_profile_fetch_runs
            SET run_status = 'running',
                lock_expires_at = NOW() + INTERVAL '5 minutes'
            WHERE id = %s AND run_status IN ('queued', 'running')
            """,
            [fetch_run_id]
        )
        conn.commit()
        return cur.rowcount > 0


def upsert_profile(
    conn: Any,
    airport_id: str,
    source_airport_id: str,
    airport_ident: str | None,
    profile_payload: dict[str, Any],
    profile_summary: str | None,
    source_attribution: dict[str, Any],
    wikipedia_page_title: str | None = None,
    wikipedia_page_id: str | None = None,
    wikipedia_revision_id: str | None = None,
    wikipedia_url: str | None = None,
    wikidata_qid: str | None = None,
    wikidata_url: str | None = None,
    profile_status: str = "cached",
    cache_state: str = "fresh",
) -> dict[str, Any]:
    """Upsert airport_public_profiles record."""
    now = datetime.now(timezone.utc)
    ttl_seconds = 30 * 24 * 60 * 60  # 30 days
    stale_at = datetime.fromtimestamp(now.timestamp() + ttl_seconds, tz=timezone.utc)
    expires_at = datetime.fromtimestamp(now.timestamp() + ttl_seconds * 1.5, tz=timezone.utc)

    cache_key = f"{LAYER_ID}:{DEFAULT_SOURCE_ID}:{source_airport_id}"

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO airport_public_profiles (
                airport_id, layer_id, source_id, source_airport_id, airport_ident,
                profile_payload, profile_summary, source_attribution,
                wikipedia_page_title, wikipedia_page_id, wikipedia_revision_id, wikipedia_url,
                wikidata_qid, wikidata_url,
                profile_status, cache_state,
                fetched_at, stale_at, expires_at,
                cache_key, latest_fetch_run_id
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (layer_id, source_id, source_airport_id) DO UPDATE SET
                profile_payload = EXCLUDED.profile_payload,
                profile_summary = EXCLUDED.profile_summary,
                source_attribution = EXCLUDED.source_attribution,
                wikipedia_page_title = EXCLUDED.wikipedia_page_title,
                wikipedia_page_id = EXCLUDED.wikipedia_page_id,
                wikipedia_revision_id = EXCLUDED.wikipedia_revision_id,
                wikipedia_url = EXCLUDED.wikipedia_url,
                wikidata_qid = EXCLUDED.wikidata_qid,
                wikidata_url = EXCLUDED.wikidata_url,
                profile_status = EXCLUDED.profile_status,
                cache_state = EXCLUDED.cache_state,
                fetched_at = EXCLUDED.fetched_at,
                stale_at = EXCLUDED.stale_at,
                expires_at = EXCLUDED.expires_at,
                updated_at = NOW(),
                latest_fetch_run_id = EXCLUDED.latest_fetch_run_id
            RETURNING id, airport_id, profile_status, cache_state, fetched_at, expires_at
            """,
            [
                airport_id,
                LAYER_ID,
                DEFAULT_SOURCE_ID,
                source_airport_id,
                airport_ident,
                json.dumps(profile_payload),
                profile_summary,
                json.dumps(source_attribution),
                wikipedia_page_title,
                wikipedia_page_id,
                wikipedia_revision_id,
                wikipedia_url,
                wikidata_qid,
                wikidata_url,
                profile_status,
                cache_state,
                now,
                stale_at,
                expires_at,
                cache_key,
                None,  # latest_fetch_run_id set after insert
            ]
        )
        row = cur.fetchone()
        conn.commit()
        return dict(row)


def insert_profile_version(
    conn: Any,
    profile_id: UUID,
    fetch_run_id: UUID | None,
    source_airport_id: str,
    profile_payload: dict[str, Any],
    profile_summary: str | None,
    source_attribution: dict[str, Any],
    wikipedia_page_title: str | None = None,
    wikipedia_page_id: str | None = None,
    wikipedia_revision_id: str | None = None,
    wikipedia_url: str | None = None,
    wikidata_qid: str | None = None,
    wikidata_url: str | None = None,
    content_hash: str | None = None,
) -> UUID:
    """Insert a new version record in airport_public_profile_versions."""
    with conn.cursor() as cur:
        # Get next version number
        cur.execute(
            """
            SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
            FROM airport_public_profile_versions
            WHERE profile_id = %s
            """,
            [profile_id]
        )
        version_row = cur.fetchone()
        version_number = version_row["next_version"]

        # Mark previous versions as not current
        cur.execute(
            """
            UPDATE airport_public_profile_versions
            SET is_current = FALSE
            WHERE profile_id = %s AND is_current = TRUE
            """,
            [profile_id]
        )

        # Insert new version
        cur.execute(
            """
            INSERT INTO airport_public_profile_versions (
                profile_id, fetch_run_id, layer_id, source_id, source_airport_id,
                version_number, is_current, version_status,
                profile_payload, profile_summary,
                wikipedia_page_title, wikipedia_page_id, wikipedia_revision_id, wikipedia_url,
                wikidata_qid, wikidata_url,
                source_attribution, content_hash,
                valid_from, fetched_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
            RETURNING id
            """,
            [
                profile_id,
                fetch_run_id,
                LAYER_ID,
                DEFAULT_SOURCE_ID,
                source_airport_id,
                version_number,
                True,
                "current",
                json.dumps(profile_payload),
                profile_summary,
                wikipedia_page_title,
                wikipedia_page_id,
                wikipedia_revision_id,
                wikipedia_url,
                wikidata_qid,
                wikidata_url,
                json.dumps(source_attribution),
                content_hash,
                version_number,
            ]
        )
        version_row = cur.fetchone()
        conn.commit()
        return version_row["id"]


def update_profile_current_version(
    conn: Any,
    profile_id: UUID,
    version_id: UUID,
) -> None:
    """Update the current_version_id on the profile."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE airport_public_profiles
            SET current_version_id = %s, updated_at = NOW()
            WHERE id = %s
            """,
            [version_id, profile_id]
        )
        conn.commit()


def update_profile_latest_fetch_run(
    conn: Any,
    profile_id: UUID,
    fetch_run_id: UUID,
) -> None:
    """Update the latest_fetch_run_id on the profile."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE airport_public_profiles
            SET latest_fetch_run_id = %s, updated_at = NOW()
            WHERE id = %s
            """,
            [fetch_run_id, profile_id]
        )
        conn.commit()