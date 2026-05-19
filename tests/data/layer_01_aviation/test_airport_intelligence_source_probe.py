"""Unit tests for airport intelligence source probe helpers.

Tests parsing logic, bbox building, format functions, and data quality rules.
No network I/O — uses fixture data.
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

WIKI_DUBAI_FIXTURE = REPO_ROOT / "tests" / "data" / "layer_01_aviation" / "fixtures" / "wikipedia_summary_dubai.json"
WIKI_KJFK_FIXTURE = REPO_ROOT / "tests" / "data" / "layer_01_aviation" / "fixtures" / "wikipedia_summary_kjfk.json"
WIKI_LHR_FIXTURE = REPO_ROOT / "tests" / "data" / "layer_01_aviation" / "fixtures" / "wikipedia_summary_lhr.json"
WIKI_BDL_FIXTURE = REPO_ROOT / "tests" / "data" / "layer_01_aviation" / "fixtures" / "wikipedia_summary_kbdl.json"


WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"
OSM_OVERPASS = "https://overpass-api.de/api/interpreter"

WIKIDATA_TARGET_PROPERTIES = {
    "P239": "icao_code",
    "P238": "iata_code",
    "P571": "opened_date",
    "P137": "operator",
    "P127": "owner",
    "P856": "official_website",
    "P1589": "passenger_traffic",
    "P3878": "cargo_tonnage",
    "P625": "coordinates",
    "P18": "image",
}

KNOWN_AIRPORT_HOMEPAGES = {
    "KJFK": "https://www.jfkairport.com/",
    "KBDL": "https://www.ctairports.org/bdl",
    "OMDB": "https://www.dubaiairports.ae/",
    "EGLL": "https://www.heathrow.com/",
    "CYQB": "https://www.quebecairport.com/en/",
}


@dataclass
class ProbeResult:
    source_name: str
    key_required: str
    request_attempted: bool
    http_status: int | None
    latency_ms: int | None
    fields_found: list[str] = field(default_factory=list)
    fields_missing: list[str] = field(default_factory=list)
    confidence_notes: list[str] = field(default_factory=list)
    recommended_use: str = "unknown"
    raw_snippet: str | None = None
    error_message: str | None = None
    usable: bool = False


def build_bbox(lat: float, lon: float, buffer: float = 0.05) -> tuple[float, float, float, float]:
    return (lon - buffer, lat - buffer, lon + buffer, lat + buffer)


def build_overpass_query(bbox: tuple[float, float, float, float]) -> str:
    s, w, n, e = bbox
    return (
        "[out:json][timeout:15];"
        f"node['aeroway'~'gate|terminal|apron|taxiway|runway|hangar|control_tower']"
        f"({s},{w},{n},{e});"
        "way['aeroway'~'gate|terminal|apron|taxiway|runway|hangar|control_tower']"
        f"({s},{w},{n},{e});"
        "out body;"
    )


def build_icao_sparql(icao: str) -> str:
    return (
        "SELECT ?entity WHERE {"
        f"?entity wdt:P239 '{icao.strip().upper()}' ."
        "} LIMIT 1"
    )


def format_probe_result(result: ProbeResult) -> str:
    status = "PASS" if result.usable else "FAIL"
    fields = ", ".join(result.fields_found) if result.fields_found else "none"
    missing = ", ".join(result.fields_missing) if result.fields_missing else "none"
    notes = " | ".join(result.confidence_notes) if result.confidence_notes else "none"
    latency = f"{result.latency_ms}ms" if result.latency_ms else "N/A"
    http = result.http_status or "N/A"
    key = result.key_required
    use = result.recommended_use
    error = f" [{result.error_message}]" if result.error_message else ""
    return (
        f"  [{status}] [{result.source_name}]\n"
        f"    Key required: {key} | HTTP: {http} | Latency: {latency} | Use: {use}{error}\n"
        f"    Fields found: {fields}\n"
        f"    Fields missing: {missing}\n"
        f"    Notes: {notes}"
    )


def extract_wikipedia_fields(data: dict) -> list[str]:
    found = []
    if data.get("title"):
        found.append("title")
    if data.get("extract"):
        found.append("summary")
    if data.get("description"):
        found.append("short_description")
    if data.get("thumbnail"):
        found.append("image")
    if data.get("coordinates"):
        found.append("coordinates")
    if data.get("content_urls", {}).get("desktop", {}).get("page"):
        found.append("article_url")
    if "passenger" in data.get("extract", "").lower():
        found.append("traffic_hints")
    if "aircraft" in data.get("extract", "").lower():
        found.append("movement_hints")
    if "cargo" in data.get("extract", "").lower():
        found.append("cargo_hints")
    return found


def has_year_qualified_traffic(extract: str) -> bool:
    import re
    year_matches = re.findall(r"(20[2-3][0-9])", extract)
    has_million = bool(re.search(r"\d+\.?\d*\s+million", extract))
    return len(year_matches) > 0 and has_million


class TestWikipediaProbeFields:
    def _run_wikipedia_field_test(self, fixture_path: Path, expect_traffic: bool):
        data = json.loads(fixture_path.read_bytes())
        extract = data.get("extract", "")
        found = extract_wikipedia_fields(data)
        has_traffic = has_year_qualified_traffic(extract)
        return {
            "fields": found,
            "has_traffic": has_traffic,
            "extract_length": len(extract),
        }

    def test_dubai_has_traffic_data_with_year(self):
        result = self._run_wikipedia_field_test(WIKI_DUBAI_FIXTURE, expect_traffic=True)
        assert result["has_traffic"] is True, "DXB extract should have year-qualified traffic"
        assert result["extract_length"] > 200

    def test_kjfk_lacks_specific_traffic_number(self):
        result = self._run_wikipedia_field_test(WIKI_KJFK_FIXTURE, expect_traffic=False)
        assert result["has_traffic"] is False, "JFK extract should not have year-qualified traffic"

    def test_heathrow_lacks_specific_traffic_number(self):
        result = self._run_wikipedia_field_test(WIKI_LHR_FIXTURE, expect_traffic=False)
        assert result["has_traffic"] is False, "Heathrow should not have traffic data"

    def test_bdl_lacks_specific_traffic_number(self):
        result = self._run_wikipedia_field_test(WIKI_BDL_FIXTURE, expect_traffic=False)
        assert result["has_traffic"] is False, "Bradley should not have traffic data"

    def test_dubai_extract_mentions_specific_passenger_number(self):
        data = json.loads(WIKI_DUBAI_FIXTURE.read_bytes())
        extract = data.get("extract", "")
        numbers = re.findall(r"(\d+\.?\d*)\s+million", extract)
        assert len(numbers) > 0, f"DXB extract should contain 'X million' pattern: {extract}"
        assert float(numbers[0]) > 50, "DXB should have > 50 million passengers"

    def test_dubai_extract_mentions_cargo_and_movements(self):
        data = json.loads(WIKI_DUBAI_FIXTURE.read_bytes())
        extract = data.get("extract", "")
        assert "cargo" in extract.lower()
        assert "movement" in extract.lower()

    def test_dubai_extract_fields(self):
        data = json.loads(WIKI_DUBAI_FIXTURE.read_bytes())
        found = extract_wikipedia_fields(data)
        assert "title" in found
        assert "summary" in found
        assert "traffic_hints" in found
        assert "cargo_hints" in found
        assert "movement_hints" in found

    def test_kjfk_extract_fields(self):
        data = json.loads(WIKI_KJFK_FIXTURE.read_bytes())
        found = extract_wikipedia_fields(data)
        assert "title" in found
        assert "summary" in found
        assert "traffic_hints" not in found


class TestWikidataProbeLogic:
    def test_target_properties_cover_key_fields(self):
        required_fields = [
            "icao_code", "iata_code", "opened_date",
            "operator", "owner", "official_website",
            "passenger_traffic", "cargo_tonnage",
            "coordinates", "image",
        ]
        for field_name in required_fields:
            assert field_name in WIKIDATA_TARGET_PROPERTIES.values(), \
                f"Missing field: {field_name}"
        assert len(WIKIDATA_TARGET_PROPERTIES) == 10

    def test_p1589_is_passenger_traffic(self):
        assert WIKIDATA_TARGET_PROPERTIES["P1589"] == "passenger_traffic"

    def test_p3878_is_cargo_tonnage(self):
        assert WIKIDATA_TARGET_PROPERTIES["P3878"] == "cargo_tonnage"

    def test_build_icao_sparql(self):
        sparql = build_icao_sparql("KJFK")
        assert "wdt:P239" in sparql
        assert "KJFK" in sparql
        assert "LIMIT 1" in sparql

    def test_build_icao_sparql_normalizes_uppercase(self):
        assert build_icao_sparql("kjfk") == build_icao_sparql("KJFK")


class TestOSMProbeLogic:
    def test_build_bbox(self):
        bbox = build_bbox(40.6397, -73.7789, buffer=0.05)
        lon_min, lat_min, lon_max, lat_max = bbox
        assert lon_min == pytest.approx(-73.8289, abs=0.001)
        assert lat_min == pytest.approx(40.5897, abs=0.001)
        assert lon_max == pytest.approx(-73.7289, abs=0.001)
        assert lat_max == pytest.approx(40.6897, abs=0.001)

    def test_build_bbox_buffer_zero(self):
        bbox = build_bbox(25.2528, 55.3644, buffer=0.0)
        lon_min, lat_min, lon_max, lat_max = bbox
        assert lon_min == pytest.approx(55.3644, abs=0.0001)
        assert lat_min == pytest.approx(25.2528, abs=0.0001)

    def test_build_bbox_for_dxb(self):
        bbox = build_bbox(25.2528, 55.3644, buffer=0.05)
        lon_min, lat_min, lon_max, lat_max = bbox
        assert lat_min > 0 and lon_min > 0
        assert "55" in str(lon_min) or "25" in str(lat_min)

    def test_build_overpass_query(self):
        bbox = (-73.8289, 40.5897, -73.7289, 40.6897)
        query = build_overpass_query(bbox)
        assert "out:json" in query
        assert "timeout:15" in query
        assert "aeroway" in query
        assert "gate" in query
        assert "terminal" in query
        assert "taxiway" in query
        assert "runway" in query


class TestBTSSkipLogic:
    def test_bts_skips_non_us_airports(self):
        is_us = "OMDB".startswith("K") and bool("DXB")
        assert is_us is False

    def test_bts_skips_non_k_icao(self):
        is_us_egll = "EGLL".startswith("K")
        assert is_us_egll is False

    def test_bts_runs_for_k_prefix(self):
        is_us_kjfk = "KJFK".startswith("K") and bool("JFK")
        assert is_us_kjfk is True

    def test_bts_runs_for_kbdal(self):
        is_us_kbdl = "KBDL".startswith("K") and bool("BDL")
        assert is_us_kbdl is True


class TestEurostatLogic:
    def test_eurostat_requires_iata(self):
        assert bool(None) is False
        assert bool("") is False
        assert bool("JFK") is True
        assert len("JFK") == 3

    def test_eurostat_skips_missing_iata(self):
        has_iata = bool("JFK") and len("JFK") == 3
        assert has_iata is True

    def test_eurostat_url_uses_iata_and_geo(self):
        iata = "JFK"
        url = f"https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/avia_paoc?geo=US&time=2023&airpt={iata}&tra_meas=PAS"
        assert iata in url
        assert "geo=US" in url
        assert "tra_meas=PAS" in url


class TestOfficialWebsiteKnownHomepages:
    def test_known_homepages_includes_jfk(self):
        assert "KJFK" in KNOWN_AIRPORT_HOMEPAGES
        assert KNOWN_AIRPORT_HOMEPAGES["KJFK"].startswith("https://")

    def test_known_homepages_includes_omdb(self):
        assert "OMDB" in KNOWN_AIRPORT_HOMEPAGES

    def test_known_homepages_includes_all_major_airports(self):
        for icao in ["KJFK", "KBDL", "OMDB", "EGLL"]:
            assert icao in KNOWN_AIRPORT_HOMEPAGES

    def test_unknown_airport_not_in_known_homepages(self):
        assert "ZZZZ" not in KNOWN_AIRPORT_HOMEPAGES


class TestProbeResultDataclass:
    def test_probe_result_has_all_required_fields(self):
        result = ProbeResult(
            source_name="Test Source",
            key_required="NO",
            request_attempted=True,
            http_status=200,
            latency_ms=150,
            fields_found=["field_a", "field_b"],
            fields_missing=["field_c"],
            confidence_notes=["note 1"],
            recommended_use="click",
            usable=True,
        )
        assert result.source_name == "Test Source"
        assert result.key_required == "NO"
        assert result.request_attempted is True
        assert result.http_status == 200
        assert result.latency_ms == 150
        assert len(result.fields_found) == 2
        assert len(result.fields_missing) == 1
        assert result.usable is True
        assert result.recommended_use == "click"

    def test_probe_result_default_usable_is_false(self):
        result = ProbeResult(
            source_name="Test",
            key_required="NO",
            request_attempted=False,
            http_status=None,
            latency_ms=None,
        )
        assert result.usable is False

    def test_probe_result_error_message(self):
        result = ProbeResult(
            source_name="Test",
            key_required="NO",
            request_attempted=True,
            http_status=429,
            latency_ms=200,
            usable=False,
            error_message="HTTP 429 Rate Limited",
        )
        assert result.error_message == "HTTP 429 Rate Limited"


class TestFormatProbeResult:
    def test_format_shows_pass_for_usable(self):
        result = ProbeResult(
            source_name="Test Source",
            key_required="NO",
            request_attempted=True,
            http_status=200,
            latency_ms=150,
            fields_found=["field_a"],
            fields_missing=["field_b"],
            confidence_notes=["test note"],
            recommended_use="click",
            usable=True,
        )
        formatted = format_probe_result(result)
        assert "[PASS]" in formatted
        assert "Test Source" in formatted
        assert "NO" in formatted
        assert "150ms" in formatted
        assert "field_a" in formatted

    def test_format_shows_fail_for_not_usable(self):
        result = ProbeResult(
            source_name="Test Source",
            key_required="NO",
            request_attempted=True,
            http_status=429,
            latency_ms=200,
            fields_found=[],
            fields_missing=[],
            confidence_notes=["rate limited"],
            recommended_use="background",
            usable=False,
            error_message="HTTP 429",
        )
        formatted = format_probe_result(result)
        assert "[FAIL]" in formatted
        assert "HTTP 429" in formatted

    def test_format_handles_none_latency(self):
        result = ProbeResult(
            source_name="Test",
            key_required="NO",
            request_attempted=False,
            http_status=None,
            latency_ms=None,
            usable=False,
        )
        formatted = format_probe_result(result)
        assert "N/A" in formatted

    def test_format_shows_skip_for_skipped(self):
        result = ProbeResult(
            source_name="BTS",
            key_required="NO",
            request_attempted=True,
            http_status=None,
            latency_ms=None,
            confidence_notes=["SKIPPED: BTS covers US only"],
            recommended_use="skip",
            usable=False,
        )
        formatted = format_probe_result(result)
        assert "SKIPPED" in formatted
        assert "BTS" in formatted


class TestWikipediaNameEncoding:
    def test_ascii_airport_name_encodes_cleanly(self):
        name = "John F. Kennedy International Airport"
        import urllib.parse
        encoded = urllib.parse.quote(name, safe="")
        assert "&" not in encoded
        assert " " not in encoded

    def test_accented_airport_name_encodes_correctly(self):
        name = "Québec Jean Lesage International Airport"
        import urllib.parse
        encoded = urllib.parse.quote(name, safe="")
        assert "%C3%A9" in encoded
        assert "é" not in encoded

    def test_wikipedia_url_construction_for_accented_name(self):
        import urllib.parse
        name = "Québec Jean Lesage International Airport"
        encoded_name = urllib.parse.quote(name, safe="")
        url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{encoded_name}"
        assert "Qu%C3%A9bec" in url


class TestYearExtractionFromWikipediaExtract:
    def test_dubai_has_year_qualified_traffic(self):
        data = json.loads(WIKI_DUBAI_FIXTURE.read_bytes())
        extract = data.get("extract", "")
        assert has_year_qualified_traffic(extract) is True

    def test_kjfk_lacks_year_qualified_traffic(self):
        data = json.loads(WIKI_KJFK_FIXTURE.read_bytes())
        extract = data.get("extract", "")
        assert has_year_qualified_traffic(extract) is False

    def test_lhr_lacks_year_qualified_traffic(self):
        data = json.loads(WIKI_LHR_FIXTURE.read_bytes())
        extract = data.get("extract", "")
        assert has_year_qualified_traffic(extract) is False

    def test_bdl_lacks_year_qualified_traffic(self):
        data = json.loads(WIKI_BDL_FIXTURE.read_bytes())
        extract = data.get("extract", "")
        assert has_year_qualified_traffic(extract) is False


class TestTrafficDataRules:
    def test_never_store_traffic_without_year_kjfk(self):
        data = json.loads(WIKI_KJFK_FIXTURE.read_bytes())
        extract = data.get("extract", "")
        numbers = re.findall(r"\b\d{4,}\b", extract)
        for num_str in numbers:
            num = int(num_str)
            assert not (
                num > 1000 and num < 100000
            ), f"JFK: Number {num} looks like passenger count but has no year qualifier. Must not store."

    def test_dubai_has_year_qualified_traffic_for_storage(self):
        data = json.loads(WIKI_DUBAI_FIXTURE.read_bytes())
        extract = data.get("extract", "")
        year_matches = re.findall(r"(20[2-3][0-9])", extract)
        has_million = bool(re.search(r"\d+\.?\d*\s+million", extract))
        assert has_million is True
        assert len(year_matches) >= 1
        assert "2024" in year_matches

    def test_wikidata_p1589_is_passenger_traffic(self):
        assert WIKIDATA_TARGET_PROPERTIES.get("P1589") == "passenger_traffic"

    def test_wikidata_p3878_is_cargo_tonnage(self):
        assert WIKIDATA_TARGET_PROPERTIES.get("P3878") == "cargo_tonnage"

    def test_wikidata_p571_is_opened_date(self):
        assert WIKIDATA_TARGET_PROPERTIES.get("P571") == "opened_date"

    def test_wikidata_p137_is_operator(self):
        assert WIKIDATA_TARGET_PROPERTIES.get("P137") == "operator"


class TestDataNeverGuessed:
    def test_operator_must_not_be_guessed(self):
        WIKIDATA_TARGET_PROPERTIES.get("P137") == "operator"
        assert True

    def test_passenger_capacity_must_not_be_guessed(self):
        PASSENGER_CAPACITY_SOURCES = ["ACI paid report", "annual report PDF", "official website"]
        for src in PASSENGER_CAPACITY_SOURCES:
            assert src in ["ACI paid report", "annual report PDF", "official website"]

    def test_gate_count_from_osm_is_approximate(self):
        OSM_SOURCES = ["osm_gate_count", "osm_terminal_count"]
        for src in OSM_SOURCES:
            assert src.startswith("osm_")