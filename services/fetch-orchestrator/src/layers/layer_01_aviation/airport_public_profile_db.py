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
    "postgresql://postgres:postgres@localhost:5432/god_eyes"
)

LAYER_ID = "layer_01_aviation"
DEFAULT_SOURCE_ID = "airport_public_enrichment"


def safe_json_dumps(data: Any) -> str:
    """Serialize data to JSON, handling UUID, datetime, date, Decimal, etc.

    This helper ensures all non-JSON-native Python types are converted to
    strings before serialization, which is required for PostgreSQL JSONB fields.
    """

    def serialize_value(obj: Any) -> Any:
        if isinstance(obj, UUID):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, datetime.__bases__[0]):  # date without datetime
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


def get_in_progress_fetch_run(
    conn: Any,
    source_airport_id: str,
    run_type: str = "lazy_fetch",
) -> dict[str, Any] | None:
    """Find an existing queued/running fetch_run for the same airport and run_type."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, profile_id, source_airport_id, airport_ident,
                   run_type, run_status, started_at, lock_expires_at,
                   error_message
            FROM airport_public_profile_fetch_runs
            WHERE layer_id = %s
              AND source_id = %s
              AND source_airport_id = %s
              AND run_type = %s
              AND run_status IN ('queued', 'running')
            ORDER BY started_at DESC
            LIMIT 1
            """,
            [LAYER_ID, DEFAULT_SOURCE_ID, source_airport_id, run_type]
        )
        row = cur.fetchone()
        return dict(row) if row else None


def mark_stale_fetch_runs_failed(
    conn: Any,
    source_airport_id: str,
    run_type: str = "lazy_fetch",
    stale_minutes: int = 30,
) -> int:
    """Mark stale running/queued fetch_runs as failed. Returns count of marked runs."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE airport_public_profile_fetch_runs
            SET run_status = 'failed',
                completed_at = NOW(),
                error_message = 'Marked stale by new worker (stuck for > %s minutes)',
                duration_ms = EXTRACT(MILLISECONDS FROM (NOW() - started_at))::INTEGER
            WHERE layer_id = %s
              AND source_id = %s
              AND source_airport_id = %s
              AND run_type = %s
              AND run_status IN ('queued', 'running')
              AND started_at < NOW() - INTERVAL '%s minutes'
            """,
            [stale_minutes, LAYER_ID, DEFAULT_SOURCE_ID, source_airport_id, run_type, stale_minutes]
        )
        conn.commit()
        return cur.rowcount


def create_or_reuse_fetch_run(
    conn: Any,
    profile_id: UUID | None,
    source_airport_id: str,
    airport_ident: str | None,
    run_type: str = "lazy_fetch",
    run_status: str = "running",
    stale_minutes: int = 30,
) -> UUID:
    """Create a new fetch_run or reuse an existing in-progress one.

    Strategy:
    1. Check for existing queued/running fetch_run
    2. If exists and is stale (> stale_minutes), mark it failed and create new
    3. If exists and is recent, reuse it (update lock_expires_at)
    4. If none exists, create new
    5. If create hits UniqueViolation, recover by loading existing
    """
    existing = get_in_progress_fetch_run(conn, source_airport_id, run_type)

    if existing:
        started_at = existing.get("started_at")
        is_stale = False

        if started_at:
            if isinstance(started_at, datetime):
                age_minutes = (datetime.now(timezone.utc) - started_at).total_seconds() / 60
                is_stale = age_minutes > stale_minutes
            else:
                is_stale = True

        if is_stale:
            mark_stale_fetch_runs_failed(conn, source_airport_id, run_type, stale_minutes)
            print(f"[DB] Marked stale fetch_run {existing['id']} as failed")
        else:
            print(f"[DB] Reusing existing fetch_run {existing['id']} (started {started_at})")
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE airport_public_profile_fetch_runs
                    SET run_status = 'running',
                        lock_expires_at = NOW() + INTERVAL '5 minutes',
                        error_message = NULL
                    WHERE id = %s
                    """,
                    [existing["id"]]
                )
                conn.commit()
            return existing["id"]

    idempotency_key = f"{source_airport_id}_{run_type}_{datetime.now(timezone.utc).isoformat()}"
    in_progress_key = f"{source_airport_id}_{run_type}_running"

    try:
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
    except Exception as e:
        conn.rollback()
        if "idx_airport_public_profile_fetch_runs_in_progress" in str(e) or "in_progress_key" in str(e):
            existing = get_in_progress_fetch_run(conn, source_airport_id, run_type)
            if existing:
                print(f"[DB] Recovered from duplicate: reusing fetch_run {existing['id']}")
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE airport_public_profile_fetch_runs
                        SET run_status = 'running',
                            lock_expires_at = NOW() + INTERVAL '5 minutes',
                            error_message = NULL
                        WHERE id = %s
                        """,
                        [existing["id"]]
                    )
                    conn.commit()
                return existing["id"]
        raise


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
                records_examined = %s,
                content_changed = %s,
                produced_version_id = %s
            WHERE id = %s
            """,
            [
                run_status,
                error_message,
                records_examined,
                content_changed,
                produced_version_id,
                fetch_run_id,
            ]
        )
        conn.commit()


def get_next_queued_fetch_run(conn: Any) -> dict[str, Any] | None:
    """Get the oldest queued or unclaimed running fetch_run to process."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT fr.id, fr.profile_id, fr.source_id, fr.source_airport_id, fr.airport_ident,
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


