"""Tests for Layer 07 Weather local proof seed workflow.

Tests do NOT call the live Open-Meteo API or a real database.
Uses hand-written fixtures and mocked connections only.
"""

from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

SRC_DIR = Path(__file__).resolve().parents[3] / "services" / "fetch-orchestrator" / "src"
sys.path.insert(0, str(SRC_DIR))

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _load_fixture(name: str) -> list[dict]:
    return json.loads((FIXTURES_DIR / name).read_text())


class RecordingCursor:
    def __init__(self, connection):
        self.connection = connection

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def execute(self, sql, values=None):
        self.connection.executions.append((sql, values))
        if self.connection.fail_on and self.connection.fail_on in sql:
            raise RuntimeError("forced database failure")

    def fetchone(self):
        if self.connection.fetchone_result is not None:
            return self.connection.fetchone_result
        return (0,)

    def fetchall(self):
        if self.connection.fetchall_result is not None:
            return self.connection.fetchall_result
        return []


class RecordingConnection:
    def __init__(self, fail_on=None, fetchone_result=None, fetchall_result=None):
        self.executions = []
        self.fail_on = fail_on
        self.fetchone_result = fetchone_result
        self.fetchall_result = fetchall_result
        self.commits = 0
        self.rollbacks = 0

    def cursor(self):
        return RecordingCursor(self)

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def close(self):
        pass


# ---------------------------------------------------------------------------
# validate_env
# ---------------------------------------------------------------------------

class TestValidateEnv:
    def test_exits_without_database_url(self):
        from layers.layer_07_weather.weather_local_seed import validate_env
        with patch.dict("os.environ", {}, clear=True):
            with pytest.raises(SystemExit):
                validate_env()

    def test_returns_database_url(self):
        from layers.layer_07_weather.weather_local_seed import validate_env
        with patch.dict("os.environ", {"DATABASE_URL": "postgresql://test:test@localhost/db"}):
            url = validate_env()
            assert url == "postgresql://test:test@localhost/db"

    def test_does_not_expose_password_in_output(self, capsys):
        from layers.layer_07_weather.weather_local_seed import validate_env
        with patch.dict("os.environ", {}, clear=True):
            with pytest.raises(SystemExit):
                validate_env()
        captured = capsys.readouterr()
        assert "secret" not in captured.err.lower()
        assert "password" not in captured.err.lower()


# ---------------------------------------------------------------------------
# connect_to_db
# ---------------------------------------------------------------------------

class TestConnectToDb:
    def test_exits_on_missing_tables(self):
        from layers.layer_07_weather.weather_local_seed import connect_to_db
        conn = RecordingConnection(fetchall_result=[])
        with patch("psycopg2.connect", return_value=conn):
            with pytest.raises(SystemExit):
                connect_to_db("postgresql://test:test@localhost/db")

    def test_exits_on_missing_psycopg2(self):
        from layers.layer_07_weather.weather_local_seed import connect_to_db
        with patch.dict("sys.modules", {"psycopg2": None}):
            with pytest.raises(SystemExit):
                connect_to_db("postgresql://test:test@localhost/db")

    def test_exits_on_connection_failure(self):
        from layers.layer_07_weather.weather_local_seed import connect_to_db
        with patch("psycopg2.connect", side_effect=RuntimeError("connection refused")):
            with pytest.raises(SystemExit):
                connect_to_db("postgresql://test:test@localhost/db")

    def test_success_when_all_tables_exist(self):
        from layers.layer_07_weather.weather_local_seed import connect_to_db
        tables = [
            ("weather_sources",),
            ("weather_locations",),
            ("weather_observations_latest",),
            ("weather_observation_history",),
        ]
        conn = RecordingConnection(fetchall_result=tables, fetchone_result=(1,))
        with patch("psycopg2.connect", return_value=conn):
            result = connect_to_db("postgresql://test:test@localhost/db")
            assert result is conn


# ---------------------------------------------------------------------------
# fetch_proof_data
# ---------------------------------------------------------------------------

