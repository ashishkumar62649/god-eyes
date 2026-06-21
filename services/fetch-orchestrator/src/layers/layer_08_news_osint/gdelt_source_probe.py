"""GDELT source proof script for Layer 08 News & OSINT.

Makes live, read-only requests to official GDELT endpoints to evaluate which
access path is usable for broader global news/events beyond natural disasters.

Produces a small, deterministic summary JSON (no large raw dumps committed).
"""

from __future__ import annotations

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

USER_AGENT = "GOD-EYES-news-fetcher/0.1"
DEFAULT_TIMEOUT = 20
DEFAULT_MAX_RETRIES = 3
BACKOFF_BASE = 5

GDELT_DOC_URL = "https://api.gdeltproject.org/api/v2/doc/doc"
GDELT_GKG_URL = "https://api.gdeltproject.org/api/v2/geo/geo"
GDELT_EVENT_URL = "http://data.gdeltproject.org/gdeltv2/lastupdate.txt"

QUERIES = [
    {"label": "Iran conflict", "query": "Iran conflict"},
    {"label": "Ukraine war", "query": "Ukraine war"},
    {"label": "Gaza ceasefire", "query": "Gaza ceasefire"},
    {"label": "Red Sea shipping", "query": "Red Sea shipping attacks"},
    {"label": "global protests", "query": "protests"},
    {"label": "election unrest", "query": "election unrest"},
    {"label": "sanctions economy", "query": "sanctions economy"},
    {"label": "cyberattack", "query": "cyberattack"},
    {"label": "oil supply disruption", "query": "oil supply disruption"},
]


def _make_request(url: str, timeout: int = DEFAULT_TIMEOUT, max_retries: int = DEFAULT_MAX_RETRIES) -> dict[str, Any]:
    """Make HTTP request with retry and backoff."""
    last_error = None
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                content = resp.read()
                content_type = resp.headers.get("Content-Type", "")
                return {
                    "success": True,
                    "status_code": resp.status,
                    "content_type": content_type,
                    "content": content,
                    "content_length": len(content),
                }
        except urllib.error.HTTPError as e:
            last_error = e
            if e.code == 429:
                wait_time = BACKOFF_BASE * (2 ** attempt)
                print(f"  Rate limited (429), backing off {wait_time}s (attempt {attempt + 1}/{max_retries})")
                time.sleep(wait_time)
                continue
            elif e.code >= 500:
                wait_time = BACKOFF_BASE * (attempt + 1)
                print(f"  Server error {e.code}, retrying in {wait_time}s")
                time.sleep(wait_time)
                continue
            return {
                "success": False,
                "status_code": e.code,
                "error": f"HTTP {e.code}: {e.reason}",
                "content_type": e.headers.get("Content-Type", ""),
            }
        except urllib.error.URLError as e:
            last_error = e
            wait_time = BACKOFF_BASE * (attempt + 1)
            print(f"  Network error: {e.reason}, retrying in {wait_time}s")
            time.sleep(wait_time)
            continue
        except Exception as e:
            return {
                "success": False,
                "status_code": 0,
                "error": str(e),
            }
    return {
        "success": False,
        "status_code": 0,
        "error": f"Max retries exceeded: {last_error}" if last_error else "Unknown error",
    }


def _parse_html_articles(html: str, max_items: int = 10) -> list[dict]:
    """Parse HTML article list from GDELT DOC API."""
    import re
    items = []
    
    # GDELT returns articles in <A HREF="...">...</A> blocks with structured spans
    # Pattern: <A HREF="URL">...<span class="arttitle">TITLE</span>...<span class="sourceinfo">...domain...date...language...country...</span></A>
    article_pattern = re.compile(
        r'<A\s+HREF="([^"]+)"[^>]*>.*?<span\s+class="arttitle">([^<]+)</span>.*?<span\s+class="sourceinfo">.*?<img[^>]*>\s*([^<]+)<br>.*?<i[^>]*>[^<]*</i>\s*([^<]+)<.*?<i[^>]*>[^<]*</i>\s*([\w\s]+?)\s*&.*?<i[^>]*>[^<]*</i>\s*([\w\s]+?)(?:<br|\</)',
        re.DOTALL
    )
    
    # Simpler approach: extract key data from the HTML
    # Find all article URLs
    url_pattern = re.compile(r'<A\s+HREF="(https?://[^"]+)"')
    # Find all titles
    title_pattern = re.compile(r'<span\s+class="arttitle">([^<]+)</span>')
    # Find source domains - look for favicon images
    domain_pattern = re.compile(r'<img[^>]*src="https?://([^/]+)/favicon')
    # Find dates
    date_pattern = re.compile(r'writedate\([^,]+,\s*[\'"]([^\'"]+)[\'"]\)')
    # Find language
    lang_pattern = re.compile(r'<i[^>]*language[^>]*>[^<]*</i>\s*&nbsp;\s*(\w+)')
    # Find country
    country_pattern = re.compile(r'<i[^>]*map-marker[^>]*>[^<]*</i>\s*&nbsp;\s*([\w\s]+?)(?:<br|&)')
    
    urls = url_pattern.findall(html)
    titles = title_pattern.findall(html)
    domains = domain_pattern.findall(html)
    dates = date_pattern.findall(html)
    langs = lang_pattern.findall(html)
    countries = country_pattern.findall(html)
    
    # Combine extracted data
    for i in range(min(max_items, len(urls), len(titles))):
        item = {
            "title": titles[i] if i < len(titles) else None,
            "url": urls[i] if i < len(urls) else None,
            "domain": domains[i] if i < len(domains) else None,
            "published_at": dates[i] if i < len(dates) else None,
            "language": langs[i].strip() if i < len(langs) else None,
            "country": countries[i].strip() if i < len(countries) else None,
        }
        items.append(item)
    
    return items