def claim_fetch_run(conn: Any, fetch_run_id: UUID | str) -> dict[str, Any] | None:
    """Atomically claim a queued fetch_run for this worker."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE airport_public_profile_fetch_runs
            SET run_status = 'running',
                lock_expires_at = NOW() + INTERVAL '5 minutes'
            WHERE id = %s
              AND run_status IN ('queued', 'running')
              AND (lock_expires_at IS NULL OR lock_expires_at < NOW())
            RETURNING id, profile_id, source_id, source_airport_id, airport_ident,
                      run_type, run_status, started_at, lock_expires_at
            """,
            [fetch_run_id]
        )
        row = cur.fetchone()
        conn.commit()
        return dict(row) if row else None


def lock_fetch_run(conn: Any, fetch_run_id: UUID | str) -> bool:
    """Backward-compatible lock helper for older worker path."""
    return claim_fetch_run(conn, fetch_run_id) is not None


def resolve_airport_by_fetch_run(
    conn: Any,
    fetch_run: dict[str, Any],
) -> dict[str, Any] | None:
    """Resolve aviation_airports identity for a queued public-profile fetch_run."""
    airport_id = fetch_run.get("airport_id")
    source_airport_id = fetch_run.get("source_airport_id")

    with conn.cursor() as cur:
        if airport_id:
            cur.execute(
                """
                SELECT id, source_id, source_airport_id, ident, iata_code,
                       name, iso_country, municipality, latitude_deg, longitude_deg,
                       wikipedia_link
                FROM aviation_airports
                WHERE id = %s
                LIMIT 1
                """,
                [airport_id],
            )
            row = cur.fetchone()
            if row:
                return dict(row)

        if not source_airport_id:
            return None

        cur.execute(
            """
            SELECT id, source_id, source_airport_id, ident, iata_code,
                   name, iso_country, municipality, latitude_deg, longitude_deg,
                   wikipedia_link
            FROM aviation_airports
            WHERE source_airport_id = %s
            ORDER BY source_id, ident
            LIMIT 1
            """,
            [source_airport_id],
        )
        row = cur.fetchone()
        return dict(row) if row else None


def mark_fetch_run_running(conn: Any, fetch_run_id: UUID | str) -> dict[str, Any] | None:
    """Compatibility wrapper for claim_fetch_run."""
    return claim_fetch_run(conn, fetch_run_id)


def mark_fetch_run_completed(
    conn: Any,
    fetch_run_id: UUID | str,
    produced_version_id: UUID | str | None = None,
    records_examined: int = 1,
    content_changed: bool = True,
) -> None:
    """Mark a fetch_run completed."""
    update_fetch_run_completed(
        conn,
        fetch_run_id,
        run_status="completed",
        records_examined=records_examined,
        content_changed=content_changed,
        produced_version_id=produced_version_id,
    )


def mark_fetch_run_failed(
    conn: Any,
    fetch_run_id: UUID | str,
    error_message: str,
    records_examined: int = 0,
) -> None:
    """Mark a fetch_run failed with a sanitized error message."""
    update_fetch_run_completed(
        conn,
        fetch_run_id,
        run_status="failed",
        error_message=error_message,
        records_examined=records_examined,
        content_changed=False,
    )


def count_pending_fetch_runs(conn: Any) -> int:
    """Count queued or unclaimed running public-profile fetch runs."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*) AS pending_count
            FROM airport_public_profile_fetch_runs
            WHERE run_status IN ('queued', 'running')
              AND (lock_expires_at IS NULL OR lock_expires_at < NOW())
            """
        )
        row = cur.fetchone()
        return int(row["pending_count"] if row else 0)


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
                profile_status, cache_state,
                fetched_at, stale_at, expires_at,
                cache_key, latest_fetch_run_id
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (layer_id, source_id, source_airport_id) DO UPDATE SET
                profile_payload = EXCLUDED.profile_payload,
                profile_summary = EXCLUDED.profile_summary,
                source_attribution = EXCLUDED.source_attribution,
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
                safe_json_dumps(profile_payload),
                profile_summary,
                safe_json_dumps(source_attribution),
                profile_status,
                cache_state,
                now,
                stale_at,
                expires_at,
                cache_key,
                None,
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
    content_hash: str | None = None,
) -> UUID:
    """Insert a new version record in airport_public_profile_versions.

    If a version with the same content_hash already exists, returns that version's ID
    instead of creating a duplicate.
    """
    with conn.cursor() as cur:
        # Check if version with same content_hash already exists
        if content_hash:
            cur.execute(
                """
                SELECT id FROM airport_public_profile_versions
                WHERE profile_id = %s AND content_hash = %s
                LIMIT 1
                """,
                [profile_id, content_hash]
            )
            existing = cur.fetchone()
            if existing:
                print(f"[DB] Version with same content_hash exists: {existing['id']}")
                return existing["id"]

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
                source_attribution, content_hash,
                created_by, valid_from, fetched_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
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
                safe_json_dumps(profile_payload),
                profile_summary,
                safe_json_dumps(source_attribution),
                content_hash,
                "worker",
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
