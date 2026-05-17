import importlib.util
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]


def load_search_script():
    script_path = REPO_ROOT / "scripts" / "aviation_search_performance.py"
    spec = importlib.util.spec_from_file_location("aviation_search_performance", script_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_broad_search_sql_is_parameterized():
    module = load_search_script()

    query = module.build_broad_search_query("Dubai")

    assert "%s" in query.sql
    assert "Dubai" not in query.sql
    assert "ILIKE" in query.sql
    assert query.params[0] == "layer_01_aviation"
    assert all(param == "%Dubai%" for param in query.params[1:])


def test_exact_field_search_sql_is_parameterized():
    module = load_search_script()

    query = module.build_exact_field_search_query("KR")

    assert "%s" in query.sql
    assert "KR" not in query.sql
    assert "iso_country = %s" in query.sql
    assert "category_normalized = %s" in query.sql
    assert query.params == ("layer_01_aviation", "KR", "KR", "KR", "kr")


def test_search_terms_cover_expected_benchmark_cases():
    module = load_search_script()

    terms = [case.term for case in module.search_cases()]

    assert {"Dubai", "London", "New York", "Tokyo", "KR"}.issubset(set(terms))
    assert any("heliport" in term.lower() for term in terms)


def test_search_benchmark_script_does_not_write_raw_data_or_require_secret_files():
    script = (REPO_ROOT / "scripts" / "aviation_search_performance.py").read_text(
        encoding="utf-8"
    )

    assert "raw/" not in script
    assert ".env" not in script
    assert "open(" not in script
    assert "write_text" not in script


def test_search_performance_document_exists():
    doc = (
        REPO_ROOT
        / "docs"
        / "data"
        / "layer_01_aviation"
        / "AVIATION_SEARCH_PERFORMANCE.md"
    ).read_text(encoding="utf-8")

    assert "Aviation Search Performance" in doc
    assert "migration" in doc.lower()


def test_search_index_migration_is_safe_when_present():
    migration_path = (
        REPO_ROOT
        / "database"
        / "migrations"
        / "layers"
        / "layer_01_aviation"
        / "003_aviation_search_indexes.sql"
    )
    if not migration_path.exists():
        return

    migration = migration_path.read_text(encoding="utf-8").lower()
    assert "create extension if not exists pg_trgm" in migration
    assert "using gin" in migration
    assert "drop table" not in migration
    assert "alter table" not in migration
    assert "delete from" not in migration
