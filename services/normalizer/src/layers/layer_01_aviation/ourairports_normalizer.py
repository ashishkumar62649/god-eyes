"""OurAirports normalizer for Layer 1 aviation reference data.

The normalizer reads raw_objects metadata from Postgres, loads the matching
objects from MinIO, then upserts normalized aviation reference tables.
"""

from __future__ import annotations

import argparse
import os
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[5]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from packages.schemas.layers.layer_01_aviation.ourairports import (
    EXPECTED_FILES,
    LAYER_ID,
    RAW_BUCKET,
    SOURCE_ID,
    OurAirportsAirportFrequencyRawRow,
    OurAirportsAirportRawRow,
    OurAirportsCountryRawRow,
    OurAirportsNavaidRawRow,
    OurAirportsRegionRawRow,
    OurAirportsRunwayRawRow,
    RawObjectMetadata,
    build_point_wkt,
    normalize_airport_record,
    parse_csv_rows,
    validate_raw_object_metadata,
    validate_required_files,
)


DEFAULT_DATABASE_URL = (
    "postgresql://god_eyes:god_eyes_dev_password@localhost:5432/god_eyes_dev"
)
DEFAULT_MINIO_ENDPOINT = "http://localhost:9000"
DEFAULT_MINIO_ACCESS_KEY = "god_eyes_minio_dev"
DEFAULT_MINIO_SECRET_KEY = "replace_with_dev_secret"


class MinioReadClient:
    def __init__(
        self,
        endpoint_url: str,
        access_key: str,
        secret_key: str,
        bucket: str,
    ) -> None:
        import boto3

        self.bucket = bucket
        self._client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
        )

    def get_object_bytes(self, bucket: str, key: str) -> bytes:
        response = self._client.get_object(Bucket=bucket, Key=key)
        return response["Body"].read()


