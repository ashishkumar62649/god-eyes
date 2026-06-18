import subprocess
from pathlib import Path

import pytest

from scope_guard import all_changed_paths_are_orchestrator_docs_scope


REPO_ROOT = Path(__file__).resolve().parents[3]
LAYER_ID = "layer_10_energy_infrastructure"
MIGRATION_PATH = (
    REPO_ROOT
    / "database"
    / "migrations"
    / "layers"
    / LAYER_ID
    / "001_energy_infrastructure_tables.sql"
)


def migration_text() -> str:
    if not MIGRATION_PATH.exists():
        return ""
    return MIGRATION_PATH.read_text(encoding="utf-8").lower()


def test_energy_infrastructure_migration_exists_and_creates_table():
    migration = migration_text()

    assert MIGRATION_PATH.exists()
    assert "create extension if not exists pgcrypto" in migration
    assert "create extension if not exists postgis" in migration
    assert "create table if not exists energy_infrastructure" in migration
    assert LAYER_ID in migration


def test_energy_infrastructure_has_required_columns():
    migration = migration_text()

    required_terms = [
        "id uuid primary key default gen_random_uuid()",
        "layer_id text not null default 'layer_10_energy_infrastructure'",
        "source_id text not null",
        "source_object_id text not null",
        "feature_type text not null",
        "category text not null",
        "geometry_type text not null",
        "name text",
        "operator text",
        "owner text",
        "country text",
        "status text",
        "fuel_type text",
        "capacity_mw double precision",
        "voltage_kv double precision",
        "pipeline_product text",
        "pipeline_length_km double precision",
        "terminal_type text",
        "geom geometry(geometry, 4326) not null",
        "centroid_lat double precision not null",
        "centroid_lon double precision not null",
        "bbox geometry(geometry, 4326)",
        "source_confidence double precision",
        "source_updated_at timestamptz",
        "first_seen_at timestamptz not null default now()",
        "last_seen_at timestamptz not null default now()",
        "raw_source_json jsonb",
        "created_at timestamptz not null default now()",
        "updated_at timestamptz not null default now()",
    ]
    for term in required_terms:
        assert term in migration


def test_energy_infrastructure_constraints_cover_layer_sources_features_and_geometry():
    migration = migration_text()

    required_terms = [
        "energy_infrastructure_layer_id_check",
        "layer_id = 'layer_10_energy_infrastructure'",
        "energy_infrastructure_source_object_unique",
        "unique (source_id, source_object_id)",
        "energy_infrastructure_source_id_check",
        "'wri_global_power_plant_database'",
        "'osm_energy_infrastructure'",
        "'global_energy_monitor_energy'",
        "energy_infrastructure_feature_type_check",
        "'power_plant'",
        "'substation'",
        "'transmission_line'",
        "'oil_pipeline'",
        "'gas_pipeline'",
        "'lng_terminal'",
        "'oil_terminal'",
        "'gas_terminal'",
        "'unknown_energy_feature'",
        "energy_infrastructure_geometry_type_check",
        "geometry_type in ('point', 'line', 'polygon')",
        "energy_infrastructure_geom_srid_check",
        "st_srid(geom) = 4326",
        "energy_infrastructure_geom_not_empty_check",
        "not st_isempty(geom)",
    ]
    for term in required_terms:
        assert term in migration


def test_energy_infrastructure_coordinate_and_numeric_constraints_exist():
    migration = migration_text()

    required_terms = [
        "energy_infrastructure_centroid_lat_check",
        "centroid_lat >= -90 and centroid_lat <= 90",
        "energy_infrastructure_centroid_lon_check",
        "centroid_lon >= -180 and centroid_lon <= 180",
        "energy_infrastructure_source_confidence_check",
        "source_confidence is null or (source_confidence >= 0 and source_confidence <= 1)",
        "energy_infrastructure_capacity_mw_check",
        "capacity_mw is null or capacity_mw >= 0",
        "energy_infrastructure_voltage_kv_check",
        "voltage_kv is null or voltage_kv >= 0",
        "energy_infrastructure_pipeline_length_km_check",
        "pipeline_length_km is null or pipeline_length_km >= 0",
        "energy_infrastructure_last_seen_after_first_seen_check",
        "last_seen_at >= first_seen_at",
    ]
    for term in required_terms:
        assert term in migration


