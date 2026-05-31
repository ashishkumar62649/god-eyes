"""Classification — Object type, category, orbit class, and visual rules.

Provides functions to classify satellites and determine their visual
appearance (shape, color) for the frontend renderer.
"""

from __future__ import annotations

from typing import Any

# Visual shape constants
VISUAL_SHAPES = frozenset(["dot", "triangle"])

# Valid object types
OBJECT_TYPES = frozenset(["satellite", "debris", "rocket_body", "inactive_payload", "unknown"])

# Valid categories
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

# Valid orbit classes
ORBIT_CLASSES = frozenset(["vleo", "leo", "meo", "geo", "heo", "unknown"])

# Visual color palette (altitude-based, no black/white)
# Colors compatible with DB constraint: no black, no white
ALTITUDE_COLORS = {
    # Ground to 2000 km - orange
    "vleo": "#ff8c00",  # Dark orange
    # 2000-5000 km - yellow
    "leo": "#ffd000",   # Gold/Yellow
    # 5000-10000 km - lime green
    "meo": "#80ff00",   # Lime
    # 10000-20000 km - cyan
    "geo": "#00d5ff",   # Cyan
    # 20000-30000 km - blue
    "heo_20_30": "#0077ff",  # Blue
    # 30000-40000 km - purple  
    "heo_30_40": "#8a2be2",  # Blue violet
    # > 40000 km - red
    "heo_above_40": "#ff2d55",  # Red/Pink
    # Unknown altitude
    "unknown": "#00d5ff",  # Default cyan
}

# Object type specific colors (for when altitude not available)
OBJECT_TYPE_COLORS = {
    "satellite": "#00d5ff",    # Cyan
    "debris": "#ff6b35",       # Orange-red (distinct from black/white)
    "rocket_body": "#ff6b35",  # Same as debris
    "inactive_payload": "#9b59b6",  # Purple
    "unknown": "#00d5ff",      # Cyan default
}

# Category-specific colors
CATEGORY_COLORS = {
    "starlink": "#00d5ff",           # Cyan
    "communications": "#00ff88",     # Green
    "navigation": "#ff9500",         # Orange
    "weather": "#00aaff",            # Light blue
    "earth_observation": "#88ff00",  # Yellow-green
    "science": "#ff00ff",            # Magenta
    "crewed_or_station": "#ffffff",  # White (ISS important) - but filtered by constraint
    "debris": "#ff6b35",             # Orange-red
    "rocket_body": "#ff6b35",        # Orange-red
    "inactive_payload": "#9b59b6",   # Purple
    "unknown": "#00d5ff",            # Cyan
}


def get_visual_shape(object_type: str) -> str:
    """Determine visual shape based on object type.
    
    Args:
        object_type: Type of space object
        
    Returns:
        'dot' for satellites, 'triangle' for debris/rocket bodies
    """
    if object_type in ("debris", "rocket_body", "inactive_payload"):
        return "triangle"
    return "dot"


def get_visual_color(
    orbit_class: str | None = None,
    altitude_km: float | None = None,
    object_type: str | None = None,
    category: str | None = None,
    is_important: bool = False,
) -> str:
    """Determine visual color based on altitude or object type.
    
    Color selection rules (priority):
    1. Altitude-based colors (most accurate for orbit class display)
    2. Category colors if altitude unavailable
    3. Object type colors as fallback
    
    Args:
        orbit_class: Orbit class (vleo, leo, meo, geo, heo, unknown)
        altitude_km: Current altitude in km
        object_type: Object type (satellite, debris, etc.)
        category: Category (starlink, navigation, etc.)
        is_important: Whether object should be highlighted
        
    Returns:
        Hex color string (never black or white)
    """
    # For important objects, use a distinctive color (not white)
    if is_important:
        return "#ffd700"  # Gold for important/highlighted
    
    # Try altitude-based coloring first
    if orbit_class and altitude_km is not None:
        return _get_altitude_color(orbit_class, altitude_km)
    
    # Fall back to category color
    if category and category in CATEGORY_COLORS:
        color = CATEGORY_COLORS[category]
        if _is_safe_color(color):
            return color
    
    # Fall back to object type color
    if object_type and object_type in OBJECT_TYPE_COLORS:
        color = OBJECT_TYPE_COLORS[object_type]
        if _is_safe_color(color):
            return color
    
    # Fall back to orbit class color
    if orbit_class and orbit_class in ALTITUDE_COLORS:
        color = ALTITUDE_COLORS[orbit_class]
        if _is_safe_color(color):
            return color
    
    # Final fallback - cyan (safe default)
    return "#00d5ff"