class OurAirportsNormalizer:
    def __init__(self, storage_client: Any, db_connection: Any) -> None:
        self.storage_client = storage_client
        self.db_connection = db_connection

    def fetch_raw_objects(self, fetch_run_id: str) -> list[RawObjectMetadata]:
        if self.db_connection is None:
            raise ValueError("db_connection is required to query raw_objects")
        with self.db_connection.cursor() as cur:
            cur.execute(
                """
                SELECT id, fetch_run_id, layer_id, source_id, object_type, filename,
                       storage_bucket, storage_key, storage_uri, content_type,
                       byte_size, checksum_sha256, fetched_at, validation_status,
                       metadata
                FROM raw_objects
                WHERE fetch_run_id = %s
                  AND layer_id = %s
                  AND source_id = %s
                  AND validation_status = 'valid'
                ORDER BY filename
                """,
                (fetch_run_id, LAYER_ID, SOURCE_ID),
            )
            rows = cur.fetchall()
        return [RawObjectMetadata.from_db_row(dict(row)) for row in rows]

    def load_raw_csvs(
        self, raw_objects: list[RawObjectMetadata]
    ) -> dict[str, tuple[RawObjectMetadata, bytes]]:
        missing_files = validate_required_files(item.filename for item in raw_objects)
        if missing_files:
            raise ValueError(f"Missing required raw objects: {', '.join(sorted(missing_files))}")

        loaded: dict[str, tuple[RawObjectMetadata, bytes]] = {}
        for raw_object in raw_objects:
            if not validate_raw_object_metadata(raw_object):
                raise ValueError(f"Invalid raw object metadata for {raw_object.filename}")
            content = self.storage_client.get_object_bytes(
                raw_object.storage_bucket, raw_object.storage_key
            )
            loaded[raw_object.filename] = (raw_object, content)
        return loaded

    def normalize_loaded_csvs(
        self, loaded_csvs: dict[str, tuple[RawObjectMetadata, bytes]]
    ) -> dict[str, list[dict[str, Any]]]:
        airports_raw_object, airports_content = loaded_csvs["airports.csv"]
        runways_raw_object, runways_content = loaded_csvs["runways.csv"]
        navaids_raw_object, navaids_content = loaded_csvs["navaids.csv"]
        frequencies_raw_object, frequencies_content = loaded_csvs[
            "airport-frequencies.csv"
        ]
        countries_raw_object, countries_content = loaded_csvs["countries.csv"]
        regions_raw_object, regions_content = loaded_csvs["regions.csv"]

        airports = [
            normalize_airport_record(
                OurAirportsAirportRawRow.from_dict(row), airports_raw_object.id
            )
            for row in parse_csv_rows(airports_content)
        ]
        runways = [
            self._runway_record(OurAirportsRunwayRawRow.from_dict(row), runways_raw_object.id)
            for row in parse_csv_rows(runways_content)
        ]
        navaids = [
            self._navaid_record(OurAirportsNavaidRawRow.from_dict(row), navaids_raw_object.id)
            for row in parse_csv_rows(navaids_content)
        ]
        frequencies = [
            self._frequency_record(
                OurAirportsAirportFrequencyRawRow.from_dict(row), frequencies_raw_object.id
            )
            for row in parse_csv_rows(frequencies_content)
        ]
        countries = [
            self._country_record(OurAirportsCountryRawRow.from_dict(row), countries_raw_object.id)
            for row in parse_csv_rows(countries_content)
        ]
        regions = [
            self._region_record(OurAirportsRegionRawRow.from_dict(row), regions_raw_object.id)
            for row in parse_csv_rows(regions_content)
        ]

        return {
            "aviation_airports": airports,
            "aviation_runways": runways,
            "aviation_navaids": navaids,
            "aviation_airport_frequencies": frequencies,
            "aviation_countries": countries,
            "aviation_regions": regions,
        }

    def normalize_fetch_run(self, fetch_run_id: str) -> dict[str, int]:
        raw_objects = self.fetch_raw_objects(fetch_run_id)
        loaded_csvs = self.load_raw_csvs(raw_objects)
        normalized = self.normalize_loaded_csvs(loaded_csvs)
        self.upsert_normalized_records(normalized)
        return {table: len(records) for table, records in normalized.items()}

    def upsert_normalized_records(
        self, normalized: dict[str, list[dict[str, Any]]]
    ) -> None:
        if self.db_connection is None:
            raise ValueError("db_connection is required to upsert normalized records")
        with self.db_connection.cursor() as cur:
            for record in normalized["aviation_airports"]:
                cur.execute(AIRPORT_UPSERT_SQL, record)
            for record in normalized["aviation_runways"]:
                cur.execute(RUNWAY_UPSERT_SQL, record)
            for record in normalized["aviation_navaids"]:
                cur.execute(NAVAID_UPSERT_SQL, record)
            for record in normalized["aviation_airport_frequencies"]:
                cur.execute(FREQUENCY_UPSERT_SQL, record)
            for record in normalized["aviation_countries"]:
                cur.execute(COUNTRY_UPSERT_SQL, record)
            for record in normalized["aviation_regions"]:
                cur.execute(REGION_UPSERT_SQL, record)
        self.db_connection.commit()

    @staticmethod
    def _runway_record(row: OurAirportsRunwayRawRow, raw_object_id: str) -> dict[str, Any]:
        record = asdict(row)
        return {
            "layer_id": LAYER_ID,
            "source_id": SOURCE_ID,
            **record,
            "raw_object_id": raw_object_id,
        }

    @staticmethod
    def _navaid_record(row: OurAirportsNavaidRawRow, raw_object_id: str) -> dict[str, Any]:
        record = asdict(row)
        return {
            "layer_id": LAYER_ID,
            "source_id": SOURCE_ID,
            **record,
            "geom": build_point_wkt(row.latitude_deg, row.longitude_deg),
            "raw_object_id": raw_object_id,
        }

    @staticmethod
    def _frequency_record(
        row: OurAirportsAirportFrequencyRawRow, raw_object_id: str
    ) -> dict[str, Any]:
        return {
            "layer_id": LAYER_ID,
            "source_id": SOURCE_ID,
            **asdict(row),
            "raw_object_id": raw_object_id,
        }

    @staticmethod
    def _country_record(row: OurAirportsCountryRawRow, raw_object_id: str) -> dict[str, Any]:
        return {
            "layer_id": LAYER_ID,
            "source_id": SOURCE_ID,
            **asdict(row),
            "raw_object_id": raw_object_id,
        }

    @staticmethod
    def _region_record(row: OurAirportsRegionRawRow, raw_object_id: str) -> dict[str, Any]:
        return {
            "layer_id": LAYER_ID,
            "source_id": SOURCE_ID,
            **asdict(row),
            "raw_object_id": raw_object_id,
        }


