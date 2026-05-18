from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATION_PATH = (
    REPO_ROOT
    / "database"
    / "migrations"
    / "layers"
    / "layer_01_aviation"
    / "007_airport_capacity_profiles.sql"
)
DOC_PATH = (
    REPO_ROOT
    / "docs"
    / "data"
    / "layer_01_aviation"
    / "AIRPORT_INTELLIGENCE_SCHEMA_PLAN.md"
)


def migration_text() -> str:
    return MIGRATION_PATH.read_text(encoding="utf-8").lower()


def test_airport_capacity_profiles_migration_exists_and_creates_table():
    migration = migration_text()

    assert MIGRATION_PATH.exists()
    assert "create extension if not exists pgcrypto" in migration
    assert "create table if not exists airport_capacity_profiles" in migration


def test_airport_capacity_profiles_migration_is_additive_and_preserves_existing_tables():
    migration = migration_text()

    destructive_terms = [
        "drop table",
        "drop column",
        "truncate",
        "delete from",
        "update aviation_airports",
        "insert into aviation_airports",
        "alter table aviation_airports",
        "alter table airport_public_profiles",
        "alter table airport_public_profile_versions",
        "alter table airport_public_profile_fetch_runs",
        "alter table airport_intelligence_modules",
        "alter table airport_source_links",
        "alter table airport_intelligence_fetch_runs",
    ]
    for term in destructive_terms:
        assert term not in migration


def test_airport_capacity_profiles_has_required_columns_and_foreign_keys():
    migration = migration_text()

    required_terms = [
        "id uuid primary key default gen_random_uuid()",
        "airport_id uuid not null references aviation_airports(id)",
        "module_id uuid references airport_intelligence_modules(id)",
        "primary_source_link_id uuid references airport_source_links(id)",
        "annual_passenger_capacity bigint",
        "terminal_capacity bigint",
        "runway_movement_capacity_per_hour integer",
        "terminal_count integer",
        "gate_count integer",
        "stand_count integer",
        "aircraft_stand_count integer",
        "check_in_counter_count integer",
        "baggage_belt_count integer",
        "capacity_year integer",
        "capacity_basis text",
        "confidence_label text",
        "confidence_score numeric(5,4)",
        "capacity_status text not null default 'no_data'",
        "notes text",
        "data_payload jsonb",
        "source_summary jsonb",
        "retrieved_at timestamptz",
        "fetched_at timestamptz",
        "stale_at timestamptz",
        "expires_at timestamptz",
        "next_refresh_at timestamptz",
        "created_at timestamptz not null default now()",
        "updated_at timestamptz not null default now()",
    ]
    for term in required_terms:
        assert term in migration


def test_airport_capacity_profiles_has_status_basis_and_quality_constraints():
    migration = migration_text()

    required_terms = [
        "airport_capacity_profiles_capacity_status_check",
        "capacity_status in ('ok', 'stale', 'fetching', 'no_data', 'low_confidence', 'error')",
        "airport_capacity_profiles_capacity_basis_check",
        "capacity_basis is null or capacity_basis in",
        "'official_declared'",
        "'annual_report'",
        "'authority_dataset'",
        "'airport_website'",
        "'osm_count'",
        "'wikidata'",
        "'wikipedia_extract'",
        "'other'",
        "annual_passenger_capacity is null or annual_passenger_capacity >= 0",
        "terminal_capacity is null or terminal_capacity >= 0",
        "runway_movement_capacity_per_hour is null or runway_movement_capacity_per_hour >= 0",
        "terminal_count is null or terminal_count >= 0",
        "gate_count is null or gate_count >= 0",
        "stand_count is null or stand_count >= 0",
        "aircraft_stand_count is null or aircraft_stand_count >= 0",
        "check_in_counter_count is null or check_in_counter_count >= 0",
        "baggage_belt_count is null or baggage_belt_count >= 0",
        "capacity_year is null or (capacity_year >= 1900 and capacity_year <= 2200)",
        "confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)",
        "stale_at is null or fetched_at is null or stale_at > fetched_at",
        "expires_at is null or fetched_at is null or expires_at > fetched_at",
    ]
    for term in required_terms:
        assert term in migration


def test_airport_capacity_profiles_has_unique_source_backed_rule_and_indexes():
    migration = migration_text()

    required_terms = [
        "constraint airport_capacity_profiles_airport_id_key unique(airport_id)",
        "airport_capacity_profiles_source_backed_ok_check",
        "capacity_status <> 'ok'",
        "primary_source_link_id is not null",
        "source_summary is not null",
        "data_payload is not null",
        "idx_airport_capacity_profiles_airport_id",
        "idx_airport_capacity_profiles_module_id",
        "idx_airport_capacity_profiles_primary_source_link_id",
        "idx_airport_capacity_profiles_capacity_status",
        "idx_airport_capacity_profiles_capacity_year",
        "idx_airport_capacity_profiles_annual_passenger_capacity",
        "idx_airport_capacity_profiles_terminal_count",
        "idx_airport_capacity_profiles_gate_count",
        "idx_airport_capacity_profiles_stand_count",
        "idx_airport_capacity_profiles_confidence_score",
        "idx_airport_capacity_profiles_stale_at",
        "idx_airport_capacity_profiles_expires_at",
        "idx_airport_capacity_profiles_next_refresh_at",
        "idx_airport_capacity_profiles_data_payload_gin",
        "idx_airport_capacity_profiles_source_summary_gin",
    ]
    for term in required_terms:
        assert term in migration


def test_airport_capacity_profiles_document_has_wo_037_notes():
    doc = DOC_PATH.read_text(encoding="utf-8")

    assert "WO-037 Stage 2 Implementation Notes" in doc
    assert "007_airport_capacity_profiles.sql" in doc
    assert "Capacity is source-backed only" in doc
    assert "Traffic metrics, derived capability tags, OSM layout, API implementation, and worker implementation are intentionally not included" in doc