class TestFetchProofData:
    def test_fetches_proof_coordinates(self):
        from layers.layer_07_weather.weather_local_seed import fetch_proof_data

        fixture = _load_fixture("sample_multi_response.json")
        mock_resp = {
            "data": fixture,
            "request_meta": {
                "url": "https://mock", "status_code": 200, "elapsed_ms": 100,
                "response_headers": {}, "coordinate_count": 2,
                "batch_index": 0, "current_vars": [], "hourly_vars": [],
                "forecast_days": 1, "fetched_at": "2026-06-10T10:00:00+00:00",
                "attempts": 1,
            },
        }
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch(
                "layers.layer_07_weather.weather_local_seed.fetch_weather_batch",
                return_value=mock_resp,
            ):
                result = fetch_proof_data(1, raw_base=tmpdir)
            assert len(result["batch_data"]) == 2
            assert result["coords"] is not None
            assert len(result["coords"]) == 7

    def test_fetches_proof_coordinates_via_curl(self):
        from layers.layer_07_weather.weather_local_seed import fetch_proof_data

        fixture = _load_fixture("sample_multi_response.json")
        mock_resp = {
            "data": fixture,
            "request_meta": {
                "url": "https://mock", "status_code": 200, "elapsed_ms": 100,
                "response_headers": {}, "coordinate_count": 2,
                "batch_index": 0, "current_vars": [], "hourly_vars": [],
                "forecast_days": 1, "fetched_at": "2026-06-10T10:00:00+00:00",
                "attempts": 1, "fetch_client": "curl",
            },
        }
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch(
                "layers.layer_07_weather.weather_local_seed.fetch_weather_batch_via_curl",
                return_value=mock_resp,
            ):
                result = fetch_proof_data(1, raw_base=tmpdir, fetch_client="curl")
            assert len(result["batch_data"]) == 2
            assert result["request_meta"]["fetch_client"] == "curl"

    def test_proof_mode_uses_7_coordinates(self):
        from layers.layer_07_weather.weather_grid import get_proof_coordinates
        coords = get_proof_coordinates()
        assert len(coords) == 7
        for c in coords:
            assert "latitude" in c
            assert "longitude" in c


# ---------------------------------------------------------------------------
# normalize_data
# ---------------------------------------------------------------------------

class TestNormalizeData:
    def test_normalizes_batch_data(self):
        from layers.layer_07_weather.weather_local_seed import normalize_data

        fixture = _load_fixture("sample_multi_response.json")
        coords = [
            {"latitude": 12.9716, "longitude": 77.5946},
            {"latitude": 51.5074, "longitude": -0.1278},
        ]
        result = normalize_data(fixture, coords)
        assert len(result) == 2
        assert result[0].get("current") is not None
        assert result[0]["current"]["temperature_c"] == 31.4

    def test_current_and_hourly_present(self):
        from layers.layer_07_weather.weather_local_seed import normalize_data

        fixture = _load_fixture("sample_multi_response.json")
        coords = [
            {"latitude": 12.9716, "longitude": 77.5946},
            {"latitude": 51.5074, "longitude": -0.1278},
        ]
        result = normalize_data(fixture, coords)
        for group in result:
            assert "current" in group
            assert "hourly" in group
            if group["current"] is not None:
                assert group["current"]["observation_type"] == "current"
            assert isinstance(group["hourly"], list)


# ---------------------------------------------------------------------------
# ingest_observations (dry-run)
# ---------------------------------------------------------------------------

class TestIngestDryRun:
    def test_dry_run_does_not_write(self):
        from layers.layer_07_weather.weather_local_seed import normalize_data, ingest_observations

        fixture = _load_fixture("sample_multi_response.json")
        coords = [
            {"latitude": 12.9716, "longitude": 77.5946},
            {"latitude": 51.5074, "longitude": -0.1278},
        ]
        normalized = normalize_data(fixture, coords)
        conn = RecordingConnection()
        result = ingest_observations(conn, normalized, dry_run=True)
        assert result["dry_run"] is True
        assert conn.executions == []

    def test_dry_run_returns_count(self):
        from layers.layer_07_weather.weather_local_seed import normalize_data, ingest_observations

        fixture = _load_fixture("sample_multi_response.json")
        coords = [
            {"latitude": 12.9716, "longitude": 77.5946},
            {"latitude": 51.5074, "longitude": -0.1278},
        ]
        normalized = normalize_data(fixture, coords)
        conn = RecordingConnection()
        result = ingest_observations(conn, normalized, dry_run=True)
        assert result["observations_ingested"] == 2


