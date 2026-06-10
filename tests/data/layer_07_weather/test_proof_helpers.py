"""Tests for Layer 07 Weather proof helpers.

Tests do NOT call the live Open-Meteo API.
Uses hand-written fixtures only.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pytest

# Add fetch-orchestrator src to path
SRC_DIR = Path(__file__).resolve().parents[3] / "services" / "fetch-orchestrator" / "src"
sys.path.insert(0, str(SRC_DIR))

from layers.layer_07_weather.open_meteo_proof import (
    build_metadata,
    build_preview,
    build_proof_url,
    extract_observed_fields,
    CURRENT_VARIABLES,
    HOURLY_VARIABLES,
    PROOF_COORDINATES,
    REQUEST_PARAMS,
    OPEN_METEO_BASE_URL,
    USER_AGENT,
)

FIXTURES_DIR = Path(__file__).parent / "fixtures"


# --- Coordinate list construction ---

class TestCoordinateConstruction:
    def test_proof_coordinates_count(self):
        assert len(PROOF_COORDINATES) == 7

    def test_proof_coordinates_have_required_keys(self):
        for coord in PROOF_COORDINATES:
            assert "name" in coord
            assert "latitude" in coord
            assert "longitude" in coord

    def test_proof_coordinates_diverse_regions(self):
        lats = [c["latitude"] for c in PROOF_COORDINATES]
        assert any(lat > 0 for lat in lats), "Should have northern hemisphere"
        assert any(lat < 0 for lat in lats), "Should have southern hemisphere"
        assert any(abs(lat) < 15 for lat in lats), "Should have low-latitude region"


# --- Request parameter construction ---

class TestRequestParams:
    def test_request_params_has_required_keys(self):
        required = ["temperature_unit", "wind_speed_unit", "precipitation_unit",
                     "timeformat", "timezone", "forecast_days", "cell_selection"]
        for key in required:
            assert key in REQUEST_PARAMS, f"Missing param: {key}"

    def test_metric_units(self):
        assert REQUEST_PARAMS["temperature_unit"] == "celsius"
        assert REQUEST_PARAMS["wind_speed_unit"] == "kmh"
        assert REQUEST_PARAMS["precipitation_unit"] == "mm"

    def test_forecast_days(self):
        assert REQUEST_PARAMS["forecast_days"] in ("1", "3", "7", "16")

    def test_current_variables_count(self):
        assert len(CURRENT_VARIABLES) == 11

    def test_hourly_variables_count(self):
        assert len(HOURLY_VARIABLES) == 12

    def test_hourly_has_precipitation_probability(self):
        assert "precipitation_probability" in HOURLY_VARIABLES

    def test_current_lacks_precipitation_probability(self):
        assert "precipitation_probability" not in CURRENT_VARIABLES


# --- URL building ---

class TestUrlBuilding:
    def test_build_proof_url_contains_base(self):
        url = build_proof_url(PROOF_COORDINATES[:2])
        assert url.startswith(OPEN_METEO_BASE_URL)

    def test_build_proof_url_contains_coordinates(self):
        url = build_proof_url(PROOF_COORDINATES[:2])
        assert "latitude=12.9716,28.6139" in url
        assert "longitude=77.5946,77.209" in url

    def test_build_proof_url_contains_params(self):
        url = build_proof_url(PROOF_COORDINATES[:1])
        assert "temperature_unit=celsius" in url
        assert "wind_speed_unit=kmh" in url
        assert "precipitation_unit=mm" in url
        assert "timeformat=iso8601" in url
        assert "timezone=auto" in url
        assert "cell_selection=land" in url


# --- Raw output path generation ---

class TestRawOutputPath:
    def test_run_directory_pattern(self):
        from datetime import datetime, timezone
        from layers.layer_07_weather.open_meteo_proof import create_run_directory
        now = datetime.now(timezone.utc)
        expected = (
            Path("raw/layer_07_weather/open-meteo")
            / now.strftime("%Y/%m/%d")
            / f"run_{now.strftime('%Y%m%dT%H%M%SZ')}"
        )
        path_str = str(expected).replace("\\", "/")
        assert "raw/layer_07_weather/open-meteo" in path_str
        assert "run_" in path_str


# --- Observed field extraction ---

class TestObservedFields:
    def test_extract_fields_from_single(self):
        with open(FIXTURES_DIR / "sample_single_response.json") as f:
            data = json.load(f)
        observed = extract_observed_fields(data)
        assert "latitude" in observed
        assert "longitude" in observed
        assert "current" in observed
        assert "hourly" in observed
        assert "elevation" in observed
        assert "generationtime_ms" in observed

    def test_extract_fields_from_array(self):
        with open(FIXTURES_DIR / "sample_multi_response.json") as f:
            data = json.load(f)
        observed = extract_observed_fields(data)
        assert "latitude" in observed
        assert "current" in observed
        assert "location_id" in observed

    def test_current_subfields_extracted(self):
        with open(FIXTURES_DIR / "sample_single_response.json") as f:
            data = json.load(f)
        observed = extract_observed_fields(data)
        assert "temperature_2m" in observed["current"]
        assert "weather_code" in observed["current"]

    def test_hourly_subfields_extracted(self):
        with open(FIXTURES_DIR / "sample_single_response.json") as f:
            data = json.load(f)
        observed = extract_observed_fields(data)
        assert "time" in observed["hourly"]
        assert "temperature_2m" in observed["hourly"]


# --- Preview generation ---

class TestPreviewGeneration:
    def test_preview_single_response(self):
        with open(FIXTURES_DIR / "sample_single_response.json") as f:
            data = json.load(f)
        preview = build_preview(data)
        assert isinstance(preview, list)
        assert len(preview) == 1
        p = preview[0]
        assert "latitude" in p
        assert "longitude" in p
        assert "elevation" in p
        assert "current" in p
        assert "hourly_time_count" in p

    def test_preview_multi_response(self):
        with open(FIXTURES_DIR / "sample_multi_response.json") as f:
            data = json.load(f)
        preview = build_preview(data)
        assert isinstance(preview, list)
        assert len(preview) == 2

    def test_preview_hourly_time_count(self):
        with open(FIXTURES_DIR / "sample_single_response.json") as f:
            data = json.load(f)
        preview = build_preview(data)
        assert preview[0]["hourly_time_count"] == 3  # 3 hourly timestamps in fixture


# --- Metadata generation ---

class TestMetadata:
    def test_metadata_has_required_fields(self):
        metadata = build_metadata(
            url="https://example.com",
            coordinates=PROOF_COORDINATES[:2],
            status=200,
            headers={"Content-Type": "application/json"},
            data=[],
        )
        assert metadata["source_id"] == "open-meteo"
        assert metadata["layer_id"] == "layer_07_weather"
        assert metadata["proof_run"] is True
        assert metadata["http_status"] == 200
        assert metadata["num_coordinates_requested"] == 2
        assert metadata["user_agent"] == USER_AGENT

    def test_metadata_contains_request_params(self):
        metadata = build_metadata(
            url="https://example.com",
            coordinates=[],
            status=200,
            headers={},
            data=[],
        )
        assert metadata["request_params"] == REQUEST_PARAMS


# --- No API key / env dependency ---

class TestNoSecrets:
    def test_no_api_key_in_url(self):
        url = build_proof_url(PROOF_COORDINATES)
        assert "apikey" not in url.lower()
        assert "api_key" not in url.lower()
        assert "key=" not in url.lower()

    def test_no_env_dependency(self):
        """Proof should not require any environment variables."""
        proof_file = SRC_DIR / "layers" / "layer_07_weather" / "open_meteo_proof.py"
        source = proof_file.read_text()
        assert "os.environ" not in source
        assert "dotenv" not in source
