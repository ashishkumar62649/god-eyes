import json
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
    / "layer_06_maritime"
    / "001_maritime_tables.sql"
)
FIXTURE_DIR = Path(__file__).parent / "fixtures" / "normalized"
POSITIONS_FIXTURE = FIXTURE_DIR / "normalized_positions.jsonl"
STATIC_FIXTURE = FIXTURE_DIR / "normalized_static.jsonl"
VESSELS_LATEST_FIXTURE = FIXTURE_DIR / "normalized_vessels_latest.jsonl"


def migration_text() -> str:
    if not MIGRATION_PATH.exists():
        return ""
    return MIGRATION_PATH.read_text(encoding="utf-8")


def migration_lower() -> str:
    return migration_text().lower()


def compact_sql(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower()).strip()


def load_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def assert_terms_present(sql: str, terms: list[str]) -> None:
    for term in terms:
        assert term.lower() in sql


def table_columns(table_name: str) -> set[str]:
    sql = migration_text()
    match = re.search(
        rf"CREATE TABLE IF NOT EXISTS {table_name} \((.*?)\n\);",
        sql,
        flags=re.IGNORECASE | re.DOTALL,
    )
    assert match, f"{table_name} not found"
    columns = set()
    for raw_line in match.group(1).splitlines():
        line = raw_line.strip()
        if not line or line.startswith("CONSTRAINT"):
            continue
        column = line.split()[0].strip(",")
        columns.add(column.lower())
    return columns


def test_maritime_migration_exists_and_creates_required_tables():
    sql = migration_lower()

    assert MIGRATION_PATH.exists()
    assert_terms_present(
        sql,
        [
            "create extension if not exists pgcrypto",
            "create extension if not exists postgis",
            "create table if not exists maritime_sources",
            "create table if not exists maritime_fetch_runs",
            "create table if not exists maritime_vessels",
            "create table if not exists maritime_positions_latest",
            "create table if not exists maritime_position_history",
            "create table if not exists maritime_raw_message_refs",
        ],
    )


def test_maritime_sources_and_fetch_runs_have_source_and_run_contract():
    sql = migration_lower()

    assert_terms_present(
        sql,
        [
            "id uuid primary key default gen_random_uuid()",
            "layer_id text not null default 'layer_06_maritime'",
            "source_id text not null",
            "source_family text not null default 'ais'",
            "source_type text not null",
            "display_name text not null",
            "coverage text",
            "is_active boolean not null default true",
            "config_json jsonb not null default '{}'::jsonb",
            "run_id text not null",
            "run_mode text not null",
            "started_at timestamptz not null",
            "ended_at timestamptz",
            "duration_seconds double precision",
            "total_messages integer not null default 0",
            "position_messages integer not null default 0",
            "static_messages integer not null default 0",
            "unique_mmsi_count integer not null default 0",
            "errors_json jsonb not null default '[]'::jsonb",
            "raw_path text",
            "status text not null default 'running'",
        ],
    )


def test_maritime_vessels_has_static_identity_latest_fields():
    required_columns = {
        "id",
        "layer_id",
        "source_id",
        "source_family",
        "source_object_id",
        "mmsi",
        "dedupe_key",
        "imo",
        "callsign",
        "vessel_name",
        "vessel_type_code",
        "vessel_type",
        "destination",
        "eta_month",
        "eta_day",
        "eta_hour",
        "eta_minute",
        "eta_display",
        "draught_meters",
        "dimension_a",
        "dimension_b",
        "dimension_c",
        "dimension_d",
        "length_meters",
        "width_meters",
        "last_position_at",
        "last_received_at",
        "raw_evidence_uri",
        "provider_metadata",
        "created_at",
        "updated_at",
    }

    assert required_columns.issubset(table_columns("maritime_vessels"))


def test_maritime_positions_latest_matches_position_record_shape_and_postgis():
    required_columns = {
        "id",
        "layer_id",
        "source_id",
        "source_family",
        "source_object_id",
        "mmsi",
        "dedupe_key",
        "latitude",
        "longitude",
        "geom",
        "speed_over_ground",
        "course_over_ground",
        "true_heading",
        "navigation_status",
        "navigation_status_text",
        "position_accuracy",
        "ais_timestamp_second",
        "metadata_time_utc",
        "received_at",
        "raw_evidence_uri",
        "provider_metadata",
        "created_at",
        "updated_at",
    }

    assert required_columns.issubset(table_columns("maritime_positions_latest"))
    assert "geom geometry(point, 4326)" in migration_lower()
    assert "st_setsrid(st_makepoint(new.longitude, new.latitude), 4326)" in migration_lower()