def _get_altitude_color(orbit_class: str, altitude_km: float) -> str:
    """Get color based on altitude and orbit class."""
    if altitude_km < 2000:
        return "#ff8c00"  # Dark orange - VLEO
    elif altitude_km < 5000:
        return "#ffd000"  # Gold - LEO
    elif altitude_km < 10000:
        return "#80ff00"  # Lime - MEO lower
    elif altitude_km < 20000:
        return "#00d5ff"  # Cyan - MEO upper / GEO
    elif altitude_km < 30000:
        return "#0077ff"  # Blue - GEO
    elif altitude_km < 40000:
        return "#8a2be2"  # Purple - HEO
    else:
        return "#ff2d55"  # Red - High HEO


def _is_safe_color(color: str) -> bool:
    """Check if color is safe (not black or white)."""
    if not color:
        return False
    
    color_lower = color.lower().lstrip("#")
    
    # Check for black variants
    if color_lower in ("000000", "000", "black"):
        return False
    
    # Check for white variants  
    if color_lower in ("ffffff", "fff", "white"):
        return False
    
    return True


def classify_object(
    name: str,
    norad_cat_id: int | None = None,
    tle_line1: str | None = None,
    tle_line2: str | None = None,
) -> dict[str, Any]:
    """Comprehensive classification of a space object.
    
    Args:
        name: Object name from TLE
        norad_cat_id: NORAD catalog ID
        tle_line1: TLE line 1 (optional, for orbit class)
        tle_line2: TLE line 2 (optional, for orbit class)
        
    Returns:
        Dictionary with classification results:
        - object_type: satellite/debris/rocket_body/inactive_payload/unknown
        - category: starlink/communications/navigation/etc.
        - orbit_class: vleo/leo/meo/geo/heo/unknown
        - is_important: bool
        - visual_shape: dot/triangle
        - visual_color: hex color
    """
    name_lower = name.lower()
    name_upper = name.upper()
    
    # Determine object type
    object_type = _classify_object_type(name_lower)
    
    # Determine category
    category = _classify_category(name, name_lower, name_upper)
    
    # Determine orbit class from TLE if available
    orbit_class = _classify_orbit_class(tle_line1, tle_line2)
    
    # Determine if important
    is_important = _classify_important(name_upper, norad_cat_id)
    
    # Visual shape
    visual_shape = get_visual_shape(object_type)
    
    # Visual color
    visual_color = get_visual_color(
        orbit_class=orbit_class,
        object_type=object_type,
        category=category,
        is_important=is_important,
    )
    
    return {
        "object_type": object_type,
        "category": category,
        "orbit_class": orbit_class,
        "is_important": is_important,
        "visual_shape": visual_shape,
        "visual_color": visual_color,
    }


def _classify_object_type(name_lower: str) -> str:
    """Classify object type from name."""
    if any(x in name_lower for x in ["debris", "fragment", "piece"]):
        return "debris"
    if "r/b" in name_lower or "rocket body" in name_lower:
        return "rocket_body"
    if any(x in name_lower for x in ["defunct", "inactive", "decayed"]):
        return "inactive_payload"
    return "satellite"


