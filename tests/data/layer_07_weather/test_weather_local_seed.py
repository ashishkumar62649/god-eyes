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
    def _make_mock_resp(self, fixture, current_only=False):
        return {
            "data": fixture,
            "request_meta": {
                "url": "https://mock", "status_code": 200, "elapsed_ms": 100,
                "response_headers": {}, "coordinate_count": 2,
                "batch_index": 0,
                "current_vars": [],
                "hourly_vars": [],
                "forecast_days": None if current_only else 1,
                "fetched_at": "2026-06-10T10:00:00+00:00",
                "attempts": 1,
                **({"current_only": True} if current_only else {}),
            },
        }

    def test_fetches_proof_coordinates(self):
        from layers.layer_07_weather.weather_local_seed import fetch_proof_data
        fixture = _load_fixture("sample_multi_response.json")
        mock_resp = self._make_mock_resp(fixture)
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch(
                "layers.layer_07_weather.weather_local_seed.fetch_weather_batch",
                return_value=mock_resp,
            ):
                result = fetch_proof_data(1, raw_base=tmpdir)
            assert len(result["batch_data"]) == 2
            assert len(result["coords"]) == 7

    def test_fetches_proof_coordinates_via_curl(self):
        from layers.layer_07_weather.weather_local_seed import fetch_proof_data
        fixture = _load_fixture("sample_multi_response.json")
        mock_resp = self._make_mock_resp(fixture)
        mock_resp["request_meta"]["fetch_client"] = "curl"
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch(
                "layers.layer_07_weather.weather_local_seed.fetch_weather_batch_via_curl",
                return_value=mock_resp,
            ):
                result = fetch_proof_data(1, raw_base=tmpdir, fetch_client="curl")
            assert len(result["batch_data"]) == 2
            assert result["request_meta"]["fetch_client"] == "curl"

    def test_current_only_uses_current_only_fetch(self):
        """--current-only mode routes to fetch_weather_current_only, not fetch_weather_batch."""
        from layers.layer_07_weather.weather_local_seed import fetch_proof_data
        fixture = _load_fixture("sample_multi_response.json")
        mock_resp = self._make_mock_resp(fixture, current_only=True)
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch(
                "layers.layer_07_weather.weather_local_seed.fetch_weather_current_only",
                return_value=mock_resp,
            ) as mock_current:
                with patch(
                    "layers.layer_07_weather.weather_local_seed.fetch_weather_batch"
                ) as mock_batch:
                    result = fetch_proof_data(1, raw_base=tmpdir, current_only=True)
            mock_current.assert_called_once()
            mock_batch.assert_not_called()
            assert result["request_meta"].get("current_only") is True

    def test_current_only_curl_uses_current_only_curl_fetch(self):
        """--current-only --fetch-client curl routes to fetch_weather_current_only_via_curl."""
        from layers.layer_07_weather.weather_local_seed import fetch_proof_data
        fixture = _load_fixture("sample_multi_response.json")
        mock_resp = self._make_mock_resp(fixture, current_only=True)
        mock_resp["request_meta"]["fetch_client"] = "curl"
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch(
                "layers.layer_07_weather.weather_local_seed.fetch_weather_current_only_via_curl",
                return_value=mock_resp,
            ) as mock_curl:
                with patch(
                    "layers.layer_07_weather.weather_local_seed.fetch_weather_batch_via_curl"
                ) as mock_batch_curl:
                    fetch_proof_data(1, raw_base=tmpdir, fetch_client="curl", current_only=True)
            mock_curl.assert_called_once()
            mock_batch_curl.assert_not_called()

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


# ---------------------------------------------------------------------------
# ingest_observations
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
        # Count = 2 current + however many hourly slots the fixture contains
        current_count = sum(1 for g in normalized if g.get("current") is not None)
        hourly_count = sum(len(g.get("hourly", [])) for g in normalized)
        assert result["observations_ingested"] == current_count + hourly_count

    def test_current_only_dry_run_returns_only_current_count(self):
        """current_only=True, dry_run=True returns count of current obs only."""
        from layers.layer_07_weather.weather_local_seed import normalize_data, ingest_observations
        fixture = _load_fixture("sample_multi_response.json")
        coords = [
            {"latitude": 12.9716, "longitude": 77.5946},
            {"latitude": 51.5074, "longitude": -0.1278},
        ]
        normalized = normalize_data(fixture, coords)
        conn = RecordingConnection()
        # Verify fixture has hourly data to ensure current_only actually filters
        has_hourly = any(len(g.get("hourly", [])) > 0 for g in normalized)
        result_all = ingest_observations(conn, normalized, dry_run=True, current_only=False)
        result_current = ingest_observations(conn, normalized, dry_run=True, current_only=True)
        if has_hourly:
            assert result_current["observations_ingested"] < result_all["observations_ingested"]
        # Always: current_only result <= total
        assert result_current["observations_ingested"] <= result_all["observations_ingested"]
        assert result_current["dry_run"] is True


