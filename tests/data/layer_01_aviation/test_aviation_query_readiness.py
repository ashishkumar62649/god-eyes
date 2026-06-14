import importlib.util
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[3]


def load_script(name: str):
    script_path = REPO_ROOT / "scripts" / name
    spec = importlib.util.spec_from_file_location(name.removesuffix(".py"), script_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_performance_script_builds_parameterized_bbox_query():
    module = load_script("aviation_query_performance.py")

    query = module.build_airport_count_query(
        bbox=module.BBox(min_lon=-125, min_lat=25, max_lon=-65, max_lat=50),
        category="heliport",
        country="US",
    )

    assert "%s" in query.sql
    assert "ST_MakeEnvelope(%s, %s, %s, %s, 4326)" in query.sql
    assert "category_normalized = %s" in query.sql
    assert "iso_country = %s" in query.sql
    assert "-125" not in query.sql
    assert "heliport" not in query.sql
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
        "heliport",
        "US",
    )


@pytest.mark.parametrize(
    "bbox",
    [
        (-181, 25, -65, 50),
        (-125, -91, -65, 50),
        (-125, 25, -181, 50),
        (-125, 25, -65, -91),
        (-65, 25, -125, 50),
        (-125, 50, -65, 25),
    ],
)
def test_bbox_validation_rejects_invalid_ranges(bbox):
    module = load_script("aviation_query_performance.py")

    with pytest.raises(ValueError):
        module.BBox(*bbox).validate()


def test_data_quality_checks_detect_invalid_coordinates_and_geom_mismatch():
    module = load_script("aviation_data_quality.py")
    rows = [
        {
            "ident": "GOOD",
            "latitude_deg": 25.2498,
            "longitude_deg": 55.371,
            "geom_lon": 55.371,
            "geom_lat": 25.2498,
        },
        {
            "ident": "MISSING",
            "latitude_deg": None,
            "longitude_deg": 55.0,
            "geom_lon": None,
            "geom_lat": None,
        },
        {
            "ident": "BADLAT",
            "latitude_deg": 95.0,
            "longitude_deg": 55.0,
            "geom_lon": 55.0,
            "geom_lat": 95.0,
        },
        {
            "ident": "MISMATCH",
            "latitude_deg": 25.0,
            "longitude_deg": 55.0,
            "geom_lon": 55.5,
            "geom_lat": 25.0,
        },
        {
            "ident": "ZERO",
            "latitude_deg": 0.0,
            "longitude_deg": 0.0,
            "geom_lon": 0.0,
            "geom_lat": 0.0,
        },
    ]

    report = module.analyze_coordinate_quality(rows)

    assert report["total"] == 5
    assert report["missing_lat_lon"] == 1
    assert report["invalid_lat_lon_range"] == 1
    assert report["geom_null"] == 1
    assert report["lat_lon_geom_disagree"] == 1
    assert report["suspicious_zero_coordinates"] == 1


def test_category_distribution_and_duplicate_detection_work():
    module = load_script("aviation_data_quality.py")
    rows = [
        {"ident": "DUP", "iata_code": "AAA", "category_normalized": "heliport"},
        {"ident": "DUP", "iata_code": "AAA", "category_normalized": "heliport"},
        {"ident": "UNIQ", "iata_code": "", "category_normalized": "small_airfield"},
        {"ident": "NONE", "iata_code": None, "category_normalized": "small_airfield"},
    ]

    assert module.count_distribution(rows, "category_normalized") == {
        "heliport": 2,
        "small_airfield": 2,
    }
    assert module.find_duplicate_values(rows, "ident") == {"DUP": 2}
    assert module.find_duplicate_values(rows, "iata_code") == {"AAA": 2}


def test_manual_override_recommendation_docs_exist():
    assert (
        REPO_ROOT
        / "docs"
        / "archive"
        / "2026-06-14-final-docs-structure"
        / "data-legacy"
        / "layer_01_aviation"
        / "AVIATION_DATA_QUALITY.md"
    ).read_text(encoding="utf-8").find("manual override") >= 0


def test_query_scripts_do_not_write_raw_data_or_require_secret_files():
    for script_name in [
        "aviation_query_performance.py",
        "aviation_data_quality.py",
    ]:
        script = (REPO_ROOT / "scripts" / script_name).read_text(encoding="utf-8")
        assert "raw/" not in script
        assert ".env" not in script
        assert "open(" not in script
        assert "write_text" not in script
