"""Database ingestion for normalized Layer 08 News & OSINT GDACS events.

The module accepts normalized dictionaries and performs parameterized writes to
the approved News tables. It does not fetch or normalize source data.

Tables written:
  - news_fetch_runs
  - news_items_latest
  - news_item_history
  - news_raw_message_refs
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Iterable, Mapping
from datetime import datetime, timezone
from typing import Any


LAYER_ID = "layer_08_news_osint"
SOURCE_ID = "gdacs"
SOURCE_FAMILY = "disaster_alert"
RUN_TYPE_PROOF = "proof"

VALID_FETCH_STATUSES = frozenset({"running", "success", "partial", "failed"})

# Fields compared to decide whether a history version bump is warranted.
_HISTORY_CHANGE_FIELDS = frozenset({
    "title",
    "summary",
    "source_url",
    "published_at",
    "source_updated_at",
    "severity",
    "category",
    "subcategory",
    "latitude",
    "longitude",
    "country_code",
    "country_name",
    "geometry_type",
    "has_coordinates",
    "marker_ready",
    "confidence_score",
    "attribution",
})

_HISTORY_TRACKED_FIELDS = sorted(_HISTORY_CHANGE_FIELDS)


# ---------------------------------------------------------------------------
# SQL statements
# ---------------------------------------------------------------------------

_CREATE_FETCH_RUN_SQL = """
INSERT INTO news_fetch_runs (
  fetch_run_id, layer_id, source_id, source_family, run_type, status,
  started_at, fetched_item_count, normalized_item_count, marker_ready_count,
  skipped_item_count, error_message, raw_output_uri, normalized_output_uri,
  provider_metadata
) VALUES (
  %s, %s, %s, %s, %s, %s,
  %s, %s, %s, %s,
  %s, %s, %s, %s,
  %s::JSONB
)
ON CONFLICT (fetch_run_id) DO UPDATE SET
  status = EXCLUDED.status,
  fetched_item_count = EXCLUDED.fetched_item_count,
  normalized_item_count = EXCLUDED.normalized_item_count,
  marker_ready_count = EXCLUDED.marker_ready_count,
  skipped_item_count = EXCLUDED.skipped_item_count,
  raw_output_uri = EXCLUDED.raw_output_uri,
  normalized_output_uri = EXCLUDED.normalized_output_uri,
  provider_metadata = EXCLUDED.provider_metadata
"""

_COMPLETE_FETCH_RUN_SQL = """
UPDATE news_fetch_runs
SET completed_at = NOW(),
    status = %s,
    fetched_item_count = %s,
    normalized_item_count = %s,
    marker_ready_count = %s,
    skipped_item_count = %s,
    raw_output_uri = %s,
    normalized_output_uri = %s,
    error_message = %s,
    provider_metadata = %s::JSONB
WHERE fetch_run_id = %s
"""

UPSERT_LATEST_SQL = """
INSERT INTO news_items_latest (
  item_id, layer_id, source_id, source_family, source_object_id,
  dedupe_key, source_url, title, summary, content_type,
  published_at, source_updated_at, fetched_at, first_seen_at, last_seen_at,
  location_confidence, country_code, country_name, region, city,
  latitude, longitude, geometry_type, geo_source,
  has_coordinates, marker_ready, category, subcategory, severity,
  source_domain, source_language, source_country,
  confidence_score, duplicate_of, raw_evidence_uri, attribution,
  provider_metadata, is_active
) VALUES (
  %s, %s, %s, %s, %s,
  %s, %s, %s, %s, %s,
  %s, %s, %s, %s, %s,
  %s, %s, %s, %s, %s,
  %s, %s, %s, %s,
  %s, %s, %s, %s, %s,
  %s, %s, %s,
  %s, %s, %s, %s,
  %s::JSONB, %s
)
ON CONFLICT (dedupe_key) DO UPDATE SET
  item_id = news_items_latest.item_id,
  source_object_id = EXCLUDED.source_object_id,
  source_url = EXCLUDED.source_url,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  published_at = EXCLUDED.published_at,
  source_updated_at = EXCLUDED.source_updated_at,
  fetched_at = EXCLUDED.fetched_at,
  last_seen_at = EXCLUDED.last_seen_at,
  location_confidence = EXCLUDED.location_confidence,
  country_code = EXCLUDED.country_code,
  country_name = EXCLUDED.country_name,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  geometry_type = EXCLUDED.geometry_type,
  geo_source = EXCLUDED.geo_source,
  has_coordinates = EXCLUDED.has_coordinates,
  marker_ready = EXCLUDED.marker_ready,
  category = EXCLUDED.category,
  subcategory = EXCLUDED.subcategory,
  severity = EXCLUDED.severity,
  source_domain = EXCLUDED.source_domain,
  confidence_score = EXCLUDED.confidence_score,
  raw_evidence_uri = EXCLUDED.raw_evidence_uri,
  attribution = EXCLUDED.attribution,
  provider_metadata = EXCLUDED.provider_metadata,
  is_active = EXCLUDED.is_active,
  updated_at = NOW()
