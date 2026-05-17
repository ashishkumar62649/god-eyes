import importlib.util
import inspect
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT_PATH = REPO_ROOT / "scripts" / "aviation_airport_detail_qa_samples.py"
DOC_PATH = (
    REPO_ROOT
    / "docs"
    / "data"
    / "layer_01_aviation"
    / "AIRPORT_DETAIL_QA_SAMPLES.md"
)


def load_qa_samples_script():
    spec = importlib.util.spec_from_file_location(
        "aviation_airport_detail_qa_samples",
        SCRIPT_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_airport_detail_qa_samples_script_exists():
    assert SCRIPT_PATH.exists()


def test_airport_detail_qa_samples_script_is_read_only():
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


def test_airport_detail_qa_samples_cli_flags_exist():
    module = load_qa_samples_script()

    args = module.build_arg_parser().parse_args(["--json", "--limit", "10"])

    assert args.json is True
    assert args.limit == 10


def test_sample_queries_are_parameterized_for_limit_and_exclusions():
    module = load_qa_samples_script()

    query = module.build_many_navaids_query(
        excluded_source_airport_ids=["5235", "3754"],
        limit=7,
    )

    assert "LIMIT %s" in query.sql
    assert "%s" in query.sql
    assert "5235" not in query.sql
    assert "3754" not in query.sql
    assert query.params[-1] == 7
    assert "ST_DWithin" in query.sql
    assert "aviation_airports" in query.sql
    assert "aviation_navaids" in query.sql


def test_expected_output_fields_are_defined():
    module = load_qa_samples_script()

    expected_fields = {
        "label",
        "source_id",
        "source_object_id",
        "ident",
        "iataCode",
        "name",
        "municipality",
        "iso_country",
        "category",
        "latitude",
        "longitude",
        "runway_count",
        "frequency_count",
        "nearby_navaid_count_100km",
        "notes",
    }

    assert expected_fields.issubset(set(module.OUTPUT_FIELDS))


def test_expected_tables_are_referenced():
    script = SCRIPT_PATH.read_text(encoding="utf-8")

    for table_name in [
        "aviation_airports",
        "aviation_runways",
        "aviation_airport_frequencies",
        "aviation_navaids",
    ]:
        assert table_name in script


def test_script_uses_small_focused_functions():
    module = load_qa_samples_script()
    functions = [
        item
        for _, item in inspect.getmembers(module, inspect.isfunction)
        if getattr(item, "__module__", "") == module.__name__
    ]

    assert len(functions) >= 12
    assert max(len(inspect.getsource(function).splitlines()) for function in functions) < 90


def test_airport_detail_qa_samples_document_exists_and_lists_output_fields():
    doc = DOC_PATH.read_text(encoding="utf-8")

    assert "Airport Detail QA Samples" in doc
    assert "Selected Sample Airports" in doc
    assert "Claude/API" in doc
    assert "Gemini/frontend" in doc
    assert "Kiro/manual QA" in doc

    for field_name in [
        "source_object_id",
        "iataCode",
        "runway_count",
        "frequency_count",
        "nearby_navaid_count_100km",
    ]:
        assert field_name in doc


def test_no_generated_qa_output_dumps_are_committed():
    generated_patterns = [
        "airport_detail_qa_samples*.json",
        "airport_detail_qa_samples*.csv",
        "airport_detail_qa_samples*.txt",
    ]
    generated_files = []
    for pattern in generated_patterns:
        generated_files.extend(REPO_ROOT.glob(pattern))
        generated_files.extend((REPO_ROOT / "docs").glob(f"**/{pattern}"))

    assert generated_files == []
