"""Space-Track Client — Authenticated full catalog fetch for Layer 05.

Space-Track.org provides authenticated access to the public satellite
catalog. This client supports downloading the full GP catalog suitable
for the layer 05 gap-fill pipeline.

Security:
- Credentials are read from environment variables only.
- Credentials are NEVER printed, logged, written to disk, or returned.
- The only env-var identifiers exposed to callers are the names
  ``SPACE_TRACK_USERNAME`` and ``SPACE_TRACK_PASSWORD``; values are
  never returned, only their presence is reported.

Environment variables (both required for download):
- SPACE_TRACK_USERNAME: Space-Track account username
- SPACE_TRACK_PASSWORD: Space-Track account password

Public API:
- has_space_track_credentials() -> bool
- get_missing_env_vars() -> list[str]
- SpaceTrackClient.fetch_full_catalog(groups=...) -> list[dict]
- SpaceTrackClient.fetch_gp_records(groups=...) -> list[dict]
"""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any

# Environment variable names (code paths only, never actual values)
ENV_USERNAME = "SPACE_TRACK_USERNAME"
ENV_PASSWORD = "SPACE_TRACK_PASSWORD"

SPACE_TRACK_BASE_URL = "https://www.space-track.org"
SPACE_TRACK_LOGIN_URL = f"{SPACE_TRACK_BASE_URL}/ajaxauth/login"
SPACE_TRACK_QUERY_BASE = f"{SPACE_TRACK_BASE_URL}/basicspacedata/query"

DEFAULT_USER_AGENT = "GodEyes/1.0 (space-satellite-fetcher; +https://github.com/god-eyes)"


# Supported group identifiers that map to Space-Track class predicates.
# 'all' resolves to the full GP catalog (no predicate filter).
# Other groups are filters on the ``gp`` class using the field/value
# syntax understood by https://www.space-track.org/basicspacedata/query/class/gp/.
# The mapping values are appended after ``/class/gp/`` in the URL.
# An empty string means "no filter" -> the full public catalog.
SPACE_TRACK_GROUPS: dict[str, str] = {
    "all": "",
    "payload": "OBJECT_TYPE/PAYLOAD",
    "debris": "OBJECT_TYPE/DEBRIS",
    "rocket-body": "OBJECT_TYPE/ROCKET BODY",
    "rocket_body": "OBJECT_TYPE/ROCKET BODY",
    "inactive": "DECAY_DATE/>0",
    "active": "DECAY_DATE/null",
}


def supported_space_track_groups() -> list[str]:
    """Return the supported Space-Track group keys, sorted for stable output."""
    return sorted(SPACE_TRACK_GROUPS.keys())


def has_space_track_credentials() -> bool:
    """Return True only if both env vars are set to non-empty strings."""
    import os
    u = os.getenv(ENV_USERNAME)
    p = os.getenv(ENV_PASSWORD)
    return bool(u and p)


def get_missing_env_vars() -> list[str]:
    """Return the list of missing env-var names (values never returned)."""
    import os
    missing: list[str] = []
    if not os.getenv(ENV_USERNAME):
        missing.append(ENV_USERNAME)
    if not os.getenv(ENV_PASSWORD):
        missing.append(ENV_PASSWORD)
    return missing


def _redact(value: str) -> str:
    """Redact a string for safe printing (only length is shown)."""
    return f"<redacted len={len(value)}>"


def get_credentials_safe() -> tuple[bool, list[str]]:
    """Return (has_credentials, missing_var_names). Never returns values."""
    missing = get_missing_env_vars()
    return (len(missing) == 0, missing)


class SpaceTrackAuthError(Exception):
    """Raised when authentication with Space-Track fails or is missing."""


class SpaceTrackHTTPError(Exception):
    """Raised when Space-Track returns an HTTP error."""

    def __init__(self, status: int, reason: str) -> None:
        self.status = status
        self.reason = reason
        super().__init__(f"Space-Track HTTP {status}: {reason}")


