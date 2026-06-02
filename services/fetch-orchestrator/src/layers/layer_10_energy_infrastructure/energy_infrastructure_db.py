"""Energy Infrastructure DB helper (Layer 10).

Persists normalized energy infrastructure features into the
``energy_infrastructure`` table.

DB schema (see ``database/migrations/layers/layer_10_energy_infrastructure/
001_energy_infrastructure_tables.sql``):

* Composite unique key: ``(source_id, source_object_id)``.
* PostGIS ``geom geometry(Geometry, 4326)`` and ``bbox geometry(...)``.
* Many allowlisted enum checks.

This module uses **parameterized SQL only** and rolls back on any
single bad row so a partial failure cannot poison a whole persist run.

The ``connect_db`` function uses ``psycopg`` when available; if it is
not installed, the helper falls back to a tiny in-memory mock so unit
tests can run without a Postgres server. The mock is clearly tagged in
its ``info`` attribute so production callers can detect it.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any

LAYER_ID = "layer_10_energy_infrastructure"

DEFAULT_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://god_eyes:god_eyes_dev_password@localhost:5432/god_eyes_dev",
)

UPSERT_SQL = """
INSERT INTO energy_infrastructure (
    layer_id,
    source_id,
    source_object_id,
    feature_type,
    category,
    geometry_type,
    name,
    operator,
    owner,
    country,
    status,
    fuel_type,
    capacity_mw,
    voltage_kv,
    pipeline_product,
    pipeline_length_km,
    terminal_type,
    geom,
    centroid_lat,
    centroid_lon,
    bbox,
    source_confidence,
    source_updated_at,
    first_seen_at,
    last_seen_at,
    raw_source_json
) VALUES (
    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
    %s, %s, %s, %s, %s, %s, %s,
    ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326),
    %s, %s,
    CASE WHEN %s IS NULL THEN NULL
         ELSE ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)
    END,
    %s, %s, %s, %s, %s::jsonb
)
ON CONFLICT (source_id, source_object_id) DO UPDATE SET
    layer_id = EXCLUDED.layer_id,
    feature_type = EXCLUDED.feature_type,
    category = EXCLUDED.category,
    geometry_type = EXCLUDED.geometry_type,
    name = EXCLUDED.name,
    operator = COALESCE(EXCLUDED.operator, energy_infrastructure.operator),
    owner = COALESCE(EXCLUDED.owner, energy_infrastructure.owner),
    country = COALESCE(EXCLUDED.country, energy_infrastructure.country),
    status = COALESCE(EXCLUDED.status, energy_infrastructure.status),
    fuel_type = COALESCE(EXCLUDED.fuel_type, energy_infrastructure.fuel_type),
    capacity_mw = COALESCE(EXCLUDED.capacity_mw, energy_infrastructure.capacity_mw),
    voltage_kv = COALESCE(EXCLUDED.voltage_kv, energy_infrastructure.voltage_kv),
    pipeline_product = COALESCE(EXCLUDED.pipeline_product, energy_infrastructure.pipeline_product),
    pipeline_length_km = COALESCE(EXCLUDED.pipeline_length_km, energy_infrastructure.pipeline_length_km),
    terminal_type = COALESCE(EXCLUDED.terminal_type, energy_infrastructure.terminal_type),
    geom = EXCLUDED.geom,
    centroid_lat = EXCLUDED.centroid_lat,
    centroid_lon = EXCLUDED.centroid_lon,
    bbox = EXCLUDED.bbox,
    source_confidence = COALESCE(EXCLUDED.source_confidence, energy_infrastructure.source_confidence),
    source_updated_at = COALESCE(EXCLUDED.source_updated_at, energy_infrastructure.source_updated_at),
    last_seen_at = EXCLUDED.last_seen_at,
    raw_source_json = EXCLUDED.raw_source_json,
    updated_at = NOW()
