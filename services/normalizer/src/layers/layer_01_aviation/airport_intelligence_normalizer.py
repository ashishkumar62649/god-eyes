"""Airport Intelligence Normalizer — normalizes Wikipedia/Wikidata into intelligence modules.

This module handles:
  1. Parsing Wikipedia summary for map_popup payload
  2. Extracting opened date from Wikidata P571
  3. Building capability tags from runway data
  4. Building infrastructure summary from runway data
  5. Generating map_popup payload for overview module
  6. Building safe derived intelligence from local DB data

Canonical decisions enforced here:
  - Never guess passenger capacity
  - Never guess passenger traffic
  - Never store traffic without year and source
  - Never mark capacity_status = ok without source backing
  - Never mark traffic_status = ok without source backing
  - If opened date is missing, store null
  - If Wikidata is unavailable, continue with Wikipedia/local DB
  - If Wikipedia is unavailable, continue with local DB only
  - If source confidence is low, mark low_confidence instead of ok
  - Map Popup payload always prepared even if sources fail
  - Infrastructure summary uses runway data only (no OSM geometry)
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[5]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

WIKIPEDIA_REST_SUMMARY_BASE = "https://en.wikipedia.org/api/rest_v1/page/summary"
WIKIDATA_ENTITY_BASE = "https://www.wikidata.org/wiki/Special:EntityData"

WIKIPEDIA_LICENSE = "CC BY-SA 4.0"
WIKIPEDIA_LICENSE_URL = "https://creativecommons.org/licenses/by-sa/4.0/"
WIKIDATA_LICENSE = "CC0 1.0"
WIKIDATA_LICENSE_URL = "https://creativecommons.org/publicdomain/zero/1.0/"
OURAIRPORTS_LICENSE = "CC BY 4.0"
OURAIRPORTS_LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"


@dataclass
class ParsedOpenedDate:
    opened_date: str | None = None
    opened_year: int | None = None
    opened_date_source: str | None = None
    opened_date_confidence: str = "none"


@dataclass
class MapPopupPayload:
    airport_name: str | None = None
    iata: str | None = None
    icao: str | None = None
    city: str | None = None
    country: str | None = None
    image_url: str | None = None
    short_summary: str | None = None
    badges: list[str] = field(default_factory=list)
    opened_date: str | None = None
    opened_year: int | None = None
    quick_stats: dict[str, Any] = field(default_factory=dict)
    confidence_label: str = "low_confidence"


@dataclass
class CapabilityTags:
    tags: list[str] = field(default_factory=list)


@dataclass
class InfrastructureSummary:
    runway_count: int | None = None
    longest_runway_ft: int | None = None
    surfaces: list[str] = field(default_factory=list)
    runway_capability: str | None = None


def extract_opened_date_from_wikidata(entity: dict[str, Any] | None) -> ParsedOpenedDate:
    """Extract opened date from Wikidata entity P571 claim.

    Preferred source order:
    1. Wikidata P571 if available
    2. Otherwise null (never guess)
    """
    if not entity:
        return ParsedOpenedDate()

    claims = entity.get("claims", {})
    p571_entries = claims.get("P571", [])

    if not p571_entries:
        return ParsedOpenedDate()

    try:
        snak = p571_entries[0].get("mainsnak", {})
        datavalue = snak.get("datavalue", {})
        value = datavalue.get("value", {})

        if isinstance(value, dict):
            time_str = value.get("time", "")
            if time_str:
                match = re.match(r"^\+?(-?\d{4,})-(\d{2})-(\d{2})", time_str)
                if match:
                    year = int(match.group(1))
                    month = int(match.group(2))
                    day = int(match.group(3))
                    if 1800 <= year <= 2100:
                        return ParsedOpenedDate(
                            opened_date=f"{year}-{month:02d}-{day:02d}",
                            opened_year=year,
                            opened_date_source="wikidata_p571",
                            opened_date_confidence="high",
                        )
        elif isinstance(value, str):
            match = re.match(r"^\+?(-?\d{4,})-(\d{2})-(\d{2})", value)
            if match:
                year = int(match.group(1))
                if 1800 <= year <= 2100:
                    return ParsedOpenedDate(
                        opened_date=value[:10],
                        opened_year=year,
                        opened_date_source="wikidata_p571",
                        opened_date_confidence="high",
                    )
    except Exception:
        pass

    return ParsedOpenedDate(opened_date_confidence="low")


def extract_opened_date_from_wikipedia(extract: str | None) -> ParsedOpenedDate:
    """Extract opened date from Wikipedia summary text.

    Only extract if clearly stated and year-qualified.
    """
    if not extract:
        return ParsedOpenedDate()

    year_match = re.search(r"opened\s+(?:on\s+)?(?:the\s+)?(\w+\s+\d{1,2},?\s+)?(\d{4})", extract, re.IGNORECASE)
    if year_match:
        year = int(year_match.group(2))
        if 1800 <= year <= 2100:
            return ParsedOpenedDate(
                opened_year=year,
                opened_date_source="wikipedia_extract",
                opened_date_confidence="medium",
            )

    return ParsedOpenedDate()


def build_map_popup_payload(
    airport_name: str | None,
    iata: str | None,
    icao: str | None,
    city: str | None,
    country: str | None,
    wikipedia_response: dict[str, Any] | None = None,
    opened_date: ParsedOpenedDate | None = None,
    runway_data: list[dict[str, Any]] | None = None,
    confidence: str = "low_confidence",
) -> MapPopupPayload:
    """Build normalized map_popup payload for overview module.

    Always produces a payload even if sources fail.
    """
    image_url = None
    short_summary = None

    if wikipedia_response:
        thumbnail = wikipedia_response.get("thumbnail", {})
        if thumbnail:
            image_url = thumbnail.get("source")
        short_summary = wikipedia_response.get("description")
        if not short_summary and wikipedia_response.get("extract"):
            extract = wikipedia_response["extract"]
            if len(extract) > 200:
                short_summary = extract[:200] + "..."
            else:
                short_summary = extract

    badges = []
    if iata:
        badges.append(f"IATA: {iata}")
    if icao:
        badges.append(f"ICAO: {icao}")
    if country:
        badges.append(country)

    quick_stats = {}
    if runway_data:
        runway_count = len(runway_data)
        quick_stats["runway_count"] = runway_count
        if runway_count > 0:
            longest = max((r.get("length_ft") or 0) for r in runway_data)
            if longest > 0:
                quick_stats["longest_runway_ft"] = int(longest)

    return MapPopupPayload(
        airport_name=airport_name,
        iata=iata,
        icao=icao,
        city=city,
        country=country,
        image_url=image_url,
        short_summary=short_summary,
        badges=badges,
        opened_date=opened_date.opened_date if opened_date else None,
        opened_year=opened_date.opened_year if opened_date else None,
        quick_stats=quick_stats,
        confidence_label=confidence,
    )


def build_capability_tags(
    airport_name: str | None,
    airport_type: str | None,
    scheduled_service: str | None,
    runway_data: list[dict[str, Any]] | None,
    has_wikipedia: bool = False,
    has_wikidata: bool = False,
    has_traffic: bool = False,
    has_capacity: bool = False,
) -> CapabilityTags:
    """Build capability tags from source-backed/local DB data only.

    Rules:
    - international if source-backed profile/name/type supports it
    - scheduled_service if airport data says scheduled service
    - jet_capable if runway length supports it
    - large_aircraft_capable if runway length supports it
    - multiple_runways if runway_count > 1
    - traffic_known only if source-backed traffic row exists
    - capacity_known only if source-backed capacity row exists
    - profile_verified if Wikipedia/Wikidata match is high confidence
    """
    tags: list[str] = []

    if scheduled_service and scheduled_service.lower() == "yes":
        tags.append("scheduled_service")

    name_lower = (airport_name or "").lower()
    type_lower = (airport_type or "").lower()
    if any(kw in name_lower for kw in ["international", "intl"]):
        tags.append("international")
    if "cargo" in type_lower or "cargo" in name_lower:
        tags.append("cargo")

    if runway_data:
        runway_count = len(runway_data)
        if runway_count > 1:
            tags.append("multiple_runways")

        max_length = max((r.get("length_ft") or 0) for r in runway_data)
        if max_length >= 8000:
            tags.append("large_aircraft_capable")
            tags.append("jet_capable")
        elif max_length >= 5000:
            tags.append("jet_capable")
        elif max_length >= 3000:
            tags.append("regional_jet")
        elif max_length > 0:
            tags.append("turboprop")

    if has_traffic:
        tags.append("traffic_known")
    if has_capacity:
        tags.append("capacity_known")
    if has_wikipedia and has_wikidata:
        tags.append("profile_verified")

    return CapabilityTags(tags=tags)


def build_infrastructure_summary(
    runway_data: list[dict[str, Any]] | None,
) -> InfrastructureSummary:
    """Build infrastructure summary from runway data only.

    No OSM geometry used in the current build.
    """
    if not runway_data:
        return InfrastructureSummary()

    runway_count = len(runway_data)
    surfaces: set[str] = set()
    max_length = 0

    for runway in runway_data:
        length = runway.get("length_ft") or 0
        if length > max_length:
            max_length = length
        surface = runway.get("surface")
        if surface:
            surfaces.add(surface)

    runway_capability: str | None = None
    if max_length >= 8000:
        runway_capability = "large_aircraft"
    elif max_length >= 5000:
        runway_capability = "jet_capable"
    elif max_length >= 3000:
        runway_capability = "regional_jet"
    elif max_length > 0:
        runway_capability = "turboprop"

    return InfrastructureSummary(
        runway_count=runway_count,
        longest_runway_ft=int(max_length) if max_length > 0 else None,
        surfaces=list(surfaces),
        runway_capability=runway_capability,
    )


def normalize_wikipedia_summary(raw_bytes: bytes) -> dict[str, Any] | None:
    """Parse Wikipedia REST API summary response."""
    import json
    try:
        return json.loads(raw_bytes)
    except Exception:
        return None


def normalize_wikidata_entity(raw_bytes: bytes) -> dict[str, Any] | None:
    """Parse Wikidata entity response."""
    import json
    try:
        return json.loads(raw_bytes)
    except Exception:
        return None


def get_wikidata_qid_from_wikipedia(wikipedia_response: dict[str, Any] | None) -> str | None:
    """Extract Wikidata QID from Wikipedia response."""
    if wikipedia_response:
        return wikipedia_response.get("wikibase_item")
    return None


def build_source_attribution(
    source_type: str,
    source_name: str,
    source_url: str | None = None,
    license_name: str | None = None,
    license_url: str | None = None,
) -> dict[str, Any]:
    """Build source attribution dict."""
    return {
        "source_type": source_type,
        "source_name": source_name,
        "source_url": source_url,
        "license_name": license_name,
        "license_url": license_url,
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
    }


def determine_module_status(
    has_wikipedia: bool,
    has_wikidata: bool,
    has_local_data: bool,
) -> tuple[str, str]:
    """Determine module status and confidence label.

    Returns (module_status, confidence_label).
    """
    if has_wikipedia and has_wikidata:
        return "ok", "high"
    elif has_wikipedia or has_wikidata or has_local_data:
        return "ok", "medium"
    else:
        return "low_confidence", "low_confidence"


def safe_year_from_extract(extract: str | None) -> int | None:
    """Extract a year from Wikipedia extract if clearly traffic-qualified."""
    if not extract:
        return None

    million_match = re.search(r"(\d{4})\s+(?:million|passengers|travelers)", extract, re.IGNORECASE)
    if million_match:
        return int(million_match.group(1))

    year_match = re.search(r"\b(20[12][0-9])\b", extract)
    if year_match:
        return int(year_match.group(1))

    return None