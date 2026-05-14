"""Schemas and helpers for Layer 1 OurAirports reference data."""

from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import date, datetime
from io import StringIO
from typing import Any, Iterable


LAYER_ID = "layer_01_aviation"
SOURCE_ID = "ourairports"
SOURCE_TYPE = "aviation_reference"
RAW_OBJECT_TYPE = "ourairports_csv"
RAW_BUCKET = "god-eyes-raw"

EXPECTED_FILES = (
    "airports.csv",
    "runways.csv",
    "navaids.csv",
    "airport-frequencies.csv",
    "countries.csv",
    "regions.csv",
)

SOURCE_URLS = {
    "airports.csv": "https://davidmegginson.github.io/ourairports-data/airports.csv",
    "runways.csv": "https://davidmegginson.github.io/ourairports-data/runways.csv",
    "navaids.csv": "https://davidmegginson.github.io/ourairports-data/navaids.csv",
    "airport-frequencies.csv": "https://davidmegginson.github.io/ourairports-data/airport-frequencies.csv",
    "countries.csv": "https://davidmegginson.github.io/ourairports-data/countries.csv",
    "regions.csv": "https://davidmegginson.github.io/ourairports-data/regions.csv",
}

REQUIRED_COLUMNS = {
    "airports.csv": {
        "id",
        "ident",
        "type",
        "name",
        "latitude_deg",
        "longitude_deg",
        "iso_country",
        "iso_region",
    },
    "runways.csv": {"id", "airport_ref", "airport_ident"},
    "navaids.csv": {"id", "filename", "ident", "name", "type"},
    "airport-frequencies.csv": {"id", "airport_ref", "airport_ident", "type"},
    "countries.csv": {"id", "code", "name", "continent"},
    "regions.csv": {"id", "code", "local_code", "name", "iso_country"},
}

AIRPORT_CATEGORY_MAP = {
    "large_airport": "international_or_major_airport",
    "medium_airport": "regional_or_domestic_airport",
    "small_airport": "small_airfield",
    "heliport": "heliport",
    "seaplane_base": "water_landing_site",
    "balloonport": "balloonport",
    "closed": "closed_or_abandoned",
    "closed_airport": "closed_or_abandoned",
}


