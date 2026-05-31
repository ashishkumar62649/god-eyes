"""TLE Parser / Normalizer — Converts raw TLE records to normalized objects.

This module provides functions to convert raw CelesTrak TLE records
into normalized objects suitable for the database schema.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from celestrak_client import TLERecord

# Layer identity
LAYER_ID = "layer_05_space_satellites"
SOURCE_ID = "celestrak"


# Valid object types from DB schema
OBJECT_TYPES = frozenset(["satellite", "debris", "rocket_body", "inactive_payload", "unknown"])

# Valid categories from DB schema
CATEGORIES = frozenset([
    "starlink",
    "communications", 
    "navigation",
    "weather",
    "earth_observation",
    "science",
    "crewed_or_station",
    "debris",
    "rocket_body",
    "inactive_payload",
    "unknown",
])

# Valid orbit classes from DB schema
ORBIT_CLASSES = frozenset(["vleo", "leo", "meo", "geo", "heo", "unknown"])

# Important objects to highlight
IMPORTANT_KEYWORDS = frozenset([
    "ISS",           # International Space Station
    "ZARYA",         # ISS first module
    "TIANGONG",      # Chinese space station
    "TSS",           # Temporary Space Station
    "HUBBLE",        # Hubble Space Telescope
    "HST",           # Hubble (alternate)
    "GPS",           # GPS satellites
    "GALILEO",       # Galileo navigation
    "GLONASS",       # GLONASS navigation
    "BEIDOU",        # BeiDou navigation
    "GOES",          # GOES weather satellites
    "NOAA",          # NOAA weather satellites
    "SENTINEL",      # Sentinel (Copernicus)
    "LANDSAT",       # Landsat earth observation
    "COSMOS",        # Russian satellites
    "PROGRESS",      # Russian cargo
    "SOYUZ",         # Russian crew
    "SHENZHOU",      # Chinese crew
    "DRAGON",        # SpaceX Dragon
    "ATV",           # European cargo
    "JAXA",          # Japanese cargo
])

# Starlink keyword patterns
STARLINK_PATTERNS = [
    re.compile(r"STARLINK", re.IGNORECASE),
    re.compile(r"^SpaceX.*\d+", re.IGNORECASE),
]


@dataclass
class NormalizedSatellite:
    """Normalized satellite record for database insertion."""
    layer_id: str = LAYER_ID
    source_id: str = SOURCE_ID
    source_object_id: str = ""
    norad_cat_id: int = 0
    name: str = ""
    object_type: str = "unknown"
    category: str = "unknown"
    orbit_class: str = "unknown"
    country: str | None = None
    operator_or_owner: str | None = None
    launch_date: str | None = None
    tle_line1: str = ""
    tle_line2: str = ""
    orbital_epoch_at: datetime | None = None
    source_updated_at: datetime | None = None
    first_seen_at: datetime | None = None
    last_seen_at: datetime | None = None
    is_active: bool = True
    is_important: bool = False
    raw_source_json: dict[str, Any] = field(default_factory=dict)


def normalize_tle_record(record: TLERecord) -> NormalizedSatellite:
    """Convert a TLE record to a normalized satellite object.
    
    Args:
        record: Raw TLE record from CelesTrak client
        
    Returns:
        Normalized satellite object ready for database insertion
    """
    # Extract epoch from TLE line 1
    epoch = parse_tle_epoch(record.tle_line1)
    
    # Determine object type
    object_type = determine_object_type(record)
    
    # Determine category
    category = determine_category(record)
    
    # Determine orbit class from TLE data
    orbit_class = determine_orbit_class(record.tle_line1, record.tle_line2)
    
    # Determine if important
    is_important = determine_important(record)
    
    now = datetime.now(timezone.utc)
    
    return NormalizedSatellite(
        layer_id=LAYER_ID,
        source_id=SOURCE_ID,
        source_object_id=str(record.norad_cat_id),
        norad_cat_id=record.norad_cat_id,
        name=record.name,
        object_type=object_type,
        category=category,
        orbit_class=orbit_class,
        country=record.country,
        operator_or_owner=extract_operator(record.name),
        launch_date=record.launch_date,
        tle_line1=record.tle_line1,
        tle_line2=record.tle_line2,
        orbital_epoch_at=epoch,
        source_updated_at=record.source_updated_at,
        first_seen_at=now,
        last_seen_at=now,
        is_active=True,
        is_important=is_important,
        raw_source_json={
            "name": record.name,
            "tle_line1": record.tle_line1,
            "tle_line2": record.tle_line2,
            "object_type_inferred": object_type,
            "category_inferred": category,
            "orbit_class_inferred": orbit_class,
        },
    )


def parse_tle_epoch(tle_line1: str) -> datetime | None:
    """Extract orbital epoch from TLE line 1.
    
    TLE Line 1 format:
    1 NNNNNC NNNNNAAA NNNNN.NNNNNNNN +.NNNNNNNN +NNNNN-N +NNNNN-N N Z
    
    The epoch is in the format YYDDD.DDDDDDDD (year and day of year).
    """
    if not tle_line1 or len(tle_line1) < 34:
        return None
        
    try:
        # Extract year (2 digits) and day of year (3 digits + fractional)
        epoch_str = tle_line1[18:32]
        year_short = int(epoch_str[0:2])
        day_of_year = float(epoch_str[2:])
        
        # Convert 2-digit year to 4-digit
        year = 2000 + year_short if year_short < 50 else 1900 + year_short
        
        # Calculate datetime from day of year
        from datetime import timedelta
        epoch = datetime(year, 1, 1, tzinfo=timezone.utc) + timedelta(days=day_of_year - 1)
        
        return epoch
        
    except (ValueError, IndexError):
        return None


def determine_object_type(record: TLERecord) -> str:
    """Determine object type from TLE record."""
    name_lower = record.name.lower()
    
    # Use the type from celestrak client if available
    if record.object_type and record.object_type in OBJECT_TYPES:
        return record.object_type
    
    # Check for debris indicators
    if any(x in name_lower for x in ["debris", "fragment", "r/b", "rocket body", "payload"]):
        if "rocket" in name_lower or "r/b" in name_lower:
            return "rocket_body"
        return "debris"
    
    # Check for inactive payload
    if "defunct" in name_lower or "inactive" in name_lower or "decayed" in name_lower:
        return "inactive_payload"
    
    return "satellite"


def determine_category(record: TLERecord) -> str:
    """Determine category from TLE record name."""
    name = record.name
    
    # Check for Starlink
    for pattern in STARLINK_PATTERNS:
        if pattern.search(name):
            return "starlink"
    
    name_lower = name.lower()
    
    # Navigation
    if any(x in name_lower for x in ["gps", "glonass", "galileo", "beidou", "compass", "navsat"]):
        return "navigation"
    
    # Weather
    if any(x in name_lower for x in ["noaa", "goes", "meteosat", "himawari", "fy", "gms"]):
        return "weather"
    
    # Earth observation
    if any(x in name_lower for x in ["landsat", "sentinel", "modis", "aqua", "terra", "spot"]):
        return "earth_observation"
    
    # Communications
    if any(x in name_lower for x in ["comms", "communication", "satcom", "SES", "intelsat", "eutelsat"]):
        return "communications"
    
    # Crewed stations
    if any(x in name_lower for x in ["iss", "zarya", "tiangong", "skylab", "salyut", "mir"]):
        return "crewed_or_station"
    
    # Science
    if any(x in name_lower for x in ["hst", "hubble", "chandra", "xmm", "spitzer", "kepler", "tess"]):
        return "science"
    
    # Debris
    if any(x in name_lower for x in ["debris", "fragment", "piece"]):
        return "debris"
    
    # Rocket body
    if any(x in name_lower for x in ["r/b", "rocket body", "upper stage", "block"]):
        return "rocket_body"
    
    return "unknown"


def determine_orbit_class(tle_line1: str, tle_line2: str) -> str:
    """Determine orbit class from TLE data.
    
    Orbit classes:
    - VLEO: Very Low Earth Orbit (< 500 km)
    - LEO: Low Earth Orbit (500 - 2000 km)
    - MEO: Medium Earth Orbit (2000 - 35,756 km)
    - GEO: Geostationary Orbit (~35,786 km)
    - HEO: Highly Elliptical Orbit
    """
    if not tle_line1 or not tle_line2:
        return "unknown"
    
    try:
        # Extract mean motion from TLE line 1 (revolutions per day)
        # Position 52-63 in TLE line 2
        mean_motion_str = tle_line2[52:63].strip()
        if not mean_motion_str:
            return "unknown"
            
        mean_motion = float(mean_motion_str)
        
        # Convert mean motion to approximate altitude
        # Mean motion (revs/day) = sqrt(GM / a^3) * (2*pi)
        # Solving for a (semi-major axis in km):
        # a = (398600.4418 / (mean_motion * 2*pi / 86400)^2)^(1/3)
        # Simplified approximation using known relationships:
        # Mean motion of 15.5 revs/day ≈ 2000 km altitude
        # Mean motion of 14.5 revs/day ≈ 5000 km altitude  
        # Mean motion of 1.0027 revs/day ≈ GEO
        
        if mean_motion > 14.0:  # Very high mean motion = VLEO
            return "vleo"
        elif mean_motion > 10.0:  # High mean motion = LEO
            return "leo"
        elif mean_motion > 2.0:   # Medium mean motion = MEO
            return "meo"
        elif 0.9 <= mean_motion <= 1.1:  # ~1 rev/day = GEO
            return "geo"
        elif mean_motion < 0.9:  # Less than GEO = HEO
            return "heo"
        else:
            return "unknown"
            
    except (ValueError, IndexError):
        return "unknown"


def determine_important(record: TLERecord) -> bool:
    """Determine if object is important (should be highlighted)."""
    name_upper = record.name.upper()
    
    for keyword in IMPORTANT_KEYWORDS:
        if keyword.upper() in name_upper:
            # Don't mark all Starlink as important (only specific ones)
            if keyword == "STARLINK" and "STARLINK" in name_upper:
                # Only very specific Starlink objects might be important
                # For now, we don't mark routine Starlink as important
                continue
            return True
    
    return False


def extract_operator(name: str) -> str | None:
    """Extract operator/owner from TLE name."""
    name_upper = name.upper()
    
    # Common operators
    operators = {
        "NASA": ["NASA", "UNITED STATES", "US NASA"],
        "ROSCOSMOS": ["ROSCOSMOS", "CIS", "RUSSIA", "SOVIET"],
        "ESA": ["ESA", "EUROPEAN"],
        "JAXA": ["JAXA", "JAPAN"],
        "ISRO": ["ISRO", "INDIA"],
        "CNSA": ["CNSA", "CHINA"],
        "SPACEX": ["SPACEX", "SPACE X"],
        "ONEWEB": ["ONEWEB"],
        "SES": ["SES"],
        "INTELSAT": ["INTELSAT"],
        "EUTELSAT": ["EUTELSAT"],
    }
    
    for operator, patterns in operators.items():
        for pattern in patterns:
            if pattern in name_upper:
                return operator
    
    return None


def normalize_records(records: list[TLERecord]) -> list[NormalizedSatellite]:
    """Normalize a list of TLE records."""
    return [normalize_tle_record(r) for r in records]


# Standalone test
if __name__ == "__main__":
    from celestrak_client import TLERecord
    
    # Create a sample TLE record for testing
    sample = TLERecord(
        norad_cat_id=25544,
        name="ISS (ZARYA)",
        tle_line1="1 25544U 98067A   23250.50000000  .00016717  00000-0  10270-3 0  9991",
        tle_line2="2 25544  51.6415 208.9168 0006703  35.0853 325.0284 15.49994638427245",
        object_type="satellite",
        country="USA",
        launch_date="1998-067A",
        source_updated_at=datetime.now(timezone.utc),
    )
    
    normalized = normalize_tle_record(sample)
    print(f"[TEST] Normalized ISS:")
    print(f"  norad_cat_id: {normalized.norad_cat_id}")
    print(f"  name: {normalized.name}")
    print(f"  object_type: {normalized.object_type}")
    print(f"  category: {normalized.category}")
    print(f"  orbit_class: {normalized.orbit_class}")
    print(f"  is_important: {normalized.is_important}")
    print(f"  country: {normalized.country}")
    print(f"  operator_or_owner: {normalized.operator_or_owner}")
    print(f"  launch_date: {normalized.launch_date}")
    print(f"  orbital_epoch: {normalized.orbital_epoch_at}")