"""

_INSERT_HISTORY_SQL = """
INSERT INTO news_item_history (
  history_id, item_id, layer_id, source_id, dedupe_key, version,
  snapshot, changed_fields, fetch_run_id, recorded_at
) VALUES (
  %s, %s, %s, %s, %s, %s,
  %s::JSONB, %s, %s, NOW()
)
ON CONFLICT (history_id) DO NOTHING
"""

_INSERT_RAW_REF_SQL = """
INSERT INTO news_raw_message_refs (
  raw_ref_id, fetch_run_id, layer_id, source_id, source_object_id,
  dedupe_key, raw_evidence_uri, provider_metadata
) VALUES (
  %s, %s, %s, %s, %s,
  %s, %s, %s::JSONB
)
ON CONFLICT (raw_ref_id) DO NOTHING
"""

_SELECT_ITEM_BY_DEDUPE_SQL = """
SELECT item_id, version
FROM news_item_history
WHERE dedupe_key = %s
ORDER BY version DESC
LIMIT 1
"""

_SELECT_LATEST_BY_DEDUPE_SQL = """
SELECT *
FROM news_items_latest
WHERE dedupe_key = %s
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _hash24(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:24]


def _execute(conn: Any, sql: str, values: list[Any]) -> None:
    with conn.cursor() as cursor:
        cursor.execute(sql, values)


def _execute_fetchone(conn: Any, sql: str, values: list[Any]) -> Any:
    with conn.cursor() as cursor:
        cursor.execute(sql, values)
        return cursor.fetchone()


def _json_dumps(value: Any) -> str:
    return json.dumps(value, sort_keys=True, ensure_ascii=False, default=str)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_datetime(value: Any, field: str) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str) and value.strip():
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError(f"{field} must be an ISO 8601 timestamp") from exc
    raise ValueError(f"{field} must be a datetime or ISO 8601 timestamp")


def build_item_id(dedupe_key: str) -> str:
    """Derive a stable item_id from the dedupe_key."""
    return _hash24(f"news_item|{dedupe_key}")


def build_history_id(item_id: str, version: int) -> str:
    """Build an idempotent history identity."""
    return _hash24(f"news_history|{item_id}|v{version}")


def build_raw_ref_id(fetch_run_id: str, dedupe_key: str) -> str:
    """Build an idempotent raw reference identity."""
    return _hash24(f"news_raw_ref|{fetch_run_id}|{dedupe_key}")


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def validate_normalized_item(item: Mapping[str, Any]) -> None:
    """Validate one normalized item before any database writes."""
    if not isinstance(item, Mapping):
        raise TypeError("normalized item must be a mapping")

    required = ("source_id", "source_family", "dedupe_key", "title", "content_type", "category")
    missing = [f for f in required if not item.get(f)]
    if missing:
        raise ValueError(f"missing required normalized fields: {', '.join(missing)}")

    location = item.get("location") or {}
    if not isinstance(location, Mapping):
        raise ValueError("location must be a mapping or None")

    if item.get("marker_ready"):
        lat = location.get("latitude")
        lon = location.get("longitude")
        geo_type = location.get("geometry_type")
        if lat is None or lon is None:
            raise ValueError("marker_ready item must have latitude and longitude in location")
        if geo_type != "Point":
            raise ValueError("marker_ready item must have geometry_type = Point")
        if not (-90 <= float(lat) <= 90):
            raise ValueError("latitude must be between -90 and 90")
        if not (-180 <= float(lon) <= 180):
            raise ValueError("longitude must be between -180 and 180")


