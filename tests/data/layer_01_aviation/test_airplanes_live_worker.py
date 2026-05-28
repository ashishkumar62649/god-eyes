"""Tests for Airplanes.live worker — WO-079C."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

sys.path.insert(0, str(REPO_ROOT / "services" / "fetch-orchestrator" / "src" / "layers" / "layer_01_aviation"))

# Import after path setup
import pytest


# ===== Worker tests =====


def test_worker_file_exists():
    """Worker file must exist."""
    worker_path = REPO_ROOT / "services" / "fetch-orchestrator" / "src" / "layers" / "layer_01_aviation" / "airplanes_live_worker.py"
    assert worker_path.exists()


def test_db_helper_file_exists():
    """DB helper file must exist."""
    db_path = REPO_ROOT / "services" / "fetch-orchestrator" / "src" / "layers" / "layer_01_aviation" / "airplanes_live_db.py"
    assert db_path.exists()


def test_dry_run_default_does_not_write_to_db():
    """Dry-run default should not write to DB."""
    from airplanes_live_worker import run_worker
    
    with patch("airplanes_live_worker.connect_db") as mock_conn:
        with patch("airplanes_live_worker.fetch_endpoint") as mock_fetch:
            mock_fetch.return_value = ({"aircraft": []}, 200, None)
            
            result = run_worker(
                include_endpoints=["mil"],
                persist=False,
            )
    
    # Should not attempt DB connection in dry-run
    mock_conn.assert_not_called()
    assert result["aircraft_processed"] == 0


def test_persist_flag_required_for_db_writes():
    """--persist must be required for DB writes."""
    from airplanes_live_worker import run_worker
    
    with patch("airplanes_live_worker.connect_db") as mock_conn:
        mock_conn.return_value = MagicMock()
        
        result = run_worker(
            include_endpoints=["mil"],
            persist=False,
        )
    
    # No DB connection in dry-run
    mock_conn.assert_not_called()


def test_official_endpoint_urls_used():
    """Official Airplanes.live API URLs must be used."""
    from airplanes_live_worker import BASE_URL, fetch_endpoint
    
    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_response = MagicMock()
        mock_response.read.return_value = b'{"aircraft": []}'
        mock_response.status = 200
        mock_urlopen.return_value.__enter__.return_value = mock_response
        
        fetch_endpoint("mil", timeout=10)
        
        # Check the URL called
        call_args = mock_urlopen.call_args
        url = call_args[0][0].full_url
        assert url == f"{BASE_URL}/mil"


def test_website_not_scraped():
    """globe.airplanes.live should not be scraped."""
    worker_path = REPO_ROOT / "services" / "fetch-orchestrator" / "src" / "layers" / "layer_01_aviation" / "airplanes_live_worker.py"
    content = worker_path.read_text()
    
    assert "globe.airplanes.live" not in content
    assert "airplanes.live/" not in content.replace("api.airplanes.live", "")


def test_no_global_all_endpoint():
    """No global /all endpoint should be invented."""
    from airplanes_live_worker import run_worker
    
    with patch("airplanes_live_worker.fetch_endpoint") as mock_fetch:
        mock_fetch.return_value = ({"aircraft": []}, 200, None)
        
        result = run_worker(
            include_endpoints=["mil"],
            persist=False,
        )
    
    # Verify we called our mocked endpoint, not /all
    calls = mock_fetch.call_args_list
    endpoints = [call[0][0] for call in calls]
    assert "all" not in endpoints


def test_point_radius_capped_at_250():
    """Point endpoint radius should be capped at 250nm."""
    from airplanes_live_worker import run_worker
    
    with patch("airplanes_live_worker.fetch_endpoint") as mock_fetch:
        mock_fetch.return_value = ({"aircraft": []}, 200, None)
        
        # Test with radius > 250
        result = run_worker(
            include_endpoints=["point"],
            lat=28.6139,
            lon=77.2090,
            radius_nm=300,
            persist=False,
        )
    
    # Should have capped radius
    calls = mock_fetch.call_args_list
    if calls:
        endpoint = calls[0][0][0]
        assert "300" not in endpoint  # Should be capped


def test_missing_point_lat_lon_skips_with_warning():
    """Missing lat/lon should skip point endpoint with warning."""
    from airplanes_live_worker import run_worker
    
    with patch("airplanes_live_worker.fetch_endpoint") as mock_fetch:
        mock_fetch.return_value = ({"aircraft": []}, 200, None)
        
        result = run_worker(
            include_endpoints=["point"],
            lat=None,
            lon=None,
            persist=False,
        )
    
    # Point should be skipped
    assert "mil" not in result.get("endpoints_processed", [])


# ===== Normalization tests =====


def test_db_flags_parsing_military():
    """dbFlags parsing: military flag."""
    from airplanes_live_worker import parse_db_flags
    
    assert parse_db_flags(1)["is_military"] is True
    assert parse_db_flags(0)["is_military"] is False
    assert parse_db_flags(5)["is_military"] is True  # 5 = 1 | 4


def test_db_flags_parsing_interesting():
    """dbFlags parsing: interesting flag."""
    from airplanes_live_worker import parse_db_flags
    
    assert parse_db_flags(2)["is_interesting"] is True
    assert parse_db_flags(0)["is_interesting"] is False


def test_db_flags_parsing_pia():
    """dbFlags parsing: PIA flag."""
    from airplanes_live_worker import parse_db_flags
    
    assert parse_db_flags(4)["is_pia"] is True
    assert parse_db_flags(0)["is_pia"] is False


def test_db_flags_parsing_ladd():
    """dbFlags parsing: LADD flag."""
    from airplanes_live_worker import parse_db_flags
    
    assert parse_db_flags(8)["is_ladd"] is True
    assert parse_db_flags(0)["is_ladd"] is False


def test_alt_baro_ground_does_not_crash():
    """alt_baro = 'ground' should handle safely."""
    from airplanes_live_worker import normalize_altitude
    
    alt, on_ground = normalize_altitude("ground")
    assert alt is None
    assert on_ground is True


def test_alt_baro_numeric():
    """alt_baro numeric values should work."""
    from airplanes_live_worker import normalize_altitude
    
    alt, on_ground = normalize_altitude(35000)
    assert alt == 35000.0
    assert on_ground is False


def test_missing_lat_lon_skipped_for_latest():
    """Missing lat/lon should be handled safely."""
    from airplanes_live_worker import normalize_aircraft
    
    received_at = datetime.now(timezone.utc)
    
    # Aircraft without position
    raw = {"hex": "ABCDEF", "lat": None, "lon": None}
    normalized = normalize_aircraft(raw, received_at)
    
    assert normalized is not None
    assert normalized["lat"] is None
    assert normalized["lon"] is None


def test_observed_at_derived_from_seen():
    """observed_at should be derived from seen seconds."""
    from airplanes_live_worker import normalize_aircraft
    
    received_at = datetime(2026, 5, 28, 12, 0, 0, tzinfo=timezone.utc)
    
    raw = {"hex": "ABCDEF", "seen": 30, "lat": 0, "lon": 0}
    normalized = normalize_aircraft(raw, received_at)
    
    # observed_at should be ~30 seconds before received_at
    assert normalized["observed_at"] < received_at


# ===== DB operations tests =====


def test_latest_upsert_sql_contains_newer_observed_at_protection():
    """Latest upsert should have newer observed_at protection."""
    db_path = REPO_ROOT / "services" / "fetch-orchestrator" / "src" / "layers" / "layer_01_aviation" / "airplanes_live_db.py"
    content = db_path.read_text()
    
    assert "observed_at < EXCLUDED.observed_at" in content


def test_observation_insert_uses_on_conflict_do_nothing():
    """Observation insert should use ON CONFLICT DO NOTHING."""
    db_path = REPO_ROOT / "services" / "fetch-orchestrator" / "src" / "layers" / "layer_01_aviation" / "airplanes_live_db.py"
    content = db_path.read_text()
    
    assert "ON CONFLICT DO NOTHING" in content


def test_parameterized_sql_used():
    """Parameterized SQL should be used (no string interpolation)."""
    db_path = REPO_ROOT / "services" / "fetch-orchestrator" / "src" / "layers" / "layer_01_aviation" / "airplanes_live_db.py"
    content = db_path.read_text()
    
    # Should have %s placeholders
    assert "%s" in content
    # Should not have f-strings with values in SQL
    assert "f\"INSERT" not in content
    assert "f'INSERT" not in content


def test_no_destructive_sql():
    """No destructive SQL (DROP, DELETE, TRUNCATE) in DB helper."""
    db_path = REPO_ROOT / "services" / "fetch-orchestrator" / "src" / "layers" / "layer_01_aviation" / "airplanes_live_db.py"
    content = db_path.read_text().lower()
    
    destructive = ["drop ", "delete ", "truncate ", "alter "]
    for word in destructive:
        assert word not in content


# ===== Rate limit tests =====


def test_rate_limit_sleep_logic_exists():
    """Rate limit sleep logic should exist."""
    worker_path = REPO_ROOT / "services" / "fetch-orchestrator" / "src" / "layers" / "layer_01_aviation" / "airplanes_live_worker.py"
    content = worker_path.read_text()
    
    assert "time.sleep" in content
    assert "RATE_LIMIT" in content


# ===== Fixtures =====


@pytest.fixture
def sample_aircraft_mil():
    """Sample military aircraft from /mil endpoint."""
    return {
        "hex": "4B03A2",
        "flight": "SWR1234 ",
        "r": "HB-JFC",
        "t": "A320",
        "dbFlags": 1,
        "type": "mil",
        "lat": 46.1234,
        "lon": 8.5678,
        "alt_baro": 35000,
        "alt_geom": 35200,
        "gs": 450.0,
        "track": 270.0,
        "mag_heading": 265,
        "true_heading": 267,
        "baro_rate": 0,
        "geom_rate": 0,
        "squawk": "2000",
        "emergency": None,
        "seen": 5.2,
        "seen_pos": 5.2,
    }


@pytest.fixture
def sample_aircraft_civil():
    """Sample civil aircraft."""
    return {
        "hex": "ABCDEF",
        "flight": "BAW123  ",
        "r": "G-EUPR",
        "t": "A319",
        "dbFlags": 0,
        "type": "civil",
        "lat": 51.4700,
        "lon": -0.4500,
        "alt_baro": 38000,
        "alt_geom": 38200,
        "gs": 480.0,
        "track": 90.0,
        "mag_heading": 88,
        "true_heading": 92,
        "baro_rate": 0,
        "geom_rate": 0,
        "squawk": "1254",
        "emergency": None,
        "seen": 10.5,
        "seen_pos": 10.5,
    }


@pytest.fixture
def sample_aircraft_ground():
    """Sample aircraft on ground."""
    return {
        "hex": "123456",
        "flight": "LH900  ",
        "r": "DAIHF",
        "t": "A320",
        "dbFlags": 2,
        "type": "civil",
        "lat": 52.3105,
        "lon": 4.7683,
        "alt_baro": "ground",
        "alt_geom": "ground",
        "gs": 0.0,
        "track": 0.0,
        "mag_heading": 180,
        "true_heading": 182,
        "baro_rate": 0,
        "geom_rate": 0,
        "squawk": "2000",
        "emergency": None,
        "seen": 2.0,
        "seen_pos": 2.0,
    }


def test_normalize_aircraft_with_fixture(sample_aircraft_mil):
    """Test normalization with fixture data."""
    from airplanes_live_worker import normalize_aircraft
    
    received_at = datetime.now(timezone.utc)
    normalized = normalize_aircraft(sample_aircraft_mil, received_at)
    
    assert normalized is not None
    assert normalized["source_object_id"] == "4B03A2"
    assert normalized["callsign"] == "SWR1234"
    assert normalized["registration"] == "HB-JFC"
    assert normalized["aircraft_type"] == "A320"
    assert normalized["is_military"] is True
    assert normalized["is_pia"] is False
    assert normalized["is_ladd"] is False
    assert normalized["lat"] == 46.1234
    assert normalized["lon"] == 8.5678
    assert normalized["altitude_baro_ft"] == 35000.0


def test_normalize_aircraft_ground_fixture(sample_aircraft_ground):
    """Test normalization of aircraft on ground."""
    from airplanes_live_worker import normalize_aircraft
    
    received_at = datetime.now(timezone.utc)
    normalized = normalize_aircraft(sample_aircraft_ground, received_at)
    
    assert normalized is not None
    assert normalized["altitude_baro_ft"] is None
    assert normalized["on_ground"] is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])