import re
import subprocess
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATION_PATH = (
    REPO_ROOT
    / "database"
    / "migrations"
    / "layers"
    / "layer_07_weather"
    / "001_weather_tables.sql"
)


def migration_text() -> str:
    if not MIGRATION_PATH.exists():
        return ""
    return MIGRATION_PATH.read_text(encoding="utf-8")


def compact_sql() -> str:
    return re.sub(r"\s+", " ", migration_text().lower()).strip()


def table_columns(table_name: str) -> set[str]:
    match = re.search(
        rf"CREATE TABLE IF NOT EXISTS {table_name} \((.*?)\n\);",
        migration_text(),
        flags=re.IGNORECASE | re.DOTALL,
    )
    assert match, f"{table_name} not found"

    columns = set()
    for raw_line in match.group(1).splitlines():
        line = raw_line.strip()
        if not line or line.startswith("CONSTRAINT"):
            continue
        columns.add(line.split()[0].strip(",").lower())
    return columns


def test_weather_migration_exists_and_defines_all_tables():
    sql = compact_sql()

    assert MIGRATION_PATH.exists()
    for table_name in (
        "weather_sources",
        "weather_fetch_runs",
        "weather_locations",
        "weather_observations_latest",
        "weather_observation_history",
        "weather_raw_message_refs",
    ):
        assert f"create table if not exists {table_name}" in sql


def test_open_meteo_source_seed_is_idempotent_and_layer_aware():
    sql = compact_sql()

    assert "insert into weather_sources" in sql
    assert "'open-meteo'" in sql
    assert "'open-meteo'" in sql
    assert "'https://open-meteo.com/'" in sql
    assert "'cc-by 4.0'" in sql
    assert "weather data provided by open-meteo under cc-by 4.0 licence." in sql
    assert "on conflict (source_id) do update set" in sql
    assert "layer_id text not null default 'layer_07_weather'" in sql


def test_latest_and_history_match_normalized_observation_contract():
    core_columns = {
        "observation_id",
        "layer_id",
        "source_id",
        "location_id",
        "observation_type",
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
        "forecast_for",
        "fetched_at",
        "provider_metadata",
        "raw_evidence_uri",
        "created_at",
    }

    assert core_columns.issubset(table_columns("weather_observations_latest"))
    assert core_columns.issubset(table_columns("weather_observation_history"))
    assert "updated_at" in table_columns("weather_observations_latest")
    assert "is_stale" in table_columns("weather_observations_latest")
    assert "history_id" in table_columns("weather_observation_history")


def test_provider_metadata_and_raw_evidence_columns_are_structured_and_auditable():
    sql = compact_sql()

    assert sql.count("provider_metadata jsonb not null default '{}'::jsonb") == 2
    for table_name in (
        "weather_observations_latest",
        "weather_observation_history",
        "weather_raw_message_refs",
    ):
        assert "raw_evidence_uri" in table_columns(table_name)

    assert "response_headers jsonb" in sql
    assert "request_metadata jsonb" in sql
    assert "observed_fields jsonb" in sql
    assert "raw_payload" not in sql
    assert "response_body" not in sql


def test_weather_locations_uses_real_postgis_geometry_and_gist_index():
    sql = compact_sql()

    assert "geom geometry(point, 4326) not null" in sql
    assert "st_setsrid( st_makepoint(new.resolved_longitude, new.resolved_latitude), 4326 )" in sql
    assert "on weather_locations using gist(geom)" in sql
    assert "select resolved_longitude" not in sql
    assert "select resolved_latitude" not in sql
    assert "using gist (st_point" not in sql


def test_latest_unique_index_preserves_current_and_hourly_forecast_slots():
    sql = compact_sql()

    assert (
        "create unique index if not exists idx_weather_latest_location_source_type_time "
        "on weather_observations_latest(location_id, source_id, observation_type, forecast_for)"
    ) in sql