def test_energy_infrastructure_has_required_filter_and_spatial_indexes():
    migration = migration_text()

    required_terms = [
        "idx_energy_infrastructure_source_id",
        "on energy_infrastructure(source_id)",
        "idx_energy_infrastructure_source_object_id",
        "on energy_infrastructure(source_object_id)",
        "idx_energy_infrastructure_feature_type",
        "on energy_infrastructure(feature_type)",
        "idx_energy_infrastructure_category",
        "on energy_infrastructure(category)",
        "idx_energy_infrastructure_country",
        "on energy_infrastructure(country)",
        "idx_energy_infrastructure_status",
        "on energy_infrastructure(status)",
        "idx_energy_infrastructure_fuel_type",
        "on energy_infrastructure(fuel_type)",
        "idx_energy_infrastructure_capacity_mw",
        "on energy_infrastructure(capacity_mw)",
        "idx_energy_infrastructure_voltage_kv",
        "on energy_infrastructure(voltage_kv)",
        "idx_energy_infrastructure_pipeline_product",
        "on energy_infrastructure(pipeline_product)",
        "idx_energy_infrastructure_terminal_type",
        "on energy_infrastructure(terminal_type)",
        "idx_energy_infrastructure_source_updated_at",
        "on energy_infrastructure(source_updated_at)",
        "idx_energy_infrastructure_last_seen_at",
        "on energy_infrastructure(last_seen_at)",
        "idx_energy_infrastructure_geom_gist",
        "on energy_infrastructure using gist(geom)",
        "idx_energy_infrastructure_bbox_gist",
        "on energy_infrastructure using gist(bbox)",
        "idx_energy_infrastructure_source_feature",
        "on energy_infrastructure(source_id, feature_type)",
        "idx_energy_infrastructure_country_feature",
        "on energy_infrastructure(country, feature_type)",
        "idx_energy_infrastructure_category_status",
        "on energy_infrastructure(category, status)",
        "idx_energy_infrastructure_fuel_capacity",
        "on energy_infrastructure(fuel_type, capacity_mw)",
        "idx_energy_infrastructure_pipeline_product_length",
        "on energy_infrastructure(pipeline_product, pipeline_length_km)",
    ]
    for term in required_terms:
        assert term in migration


def test_energy_infrastructure_migration_is_additive_and_scoped_to_layer_10():
    migration = migration_text()

    forbidden_terms = [
        "drop table",
        "drop column",
        "drop index",
        "drop extension",
        "truncate",
        "delete from",
        "insert into energy_infrastructure",
        "update energy_infrastructure",
        "http://",
        "https://",
        "api_key",
        "secret",
        ".env",
        "layer_05_space",
        "layer_06_energy",
    ]
    for term in forbidden_terms:
        assert term not in migration


def test_energy_infrastructure_work_order_changes_stay_in_allowed_paths():
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

    # Approved Orchestrator docs/spec-only dirty trees (e.g. AGENTS.md,
    # docs/control/, specs/) are not layer-scoped data work and must not be
    # blocked by this layer guard. The allowance fires only when EVERY dirty
    # path is approved orchestrator docs/spec; a mixed tree still fails below.
    if all_changed_paths_are_orchestrator_docs_scope(changed_paths):
        return

    allowed_prefixes = (
        "database/migrations/layers/layer_10_energy_infrastructure/",
        "tests/data/layer_10_energy_infrastructure/",
        "docs/state/HANDOFF_LOG.md",
    )
    assert changed_paths
    assert all(path.startswith(allowed_prefixes) for path in changed_paths)


def test_energy_infrastructure_work_order_adds_no_raw_data_or_env_files():
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
