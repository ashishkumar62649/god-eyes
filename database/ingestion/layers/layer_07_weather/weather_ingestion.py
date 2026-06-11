"""Database ingestion for normalized Layer 07 Weather observations.

The module accepts normalized dictionaries and performs parameterized writes to
the approved Weather tables. It does not fetch or normalize source data.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Iterable, Mapping
from datetime import datetime
from typing import Any


LAYER_ID = "layer_07_weather"
DEFAULT_GRID_RESOLUTION = "5deg"
VALID_OBSERVATION_TYPES = frozenset({"current", "hourly"})
VALID_FETCH_STATUSES = frozenset({"running", "completed", "failed", "partial"})

REQUIRED_OBSERVATION_FIELDS = (
    "observation_id",
    "source_id",
    "location_id",
    "observation_type",
    "requested_latitude",
    "requested_longitude",
    "resolved_latitude",
    "resolved_longitude",
    "forecast_for",
    "fetched_at",
    "temperature_c",
)

OBSERVATION_VALUE_FIELDS = (
    "temperature_c",
    "apparent_temperature_c",
    "wind_speed_kph",
    "wind_direction_deg",
    "wind_gust_kph",
    "humidity_percent",
    "pressure_hpa",
    "precipitation_mm",
    "precipitation_probability_percent",
    "cloud_cover_percent",
    "weather_code",
    "weather_label",
)


UPSERT_LOCATION_SQL = """
INSERT INTO weather_locations (
  location_id, layer_id, requested_latitude, requested_longitude,
  resolved_latitude, resolved_longitude, elevation_m, grid_resolution, cell_note
) VALUES (
  %s, %s, %s, %s,
  %s, %s, %s, %s, %s
)
ON CONFLICT (location_id) DO UPDATE SET
  resolved_latitude = EXCLUDED.resolved_latitude,
  resolved_longitude = EXCLUDED.resolved_longitude,
  elevation_m = EXCLUDED.elevation_m,
  grid_resolution = EXCLUDED.grid_resolution,
  cell_note = COALESCE(EXCLUDED.cell_note, weather_locations.cell_note),
  updated_at = NOW()
"""

UPSERT_LATEST_SQL = """
INSERT INTO weather_observations_latest (
  observation_id, layer_id, source_id, location_id, observation_type,
  temperature_c, apparent_temperature_c, wind_speed_kph, wind_direction_deg,
  wind_gust_kph, humidity_percent, pressure_hpa, precipitation_mm,
  precipitation_probability_percent, cloud_cover_percent, weather_code,
  weather_label, forecast_for, fetched_at, is_stale, provider_metadata,
  raw_evidence_uri
) VALUES (
  %s, %s, %s, %s, %s,
  %s, %s, %s, %s,
  %s, %s, %s, %s,
  %s, %s, %s,
  %s, %s, %s, %s, %s::JSONB,
  %s
)
ON CONFLICT (location_id, source_id, observation_type, forecast_for)
DO UPDATE SET
  temperature_c = EXCLUDED.temperature_c,
  apparent_temperature_c = EXCLUDED.apparent_temperature_c,
  wind_speed_kph = EXCLUDED.wind_speed_kph,
  wind_direction_deg = EXCLUDED.wind_direction_deg,
  wind_gust_kph = EXCLUDED.wind_gust_kph,
  humidity_percent = EXCLUDED.humidity_percent,
  pressure_hpa = EXCLUDED.pressure_hpa,
  precipitation_mm = EXCLUDED.precipitation_mm,
  precipitation_probability_percent = EXCLUDED.precipitation_probability_percent,
  cloud_cover_percent = EXCLUDED.cloud_cover_percent,
  weather_code = EXCLUDED.weather_code,
  weather_label = EXCLUDED.weather_label,
  fetched_at = EXCLUDED.fetched_at,
  is_stale = EXCLUDED.is_stale,
  provider_metadata = EXCLUDED.provider_metadata,
  raw_evidence_uri = EXCLUDED.raw_evidence_uri,
  updated_at = NOW()