AIRPORT_UPSERT_SQL = """
INSERT INTO aviation_airports (
  layer_id, source_id, source_airport_id, ident, type_source,
  category_normalized, name, latitude_deg, longitude_deg, elevation_ft,
  continent, iso_country, iso_region, municipality, scheduled_service,
  gps_code, iata_code, local_code, home_link, wikipedia_link, keywords,
  geom, raw_object_id
)
VALUES (
  %(layer_id)s, %(source_id)s, %(source_airport_id)s, %(ident)s, %(type_source)s,
  %(category_normalized)s, %(name)s, %(latitude_deg)s, %(longitude_deg)s,
  %(elevation_ft)s, %(continent)s, %(iso_country)s, %(iso_region)s,
  %(municipality)s, %(scheduled_service)s, %(gps_code)s, %(iata_code)s,
  %(local_code)s, %(home_link)s, %(wikipedia_link)s, %(keywords)s,
  CASE WHEN %(geom)s IS NULL THEN NULL ELSE ST_GeomFromEWKT(%(geom)s) END,
  %(raw_object_id)s
)
ON CONFLICT (source_id, source_airport_id) DO UPDATE SET
  ident = EXCLUDED.ident,
  type_source = EXCLUDED.type_source,
  category_normalized = EXCLUDED.category_normalized,
  name = EXCLUDED.name,
  latitude_deg = EXCLUDED.latitude_deg,
  longitude_deg = EXCLUDED.longitude_deg,
  elevation_ft = EXCLUDED.elevation_ft,
  continent = EXCLUDED.continent,
  iso_country = EXCLUDED.iso_country,
  iso_region = EXCLUDED.iso_region,
  municipality = EXCLUDED.municipality,
  scheduled_service = EXCLUDED.scheduled_service,
  gps_code = EXCLUDED.gps_code,
  iata_code = EXCLUDED.iata_code,
  local_code = EXCLUDED.local_code,
  home_link = EXCLUDED.home_link,
  wikipedia_link = EXCLUDED.wikipedia_link,
  keywords = EXCLUDED.keywords,
  geom = EXCLUDED.geom,
  raw_object_id = EXCLUDED.raw_object_id,
  updated_at = NOW()
"""