# ---------------------------------------------------------------------------
# current-only payload validation
# ---------------------------------------------------------------------------

class TestCurrentOnlyPayload:
    def test_current_only_url_has_no_hourly_param(self):
        """_build_url_current_only must not include hourly= in the URL."""
        from layers.layer_07_weather.open_meteo_client import _build_url_current_only
        url = _build_url_current_only([10.0], [20.0])
        assert "hourly=" not in url

    def test_current_only_url_has_no_forecast_days(self):
        """_build_url_current_only must not include forecast_days in the URL."""
        from layers.layer_07_weather.open_meteo_client import _build_url_current_only
        url = _build_url_current_only([10.0], [20.0])
        assert "forecast_days" not in url

    def test_current_only_url_has_current_param(self):
        from layers.layer_07_weather.open_meteo_client import _build_url_current_only
        url = _build_url_current_only([10.0], [20.0])
        assert "current=" in url

    def test_proof_current_variables_within_approved_list(self):
        """PROOF_CURRENT_VARIABLES must be a subset of the approved 10-variable list."""
        from layers.layer_07_weather.open_meteo_client import PROOF_CURRENT_VARIABLES
        approved = {
            "temperature_2m", "apparent_temperature", "relative_humidity_2m",
            "surface_pressure", "precipitation", "cloud_cover",
            "weather_code", "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m",
        }
        for var in PROOF_CURRENT_VARIABLES:
            assert var in approved, f"Unexpected variable in PROOF_CURRENT_VARIABLES: {var}"

    def test_proof_current_variables_timezone_utc(self):
        """Current-only URL must use timezone=UTC."""
        from layers.layer_07_weather.open_meteo_client import _build_url_current_only
        url = _build_url_current_only([10.0], [20.0])
        assert "timezone=UTC" in url

    def test_current_only_request_meta_marks_current_only(self):
        """fetch_weather_current_only request_meta must include current_only=True."""
        import urllib.request
        from io import BytesIO
        from unittest.mock import MagicMock
        from layers.layer_07_weather.open_meteo_client import fetch_weather_current_only

        data = {"current": {"time": "2026-06-11T10:00", "temperature_2m": 25.0}}
        body = json.dumps(data).encode()
        mock_resp = MagicMock()
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)
        mock_resp.status = 200
        mock_resp.headers = {}
        mock_resp.read.return_value = body

        with patch("urllib.request.urlopen", return_value=mock_resp):
            result = fetch_weather_current_only([10.0], [20.0])

        assert result["request_meta"]["current_only"] is True
        assert result["request_meta"]["hourly_vars"] == []
        assert result["request_meta"]["forecast_days"] is None

    def test_current_only_via_curl_request_meta_marks_current_only(self):
        """fetch_weather_current_only_via_curl request_meta must include current_only=True."""
        from layers.layer_07_weather.open_meteo_client import fetch_weather_current_only_via_curl

        data = {"current": {"time": "2026-06-11T10:00", "temperature_2m": 25.0}}
        stdout_body = json.dumps(data)

        with patch("subprocess.run") as mock_run:
            mock_result = MagicMock()
            mock_result.returncode = 0
            mock_result.stdout = f"{stdout_body}\n200"
            mock_result.stderr = ""
            mock_run.return_value = mock_result

            with patch(
                "layers.layer_07_weather.open_meteo_client._find_curl_executable",
                return_value="curl.exe",
            ):
                result = fetch_weather_current_only_via_curl([10.0], [20.0])

        assert result["request_meta"]["current_only"] is True
        assert result["request_meta"]["hourly_vars"] == []
        assert result["request_meta"]["forecast_days"] is None


# ---------------------------------------------------------------------------
# full pipeline (mocked)
# ---------------------------------------------------------------------------

