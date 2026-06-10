"""Grid generation and batching for Layer 07 Weather.

Generates a deterministic 5° global grid and batches coordinates.
Does NOT call Open-Meteo.
"""

from __future__ import annotations

import math
from typing import Any

DEFAULT_SPACING = 5
DEFAULT_BATCH_SIZE = 50

# Proof coordinates used in WO-WEATHER-S
PROOF_COORDINATES = [
    {"name": "Bengaluru, India",  "latitude": 12.9716,  "longitude": 77.5946},
    {"name": "Delhi, India",      "latitude": 28.6139,  "longitude": 77.2090},
    {"name": "London, UK",        "latitude": 51.5074,  "longitude": -0.1278},
    {"name": "New York, USA",     "latitude": 40.7128,  "longitude": -74.0060},
    {"name": "Sydney, Australia", "latitude": -33.8688, "longitude": 151.2093},
    {"name": "Tokyo, Japan",      "latitude": 35.6762,  "longitude": 139.6503},
    {"name": "Cape Town, SA",     "latitude": -33.9249, "longitude": 18.4241},
]


def generate_grid(spacing: int = DEFAULT_SPACING) -> list[dict[str, float]]:
    """Return deterministic list of {latitude, longitude} dicts for a global grid.

    Latitude: -90 to +90 inclusive (37 values at 5° spacing).
    Longitude: -180 inclusive to +175 (72 values at 5° spacing).
      +180 is excluded because it is the same meridian as -180.
    Total at 5°: 37 × 72 = 2664 coordinates.
    """
    coords = []
    lat = -90
    while lat <= 90:
        lon = -180
        while lon < 180:  # exclude +180 (duplicate of -180)
            coords.append({"latitude": float(lat), "longitude": float(lon)})
            lon += spacing
        lat += spacing
    return coords


def batch_coordinates(
    coords: list[dict[str, Any]],
    batch_size: int = DEFAULT_BATCH_SIZE,
) -> list[list[dict[str, Any]]]:
    """Split coordinate list into stable batches of batch_size."""
    return [coords[i : i + batch_size] for i in range(0, len(coords), batch_size)]


def grid_summary(spacing: int = DEFAULT_SPACING, batch_size: int = DEFAULT_BATCH_SIZE) -> dict[str, int]:
    """Return estimated grid stats without generating full list.

    Matches generate_grid: lon range is -180 inclusive to +180 exclusive (72 values at 5°).
    """
    lat_count = len(range(-90, 91, spacing))
    lon_count = len(range(-180, 180, spacing))  # excludes +180
    total = lat_count * lon_count
    batches = math.ceil(total / batch_size)
    return {
        "total_coordinates": total,
        "batch_count": batches,
        "planned_requests": batches,
    }


def get_proof_coordinates() -> list[dict[str, Any]]:
    """Return the approved WO-WEATHER-S proof coordinate set."""
    return list(PROOF_COORDINATES)
