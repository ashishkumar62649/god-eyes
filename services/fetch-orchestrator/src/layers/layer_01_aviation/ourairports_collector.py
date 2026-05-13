"""Manual OurAirports collector for Layer 1 aviation reference data.

The collector downloads the real OurAirports CSV snapshots, stores the original
bytes in MinIO first, then records fetch_runs/raw_objects metadata in Postgres.
It intentionally does not normalize records.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import sys
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

REPO_ROOT = Path(__file__).resolve().parents[5]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from packages.schemas.layers.layer_01_aviation.ourairports import (
    EXPECTED_FILES,
    LAYER_ID,
    RAW_BUCKET,
    RAW_OBJECT_TYPE,
    SOURCE_ID,
    SOURCE_TYPE,
    SOURCE_URLS,
    build_raw_storage_key,
    build_storage_uri,
    parse_csv_rows,
    validate_airport_coordinates,
    validate_csv_columns,
)


DEFAULT_DATABASE_URL = (
    "postgresql://god_eyes:god_eyes_dev_password@localhost:5432/god_eyes_dev"
)
DEFAULT_MINIO_ENDPOINT = "http://localhost:9000"
DEFAULT_MINIO_ACCESS_KEY = "god_eyes_minio_dev"
DEFAULT_MINIO_SECRET_KEY = "replace_with_dev_secret"


@dataclass(frozen=True)
class FileValidationResult:
    status: str
    row_count: int
    error_message: str | None
    metadata: dict[str, object]


@dataclass(frozen=True)
class CollectedRawObject:
    id: str
    filename: str
    storage_bucket: str
    storage_key: str
    storage_uri: str
    byte_size: int
    checksum_sha256: str
    validation_status: str
    row_count: int
    metadata: dict[str, object]


class MinioRawStorageClient:
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

    def put_object_bytes(self, key: str, content: bytes, content_type: str) -> None:
        self._client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=content,
            ContentType=content_type,
        )


class PostgresIngestionRepository:
    def __init__(self, database_url: str) -> None:
        import psycopg

        self._connection = psycopg.connect(database_url)

    def close(self) -> None:
        self._connection.close()

    def create_fetch_run(self, fetch_run_id: str, started_at: datetime) -> None:
        metadata = {
            "source_type": SOURCE_TYPE,
            "expected_files": list(EXPECTED_FILES),
            "collector": "ourairports_collector",
        }
        with self._connection.cursor() as cur:
            cur.execute(
                """
                INSERT INTO fetch_runs (
                  id, layer_id, source_id, status, started_at, metadata
                )
                VALUES (%s, %s, %s, 'running', %s, %s::jsonb)
                """,
                (
                    fetch_run_id,
                    LAYER_ID,
                    SOURCE_ID,
                    started_at,
                    json.dumps(metadata),
                ),
            )
        self._connection.commit()

    def insert_raw_object(
        self,
        fetch_run_id: str,
        raw_object: CollectedRawObject,
        fetched_at: datetime,
    ) -> None:
        with self._connection.cursor() as cur:
            cur.execute(
                """
                INSERT INTO raw_objects (
                  id, fetch_run_id, layer_id, source_id, object_type, filename,
                  storage_bucket, storage_key, storage_uri, content_type,
                  byte_size, checksum_sha256, fetched_at, validation_status,
                  metadata
                )
                VALUES (
                  %s, %s, %s, %s, %s, %s,
                  %s, %s, %s, 'text/csv',
                  %s, %s, %s, %s, %s::jsonb
                )
                ON CONFLICT (fetch_run_id, filename) DO UPDATE SET
                  storage_bucket = EXCLUDED.storage_bucket,
                  storage_key = EXCLUDED.storage_key,
                  storage_uri = EXCLUDED.storage_uri,
                  byte_size = EXCLUDED.byte_size,
                  checksum_sha256 = EXCLUDED.checksum_sha256,
                  fetched_at = EXCLUDED.fetched_at,
                  validation_status = EXCLUDED.validation_status,
                  metadata = EXCLUDED.metadata
                """,
                (
                    raw_object.id,
                    fetch_run_id,
                    LAYER_ID,
                    SOURCE_ID,
                    RAW_OBJECT_TYPE,
                    raw_object.filename,
                    raw_object.storage_bucket,
                    raw_object.storage_key,
                    raw_object.storage_uri,
                    raw_object.byte_size,
                    raw_object.checksum_sha256,
                    fetched_at,
                    raw_object.validation_status,
                    json.dumps(raw_object.metadata),
                ),
            )
        self._connection.commit()

    def complete_fetch_run(
        self,
        fetch_run_id: str,
        completed_at: datetime,
        record_count: int,
        file_count: int,
        metadata: dict[str, object],
    ) -> None:
        with self._connection.cursor() as cur:
            cur.execute(
                """
                UPDATE fetch_runs
                SET status = 'completed',
                    completed_at = %s,
                    record_count = %s,
                    file_count = %s,
                    metadata = metadata || %s::jsonb
                WHERE id = %s
                """,
                (
                    completed_at,
                    record_count,
                    file_count,
                    json.dumps(metadata),
                    fetch_run_id,
                ),
            )
        self._connection.commit()

    def fail_fetch_run(self, fetch_run_id: str, error_message: str) -> None:
        with self._connection.cursor() as cur:
            cur.execute(
                """
                UPDATE fetch_runs
                SET status = 'failed',
                    completed_at = NOW(),
                    error_message = %s
                WHERE id = %s
                """,
                (error_message, fetch_run_id),
            )
        self._connection.commit()


def download_csv(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": "god-eyes-codex-ourairports/1.0"})
    with urlopen(request, timeout=60) as response:
        return response.read()


def validate_csv_file(filename: str, content: bytes, checksum_sha256: str) -> FileValidationResult:
    metadata: dict[str, object] = {
        "checksum_sha256": checksum_sha256,
        "required_columns_checked": True,
    }
    try:
        rows = parse_csv_rows(content)
    except csv.Error as exc:
        return FileValidationResult("invalid", 0, f"CSV parse failed: {exc}", metadata)

    row_count = len(rows)
    metadata["row_count"] = row_count
    if row_count == 0:
        return FileValidationResult("invalid", row_count, "CSV has zero rows", metadata)

    missing_columns = validate_csv_columns(filename, rows)
    if missing_columns:
        metadata["missing_columns"] = sorted(missing_columns)
        return FileValidationResult(
            "invalid",
            row_count,
            f"Missing required columns: {', '.join(sorted(missing_columns))}",
            metadata,
        )

    if filename == "airports.csv":
        invalid_airports = validate_airport_coordinates(rows)
        metadata["invalid_coordinate_count"] = len(invalid_airports)
        if invalid_airports:
            metadata["invalid_coordinate_examples"] = invalid_airports[:10]
            return FileValidationResult(
                "invalid",
                row_count,
                "Airports missing latitude/longitude when applicable",
                metadata,
            )

    return FileValidationResult("valid", row_count, None, metadata)


def collect_ourairports(
    repository: PostgresIngestionRepository,
    storage_client: MinioRawStorageClient,
    fetch_run_id: str | None = None,
    fetched_at: datetime | None = None,
) -> str:
    run_id = fetch_run_id or f"fetch_run_{uuid.uuid4().hex}"
    now = fetched_at or datetime.now(timezone.utc)
    repository.create_fetch_run(run_id, now)

    total_rows = 0
    collected: list[CollectedRawObject] = []
    try:
        for filename in EXPECTED_FILES:
            content = download_csv(SOURCE_URLS[filename])
            checksum = hashlib.sha256(content).hexdigest()
            storage_key = build_raw_storage_key(now, run_id, filename)
            storage_client.put_object_bytes(storage_key, content, "text/csv")

            validation = validate_csv_file(filename, content, checksum)
            total_rows += validation.row_count
            raw_object = CollectedRawObject(
                id=str(uuid.uuid4()),
                filename=filename,
                storage_bucket=storage_client.bucket,
                storage_key=storage_key,
                storage_uri=build_storage_uri(storage_client.bucket, storage_key),
                byte_size=len(content),
                checksum_sha256=checksum,
                validation_status=validation.status,
                row_count=validation.row_count,
                metadata={
                    **validation.metadata,
                    "source_url": SOURCE_URLS[filename],
                    "validation_error": validation.error_message,
                },
            )
            repository.insert_raw_object(run_id, raw_object, now)
            collected.append(raw_object)

        repository.complete_fetch_run(
            run_id,
            datetime.now(timezone.utc),
            record_count=total_rows,
            file_count=len(collected),
            metadata={
                "validation_statuses": {
                    item.filename: item.validation_status for item in collected
                }
            },
        )
        return run_id
    except Exception as exc:
        repository.fail_fetch_run(run_id, str(exc))
        raise


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Collect OurAirports reference CSVs")
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL))
    parser.add_argument("--minio-endpoint", default=os.getenv("MINIO_ENDPOINT", DEFAULT_MINIO_ENDPOINT))
    parser.add_argument("--minio-access-key", default=os.getenv("MINIO_ACCESS_KEY", DEFAULT_MINIO_ACCESS_KEY))
    parser.add_argument("--minio-secret-key", default=os.getenv("MINIO_SECRET_KEY", DEFAULT_MINIO_SECRET_KEY))
    parser.add_argument("--minio-bucket", default=os.getenv("MINIO_BUCKET", RAW_BUCKET))
    parser.add_argument("--fetch-run-id", default=None)
    return parser


def main() -> None:
    args = build_arg_parser().parse_args()
    repository = PostgresIngestionRepository(args.database_url)
    storage_client = MinioRawStorageClient(
        endpoint_url=args.minio_endpoint,
        access_key=args.minio_access_key,
        secret_key=args.minio_secret_key,
        bucket=args.minio_bucket,
    )
    try:
        run_id = collect_ourairports(repository, storage_client, args.fetch_run_id)
        print(run_id)
    finally:
        repository.close()


if __name__ == "__main__":
    main()