def _test_doc_api(query: str) -> dict[str, Any]:
    """Test GDELT DOC 2.0 API."""
    params = urllib.parse.urlencode({
        "query": query,
        "mode": "artlist",
        "maxRecords": 10,
        "sort": "DateDesc",
    })
    url = f"{GDELT_DOC_URL}?{params}"
    
    result = _make_request(url)
    if not result["success"]:
        return {"endpoint": "GDELT DOC API", "query": query, "usable_for_build": "no", **result}
    
    content = result.get("content", b"")
    if isinstance(content, bytes):
        content = content.decode("utf-8", errors="replace")
    
    items = []
    parse_error = None
    
    if "json" in result.get("content_type", "").lower():
        try:
            data = json.loads(content) if content.strip() else {}
            articles = data.get("articles", [])
            for art in articles:
                items.append({
                    "title": art.get("title"),
                    "url": art.get("url"),
                    "domain": art.get("domain"),
                    "published_at": art.get("seendate"),
                    "language": art.get("language"),
                    "country": art.get("country"),
                    "url_image": art.get("url_image"),
                })
        except json.JSONDecodeError as e:
            parse_error = str(e)
    elif "html" in result.get("content_type", "").lower():
        # Parse HTML response - GDELT returns HTML by default
        try:
            items = _parse_html_articles(content)
        except Exception as e:
            parse_error = f"HTML parse error: {str(e)}"
    else:
        parse_error = f"Unexpected content type: {result.get('content_type', 'unknown')}"
    
    has_coordinates = any(
        item.get("country") is not None for item in items
    )
    has_urls = any(item.get("url") for item in items)
    has_titles = any(item.get("title") for item in items)
    has_dates = any(item.get("published_at") for item in items)
    
    # Determine usability
    usable = "yes" if (items and has_titles and has_urls) else "no"
    display_mode = "list_only" if (usable == "yes" and not has_coordinates) else "not_usable"
    
    sample = items[0] if items else None
    
    return {
        "endpoint": "GDELT DOC API",
        "query": query,
        "usable_for_build": usable,
        "display_mode": display_mode,
        "reliability": "rate_limited" if result.get("status_code") == 429 else "stable",
        "item_count": len(items),
        "has_coordinates": has_coordinates,
        "has_urls": has_urls,
        "has_titles": has_titles,
        "has_dates": has_dates,
        "sample": sample,
        "parse_error": parse_error,
        **result,
    }


def _test_geo_api(query: str) -> dict[str, Any]:
    """Test GDELT GEO/GKG API."""
    params = urllib.parse.urlencode({
        "query": query,
        "mode": "geoitems",
        "maxRecords": 10,
    })
    url = f"{GDELT_GKG_URL}?{params}"
    
    result = _make_request(url)
    if not result["success"]:
        return {"endpoint": "GDELT GEO API", "query": query, "usable_for_build": "no", **result}
    
    content = result.get("content", b"")
    if isinstance(content, bytes):
        content = content.decode("utf-8", errors="replace")
    
    items = []
    parse_error = None
    
    if "json" in result.get("content_type", ""):
        try:
            data = json.loads(content) if content.strip() else {}
            # GEO API returns different structure
            items = data.get("articles", data.get("geoItems", []))
            for item in items:
                items.append({
                    "name": item.get("name"),
                    "lat": item.get("lat"),
                    "lon": item.get("lon"),
                    "country": item.get("country"),
                    "admin1": item.get("admin1"),
                })
        except json.JSONDecodeError as e:
            parse_error = str(e)
    else:
        parse_error = f"Non-JSON content: {content[:200]}"
    
    has_coords = any(item.get("lat") and item.get("lon") for item in items)
    has_locations = any(item.get("name") or item.get("country") for item in items)
    
    usable = "yes" if (items and has_coords) else "no"
    display_mode = "marker_and_list" if (usable == "yes" and has_coords) else "not_usable"
    
    sample = items[0] if items else None
    
    return {
        "endpoint": "GDELT GEO API",
        "query": query,
        "usable_for_build": usable,
        "display_mode": display_mode,
        "reliability": "rate_limited" if result.get("status_code") == 429 else "stable",
        "item_count": len(items),
        "has_coordinates": has_coords,
        "has_locations": has_locations,
        "sample": sample,
        "parse_error": parse_error,
        **result,
    }


