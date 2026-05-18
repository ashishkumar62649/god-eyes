from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATION_PATH = (
    REPO_ROOT
    / "database"
    / "migrations"
    / "layers"
    / "layer_01_aviation"
    / "009_airport_derived_intelligence.sql"
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


def test_airport_derived_intelligence_migration_exists_and_creates_table():
    migration = migration_text()

    assert MIGRATION_PATH.exists()
    assert "create extension if not exists pgcrypto" in migration
    assert "create table if not exists airport_derived_intelligence" in migration


def test_airport_derived_intelligence_migration_is_additive_and_preserves_existing_tables():
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
        "alter table airport_capacity_profiles",
        "alter table airport_traffic_metrics",
    ]
    for term in destructive_terms:
        assert term not in migration


def test_airport_derived_intelligence_has_required_columns_and_foreign_keys():
    migration = migration_text()

    required_terms = [
        "id uuid primary key default gen_random_uuid()",
        "airport_id uuid not null references aviation_airports(id)",
        "module_id uuid references airport_intelligence_modules(id)",
        "capacity_profile_id uuid references airport_capacity_profiles(id)",
        "intelligence_status text not null default 'no_data'",
        "airport_class text",
        "traffic_scale text",
        "capacity_scale text",
        "runway_capability text",
        "operating_role text",
        "capability_tags text[] not null default '{}'",
        "risk_flags text[] not null default '{}'",
        "source_flags text[] not null default '{}'",
        "confidence_score numeric(5,4)",
        "utilization_pct numeric(7,4)",
        "year_over_year_growth_pct numeric(8,4)",
        "five_year_growth_pct numeric(8,4)",
        "latest_passenger_year integer",
        "latest_passenger_value bigint",
        "latest_movement_year integer",
        "latest_movement_value bigint",
        "longest_runway_ft integer",
        "runway_count integer",
        "intelligence_summary text",
        "capability_summary text",
        "traffic_summary text",
        "capacity_summary text",
        "source_summary jsonb",
        "input_snapshot jsonb",
        "data_payload jsonb",
        "source_hash text",
        "generated_at timestamptz",
        "stale_at timestamptz",
        "expires_at timestamptz",
        "next_refresh_at timestamptz",
        "created_at timestamptz not null default now()",
        "updated_at timestamptz not null default now()",
    ]
    for term in required_terms:
        assert term in migration


def test_airport_derived_intelligence_has_allowed_label_constraints():
    migration = migration_text()

    required_terms = [
        "airport_derived_intelligence_status_check",
        "intelligence_status in ('ok', 'stale', 'fetching', 'no_data', 'low_confidence', 'error')",
        "airport_derived_intelligence_airport_class_check",
        "airport_class is null or airport_class in",
        "'global_hub'",
        "'major_international'",
        "'international'",
        "'regional'",
        "'local'",
        "'general_aviation'",
        "'cargo'",
        "'military'",
        "'heliport'",
        "'seaplane'",
        "'closed'",
        "'unknown'",
        "airport_derived_intelligence_traffic_scale_check",
        "traffic_scale is null or traffic_scale in ('very_high', 'high', 'medium', 'low', 'minimal', 'unknown')",
        "airport_derived_intelligence_capacity_scale_check",
        "capacity_scale is null or capacity_scale in ('very_high', 'high', 'medium', 'low', 'minimal', 'unknown')",
        "airport_derived_intelligence_runway_capability_check",
        "runway_capability is null or runway_capability in",
        "'large_aircraft'",
        "'jet_capable'",
        "'regional_jet'",
        "'turboprop'",
        "'light_aircraft'",
        "'heliport_only'",
        "'seaplane_only'",
        "airport_derived_intelligence_operating_role_check",
        "operating_role is null or operating_role in",
        "'passenger'",
        "'mixed'",
        "'emergency'",
    ]
    for term in required_terms:
        assert term in migration


