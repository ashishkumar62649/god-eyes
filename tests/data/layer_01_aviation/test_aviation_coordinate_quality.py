import importlib.util
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATION_PATH = (
    REPO_ROOT
    / "database"
    / "migrations"
    / "layers"
    / "layer_01_aviation"
    / "004_aviation_coordinate_quality_overrides.sql"
)
DOC_PATH = (
    REPO_ROOT
    / "docs"
    / "archive"
    / "2026-06-14-final-docs-structure"
    / "data-legacy"
    / "layer_01_aviation"
    / "AVIATION_COORDINATE_QUALITY_AND_OVERRIDES.md"
)


def load_coordinate_quality_script():
    script_path = REPO_ROOT / "scripts" / "aviation_coordinate_quality.py"
    spec = importlib.util.spec_from_file_location("aviation_coordinate_quality", script_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def read_migration() -> str:
    return MIGRATION_PATH.read_text(encoding="utf-8")


def test_coordinate_quality_migration_file_exists():
    assert MIGRATION_PATH.exists()


def test_coordinate_quality_migration_is_additive_and_preserves_airports():
    migration = read_migration().lower()

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

    assert "create table if not exists aviation_coordinate_quality_reviews" in migration
    assert "create table if not exists aviation_coordinate_overrides" in migration


def test_coordinate_quality_migration_has_coordinate_and_confidence_constraints():
    migration = read_migration().lower()

    assert "quality_status" in migration
    assert "visually_verified" in migration
    assert "suspected_offset" in migration
    assert "original_latitude >= -90" in migration
    assert "original_latitude <= 90" in migration
    assert "original_longitude >= -180" in migration
    assert "original_longitude <= 180" in migration
    assert "override_latitude >= -90" in migration
    assert "override_latitude <= 90" in migration
    assert "override_longitude >= -180" in migration
    assert "override_longitude <= 180" in migration
    assert "confidence_score >= 0" in migration
    assert "confidence_score <= 1" in migration


def test_coordinate_quality_migration_has_indexes_and_provenance_fields():
    migration = read_migration().lower()

    assert "reviewed_by" in migration
    assert "approved_by" in migration
    assert "evidence_url" in migration
    assert "override_reason" in migration
    assert "idx_aviation_coordinate_quality_reviews_source" in migration
    assert "idx_aviation_coordinate_quality_reviews_airport_ident" in migration
    assert "idx_aviation_coordinate_quality_reviews_status" in migration
    assert "idx_aviation_coordinate_overrides_source" in migration
    assert "idx_aviation_coordinate_overrides_airport_ident" in migration
    assert "idx_aviation_coordinate_overrides_active" in migration


def test_coordinate_quality_script_builds_parameterized_sample_query():
    module = load_coordinate_quality_script()

    query = module.build_visual_review_candidates_query(7)

    assert "%s" in query.sql
    assert "LIMIT %s" in query.sql
    assert "7" not in query.sql
    assert query.params[-1] == 7
    assert "aviation_airports" in query.sql


def test_coordinate_quality_script_has_optional_table_queries():
    module = load_coordinate_quality_script()

    assert module.table_exists_query("aviation_coordinate_overrides").params == (
        "aviation_coordinate_overrides",
    )
    assert module.table_count_query("aviation_coordinate_overrides").sql == (
        "SELECT COUNT(*) FROM aviation_coordinate_overrides"
    )


def test_coordinate_quality_script_does_not_write_raw_data_or_require_secret_files():
    script = (REPO_ROOT / "scripts" / "aviation_coordinate_quality.py").read_text(
        encoding="utf-8"
    )

    assert "raw/" not in script
    assert ".env" not in script
    assert "open(" not in script
    assert "write_text" not in script
    assert "INSERT " not in script.upper()
    assert "UPDATE " not in script.upper()
    assert "DELETE " not in script.upper()


def test_coordinate_quality_document_exists_and_covers_override_rules():
    doc = DOC_PATH.read_text(encoding="utf-8")

    assert "Source-Data Preservation Rule" in doc
    assert "Manual Override Strategy" in doc
    assert "approval" in doc.lower()
    assert "active override" in doc.lower()
    assert "imagery alignment" in doc.lower()
