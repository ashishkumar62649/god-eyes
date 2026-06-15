from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATION_PATH = (
    REPO_ROOT
    / "database"
    / "migrations"
    / "layers"
    / "layer_01_aviation"
    / "010_airport_image_assets.sql"
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
    if not MIGRATION_PATH.exists():
        return ""
    return MIGRATION_PATH.read_text(encoding="utf-8").lower()


def test_airport_image_assets_migration_exists_and_creates_table():
    migration = migration_text()

    assert MIGRATION_PATH.exists()
    assert "create extension if not exists pgcrypto" in migration
    assert "create table if not exists airport_image_assets" in migration


def test_airport_image_assets_migration_is_additive_and_preserves_existing_tables():
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
        "alter table airport_derived_intelligence",
    ]
    for term in destructive_terms:
        assert term not in migration


def test_airport_image_assets_has_required_columns_and_foreign_key():
    migration = migration_text()

    required_terms = [
        "id uuid primary key default gen_random_uuid()",
        "airport_id uuid not null references aviation_airports(id) on delete cascade",
        "source_type text not null",
        "source_name text",
        "source_url text",
        "source_file_title text",
        "image_url text not null",
        "thumbnail_url text",
        "original_url text",
        "caption text",
        "description text",
        "attribution_text text",
        "license_name text",
        "license_url text",
        "width_px integer",
        "height_px integer",
        "media_type text",
        "image_kind text not null default 'unknown'",
        "is_hero boolean not null default false",
        "rank integer not null default 100",
        "confidence_label text not null default 'unknown'",
        "confidence_score numeric(4,3)",
        "content_hash text",
        "source_entity_id text",
        "fetched_at timestamptz not null default now()",
        "last_checked_at timestamptz",
        "expires_at timestamptz",
        "created_at timestamptz not null default now()",
        "updated_at timestamptz not null default now()",
        "raw_metadata jsonb not null default '{}'::jsonb",
        "diagnostics jsonb not null default '{}'::jsonb",
    ]
    for term in required_terms:
        assert term in migration


def test_airport_image_assets_has_allowed_value_constraints():
    migration = migration_text()

    required_terms = [
        "airport_image_assets_source_type_check",
        "source_type in ('wikimedia_commons', 'wikipedia', 'wikidata', 'official_site', 'manual', 'other')",
        "airport_image_assets_image_kind_check",
        "image_kind in ('photo', 'logo', 'map', 'terminal', 'runway', 'aerial', 'tower', 'interior', 'unknown')",
        "airport_image_assets_confidence_label_check",
        "confidence_label in ('high', 'medium', 'low', 'unknown')",
    ]
    for term in required_terms:
        assert term in migration


def test_airport_image_assets_has_required_data_quality_constraints():
    migration = migration_text()

    required_terms = [
        "airport_image_assets_image_url_not_empty_check",
        "btrim(image_url) <> ''",
        "airport_image_assets_rank_check",
        "rank >= 0",
        "airport_image_assets_width_px_check",
        "width_px is null or width_px > 0",
        "airport_image_assets_height_px_check",
        "height_px is null or height_px > 0",
        "airport_image_assets_confidence_score_check",
        "confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)",
        "airport_image_assets_expires_after_fetched_check",
        "expires_at is null or expires_at > fetched_at",
        "airport_image_assets_last_checked_after_fetched_check",
        "last_checked_at is null or last_checked_at >= fetched_at",
    ]
    for term in required_terms:
        assert term in migration


def test_airport_image_assets_has_dedupe_and_single_hero_rules():
    migration = migration_text()

    required_terms = [
        "constraint airport_image_assets_airport_image_url_key unique(airport_id, image_url)",
        "idx_airport_image_assets_single_hero",
        "unique",
        "on airport_image_assets(airport_id)",
        "where is_hero = true",
    ]
    for term in required_terms:
        assert term in migration


def test_airport_image_assets_has_expected_indexes():
    migration = migration_text()

    required_terms = [
        "idx_airport_image_assets_airport_id",
        "on airport_image_assets(airport_id)",
        "idx_airport_image_assets_airport_rank",
        "on airport_image_assets(airport_id, rank)",
        "idx_airport_image_assets_airport_is_hero",
        "on airport_image_assets(airport_id, is_hero)",
        "idx_airport_image_assets_airport_image_kind",
        "on airport_image_assets(airport_id, image_kind)",
        "idx_airport_image_assets_source_type",
        "on airport_image_assets(source_type)",
        "idx_airport_image_assets_confidence_label",
        "on airport_image_assets(confidence_label)",
        "idx_airport_image_assets_fetched_at",
        "on airport_image_assets(fetched_at)",
        "idx_airport_image_assets_expires_at",
        "on airport_image_assets(expires_at)",
        "idx_airport_image_assets_content_hash",
        "on airport_image_assets(content_hash)",
    ]
    for term in required_terms:
        assert term in migration


def test_airport_image_assets_has_jsonb_gin_indexes():
    migration = migration_text()

    required_terms = [
        "idx_airport_image_assets_raw_metadata_gin",
        "on airport_image_assets using gin(raw_metadata)",
        "idx_airport_image_assets_diagnostics_gin",
        "on airport_image_assets using gin(diagnostics)",
    ]
    for term in required_terms:
        assert term in migration


def test_airport_image_assets_document_has_wo_050_notes():
    doc = DOC_PATH.read_text(encoding="utf-8")

    assert "WO-050 Airport Image Assets" in doc
    assert "supports multiple images per airport" in doc
    assert "Wikimedia Commons, Wikipedia, and Wikidata" in doc
    assert "heroImage and images[]" in doc
    assert "popup slider and Intel panel gallery" in doc
    assert "No images are fetched in this work order" in doc
