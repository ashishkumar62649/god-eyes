import copy
import json
import subprocess
from pathlib import Path

import pytest

from database.ingestion.layers.layer_07_weather import weather_ingestion


REPO_ROOT = Path(__file__).resolve().parents[3]


def sample_observation(**overrides):
    observation = {
        "observation_id": "normalizer-logical-id",
        "layer_id": "layer_07_weather",
        "source_id": "open-meteo",
        "location_id": "location-test",
        "observation_type": "current",
        "requested_latitude": 28.6139,
        "requested_longitude": 77.2090,
        "resolved_latitude": 28.625,
        "resolved_longitude": 77.25,
        "elevation_m": 216.0,
        "grid_resolution": "5deg",
        "forecast_for": "2026-06-10T12:00:00Z",
        "fetched_at": "2026-06-10T11:55:00Z",
        "temperature_c": 34.5,
        "apparent_temperature_c": 37.1,
        "wind_speed_kph": 12.0,
        "wind_direction_deg": 180.0,
        "wind_gust_kph": 18.0,
        "humidity_percent": 45,
        "pressure_hpa": 1001.2,
        "precipitation_mm": 0.0,
        "precipitation_probability_percent": None,
        "cloud_cover_percent": 20,
        "weather_code": 1,
        "weather_label": "Mainly Clear",
        "raw_evidence_uri": "raw/layer_07_weather/open-meteo/test/batch_001.json",
        "provider_metadata": {"location_id": 1, "surface_pressure_hpa": 998.0},
    }
    observation.update(overrides)
    return observation


class RecordingCursor:
    def __init__(self, connection):
        self.connection = connection

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def execute(self, sql, values):
        self.connection.executions.append((sql, values))
        if self.connection.fail_on and self.connection.fail_on in sql:
            raise RuntimeError("forced database failure")


class RecordingConnection:
    def __init__(self, fail_on=None):
        self.executions = []
        self.fail_on = fail_on
        self.commits = 0
        self.rollbacks = 0

    def cursor(self):
        return RecordingCursor(self)

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


def compact_sql(sql):
    return " ".join(sql.lower().split())


def test_ingestion_module_and_required_functions_exist():
    required = (
        "build_history_id",
        "validate_weather_observation",
        "extract_location_record",
        "extract_latest_record",
        "extract_history_record",
        "upsert_weather_location",
        "upsert_weather_latest_observation",
        "insert_weather_history_observation",
        "insert_weather_raw_message_ref",
        "create_weather_fetch_run",
        "complete_weather_fetch_run",
        "ingest_weather_observation",
        "ingest_weather_observations",
    )
    for function_name in required:
        assert callable(getattr(weather_ingestion, function_name))


def test_history_id_is_deterministic_and_fetch_specific():
    first = weather_ingestion.build_history_id("db-observation", "2026-06-10T12:00:00Z")
    repeated = weather_ingestion.build_history_id("db-observation", "2026-06-10T12:00:00Z")
    later = weather_ingestion.build_history_id("db-observation", "2026-06-10T12:05:00Z")

    assert len(first) == 24
    assert first == repeated
    assert first != later


def test_raw_ref_id_is_deterministic_and_batch_specific():
    first = weather_ingestion.build_raw_ref_id("run-1", "raw/test.json", 0)
    repeated = weather_ingestion.build_raw_ref_id("run-1", "raw/test.json", 0)
    second_batch = weather_ingestion.build_raw_ref_id("run-1", "raw/test.json", 1)

    assert len(first) == 24
    assert first == repeated
    assert first != second_batch


@pytest.mark.parametrize("field", weather_ingestion.REQUIRED_OBSERVATION_FIELDS)
def test_required_field_validation(field):
    observation = sample_observation()
    observation[field] = None

    with pytest.raises(ValueError, match="missing required"):
        weather_ingestion.validate_weather_observation(observation)


