"""Airport source endpoint probe — WO-041 — exact endpoint validation.

This script tests real HTTP endpoints for all free airport data sources.
It is a research/dry-run tool — no database writes.

User-Agent on every request: GodEyes/0.1 (operations@madmarketingmedia.com)

Endpoints tested:
  SOURCE 1: OurAirports CSV URLs (davidmegginson.github.io)
  SOURCE 2: Wikipedia Search + Summary REST API
  SOURCE 3: Wikidata Entity Data + wbgetentities
  SOURCE 4: OSM Overpass (multiple public endpoints)
  SOURCE 5: BTS TranStats (form-based, not REST)
  SOURCE 6: Eurostat API (avia_paoc dataset)
  SOURCE 7: AviationWeather METAR/TAF/stationinfo
  SOURCE 8: Official airport websites

Usage:
  python airport_source_endpoint_probe.py --all --show-raw
  python airport_source_endpoint_probe.py --airport-ident KJFK --iata JFK \\
      --name "John F. Kennedy International Airport" \\
      --lat 40.6413 --lon -73.7781 --show-raw
  python airport_source_endpoint_probe.py --all --json-output results.json

Test airports:
  KJFK / JFK / John F. Kennedy International Airport / 40.6413 / -73.7781
  KBDL / BDL / Bradley International Airport / 41.9389 / -72.6832
  OMDB / DXB / Dubai International Airport / 25.2532 / 55.3657
  EGLL / LHR / London Heathrow Airport / 51.4700 / -0.4543
  CYQB / YQB / Quebec City Jean Lesage International Airport / 46.7911 / -71.3933

All sources: API key = NO.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[5]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

DEFAULT_USER_AGENT = "GodEyes/0.1 (operations@madmarketingmedia.com)"

OURAIRPORTS_BASE = "https://davidmegginson.github.io/ourairports-data"
WIKIPEDIA_SEARCH_BASE = "https://en.wikipedia.org/w/rest.php/v1/search/page"
WIKIPEDIA_SUMMARY_BASE = "https://en.wikipedia.org/api/rest_v1/page/summary"
WIKIDATA_ENTITY_BASE = "https://www.wikidata.org/wiki/Special:EntityData"
WIKIDATA_API_BASE = "https://www.wikidata.org/w/api.php"
OSM_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
]
BTS_DBINFO_URL = "https://www.transtats.bts.gov/DatabaseInfo.asp"
BTS_DL_SELECT_URL = "https://www.transtats.bts.gov/DL_SelectFields.aspx"
EUROSTAT_BASE = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/avia_paoc"
AV_METAR_BASE = "https://aviationweather.gov/api/data/metar"
AV_TAF_BASE = "https://aviationweather.gov/api/data/taf"
AV_STATION_BASE = "https://aviationweather.gov/api/data/stationinfo"

WIKIDATA_THROTTLE_SECONDS = 2.0
WIKIDATA_LAST_REQUEST_TIME: float = 0.0


@dataclass
class EndpointProbeResult:
    source_name: str
    endpoint: str
    request_method: str
    api_key_required: bool
    user_agent_used: bool
    http_status: int | None
    latency_ms: int | None
    response_size: int | None
    fields_found: list[str] = field(default_factory=list)
    fields_missing: list[str] = field(default_factory=list)
    status: str = "fail"
    recommended_use: str = "unknown"
    failure_reason: str | None = None
    next_fix: str | None = None
    confidence_notes: list[str] = field(default_factory=list)
    raw_snippet: str | None = None


@dataclass
class AirportProbeResults:
    airport_ident: str
    airport_iata: str | None
    airport_name: str
    lat: float | None
    lon: float | None
    probes: dict[str, EndpointProbeResult]
    probed_at: str


def _throttle_wikidata():
    global WIKIDATA_LAST_REQUEST_TIME
    elapsed = time.time() - WIKIDATA_LAST_REQUEST_TIME
    if elapsed < WIKIDATA_THROTTLE_SECONDS:
        time.sleep(WIKIDATA_THROTTLE_SECONDS - elapsed)
    WIKIDATA_LAST_REQUEST_TIME = time.time()


def _make_request(
    url: str,
    method: str = "GET",
    data: bytes | None = None,
    headers: dict[str, str] | None = None,
    timeout: int = 20,
    user_agent: str | None = None,
) -> tuple[bytes, int, dict[str, str]]:
    ua = user_agent or DEFAULT_USER_AGENT
    hdrs = {**(headers or {}), "User-Agent": ua}
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            latency_ms = int((time.time() - start) * 1000)
            resp_headers = dict(resp.headers)
            return raw, resp.status, latency_ms, resp_headers
    except urllib.error.HTTPError as exc:
        latency_ms = int((time.time() - start) * 1000)
        return b"", exc.code, latency_ms, {}
    except TimeoutError:
        latency_ms = int((time.time() - start) * 1000)
        return b"", 408, latency_ms, {}
    except Exception:
        latency_ms = int((time.time() - start) * 1000)
        return b"", 0, latency_ms, {}


# ─────────────────────────────────────────────────────────────────────────────
# SOURCE 1 — OurAirports CSV
# ─────────────────────────────────────────────────────────────────────────────


class OurAirportsSourceProbe:
    name = "OurAirports CSV"
    recommended_use = "click_safe_via_db"

    FILES = [
        ("airports", "airports.csv"),
        ("runways", "runways.csv"),
        ("airport-frequencies", "airport-frequencies.csv"),
        ("navaids", "navaids.csv"),
        ("countries", "countries.csv"),
        ("regions", "regions.csv"),
    ]

    AIRPORT_COLUMNS = {
        "id", "ident", "type", "name", "latitude_deg", "longitude_deg",
        "elevation_ft", "iso_country", "iso_region", "municipality",
        "scheduled_service", "gps_code", "iata_code", "local_code",
        "home_link", "wikipedia_link", "keywords",
    }
    RUNWAY_COLUMNS = {
        "id", "airport_ref", "airport_ident", "length_ft", "width_ft",
        "surface", "lighted", "closed", "le_ident", "le_latitude_deg",
        "le_longitude_deg", "he_latitude_deg", "he_longitude_deg",
    }

    def probe(self, lat: float | None, lon: float | None) -> EndpointProbeResult:
        result = EndpointProbeResult(
            source_name=self.name,
            endpoint=f"{OURAIRPORTS_BASE}/",
            request_method="HEAD",
            api_key_required=False,
            user_agent_used=True,
            http_status=None,
            latency_ms=None,
            response_size=None,
            recommended_use=self.recommended_use,
        )
        try:
            raw, status, latency, _ = _make_request(
                f"{OURAIRPORTS_BASE}/airports.csv",
                user_agent=DEFAULT_USER_AGENT,
            )
            result.http_status = status
            result.latency_ms = latency
            result.response_size = len(raw)
            if status == 200:
                result.status = "pass"
                result.fields_found = self._probe_csv_columns(raw)
                result.confidence_notes.append(f"CSV size: {len(raw):,} bytes")
            else:
                result.status = "fail"
                result.failure_reason = f"HTTP {status}"
        except Exception as exc:
            result.status = "fail"
            result.failure_reason = str(exc)
        return result

    def _probe_csv_columns(self, raw: bytes) -> list[str]:
        text = raw.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        if reader.fieldnames:
            return list(reader.fieldnames)
        return []


# ─────────────────────────────────────────────────────────────────────────────
# SOURCE 2 — Wikipedia Search + Summary
# ─────────────────────────────────────────────────────────────────────────────


class WikipediaEndpointProbe:
    name = "Wikipedia REST API"
    recommended_use = "click_safe"

    def probe(
        self,
        airport_ident: str,
        iata: str | None,
        name: str,
        lat: float | None,
        lon: float | None,
    ) -> EndpointProbeResult:
        result = EndpointProbeResult(
            source_name=self.name,
            endpoint=WIKIPEDIA_SUMMARY_BASE + "/{title}",
            request_method="GET",
            api_key_required=False,
            user_agent_used=True,
            http_status=None,
            latency_ms=None,
            response_size=None,
            recommended_use=self.recommended_use,
        )
        encoded_name = urllib.parse.quote(name, safe="")
        summary_url = f"{WIKIPEDIA_SUMMARY_BASE}/{encoded_name}"
        raw, status, latency, _ = _make_request(summary_url, user_agent=DEFAULT_USER_AGENT)
        result.http_status = status
        result.latency_ms = latency
        result.endpoint = summary_url
        result.response_size = len(raw)
        if status == 200:
            result.status = "pass"
            data = json.loads(raw)
            result.fields_found = self._extract_fields(data, data.get("extract", ""))
            result.confidence_notes.append(f"page_id={data.get('pageid')}")
            result.confidence_notes.append(f"wikibase_item={data.get('wikibase_item')}")
            extract = data.get("extract", "")
            if not self._has_year_qualified_traffic(extract):
                result.fields_missing.append("traffic_data")
                result.confidence_notes.append(
                    "WARNING: no year-qualified traffic data in extract"
                )
            if data.get("wikibase_item"):
                result.fields_found.append("wikidata_qid")
        elif status == 404:
            result.status = "fail"
            result.failure_reason = (
                f"404 Not Found for '{name}'. "
                "Airport may not have a Wikipedia article. "
                "Next fix: try search endpoint first."
            )
            result.next_fix = (
                "Use Wikipedia search endpoint to find correct page title, "
                "then use summary. Also check accented characters in name."
            )
        else:
            result.status = "fail"
            result.failure_reason = f"HTTP {status}"
        return result

    def _extract_fields(self, data: dict, extract: str) -> list[str]:
        found = []
        if data.get("title"):
            found.append("title")
        if extract:
            found.append("summary")
        if data.get("description"):
            found.append("description")
        if data.get("thumbnail"):
            found.append("thumbnail")
        if data.get("originalimage"):
            found.append("original_image")
        if data.get("coordinates"):
            found.append("coordinates")
        if data.get("content_urls", {}).get("desktop", {}).get("page"):
            found.append("article_url")
        if data.get("wikibase_item"):
            found.append("wikidata_qid")
        if data.get("pageid"):
            found.append("page_id")
        if data.get("revision"):
            found.append("revision_id")
        if "passenger" in extract.lower() or "million" in extract.lower():
            found.append("traffic_hints")
        if "cargo" in extract.lower():
            found.append("cargo_hints")
        if "movement" in extract.lower():
            found.append("movement_hints")
        if re.search(r"opened?\s+\d{4}", extract, re.IGNORECASE):
            found.append("opened_date_hints")
        return found

    def _has_year_qualified_traffic(self, extract: str) -> bool:
        million_pattern = re.search(r"(\d+\.?\d*)\s+million", extract)
        year_pattern = re.search(r"20[2-3][0-9]", extract)
        return bool(million_pattern and year_pattern)

    def probe_search(
        self,
        airport_ident: str,
        iata: str | None,
        name: str,
    ) -> EndpointProbeResult:
        result = EndpointProbeResult(
            source_name=self.name + " (search)",
            endpoint=WIKIPEDIA_SEARCH_BASE,
            request_method="GET",
            api_key_required=False,
            user_agent_used=True,
            http_status=None,
            latency_ms=None,
            response_size=None,
            recommended_use="click_safe",
        )
        search_queries = [
            name,
            f"{name} airport",
            f"{name} International Airport",
        ]
        best_match = None
        for query in search_queries:
            encoded_q = urllib.parse.quote(query, safe="")
            url = f"{WIKIPEDIA_SEARCH_BASE}?q={encoded_q}&limit=3"
            raw, status, latency, _ = _make_request(url, user_agent=DEFAULT_USER_AGENT)
            result.http_status = status
            result.latency_ms = latency
            result.response_size = len(raw)
            if status == 200:
                data = json.loads(raw)
                pages = data.get("pages", [])
                if pages:
                    best_match = pages[0]
                    result.status = "pass"
                    result.fields_found = ["search_results", "top_match_title"]
                    result.confidence_notes.append(f"top_match={best_match.get('title')}")
                    result.confidence_notes.append(f"key={best_match.get('key')}")
                    break
            else:
                if result.status != "pass":
                    result.status = "fail"
                    result.failure_reason = f"HTTP {status}"
        if not best_match:
            result.status = "fail"
            result.failure_reason = "No search results returned"
        return result


# ─────────────────────────────────────────────────────────────────────────────
# SOURCE 3 — Wikidata Entity Data + API
# ─────────────────────────────────────────────────────────────────────────────


class WikidataEndpointProbe:
    name = "Wikidata REST/API"
    recommended_use = "background_only"

    PROPERTIES = {
        "P571": "opened_date",
        "P137": "operator",
        "P127": "owner",
        "P856": "official_website",
        "P18": "image",
        "P238": "iata_code",
        "P239": "icao_code",
        "P625": "coordinates",
    }

    def probe(
        self,
        airport_ident: str,
        iata: str | None,
        name: str,
        qid: str | None,
    ) -> EndpointProbeResult:
        if not qid:
            return EndpointProbeResult(
                source_name=self.name,
                endpoint=WIKIDATA_ENTITY_BASE + "/{QID}.json",
                request_method="GET",
                api_key_required=False,
                user_agent_used=True,
                http_status=None,
                latency_ms=None,
                response_size=None,
                status="fail",
                recommended_use="background_only",
                failure_reason="No QID provided — need Wikipedia QID or ICAO lookup first",
            )
        _throttle_wikidata()
        url = f"{WIKIDATA_ENTITY_BASE}/{qid}.json"
        result = EndpointProbeResult(
            source_name=self.name,
            endpoint=url,
            request_method="GET",
            api_key_required=False,
            user_agent_used=True,
            http_status=None,
            latency_ms=None,
            response_size=None,
            recommended_use=self.recommended_use,
        )
        raw, status, latency, _ = _make_request(url, user_agent=DEFAULT_USER_AGENT)
        result.http_status = status
        result.latency_ms = latency
        result.response_size = len(raw)
        if status == 200:
            result.status = "pass"
            data = json.loads(raw)
            entity = data.get("entities", {}).get(qid, {})
            claims = entity.get("claims", {})
            found_props, missing_props = self._check_properties(claims)
            result.fields_found = found_props
            result.fields_missing = missing_props
            result.confidence_notes.append(f"properties_found={len(found_props)}/{len(self.PROPERTIES)}")
            if "P1589" in claims:
                result.fields_found.append("passenger_traffic_P1589")
            if "P3878" in claims:
                result.fields_found.append("cargo_tonnage_P3878")
        elif status == 429:
            result.status = "rate_limited"
            result.failure_reason = (
                "HTTP 429 Too Many Requests. "
                "Wikidata is rate-limiting our requests. "
                "Next fix: implement request queue with 2s throttle between requests."
            )
            result.next_fix = (
                "Use a throttle of at least 2 seconds between Wikidata requests. "
                "Or pre-fetch QIDs for top airports monthly. "
                "Or use a local Wikidata JSON dump."
            )
        else:
            result.status = "fail"
            result.failure_reason = f"HTTP {status}"
        return result

    def probe_wbgetentities(
        self,
        qid: str | None,
    ) -> EndpointProbeResult:
        if not qid:
            return EndpointProbeResult(
                source_name=self.name + " (wbgetentities)",
                endpoint=WIKIDATA_API_BASE + "?action=wbgetentities&ids={QID}",
                request_method="GET",
                api_key_required=False,
                user_agent_used=True,
                http_status=None,
                latency_ms=None,
                response_size=None,
                status="fail",
                recommended_use="background_only",
                failure_reason="No QID provided",
            )
        _throttle_wikidata()
        params = urllib.parse.urlencode({
            "action": "wbgetentities",
            "ids": qid,
            "props": "claims|labels|descriptions|sitelinks",
            "languages": "en",
            "format": "json",
        })
        url = f"{WIKIDATA_API_BASE}?{params}"
        result = EndpointProbeResult(
            source_name=self.name + " (wbgetentities)",
            endpoint=url,
            request_method="GET",
            api_key_required=False,
            user_agent_used=True,
            http_status=None,
            latency_ms=None,
            response_size=None,
            recommended_use=self.recommended_use,
        )
        raw, status, latency, _ = _make_request(url, user_agent=DEFAULT_USER_AGENT)
        result.http_status = status
        result.latency_ms = latency
        result.response_size = len(raw)
        if status == 200:
            result.status = "pass"
            data = json.loads(raw)
            entity = data.get("entities", {}).get(qid, {})
            labels = entity.get("labels", {}).get("en", {}).get("value", "")
            result.fields_found = ["label"] if labels else []
            if entity.get("claims"):
                result.fields_found.append("claims")
        elif status == 429:
            result.status = "rate_limited"
            result.failure_reason = "HTTP 429 — Wikidata rate-limited"
            result.next_fix = "Add 2+ second throttle between requests"
        else:
            result.status = "fail"
            result.failure_reason = f"HTTP {status}"
        return result

    def _check_properties(self, claims: dict) -> tuple[list[str], list[str]]:
        found, missing = [], []
        for prop_id, field_name in self.PROPERTIES.items():
            if prop_id in claims:
                found.append(field_name)
            else:
                missing.append(field_name)
        return found, missing


# ─────────────────────────────────────────────────────────────────────────────
# SOURCE 4 — OpenStreetMap / Overpass
# ─────────────────────────────────────────────────────────────────────────────


class OSMOverpassEndpointProbe:
    name = "OpenStreetMap Overpass"
    recommended_use = "background_only"

    OVERPASS_QUERY_TEMPLATE = (
        "[out:json][timeout:25];"
        "("
        "  way[\"aeroway\"=\"aerodrome\"]({s},{w},{n},{e});"
        "  relation[\"aeroway\"=\"aerodrome\"]({s},{w},{n},{e});"
        "  way[\"aeroway\"=\"runway\"]({s},{w},{n},{e});"
        "  way[\"aeroway\"=\"taxiway\"]({s},{w},{n},{e});"
        "  way[\"aeroway\"=\"apron\"]({s},{w},{n},{e});"
        "  way[\"aeroway\"=\"terminal\"]({s},{w},{n},{e});"
        "  way[\"aeroway\"=\"hangar\"]({s},{w},{n},{e});"
        "  node[\"aeroway\"=\"gate\"]({s},{w},{n},{e});"
        "  node[\"aeroway\"=\"helipad\"]({s},{w},{n},{e});"
        ");"
        "out geom;"
    )

    def probe(
        self,
        airport_ident: str,
        lat: float | None,
        lon: float | None,
    ) -> EndpointProbeResult:
        if lat is None or lon is None:
            return EndpointProbeResult(
                source_name=self.name,
                endpoint="(multiple)",
                request_method="POST",
                api_key_required=False,
                user_agent_used=True,
                http_status=None,
                latency_ms=None,
                response_size=None,
                status="fail",
                recommended_use=self.recommended_use,
                failure_reason="lat/lon required for OSM bounding box",
            )
        result = EndpointProbeResult(
            source_name=self.name,
            endpoint="(multiple endpoints tested)",
            request_method="POST",
            api_key_required=False,
            user_agent_used=True,
            http_status=None,
            latency_ms=None,
            response_size=None,
            recommended_use=self.recommended_use,
        )
        s, w, n, e = lon - 0.05, lat - 0.05, lon + 0.05, lat + 0.05
        query = self.OVERPASS_QUERY_TEMPLATE.format(s=s, w=w, n=n, e=e)
        body = f"data={urllib.parse.quote_plus(query)}"
        any_success = False
        all_results: list[dict[str, Any]] = []
        for endpoint_url in OSM_ENDPOINTS:
            req = urllib.request.Request(
                endpoint_url,
                data=body.encode("utf-8"),
                headers={
                    "User-Agent": DEFAULT_USER_AGENT,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                method="POST",
            )
            start = time.time()
            try:
                with urllib.request.urlopen(req, timeout=30) as resp:
                    raw = resp.read()
                    latency = int((time.time() - start) * 1000)
                    data = json.loads(raw)
                    elements = data.get("elements", [])
                    aeroway_types: dict[str, int] = {}
                    for el in elements:
                        aw = el.get("tags", {}).get("aeroway")
                        if aw:
                            aeroway_types[aw] = aeroway_types.get(aw, 0) + 1
                    result.http_status = resp.status
                    result.latency_ms = latency
                    result.response_size = len(raw)
                    result.endpoint = endpoint_url
                    result.fields_found = list(aeroway_types.keys())
                    result.confidence_notes.append(
                        f"endpoint={endpoint_url.split('//')[1].split('/')[0]}, "
                        f"elements={len(elements)}, types={json.dumps(aeroway_types)}"
                    )
                    any_success = True
                    break
            except urllib.error.HTTPError as exc:
                result.confidence_notes.append(
                    f"endpoint={endpoint_url.split('//')[1].split('/')[0]}: HTTP {exc.code}"
                )
                if not any_success:
                    result.http_status = exc.code
                    result.latency_ms = int((time.time() - start) * 1000)
            except Exception as exc:
                result.confidence_notes.append(
                    f"endpoint={endpoint_url.split('//')[1].split('/')[0]}: {exc}"
                )
        if any_success:
            result.status = "pass"
        else:
            result.status = "blocked"
            result.failure_reason = (
                "All Overpass endpoints returned errors. "
                "HTTP 406 indicates global rate-limit or IP block. "
                "Next fix: run own Overpass instance, or use commercial OSM provider."
            )
            result.next_fix = (
                "Option A: self-hosted Overpass (nominatim + overpass) "
                "Option B: Mapbox/Geofabrik OSM data "
                "Option C: skip OSM layout for v1"
            )
        return result


# ─────────────────────────────────────────────────────────────────────────────
# SOURCE 5 — BTS TranStats
# ─────────────────────────────────────────────────────────────────────────────


class BTSTranstatsProbe:
    name = "BTS TranStats"
    recommended_use = "backfill_only"

    def probe(self, airport_ident: str, iata: str | None) -> EndpointProbeResult:
        result = EndpointProbeResult(
            source_name=self.name,
            endpoint=BTS_DBINFO_URL,
            request_method="GET",
            api_key_required=False,
            user_agent_used=True,
            http_status=None,
            latency_ms=None,
            response_size=None,
            recommended_use=self.recommended_use,
        )
        raw, status, latency, _ = _make_request(BTS_DBINFO_URL, user_agent=DEFAULT_USER_AGENT)
        result.http_status = status
        result.latency_ms = latency
        result.response_size = len(raw)
        if status == 200:
            text = raw.decode("utf-8", errors="ignore")
            result.status = "partial"
            result.confidence_notes.append(
                f"BTS page size={len(text):,} chars — form-based, not REST API"
            )
            result.confidence_notes.append(
                "No JSON endpoint found — BTS requires form submission or pre-downloaded CSV"
            )
            result.fields_found = ["form_page"]
            result.fields_missing = [
                "json_api", "direct_csv_download", "simple_rest_endpoint"
            ]
            result.failure_reason = (
                "BTS is a form-based interface, not a REST API. "
                "No JSON endpoint accessible without form submission. "
                "Next fix: pre-download T-100 CSV monthly from TranStats website."
            )
            result.next_fix = (
                "Download BTS T-100 dataset monthly to S3, then read locally. "
                "Alternatively use BTS API via form parameters — requires query builder."
            )
        else:
            result.status = "fail"
            result.failure_reason = f"HTTP {status}"
        return result


# ─────────────────────────────────────────────────────────────────────────────
# SOURCE 6 — Eurostat
# ─────────────────────────────────────────────────────────────────────────────


class EurostatProbe:
    name = "Eurostat API"
    recommended_use = "backfill_only"

    def probe(self, iata: str | None) -> EndpointProbeResult:
        result = EndpointProbeResult(
            source_name=self.name,
            endpoint=EUROSTAT_BASE,
            request_method="GET",
            api_key_required=False,
            user_agent_used=True,
            http_status=None,
            latency_ms=None,
            response_size=None,
            recommended_use=self.recommended_use,
        )
        base_url = (
            f"{EUROSTAT_BASE}"
            f"?format=JSON&lang=en"
        )
        raw, status, latency, _ = _make_request(base_url, user_agent=DEFAULT_USER_AGENT)
        result.http_status = status
        result.latency_ms = latency
        result.response_size = len(raw)
        if status == 200:
            result.status = "pass"
            result.fields_found = ["avia_paoc_dataset"]
            result.confidence_notes.append(
                f"Eurostat base dataset accessible — size={len(raw):,} bytes"
            )
        elif status == 400:
            result.status = "fail"
            result.failure_reason = "HTTP 400 Bad Request — query parameters incorrect"
            result.next_fix = (
                "Discover required dimensions via dataset browser first. "
                "Eurostat API requires specific dimension codes: "
                "geo, time, airpt, tra_meas. "
                "Try: ?geo=US&time=2023&airpt=JFK&tra_meas=PAS"
            )
            result.confidence_notes.append(
                "Correct format: /dissemination/statistics/1.0/data/avia_paoc"
                "?geo=US&time=2023&airpt=JFK&tra_meas=PAS"
            )
        else:
            result.status = "fail"
            result.failure_reason = f"HTTP {status}"
        return result


# ─────────────────────────────────────────────────────────────────────────────
# SOURCE 7 — AviationWeather / NOAA
# ─────────────────────────────────────────────────────────────────────────────


class AviationWeatherProbe:
    name = "AviationWeather METAR/TAF"
    recommended_use = "later_live_layer"

    def probe(self, airport_ident: str, iata: str | None) -> EndpointProbeResult:
        result = EndpointProbeResult(
            source_name=self.name,
            endpoint=f"{AV_METAR_BASE}?ids={{icao}}&format=json",
            request_method="GET",
            api_key_required=False,
            user_agent_used=True,
            http_status=None,
            latency_ms=None,
            response_size=None,
            recommended_use=self.recommended_use,
        )
        if not airport_ident:
            result.status = "fail"
            result.failure_reason = "ICAO code required for METAR"
            return result
        metar_url = f"{AV_METAR_BASE}?ids={airport_ident}&format=json"
        raw, status, latency, _ = _make_request(metar_url, user_agent=DEFAULT_USER_AGENT)
        result.http_status = status
        result.latency_ms = latency
        result.response_size = len(raw)
        result.endpoint = metar_url
        if status == 200:
            result.status = "pass"
            result.fields_found = ["metar_data"]
            try:
                data = json.loads(raw)
                if isinstance(data, list) and len(data) > 0:
                    metar = data[0]
                    for fld in ["reportTime", "rawOb", "lat", "lon", "elevationFt",
                                "temp", "dewp", "wdir", "wsmp", "visibility",
                                "fligCategory"]:
                        if fld in metar:
                            result.fields_found.append(f"metar_{fld}")
            except Exception:
                pass
            result.confidence_notes.append(
                "AviationWeather is live weather data — out of scope for "
                "static airport profile v1, but useful for future live layer"
            )
        else:
            result.status = "fail"
            result.failure_reason = f"HTTP {status}"

        taf_url = f"{AV_TAF_BASE}?ids={airport_ident}&format=json"
        raw_taf, status_taf, lat_taf, _ = _make_request(taf_url, user_agent=DEFAULT_USER_AGENT)
        if status_taf == 200:
            result.fields_found.append("taf_data")
        return result


# ─────────────────────────────────────────────────────────────────────────────
# SOURCE 8 — Official Airport Websites
# ─────────────────────────────────────────────────────────────────────────────


class OfficialWebsiteProbe:
    name = "Official Airport Website"
    recommended_use = "backfill_only"

    HOMEPAGES: dict[str, str] = {
        "KJFK": "https://www.jfkairport.com/",
        "KBDL": "https://www.ctairports.org/bdl",
        "OMDB": "https://www.dubaiairports.ae/",
        "EGLL": "https://www.heathrow.com/",
        "CYQB": "https://www.quebecairport.com/en/",
    }

    def probe(self, airport_ident: str, iata: str | None) -> EndpointProbeResult:
        url = self.HOMEPAGES.get(airport_ident)
        if not url:
            return EndpointProbeResult(
                source_name=self.name,
                endpoint="(not in known list)",
                request_method="GET",
                api_key_required=False,
                user_agent_used=True,
                http_status=None,
                latency_ms=None,
                response_size=None,
                status="fail",
                recommended_use=self.recommended_use,
                failure_reason=f"No known homepage for {airport_ident} — need Wikidata P856",
            )
        result = EndpointProbeResult(
            source_name=self.name,
            endpoint=url,
            request_method="GET",
            api_key_required=False,
            user_agent_used=True,
            http_status=None,
            latency_ms=None,
            response_size=None,
            recommended_use=self.recommended_use,
        )
        raw, status, latency, _ = _make_request(url, user_agent=DEFAULT_USER_AGENT)
        result.http_status = status
        result.latency_ms = latency
        result.response_size = len(raw)
        if status == 200:
            text = raw.decode("utf-8", errors="ignore")
            result.status = "partial"
            result.fields_found = ["page_title", "page_content_length"]
            result.confidence_notes.append(f"content_length={len(text):,}")
            if "<script" in text[:1000].lower() or "javascript" in text[:5000].lower():
                result.confidence_notes.append(
                    "WARNING: page contains JavaScript — static fetch returns HTML shell, "
                    "actual content loads client-side. Not usable for data extraction."
                )
                result.fields_missing = ["structured_data", "traffic_stats", "annual_report_links"]
            keywords_found = []
            for kw in ["annual", "report", "statistic", "traffic", "passenger"]:
                if kw in text.lower():
                    keywords_found.append(kw)
            if keywords_found:
                result.fields_found.append(f"keyword_hints={keywords_found}")
        else:
            result.status = "fail"
            result.failure_reason = f"HTTP {status}"
        return result


# ─────────────────────────────────────────────────────────────────────────────
# Orchestration
# ─────────────────────────────────────────────────────────────────────────────


def probe_airport(
    airport_ident: str,
    iata: str | None,
    name: str,
    lat: float | None,
    lon: float | None,
    show_raw: bool = False,
    wikipedia_qid: str | None = None,
) -> AirportProbeResults:
    probes = {}
    ourairports = OurAirportsSourceProbe()
    ourairports_result = ourairports.probe(lat, lon)
    probes[ourairports.name] = ourairports_result

    wikipedia = WikipediaEndpointProbe()
    wiki_result = wikipedia.probe(airport_ident, iata, name, lat, lon)
    probes[wikipedia.name] = wiki_result

    qid = wikipedia_qid
    if not qid and wiki_result.http_status == 200:
        try:
            enc_name = urllib.parse.quote(name, safe="")
            url = f"{WIKIPEDIA_SUMMARY_BASE}/{enc_name}"
            raw, _, _, _ = _make_request(url, user_agent=DEFAULT_USER_AGENT)
            data = json.loads(raw)
            qid = data.get("wikibase_item")
        except Exception:
            pass

    wikidata = WikidataEndpointProbe()
    wd_result = wikidata.probe(airport_ident, iata, name, qid)
    probes[wikidata.name] = wd_result

    osm = OSMOverpassEndpointProbe()
    osm_result = osm.probe(airport_ident, lat, lon)
    probes[osm.name] = osm_result

    bts = BTSTranstatsProbe()
    bts_result = bts.probe(airport_ident, iata)
    probes[bts.name] = bts_result

    eurostat = EurostatProbe()
    eurostat_result = eurostat.probe(iata)
    probes[eurostat.name] = eurostat_result

    av = AviationWeatherProbe()
    av_result = av.probe(airport_ident, iata)
    probes[av.name] = av_result

    official = OfficialWebsiteProbe()
    official_result = official.probe(airport_ident, iata)
    probes[official.name] = official_result

    return AirportProbeResults(
        airport_ident=airport_ident,
        airport_iata=iata,
        airport_name=name,
        lat=lat,
        lon=lon,
        probes=probes,
        probed_at=datetime.now(timezone.utc).isoformat(),
    )


def format_result(result: EndpointProbeResult) -> str:
    fields = ", ".join(result.fields_found) if result.fields_found else "none"
    missing = ", ".join(result.fields_missing) if result.fields_missing else "none"
    notes = " | ".join(result.confidence_notes) if result.confidence_notes else "none"
    latency = f"{result.latency_ms}ms" if result.latency_ms else "N/A"
    http = result.http_status or "N/A"
    key = "YES" if result.api_key_required else "NO"
    ua = "YES" if result.user_agent_used else "NO"
    use = result.recommended_use
    fail = f" [FAIL: {result.failure_reason}]" if result.failure_reason else ""
    fix = f" [FIX: {result.next_fix}]" if result.next_fix else ""
    raw = f"\n  RAW: {result.raw_snippet[:200]}..." if result.raw_snippet else ""
    return (
        f"  SOURCE: {result.source_name}\n"
        f"  ENDPOINT: {result.endpoint}\n"
        f"  METHOD: {result.request_method} | KEY: {key} | UA: {ua}\n"
        f"  STATUS: {result.status.upper()} | HTTP: {http} | LATENCY: {latency}\n"
        f"  SIZE: {result.response_size or 'N/A'} bytes\n"
        f"  STATUS: {result.status.upper()}\n"
        f"  USE: {use}\n"
        f"  Fields found: {fields}\n"
        f"  Fields missing: {missing}\n"
        f"  Notes: {notes}{fail}{fix}{raw}"
    )


def print_airport_results(results: AirportProbeResults) -> None:
    print(f"\n{'='*70}")
    print(f"AIRPORT: {results.airport_ident} / {results.airport_iata} — {results.airport_name}")
    print(f"  Lat/Lon: {results.lat}, {results.lon}")
    print(f"{'='*70}")
    for src_name, probe in results.probes.items():
        print(format_result(probe))
        print()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Airport source endpoint probe — dry-run, no DB writes",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--airport-ident", default="KJFK", help="ICAO code")
    parser.add_argument("--iata", default="JFK", help="IATA code")
    parser.add_argument("--name", default="John F. Kennedy International Airport",
                        help="Airport name for Wikipedia lookup")
    parser.add_argument("--lat", type=float, default=40.6413)
    parser.add_argument("--lon", type=float, default=-73.7781)
    parser.add_argument("--show-raw", action="store_true")
    parser.add_argument("--json-output", help="Write results to JSON file")
    parser.add_argument(
        "--all", action="store_true",
        help="Probe all 5 standard airports"
    )
    args = parser.parse_args()

    if args.all:
        airports = [
            ("KJFK", "JFK", "John F. Kennedy International Airport", 40.6413, -73.7781),
            ("KBDL", "BDL", "Bradley International Airport", 41.9389, -72.6832),
            ("OMDB", "DXB", "Dubai International Airport", 25.2532, 55.3657),
            ("EGLL", "LHR", "London Heathrow Airport", 51.4700, -0.4543),
            ("CYQB", "YQB", "Quebec City Jean Lesage International Airport", 46.7911, -71.3933),
        ]
        all_results: list[dict[str, Any]] = []
        for ident, iata, name, lat, lon in airports:
            results = probe_airport(ident, iata, name, lat, lon, show_raw=args.show_raw)
            print_airport_results(results)
            all_results.append({
                "airport_ident": results.airport_ident,
                "airport_iata": results.airport_iata,
                "airport_name": results.airport_name,
                "probed_at": results.probed_at,
                "probes": {k: asdict(v) for k, v in results.probes.items()},
            })
        if args.json_output:
            Path(args.json_output).write_text(json.dumps(all_results, indent=2, default=str))
            print(f"\nJSON results written to: {args.json_output}")
        return

    results = probe_airport(
        args.airport_ident,
        args.iata,
        args.name,
        args.lat,
        args.lon,
        show_raw=args.show_raw,
    )
    print_airport_results(results)

    if args.json_output:
        output = {
            "airport_ident": results.airport_ident,
            "airport_iata": results.airport_iata,
            "airport_name": results.airport_name,
            "probed_at": results.probed_at,
            "probes": {k: asdict(v) for k, v in results.probes.items()},
        }
        Path(args.json_output).write_text(json.dumps(output, indent=2, default=str))
        print(f"\nJSON results written to: {args.json_output}")


if __name__ == "__main__":
    main()