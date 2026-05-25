from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATION_PATH = (
    REPO_ROOT
    / "database"
    / "migrations"
    / "layers"
    / "layer_03_earth_events"
    / "001_earth_events_tables.sql"
)


def migration_text() -> str:
    if not MIGRATION_PATH.exists():
        return ""
    return MIGRATION_PATH.read_text(encoding="utf-8").lower()


def test_earth_events_migration_exists_and_creates_tables():
    migration = migration_text()

    assert MIGRATION_PATH.exists()
    assert "create extension if not exists pgcrypto" in migration
    assert "create extension if not exists postgis" in migration
    assert "create table if not exists earth_events_latest" in migration
    assert "create table if not exists earth_events_history" in migration


def test_earth_events_migration_is_additive_and_contains_no_seed_data():
    migration = migration_text()

    destructive_or_seed_terms = [
        "drop table",
        "drop column",
        "truncate",
        "delete from",
        "insert into earth_events_latest",
        "insert into earth_events_history",
        "update earth_events_latest",
        "update earth_events_history",
    ]
    for term in destructive_or_seed_terms:
        assert term not in migration


def test_earth_events_latest_has_required_columns_and_dedupe():
    migration = migration_text()

    required_terms = [
        "id uuid primary key default gen_random_uuid()",
        "layer_id text not null default 'layer_03_earth_events'",
        "source_id text not null",
        "source_object_id text not null",
        "event_type text not null",
        "magnitude numeric",
        "magnitude_type text",
        "depth_km numeric",
        "place text",
        "alert_level text",
        "significance integer",
        "tsunami boolean not null default false",
        "geometry geometry(point, 4326) not null",
        "source_url text",
        "observed_at timestamptz not null",
        "updated_at timestamptz not null",
        "fetched_at timestamptz not null",
        "properties_json jsonb not null default '{}'::jsonb",
        "created_at timestamptz not null default now()",
        "unique(source_id, source_object_id)",
    ]
    for term in required_terms:
        assert term in migration


def test_earth_events_history_has_required_columns():
    migration = migration_text()

    required_terms = [
        "create table if not exists earth_events_history",
        "id uuid primary key default gen_random_uuid()",
        "layer_id text not null default 'layer_03_earth_events'",
        "source_id text not null",
        "source_object_id text not null",
        "event_type text not null",
        "magnitude numeric",
        "depth_km numeric",
        "place text",
        "alert_level text",
        "geometry geometry(point, 4326) not null",
        "source_url text",
        "observed_at timestamptz not null",
        "updated_at timestamptz not null",
        "fetched_at timestamptz not null",
        "properties_json jsonb not null default '{}'::jsonb",
        "created_at timestamptz not null default now()",
    ]
    for term in required_terms:
        assert term in migration


def test_earth_events_has_required_indexes():
    migration = migration_text()

    required_terms = [
        "idx_earth_events_latest_geometry_gist",
        "on earth_events_latest using gist(geometry)",
        "idx_earth_events_latest_observed_at",
        "on earth_events_latest(observed_at)",
        "idx_earth_events_latest_event_type",
        "on earth_events_latest(event_type)",
        "idx_earth_events_history_source_object_updated",
        "on earth_events_history(source_id, source_object_id, updated_at)",
        "idx_earth_events_history_created_at",
        "on earth_events_history(created_at)",
        "idx_earth_events_history_geometry_gist",
        "on earth_events_history using gist(geometry)",
    ]
    for term in required_terms:
        assert term in migration


def test_earth_events_has_public_safety_and_geometry_constraints():
    migration = migration_text()

    required_terms = [
        "earth_events_latest_layer_id_check",
        "layer_id = 'layer_03_earth_events'",
        "earth_events_latest_geometry_srid_check",
        "st_srid(geometry) = 4326",
        "earth_events_latest_geometry_not_empty_check",
        "not st_isempty(geometry)",
        "earth_events_history_geometry_srid_check",
        "earth_events_history_geometry_not_empty_check",
        "source_id_not_empty_check",
        "source_object_id_not_empty_check",
        "event_type_not_empty_check",
    ]
    for term in required_terms:
        assert term in migration