WHERE EXCLUDED.fetched_at >= weather_observations_latest.fetched_at
"""

INSERT_HISTORY_SQL = """
INSERT INTO weather_observation_history (
  history_id, observation_id, layer_id, source_id, location_id, observation_type,
  temperature_c, apparent_temperature_c, wind_speed_kph, wind_direction_deg,
  wind_gust_kph, humidity_percent, pressure_hpa, precipitation_mm,
  precipitation_probability_percent, cloud_cover_percent, weather_code,
  weather_label, forecast_for, fetched_at, provider_metadata, raw_evidence_uri
) VALUES (
  %s, %s, %s, %s, %s, %s,
  %s, %s, %s, %s,
  %s, %s, %s, %s,
  %s, %s, %s,
  %s, %s, %s, %s::JSONB, %s
)
ON CONFLICT (history_id) DO NOTHING
"""

INSERT_RAW_REF_SQL = """
INSERT INTO weather_raw_message_refs (
  raw_ref_id, fetch_run_id, source_id, layer_id, raw_evidence_uri,
  batch_index, coordinate_count, response_status, response_headers,
  request_metadata, observed_fields, created_at
) VALUES (
  %s, %s, %s, %s, %s,
  %s, %s, %s, %s::JSONB,
  %s::JSONB, %s::JSONB, COALESCE(%s, NOW())
)
ON CONFLICT (raw_ref_id) DO NOTHING
"""

CREATE_FETCH_RUN_SQL = """
INSERT INTO weather_fetch_runs (
  fetch_run_id, source_id, layer_id, grid_resolution, total_cells,
  successful_cells, failed_cells, fetch_started_at, fetch_completed_at,
  api_calls_made, raw_storage_path, status, error_message
) VALUES (
  %s, %s, %s, %s, %s,
  %s, %s, %s, %s,
  %s, %s, %s, %s
)
ON CONFLICT (fetch_run_id) DO UPDATE SET
  successful_cells = EXCLUDED.successful_cells,
  failed_cells = EXCLUDED.failed_cells,
  fetch_completed_at = EXCLUDED.fetch_completed_at,
  api_calls_made = EXCLUDED.api_calls_made,
  raw_storage_path = EXCLUDED.raw_storage_path,
  status = EXCLUDED.status,
  error_message = EXCLUDED.error_message
"""

COMPLETE_FETCH_RUN_SQL = """
UPDATE weather_fetch_runs
SET fetch_completed_at = NOW(),
    status = %s,
    successful_cells = %s,
    failed_cells = %s,
    api_calls_made = %s,
    error_message = %s