def test_history_uses_fetch_specific_identity_for_append_only_rows():
    sql = compact_sql()
    history_match = re.search(
        r"create table if not exists weather_observation_history \((.*?)\);",
        sql,
    )

    assert history_match
    assert "history_id text primary key" in sql
    assert "observation_id text not null" in sql
    assert (
        "create index if not exists idx_weather_history_observation_id "
        "on weather_observation_history(observation_id)"
    ) in sql
    assert "observation_id text primary key" not in history_match.group(1)


def test_checks_cover_observation_types_percentages_coordinates_and_runs():
    sql = compact_sql()

    assert sql.count("check (observation_type in ('current', 'hourly'))") == 2
    assert sql.count("humidity_percent >= 0 and humidity_percent <= 100") == 2
    assert sql.count("cloud_cover_percent >= 0 and cloud_cover_percent <= 100") == 2
    assert sql.count(
        "precipitation_probability_percent >= 0 and precipitation_probability_percent <= 100"
    ) == 2
    assert sql.count("wind_direction_deg >= 0 and wind_direction_deg <= 360") == 2
    assert "requested_longitude >= -180 and requested_longitude < 180" in sql
    assert "resolved_longitude >= -180 and resolved_longitude <= 180" in sql
    assert "successful_cells + failed_cells <= total_cells" in sql
    assert "status in ('running', 'completed', 'failed', 'partial')" in sql
    assert "response_status >= 100 and response_status <= 599" in sql


def test_source_and_location_foreign_keys_are_explicit():
    sql = compact_sql()

    assert sql.count("foreign key (source_id) references weather_sources(source_id)") == 4
    assert sql.count("foreign key (location_id) references weather_locations(location_id)") == 2
    assert "foreign key (fetch_run_id) references weather_fetch_runs(fetch_run_id)" in sql


def test_indexes_cover_api_filters_auditing_and_json_metadata():
    sql = compact_sql()

    required_indexes = (
        "idx_weather_fetch_runs_source_id",
        "idx_weather_fetch_runs_started_at",
        "idx_weather_locations_geom_gist",
        "idx_weather_latest_forecast_for",
        "idx_weather_latest_fetched_at",
        "idx_weather_latest_not_stale",
        "idx_weather_latest_temperature_c",
        "idx_weather_latest_weather_code",
        "idx_weather_latest_provider_metadata_gin",
        "idx_weather_history_forecast_for",
        "idx_weather_history_fetched_at",
        "idx_weather_history_provider_metadata_gin",
        "idx_weather_raw_refs_raw_evidence_uri",
        "idx_weather_raw_refs_request_metadata_gin",
        "idx_weather_raw_refs_observed_fields_gin",
    )
    for index_name in required_indexes:
        assert f"create index if not exists {index_name}" in sql


def test_migration_is_additive_schema_only_and_contains_no_credentials():
    sql = compact_sql()

    for forbidden_term in (
        "drop table",
        "drop column",
        "drop extension",
        "truncate",
        "delete from",
        "api_key",
        "apikey",
        "password",
        ".env",
    ):
        assert forbidden_term not in sql

    assert "insert into weather_sources" in sql
    assert "insert into weather_observations" not in sql
    assert "insert into weather_observation_history" not in sql


def test_weather_work_order_changes_stay_in_allowed_paths():
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
        "database/migrations/layers/layer_07_weather/",
        "database/ingestion/",
        "tests/data/layer_07_weather/",
        "docs/state/HANDOFF_LOG.md",
        "specs/006-layer-07-weather-mvp/DATABASE_PLANNING.md",
        "specs/006-layer-07-weather-mvp/OPEN_QUESTIONS.md",
    )
    assert all(path.startswith(allowed_prefixes) for path in changed_paths), changed_paths


def test_weather_work_order_adds_no_raw_or_environment_files():
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
    assert not any(path.startswith("services/fetch-orchestrator/") for path in changed_paths)
