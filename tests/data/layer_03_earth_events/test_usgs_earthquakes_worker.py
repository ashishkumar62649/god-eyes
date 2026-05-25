"""Tests for USGS Earth Events fetcher (WO-072)."""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT / "services" / "fetch-orchestrator" / "src" / "layers" / "layer_03_earth_events"))

# Import after path setup
from usgs_earthquakes_worker import (
    validate_geojson,
    normalize_usgs_feature,
    LAYER_ID,
    SOURCE_ID,
)


FIXTURE_PATH = REPO_ROOT / "tests" / "data" / "layer_03_earth_events" / "fixtures" / "usgs_earthquake_feature.json"


def load_fixture() -> dict:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def test_validate_geojson_valid():
    data = {"type": "FeatureCollection", "features": []}
    assert validate_geojson(data) is True


def test_validate_geojson_missing_type():
    data = {"features": []}
    assert validate_geojson(data) is False


def test_validate_geojson_wrong_type():
    data = {"type": "Feature", "features": []}
    assert validate_geojson(data) is False


def test_validate_geojson_missing_features():
    data = {"type": "FeatureCollection"}
    assert validate_geojson(data) is False


def test_normalize_usgs_feature_valid():
    feature = load_fixture()
    result = normalize_usgs_feature(feature)

    assert result is not None
    assert result["layer_id"] == LAYER_ID
    assert result["source_id"] == SOURCE_ID
    assert result["source_object_id"] == "pr2025145000"
    assert result["event_type"] == "earthquake"
    assert result["magnitude"] == 4.5
    assert result["magnitude_type"] == "md"
    assert result["depth_km"] == 32.41
    assert result["place"] == "54km NNE of Cruz Bay, U.S. Virgin Islands"
    assert result["alert_level"] == "green"
    assert result["significance"] == 312
    assert result["tsunami"] is False
    assert "POINT" in result["geometry_wkt"]
    assert result["source_url"] == "https://earthquake.usgs.gov/earthquakes/eventpage/pr2025145000"
    assert result["properties_json"]["title"] == "M 4.5 - 54km NNE of Cruz Bay, U.S. Virgin Islands"


def test_normalize_usgs_feature_missing_geometry():
    feature = {
        "type": "Feature",
        "properties": {"mag": 4.5, "place": "Test", "time": 1748164800000},
        "id": "test123"
    }
    result = normalize_usgs_feature(feature)
    assert result is None


def test_normalize_usgs_feature_empty_coords():
    feature = {
        "type": "Feature",
        "properties": {"mag": 4.5, "place": "Test", "time": 1748164800000},
        "geometry": {"type": "Point", "coordinates": []},
        "id": "test123"
    }
    result = normalize_usgs_feature(feature)
    assert result is None


def test_dry_run_does_not_write(monkeypatch, capsys):
    """Test that dry-run mode processes data without DB writes.
    
    Note: This test makes a real network call to USGS (intentional for
    testing integration). In dry-run mode, no DB writes should occur.
    """
    import sys
    from pathlib import Path as PathLib
    import importlib

    REPO_ROOT = PathLib(__file__).resolve().parents[3]
    sys.path.insert(0, str(REPO_ROOT / "services" / "fetch-orchestrator" / "src" / "layers" / "layer_03_earth_events"))
    from usgs_earthquakes_worker import run_fetcher

    # Dry-run mode should not write to DB - just verify it processes
    result = run_fetcher(dry_run=True, show_raw=False)
    
    # Verify we got data (real network call succeeds)
    assert result["features_fetched"] > 0
    assert result["features_normalized"] > 0
    # In dry-run mode, nothing is written
    assert result["written_latest"] == 0
    assert result["written_history"] == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])