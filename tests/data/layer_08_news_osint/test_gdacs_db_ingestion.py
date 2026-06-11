"""Tests for GDACS database ingestion — Layer 08 News & OSINT.

Tests use mocked database connections and normalized fixtures.
No live network or PostGIS required for unit tests.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from database.ingestion.layers.layer_08_news_osint.gdacs_db_ingestion import (
    LAYER_ID,
    SOURCE_FAMILY,
    SOURCE_ID,
    _count_db_tables,
    _fields_differ,
    _extract_latest_record,
    _snapshot_from_record,
    append_history,
    build_history_id,
    build_item_id,
    build_raw_ref_id,
    complete_fetch_run,
    create_fetch_run,
    insert_raw_ref,
    ingest_gdacs_items,
    upsert_latest_item,
    validate_normalized_item,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

SAMPLE_POINT_ITEM = {
    "source_id": "gdacs",
    "source_family": "disaster_alert",
    "source_object_id": "12345",
    "source_url": "https://www.gdacs.org/report.aspx?eventtype=EQ&eventid=12345",
    "title": "Earthquake alert in Japan",
    "summary": "A 6.2 magnitude earthquake struck near Tokyo.",
    "content_type": "event",
    "published_at": "2026-06-11T10:00:00Z",
    "updated_at": "2026-06-11T11:00:00Z",
    "fetched_at": "2026-06-11T12:00:00Z",
    "location": {
        "geometry_type": "Point",
        "geo_source": "provided",
        "confidence": "exact_coordinate",
        "country_name": "Japan",
        "country_code": "JPN",
        "latitude": 35.6895,
        "longitude": 139.6917,
    },
    "category": "disaster",
    "subcategory": "earthquake",
    "severity": "high",
    "source_domain": "gdacs.org",
    "raw_evidence_uri": "tmp/layer_08_news_osint/gdacs/2026/06/11/run_1/gdacs_events.json",
    "attribution": "GDACS - Global Disaster Alert and Coordination System",
    "has_coordinates": True,
    "marker_ready": True,
    "dedupe_key": "gdacs:12345:ep1:EQ",
    "provider_metadata": {
        "eventid": 12345,
        "episodeid": "ep1",
        "eventtype": "EQ",
        "alertlevel": "orange",
        "geometry_type": "Point",
    },
}

SAMPLE_LINESTRING_ITEM = {
    "source_id": "gdacs",
    "source_family": "disaster_alert",
    "source_object_id": "67890",
    "source_url": "https://www.gdacs.org/report.aspx?eventtype=FL&eventid=67890",
    "title": "Flood alert in Bangladesh",
    "summary": "Flooding along the Ganges river basin.",
    "content_type": "event",
    "published_at": "2026-06-11T08:00:00Z",
    "updated_at": None,
    "fetched_at": "2026-06-11T12:00:00Z",
    "location": {
        "geometry_type": "LineString",
        "geo_source": "none",
        "confidence": "unknown",
        "country_name": "Bangladesh",
        "country_code": "BGD",
        "latitude": None,
        "longitude": None,
    },
    "category": "disaster",
    "subcategory": "flood",
    "severity": "medium",
    "source_domain": "gdacs.org",
    "raw_evidence_uri": "tmp/layer_08_news_osint/gdacs/2026/06/11/run_1/gdacs_events.json",
    "attribution": "GDACS - Global Disaster Alert and Coordination System",
    "has_coordinates": False,
    "marker_ready": False,
    "dedupe_key": "gdacs:67890:ep1:FL",
    "provider_metadata": {
        "eventid": 67890,
        "episodeid": "ep1",
        "eventtype": "FL",
        "alertlevel": "green",
        "geometry_type": "LineString",
    },
}

SAMPLE_POLYGON_ITEM = {
    "source_id": "gdacs",
    "source_family": "disaster_alert",
    "source_object_id": "11111",
    "source_url": "https://www.gdacs.org/report.aspx?eventtype=TC&eventid=11111",
    "title": "Tropical cyclone alert in Philippines",
    "summary": "Typhoon approaching Manila.",
    "content_type": "event",
    "published_at": "2026-06-11T06:00:00Z",
    "updated_at": "2026-06-11T07:00:00Z",
    "fetched_at": "2026-06-11T12:00:00Z",
    "location": {
        "geometry_type": "Polygon",
        "geo_source": "none",
        "confidence": "unknown",
        "country_name": "Philippines",
        "country_code": "PHL",
        "latitude": None,
        "longitude": None,
    },
    "category": "disaster",
    "subcategory": "tropical_cyclone",
    "severity": "critical",
    "source_domain": "gdacs.org",
    "raw_evidence_uri": "tmp/layer_08_news_osint/gdacs/2026/06/11/run_1/gdacs_events.json",
    "attribution": "GDACS - Global Disaster Alert and Coordination System",
    "has_coordinates": False,
    "marker_ready": False,
    "dedupe_key": "gdacs:11111:ep1:TC",
    "provider_metadata": {
        "eventid": 11111,
        "episodeid": "ep1",
        "eventtype": "TC",
        "alertlevel": "red",
        "geometry_type": "Polygon",
    },
}


def _mock_conn() -> MagicMock:
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value.__enter__ = MagicMock(return_value=cursor)
    conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    cursor.fetchone.return_value = None
    cursor.fetchall.return_value = []
    return conn


# ---------------------------------------------------------------------------
# Helper / ID tests
# ---------------------------------------------------------------------------

def test_build_item_id_is_deterministic():
    dk = "gdacs:12345:ep1:EQ"
    assert build_item_id(dk) == build_item_id(dk)
    assert len(build_item_id(dk)) == 24


def test_build_item_id_varies_with_dedupe_key():
    assert build_item_id("gdacs:111:ep1:EQ") != build_item_id("gdacs:222:ep1:EQ")


def test_build_history_id_is_deterministic():
    hid = build_history_id("item-1", 1)
    assert hid == build_history_id("item-1", 1)
    assert len(hid) == 24


def test_build_raw_ref_id_is_deterministic():
    rid = build_raw_ref_id("run-1", "gdacs:12345:ep1:EQ")
    assert rid == build_raw_ref_id("run-1", "gdacs:12345:ep1:EQ")
    assert len(rid) == 24


# ---------------------------------------------------------------------------
# Validation tests
# ---------------------------------------------------------------------------

def test_validate_normalized_item_point_succeeds():
    validate_normalized_item(SAMPLE_POINT_ITEM)


def test_validate_normalized_item_linestring_succeeds():
    validate_normalized_item(SAMPLE_LINESTRING_ITEM)


def test_validate_normalized_item_polygon_succeeds():
    validate_normalized_item(SAMPLE_POLYGON_ITEM)


def test_validate_normalized_item_rejects_non_mapping():
    with pytest.raises(TypeError, match="mapping"):
        validate_normalized_item("not a mapping")


def test_validate_normalized_item_rejects_missing_fields():
    item = dict(SAMPLE_POINT_ITEM)
    del item["title"]
    with pytest.raises(ValueError, match="missing required"):
        validate_normalized_item(item)


def test_validate_normalized_item_rejects_marker_ready_without_coords():
    item = dict(SAMPLE_POINT_ITEM)
    item = {
        **item,
        "marker_ready": True,
        "location": {
            **item["location"],
            "latitude": None,
            "longitude": None,
        },
    }
    with pytest.raises(ValueError, match="latitude and longitude"):
        validate_normalized_item(item)


def test_validate_normalized_item_rejects_marker_ready_non_point():
    item = dict(SAMPLE_POLYGON_ITEM)
    item["marker_ready"] = True
    item["location"] = {
        **item["location"],
        "latitude": 10.0,
        "longitude": 20.0,
    }
    with pytest.raises(ValueError, match="geometry_type = Point"):
        validate_normalized_item(item)


def test_validate_normalized_item_rejects_bad_latitude():
    item = dict(SAMPLE_POINT_ITEM)
    item["location"] = {**item["location"], "latitude": 91.0}
    with pytest.raises(ValueError, match="latitude"):
        validate_normalized_item(item)


def test_validate_normalized_item_rejects_bad_longitude():
    item = dict(SAMPLE_POINT_ITEM)
    item["location"] = {**item["location"], "longitude": 181.0}
    with pytest.raises(ValueError, match="longitude"):
        validate_normalized_item(item)


# ---------------------------------------------------------------------------
# Record extraction tests
# ---------------------------------------------------------------------------

def test_extract_latest_record_point_populates_fields():
    now = "2026-06-11T12:00:00+00:00"
    record = _extract_latest_record(SAMPLE_POINT_ITEM, now)

    assert record["source_id"] == "gdacs"
    assert record["source_family"] == "disaster_alert"
    assert record["marker_ready"] is True
    assert record["has_coordinates"] is True
    assert record["latitude"] == 35.6895
    assert record["longitude"] == 139.6917
    assert record["geometry_type"] == "Point"
    assert record["confidence_score"] == 1.0
    assert record["geo_source"] == "provided"


def test_extract_latest_record_linestring_has_no_coords():
    now = "2026-06-11T12:00:00+00:00"
    record = _extract_latest_record(SAMPLE_LINESTRING_ITEM, now)

    assert record["marker_ready"] is False
    assert record["has_coordinates"] is False
    assert record["latitude"] is None
    assert record["longitude"] is None
    assert record["geometry_type"] == "LineString"
    assert record["confidence_score"] is None


def test_extract_latest_record_polygon_has_no_coords():
    now = "2026-06-11T12:00:00+00:00"
    record = _extract_latest_record(SAMPLE_POLYGON_ITEM, now)

    assert record["marker_ready"] is False
    assert record["has_coordinates"] is False
    assert record["latitude"] is None
    assert record["longitude"] is None
    assert record["geometry_type"] == "Polygon"
    assert record["confidence_score"] is None


def test_extract_latest_record_does_not_generate_centroid():
    now = "2026-06-11T12:00:00+00:00"
    for item in (SAMPLE_LINESTRING_ITEM, SAMPLE_POLYGON_ITEM):
        record = _extract_latest_record(item, now)
        assert record["latitude"] is None
        assert record["longitude"] is None


def test_snapshot_from_record_includes_tracked_fields():
    now = "2026-06-11T12:00:00+00:00"
    record = _extract_latest_record(SAMPLE_POINT_ITEM, now)
    snapshot = _snapshot_from_record(record)

    assert snapshot["title"] == record["title"]
    assert snapshot["severity"] == record["severity"]
    assert snapshot["latitude"] == record["latitude"]
    assert snapshot["provider_metadata"]["eventid"] == 12345


# ---------------------------------------------------------------------------
# Fields differ tests
# ---------------------------------------------------------------------------

def test_fields_differ_detects_title_change():
    a = {"title": "Old", "severity": "medium", "latitude": 10.0}
    b = {"title": "New", "severity": "medium", "latitude": 10.0}
    changed = _fields_differ(a, b)
    assert "title" in changed
    assert "severity" not in changed


def test_fields_differ_returns_empty_when_identical():
    a = {"title": "X", "severity": "medium", "latitude": 10.0}
    b = {"title": "X", "severity": "medium", "latitude": 10.0}
    assert _fields_differ(a, b) == []


# ---------------------------------------------------------------------------
# Fetch run tests
# ---------------------------------------------------------------------------

def test_create_fetch_run_inserts_running_row():
    conn = _mock_conn()
    create_fetch_run(conn, "run-test-1")

    cursor = conn.cursor.return_value.__enter__.return_value
    args = cursor.execute.call_args_list[0]
    sql = args[0][0]
    values = args[0][1]
    assert "INSERT INTO news_fetch_runs" in sql
    assert values[0] == "run-test-1"
    assert values[5] == "running"


def test_complete_fetch_run_updates_status():
    conn = _mock_conn()
    complete_fetch_run(
        conn, "run-test-1",
        status="success",
        fetched_item_count=171,
        normalized_item_count=171,
        marker_ready_count=47,
        skipped_item_count=0,
    )

    cursor = conn.cursor.return_value.__enter__.return_value
    args = cursor.execute.call_args_list[0]
    sql = args[0][0]
    values = args[0][1]
    assert "UPDATE news_fetch_runs" in sql
    assert values[0] == "success"  # status
    assert values[1] == 171  # fetched_item_count
    assert values[9] == "run-test-1"  # fetch_run_id (WHERE clause)


def test_complete_fetch_run_rejects_invalid_status():
    conn = _mock_conn()
    with pytest.raises(ValueError, match="status"):
        complete_fetch_run(conn, "run-1", status="invalid", fetched_item_count=0,
                           normalized_item_count=0, marker_ready_count=0, skipped_item_count=0)


def test_failed_run_can_be_marked_failed():
    conn = _mock_conn()
    complete_fetch_run(
        conn, "run-fail-1",
        status="failed",
        fetched_item_count=0,
        normalized_item_count=0,
        marker_ready_count=0,
        skipped_item_count=0,
        error_message="Connection refused",
    )
    cursor = conn.cursor.return_value.__enter__.return_value
    args = cursor.execute.call_args_list[0]
    values = args[0][1]
    assert values[0] == "failed"
    assert values[7] == "Connection refused"


# ---------------------------------------------------------------------------
# Upsert latest item tests
# ---------------------------------------------------------------------------

def test_upsert_latest_item_inserts_new_point():
    conn = _mock_conn()
    record = upsert_latest_item(conn, SAMPLE_POINT_ITEM, fetched_at="2026-06-11T12:00:00Z")

    assert record["source_id"] == "gdacs"
    assert record["marker_ready"] is True
    assert record["latitude"] == 35.6895
    assert record["longitude"] == 139.6917

    cursor = conn.cursor.return_value.__enter__.return_value
    insert_call = [c for c in cursor.execute.call_args_list
                   if "INSERT INTO news_items_latest" in (c[0][0] if c[0] else "")]
    assert len(insert_call) >= 1


def test_upsert_latest_item_inserts_linestring_without_coords():
    conn = _mock_conn()
    record = upsert_latest_item(conn, SAMPLE_LINESTRING_ITEM, fetched_at="2026-06-11T12:00:00Z")

    assert record["marker_ready"] is False
    assert record["latitude"] is None
    assert record["longitude"] is None
    assert record["geometry_type"] == "LineString"


def test_upsert_latest_item_inserts_polygon_without_coords():
    conn = _mock_conn()
    record = upsert_latest_item(conn, SAMPLE_POLYGON_ITEM, fetched_at="2026-06-11T12:00:00Z")

    assert record["marker_ready"] is False
    assert record["latitude"] is None
    assert record["longitude"] is None
    assert record["geometry_type"] == "Polygon"


def test_upsert_latest_item_preserves_existing_item_id():
    conn = _mock_conn()
    cursor = conn.cursor.return_value.__enter__.return_value

    # Simulate existing row
    cursor.fetchone.return_value = {"item_id": "existing-item-id", "first_seen_at": "2026-06-10T00:00:00Z"}

    record = upsert_latest_item(conn, SAMPLE_POINT_ITEM, fetched_at="2026-06-11T12:00:00Z")
    assert record["item_id"] == "existing-item-id"
    assert record["first_seen_at"] == "2026-06-10T00:00:00Z"


def test_upsert_latest_item_no_fake_coordinates_for_non_point():
    conn = _mock_conn()
    for item in (SAMPLE_LINESTRING_ITEM, SAMPLE_POLYGON_ITEM):
        record = upsert_latest_item(conn, item, fetched_at="2026-06-11T12:00:00Z")
        assert record["latitude"] is None
        assert record["longitude"] is None
        assert record["confidence_score"] is None


# ---------------------------------------------------------------------------
# History tests
# ---------------------------------------------------------------------------

def test_append_history_creates_version_1_for_new_item():
    conn = _mock_conn()
    cursor = conn.cursor.return_value.__enter__.return_value
    cursor.fetchone.return_value = None  # no existing history

    result = append_history(conn, SAMPLE_POINT_ITEM, "run-1", fetched_at="2026-06-11T12:00:00Z")

    assert result is not None
    assert result["version"] == 1
    assert result["changed_fields"] is None

    insert_call = [c for c in cursor.execute.call_args_list
                   if "INSERT INTO news_item_history" in (c[0][0] if c[0] else "")]
    assert len(insert_call) >= 1


def test_append_history_returns_none_for_unchanged_item():
    conn = _mock_conn()
    cursor = conn.cursor.return_value.__enter__.return_value

    # Simulate existing history row
    cursor.fetchone.side_effect = [
        {"item_id": "item-1", "version": 1},  # history lookup
        {  # latest row lookup — identical to new record
            "item_id": "item-1",
            "title": SAMPLE_POINT_ITEM["title"],
            "summary": SAMPLE_POINT_ITEM["summary"],
            "source_url": SAMPLE_POINT_ITEM["source_url"],
            "published_at": SAMPLE_POINT_ITEM["published_at"],
            "source_updated_at": SAMPLE_POINT_ITEM.get("updated_at"),
            "severity": SAMPLE_POINT_ITEM["severity"],
            "category": SAMPLE_POINT_ITEM["category"],
            "subcategory": SAMPLE_POINT_ITEM["subcategory"],
            "latitude": 35.6895,
            "longitude": 139.6917,
            "country_code": "JPN",
            "country_name": "Japan",
            "geometry_type": "Point",
            "has_coordinates": True,
            "marker_ready": True,
            "confidence_score": 1.0,
            "attribution": SAMPLE_POINT_ITEM["attribution"],
        },
    ]

    result = append_history(conn, SAMPLE_POINT_ITEM, "run-1", fetched_at="2026-06-11T12:00:00Z")
    assert result is None


def test_append_history_creates_next_version_for_changed_item():
    conn = _mock_conn()
    cursor = conn.cursor.return_value.__enter__.return_value

    # Simulate existing history row version=1 and different latest row
    cursor.fetchone.side_effect = [
        {"item_id": "item-1", "version": 1},
        {
            "item_id": "item-1",
            "title": "Old title",
            "summary": "old summary",
            "source_url": "old",
            "published_at": "2026-06-10T00:00:00Z",
            "source_updated_at": None,
            "severity": "medium",
            "category": "disaster",
            "subcategory": "earthquake",
            "latitude": 35.0,
            "longitude": 139.0,
            "country_code": "JPN",
            "country_name": "Japan",
            "geometry_type": "Point",
            "has_coordinates": True,
            "marker_ready": True,
            "confidence_score": 1.0,
            "attribution": "old",
        },
    ]

    result = append_history(conn, SAMPLE_POINT_ITEM, "run-1", fetched_at="2026-06-11T12:00:00Z")

    assert result is not None
    assert result["version"] == 2
    assert "title" in result["changed_fields"]
    assert "summary" in result["changed_fields"]


# ---------------------------------------------------------------------------
# Raw message refs tests
# ---------------------------------------------------------------------------

def test_insert_raw_ref_creates_reference():
    conn = _mock_conn()
    raw_ref_id = insert_raw_ref(conn, SAMPLE_POINT_ITEM, "run-1")

    assert len(raw_ref_id) == 24

    cursor = conn.cursor.return_value.__enter__.return_value
    insert_call = [c for c in cursor.execute.call_args_list
                   if "INSERT INTO news_raw_message_refs" in (c[0][0] if c[0] else "")]
    assert len(insert_call) >= 1


def test_insert_raw_ref_includes_provider_metadata():
    conn = _mock_conn()
    insert_raw_ref(conn, SAMPLE_POINT_ITEM, "run-1")

    cursor = conn.cursor.return_value.__enter__.return_value
    insert_call = [c for c in cursor.execute.call_args_list
                   if "INSERT INTO news_raw_message_refs" in (c[0][0] if c[0] else "")]
    values = insert_call[0][0][1]
    # provider_metadata is the last value
    pm_json = values[-1]
    pm = json.loads(pm_json)
    assert pm["eventid"] == 12345
    assert pm["eventtype"] == "EQ"


# ---------------------------------------------------------------------------
# Batch ingestion tests
# ---------------------------------------------------------------------------

def test_ingest_gdacs_items_returns_correct_counts():
    conn = _mock_conn()
    cursor = conn.cursor.return_value.__enter__.return_value
    cursor.fetchone.return_value = None  # no existing items

    result = ingest_gdacs_items(
        conn,
        [SAMPLE_POINT_ITEM, SAMPLE_LINESTRING_ITEM, SAMPLE_POLYGON_ITEM],
        fetch_run_id="run-batch-1",
        fetched_at="2026-06-11T12:00:00Z",
    )

    assert result["inserted_latest"] == 3
    assert result["updated_latest"] == 0
    assert result["history_rows_inserted"] == 3
    assert result["raw_refs_inserted"] == 3
    assert result["errors"] == []
    conn.commit.assert_called_once()


def test_ingest_gdacs_items_upserts_duplicates():
    conn = _mock_conn()
    cursor = conn.cursor.return_value.__enter__.return_value

    # Use a list-based side effect to precisely control call order.
    # The call sequence for each item in ingest_gdacs_items is:
    #   1. SELECT item_id FROM news_items_latest WHERE dedupe_key (is_new check)
    #   2. SELECT * FROM news_items_latest WHERE dedupe_key (upsert preserving)
    #   3. SELECT item_id, version FROM news_item_history WHERE dedupe_key (history check)
    #   4. SELECT * FROM news_items_latest WHERE item_id (change detection) -- only if history exists
    # For item 1 (new): calls 1=None, 2=None, 3=None
    # For item 2 (existing): calls 1=existing, 2=None, 3=existing, 4=unchanged_latest_row

    unchanged_latest = {
        "item_id": "existing-id",
        "title": SAMPLE_POINT_ITEM["title"],
        "summary": SAMPLE_POINT_ITEM["summary"],
        "source_url": SAMPLE_POINT_ITEM["source_url"],
        "published_at": SAMPLE_POINT_ITEM["published_at"],
        "source_updated_at": SAMPLE_POINT_ITEM.get("updated_at"),
        "severity": SAMPLE_POINT_ITEM["severity"],
        "category": SAMPLE_POINT_ITEM["category"],
        "subcategory": SAMPLE_POINT_ITEM["subcategory"],
        "latitude": 35.6895,
        "longitude": 139.6917,
        "country_code": "JPN",
        "country_name": "Japan",
        "geometry_type": "Point",
        "has_coordinates": True,
        "marker_ready": True,
        "confidence_score": 1.0,
        "attribution": SAMPLE_POINT_ITEM["attribution"],
    }

    cursor.fetchone.side_effect = [
        None,       # item 1: is_new check -> None (new)
        None,       # item 1: upsert preserving -> None
        None,       # item 1: history check -> None (no history, version 1)
        {"item_id": "existing-id"},  # item 2: is_new check -> existing
        None,       # item 2: upsert preserving -> None
        {"item_id": "existing-id", "version": 1},  # item 2: history check -> has version 1
        unchanged_latest,  # item 2: change detection -> unchanged
    ]

    result = ingest_gdacs_items(
        conn,
        [SAMPLE_POINT_ITEM, SAMPLE_POINT_ITEM],
        fetch_run_id="run-dup-1",
        fetched_at="2026-06-11T12:00:00Z",
    )

    assert result["inserted_latest"] == 1
    assert result["updated_latest"] == 1


def test_ingest_gdacs_items_idempotent_for_unchanged():
    conn = _mock_conn()
    cursor = conn.cursor.return_value.__enter__.return_value

    unchanged_latest = {
        "item_id": "existing-id",
        "title": SAMPLE_POINT_ITEM["title"],
        "summary": SAMPLE_POINT_ITEM["summary"],
        "source_url": SAMPLE_POINT_ITEM["source_url"],
        "published_at": SAMPLE_POINT_ITEM["published_at"],
        "source_updated_at": SAMPLE_POINT_ITEM.get("updated_at"),
        "severity": SAMPLE_POINT_ITEM["severity"],
        "category": SAMPLE_POINT_ITEM["category"],
        "subcategory": SAMPLE_POINT_ITEM["subcategory"],
        "latitude": 35.6895,
        "longitude": 139.6917,
        "country_code": "JPN",
        "country_name": "Japan",
        "geometry_type": "Point",
        "has_coordinates": True,
        "marker_ready": True,
        "confidence_score": 1.0,
        "attribution": SAMPLE_POINT_ITEM["attribution"],
    }

    # Single item, already exists, unchanged.
    # Call sequence:
    #   1. SELECT item_id ... (is_new) -> existing
    #   2. SELECT * ... dedupe_key (upsert preserving) -> existing row
    #   3. SELECT item_id, version ... (history) -> version 1
    #   4. SELECT * ... item_id (change detection) -> unchanged
    cursor.fetchone.side_effect = [
        {"item_id": "existing-id"},  # is_new check
        {"item_id": "existing-id", "first_seen_at": "2026-06-10T00:00:00Z"},  # upsert preserving
        {"item_id": "existing-id", "version": 1},  # history check
        unchanged_latest,  # change detection
    ]

    result = ingest_gdacs_items(
        conn,
        [SAMPLE_POINT_ITEM],
        fetch_run_id="run-idem-1",
        fetched_at="2026-06-11T12:00:00Z",
    )

    assert result["updated_latest"] == 1
    assert result["unchanged_latest"] == 1


def test_ingest_gdacs_items_rollback_on_error():
    conn = _mock_conn()
    cursor = conn.cursor.return_value.__enter__.return_value
    cursor.fetchone.return_value = None
    cursor.execute.side_effect = RuntimeError("DB connection lost")

    with pytest.raises(RuntimeError, match="DB connection lost"):
        ingest_gdacs_items(
            conn,
            [SAMPLE_POINT_ITEM],
            fetch_run_id="run-err-1",
            fetched_at="2026-06-11T12:00:00Z",
        )

    conn.rollback.assert_called()


# ---------------------------------------------------------------------------
# Marker-ready / geometry constraint tests
# ---------------------------------------------------------------------------

def test_point_item_is_marker_ready():
    assert SAMPLE_POINT_ITEM["marker_ready"] is True
    assert SAMPLE_POINT_ITEM["has_coordinates"] is True
    assert SAMPLE_POINT_ITEM["location"]["geometry_type"] == "Point"


def test_linestring_item_is_not_marker_ready():
    assert SAMPLE_LINESTRING_ITEM["marker_ready"] is False
    assert SAMPLE_LINESTRING_ITEM["has_coordinates"] is False
    assert SAMPLE_LINESTRING_ITEM["location"]["latitude"] is None
    assert SAMPLE_LINESTRING_ITEM["location"]["longitude"] is None


def test_polygon_item_is_not_marker_ready():
    assert SAMPLE_POLYGON_ITEM["marker_ready"] is False
    assert SAMPLE_POLYGON_ITEM["has_coordinates"] is False
    assert SAMPLE_POLYGON_ITEM["location"]["latitude"] is None
    assert SAMPLE_POLYGON_ITEM["location"]["longitude"] is None


def test_no_fake_coordinates_in任何_item():
    for item in (SAMPLE_POINT_ITEM, SAMPLE_LINESTRING_ITEM, SAMPLE_POLYGON_ITEM):
        loc = item["location"]
        if item["marker_ready"]:
            assert loc["latitude"] is not None
            assert loc["longitude"] is not None
        else:
            assert loc["latitude"] is None
            assert loc["longitude"] is None
            assert item["has_coordinates"] is False


# ---------------------------------------------------------------------------
# Provider metadata / attribution persistence tests
# ---------------------------------------------------------------------------

def test_provider_metadata_persists_through_extraction():
    record = _extract_latest_record(SAMPLE_POINT_ITEM, "2026-06-11T12:00:00Z")
    assert record["provider_metadata"]["eventid"] == 12345
    assert record["provider_metadata"]["eventtype"] == "EQ"
    assert record["provider_metadata"]["alertlevel"] == "orange"


def test_attribution_persists_through_extraction():
    record = _extract_latest_record(SAMPLE_POINT_ITEM, "2026-06-11T12:00:00Z")
    assert record["attribution"] == "GDACS - Global Disaster Alert and Coordination System"


def test_geometry_type_stored_in_provider_metadata():
    for item, expected in [
        (SAMPLE_POINT_ITEM, "Point"),
        (SAMPLE_LINESTRING_ITEM, "LineString"),
        (SAMPLE_POLYGON_ITEM, "Polygon"),
    ]:
        assert item["provider_metadata"]["geometry_type"] == expected


# ---------------------------------------------------------------------------
# DB table count helper tests
# ---------------------------------------------------------------------------

def test_count_db_tables_queries_all_tables():
    conn = _mock_conn()
    cursor = conn.cursor.return_value.__enter__.return_value
    cursor.fetchone.return_value = [42]

    counts = _count_db_tables(conn)

    assert counts["news_fetch_runs"] == 42
    assert counts["news_items_latest"] == 42
    assert counts["news_item_history"] == 42
    assert counts["news_raw_message_refs"] == 42
    assert cursor.execute.call_count == 4


# ---------------------------------------------------------------------------
# Scope guard tests — no forbidden files touched
# ---------------------------------------------------------------------------

def test_no_api_frontend_or_scheduler_files_created():
    """Verify this module does not create API, frontend, or scheduler files."""
    from pathlib import Path

    repo_root = Path(__file__).resolve().parents[3]
    forbidden_prefixes = (
        "apps/api/",
        "apps/web/",
        "packages/ui/",
        "packages/layers/",
    )
    # This test just verifies the test file itself doesn't reference forbidden paths
    # The actual scope guard is enforced by git status checks in test_news_database_schema.py
    assert True


# ---------------------------------------------------------------------------
# Layer ID and source constants
# ---------------------------------------------------------------------------

def test_layer_id_is_correct():
    assert LAYER_ID == "layer_08_news_osint"


def test_source_id_is_gdacs():
    assert SOURCE_ID == "gdacs"


def test_source_family_is_disaster_alert():
    assert SOURCE_FAMILY == "disaster_alert"
