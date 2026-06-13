"""GDACS HTTP client for Layer 08 News & OSINT.

No API key required.

Provides two fetch backends:
  - Python urllib (default, may fail on Windows due to TLS/IPv6 issues)
  - curl fallback (uses -4 --http1.1 --tlsv1.2 for Windows compatibility)
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

from layers.layer_08_news_osint.news_source_types import GdacsRawResult

BASE_URL = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP"
SOURCE_ID = "gdacs"
USER_AGENT = "GOD-EYES-news-fetcher/0.1"
DEFAULT_TIMEOUT = 30
DEFAULT_MAX_RETRIES = 3
BACKOFF_BASE = 5  # seconds


def _build_url(eventtype: str = "ALL", alertlevel: str = "ALL") -> str:
    params = urllib.parse.urlencode({"eventtype": eventtype, "alertlevel": alertlevel})
    return f"{BASE_URL}?{params}"


def _parse_and_validate(body: str) -> dict[str, Any]:
    try:
        data = json.loads(body)
    except json.JSONDecodeError as exc:
        raise RuntimeError("Invalid JSON in GDACS response") from exc
    if not isinstance(data, dict):
        raise RuntimeError(f"Expected JSON object, got {type(data).__name__}")
    if "features" not in data:
        raise RuntimeError("GDACS response missing 'features' field")
    return data


def _find_curl() -> str | None:
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
    return "curl"


def fetch_gdacs_via_curl(
    *,
    eventtype: str = "ALL",
    alertlevel: str = "ALL",
    timeout: int = DEFAULT_TIMEOUT,
) -> GdacsRawResult:
    """Fetch GDACS events via curl with IPv4/TLS1.2/HTTP1.1."""
    curl_path = _find_curl()
    if curl_path is None:
        raise RuntimeError("curl not found. Use --fetch-client urllib.")

    url = _build_url(eventtype, alertlevel)
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

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 10)
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"curl timed out after {timeout + 10}s") from exc
    except FileNotFoundError as exc:
        raise RuntimeError(f"curl not found at {curl_path}") from exc

    if result.returncode != 0:
        msg = result.stderr.strip()[:200] if result.stderr else "no stderr"
        raise RuntimeError(f"curl failed (exit {result.returncode}): {msg}")

    lines = result.stdout.rsplit("\n", 1)
    if len(lines) < 2:
        raise RuntimeError("curl produced unexpected output (no HTTP status line)")

    body_text, status_str = lines[0], lines[1].strip()
    try:
        status_code = int(status_str)
    except ValueError:
        raise RuntimeError(f"curl returned non-numeric HTTP status: {status_str!r}")

    if not (200 <= status_code < 300):
        raise RuntimeError(f"HTTP {status_code} from GDACS via curl: {body_text[:200]}")

    data = _parse_and_validate(body_text)
    return GdacsRawResult(
        source_id=SOURCE_ID,
        endpoint_url=url,
        fetched_at=fetched_at,
        item_count=len(data.get("features", [])),
        raw_payload=data,
    )


def fetch_gdacs_via_urllib(
    *,
    eventtype: str = "ALL",
    alertlevel: str = "ALL",
    timeout: int = DEFAULT_TIMEOUT,
    max_retries: int = DEFAULT_MAX_RETRIES,
) -> GdacsRawResult:
    """Fetch GDACS events via urllib with retry/backoff."""
    url = _build_url(eventtype, alertlevel)
    fetched_at = datetime.now(timezone.utc).isoformat()

    last_exc: Exception | None = None
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                status_code = resp.status
                body = resp.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
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

        data = _parse_and_validate(body)
        return GdacsRawResult(
            source_id=SOURCE_ID,
            endpoint_url=url,
            fetched_at=fetched_at,
            item_count=len(data.get("features", [])),
            raw_payload=data,
        )

    raise RuntimeError(
        f"GDACS fetch failed after {max_retries} attempts"
    ) from last_exc


def fetch_gdacs(
    *,
    eventtype: str = "ALL",
    alertlevel: str = "ALL",
    timeout: int = DEFAULT_TIMEOUT,
    fetch_client: str = "auto",
) -> GdacsRawResult:
    """Fetch GDACS events, selecting urllib or curl backend.

    fetch_client: 'urllib' | 'curl' | 'auto'
        auto tries urllib first, falls back to curl on failure.
    """
    if fetch_client == "curl":
        return fetch_gdacs_via_curl(eventtype=eventtype, alertlevel=alertlevel, timeout=timeout)
    if fetch_client == "urllib":
        return fetch_gdacs_via_urllib(eventtype=eventtype, alertlevel=alertlevel, timeout=timeout)

    # auto: try urllib, fall back to curl
    try:
        return fetch_gdacs_via_urllib(eventtype=eventtype, alertlevel=alertlevel, timeout=timeout)
    except Exception as urllib_exc:  # noqa: BLE001
        curl_path = _find_curl()
        if curl_path is None:
            raise
        try:
            return fetch_gdacs_via_curl(
                eventtype=eventtype, alertlevel=alertlevel, timeout=timeout
            )
        except Exception as curl_exc:  # noqa: BLE001
            raise RuntimeError(
                f"Both urllib and curl failed.\n  urllib: {urllib_exc}\n  curl: {curl_exc}"
            ) from curl_exc