RUNWAY_UPSERT_SQL = """
INSERT INTO aviation_runways (
  layer_id, source_id, source_runway_id, airport_ref, airport_ident,
  length_ft, width_ft, surface, lighted, closed, le_ident, le_latitude_deg,
  le_longitude_deg, le_elevation_ft, "le_heading_degT",
  le_displaced_threshold_ft, he_ident, he_latitude_deg, he_longitude_deg,
  he_elevation_ft, "he_heading_degT", he_displaced_threshold_ft, raw_object_id
)
VALUES (
  %(layer_id)s, %(source_id)s, %(source_runway_id)s, %(airport_ref)s,
  %(airport_ident)s, %(length_ft)s, %(width_ft)s, %(surface)s, %(lighted)s,
  %(closed)s, %(le_ident)s, %(le_latitude_deg)s, %(le_longitude_deg)s,
  %(le_elevation_ft)s, %(le_heading_degT)s, %(le_displaced_threshold_ft)s,
  %(he_ident)s, %(he_latitude_deg)s, %(he_longitude_deg)s, %(he_elevation_ft)s,
  %(he_heading_degT)s, %(he_displaced_threshold_ft)s, %(raw_object_id)s
)
ON CONFLICT (source_id, source_runway_id) DO UPDATE SET
  airport_ref = EXCLUDED.airport_ref,
  airport_ident = EXCLUDED.airport_ident,
  length_ft = EXCLUDED.length_ft,
  width_ft = EXCLUDED.width_ft,
  surface = EXCLUDED.surface,
  lighted = EXCLUDED.lighted,
  closed = EXCLUDED.closed,
  le_ident = EXCLUDED.le_ident,
  le_latitude_deg = EXCLUDED.le_latitude_deg,
  le_longitude_deg = EXCLUDED.le_longitude_deg,
  le_elevation_ft = EXCLUDED.le_elevation_ft,
  "le_heading_degT" = EXCLUDED."le_heading_degT",
  le_displaced_threshold_ft = EXCLUDED.le_displaced_threshold_ft,
  he_ident = EXCLUDED.he_ident,
  he_latitude_deg = EXCLUDED.he_latitude_deg,
  he_longitude_deg = EXCLUDED.he_longitude_deg,
  he_elevation_ft = EXCLUDED.he_elevation_ft,
  "he_heading_degT" = EXCLUDED."he_heading_degT",
  he_displaced_threshold_ft = EXCLUDED.he_displaced_threshold_ft,
  raw_object_id = EXCLUDED.raw_object_id,
  updated_at = NOW()
"""

NAVAID_UPSERT_SQL = """
INSERT INTO aviation_navaids (
  layer_id, source_id, source_navaid_id, filename, ident, name, type,
  frequency_khz, latitude_deg, longitude_deg, elevation_ft, iso_country,
  dme_frequency_khz, dme_channel, dme_latitude_deg, dme_longitude_deg,
  dme_elevation_ft, slaved_variation_deg, magnetic_variation_deg,
  "usageType", power, associated_airport, geom, raw_object_id
)
VALUES (
  %(layer_id)s, %(source_id)s, %(source_navaid_id)s, %(filename)s,
  %(ident)s, %(name)s, %(type)s, %(frequency_khz)s, %(latitude_deg)s,
  %(longitude_deg)s, %(elevation_ft)s, %(iso_country)s,
  %(dme_frequency_khz)s, %(dme_channel)s, %(dme_latitude_deg)s,
  %(dme_longitude_deg)s, %(dme_elevation_ft)s, %(slaved_variation_deg)s,
  %(magnetic_variation_deg)s, %(usageType)s, %(power)s, %(associated_airport)s,
  CASE WHEN %(geom)s IS NULL THEN NULL ELSE ST_GeomFromEWKT(%(geom)s) END,
  %(raw_object_id)s
)
ON CONFLICT (source_id, source_navaid_id) DO UPDATE SET
  filename = EXCLUDED.filename,
  ident = EXCLUDED.ident,
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  frequency_khz = EXCLUDED.frequency_khz,
  latitude_deg = EXCLUDED.latitude_deg,
  longitude_deg = EXCLUDED.longitude_deg,
  elevation_ft = EXCLUDED.elevation_ft,
  iso_country = EXCLUDED.iso_country,
  dme_frequency_khz = EXCLUDED.dme_frequency_khz,
  dme_channel = EXCLUDED.dme_channel,
  dme_latitude_deg = EXCLUDED.dme_latitude_deg,
  dme_longitude_deg = EXCLUDED.dme_longitude_deg,
  dme_elevation_ft = EXCLUDED.dme_elevation_ft,
  slaved_variation_deg = EXCLUDED.slaved_variation_deg,
  magnetic_variation_deg = EXCLUDED.magnetic_variation_deg,
  "usageType" = EXCLUDED."usageType",
  power = EXCLUDED.power,
  associated_airport = EXCLUDED.associated_airport,
  geom = EXCLUDED.geom,
  raw_object_id = EXCLUDED.raw_object_id,
  updated_at = NOW()
"""