def _classify_category(name: str, name_lower: str, name_upper: str) -> str:
    """Classify category from name."""
    import re
    
    # Check Starlink
    if "star" in name_lower and "link" in name_lower:
        return "starlink"
    for pattern in [re.compile(r"star\s*link", re.I), re.compile(r"spacex.*\d+", re.I)]:
        if pattern.search(name):
            return "starlink"
    
    # Navigation
    if any(x in name_lower for x in ["gps", "glonass", "galileo", "beidou", "compass", "navsat"]):
        return "navigation"
    
    # Weather
    if any(x in name_lower for x in ["noaa", "goes", "meteosat", "himawari", "fy-", "gms"]):
        return "weather"
    
    # Earth observation
    if any(x in name_lower for x in ["landsat", "sentinel", "modis", "aqua", "terra", "spot", "planet"]):
        return "earth_observation"
    
    # Communications
    if any(x in name_lower for x in ["comms", "communication", "satcom", "intelsat", "eutelsat", "ses-"]):
        return "communications"
    
    # Crewed stations
    if any(x in name_lower for x in ["iss ", "zarya", "tiangong", "skylab", "salyut", "mir ", "tss"]):
        return "crewed_or_station"
    
    # Science
    if any(x in name_lower for x in ["hst", "hubble", "chandra", "xmm", "spitzer", "kepler", "tess", "jwst"]):
        return "science"
    
    # Debris
    if any(x in name_lower for x in ["debris", "fragment", "piece"]):
        return "debris"
    
    # Rocket body
    if "r/b" in name_lower or "rocket" in name_lower:
        return "rocket_body"
    
    return "unknown"


def _classify_orbit_class(tle_line1: str | None, tle_line2: str | None) -> str:
    """Classify orbit class from TLE data."""
    import math
    
    if not tle_line1 or not tle_line2 or len(tle_line2) < 63:
        return "unknown"
    
    try:
        mean_motion_str = tle_line2[52:63].strip()
        mean_motion = float(mean_motion_str)
        
        if mean_motion > 14.0:
            return "vleo"
        elif mean_motion > 10.0:
            return "leo"
        elif mean_motion > 2.0:
            return "meo"
        elif 0.9 <= mean_motion <= 1.1:
            return "geo"
        else:
            return "heo"
    except (ValueError, IndexError):
        return "unknown"


def _classify_important(name_upper: str, norad_cat_id: int | None) -> bool:
    """Determine if object should be marked as important."""
    important_keywords = [
        "ISS",
        "ZARYA",
        "TIANGONG",
        "HUBBLE",
        "HST",
        "GPS",
        "GALILEO", 
        "GLONASS",
        "BEIDOU",
        "GOES",
        "NOAA",
        "SENTINEL",
        "LANDSAT",
        "COSMOS",
    ]
    
    for keyword in important_keywords:
        if keyword in name_upper:
            # Don't mark all Cosmos as important (too many)
            if keyword == "COSMOS" and norad_cat_id:
                # Only mark specific Cosmos that are important
                if norad_cat_id < 10000:  # Lower numbers tend to be older/significant
                    return True
                return False
            return True
    
    return False


# Standalone test
if __name__ == "__main__":
    test_cases = [
        "ISS (ZARYA)",
        "STARLINK 1542",
        "GPS BIIR-2",
        "NOAA 19",
        "HUBBLE SPACE TELESCOPE",
        "COSMOS 2542",
        "DEBris fragment",
    ]
    
    print("[TEST] Classification:")
    for name in test_cases:
        result = classify_object(name, norad_cat_id=25544 if "ISS" in name else None)
        print(f"\n  {name}:")
        print(f"    object_type: {result['object_type']}")
        print(f"    category: {result['category']}")
        print(f"    is_important: {result['is_important']}")
        print(f"    visual_shape: {result['visual_shape']}")
        print(f"    visual_color: {result['visual_color']}")