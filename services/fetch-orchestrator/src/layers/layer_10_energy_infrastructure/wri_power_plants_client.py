"""WRI Global Power Plant Database client (Layer 10 P1 source).

The WRI dataset is distributed as a single CSV file with one row per
power plant. Columns include ``country``, ``country_long``,
``name``, ``gppd_idnr``, ``capacity_mw``, ``latitude``, ``longitude``,
``primary_fuel``, ``commissioning_year``, ``owner``, ``source``,
``url``, ``geolocation_source``, ``wepp_id`` and ``year_of_capacity_data``.

This client is responsible for:

* Downloading the CSV (or accepting an injected ``csv_text`` for tests).
* Parsing the CSV into a list of plain dicts.
* Classifying each row into a canonical (category, fuel_type, feature_type).
* Building a normalized ``power_plant`` feature dict (caller performs
  geometry / centroid / bbox via the normalizer).

Live download is best-effort: if the URL is not reachable, the caller
records a failure in the manifest and continues. The normalizer
already supports a "no raw text" code path, and the cache only writes
an envelope on success.
"""

from __future__ import annotations

import io
import json
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from energy_sources import (
    SOURCE_WRI,
    WRI_CONFIG,
    wri_fuel_to_canonical,
)

LAYER_ID = "layer_10_energy_infrastructure"
SOURCE_ID = SOURCE_WRI

DEFAULT_DOWNLOAD_URL = WRI_CONFIG.default_download_url

# Public fallback: WRI's own GitHub mirror of the same CSV.
_FALLBACK_DOWNLOAD_URL = (
    "https://raw.githubusercontent.com/wri/global-power-plant-database"
    "/master/output_database/global_power_plant_database.csv"
)

# WRI's known column set. We keep these as constants so the parser
# stays robust against header re-ordering.
COL_GPPD_IDNR = "gppd_idnr"
COL_COUNTRY = "country"
COL_COUNTRY_LONG = "country_long"
COL_NAME = "name"
COL_CAPACITY_MW = "capacity_mw"
COL_LATITUDE = "latitude"
COL_LONGITUDE = "longitude"
COL_PRIMARY_FUEL = "primary_fuel"
COL_OTHER_FUEL1 = "other_fuel1"
COL_OTHER_FUEL2 = "other_fuel2"
COL_OTHER_FUEL3 = "other_fuel3"
COL_COMMISSIONING_YEAR = "commissioning_year"
COL_OWNER = "owner"
COL_SOURCE = "source"
COL_URL_FIELD = "url"
COL_GEOLOCATION_SOURCE = "geolocation_source"
COL_WEPP_ID = "wepp_id"
COL_YEAR_OF_CAPACITY_DATA = "year_of_capacity_data"
COL_ESTIMATED_GENERATION_GWH = "estimated_generation_gwh"


class WRIHttpError(RuntimeError):
    """Raised when the WRI CSV cannot be downloaded."""


@dataclass
class WRIRow:
    """A normalized WRI row after column coercion."""

    gppd_idnr: str
    name: str | None
    country: str | None
    capacity_mw: float | None
    latitude: float
    longitude: float
    primary_fuel: str | None
    commissioning_year: int | None
    owner: str | None
    source: str | None
    url: str | None
    geolocation_source: str | None


def _coerce_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    return f


def _coerce_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _coerce_str(value: Any) -> str | None:
    if value is None:
        return None
    s = str(value).strip()
    return s or None


def parse_wri_csv(csv_text: str) -> list[dict[str, str]]:
    """Parse WRI CSV text into a list of raw row dicts.

    The header is preserved verbatim. Empty lines are skipped. Values
    are returned as strings; downstream callers coerce numeric fields.
    """
    import csv

    if not csv_text:
        return []
    reader = csv.DictReader(io.StringIO(csv_text))
    rows: list[dict[str, str]] = []
    for row in reader:
        if not row:
            continue
        cleaned: dict[str, str] = {}
        for k, v in row.items():
            if k is None:
                continue
            cleaned[k] = "" if v is None else str(v)
        rows.append(cleaned)
    return rows


