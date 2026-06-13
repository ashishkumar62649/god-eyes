"""Open-Meteo Fetch Proof - WO-WEATHER-S

Minimal proof that Open-Meteo returns real weather data for a small set of coordinates
and that the response structure supports the planned Weather MVP pipeline.

Usage:
    python -m layers.layer_07_weather.open_meteo_proof
    python services/fetch-orchestrator/src/layers/layer_07_weather/open_meteo_proof.py

No API key required. No secrets. No fake data.
"""

from __future__ import annotations

import json
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# --- Configuration ---

OPEN_METEO_BASE_URL = "https://api.open-meteo.com/v1/forecast"
USER_AGENT = "GOD-EYES-weather-proof/0.1"

# Proof coordinates: 7 cities across different regions
PROOF_COORDINATES = [
    {"name": "Bengaluru, India",    "latitude": 12.9716, "longitude": 77.5946},
    {"name": "Delhi, India",        "latitude": 28.6139, "longitude": 77.2090},
    {"name": "London, UK",          "latitude": 51.5074, "longitude": -0.1278},
    {"name": "New York, USA",       "latitude": 40.7128, "longitude": -74.0060},
    {"name": "Sydney, Australia",   "latitude": -33.8688, "longitude": 151.2093},
    {"name": "Tokyo, Japan",        "latitude": 35.6762, "longitude": 139.6503},
    {"name": "Cape Town, SA",       "latitude": -33.9249, "longitude": 18.4241},
]

CURRENT_VARIABLES = [
    "temperature_2m", "apparent_temperature", "relative_humidity_2m",
    "precipitation", "weather_code", "cloud_cover",
    "pressure_msl", "surface_pressure",
    "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m",
]

HOURLY_VARIABLES = [
    "temperature_2m", "apparent_temperature", "relative_humidity_2m",
    "precipitation", "precipitation_probability", "weather_code",
    "cloud_cover", "pressure_msl", "surface_pressure",
    "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m",
]

REQUEST_PARAMS = {
    "temperature_unit": "celsius",
    "wind_speed_unit": "kmh",
    "precipitation_unit": "mm",
    "timeformat": "iso8601",
    "timezone": "auto",
    "forecast_days": "1",
    "cell_selection": "land",
}


# --- Helper Functions ---

def build_proof_url(coordinates: list[dict[str, Any]]) -> str:
    """Build the Open-Meteo proof request URL."""
    lats = ",".join(str(c["latitude"]) for c in coordinates)
    lons = ",".join(str(c["longitude"]) for c in coordinates)
    current = ",".join(CURRENT_VARIABLES)
    hourly = ",".join(HOURLY_VARIABLES)

    params = {
        "latitude": lats,
        "longitude": lons,
        "current": current,
        "hourly": hourly,
        **REQUEST_PARAMS,
    }

    query = "&".join(f"{k}={v}" for k, v in params.items())
    return f"{OPEN_METEO_BASE_URL}?{query}"


def create_run_directory() -> Path:
    """Create raw output directory for this proof run."""
    now = datetime.now(timezone.utc)
    run_dir = (
        Path("raw/layer_07_weather/open-meteo")
        / now.strftime("%Y/%m/%d")
        / f"run_{now.strftime('%Y%m%dT%H%M%SZ')}"
    )
    run_dir.mkdir(parents=True, exist_ok=True)
    return run_dir