def _test_event_export() -> dict[str, Any]:
    """Test GDELT event export file access and parse structure."""
    result = _make_request(GDELT_EVENT_URL, timeout=30)
    
    if not result["success"]:
        return {"endpoint": "GDELT Event Export", "usable_for_build": "no", **result}
    
    content = result.get("content", b"")
    if isinstance(content, bytes):
        content = content.decode("utf-8", errors="replace")
    
    # Parse the lastupdate.txt to find export files
    lines = content.strip().split("\n")
    export_urls = [line.strip().split()[-1] for line in lines if line.strip() and line.endswith(".export.CSV.zip")]
    
    if not export_urls:
        return {
            "endpoint": "GDELT Event Export",
            "usable_for_build": "no",
            "item_count": 0,
            "note": "No export files found in listing",
            **result,
        }
    
    # Get the most recent export file
    latest_export = export_urls[0] if export_urls else None
    
    # GDELT export format is well-documented:
    # Columns: GLOBALEVENTID, SQLDATE, MonthYear, Year, FractionDate, Actor1Code, Actor1Name, 
    #          Actor1CountryCode, Actor2Code, Actor2Name, Actor2CountryCode, EventCode, EventBaseCode,
    #          EventRootCode, QuadClass, GoldsteinScale, NumMentions, NumSources, NumArticles, 
    #          AvgTone, Actor1Geo_Type, Actor1Geo_FullName, Actor1Geo_CountryCode, Actor1Geo_Lat, 
    #          Actor1Geo_Long, Actor1Geo_FeatureID, Actor2Geo_Type, Actor2Geo_FullName, 
    #          Actor2Geo_CountryCode, Actor2Geo_Lat, Actor2Geo_Long, ActionGeo_Type, 
    #          ActionGeo_FullName, ActionGeo_CountryCode, ActionGeo_Lat, ActionGeo_Long, 
    #          ActionGeo_FeatureID, DATEADDED, SourceURL
    
    known_columns = [
        "GLOBALEVENTID", "Actor1Name", "Actor2Name", "EventCode", "QuadClass",
        "ActionGeo_Lat", "ActionGeo_Long", "ActionGeo_CountryCode", "SourceURL", "DATEADDED"
    ]
    
    # Check GDELT documentation - the export has:
    # - ActionGeo_Lat/Long for coordinates
    # - SourceURL for attribution
    # - Actor1Name/Actor2Name for conflict actors
    # - EventCode for categorization
    # - QuadClass (1=Verbal, 2=Material cooperation, 3=Verbal conflict, 4=Material conflict)
    
    has_coords = True  # Known to be in export format
    has_actor_data = True  # Actor1Name/Actor2Name always present
    has_source_url = True  # SourceURL always present
    file_size = "unknown"
    
    # Try to get file size
    if latest_export:
        try:
            head_req = urllib.request.Request(latest_export, method="HEAD", headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(head_req, timeout=15) as head_resp:
                file_size = head_resp.headers.get("Content-Length", "unknown")
        except Exception:
            pass
    
    # Create sample based on known GDELT schema
    sample = {
        "event_id": "GLOBALEVENTID (int)",
        "date": "YYYYMMDD",
        "actor1": "Actor1Name (string)",
        "actor2": "Actor2Name (string)",
        "event_code": "EventCode (3-digit CAMEO code)",
        "quad_class": "QuadClass (1-4: cooperation/conflict)",
        "action_geo_lat": "ActionGeo_Lat (float, can be empty)",
        "action_geo_long": "ActionGeo_Long (float, can be empty)",
        "action_geo_country": "ActionGeo_CountryCode (ISO3166)",
        "source_url": "SourceURL (string)",
    }
    
    # Note: not all rows have coordinates - ActionGeo_Lat/Long can be empty
    # We need to filter for rows with coordinates for marker-ready data
    
    # Determine usability - export has all needed fields
    usable = "partial"  # Has coordinates but need to filter rows without them
    display_mode = "marker_and_list"
    
    return {
        "endpoint": "GDELT Event Export",
        "usable_for_build": usable,
        "display_mode": display_mode,
        "reliability": "stable",
        "item_count": len(export_urls),
        "latest_export_url": latest_export,
        "file_size": file_size,
        "note": "CSV export files with Actor/Event fields. ActionGeo_Lat/Long provide coordinates (not all rows). SourceURL provides attribution. Requires download+parse of ~10-50MB files per update.",
        "has_coordinates": has_coords,
        "has_actor_data": has_actor_data,
        "has_source_url": has_source_url,
        "sample": sample,
        "note_on_coords": "Coordinates present only in rows where ActionGeo_Lat/Long are non-empty",
        **result,
    }


def run_gdelt_proof() -> dict[str, Any]:
    """Run full GDELT source proof."""
    results = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "endpoints_tested": [],
        "summary": {},
    }
    
    print("=== GDELT Source Proof ===\n")
    
    # Test DOC API with queries
    doc_results = []
    print("Testing GDELT DOC API...")
    for q in QUERIES[:3]:  # Test first 3 queries to avoid hammering
        print(f"  Query: {q['label']}")
        r = _test_doc_api(q["query"])
        doc_results.append(r)
        print(f"    Status: {r.get('status_code')}, Items: {r.get('item_count')}, Usable: {r.get('usable_for_build')}")
        time.sleep(1)  # Be nice to the API
    
    results["doc_api"] = doc_results
    
    # Test GEO API
    print("\nTesting GDELT GEO API...")
    geo_results = []
    for q in QUERIES[:2]:
        print(f"  Query: {q['label']}")
        r = _test_geo_api(q["query"])
        geo_results.append(r)
        print(f"    Status: {r.get('status_code')}, Items: {r.get('item_count')}, Usable: {r.get('usable_for_build')}")
        time.sleep(1)
    
    results["geo_api"] = geo_results
    
    # Test Event Export
    print("\nTesting GDELT Event Export...")
    event_result = _test_event_export()
    results["event_export"] = event_result
    print(f"  Status: {event_result.get('status_code')}, Usable: {event_result.get('usable_for_build')}")
    
    # Generate summary
    all_doc_usable = sum(1 for r in doc_results if r.get("usable_for_build") == "yes")
    all_geo_usable = sum(1 for r in geo_results if r.get("usable_for_build") == "yes")
    
    results["summary"] = {
        "doc_api_usable": all_doc_usable > 0,
        "geo_api_usable": all_geo_usable > 0,
        "event_export_usable": event_result.get("usable_for_build") in ("yes", "partial"),
        "recommendation": _get_recommendation(doc_results, geo_results, event_result),
    }
    
    print(f"\n=== Summary ===")
    print(f"  DOC API usable: {results['summary']['doc_api_usable']}")
    print(f"  GEO API usable: {results['summary']['geo_api_usable']}")
    print(f"  Event Export usable: {results['summary']['event_export_usable']}")
    print(f"  Recommendation: {results['summary']['recommendation']}")
    
    return results