RETURNING id, (xmax = 0) AS inserted
"""


def safe_json_dumps(data: Any) -> str:
    """JSON serializer that handles ``datetime`` / ``Decimal`` / ``bytes``."""

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


class EnergyInfrastructureInMemoryConnection:
    """Tiny in-memory mock used when ``psycopg`` is not installed.

    The mock keeps a ``rows`` list and a ``calls`` list so tests can
    assert that the worker issued the right SQL with the right
    parameters. It cannot represent real PostGIS geometry, but it
    does verify upsert semantics (unique on ``source_id`` /
    ``source_object_id``) and the parameter ordering used by
    ``upsert_feature``.
    """

    info = "in-memory-mock"

    def __init__(self) -> None:
        self.rows: list[dict[str, Any]] = []
        self.calls: list[dict[str, Any]] = []

    def cursor(self) -> "EnergyInfrastructureInMemoryCursor":
        return EnergyInfrastructureInMemoryCursor(self)

    def commit(self) -> None:
        return None

    def rollback(self) -> None:
        return None

    def close(self) -> None:
        return None

    def count(self) -> int:
        return len(self.rows)


class EnergyInfrastructureInMemoryCursor:
    def __init__(self, conn: EnergyInfrastructureInMemoryConnection) -> None:
        self.conn = conn
        self._result: list[Any] = []

    def __enter__(self) -> "EnergyInfrastructureInMemoryCursor":
        return self

    def __exit__(self, *exc: Any) -> None:
        return None

    def execute(self, sql: str, params: list[Any] | None = None) -> None:
        self.conn.calls.append({"sql": sql.strip(), "params": list(params or [])})
        params = list(params or [])
        if not params:
            return
        # Map parameter ordering to the UPSERT_SQL column order:
        # 0  layer_id
        # 1  source_id
        # 2  source_object_id
        # 3  feature_type
        # 4  category
        # 5  geometry_type
        # 6  name
        # 7  operator
        # 8  owner
        # 9  country
        # 10 status
        # 11 fuel_type
        # 12 capacity_mw
        # 13 voltage_kv
        # 14 pipeline_product
        # 15 pipeline_length_km
        # 16 terminal_type
        # 17 geometry_geojson
        # 18 centroid_lat
        # 19 centroid_lon
        # 20 bbox_geojson (passes null when no bbox)
        # 21 bbox_geojson (the CASE branch)
        # 22 source_confidence
        # 23 source_updated_at
        # 24 first_seen_at
        # 25 last_seen_at
        # 26 raw_source_json (text)
        source_id = params[1]
        source_object_id = params[2]
        geom = params[17]
        bbox_geom = params[20]
        bbox_geom_case = params[21]
        raw_text = params[26]

        existing = next(
            (
                r
                for r in self.conn.rows
                if r["source_id"] == source_id
                and r["source_object_id"] == source_object_id
            ),
            None,
        )
        record = {
            "layer_id": params[0],
            "source_id": source_id,
            "source_object_id": source_object_id,
            "feature_type": params[3],
            "category": params[4],
            "geometry_type": params[5],
            "name": params[6],
            "operator": params[7],
            "owner": params[8],
            "country": params[9],
            "status": params[10],
            "fuel_type": params[11],
            "capacity_mw": params[12],
            "voltage_kv": params[13],
            "pipeline_product": params[14],
            "pipeline_length_km": params[15],
            "terminal_type": params[16],
            "geom_geojson": geom,
            "centroid_lat": params[18],
            "centroid_lon": params[19],
            "bbox_geojson": bbox_geom_case if bbox_geom else None,
            "source_confidence": params[22],
            "source_updated_at": params[23],
            "first_seen_at": params[24],
            "last_seen_at": params[25],
            "raw_source_json_text": raw_text,
            "inserted": existing is None,
        }
        if existing is None:
            self.conn.rows.append(record)
        else:
            existing.update(record)
        self._result = [[record.get("id", f"id-{len(self.conn.rows)}"), record["inserted"]]]

    def fetchone(self) -> Any:
        return self._result[0] if self._result else None

    def fetchall(self) -> list[Any]:
        return list(self._result)


def connect_db(database_url: str = DEFAULT_DATABASE_URL) -> Any:
    """Connect to PostGIS, or return an in-memory mock if psycopg is missing.

    The mock is clearly labeled via its ``info`` attribute; production
    callers can check ``getattr(conn, "info", None) == "in-memory-mock"``
    to detect the fallback. Database URLs are never printed.
    """
    try:
        import psycopg  # type: ignore
        from psycopg.rows import dict_row  # type: ignore
    except ImportError:
        return EnergyInfrastructureInMemoryConnection()
    return psycopg.connect(database_url, row_factory=dict_row)


def is_in_memory_connection(conn: Any) -> bool:
    return getattr(conn, "info", None) == "in-memory-mock"


def upsert_feature(
    conn: Any,
    feature: dict[str, Any],
    *,
    dry_run: bool = False,
) -> dict[str, Any]:
    """Upsert a single canonical feature.

    Args:
        conn: A DB connection or an in-memory mock.
        feature: Canonical feature dict from
            ``energy_normalizer._build_canonical_record``.
        dry_run: If True, do not write — just return what would have
            been written. Default ``False``.

    Returns:
        ``{"id": str, "inserted": bool, "skipped": bool, "dry_run": bool}``.

    Raises:
        ValueError: If the feature is missing required fields.
        RuntimeError: If the DB rejects the row.
    """
    missing = [k for k in ("source_id", "source_object_id", "feature_type", "category") if not feature.get(k)]
    if missing:
        raise ValueError(f"Feature missing required fields: {missing}")
    if not feature.get("geometry_geojson"):
        raise ValueError("Feature missing geometry_geojson")
    if feature.get("centroid_lat") is None or feature.get("centroid_lon") is None:
        raise ValueError("Feature missing centroid_lat / centroid_lon")

    now = datetime.now(timezone.utc)
    first_seen = feature.get("first_seen_at") or now
    last_seen = feature.get("last_seen_at") or now

    raw_json = feature.get("raw_source_json") or {}
    raw_text = safe_json_dumps(raw_json) if not isinstance(raw_json, str) else raw_json

    geometry_text = safe_json_dumps(feature["geometry_geojson"])
    bbox_text = (
        safe_json_dumps(feature["bbox_geojson"]) if feature.get("bbox_geojson") else None
    )

    params: list[Any] = [
        feature.get("layer_id") or LAYER_ID,
        feature["source_id"],
        str(feature["source_object_id"]),
        feature["feature_type"],
        feature["category"],
        feature.get("geometry_type"),
        feature.get("name"),
        feature.get("operator"),
        feature.get("owner"),
        feature.get("country"),
        feature.get("status"),
        feature.get("fuel_type"),
        feature.get("capacity_mw"),
        feature.get("voltage_kv"),
        feature.get("pipeline_product"),
        feature.get("pipeline_length_km"),
        feature.get("terminal_type"),
        geometry_text,
        float(feature["centroid_lat"]),
        float(feature["centroid_lon"]),
        bbox_text,
        bbox_text,  # second occurrence: CASE WHEN expression
        feature.get("source_confidence"),
        feature.get("source_updated_at"),
        first_seen,
        last_seen,
        raw_text,
    ]

    if dry_run:
        return {
            "id": "dry-run",
            "inserted": True,
            "skipped": False,
            "dry_run": True,
        }

    try:
        with conn.cursor() as cur:
            cur.execute(UPSERT_SQL, params)
            row = cur.fetchone()
        conn.commit()
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise

    inserted = True
    if isinstance(row, dict):
        inserted = bool(row.get("inserted", True))
    elif isinstance(row, (list, tuple)) and len(row) >= 2:
        inserted = bool(row[1])
    feature_id = None
    if isinstance(row, dict):
        feature_id = row.get("id")
    elif isinstance(row, (list, tuple)) and row:
        feature_id = row[0]
    return {
        "id": str(feature_id) if feature_id is not None else "unknown",
        "inserted": inserted,
        "skipped": False,
        "dry_run": False,
    }


def persist_features(
    conn: Any,
    features: list[dict[str, Any]],
    *,
    dry_run: bool = False,
) -> dict[str, int]:
    """Persist a list of canonical features with row-level safety.

    Returns counters:
    * ``inserted`` — newly inserted rows
    * ``updated`` — updated existing rows
    * ``skipped`` — explicitly skipped (none for now; reserved for future)
    * ``errors`` — rows that failed to persist
    * ``total`` — total rows attempted
    """
    inserted = 0
    updated = 0
    skipped = 0
    errors = 0
    for feat in features:
        try:
            res = upsert_feature(conn, feat, dry_run=dry_run)
            if res.get("dry_run"):
                inserted += 1
            elif res.get("inserted"):
                inserted += 1
            else:
                updated += 1
        except Exception as exc:  # noqa: BLE001
            errors += 1
            # The worker logs the error message; the bad row never
            # blocks the rest of the run because we rollback here.
            print(
                f"[PERSIST] ERROR: failed to persist "
                f"{feat.get('source_id')}/{feat.get('source_object_id')}: {exc}"
            )
    return {
        "inserted": inserted,
        "updated": updated,
        "skipped": skipped,
        "errors": errors,
        "total": len(features),
    }


def get_feature_count(conn: Any) -> int:
    """Return the row count of ``energy_infrastructure``."""
    if is_in_memory_connection(conn):
        return conn.count()
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS cnt FROM energy_infrastructure")
        row = cur.fetchone()
    if isinstance(row, dict):
        return int(row.get("cnt", 0))
    if isinstance(row, (list, tuple)) and row:
        return int(row[0])
    return 0


def get_existing_keys(conn: Any) -> set[tuple[str, str]]:
    """Return the set of ``(source_id, source_object_id)`` already persisted."""
    if is_in_memory_connection(conn):
        return {(r["source_id"], r["source_object_id"]) for r in conn.rows}
    with conn.cursor() as cur:
        cur.execute("SELECT source_id, source_object_id FROM energy_infrastructure")
        rows = cur.fetchall() or []
    out: set[tuple[str, str]] = set()
    for row in rows:
        if isinstance(row, dict):
            sid = row.get("source_id")
            oid = row.get("source_object_id")
        else:
            sid, oid = row[0], row[1]
        if sid is not None and oid is not None:
            out.add((str(sid), str(oid)))
    return out


def describe_db() -> dict[str, Any]:
    """Return a JSON-friendly description (for the worker banner)."""
    return {
        "layer_id": LAYER_ID,
        "default_database_url_set": bool(os.getenv("DATABASE_URL")),
        "upsert_columns": [
            "layer_id", "source_id", "source_object_id", "feature_type", "category",
            "geometry_type", "name", "operator", "owner", "country", "status",
            "fuel_type", "capacity_mw", "voltage_kv", "pipeline_product",
            "pipeline_length_km", "terminal_type", "geom", "centroid_lat", "centroid_lon",
            "bbox", "source_confidence", "source_updated_at", "first_seen_at",
            "last_seen_at", "raw_source_json",
        ],
    }


# Re-export for tests
__all__ = [
    "LAYER_ID",
    "DEFAULT_DATABASE_URL",
    "UPSERT_SQL",
    "connect_db",
    "is_in_memory_connection",
    "upsert_feature",
    "persist_features",
    "get_feature_count",
    "get_existing_keys",
    "EnergyInfrastructureInMemoryConnection",
    "describe_db",
    "safe_json_dumps",
]
