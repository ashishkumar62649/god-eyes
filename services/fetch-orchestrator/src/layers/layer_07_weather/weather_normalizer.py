"""Normalizer for raw Open-Meteo batch responses — Layer 07 Weather.

Converts raw API response items into GOD EYES weather observation dicts.
No database writes. No network calls.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from layers.layer_07_weather.weather_codes import get_weather_label

LAYER_ID = "layer_07_weather"
SOURCE_ID = "open-meteo"
DEFAULT_GRID_RESOLUTION = "5deg"


# ---------------------------------------------------------------------------
# ID generation
# ---------------------------------------------------------------------------

def build_location_id(
    requested_latitude: float,
    requested_longitude: float,
    grid_resolution: str = DEFAULT_GRID_RESOLUTION,
) -> str:
    """Deterministic 16-char location ID from requested coordinates."""
    key = f"{LAYER_ID}|{SOURCE_ID}|{grid_resolution}|{requested_latitude:.6f}|{requested_longitude:.6f}"
    return hashlib.sha256(key.encode()).hexdigest()[:16]


def build_observation_id(location_id: str, source_id: str, forecast_for: str) -> str:
    """Deterministic 24-char observation ID."""
    key = f"{location_id}|{source_id}|{forecast_for}"
    return hashlib.sha256(key.encode()).hexdigest()[:24]


# ---------------------------------------------------------------------------
# Provider metadata
# ---------------------------------------------------------------------------

def extract_provider_metadata(item: dict[str, Any]) -> dict[str, Any]:
    """Extract Open-Meteo response metadata into provider_metadata dict."""
    meta: dict[str, Any] = {}
    for key in (
        "generationtime_ms", "utc_offset_seconds", "timezone",
        "timezone_abbreviation", "elevation",
    ):
        if key in item:
            meta[key] = item[key]
    # Preserve Open-Meteo location_id
    if "location_id" in item:
        meta["location_id"] = item["location_id"]
    # Preserve unit objects for reference
    if "current_units" in item:
        meta["current_units"] = item["current_units"]
    if "hourly_units" in item:
        meta["hourly_units"] = item["hourly_units"]
    return meta


def _safe_get(d: dict[str, Any], key: str) -> Any:
    """Return value or None; never raises."""
    return d.get(key)


# ---------------------------------------------------------------------------
# Core observation builder
# ---------------------------------------------------------------------------

def _base_obs(
    location_id: str,
    requested_lat: float,
    requested_lon: float,
    resolved_lat: float,
    resolved_lon: float,
    elevation_m: float | None,
    source_id: str,
    fetched_at: str,
    raw_evidence_uri: str | None,
    provider_meta: dict[str, Any],
) -> dict[str, Any]:
    return {
        "layer_id": LAYER_ID,
        "source_id": source_id,
        "location_id": location_id,
        "requested_latitude": requested_lat,
        "requested_longitude": requested_lon,
        "resolved_latitude": resolved_lat,
        "resolved_longitude": resolved_lon,
        "elevation_m": elevation_m,
        "fetched_at": fetched_at,
        "raw_evidence_uri": raw_evidence_uri,
        "provider_metadata": provider_meta,
    }


# ---------------------------------------------------------------------------
# Current weather normalization
# ---------------------------------------------------------------------------

def normalize_current_observation(
    item: dict[str, Any],
    requested_coordinate: dict[str, float],
    source_id: str = SOURCE_ID,
    raw_evidence_uri: str | None = None,
    fetched_at: str | None = None,
    grid_resolution: str = DEFAULT_GRID_RESOLUTION,
) -> dict[str, Any] | None:
    """Normalize the current weather block of one response item.

    Returns None if required fields (temperature_c, forecast_for) are absent.
    """
    current = item.get("current")
    if not isinstance(current, dict):
        return None

    forecast_for = _safe_get(current, "time")
    temperature_c = _safe_get(current, "temperature_2m")
    if forecast_for is None or temperature_c is None:
        return None

    req_lat = float(requested_coordinate["latitude"])
    req_lon = float(requested_coordinate["longitude"])
    resolved_lat = float(item.get("latitude", req_lat))
    resolved_lon = float(item.get("longitude", req_lon))
    elevation_m = item.get("elevation")

    location_id = build_location_id(req_lat, req_lon, grid_resolution)
    observation_id = build_observation_id(location_id, source_id, forecast_for)

    ft = fetched_at or datetime.now(timezone.utc).isoformat()
    provider_meta = extract_provider_metadata(item)
    sp = _safe_get(current, "surface_pressure")
    if sp is not None:
        provider_meta["surface_pressure_hpa"] = sp

    weather_code = _safe_get(current, "weather_code")

    obs = _base_obs(
        location_id, req_lat, req_lon, resolved_lat, resolved_lon,
        elevation_m, source_id, ft, raw_evidence_uri, provider_meta,
    )
    obs.update({
        "observation_id": observation_id,
        "observation_type": "current",
        "forecast_for": forecast_for,
        "temperature_c": temperature_c,
        "apparent_temperature_c": _safe_get(current, "apparent_temperature"),
        "wind_speed_kph": _safe_get(current, "wind_speed_10m"),
        "wind_direction_deg": _safe_get(current, "wind_direction_10m"),
        "wind_gust_kph": _safe_get(current, "wind_gusts_10m"),
        "humidity_percent": _safe_get(current, "relative_humidity_2m"),
        "pressure_hpa": _safe_get(current, "pressure_msl"),
        "precipitation_mm": _safe_get(current, "precipitation"),
        "precipitation_probability_percent": None,  # not available in current block
        "cloud_cover_percent": _safe_get(current, "cloud_cover"),
        "weather_code": weather_code,
        "weather_label": get_weather_label(weather_code),
    })
    return obs


# ---------------------------------------------------------------------------
# Hourly forecast normalization
# ---------------------------------------------------------------------------

def normalize_hourly_observations(
    item: dict[str, Any],
    requested_coordinate: dict[str, float],
    source_id: str = SOURCE_ID,
    raw_evidence_uri: str | None = None,
    fetched_at: str | None = None,
    grid_resolution: str = DEFAULT_GRID_RESOLUTION,
) -> list[dict[str, Any]]:
    """Normalize the hourly block of one response item into a list of observations."""
    hourly = item.get("hourly")
    if not isinstance(hourly, dict):
        return []

    times = hourly.get("time", [])
    if not times:
        return []

    req_lat = float(requested_coordinate["latitude"])
    req_lon = float(requested_coordinate["longitude"])
    resolved_lat = float(item.get("latitude", req_lat))
    resolved_lon = float(item.get("longitude", req_lon))
    elevation_m = item.get("elevation")
    location_id = build_location_id(req_lat, req_lon, grid_resolution)
    ft = fetched_at or datetime.now(timezone.utc).isoformat()
    base_provider_meta = extract_provider_metadata(item)

    def _idx(key: str, i: int) -> Any:
        arr = hourly.get(key)
        if not isinstance(arr, list) or i >= len(arr):
            return None
        val = arr[i]
        return None if val is None else val

    results = []
    for i, forecast_for in enumerate(times):
        temperature_c = _idx("temperature_2m", i)
        if temperature_c is None:
            continue  # skip invalid hourly slots

        provider_meta = dict(base_provider_meta)
        sp = _idx("surface_pressure", i)
        if sp is not None:
            provider_meta["surface_pressure_hpa"] = sp

        observation_id = build_observation_id(location_id, source_id, forecast_for)
        weather_code = _idx("weather_code", i)

        obs = _base_obs(
            location_id, req_lat, req_lon, resolved_lat, resolved_lon,
            elevation_m, source_id, ft, raw_evidence_uri, provider_meta,
        )
        obs.update({
            "observation_id": observation_id,
            "observation_type": "hourly",
            "forecast_for": forecast_for,
            "temperature_c": temperature_c,
            "apparent_temperature_c": _idx("apparent_temperature", i),
            "wind_speed_kph": _idx("wind_speed_10m", i),
            "wind_direction_deg": _idx("wind_direction_10m", i),
            "wind_gust_kph": _idx("wind_gusts_10m", i),
            "humidity_percent": _idx("relative_humidity_2m", i),
            "pressure_hpa": _idx("pressure_msl", i),
            "precipitation_mm": _idx("precipitation", i),
            "precipitation_probability_percent": _idx("precipitation_probability", i),
            "cloud_cover_percent": _idx("cloud_cover", i),
            "weather_code": weather_code,
            "weather_label": get_weather_label(weather_code),
        })
        results.append(obs)
    return results


# ---------------------------------------------------------------------------
# Batch normalization
# ---------------------------------------------------------------------------

def normalize_open_meteo_item(
    item: dict[str, Any],
    requested_coordinate: dict[str, float],
    source_id: str = SOURCE_ID,
    raw_evidence_uri: str | None = None,
    fetched_at: str | None = None,
    grid_resolution: str = DEFAULT_GRID_RESOLUTION,
) -> dict[str, Any]:
    """Normalize one response item into current + hourly observations.

    Returns dict with keys:
        current   – single normalized observation dict or None
        hourly    – list of normalized observation dicts
    """
    current = normalize_current_observation(
        item, requested_coordinate, source_id, raw_evidence_uri, fetched_at, grid_resolution,
    )
    hourly = normalize_hourly_observations(
        item, requested_coordinate, source_id, raw_evidence_uri, fetched_at, grid_resolution,
    )
    return {"current": current, "hourly": hourly}


def normalize_open_meteo_batch(
    batch_data: list[dict[str, Any]],
    requested_coordinates: list[dict[str, float]],
    raw_evidence_uri: str | None = None,
    fetched_at: str | None = None,
    grid_resolution: str = DEFAULT_GRID_RESOLUTION,
) -> list[dict[str, Any]]:
    """Normalize a full batch (list of response items) into normalized observation groups."""
    results = []
    for i, item in enumerate(batch_data):
        if i >= len(requested_coordinates):
            break
        coord = requested_coordinates[i]
        results.append(
            normalize_open_meteo_item(
                item, coord, SOURCE_ID, raw_evidence_uri, fetched_at, grid_resolution,
            )
        )
    return results


def normalize_raw_batch_file(
    batch_path: str | Path,
    requested_coordinates: list[dict[str, float]],
    raw_evidence_uri: str | None = None,
    fetched_at: str | None = None,
    grid_resolution: str = DEFAULT_GRID_RESOLUTION,
) -> list[dict[str, Any]]:
    """Load a raw batch JSON file and normalize it."""
    path = Path(batch_path)
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict):
        data = [data]
    uri = raw_evidence_uri or str(path)
    return normalize_open_meteo_batch(data, requested_coordinates, uri, fetched_at, grid_resolution)
