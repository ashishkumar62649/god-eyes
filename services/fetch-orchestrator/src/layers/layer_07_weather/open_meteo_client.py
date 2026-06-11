"""Open-Meteo HTTP client for Layer 07 Weather.

No API key required. No .env dependency.

Provides two fetch backends:
  - Python urllib (default, may fail on Windows due to TLS/IPv6 issues)
  - curl.exe fallback (uses -4 --http1.1 --tlsv1.2 for Windows compatibility)
"""

from __future__ import annotations

import json
import subprocess
import sys
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
    "surface_pressure",
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

PROOF_CURRENT_PARAMS = {
    "temperature_unit": "celsius",
    "wind_speed_unit": "kmh",
    "precipitation_unit": "mm",
    "timeformat": "iso8601",
    "timezone": "UTC",
}

PROOF_CURRENT_VARIABLES = [
    "temperature_2m", "apparent_temperature", "relative_humidity_2m",
    "surface_pressure", "precipitation", "cloud_cover",
    "weather_code", "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m",
]


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


def _build_url_current_only(
    latitudes: list[float],
    longitudes: list[float],
    current_vars: list[str] | None = None,
) -> str:
    """Build URL requesting only current variables — no hourly, no forecast_days."""
    cv = current_vars or PROOF_CURRENT_VARIABLES
    params: list[tuple[str, str]] = [
        ("latitude", ",".join(str(x) for x in latitudes)),
        ("longitude", ",".join(str(x) for x in longitudes)),
        ("current", ",".join(cv)),
    ]
    for k, v in PROOF_CURRENT_PARAMS.items():
        params.append((k, v))
    return BASE_URL + "?" + urllib.parse.urlencode(params)


def _sanitize_url(url: str) -> str:
    return url[:300] + "..." if len(url) > 300 else url


def _find_curl_executable() -> str | None:
    """Locate curl.exe on the system (Windows ships curl.exe, not curl)."""
    if sys.platform == "win32":
        try:
            result = subprocess.run(
                ["where", "curl.exe"],
                capture_output=True, text=True, timeout=5,
            )
            if result.returncode == 0 and result.stdout.strip():
                return result.stdout.strip().splitlines()[0]
        except (subprocess.SubprocessError, FileNotFoundError):
            pass
    return None


def fetch_weather_batch_via_curl(
    latitudes: list[float],
    longitudes: list[float],
    *,
    current_vars: list[str] | None = None,
    hourly_vars: list[str] | None = None,
    forecast_days: int = 3,
    batch_index: int = 0,
    timeout: int = DEFAULT_TIMEOUT,
) -> dict[str, Any]:
    """Fetch weather data via curl.exe with IPv4/TLS1.2/HTTP1.1.

    Uses curl as a fallback for environments where Python urllib has
    TLS/IPv6 issues (e.g. Windows with certain network configurations).

    Returns dict with keys:
        data          – list of coordinate response objects
        request_meta  – sanitized request metadata
    """
    if len(latitudes) != len(longitudes):
        raise ValueError("latitudes and longitudes must have equal length")
    if not latitudes:
        raise ValueError("At least one coordinate required")

    curl_path = _find_curl_executable()
    if curl_path is None:
        raise RuntimeError(
            "curl.exe not found. Install curl or use --fetch-client urllib."
        )

    cv = current_vars or CURRENT_VARIABLES
    hv = hourly_vars or HOURLY_VARIABLES
    url = _build_url(latitudes, longitudes, cv, hv, forecast_days)
    fetched_at = datetime.now(timezone.utc).isoformat()

    cmd = [
        curl_path,
        "-4",                  # Force IPv4
        "--http1.1",           # Force HTTP/1.1
        "--tlsv1.2",           # Force TLS 1.2
        "-L",                  # Follow redirects
        "--connect-timeout", "10",
        "--max-time", str(timeout),
        "-s",                  # Silent mode
        "-w", "\n%{http_code}",  # Append HTTP status code to output
        "-H", f"User-Agent: {USER_AGENT}",
        url,
    ]

    t0 = time.monotonic()
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout + 10,
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(
            f"curl timed out after {timeout + 10}s"
        ) from exc
    except FileNotFoundError as exc:
        raise RuntimeError(
            f"curl executable not found at {curl_path}"
        ) from exc

    elapsed_ms = int((time.monotonic() - t0) * 1000)

    if result.returncode != 0:
        stderr_msg = result.stderr.strip()[:200] if result.stderr else "no stderr"
        raise RuntimeError(
            f"curl failed with exit code {result.returncode}: {stderr_msg}"
        )

    output = result.stdout
    lines = output.rsplit("\n", 1)
    if len(lines) < 2:
        raise RuntimeError("curl produced unexpected output (no HTTP status line)")

    body_text = lines[0]
    try:
        status_code = int(lines[1].strip())
    except ValueError:
        raise RuntimeError(
            f"curl returned non-numeric HTTP status: {lines[1].strip()!r}"
        )

    if status_code < 200 or status_code >= 300:
        raise RuntimeError(
            f"HTTP {status_code} from Open-Meteo via curl: {body_text[:200]}"
        )

    try:
        data = json.loads(body_text)
    except json.JSONDecodeError as exc:
        raise RuntimeError("Invalid JSON in Open-Meteo curl response") from exc

    if isinstance(data, dict):
        data = [data]

    return {
        "data": data,
        "request_meta": {
            "url": _sanitize_url(url),
            "status_code": status_code,
            "elapsed_ms": elapsed_ms,
            "response_headers": {},
            "coordinate_count": len(latitudes),
            "batch_index": batch_index,
            "current_vars": cv,
            "hourly_vars": hv,
            "forecast_days": forecast_days,
            "fetched_at": fetched_at,
            "attempts": 1,
            "fetch_client": "curl",
        },
    }


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


