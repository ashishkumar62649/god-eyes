"""Database ingestion for normalized GDELT Event Export records."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Iterable, Mapping
from datetime import datetime, timezone
from typing import Any


LAYER_ID = "layer_08_news_osint"
SOURCE_ID = "gdelt_event_export"
SOURCE_FAMILY = "global_event"
CONTENT_TYPE = "event"
RUN_TYPE = "ingestion"

_HISTORY_FIELDS = (
    "source_object_id",
    "source_url",
    "title",
    "summary",
    "published_at",
    "source_updated_at",
    "location_confidence",
    "country_code",
    "city",
    "latitude",
    "longitude",
    "geometry_type",
    "has_coordinates",
    "marker_ready",
    "category",
    "subcategory",
    "severity",
    "source_domain",
    "attribution",
    "provider_metadata",
)

_CREATE_FETCH_RUN_SQL = """
INSERT INTO news_fetch_runs (
  fetch_run_id, layer_id, source_id, source_family, run_type, status,
  started_at, fetched_item_count, normalized_item_count, marker_ready_count,
  skipped_item_count, raw_output_uri, normalized_output_uri, provider_metadata
) VALUES (
  %s, %s, %s, %s, %s, 'running',
  %s, %s, %s, %s,
  %s, %s, %s, %s::JSONB
)
"""

_COMPLETE_FETCH_RUN_SQL = """
UPDATE news_fetch_runs
SET completed_at = %s,
    status = 'success',
    fetched_item_count = %s,
    normalized_item_count = %s,
    marker_ready_count = %s,
    skipped_item_count = %s,
    raw_output_uri = %s,
    normalized_output_uri = %s,
    provider_metadata = %s::JSONB
WHERE fetch_run_id = %s
"""

_SELECT_LATEST_SQL = """
SELECT * FROM news_items_latest WHERE dedupe_key = %s
"""

_SELECT_HISTORY_VERSION_SQL = """
SELECT COALESCE(MAX(version), 0) AS version
FROM news_item_history
WHERE item_id = %s
"""

_UPSERT_LATEST_SQL = """
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
  source_object_id = EXCLUDED.source_object_id,
  source_url = EXCLUDED.source_url,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  content_type = EXCLUDED.content_type,
  published_at = EXCLUDED.published_at,
  source_updated_at = EXCLUDED.source_updated_at,
  fetched_at = EXCLUDED.fetched_at,
  last_seen_at = EXCLUDED.last_seen_at,
  location_confidence = EXCLUDED.location_confidence,
  country_code = EXCLUDED.country_code,
  country_name = EXCLUDED.country_name,
  region = EXCLUDED.region,
  city = EXCLUDED.city,
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
  source_language = EXCLUDED.source_language,
  source_country = EXCLUDED.source_country,
  confidence_score = EXCLUDED.confidence_score,
  duplicate_of = EXCLUDED.duplicate_of,
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
  %s::JSONB, %s, %s, %s
)
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


def _hash24(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:24]


def _json_dumps(value: Any) -> str:
    return json.dumps(value, sort_keys=True, ensure_ascii=False, default=str)


def _fetchone(conn: Any, sql: str, values: list[Any]) -> Any:
    with conn.cursor() as cursor:
        cursor.execute(sql, values)
        return cursor.fetchone()


def _execute(conn: Any, sql: str, values: list[Any]) -> None:
    with conn.cursor() as cursor:
        cursor.execute(sql, values)


def _row_value(row: Any, key: str, index: int = 0) -> Any:
    if row is None:
        return None
    if isinstance(row, Mapping):
        return row.get(key)
    return row[index]


def _parse_timestamp(value: Any, field: str) -> datetime | None:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str):
        text = value.strip()
        parsed = None
        for fmt in ("%Y%m%d%H%M%S", "%Y%m%d"):
            try:
                parsed = datetime.strptime(text, fmt).replace(tzinfo=timezone.utc)
                break
            except ValueError:
                pass
        if parsed is None:
            try:
                parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
            except ValueError as exc:
                raise ValueError(f"{field} must be an ISO 8601 or GDELT timestamp") from exc
    else:
        raise ValueError(f"{field} must be a datetime or timestamp string")

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def build_item_id(dedupe_key: str) -> str:
    return _hash24(f"news_item|{dedupe_key}")


def build_history_id(item_id: str, version: int) -> str:
    return _hash24(f"news_history|{item_id}|v{version}")


def build_raw_ref_id(fetch_run_id: str, dedupe_key: str) -> str:
    return _hash24(f"news_raw_ref|{fetch_run_id}|{dedupe_key}")


