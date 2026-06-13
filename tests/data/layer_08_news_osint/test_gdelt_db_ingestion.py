"""Tests for GDELT Event Export database ingestion."""

from __future__ import annotations

import os
import subprocess
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from database.ingestion.layers.layer_08_news_osint.gdelt_db_ingestion import (
    LAYER_ID,
    SOURCE_FAMILY,
    SOURCE_ID,
    _changed_fields,
    _extract_record,
    _parse_timestamp,
    build_history_id,
    build_item_id,
    build_raw_ref_id,
    ingest_gdelt_run,
    validate_gdelt_item,
)


REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATION_PATH = (
    REPO_ROOT
    / "database"
    / "migrations"
    / "layers"
    / "layer_08_news_osint"
    / "001_news_tables.sql"
)
DB_CONTAINER = "god-eyes-postgis"
DB_USER = "god_eyes"

MARKER_ITEM = {
    "item_id": None,
    "layer_id": LAYER_ID,
    "source_id": SOURCE_ID,
    "source_family": SOURCE_FAMILY,
    "source_event_id": "1202606130000001",
    "dedupe_key": "gdelt_event_export:1202606130000001",
    "title": "GDELT event 190 involving ACTOR ONE and ACTOR TWO in IN",
    "summary": "EventCode: 190 | Type: Material Conflict | Location: New Delhi, India",
    "category": "conflict",
    "subcategory": "fight",
    "severity": "critical",
    "country_code": "IN",
    "location_name": "New Delhi, India",
    "latitude": 28.6139,
    "longitude": 77.209,
    "has_coordinates": True,
    "marker_ready": True,
    "geometry_type": "Point",
    "location_confidence": "city_level",
    "published_at": "2026-06-13T00:00:00+00:00",
    "source_updated_at": "20260613121500",
    "fetched_at": "2026-06-13T12:20:00+00:00",
    "source_url": "https://example.invalid/article/1",
    "source_domain": "example.invalid",
    "attribution": "GDELT source attribution",
    "provider_metadata": {
        "global_event_id": "1202606130000001",
        "event_code": "190",
        "quad_class": "4",
    },
}

LIST_ONLY_ITEM = {
    **MARKER_ITEM,
    "source_event_id": "1202606130000002",
    "dedupe_key": "gdelt_event_export:1202606130000002",
    "title": "GDELT verbal cooperation event in IN",
    "summary": "EventCode: 040 | Type: Verbal Cooperation | Country: IN",
    "category": "diplomacy",
    "subcategory": "consultation",
    "severity": "low",
    "location_name": None,
    "latitude": None,
    "longitude": None,
    "has_coordinates": False,
    "marker_ready": False,
    "geometry_type": None,
    "location_confidence": "country_level",
    "source_url": "https://example.invalid/article/2",
    "provider_metadata": {
        "global_event_id": "1202606130000002",
        "event_code": "040",
        "quad_class": "1",
    },
}


def test_source_identity_and_dedupe_do_not_conflict_with_gdacs():
    assert SOURCE_ID == "gdelt_event_export"
    assert SOURCE_FAMILY == "global_event"
    assert MARKER_ITEM["dedupe_key"].startswith("gdelt_event_export:")
    assert not MARKER_ITEM["dedupe_key"].startswith("gdacs:")


def test_identifiers_are_stable_and_source_scoped():
    item_id = build_item_id(MARKER_ITEM["dedupe_key"])
    assert item_id == build_item_id(MARKER_ITEM["dedupe_key"])
    assert build_history_id(item_id, 1) != build_history_id(item_id, 2)
    assert build_raw_ref_id("run-one", MARKER_ITEM["dedupe_key"]) != build_raw_ref_id(
        "run-two", MARKER_ITEM["dedupe_key"]
    )


def test_validate_marker_ready_and_list_only_items():
    validate_gdelt_item(MARKER_ITEM)
    validate_gdelt_item(LIST_ONLY_ITEM)


@pytest.mark.parametrize(
    ("field", "value", "message"),
    (
        ("source_id", "gdacs", "source_id"),
        ("dedupe_key", "gdacs:1", "dedupe_key"),
        ("latitude", 91.0, "latitude"),
        ("longitude", 181.0, "longitude"),
    ),
)
def test_validate_rejects_wrong_identity_and_invalid_coordinates(field, value, message):
    item = deepcopy(MARKER_ITEM)
    item[field] = value
    with pytest.raises(ValueError, match=message):
        validate_gdelt_item(item)