def fetch_weather_current_only(
    latitudes: list[float],
    longitudes: list[float],
    *,
    current_vars: list[str] | None = None,
    batch_index: int = 0,
    max_retries: int = DEFAULT_MAX_RETRIES,
    timeout: int = DEFAULT_TIMEOUT,
) -> dict[str, Any]:
    """Fetch current-only weather for a batch of coordinates via urllib.

    No hourly variables. No forecast_days. Minimal payload for proof ingest.

    Returns dict with keys:
        data          – list of coordinate response objects
        request_meta  – sanitized request metadata
    """
    if len(latitudes) != len(longitudes):
        raise ValueError("latitudes and longitudes must have equal length")
    if not latitudes:
        raise ValueError("At least one coordinate required")

    cv = current_vars or PROOF_CURRENT_VARIABLES
    url = _build_url_current_only(latitudes, longitudes, cv)
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
                "hourly_vars": [],
                "forecast_days": None,
                "fetched_at": fetched_at,
                "attempts": attempt + 1,
                "current_only": True,
            },
        }

    raise RuntimeError(
        f"Open-Meteo fetch failed after {max_retries} attempts"
    ) from last_exc


def fetch_weather_current_only_via_curl(
    latitudes: list[float],
    longitudes: list[float],
    *,
    current_vars: list[str] | None = None,
    batch_index: int = 0,
    timeout: int = DEFAULT_TIMEOUT,
) -> dict[str, Any]:
    """Fetch current-only weather via curl.exe with IPv4/TLS1.2/HTTP1.1.

    No hourly variables. No forecast_days. Minimal payload for proof ingest.

    Returns dict with keys:
        data          – list of coordinate response objects
        request_meta  – sanitized request metadata
    """
    if len(latitudes) != len(longitudes):
        raise ValueError("latitudes and longitudes must have equal length")
    if not latitudes:
        raise ValueError("At least one coordinate required")

    curl_path = _find_curl_executable()
    if curl_path is None:
        raise RuntimeError(
            "curl.exe not found. Install curl or use --fetch-client urllib."
        )

    cv = current_vars or PROOF_CURRENT_VARIABLES
    url = _build_url_current_only(latitudes, longitudes, cv)
    fetched_at = datetime.now(timezone.utc).isoformat()

    cmd = [
        curl_path,
        "-4", "--http1.1", "--tlsv1.2", "-L",
        "--connect-timeout", "10",
        "--max-time", str(timeout),
        "-s",
        "-w", "\n%{http_code}",
        "-H", f"User-Agent: {USER_AGENT}",
        url,
    ]

    t0 = time.monotonic()
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 10)
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"curl timed out after {timeout + 10}s") from exc
    except FileNotFoundError as exc:
        raise RuntimeError(f"curl executable not found at {curl_path}") from exc

    elapsed_ms = int((time.monotonic() - t0) * 1000)

    if result.returncode != 0:
        stderr_msg = result.stderr.strip()[:200] if result.stderr else "no stderr"
        raise RuntimeError(f"curl failed with exit code {result.returncode}: {stderr_msg}")

    lines = result.stdout.rsplit("\n", 1)
    if len(lines) < 2:
        raise RuntimeError("curl produced unexpected output (no HTTP status line)")

    body_text = lines[0]
    try:
        status_code = int(lines[1].strip())
    except ValueError:
        raise RuntimeError(f"curl returned non-numeric HTTP status: {lines[1].strip()!r}")

    if status_code < 200 or status_code >= 300:
        raise RuntimeError(f"HTTP {status_code} from Open-Meteo via curl: {body_text[:200]}")

    try:
        data = json.loads(body_text)
    except json.JSONDecodeError as exc:
        raise RuntimeError("Invalid JSON in Open-Meteo curl response") from exc

    if isinstance(data, dict):
        data = [data]

    return {
        "data": data,
        "request_meta": {
            "url": _sanitize_url(url),
            "status_code": status_code,
            "elapsed_ms": elapsed_ms,
            "response_headers": {},
            "coordinate_count": len(latitudes),
            "batch_index": batch_index,
            "current_vars": cv,
            "hourly_vars": [],
            "forecast_days": None,
            "fetched_at": fetched_at,
            "attempts": 1,
            "fetch_client": "curl",
            "current_only": True,
        },
    }
