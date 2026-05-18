"""Schemas and pure functions for airport public profile enrichment.

This module defines the canonical shapes for Wikipedia/Wikidata API responses
and the normalized AirportPublicProfilePayload used by the fetcher and normalizer.

No database I/O occurs here — only pure data transformation functions.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any


LAYER_ID = "layer_01_aviation"
SOURCE_ID = "airport_public_enrichment"
WIKIMEDIA_USER_AGENT = (
    "god-eyes/1.0 (https://github.com/anomalyco/god-eyes; god-eyes@example.com) "
    "WikipediaEnrichmentFetcher/1.0"
)
WIKIPEDIA_REST_SUMMARY_BASE = "https://en.wikipedia.org/api/rest_v1/page/summary"
WIKIDATA_ENTITY_BASE = "https://www.wikidata.org/wiki/Special:EntityData"
WIKIDATA_SPARQL_ENDPOINT = "https://query.wikidata.org/sparql"
WIKIDATA_SPARQL_ACCEPT = "application/sparql-results+json"

WIKIDATA_PROPERTY_MAP = {
    "P571": "opened_date",
    "P137": "operator",
    "P127": "owner",
    "P856": "official_website",
    "P18": "image_url",
    "P239": "icao_code",
    "P238": "iata_code",
    "P625": "coordinate_location",
}


@dataclass(frozen=True)
class InterestingFact:
    fact: str
    source: str
    property_id: str | None = None


@dataclass(frozen=True)
class WikipediaAttribution:
    title: str
    url: str
    license: str = "CC BY-SA 4.0"
    license_url: str = "https://creativecommons.org/licenses/by-sa/4.0/"
    revision_id: int | None = None
    page_id: int | None = None


@dataclass(frozen=True)
class WikidataAttribution:
    qid: str
    url: str
    license: str = "CC0 1.0"
    license_url: str = "https://creativecommons.org/publicdomain/zero/1.0/"


@dataclass(frozen=True)
class SourceAttribution:
    wikipedia: WikipediaAttribution
    wikidata: WikidataAttribution | None = None
    retrieved_at: str | None = None


@dataclass(frozen=True)
class WikipediaSummaryResponse:
    title: str
    page_id: int
    revision_id: int
    extract: str
    description: str | None
    thumbnail_url: str | None
    content_url: str
    tid: str | None = None


@dataclass(frozen=True)
class WikidataPropertyValue:
    property_id: str
    value: str | None
    qualifiers: dict[str, list[str]] | None = None


@dataclass(frozen=True)
class WikidataEntityData:
    qid: str
    label: str | None
    description: str | None
    properties: dict[str, list[WikidataPropertyValue]]


@dataclass(frozen=True)
class MatchMetadata:
    method: str
    confidence: str
    wikidata_qid: str | None = None
    wikipedia_title: str | None = None
    reason: str | None = None


@dataclass(frozen=True)
class AirportPublicProfilePayload:
    airport_id: int | None
    icao_code: str | None
    iata_code: str | None
    wikipedia_title: str | None
    wikipedia_url: str | None
    wikidata_qid: str | None
    summary: str | None
    short_description: str | None
    interesting_facts: list[InterestingFact] = field(default_factory=list)
    opened_date: str | None = None
    operator: str | None = None
    owner: str | None = None
    official_website: str | None = None
    image_url: str | None = None
    attribution: dict[str, Any] | None = None
    match: MatchMetadata | None = None
    fetched_at: str | None = None
    expires_at: str | None = None
    wikipedia_revision_id: int | None = None
    wikipedia_page_id: int | None = None
    wikidata_last_modified: str | None = None
    change_hash: str | None = None


def parse_wikipedia_summary_response(raw_json: bytes | str) -> WikipediaSummaryResponse:
    data = json.loads(raw_json) if isinstance(raw_json, bytes) else json.loads(raw_json)
    content_urls = data.get("content_urls", {}).get("desktop", {}).get("page", "")
    thumbnail = data.get("thumbnail", {})
    return WikipediaSummaryResponse(
        title=data.get("title", ""),
        page_id=data.get("pageid", 0),
        revision_id=data.get("revision", 0),
        extract=data.get("extract", ""),
        description=data.get("description"),
        thumbnail_url=thumbnail.get("source") if thumbnail else None,
        content_url=content_urls,
        tid=data.get("tid"),
    )


def parse_wikidata_entity_response(
    raw_json: bytes | str,
) -> WikidataEntityData:
    data = json.loads(raw_json) if isinstance(raw_json, bytes) else json.loads(raw_json)
    entities = data.get("entities", {})
    if not entities:
        raise ValueError("No entities found in Wikidata response")
    entity = next(iter(entities.values()))
    entity_id = entity.get("id", "")
    label = entity.get("labels", {}).get("en", {}).get("value")
    description = entity.get("descriptions", {}).get("en", {}).get("value")
    claims = entity.get("claims", {})
    properties: dict[str, list[WikidataPropertyValue]] = {}
    for prop_id, prop_entries in claims.items():
        values: list[WikidataPropertyValue] = []
        for entry in prop_entries:
            mainsnak = entry.get("mainsnak", {})
            datavalue = mainsnak.get("datavalue", {})
            value: str | None = None
            if datavalue.get("type") == "text":
                value = datavalue.get("value")
            elif datavalue.get("type") == "wikibase-entityid":
                value = datavalue.get("value", {}).get("id")
            elif datavalue.get("type") == "time":
                time_val = datavalue.get("value", {}).get("time", "")
                value = time_val.lstrip("+") if time_val else None
            elif datavalue.get("type") == "globecoordinate":
                coord = datavalue.get("value", {})
                value = f"{coord.get('latitude')},{coord.get('longitude')}"
            qualifiers: dict[str, list[str]] = {}
            for qual_prop, qual_list in (entry.get("qualifiers", {}) or {}).items():
                qualifiers[qual_prop] = [
                    q.get("datavalue", {}).get("value", {}).get("id", q.get("datavalue", {}).get("value", ""))
                    for q in qual_list
                ]
            values.append(WikidataPropertyValue(
                property_id=prop_id,
                value=value,
                qualifiers=qualifiers if qualifiers else None,
            ))
        if values:
            properties[prop_id] = values
    return WikidataEntityData(
        qid=entity_id,
        label=label,
        description=description,
        properties=properties,
    )


def build_interesting_facts_from_wikidata(
    entity: WikidataEntityData,
) -> list[InterestingFact]:
    facts: list[InterestingFact] = []
    for prop_id, prop_label in [
        ("P571", "opened_date"),
        ("P137", "operator"),
        ("P127", "owner"),
    ]:
        if prop_id in entity.properties:
            for pv in entity.properties[prop_id]:
                if pv.value:
                    if prop_id == "P571":
                        fact_str = f"Opened: {pv.value}"
                    elif prop_id == "P137":
                        fact_str = f"Operated by {pv.value}"
                    elif prop_id == "P127":
                        fact_str = f"Owned by {pv.value}"
                    else:
                        fact_str = pv.value
                    facts.append(InterestingFact(
                        fact=fact_str,
                        source="wikidata",
                        property_id=prop_id,
                    ))
    official_website_prop = entity.properties.get("P856")
    if official_website_prop and official_website_prop[0].value:
        facts.append(InterestingFact(
            fact=f"Official website: {official_website_prop[0].value}",
            source="wikidata",
            property_id="P856",
        ))
    return facts


def normalize_airport_public_profile(
    airport_id: int | None,
    icao_code: str | None,
    iata_code: str | None,
    wikipedia_response: WikipediaSummaryResponse | None,
    wikidata_entity: WikidataEntityData | None,
    match_method: str,
    match_confidence: str,
    wikidata_qid: str | None = None,
    wikipedia_title: str | None = None,
    reason: str | None = None,
    now_utc: datetime | None = None,
    ttl_days: int = 30,
) -> AirportPublicProfilePayload:
    if now_utc is None:
        now_utc = datetime.now(timezone.utc)
    fetched_at = now_utc.isoformat()
    import datetime as dt
    expiry = now_utc + dt.timedelta(days=ttl_days)
    expires_at = expiry.isoformat()
    summary = wikipedia_response.extract if wikipedia_response else None
    short_description = wikipedia_response.description if wikipedia_response else None
    image_url = wikipedia_response.thumbnail_url if wikipedia_response else None
    wikipedia_url = wikipedia_response.content_url if wikipedia_response else None
    wikipedia_revision_id = wikipedia_response.revision_id if wikipedia_response else None
    wikipedia_page_id = wikipedia_response.page_id if wikipedia_response else None
    interesting_facts: list[InterestingFact] = []
    opened_date: str | None = None
    operator: str | None = None
    owner: str | None = None
    official_website: str | None = None
    if wikidata_entity:
        interesting_facts = build_interesting_facts_from_wikidata(wikidata_entity)
        if "P571" in wikidata_entity.properties:
            opened_date = wikidata_entity.properties["P571"][0].value
        if "P137" in wikidata_entity.properties:
            operator = wikidata_entity.properties["P137"][0].value
        if "P127" in wikidata_entity.properties:
            owner = wikidata_entity.properties["P127"][0].value
        if "P856" in wikidata_entity.properties:
            official_website = wikidata_entity.properties["P856"][0].value
    attribution: dict[str, Any] | None = None
    if wikipedia_response:
        wikidata_attr_dict: dict[str, Any] | None = None
        if wikidata_entity:
            wikidata_attr_dict = {
                "qid": wikidata_entity.qid,
                "url": f"https://www.wikidata.org/wiki/{wikidata_entity.qid}",
                "license": "CC0 1.0",
                "license_url": "https://creativecommons.org/publicdomain/zero/1.0/",
                "retrieved_at": fetched_at,
            }
        attribution = {
            "wikipedia": {
                "title": wikipedia_response.title,
                "url": wikipedia_response.content_url,
                "license": "CC BY-SA 4.0",
                "license_url": "https://creativecommons.org/licenses/by-sa/4.0/",
                "retrieved_at": fetched_at,
                "revision_id": wikipedia_response.revision_id,
            },
            "wikidata": wikidata_attr_dict,
        }
    match = MatchMetadata(
        method=match_method,
        confidence=match_confidence,
        wikidata_qid=wikidata_qid or (wikidata_entity.qid if wikidata_entity else None),
        wikipedia_title=wikipedia_title or (wikipedia_response.title if wikipedia_response else None),
        reason=reason,
    )
    payload = AirportPublicProfilePayload(
        airport_id=airport_id,
        icao_code=icao_code,
        iata_code=iata_code,
        wikipedia_title=wikipedia_response.title if wikipedia_response else wikipedia_title,
        wikipedia_url=wikipedia_url,
        wikidata_qid=wikidata_qid or (wikidata_entity.qid if wikidata_entity else None),
        summary=summary,
        short_description=short_description,
        interesting_facts=interesting_facts,
        opened_date=opened_date,
        operator=operator,
        owner=owner,
        official_website=official_website,
        image_url=image_url,
        attribution=attribution,
        match=match,
        fetched_at=fetched_at,
        expires_at=expires_at,
        wikipedia_revision_id=wikipedia_revision_id,
        wikipedia_page_id=wikipedia_page_id,
        wikidata_last_modified=None,
    )
    payload_dict = asdict(payload)
    payload_dict["interesting_facts"] = [
        asdict(f) for f in payload.interesting_facts
    ]
    if payload.match:
        payload_dict["match"] = asdict(payload.match)
    change_hash = compute_change_hash(payload_dict)
    return AirportPublicProfilePayload(
        airport_id=payload.airport_id,
        icao_code=payload.icao_code,
        iata_code=payload.iata_code,
        wikipedia_title=payload.wikipedia_title,
        wikipedia_url=payload.wikipedia_url,
        wikidata_qid=payload.wikidata_qid,
        summary=payload.summary,
        short_description=payload.short_description,
        interesting_facts=payload.interesting_facts,
        opened_date=payload.opened_date,
        operator=payload.operator,
        owner=payload.owner,
        official_website=payload.official_website,
        image_url=payload.image_url,
        attribution=payload.attribution,
        match=payload.match,
        fetched_at=payload.fetched_at,
        expires_at=payload.expires_at,
        wikipedia_revision_id=payload.wikipedia_revision_id,
        wikipedia_page_id=payload.wikipedia_page_id,
        wikidata_last_modified=payload.wikidata_last_modified,
        change_hash=change_hash,
    )


def compute_change_hash(payload_dict: dict[str, Any]) -> str:
    canonical_fields = [
        "summary",
        "short_description",
        "opened_date",
        "operator",
        "owner",
        "official_website",
        "wikidata_qid",
        "wikipedia_revision_id",
    ]
    values = [str(payload_dict.get(k, "")) for k in canonical_fields]
    combined = "|".join(values)
    return hashlib.sha256(combined.encode("utf-8")).hexdigest()


def build_source_attribution(
    wikipedia: WikipediaSummaryResponse | None,
    wikidata: WikidataEntityData | None,
    fetched_at: str,
) -> dict[str, Any]:
    result: dict[str, Any] = {}
    if wikipedia:
        result["wikipedia"] = {
            "title": wikipedia.title,
            "url": wikipedia.content_url,
            "license": "CC BY-SA 4.0",
            "license_url": "https://creativecommons.org/licenses/by-sa/4.0/",
            "retrieved_at": fetched_at,
            "revision_id": wikipedia.revision_id,
        }
    if wikidata:
        result["wikidata"] = {
            "qid": wikidata.qid,
            "url": f"https://www.wikidata.org/wiki/{wikidata.qid}",
            "license": "CC0 1.0",
            "license_url": "https://creativecommons.org/publicdomain/zero/1.0/",
            "retrieved_at": fetched_at,
        }
    return result


def build_wikipedia_summary_url(wikipedia_title: str) -> str:
    encoded_title = wikipedia_title.replace(" ", "_")
    return f"{WIKIPEDIA_REST_SUMMARY_BASE}/{encoded_title}"


def build_wikidata_entity_url(qid: str, format: str = "json") -> str:
    return f"{WIKIDATA_ENTITY_BASE}/{qid}.{format}"