# ---------------------------------------------------------------------------
# full pipeline (mocked)
# ---------------------------------------------------------------------------

class TestFullPipeline:
    def test_full_pipeline_dry_run(self):
        from layers.layer_07_weather.weather_local_seed import main

        fixture = _load_fixture("sample_multi_response.json")
        mock_resp = {
            "data": fixture,
            "request_meta": {
                "url": "https://mock", "status_code": 200, "elapsed_ms": 100,
                "response_headers": {}, "coordinate_count": 2,
                "batch_index": 0, "current_vars": [], "hourly_vars": [],
                "forecast_days": 1, "fetched_at": "2026-06-10T10:00:00+00:00",
                "attempts": 1,
            },
        }

        conn = RecordingConnection(fetchall_result=[
            ("weather_sources",),
            ("weather_locations",),
            ("weather_observations_latest",),
            ("weather_observation_history",),
        ], fetchone_result=(1,))

        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.dict("os.environ", {"DATABASE_URL": "postgresql://test:test@localhost/db"}):
                with patch("psycopg2.connect", return_value=conn):
                    with patch(
                        "layers.layer_07_weather.weather_local_seed.fetch_weather_batch",
                        return_value=mock_resp,
                    ):
                        result = main(["--proof", "--forecast-days", "1", "--dry-run", "--raw-root", tmpdir])
            assert result == 0

    def test_full_pipeline_limit_current_only(self):
        from layers.layer_07_weather.weather_local_seed import main

        fixture = _load_fixture("sample_multi_response.json")
        mock_resp = {
            "data": fixture,
            "request_meta": {
                "url": "https://mock", "status_code": 200, "elapsed_ms": 100,
                "response_headers": {}, "coordinate_count": 2,
                "batch_index": 0, "current_vars": [], "hourly_vars": [],
                "forecast_days": 1, "fetched_at": "2026-06-10T10:00:00+00:00",
                "attempts": 1,
            },
        }

        conn = RecordingConnection(fetchall_result=[
            ("weather_sources",),
            ("weather_locations",),
            ("weather_observations_latest",),
            ("weather_observation_history",),
        ], fetchone_result=(1,))

        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.dict("os.environ", {"DATABASE_URL": "postgresql://test:test@localhost/db"}):
                with patch("psycopg2.connect", return_value=conn):
                    with patch(
                        "layers.layer_07_weather.weather_local_seed.fetch_weather_batch",
                        return_value=mock_resp,
                    ):
                        result = main([
                            "--proof", "--forecast-days", "1", "--dry-run",
                            "--limit-current-only", "--raw-root", tmpdir,
                        ])
            assert result == 0

    def test_full_pipeline_with_curl_client(self):
        from layers.layer_07_weather.weather_local_seed import main

        fixture = _load_fixture("sample_multi_response.json")
        mock_resp = {
            "data": fixture,
            "request_meta": {
                "url": "https://mock", "status_code": 200, "elapsed_ms": 100,
                "response_headers": {}, "coordinate_count": 2,
                "batch_index": 0, "current_vars": [], "hourly_vars": [],
                "forecast_days": 1, "fetched_at": "2026-06-10T10:00:00+00:00",
                "attempts": 1, "fetch_client": "curl",
            },
        }

        conn = RecordingConnection(fetchall_result=[
            ("weather_sources",),
            ("weather_locations",),
            ("weather_observations_latest",),
            ("weather_observation_history",),
        ], fetchone_result=(1,))

        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.dict("os.environ", {"DATABASE_URL": "postgresql://test:test@localhost/db"}):
                with patch("psycopg2.connect", return_value=conn):
                    with patch(
                        "layers.layer_07_weather.weather_local_seed.fetch_weather_batch_via_curl",
                        return_value=mock_resp,
                    ):
                        result = main([
                            "--proof", "--forecast-days", "1", "--dry-run",
                            "--fetch-client", "curl", "--raw-root", tmpdir,
                        ])
            assert result == 0