def test_maritime_history_and_raw_refs_preserve_auditability_without_raw_blobs():
    sql = migration_lower()

    assert_terms_present(
        sql,
        [
            "create table if not exists maritime_position_history",
            "create table if not exists maritime_raw_message_refs",
            "fetch_run_id uuid references maritime_fetch_runs(id)",
            "message_type text not null",
            "raw_evidence_uri text not null",
            "provider_metadata jsonb not null default '{}'::jsonb",
        ],
    )
    assert "raw_json" not in sql
    assert "raw_payload" not in sql
    assert "payload_json" not in sql


def test_maritime_unique_constraints_support_source_mmsi_upserts():
    sql = compact_sql(migration_text())

    assert_terms_present(
        sql,
        [
            "constraint maritime_vessels_source_mmsi_unique unique (source_id, mmsi)",
            "constraint maritime_positions_latest_source_mmsi_unique unique (source_id, mmsi)",
            "constraint maritime_vessels_dedupe_key_check check (dedupe_key = source_id || ':' || mmsi::text)",
            "constraint maritime_positions_latest_dedupe_key_check check (dedupe_key = source_id || ':' || mmsi::text)",
            "constraint maritime_vessels_source_object_id_mmsi_check check (source_object_id = mmsi::text)",
            "constraint maritime_positions_latest_source_object_id_mmsi_check check (source_object_id = mmsi::text)",
        ],
    )


def test_maritime_constraints_cover_layer_coordinates_motion_and_partial_eta():
    sql = compact_sql(migration_text())

    assert_terms_present(
        sql,
        [
            "layer_id = 'layer_06_maritime'",
            "constraint maritime_positions_latest_latitude_check check (latitude >= -90 and latitude <= 90)",
            "constraint maritime_positions_latest_longitude_check check (longitude >= -180 and longitude <= 180)",
            "constraint maritime_position_history_latitude_check check (latitude >= -90 and latitude <= 90)",
            "constraint maritime_position_history_longitude_check check (longitude >= -180 and longitude <= 180)",
            "constraint maritime_positions_latest_speed_over_ground_check check (speed_over_ground is null or speed_over_ground >= 0)",
            "constraint maritime_positions_latest_course_over_ground_check check (course_over_ground is null or (course_over_ground >= 0 and course_over_ground <= 360))",
            "constraint maritime_positions_latest_true_heading_check check (true_heading is null or (true_heading >= 0 and true_heading <= 359))",
            "constraint maritime_vessels_eta_month_check check (eta_month is null or (eta_month >= 1 and eta_month <= 12))",
            "constraint maritime_vessels_eta_day_check check (eta_day is null or (eta_day >= 1 and eta_day <= 31))",
            "constraint maritime_vessels_eta_hour_check check (eta_hour is null or (eta_hour >= 0 and eta_hour <= 23))",
            "constraint maritime_vessels_eta_minute_check check (eta_minute is null or (eta_minute >= 0 and eta_minute <= 59))",
        ],
    )
    assert " eta timestamptz" not in sql
    assert " eta timestamp" not in sql


def test_maritime_indexes_support_layer_source_mmsi_bbox_and_time_queries():
    sql = compact_sql(migration_text())

    assert_terms_present(
        sql,
        [
            "create index if not exists idx_maritime_sources_layer_source on maritime_sources(layer_id, source_id)",
            "create index if not exists idx_maritime_fetch_runs_layer_source on maritime_fetch_runs(layer_id, source_id)",
            "create index if not exists idx_maritime_vessels_layer_source on maritime_vessels(layer_id, source_id)",
            "create index if not exists idx_maritime_vessels_mmsi on maritime_vessels(mmsi)",
            "create index if not exists idx_maritime_vessels_vessel_type on maritime_vessels(vessel_type)",
            "create index if not exists idx_maritime_vessels_last_received_at on maritime_vessels(last_received_at desc)",
            "create index if not exists idx_maritime_positions_latest_layer_source on maritime_positions_latest(layer_id, source_id)",
            "create index if not exists idx_maritime_positions_latest_mmsi on maritime_positions_latest(mmsi)",
            "create index if not exists idx_maritime_positions_latest_received_at on maritime_positions_latest(received_at desc)",
            "create index if not exists idx_maritime_positions_latest_geom_gist on maritime_positions_latest using gist(geom)",
            "create index if not exists idx_maritime_positions_latest_bbox on maritime_positions_latest(longitude, latitude)",
            "create index if not exists idx_maritime_position_history_source_object_time on maritime_position_history(source_id, source_object_id, received_at desc)",
            "create index if not exists idx_maritime_raw_message_refs_mmsi on maritime_raw_message_refs(mmsi)",
        ],
    )


