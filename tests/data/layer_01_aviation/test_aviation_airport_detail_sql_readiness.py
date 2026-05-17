import importlib.util
import inspect
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT_PATH = REPO_ROOT / "scripts" / "aviation_airport_detail_sql_readiness.py"
DOC_PATH = (
    REPO_ROOT
    / "docs"
    / "data"
    / "layer_01_aviation"
    / "AIRPORT_DETAIL_SQL_READINESS.md"
)


def load_readiness_script():
    spec = importlib.util.spec_from_file_location(
        "aviation_airport_detail_sql_readiness",
        SCRIPT_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_airport_detail_sql_readiness_script_exists():
    assert SCRIPT_PATH.exists()


def test_airport_detail_sql_readiness_script_is_read_only():
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


def test_airport_detail_sql_readiness_cli_flags_exist():
    module = load_readiness_script()

    args = module.build_arg_parser().parse_args(
        ["--json", "--limit", "5", "--airport-ident", "OMDB"]
    )

    assert args.json is True
    assert args.limit == 5
    assert args.airport_ident == "OMDB"


def test_airport_lookup_queries_are_parameterized():
    module = load_readiness_script()

    by_source = module.build_airport_by_source_object_query(
        source_id="ourairports",
        source_airport_id="4242",
    )
    by_ident = module.build_airport_by_ident_query("OMDB")

    assert "%s" in by_source.sql
    assert "%s" in by_ident.sql
    assert "4242" not in by_source.sql
    assert "OMDB" not in by_ident.sql
    assert by_source.params == ("layer_01_aviation", "ourairports", "4242")
    assert by_ident.params == ("layer_01_aviation", "OMDB")
    assert "latitude_deg" in by_source.sql
    assert "longitude_deg" in by_source.sql
    assert "geom" in by_source.sql


def test_detail_queries_are_parameterized_for_airport_inputs():
    module = load_readiness_script()
    airport = {
        "layer_id": "layer_01_aviation",
        "source_id": "ourairports",
        "ident": "OMDB",
        "source_airport_id": "3000",
    }

    runways = module.build_runways_query(airport, limit=11)
    frequencies = module.build_frequencies_query(airport, limit=13)
    navaids = module.build_nearby_navaids_query(
        airport,
        radius_meters=100000,
        limit=20,
    )

    assert "LIMIT %s" in runways.sql
    assert "LIMIT %s" in frequencies.sql
    assert "LIMIT %s" in navaids.sql
    assert "ST_DWithin" in navaids.sql
    assert "OMDB" not in runways.sql
    assert "OMDB" not in frequencies.sql
    assert "100000" not in navaids.sql
    assert runways.params[-1] == 11
    assert frequencies.params[-1] == 13
    assert navaids.params[-2:] == (100000, 20)


def test_effective_coordinate_query_handles_override_table_presence():
    module = load_readiness_script()
    airport = {
        "layer_id": "layer_01_aviation",
        "source_id": "ourairports",
        "source_airport_id": "3000",
    }

    with_override = module.build_effective_coordinate_query(
        airport,
        override_table_exists=True,
    )
    without_override = module.build_effective_coordinate_query(
        airport,
        override_table_exists=False,
    )

    assert "LEFT JOIN aviation_coordinate_overrides" in with_override.sql
    assert "aviation_coordinate_overrides" not in without_override.sql
    assert with_override.params == ("layer_01_aviation", "ourairports", "3000")
    assert without_override.params == ("layer_01_aviation", "ourairports", "3000")


def test_expected_tables_are_referenced():
    script = SCRIPT_PATH.read_text(encoding="utf-8")

    for table_name in [
        "aviation_airports",
        "aviation_runways",
        "aviation_airport_frequencies",
        "aviation_navaids",
        "aviation_coordinate_overrides",
        "aviation_coordinate_quality_reviews",
    ]:
        assert table_name in script


def test_script_uses_small_focused_functions():
    module = load_readiness_script()
    functions = [
        item
        for _, item in inspect.getmembers(module, inspect.isfunction)
        if getattr(item, "__module__", "") == module.__name__
    ]

    assert len(functions) >= 12
    assert max(len(inspect.getsource(function).splitlines()) for function in functions) < 90


def test_airport_detail_sql_readiness_document_exists():
    doc = DOC_PATH.read_text(encoding="utf-8")

    assert "Airport Detail SQL Readiness" in doc
    assert "Queries Benchmarked" in doc
    assert "Airport Overview Lookup Readiness" in doc
    assert "Nearby Navaid Spatial Lookup Readiness" in doc
    assert "Index Recommendation" in doc
    assert "Next Safe API Task" in doc
