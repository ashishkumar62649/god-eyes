import importlib.util
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT_PATH = REPO_ROOT / "scripts" / "aviation_category_audit.py"
DOC_PATH = (
    REPO_ROOT
    / "docs"
    / "archive"
    / "2026-06-14-final-docs-structure"
    / "data-legacy"
    / "layer_01_aviation"
    / "AVIATION_CATEGORY_AUDIT_WO-029E.md"
)


def load_audit_script():
    spec = importlib.util.spec_from_file_location("aviation_category_audit", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_category_audit_script_exists():
    assert SCRIPT_PATH.exists()


def test_category_audit_script_is_read_only():
    script = SCRIPT_PATH.read_text(encoding="utf-8")
    upper_script = script.upper()

    for destructive in [
        "INSERT ",
        "UPDATE ",
        "DELETE ",
        "DROP ",
        "TRUNCATE ",
        "ALTER ",
        "CREATE TABLE",
        "COPY ",
    ]:
        assert destructive not in upper_script

    assert "open(" not in script
    assert "write_text" not in script
    assert ".env" not in script


def test_display_mapping_covers_required_panel_categories():
    module = load_audit_script()

    assert module.DISPLAY_CATEGORY_MAPPING == {
        "international_or_major_airport": "Major / International",
        "regional_or_domestic_airport": "Regional / Domestic",
        "small_airfield": "Local / Small Airfields",
        "heliport": "Heliports",
        "water_landing_site": "Water / Seaplane",
        "balloonport": "Balloonports",
        "unknown": "Unknown / Unclassified",
        "closed_or_abandoned": "Closed / Historical",
    }


def test_category_and_type_queries_are_parameterized():
    module = load_audit_script()

    for query in [
        module.build_category_counts_query(),
        module.build_type_source_counts_query(),
        module.build_major_airport_country_counts_query(limit=12),
        module.build_water_country_counts_query(limit=12),
        module.build_source_pattern_query(limit=12),
    ]:
        assert "%s" in query.sql
        assert "layer_01_aviation" not in query.sql
        assert query.params


def test_country_sample_query_validates_country_codes():
    module = load_audit_script()

    query = module.build_country_major_airports_query("IN", limit=25)

    assert "%s" in query.sql
    assert "IN" not in query.sql
    assert query.params == ("layer_01_aviation", "international_or_major_airport", "IN", 25)

    with pytest.raises(ValueError):
        module.build_country_major_airports_query("india", limit=25)


def test_category_sample_query_uses_known_categories_only():
    module = load_audit_script()

    query = module.build_category_sample_query("water_landing_site", limit=5)

    assert "%s" in query.sql
    assert "water_landing_site" not in query.sql
    assert query.params == ("layer_01_aviation", "water_landing_site", 5)

    with pytest.raises(ValueError):
        module.build_category_sample_query("large_airport", limit=5)


def test_category_audit_document_covers_required_sections():
    doc = DOC_PATH.read_text(encoding="utf-8")

    for expected in [
        "Aviation Category Audit WO-029E",
        "Exact Database Categories And Counts",
        "Source Type Distribution",
        "Recommended Frontend Display Category Mapping",
        "India And China Major Airport Evidence",
        "Asia Water And Seaplane Evidence",
        "Missing Or Ambiguous Mappings",
        "QA Examples",
        "Warnings And Limitations",
    ]:
        assert expected in doc
