"""Unit tests for GDELT Event Export normalizer.

No live network calls - uses fixture data only.
"""

from __future__ import annotations

import pytest
from datetime import datetime, timezone
from layers.layer_08_news_osint.gdelt_event_export_normalizer import (
    normalize_gdelt_row,
    normalize_gdelt_payload,
    _map_category,
    _map_subcategory,
    _map_severity,
    _map_quadclass_to_label,
    _validate_coordinates,
    SOURCE_ID,
    SOURCE_FAMILY,
    LAYER_ID,
)


class TestMapCategory:
    """Test QuadClass to category mapping."""

    def test_maps_quadclass_1(self):
        assert _map_category("1") == "diplomacy"

    def test_maps_quadclass_2(self):
        assert _map_category("2") == "cooperation"

    def test_maps_quadclass_3(self):
        assert _map_category("3") == "conflict"

    def test_maps_quadclass_4(self):
        assert _map_category("4") == "conflict"

    def test_unknown_for_empty(self):
        assert _map_category("") == "unknown"
        assert _map_category(None) == "unknown"

    def test_unknown_for_invalid(self):
        assert _map_category("99") == "unknown"


class TestMapSubcategory:
    """Test EventRootCode to subcategory mapping."""

    def test_maps_root_code_01(self):
        assert _map_subcategory("010") == "statement"
        assert _map_subcategory("01") == "statement"

    def test_maps_root_code_04(self):
        assert _map_subcategory("042") == "consultation"

    def test_maps_root_code_19(self):
        assert _map_subcategory("190") == "fight"

    def test_unknown_for_empty(self):
        assert _map_subcategory("") == "unknown"
        assert _map_subcategory(None) == "unknown"


class TestMapSeverity:
    """Test severity mapping."""

    def test_quadclass_4_is_high(self):
        assert _map_severity("4", None) == "high"

    def test_quadclass_3_is_medium(self):
        assert _map_severity("3", None) == "medium"

    def test_eventroot_20_is_critical(self):
        assert _map_severity("4", "200") == "critical"

    def test_eventroot_18_is_high(self):
        assert _map_severity("4", "180") == "high"

    def test_unknown_for_empty(self):
        assert _map_severity("", None) == "unknown"


class TestValidateCoordinates:
    """Test coordinate validation."""

    def test_valid_coordinates(self):
        valid, lat, lon = _validate_coordinates("45.5", "-122.6")
        assert valid is True
        assert lat == 45.5
        assert lon == -122.6

    def test_invalid_latitude(self):
        valid, lat, lon = _validate_coordinates("91.0", "0.0")
        assert valid is False
        assert lat is None

    def test_invalid_longitude(self):
        valid, lat, lon = _validate_coordinates("45.0", "181.0")
        assert valid is False
        assert lon is None

    def test_empty_returns_false(self):
        valid, lat, lon = _validate_coordinates("", "")
        assert valid is False

    def test_invalid_string_returns_false(self):
        valid, lat, lon = _validate_coordinates("abc", "123")
        assert valid is False


def _make_row(overrides: dict = None) -> dict:
    """Helper to create a valid GDELT row dict."""
    row = {
        "global_event_id": "1308846926",
        "sql_date": "20250613",
        "actor1_name": "USA",
        "actor2_name": "IRAN",
        "event_code": "043",
        "event_base_code": "043",
        "event_root_code": "04",
        "quad_class": "3",
        "goldstein_scale": "5.0",
        "num_mentions": "10",
        "num_sources": "1",
        "num_articles": "10",
        "avg_tone": "7.5",
        "action_geo_type": "1",
        "action_geo_full_name": "United States",
        "action_geo_country_code": "US",
        "action_geo_lat": "45.5",
        "action_geo_long": "-122.6",
        "source_url": "https://example.com/article",
        "source_domain": "example.com",
        "date_added": "20260613111500",
    }
    if overrides:
        row.update(overrides)
    return row


