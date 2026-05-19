"""Airport intelligence source probe — dry-run validation, no DB writes.

WO-040 — Source availability and fetch probe
Tests: KJFK/JFK, KBDL/BDL, OMDB/DXB, EGLL/LHR, CYQB/YQB

Usage:
    python services/fetch-orchestrator/src/layers/layer_01_aviation/airport_intelligence_source_probe.py \\
        --airport-ident KJFK --iata JFK --name "John F. Kennedy International Airport" --show-raw

    python services/fetch-orchestrator/src/layers/layer_01_aviation/airport_intelligence_source_probe.py \\
        --airport-ident OMDB --iata DXB --name "Dubai International Airport"

    python services/fetch-orchestrator/src/layers/layer_01_aviation/airport_intelligence_source_probe.py \\
        --all  # probe all 5 test airports

Behavior:
  - Makes real HTTP requests to live sources
  - Prints structured probe results to stdout
  - NEVER writes to database
  - NEVER modifies any state

Sources probed:
  1. Wikipedia REST API         — no key, free, fast
  2. Wikidata REST             — no key, free, fast
  3. OSM Overpass API         — no key, free, rate-limited / 406
  4. BTS Transtats             — no key, free, requires query building
  5. Eurostat                  — no key, free, query format complexity
  6. Official airport website — no key, free, JS-heavy

Fields probed per source are documented in the audit doc:
  docs/work-orders/WO-040-airport-intelligence-source-audit.md
"""

from __future__ import annotations

import argparse
import json
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

DEFAULT_USER_AGENT = (
    "god-eyes-audit/1.0 (research probe; god-eyes@example.com) "
    "SourceProbe/1.0"
)
WIKIPEDIA_REST_BASE = "https://en.wikipedia.org/api/rest_v1/page/summary"
WIKIDATA_ENTITY_BASE = "https://www.wikidata.org/wiki/Special:EntityData"
WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"
OSM_OVERPASS = "https://overpass-api.de/api/interpreter"


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


@dataclass
class AirportProbeResults:
    airport_ident: str
    airport_iata: str | None
    airport_name: str
    probes: dict[str, ProbeResult]
    probed_at: str


class WikipediaSourceProbe:
    name = "Wikipedia REST API"
    recommended_use = "click"
    user_agent = DEFAULT_USER_AGENT

    def probe(
        self,
        airport_ident: str,
        iata: str | None,
        name: str,
        lat: float | None = None,
        lon: float | None = None,
    ) -> ProbeResult:
        result = ProbeResult(
            source_name=self.name,
            key_required="NO",
            request_attempted=True,
            http_status=None,
            latency_ms=None,
            recommended_use=self.recommended_use,
        )
        url = f"{WIKIPEDIA_REST_BASE}/{name.replace(' ', '_')}"
        req = urllib.request.Request(url, headers={"User-Agent": self.user_agent})
        start = time.time()
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                raw = resp.read()
                latency_ms = int((time.time() - start) * 1000)
                result.http_status = resp.status
                result.latency_ms = latency_ms
                data = json.loads(raw)
                result.usable = True
                result.fields_found = self._extract_fields(data)
                result.confidence_notes = [
                    f"page_id={data.get('pageid')}",
                    f"revision={data.get('revision')}",
                    f"extract_length={len(data.get('extract', ''))}",
                ]
                if data.get("extract"):
                    has_year = any(str(y) in data["extract"]
                                  for y in range(2020, 2027))
                    if has_year:
                        result.confidence_notes.append("extract contains year reference")
                    else:
                        result.confidence_notes.append(
                            "WARNING: extract missing year qualifier"
                        )
                if result.fields_found:
                    result.fields_missing = [
                        f for f in ["passenger_count", "operator"]
                        if f not in result.fields_found
                    ]
        except urllib.error.HTTPError as exc:
            result.http_status = exc.code
            result.latency_ms = int((time.time() - start) * 1000)
            result.error_message = f"HTTP {exc.code}"
            result.usable = False
            result.confidence_notes.append(
                f"Error: {exc.code} — airport may not have Wikipedia article"
            )
        except Exception as exc:
            result.latency_ms = int((time.time() - start) * 1000)
            result.error_message = str(exc)
            result.usable = False
        return result

    def _extract_fields(self, data: dict) -> list[str]:
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


