from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATION_PATH = (
    REPO_ROOT
    / "database"
    / "migrations"
    / "layers"
    / "layer_01_aviation"
    / "011_airport_layout_features.sql"
)
DOC_PATH = (
    REPO_ROOT
    / "docs"
    / "data"
    / "layer_01_aviation"
    / "AIRPORT_INTELLIGENCE_SCHEMA_PLAN.md"
)


def migration_text() -> str:
    if not MIGRATION_PATH.exists():
        return ""
    return MIGRATION_PATH.read_text(encoding="utf-8").lower()


def test_airport_layout_features_migration_exists_and_creates_tables():
    migration = migration_text()

    assert MIGRATION_PATH.exists()
    assert "create extension if not exists pgcrypto" in migration
    assert "create extension if not exists postgis" in migration
    assert "create table if not exists airport_layout_features" in migration
    assert "create table if not exists airport_layout_fetch_runs" in migration


def test_airport_layout_features_migration_is_additive_and_preserves_existing_tables():
    migration = migration_text()

    destructive_terms = [
        "drop table",
        "drop column",
        "truncate",
        "delete from",
        "insert into airport_layout_features",
        "insert into airport_layout_fetch_runs",
        "insert into aviation_airports",
        "update aviation_airports",
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
        "alter table airport_image_assets",
    ]
    for term in destructive_terms:
        assert term not in migration


def test_airport_layout_features_has_required_columns_and_foreign_key():
    migration = migration_text()

    required_terms = [
        "id uuid primary key default gen_random_uuid()",
        "airport_id uuid not null references aviation_airports(id) on delete cascade",
        "feature_type text not null",
        "feature_subtype text",
        "feature_name text",
        "source_type text not null",
        "source_name text",
        "source_url text",
        "source_object_id text",
        "source_entity_id text",
        "geometry geometry(geometry, 4326) not null",
        "geometry_type text not null",
        "centroid geometry(point, 4326)",
        "bbox geometry(polygon, 4326)",
        "confidence_label text not null default 'unknown'",
        "confidence_score numeric(4,3)",
        "rank integer not null default 100",
        "is_primary boolean not null default false",
        "is_active boolean not null default true",
        "fetched_at timestamptz not null default now()",
        "last_checked_at timestamptz",
        "expires_at timestamptz",
        "created_at timestamptz not null default now()",
        "updated_at timestamptz not null default now()",
        "content_hash text",
        "raw_metadata jsonb not null default '{}'::jsonb",
        "diagnostics jsonb not null default '{}'::jsonb",
    ]
    for term in required_terms:
        assert term in migration


def test_airport_layout_features_has_allowed_value_constraints():
    migration = migration_text()

    required_terms = [
        "airport_layout_features_feature_type_check",
        "feature_type in ('runway', 'taxiway', 'apron', 'terminal', 'gate', 'stand', 'tower', 'helipad', 'boundary', 'service_road', 'parking', 'hangar', 'fuel', 'navigation_aid', 'unknown')",
        "airport_layout_features_source_type_check",
        "source_type in ('ourairports', 'openstreetmap', 'wikidata', 'official_site', 'manual', 'derived', 'other')",
        "airport_layout_features_geometry_type_check",
        "geometry_type in ('point', 'line', 'polygon', 'multipoint', 'multilinestring', 'multipolygon', 'geometry')",
        "airport_layout_features_confidence_label_check",
        "confidence_label in ('high', 'medium', 'low', 'unknown')",
    ]
    for term in required_terms:
        assert term in migration


def test_airport_layout_features_has_data_quality_and_spatial_constraints():
    migration = migration_text()

    required_terms = [
        "airport_layout_features_confidence_score_check",
        "confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)",
        "airport_layout_features_rank_check",
        "rank >= 0",
        "airport_layout_features_expires_after_fetched_check",
        "expires_at is null or expires_at > fetched_at",
        "airport_layout_features_last_checked_after_fetched_check",
        "last_checked_at is null or last_checked_at >= fetched_at",
        "airport_layout_features_geometry_srid_check",
        "st_srid(geometry) = 4326",
        "airport_layout_features_geometry_not_empty_check",
        "not st_isempty(geometry)",
        "airport_layout_features_centroid_srid_check",
        "centroid is null or st_srid(centroid) = 4326",
        "airport_layout_features_bbox_srid_check",
        "bbox is null or st_srid(bbox) = 4326",
        "airport_layout_features_source_object_id_not_empty_check",
        "source_object_id is null or btrim(source_object_id) <> ''",
        "airport_layout_features_content_hash_not_empty_check",
        "content_hash is null or btrim(content_hash) <> ''",
    ]
    for term in required_terms:
        assert term in migration


