"""Airport Image Gallery DB helper.

Tables written:
- airport_image_assets (upsert)

Tables read:
- aviation_airports (identity resolution)
- airport_source_links (Wikipedia/Wikidata source discovery)
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


def safe_json_dumps(data: Any) -> str:
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


def resolve_airport_by_iata(conn: Any, iata_code: str) -> dict[str, Any] | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, source_id, source_airport_id, ident, iata_code,
                   name, iso_country, municipality, latitude_deg, longitude_deg,
                   wikipedia_link, elevation_ft, scheduled_service
            FROM aviation_airports
            WHERE iata_code = %s
            LIMIT 1
            """,
            [iata_code]
        )
        row = cur.fetchone()
        return dict(row) if row else None


def find_source_links_for_airport(conn: Any, airport_id: str) -> list[dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, source_type, source_name, source_url, source_entity_id,
                   source_license, source_license_url, attribution_text,
                   confidence_label, confidence_score, is_primary, metadata
            FROM airport_source_links
            WHERE airport_id = %s
            ORDER BY is_primary DESC, confidence_score DESC NULLS LAST
            """,
            [airport_id]
        )
        rows = cur.fetchall()
        return [dict(row) for row in rows]


def check_image_assets_table_exists(conn: Any) -> bool:
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_name = 'airport_image_assets'
                )
                """
            )
            row = cur.fetchone()
            return row["exists"] if row else False
    except Exception:
        return False


def upsert_image_asset(
    conn: Any,
    airport_id: UUID | str,
    source_type: str,
    image_url: str,
    thumbnail_url: str | None = None,
    original_url: str | None = None,
    caption: str | None = None,
    description: str | None = None,
    attribution_text: str | None = None,
    license_name: str | None = None,
    license_url: str | None = None,
    width_px: int | None = None,
    height_px: int | None = None,
    media_type: str | None = None,
    image_kind: str = "unknown",
    is_hero: bool = False,
    rank: int = 100,
    confidence_label: str = "unknown",
    confidence_score: float | None = None,
    content_hash: str | None = None,
    source_entity_id: str | None = None,
    source_name: str | None = None,
    source_url: str | None = None,
    source_file_title: str | None = None,
    source_object_id: str | None = None,
    source_id: str | None = None,
    raw_metadata: dict[str, Any] | None = None,
    diagnostics: dict[str, Any] | None = None,
) -> UUID:
    now = datetime.now(timezone.utc)
    raw_metadata_json = safe_json_dumps(raw_metadata) if raw_metadata else "{}"
    diagnostics_json = safe_json_dumps(diagnostics) if diagnostics else "{}"

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO airport_image_assets (
                airport_id, source_type, image_url,
                thumbnail_url, original_url, caption, description,
                attribution_text, license_name, license_url,
                width_px, height_px, media_type, image_kind,
                is_hero, rank, confidence_label, confidence_score,
                content_hash, source_entity_id, source_name, source_url,
                source_file_title, source_object_id, source_id,
                fetched_at, raw_metadata, diagnostics
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s
            )
            ON CONFLICT (airport_id, image_url) DO UPDATE SET
                thumbnail_url = COALESCE(EXCLUDED.thumbnail_url, airport_image_assets.thumbnail_url),
                original_url = COALESCE(EXCLUDED.original_url, airport_image_assets.original_url),
                caption = COALESCE(EXCLUDED.caption, airport_image_assets.caption),
                description = COALESCE(EXCLUDED.description, airport_image_assets.description),
                attribution_text = COALESCE(EXCLUDED.attribution_text, airport_image_assets.attribution_text),
                license_name = COALESCE(EXCLUDED.license_name, airport_image_assets.license_name),
                license_url = COALESCE(EXCLUDED.license_url, airport_image_assets.license_url),
                width_px = COALESCE(EXCLUDED.width_px, airport_image_assets.width_px),
                height_px = COALESCE(EXCLUDED.height_px, airport_image_assets.height_px),
                media_type = COALESCE(EXCLUDED.media_type, airport_image_assets.media_type),
                image_kind = EXCLUDED.image_kind,
                rank = LEAST(airport_image_assets.rank, EXCLUDED.rank),
                confidence_label = EXCLUDED.confidence_label,
                confidence_score = EXCLUDED.confidence_score,
                content_hash = COALESCE(EXCLUDED.content_hash, airport_image_assets.content_hash),
                source_name = COALESCE(EXCLUDED.source_name, airport_image_assets.source_name),
                source_url = COALESCE(EXCLUDED.source_url, airport_image_assets.source_url),
                source_file_title = COALESCE(EXCLUDED.source_file_title, airport_image_assets.source_file_title),
                raw_metadata = COALESCE(EXCLUDED.raw_metadata, airport_image_assets.raw_metadata),
                diagnostics = COALESCE(EXCLUDED.diagnostics, airport_image_assets.diagnostics),
                fetched_at = EXCLUDED.fetched_at,
                updated_at = NOW()
            RETURNING id
            """,
            [
                airport_id, source_type, image_url,
                thumbnail_url, original_url, caption, description,
                attribution_text, license_name, license_url,
                width_px, height_px, media_type, image_kind,
                is_hero, rank, confidence_label, confidence_score,
                content_hash, source_entity_id, source_name, source_url,
                source_file_title, source_object_id, source_id,
                now, raw_metadata_json, diagnostics_json,
            ]
        )
        row = cur.fetchone()
        conn.commit()
        return row["id"]


def clear_hero_for_airport(conn: Any, airport_id: UUID | str) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE airport_image_assets
            SET is_hero = FALSE, updated_at = NOW()
            WHERE airport_id = %s AND is_hero = TRUE
            """,
            [airport_id]
        )
        count = cur.rowcount
        conn.commit()
        return count


def set_hero_image(conn: Any, image_asset_id: UUID | str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE airport_image_assets
            SET is_hero = TRUE, updated_at = NOW()
            WHERE id = %s
            """,
            [image_asset_id]
        )
        conn.commit()


def get_existing_images_for_airport(conn: Any, airport_id: str) -> list[dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, image_url, image_kind, is_hero, rank,
                   thumbnail_url, license_name, source_type, source_file_title
            FROM airport_image_assets
            WHERE airport_id = %s
            ORDER BY rank, created_at
            """,
            [airport_id]
        )
        rows = cur.fetchall()
        return [dict(row) for row in rows]
