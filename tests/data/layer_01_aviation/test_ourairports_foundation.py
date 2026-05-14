import importlib.util
import json
from pathlib import Path

import pytest

from packages.schemas.layers.layer_01_aviation.ourairports import (
    EXPECTED_FILES,
    SOURCE_ID,
    LAYER_ID,
    RawObjectMetadata,
    OurAirportsAirportRawRow,
    build_idempotency_key,
    build_point_wkt,
    build_raw_storage_key,
    normalize_airport_category,
    normalize_airport_record,
    parse_csv_rows,
    validate_raw_object_metadata,
)


REPO_ROOT = Path(__file__).resolve().parents[3]
CATALOG_PATH = (
    REPO_ROOT
    / "packages"
    / "source-catalog"
    / "layers"
    / "layer_01_aviation"
    / "ourairports.json"
)


def test_raw_storage_path_builder_includes_layer_source_date_run_and_filename():
    key = build_raw_storage_key("2026-05-14", "fetch_run_abc", "airports.csv")

    assert (
        key
        == "raw/layer_01_aviation/ourairports/2026/05/14/fetch_run_abc/airports.csv"
    )


@pytest.mark.parametrize(
    ("source_type", "expected"),
    [
        ("large_airport", "international_or_major_airport"),
        ("medium_airport", "regional_or_domestic_airport"),
        ("small_airport", "small_airfield"),
        ("heliport", "heliport"),
        ("seaplane_base", "water_landing_site"),
        ("balloonport", "balloonport"),
        ("closed", "closed_or_abandoned"),
        ("closed_airport", "closed_or_abandoned"),
        ("mystery_airstrip", "unknown"),
        ("", "unknown"),
    ],
)
def test_airport_category_normalization(source_type, expected):
    assert normalize_airport_category(source_type) == expected


def test_source_catalog_declares_ourairports_foundation():
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))

    assert catalog["layer_id"] == LAYER_ID
    assert catalog["source_id"] == SOURCE_ID
    assert catalog["source_type"] == "aviation_reference"
    assert catalog["refresh_policy"]["cadence"] == "monthly"
    assert catalog["refresh_policy"]["manual_refresh_allowed"] is True
    assert catalog["raw_storage"]["bucket"] == "god-eyes-raw"
    assert (
        catalog["raw_storage"]["path_pattern"]
        == "raw/layer_01_aviation/ourairports/{yyyy}/{mm}/{dd}/{fetch_run_id}/{filename}"
    )
    assert sorted(item["filename"] for item in catalog["expected_files"]) == sorted(
        EXPECTED_FILES
    )


def test_required_ourairports_file_list_is_complete():
    assert EXPECTED_FILES == (
        "airports.csv",
        "runways.csv",
        "navaids.csv",
        "airport-frequencies.csv",
        "countries.csv",
        "regions.csv",
    )


def test_csv_parser_handles_representative_airport_row():
    raw_csv = (
        "id,ident,type,name,latitude_deg,longitude_deg,elevation_ft,continent,"
        "iso_country,iso_region,municipality,scheduled_service,gps_code,iata_code,"
        "local_code,home_link,wikipedia_link,keywords\n"
        "2434,EGLL,large_airport,London Heathrow Airport,51.470600,-0.461941,"
        "83,EU,GB,GB-ENG,London,yes,EGLL,LHR,,http://example.com,"
        "https://en.wikipedia.org/wiki/Heathrow_Airport,\"LON, Londres\"\n"
    ).encode("utf-8")

    rows = parse_csv_rows(raw_csv)
    parsed = OurAirportsAirportRawRow.from_dict(rows[0])

    assert parsed.source_airport_id == "2434"
    assert parsed.ident == "EGLL"
    assert parsed.type_source == "large_airport"
    assert parsed.latitude_deg == pytest.approx(51.4706)
    assert parsed.longitude_deg == pytest.approx(-0.461941)


