"""Unit tests for GDELT Event Export fetcher.

No live network calls - uses fixture data only.
"""

from __future__ import annotations

import pytest
from layers.layer_08_news_osint.gdelt_event_export_client import (
    GdeltExportInfo,
    parse_export_urls,
    get_latest_export,
)
from layers.layer_08_news_osint.gdelt_event_export_fetcher import (
    _parse_float,
    _is_valid_coordinate,
    _extract_domain,
    parse_row,
    summarize_rows,
    GdeltEventRow,
)


class TestParseExportUrls:
    """Test parsing of lastupdate.txt content."""

    def test_parses_export_urls(self):
        # Use actual format from lastupdate.txt
        content = b"""20260613111500.export.CSV.zip 12345 20260613111500
20260612180000.export.CSV.zip 23456 20260612180000
"""
        exports = parse_export_urls(content)
        
        assert len(exports) == 2
        assert exports[0].filename == "20260613111500.export.CSV.zip"
        assert exports[1].filename == "20260612180000.export.CSV.zip"

    def test_returns_empty_for_no_exports(self):
        content = b"some other file.txt"
        exports = parse_export_urls(content)
        assert exports == []


class TestGetLatestExport:
    """Test getting latest export."""

    def test_returns_most_recent(self):
        exports = [
            GdeltExportInfo(url="http://example.com/a.zip", filename="20260612180000.export.CSV.zip", timestamp="20260612180000", compressed_size=100),
            GdeltExportInfo(url="http://example.com/b.zip", filename="20260613111500.export.CSV.zip", timestamp="20260613111500", compressed_size=200),
        ]
        latest = get_latest_export(exports)
        assert latest.timestamp == "20260613111500"

    def test_returns_none_for_empty(self):
        latest = get_latest_export([])
        assert latest is None


class TestParseFloat:
    """Test float parsing."""

    def test_parses_valid_float(self):
        assert _parse_float("123.45") == 123.45

    def test_returns_none_for_empty(self):
        assert _parse_float("") is None
        assert _parse_float("   ") is None

    def test_returns_none_for_invalid(self):
        assert _parse_float("abc") is None


class TestIsValidCoordinate:
    """Test coordinate validation."""

    def test_valid_coordinates(self):
        assert _is_valid_coordinate(45.0, -122.0) is True
        assert _is_valid_coordinate(0.0, 0.0) is True
        assert _is_valid_coordinate(-90.0, 180.0) is True

    def test_invalid_latitude(self):
        assert _is_valid_coordinate(91.0, 0.0) is False
        assert _is_valid_coordinate(-91.0, 0.0) is False

    def test_invalid_longitude(self):
        assert _is_valid_coordinate(0.0, 181.0) is False
        assert _is_valid_coordinate(0.0, -181.0) is False

    def test_none_returns_false(self):
        assert _is_valid_coordinate(None, 0.0) is False
        assert _is_valid_coordinate(0.0, None) is False


class TestExtractDomain:
    """Test URL domain extraction."""

    def test_extracts_domain(self):
        assert _extract_domain("https://www.example.com/path") == "www.example.com"
        assert _extract_domain("http://news.bbc.co.uk/") == "news.bbc.co.uk"

    def test_empty_url(self):
        assert _extract_domain("") == ""

    def test_invalid_url(self):
        assert _extract_domain("not-a-url") == ""


def _make_columns(overrides: dict = None) -> list[str]:
    """Helper to create a valid 61-column row."""
    # Default valid row
    cols = [""] * 61
    cols[0] = "1308846926"  # GLOBALEVENTID
    cols[1] = "20250613"    # SQLDATE
    cols[6] = "USA"         # Actor1Name
    cols[16] = "IRAN"       # Actor2Name
    cols[25] = "1"          # IsRootEvent
    cols[26] = "043"        # EventCode (verified correct index)
    cols[27] = "043"        # EventBaseCode
    cols[28] = "04"         # EventRootCode
    cols[29] = "1"          # QuadClass
    cols[30] = "5.0"        # GoldsteinScale
    cols[31] = "10"         # NumMentions
    cols[32] = "1"          # NumSources
    cols[33] = "10"         # NumArticles
    cols[34] = "7.5"        # AvgTone
    cols[44] = "1"          # ActionGeo_Type
    cols[45] = "US"         # ActionGeo_CountryCode
    cols[47] = "United States"  # ActionGeo_FullName
    cols[48] = "37.5"       # ActionGeo_Lat (verified correct index)
    cols[49] = "-122.0"     # ActionGeo_Long (verified correct index)
    cols[59] = "20260613111500"  # DATEADDED
    cols[60] = "https://example.com/article"  # SourceURL
    
    if overrides:
        for k, v in overrides.items():
            cols[k] = v
    return cols