class WikidataSourceProbe:
    name = "Wikidata REST API"
    recommended_use = "click"
    user_agent = DEFAULT_USER_AGENT

    TARGET_PROPERTIES = {
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

    def probe(
        self,
        airport_ident: str,
        iata: str | None,
        name: str,
        lat: float | None = None,
        lon: float | None = None,
    ) -> ProbeResult:
        result = ProbeResult(
            source_name=self.name,
            key_required="NO",
            request_attempted=True,
            http_status=None,
            latency_ms=None,
            recommended_use=self.recommended_use,
        )
        sparql = self._build_icao_sparql(airport_ident)
        url = f"{WIKIDATA_SPARQL}?{urllib.parse.urlencode({'query': sparql, 'format': 'json'})}"
        req = urllib.request.Request(url, headers={
            "User-Agent": self.user_agent,
            "Accept": "application/sparql-results+json",
        })
        start = time.time()
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                raw = resp.read()
                latency_ms = int((time.time() - start) * 1000)
                result.http_status = resp.status
                result.latency_ms = latency_ms
                data = json.loads(raw)
                bindings = data.get("results", {}).get("bindings", [])
                if not bindings:
                    result.confidence_notes.append("SPARQL returned no bindings — airport may not be in Wikidata")
                    result.fields_missing = list(self.TARGET_PROPERTIES.values())
                    result.usable = False
                    return result
                entity_uri = bindings[0].get("entity", {}).get("value", "")
                qid = entity_uri.split("/")[-1] if entity_uri else None
                if qid:
                    result = self._probe_entity(qid, start)
                else:
                    result.latency_ms = int((time.time() - start) * 1000)
                    result.confidence_notes.append("No QID resolved from SPARQL")
                    result.usable = False
        except urllib.error.HTTPError as exc:
            result.http_status = exc.code
            result.latency_ms = int((time.time() - start) * 1000)
            result.error_message = f"HTTP {exc.code}"
            result.usable = False
        except Exception as exc:
            result.latency_ms = int((time.time() - start) * 1000)
            result.error_message = str(exc)
            result.usable = False
        return result

    def _probe_entity(self, qid: str, start_time: float) -> ProbeResult:
        result = ProbeResult(
            source_name=self.name,
            key_required="NO",
            request_attempted=True,
            http_status=None,
            latency_ms=None,
            recommended_use=self.recommended_use,
        )
        url = f"{WIKIDATA_ENTITY_BASE}/{qid}.json"
        req = urllib.request.Request(url, headers={"User-Agent": self.user_agent})
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                raw = resp.read()
                result.latency_ms = int((time.time() - start_time) * 1000)
                result.http_status = resp.status
                data = json.loads(raw)
                entity = data.get("entities", {}).get(qid, {})
                claims = entity.get("claims", {})
                found_fields = []
                missing_fields = []
                for prop_id, field_name in self.TARGET_PROPERTIES.items():
                    if prop_id in claims:
                        found_fields.append(field_name)
                    else:
                        missing_fields.append(field_name)
                result.fields_found = found_fields
                result.fields_missing = missing_fields
                result.confidence_notes = [
                    f"qid={qid}",
                    f"properties_found={len(found_fields)}/{len(self.TARGET_PROPERTIES)}",
                ]
                if not found_fields:
                    result.usable = False
                    result.confidence_notes.append(
                        "WARNING: Wikidata entity has no target properties"
                    )
                else:
                    result.usable = True
        except urllib.error.HTTPError as exc:
            result.http_status = exc.code
            result.latency_ms = int((time.time() - start_time) * 1000)
            result.error_message = f"HTTP {exc.code}"
            result.usable = False
        except Exception as exc:
            result.latency_ms = int((time.time() - start_time) * 1000)
            result.error_message = str(exc)
            result.usable = False
        return result

    def _build_icao_sparql(self, icao: str) -> str:
        return (
            "SELECT ?entity WHERE {"
            f"?entity wdt:P239 '{icao.strip().upper()}' ."
            "} LIMIT 1"
        )


class OSMSourceProbe:
    name = "OpenStreetMap Overpass API"
    recommended_use = "background"
    user_agent = DEFAULT_USER_AGENT

    def probe(
        self,
        airport_ident: str,
        iata: str | None,
        name: str,
        lat: float | None = None,
        lon: float | None = None,
    ) -> ProbeResult:
        result = ProbeResult(
            source_name=self.name,
            key_required="NO",
            request_attempted=True,
            http_status=None,
            latency_ms=None,
            recommended_use=self.recommended_use,
        )
        if lat is None or lon is None:
            result.confidence_notes.append(
                "SKIPPED: lat/lon not provided — OSM requires bounding box"
            )
            result.recommended_use = "skip"
            result.usable = False
            return result
        bbox = self._build_bbox(lat, lon, buffer=0.05)
        query = self._build_overpass_query(bbox)
        start = time.time()
        try:
            body = f"data={urllib.parse.quote_plus(query)}"
            req = urllib.request.Request(
                OSM_OVERPASS,
                data=body.encode("utf-8"),
                headers={
                    "User-Agent": self.user_agent,
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json",
                },
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                raw = resp.read()
                latency_ms = int((time.time() - start) * 1000)
                result.http_status = resp.status
                result.latency_ms = latency_ms
                data = json.loads(raw)
                elements = data.get("elements", [])
                aeroway_types: dict[str, int] = {}
                for el in elements:
                    aw = el.get("tags", {}).get("aeroway")
                    if aw:
                        aeroway_types[aw] = aeroway_types.get(aw, 0) + 1
                result.fields_found = list(aeroway_types.keys())
                if not result.fields_found:
                    result.confidence_notes.append(
                        "No OSM aeroway elements found in bounding box — "
                        "airport may not be mapped in OSM"
                    )
                else:
                    result.confidence_notes.append(
                        f"elements_found={len(elements)}, "
                        f"types={json.dumps(aeroway_types)}"
                    )
                result.usable = True
                result.recommended_use = "background"
        except urllib.error.HTTPError as exc:
            result.http_status = exc.code
            result.latency_ms = int((time.time() - start) * 1000)
            result.error_message = f"HTTP {exc.code}"
            result.usable = False
            result.recommended_use = "background"
            if exc.code == 406:
                result.confidence_notes.append(
                    "406 Not Acceptable — Overpass rate-limited or "
                    "requires different User-Agent/format. "
                    "Consider running own Overpass instance."
                )
        except Exception as exc:
            result.latency_ms = int((time.time() - start) * 1000)
            result.error_message = str(exc)
            result.usable = False
            result.recommended_use = "background"
        return result

    def _build_bbox(
        self, lat: float, lon: float, buffer: float = 0.05
    ) -> tuple[float, float, float, float]:
        return (lon - buffer, lat - buffer, lon + buffer, lat + buffer)

    def _build_overpass_query(self, bbox: tuple[float, float, float, float]) -> str:
        s, w, n, e = bbox
        return (
            "[out:json][timeout:15];"
            f"node['aeroway'~'gate|terminal|apron|taxiway|runway|hangar|control_tower']"
            f"({s},{w},{n},{e});"
            "way['aeroway'~'gate|terminal|apron|taxiway|runway|hangar|control_tower']"
            f"({s},{w},{n},{e});"
            "out body;"
        )


class BTSSourceProbe:
    name = "BTS Transtats T-100"
    recommended_use = "background"
    user_agent = DEFAULT_USER_AGENT

    def probe(
        self,
        airport_ident: str,
        iata: str | None,
        name: str,
        lat: float | None = None,
        lon: float | None = None,
    ) -> ProbeResult:
        result = ProbeResult(
            source_name=self.name,
            key_required="NO",
            request_attempted=True,
            http_status=None,
            latency_ms=None,
            recommended_use=self.recommended_use,
        )
        if not airport_ident.startswith("K") or not iata:
            result.confidence_notes.append(
                "SKIPPED: BTS T-100 covers US airports only (ICAO starts with K)"
            )
            result.recommended_use = "skip"
            result.usable = False
            return result
        url = (
            f"https://api.bts.gov/api?dataset=T-100&"
            f"airline=AllCarriers&airport={iata}&"
            f"year=2023&period=12&submit=Submit"
        )
        req = urllib.request.Request(url, headers={"User-Agent": self.user_agent})
        start = time.time()
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                raw = resp.read()
                latency_ms = int((time.time() - start) * 1000)
                result.http_status = resp.status
                result.latency_ms = latency_ms
                result.confidence_notes.append(
                    "BTS responded but response format may not be JSON — "
                    "requires HTML form submission approach"
                )
                result.usable = True
                result.recommended_use = "background"
        except urllib.error.HTTPError as exc:
            result.http_status = exc.code
            result.latency_ms = int((time.time() - start) * 1000)
            result.error_message = f"HTTP {exc.code}"
            result.usable = False
        except Exception as exc:
            result.latency_ms = int((time.time() - start) * 1000)
            result.error_message = str(exc)
            result.usable = False
        return result


class EurostatSourceProbe:
    name = "Eurostat avia_paoc"
    recommended_use = "background"
    user_agent = DEFAULT_USER_AGENT

    def probe(
        self,
        airport_ident: str,
        iata: str | None,
        name: str,
        lat: float | None = None,
        lon: float | None = None,
    ) -> ProbeResult:
        result = ProbeResult(
            source_name=self.name,
            key_required="NO",
            request_attempted=True,
            http_status=None,
            latency_ms=None,
            recommended_use=self.recommended_use,
        )
        if not iata or len(iata) != 3:
            result.confidence_notes.append("SKIPPED: Eurostat uses IATA codes")
            result.recommended_use = "skip"
            result.usable = False
            return result
        url = (
            f"https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/avia_paoc"
            f"?geo=US&time=2023&tra_meas=PAS&airpt={iata}"
        )
        req = urllib.request.Request(url, headers={"User-Agent": self.user_agent})
        start = time.time()
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                raw = resp.read()
                latency_ms = int((time.time() - start) * 1000)
                result.http_status = resp.status
                result.latency_ms = latency_ms
                result.usable = True
        except urllib.error.HTTPError as exc:
            result.http_status = exc.code
            result.latency_ms = int((time.time() - start) * 1000)
            result.error_message = f"HTTP {exc.code}"
            result.usable = False
            result.confidence_notes.append(
                f"Eurostat API returned {exc.code} — "
                "query format may be incorrect. "
                "Eurostat requires specific geo+time+airpt parameters."
            )
        except Exception as exc:
            result.latency_ms = int((time.time() - start) * 1000)
            result.error_message = str(exc)
            result.usable = False
        return result


class OfficialWebsiteSourceProbe:
    name = "Official Airport Website"
    recommended_use = "background"
    user_agent = DEFAULT_USER_AGENT

    KNOWN_HOMEPAGES: dict[str, str] = {
        "KJFK": "https://www.jfkairport.com/",
        "KBDL": "https://www.ctairports.org/bdl",
        "OMDB": "https://www.dubaiairports.ae/",
        "EGLL": "https://www.heathrow.com/",
        "CYQB": "https://www.quebecairport.com/en/",
    }

    def probe(
        self,
        airport_ident: str,
        iata: str | None,
        name: str,
        lat: float | None = None,
        lon: float | None = None,
    ) -> ProbeResult:
        result = ProbeResult(
            source_name=self.name,
            key_required="NO",
            request_attempted=True,
            http_status=None,
            latency_ms=None,
            recommended_use=self.recommended_use,
        )
        url = self.KNOWN_HOMEPAGES.get(airport_ident)
        if not url:
            result.confidence_notes.append(
                f"No known homepage for {airport_ident} — "
                "would need to resolve from Wikidata P856 or OurAirports homepage field"
            )
            result.recommended_use = "background"
            result.usable = False
            return result
        req = urllib.request.Request(url, headers={"User-Agent": self.user_agent})
        start = time.time()
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                raw = resp.read()
                latency_ms = int((time.time() - start) * 1000)
                result.http_status = resp.status
                result.latency_ms = latency_ms
                text = raw.decode("utf-8", errors="ignore")
                result.fields_found = []
                if "<title" in text.lower():
                    result.fields_found.append("page_title")
                if len(text) > 5000:
                    result.fields_found.append("page_content")
                result.confidence_notes = [
                    f"content_length={len(text)}",
                    "WARNING: website content is primarily JavaScript-rendered — "
                    "server returns HTML shell, actual content loaded by browser JS. "
                    "Static fetch returns minimal useful data.",
                ]
                result.usable = True
                result.recommended_use = "background"
        except urllib.error.HTTPError as exc:
            result.http_status = exc.code
            result.latency_ms = int((time.time() - start) * 1000)
            result.error_message = f"HTTP {exc.code}"
            result.usable = False
        except Exception as exc:
            result.latency_ms = int((time.time() - start) * 1000)
            result.error_message = str(exc)
            result.usable = False
        return result


def probe_airport(
    airport_ident: str,
    iata: str | None,
    name: str,
    show_raw: bool = False,
    lat: float | None = None,
    lon: float | None = None,
) -> AirportProbeResults:
    probes = {}
    sources = [
        WikipediaSourceProbe(),
        WikidataSourceProbe(),
        OSMSourceProbe(),
        BTSSourceProbe(),
        EurostatSourceProbe(),
        OfficialWebsiteSourceProbe(),
    ]
    for source in sources:
        probe = source.probe(airport_ident, iata, name, lat, lon)
        probes[source.name] = probe
    return AirportProbeResults(
        airport_ident=airport_ident,
        airport_iata=iata,
        airport_name=name,
        probes=probes,
        probed_at=datetime.now(timezone.utc).isoformat(),
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


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Airport intelligence source probe — dry-run only, no DB writes"
    )
    parser.add_argument("--airport-ident", default="KJFK", help="ICAO code (e.g. KJFK)")
    parser.add_argument("--iata", default="JFK", help="IATA code (e.g. JFK)")
    parser.add_argument("--name", default="John F. Kennedy International Airport",
                        help="Airport name for Wikipedia lookup")
    parser.add_argument("--lat", type=float, default=None, help="Latitude for OSM bounding box")
    parser.add_argument("--lon", type=float, default=None, help="Longitude for OSM bounding box")
    parser.add_argument("--show-raw", action="store_true", help="Print raw JSON snippets")
    parser.add_argument(
        "--all", action="store_true", help="Probe all 5 standard test airports"
    )
    args = parser.parse_args()

    if args.all:
        airports = [
            ("KJFK", "JFK", "John F. Kennedy International Airport", 40.6397, -73.7789),
            ("KBDL", "BDL", "Bradley International Airport", 41.9389, -72.6832),
            ("OMDB", "DXB", "Dubai International Airport", 25.2528, 55.3644),
            ("EGLL", "LHR", "Heathrow Airport", 51.4775, -0.4614),
            ("CYQB", "YQB", "Québec Jean Lesage International Airport", 46.7911, -71.3906),
        ]
        for ident, iata, name, lat, lon in airports:
            print(f"\n{'='*70}")
            print(f"PROBING: {ident} / {iata} — {name}")
            print(f"{'='*70}")
            results = probe_airport(ident, iata, name, show_raw=args.show_raw, lat=lat, lon=lon)
            for src_name, probe in results.probes.items():
                print(format_probe_result(probe))
        return

    print(f"\n{'='*70}")
    print(f"PROBING: {args.airport_ident} / {args.iata} — {args.name}")
    print(f"{'='*70}")
    results = probe_airport(
        args.airport_ident,
        args.iata,
        args.name,
        show_raw=args.show_raw,
        lat=args.lat,
        lon=args.lon,
    )
    for src_name, probe in results.probes.items():
        print(format_probe_result(probe))

    if args.show_raw:
        print("\n--- RAW RESULTS ---")
        print(json.dumps(
            {k: asdict(v) for k, v in results.probes.items()},
            indent=2,
            default=str,
        ))


if __name__ == "__main__":
    main()