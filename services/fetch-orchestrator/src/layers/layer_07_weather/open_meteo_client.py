"""Open-Meteo HTTP client for Layer 07 Weather.

No API key required. No .env dependency.
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any

BASE_URL = "https://api.open-meteo.com/v1/forecast"
USER_AGENT = "GOD-EYES-weather-fetcher/0.1"
DEFAULT_TIMEOUT = 30
DEFAULT_MAX_RETRIES = 3
BACKOFF_BASE = 30  # seconds

CURRENT_VARIABLES = [
    "temperature_2m", "apparent_temperature", "relative_humidity_2m",
    "precipitation", "weather_code", "cloud_cover", "pressure_msl",
    "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m",
]

HOURLY_VARIABLES = [
    "temperature_2m", "apparent_temperature", "relative_humidity_2m",
    "precipitation", "precipitation_probability", "weather_code",
    "cloud_cover", "pressure_msl", "surface_pressure",
    "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m",
]

DEFAULT_PARAMS = {
    "temperature_unit": "celsius",
    "wind_speed_unit": "kmh",
    "precipitation_unit": "mm",
    "timeformat": "iso8601",
    "timezone": "auto",
    "cell_selection": "land",
}


def _build_url(
    latitudes: list[float],
    longitudes: list[float],
    current_vars: list[str],
    hourly_vars: list[str],
    forecast_days: int,
) -> str:
    params: list[tuple[str, str]] = [
        ("latitude", ",".join(str(x) for x in latitudes)),
        ("longitude", ",".join(str(x) for x in longitudes)),
        ("current", ",".join(current_vars)),
        ("hourly", ",".join(hourly_vars)),
        ("forecast_days", str(forecast_days)),
    ]
    for k, v in DEFAULT_PARAMS.items():
        params.append((k, v))
    return BASE_URL + "?" + urllib.parse.urlencode(params)


def _sanitize_url(url: str) -> str:
    return url[:300] + "..." if len(url) > 300 else url


def fetch_weather_batch(
    latitudes: list[float],
    longitudes: list[float],
    *,
    current_vars: list[str] | None = None,
    hourly_vars: list[str] | None = None,
    forecast_days: int = 3,
    batch_index: int = 0,
    max_retries: int = DEFAULT_MAX_RETRIES,
    timeout: int = DEFAULT_TIMEOUT,
) -> dict[str, Any]:
    """Fetch weather data for a batch of coordinates.

    Returns dict with keys:
        data          – list of coordinate response objects
        request_meta  – sanitized request metadata
    """
    if len(latitudes) != len(longitudes):
        raise ValueError("latitudes and longitudes must have equal length")
    if not latitudes:
        raise ValueError("At least one coordinate required")

    cv = current_vars or CURRENT_VARIABLES
    hv = hourly_vars or HOURLY_VARIABLES
    url = _build_url(latitudes, longitudes, cv, hv, forecast_days)
    fetched_at = datetime.now(timezone.utc).isoformat()

    last_exc: Exception | None = None
    for attempt in range(max_retries):
        t0 = time.monotonic()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                elapsed_ms = int((time.monotonic() - t0) * 1000)
                status_code = resp.status
                headers = dict(resp.headers)
                body = resp.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            elapsed_ms = int((time.monotonic() - t0) * 1000)
            if 400 <= exc.code < 500:
                body = exc.read().decode("utf-8", errors="replace")
                raise RuntimeError(
                    f"HTTP {exc.code} (client error, no retry): {body[:200]}"
                ) from exc
            last_exc = RuntimeError(f"HTTP {exc.code} on attempt {attempt + 1}")
            time.sleep(BACKOFF_BASE * (2 ** attempt))
            continue
        except OSError as exc:
            last_exc = exc
            time.sleep(BACKOFF_BASE * (2 ** attempt))
            continue

        try:
            data = json.loads(body)
        except json.JSONDecodeError as exc:
            raise RuntimeError("Invalid JSON in Open-Meteo response") from exc

        if isinstance(data, dict):
            data = [data]

        return {
            "data": data,
            "request_meta": {
                "url": _sanitize_url(url),
                "status_code": status_code,
                "elapsed_ms": elapsed_ms,
                "response_headers": headers,
                "coordinate_count": len(latitudes),
                "batch_index": batch_index,
                "current_vars": cv,
                "hourly_vars": hv,
                "forecast_days": forecast_days,
                "fetched_at": fetched_at,
                "attempts": attempt + 1,
            },
        }

    raise RuntimeError(
        f"Open-Meteo fetch failed after {max_retries} attempts"
    ) from last_exc