def test_validate_rejects_fake_marker_coordinates():
    item = deepcopy(LIST_ONLY_ITEM)
    item["marker_ready"] = True
    with pytest.raises(ValueError, match="marker_ready"):
        validate_gdelt_item(item)


def test_gdelt_compact_timestamp_is_database_ready():
    parsed = _parse_timestamp("20260613121500", "source_updated_at")
    assert parsed == datetime(2026, 6, 13, 12, 15, tzinfo=timezone.utc)


def test_extract_record_maps_flat_normalizer_shape_without_coordinates():
    observed_at = datetime(2026, 6, 13, 12, 30, tzinfo=timezone.utc)
    record = _extract_record(
        LIST_ONLY_ITEM,
        observed_at=observed_at,
        raw_evidence_uri="tmp/layer_08_news_osint/gdelt_event_export/export.zip",
    )
    assert record["source_object_id"] == LIST_ONLY_ITEM["source_event_id"]
    assert record["content_type"] == "event"
    assert record["latitude"] is None
    assert record["longitude"] is None
    assert record["marker_ready"] is False
    assert record["geo_source"] == "none"


def test_changed_fields_detects_meaningful_change_and_ignores_seen_times():
    observed_at = datetime(2026, 6, 13, 12, 30, tzinfo=timezone.utc)
    old = _extract_record(
        MARKER_ITEM,
        observed_at=observed_at,
        raw_evidence_uri="tmp/layer_08_news_osint/gdelt_event_export/export.zip",
    )
    new = dict(old)
    new["title"] = "Changed title"
    new["last_seen_at"] = datetime(2026, 6, 13, 12, 45, tzinfo=timezone.utc)
    assert _changed_fields(old, new) == ["title"]


def test_ingest_run_rolls_back_on_database_error():
    conn = MagicMock()
    cursor = conn.cursor.return_value.__enter__.return_value
    cursor.execute.side_effect = RuntimeError("database unavailable")

    with pytest.raises(RuntimeError, match="database unavailable"):
        ingest_gdelt_run(
            conn,
            [MARKER_ITEM],
            fetch_run_id="gdelt-run-error",
            raw_output_uri="tmp/layer_08_news_osint/gdelt_event_export/export.zip",
        )

    conn.rollback.assert_called_once()
    conn.commit.assert_not_called()


def test_ingest_run_rejects_duplicate_dedupe_keys_before_writes():
    conn = MagicMock()
    with pytest.raises(ValueError, match="duplicate dedupe keys"):
        ingest_gdelt_run(
            conn,
            [MARKER_ITEM, deepcopy(MARKER_ITEM)],
            fetch_run_id="gdelt-run-duplicate",
            raw_output_uri="tmp/layer_08_news_osint/gdelt_event_export/export.zip",
        )
    conn.cursor.assert_not_called()


def _docker_psql(database: str, sql: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            "docker",
            "exec",
            "-i",
            DB_CONTAINER,
            "psql",
            "-v",
            "ON_ERROR_STOP=1",
            "-U",
            DB_USER,
            "-d",
            database,
            "-tA",
        ],
        input=sql,
        text=True,
        capture_output=True,
        check=False,
    )


@pytest.fixture(scope="module")
def gdelt_database():
    if os.environ.get("GOD_EYES_RUN_DB_TESTS") != "1":
        pytest.skip("Set GOD_EYES_RUN_DB_TESTS=1 to run local PostGIS integration tests")

    inspect = subprocess.run(
        ["docker", "inspect", "-f", "{{.State.Running}}", DB_CONTAINER],
        capture_output=True,
        text=True,
        check=False,
    )
    if inspect.returncode != 0 or inspect.stdout.strip() != "true":
        pytest.skip(f"Local container {DB_CONTAINER} is not running")

    database = f"god_eyes_gdelt_ingestion_test_{os.getpid()}"
    create = _docker_psql(
        "postgres",
        f'DROP DATABASE IF EXISTS "{database}"; CREATE DATABASE "{database}";',
    )
    assert create.returncode == 0, create.stderr
    applied = _docker_psql(database, MIGRATION_PATH.read_text(encoding="utf-8"))
    assert applied.returncode == 0, applied.stderr

    try:
        yield database
    finally:
        _docker_psql(
            "postgres",
            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
            f"WHERE datname = '{database}' AND pid <> pg_backend_pid(); "
            f'DROP DATABASE IF EXISTS "{database}";',
        )