def test_invalid_observation_type_is_rejected():
    with pytest.raises(ValueError, match="observation_type"):
        weather_ingestion.validate_weather_observation(sample_observation(observation_type="daily"))


@pytest.mark.parametrize(
    ("field", "value"),
    (
        ("requested_latitude", 91),
        ("requested_longitude", 180),
        ("resolved_latitude", -91),
        ("resolved_longitude", 181),
    ),
)
def test_coordinate_range_validation(field, value):
    with pytest.raises(ValueError, match=field):
        weather_ingestion.validate_weather_observation(sample_observation(**{field: value}))


def test_location_record_uses_default_grid_and_keeps_requested_coordinates():
    observation = sample_observation(grid_resolution=None)
    record = weather_ingestion.extract_location_record(observation)

    assert record["grid_resolution"] == "5deg"
    assert record["requested_latitude"] == observation["requested_latitude"]
    assert record["requested_longitude"] == observation["requested_longitude"]
    assert record["resolved_latitude"] == observation["resolved_latitude"]
    assert "geom" not in record


def test_latest_record_uses_type_aware_database_identity_without_mutating_input():
    observation = sample_observation()
    original = copy.deepcopy(observation)
    record = weather_ingestion.extract_latest_record(observation)

    expected = weather_ingestion.build_database_observation_id(
        observation["location_id"],
        observation["source_id"],
        observation["observation_type"],
        observation["forecast_for"],
    )
    assert record["observation_id"] == expected
    assert record["provider_metadata"]["logical_observation_id"] == observation["observation_id"]
    assert record["raw_evidence_uri"] == observation["raw_evidence_uri"]
    assert observation == original


def test_current_hourly_normalizer_identity_collision_is_resolved_for_database():
    from layers.layer_07_weather.weather_normalizer import build_observation_id

    normalizer_id = build_observation_id(
        "location-test",
        "open-meteo",
        "2026-06-10T12:00:00Z",
    )
    current = sample_observation(observation_type="current", observation_id=normalizer_id)
    hourly = sample_observation(observation_type="hourly", observation_id=normalizer_id)

    assert current["observation_id"] == hourly["observation_id"]
    current_record = weather_ingestion.extract_latest_record(current)
    hourly_record = weather_ingestion.extract_latest_record(hourly)
    assert current_record["observation_id"] != hourly_record["observation_id"]
    assert current_record["provider_metadata"]["logical_observation_id"] == normalizer_id
    assert hourly_record["provider_metadata"]["logical_observation_id"] == normalizer_id


def test_history_record_uses_database_identity_and_fetched_at():
    first = weather_ingestion.extract_history_record(sample_observation())
    later = weather_ingestion.extract_history_record(
        sample_observation(fetched_at="2026-06-10T12:05:00Z")
    )

    assert first["observation_id"] == later["observation_id"]
    assert first["history_id"] != later["history_id"]


def test_latest_upsert_uses_approved_conflict_target_and_serializes_metadata():
    connection = RecordingConnection()
    weather_ingestion.upsert_weather_latest_observation(connection, sample_observation())
    sql, values = connection.executions[0]

    assert (
        "on conflict (location_id, source_id, observation_type, forecast_for)"
        in compact_sql(sql)
    )
    serialized_metadata = json.loads(values[-2])
    assert serialized_metadata["location_id"] == 1
    assert serialized_metadata["logical_observation_id"] == "normalizer-logical-id"
    assert values[-1].endswith("batch_001.json")


def test_location_upsert_preserves_requested_coordinates_on_conflict():
    sql = compact_sql(weather_ingestion.UPSERT_LOCATION_SQL)

    assert "on conflict (location_id) do update" in sql
    update_clause = sql.split("do update set", 1)[1]
    assert "resolved_latitude = excluded.resolved_latitude" in update_clause
    assert "resolved_longitude = excluded.resolved_longitude" in update_clause
    assert "requested_latitude =" not in update_clause
    assert "requested_longitude =" not in update_clause
    assert "geom" not in weather_ingestion.UPSERT_LOCATION_SQL.lower()