def test_maritime_migration_is_additive_schema_only_and_secret_safe():
    sql = migration_lower()

    forbidden_terms = [
        "truncate",
        "delete from",
        "insert into maritime_",
        "api_key",
        "apikey",
        "secret",
        ".env",
        "aisstream_api_key",
        "raw/layer_06_maritime",
    ]
    for term in forbidden_terms:
        assert term not in sql

    assert "drop table" not in sql
    assert "drop column" not in sql
    assert "drop extension" not in sql


def test_normalized_position_fixture_maps_to_latest_and_history_insert_columns():
    positions = load_jsonl(POSITIONS_FIXTURE)
    sample = positions[0]

    insert_row = {
        "layer_id": sample["layer_id"],
        "source_id": sample["source_id"],
        "source_family": sample["source_family"],
        "source_object_id": str(sample["mmsi"]),
        "mmsi": sample["mmsi"],
        "dedupe_key": f"{sample['source_id']}:{sample['mmsi']}",
        "latitude": sample["latitude"],
        "longitude": sample["longitude"],
        "speed_over_ground": sample["speed_over_ground"],
        "course_over_ground": sample["course_over_ground"],
        "true_heading": sample["true_heading"],
        "navigation_status": sample["navigation_status"],
        "navigation_status_text": sample["navigation_status_text"],
        "position_accuracy": sample["position_accuracy"],
        "ais_timestamp_second": sample["ais_timestamp_second"],
        "metadata_time_utc": sample["metadata_time_utc"],
        "received_at": sample["received_at"],
        "raw_evidence_uri": sample["raw_evidence_uri"],
        "provider_metadata": sample["provider_metadata"],
    }

    latest_columns = table_columns("maritime_positions_latest")
    history_columns = table_columns("maritime_position_history")
    assert set(insert_row).issubset(latest_columns)
    assert (set(insert_row) - {"dedupe_key", "navigation_status_text", "position_accuracy", "provider_metadata"}).issubset(
        history_columns
    )
    assert insert_row["layer_id"] == "layer_06_maritime"
    assert insert_row["dedupe_key"] == "aisstream:258674000"
    assert -90 <= insert_row["latitude"] <= 90
    assert -180 <= insert_row["longitude"] <= 180


def test_normalized_static_fixture_maps_to_vessel_upsert_columns_and_keeps_partial_eta():
    static_records = load_jsonl(STATIC_FIXTURE)
    sample = static_records[0]

    insert_row = {
        "layer_id": sample["layer_id"],
        "source_id": sample["source_id"],
        "source_family": sample["source_family"],
        "source_object_id": str(sample["mmsi"]),
        "mmsi": sample["mmsi"],
        "dedupe_key": f"{sample['source_id']}:{sample['mmsi']}",
        "imo": sample["imo"],
        "callsign": sample["callsign"],
        "vessel_name": sample["vessel_name"],
        "vessel_type_code": sample["vessel_type_code"],
        "vessel_type": sample["vessel_type"],
        "destination": sample["destination"],
        "eta_month": sample["eta_month"],
        "eta_day": sample["eta_day"],
        "eta_hour": sample["eta_hour"],
        "eta_minute": sample["eta_minute"],
        "eta_display": sample["eta_display"],
        "draught_meters": sample["draught_meters"],
        "dimension_a": sample["dimension_a"],
        "dimension_b": sample["dimension_b"],
        "dimension_c": sample["dimension_c"],
        "dimension_d": sample["dimension_d"],
        "length_meters": sample["length_meters"],
        "width_meters": sample["width_meters"],
        "last_received_at": sample["received_at"],
        "raw_evidence_uri": sample["raw_evidence_uri"],
        "provider_metadata": sample["provider_metadata"],
    }

    assert set(insert_row).issubset(table_columns("maritime_vessels"))
    assert "eta" not in insert_row
    assert insert_row["dedupe_key"] == "aisstream:211352790"
    assert insert_row["length_meters"] == 100
    assert insert_row["width_meters"] == 30