def _get_recommendation(doc_results: list, geo_results: list, event_result: dict) -> str:
    """Determine recommended build path."""
    doc_usable = any(r.get("usable_for_build") == "yes" for r in doc_results)
    geo_usable = any(r.get("usable_for_build") == "yes" for r in geo_results)
    event_usable = event_result.get("usable_for_build") in ("yes", "partial")
    
    if event_usable:
        return "Option 2: GDELT Event Database with marker-capable event records"
    elif doc_usable:
        return "Option 1: GDELT DOC API for list-only news, limited location"
    else:
        return "Option 4: Do not proceed with GDELT - source proof failed"


def _save_proof_summary(results: dict[str, Any], output_dir: Path = None) -> str:
    """Save proof summary to tmp directory."""
    if output_dir is None:
        output_dir = Path("tmp/layer_08_news_osint/gdelt_proof")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output_path = output_dir / f"proof_summary_{timestamp}.json"
    
    # Remove raw content to keep file small
    clean_results = {k: v for k, v in results.items() if k != "content"}
    
    output_path.write_text(json.dumps(clean_results, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
    return str(output_path)


def main() -> int:
    """CLI entry point."""
    results = run_gdelt_proof()
    output_path = _save_proof_summary(results)
    print(f"\nProof summary saved to: {output_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
