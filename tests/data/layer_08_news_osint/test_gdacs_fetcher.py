"""Tests for Layer 08 News & OSINT — GDACS fetcher modules.

No live network calls. Uses mocked responses and hand-written fixtures only.
"""

from __future__ import annotations

import json
import sys
import urllib.error
from io import BytesIO
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

SRC_DIR = Path(__file__).resolve().parents[3] / "services" / "fetch-orchestrator" / "src"
sys.path.insert(0, str(SRC_DIR))

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

SAMPLE_FEATURE = {
    "type": "Feature",
    "geometry": {"type": "Point", "coordinates": [35.5, 1.5]},
    "properties": {
        "eventid": 1234,
        "eventtype": "FL",
        "alertlevel": "Orange",
        "country": "Kenya",
        "resources": {
            "report": "https://www.gdacs.org/report/FL/1234",
            "details": "https://www.gdacs.org/details/FL/1234",
            "geometry": "https://www.gdacs.org/geometry/FL/1234",
        },
    },
}

SAMPLE_GEOJSON = {
    "type": "FeatureCollection",
    "features": [SAMPLE_FEATURE],
}

MULTI_FEATURE_GEOJSON = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [80.0, 20.0]},
            "properties": {"eventid": 1, "eventtype": "EQ", "alertlevel": "Red", "country": "India"},
        },
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [-75.0, 10.0]},
            "properties": {"eventid": 2, "eventtype": "TC", "alertlevel": "Orange", "country": "Colombia"},
        },
        {
            "type": "Feature",
            "geometry": None,  # no coordinates
            "properties": {"eventid": 3, "eventtype": "DR", "alertlevel": "Green", "country": "Mali"},
        },
    ],
}

EMPTY_GEOJSON = {"type": "FeatureCollection", "features": []}


# ---------------------------------------------------------------------------
# gdacs_client — URL construction
# ---------------------------------------------------------------------------

class TestGdacsClientUrl:
    def setup_method(self):
        from layers.layer_08_news_osint.gdacs_client import _build_url
        self._build_url = _build_url

    def test_default_params(self):
        url = self._build_url()
        assert "eventtype=ALL" in url
        assert "alertlevel=ALL" in url

    def test_custom_eventtype(self):
        url = self._build_url(eventtype="EQ")
        assert "eventtype=EQ" in url

    def test_custom_alertlevel(self):
        url = self._build_url(alertlevel="Red")
        assert "alertlevel=Red" in url

    def test_base_url(self):
        url = self._build_url()
        assert url.startswith("https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP")


# ---------------------------------------------------------------------------
# gdacs_client — response parsing and validation
# ---------------------------------------------------------------------------

class TestGdacsClientParsing:
    def setup_method(self):
        from layers.layer_08_news_osint.gdacs_client import _parse_and_validate
        self._parse = _parse_and_validate

    def test_valid_geojson_parsed(self):
        body = json.dumps(SAMPLE_GEOJSON)
        data = self._parse(body)
        assert "features" in data
        assert len(data["features"]) == 1

    def test_bad_json_raises(self):
        with pytest.raises(RuntimeError, match="Invalid JSON"):
            self._parse("not json {{{")

    def test_missing_features_raises(self):
        with pytest.raises(RuntimeError, match="missing 'features'"):
            self._parse('{"type": "FeatureCollection"}')

    def test_non_object_raises(self):
        with pytest.raises(RuntimeError):
            self._parse("[1, 2, 3]")

    def test_empty_features_ok(self):
        body = json.dumps(EMPTY_GEOJSON)
        data = self._parse(body)
        assert data["features"] == []


# ---------------------------------------------------------------------------
# gdacs_client — urllib fetch (mocked)
# ---------------------------------------------------------------------------