def validate_gdelt_item(item: Mapping[str, Any]) -> None:
    if not isinstance(item, Mapping):
        raise TypeError("normalized item must be a mapping")
    if item.get("layer_id") != LAYER_ID:
        raise ValueError(f"layer_id must be {LAYER_ID}")
    if item.get("source_id") != SOURCE_ID:
        raise ValueError(f"source_id must be {SOURCE_ID}")
    if item.get("source_family") != SOURCE_FAMILY:
        raise ValueError(f"source_family must be {SOURCE_FAMILY}")

    source_object_id = str(item.get("source_event_id") or "").strip()
    expected_dedupe_key = f"{SOURCE_ID}:{source_object_id}"
    if not source_object_id:
        raise ValueError("source_event_id is required")
    if item.get("dedupe_key") != expected_dedupe_key:
        raise ValueError(f"dedupe_key must be {expected_dedupe_key}")
    for field in ("title", "category", "attribution"):
        if not item.get(field):
            raise ValueError(f"{field} is required")

    lat = item.get("latitude")
    lon = item.get("longitude")
    has_coordinates = lat is not None and lon is not None
    if (lat is None) != (lon is None):
        raise ValueError("latitude and longitude must be provided together")
    if has_coordinates:
        if not -90 <= float(lat) <= 90:
            raise ValueError("latitude must be between -90 and 90")
        if not -180 <= float(lon) <= 180:
            raise ValueError("longitude must be between -180 and 180")
    if bool(item.get("has_coordinates")) != has_coordinates:
        raise ValueError("has_coordinates must match the coordinate pair")
    if item.get("marker_ready") and (
        not has_coordinates or item.get("geometry_type") != "Point"
    ):
        raise ValueError("marker_ready requires valid Point coordinates")

    _parse_timestamp(item.get("published_at"), "published_at")
    _parse_timestamp(item.get("source_updated_at"), "source_updated_at")
    _parse_timestamp(item.get("fetched_at"), "fetched_at")


def _extract_record(
    item: Mapping[str, Any],
    *,
    observed_at: datetime,
    raw_evidence_uri: str,
) -> dict[str, Any]:
    has_coordinates = item.get("latitude") is not None and item.get("longitude") is not None
    return {
        "item_id": build_item_id(item["dedupe_key"]),
        "layer_id": LAYER_ID,
        "source_id": SOURCE_ID,
        "source_family": SOURCE_FAMILY,
        "source_object_id": str(item["source_event_id"]),
        "dedupe_key": item["dedupe_key"],
        "source_url": item.get("source_url") or None,
        "title": item["title"],
        "summary": item.get("summary"),
        "content_type": CONTENT_TYPE,
        "published_at": _parse_timestamp(item.get("published_at"), "published_at"),
        "source_updated_at": _parse_timestamp(
            item.get("source_updated_at"), "source_updated_at"
        ),
        "fetched_at": _parse_timestamp(item.get("fetched_at"), "fetched_at") or observed_at,
        "first_seen_at": observed_at,
        "last_seen_at": observed_at,
        "location_confidence": item.get("location_confidence") or "unknown",
        "country_code": item.get("country_code"),
        "country_name": None,
        "region": None,
        "city": item.get("location_name"),
        "latitude": item.get("latitude"),
        "longitude": item.get("longitude"),
        "geometry_type": item.get("geometry_type"),
        "geo_source": "provided" if has_coordinates else "none",
        "has_coordinates": has_coordinates,
        "marker_ready": bool(item.get("marker_ready")),
        "category": item["category"],
        "subcategory": item.get("subcategory"),
        "severity": item.get("severity") or "unknown",
        "source_domain": item.get("source_domain"),
        "source_language": None,
        "source_country": None,
        "confidence_score": None,
        "duplicate_of": None,
        "raw_evidence_uri": raw_evidence_uri,
        "attribution": item["attribution"],
        "provider_metadata": item.get("provider_metadata") or {},
        "is_active": True,
    }


def _compare_value(value: Any) -> Any:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat()
    if isinstance(value, Mapping):
        return _json_dumps(value)
    return value


def _changed_fields(existing: Mapping[str, Any], record: Mapping[str, Any]) -> list[str]:
    return [
        field
        for field in _HISTORY_FIELDS
        if _compare_value(existing.get(field)) != _compare_value(record.get(field))
    ]


def _snapshot(record: Mapping[str, Any]) -> dict[str, Any]:
    excluded = {"first_seen_at", "last_seen_at", "is_active"}
    return {
        key: _compare_value(value)
        for key, value in record.items()
        if key not in excluded and value is not None
    }


def _upsert_latest(conn: Any, record: Mapping[str, Any]) -> None:
    columns = (
        "item_id", "layer_id", "source_id", "source_family", "source_object_id",
        "dedupe_key", "source_url", "title", "summary", "content_type",
        "published_at", "source_updated_at", "fetched_at", "first_seen_at", "last_seen_at",
        "location_confidence", "country_code", "country_name", "region", "city",
        "latitude", "longitude", "geometry_type", "geo_source",
        "has_coordinates", "marker_ready", "category", "subcategory", "severity",
        "source_domain", "source_language", "source_country",
        "confidence_score", "duplicate_of", "raw_evidence_uri", "attribution",
    )
    values = [record[column] for column in columns]
    values.extend((_json_dumps(record["provider_metadata"]), record["is_active"]))
    _execute(conn, _UPSERT_LATEST_SQL, values)


