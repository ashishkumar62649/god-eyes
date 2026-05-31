import subprocess
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATION_PATH = (
    REPO_ROOT
    / "database"
    / "migrations"
    / "layers"
    / "layer_05_space_satellites"
    / "001_space_satellites_tables.sql"
)


def migration_text() -> str:
    if not MIGRATION_PATH.exists():
        return ""
    return MIGRATION_PATH.read_text(encoding="utf-8").lower()


def test_space_satellites_migration_exists_and_creates_required_tables():
    migration = migration_text()

    assert MIGRATION_PATH.exists()
    assert "create extension if not exists pgcrypto" in migration
    assert "create table if not exists space_satellites" in migration
    assert "create table if not exists space_satellite_positions_latest" in migration


def test_space_satellites_catalog_has_required_identity_columns():
    migration = migration_text()

    required_terms = [
        "id uuid primary key default gen_random_uuid()",
        "layer_id text not null default 'layer_05_space_satellites'",
        "source_id text not null",
        "source_object_id text not null",
        "norad_cat_id integer",
        "name text not null",
        "object_type text not null",
        "category text not null",
        "orbit_class text not null",
        "country text",
        "operator_or_owner text",
        "launch_date date",
        "tle_line1 text",
        "tle_line2 text",
        "orbital_epoch_at timestamptz",
        "source_updated_at timestamptz",
        "first_seen_at timestamptz not null default now()",
        "last_seen_at timestamptz not null default now()",
        "is_active boolean not null default true",
        "is_important boolean not null default false",
        "raw_source_json jsonb not null default '{}'::jsonb",
        "created_at timestamptz not null default now()",
        "updated_at timestamptz not null default now()",
    ]
    for term in required_terms:
        assert term in migration


def test_space_satellites_latest_positions_have_required_renderable_columns():
    migration = migration_text()

    required_terms = [
        "satellite_id uuid not null references space_satellites(id) on delete cascade",
        "layer_id text not null default 'layer_05_space_satellites'",
        "source_id text not null",
        "source_object_id text not null",
        "norad_cat_id integer",
        "estimated_at timestamptz not null",
        "latitude double precision not null",
        "longitude double precision not null",
        "altitude_km double precision",
        "velocity_kms double precision",
        "heading_deg double precision",
        "orbit_class text not null",
        "object_type text not null",
        "category text not null",
        "visual_shape text not null",
        "visual_color text not null",
        "is_important boolean not null default false",
        "source_age_seconds integer",
        "computation_method text not null",
        "raw_position_json jsonb not null default '{}'::jsonb",
        "updated_at timestamptz not null default now()",
    ]
    for term in required_terms:
        assert term in migration


def test_space_satellites_constraints_cover_layer_source_enums_and_coordinates():
    migration = migration_text()

    required_terms = [
        "space_satellites_layer_id_check",
        "layer_id = 'layer_05_space_satellites'",
        "space_satellites_source_object_unique",
        "unique (source_id, source_object_id)",
        "space_satellites_source_id_not_empty_check",
        "space_satellites_source_object_id_not_empty_check",
        "space_satellites_norad_cat_id_check",
        "space_satellites_object_type_check",
        "'satellite'",
        "'debris'",
        "'rocket_body'",
        "'inactive_payload'",
        "'unknown'",
        "space_satellites_category_check",
        "'starlink'",
        "'communications'",
        "'navigation'",
        "'weather'",
        "'earth_observation'",
        "'science'",
        "'crewed_or_station'",
        "space_satellites_orbit_class_check",
        "'vleo'",
        "'leo'",
        "'meo'",
        "'geo'",
        "'heo'",
        "space_satellite_positions_latest_latitude_check",
        "latitude >= -90 and latitude <= 90",
        "space_satellite_positions_latest_longitude_check",
        "longitude >= -180 and longitude <= 180",
        "space_satellite_positions_latest_altitude_km_check",
        "altitude_km is null or altitude_km >= 0",
        "space_satellite_positions_latest_velocity_kms_check",
        "velocity_kms is null or velocity_kms >= 0",
        "space_satellite_positions_latest_heading_deg_check",
        "heading_deg is null or (heading_deg >= 0 and heading_deg <= 360)",
        "space_satellite_positions_latest_visual_shape_check",
        "visual_shape in ('dot', 'triangle')",
    ]
    for term in required_terms:
        assert term in migration


def test_space_satellites_visual_colors_avoid_black_and_white_primary_markers():
    migration = migration_text()

    required_terms = [
        "space_satellite_positions_latest_visual_color_check",
        "lower(visual_color) not in ('black', 'white', '#000000', '#ffffff', '#fff', '#000')",
    ]
    for term in required_terms:
        assert term in migration


def test_space_satellites_migration_has_required_indexes():
    migration = migration_text()

    required_terms = [
        "idx_space_satellites_norad_cat_id",
        "on space_satellites(norad_cat_id)",
        "idx_space_satellites_source_object",
        "on space_satellites(source_id, source_object_id)",
        "idx_space_satellites_layer_id",
        "on space_satellites(layer_id)",
        "idx_space_satellites_object_type",
        "on space_satellites(object_type)",
        "idx_space_satellites_category",
        "on space_satellites(category)",
        "idx_space_satellites_orbit_class",
        "on space_satellites(orbit_class)",
        "idx_space_satellites_is_important",
        "where is_important = true",
        "idx_space_satellites_active_updated",
        "on space_satellites(is_active, updated_at desc)",
        "idx_space_satellite_positions_latest_satellite_id",
        "on space_satellite_positions_latest(satellite_id)",
        "idx_space_satellite_positions_latest_source_object",
        "on space_satellite_positions_latest(source_id, source_object_id)",
        "idx_space_satellite_positions_latest_estimated_at",
        "on space_satellite_positions_latest(estimated_at desc)",
        "idx_space_satellite_positions_latest_updated_at",
        "on space_satellite_positions_latest(updated_at desc)",
        "idx_space_satellite_positions_latest_active_render",
        "on space_satellite_positions_latest(layer_id, category, object_type, orbit_class)",
    ]
    for term in required_terms:
        assert term in migration


def test_space_satellites_migration_is_schema_only_and_uses_correct_layer_name():
    migration = migration_text()

    forbidden_terms = [
        "drop table",
        "drop column",
        "drop index",
        "drop extension",
        "truncate",
        "delete from",
        "insert into space_satellites",
        "insert into space_satellite_positions_latest",
        "http://",
        "https://",
        "api_key",
        "secret",
        ".env",
        "layer_04_space",
    ]
    for term in forbidden_terms:
        assert term not in migration


def test_space_satellites_work_order_changes_stay_in_allowed_paths():
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

    allowed_prefixes = (
        "database/migrations/layers/layer_05_space_satellites/",
        "tests/data/layer_05_space_satellites/",
        "docs/state/HANDOFF_LOG.md",
    )
    assert changed_paths
    assert all(path.startswith(allowed_prefixes) for path in changed_paths)


def test_space_satellites_work_order_adds_no_raw_data_or_env_files():
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