def coerce_row(raw: dict[str, str]) -> WRIRow | None:
    """Coerce a raw WRI dict into a ``WRIRow`` or skip if invalid.

    Skips rows that:
    * have no ``gppd_idnr``
    * have no parseable latitude/longitude
    * have an out-of-range latitude/longitude
    """
    gppd = _coerce_str(raw.get(COL_GPPD_IDNR))
    if not gppd:
        return None
    lat = _coerce_float(raw.get(COL_LATITUDE))
    lon = _coerce_float(raw.get(COL_LONGITUDE))
    if lat is None or lon is None:
        return None
    if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
        return None
    return WRIRow(
        gppd_idnr=gppd,
        name=_coerce_str(raw.get(COL_NAME)),
        country=_coerce_str(raw.get(COL_COUNTRY)),
        capacity_mw=_coerce_float(raw.get(COL_CAPACITY_MW)),
        latitude=lat,
        longitude=lon,
        primary_fuel=_coerce_str(raw.get(COL_PRIMARY_FUEL)),
        commissioning_year=_coerce_int(raw.get(COL_COMMISSIONING_YEAR)),
        owner=_coerce_str(raw.get(COL_OWNER)),
        source=_coerce_str(raw.get(COL_SOURCE)),
        url=_coerce_str(raw.get(COL_URL_FIELD)),
        geolocation_source=_coerce_str(raw.get(COL_GEOLOCATION_SOURCE)),
    )


def classify_wri_row(row: WRIRow) -> dict[str, str | None]:
    """Map a WRI row to canonical ``category``, ``fuel_type``, ``feature_type``."""
    category, fuel_type = wri_fuel_to_canonical(row.primary_fuel)
    return {
        "category": category,
        "fuel_type": fuel_type,
        "feature_type": "power_plant",
    }


def wri_row_to_feature_dict(row: WRIRow) -> dict[str, Any]:
    """Convert a coerced ``WRIRow`` into a dict ready for the normalizer.

    The normalizer will derive geometry_geojson, centroid, and bbox.
    """
    cls = classify_wri_row(row)
    # Lightweight status heuristic: commissioning_year missing => "unknown",
    # commissioning_year > current year + 1 => "planned" (with caveats).
    status: str | None = None
    year_now = datetime.now(timezone.utc).year
    if row.commissioning_year is None:
        status = "unknown"
    elif row.commissioning_year > year_now + 1:
        status = "planned"
    else:
        status = "operational"

    return {
        "source_id": SOURCE_ID,
        "source_object_id": row.gppd_idnr,
        "feature_type": cls["feature_type"],
        "category": cls["category"],
        "name": row.name,
        "operator": row.owner,
        "owner": row.owner,
        "country": row.country,
        "status": status,
        "fuel_type": cls["fuel_type"],
        "capacity_mw": row.capacity_mw,
        "voltage_kv": None,
        "pipeline_product": None,
        "pipeline_length_km": None,
        "terminal_type": None,
        "latitude": row.latitude,
        "longitude": row.longitude,
        "source_url": row.url,
        "source_metadata": {
            "commissioning_year": row.commissioning_year,
            "geolocation_source": row.geolocation_source,
            "wepp_id": None,
            "source_field": row.source,
            "year_of_capacity_data": None,
        },
        "source_confidence": 0.9,
        "raw": {
            COL_GPPD_IDNR: row.gppd_idnr,
            COL_NAME: row.name,
            COL_COUNTRY: row.country,
            COL_CAPACITY_MW: row.capacity_mw,
            COL_LATITUDE: row.latitude,
            COL_LONGITUDE: row.longitude,
            COL_PRIMARY_FUEL: row.primary_fuel,
            COL_COMMISSIONING_YEAR: row.commissioning_year,
            COL_OWNER: row.owner,
            COL_SOURCE: row.source,
            COL_URL_FIELD: row.url,
            COL_GEOLOCATION_SOURCE: row.geolocation_source,
        },
    }


