"""Tests for Layer 08 News & OSINT — GDACS normalizer.

No live network calls. Uses hand-written fixtures only.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

SRC_DIR = Path(__file__).resolve().parents[3] / "services" / "fetch-orchestrator" / "src"
sys.path.insert(0, str(SRC_DIR))

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

POINT_FEATURE = {
    "type": "Feature",
    "geometry": {"type": "Point", "coordinates": [139.69, 35.69]},
    "properties": {
        "eventid": 1001,
        "episodeid": 5,
        "eventtype": "EQ",
        "alertlevel": "Orange",
        "country": "Japan",
        "humanReadable": "M6.1 earthquake near Tokyo",
        "description": "Shallow earthquake detected.",
        "fromdate": "2026-06-10T08:00:00Z",
        "todate": "2026-06-10T12:00:00Z",
        "resources": {
            "report": "https://www.gdacs.org/report/EQ/1001",
            "details": "https://www.gdacs.org/details/EQ/1001",
            "geometry": "https://www.gdacs.org/geometry/EQ/1001",
        },
    },
}

POLYGON_FEATURE = {
    "type": "Feature",
    "geometry": {
        "type": "Polygon",
        "coordinates": [[[100.0, 10.0], [101.0, 10.0], [101.0, 11.0], [100.0, 11.0], [100.0, 10.0]]],
    },
    "properties": {
        "eventid": 2002,
        "eventtype": "TC",
        "alertlevel": "Red",
        "country": "Philippines",
        "humanReadable": "Tropical Cyclone Batang",
    },
}

LINESTRING_FEATURE = {
    "type": "Feature",
    "geometry": {
        "type": "LineString",
        "coordinates": [[80.0, 20.0], [81.0, 21.0]],
    },
    "properties": {
        "eventid": 3003,
        "eventtype": "FL",
        "alertlevel": "Green",
        "country": "India",
    },
}

NO_TITLE_FEATURE = {
    "type": "Feature",
    "geometry": {"type": "Point", "coordinates": [25.0, -5.0]},
    "properties": {
        "eventid": 4004,
        "eventtype": "DR",
        "alertlevel": "Green",
        "country": "DRC",
        "humanReadable": "No title",
    },
}

NO_GEOMETRY_FEATURE = {
    "type": "Feature",
    "geometry": None,
    "properties": {
        "eventid": 5005,
        "eventtype": "WF",
        "alertlevel": "Orange",
        "country": "Australia",
    },
}

MISSING_EVENTID_FEATURE = {
    "type": "Feature",
    "geometry": {"type": "Point", "coordinates": [10.0, 50.0]},
    "properties": {
        "eventtype": "VO",
        "alertlevel": "Red",
    },
}

FETCHED_AT = "2026-06-11T16:00:00+00:00"


# ---------------------------------------------------------------------------
# normalize_gdacs_feature
# ---------------------------------------------------------------------------

class TestNormalizeFeature:
    def setup_method(self):
        from layers.layer_08_news_osint.gdacs_normalizer import normalize_gdacs_feature
        self.normalize = normalize_gdacs_feature

    def test_point_marker_ready(self):
        item = self.normalize(POINT_FEATURE, FETCHED_AT)
        assert item["marker_ready"] is True
        assert item["has_coordinates"] is True

    def test_point_lat_lon_correct(self):
        # GeoJSON coords are [lon, lat]
        item = self.normalize(POINT_FEATURE, FETCHED_AT)
        assert item["location"]["longitude"] == 139.69
        assert item["location"]["latitude"] == 35.69

    def test_point_confidence_exact(self):
        item = self.normalize(POINT_FEATURE, FETCHED_AT)
        assert item["location"]["confidence"] == "exact_coordinate"
        assert item["location"]["geo_source"] == "provided"

    def test_polygon_not_marker_ready(self):
        item = self.normalize(POLYGON_FEATURE, FETCHED_AT)
        assert item["marker_ready"] is False
        assert item["has_coordinates"] is False
        assert item["location"]["latitude"] is None
        assert item["location"]["longitude"] is None

    def test_polygon_no_fake_coordinates(self):
        item = self.normalize(POLYGON_FEATURE, FETCHED_AT)
        assert item["location"]["latitude"] is None
        assert item["location"]["longitude"] is None

    def test_linestring_not_marker_ready(self):
        item = self.normalize(LINESTRING_FEATURE, FETCHED_AT)
        assert item["marker_ready"] is False
        assert item["location"]["latitude"] is None
        assert item["location"]["longitude"] is None

    def test_linestring_no_fake_coordinates(self):
        item = self.normalize(LINESTRING_FEATURE, FETCHED_AT)
        assert item["location"]["latitude"] is None
        assert item["location"]["longitude"] is None

    def test_null_geometry_not_marker_ready(self):
        item = self.normalize(NO_GEOMETRY_FEATURE, FETCHED_AT)
        assert item["marker_ready"] is False
        assert item["has_coordinates"] is False

    def test_geometry_type_preserved(self):
        item = self.normalize(POLYGON_FEATURE, FETCHED_AT)
        assert item["location"]["geometry_type"] == "Polygon"
        assert item["provider_metadata"]["geometry_type"] == "Polygon"

    def test_eq_maps_to_earthquake(self):
        item = self.normalize(POINT_FEATURE, FETCHED_AT)
        assert item["subcategory"] == "earthquake"
        assert item["category"] == "disaster"

    def test_tc_maps_to_tropical_cyclone(self):
        item = self.normalize(POLYGON_FEATURE, FETCHED_AT)
        assert item["subcategory"] == "tropical_cyclone"

    def test_fl_maps_to_flood(self):
        item = self.normalize(LINESTRING_FEATURE, FETCHED_AT)
        assert item["subcategory"] == "flood"

    def test_dr_maps_to_drought(self):
        item = self.normalize(NO_TITLE_FEATURE, FETCHED_AT)
        assert item["subcategory"] == "drought"

    def test_wf_maps_to_wildfire(self):
        item = self.normalize(NO_GEOMETRY_FEATURE, FETCHED_AT)
        assert item["subcategory"] == "wildfire"

    def test_alert_orange_is_high(self):
        item = self.normalize(POINT_FEATURE, FETCHED_AT)
        assert item["severity"] == "high"

    def test_alert_red_is_critical(self):
        item = self.normalize(POLYGON_FEATURE, FETCHED_AT)
        assert item["severity"] == "critical"

    def test_alert_green_is_medium(self):
        item = self.normalize(LINESTRING_FEATURE, FETCHED_AT)
        assert item["severity"] == "medium"

    def test_source_id(self):
        item = self.normalize(POINT_FEATURE, FETCHED_AT)
        assert item["source_id"] == "gdacs"

    def test_source_family(self):
        item = self.normalize(POINT_FEATURE, FETCHED_AT)
        assert item["source_family"] == "disaster_alert"

    def test_content_type(self):
        item = self.normalize(POINT_FEATURE, FETCHED_AT)
        assert item["content_type"] == "event"

    def test_title_from_human_readable(self):
        item = self.normalize(POINT_FEATURE, FETCHED_AT)
        assert item["title"] == "M6.1 earthquake near Tokyo"

    def test_title_fallback_with_country(self):
        item = self.normalize(NO_TITLE_FEATURE, FETCHED_AT)
        assert "DRC" in item["title"]
        assert "drought" in item["title"].lower() or "Drought" in item["title"]

    def test_title_fallback_no_country(self):
        feature = {
            "type": "Feature",
            "geometry": None,
            "properties": {"eventtype": "VO", "alertlevel": "Red"},
        }
        item = self.normalize(feature, FETCHED_AT)
        assert "volcano" in item["title"].lower() or "Volcano" in item["title"]

    def test_title_ultimate_fallback(self):
        feature = {"type": "Feature", "geometry": None, "properties": {}}
        item = self.normalize(feature, FETCHED_AT)
        assert item["title"] == "GDACS disaster alert"

    def test_dedupe_key_stable(self):
        item1 = self.normalize(POINT_FEATURE, FETCHED_AT)
        item2 = self.normalize(POINT_FEATURE, "2026-06-12T00:00:00Z")
        assert item1["dedupe_key"] == item2["dedupe_key"]

    def test_dedupe_key_format(self):
        item = self.normalize(POINT_FEATURE, FETCHED_AT)
        assert item["dedupe_key"] == "gdacs:1001:5:EQ"

    def test_missing_eventid_handled(self):
        item = self.normalize(MISSING_EVENTID_FEATURE, FETCHED_AT)
        assert item is not None
        assert item["source_object_id"] is None

    def test_malformed_feature_returns_none(self):
        from layers.layer_08_news_osint.gdacs_normalizer import normalize_gdacs_feature
        result = normalize_gdacs_feature("not a dict", FETCHED_AT)
        assert result is None

    def test_raw_evidence_uri_passed_through(self):
        item = self.normalize(POINT_FEATURE, FETCHED_AT, raw_evidence_uri="/tmp/test.json")
        assert item["raw_evidence_uri"] == "/tmp/test.json"

    def test_fetched_at_in_output(self):
        item = self.normalize(POINT_FEATURE, FETCHED_AT)
        assert item["fetched_at"] == FETCHED_AT

    def test_published_at_from_fromdate(self):
        item = self.normalize(POINT_FEATURE, FETCHED_AT)
        assert item["published_at"] == "2026-06-10T08:00:00Z"

    def test_attribution_present(self):
        item = self.normalize(POINT_FEATURE, FETCHED_AT)
        assert "gdacs.org" in item["attribution"].lower() or "GDACS" in item["attribution"]

    def test_country_name_populated(self):
        item = self.normalize(POINT_FEATURE, FETCHED_AT)
        assert item["location"]["country_name"] == "Japan"


# ---------------------------------------------------------------------------
# normalize_gdacs_payload
# ---------------------------------------------------------------------------

class TestNormalizePayload:
    def setup_method(self):
        from layers.layer_08_news_osint.gdacs_normalizer import normalize_gdacs_payload
        self.normalize_payload = normalize_gdacs_payload

    def _payload(self, features):
        return {"type": "FeatureCollection", "features": features}

    def test_counts_total_features(self):
        result = self.normalize_payload(
            self._payload([POINT_FEATURE, POLYGON_FEATURE, LINESTRING_FEATURE]),
            FETCHED_AT,
        )
        assert result["total_features"] == 3
        assert result["normalized_items"] == 3

    def test_marker_ready_count_point_only(self):
        result = self.normalize_payload(
            self._payload([POINT_FEATURE, POLYGON_FEATURE, LINESTRING_FEATURE]),
            FETCHED_AT,
        )
        assert result["marker_ready_items"] == 1

    def test_geometry_type_counts(self):
        result = self.normalize_payload(
            self._payload([POINT_FEATURE, POLYGON_FEATURE, LINESTRING_FEATURE]),
            FETCHED_AT,
        )
        assert result["geometry_type_counts"]["Point"] == 1
        assert result["geometry_type_counts"]["Polygon"] == 1
        assert result["geometry_type_counts"]["LineString"] == 1

    def test_event_type_counts(self):
        result = self.normalize_payload(
            self._payload([POINT_FEATURE, POLYGON_FEATURE]),
            FETCHED_AT,
        )
        assert result["event_type_counts"]["EQ"] == 1
        assert result["event_type_counts"]["TC"] == 1

    def test_alert_level_counts(self):
        result = self.normalize_payload(
            self._payload([POINT_FEATURE, POLYGON_FEATURE]),
            FETCHED_AT,
        )
        assert result["alert_level_counts"]["Orange"] == 1
        assert result["alert_level_counts"]["Red"] == 1

    def test_empty_payload_no_crash(self):
        result = self.normalize_payload({"features": []}, FETCHED_AT)
        assert result["total_features"] == 0
        assert result["normalized_items"] == 0
        assert result["marker_ready_items"] == 0
        assert result["skipped_items"] == 0

    def test_malformed_feature_counted_as_skipped(self):
        result = self.normalize_payload(
            self._payload(["not_a_dict", POINT_FEATURE]),
            FETCHED_AT,
        )
        assert result["skipped_items"] == 1
        assert result["normalized_items"] == 1

    def test_items_list_present(self):
        result = self.normalize_payload(
            self._payload([POINT_FEATURE]),
            FETCHED_AT,
        )
        assert len(result["items"]) == 1

    def test_no_fake_coords_in_polygon_items(self):
        result = self.normalize_payload(
            self._payload([POLYGON_FEATURE, LINESTRING_FEATURE]),
            FETCHED_AT,
        )
        for item in result["items"]:
            assert item["location"]["latitude"] is None
            assert item["location"]["longitude"] is None


# ---------------------------------------------------------------------------
# gdacs_raw_storage — normalized output
# ---------------------------------------------------------------------------

class TestNormalizedStorage:
    def setup_method(self):
        from layers.layer_08_news_osint import gdacs_raw_storage as storage
        from layers.layer_08_news_osint.gdacs_normalizer import normalize_gdacs_payload
        self.storage = storage
        self.normalize_payload = normalize_gdacs_payload

    def test_save_normalized_events_writes_file(self, tmp_path):
        payload = {"features": [POINT_FEATURE]}
        norm_result = self.normalize_payload(payload, FETCHED_AT)
        run_dir = tmp_path / "run_test"
        path = self.storage.save_normalized_events(run_dir, norm_result)
        assert Path(path).exists()
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        assert isinstance(data, list)
        assert len(data) == 1

    def test_save_normalized_summary_excludes_items(self, tmp_path):
        payload = {"features": [POINT_FEATURE, POLYGON_FEATURE]}
        norm_result = self.normalize_payload(payload, FETCHED_AT)
        run_dir = tmp_path / "run_test"
        path = self.storage.save_normalized_summary(run_dir, norm_result)
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        assert "items" not in data
        assert "normalized_items" in data
        assert "marker_ready_items" in data

    def test_normalized_output_under_tmp(self, tmp_path):
        from datetime import datetime, timezone
        dt = datetime(2026, 6, 11, 12, 0, 0, tzinfo=timezone.utc)
        run_id = self.storage.make_run_id(dt)
        run_dir = self.storage.run_directory(run_id, base=tmp_path, dt=dt)
        assert str(run_dir).startswith(str(tmp_path))