class TestParseRow:
    """Test GDELT row parsing using verified indices."""

    def test_parses_valid_row(self):
        columns = _make_columns()
        
        row = parse_row(columns)
        assert row is not None
        assert row.global_event_id == "1308846926"
        assert row.event_code == "043"
        assert row.action_geo_lat == "37.5"
        assert row.action_geo_long == "-122.0"
        assert row.marker_ready_candidate is True

    def test_returns_none_for_short_row(self):
        columns = ["1308846926", "20250613"]  # Only 2 columns
        row = parse_row(columns)
        assert row is None

    def test_markers_not_ready_without_coords(self):
        columns = _make_columns({
            48: "",  # Empty lat
            49: "",  # Empty lon
        })
        
        row = parse_row(columns)
        assert row is not None
        assert row.marker_ready_candidate is False


class TestSummarizeRows:
    """Test row summarization."""

    def test_summarizes_quadclass(self):
        rows = [
            GdeltEventRow(global_event_id="1", sql_date="20250613", actor1_name="", actor2_name="", event_code="", event_base_code="", event_root_code="",
                         quad_class="1", goldstein_scale="", num_mentions="", num_sources="", num_articles="", avg_tone="", action_geo_full_name="",
                         action_geo_country_code="US", action_geo_lat="45", action_geo_long="-122", source_url="http://x.com", source_domain="x.com", date_added="", 
                         has_action_coordinates=True, marker_ready_candidate=True),
            GdeltEventRow(global_event_id="2", sql_date="20250613", actor1_name="", actor2_name="", event_code="", event_base_code="", event_root_code="",
                         quad_class="4", goldstein_scale="", num_mentions="", num_sources="", num_articles="", avg_tone="", action_geo_full_name="",
                         action_geo_country_code="US", action_geo_lat="45", action_geo_long="-122", source_url="http://x.com", source_domain="x.com", date_added="",
                         has_action_coordinates=True, marker_ready_candidate=True),
            GdeltEventRow(global_event_id="3", sql_date="20250613", actor1_name="", actor2_name="", event_code="", event_base_code="", event_root_code="",
                         quad_class="4", goldstein_scale="", num_mentions="", num_sources="", num_articles="", avg_tone="", action_geo_full_name="",
                         action_geo_country_code="US", action_geo_lat="45", action_geo_long="-122", source_url="http://x.com", source_domain="x.com", date_added="",
                         has_action_coordinates=True, marker_ready_candidate=True),
        ]
        
        summary = summarize_rows(rows)
        
        assert summary["parsed_row_count"] == 3
        assert summary["quadclass_counts"]["1"] == 1
        assert summary["quadclass_counts"]["4"] == 2
        assert summary["marker_ready_candidate_count"] == 3

    def test_summarizes_event_codes(self):
        rows = [
            GdeltEventRow(global_event_id="1", sql_date="20250613", actor1_name="", actor2_name="", event_code="010", event_base_code="", event_root_code="",
                         quad_class="1", goldstein_scale="", num_mentions="", num_sources="", num_articles="", avg_tone="", action_geo_full_name="",
                         action_geo_country_code="US", action_geo_lat="45", action_geo_long="-122", source_url="http://x.com", source_domain="x.com", date_added="",
                         has_action_coordinates=True, marker_ready_candidate=True),
            GdeltEventRow(global_event_id="2", sql_date="20250613", actor1_name="", actor2_name="", event_code="020", event_base_code="", event_root_code="",
                         quad_class="1", goldstein_scale="", num_mentions="", num_sources="", num_articles="", avg_tone="", action_geo_full_name="",
                         action_geo_country_code="US", action_geo_lat="45", action_geo_long="-122", source_url="http://x.com", source_domain="x.com", date_added="",
                         has_action_coordinates=True, marker_ready_candidate=True),
            GdeltEventRow(global_event_id="3", sql_date="20250613", actor1_name="", actor2_name="", event_code="010", event_base_code="", event_root_code="",
                         quad_class="1", goldstein_scale="", num_mentions="", num_sources="", num_articles="", avg_tone="", action_geo_full_name="",
                         action_geo_country_code="US", action_geo_lat="45", action_geo_long="-122", source_url="http://x.com", source_domain="x.com", date_added="",
                         has_action_coordinates=True, marker_ready_candidate=True),
        ]
        
        summary = summarize_rows(rows)
        
        assert summary["top_event_codes"]["010"] == 2
        assert summary["top_event_codes"]["020"] == 1