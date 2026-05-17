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
SCRIPT_PATH = REPO_ROOT / "scripts" / "aviation_coordinate_quality.py"
DOC_PATH = (
    REPO_ROOT
    / "docs"
    / "data"
    / "layer_01_aviation"
    / "AVIATION_COORDINATE_MIGRATION_VERIFICATION.md"
)


def load_coordinate_quality_script():
    spec = importlib.util.spec_from_file_location("aviation_coordinate_quality", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def migration_text() -> str:
    return MIGRATION_PATH.read_text(encoding="utf-8").lower()


def test_migration_004_exists_and_defines_expected_tables():
    migration = migration_text()

    assert MIGRATION_PATH.exists()
    assert "create table if not exists aviation_coordinate_quality_reviews" in migration
    assert "create table if not exists aviation_coordinate_overrides" in migration


def test_migration_004_keeps_aviation_airports_read_only():
    migration = migration_text()

    assert "alter table aviation_airports" not in migration
    assert "update aviation_airports" not in migration
    assert "insert into aviation_airports" not in migration
    assert "delete from aviation_airports" not in migration
    assert "drop table" not in migration
    assert "truncate" not in migration


def test_migration_004_has_coordinate_and_confidence_constraints():
    migration = migration_text()

    expected_checks = [
        "original_latitude >= -90",
        "original_latitude <= 90",
        "original_longitude >= -180",
        "original_longitude <= 180",
        "override_latitude >= -90",
        "override_latitude <= 90",
        "override_longitude >= -180",
        "override_longitude <= 180",
        "confidence_score >= 0",
        "confidence_score <= 1",
    ]
    for expected_check in expected_checks:
        assert expected_check in migration


def test_migration_004_has_operational_lookup_indexes():
    migration = migration_text()

    expected_indexes = [
        "idx_aviation_coordinate_quality_reviews_source",
        "idx_aviation_coordinate_quality_reviews_airport_ident",
        "idx_aviation_coordinate_overrides_source",
        "idx_aviation_coordinate_overrides_airport_ident",
        "idx_aviation_coordinate_overrides_active",
        "idx_aviation_coordinate_overrides_one_active_per_source",
    ]
    for expected_index in expected_indexes:
        assert expected_index in migration


def test_coordinate_quality_script_handles_missing_optional_tables(monkeypatch):
    module = load_coordinate_quality_script()

    monkeypatch.setattr(module, "table_exists", lambda _connection, _table_name: False)

    assert module.optional_count(object(), "aviation_coordinate_quality_reviews") is None
    assert module.optional_active_overrides_count(object()) is None


def test_coordinate_quality_script_handles_present_optional_tables(monkeypatch):
    module = load_coordinate_quality_script()

    monkeypatch.setattr(module, "table_exists", lambda _connection, _table_name: True)
    monkeypatch.setattr(module, "fetch_scalar", lambda _connection, _query: 3)

    assert module.optional_count(object(), "aviation_coordinate_quality_reviews") == 3
    assert module.optional_active_overrides_count(object()) == 3


def test_coordinate_quality_script_exists_and_uses_parameterized_queries():
    module = load_coordinate_quality_script()

    assert SCRIPT_PATH.exists()
    assert module.table_exists_query("aviation_coordinate_overrides").params == (
        "aviation_coordinate_overrides",
    )
    query = module.build_visual_review_candidates_query(5)
    assert "LIMIT %s" in query.sql
    assert query.params[-1] == 5


def test_migration_verification_document_exists():
    doc = DOC_PATH.read_text(encoding="utf-8")

    assert "Migration applied: yes" in doc
    assert "Tables verified" in doc
    assert "Constraints verified" in doc
    assert "Source data preservation" in doc
