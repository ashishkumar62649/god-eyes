from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATION_PATH = (
    REPO_ROOT
    / "database"
    / "migrations"
    / "layers"
    / "layer_01_aviation"
    / "005_airport_public_profile_cache.sql"
)
DOC_PATH = (
    REPO_ROOT
    / "docs"
    / "archive"
    / "2026-06-14-final-docs-structure"
    / "data-legacy"
    / "layer_01_aviation"
    / "AIRPORT_PUBLIC_PROFILE_SCHEMA_PLAN.md"
)


def migration_text() -> str:
    return MIGRATION_PATH.read_text(encoding="utf-8").lower()


def test_public_profile_cache_migration_exists_and_creates_tables():
    migration = migration_text()

    assert MIGRATION_PATH.exists()
    assert "create extension if not exists pgcrypto" in migration
    assert "create table if not exists airport_public_profiles" in migration
    assert "create table if not exists airport_public_profile_versions" in migration
    assert "create table if not exists airport_public_profile_fetch_runs" in migration


def test_public_profile_cache_migration_is_additive_and_preserves_airports():
    migration = migration_text()

    destructive_terms = [
        "drop table",
        "drop column",
        "truncate",
        "delete from",
        "update aviation_airports",
        "insert into aviation_airports",
        "alter table aviation_airports",
    ]
    for term in destructive_terms:
        assert term not in migration

    assert "references aviation_airports(id)" in migration


def test_public_profile_cache_profiles_has_v1_columns_constraints_and_indexes():
    migration = migration_text()

    required_columns = [
        "layer_id text not null",
        "source_id text not null",
        "source_airport_id text not null",
        "airport_id uuid",
        "airport_ident text",
        "iata_code text",
        "airport_name text",
        "iso_country text",
        "profile_status text not null",
        "cache_state text not null",
        "cache_ttl_seconds integer not null default 2592000",
        "profile_payload jsonb not null default '{}'::jsonb",
        "source_urls jsonb not null default '[]'::jsonb",
        "source_attribution jsonb not null default '{}'::jsonb",
        "cache_key text not null",
        "content_hash text",
        "source_content_hash text",
        "current_version_id uuid",
        "latest_fetch_run_id uuid",
        "latest_successful_fetch_run_id uuid",
        "created_at timestamptz not null default now()",
        "updated_at timestamptz not null default now()",
    ]
    for column in required_columns:
        assert column in migration

    assert "airport_public_profiles_source_identity_key" in migration
    assert "unique(layer_id, source_id, source_airport_id)" in migration
    assert "airport_public_profiles_cache_key_key" in migration
    assert "unique(cache_key)" in migration

    expected_indexes = [
        "idx_airport_public_profiles_airport_id",
        "idx_airport_public_profiles_layer_source_object",
        "idx_airport_public_profiles_cache_state",
        "idx_airport_public_profiles_profile_status",
        "idx_airport_public_profiles_stale_at",
        "idx_airport_public_profiles_next_refresh_at",
    ]
    for index_name in expected_indexes:
        assert index_name in migration


def test_public_profile_cache_versions_are_append_only_and_indexed():
    migration = migration_text()

    required_terms = [
        "profile_id uuid not null",
        "fetch_run_id uuid",
        "version_number integer not null",
        "previous_version_id uuid",
        "is_current boolean not null default false",
        "version_status text not null",
        "profile_payload jsonb not null default '{}'::jsonb",
        "raw_source_metadata jsonb not null default '{}'::jsonb",
        "diff_from_previous jsonb not null default '{}'::jsonb",
        "review_status text not null default 'not_required'",
        "unique(profile_id, version_number)",
        "unique(profile_id, content_hash)",
        "where is_current",
        "idx_airport_public_profile_versions_profile_id",
        "idx_airport_public_profile_versions_fetch_run_id",
        "idx_airport_public_profile_versions_source_identity",
        "idx_airport_public_profile_versions_current",
        "idx_airport_public_profile_versions_created_at",
        "idx_airport_public_profile_versions_fetched_at",
        "idx_airport_public_profile_versions_review_status",
    ]
    for term in required_terms:
        assert term in migration


def test_public_profile_cache_fetch_runs_dedupe_and_audit_fields():
    migration = migration_text()

    required_terms = [
        "run_type text not null",
        "run_status text not null",
        "cache_result text",
        "idempotency_key text",
        "in_progress_key text",
        "requested_urls jsonb not null default '[]'::jsonb",
        "successful_urls jsonb not null default '[]'::jsonb",
        "failed_urls jsonb not null default '[]'::jsonb",
        "http_statuses jsonb not null default '{}'::jsonb",
        "records_examined integer not null default 0",
        "bytes_fetched bigint not null default 0",
        "content_changed boolean",
        "stale_before_run boolean not null default false",
        "stale_after_run boolean not null default false",
        "unique(idempotency_key)",
        "run_status in ('queued', 'running')",
        "idx_airport_public_profile_fetch_runs_profile_id",
        "idx_airport_public_profile_fetch_runs_source_identity",
        "idx_airport_public_profile_fetch_runs_status_started",
        "idx_airport_public_profile_fetch_runs_type_started",
        "idx_airport_public_profile_fetch_runs_completed_at",
        "idx_airport_public_profile_fetch_runs_cache_result",
        "idx_airport_public_profile_fetch_runs_next_refresh_at",
        "idx_airport_public_profile_fetch_runs_retry_after_at",
        "idx_airport_public_profile_fetch_runs_error_code",
    ]
    for term in required_terms:
        assert term in migration


def test_public_profile_cache_migration_excludes_future_ai_fields():
    migration = migration_text()

    forbidden_terms = [
        "ai_analysis",
        "ai_summary",
        "ai_key_facts",
        "ai_risk_flags",
        "ai_confidence",
        "ai_model",
        "ai_prompt",
        "ai_generated",
        "ai_review",
    ]
    for term in forbidden_terms:
        assert term not in migration


def test_public_profile_cache_document_has_wo_032b_notes():
    doc = DOC_PATH.read_text(encoding="utf-8")

    assert "WO-032B Implementation Notes" in doc
    assert "005_airport_public_profile_cache.sql" in doc
    assert "Future AI fields intentionally excluded" in doc
