"""Tests for Layer 07 Weather fetcher modules.

Tests do NOT call the live Open-Meteo API.
Uses hand-written fixtures and mocked responses only.
"""

from __future__ import annotations

import json
import sys
import tempfile
import urllib.error
from io import BytesIO
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

SRC_DIR = Path(__file__).resolve().parents[3] / "services" / "fetch-orchestrator" / "src"
sys.path.insert(0, str(SRC_DIR))

FIXTURES_DIR = Path(__file__).parent / "fixtures"


# ---------------------------------------------------------------------------
# weather_grid
# ---------------------------------------------------------------------------

class TestWeatherGrid:
    def setup_method(self):
        from layers.layer_07_weather.weather_grid import (
            generate_grid, batch_coordinates, grid_summary, get_proof_coordinates,
        )
        self.generate_grid = generate_grid
        self.batch_coordinates = batch_coordinates
        self.grid_summary = grid_summary
        self.get_proof_coordinates = get_proof_coordinates

    def test_5deg_grid_coordinate_count(self):
        coords = self.generate_grid(spacing=5)
        # lat: -90..90 step 5 = 37; lon: -180..180 step 5 = 73; total = 37*73 = 2701
        # (range includes both endpoints)
        assert len(coords) > 2500

    def test_grid_is_deterministic(self):
        a = self.generate_grid(spacing=5)
        b = self.generate_grid(spacing=5)
        assert a == b

    def test_grid_coordinate_validity(self):
        for c in self.generate_grid(spacing=10):
            assert -90 <= c["latitude"] <= 90
            assert -180 <= c["longitude"] <= 180

    def test_grid_has_latitude_longitude_keys(self):
        coord = self.generate_grid(spacing=5)[0]
        assert "latitude" in coord
        assert "longitude" in coord

    def test_grid_ordering_stable(self):
        coords = self.generate_grid(spacing=10)
        lats = [c["latitude"] for c in coords[:10]]
        # first row should all be same lat
        assert all(l == lats[0] for l in lats[:len([c for c in coords if c["latitude"] == lats[0]])])

    def test_batch_size_50(self):
        coords = self.generate_grid(spacing=5)
        batches = self.batch_coordinates(coords, batch_size=50)
        assert all(len(b) <= 50 for b in batches)
        assert sum(len(b) for b in batches) == len(coords)

    def test_batch_size_25(self):
        coords = self.generate_grid(spacing=5)
        batches = self.batch_coordinates(coords, batch_size=25)
        assert all(len(b) <= 25 for b in batches)

    def test_batch_size_100(self):
        coords = self.generate_grid(spacing=5)
        batches = self.batch_coordinates(coords, batch_size=100)
        assert all(len(b) <= 100 for b in batches)

    def test_grid_summary_returns_expected_keys(self):
        s = self.grid_summary(spacing=5, batch_size=50)
        assert "total_coordinates" in s
        assert "batch_count" in s
        assert "planned_requests" in s

    def test_grid_summary_batch_count(self):
        s = self.grid_summary(spacing=5, batch_size=50)
        import math
        assert s["batch_count"] == math.ceil(s["total_coordinates"] / 50)

    def test_proof_coordinates_count(self):
        proof = self.get_proof_coordinates()
        assert len(proof) == 7

    def test_proof_coordinates_have_lat_lon(self):
        for c in self.get_proof_coordinates():
            assert "latitude" in c
            assert "longitude" in c


# ---------------------------------------------------------------------------
# open_meteo_client — parameter construction (no network)
# ---------------------------------------------------------------------------

class TestClientParams:
    def setup_method(self):
        from layers.layer_07_weather.open_meteo_client import (
            _build_url, USER_AGENT, CURRENT_VARIABLES, HOURLY_VARIABLES,
            BASE_URL, DEFAULT_PARAMS,
        )
        self._build_url = _build_url
        self.USER_AGENT = USER_AGENT
        self.CURRENT_VARIABLES = CURRENT_VARIABLES
        self.HOURLY_VARIABLES = HOURLY_VARIABLES
        self.BASE_URL = BASE_URL
        self.DEFAULT_PARAMS = DEFAULT_PARAMS

    def test_url_starts_with_base(self):
        url = self._build_url([10.0], [20.0], self.CURRENT_VARIABLES, self.HOURLY_VARIABLES, 3)
        assert url.startswith(self.BASE_URL)

    def test_url_contains_cell_selection_land(self):
        url = self._build_url([10.0], [20.0], self.CURRENT_VARIABLES, self.HOURLY_VARIABLES, 3)
        assert "cell_selection=land" in url

    def test_url_contains_forecast_days(self):
        url = self._build_url([10.0], [20.0], self.CURRENT_VARIABLES, self.HOURLY_VARIABLES, 3)
        assert "forecast_days=3" in url

    def test_user_agent_value(self):
        assert self.USER_AGENT == "GOD-EYES-weather-fetcher/0.1"

    def test_no_api_key_in_url(self):
        url = self._build_url([10.0], [20.0], self.CURRENT_VARIABLES, self.HOURLY_VARIABLES, 3)
        assert "apikey" not in url.lower()
        assert "api_key" not in url.lower()
        assert "key=" not in url.lower()

    def test_full_fetch_forecast_days_default(self):
        """Default forecast_days for full fetch is 3."""
        from layers.layer_07_weather.open_meteo_client import fetch_weather_batch
        import inspect
        sig = inspect.signature(fetch_weather_batch)
        assert sig.parameters["forecast_days"].default == 3

    def test_proof_forecast_days_1_allowed(self):
        url = self._build_url([10.0], [20.0], self.CURRENT_VARIABLES, self.HOURLY_VARIABLES, 1)
        assert "forecast_days=1" in url

    def test_no_env_dependency(self):
        client_file = SRC_DIR / "layers" / "layer_07_weather" / "open_meteo_client.py"
        source = client_file.read_text()
        assert "os.environ" not in source
        assert "dotenv" not in source