def _insert_history(
    conn: Any,
    record: Mapping[str, Any],
    *,
    version: int,
    changed_fields: list[str] | None,
    fetch_run_id: str,
    recorded_at: datetime,
) -> None:
    _execute(
        conn,
        _INSERT_HISTORY_SQL,
        [
            build_history_id(record["item_id"], version),
            record["item_id"],
            LAYER_ID,
            SOURCE_ID,
            record["dedupe_key"],
            version,
            _json_dumps(_snapshot(record)),
            changed_fields,
            fetch_run_id,
            recorded_at,
        ],
    )


def _insert_raw_ref(
    conn: Any,
    record: Mapping[str, Any],
    *,
    fetch_run_id: str,
) -> None:
    _execute(
        conn,
        _INSERT_RAW_REF_SQL,
        [
            build_raw_ref_id(fetch_run_id, record["dedupe_key"]),
            fetch_run_id,
            LAYER_ID,
            SOURCE_ID,
            record["source_object_id"],
            record["dedupe_key"],
            record["raw_evidence_uri"],
            _json_dumps({"global_event_id": record["source_object_id"]}),
        ],
    )


def ingest_gdelt_run(
    conn: Any,
    items: Iterable[Mapping[str, Any]],
    *,
    fetch_run_id: str,
    raw_output_uri: str,
    normalized_output_uri: str | None = None,
    fetched_item_count: int | None = None,
    observed_at: datetime | str | None = None,
    provider_metadata: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Write one normalized GDELT run atomically and return explicit counts."""
    item_list = list(items)
    if not fetch_run_id.strip():
        raise ValueError("fetch_run_id is required")
    if not raw_output_uri.strip():
        raise ValueError("raw_output_uri is required")
    for item in item_list:
        validate_gdelt_item(item)
    dedupe_keys = [item["dedupe_key"] for item in item_list]
    if len(dedupe_keys) != len(set(dedupe_keys)):
        raise ValueError("normalized batch contains duplicate dedupe keys")

    run_time = _parse_timestamp(observed_at, "observed_at") or datetime.now(timezone.utc)
    fetched_count = len(item_list) if fetched_item_count is None else fetched_item_count
    if fetched_count < len(item_list):
        raise ValueError("fetched_item_count cannot be less than normalized item count")

    marker_ready_count = sum(bool(item.get("marker_ready")) for item in item_list)
    inserted = 0
    updated = 0
    unchanged = 0
    history_inserted = 0

    try:
        _execute(
            conn,
            _CREATE_FETCH_RUN_SQL,
            [
                fetch_run_id,
                LAYER_ID,
                SOURCE_ID,
                SOURCE_FAMILY,
                RUN_TYPE,
                run_time,
                fetched_count,
                len(item_list),
                marker_ready_count,
                fetched_count - len(item_list),
                raw_output_uri,
                normalized_output_uri,
                _json_dumps(provider_metadata or {}),
            ],
        )

        for item in item_list:
            existing_row = _fetchone(conn, _SELECT_LATEST_SQL, [item["dedupe_key"]])
            existing = dict(existing_row) if existing_row else None
            record = _extract_record(
                item,
                observed_at=run_time,
                raw_evidence_uri=raw_output_uri,
            )
            if existing:
                record["item_id"] = existing["item_id"]
                record["first_seen_at"] = existing["first_seen_at"]
                changed = _changed_fields(existing, record)
            else:
                changed = None

            _upsert_latest(conn, record)

            if existing is None or changed:
                version_row = _fetchone(
                    conn, _SELECT_HISTORY_VERSION_SQL, [record["item_id"]]
                )
                version = int(_row_value(version_row, "version") or 0) + 1
                _insert_history(
                    conn,
                    record,
                    version=version,
                    changed_fields=changed,
                    fetch_run_id=fetch_run_id,
                    recorded_at=run_time,
                )
                history_inserted += 1

            _insert_raw_ref(conn, record, fetch_run_id=fetch_run_id)

            if existing is None:
                inserted += 1
            elif changed:
                updated += 1
            else:
                unchanged += 1

        _execute(
            conn,
            _COMPLETE_FETCH_RUN_SQL,
            [
                run_time,
                fetched_count,
                len(item_list),
                marker_ready_count,
                fetched_count - len(item_list),
                raw_output_uri,
                normalized_output_uri,
                _json_dumps(provider_metadata or {}),
                fetch_run_id,
            ],
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise

    return {
        "fetch_run_id": fetch_run_id,
        "fetched_items": fetched_count,
        "normalized_items": len(item_list),
        "stored_latest_items": len(item_list),
        "inserted_latest": inserted,
        "updated_latest": updated,
        "unchanged_latest": unchanged,
        "history_rows_inserted": history_inserted,
        "raw_refs_inserted": len(item_list),
        "marker_ready_items": marker_ready_count,
        "list_only_items": len(item_list) - marker_ready_count,
    }
