from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATION_PATH = (
    REPO_ROOT
    / "database"
    / "migrations"
    / "layers"
    / "layer_01_aviation"
    / "008_airport_traffic_metrics.sql"
)
DOC_PATH = (
    REPO_ROOT
    / "docs"
    / "archive"
    / "2026-06-14-final-docs-structure"
    / "data-legacy"
    / "layer_01_aviation"
    / "AIRPORT_INTELLIGENCE_SCHEMA_PLAN.md"
)


def migration_text() -> str:
    return MIGRATION_PATH.read_text(encoding="utf-8").lower()


def test_airport_traffic_metrics_migration_exists_and_creates_table():
    migration = migration_text()

    assert MIGRATION_PATH.exists()
    assert "create extension if not exists pgcrypto" in migration
    assert "create table if not exists airport_traffic_metrics" in migration


def test_airport_traffic_metrics_migration_is_additive_and_preserves_existing_tables():
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
    ]
    for term in destructive_terms:
        assert term not in migration


def test_airport_traffic_metrics_has_required_columns_and_foreign_keys():
    migration = migration_text()

    required_terms = [
        "id uuid primary key default gen_random_uuid()",
        "airport_id uuid not null references aviation_airports(id)",
        "module_id uuid references airport_intelligence_modules(id)",
        "primary_source_link_id uuid references airport_source_links(id)",
        "metric_type text not null",
        "period_type text not null default 'annual'",
        "period_year integer not null",
        "period_start date",
        "period_end date",
        "metric_value numeric(20,4) not null",
        "metric_unit text not null",
        "traffic_status text not null default 'ok'",
        "confidence_label text",
        "confidence_score numeric(5,4)",
        "source_summary jsonb",
        "data_payload jsonb",
        "notes text",
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


def test_airport_traffic_metrics_has_allowed_value_and_quality_constraints():
    migration = migration_text()

    required_terms = [
        "airport_traffic_metrics_metric_type_check",
        "metric_type in",
        "'passengers_total'",
        "'passengers_domestic'",
        "'passengers_international'",
        "'aircraft_movements'",
        "'cargo_tonnes'",
        "'freight_tonnes'",
        "'mail_tonnes'",
        "'cargo_kg'",
        "'freight_kg'",
        "'mail_kg'",
        "'routes_count'",
        "'destinations_count'",
        "'seats_total'",
        "'other'",
        "airport_traffic_metrics_period_type_check",
        "period_type = 'annual'",
        "airport_traffic_metrics_metric_unit_check",
        "metric_unit in",
        "'passengers'",
        "'movements'",
        "'tonnes'",
        "'kg'",
        "'routes'",
        "'destinations'",
        "'seats'",
        "'count'",
        "'other'",
        "airport_traffic_metrics_traffic_status_check",
        "traffic_status in ('ok', 'stale', 'fetching', 'no_data', 'low_confidence', 'error')",
        "airport_traffic_metrics_metric_value_check",
        "metric_value >= 0",
        "airport_traffic_metrics_period_year_check",
        "period_year >= 1900 and period_year <= 2200",
        "airport_traffic_metrics_confidence_score_check",
        "confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)",
        "airport_traffic_metrics_period_dates_check",
        "period_start is null or period_end is null or period_start <= period_end",
        "airport_traffic_metrics_stale_after_fetched_check",
        "stale_at is null or fetched_at is null or stale_at > fetched_at",
        "airport_traffic_metrics_expires_after_fetched_check",
        "expires_at is null or fetched_at is null or expires_at > fetched_at",
        "airport_traffic_metrics_unit_consistency_check",
        "metric_type not in ('passengers_total', 'passengers_domestic', 'passengers_international')",
        "right(metric_type, 7) <> '_tonnes'",
        "right(metric_type, 3) <> '_kg'",
    ]
    for term in required_terms:
        assert term in migration


def test_airport_traffic_metrics_has_unique_source_backed_rule_and_indexes():
    migration = migration_text()

    required_terms = [
        "constraint airport_traffic_metrics_airport_metric_year_key unique(airport_id, metric_type, period_type, period_year)",
        "airport_traffic_metrics_source_backed_ok_check",
        "traffic_status <> 'ok'",
        "primary_source_link_id is not null",
        "source_summary is not null",
        "data_payload is not null",
        "idx_airport_traffic_metrics_airport_id",
        "idx_airport_traffic_metrics_module_id",
        "idx_airport_traffic_metrics_primary_source_link_id",
        "idx_airport_traffic_metrics_metric_type",
        "idx_airport_traffic_metrics_period_year",
        "idx_airport_traffic_metrics_period_type_year",
        "idx_airport_traffic_metrics_airport_metric_year",
        "idx_airport_traffic_metrics_traffic_status",
        "idx_airport_traffic_metrics_metric_value",
        "idx_airport_traffic_metrics_confidence_score",
        "idx_airport_traffic_metrics_stale_at",
        "idx_airport_traffic_metrics_expires_at",
        "idx_airport_traffic_metrics_next_refresh_at",
        "idx_airport_traffic_metrics_data_payload_gin",
        "idx_airport_traffic_metrics_source_summary_gin",
    ]
    for term in required_terms:
        assert term in migration


def test_airport_traffic_metrics_document_has_wo_038_notes():
    doc = DOC_PATH.read_text(encoding="utf-8")

    assert "WO-038 Stage 3 Implementation Notes" in doc
    assert "008_airport_traffic_metrics.sql" in doc
    assert "Annual traffic metrics only" in doc
    assert "Traffic is source-backed only" in doc
    assert "Growth is computed later from multiple annual rows" in doc
    assert "Monthly traffic, API implementation, worker implementation, derived intelligence/capability tags, and OSM layout are intentionally not included" in doc