def fetch_url(url: str) -> tuple[dict[str, Any], dict[str, str], int]:
    """Fetch URL and return (response_json, headers, status_code)."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            status = resp.status
            headers = dict(resp.headers)
            body = resp.read().decode("utf-8")
            data = json.loads(body)
            return data, headers, status
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code}: {body}") from e


def extract_observed_fields(data: Any) -> dict[str, list[str]]:
    """Extract all field names from the response for observation."""
    observed: dict[str, list[str]] = {}

    if isinstance(data, list):
        items = data
    else:
        items = [data]

    for item in items:
        for key in item:
            if key not in observed:
                observed[key] = []
            val = item[key]
            if isinstance(val, dict):
                for sub_key in val:
                    if sub_key not in observed[key]:
                        observed[key].append(sub_key)
            elif isinstance(val, list) and len(val) > 0:
                observed[key].append(f"list[{len(val)}]")
            else:
                t = type(val).__name__
                if t not in observed[key]:
                    observed[key].append(t)

    return observed


def build_preview(data: Any, max_items: int = 2) -> Any:
    """Build a small sanitized preview from the response."""
    if isinstance(data, list):
        items = data[:max_items]
    else:
        items = [data]

    preview = []
    for item in items:
        p: dict[str, Any] = {}
        for key in ("latitude", "longitude", "elevation", "generationtime_ms",
                     "utc_offset_seconds", "timezone", "timezone_abbreviation"):
            if key in item:
                p[key] = item[key]

        if "current" in item:
            p["current"] = item["current"]
        if "current_units" in item:
            p["current_units"] = item["current_units"]

        if "hourly" in item:
            hourly = item["hourly"]
            p["hourly_time_count"] = len(hourly.get("time", []))
            for k in list(hourly.keys())[:3]:
                if k != "time":
                    p[f"hourly_{k}_sample"] = hourly[k][:3] if isinstance(hourly[k], list) else hourly[k]

        if "hourly_units" in item:
            p["hourly_units"] = item["hourly_units"]

        preview.append(p)

    return preview


def build_metadata(
    url: str,
    coordinates: list[dict[str, Any]],
    status: int,
    headers: dict[str, str],
    data: Any,
) -> dict[str, Any]:
    """Build metadata.json content."""
    now = datetime.now(timezone.utc)
    return {
        "source_id": "open-meteo",
        "layer_id": "layer_07_weather",
        "proof_run": True,
        "fetch_started_at": now.isoformat(),
        "endpoint": OPEN_METEO_BASE_URL,
        "request_url": url,
        "num_coordinates_requested": len(coordinates),
        "coordinates": coordinates,
        "request_params": REQUEST_PARAMS,
        "current_variables": CURRENT_VARIABLES,
        "hourly_variables": HOURLY_VARIABLES,
        "http_status": status,
        "response_headers": {k: v for k, v in headers.items()},
        "user_agent": USER_AGENT,
    }


# --- Main ---

def run_proof() -> dict[str, Any]:
    """Run the fetch proof and save results."""
    print("=" * 60)
    print("WO-WEATHER-S Open-Meteo Fetch Proof")
    print("=" * 60)

    coordinates = PROOF_COORDINATES
    url = build_proof_url(coordinates)
    print(f"\nCoordinates: {len(coordinates)}")
    for c in coordinates:
        print(f"  - {c['name']}: ({c['latitude']}, {c['longitude']})")

    print(f"\nEndpoint: {OPEN_METEO_BASE_URL}")
    print(f"Forecast days: {REQUEST_PARAMS['forecast_days']}")
    print(f"Cell selection: {REQUEST_PARAMS['cell_selection']}")

    print("\nFetching...")
    data, headers, status = fetch_url(url)
    print(f"HTTP Status: {status}")

    # Determine response shape
    is_list = isinstance(data, list)
    count = len(data) if is_list else 1
    print(f"Response shape: {'array' if is_list else 'object'} ({count} items)")

    # Save raw output
    run_dir = create_run_directory()
    print(f"\nRaw output: {run_dir}")

    # metadata.json
    metadata = build_metadata(url, coordinates, status, headers, data)
    (run_dir / "metadata.json").write_text(json.dumps(metadata, indent=2))

    # proof_response.json
    (run_dir / "proof_response.json").write_text(json.dumps(data, indent=2))

    # preview.json
    preview = build_preview(data)
    (run_dir / "preview.json").write_text(json.dumps(preview, indent=2))

    # observed_fields.json
    observed = extract_observed_fields(data)
    (run_dir / "observed_fields.json").write_text(json.dumps(observed, indent=2))

    # Check rate-limit headers
    rate_limit_headers = {k: v for k, v in headers.items()
                          if "rate" in k.lower() or "limit" in k.lower()
                          or "retry" in k.lower() or "remaining" in k.lower()}
    if rate_limit_headers:
        print(f"\nRate-limit headers found: {rate_limit_headers}")
    else:
        print("\nNo rate-limit headers observed in response.")

    # Validate fields
    items = data if is_list else [data]
    current_fields_ok = True
    hourly_fields_ok = True
    missing_current = []
    missing_hourly = []

    for item in items:
        if "current" not in item:
            current_fields_ok = False
            missing_current.append("current block missing")
        else:
            for var in CURRENT_VARIABLES:
                if var not in item["current"]:
                    current_fields_ok = False
                    missing_current.append(var)

        if "hourly" not in item:
            hourly_fields_ok = False
            missing_hourly.append("hourly block missing")
        else:
            for var in HOURLY_VARIABLES:
                if var not in item["hourly"]:
                    hourly_fields_ok = False
                    missing_hourly.append(var)

    print(f"\n--- Validation ---")
    print(f"Current fields present: {'YES' if current_fields_ok else 'NO'}")
    if missing_current:
        print(f"  Missing: {missing_current[:5]}")
    print(f"Hourly fields present: {'YES' if hourly_fields_ok else 'NO'}")
    if missing_hourly:
        print(f"  Missing: {missing_hourly[:5]}")

    # Check metadata fields
    meta_fields = ["generationtime_ms", "utc_offset_seconds", "timezone", "timezone_abbreviation"]
    for item in items:
        for mf in meta_fields:
            val = item.get(mf, "MISSING")
            if val == "MISSING":
                print(f"  Metadata {mf}: MISSING")

    # Check coordinate resolution
    coord_diffs = []
    for i, item in enumerate(items):
        req_lat = coordinates[i]["latitude"]
        req_lon = coordinates[i]["longitude"]
        resp_lat = item.get("latitude")
        resp_lon = item.get("longitude")
        if resp_lat is not None and resp_lon is not None:
            if abs(resp_lat - req_lat) > 0.01 or abs(resp_lon - req_lon) > 0.01:
                coord_diffs.append({
                    "name": coordinates[i]["name"],
                    "requested": (req_lat, req_lon),
                    "returned": (resp_lat, resp_lon),
                })

    if coord_diffs:
        print(f"\nCoordinate resolution differences: {len(coord_diffs)}")
        for d in coord_diffs[:3]:
            print(f"  {d['name']}: requested {d['requested']} -> returned {d['returned']}")
    else:
        print(f"\nAll returned coordinates match requested (within 0.01 tolerance).")

    # Summary
    result = {
        "status": "SUCCESS",
        "http_status": status,
        "response_shape": "array" if is_list else "object",
        "num_items": count,
        "current_fields_present": current_fields_ok,
        "hourly_fields_present": hourly_fields_ok,
        "missing_current_fields": missing_current,
        "missing_hourly_fields": missing_hourly,
        "rate_limit_headers": rate_limit_headers,
        "coord_resolution_differences": coord_diffs,
        "raw_dir": str(run_dir),
    }

    print(f"\n{'=' * 60}")
    print(f"Proof complete: {result['status']}")
    print(f"Raw files saved to: {run_dir}")
    print(f"{'=' * 60}")

    return result


if __name__ == "__main__":
    try:
        run_proof()
    except Exception as e:
        print(f"\nPROOF FAILED: {e}", file=sys.stderr)
        sys.exit(1)
