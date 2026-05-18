"""Airport public profile normalizer — orchestrates fetch + normalize.

This normalizer combines OurAirports identity fields with Wikimedia/Wikidata
API responses to produce an AirportPublicProfilePayload.

The caller provides airport identity context (icao_code, iata_code,
wikipedia_link from OurAirports) and this module handles:
  1. Resolving Wikipedia title from OurAirports wikipedia_link or ICAO lookup
  2. Resolving Wikidata QID from OurAirports wikipedia_link or ICAO/IATA lookup
  3. Fetching Wikipedia summary and Wikidata entity
  4. Normalizing into AirportPublicProfilePayload

No database I/O occurs here. Persistence is the caller's responsibility
after the DB schema (WO-032B) lands.

Canonical decisions enforced here:
  - Only English Wikipedia (no other languages)
  - Wikidata for structured facts (P571, P137, P127, P856, P18, P239, P238)
  - No full Wikipedia page storage
  - No paid APIs
  - 30-day TTL baked into the payload
  - Attribution always constructed for CC BY-SA 4.0 compliance
  - match_confidence drives what content is included
  - AI-generated facts are NOT stored as ground truth
"""

from __future__ import annotations

import sys
from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[5]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from packages.schemas.layers.layer_01_aviation.airport_public_profile import (
    AirportPublicProfilePayload,
    InterestingFact,
    MatchMetadata,
    SourceAttribution,
    WikipediaAttribution,
    WikidataAttribution,
    build_source_attribution,
    compute_change_hash,
    normalize_airport_public_profile,
    parse_wikidata_entity_response,
    parse_wikipedia_summary_response,
)
from services.fetch_orchestrator.src.layers.layer_01_aviation.wikimedia_wikidata_fetcher import (
    FetchResult,
    FetchRateLimitedError,
    FetcherError,
    SOURCE_ID,
    fetch_airport_public_data,
    fetch_wikipedia_summary,
    fetch_wikidata_entity,
    icao_to_wikidata_qid,
    iata_to_wikidata_qid,
)


LAYER_ID = "layer_01_aviation"


class AirportPublicProfileNormalizer:
    def __init__(self) -> None:
        pass

    def normalize_from_ourairports_identity(
        self,
        airport_id: int | None,
        icao_code: str | None,
        iata_code: str | None,
        wikipedia_link: str | None,
        latitude_deg: float | None,
        longitude_deg: float | None,
    ) -> dict[str, Any]:
        resolved_wiki_title: str | None = None
        resolved_qid: str | None = None
        match_method: str = "direct"
        match_confidence: str = "high"

        if wikipedia_link:
            resolved_wiki_title = _extract_wikipedia_title(wikipedia_link)
            if resolved_wiki_title:
                match_method = "ourairports_wikipedia_link"
            resolved_qid = icao_to_wikidata_qid(icao_code or "") if icao_code else None
        elif icao_code:
            try:
                resolved_qid = icao_to_wikidata_qid(icao_code)
                match_method = "wikidata_icao_lookup"
            except (FetcherError, FetchRateLimitedError):
                match_method = "wikidata_icao_lookup_failed"
                match_confidence = "medium"

        fetch_result = fetch_airport_public_data(
            wikipedia_title=resolved_wiki_title,
            wikidata_qid=resolved_qid,
            icao_code=icao_code,
            iata_code=iata_code,
            match_method=match_method,
        )

        profile = normalize_airport_public_profile(
            airport_id=airport_id,
            icao_code=icao_code,
            iata_code=iata_code,
            wikipedia_response=fetch_result.wikipedia_response,
            wikidata_entity=fetch_result.wikidata_entity,
            match_method=fetch_result.match_method,
            match_confidence=fetch_result.match_confidence,
            wikidata_qid=fetch_result.wikidata_qid,
            wikipedia_title=resolved_wiki_title,
        )

        return self._payload_to_dict(profile)

    def normalize_from_fetch_result(
        self,
        airport_id: int | None,
        icao_code: str | None,
        iata_code: str | None,
        fetch_result: FetchResult,
    ) -> dict[str, Any]:
        profile = normalize_airport_public_profile(
            airport_id=airport_id,
            icao_code=icao_code,
            iata_code=iata_code,
            wikipedia_response=fetch_result.wikipedia_response,
            wikidata_entity=fetch_result.wikidata_entity,
            match_method=fetch_result.match_method,
            match_confidence=fetch_result.match_confidence,
            wikidata_qid=fetch_result.wikidata_qid,
        )
        return self._payload_to_dict(profile)

    def _payload_to_dict(self, profile: AirportPublicProfilePayload) -> dict[str, Any]:
        result = asdict(profile)
        result["interesting_facts"] = [
            asdict(f) for f in profile.interesting_facts
        ]
        if profile.match:
            result["match"] = asdict(profile.match)
        return result


def _extract_wikipedia_title(wikipedia_link: str) -> str | None:
    if not wikipedia_link:
        return None
    if "/wiki/" not in wikipedia_link:
        return None
    try:
        title = wikipedia_link.split("/wiki/")[-1]
        return title.replace("_", " ")
    except (ValueError, IndexError):
        return None


def extract_interesting_facts_from_summary(
    summary_text: str | None,
) -> list[InterestingFact]:
    if not summary_text:
        return []
    return []


def build_match_metadata(
    method: str,
    confidence: str,
    wikidata_qid: str | None = None,
    wikipedia_title: str | None = None,
    reason: str | None = None,
) -> MatchMetadata:
    return MatchMetadata(
        method=method,
        confidence=confidence,
        wikidata_qid=wikidata_qid,
        wikipedia_title=wikipedia_title,
        reason=reason,
    )