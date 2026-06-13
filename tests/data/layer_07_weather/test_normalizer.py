"""Tests for Layer 07 Weather normalizer modules.

Tests do NOT call the live Open-Meteo API.
Uses hand-written fixtures only.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

SRC_DIR = Path(__file__).resolve().parents[3] / "services" / "fetch-orchestrator" / "src"
sys.path.insert(0, str(SRC_DIR))

FIXTURES_DIR = Path(__file__).parent / "fixtures"

# Reuse existing fixtures
SINGLE = json.loads((FIXTURES_DIR / "sample_single_response.json").read_text())
MULTI = json.loads((FIXTURES_DIR / "sample_multi_response.json").read_text())

PROOF_COORD = {"latitude": 12.9716, "longitude": 77.5946}
PROOF_COORD_2 = {"latitude": 51.5074, "longitude": -0.1278}


# ---------------------------------------------------------------------------
# weather_codes
# ---------------------------------------------------------------------------

class TestWeatherCodes:
    def setup_method(self):
        from layers.layer_07_weather.weather_codes import get_weather_label, WMO_CODES
        self.get_weather_label = get_weather_label
        self.WMO_CODES = WMO_CODES

    def test_known_codes_mapped(self):
        expected = {
            0: "Clear Sky", 1: "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast",
            45: "Foggy", 48: "Depositing Rime Fog",
            51: "Light Drizzle", 53: "Moderate Drizzle", 55: "Dense Drizzle",
            61: "Slight Rain", 63: "Moderate Rain", 65: "Heavy Rain",
            71: "Slight Snow Fall", 75: "Heavy Snow Fall", 77: "Snow Grains",
            80: "Slight Rain Showers", 82: "Violent Rain Showers",
            95: "Thunderstorm", 96: "Thunderstorm with Slight Hail",
            99: "Thunderstorm with Heavy Hail",
        }
        for code, label in expected.items():
            assert self.get_weather_label(code) == label

    def test_all_required_codes_present(self):
        required = [0,1,2,3,45,48,51,53,55,56,57,61,63,65,66,67,
                    71,73,75,77,80,81,82,85,86,95,96,99]
        for code in required:
            assert code in self.WMO_CODES, f"Missing WMO code: {code}"

    def test_unknown_code_returns_unknown(self):
        result = self.get_weather_label(999)
        assert result == "Unknown"

    def test_none_returns_none(self):
        assert self.get_weather_label(None) is None

    def test_zero_returns_clear_sky(self):
        assert self.get_weather_label(0) == "Clear Sky"


# ---------------------------------------------------------------------------
# build_location_id / build_observation_id
# ---------------------------------------------------------------------------

class TestIDGeneration:
    def setup_method(self):
        from layers.layer_07_weather.weather_normalizer import (
            build_location_id, build_observation_id,
        )
        self.build_location_id = build_location_id
        self.build_observation_id = build_observation_id

    def test_location_id_is_16_chars(self):
        lid = self.build_location_id(12.9716, 77.5946)
        assert len(lid) == 16

    def test_location_id_is_deterministic(self):
        a = self.build_location_id(12.9716, 77.5946)
        b = self.build_location_id(12.9716, 77.5946)
        assert a == b

    def test_location_id_differs_for_different_coords(self):
        a = self.build_location_id(12.9716, 77.5946)
        b = self.build_location_id(51.5074, -0.1278)
        assert a != b

    def test_location_id_differs_for_different_resolution(self):
        a = self.build_location_id(10.0, 20.0, "5deg")
        b = self.build_location_id(10.0, 20.0, "2.5deg")
        assert a != b

    def test_observation_id_is_24_chars(self):
        lid = self.build_location_id(12.9716, 77.5946)
        oid = self.build_observation_id(lid, "open-meteo", "2026-06-10T15:00")
        assert len(oid) == 24

    def test_observation_id_is_deterministic(self):
        lid = self.build_location_id(12.9716, 77.5946)
        a = self.build_observation_id(lid, "open-meteo", "2026-06-10T15:00")
        b = self.build_observation_id(lid, "open-meteo", "2026-06-10T15:00")
        assert a == b

    def test_observation_id_differs_for_different_time(self):
        lid = self.build_location_id(12.9716, 77.5946)
        a = self.build_observation_id(lid, "open-meteo", "2026-06-10T15:00")
        b = self.build_observation_id(lid, "open-meteo", "2026-06-10T16:00")
        assert a != b


# ---------------------------------------------------------------------------
# extract_provider_metadata
# ---------------------------------------------------------------------------

class TestProviderMetadata:
    def setup_method(self):
        from layers.layer_07_weather.weather_normalizer import extract_provider_metadata
        self.extract = extract_provider_metadata

    def test_location_id_preserved(self):
        meta = self.extract(SINGLE)
        assert meta["location_id"] == SINGLE["location_id"]

    def test_timezone_preserved(self):
        meta = self.extract(SINGLE)
        assert meta["timezone"] == "Asia/Kolkata"

    def test_utc_offset_preserved(self):
        meta = self.extract(SINGLE)
        assert meta["utc_offset_seconds"] == 19800

    def test_generationtime_preserved(self):
        meta = self.extract(SINGLE)
        assert "generationtime_ms" in meta

    def test_elevation_preserved(self):
        meta = self.extract(SINGLE)
        assert meta["elevation"] == 910.0

    def test_current_units_preserved(self):
        meta = self.extract(SINGLE)
        assert "current_units" in meta

    def test_hourly_units_preserved(self):
        meta = self.extract(SINGLE)
        assert "hourly_units" in meta


# ---------------------------------------------------------------------------
# normalize_current_observation
# ---------------------------------------------------------------------------

class TestCurrentNormalization:
    def setup_method(self):
        from layers.layer_07_weather.weather_normalizer import normalize_current_observation
        self.normalize = normalize_current_observation

    def test_returns_dict_for_valid_item(self):
        obs = self.normalize(SINGLE, PROOF_COORD, fetched_at="2026-06-10T10:00:00Z")
        assert obs is not None
        assert isinstance(obs, dict)

    def test_required_fields_present(self):
        obs = self.normalize(SINGLE, PROOF_COORD, fetched_at="2026-06-10T10:00:00Z")
        for field in ("observation_id", "location_id", "layer_id", "source_id",
                      "forecast_for", "temperature_c", "requested_latitude",
                      "requested_longitude", "resolved_latitude", "resolved_longitude"):
            assert field in obs, f"Missing field: {field}"

    def test_requested_vs_resolved_coords_separate(self):
        obs = self.normalize(SINGLE, PROOF_COORD, fetched_at="2026-06-10T10:00:00Z")
        assert obs["requested_latitude"] == PROOF_COORD["latitude"]
        assert obs["requested_longitude"] == PROOF_COORD["longitude"]
        assert obs["resolved_latitude"] == SINGLE["latitude"]
        assert obs["resolved_longitude"] == SINGLE["longitude"]

    def test_temperature_mapped(self):
        obs = self.normalize(SINGLE, PROOF_COORD, fetched_at="2026-06-10T10:00:00Z")
        assert obs["temperature_c"] == SINGLE["current"]["temperature_2m"]

    def test_weather_code_and_label(self):
        obs = self.normalize(SINGLE, PROOF_COORD, fetched_at="2026-06-10T10:00:00Z")
        assert obs["weather_code"] == 2
        assert obs["weather_label"] == "Partly Cloudy"

    def test_precipitation_probability_is_none(self):
        obs = self.normalize(SINGLE, PROOF_COORD, fetched_at="2026-06-10T10:00:00Z")
        assert obs["precipitation_probability_percent"] is None

    def test_surface_pressure_in_provider_metadata(self):
        obs = self.normalize(SINGLE, PROOF_COORD, fetched_at="2026-06-10T10:00:00Z")
        assert "surface_pressure_hpa" in obs["provider_metadata"]
        assert obs["provider_metadata"]["surface_pressure_hpa"] == SINGLE["current"]["surface_pressure"]

    def test_location_id_in_provider_metadata(self):
        obs = self.normalize(SINGLE, PROOF_COORD, fetched_at="2026-06-10T10:00:00Z")
        assert obs["provider_metadata"]["location_id"] == SINGLE["location_id"]

    def test_raw_evidence_uri_preserved(self):
        obs = self.normalize(SINGLE, PROOF_COORD, raw_evidence_uri="raw/test/batch_001.json",
                             fetched_at="2026-06-10T10:00:00Z")
        assert obs["raw_evidence_uri"] == "raw/test/batch_001.json"

    def test_observation_type_is_current(self):
        obs = self.normalize(SINGLE, PROOF_COORD, fetched_at="2026-06-10T10:00:00Z")
        assert obs["observation_type"] == "current"

    def test_returns_none_when_no_current_block(self):
        item = {k: v for k, v in SINGLE.items() if k != "current"}
        obs = self.normalize(item, PROOF_COORD, fetched_at="2026-06-10T10:00:00Z")
        assert obs is None

    def test_layer_id_and_source_id(self):
        obs = self.normalize(SINGLE, PROOF_COORD, fetched_at="2026-06-10T10:00:00Z")
        assert obs["layer_id"] == "layer_07_weather"
        assert obs["source_id"] == "open-meteo"


# ---------------------------------------------------------------------------
# normalize_hourly_observations
# ---------------------------------------------------------------------------

class TestHourlyNormalization:
    def setup_method(self):
        from layers.layer_07_weather.weather_normalizer import normalize_hourly_observations
        self.normalize = normalize_hourly_observations

    def test_returns_list(self):
        obs_list = self.normalize(SINGLE, PROOF_COORD, fetched_at="2026-06-10T10:00:00Z")
        assert isinstance(obs_list, list)

    def test_one_observation_per_hour(self):
        obs_list = self.normalize(SINGLE, PROOF_COORD, fetched_at="2026-06-10T10:00:00Z")
        assert len(obs_list) == 3  # fixture has 3 hourly timestamps

    def test_hourly_observation_has_required_fields(self):
        obs = self.normalize(SINGLE, PROOF_COORD, fetched_at="2026-06-10T10:00:00Z")[0]
        for field in ("observation_id", "location_id", "forecast_for", "temperature_c",
                      "requested_latitude", "requested_longitude"):
            assert field in obs

    def test_hourly_precipitation_probability_present(self):
        obs = self.normalize(SINGLE, PROOF_COORD, fetched_at="2026-06-10T10:00:00Z")[0]
        assert obs["precipitation_probability_percent"] == 10

    def test_hourly_surface_pressure_in_metadata(self):
        obs = self.normalize(SINGLE, PROOF_COORD, fetched_at="2026-06-10T10:00:00Z")[0]
        assert "surface_pressure_hpa" in obs["provider_metadata"]

    def test_observation_type_is_hourly(self):
        obs = self.normalize(SINGLE, PROOF_COORD, fetched_at="2026-06-10T10:00:00Z")[0]
        assert obs["observation_type"] == "hourly"

    def test_empty_list_when_no_hourly_block(self):
        item = {k: v for k, v in SINGLE.items() if k != "hourly"}
        result = self.normalize(item, PROOF_COORD, fetched_at="2026-06-10T10:00:00Z")
        assert result == []

    def test_none_values_in_hourly_array_skipped(self):
        item = json.loads(json.dumps(SINGLE))  # deep copy
        item["hourly"]["temperature_2m"] = [None, 21.8, 21.4]
        result = self.normalize(item, PROOF_COORD, fetched_at="2026-06-10T10:00:00Z")
        # First slot skipped (temperature_c None), remaining 2 returned
        assert len(result) == 2

    def test_different_observation_ids_per_hour(self):
        obs_list = self.normalize(SINGLE, PROOF_COORD, fetched_at="2026-06-10T10:00:00Z")
        ids = [o["observation_id"] for o in obs_list]
        assert len(set(ids)) == len(ids)


# ---------------------------------------------------------------------------
# normalize_open_meteo_batch
# ---------------------------------------------------------------------------

class TestBatchNormalization:
    def setup_method(self):
        from layers.layer_07_weather.weather_normalizer import normalize_open_meteo_batch
        self.normalize_batch = normalize_open_meteo_batch

    def test_multi_coord_batch(self):
        coords = [PROOF_COORD, PROOF_COORD_2]
        results = self.normalize_batch(MULTI, coords, fetched_at="2026-06-10T10:00:00Z")
        assert len(results) == 2

    def test_each_result_has_current_and_hourly(self):
        coords = [PROOF_COORD, PROOF_COORD_2]
        results = self.normalize_batch(MULTI, coords, fetched_at="2026-06-10T10:00:00Z")
        for r in results:
            assert "current" in r
            assert "hourly" in r

    def test_requested_coords_preserved_per_item(self):
        coords = [PROOF_COORD, PROOF_COORD_2]
        results = self.normalize_batch(MULTI, coords, fetched_at="2026-06-10T10:00:00Z")
        assert results[0]["current"]["requested_latitude"] == PROOF_COORD["latitude"]
        assert results[1]["current"]["requested_latitude"] == PROOF_COORD_2["latitude"]

    def test_location_ids_differ_per_coord(self):
        coords = [PROOF_COORD, PROOF_COORD_2]
        results = self.normalize_batch(MULTI, coords, fetched_at="2026-06-10T10:00:00Z")
        lid0 = results[0]["current"]["location_id"]
        lid1 = results[1]["current"]["location_id"]
        assert lid0 != lid1

    def test_raw_evidence_uri_propagated(self):
        coords = [PROOF_COORD]
        results = self.normalize_batch([SINGLE], coords,
                                       raw_evidence_uri="raw/batch_001.json",
                                       fetched_at="2026-06-10T10:00:00Z")
        assert results[0]["current"]["raw_evidence_uri"] == "raw/batch_001.json"

    def test_no_network_calls(self):
        """Normalizer must not make any network calls."""
        import urllib.request
        original = urllib.request.urlopen
        called = []
        def fake_open(*a, **kw):
            called.append(True)
            return original(*a, **kw)
        urllib.request.urlopen = fake_open
        try:
            coords = [PROOF_COORD]
            from layers.layer_07_weather.weather_normalizer import normalize_open_meteo_batch
            normalize_open_meteo_batch([SINGLE], coords, fetched_at="2026-06-10T10:00:00Z")
        finally:
            urllib.request.urlopen = original
        assert not called, "Normalizer must not make network calls"

    def test_no_api_key_needed(self):
        normalizer_file = SRC_DIR / "layers" / "layer_07_weather" / "weather_normalizer.py"
        source = normalizer_file.read_text()
        assert "api_key" not in source.lower()
        assert "os.environ" not in source

    def test_no_database_writes(self):
        """No DB-related imports in normalizer."""
        normalizer_file = SRC_DIR / "layers" / "layer_07_weather" / "weather_normalizer.py"
        source = normalizer_file.read_text()
        for forbidden in ("psycopg", "sqlalchemy", "sqlite3", "INSERT INTO", "cursor.execute"):
            assert forbidden not in source, f"Forbidden DB reference: {forbidden}"


# ---------------------------------------------------------------------------
# normalize_raw_batch_file
# ---------------------------------------------------------------------------

class TestNormalizeRawBatchFile:
    def test_loads_and_normalizes_single_fixture(self):
        from layers.layer_07_weather.weather_normalizer import normalize_raw_batch_file
        results = normalize_raw_batch_file(
            FIXTURES_DIR / "sample_single_response.json",
            [PROOF_COORD],
            fetched_at="2026-06-10T10:00:00Z",
        )
        assert len(results) == 1
        assert results[0]["current"] is not None

    def test_loads_and_normalizes_multi_fixture(self):
        from layers.layer_07_weather.weather_normalizer import normalize_raw_batch_file
        coords = [PROOF_COORD, PROOF_COORD_2]
        results = normalize_raw_batch_file(
            FIXTURES_DIR / "sample_multi_response.json",
            coords,
            fetched_at="2026-06-10T10:00:00Z",
        )
        assert len(results) == 2