class TestFullPipeline:
    def _mock_resp(self, fixture, current_only=False):
        return {
            "data": fixture,
            "request_meta": {
                "url": "https://mock", "status_code": 200, "elapsed_ms": 100,
                "response_headers": {}, "coordinate_count": 2,
                "batch_index": 0, "current_vars": [], "hourly_vars": [],
                "forecast_days": None if current_only else 1,
                "fetched_at": "2026-06-10T10:00:00+00:00",
                "attempts": 1,
                **({"current_only": True} if current_only else {}),
            },
        }

    def _tables_conn(self):
        return RecordingConnection(fetchall_result=[
            ("weather_sources",),
            ("weather_locations",),
            ("weather_observations_latest",),
            ("weather_observation_history",),
        ], fetchone_result=(1,))

    def test_full_pipeline_dry_run(self):
        from layers.layer_07_weather.weather_local_seed import main
        fixture = _load_fixture("sample_multi_response.json")
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.dict("os.environ", {"DATABASE_URL": "postgresql://test:test@localhost/db"}):
                with patch("psycopg2.connect", return_value=self._tables_conn()):
                    with patch(
                        "layers.layer_07_weather.weather_local_seed.fetch_weather_batch",
                        return_value=self._mock_resp(fixture),
                    ):
                        result = main(["--proof", "--forecast-days", "1", "--dry-run", "--raw-root", tmpdir])
            assert result == 0

    def test_full_pipeline_current_only_dry_run(self):
        """--current-only --dry-run must return 0 and use current-only fetch."""
        from layers.layer_07_weather.weather_local_seed import main
        fixture = _load_fixture("sample_multi_response.json")
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.dict("os.environ", {"DATABASE_URL": "postgresql://test:test@localhost/db"}):
                with patch("psycopg2.connect", return_value=self._tables_conn()):
                    with patch(
                        "layers.layer_07_weather.weather_local_seed.fetch_weather_current_only",
                        return_value=self._mock_resp(fixture, current_only=True),
                    ) as mock_current:
                        with patch(
                            "layers.layer_07_weather.weather_local_seed.fetch_weather_batch"
                        ) as mock_batch:
                            result = main(["--proof", "--current-only", "--dry-run", "--raw-root", tmpdir])
            assert result == 0
            mock_current.assert_called_once()
            mock_batch.assert_not_called()

    def test_full_pipeline_current_only_curl_dry_run(self):
        """--current-only --fetch-client curl --dry-run must use curl current-only fetch."""
        from layers.layer_07_weather.weather_local_seed import main
        fixture = _load_fixture("sample_multi_response.json")
        mock_r = self._mock_resp(fixture, current_only=True)
        mock_r["request_meta"]["fetch_client"] = "curl"
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.dict("os.environ", {"DATABASE_URL": "postgresql://test:test@localhost/db"}):
                with patch("psycopg2.connect", return_value=self._tables_conn()):
                    with patch(
                        "layers.layer_07_weather.weather_local_seed.fetch_weather_current_only_via_curl",
                        return_value=mock_r,
                    ) as mock_curl:
                        with patch(
                            "layers.layer_07_weather.weather_local_seed.fetch_weather_batch_via_curl"
                        ) as mock_batch_curl:
                            result = main([
                                "--proof", "--current-only", "--dry-run",
                                "--fetch-client", "curl", "--raw-root", tmpdir,
                            ])
            assert result == 0
            mock_curl.assert_called_once()
            mock_batch_curl.assert_not_called()

    def test_full_pipeline_with_curl_client(self):
        from layers.layer_07_weather.weather_local_seed import main
        fixture = _load_fixture("sample_multi_response.json")
        mock_r = self._mock_resp(fixture)
        mock_r["request_meta"]["fetch_client"] = "curl"
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.dict("os.environ", {"DATABASE_URL": "postgresql://test:test@localhost/db"}):
                with patch("psycopg2.connect", return_value=self._tables_conn()):
                    with patch(
                        "layers.layer_07_weather.weather_local_seed.fetch_weather_batch_via_curl",
                        return_value=mock_r,
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

    def test_current_only_flag(self):
        from layers.layer_07_weather.weather_local_seed import build_parser
        args = build_parser().parse_args(["--current-only"])
        assert args.current_only is True

    def test_current_only_default_is_false(self):
        from layers.layer_07_weather.weather_local_seed import build_parser
        args = build_parser().parse_args([])
        assert args.current_only is False

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

    def test_no_limit_current_only_flag(self):
        """Old --limit-current-only flag must no longer exist."""
        from layers.layer_07_weather.weather_local_seed import build_parser
        with pytest.raises(SystemExit):
            build_parser().parse_args(["--limit-current-only"])


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