# ---------------------------------------------------------------------------
# proof mode safety
# ---------------------------------------------------------------------------

class TestProofModeSafety:
    def test_proof_coordinates_are_small_set(self):
        from layers.layer_07_weather.weather_grid import get_proof_coordinates
        coords = get_proof_coordinates()
        assert len(coords) <= 10

    def test_no_full_grid_in_seed_script(self):
        seed_file = SRC_DIR / "layers" / "layer_07_weather" / "weather_local_seed.py"
        source = seed_file.read_text()
        assert "allow_full_grid" not in source
        assert "generate_grid" not in source
        assert "2664" not in source


# ---------------------------------------------------------------------------
# build_parser
# ---------------------------------------------------------------------------

class TestBuildParser:
    def test_proof_flag_default(self):
        from layers.layer_07_weather.weather_local_seed import build_parser
        args = build_parser().parse_args([])
        assert args.proof is True

    def test_forecast_days_default(self):
        from layers.layer_07_weather.weather_local_seed import build_parser
        args = build_parser().parse_args([])
        assert args.forecast_days == 1

    def test_dry_run_flag(self):
        from layers.layer_07_weather.weather_local_seed import build_parser
        args = build_parser().parse_args(["--dry-run"])
        assert args.dry_run is True

    def test_keep_raw_flag(self):
        from layers.layer_07_weather.weather_local_seed import build_parser
        args = build_parser().parse_args(["--keep-raw"])
        assert args.keep_raw is True

    def test_skip_fetch_flag(self):
        from layers.layer_07_weather.weather_local_seed import build_parser
        args = build_parser().parse_args(["--skip-fetch"])
        assert args.skip_fetch is True

    def test_limit_current_only_flag(self):
        from layers.layer_07_weather.weather_local_seed import build_parser
        args = build_parser().parse_args(["--limit-current-only"])
        assert args.limit_current_only is True

    def test_raw_root_default(self):
        from layers.layer_07_weather.weather_local_seed import build_parser
        args = build_parser().parse_args([])
        assert args.raw_root == "raw"

    def test_fetch_client_default(self):
        from layers.layer_07_weather.weather_local_seed import build_parser
        args = build_parser().parse_args([])
        assert args.fetch_client == "urllib"

    def test_fetch_client_curl(self):
        from layers.layer_07_weather.weather_local_seed import build_parser
        args = build_parser().parse_args(["--fetch-client", "curl"])
        assert args.fetch_client == "curl"

    def test_fetch_client_invalid(self):
        from layers.layer_07_weather.weather_local_seed import build_parser
        with pytest.raises(SystemExit):
            build_parser().parse_args(["--fetch-client", "invalid"])


# ---------------------------------------------------------------------------
# load_raw_data
# ---------------------------------------------------------------------------

class TestLoadRawData:
    def test_exits_when_no_raw_dir(self):
        from layers.layer_07_weather.weather_local_seed import load_raw_data
        with tempfile.TemporaryDirectory() as tmpdir:
            with pytest.raises(SystemExit):
                load_raw_data(tmpdir)

    def test_loads_existing_batch(self):
        from layers.layer_07_weather.weather_local_seed import load_raw_data

        fixture = _load_fixture("sample_multi_response.json")
        with tempfile.TemporaryDirectory() as tmpdir:
            raw_base = Path(tmpdir) / "layer_07_weather" / "open-meteo" / "2026" / "06" / "10" / "run_test"
            batches_dir = raw_base / "batches"
            batches_dir.mkdir(parents=True)
            (batches_dir / "batch_001.json").write_text(json.dumps(fixture))

            result = load_raw_data(tmpdir)
            assert len(result["batch_data"]) == 2
            assert result["run_id"] == "run_test"