class TestNormalizeGdeltRow:
    """Test row normalization."""

    def test_normalizes_marker_ready_row(self):
        row = _make_row()
        result = normalize_gdelt_row(row)
        
        assert result["source_id"] == SOURCE_ID
        assert result["source_family"] == SOURCE_FAMILY
        assert result["layer_id"] == LAYER_ID
        assert result["source_event_id"] == "1308846926"
        assert result["dedupe_key"] == "gdelt_event_export:1308846926"
        assert result["category"] == "conflict"
        assert result["subcategory"] == "consultation"
        assert result["severity"] == "medium"
        assert result["marker_ready"] is True
        assert result["latitude"] == 45.5
        assert result["longitude"] == -122.6
        assert result["has_coordinates"] is True

    def test_normalizes_list_only_row(self):
        row = _make_row({
            "action_geo_lat": "",
            "action_geo_long": "",
        })
        result = normalize_gdelt_row(row)
        
        assert result["marker_ready"] is False
        assert result["latitude"] is None
        assert result["longitude"] is None
        assert result["has_coordinates"] is False

    def test_invalid_coords_become_list_only(self):
        row = _make_row({
            "action_geo_lat": "200.0",  # Invalid lat
            "action_geo_long": "-122.6",
        })
        result = normalize_gdelt_row(row)
        
        assert result["marker_ready"] is False
        assert result["latitude"] is None

    def test_title_includes_actors(self):
        row = _make_row()
        result = normalize_gdelt_row(row)
        
        assert "USA" in result["title"]
        assert "IRAN" in result["title"]

    def test_provider_metadata_preserved(self):
        row = _make_row()
        result = normalize_gdelt_row(row)
        
        pm = result["provider_metadata"]
        assert pm["global_event_id"] == "1308846926"
        assert pm["event_code"] == "043"
        assert pm["actor1_name"] == "USA"

    def test_dedupe_key_stable(self):
        row = _make_row({"global_event_id": "12345"})
        result1 = normalize_gdelt_row(row)
        result2 = normalize_gdelt_row(row)
        
        assert result1["dedupe_key"] == result2["dedupe_key"]
        assert result1["dedupe_key"] == "gdelt_event_export:12345"

    def test_source_url_domain_preserved(self):
        row = _make_row()
        result = normalize_gdelt_row(row)
        
        assert result["source_url"] == "https://example.com/article"
        assert result["source_domain"] == "example.com"


class TestNormalizeGdeltPayload:
    """Test batch normalization."""

    def test_normalizes_batch(self):
        rows = [
            _make_row({"global_event_id": "1", "quad_class": "1"}),
            _make_row({"global_event_id": "2", "quad_class": "4"}),
            _make_row({"global_event_id": "3", "quad_class": "3", "action_geo_lat": "", "action_geo_long": ""}),
        ]
        result = normalize_gdelt_payload(rows)
        
        assert result["raw_row_count"] == 3
        assert result["normalized_count"] == 3
        assert result["marker_ready_count"] == 2  # 2 have coords
        assert result["list_only_count"] == 1

    def test_counts_categories(self):
        rows = [
            _make_row({"global_event_id": "1", "quad_class": "1"}),
            _make_row({"global_event_id": "2", "quad_class": "1"}),
            _make_row({"global_event_id": "3", "quad_class": "4"}),
        ]
        result = normalize_gdelt_payload(rows)
        
        assert result["category_counts"]["diplomacy"] == 2
        assert result["category_counts"]["conflict"] == 1

    def test_counts_severity(self):
        rows = [
            _make_row({"global_event_id": "1", "quad_class": "1"}),
            _make_row({"global_event_id": "2", "quad_class": "4"}),  # high
        ]
        result = normalize_gdelt_payload(rows)
        
        assert result["severity_counts"]["low"] == 1
        assert result["severity_counts"]["high"] == 1