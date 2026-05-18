"""Unit tests for airport public profile schema (parser + normalizer).

Tests the pure functions in airport_public_profile.py:
  - parse_wikipedia_summary_response
  - parse_wikidata_entity_response
  - build_interesting_facts_from_wikidata
  - compute_change_hash
  - normalize_airport_public_profile
  - build_source_attribution
  - URL builders

No network I/O, no database I/O.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone

import pytest

from packages.schemas.layers.layer_01_aviation.airport_public_profile import (
    LAYER_ID,
    SOURCE_ID,
    WIKIDATA_ENTITY_BASE,
    WIKIDATA_SPARQL_ENDPOINT,
    WIKIPEDIA_REST_SUMMARY_BASE,
    AirportPublicProfilePayload,
    InterestingFact,
    MatchMetadata,
    SourceAttribution,
    WikipediaAttribution,
    WikipediaSummaryResponse,
    WikidataEntityData,
    build_source_attribution,
    build_wikidata_entity_url,
    build_wikipedia_summary_url,
    compute_change_hash,
    normalize_airport_public_profile,
    parse_wikidata_entity_response,
    parse_wikipedia_summary_response,
    build_interesting_facts_from_wikidata,
)


REPO_ROOT = __import__("pathlib").Path(__file__).resolve().parents[3]

WIKIPEDIA_DUBAI_FIXTURE = REPO_ROOT / "tests" / "data" / "layer_01_aviation" / "fixtures" / "wikipedia_summary_dubai.json"
WIKIDATA_DUBAI_FIXTURE = REPO_ROOT / "tests" / "data" / "layer_01_aviation" / "fixtures" / "wikidata_entity_dubai.json"


class TestParseWikipediaSummaryResponse:
    def test_parses_dubai_international_response(self):
        raw = WIKIPEDIA_DUBAI_FIXTURE.read_bytes()
        result = parse_wikipedia_summary_response(raw)
        assert isinstance(result, WikipediaSummaryResponse)
        assert result.title == "Dubai International Airport"
        assert result.page_id == 4792390
        assert result.revision_id == 1285778220
        assert "primary international airport" in result.extract
        assert result.description == "International airport in Dubai, United Arab Emirates"
        assert result.thumbnail_url is not None
        assert "upload.wikimedia.org" in result.thumbnail_url
        assert result.content_url == "https://en.wikipedia.org/wiki/Dubai_International_Airport"
        assert result.tid == "t4g82w"

    def test_parses_string_input(self):
        raw_str = WIKIPEDIA_DUBAI_FIXTURE.read_text(encoding="utf-8")
        result = parse_wikipedia_summary_response(raw_str)
        assert result.title == "Dubai International Airport"
        assert result.page_id == 4792390

    def test_handles_missing_optional_fields(self):
        minimal_json = b'{"title":"Test","pageid":1,"extract":"Summary text."}'
        result = parse_wikipedia_summary_response(minimal_json)
        assert result.description is None
        assert result.thumbnail_url is None
        assert result.tid is None


class TestParseWikidataEntityResponse:
    def test_parses_dubai_q44426_entity(self):
        raw = WIKIDATA_DUBAI_FIXTURE.read_bytes()
        result = parse_wikidata_entity_response(raw)
        assert isinstance(result, WikidataEntityData)
        assert result.qid == "Q44426"
        assert result.label == "Dubai International Airport"
        assert result.description == "airport"
        assert "P571" in result.properties
        assert "P137" in result.properties
        assert "P856" in result.properties

    def test_extracts_p571_inception_date(self):
        raw = WIKIDATA_DUBAI_FIXTURE.read_bytes()
        result = parse_wikidata_entity_response(raw)
        p571_values = result.properties["P571"]
        assert len(p571_values) == 1
        assert p571_values[0].value == "1960-01-01T00:00:00Z"
        assert p571_values[0].property_id == "P571"

    def test_extracts_p137_operator(self):
        raw = WIKIDATA_DUBAI_FIXTURE.read_bytes()
        result = parse_wikidata_entity_response(raw)
        p137_values = result.properties["P137"]
        assert len(p137_values) == 1
        assert p137_values[0].value == "Q1395985"

    def test_extracts_p856_official_website(self):
        raw = WIKIDATA_DUBAI_FIXTURE.read_bytes()
        result = parse_wikidata_entity_response(raw)
        p856_values = result.properties["P856"]
        assert len(p856_values) == 1
        assert p856_values[0].value == "https://www.dubaiairports.ae"

    def test_extracts_p625_coordinates(self):
        raw = WIKIDATA_DUBAI_FIXTURE.read_bytes()
        result = parse_wikidata_entity_response(raw)
        p625_values = result.properties["P625"]
        assert len(p625_values) == 1
        assert "25.2528" in p625_values[0].value
        assert "55.3644" in p625_values[0].value

    def test_parses_string_input(self):
        raw_str = WIKIDATA_DUBAI_FIXTURE.read_text(encoding="utf-8")
        result = parse_wikidata_entity_response(raw_str)
        assert result.qid == "Q44426"
        assert "P571" in result.properties


class TestBuildInterestingFactsFromWikidata:
    def test_extracts_opened_date_fact(self):
        raw = WIKIDATA_DUBAI_FIXTURE.read_bytes()
        entity = parse_wikidata_entity_response(raw)
        facts = build_interesting_facts_from_wikidata(entity)
        assert any("opened" in f.fact.lower() or "1960" in f.fact for f in facts)
        assert all(f.source == "wikidata" for f in facts)

    def test_extracts_operator_fact(self):
        raw = WIKIDATA_DUBAI_FIXTURE.read_bytes()
        entity = parse_wikidata_entity_response(raw)
        facts = build_interesting_facts_from_wikidata(entity)
        assert any(f.property_id == "P137" for f in facts)

    def test_extracts_official_website_fact(self):
        raw = WIKIDATA_DUBAI_FIXTURE.read_bytes()
        entity = parse_wikidata_entity_response(raw)
        facts = build_interesting_facts_from_wikidata(entity)
        assert any(f.property_id == "P856" for f in facts)

    def test_returns_empty_list_for_entity_with_no_target_properties(self):
        empty_entity = WikidataEntityData(
            qid="Q999999",
            label="Empty Airport",
            description=None,
            properties={},
        )
        facts = build_interesting_facts_from_wikidata(empty_entity)
        assert facts == []


class TestNormalizeAirportPublicProfile:
    def test_normalizes_full_profile_with_wikipedia_and_wikidata(self):
        wiki_raw = WIKIPEDIA_DUBAI_FIXTURE.read_bytes()
        wiki_response = parse_wikipedia_summary_response(wiki_raw)
        wiki_raw_str = WIKIPEDIA_DUBAI_FIXTURE.read_text(encoding="utf-8")
        wiki_response_str = parse_wikipedia_summary_response(wiki_raw_str)
        wd_raw = WIKIDATA_DUBAI_FIXTURE.read_bytes()
        wd_entity = parse_wikidata_entity_response(wd_raw)

        now = datetime(2026, 5, 18, 12, 0, 0, tzinfo=timezone.utc)
        result = normalize_airport_public_profile(
            airport_id=123,
            icao_code="OMDB",
            iata_code="DXB",
            wikipedia_response=wiki_response,
            wikidata_entity=wd_entity,
            match_method="ourairports_wikipedia_link",
            match_confidence="high",
            wikidata_qid="Q44426",
            now_utc=now,
            ttl_days=30,
        )
        assert isinstance(result, AirportPublicProfilePayload)
        assert result.airport_id == 123
        assert result.icao_code == "OMDB"
        assert result.iata_code == "DXB"
        assert result.wikipedia_title == "Dubai International Airport"
        assert result.wikidata_qid == "Q44426"
        assert result.summary is not None
        assert "primary international airport" in result.summary
        assert result.short_description == "International airport in Dubai, United Arab Emirates"
        assert result.opened_date == "1960-01-01T00:00:00Z"
        assert result.operator == "Q1395985"
        assert result.official_website == "https://www.dubaiairports.ae"
        assert result.image_url is not None
        assert result.attribution is not None
        assert result.attribution["wikipedia"]["license"] == "CC BY-SA 4.0"
        assert result.attribution["wikidata"]["qid"] == "Q44426"
        assert result.change_hash is not None
        assert result.fetched_at == now.isoformat()
        assert "2026-06-17" in result.expires_at
        assert result.match is not None
        assert result.match.method == "ourairports_wikipedia_link"
        assert result.match.confidence == "high"
        assert len(result.interesting_facts) > 0

    def test_normalizes_wikipedia_only_when_no_wikidata(self):
        wiki_raw = WIKIPEDIA_DUBAI_FIXTURE.read_bytes()
        wiki_response = parse_wikipedia_summary_response(wiki_raw)
        now = datetime(2026, 5, 18, 12, 0, 0, tzinfo=timezone.utc)
        result = normalize_airport_public_profile(
            airport_id=456,
            icao_code="KLAX",
            iata_code="LAX",
            wikipedia_response=wiki_response,
            wikidata_entity=None,
            match_method="wikidata_icao_lookup",
            match_confidence="high",
            now_utc=now,
        )
        assert result.summary is not None
        assert result.wikidata_qid is None
        assert result.opened_date is None
        assert result.operator is None
        assert result.attribution is not None
        assert result.attribution["wikidata"] is None

    def test_normalizes_empty_when_no_wikipedia_or_wikidata(self):
        now = datetime(2026, 5, 18, 12, 0, 0, tzinfo=timezone.utc)
        result = normalize_airport_public_profile(
            airport_id=789,
            icao_code="ZZZZ",
            iata_code=None,
            wikipedia_response=None,
            wikidata_entity=None,
            match_method="no_match",
            match_confidence="none",
            now_utc=now,
        )
        assert result.summary is None
        assert result.short_description is None
        assert result.match is not None
        assert result.match.confidence == "none"

    def test_change_hash_deterministic(self):
        now = datetime(2026, 5, 18, 12, 0, 0, tzinfo=timezone.utc)
        wiki_raw = WIKIPEDIA_DUBAI_FIXTURE.read_bytes()
        wiki_response = parse_wikipedia_summary_response(wiki_raw)
        wd_raw = WIKIDATA_DUBAI_FIXTURE.read_bytes()
        wd_entity = parse_wikidata_entity_response(wd_raw)

        result1 = normalize_airport_public_profile(
            airport_id=100,
            icao_code="OMDB",
            iata_code="DXB",
            wikipedia_response=wiki_response,
            wikidata_entity=wd_entity,
            match_method="ourairports_wikipedia_link",
            match_confidence="high",
            wikidata_qid="Q44426",
            now_utc=now,
        )
        result2 = normalize_airport_public_profile(
            airport_id=100,
            icao_code="OMDB",
            iata_code="DXB",
            wikipedia_response=wiki_response,
            wikidata_entity=wd_entity,
            match_method="ourairports_wikipedia_link",
            match_confidence="high",
            wikidata_qid="Q44426",
            now_utc=now,
        )
        assert result1.change_hash == result2.change_hash
        assert result1.change_hash is not None


class TestBuildSourceAttribution:
    def test_builds_wikipedia_attribution(self):
        wiki_raw = WIKIPEDIA_DUBAI_FIXTURE.read_bytes()
        wiki_response = parse_wikipedia_summary_response(wiki_raw)
        now_str = "2026-05-18T12:00:00+00:00"
        result = build_source_attribution(wiki_response, None, now_str)
        assert "wikipedia" in result
        assert result["wikipedia"]["title"] == "Dubai International Airport"
        assert result["wikipedia"]["license"] == "CC BY-SA 4.0"
        assert result["wikipedia"]["revision_id"] == 1285778220
        assert "wikidata" not in result

    def test_builds_both_wikipedia_and_wikidata_attribution(self):
        wiki_raw = WIKIPEDIA_DUBAI_FIXTURE.read_bytes()
        wiki_response = parse_wikipedia_summary_response(wiki_raw)
        wd_raw = WIKIDATA_DUBAI_FIXTURE.read_bytes()
        wd_entity = parse_wikidata_entity_response(wd_raw)
        now_str = "2026-05-18T12:00:00+00:00"
        result = build_source_attribution(wiki_response, wd_entity, now_str)
        assert "wikipedia" in result
        assert "wikidata" in result
        assert result["wikidata"]["qid"] == "Q44426"
        assert result["wikidata"]["license"] == "CC0 1.0"


class TestUrlBuilders:
    def test_build_wikipedia_summary_url(self):
        url = build_wikipedia_summary_url("Dubai International Airport")
        assert url == f"{WIKIPEDIA_REST_SUMMARY_BASE}/Dubai_International_Airport"
        assert WIKIPEDIA_REST_SUMMARY_BASE in url

    def test_build_wikipedia_summary_url_with_spaces(self):
        url = build_wikipedia_summary_url("Heathrow Airport")
        assert "Heathrow_Airport" in url
        assert "Heathrow Airport" not in url

    def test_build_wikidata_entity_url(self):
        url = build_wikidata_entity_url("Q44426")
        assert url == f"{WIKIDATA_ENTITY_BASE}/Q44426.json"


class TestComputeChangeHash:
    def test_same_content_same_hash(self):
        dict1 = {"summary": "Test summary", "short_description": "Short desc", "opened_date": "2020", "operator": "Op", "owner": "Own", "official_website": "https://x.com", "wikidata_qid": "Q1", "wikipedia_revision_id": 123}
        dict2 = dict1.copy()
        assert compute_change_hash(dict1) == compute_change_hash(dict2)

    def test_different_content_different_hash(self):
        dict1 = {"summary": "Test summary", "short_description": "Short desc", "opened_date": "2020", "operator": "Op", "owner": "Own", "official_website": "https://x.com", "wikidata_qid": "Q1", "wikipedia_revision_id": 123}
        dict2 = {**dict1, "summary": "Different summary"}
        assert compute_change_hash(dict1) != compute_change_hash(dict2)

    def test_hash_is_sha256_hex(self):
        d = {"summary": "", "short_description": None, "opened_date": None, "operator": None, "owner": None, "official_website": None, "wikidata_qid": None, "wikipedia_revision_id": None}
        h = compute_change_hash(d)
        assert len(h) == 64
        assert all(c in "0123456789abcdef" for c in h)


class TestSchemaConstants:
    def test_layer_id_is_layer_01_aviation(self):
        assert LAYER_ID == "layer_01_aviation"

    def test_source_id_is_airport_public_enrichment(self):
        assert SOURCE_ID == "airport_public_enrichment"


class TestInterestingFactDataclass:
    def test_interesting_fact_is_frozen(self):
        fact = InterestingFact(fact="Opened in 1960", source="wikidata", property_id="P571")
        assert fact.fact == "Opened in 1960"
        assert fact.source == "wikidata"
        assert fact.property_id == "P571"

    def test_interesting_fact_default_property_none(self):
        fact = InterestingFact(fact="Test", source="wikipedia")
        assert fact.property_id is None


class TestMatchMetadata:
    def test_match_metadata_contains_all_fields(self):
        match = MatchMetadata(
            method="ourairports_wikipedia_link",
            confidence="high",
            wikidata_qid="Q44426",
            wikipedia_title="Dubai International Airport",
            reason=None,
        )
        assert match.method == "ourairports_wikipedia_link"
        assert match.confidence == "high"
        assert match.wikidata_qid == "Q44426"
        assert match.wikipedia_title == "Dubai International Airport"
        assert match.reason is None