def test_history_insert_is_idempotent():
    connection = RecordingConnection()
    weather_ingestion.insert_weather_history_observation(connection, sample_observation())
    sql, values = connection.executions[0]

    assert "on conflict (history_id) do nothing" in compact_sql(sql)
    assert len(values[0]) == 24
    assert values[1] == weather_ingestion.extract_latest_record(sample_observation())["observation_id"]


def test_raw_ref_insert_generates_identity_and_serializes_json_fields():
    connection = RecordingConnection()
    raw_ref = {
        "fetch_run_id": "run-test",
        "source_id": "open-meteo",
        "raw_evidence_uri": "raw/test/batch_001.json",
        "batch_index": 0,
        "coordinate_count": 2,
        "response_status": 200,
        "response_headers": {"content-type": "application/json"},
        "request_metadata": {"grid_resolution": "5deg"},
        "observed_fields": ["current", "hourly"],
    }

    raw_ref_id = weather_ingestion.insert_weather_raw_message_ref(connection, raw_ref)
    sql, values = connection.executions[0]
    assert "insert into weather_raw_message_refs" in compact_sql(sql)
    assert raw_ref_id == weather_ingestion.build_raw_ref_id("run-test", raw_ref["raw_evidence_uri"], 0)
    assert json.loads(values[8])["content-type"] == "application/json"
    assert json.loads(values[9])["grid_resolution"] == "5deg"
    assert json.loads(values[10]) == ["current", "hourly"]


def test_fetch_run_create_and_complete_sql():
    connection = RecordingConnection()
    weather_ingestion.create_weather_fetch_run(
        connection,
        {
            "fetch_run_id": "run-test",
            "source_id": "open-meteo",
            "grid_resolution": "5deg",
            "total_cells": 2,
            "fetch_started_at": "2026-06-10T11:00:00Z",
        },
    )
    weather_ingestion.complete_weather_fetch_run(
        connection,
        "run-test",
        "completed",
        successful_cells=2,
        failed_cells=0,
        api_calls_made=1,
    )

    assert "insert into weather_fetch_runs" in compact_sql(connection.executions[0][0])
    assert "on conflict (fetch_run_id) do update" in compact_sql(connection.executions[0][0])
    assert "update weather_fetch_runs" in compact_sql(connection.executions[1][0])
    assert connection.executions[1][1][-1] == "run-test"


def test_invalid_fetch_run_counts_are_rejected_before_write():
    connection = RecordingConnection()
    with pytest.raises(ValueError, match="must not exceed"):
        weather_ingestion.create_weather_fetch_run(
            connection,
            {
                "fetch_run_id": "run-test",
                "source_id": "open-meteo",
                "grid_resolution": "5deg",
                "total_cells": 1,
                "successful_cells": 1,
                "failed_cells": 1,
                "fetch_started_at": "2026-06-10T11:00:00Z",
            },
        )
    assert connection.executions == []


def test_fetch_run_completion_must_not_precede_start():
    connection = RecordingConnection()
    with pytest.raises(ValueError, match="must not be before"):
        weather_ingestion.create_weather_fetch_run(
            connection,
            {
                "fetch_run_id": "run-test",
                "source_id": "open-meteo",
                "grid_resolution": "5deg",
                "total_cells": 1,
                "fetch_started_at": "2026-06-10T12:00:00Z",
                "fetch_completed_at": "2026-06-10T11:00:00Z",
            },
        )
    assert connection.executions == []


@pytest.mark.parametrize(
    ("field", "value", "message"),
    (
        ("batch_index", -1, "batch_index"),
        ("coordinate_count", -1, "coordinate_count"),
        ("response_status", 99, "response_status"),
        ("response_status", 600, "response_status"),
    ),
)
def test_raw_ref_ranges_are_validated_before_write(field, value, message):
    connection = RecordingConnection()
    raw_ref = {
        "source_id": "open-meteo",
        "raw_evidence_uri": "raw/test/batch_001.json",
        field: value,
    }
    with pytest.raises(ValueError, match=message):
        weather_ingestion.insert_weather_raw_message_ref(connection, raw_ref)
    assert connection.executions == []