def _none_if_blank(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _float_or_none(value: Any) -> float | None:
    text = _none_if_blank(value)
    return None if text is None else float(text)


def _int_or_none(value: Any) -> int | None:
    text = _none_if_blank(value)
    return None if text is None else int(float(text))


def _bool_from_int(value: Any) -> bool | None:
    text = _none_if_blank(value)
    if text is None:
        return None
    return text == "1"


def parse_csv_rows(content: bytes) -> list[dict[str, str]]:
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(StringIO(text))
    return [dict(row) for row in reader]


def build_raw_storage_key(
    fetch_date: date | datetime | str,
    fetch_run_id: str,
    filename: str,
    layer_id: str = LAYER_ID,
    source_id: str = SOURCE_ID,
) -> str:
    if isinstance(fetch_date, datetime):
        normalized_date = fetch_date.date()
    elif isinstance(fetch_date, date):
        normalized_date = fetch_date
    else:
        normalized_date = date.fromisoformat(fetch_date)
    return (
        f"raw/{layer_id}/{source_id}/"
        f"{normalized_date:%Y}/{normalized_date:%m}/{normalized_date:%d}/"
        f"{fetch_run_id}/{filename}"
    )


def build_storage_uri(bucket: str, key: str) -> str:
    return f"s3://{bucket}/{key}"


def normalize_airport_category(source_type: str | None) -> str:
    return AIRPORT_CATEGORY_MAP.get((source_type or "").strip(), "unknown")


def build_point_wkt(latitude_deg: float | None, longitude_deg: float | None) -> str | None:
    if latitude_deg is None or longitude_deg is None:
        return None
    return f"SRID=4326;POINT({longitude_deg} {latitude_deg})"


def build_idempotency_key(
    table_name: str, source_id: str, source_object_id: str
) -> tuple[str, str, str]:
    return (table_name, source_id, source_object_id)


@dataclass(frozen=True)
class FetchRunMetadata:
    id: str
    layer_id: str
    source_id: str
    status: str
    started_at: str | None = None
    completed_at: str | None = None
    record_count: int | None = None
    file_count: int | None = None
    error_message: str | None = None
    metadata: dict[str, Any] | None = None


@dataclass(frozen=True)
class RawObjectMetadata:
    id: str
    fetch_run_id: str
    layer_id: str
    source_id: str
    object_type: str
    filename: str
    storage_bucket: str
    storage_key: str
    storage_uri: str
    content_type: str
    byte_size: int
    checksum_sha256: str
    validation_status: str
    fetched_at: str | None = None
    metadata: dict[str, Any] | None = None

    @classmethod
    def from_db_row(cls, row: dict[str, Any]) -> "RawObjectMetadata":
        return cls(
            id=str(row["id"]),
            fetch_run_id=str(row["fetch_run_id"]),
            layer_id=row["layer_id"],
            source_id=row["source_id"],
            object_type=row["object_type"],
            filename=row["filename"],
            storage_bucket=row["storage_bucket"],
            storage_key=row["storage_key"],
            storage_uri=row["storage_uri"],
            content_type=row["content_type"],
            byte_size=int(row["byte_size"]),
            checksum_sha256=row["checksum_sha256"],
            validation_status=row["validation_status"],
            fetched_at=str(row["fetched_at"]) if row.get("fetched_at") else None,
            metadata=row.get("metadata"),
        )


def validate_raw_object_metadata(raw_object: RawObjectMetadata) -> bool:
    return all(
        [
            raw_object.id,
            raw_object.fetch_run_id,
            raw_object.layer_id == LAYER_ID,
            raw_object.source_id == SOURCE_ID,
            raw_object.filename in EXPECTED_FILES,
            raw_object.storage_bucket,
            raw_object.storage_key.startswith(f"raw/{LAYER_ID}/{SOURCE_ID}/"),
            raw_object.storage_uri == build_storage_uri(
                raw_object.storage_bucket, raw_object.storage_key
            ),
            raw_object.byte_size > 0,
            len(raw_object.checksum_sha256) == 64,
            raw_object.validation_status in {"valid", "invalid", "pending"},
        ]
    )


def validate_required_files(filenames: Iterable[str]) -> set[str]:
    return set(EXPECTED_FILES).difference(filenames)


def validate_csv_columns(filename: str, rows: list[dict[str, str]]) -> set[str]:
    if not rows:
        return set(REQUIRED_COLUMNS[filename])
    return REQUIRED_COLUMNS[filename].difference(rows[0].keys())


def validate_airport_coordinates(rows: list[dict[str, str]]) -> list[str]:
    invalid: list[str] = []
    for row in rows:
        airport_type = row.get("type")
        if airport_type in {"closed", "closed_airport"}:
            continue
        lat = _none_if_blank(row.get("latitude_deg"))
        lon = _none_if_blank(row.get("longitude_deg"))
        if lat is None or lon is None:
            invalid.append(row.get("ident") or row.get("id") or "<unknown>")
    return invalid


@dataclass(frozen=True)
class OurAirportsAirportRawRow:
    source_airport_id: str
    ident: str
    type_source: str
    name: str
    latitude_deg: float | None
    longitude_deg: float | None
    elevation_ft: int | None
    continent: str | None
    iso_country: str | None
    iso_region: str | None
    municipality: str | None
    scheduled_service: str | None
    gps_code: str | None
    iata_code: str | None
    local_code: str | None
    home_link: str | None
    wikipedia_link: str | None
    keywords: str | None

    @classmethod
    def from_dict(cls, row: dict[str, Any]) -> "OurAirportsAirportRawRow":
        return cls(
            source_airport_id=str(row["id"]),
            ident=row["ident"],
            type_source=row.get("type", ""),
            name=row.get("name", ""),
            latitude_deg=_float_or_none(row.get("latitude_deg")),
            longitude_deg=_float_or_none(row.get("longitude_deg")),
            elevation_ft=_int_or_none(row.get("elevation_ft")),
            continent=_none_if_blank(row.get("continent")),
            iso_country=_none_if_blank(row.get("iso_country")),
            iso_region=_none_if_blank(row.get("iso_region")),
            municipality=_none_if_blank(row.get("municipality")),
            scheduled_service=_none_if_blank(row.get("scheduled_service")),
            gps_code=_none_if_blank(row.get("gps_code")),
            iata_code=_none_if_blank(row.get("iata_code")),
            local_code=_none_if_blank(row.get("local_code")),
            home_link=_none_if_blank(row.get("home_link")),
            wikipedia_link=_none_if_blank(row.get("wikipedia_link")),
            keywords=_none_if_blank(row.get("keywords")),
        )


@dataclass(frozen=True)
class OurAirportsRunwayRawRow:
    source_runway_id: str
    airport_ref: int | None
    airport_ident: str | None
    length_ft: int | None
    width_ft: int | None
    surface: str | None
    lighted: bool | None
    closed: bool | None
    le_ident: str | None
    le_latitude_deg: float | None
    le_longitude_deg: float | None
    le_elevation_ft: int | None
    le_heading_degT: float | None
    le_displaced_threshold_ft: int | None
    he_ident: str | None
    he_latitude_deg: float | None
    he_longitude_deg: float | None
    he_elevation_ft: int | None
    he_heading_degT: float | None
    he_displaced_threshold_ft: int | None

    @classmethod
    def from_dict(cls, row: dict[str, Any]) -> "OurAirportsRunwayRawRow":
        return cls(
            source_runway_id=str(row["id"]),
            airport_ref=_int_or_none(row.get("airport_ref")),
            airport_ident=_none_if_blank(row.get("airport_ident")),
            length_ft=_int_or_none(row.get("length_ft")),
            width_ft=_int_or_none(row.get("width_ft")),
            surface=_none_if_blank(row.get("surface")),
            lighted=_bool_from_int(row.get("lighted")),
            closed=_bool_from_int(row.get("closed")),
            le_ident=_none_if_blank(row.get("le_ident")),
            le_latitude_deg=_float_or_none(row.get("le_latitude_deg")),
            le_longitude_deg=_float_or_none(row.get("le_longitude_deg")),
            le_elevation_ft=_int_or_none(row.get("le_elevation_ft")),
            le_heading_degT=_float_or_none(row.get("le_heading_degT")),
            le_displaced_threshold_ft=_int_or_none(
                row.get("le_displaced_threshold_ft")
            ),
            he_ident=_none_if_blank(row.get("he_ident")),
            he_latitude_deg=_float_or_none(row.get("he_latitude_deg")),
            he_longitude_deg=_float_or_none(row.get("he_longitude_deg")),
            he_elevation_ft=_int_or_none(row.get("he_elevation_ft")),
            he_heading_degT=_float_or_none(row.get("he_heading_degT")),
            he_displaced_threshold_ft=_int_or_none(
                row.get("he_displaced_threshold_ft")
            ),
        )


@dataclass(frozen=True)
class OurAirportsNavaidRawRow:
    source_navaid_id: str
    filename: str | None
    ident: str | None
    name: str | None
    type: str | None
    frequency_khz: int | None
    latitude_deg: float | None
    longitude_deg: float | None
    elevation_ft: int | None
    iso_country: str | None
    dme_frequency_khz: int | None
    dme_channel: str | None
    dme_latitude_deg: float | None
    dme_longitude_deg: float | None
    dme_elevation_ft: int | None
    slaved_variation_deg: float | None
    magnetic_variation_deg: float | None
    usageType: str | None
    power: str | None
    associated_airport: str | None

    @classmethod
    def from_dict(cls, row: dict[str, Any]) -> "OurAirportsNavaidRawRow":
        return cls(
            source_navaid_id=str(row["id"]),
            filename=_none_if_blank(row.get("filename")),
            ident=_none_if_blank(row.get("ident")),
            name=_none_if_blank(row.get("name")),
            type=_none_if_blank(row.get("type")),
            frequency_khz=_int_or_none(row.get("frequency_khz")),
            latitude_deg=_float_or_none(row.get("latitude_deg")),
            longitude_deg=_float_or_none(row.get("longitude_deg")),
            elevation_ft=_int_or_none(row.get("elevation_ft")),
            iso_country=_none_if_blank(row.get("iso_country")),
            dme_frequency_khz=_int_or_none(row.get("dme_frequency_khz")),
            dme_channel=_none_if_blank(row.get("dme_channel")),
            dme_latitude_deg=_float_or_none(row.get("dme_latitude_deg")),
            dme_longitude_deg=_float_or_none(row.get("dme_longitude_deg")),
            dme_elevation_ft=_int_or_none(row.get("dme_elevation_ft")),
            slaved_variation_deg=_float_or_none(row.get("slaved_variation_deg")),
            magnetic_variation_deg=_float_or_none(row.get("magnetic_variation_deg")),
            usageType=_none_if_blank(row.get("usageType")),
            power=_none_if_blank(row.get("power")),
            associated_airport=_none_if_blank(row.get("associated_airport")),
        )


@dataclass(frozen=True)
class OurAirportsAirportFrequencyRawRow:
    source_frequency_id: str
    airport_ref: int | None
    airport_ident: str | None
    type: str | None
    description: str | None
    frequency_mhz: float | None

    @classmethod
    def from_dict(cls, row: dict[str, Any]) -> "OurAirportsAirportFrequencyRawRow":
        return cls(
            source_frequency_id=str(row["id"]),
            airport_ref=_int_or_none(row.get("airport_ref")),
            airport_ident=_none_if_blank(row.get("airport_ident")),
            type=_none_if_blank(row.get("type")),
            description=_none_if_blank(row.get("description")),
            frequency_mhz=_float_or_none(row.get("frequency_mhz")),
        )


@dataclass(frozen=True)
class OurAirportsCountryRawRow:
    source_country_id: str
    code: str
    name: str
    continent: str | None
    wikipedia_link: str | None
    keywords: str | None

    @classmethod
    def from_dict(cls, row: dict[str, Any]) -> "OurAirportsCountryRawRow":
        return cls(
            source_country_id=str(row["id"]),
            code=row["code"],
            name=row["name"],
            continent=_none_if_blank(row.get("continent")),
            wikipedia_link=_none_if_blank(row.get("wikipedia_link")),
            keywords=_none_if_blank(row.get("keywords")),
        )


@dataclass(frozen=True)
class OurAirportsRegionRawRow:
    source_region_id: str
    code: str
    local_code: str | None
    name: str
    continent: str | None
    iso_country: str | None
    wikipedia_link: str | None
    keywords: str | None

    @classmethod
    def from_dict(cls, row: dict[str, Any]) -> "OurAirportsRegionRawRow":
        return cls(
            source_region_id=str(row["id"]),
            code=row["code"],
            local_code=_none_if_blank(row.get("local_code")),
            name=row["name"],
            continent=_none_if_blank(row.get("continent")),
            iso_country=_none_if_blank(row.get("iso_country")),
            wikipedia_link=_none_if_blank(row.get("wikipedia_link")),
            keywords=_none_if_blank(row.get("keywords")),
        )


def normalize_airport_record(
    row: OurAirportsAirportRawRow, raw_object_id: str
) -> dict[str, Any]:
    return {
        "layer_id": LAYER_ID,
        "source_id": SOURCE_ID,
        "source_airport_id": row.source_airport_id,
        "ident": row.ident,
        "type_source": row.type_source,
        "category_normalized": normalize_airport_category(row.type_source),
        "name": row.name,
        "latitude_deg": row.latitude_deg,
        "longitude_deg": row.longitude_deg,
        "elevation_ft": row.elevation_ft,
        "continent": row.continent,
        "iso_country": row.iso_country,
        "iso_region": row.iso_region,
        "municipality": row.municipality,
        "scheduled_service": row.scheduled_service,
        "gps_code": row.gps_code,
        "iata_code": row.iata_code,
        "local_code": row.local_code,
        "home_link": row.home_link,
        "wikipedia_link": row.wikipedia_link,
        "keywords": row.keywords,
        "geom": build_point_wkt(row.latitude_deg, row.longitude_deg),
        "raw_object_id": raw_object_id,
    }
