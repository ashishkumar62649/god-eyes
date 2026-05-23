"""Airport Layout Features DB helper.

This module provides DB operations for persisting airport layout features.

Tables written:
- airport_layout_features (upsert with is_active update)

Tables read:
- aviation_airports (identity resolution)
- aviation_runways (runway data for layout features)
- airport_layout_features (existing features)
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

LAYER_ID = "layer_01_aviation"


def safe_json_dumps(data: Any) -> str:
    """Serialize data to JSON, handling UUID, datetime, date, Decimal, etc."""
    def serialize_value(obj: Any) -> Any:
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return str(obj)
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
                   name, iso_country, municipality, latitude_deg, longitude_deg
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
                   name, iso_country, municipality, latitude_deg, longitude_deg
            FROM aviation_airports
            WHERE ident = %s
            LIMIT 1
            """,
            [airport_ident]
        )
        row = cur.fetchone()
        return dict(row) if row else None


def get_runway_data_for_layout(conn: Any, airport_ident: str) -> list[dict[str, Any]]:
    """Get runway data for an airport from aviation_runways table."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                source_runway_id,
                le_ident,
                le_latitude_deg,
                le_longitude_deg,
                le_elevation_ft,
                "le_heading_degT",
                le_displaced_threshold_ft,
                he_ident,
                he_latitude_deg,
                he_longitude_deg,
                he_elevation_ft,
                "he_heading_degT",
                he_displaced_threshold_ft,
                length_ft,
                width_ft,
                surface,
                lighted,
                closed
            FROM aviation_runways
            WHERE airport_ident = %s
            ORDER BY length_ft DESC NULLS LAST
            """,
            [airport_ident]
        )
        rows = cur.fetchall()
        return [dict(row) for row in rows]


def get_existing_layout_features(
    conn: Any,
    airport_id: str,
    source_type: str,
) -> dict[str, dict[str, Any]]:
    """Get existing layout features keyed by source_object_id."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, source_object_id, is_active, feature_type, feature_name
            FROM airport_layout_features
            WHERE airport_id = %s AND source_type = %s
            """,
            [airport_id, source_type]
        )
        rows = cur.fetchall()
        return {row["source_object_id"]: dict(row) for row in rows}


LAYOUT_FEATURE_UPSERT_SQL = """
INSERT INTO airport_layout_features (
    airport_id,
    layer_id,
    feature_type,
    feature_subtype,
    feature_name,
    source_type,
    source_name,
    source_url,
    source_object_id,
    source_entity_id,
    geometry,
    geometry_type,
    centroid,
    bbox,
    confidence_label,
    confidence_score,
    rank,
    is_primary,
    is_active,
    fetched_at,
    last_checked_at,
    expires_at,
    content_hash,
    raw_metadata,
    diagnostics
) VALUES (
    %(airport_id)s,
    %(layer_id)s,
    %(feature_type)s,
    %(feature_subtype)s,
    %(feature_name)s,
    %(source_type)s,
    %(source_name)s,
    %(source_url)s,
    %(source_object_id)s,
    %(source_entity_id)s,
    ST_GeomFromText(%(geometry)s, 4326),
    %(geometry_type)s,
    CASE WHEN %(centroid)s::text IS NULL THEN NULL ELSE ST_GeomFromText(%(centroid)s, 4326) END,
    CASE WHEN %(bbox)s::text IS NULL THEN NULL ELSE ST_GeomFromText(%(bbox)s, 4326) END,
    %(confidence_label)s,
    %(confidence_score)s,
    %(rank)s,
    %(is_primary)s,
    %(is_active)s,
    %(fetched_at)s,
    %(last_checked_at)s,
    %(expires_at)s,
    %(content_hash)s,
    %(raw_metadata)s::jsonb,
    %(diagnostics)s::jsonb
)
ON CONFLICT (airport_id, source_type, source_object_id)
WHERE source_object_id IS NOT NULL
DO UPDATE SET
    feature_subtype = EXCLUDED.feature_subtype,
    feature_name = EXCLUDED.feature_name,
    source_name = EXCLUDED.source_name,
    geometry = EXCLUDED.geometry,
    centroid = EXCLUDED.centroid,
    bbox = EXCLUDED.bbox,
    confidence_label = EXCLUDED.confidence_label,
    confidence_score = EXCLUDED.confidence_score,
    rank = EXCLUDED.rank,
    is_primary = EXCLUDED.is_primary,
    is_active = EXCLUDED.is_active,
    fetched_at = EXCLUDED.fetched_at,
    last_checked_at = EXCLUDED.last_checked_at,
    expires_at = EXCLUDED.expires_at,
    raw_metadata = EXCLUDED.raw_metadata,
    diagnostics = EXCLUDED.diagnostics,
    updated_at = NOW()
RETURNING id
"""