WHERE fetch_run_id = %s
"""


def _hash24(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:24]


def build_database_observation_id(
    location_id: str,
    source_id: str,
    observation_type: str,
    forecast_for: Any,
) -> str:
    """Build the type-aware observation identity stored by the database."""
    return _hash24(f"{location_id}|{source_id}|{observation_type}|{forecast_for}")


def build_history_id(observation_id: str, fetched_at: Any) -> str:
    """Build an idempotent history identity for one fetched observation."""
    return _hash24(f"{observation_id}|{fetched_at}")


def build_raw_ref_id(
    fetch_run_id: str | None,
    raw_evidence_uri: str,
    batch_index: int | None,
) -> str:
    """Build an idempotent identity for a raw batch reference."""
    return _hash24(f"{fetch_run_id or ''}|{raw_evidence_uri}|{batch_index}")


def _require_number(value: Any, field: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{field} must be numeric")
    return float(value)


def _validate_range(value: Any, field: str, minimum: float, maximum: float) -> None:
    if value is None:
        return
    number = _require_number(value, field)
    if number < minimum or number > maximum:
        raise ValueError(f"{field} must be between {minimum} and {maximum}")


def validate_weather_observation(observation: Mapping[str, Any]) -> None:
    """Validate one normalized observation before any database writes."""
    if not isinstance(observation, Mapping):
        raise TypeError("observation must be a mapping")

    missing = [field for field in REQUIRED_OBSERVATION_FIELDS if observation.get(field) is None]
    if missing:
        raise ValueError(f"missing required weather observation fields: {', '.join(missing)}")

    for field in ("observation_id", "source_id", "location_id", "forecast_for", "fetched_at"):
        if not str(observation[field]).strip():
            raise ValueError(f"{field} must not be empty")

    observation_type = observation["observation_type"]
    if observation_type not in VALID_OBSERVATION_TYPES:
        raise ValueError("observation_type must be current or hourly")

    layer_id = observation.get("layer_id", LAYER_ID)
    if layer_id != LAYER_ID:
        raise ValueError(f"layer_id must be {LAYER_ID}")

    _validate_range(observation["requested_latitude"], "requested_latitude", -90, 90)
    requested_longitude = _require_number(observation["requested_longitude"], "requested_longitude")
    if requested_longitude < -180 or requested_longitude >= 180:
        raise ValueError("requested_longitude must be at least -180 and less than 180")
    _validate_range(observation["resolved_latitude"], "resolved_latitude", -90, 90)
    _validate_range(observation["resolved_longitude"], "resolved_longitude", -180, 180)
    _require_number(observation["temperature_c"], "temperature_c")

    _validate_range(observation.get("humidity_percent"), "humidity_percent", 0, 100)
    _validate_range(observation.get("cloud_cover_percent"), "cloud_cover_percent", 0, 100)
    _validate_range(
        observation.get("precipitation_probability_percent"),
        "precipitation_probability_percent",
        0,
        100,
    )
    _validate_range(observation.get("wind_direction_deg"), "wind_direction_deg", 0, 360)

    provider_metadata = observation.get("provider_metadata")
    if provider_metadata is not None and not isinstance(provider_metadata, Mapping):
        raise ValueError("provider_metadata must be a mapping or None")


def _database_identity(observation: Mapping[str, Any]) -> tuple[str, dict[str, Any]]:
    logical_observation_id = str(observation["observation_id"])
    database_observation_id = build_database_observation_id(
        str(observation["location_id"]),
        str(observation["source_id"]),
        str(observation["observation_type"]),
        observation["forecast_for"],
    )
    provider_metadata = dict(observation.get("provider_metadata") or {})
    provider_metadata["logical_observation_id"] = logical_observation_id
    return database_observation_id, provider_metadata


def extract_location_record(observation: Mapping[str, Any]) -> dict[str, Any]:
    validate_weather_observation(observation)
    return {
        "location_id": observation["location_id"],
        "layer_id": LAYER_ID,
        "requested_latitude": observation["requested_latitude"],
        "requested_longitude": observation["requested_longitude"],
        "resolved_latitude": observation["resolved_latitude"],
        "resolved_longitude": observation["resolved_longitude"],
        "elevation_m": observation.get("elevation_m"),
        "grid_resolution": observation.get("grid_resolution") or DEFAULT_GRID_RESOLUTION,
        "cell_note": observation.get("cell_note"),
    }


def extract_latest_record(observation: Mapping[str, Any]) -> dict[str, Any]:
    validate_weather_observation(observation)
    observation_id, provider_metadata = _database_identity(observation)
    record = {
        "observation_id": observation_id,
        "layer_id": LAYER_ID,
        "source_id": observation["source_id"],
        "location_id": observation["location_id"],
        "observation_type": observation["observation_type"],
    }
    record.update({field: observation.get(field) for field in OBSERVATION_VALUE_FIELDS})
    record.update(
        {
            "forecast_for": observation["forecast_for"],
            "fetched_at": observation["fetched_at"],
            "is_stale": bool(observation.get("is_stale", False)),
            "provider_metadata": provider_metadata,
            "raw_evidence_uri": observation.get("raw_evidence_uri"),
        }
    )
    return record


def extract_history_record(observation: Mapping[str, Any]) -> dict[str, Any]:
    latest = extract_latest_record(observation)
    latest.pop("is_stale")
    return {
        "history_id": build_history_id(latest["observation_id"], latest["fetched_at"]),
        **latest,
    }


def _json_value(value: Any, default: Any) -> str:
    return json.dumps(default if value is None else value, sort_keys=True, separators=(",", ":"))


def _execute(conn: Any, sql: str, values: list[Any]) -> None:
    with conn.cursor() as cursor:
        cursor.execute(sql, values)


def upsert_weather_location(conn: Any, observation: Mapping[str, Any]) -> None:
    record = extract_location_record(observation)
    _execute(conn, UPSERT_LOCATION_SQL, list(record.values()))


def upsert_weather_latest_observation(conn: Any, observation: Mapping[str, Any]) -> None:
    record = extract_latest_record(observation)
    values = [
        record["observation_id"],
        record["layer_id"],
        record["source_id"],
        record["location_id"],
        record["observation_type"],
        *[record[field] for field in OBSERVATION_VALUE_FIELDS],
        record["forecast_for"],
        record["fetched_at"],
        record["is_stale"],
        _json_value(record["provider_metadata"], {}),
        record["raw_evidence_uri"],
    ]
    _execute(conn, UPSERT_LATEST_SQL, values)


def insert_weather_history_observation(conn: Any, observation: Mapping[str, Any]) -> None:
    record = extract_history_record(observation)
    values = [
        record["history_id"],
        record["observation_id"],
        record["layer_id"],
        record["source_id"],
        record["location_id"],
        record["observation_type"],
        *[record[field] for field in OBSERVATION_VALUE_FIELDS],
        record["forecast_for"],
        record["fetched_at"],
        _json_value(record["provider_metadata"], {}),
        record["raw_evidence_uri"],
    ]
    _execute(conn, INSERT_HISTORY_SQL, values)


def insert_weather_raw_message_ref(conn: Any, raw_ref: Mapping[str, Any]) -> str:
    if not isinstance(raw_ref, Mapping):
        raise TypeError("raw_ref must be a mapping")
    source_id = raw_ref.get("source_id")
    raw_evidence_uri = raw_ref.get("raw_evidence_uri")
    if not source_id or not raw_evidence_uri:
        raise ValueError("raw_ref requires source_id and raw_evidence_uri")

    batch_index = raw_ref.get("batch_index")
    if batch_index is not None and (not isinstance(batch_index, int) or batch_index < 0):
        raise ValueError("batch_index must be a non-negative integer or None")
    coordinate_count = raw_ref.get("coordinate_count")
    if coordinate_count is not None and (
        not isinstance(coordinate_count, int)
        or isinstance(coordinate_count, bool)
        or coordinate_count < 0
    ):
        raise ValueError("coordinate_count must be a non-negative integer or None")
    response_status = raw_ref.get("response_status")
    if response_status is not None and (
        not isinstance(response_status, int)
        or isinstance(response_status, bool)
        or response_status < 100
        or response_status > 599
    ):
        raise ValueError("response_status must be between 100 and 599 or None")

    raw_ref_id = raw_ref.get("raw_ref_id") or build_raw_ref_id(
        raw_ref.get("fetch_run_id"),
        str(raw_evidence_uri),
        batch_index,
    )
    values = [
        raw_ref_id,
        raw_ref.get("fetch_run_id"),
        source_id,
        LAYER_ID,
        raw_evidence_uri,
        batch_index,
        coordinate_count,
        response_status,
        _json_value(raw_ref.get("response_headers"), {}),
        _json_value(raw_ref.get("request_metadata"), {}),
        _json_value(raw_ref.get("observed_fields"), []),
        raw_ref.get("created_at"),
    ]
    _execute(conn, INSERT_RAW_REF_SQL, values)
    return str(raw_ref_id)


def _validate_fetch_counts(total_cells: int, successful_cells: int, failed_cells: int) -> None:
    for field, value in (
        ("total_cells", total_cells),
        ("successful_cells", successful_cells),
        ("failed_cells", failed_cells),
    ):
        if not isinstance(value, int) or isinstance(value, bool) or value < 0:
            raise ValueError(f"{field} must be a non-negative integer")
    if successful_cells + failed_cells > total_cells:
        raise ValueError("successful_cells + failed_cells must not exceed total_cells")


def _parse_datetime(value: Any, field: str) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str) and value.strip():
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError(f"{field} must be an ISO 8601 timestamp") from exc
    raise ValueError(f"{field} must be a datetime or ISO 8601 timestamp")


def create_weather_fetch_run(conn: Any, fetch_run: Mapping[str, Any]) -> None:
    if not isinstance(fetch_run, Mapping):
        raise TypeError("fetch_run must be a mapping")
    required = ("fetch_run_id", "source_id", "grid_resolution", "total_cells", "fetch_started_at")
    missing = [field for field in required if fetch_run.get(field) is None]
    if missing:
        raise ValueError(f"missing required fetch run fields: {', '.join(missing)}")
    for field in ("fetch_run_id", "source_id", "grid_resolution"):
        if not str(fetch_run[field]).strip():
            raise ValueError(f"{field} must not be empty")

    successful_cells = fetch_run.get("successful_cells", 0)
    failed_cells = fetch_run.get("failed_cells", 0)
    total_cells = fetch_run["total_cells"]
    _validate_fetch_counts(total_cells, successful_cells, failed_cells)
    status = fetch_run.get("status", "running")
    if status not in VALID_FETCH_STATUSES:
        raise ValueError("invalid weather fetch run status")
    api_calls_made = fetch_run.get("api_calls_made", 0)
    if not isinstance(api_calls_made, int) or isinstance(api_calls_made, bool) or api_calls_made < 0:
        raise ValueError("api_calls_made must be a non-negative integer")
    fetch_started_at = _parse_datetime(fetch_run["fetch_started_at"], "fetch_started_at")
    fetch_completed_value = fetch_run.get("fetch_completed_at")
    if fetch_completed_value is not None:
        fetch_completed_at = _parse_datetime(fetch_completed_value, "fetch_completed_at")
        if fetch_completed_at < fetch_started_at:
            raise ValueError("fetch_completed_at must not be before fetch_started_at")

    values = [
        fetch_run["fetch_run_id"],
        fetch_run["source_id"],
        LAYER_ID,
        fetch_run["grid_resolution"],
        total_cells,
        successful_cells,
        failed_cells,
        fetch_run["fetch_started_at"],
        fetch_completed_value,
        api_calls_made,
        fetch_run.get("raw_storage_path"),
        status,
        fetch_run.get("error_message"),
    ]
    _execute(conn, CREATE_FETCH_RUN_SQL, values)


def complete_weather_fetch_run(
    conn: Any,
    fetch_run_id: str,
    status: str,
    successful_cells: int,
    failed_cells: int,
    api_calls_made: int,
    error_message: str | None = None,
) -> None:
    if status not in VALID_FETCH_STATUSES:
        raise ValueError("invalid weather fetch run status")
    if not fetch_run_id:
        raise ValueError("fetch_run_id is required")
    for field, value in (
        ("successful_cells", successful_cells),
        ("failed_cells", failed_cells),
        ("api_calls_made", api_calls_made),
    ):
        if not isinstance(value, int) or isinstance(value, bool) or value < 0:
            raise ValueError(f"{field} must be a non-negative integer")
    _execute(
        conn,
        COMPLETE_FETCH_RUN_SQL,
        [status, successful_cells, failed_cells, api_calls_made, error_message, fetch_run_id],
    )


def _write_weather_observation(conn: Any, observation: Mapping[str, Any]) -> None:
    upsert_weather_location(conn, observation)
    upsert_weather_latest_observation(conn, observation)
    insert_weather_history_observation(conn, observation)


def ingest_weather_observation(conn: Any, observation: Mapping[str, Any]) -> dict[str, Any]:
    """Atomically ingest one normalized observation."""
    validate_weather_observation(observation)
    try:
        _write_weather_observation(conn, observation)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return extract_history_record(observation)


def ingest_weather_observations(
    conn: Any,
    observations: Iterable[Mapping[str, Any]],
    fetch_run: Mapping[str, Any] | None = None,
    raw_refs: Iterable[Mapping[str, Any]] | None = None,
) -> dict[str, int]:
    """Atomically ingest observations and optional fetch audit records."""
    observation_list = list(observations)
    raw_ref_list = list(raw_refs or [])
    for observation in observation_list:
        validate_weather_observation(observation)

    try:
        if fetch_run is not None:
            create_weather_fetch_run(conn, fetch_run)
        for observation in observation_list:
            _write_weather_observation(conn, observation)
        for raw_ref in raw_ref_list:
            insert_weather_raw_message_ref(conn, raw_ref)
        conn.commit()
    except Exception:
        conn.rollback()
        raise

    return {
        "observations_ingested": len(observation_list),
        "locations_upserted": len(observation_list),
        "latest_upserts": len(observation_list),
        "history_inserts_attempted": len(observation_list),
        "raw_refs_inserted": len(raw_ref_list),
        "fetch_runs_created": int(fetch_run is not None),
    }