def _connect(database: str):
    import psycopg
    from psycopg.rows import dict_row

    return psycopg.connect(
        f"postgresql://god_eyes:god_eyes_dev_password@localhost:5432/{database}",
        row_factory=dict_row,
    )


def test_live_postgis_ingestion_geometry_dedupe_history_and_raw_refs(gdelt_database):
    raw_uri = "tmp/layer_08_news_osint/gdelt_event_export/20260613121500.export.CSV.zip"
    first_seen = datetime(2026, 6, 13, 12, 30, tzinfo=timezone.utc)
    second_seen = datetime(2026, 6, 13, 12, 45, tzinfo=timezone.utc)

    with _connect(gdelt_database) as conn:
        first = ingest_gdelt_run(
            conn,
            [MARKER_ITEM, LIST_ONLY_ITEM],
            fetch_run_id="gdelt-test-run-one",
            raw_output_uri=raw_uri,
            observed_at=first_seen,
        )
        second = ingest_gdelt_run(
            conn,
            [MARKER_ITEM, LIST_ONLY_ITEM],
            fetch_run_id="gdelt-test-run-two",
            raw_output_uri=raw_uri,
            observed_at=second_seen,
        )

        assert first["inserted_latest"] == 2
        assert first["history_rows_inserted"] == 2
        assert second["inserted_latest"] == 0
        assert second["updated_latest"] == 0
        assert second["unchanged_latest"] == 2
        assert second["history_rows_inserted"] == 0

        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                  count(*) AS latest_count,
                  count(*) FILTER (WHERE marker_ready) AS marker_count,
                  count(*) FILTER (WHERE NOT marker_ready) AS list_count,
                  count(*) FILTER (WHERE geom IS NOT NULL) AS geometry_count,
                  count(*) FILTER (WHERE NOT marker_ready AND geom IS NOT NULL) AS fake_risk,
                  count(DISTINCT dedupe_key) AS distinct_dedupe,
                  min(first_seen_at) AS first_seen_at,
                  max(last_seen_at) AS last_seen_at
                FROM news_items_latest
                WHERE source_id = %s
                """,
                [SOURCE_ID],
            )
            counts = cursor.fetchone()
            assert counts["latest_count"] == 2
            assert counts["marker_count"] == 1
            assert counts["list_count"] == 1
            assert counts["geometry_count"] == 1
            assert counts["fake_risk"] == 0
            assert counts["distinct_dedupe"] == 2
            assert counts["first_seen_at"] == first_seen
            assert counts["last_seen_at"] == second_seen

            cursor.execute(
                """
                SELECT
                  (SELECT count(*) FROM news_sources WHERE source_id IN ('gdacs', %s)) AS source_count,
                  (SELECT count(*) FROM news_fetch_runs WHERE source_id = %s) AS run_count,
                  (SELECT count(*) FROM news_item_history WHERE source_id = %s) AS history_count,
                  (SELECT count(*) FROM news_raw_message_refs WHERE source_id = %s) AS raw_ref_count
                """,
                [SOURCE_ID, SOURCE_ID, SOURCE_ID, SOURCE_ID],
            )
            evidence = cursor.fetchone()
            assert evidence == {
                "source_count": 2,
                "run_count": 2,
                "history_count": 2,
                "raw_ref_count": 4,
            }

        changed_item = deepcopy(MARKER_ITEM)
        changed_item["title"] = "Updated GDELT event title"
        third = ingest_gdelt_run(
            conn,
            [changed_item, LIST_ONLY_ITEM],
            fetch_run_id="gdelt-test-run-three",
            raw_output_uri=raw_uri,
            observed_at=datetime(2026, 6, 13, 13, 0, tzinfo=timezone.utc),
        )
        assert third["updated_latest"] == 1
        assert third["unchanged_latest"] == 1
        assert third["history_rows_inserted"] == 1

        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT version, changed_fields
                FROM news_item_history
                WHERE dedupe_key = %s
                ORDER BY version DESC
                LIMIT 1
                """,
                [MARKER_ITEM["dedupe_key"]],
            )
            history = cursor.fetchone()
            assert history["version"] == 2
            assert history["changed_fields"] == ["title"]
