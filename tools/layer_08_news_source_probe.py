#!/usr/bin/env python3
"""
Layer 08 News & OSINT Source Proof Script

This script fetches real global data from four source families and produces a structured proof report.
It is a proof script, not production ingestion.

Rules:
- No database writes
- No frontend/API changes
- No fake data
- No city-specific filtering
- Use global feeds or global queries
- Save raw proof output only under tmp/layer_08_news_probe/
- Use safe timeouts
- Use curl fallback on Windows if urllib fails
- Do not crash the whole script if one source fails
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error
import ssl
from datetime import datetime, timezone
from pathlib import Path
import subprocess
import platform

# Configuration
OUTPUT_DIR = Path("tmp/layer_08_news_probe")
OUTPUT_FILE = OUTPUT_DIR / "source_probe_report.json"
TIMEOUT = 30  # seconds
USER_AGENT = "Layer08-Proof-Script/1.0 (Research Purpose)"

# Create output directory
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def log(message, level="INFO"):
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    print(f"[{timestamp}] [{level}] {message}")

def fetch_with_urllib(url, timeout=TIMEOUT):
    """Fetch URL using urllib with SSL context."""
    try:
        # Create SSL context that doesn't verify certificates (for proof script only)
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as response:
            return response.read().decode("utf-8"), response.getcode()
    except Exception as e:
        raise Exception(f"urllib fetch failed: {e}")

def fetch_with_curl(url, timeout=TIMEOUT):
    """Fetch URL using curl as fallback."""
    try:
        # Use curl with SSL verification disabled for proof script
        cmd = ["curl", "-s", "-L", "--max-time", str(timeout), "--insecure", url]
        result = subprocess.run(cmd, capture_output=True, timeout=timeout + 5)
        if result.returncode != 0:
            raise Exception(f"curl failed with return code {result.returncode}: {result.stderr.decode('utf-8', errors='replace')}")
        # Decode output as UTF-8
        return result.stdout.decode('utf-8', errors='replace'), 200  # Assume 200 if curl succeeds
    except Exception as e:
        raise Exception(f"curl fetch failed: {e}")

def fetch_url(url, timeout=TIMEOUT):
    """Fetch URL with urllib, fallback to curl on Windows."""
    try:
        content, status = fetch_with_urllib(url, timeout)
        # Ensure content is properly decoded as UTF-8
        if isinstance(content, bytes):
            content = content.decode('utf-8', errors='replace')
        return content, status
    except Exception as e:
        log(f"urllib failed: {e}, trying curl fallback", "WARN")
        try:
            content, status = fetch_with_curl(url, timeout)
            # Ensure content is properly decoded as UTF-8
            if isinstance(content, bytes):
                content = content.decode('utf-8', errors='replace')
            return content, status
        except Exception as e2:
            raise Exception(f"Both urllib and curl failed: {e}, {e2}")

def test_gdacs():
    """Test GDACS source - Global Disaster Alert and Coordination System."""
    source_id = "gdacs"
    source_family = "disaster_alert"
    endpoint = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP"
    
    log(f"Testing {source_id}...")
    
    try:
        # Fetch global disaster events
        url = f"{endpoint}?eventtype=ALL&alertlevel=ALL"
        content, status = fetch_url(url)
        
        # Parse JSON response
        data = json.loads(content)
        
        # Extract sample items
        sample_items = []
        if "features" in data:
            for feature in data["features"][:5]:  # Take first 5 as sample
                props = feature.get("properties", {})
                geometry = feature.get("geometry", {})
                coords = geometry.get("coordinates", [None, None])
                
                sample_items.append({
                    "title": props.get("humanReadable", "No title"),
                    "event_type": props.get("eventtype", "Unknown"),
                    "alert_severity": props.get("alertlevel", "Unknown"),
                    "published_time": props.get("from", ""),
                    "link": props.get("url", ""),
                    "country": props.get("country", ""),
                    "latitude": coords[1] if len(coords) > 1 else None,
                    "longitude": coords[0] if len(coords) > 0 else None,
                    "event_id": props.get("eventid", ""),
                })
        
        return {
            "source_id": source_id,
            "source_family": source_family,
            "status": "PASS",
            "endpoint_tested": url,
            "http_status": status,
            "item_count": len(data.get("features", [])),
            "sample_items": sample_items,
            "has_coordinates": any(item.get("latitude") is not None for item in sample_items),
            "has_country_or_region": any(item.get("country") for item in sample_items),
            "useful_for_globe_markers": True,
            "useful_for_news_list": True,
            "needs_secret_key": False,
            "needs_appname": False,
            "attribution_notes": "GDACS data is provided under Creative Commons Attribution 4.0 International (CC BY 4.0) license.",
            "limitations": "Limited to major natural disasters only.",
            "error": None,
        }
    except Exception as e:
        return {
            "source_id": source_id,
            "source_family": source_family,
            "status": "FAIL",
            "endpoint_tested": endpoint,
            "http_status": None,
            "item_count": 0,
            "sample_items": [],
            "has_coordinates": False,
            "has_country_or_region": False,
            "useful_for_globe_markers": False,
            "useful_for_news_list": False,
            "needs_secret_key": False,
            "needs_appname": False,
            "attribution_notes": "GDACS data is provided under Creative Commons Attribution 4.0 International (CC BY 4.0) license.",
            "limitations": "Limited to major natural disasters only.",
            "error": str(e),
        }

def test_gdelt():
    """Test GDELT source - Global Database of Events, Language, and Tone."""
    source_id = "gdelt"
    source_family = "news_api"
    endpoint = "https://api.gdeltproject.org/api/v2/doc/doc"
    
    log(f"Testing {source_id}...")
    
    try:
        # Use global query for situational awareness topics
        # URL encode the query
        import urllib.parse
        query = "earthquake OR flood OR cyclone OR wildfire OR evacuation OR explosion OR outbreak OR humanitarian"
        encoded_query = urllib.parse.quote(query)
        url = f"{endpoint}?query={encoded_query}&mode=ArtList&format=json&maxrecords=10&timespan=1d"
        content, status = fetch_url(url)
        
        # Parse JSON response
        data = json.loads(content)
        
        # Extract sample items
        sample_items = []
        articles = data.get("articles", [])
        for article in articles[:5]:  # Take first 5 as sample
            sample_items.append({
                "title": article.get("title", "No title"),
                "url": article.get("url", ""),
                "source_domain": article.get("domain", ""),
                "language": article.get("language", ""),
                "source_country": article.get("sourcecountry", ""),
                "seen_time": article.get("seendate", ""),
                "image_url": article.get("socialimage", ""),
                "location_fields": f"sourcecountry: {article.get('sourcecountry', '')}",
            })
        
        return {
            "source_id": source_id,
            "source_family": source_family,
            "status": "PASS",
            "endpoint_tested": url,
            "http_status": status,
            "item_count": len(articles),
            "sample_items": sample_items,
            "has_coordinates": False,  # GDELT doesn't provide coordinates directly
            "has_country_or_region": any(item.get("source_country") for item in sample_items),
            "useful_for_globe_markers": False,  # Needs geocoding
            "useful_for_news_list": True,
            "needs_secret_key": False,
            "needs_appname": False,
            "attribution_notes": "GDELT data is free to use with attribution to the GDELT Project.",
            "limitations": "No direct coordinates, requires geocoding for globe markers.",
            "error": None,
        }
    except Exception as e:
        return {
            "source_id": source_id,
            "source_family": source_family,
            "status": "FAIL",
            "endpoint_tested": endpoint,
            "http_status": None,
            "item_count": 0,
            "sample_items": [],
            "has_coordinates": False,
            "has_country_or_region": False,
            "useful_for_globe_markers": False,
            "useful_for_news_list": False,
            "needs_secret_key": False,
            "needs_appname": False,
            "attribution_notes": "GDELT data is free to use with attribution to the GDELT Project.",
            "limitations": "No direct coordinates, requires geocoding for globe markers.",
            "error": str(e),
        }

def test_reliefweb():
    """Test ReliefWeb source - UN OCHA humanitarian reports."""
    source_id = "reliefweb"
    source_family = "humanitarian"
    endpoint = "https://api.reliefweb.int/v2/reports"
    
    log(f"Testing {source_id}...")
    
    # Check for appname
    appname = os.environ.get("RELIEFWEB_APPNAME")
    if not appname:
        return {
            "source_id": source_id,
            "source_family": source_family,
            "status": "SKIPPED",
            "endpoint_tested": endpoint,
            "http_status": None,
            "item_count": 0,
            "sample_items": [],
            "has_coordinates": False,
            "has_country_or_region": False,
            "useful_for_globe_markers": False,
            "useful_for_news_list": False,
            "needs_secret_key": False,
            "needs_appname": True,
            "attribution_notes": "ReliefWeb data is provided by UN OCHA.",
            "limitations": "Requires pre-approved appname. Set RELIEFWEB_APPNAME environment variable.",
            "error": "RELIEFWEB_APPNAME environment variable not set",
        }
    
    try:
        # Fetch latest reports
        url = f"{endpoint}?appname={appname}&limit=5&sort[]=date:desc"
        content, status = fetch_url(url)
        
        # Parse JSON response
        data = json.loads(content)
        
        # Extract sample items
        sample_items = []
        reports = data.get("data", [])
        for report in reports[:5]:  # Take first 5 as sample
            fields = report.get("fields", {})
            countries = fields.get("country", [])
            country_names = [c.get("name", "") for c in countries] if countries else []
            
            sample_items.append({
                "title": fields.get("title", "No title"),
                "url": f"https://reliefweb.int/updates/{report.get('id', '')}",
                "source_organization": fields.get("source", [{}])[0].get("name", "") if fields.get("source") else "",
                "country": ", ".join(country_names) if country_names else "",
                "disaster_references": len(fields.get("disaster", [])),
                "published_date": fields.get("date", {}).get("original", ""),
                "report_id": report.get("id", ""),
                "summary": fields.get("body", "")[:200] + "..." if fields.get("body") else "",
            })
        
        return {
            "source_id": source_id,
            "source_family": source_family,
            "status": "PASS",
            "endpoint_tested": url,
            "http_status": status,
            "item_count": len(reports),
            "sample_items": sample_items,
            "has_coordinates": False,  # ReliefWeb provides country level only
            "has_country_or_region": any(item.get("country") for item in sample_items),
            "useful_for_globe_markers": False,  # Country level only
            "useful_for_news_list": True,
            "needs_secret_key": False,
            "needs_appname": True,
            "attribution_notes": "ReliefWeb data is provided by UN OCHA under Creative Commons Attribution 4.0 International (CC BY 4.0) license.",
            "limitations": "Country-level location only, no exact coordinates.",
            "error": None,
        }
    except Exception as e:
        return {
            "source_id": source_id,
            "source_family": source_family,
            "status": "FAIL",
            "endpoint_tested": endpoint,
            "http_status": None,
            "item_count": 0,
            "sample_items": [],
            "has_coordinates": False,
            "has_country_or_region": False,
            "useful_for_globe_markers": False,
            "useful_for_news_list": False,
            "needs_secret_key": False,
            "needs_appname": True,
            "attribution_notes": "ReliefWeb data is provided by UN OCHA.",
            "limitations": "Requires pre-approved appname. Set RELIEFWEB_APPNAME environment variable.",
            "error": str(e),
        }

def test_rss_feeds():
    """Test curated RSS/Atom feeds from official sources."""
    source_id = "curated_rss"
    source_family = "rss"
    
    log(f"Testing {source_id}...")
    
    # Test multiple feeds
    feeds = [
        {
            "name": "UN News - Top Stories",
            "url": "https://news.un.org/feed/subscribe/en/news/all/rss.xml",
            "expected_format": "rss",
        },
        {
            "name": "UN News - Humanitarian Aid",
            "url": "https://news.un.org/feed/subscribe/en/news/topic/humanitarian-aid/feed/rss.xml",
            "expected_format": "rss",
        },
        {
            "name": "WHO News",
            "url": "https://www.who.int/rss-feeds/news-english.xml",
            "expected_format": "rss",
        },
        {
            "name": "CDC Newsroom",
            "url": "http://www2c.cdc.gov/podcasts/feed.asp?feedid=183",
            "expected_format": "rss",
        },
    ]
    
    sample_items = []
    working_feeds = []
    failed_feeds = []
    
    for feed in feeds:
        try:
            content, status = fetch_url(feed["url"], timeout=15)
            
            # Simple XML parsing to extract items
            # Note: This is a simplified parser for proof purposes
            items = []
            if "<item>" in content:
                # RSS format
                import re
                item_blocks = re.findall(r"<item>(.*?)</item>", content, re.DOTALL)
                for item_block in item_blocks[:3]:  # Take first 3 items
                    title_match = re.search(r"<title>(.*?)</title>", item_block)
                    link_match = re.search(r"<link>(.*?)</link>", item_block)
                    pubdate_match = re.search(r"<pubDate>(.*?)</pubDate>", item_block)
                    desc_match = re.search(r"<description>(.*?)</description>", item_block, re.DOTALL)
                    
                    title = title_match.group(1) if title_match else "No title"
                    link = link_match.group(1) if link_match else ""
                    pubdate = pubdate_match.group(1) if pubdate_match else ""
                    desc = desc_match.group(1) if desc_match else ""
                    
                    # Clean HTML tags from description
                    desc = re.sub(r"<[^>]+>", "", desc)[:200]
                    
                    items.append({
                        "feed_name": feed["name"],
                        "title": title,
                        "link": link,
                        "published_date": pubdate,
                        "summary": desc,
                        "source": feed["name"],
                        "category_hints": "news",
                    })
            
            if items:
                sample_items.extend(items)
                working_feeds.append(feed["name"])
            else:
                # Feed worked but no items found
                working_feeds.append(f"{feed['name']} (no items)")
                log(f"Feed {feed['name']} returned no items", "WARN")
            
        except Exception as e:
            log(f"Feed {feed['name']} failed: {e}", "WARN")
            failed_feeds.append(f"{feed['name']}: {e}")
    
    if not working_feeds:
        return {
            "source_id": source_id,
            "source_family": source_family,
            "status": "FAIL",
            "endpoint_tested": "Multiple RSS feeds",
            "http_status": None,
            "item_count": 0,
            "sample_items": [],
            "has_coordinates": False,
            "has_country_or_region": False,
            "useful_for_globe_markers": False,
            "useful_for_news_list": False,
            "needs_secret_key": False,
            "needs_appname": False,
            "attribution_notes": "Various institutional sources.",
            "limitations": "Inconsistent formats, may lack coordinates.",
            "error": f"All feeds failed: {'; '.join(failed_feeds)}",
        }
    
    return {
        "source_id": source_id,
        "source_family": source_family,
        "status": "PASS" if len(working_feeds) >= 2 else "PARTIAL",
        "endpoint_tested": f"{len(working_feeds)}/{len(feeds)} feeds working",
        "http_status": 200,
        "item_count": len(sample_items),
        "sample_items": sample_items,
        "has_coordinates": False,
        "has_country_or_region": False,
        "useful_for_globe_markers": False,
        "useful_for_news_list": True,
        "needs_secret_key": False,
        "needs_appname": False,
        "attribution_notes": "Various institutional sources under their respective licenses.",
        "limitations": "Inconsistent formats, may lack coordinates. Working feeds: " + ", ".join(working_feeds),
        "error": None if not failed_feeds else f"Some feeds failed: {'; '.join(failed_feeds)}",
    }

def main():
    """Main function to run all source tests."""
    log("Starting Layer 08 News & OSINT Source Proof Script")
    log(f"Output directory: {OUTPUT_DIR}")
    
    # Run tests for each source
    results = []
    
    # Test GDACS
    results.append(test_gdacs())
    
    # Test GDELT
    results.append(test_gdelt())
    
    # Test ReliefWeb
    results.append(test_reliefweb())
    
    # Test RSS Feeds
    results.append(test_rss_feeds())
    
    # Generate report
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_results": results,
        "recommended_mvp_order": [
            "gdacs",  # Best for globe markers with coordinates
            "gdelt",  # Best for news discovery
            "reliefweb",  # Best for humanitarian reports (if appname available)
            "curated_rss",  # Supplementary content
        ],
    }
    
    # Save report
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    
    log(f"Report saved to {OUTPUT_FILE}")
    
    # Print summary
    print("\n" + "="*80)
    print("SOURCE PROOF SUMMARY")
    print("="*80)
    
    for result in results:
        if result["status"] == "PASS":
            status_icon = "[PASS]"
        elif result["status"] == "FAIL":
            status_icon = "[FAIL]"
        else:
            status_icon = "[SKIP]"
        
        print(f"{status_icon} {result['source_id'].upper()}: {result['status']}")
        print(f"  Items: {result['item_count']}")
        print(f"  Coordinates: {'Yes' if result['has_coordinates'] else 'No'}")
        print(f"  Country/Region: {'Yes' if result['has_country_or_region'] else 'No'}")
        if result["error"]:
            print(f"  Error: {result['error']}")
        print()
    
    print("="*80)
    print("RECOMMENDED MVP ORDER:")
    for i, source_id in enumerate(report["recommended_mvp_order"], 1):
        print(f"{i}. {source_id.upper()}")
    print("="*80)
    
    return 0 if all(r["status"] != "FAIL" for r in results) else 1

if __name__ == "__main__":
    sys.exit(main())