class TestGdacsClientUrllib:
    def _mock_urlopen(self, payload: dict):
        body = json.dumps(payload).encode("utf-8")
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = body
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)
        return mock_resp

    def test_successful_fetch_returns_result(self):
        from layers.layer_08_news_osint.gdacs_client import fetch_gdacs_via_urllib

        mock_resp = self._mock_urlopen(SAMPLE_GEOJSON)
        with patch("urllib.request.urlopen", return_value=mock_resp):
            result = fetch_gdacs_via_urllib()

        assert result.source_id == "gdacs"
        assert result.item_count == 1
        assert "features" in result.raw_payload

    def test_empty_features_returns_zero_count(self):
        from layers.layer_08_news_osint.gdacs_client import fetch_gdacs_via_urllib

        mock_resp = self._mock_urlopen(EMPTY_GEOJSON)
        with patch("urllib.request.urlopen", return_value=mock_resp):
            result = fetch_gdacs_via_urllib()

        assert result.item_count == 0

    def test_network_error_raises_after_retries(self):
        from layers.layer_08_news_osint.gdacs_client import fetch_gdacs_via_urllib

        with patch("urllib.request.urlopen", side_effect=OSError("connection refused")):
            with patch("time.sleep"):  # don't actually sleep
                with pytest.raises(RuntimeError, match="failed after"):
                    fetch_gdacs_via_urllib(max_retries=2)

    def test_http_5xx_retries(self):
        from layers.layer_08_news_osint.gdacs_client import fetch_gdacs_via_urllib

        err = urllib.error.HTTPError(url="", code=503, msg="Service Unavailable", hdrs=None, fp=None)
        with patch("urllib.request.urlopen", side_effect=err):
            with patch("time.sleep"):
                with pytest.raises(RuntimeError):
                    fetch_gdacs_via_urllib(max_retries=2)

    def test_http_4xx_no_retry(self):
        from layers.layer_08_news_osint.gdacs_client import fetch_gdacs_via_urllib

        err_fp = MagicMock()
        err_fp.read.return_value = b"Not Found"
        err = urllib.error.HTTPError(url="", code=404, msg="Not Found", hdrs=None, fp=err_fp)
        with patch("urllib.request.urlopen", side_effect=err):
            with pytest.raises(RuntimeError, match="client error, no retry"):
                fetch_gdacs_via_urllib(max_retries=3)


# ---------------------------------------------------------------------------
# gdacs_client — curl fallback (mocked)
# ---------------------------------------------------------------------------

class TestGdacsClientCurl:
    def test_curl_command_contains_tls_flags(self):
        from layers.layer_08_news_osint.gdacs_client import fetch_gdacs_via_curl

        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = json.dumps(SAMPLE_GEOJSON) + "\n200"
        mock_result.stderr = ""

        with patch("layers.layer_08_news_osint.gdacs_client._find_curl", return_value="curl"):
            with patch("subprocess.run", return_value=mock_result) as mock_run:
                result = fetch_gdacs_via_curl()

        cmd = mock_run.call_args[0][0]
        assert "-4" in cmd
        assert "--http1.1" in cmd
        assert "--tlsv1.2" in cmd
        assert "-L" in cmd
        assert result.item_count == 1

    def test_curl_not_found_raises(self):
        from layers.layer_08_news_osint.gdacs_client import fetch_gdacs_via_curl

        with patch("layers.layer_08_news_osint.gdacs_client._find_curl", return_value=None):
            with pytest.raises(RuntimeError, match="curl not found"):
                fetch_gdacs_via_curl()

    def test_curl_non_zero_exit_raises(self):
        from layers.layer_08_news_osint.gdacs_client import fetch_gdacs_via_curl

        mock_result = MagicMock()
        mock_result.returncode = 6
        mock_result.stderr = "Could not resolve host"

        with patch("layers.layer_08_news_osint.gdacs_client._find_curl", return_value="curl"):
            with patch("subprocess.run", return_value=mock_result):
                with pytest.raises(RuntimeError, match="curl failed"):
                    fetch_gdacs_via_curl()

    def test_curl_bad_json_raises(self):
        from layers.layer_08_news_osint.gdacs_client import fetch_gdacs_via_curl

        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "not json\n200"
        mock_result.stderr = ""

        with patch("layers.layer_08_news_osint.gdacs_client._find_curl", return_value="curl"):
            with patch("subprocess.run", return_value=mock_result):
                with pytest.raises(RuntimeError, match="Invalid JSON"):
                    fetch_gdacs_via_curl()

    def test_curl_http_error_raises(self):
        from layers.layer_08_news_osint.gdacs_client import fetch_gdacs_via_curl

        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "Service Unavailable\n503"
        mock_result.stderr = ""

        with patch("layers.layer_08_news_osint.gdacs_client._find_curl", return_value="curl"):
            with patch("subprocess.run", return_value=mock_result):
                with pytest.raises(RuntimeError, match="HTTP 503"):
                    fetch_gdacs_via_curl()


# ---------------------------------------------------------------------------
# gdacs_fetcher — extraction and summaries
# ---------------------------------------------------------------------------