FREQUENCY_UPSERT_SQL = """
INSERT INTO aviation_airport_frequencies (
  layer_id, source_id, source_frequency_id, airport_ref, airport_ident,
  type, description, frequency_mhz, raw_object_id
)
VALUES (
  %(layer_id)s, %(source_id)s, %(source_frequency_id)s, %(airport_ref)s,
  %(airport_ident)s, %(type)s, %(description)s, %(frequency_mhz)s,
  %(raw_object_id)s
)
ON CONFLICT (source_id, source_frequency_id) DO UPDATE SET
  airport_ref = EXCLUDED.airport_ref,
  airport_ident = EXCLUDED.airport_ident,
  type = EXCLUDED.type,
  description = EXCLUDED.description,
  frequency_mhz = EXCLUDED.frequency_mhz,
  raw_object_id = EXCLUDED.raw_object_id,
  updated_at = NOW()
"""

COUNTRY_UPSERT_SQL = """
INSERT INTO aviation_countries (
  layer_id, source_id, source_country_id, code, name, continent,
  wikipedia_link, keywords, raw_object_id
)
VALUES (
  %(layer_id)s, %(source_id)s, %(source_country_id)s, %(code)s, %(name)s,
  %(continent)s, %(wikipedia_link)s, %(keywords)s, %(raw_object_id)s
)
ON CONFLICT (source_id, code) DO UPDATE SET
  source_country_id = EXCLUDED.source_country_id,
  name = EXCLUDED.name,
  continent = EXCLUDED.continent,
  wikipedia_link = EXCLUDED.wikipedia_link,
  keywords = EXCLUDED.keywords,
  raw_object_id = EXCLUDED.raw_object_id,
  updated_at = NOW()
"""

REGION_UPSERT_SQL = """
INSERT INTO aviation_regions (
  layer_id, source_id, source_region_id, code, local_code, name, continent,
  iso_country, wikipedia_link, keywords, raw_object_id
)
VALUES (
  %(layer_id)s, %(source_id)s, %(source_region_id)s, %(code)s, %(local_code)s,
  %(name)s, %(continent)s, %(iso_country)s, %(wikipedia_link)s, %(keywords)s,
  %(raw_object_id)s
)
ON CONFLICT (source_id, code) DO UPDATE SET
  source_region_id = EXCLUDED.source_region_id,
  local_code = EXCLUDED.local_code,
  name = EXCLUDED.name,
  continent = EXCLUDED.continent,
  iso_country = EXCLUDED.iso_country,
  wikipedia_link = EXCLUDED.wikipedia_link,
  keywords = EXCLUDED.keywords,
  raw_object_id = EXCLUDED.raw_object_id,
  updated_at = NOW()
"""


def connect_database(database_url: str) -> Any:
    import psycopg
    from psycopg.rows import dict_row

    return psycopg.connect(database_url, row_factory=dict_row)


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Normalize OurAirports raw CSV objects")
    parser.add_argument("--fetch-run-id", required=True)
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL))
    parser.add_argument("--minio-endpoint", default=os.getenv("MINIO_ENDPOINT", DEFAULT_MINIO_ENDPOINT))
    parser.add_argument("--minio-access-key", default=os.getenv("MINIO_ACCESS_KEY", DEFAULT_MINIO_ACCESS_KEY))
    parser.add_argument("--minio-secret-key", default=os.getenv("MINIO_SECRET_KEY", DEFAULT_MINIO_SECRET_KEY))
    parser.add_argument("--minio-bucket", default=os.getenv("MINIO_BUCKET", RAW_BUCKET))
    return parser


def main() -> None:
    args = build_arg_parser().parse_args()
    db_connection = connect_database(args.database_url)
    storage_client = MinioReadClient(
        endpoint_url=args.minio_endpoint,
        access_key=args.minio_access_key,
        secret_key=args.minio_secret_key,
        bucket=args.minio_bucket,
    )
    try:
        normalizer = OurAirportsNormalizer(storage_client, db_connection)
        counts = normalizer.normalize_fetch_run(args.fetch_run_id)
        for table in sorted(counts):
            print(f"{table}: {counts[table]}")
    finally:
        db_connection.close()


if __name__ == "__main__":
    main()