# ---------------------------------------------------------------------------
# Record extraction
# ---------------------------------------------------------------------------

def _extract_latest_record(item: Mapping[str, Any], now: str) -> dict[str, Any]:
    """Convert a normalized item dict to the latest-row record shape."""
    location = item.get("location") or {}
    marker_ready = bool(item.get("marker_ready", False))
    has_coordinates = bool(location.get("latitude") is not None and location.get("longitude") is not None)

    geo_source = location.get("geo_source", "none")
    if marker_ready and has_coordinates:
        geo_source = "provided"

    confidence = location.get("confidence", "unknown")
    confidence_score = 1.0 if confidence == "exact_coordinate" else None

    return {
        "item_id": build_item_id(item["dedupe_key"]),
        "layer_id": LAYER_ID,
        "source_id": item["source_id"],
        "source_family": item["source_family"],
        "source_object_id": item.get("source_object_id"),
        "dedupe_key": item["dedupe_key"],
        "source_url": item.get("source_url"),
        "title": item["title"],
        "summary": item.get("summary"),
        "content_type": item["content_type"],
        "published_at": item.get("published_at"),
        "source_updated_at": item.get("updated_at"),
        "fetched_at": item.get("fetched_at", now),
        "first_seen_at": now,
        "last_seen_at": now,
        "location_confidence": confidence,
        "country_code": location.get("country_code"),
        "country_name": location.get("country_name"),
        "region": None,
        "city": None,
        "latitude": location.get("latitude"),
        "longitude": location.get("longitude"),
        "geometry_type": location.get("geometry_type"),
        "geo_source": geo_source,
        "has_coordinates": has_coordinates,
        "marker_ready": marker_ready,
        "category": item["category"],
        "subcategory": item.get("subcategory"),
        "severity": item.get("severity", "unknown"),
        "source_domain": item.get("source_domain"),
        "source_language": None,
        "source_country": None,
        "confidence_score": confidence_score,
        "duplicate_of": item.get("duplicate_of"),
        "raw_evidence_uri": item.get("raw_evidence_uri"),
        "attribution": item["attribution"],
        "provider_metadata": item.get("provider_metadata") or {},
        "is_active": True,
    }


def _snapshot_from_record(record: dict[str, Any]) -> dict[str, Any]:
    """Create a JSON-serialisable snapshot from a latest record."""
    snapshot: dict[str, Any] = {}
    for key in (
        "item_id", "source_id", "source_family", "source_object_id",
        "dedupe_key", "source_url", "title", "summary", "content_type",
        "published_at", "source_updated_at", "fetched_at",
        "location_confidence", "country_code", "country_name",
        "latitude", "longitude", "geometry_type", "has_coordinates",
        "marker_ready", "category", "subcategory", "severity",
        "source_domain", "confidence_score", "raw_evidence_uri",
        "attribution",
    ):
        val = record.get(key)
        if val is not None:
            snapshot[key] = val
    pm = record.get("provider_metadata")
    if pm:
        snapshot["provider_metadata"] = pm
    return snapshot


# ---------------------------------------------------------------------------
# Core ingestion functions
# ---------------------------------------------------------------------------

def create_fetch_run(
    conn: Any,
    fetch_run_id: str,
    *,
    run_type: str = RUN_TYPE_PROOF,
    started_at: str | None = None,
) -> None:
    """Insert a new fetch run row with status=running."""
    now = started_at or _now_iso()
    values = [
        fetch_run_id,
        LAYER_ID,
        SOURCE_ID,
        SOURCE_FAMILY,
        run_type,
        "running",
        now,
        0, 0, 0, 0,
        None, None, None,
        "{}",
    ]
    _execute(conn, _CREATE_FETCH_RUN_SQL, values)