class TestGdacsFetcher:
    def setup_method(self):
        from layers.layer_08_news_osint.gdacs_fetcher import extract_event_summary, summarise_events
        from layers.layer_08_news_osint.news_source_types import GdacsRawResult
        self.extract = extract_event_summary
        self.summarise = summarise_events
        self.GdacsRawResult = GdacsRawResult

    def _make_result(self, payload):
        return self.GdacsRawResult(
            source_id="gdacs",
            endpoint_url="https://example.com",
            fetched_at="2026-06-11T00:00:00+00:00",
            item_count=len(payload.get("features", [])),
            raw_payload=payload,
        )

    def test_extract_coordinates_from_point(self):
        s = self.extract(SAMPLE_FEATURE)
        assert s.longitude == 35.5
        assert s.latitude == 1.5

    def test_extract_event_id(self):
        s = self.extract(SAMPLE_FEATURE)
        assert s.event_id == "1234"

    def test_extract_event_type(self):
        s = self.extract(SAMPLE_FEATURE)
        assert s.event_type == "FL"

    def test_extract_alert_level(self):
        s = self.extract(SAMPLE_FEATURE)
        assert s.alert_level == "Orange"

    def test_extract_country(self):
        s = self.extract(SAMPLE_FEATURE)
        assert s.country == "Kenya"

    def test_extract_report_url(self):
        s = self.extract(SAMPLE_FEATURE)
        assert "report" in (s.report_url or "")

    def test_extract_null_geometry(self):
        feature = {"type": "Feature", "geometry": None, "properties": {"eventid": 99}}
        s = self.extract(feature)
        assert s.latitude is None
        assert s.longitude is None

    def test_summarise_event_type_counts(self):
        result = self._make_result(MULTI_FEATURE_GEOJSON)
        summary = self.summarise(result)
        assert summary["event_type_counts"]["EQ"] == 1
        assert summary["event_type_counts"]["TC"] == 1
        assert summary["event_type_counts"]["DR"] == 1

    def test_summarise_alert_level_counts(self):
        result = self._make_result(MULTI_FEATURE_GEOJSON)
        summary = self.summarise(result)
        assert summary["alert_level_counts"]["Red"] == 1
        assert summary["alert_level_counts"]["Orange"] == 1
        assert summary["alert_level_counts"]["Green"] == 1

    def test_summarise_coordinates_count(self):
        # 2 of 3 features have coordinates (one has geometry=None)
        result = self._make_result(MULTI_FEATURE_GEOJSON)
        summary = self.summarise(result)
        assert summary["items_with_coordinates"] == 2

    def test_empty_features_no_crash(self):
        result = self._make_result(EMPTY_GEOJSON)
        summary = self.summarise(result)
        assert summary["item_count"] == 0
        assert summary["items_with_coordinates"] == 0
        assert summary["alert_level_counts"] == {}
        assert summary["event_type_counts"] == {}


# ---------------------------------------------------------------------------
# gdacs_raw_storage — path generation
# ---------------------------------------------------------------------------

class TestGdacsRawStorage:
    def setup_method(self):
        from layers.layer_08_news_osint import gdacs_raw_storage as storage
        self.storage = storage

    def test_run_id_format(self):
        run_id = self.storage.make_run_id()
        assert run_id.startswith("run_")
        assert "T" in run_id
        assert run_id.endswith("Z")

    def test_run_directory_under_tmp(self):
        from datetime import datetime, timezone
        dt = datetime(2026, 6, 11, 12, 0, 0, tzinfo=timezone.utc)
        run_id = "run_20260611T120000Z"
        d = self.storage.run_directory(run_id, base="tmp", dt=dt)
        parts = d.parts
        assert "tmp" in parts
        assert "layer_08_news_osint" in parts
        assert "gdacs" in parts
        assert "2026" in parts
        assert "06" in parts
        assert "11" in parts
        assert run_id in parts

    def test_save_raw_events_writes_file(self, tmp_path):
        run_dir = tmp_path / "run_test"
        path = self.storage.save_raw_events(run_dir, SAMPLE_GEOJSON)
        assert Path(path).exists()
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        assert data["features"][0]["properties"]["eventid"] == 1234

    def test_save_proof_summary_writes_file(self, tmp_path):
        run_dir = tmp_path / "run_test"
        summary = {"item_count": 5, "items_with_coordinates": 4}
        path = self.storage.save_proof_summary(run_dir, summary)
        assert Path(path).exists()
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        assert data["item_count"] == 5

    def test_proof_cli_writes_under_tmp(self, tmp_path):
        """Verify the CLI proof output path stays under the provided base, not outside."""
        from datetime import datetime, timezone
        dt = datetime(2026, 6, 11, 12, 0, 0, tzinfo=timezone.utc)
        run_id = self.storage.make_run_id(dt)
        run_dir = self.storage.run_directory(run_id, base=tmp_path, dt=dt)
        # run_dir must be inside tmp_path
        assert str(run_dir).startswith(str(tmp_path))