def test_airport_derived_intelligence_has_unique_numeric_freshness_and_ok_rules():
    migration = migration_text()

    required_terms = [
        "constraint airport_derived_intelligence_airport_id_key unique(airport_id)",
        "airport_derived_intelligence_confidence_score_check",
        "confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)",
        "airport_derived_intelligence_utilization_pct_check",
        "utilization_pct is null or utilization_pct >= 0",
        "airport_derived_intelligence_yoy_growth_check",
        "year_over_year_growth_pct is null or (year_over_year_growth_pct >= -100 and year_over_year_growth_pct <= 10000)",
        "airport_derived_intelligence_five_year_growth_check",
        "five_year_growth_pct is null or (five_year_growth_pct >= -100 and five_year_growth_pct <= 10000)",
        "airport_derived_intelligence_latest_passenger_year_check",
        "latest_passenger_year is null or (latest_passenger_year >= 1900 and latest_passenger_year <= 2200)",
        "airport_derived_intelligence_latest_movement_year_check",
        "latest_movement_year is null or (latest_movement_year >= 1900 and latest_movement_year <= 2200)",
        "latest_passenger_value is null or latest_passenger_value >= 0",
        "latest_movement_value is null or latest_movement_value >= 0",
        "longest_runway_ft is null or longest_runway_ft >= 0",
        "runway_count is null or runway_count >= 0",
        "stale_at is null or generated_at is null or stale_at > generated_at",
        "expires_at is null or generated_at is null or expires_at > generated_at",
        "airport_derived_intelligence_derived_backed_ok_check",
        "intelligence_status <> 'ok'",
        "input_snapshot is not null",
        "source_summary is not null",
        "data_payload is not null",
        "capacity_profile_id is not null",
        "latest_passenger_value is not null",
        "longest_runway_ft is not null",
        "cardinality(capability_tags) > 0",
        "airport_derived_intelligence_low_confidence_check",
        "intelligence_status <> 'low_confidence' or confidence_score is null or confidence_score < 0.5",
    ]
    for term in required_terms:
        assert term in migration


def test_airport_derived_intelligence_has_required_indexes():
    migration = migration_text()

    required_terms = [
        "idx_airport_derived_intelligence_airport_id",
        "idx_airport_derived_intelligence_module_id",
        "idx_airport_derived_intelligence_capacity_profile_id",
        "idx_airport_derived_intelligence_status",
        "idx_airport_derived_intelligence_airport_class",
        "idx_airport_derived_intelligence_traffic_scale",
        "idx_airport_derived_intelligence_capacity_scale",
        "idx_airport_derived_intelligence_runway_capability",
        "idx_airport_derived_intelligence_operating_role",
        "idx_airport_derived_intelligence_confidence_score",
        "idx_airport_derived_intelligence_utilization_pct",
        "idx_airport_derived_intelligence_yoy_growth",
        "idx_airport_derived_intelligence_latest_passenger_year",
        "idx_airport_derived_intelligence_latest_passenger_value",
        "idx_airport_derived_intelligence_longest_runway_ft",
        "idx_airport_derived_intelligence_stale_at",
        "idx_airport_derived_intelligence_expires_at",
        "idx_airport_derived_intelligence_next_refresh_at",
        "idx_airport_derived_intelligence_source_hash",
        "idx_airport_derived_intelligence_capability_tags_gin",
        "idx_airport_derived_intelligence_risk_flags_gin",
        "idx_airport_derived_intelligence_source_flags_gin",
        "idx_airport_derived_intelligence_input_snapshot_gin",
        "idx_airport_derived_intelligence_data_payload_gin",
        "idx_airport_derived_intelligence_source_summary_gin",
    ]
    for term in required_terms:
        assert term in migration


def test_airport_derived_intelligence_document_has_wo_039_notes():
    doc = DOC_PATH.read_text(encoding="utf-8")

    assert "WO-039 Stage 4 Implementation Notes" in doc
    assert "009_airport_derived_intelligence.sql" in doc
    assert "derived/computed intelligence, not raw fetched facts" in doc
    assert "Capability tags are generated later by worker/API logic" in doc
    assert "source-backed/derived-backed rule" in doc
    assert "API implementation, worker implementation, frontend implementation, OSM layout, backfill, monthly traffic, and actual computation logic are intentionally not included" in doc