def download_wri_csv(
    url: str = DEFAULT_DOWNLOAD_URL,
    timeout: int = 60,
) -> str:
    """Download the WRI CSV, falling back to GitHub if the primary fails.

    Tries ``url`` first.  On any HTTP / transport error the function
    retries with ``_FALLBACK_DOWNLOAD_URL``.  Returns the CSV text on
    success.  Raises ``WRIHttpError`` only when *both* attempts fail.
    The DB URL is never logged.
    """
    errors: list[str] = []
    urls_to_try = [url] if url else []
    if _FALLBACK_DOWNLOAD_URL and _FALLBACK_DOWNLOAD_URL not in urls_to_try:
        urls_to_try.append(_FALLBACK_DOWNLOAD_URL)

    if not urls_to_try:
        raise WRIHttpError("No WRI download URL configured")

    for attempt_url in urls_to_try:
        req = urllib.request.Request(
            attempt_url,
            headers={"User-Agent": "god-eyes-fetching/wo-083c (energy-infrastructure)"},
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310
                status = getattr(resp, "status", None) or resp.getcode()
                if status and int(status) >= 400:
                    raise WRIHttpError(f"HTTP {status}")
                data = resp.read()
            try:
                csv_text = data.decode("utf-8")
            except UnicodeDecodeError:
                csv_text = data.decode("utf-8", errors="replace")
            # Basic sanity check: must look like CSV (has a header row).
            if csv_text and "\n" in csv_text:
                return csv_text
            errors.append(f"Empty or invalid CSV from {attempt_url}")
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as exc:
            errors.append(f"{attempt_url}: {exc.__class__.__name__}")

    raise WRIHttpError(
        "All WRI download URLs failed: " + "; ".join(errors)
    )


def fetch_wri(
    csv_text: str | None = None,
    url: str = DEFAULT_DOWNLOAD_URL,
    timeout: int = 60,
) -> dict[str, Any]:
    """Fetch and classify the WRI dataset.

    Args:
        csv_text: Inject pre-loaded CSV text (for tests). When provided,
            the network is not used.
        url: URL to download from if ``csv_text`` is ``None``.
        timeout: Network timeout in seconds.

    Returns:
        Dictionary with:
        * ``ok`` (bool)
        * ``csv_text`` (str, possibly empty on failure)
        * ``records`` (list[dict[str, Any]] of normalized feature dicts)
        * ``raw_records`` (list[dict[str, str]] of WRI source rows)
        * ``skipped`` (int) — number of rows skipped due to invalid data
        * ``error`` (str | None)
        * ``fetched_at`` (str ISO 8601)
    """
    fetched_at = datetime.now(timezone.utc).isoformat()
    if csv_text is None:
        try:
            csv_text = download_wri_csv(url=url, timeout=timeout)
        except WRIHttpError as exc:
            return {
                "ok": False,
                "csv_text": "",
                "records": [],
                "raw_records": [],
                "skipped": 0,
                "error": str(exc),
                "fetched_at": fetched_at,
            }

    raw_rows = parse_wri_csv(csv_text)
    skipped = 0
    records: list[dict[str, Any]] = []
    for raw in raw_rows:
        row = coerce_row(raw)
        if row is None:
            skipped += 1
            continue
        records.append(wri_row_to_feature_dict(row))

    return {
        "ok": True,
        "csv_text": csv_text,
        "records": records,
        "raw_records": raw_rows,
        "skipped": skipped,
        "error": None,
        "fetched_at": fetched_at,
    }


def write_wri_raw_to_disk(
    csv_text: str,
    out_path: str | Path,
) -> Path:
    """Write the WRI CSV text to disk under the configured cache path.

    No secrets are written; the file is the verbatim CSV payload.
    """
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(csv_text, encoding="utf-8")
    return out


def is_malformed_wri_row(raw: dict[str, str]) -> bool:
    """Return True if a raw WRI row is missing required fields or has
    invalid lat/lon. Useful as a test helper.
    """
    return coerce_row(raw) is None


# --------------------------------------------------------------------- misc


def describe_wri() -> dict[str, Any]:
    """JSON-friendly description of the WRI source (for the worker banner)."""
    return {
        "source_id": SOURCE_ID,
        "name": WRI_CONFIG.name,
        "license": WRI_CONFIG.license_name,
        "license_url": WRI_CONFIG.license_url,
        "download_url": DEFAULT_DOWNLOAD_URL,
        "columns": [
            COL_GPPD_IDNR,
            COL_NAME,
            COL_COUNTRY,
            COL_CAPACITY_MW,
            COL_LATITUDE,
            COL_LONGITUDE,
            COL_PRIMARY_FUEL,
            COL_COMMISSIONING_YEAR,
            COL_OWNER,
            COL_SOURCE,
            COL_URL_FIELD,
            COL_GEOLOCATION_SOURCE,
        ],
    }