# ---------------------------------------------------------------------------
# open_meteo_client — retry/mock behavior
# ---------------------------------------------------------------------------

class TestClientRetry:
    def _mock_response(self, data, status=200):
        body = json.dumps(data).encode()
        mock = MagicMock()
        mock.__enter__ = lambda s: s
        mock.__exit__ = MagicMock(return_value=False)
        mock.status = status
        mock.headers = {"Content-Type": "application/json"}
        mock.read.return_value = body
        return mock

    def test_successful_fetch_returns_data(self):
        fixture = json.loads((FIXTURES_DIR / "sample_multi_response.json").read_text())
        with patch("urllib.request.urlopen", return_value=self._mock_response(fixture)):
            from layers.layer_07_weather.open_meteo_client import fetch_weather_batch
            result = fetch_weather_batch([12.9, 51.5], [77.5, -0.1])
        assert "data" in result
        assert "request_meta" in result
        assert result["request_meta"]["coordinate_count"] == 2

    def test_user_agent_sent(self):
        fixture = json.loads((FIXTURES_DIR / "sample_multi_response.json").read_text())
        with patch("urllib.request.urlopen", return_value=self._mock_response(fixture)) as mock_open:
            with patch("urllib.request.Request") as mock_req:
                mock_req.return_value = MagicMock()
                mock_open.return_value = self._mock_response(fixture)
                from layers.layer_07_weather import open_meteo_client
                open_meteo_client.fetch_weather_batch([10.0], [20.0])
                call_kwargs = mock_req.call_args
                headers = call_kwargs[1].get("headers") or call_kwargs[0][1]
                assert headers.get("User-Agent") == open_meteo_client.USER_AGENT

    def test_4xx_raises_no_retry(self):
        http_err = urllib.error.HTTPError(
            url="https://x", code=400, msg="Bad Request",
            hdrs=MagicMock(), fp=BytesIO(b'{"error":true}')
        )
        with patch("urllib.request.urlopen", side_effect=http_err):
            from layers.layer_07_weather.open_meteo_client import fetch_weather_batch
            with pytest.raises(RuntimeError, match="400"):
                fetch_weather_batch([10.0], [20.0])

    def test_5xx_retries_and_raises(self):
        http_err = urllib.error.HTTPError(
            url="https://x", code=503, msg="Unavailable",
            hdrs=MagicMock(), fp=BytesIO(b"error")
        )
        with patch("urllib.request.urlopen", side_effect=http_err):
            with patch("time.sleep"):  # don't actually sleep
                from layers.layer_07_weather.open_meteo_client import fetch_weather_batch
                with pytest.raises(RuntimeError, match="3 attempts"):
                    fetch_weather_batch([10.0], [20.0], max_retries=3)

    def test_request_meta_fields(self):
        fixture = json.loads((FIXTURES_DIR / "sample_multi_response.json").read_text())
        with patch("urllib.request.urlopen", return_value=self._mock_response(fixture)):
            from layers.layer_07_weather.open_meteo_client import fetch_weather_batch
            result = fetch_weather_batch([12.9, 51.5], [77.5, -0.1], batch_index=2)
        meta = result["request_meta"]
        assert meta["batch_index"] == 2
        assert meta["status_code"] == 200
        assert "fetched_at" in meta
        assert "elapsed_ms" in meta
        assert "forecast_days" in meta


# ---------------------------------------------------------------------------
# weather_raw_storage
# ---------------------------------------------------------------------------