class SpaceTrackClient:
    """Authenticated Space-Track client.

    Credentials are read from the environment at instantiation time and
    stored only as references. Values are never logged or returned.
    """

    def __init__(self) -> None:
        import os
        self._username: str | None = os.getenv(ENV_USERNAME)
        self._password: str | None = os.getenv(ENV_PASSWORD)
        self._session_cookies: dict[str, str] = {}
        self._authenticated = False
        self._last_fetch_at: str | None = None

    @property
    def is_available(self) -> bool:
        return bool(self._username and self._password)

    @property
    def is_authenticated(self) -> bool:
        return self._authenticated

    @property
    def last_fetch_at(self) -> str | None:
        return self._last_fetch_at

    def authenticate(self) -> bool:
        """Authenticate against Space-Track using env credentials.

        Returns True on success, False on auth failure or missing creds.
        Network calls are delegated to ``_login()`` which is patchable
        in tests.
        """
        if not self.is_available:
            return False
        try:
            self._session_cookies = self._login(self._username or "", self._password or "")
        except Exception as exc:
            print(f"[SPACE-TRACK] Authentication failed: {exc}")
            self._authenticated = False
            return False
        self._authenticated = bool(self._session_cookies)
        return self._authenticated

    def _login(self, username: str, password: str) -> dict[str, str]:
        """Perform the Space-Track login.  Returns cookies on success.

        This is split out so tests can patch it without touching the
        network. ``username``/``password`` are passed in only to make
        mocking trivial; the live implementation reads them from
        ``os.environ`` directly inside the URL-encoded body.
        """
        import os
        u = username or os.getenv(ENV_USERNAME) or ""
        p = password or os.getenv(ENV_PASSWORD) or ""
        body = urllib.parse.urlencode({
            "identity": u,
            "password": p,
        }).encode("utf-8")
        req = urllib.request.Request(
            SPACE_TRACK_LOGIN_URL,
            data=body,
            headers={"User-Agent": DEFAULT_USER_AGENT},
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                set_cookie = resp.headers.get_all("Set-Cookie") or []
        except urllib.error.HTTPError as exc:
            raise SpaceTrackAuthError(f"HTTP {exc.code}: {exc.reason}") from exc
        except urllib.error.URLError as exc:
            raise SpaceTrackAuthError(f"URL error: {exc.reason}") from exc
        cookies: dict[str, str] = {}
        for c in set_cookie:
            kv = c.split(";", 1)[0]
            if "=" in kv:
                k, v = kv.split("=", 1)
                cookies[k.strip()] = v.strip()
        return cookies

    def _http_get_json(self, url: str) -> list[dict[str, Any]]:
        """GET a Space-Track JSON endpoint using session cookies."""
        cookie_header = "; ".join(f"{k}={v}" for k, v in self._session_cookies.items())
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": DEFAULT_USER_AGENT,
                "Cookie": cookie_header,
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as exc:
            raise SpaceTrackHTTPError(exc.code, exc.reason) from exc
        except urllib.error.URLError as exc:
            raise SpaceTrackHTTPError(0, str(exc.reason)) from exc
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise SpaceTrackAuthError(f"Invalid JSON: {exc}") from exc
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            return [data]
        return []

    def _build_query_url(self, group: str) -> str:
        """Build a Space-Track query URL for a group identifier.

        Group is one of ``SPACE_TRACK_GROUPS`` keys (case-insensitive).
        The query uses the ``gp`` class which is the full public
        catalog including TLE lines, epoch, and object metadata.
        For ``all`` no filter is appended so the full catalog is
        returned; for other groups, the matching field/value filter
        is appended after ``/class/gp/``.

        Example URLs:
            all       -> /basicspacedata/query/class/gp/format/json
            payload   -> /basicspacedata/query/class/gp/OBJECT_TYPE/PAYLOAD/format/json
            debris    -> /basicspacedata/query/class/gp/OBJECT_TYPE/DEBRIS/format/json
            active    -> /basicspacedata/query/class/gp/DECAY_DATE/null/format/json
        """
        key = (group or "").strip().lower()
        if key not in SPACE_TRACK_GROUPS:
            supported = ", ".join(supported_space_track_groups())
            raise ValueError(
                f"Unknown Space-Track group: {group!r}. "
                f"Supported groups: {supported}"
            )
        predicate = SPACE_TRACK_GROUPS[key]
        if predicate:
            return f"{SPACE_TRACK_QUERY_BASE}/class/gp/{predicate}/format/json"
        return f"{SPACE_TRACK_QUERY_BASE}/class/gp/format/json"

    def fetch_full_catalog(
        self,
        groups: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """Fetch the full public catalog from Space-Track.

        Args:
            groups: One or more group identifiers.  Defaults to
                ``['all']`` which fetches the union of payloads, debris
                and rocket bodies.

        Returns:
            A list of raw Space-Track GP dicts.
        """
        if not self.is_available:
            missing = get_missing_env_vars()
            raise SpaceTrackAuthError(
                f"Space-Track credentials missing: env vars {missing} must be set"
            )
        if not self._authenticated:
            ok = self.authenticate()
            if not ok:
                raise SpaceTrackAuthError("Space-Track authentication failed")

        if not groups:
            groups = ["all"]

        all_records: list[dict[str, Any]] = []
        for grp in groups:
            url = self._build_query_url(grp)
            try:
                records = self._http_get_json(url)
            except SpaceTrackHTTPError as exc:
                if exc.status in (401, 403):
                    raise SpaceTrackAuthError(
                        f"Space-Track auth/HTTP {exc.status}: {exc.reason}"
                    ) from exc
                raise
            all_records.extend(records)

        self._last_fetch_at = datetime.now(timezone.utc).isoformat()
        return all_records

    def fetch_gp_records(
        self,
        groups: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """Alias for ``fetch_full_catalog``."""
        return self.fetch_full_catalog(groups)


def create_space_track_client() -> SpaceTrackClient:
    """Factory: build a client and authenticate if creds are present."""
    client = SpaceTrackClient()
    if client.is_available:
        client.authenticate()
    return client


# Standalone test
if __name__ == "__main__":
    print("[TEST] Space-Track availability")
    ok, missing = get_credentials_safe()
    if ok:
        print("  Credentials: present (values redacted)")
    else:
        print(f"  Credentials: MISSING env vars {missing}")
    print(f"  has_space_track_credentials() = {has_space_track_credentials()}")
