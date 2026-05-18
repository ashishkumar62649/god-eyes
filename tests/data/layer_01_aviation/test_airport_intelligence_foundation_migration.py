from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATION_PATH = (
    REPO_ROOT
    / "database"
    / "migrations"
    / "layers"
    / "layer_01_aviation"
    / "006_airport_intelligence_foundation.sql"
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


def test_airport_intelligence_foundation_migration_exists_and_creates_tables():
    migration = migration_text()

    assert MIGRATION_PATH.exists()
    assert "create extension if not exists pgcrypto" in migration
    assert "create table if not exists airport_intelligence_modules" in migration
    assert "create table if not exists airport_source_links" in migration
    assert "create table if not exists airport_intelligence_fetch_runs" in migration


def test_airport_intelligence_foundation_is_additive_and_preserves_existing_tables():
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
    ]
    for term in destructive_terms:
        assert term not in migration

    assert "references aviation_airports(id)" in migration


def test_airport_intelligence_modules_has_required_columns_constraints_and_indexes():
    migration = migration_text()

    required_terms = [
        "airport_intelligence_modules",
        "airport_id uuid not null references aviation_airports(id)",
        "module_key text not null",
        "module_status text not null",
        "cache_state text not null",
        "cache_ttl_seconds integer not null default 2592000",
        "confidence_label text",
        "confidence_score numeric(5,4)",
        "data_payload jsonb",
        "summary_payload jsonb",
        "source_summary jsonb",
        "error_code text",
        "error_message text",
        "fetched_at timestamptz",
        "stale_at timestamptz",
        "expires_at timestamptz",
        "next_refresh_at timestamptz",
        "refresh_error_count integer not null default 0",
        "unique(airport_id, module_key)",
        "cache_ttl_seconds > 0",
        "refresh_error_count >= 0",
        "confidence_score >= 0",
        "confidence_score <= 1",
        "expires_at > fetched_at",
        "stale_at > fetched_at",
        "idx_airport_intelligence_modules_airport_id",
        "idx_airport_intelligence_modules_module_status",
        "idx_airport_intelligence_modules_cache_state",
        "idx_airport_intelligence_modules_next_refresh_at",
        "idx_airport_intelligence_modules_stale_at",
        "idx_airport_intelligence_modules_expires_at",
        "idx_airport_intelligence_modules_confidence_score",
        "idx_airport_intelligence_modules_data_payload_gin",
        "idx_airport_intelligence_modules_source_summary_gin",
    ]
    for term in required_terms:
        assert term in migration


def test_airport_source_links_has_required_columns_constraints_dedupe_and_indexes():
    migration = migration_text()

    required_terms = [
        "airport_source_links",
        "airport_id uuid not null references aviation_airports(id)",
        "module_key text",
        "source_type text not null",
        "source_name text not null",
        "source_url text",
        "source_entity_id text",
        "source_license text",
        "source_license_url text",
        "attribution_text text",
        "retrieved_at timestamptz",
        "last_checked_at timestamptz",
        "confidence_label text",
        "confidence_score numeric(5,4)",
        "is_primary boolean not null default false",
        "metadata jsonb",
        "btrim(source_name) <> ''",
        "idx_airport_source_links_airport_id",
        "idx_airport_source_links_airport_module",
        "idx_airport_source_links_source_type",
        "idx_airport_source_links_source_entity_id",
        "idx_airport_source_links_is_primary",
        "idx_airport_source_links_retrieved_at",
        "idx_airport_source_links_confidence_score",
        "idx_airport_source_links_metadata_gin",
        "idx_airport_source_links_entity_dedupe",
        "idx_airport_source_links_url_dedupe",
    ]
    for term in required_terms:
        assert term in migration


def test_airport_intelligence_fetch_runs_has_required_columns_constraints_dedupe_and_indexes():
    migration = migration_text()

    required_terms = [
        "airport_intelligence_fetch_runs",
        "airport_id uuid not null references aviation_airports(id)",
        "module_key text not null",
        "run_type text not null",
        "run_status text not null",
        "priority integer not null default 100",
        "requested_by text",
        "source_type text",
        "started_at timestamptz",
        "completed_at timestamptz",
        "lock_expires_at timestamptz",
        "next_retry_at timestamptz",
        "retry_count integer not null default 0",
        "max_retries integer not null default 2",
        "duration_ms integer",
        "result_status text",
        "produced_module_id uuid references airport_intelligence_modules(id)",
        "metadata jsonb",
        "in_progress_key text generated always as",
        "retry_count >= 0",
        "max_retries >= 0",
        "priority >= 0",
        "duration_ms >= 0",
        "completed_at >= started_at",
        "next_retry_at is null or run_status in ('queued', 'failed')",
        "idx_airport_intelligence_fetch_runs_airport_id",
        "idx_airport_intelligence_fetch_runs_airport_module",
        "idx_airport_intelligence_fetch_runs_module_status",
        "idx_airport_intelligence_fetch_runs_status_priority_created",
        "idx_airport_intelligence_fetch_runs_lock_expires_at",
        "idx_airport_intelligence_fetch_runs_next_retry_at",
        "idx_airport_intelligence_fetch_runs_source_type",
        "idx_airport_intelligence_fetch_runs_produced_module_id",
        "idx_airport_intelligence_fetch_runs_metadata_gin",
        "idx_airport_intelligence_fetch_runs_active_dedupe",
        "where run_status in ('queued', 'running')",
    ]
    for term in required_terms:
        assert term in migration


def test_airport_intelligence_foundation_check_constraints_use_allowed_values():
    migration = migration_text()

    expected_values = [
        "'overview'",
        "'capability'",
        "'capacity'",
        "'traffic'",
        "'infrastructure'",
        "'sources'",
        "'advanced_details'",
        "'ok'",
        "'fetching'",
        "'stale'",
        "'no_data'",
        "'low_confidence'",
        "'error'",
        "'fresh'",
        "'expired'",
        "'refresh_queued'",
        "'refresh_running'",
        "'failed'",
        "'ourairports'",
        "'wikipedia'",
        "'wikidata'",
        "'osm'",
        "'official_website'",
        "'national_authority'",
        "'lazy_fetch'",
        "'refresh'",
        "'backfill'",
        "'manual'",
        "'retry'",
        "'queued'",
        "'running'",
        "'completed'",
        "'cancelled'",
        "'skipped'",
        "'unchanged'",
    ]
    for value in expected_values:
        assert value in migration

    expected_constraints = [
        "airport_intelligence_modules_module_key_check",
        "airport_intelligence_modules_module_status_check",
        "airport_intelligence_modules_cache_state_check",
        "airport_source_links_module_key_check",
        "airport_source_links_source_type_check",
        "airport_intelligence_fetch_runs_module_key_check",
        "airport_intelligence_fetch_runs_run_type_check",
        "airport_intelligence_fetch_runs_run_status_check",
        "airport_intelligence_fetch_runs_result_status_check",
    ]
    for constraint_name in expected_constraints:
        assert constraint_name in migration


def test_airport_intelligence_foundation_document_has_wo_036_notes():
    doc = DOC_PATH.read_text(encoding="utf-8")

    assert "WO-036 Stage 1 Implementation Notes" in doc
    assert "006_airport_intelligence_foundation.sql" in doc
    assert "capacity, traffic, layout, derived intelligence, and backfill tables are intentionally not included" in doc