def test_normalizer_preserves_original_source_type():
    row = OurAirportsAirportRawRow.from_dict(
        {
            "id": "1",
            "ident": "KJFK",
            "type": "large_airport",
            "name": "John F Kennedy International Airport",
            "latitude_deg": "40.639801",
            "longitude_deg": "-73.7789",
            "elevation_ft": "13",
            "continent": "NA",
            "iso_country": "US",
            "iso_region": "US-NY",
            "municipality": "New York",
            "scheduled_service": "yes",
            "gps_code": "KJFK",
            "iata_code": "JFK",
            "local_code": "",
            "home_link": "",
            "wikipedia_link": "",
            "keywords": "",
        }
    )

    normalized = normalize_airport_record(row, raw_object_id="raw-airports")

    assert normalized["type_source"] == "large_airport"
    assert normalized["category_normalized"] == "international_or_major_airport"


def test_generated_geometry_uses_lon_lat_order():
    assert build_point_wkt(latitude_deg=51.4706, longitude_deg=-0.461941) == (
        "SRID=4326;POINT(-0.461941 51.4706)"
    )


def test_idempotency_key_logic_uses_source_and_source_id():
    assert build_idempotency_key("aviation_airports", "ourairports", "2434") == (
        "aviation_airports",
        "ourairports",
        "2434",
    )


def test_raw_object_metadata_contract_requires_traceability_fields():
    metadata = RawObjectMetadata(
        id="raw-1",
        fetch_run_id="fetch_run_abc",
        layer_id=LAYER_ID,
        source_id=SOURCE_ID,
        object_type="ourairports_csv",
        filename="airports.csv",
        storage_bucket="god-eyes-raw",
        storage_key="raw/layer_01_aviation/ourairports/2026/05/14/fetch_run_abc/airports.csv",
        storage_uri="s3://god-eyes-raw/raw/layer_01_aviation/ourairports/2026/05/14/fetch_run_abc/airports.csv",
        content_type="text/csv",
        byte_size=123,
        checksum_sha256="a" * 64,
        validation_status="valid",
    )

    assert validate_raw_object_metadata(metadata) is True


def test_normalizer_reads_raw_objects_metadata_not_random_paths():
    module_path = (
        REPO_ROOT
        / "services"
        / "normalizer"
        / "src"
        / "layers"
        / "layer_01_aviation"
        / "ourairports_normalizer.py"
    )
    spec = importlib.util.spec_from_file_location("ourairports_normalizer", module_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)

    class RecordingStorageClient:
        def __init__(self):
            self.requests = []

        def get_object_bytes(self, bucket, key):
            self.requests.append((bucket, key))
            return b"id,ident,type,name,latitude_deg,longitude_deg\n"

    storage = RecordingStorageClient()
    normalizer = module.OurAirportsNormalizer(storage_client=storage, db_connection=None)
    raw_objects = [
        RawObjectMetadata(
            id=f"raw-{index}",
            fetch_run_id="fetch_run_abc",
            layer_id=LAYER_ID,
            source_id=SOURCE_ID,
            object_type="ourairports_csv",
            filename=filename,
            storage_bucket="god-eyes-raw",
            storage_key=f"raw/layer_01_aviation/ourairports/2026/05/14/fetch_run_abc/{filename}",
            storage_uri=f"s3://god-eyes-raw/raw/layer_01_aviation/ourairports/2026/05/14/fetch_run_abc/{filename}",
            content_type="text/csv",
            byte_size=41,
            checksum_sha256="b" * 64,
            validation_status="valid",
        )
        for index, filename in enumerate(EXPECTED_FILES, start=1)
    ]

    loaded = normalizer.load_raw_csvs(raw_objects)

    assert sorted(loaded) == sorted(EXPECTED_FILES)
    assert storage.requests == [
        ("god-eyes-raw", raw_object.storage_key) for raw_object in raw_objects
    ]


def test_normalizer_casts_postgis_ewkt_parameters_for_psycopg():
    module_path = (
        REPO_ROOT
        / "services"
        / "normalizer"
        / "src"
        / "layers"
        / "layer_01_aviation"
        / "ourairports_normalizer.py"
    )
    spec = importlib.util.spec_from_file_location("ourairports_normalizer", module_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)

    assert "ST_GeomFromEWKT(%(geom)s::text)" in module.AIRPORT_UPSERT_SQL
    assert "ST_GeomFromEWKT(%(geom)s::text)" in module.NAVAID_UPSERT_SQL
