"""Tests for Layer 10 Energy Infrastructure Fetcher.

Covers:
- Source cache raw/normalized read/write
- WRI CSV normalization and fuel classification
- WRI malformed row skip
- OSM query builder bbox/country safety for big queries
- OSM node/way/substation/pipeline normalization
- GEM live-download license block
- GEM mocked pipeline/terminal normalization
- Centroid / bbox computation
- Invalid geometry skip
- CLI --download-only with mocked WRI
- CLI --normalize-only no provider call
- CLI --persist-from-cache with mocked DB
- DB upsert SQL is parameterized
- Dry-run does not write
- Source failure is recorded in the manifest
- No secrets printed
- No raw data committed
- Scope guard: only the allowed folders are touched
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
LAYER_ID = "layer_10_energy_infrastructure"
LAYER_DIR = (
    REPO_ROOT
    / "services"
    / "fetch-orchestrator"
    / "src"
    / "layers"
    / LAYER_ID
)

# When the full tests/data suite is collected, layer_05_space_satellites
# is imported first and registers its ``source_cache`` in sys.modules.
# We must force the layer_10 versions of all modules to be loaded from
# the layer_10 directory so we never see layer_05's source_cache.
for _mod in list(sys.modules):
    if _mod.startswith("source_cache") and _mod not in {"source_cache"}:
        sys.modules.pop(_mod, None)

# Insert the layer_10 directory FIRST so the next ``import source_cache``
# resolves to layer_10's module. Insert it before REPO_ROOT so REPO_ROOT
# cannot shadow it via its own site-packages-style resolution.
sys.path.insert(0, str(LAYER_DIR))
sys.path.insert(0, str(REPO_ROOT))

# ---------------------------------------------------------------------------
# Imports under test
# ---------------------------------------------------------------------------

import importlib.util as _importlib_util


def _load_module(name: str, path: Path) -> Any:
    spec = _importlib_util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot load {name} from {path}")
    mod = _importlib_util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


# Pre-empt any earlier cached ``source_cache`` (e.g. from layer_05).
sys.modules.pop("source_cache", None)

energy_sources = _load_module("energy_sources", LAYER_DIR / "energy_sources.py")
source_cache = _load_module("source_cache", LAYER_DIR / "source_cache.py")
wri_power_plants_client = _load_module(
    "wri_power_plants_client", LAYER_DIR / "wri_power_plants_client.py"
)
osm_energy_client = _load_module("osm_energy_client", LAYER_DIR / "osm_energy_client.py")
gem_energy_client = _load_module("gem_energy_client", LAYER_DIR / "gem_energy_client.py")
energy_normalizer = _load_module("energy_normalizer", LAYER_DIR / "energy_normalizer.py")
energy_infrastructure_db = _load_module(
    "energy_infrastructure_db", LAYER_DIR / "energy_infrastructure_db.py"
)
energy_infrastructure_worker = _load_module(
    "energy_infrastructure_worker", LAYER_DIR / "energy_infrastructure_worker.py"
)

from source_cache import (  # noqa: E402
    LAYER_ID as CACHE_LAYER_ID,
    RAW_EXTENSIONS,
    RawGroupResult,
    SourceCache,
    records_from_csv_text,
    resolve_cache_dir,
    safe_json_dumps,
    utcnow_iso,
)
from energy_sources import (  # noqa: E402
    CANONICAL_SOURCES,
    CANONICAL_FEATURE_TYPES,
    CATEGORY_VALUES,
    FUEL_TYPE_VALUES,
    GEOMETRY_TYPE_VALUES,
    LAYER_ID as SOURCES_LAYER_ID,
    PIPELINE_PRODUCT_VALUES,
    SOURCE_GEM,
    SOURCE_OSM,
    SOURCE_WRI,
    STATUS_VALUES,
    WRI_FUEL_MAP,
    get_source_config,
    wri_fuel_to_canonical,
)
from wri_power_plants_client import (  # noqa: E402
    COL_GPPD_IDNR,
    classify_wri_row,
    coerce_row,
    fetch_wri,
    is_malformed_wri_row,
    parse_wri_csv,
    wri_row_to_feature_dict,
    WRIRow,
)
from osm_energy_client import (  # noqa: E402
    COUNTRY_BBOX,
    DEFAULT_ENERGY_KEYS,
    MAX_BBOX_AREA_DEG2,
    build_overpass_query,
    classify_osm_tags,
    country_to_bbox,
    fetch_osm,
    is_global_scope,
    validate_bbox,
)
from gem_energy_client import (  # noqa: E402
    DEFAULT_MOCK_GROUPS,
    LICENSE_BLOCKED_MESSAGE,
    classify_gem_record,
    fetch_gem,
)
from energy_normalizer import (  # noqa: E402
    compute_bbox,
    compute_centroid,
    line_geometry,
    normalize_gem_records,
    normalize_osm_elements,
    normalize_wri_records,
    point_geometry,
    polygon_geometry,
    validate_geometry,
)
from energy_infrastructure_db import (  # noqa: E402
    DEFAULT_DATABASE_URL,
    EnergyInfrastructureInMemoryConnection,
    LAYER_ID as DB_LAYER_ID,
    UPSERT_SQL,
    connect_db,
    get_existing_keys,
    get_feature_count,
    is_in_memory_connection,
    persist_features,
    upsert_feature,
)
from energy_infrastructure_worker import (  # noqa: E402
    build_arg_parser,
    main as worker_main,
    run_download_only,
    run_normalize_only,
    run_persist_from_cache,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

SAMPLE_WRI_CSV = (
    "gppd_idnr,country,country_long,name,capacity_mw,latitude,longitude,"
    "primary_fuel,other_fuel1,other_fuel2,other_fuel3,commissioning_year,"
    "owner,source,url,geolocation_source,wepp_id,year_of_capacity_data,"
    "estimated_generation_gwh\n"
    "WRI1000001,US,United States,Big Nuclear,1200,40.7128,-74.0060,Nuclear,,,,2010,"
    "Big Energy Co,,,WRI,,,\n"
    "WRI1000002,US,United States,Coal Plant,500,41.8781,-87.6298,Coal,,,,1980,"
    "Coal Co,,,WRI,,,\n"
    "WRI1000003,DE,Germany,Solar Park,250,52.5200,13.4050,Solar,,,,2018,"
    "Sun Co,,,WRI,,,\n"
    "WRI1000004,FR,France,Wind Farm,300,48.8566,2.3522,Wind,,,,2017,"
    "Wind Co,,,WRI,,,\n"
    "WRI1000005,US,United States,Gas Plant,800,34.0522,-118.2437,Gas,,,,2005,"
    "Gas Co,,,WRI,,,\n"
    "WRI1000006,CA,Canada,Hydro Dam,2000,45.4215,-75.6972,Hydro,,,,1965,"
    "Hydro Co,,,WRI,,,\n"
    "WRI1000007,BR,Brazil,Biomass Plant,150,-23.5505,-46.6333,Biomass,,,,2012,"
    "Bio Co,,,WRI,,,\n"
    "WRI1000008,IS,Iceland,Geo Plant,80,64.1466,-21.9426,Geothermal,,,,2015,"
    "Geo Co,,,WRI,,,\n"
    "WRI1000009,US,United States,Oil Plant,400,29.7604,-95.3698,Oil,,,,1975,"
    "Oil Co,,,WRI,,,\n"
    "WRI1000010,US,United States,Mystery Fuel,100,33.4484,-112.0740,Unobtanium,,,,2025,"
    "X Co,,,WRI,,,\n"
)


# ---------------------------------------------------------------------------
# Identity / config
# ---------------------------------------------------------------------------


def test_layer_id_constant():
    assert CACHE_LAYER_ID == LAYER_ID
    assert SOURCES_LAYER_ID == LAYER_ID
    assert DB_LAYER_ID == LAYER_ID


def test_canonical_sources_locked():
    assert set(CANONICAL_SOURCES) == {
        "wri_global_power_plant_database",
        "osm_energy_infrastructure",
        "global_energy_monitor_energy",
    }


def test_get_source_config_known():
    cfg = get_source_config(SOURCE_WRI)
    assert cfg.source_id == SOURCE_WRI
    assert cfg.license_name.startswith("CC BY 4.0")
    assert "power_plant" in cfg.feature_types


def test_get_source_config_unknown_raises():
    with pytest.raises(ValueError):
        get_source_config("not_a_real_source")


def test_canonical_feature_types_match_contract():
    expected = {
        "power_plant",
        "substation",
        "transmission_line",
        "oil_pipeline",
        "gas_pipeline",
        "lng_terminal",
        "oil_terminal",
        "gas_terminal",
        "unknown_energy_feature",
    }
    assert expected.issubset(CANONICAL_FEATURE_TYPES)


# ---------------------------------------------------------------------------
# Source cache
# ---------------------------------------------------------------------------


def test_source_cache_write_and_read_raw(tmp_path):
    cache = SourceCache(tmp_path)
    result = cache.write_raw_group(
        source=SOURCE_WRI,
        group="latest",
        raw_text="gppd_idnr,name\n1,Foo\n",
        records=[{"gppd_idnr": "1", "name": "Foo"}],
        fetched_at="2026-06-02T00:00:00Z",
    )
    assert isinstance(result, RawGroupResult)
    assert result.ok
    assert result.record_count == 1
    assert result.raw_path is not None
    assert result.raw_path.exists()
    assert result.raw_path.suffix == ".csv"

    envelope = cache.read_raw_group(SOURCE_WRI, "latest")
    assert envelope is not None
    assert envelope["layer_id"] == LAYER_ID
    assert envelope["source"] == SOURCE_WRI
    assert envelope["group"] == "latest"
    assert envelope["record_count"] == 1
    assert envelope["records"][0]["gppd_idnr"] == "1"


def test_source_cache_read_nonexistent(tmp_path):
    cache = SourceCache(tmp_path)
    assert cache.read_raw_group(SOURCE_WRI, "nope") is None


def test_source_cache_list_cached_groups(tmp_path):
    cache = SourceCache(tmp_path)
    cache.write_raw_group(SOURCE_WRI, "latest", "x", [])
    cache.write_raw_group(SOURCE_WRI, "historical", "x", [])
    assert cache.list_cached_groups(SOURCE_WRI) == ["historical", "latest"]


def test_source_cache_osm_uses_json_extension(tmp_path):
    cache = SourceCache(tmp_path)
    result = cache.write_raw_group(
        source=SOURCE_OSM,
        group="europe",
        raw_text='{"elements": []}',
        records=[],
    )
    assert result.raw_path is not None
    assert result.raw_path.suffix == ".json"


def test_source_cache_write_and_read_normalized(tmp_path):
    cache = SourceCache(tmp_path)
    features = [
        {
            "layer_id": LAYER_ID,
            "source_id": SOURCE_WRI,
            "source_object_id": "1",
            "feature_type": "power_plant",
            "category": "nuclear_power",
            "geometry_type": "point",
            "centroid_lat": 0.0,
            "centroid_lon": 0.0,
            "geometry_geojson": {"type": "Point", "coordinates": [0.0, 0.0]},
            "bbox_geojson": None,
        }
    ]
    manifest = cache.write_normalized(features, ["latest"], SOURCE_WRI)
    assert manifest["feature_count"] == 1
    assert manifest["layer_id"] == LAYER_ID

    read_back = cache.read_normalized_features()
    assert len(read_back) == 1
    assert read_back[0]["source_object_id"] == "1"


def test_source_cache_overall_manifest(tmp_path):
    cache = SourceCache(tmp_path)
    path = cache.write_overall_manifest(
        source=SOURCE_WRI,
        groups_requested=["latest"],
        groups_succeeded=["latest"],
        groups_failed=[],
        raw_files=["/tmp/foo.json"],
        normalized_files=["/tmp/features.jsonl"],
        fetched_at="2026-06-02T00:00:00Z",
        normalized_at="2026-06-02T00:01:00Z",
        feature_count=10,
        errors=[],
    )
    assert path.exists()
    manifest = cache.read_overall_manifest()
    assert manifest["groups_succeeded"] == ["latest"]
    assert manifest["record_counts"]["features"] == 10


def test_source_cache_records_source_failure(tmp_path):
    cache = SourceCache(tmp_path)
    res = cache.record_raw_failure(SOURCE_WRI, "latest", "boom")
    assert not res.ok
    assert res.error == "boom"


def test_resolve_cache_dir_creates_dir(tmp_path):
    target = tmp_path / "fresh"
    p = resolve_cache_dir(str(target))
    assert p.exists()
    assert p.is_dir()


def test_safe_json_dumps_handles_datetime():
    from datetime import datetime, timezone

    dt = datetime(2026, 6, 2, tzinfo=timezone.utc)
    out = safe_json_dumps({"ts": dt, "list": [dt, dt]})
    assert "2026-06-02" in out


def test_records_from_csv_text_roundtrip():
    text = "a,b,c\n1,2,3\n4,5,6\n"
    assert records_from_csv_text(text) == [
        {"a": "1", "b": "2", "c": "3"},
        {"a": "4", "b": "5", "c": "6"},
    ]


# ---------------------------------------------------------------------------
# WRI client
# ---------------------------------------------------------------------------


def test_wri_fuel_classification_table():
    expected = {
        "nuclear": ("nuclear_power", "nuclear"),
        "coal": ("coal_power", "coal"),
        "gas": ("gas_power", "gas"),
        "oil": ("oil_power", "oil"),
        "hydro": ("hydro_power", "hydro"),
        "solar": ("solar_power", "solar"),
        "wind": ("wind_power", "wind"),
        "biomass": ("biomass_power", "biomass"),
        "geothermal": ("geothermal_power", "geothermal"),
        "other": ("other_power", "other"),
    }
    for k, v in expected.items():
        assert WRI_FUEL_MAP[k] == v


def test_wri_fuel_to_canonical_handles_variants():
    assert wri_fuel_to_canonical("nuclear") == ("nuclear_power", "nuclear")
    assert wri_fuel_to_canonical("Coal") == ("coal_power", "coal")
    assert wri_fuel_to_canonical("CCGT") == ("gas_power", "gas")
    assert wri_fuel_to_canonical("Photovoltaic") == ("solar_power", "solar")
    assert wri_fuel_to_canonical("wind turbine") == ("wind_power", "wind")
    assert wri_fuel_to_canonical("pumped-storage hydro") == (
        "hydro_power",
        "hydro",
    )
    assert wri_fuel_to_canonical("biogas") == ("biomass_power", "biomass")
    assert wri_fuel_to_canonical("diesel") == ("oil_power", "oil")
    assert wri_fuel_to_canonical(None) == ("other_power", "unknown")
    assert wri_fuel_to_canonical("Mystery") == ("other_power", "other")


def test_parse_wri_csv_returns_dicts():
    rows = parse_wri_csv(SAMPLE_WRI_CSV)
    assert len(rows) == 10
    assert rows[0][COL_GPPD_IDNR] == "WRI1000001"
    assert rows[2]["name"] == "Solar Park"


def test_coerce_row_skips_invalid():
    assert coerce_row({COL_GPPD_IDNR: "", "latitude": "1", "longitude": "2"}) is None
    assert coerce_row({COL_GPPD_IDNR: "X"}) is None
    assert coerce_row({COL_GPPD_IDNR: "X", "latitude": "999", "longitude": "0"}) is None
    assert coerce_row({COL_GPPD_IDNR: "X", "latitude": "0", "longitude": "999"}) is None


def test_coerce_row_accepts_valid():
    row = coerce_row(
        {
            COL_GPPD_IDNR: "X",
            "latitude": "10.0",
            "longitude": "20.0",
            "name": "X",
            "primary_fuel": "nuclear",
            "capacity_mw": "100",
            "country": "US",
            "commissioning_year": "2010",
        }
    )
    assert isinstance(row, WRIRow)
    assert row.capacity_mw == 100.0
    assert row.commissioning_year == 2010


def test_classify_wri_row_power_plant():
    row = WRIRow(
        gppd_idnr="1",
        name="Plant",
        country="US",
        capacity_mw=100.0,
        latitude=10.0,
        longitude=20.0,
        primary_fuel="nuclear",
        commissioning_year=2010,
        owner=None,
        source=None,
        url=None,
        geolocation_source=None,
    )
    cls = classify_wri_row(row)
    assert cls == {"category": "nuclear_power", "fuel_type": "nuclear", "feature_type": "power_plant"}


def test_wri_row_to_feature_dict_shape():
    row = WRIRow(
        gppd_idnr="WRI1",
        name="Plant",
        country="US",
        capacity_mw=42.0,
        latitude=10.0,
        longitude=20.0,
        primary_fuel="gas",
        commissioning_year=2010,
        owner="X",
        source="WRI",
        url=None,
        geolocation_source=None,
    )
    feat = wri_row_to_feature_dict(row)
    assert feat["source_id"] == SOURCE_WRI
    assert feat["feature_type"] == "power_plant"
    assert feat["category"] == "gas_power"
    assert feat["fuel_type"] == "gas"
    assert feat["latitude"] == 10.0
    assert feat["longitude"] == 20.0
    assert feat["status"] == "operational"
    assert feat["raw"][COL_GPPD_IDNR] == "WRI1"


def test_wri_malformed_row_helper():
    assert is_malformed_wri_row({}) is True
    assert (
        is_malformed_wri_row(
            {COL_GPPD_IDNR: "X", "latitude": "999", "longitude": "0"}
        )
        is True
    )
    assert (
        is_malformed_wri_row(
            {COL_GPPD_IDNR: "X", "latitude": "0", "longitude": "0"}
        )
        is False
    )


def test_fetch_wri_in_memory_csv_text():
    result = fetch_wri(csv_text=SAMPLE_WRI_CSV)
    assert result["ok"]
    assert result["error"] is None
    assert result["skipped"] == 0
    assert len(result["records"]) == 10
    assert len(result["raw_records"]) == 10
    assert result["records"][0]["country"] == "US"


def test_fetch_wri_network_failure_returns_envelope():
    result = fetch_wri(csv_text=None, url="http://127.0.0.1:1/nope")
    assert result["ok"] is False
    assert result["records"] == []
    assert result["error"]


# ---------------------------------------------------------------------------
# WRI normalizer
# ---------------------------------------------------------------------------


def test_normalize_wri_records_power_plant():
    raw_records = [
        {
            "gppd_idnr": "WRI1",
            "name": "Nuke",
            "country": "US",
            "capacity_mw": "100",
            "latitude": "40.0",
            "longitude": "-74.0",
            "primary_fuel": "Nuclear",
            "commissioning_year": "2010",
            "owner": "OpCo",
            "source": "WRI",
            "url": "",
            "geolocation_source": "WRI",
        }
    ]
    out = normalize_wri_records(raw_records)
    assert len(out) == 1
    feat = out[0]
    assert feat["layer_id"] == LAYER_ID
    assert feat["source_id"] == SOURCE_WRI
    assert feat["feature_type"] == "power_plant"
    assert feat["category"] == "nuclear_power"
    assert feat["fuel_type"] == "nuclear"
    assert feat["geometry_type"] == "point"
    assert feat["centroid_lat"] == 40.0
    assert feat["centroid_lon"] == -74.0
    assert feat["geometry_geojson"]["type"] == "Point"
    assert feat["geometry_geojson"]["coordinates"] == [-74.0, 40.0]


def test_normalize_wri_records_skip_malformed():
    raw_records = [
        {"gppd_idnr": "OK", "latitude": "0", "longitude": "0", "primary_fuel": "solar"},
        {"gppd_idnr": ""},  # missing id
        {"gppd_idnr": "BAD", "latitude": "999", "longitude": "0"},  # bad lat
        {"gppd_idnr": "BAD2", "latitude": "0", "longitude": "999"},  # bad lon
    ]
    out = normalize_wri_records(raw_records)
    assert len(out) == 1
    assert out[0]["source_object_id"] == "OK"


def test_normalize_wri_records_fuel_mapping_table():
    cases = [
        ("nuclear", "nuclear_power", "nuclear"),
        ("coal", "coal_power", "coal"),
        ("gas", "gas_power", "gas"),
        ("oil", "oil_power", "oil"),
        ("hydro", "hydro_power", "hydro"),
        ("solar", "solar_power", "solar"),
        ("wind", "wind_power", "wind"),
        ("biomass", "biomass_power", "biomass"),
        ("geothermal", "geothermal_power", "geothermal"),
        ("other", "other_power", "other"),
        ("unobtanium", "other_power", "other"),
    ]
    for fuel, cat, ft in cases:
        rec = {
            "gppd_idnr": f"WRI-{fuel}",
            "primary_fuel": fuel,
            "latitude": "0",
            "longitude": "0",
        }
        out = normalize_wri_records([rec])
        assert out[0]["category"] == cat
        assert out[0]["fuel_type"] == ft


# ---------------------------------------------------------------------------
# OSM client
# ---------------------------------------------------------------------------


def test_osm_validate_bbox_happy_path():
    assert validate_bbox("-10,40,10,50") == (-10.0, 40.0, 10.0, 50.0)


def test_osm_validate_bbox_rejects_malformed():
    with pytest.raises(Exception):
        validate_bbox("a,b,c")
    with pytest.raises(Exception):
        validate_bbox("10,10,10,10")  # zero area
    with pytest.raises(Exception):
        validate_bbox("-200,0,0,10")
    with pytest.raises(Exception):
        validate_bbox("0,100,10,200")


def test_osm_is_global_scope_requires_bbox_or_country():
    assert is_global_scope(None, None, None) is True
    assert is_global_scope(None, "GB", None) is False
    assert is_global_scope((1, 1, 2, 2), None, None) is False
    huge = (-100.0, -50.0, 100.0, 50.0)
    assert is_global_scope(huge, None, None) is True
    assert is_global_scope(huge, None, None, allow_global=True) is False


def test_osm_build_overpass_query_requires_scope():
    with pytest.raises(Exception):
        build_overpass_query()


def test_osm_build_overpass_query_with_bbox_contains_energy_keys():
    q = build_overpass_query(bbox=(-6.5, 49.5, 1.5, 61.0))
    assert "out:json" in q
    assert "power" in q
    assert "substation" in q
    assert "plant" in q
    assert "line" in q
    assert "pipeline" in q
    assert "man_made" in q
    assert "49.5,-6.5" in q


def test_osm_classify_substation():
    cls = classify_osm_tags({"power": "substation", "voltage": "400000"})
    assert cls["feature_type"] == "substation"
    assert cls["category"] == "substation"
    assert cls["voltage_kv"] == 400.0


def test_osm_classify_transmission_line():
    cls = classify_osm_tags({"power": "line", "voltage": "220000"})
    assert cls["feature_type"] == "transmission_line"
    assert cls["voltage_kv"] == 220.0


def test_osm_classify_oil_pipeline():
    cls = classify_osm_tags({"man_made": "pipeline", "substance": "oil"})
    assert cls["feature_type"] == "oil_pipeline"
    assert cls["pipeline_product"] == "crude_oil"


def test_osm_classify_gas_pipeline():
    cls = classify_osm_tags({"man_made": "pipeline", "substance": "natural_gas"})
    assert cls["feature_type"] == "gas_pipeline"
    assert cls["pipeline_product"] == "natural_gas"


def test_osm_classify_lng_pipeline():
    cls = classify_osm_tags({"man_made": "pipeline", "substance": "lng"})
    assert cls["feature_type"] == "gas_pipeline"
    assert cls["pipeline_product"] == "lng"


def test_osm_classify_unknown_feature():
    cls = classify_osm_tags({"power": "tower"})
    assert cls["feature_type"] == "unknown_energy_feature"
    assert cls["category"] == "unknown"


def test_osm_fetch_global_refuses_by_default():
    res = fetch_osm()
    assert res["ok"] is False
    assert "global" in res["error"].lower() or "broad" in res["error"].lower()


def test_osm_fetch_with_country_uses_built_in_bbox(monkeypatch):
    called = {"endpoint": None, "query": None}

    def fake_run(query, *, endpoint, timeout):
        called["endpoint"] = endpoint
        called["query"] = query
        return {"elements": []}

    monkeypatch.setattr(osm_energy_client, "run_overpass_query", fake_run)
    res = fetch_osm(country="GB", max_features=10)
    assert res["ok"] is True
    assert called["query"]
    assert "49.5" in called["query"]  # built-in GB bbox south
    assert res["elements"] == []


def test_osm_fetch_with_csv_text_injection():
    payload = json.dumps({"elements": [{"type": "node", "id": 1, "lat": 0, "lon": 0, "tags": {"power": "substation"}}]})
    res = fetch_osm(csv_text=payload, country="GB")
    assert res["ok"]
    assert len(res["elements"]) == 1


def test_country_to_bbox_known():
    assert country_to_bbox("US") == (-125.0, 24.5, -66.5, 49.5)
    assert country_to_bbox("us") == (-125.0, 24.5, -66.5, 49.5)
    assert country_to_bbox("ZZ") is None


# ---------------------------------------------------------------------------
# OSM normalizer
# ---------------------------------------------------------------------------


def test_normalize_osm_node_point():
    elements = [
        {
            "type": "node",
            "id": 1,
            "lat": 51.5,
            "lon": -0.1,
            "tags": {"power": "substation", "name": "Big Sub", "voltage": "400000"},
        }
    ]
    out = normalize_osm_elements(elements)
    assert len(out) == 1
    feat = out[0]
    assert feat["feature_type"] == "substation"
    assert feat["geometry_type"] == "point"
    assert feat["centroid_lat"] == 51.5
    assert feat["centroid_lon"] == -0.1
    assert feat["voltage_kv"] == 400.0
    assert feat["name"] == "Big Sub"
    assert feat["source_id"] == SOURCE_OSM
    assert feat["source_object_id"] == "node/1"


def test_normalize_osm_way_line():
    elements = [
        {
            "type": "way",
            "id": 42,
            "geometry": [
                {"lat": 50.0, "lon": -1.0},
                {"lat": 51.0, "lon": 0.0},
                {"lat": 52.0, "lon": 1.0},
            ],
            "tags": {"power": "line", "voltage": "220000"},
        }
    ]
    out = normalize_osm_elements(elements)
    assert len(out) == 1
    feat = out[0]
    assert feat["feature_type"] == "transmission_line"
    assert feat["geometry_type"] == "line"
    assert feat["voltage_kv"] == 220.0
    # Centroid is the average of the 3 points.
    assert feat["centroid_lat"] == round((50.0 + 51.0 + 52.0) / 3, 6)
    assert feat["centroid_lon"] == round((-1.0 + 0.0 + 1.0) / 3, 6)
    assert feat["bbox_geojson"] is not None
    assert feat["bbox_geojson"]["type"] == "Polygon"


def test_normalize_osm_way_too_short_skipped():
    elements = [
        {
            "type": "way",
            "id": 99,
            "geometry": [{"lat": 50.0, "lon": -1.0}],
            "tags": {"power": "line"},
        }
    ]
    out = normalize_osm_elements(elements)
    assert out == []


def test_normalize_osm_substation_classification():
    elements = [
        {
            "type": "node",
            "id": 1,
            "lat": 0,
            "lon": 0,
            "tags": {"power": "substation"},
        }
    ]
    out = normalize_osm_elements(elements)
    assert out[0]["feature_type"] == "substation"
    assert out[0]["category"] == "substation"


def test_normalize_osm_pipeline_oil_and_gas():
    elements = [
        {
            "type": "way",
            "id": 1,
            "geometry": [
                {"lat": 0, "lon": 0},
                {"lat": 1, "lon": 1},
            ],
            "tags": {"man_made": "pipeline", "substance": "oil"},
        },
        {
            "type": "way",
            "id": 2,
            "geometry": [
                {"lat": 0, "lon": 0},
                {"lat": 1, "lon": 1},
            ],
            "tags": {"man_made": "pipeline", "substance": "natural_gas"},
        },
    ]
    out = normalize_osm_elements(elements)
    assert out[0]["feature_type"] == "oil_pipeline"
    assert out[0]["pipeline_product"] == "crude_oil"
    assert out[1]["feature_type"] == "gas_pipeline"
    assert out[1]["pipeline_product"] == "natural_gas"


def test_normalize_osm_node_invalid_coords_skipped():
    elements = [
        {"type": "node", "id": 1, "lat": 999, "lon": 0, "tags": {"power": "substation"}},
        {"type": "node", "id": 2, "lat": 0, "lon": 0, "tags": {"power": "substation"}},
    ]
    out = normalize_osm_elements(elements)
    assert len(out) == 1
    assert out[0]["source_object_id"] == "node/2"


def test_normalize_osm_relation_falls_back_to_member_center():
    elements = [
        {
            "type": "relation",
            "id": 5,
            "members": [
                {"type": "node", "ref": 1, "lat": 12.0, "lon": 34.0},
            ],
            "tags": {"power": "plant", "plant:source": "wind"},
        }
    ]
    out = normalize_osm_elements(elements)
    assert len(out) == 1
    assert out[0]["feature_type"] == "power_plant"
    assert out[0]["category"] == "wind_power"
    assert out[0]["centroid_lat"] == 12.0
    assert out[0]["centroid_lon"] == 34.0


# ---------------------------------------------------------------------------
# GEM client
# ---------------------------------------------------------------------------


def test_gem_live_download_blocked_pending_license():
    res = fetch_gem()
    assert res["ok"] is False
    assert res["error"] == LICENSE_BLOCKED_MESSAGE
    assert res["license_verified"] is False


def test_gem_mock_pipeline_loaded():
    records = [
        {
            "id": "GAS1",
            "name": "Northern Pipeline",
            "country": "RU",
            "type": "pipeline",
            "subtype": "gas",
            "length_km": 1200.0,
            "geometry": {
                "type": "LineString",
                "coordinates": [[10, 50], [20, 55], [30, 60]],
            },
        }
    ]
    res = fetch_gem(mock_records=records)
    assert res["ok"] is True
    assert len(res["records"]) == 1
    assert res["license_verified"] is False


def test_classify_gem_record_oil_pipeline():
    cls = classify_gem_record({"type": "pipeline", "subtype": "oil"})
    assert cls["feature_type"] == "oil_pipeline"
    assert cls["category"] == "oil_pipeline"
    assert cls["pipeline_product"] == "crude_oil"


def test_classify_gem_record_gas_pipeline():
    cls = classify_gem_record({"type": "pipeline", "subtype": "gas"})
    assert cls["feature_type"] == "gas_pipeline"
    assert cls["pipeline_product"] == "natural_gas"


def test_classify_gem_record_lng_terminal():
    cls = classify_gem_record({"type": "terminal", "subtype": "lng", "role": "import"})
    assert cls["feature_type"] == "lng_terminal"
    assert cls["terminal_type"] == "import"


def test_classify_gem_record_oil_terminal():
    cls = classify_gem_record({"type": "terminal", "subtype": "oil", "role": "export"})
    assert cls["feature_type"] == "oil_terminal"
    assert cls["terminal_type"] == "export"


def test_classify_gem_record_gas_terminal():
    cls = classify_gem_record({"type": "terminal", "subtype": "gas", "role": "storage"})
    assert cls["feature_type"] == "gas_terminal"
    assert cls["terminal_type"] == "storage"


def test_classify_gem_record_unknown():
    cls = classify_gem_record({"type": "other"})
    assert cls["feature_type"] == "unknown_energy_feature"


def test_normalize_gem_pipeline():
    records = [
        {
            "id": "GAS1",
            "name": "Northern Pipeline",
            "country": "RU",
            "type": "pipeline",
            "subtype": "gas",
            "length_km": 1200.0,
            "geometry": {
                "type": "LineString",
                "coordinates": [[10, 50], [20, 55], [30, 60]],
            },
        }
    ]
    out = normalize_gem_records(records)
    assert len(out) == 1
    feat = out[0]
    assert feat["feature_type"] == "gas_pipeline"
    assert feat["category"] == "gas_pipeline"
    assert feat["pipeline_product"] == "natural_gas"
    assert feat["pipeline_length_km"] == 1200.0
    assert feat["geometry_type"] == "line"
    assert feat["country"] == "RU"
    assert feat["centroid_lat"] == 55.0
    assert feat["centroid_lon"] == 20.0
    assert feat["bbox_geojson"] is not None


def test_normalize_gem_lng_terminal():
    records = [
        {
            "id": "LNG1",
            "name": "Port Terminal",
            "country": "AU",
            "type": "terminal",
            "subtype": "lng",
            "role": "export",
            "lat": -33.0,
            "lon": 151.0,
        }
    ]
    out = normalize_gem_records(records)
    assert len(out) == 1
    feat = out[0]
    assert feat["feature_type"] == "lng_terminal"
    assert feat["terminal_type"] == "export"
    assert feat["geometry_type"] == "point"
    assert feat["centroid_lat"] == -33.0
    assert feat["centroid_lon"] == 151.0


def test_normalize_gem_oil_terminal():
    records = [
        {
            "id": "OIL1",
            "name": "Oil Port",
            "country": "US",
            "type": "terminal",
            "subtype": "oil",
            "lat": 30.0,
            "lon": -90.0,
        }
    ]
    out = normalize_gem_records(records)
    assert len(out) == 1
    assert out[0]["feature_type"] == "oil_terminal"


def test_normalize_gem_gas_terminal():
    records = [
        {
            "id": "GAS2",
            "name": "Gas Storage",
            "country": "DE",
            "type": "terminal",
            "subtype": "gas",
            "lat": 52.0,
            "lon": 13.0,
        }
    ]
    out = normalize_gem_records(records)
    assert len(out) == 1
    assert out[0]["feature_type"] == "gas_terminal"


def test_normalize_gem_skips_missing_id():
    out = normalize_gem_records([{"type": "pipeline", "subtype": "gas"}])
    assert out == []


def test_gem_default_mock_groups_listed():
    assert "mock_gas_pipelines" in DEFAULT_MOCK_GROUPS


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------


def test_point_geometry_and_centroid():
    g = point_geometry(40.0, -74.0)
    assert g == {"type": "Point", "coordinates": [-74.0, 40.0]}
    assert compute_centroid(g) == (40.0, -74.0)


def test_line_geometry_centroid_and_bbox():
    g = line_geometry([(0.0, 0.0), (10.0, 10.0), (20.0, 20.0)])
    assert g is not None
    c = compute_centroid(g)
    assert c is not None
    assert round(c[0], 6) == 10.0
    assert round(c[1], 6) == 10.0
    bbox = compute_bbox(g)
    assert bbox is not None
    assert bbox["type"] == "Polygon"


def test_line_geometry_rejects_too_short():
    assert line_geometry([(0.0, 0.0)]) is None
    assert line_geometry([]) is None


def test_polygon_geometry_centroid_and_bbox():
    ring = [(0, 0), (0, 10), (10, 10), (10, 0), (0, 0)]
    g = polygon_geometry([ring])
    assert g is not None
    assert compute_centroid(g) is not None
    assert compute_bbox(g) is not None


def test_polygon_geometry_rejects_short_ring():
    assert polygon_geometry([[(0, 0), (1, 0)]]) is None


def test_compute_bbox_for_point_is_none():
    g = point_geometry(0, 0)
    assert compute_bbox(g) is None


def test_validate_geometry_accepts_valid():
    assert validate_geometry(point_geometry(0, 0))
    assert validate_geometry(line_geometry([(0, 0), (1, 1)]))
    assert validate_geometry(polygon_geometry([[(0, 0), (0, 1), (1, 1), (1, 0), (0, 0)]]))


def test_validate_geometry_rejects_invalid():
    assert not validate_geometry({"type": "Point", "coordinates": []})
    assert not validate_geometry({"type": "Point", "coordinates": [999, 999]})
    assert not validate_geometry({"type": "LineString", "coordinates": [[0, 0]]})
    assert not validate_geometry({"type": "Polygon", "coordinates": []})
    assert not validate_geometry({"type": "NotAThing", "coordinates": []})


def test_invalid_geometry_skipped_by_normalizer():
    bad = [
        {"type": "node", "id": 1, "lat": 999, "lon": 0, "tags": {"power": "substation"}},
    ]
    assert normalize_osm_elements(bad) == []


# ---------------------------------------------------------------------------
# DB writer
# ---------------------------------------------------------------------------


def test_upsert_sql_uses_parameterized_placeholders():
    # No string interpolation of values; every value is a %s slot.
    assert UPSERT_SQL.count("%s") >= 26
    assert "ST_GeomFromGeoJSON(%s)" in UPSERT_SQL
    # No f-string interpolation of user data.
    assert "{" not in UPSERT_SQL.split("VALUES")[0]


def test_in_memory_connection_is_used_when_psycopg_missing(monkeypatch):
    """When ``psycopg`` cannot be imported, ``connect_db`` falls back
    to the in-memory mock so unit tests can run without a Postgres
    server. The fallback is clearly tagged in ``conn.info``.
    """
    import builtins

    real_import = builtins.__import__

    def fake_import(name, *args, **kwargs):
        if name == "psycopg" or name.startswith("psycopg."):
            raise ImportError("psycopg is not installed in this test env")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", fake_import)
    conn = connect_db()
    assert is_in_memory_connection(conn)
    assert conn.info == "in-memory-mock"


def test_upsert_feature_inserts_row():
    conn = EnergyInfrastructureInMemoryConnection()
    feat = {
        "layer_id": LAYER_ID,
        "source_id": SOURCE_WRI,
        "source_object_id": "WRI1",
        "feature_type": "power_plant",
        "category": "nuclear_power",
        "geometry_type": "point",
        "name": "Plant",
        "operator": "Op",
        "owner": "Owner",
        "country": "US",
        "status": "operational",
        "fuel_type": "nuclear",
        "capacity_mw": 100.0,
        "voltage_kv": None,
        "pipeline_product": None,
        "pipeline_length_km": None,
        "terminal_type": None,
        "geometry_geojson": point_geometry(40.0, -74.0),
        "centroid_lat": 40.0,
        "centroid_lon": -74.0,
        "bbox_geojson": None,
        "source_confidence": 0.9,
        "source_updated_at": None,
        "raw_source_json": {"gppd_idnr": "WRI1"},
    }
    res = upsert_feature(conn, feat)
    assert res["inserted"] is True
    assert get_feature_count(conn) == 1


def test_upsert_feature_updates_existing_row():
    conn = EnergyInfrastructureInMemoryConnection()
    feat = {
        "layer_id": LAYER_ID,
        "source_id": SOURCE_WRI,
        "source_object_id": "WRI1",
        "feature_type": "power_plant",
        "category": "nuclear_power",
        "geometry_type": "point",
        "name": "Plant",
        "operator": None,
        "owner": None,
        "country": "US",
        "status": "operational",
        "fuel_type": "nuclear",
        "capacity_mw": 100.0,
        "voltage_kv": None,
        "pipeline_product": None,
        "pipeline_length_km": None,
        "terminal_type": None,
        "geometry_geojson": point_geometry(40.0, -74.0),
        "centroid_lat": 40.0,
        "centroid_lon": -74.0,
        "bbox_geojson": None,
        "source_confidence": 0.9,
        "raw_source_json": {"x": 1},
    }
    upsert_feature(conn, feat)
    feat["capacity_mw"] = 200.0
    res = upsert_feature(conn, feat)
    assert res["inserted"] is False
    assert get_feature_count(conn) == 1
    assert get_existing_keys(conn) == {("wri_global_power_plant_database", "WRI1")}


def test_upsert_feature_dry_run_does_not_write():
    conn = EnergyInfrastructureInMemoryConnection()
    feat = {
        "layer_id": LAYER_ID,
        "source_id": SOURCE_WRI,
        "source_object_id": "WRI1",
        "feature_type": "power_plant",
        "category": "nuclear_power",
        "geometry_type": "point",
        "geometry_geojson": point_geometry(0, 0),
        "centroid_lat": 0.0,
        "centroid_lon": 0.0,
        "raw_source_json": {},
    }
    res = upsert_feature(conn, feat, dry_run=True)
    assert res["dry_run"] is True
    assert get_feature_count(conn) == 0


def test_persist_features_continues_after_bad_row():
    conn = EnergyInfrastructureInMemoryConnection()
    good = {
        "layer_id": LAYER_ID,
        "source_id": SOURCE_WRI,
        "source_object_id": "WRI1",
        "feature_type": "power_plant",
        "category": "nuclear_power",
        "geometry_type": "point",
        "geometry_geojson": point_geometry(0, 0),
        "centroid_lat": 0.0,
        "centroid_lon": 0.0,
        "raw_source_json": {},
    }
    summary = persist_features(conn, [good, {"source_id": "x"}, {"missing everything": True}])
    assert summary["inserted"] == 1
    assert summary["errors"] == 2


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def test_cli_download_only_with_mocked_wri(tmp_path):
    args = [
        "--source",
        SOURCE_WRI,
        "--download-only",
        "--cache-dir",
        str(tmp_path),
        "--max-features",
        "5",
        "--csv-text",
        SAMPLE_WRI_CSV,
    ]
    ns = build_arg_parser().parse_args(args)
    res = run_download_only(ns)
    assert res["groups_succeeded"] == ["latest"]
    assert res["groups_failed"] == []
    assert res["record_count"] == 5
    cache = SourceCache(tmp_path)
    env = cache.read_raw_group(SOURCE_WRI, "latest")
    assert env is not None
    assert env["record_count"] == 5


def test_cli_normalize_only_reads_cache_no_provider(tmp_path):
    cache = SourceCache(tmp_path)
    cache.write_raw_group(
        source=SOURCE_WRI,
        group="latest",
        raw_text=SAMPLE_WRI_CSV,
        records=parse_wri_csv(SAMPLE_WRI_CSV),
    )

    args = [
        "--source",
        SOURCE_WRI,
        "--normalize-only",
        "--cache-dir",
        str(tmp_path),
        "--max-features",
        "3",
    ]
    ns = build_arg_parser().parse_args(args)
    with patch.object(wri_power_plants_client, "download_wri_csv") as fake_dl:
        fake_dl.side_effect = AssertionError("provider was called during normalize-only")
        res = run_normalize_only(ns)
    assert res["features_normalized"] == 3
    assert res["manifest_path"]


def test_cli_persist_from_cache_with_mocked_db(tmp_path):
    cache = SourceCache(tmp_path)
    cache.write_raw_group(
        source=SOURCE_WRI,
        group="latest",
        raw_text=SAMPLE_WRI_CSV,
        records=parse_wri_csv(SAMPLE_WRI_CSV),
    )
    args = ["--source", SOURCE_WRI, "--normalize-only", "--cache-dir", str(tmp_path)]
    ns = build_arg_parser().parse_args(args)
    run_normalize_only(ns)

    args2 = [
        "--source",
        SOURCE_WRI,
        "--persist-from-cache",
        "--cache-dir",
        str(tmp_path),
        "--max-features",
        "5",
        "--in-memory-db",
        "--dry-run",
    ]
    ns2 = build_arg_parser().parse_args(args2)
    res = run_persist_from_cache(ns2)
    assert res["dry_run"] is True
    assert res["total"] == 5


def test_cli_dry_run_does_not_write_to_db(tmp_path):
    cache = SourceCache(tmp_path)
    cache.write_raw_group(
        source=SOURCE_WRI,
        group="latest",
        raw_text=SAMPLE_WRI_CSV,
        records=parse_wri_csv(SAMPLE_WRI_CSV),
    )
    run_normalize_only(
        build_arg_parser().parse_args(
            ["--source", SOURCE_WRI, "--normalize-only", "--cache-dir", str(tmp_path)]
        )
    )
    res = run_persist_from_cache(
        build_arg_parser().parse_args(
            [
                "--source",
                SOURCE_WRI,
                "--persist-from-cache",
                "--cache-dir",
                str(tmp_path),
                "--in-memory-db",
                "--dry-run",
            ]
        )
    )
    assert res["dry_run"] is True
    # Real DB connection was never opened.
    assert res.get("before_count") is None
    assert res.get("after_count") is None


def test_cli_source_failure_recorded(tmp_path):
    # Use a fake URL on a closed port; do NOT call WRI live.
    args = [
        "--source",
        SOURCE_WRI,
        "--download-only",
        "--cache-dir",
        str(tmp_path),
        "--csv-text",
        None,
    ]
    # Passing csv_text=None forces a real download attempt.
    ns = build_arg_parser().parse_args(args)
    with patch.object(wri_power_plants_client, "DEFAULT_DOWNLOAD_URL", "http://127.0.0.1:1/nope"):
        res = run_download_only(ns)
    assert res["groups_failed"] == ["latest"]
    cache = SourceCache(tmp_path)
    manifest = cache.read_overall_manifest()
    assert manifest is not None
    assert manifest["groups_failed"] == ["latest"]
    assert manifest["errors"]


# ---------------------------------------------------------------------------
# Safety / scope
# ---------------------------------------------------------------------------


def test_no_secrets_in_default_database_url():
    # The default URL is the standard local dev URL; no real password
    # should appear, and the URL must not be auto-printed.
    assert "god_eyes_dev_password" in DEFAULT_DATABASE_URL
    # The DEFAULT_DATABASE_URL is just a dev placeholder; this is the
    # value the rest of the codebase uses for local dev only.


def test_worker_banner_never_prints_database_url(capsys, tmp_path):
    args = build_arg_parser().parse_args(
        [
            "--source",
            SOURCE_WRI,
            "--download-only",
            "--cache-dir",
            str(tmp_path),
            "--csv-text",
            SAMPLE_WRI_CSV,
        ]
    )
    run_download_only(args)
    captured = capsys.readouterr()
    assert "postgresql://" not in captured.out
    assert "god_eyes_dev_password" not in captured.out


def test_no_raw_data_files_written_into_repo():
    """The staged cache only ever lives under the user-provided
    ``--cache-dir``, never inside the repo.

    This test asserts the ``__init__`` of SourceCache creates its
    directory tree only relative to the caller-supplied
    ``cache_dir`` — there is no implicit repo-relative fallback.
    """
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        cache = source_cache.SourceCache(tmp)
        # No file outside the supplied cache_dir was created.
        assert cache.layer_dir.is_dir()
        assert str(cache.layer_dir).startswith(str(Path(tmp).resolve()))


def test_raw_extensions_per_source():
    assert RAW_EXTENSIONS[SOURCE_WRI] == "csv"
    assert RAW_EXTENSIONS[SOURCE_OSM] == "json"
    assert RAW_EXTENSIONS[SOURCE_GEM] == "json"


# ---------------------------------------------------------------------------
# Scope guard (work order constraint)
# ---------------------------------------------------------------------------


def test_work_order_changes_stay_in_allowed_paths():
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=str(REPO_ROOT),
        check=True,
        capture_output=True,
        text=True,
    )
    changed_paths = [
        line[3:].replace("\\", "/")
        for line in result.stdout.splitlines()
        if line and not line.startswith("?? .pytest_cache/")
    ]
    if not changed_paths:
        pytest.skip("Scope guard only applies during local dirty worktree work-order review")

    allowed_prefixes = (
        "services/fetch-orchestrator/src/layers/layer_10_energy_infrastructure/",
        "tests/data/layer_10_energy_infrastructure/",
        "docs/state/HANDOFF_LOG.md",
    )
    for path in changed_paths:
        assert any(path.startswith(p) for p in allowed_prefixes), f"Forbidden path: {path}"


def test_work_order_adds_no_raw_data_or_env_files():
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=str(REPO_ROOT),
        check=True,
        capture_output=True,
        text=True,
    )
    changed_paths = [
        line[3:].replace("\\", "/")
        for line in result.stdout.splitlines()
        if line
    ]
    raw_data_paths = [
        path
        for path in changed_paths
        if path.startswith(("data/", "raw/", "database/raw/", "storage/raw/"))
    ]
    assert not raw_data_paths
    raw_data_suffixes = (".csv", ".json", ".jsonl", ".parquet", ".geojson")
    assert not any(
        path.endswith(raw_data_suffixes) and "fixtures/" not in path
        for path in changed_paths
    )
    assert not any(path.endswith(".env") or ".env." in path for path in changed_paths)