def test_batch_ingestion_commits_once_and_writes_all_table_types():
    connection = RecordingConnection()
    current = sample_observation()
    hourly = sample_observation(
        observation_type="hourly",
        observation_id="normalizer-hourly-id",
        forecast_for="2026-06-10T13:00:00Z",
        precipitation_probability_percent=10,
    )
    stats = weather_ingestion.ingest_weather_observations(
        connection,
        [current, hourly],
        fetch_run={
            "fetch_run_id": "run-test",
            "source_id": "open-meteo",
            "grid_resolution": "5deg",
            "total_cells": 1,
            "successful_cells": 1,
            "fetch_started_at": "2026-06-10T11:00:00Z",
        },
        raw_refs=[
            {
                "fetch_run_id": "run-test",
                "source_id": "open-meteo",
                "raw_evidence_uri": "raw/test/batch_001.json",
                "batch_index": 0,
            }
        ],
    )

    executed_sql = " ".join(compact_sql(sql) for sql, _ in connection.executions)
    assert "weather_fetch_runs" in executed_sql
    assert "weather_locations" in executed_sql
    assert "weather_observations_latest" in executed_sql
    assert "weather_observation_history" in executed_sql
    assert "weather_raw_message_refs" in executed_sql
    assert connection.commits == 1
    assert connection.rollbacks == 0
    assert stats["observations_ingested"] == 2


def test_batch_ingestion_rolls_back_on_database_failure():
    connection = RecordingConnection(fail_on="weather_observation_history")

    with pytest.raises(RuntimeError, match="forced database failure"):
        weather_ingestion.ingest_weather_observations(connection, [sample_observation()])

    assert connection.commits == 0
    assert connection.rollbacks == 1


def test_ingestion_module_has_no_network_fetch_or_application_dependencies():
    source = Path(weather_ingestion.__file__).read_text(encoding="utf-8").lower()

    for forbidden in (
        "requests",
        "urllib",
        "httpx",
        "open_meteo_client",
        "weather_normalizer",
        "apps.api",
        "apps.web",
    ):
        assert forbidden not in source


def test_weather_ingestion_work_order_changes_stay_in_allowed_paths():
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    changed_paths = [
        line[3:].replace("\\", "/")
        for line in result.stdout.splitlines()
        if line and not line.startswith("?? .pytest_cache/")
    ]

    if not changed_paths:
        pytest.skip("Scope guard applies only during dirty worktree review")

    allowed_prefixes = (
        "database/ingestion/",
        "services/fetch-orchestrator/src/layers/layer_07_weather/",
        "tests/data/layer_07_weather/",
        "docs/state/HANDOFF_LOG.md",
        "specs/006-layer-07-weather-mvp/DATABASE_PLANNING.md",
        "specs/006-layer-07-weather-mvp/OPEN_QUESTIONS.md",
    )
    assert all(path.startswith(allowed_prefixes) for path in changed_paths), changed_paths


def test_weather_ingestion_work_order_tracks_no_raw_or_environment_files():
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    changed_paths = [line[3:].replace("\\", "/") for line in result.stdout.splitlines() if line]

    assert not any(path.startswith(("raw/", "data/", "database/raw/")) for path in changed_paths)
    assert not any(path.endswith(".env") or ".env." in path for path in changed_paths)
    assert not any(path.startswith(("apps/api/", "apps/web/")) for path in changed_paths)
    assert not any(
        path.startswith("services/fetch-orchestrator/")
        and not path.startswith("services/fetch-orchestrator/src/layers/layer_07_weather/")
        for path in changed_paths
    )