def complete_fetch_run(
    conn: Any,
    fetch_run_id: str,
    *,
    status: str,
    fetched_item_count: int,
    normalized_item_count: int,
    marker_ready_count: int,
    skipped_item_count: int,
    raw_output_uri: str | None = None,
    normalized_output_uri: str | None = None,
    error_message: str | None = None,
    provider_metadata: dict[str, Any] | None = None,
) -> None:
    """Update a fetch run row to completed status."""
    if status not in VALID_FETCH_STATUSES:
        raise ValueError(f"status must be one of {VALID_FETCH_STATUSES}")
    values = [
        status,
        fetched_item_count,
        normalized_item_count,
        marker_ready_count,
        skipped_item_count,
        raw_output_uri,
        normalized_output_uri,
        error_message,
        _json_dumps(provider_metadata or {}),
        fetch_run_id,
    ]
    _execute(conn, _COMPLETE_FETCH_RUN_SQL, values)


def upsert_latest_item(
    conn: Any,
    item: Mapping[str, Any],
    *,
    fetched_at: str | None = None,
) -> dict[str, Any]:
    """Upsert one normalized item into news_items_latest.

    Returns the latest record dict written to the database.
    If the item already exists (dedupe_key match), first_seen_at and item_id
    are preserved from the existing row.
    """
    now = fetched_at or _now_iso()
    record = _extract_latest_record(item, now)

    existing = _execute_fetchone(conn, _SELECT_LATEST_BY_DEDUPE_SQL, [item["dedupe_key"]])
    if existing:
        record["item_id"] = existing["item_id"]
        record["first_seen_at"] = existing["first_seen_at"]
    record["last_seen_at"] = now

    values = [
        record["item_id"],
        record["layer_id"],
        record["source_id"],
        record["source_family"],
        record["source_object_id"],
        record["dedupe_key"],
        record["source_url"],
        record["title"],
        record["summary"],
        record["content_type"],
        record["published_at"],
        record["source_updated_at"],
        record["fetched_at"],
        record["first_seen_at"],
        record["last_seen_at"],
        record["location_confidence"],
        record["country_code"],
        record["country_name"],
        record["region"],
        record["city"],
        record["latitude"],
        record["longitude"],
        record["geometry_type"],
        record["geo_source"],
        record["has_coordinates"],
        record["marker_ready"],
        record["category"],
        record["subcategory"],
        record["severity"],
        record["source_domain"],
        record["source_language"],
        record["source_country"],
        record["confidence_score"],
        record["duplicate_of"],
        record["raw_evidence_uri"],
        record["attribution"],
        _json_dumps(record["provider_metadata"]),
        record["is_active"],
    ]
    _execute(conn, UPSERT_LATEST_SQL, values)
    return record


def _fields_differ(a: dict[str, Any], b: dict[str, Any]) -> list[str]:
    """Return the list of tracked fields that differ between two records."""
    changed: list[str] = []
    for field in _HISTORY_TRACKED_FIELDS:
        val_a = a.get(field)
        val_b = b.get(field)
        if val_a != val_b:
            changed.append(field)
    return changed


def append_history(
    conn: Any,
    item: Mapping[str, Any],
    fetch_run_id: str | None = None,
    *,
    fetched_at: str | None = None,
) -> dict[str, Any] | None:
    """Append a history version for a normalized item.

    Returns the history record if a new version was created, or None if
    the item is unchanged and no history row is needed.
    """
    now = fetched_at or _now_iso()
    dedupe_key = item["dedupe_key"]

    existing_row = _execute_fetchone(conn, _SELECT_ITEM_BY_DEDUPE_SQL, [dedupe_key])

    if existing_row is None:
        version = 1
        changed_fields_list: list[str] | None = None
        item_id = build_item_id(dedupe_key)
    else:
        item_id = existing_row["item_id"]
        current_version = existing_row["version"]

        latest_row = _execute_fetchone(
            conn,
            "SELECT * FROM news_items_latest WHERE item_id = %s",
            [item_id],
        )

        new_record = _extract_latest_record(item, now)
        if latest_row:
            changed = _fields_differ(dict(latest_row), new_record)
            if not changed:
                return None
            changed_fields_list = changed
        else:
            changed_fields_list = None

        version = current_version + 1

    new_record = _extract_latest_record(item, now)
    snapshot = _snapshot_from_record(new_record)
    history_id = build_history_id(item_id, version)

    values = [
        history_id,
        item_id,
        LAYER_ID,
        item["source_id"],
        dedupe_key,
        version,
        _json_dumps(snapshot),
        changed_fields_list,
        fetch_run_id,
    ]
    _execute(conn, _INSERT_HISTORY_SQL, values)

    return {
        "history_id": history_id,
        "item_id": item_id,
        "version": version,
        "changed_fields": changed_fields_list,
    }


