import importlib.util
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT_PATH = REPO_ROOT / "scripts" / "aviation_detail_data_readiness.py"
DOC_PATH = (
    REPO_ROOT
    / "docs"
    / "data"
    / "layer_01_aviation"
    / "AVIATION_DETAIL_DATA_READINESS.md"
)


def load_readiness_script():
    spec = importlib.util.spec_from_file_location(
        "aviation_detail_data_readiness",
        SCRIPT_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_detail_readiness_script_exists():
    assert SCRIPT_PATH.exists()


def test_detail_readiness_script_is_read_only():
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


def test_detail_readiness_script_references_expected_tables():
    script = SCRIPT_PATH.read_text(encoding="utf-8")

    for table_name in [
        "aviation_airports",
        "aviation_runways",
        "aviation_airport_frequencies",
        "aviation_navaids",
        "aviation_countries",
        "aviation_regions",
    ]:
        assert table_name in script


def test_sample_queries_are_parameterized_for_limit_and_radius():
    module = load_readiness_script()

    rich_query = module.build_rich_airport_sample_query(limit=7)
    missing_query = module.build_missing_detail_sample_query(limit=9)
    navaid_query = module.build_nearby_navaid_sample_query(limit=5, radius_meters=25000)

    assert "LIMIT %s" in rich_query.sql
    assert "LIMIT %s" in missing_query.sql
    assert "ST_DWithin" in navaid_query.sql
    assert "%s" in navaid_query.sql
    assert rich_query.params[-1] == 7
    assert missing_query.params[-1] == 9
    assert 25000 in navaid_query.params
    assert navaid_query.params[-1] == 5
    assert "25000" not in navaid_query.sql


def test_distribution_query_rejects_unknown_table_or_field():
    module = load_readiness_script()

    try:
        module.build_distribution_query("bad_table", "type")
    except ValueError as exc:
        assert "unsupported distribution" in str(exc)
    else:
        raise AssertionError("unsupported distribution table was accepted")

    try:
        module.build_distribution_query("aviation_runways", "bad_field")
    except ValueError as exc:
        assert "unsupported distribution" in str(exc)
    else:
        raise AssertionError("unsupported distribution field was accepted")


def test_json_output_mode_exists():
    module = load_readiness_script()

    args = module.build_arg_parser().parse_args(["--json", "--limit", "3"])

    assert args.json is True
    assert args.limit == 3


def test_detail_readiness_docs_exist_and_cover_object_intel_sections():
    doc = DOC_PATH.read_text(encoding="utf-8")

    assert "Aviation Detail Data Readiness" in doc
    assert "Runway Readiness" in doc
    assert "Frequency Readiness" in doc
    assert "Navaid Readiness" in doc
    assert "Recommended Future Object Intel Sections" in doc
    assert "Airport Overview" in doc
    assert "Coordinate Quality" in doc