class TestRawStorage:
    def setup_method(self):
        from layers.layer_07_weather import weather_raw_storage as s
        self.s = s

    def test_run_id_format(self):
        run_id = self.s.make_run_id()
        assert run_id.startswith("run_")
        assert "T" in run_id
        assert run_id.endswith("Z")

    def test_run_directory_path_structure(self):
        from datetime import datetime, timezone
        dt = datetime(2026, 6, 10, 12, 0, 0, tzinfo=timezone.utc)
        path = self.s.run_directory("run_test", base="raw", dt=dt)
        parts = path.parts
        assert "layer_07_weather" in parts
        assert "open-meteo" in parts
        assert "2026" in parts
        assert "06" in parts
        assert "10" in parts

    def test_save_batch_creates_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            run_dir = Path(tmpdir)
            fixture = json.loads((FIXTURES_DIR / "sample_multi_response.json").read_text())
            uri = self.s.save_batch(run_dir, 0, fixture)
            assert Path(uri).exists()
            assert "batch_001.json" in uri

    def test_save_metadata_includes_attribution(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            run_dir = Path(tmpdir)
            self.s.save_metadata(run_dir, {"source_id": "open-meteo"})
            data = json.loads((run_dir / "metadata.json").read_text())
            assert "source_attribution" in data
            assert "open-meteo.com" in data["source_attribution"]

    def test_save_observed_fields_extracts_location_id(self):
        fixture = json.loads((FIXTURES_DIR / "sample_multi_response.json").read_text())
        with tempfile.TemporaryDirectory() as tmpdir:
            run_dir = Path(tmpdir)
            self.s.save_observed_fields(run_dir, [fixture])
            observed = json.loads((run_dir / "observed_fields.json").read_text())
            assert "location_id" in observed

    def test_save_preview_limits_items(self):
        fixture = json.loads((FIXTURES_DIR / "sample_multi_response.json").read_text())
        with tempfile.TemporaryDirectory() as tmpdir:
            run_dir = Path(tmpdir)
            self.s.save_preview(run_dir, [fixture], max_items=1)
            preview = json.loads((run_dir / "preview.json").read_text())
            assert len(preview) == 1

    def test_save_preview_contains_current_block(self):
        fixture = json.loads((FIXTURES_DIR / "sample_multi_response.json").read_text())
        with tempfile.TemporaryDirectory() as tmpdir:
            run_dir = Path(tmpdir)
            self.s.save_preview(run_dir, [fixture])
            preview = json.loads((run_dir / "preview.json").read_text())
            assert "current" in preview[0]


# ---------------------------------------------------------------------------
# weather_fetcher — dry-run and orchestration (no network)
# ---------------------------------------------------------------------------

class TestFetcher:
    def test_dry_run_returns_zero_api_calls(self):
        from layers.layer_07_weather.weather_fetcher import run_dry_run
        result = run_dry_run(grid_spacing=5, batch_size=50, forecast_days=3)
        assert result["api_calls_made"] == 0
        assert result["raw_files_written"] is False
        assert result["mode"] == "dry_run"

    def test_dry_run_contains_grid_summary(self):
        from layers.layer_07_weather.weather_fetcher import run_dry_run
        result = run_dry_run(grid_spacing=5, batch_size=50)
        assert "total_coordinates" in result
        assert "batch_count" in result

    def test_full_grid_requires_allow_full_grid(self):
        from layers.layer_07_weather.weather_fetcher import run_fetch
        with pytest.raises(RuntimeError, match="allow-full-grid"):
            run_fetch(proof=False, allow_full_grid=False, max_batches=None)

    def test_proof_fetch_with_mock(self):
        fixture = json.loads((FIXTURES_DIR / "sample_multi_response.json").read_text())
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
                "layers.layer_07_weather.weather_fetcher.fetch_weather_batch",
                return_value=mock_resp,
            ):
                from layers.layer_07_weather.weather_fetcher import run_fetch
                result = run_fetch(proof=True, forecast_days=1, raw_base=tmpdir)
            assert result["mode"] == "proof"
            assert result["requests_succeeded"] == 1
            assert result["requests_failed"] == 0
            assert Path(result["raw_dir"]).exists()


# ---------------------------------------------------------------------------
# weather_cli — dry-run does not call network
# ---------------------------------------------------------------------------

class TestCLI:
    def test_dry_run_no_network(self):
        from layers.layer_07_weather.weather_cli import main
        with patch("urllib.request.urlopen") as mock_open:
            result = main(["dry-run", "--grid-spacing", "5", "--batch-size", "50"])
        assert result == 0
        mock_open.assert_not_called()

    def test_fetch_without_allow_full_grid_exits_nonzero(self):
        from layers.layer_07_weather.weather_cli import main
        result = main(["fetch", "--grid-spacing", "5", "--batch-size", "50"])
        assert result != 0

    def test_proof_command_exists(self):
        from layers.layer_07_weather.weather_cli import build_parser
        parser = build_parser()
        # Should not raise
        args = parser.parse_args(["proof"])
        assert args.command == "proof"

    def test_fetch_proof_flag(self):
        from layers.layer_07_weather.weather_cli import build_parser
        args = build_parser().parse_args(["fetch", "--proof"])
        assert args.proof is True

    def test_fetch_allow_full_grid_flag(self):
        from layers.layer_07_weather.weather_cli import build_parser
        args = build_parser().parse_args(["fetch", "--allow-full-grid"])
        assert args.allow_full_grid is True
