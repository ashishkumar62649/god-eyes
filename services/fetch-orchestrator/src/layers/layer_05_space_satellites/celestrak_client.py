"""CelesTrak Client — Fetches public TLE satellite data.

CelesTrak provides free, public TLE (Two-Line Element) data for satellites,
debris, and other orbital objects. No API key required.

Usage:
    from celestrak_client import fetch_tle_group, CELESTRAK_GROUPS
    
    data = fetch_tle_group("active")
    data = fetch_tle_group("starlink")
    data = fetch_tle_group("stations")
"""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

# CelesTrak base URL
CELESTRAK_BASE_URL = "https://celestrak.org/NORAD/elements/gp.php"

# Valid group queries supported by CelesTrak
CELESTRAK_GROUPS = [
    "active",        # Active satellites
    "starlink",      # Starlink satellites
    "stations",      # Space stations (ISS, Tiangong, etc.)
    "weather",       # Weather satellites
    "noaa",          # NOAA weather satellites
    "goes",          # GOES weather satellites
    "navigation",    # Navigation satellites (GPS, GLONASS, Galileo, etc.)
    "science",       # Scientific satellites
    "cubesat",       # CubeSats
    " debris",       # Debris (note leading space in URL)
    "rocket-bodies", # Rocket bodies
    "special",       # Special interest objects
    "last-30-days",  # Objects launched in last 30 days
]

DEFAULT_USER_AGENT = "GodEyes/1.0 (space-satellite-fetcher; +https://github.com/god-eyes)"


@dataclass
class TLERecord:
    """Represents a parsed TLE record from CelesTrak."""
    norad_cat_id: int
    name: str
    tle_line1: str
    tle_line2: str
    object_type: str | None = None
    country: str | None = None
    launch_date: str | None = None
    source_updated_at: datetime | None = None


def fetch_tle_group(
    group: str = "active",
    format_type: str = "tle",
    timeout: int = 30,
) -> list[TLERecord] | None:
    """Fetch TLE data for a specific group from CelesTrak.
    
    Args:
        group: Group name (e.g., 'active', 'starlink', 'stations')
        format_type: Output format ('tle' for text TLE, 'html' for HTML table)
        timeout: Request timeout in seconds
        
    Returns:
        List of TLE records, or None on error.
    """
    # Use space-prefixed group for debris
    url_group = group if not group.startswith(" ") else group.lstrip()
    
    url = f"{CELESTRAK_BASE_URL}?GROUP={url_group}&FORMAT={format_type}"
    
    req = urllib.request.Request(url, headers={"User-Agent": DEFAULT_USER_AGENT})
    
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return parse_tle_text(raw)
    except urllib.error.HTTPError as exc:
        print(f"[CELESTRAK] HTTP error {exc.code}: {exc.reason} for group: {group}")
        return None
    except urllib.error.URLError as exc:
        print(f"[CELESTRAK] URL error: {exc.reason}")
        return None
    except Exception as exc:
        print(f"[CELESTRAK] Error: {exc}")
        return None


def parse_tle_text(text: str) -> list[TLERecord]:
    """Parse TLE text format into TLE records.
    
    CelesTrak TLE format:
    NAME
    LINE1
    LINE2
    """
    records: list[TLERecord] = []
    lines = text.strip().split("\n")
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
            
        # Check if this looks like a TLE name line (not a TLE line)
        # TLE Line 1 starts with "1 " followed by satellite number
        # TLE Line 2 starts with "2 " followed by satellite number
        if line.startswith("1 ") or line.startswith("2 "):
            i += 1
            continue
            
        # This should be a name line
        name = line
        i += 1
        
        if i + 1 >= len(lines):
            break
            
        line1 = lines[i].strip()
        line2 = lines[i + 1].strip()
        
        # Validate TLE lines
        if not (line1.startswith("1 ") and line2.startswith("2 ")):
            i += 1
            continue
            
        # Parse NORAD catalog number from line 1
        # Format: 1 NNNNNC NNNNNAAA NNNNN.NNNNNNNN +.NNNNNNNN +NNNNN-N +NNNNN-N N Z
        norad_match = re.match(r"1\s+(\d{5})", line1)
        if not norad_match:
            i += 2
            continue
            
        norad_cat_id = int(norad_match.group(1))
        
        # Extract launch date from name if present (e.g., "NAME [1998-067A]")
        launch_date = None
        launch_match = re.search(r"\[(\d{4}-\d{2}[A-Z]?)\]", name)
        if launch_match:
            launch_date = launch_match.group(1)
        
        # Determine object type from name
        object_type = infer_object_type(name)
        
        # Extract country/owner from name if available
        country = infer_country(name)
        
        records.append(TLERecord(
            norad_cat_id=norad_cat_id,
            name=name.strip(),
            tle_line1=line1,
            tle_line2=line2,
            object_type=object_type,
            country=country,
            launch_date=launch_date,
            source_updated_at=datetime.now(timezone.utc),
        ))
        
        i += 2
    
    return records


def infer_object_type(name: str) -> str:
    """Infer object type from TLE name."""
    name_lower = name.lower()
    
    # Check for debris indicators
    if any(x in name_lower for x in ["debris", "fragment", "debris", "r/b", "rocket body"]):
        return "debris"
    
    # Check for rocket body
    if "r/b" in name_lower or "rocket body" in name_lower:
        return "rocket_body"
    
    # Check for inactive payload
    if "defunct" in name_lower or "inactive" in name_lower:
        return "inactive_payload"
    
    # Default to satellite
    return "satellite"


def infer_country(name: str) -> str | None:
    """Infer country/owner from TLE name."""
    # Common country/owner prefixes
    country_patterns = [
        ("USA", ["US", "USA", "UNITED STATES", "NRO", "NRL", "USAF"]),
        ("Russia", ["RUSSIA", "CIS", "SOVIET"]),
        ("China", ["CHINA", "CNSA", "PRC"]),
        ("Europe", ["ESA", "EUROPE", "EUMETSAT"]),
        ("Japan", ["JAPAN", "JAXA"]),
        ("India", ["INDIA", "ISRO"]),
        ("Canada", ["CANADA", "CSA"]),
        ("France", ["FRANCE", "CNES"]),
        ("Germany", ["GERMANY", "DLR"]),
        ("Italy", ["ITALY", "ASI"]),
    ]
    
    name_upper = name.upper()
    for country, patterns in country_patterns:
        for pattern in patterns:
            if pattern in name_upper:
                return country
    
    return None


def get_group_display_name(group: str) -> str:
    """Get human-readable display name for a group."""
    display_names = {
        "active": "Active Satellites",
        "starlink": "Starlink Constellation",
        "stations": "Space Stations",
        "weather": "Weather Satellites",
        "noaa": "NOAA Weather Satellites",
        "goes": "GOES Weather Satellites",
        "navigation": "Navigation Satellites",
        "science": "Scientific Satellites",
        "cubesat": "CubeSats",
        "debris": "Space Debris",
        "rocket-bodies": "Rocket Bodies",
        "special": "Special Interest",
        "last-30-days": "Recent Launches",
    }
    return display_names.get(group, group.title())


# Standalone test
if __name__ == "__main__":
    print("[TEST] Fetching 'stations' group from CelesTrak...")
    records = fetch_tle_group("stations")
    if records:
        print(f"  Fetched {len(records)} TLE records")
        for rec in records[:3]:
            print(f"  - {rec.name} (NORAD: {rec.norad_cat_id})")
    else:
        print("  Failed to fetch data")