def insert_raw_ref(
    conn: Any,
    item: Mapping[str, Any],
    fetch_run_id: str,
) -> str:
    """Insert a raw message reference for one normalized item."""
    dedupe_key = item["dedupe_key"]
    raw_ref_id = build_raw_ref_id(fetch_run_id, dedupe_key)

    pm = item.get("provider_metadata") or {}

    values = [
        raw_ref_id,
        fetch_run_id,
        LAYER_ID,
        item["source_id"],
        item.get("source_object_id"),
        dedupe_key,
        item.get("raw_evidence_uri") or f"gdacs:live:{dedupe_key}",
        _json_dumps(pm),
    ]
    _execute(conn, _INSERT_RAW_REF_SQL, values)
    return raw_ref_id


# ---------------------------------------------------------------------------
# High-level batch ingestion
# ---------------------------------------------------------------------------

def ingest_gdacs_items(
    conn: Any,
    items: Iterable[Mapping[str, Any]],
    *,
    fetch_run_id: str,
    fetched_at: str | None = None,
) -> dict[str, int]:
    """Ingest a batch of normalized GDACS items atomically.

    For each item:
      1. Upsert into news_items_latest (deduplicated by dedupe_key).
      2. Append history version if new or changed.
      3. Insert raw message reference.

    Returns a summary dict with counts.
    """
    item_list = list(items)
    now = fetched_at or _now_iso()

    inserted = 0
    updated = 0
    unchanged = 0
    history_inserted = 0
    raw_refs_inserted = 0
    errors: list[str] = []

    try:
        for item in item_list:
            try:
                validate_normalized_item(item)
            except (TypeError, ValueError) as exc:
                errors.append(f"validation error for {item.get('dedupe_key', '?')}: {exc}")
                continue

            dedupe_key = item["dedupe_key"]
            existing = _execute_fetchone(
                conn,
                "SELECT item_id FROM news_items_latest WHERE dedupe_key = %s",
                [dedupe_key],
            )
            is_new = existing is None

            upsert_latest_item(conn, item, fetched_at=now)

            if is_new:
                inserted += 1
            else:
                updated += 1

            history_rec = append_history(conn, item, fetch_run_id, fetched_at=now)
            if history_rec is not None:
                history_inserted += 1
            else:
                unchanged += 1

            insert_raw_ref(conn, item, fetch_run_id)
            raw_refs_inserted += 1

        conn.commit()
    except Exception:
        conn.rollback()
        raise

    return {
        "inserted_latest": inserted,
        "updated_latest": updated,
        "unchanged_latest": unchanged,
        "history_rows_inserted": history_inserted,
        "raw_refs_inserted": raw_refs_inserted,
        "errors": errors,
    }


# ---------------------------------------------------------------------------
# DB table counts helper
# ---------------------------------------------------------------------------

def _count_db_tables(conn: Any) -> dict[str, int]:
    """Count rows in the four news tables."""
    tables = [
        "news_fetch_runs",
        "news_items_latest",
        "news_item_history",
        "news_raw_message_refs",
    ]
    counts: dict[str, int] = {}
    for table in tables:
        with conn.cursor() as cursor:
            cursor.execute(f"SELECT count(*) FROM {table}")
            counts[table] = cursor.fetchone()[0]
    return counts