def test_vessels_latest_fixture_supports_static_only_and_position_only_records():
    vessels = load_jsonl(VESSELS_LATEST_FIXTURE)

    assert any("vessel_name" in vessel and "latitude" not in vessel for vessel in vessels)
    assert any("latitude" in vessel and "vessel_name" not in vessel for vessel in vessels)
    for vessel in vessels:
        assert vessel["layer_id"] == "layer_06_maritime"
        assert vessel["dedupe_key"] == f"{vessel['source_id']}:{vessel['mmsi']}"


def test_latest_position_upsert_semantics_are_source_id_and_mmsi_based():
    positions = load_jsonl(POSITIONS_FIXTURE)
    first = positions[0]
    updated = {
        **first,
        "latitude": first["latitude"] + 0.01,
        "longitude": first["longitude"] + 0.01,
        "received_at": "2026-06-09T12:09:31.743805+00:00",
    }

    latest_by_source_mmsi = {}
    for row in [first, updated]:
        latest_by_source_mmsi[(row["source_id"], row["mmsi"])] = row

    assert len(latest_by_source_mmsi) == 1
    stored = latest_by_source_mmsi[("aisstream", first["mmsi"])]
    assert stored["latitude"] == updated["latitude"]
    assert stored["received_at"] == updated["received_at"]


def test_invalid_lat_lon_would_be_rejected_by_declared_checks():
    sql = compact_sql(migration_text())
    invalid_position = {
        "latitude": 91.0,
        "longitude": 181.0,
    }

    assert invalid_position["latitude"] > 90
    assert invalid_position["longitude"] > 180
    assert "latitude >= -90 and latitude <= 90" in sql
    assert "longitude >= -180 and longitude <= 180" in sql


def test_bbox_query_contract_uses_postgis_geom_and_longitude_latitude_fallback():
    sql = compact_sql(migration_text())

    assert "idx_maritime_positions_latest_geom_gist" in sql
    assert "using gist(geom)" in sql
    assert "idx_maritime_positions_latest_bbox" in sql
    assert "on maritime_positions_latest(longitude, latitude)" in sql


def test_maritime_work_order_changes_stay_in_allowed_paths():
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
        pytest.skip("Scope guard only applies during local dirty worktree work-order review")

    # Detection: if any changed path is under services/fetch-orchestrator, this is
    # a fetching-worker (ingestion/fetcher) work order; allow that path prefix.
    has_fetching_changes = any(
        p.startswith("services/fetch-orchestrator/src/layers/layer_06_maritime/")
        for p in changed_paths
    )

    # Detection: if any changed path is under database/migrations, this is a
    # database-worker work order; allow that path prefix.
    has_db_changes = any(
        p.startswith("database/migrations/layers/layer_06_maritime/")
        for p in changed_paths
    )

    # Both lanes share these test/docs paths
    common_allowed = (
        "tests/data/layer_06_maritime/",
        "docs/state/HANDOFF_LOG.md",
    )

    # Build lane-specific allowed prefixes
    allowed_prefixes = list(common_allowed)
    if has_db_changes:
        allowed_prefixes.append("database/migrations/layers/layer_06_maritime/")
    if has_fetching_changes:
        allowed_prefixes.append("services/fetch-orchestrator/src/layers/layer_06_maritime/")

    assert changed_paths
    assert all(
        path.startswith(tuple(allowed_prefixes)) for path in changed_paths
    ), (
        f"Changed paths not in allowed prefixes for detected lane(s). "
        f"has_fetching={has_fetching_changes}, has_db={has_db_changes}. "
        f"Changed: {changed_paths}"
    )


def test_maritime_work_order_adds_no_raw_data_or_env_files():
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
        if line
    ]

    raw_data_paths = [
        path
        for path in changed_paths
        if path.startswith(("data/", "raw/", "database/raw/", "storage/raw/"))
    ]
    raw_data_suffixes = (".csv", ".json", ".jsonl", ".parquet", ".geojson")
    assert not raw_data_paths
    assert not any(
        path.endswith(raw_data_suffixes) and "fixtures/" not in path
        for path in changed_paths
    )
    assert not any(path.endswith(".env") or ".env." in path for path in changed_paths)
