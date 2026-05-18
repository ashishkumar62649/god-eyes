"""Wikimedia (Wikipedia + Wikidata) fetcher for airport public profiles.

This module fetches public airport data from:
  1. English Wikipedia via the Wikimedia REST API (page summary endpoint)
  2. Wikidata via the Entity Data endpoint (structured facts)

User-Agent requirement:
  Wikimedia requires a descriptive User-Agent per their policy:
  "god-eyes/1.0 (https://github.com/anomalyco/god-eyes; god-eyes@example.com)
   WikipediaEnrichmentFetcher/1.0"
  Do NOT remove or anonymize this header — it may result in IP bans.

Timeout and retry design (v1, no queue system yet):
  - HTTP timeout per request: 10 seconds
  - Max retries on timeout/5xx: 2 retries with exponential backoff
  - Backoff base: 1 second, doubling each retry (1s, 2s)
  - Max total fetch time: ~30 seconds before marking as error
  - On 404 (not found): do NOT retry, return None
  - On 429 (rate limited): respect Retry-After header if present
  - Do NOT retry on 4xx client errors (other than 429)

This module is DB-schema-agnostic — it fetches and returns raw/dict data.
Persistence (airport_public_profiles, fetch_runs) is handled by the caller
after WO-032B lands.

Canonical decisions enforced here:
  - English Wikipedia only (no other language Wikipedias)
  - Wikidata allowed for structured facts
  - No paid APIs, no API keys required
  - No full Wikipedia page storage
  - Lazy fetch — caller decides when to call
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

REPO_ROOT = __import__("pathlib").Path(__file__).resolve().parents[5]
import sys

if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from packages.schemas.layers.layer_01_aviation.airport_public_profile import (
    LAYER_ID,
    SOURCE_ID,
    WIKIDATA_ENTITY_BASE,
    WIKIDATA_SPARQL_ENDPOINT,
    WIKIDATA_SPARQL_ACCEPT,
    WIKIMEDIA_USER_AGENT,
    WIKIPEDIA_REST_SUMMARY_BASE,
    WikipediaSummaryResponse,
    WikidataEntityData,
    build_wikidata_entity_url,
    build_wikipedia_summary_url,
    parse_wikipedia_summary_response,
    parse_wikidata_entity_response,
)

DEFAULT_HTTP_TIMEOUT = 10
MAX_RETRIES = 2
BACKOFF_BASE_SECONDS = 1.0
MAX_TOTAL_FETCH_SECONDS = 30


class FetcherError(Exception):
    pass


class WikipediaNotFoundError(FetcherError):
    pass


class WikidataNotFoundError(FetcherError):
    pass


class FetchRateLimitedError(FetcherError):
    pass


@dataclass(frozen=True)
class FetchResult:
    wikipedia_response: WikipediaSummaryResponse | None
    wikidata_entity: WikidataEntityData | None
    wikidata_qid: str | None
    match_method: str
    match_confidence: str
    fetch_duration_ms: int
    http_status_wikipedia: int | None
    http_status_wikidata: int | None
    error_message: str | None


def _build_request(url: str, accept: str | None = None) -> urllib.request.Request:
    headers = {"User-Agent": WIKIMEDIA_USER_AGENT}
    if accept:
        headers["Accept"] = accept
    return urllib.request.Request(url, headers=headers)


def _fetch_url(request: urllib.request.Request, timeout: int) -> tuple[bytes, int]:
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read(), response.status


def _fetch_with_retry(
    url: str,
    accept: str | None = None,
    timeout: int = DEFAULT_HTTP_TIMEOUT,
    max_retries: int = MAX_RETRIES,
) -> tuple[bytes, int]:
    request = _build_request(url, accept)
    last_exception: Exception | None = None
    for attempt in range(max_retries + 1):
        try:
            return _fetch_url(request, timeout)
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                raise WikipediaNotFoundError(f"Resource not found: {url}") from exc
            if exc.code == 429:
                retry_after = exc.headers.get("Retry-After")
                if retry_after and attempt < max_retries:
                    wait_seconds = float(retry_after)
                    time.sleep(wait_seconds)
                    continue
                raise FetchRateLimitedError(f"Rate limited: {url}") from exc
            if 400 <= exc.code < 500 and exc.code != 429:
                raise FetcherError(f"Client error {exc.code} for {url}") from exc
            if attempt < max_retries:
                backoff = BACKOFF_BASE_SECONDS * (2**attempt)
                time.sleep(backoff)
                last_exception = exc
                continue
            raise FetcherError(f"HTTP {exc.code} after {max_retries} retries: {url}") from exc
        except urllib.error.URLError as exc:
            if attempt < max_retries:
                backoff = BACKOFF_BASE_SECONDS * (2**attempt)
                time.sleep(backoff)
                last_exception = exc
                continue
            raise FetcherError(f"URL error after {max_retries} retries: {exc}") from exc
        except TimeoutError as exc:
            if attempt < max_retries:
                backoff = BACKOFF_BASE_SECONDS * (2**attempt)
                time.sleep(backoff)
                last_exception = exc
                continue
            raise FetcherError(f"Timeout after {max_retries} retries: {url}") from exc
    raise FetcherError(f"Failed after {max_retries} retries") from last_exception


def fetch_wikipedia_summary(wikipedia_title: str) -> WikipediaSummaryResponse:
    url = build_wikipedia_summary_url(wikipedia_title)
    try:
        raw_bytes, status = _fetch_with_retry(url)
        return parse_wikipedia_summary_response(raw_bytes)
    except WikipediaNotFoundError:
        raise
    except FetchRateLimitedError:
        raise
    except FetcherError:
        raise


def fetch_wikidata_entity(qid: str) -> WikidataEntityData:
    url = build_wikidata_entity_url(qid)
    try:
        raw_bytes, status = _fetch_with_retry(url)
        return parse_wikidata_entity_response(raw_bytes)
    except WikidataNotFoundError:
        raise
    except FetchRateLimitedError:
        raise
    except FetcherError:
        raise


def fetch_wikidata_sparql(query: str) -> dict[str, Any]:
    encoded_query = urllib.parse.urlencode({"query": query, "format": "json"})
    url = f"{WIKIDATA_SPARQL_ENDPOINT}?{encoded_query}"
    request = _build_request(url, accept="application/sparql-results+json")
    timeout = DEFAULT_HTTP_TIMEOUT
    last_exception: Exception | None = None
    for attempt in range(MAX_RETRIES + 1):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                raw = response.read()
                return json.loads(raw)
        except urllib.error.HTTPError as exc:
            if exc.code == 429:
                raise FetchRateLimitedError(f"SPARQL rate limited: {url}") from exc
            if attempt < MAX_RETRIES:
                backoff = BACKOFF_BASE_SECONDS * (2**attempt)
                time.sleep(backoff)
                last_exception = exc
                continue
            raise FetcherError(f"SPARQL HTTP {exc.code}") from exc
        except Exception as exc:
            if attempt < MAX_RETRIES:
                backoff = BACKOFF_BASE_SECONDS * (2**attempt)
                time.sleep(backoff)
                last_exception = exc
                continue
            raise FetcherError(f"SPARQL failed after {MAX_RETRIES} retries") from exc
    raise FetcherError("SPARQL failed") from last_exception


def icao_to_wikidata_qid(icao_code: str) -> str | None:
    query = """
    SELECT ?entity WHERE {
      ?entity wdt:P239 '""" + icao_code.strip().upper() + """' .
    }
    LIMIT 1
    """
    result = fetch_wikidata_sparql(query)
    bindings = result.get("results", {}).get("bindings", [])
    if bindings:
        uri = bindings[0].get("entity", {}).get("value", "")
        return uri.split("/")[-1]
    return None


def iata_to_wikidata_qid(iata_code: str) -> str | None:
    query = """
    SELECT ?entity WHERE {
      ?entity wdt:P238 '""" + iata_code.strip().upper() + """' .
    }
    LIMIT 1
    """
    result = fetch_wikidata_sparql(query)
    bindings = result.get("results", {}).get("bindings", [])
    if bindings:
        uri = bindings[0].get("entity", {}).get("value", "")
        return uri.split("/")[-1]
    return None


def fetch_airport_public_data(
    wikipedia_title: str | None = None,
    wikidata_qid: str | None = None,
    icao_code: str | None = None,
    iata_code: str | None = None,
    match_method: str = "direct",
) -> FetchResult:
    start = datetime.now(timezone.utc)
    wikipedia_response: WikipediaSummaryResponse | None = None
    wikidata_entity: WikidataEntityData | None = None
    resolved_qid = wikidata_qid
    resolved_wiki_title = wikipedia_title
    final_match_method = match_method
    match_confidence = "high"
    http_status_wiki: int | None = None
    http_status_wiki_err: int | None = None
    error_message: str | None = None

    try:
        if resolved_wiki_title:
            wikipedia_response = fetch_wikipedia_summary(resolved_wiki_title)
            http_status_wiki = 200
            if not resolved_qid:
                resolved_qid = icao_to_wikidata_qid(icao_code or "") if icao_code else None
        elif resolved_qid:
            entity = fetch_wikidata_entity(resolved_qid)
            wikidata_entity = entity
            http_status_wiki_err = 200
    except WikipediaNotFoundError:
        http_status_wiki = 404
        final_match_method = f"{match_method}_wiki_404"
        match_confidence = "none"
        error_message = "Wikipedia article not found"
    except WikidataNotFoundError:
        http_status_wiki_err = 404
        final_match_method = f"{match_method}_wikidata_404"
        match_confidence = "none"
        error_message = "Wikidata entity not found"
    except FetchRateLimitedError as exc:
        error_message = f"Rate limited: {exc}"
        match_confidence = "none"
    except FetcherError as exc:
        error_message = f"Fetch error: {exc}"
        match_confidence = "none"

    end = datetime.now(timezone.utc)
    duration_ms = int((end - start).total_seconds() * 1000)
    return FetchResult(
        wikipedia_response=wikipedia_response,
        wikidata_entity=wikidata_entity,
        wikidata_qid=resolved_qid,
        match_method=final_match_method,
        match_confidence=match_confidence,
        fetch_duration_ms=duration_ms,
        http_status_wikipedia=http_status_wiki,
        http_status_wikidata=http_status_wiki_err,
        error_message=error_message,
    )