def test_airport_layout_features_has_required_indexes():
    migration = migration_text()

    required_terms = [
        "idx_airport_layout_features_airport_id",
        "on airport_layout_features(airport_id)",
        "idx_airport_layout_features_airport_feature_type",
        "on airport_layout_features(airport_id, feature_type)",
        "idx_airport_layout_features_airport_source_type",
        "on airport_layout_features(airport_id, source_type)",
        "idx_airport_layout_features_airport_is_active",
        "on airport_layout_features(airport_id, is_active)",
        "idx_airport_layout_features_airport_rank",
        "on airport_layout_features(airport_id, rank)",
        "idx_airport_layout_features_feature_type",
        "on airport_layout_features(feature_type)",
        "idx_airport_layout_features_source_type",
        "on airport_layout_features(source_type)",
        "idx_airport_layout_features_confidence_label",
        "on airport_layout_features(confidence_label)",
        "idx_airport_layout_features_fetched_at",
        "on airport_layout_features(fetched_at)",
        "idx_airport_layout_features_expires_at",
        "on airport_layout_features(expires_at)",
        "idx_airport_layout_features_content_hash",
        "on airport_layout_features(content_hash)",
        "idx_airport_layout_features_source_object_id",
        "on airport_layout_features(source_object_id)",
    ]
    for term in required_terms:
        assert term in migration


def test_airport_layout_features_has_spatial_and_jsonb_indexes():
    migration = migration_text()

    required_terms = [
        "idx_airport_layout_features_geometry_gist",
        "on airport_layout_features using gist(geometry)",
        "idx_airport_layout_features_centroid_gist",
        "on airport_layout_features using gist(centroid)",
        "idx_airport_layout_features_bbox_gist",
        "on airport_layout_features using gist(bbox)",
        "idx_airport_layout_features_raw_metadata_gin",
        "on airport_layout_features using gin(raw_metadata)",
        "idx_airport_layout_features_diagnostics_gin",
        "on airport_layout_features using gin(diagnostics)",
    ]
    for term in required_terms:
        assert term in migration


def test_airport_layout_features_has_partial_unique_dedupe_rules():
    migration = migration_text()

    required_terms = [
        "idx_airport_layout_features_source_object_dedupe",
        "unique",
        "on airport_layout_features(airport_id, source_type, source_object_id)",
        "where source_object_id is not null",
        "idx_airport_layout_features_content_hash_dedupe",
        "on airport_layout_features(airport_id, feature_type, content_hash)",
        "where content_hash is not null",
    ]
    for term in required_terms:
        assert term in migration


def test_airport_layout_fetch_runs_has_required_columns_constraints_and_indexes():
    migration = migration_text()

    required_terms = [
        "create table if not exists airport_layout_fetch_runs",
        "id uuid primary key default gen_random_uuid()",
        "airport_id uuid references aviation_airports(id) on delete cascade",
        "source_type text not null",
        "run_status text not null default 'queued'",
        "started_at timestamptz",
        "finished_at timestamptz",
        "features_found integer not null default 0",
        "features_written integer not null default 0",
        "error_message text",
        "diagnostics jsonb not null default '{}'::jsonb",
        "created_at timestamptz not null default now()",
        "updated_at timestamptz not null default now()",
        "airport_layout_fetch_runs_source_type_check",
        "airport_layout_fetch_runs_status_check",
        "run_status in ('queued', 'running', 'success', 'partial', 'failed', 'skipped')",
        "airport_layout_fetch_runs_finished_requires_started_check",
        "finished_at is null or started_at is not null",
        "airport_layout_fetch_runs_finished_after_started_check",
        "finished_at is null or finished_at >= started_at",
        "airport_layout_fetch_runs_features_found_check",
        "features_found >= 0",
        "airport_layout_fetch_runs_features_written_check",
        "features_written >= 0",
        "idx_airport_layout_fetch_runs_airport_id",
        "idx_airport_layout_fetch_runs_source_type",
        "idx_airport_layout_fetch_runs_run_status",
        "idx_airport_layout_fetch_runs_created_at",
        "idx_airport_layout_fetch_runs_started_at",
        "idx_airport_layout_fetch_runs_finished_at",
        "idx_airport_layout_fetch_runs_diagnostics_gin",
        "on airport_layout_fetch_runs using gin(diagnostics)",
    ]
    for term in required_terms:
        assert term in migration


def test_airport_layout_features_document_has_wo_054_notes():
    doc = DOC_PATH.read_text(encoding="utf-8")

    assert "WO-054 Airport Layout Features" in doc
    assert "source-backed airport infrastructure geometry" in doc
    assert "OurAirports runway coordinates, OpenStreetMap/Overpass, Wikidata, and official sources" in doc
    assert "API will later expose layout features by airport" in doc
    assert "Frontend will later render visual infrastructure overlays" in doc
    assert "No source fetching or frontend rendering is part of this work order" in doc
