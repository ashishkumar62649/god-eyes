from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATION_PATH = (
    REPO_ROOT
    / "database"
    / "migrations"
    / "layers"
    / "layer_02_borders_boundaries"
    / "001_borders_boundaries_schema.sql"
)


def migration_text() -> str:
    if not MIGRATION_PATH.exists():
        return ""
    return MIGRATION_PATH.read_text(encoding="utf-8").lower()


def test_borders_boundaries_migration_exists_and_creates_expected_tables():
    migration = migration_text()

    assert MIGRATION_PATH.exists()
    assert "create extension if not exists pgcrypto" in migration
    assert "create extension if not exists postgis" in migration
    assert "create table if not exists border_boundary_sources" in migration
    assert "create table if not exists border_boundaries" in migration
    assert "create table if not exists border_boundary_compliance_reviews" in migration


def test_borders_boundaries_migration_is_schema_only_with_no_seed_or_copy_data():
    migration = migration_text()

    forbidden_terms = [
        "insert into",
        "\ncopy ",
        "copy border_",
        "drop table",
        "drop column",
        "truncate",
        "delete from",
        "update border_boundary_sources",
        "update border_boundaries",
        "update border_boundary_compliance_reviews",
    ]
    for term in forbidden_terms:
        assert term not in migration


def test_borders_boundaries_migration_contains_no_external_data_download_references():
    migration = migration_text()

    forbidden_terms = [
        "http://",
        "https://",
        ".geojson",
        ".shp",
        ".shapefile",
        ".kml",
        ".pdf",
        ".csv",
        "download",
        "natural earth",
        "openstreetmap",
        "surveyofindia",
    ]
    for term in forbidden_terms:
        assert term not in migration


def test_border_boundary_sources_has_required_columns_and_india_gate_fields():
    migration = migration_text()

    required_terms = [
        "source_id text unique not null",
        "source_name text not null",
        "source_url text",
        "license_name text",
        "license_url text",
        "attribution text",
        "approved_for_india boolean not null default false",
        "approved_for_non_india boolean not null default false",
        "india_conflict_checked boolean not null default false",
        "human_approved_by text",
        "human_approved_at timestamptz",
        "approval_notes text",
        "created_at timestamptz not null default now()",
        "updated_at timestamptz not null default now()",
    ]
    for term in required_terms:
        assert term in migration


def test_border_boundaries_has_required_columns_and_geometry():
    migration = migration_text()

    required_terms = [
        "layer_id text not null default 'layer_02_borders_boundaries'",
        "source_id text not null references border_boundary_sources(source_id)",
        "source_object_id text",
        "boundary_type text not null",
        "boundary_level text",
        "country_iso2 text",
        "country_iso3 text",
        "admin_level integer",
        "name text not null",
        "name_local text",
        "display_name text",
        "disputed boolean not null default false",
        "dispute_status text not null default 'undisputed'",
        "india_sensitive boolean not null default false",
        "india_compliance_status text not null default 'not_applicable'",
        "geometry geometry(geometry, 4326) not null",
        "properties jsonb not null default '{}'::jsonb",
        "valid_from date",
        "valid_to date",
    ]
    for term in required_terms:
        assert term in migration


def test_borders_boundaries_has_required_check_constraints():
    migration = migration_text()

    required_terms = [
        "border_boundaries_layer_id_check",
        "layer_id = 'layer_02_borders_boundaries'",
        "border_boundaries_boundary_type_check",
        "boundary_type in (",
        "'country_boundary'",
        "'admin_boundary'",
        "'coastline'",
        "'eez'",
        "'disputed_boundary'",
        "'claim_line'",
        "'line_of_control'",
        "'other'",
        "border_boundaries_dispute_status_check",
        "'undisputed'",
        "'disputed'",
        "'claimed'",
        "'occupied'",
        "'provisional'",
        "'unknown'",
        "border_boundaries_india_compliance_status_check",
        "'not_applicable'",
        "'requires_soi_review'",
        "'soi_approved'",
        "'blocked'",
        "jsonb_typeof(properties) = 'object'",
        "st_srid(geometry) = 4326",
        "not st_isempty(geometry)",
    ]
    for term in required_terms:
        assert term in migration


def test_compliance_reviews_has_required_columns_and_constraints():
    migration = migration_text()

    required_terms = [
        "create table if not exists border_boundary_compliance_reviews",
        "review_scope text not null",
        "source_id text references border_boundary_sources(source_id)",
        "boundary_id uuid references border_boundaries(id)",
        "review_status text not null",
        "reviewed_by text",
        "reviewed_at timestamptz",
        "evidence_url text",
        "notes text",
        "border_boundary_compliance_reviews_scope_check",
        "'source_license'",
        "'india_compliance'",
        "'non_india_license'",
        "'disputed_territory'",
        "'data_quality'",
        "border_boundary_compliance_reviews_status_check",
        "'pending'",
        "'pass'",
        "'fail'",
        "'blocked'",
    ]
    for term in required_terms:
        assert term in migration


def test_borders_boundaries_has_required_indexes_and_idempotent_statements():
    migration = migration_text()

    required_terms = [
        "create index if not exists idx_border_boundaries_geometry_gist",
        "on border_boundaries using gist(geometry)",
        "idx_border_boundaries_source_id",
        "on border_boundaries(source_id)",
        "idx_border_boundaries_boundary_type",
        "idx_border_boundaries_country_iso2",
        "idx_border_boundaries_country_iso3",
        "idx_border_boundaries_disputed",
        "idx_border_boundaries_india_sensitive",
        "idx_border_boundaries_india_compliance_status",
        "idx_border_boundary_sources_source_id",
        "on border_boundary_sources(source_id)",
        "idx_border_boundary_compliance_reviews_source_id",
        "idx_border_boundary_compliance_reviews_boundary_id",
        "idx_border_boundary_compliance_reviews_review_status",
    ]
    for term in required_terms:
        assert term in migration


def test_borders_boundaries_has_source_object_dedupe_where_possible():
    migration = migration_text()

    required_terms = [
        "idx_border_boundaries_source_object_dedupe",
        "unique",
        "on border_boundaries(source_id, source_object_id)",
        "where source_object_id is not null",
    ]
    for term in required_terms:
        assert term in migration
