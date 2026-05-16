import importlib.util
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT_PATH = REPO_ROOT / "scripts" / "aviation_density_view_data_reference.py"
DOC_PATH = (
    REPO_ROOT
    / "docs"
    / "data"
    / "layer_01_aviation"
    / "AVIATION_DENSITY_VIEW_DATA_REFERENCE.md"
)


def load_density_script():
    spec = importlib.util.spec_from_file_location(
        "aviation_density_view_data_reference",
        SCRIPT_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_density_reference_script_exists():
    assert SCRIPT_PATH.exists()


def test_density_reference_script_is_read_only():
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


def test_density_reference_cli_flags_exist():
    module = load_density_script()

    args = module.build_arg_parser().parse_args(
        ["--json", "--country-limit", "12", "--grid-limit", "8", "--cell-size-degrees", "2.5"]
    )

    assert args.json is True
    assert args.country_limit == 12
    assert args.grid_limit == 8
    assert args.cell_size_degrees == 2.5


def test_density_grid_query_is_parameterized():
    module = load_density_script()

    query = module.build_grid_density_query(cell_size_degrees=5.0, limit=10)

    assert "%s" in query.sql
    assert "LIMIT %s" in query.sql
    assert "aviation_airports" in query.sql
    assert "GROUP BY lon_bucket, lat_bucket" in query.sql
    assert "5.0" not in query.sql
    assert "10" not in query.sql
    assert query.params[-1] == 10


def test_density_bbox_query_is_parameterized():
    module = load_density_script()

    query = module.bbox_count_query(module.BBox(-125, 25, -65, 50))

    assert "ST_MakeEnvelope(%s, %s, %s, %s, 4326)" in query.sql
    assert "-125" not in query.sql
    assert query.params == (
        "layer_01_aviation",
        -125,
        25,
        -65,
        50,
        -125,
        25,
        -65,
        50,
    )


@pytest.mark.parametrize(
    "bbox",
    [
        (-181, 25, -65, 50),
        (-125, -91, -65, 50),
        (-125, 25, 181, 50),
        (-125, 25, -65, 91),
        (-65, 25, -125, 50),
        (-125, 50, -65, 25),
    ],
)
def test_density_bbox_validation_rejects_invalid_ranges(bbox):
    module = load_density_script()

    with pytest.raises(ValueError):
        module.BBox(*bbox).validate()


def test_density_reference_document_exists_and_covers_required_sections():
    doc = DOC_PATH.read_text(encoding="utf-8")

    for expected in [
        "Aviation Density View Data Reference",
        "Total Airport Count",
        "Counts By Category",
        "Operational Versus Closed",
        "Densest Bounding Boxes",
        "QA Regions",
        "Density Mode Limit Recommendations",
        "Global All-Point Rendering Warning",
        "Known Limitations",
    ]:
        assert expected in doc