def upsert_layout_feature(
    conn: Any,
    feature: dict[str, Any],
) -> str | None:
    """Upsert a single layout feature. Returns the feature id."""
    if feature.get("centroid"):
        feature["centroid"] = feature["centroid"]
    if feature.get("bbox"):
        feature["bbox"] = feature["bbox"]
    if feature.get("raw_metadata"):
        feature["raw_metadata"] = safe_json_dumps(feature["raw_metadata"])
    if feature.get("diagnostics"):
        feature["diagnostics"] = safe_json_dumps(feature["diagnostics"])

    with conn.cursor() as cur:
        cur.execute(LAYOUT_FEATURE_UPSERT_SQL, feature)
        row = cur.fetchone()
        if row:
            conn.commit()
            return row["id"]
    return None


def upsert_layout_features(
    conn: Any,
    features: list[dict[str, Any]],
) -> list[str]:
    """Upsert multiple layout features. Returns list of feature ids."""
    ids = []
    for feature in features:
        fid = upsert_layout_feature(conn, feature)
        if fid:
            ids.append(fid)
    return ids


def deactivate_features_not_in_list(
    conn: Any,
    airport_id: str,
    source_type: str,
    active_source_object_ids: list[str],
) -> int:
    """Mark features as inactive if they're not in the current run."""
    if not active_source_object_ids:
        return 0

    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE airport_layout_features
            SET is_active = false, updated_at = NOW()
            WHERE airport_id = %s
              AND source_type = %s
              AND source_object_id NOT IN %s
              AND is_active = true
            """,
            [airport_id, source_type, tuple(active_source_object_ids)]
        )
        rows_updated = cur.rowcount
        conn.commit()
        return rows_updated


def get_layout_features_for_api(
    conn: Any,
    airport_id: str,
    include_inactive: bool = False,
    feature_type: str | None = None,
) -> list[dict[str, Any]]:
    """Get layout features for API response."""
    if include_inactive:
        where_clause = "WHERE airport_id = %s"
        params: tuple[str, ...] = (airport_id,)
    else:
        where_clause = "WHERE airport_id = %s AND is_active = true"
        params = (airport_id,)

    if feature_type:
        where_clause += " AND feature_type = %s"
        params = (airport_id, feature_type)

    query_sql = f"""
        SELECT
            id,
            feature_type,
            feature_subtype,
            feature_name,
            source_type,
            geometry,
            geometry_type,
            centroid,
            is_active,
            confidence_label,
            confidence_score,
            rank,
            is_primary,
            fetched_at
        FROM airport_layout_features
        {where_clause}
        ORDER BY rank ASC, feature_name ASC
    """

    with conn.cursor() as cur:
        cur.execute(query_sql, params)
        rows = cur.fetchall()
        return [dict(row) for row in rows]


def get_layout_feature_summary(
    conn: Any,
    airport_id: str,
    include_inactive: bool = False,
) -> dict[str, Any]:
    """Get summary of layout features for an airport."""
    if include_inactive:
        where_clause = "WHERE airport_id = %s"
        params: tuple[str, ...] = (airport_id,)
    else:
        where_clause = "WHERE airport_id = %s AND is_active = true"
        params = (airport_id,)

    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
                feature_type,
                COUNT(*) as count
            FROM airport_layout_features
            {where_clause}
            GROUP BY feature_type
            """,
            params
        )
        rows = cur.fetchall()

    by_type: dict[str, int] = {}
    total = 0
    for row in rows:
        ft = row["feature_type"]
        count = row["count"]
        by_type[ft] = count
        total += count

    has_runways = "runway" in by_type
    has_taxiways = "taxiway" in by_type
    has_aprons = "apron" in by_type
    has_terminals = "terminal" in by_type

    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT DISTINCT source_type
            FROM airport_layout_features
            {where_clause}
            """,
            params
        )
        source_types = [row["source_type"] for row in cur.fetchall()]

    return {
        "totalFeatures": total,
        "byType": by_type,
        "sourceTypes": source_types,
        "hasRunways": has_runways,
        "hasTaxiways": has_taxiways,
        "hasAprons": has_aprons,
        "hasTerminals": has_terminals,
    }