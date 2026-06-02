"""OSM Energy Infrastructure client (Layer 10 P2 source).

The OpenStreetMap (OSM) energy dataset is queried through the public
Overpass API. The Overpass query is built per region/bounding box to
keep traffic polite; **no global queries are run by default**.

The fetcher:

* Builds an Overpass QL query for the energy tags listed in the
  contract (power=plant, power=generator, power=substation, power=line,
  pipeline=*, man_made=pipeline).
* Refuses a query that has no ``--bbox`` / ``--country`` / ``--region``
  scope unless the caller explicitly opts into ``--allow-global`` (only
  intended for the test mode, never enabled in production runs).
* Sends the query to Overpass and parses the standard JSON response
  (``elements`` array of nodes/ways/relations).
* Returns a list of element-shaped dicts so the normalizer can decide
  per-element geometry (point/line/polygon).
* Network calls are best-effort; failures are recorded in the
  manifest.

Reference Overpass QL syntax:
https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL
"""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterable

from energy_sources import SOURCE_OSM

LAYER_ID = "layer_10_energy_infrastructure"
SOURCE_ID = SOURCE_OSM

DEFAULT_OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Default energy-tag set. Each tuple is (key, value). A value of ``""``
# means "any value" — we use the ``["key"]`` query syntax for those.
DEFAULT_ENERGY_KEYS: tuple[tuple[str, str], ...] = (
    ("power", "plant"),
    ("power", "generator"),
    ("power", "substation"),
    ("power", "line"),
    ("power", "cable"),
    ("power", "minor_line"),
    ("power", "transformer"),
    ("pipeline", ""),
    ("man_made", "pipeline"),
)

# Hard cap for any single Overpass query to keep the public instance
# healthy. ``--max-features`` further caps the result set on the client
# side for dry runs.
DEFAULT_QUERY_LIMIT = 5000
MAX_BBOX_AREA_DEG2 = 25.0  # ~ Western Europe; > this is treated as global.


class OSMQueryError(ValueError):
    """Raised when an Overpass query is unsafe (e.g. missing bbox)."""


class OSMHttpError(RuntimeError):
    """Raised when Overpass returns an error or the request fails."""


# --------------------------------------------------------------------- query


def validate_bbox(bbox: str | None) -> tuple[float, float, float, float] | None:
    """Parse ``"west,south,east,north"`` into a tuple of floats.

    Returns ``None`` for empty input. Raises ``OSMQueryError`` for
    malformed values or inverted ranges.
    """
    if bbox is None:
        return None
    parts = [p.strip() for p in bbox.split(",")]
    if len(parts) != 4:
        raise OSMQueryError(
            f"bbox must be 'west,south,east,north' (4 numbers); got: {bbox!r}"
        )
    try:
        west, south, east, north = (float(p) for p in parts)
    except ValueError as exc:
        raise OSMQueryError(f"bbox has non-numeric components: {bbox!r}") from exc
    if not (-180.0 <= west <= 180.0 and -180.0 <= east <= 180.0):
        raise OSMQueryError(f"bbox longitudes out of range: {bbox!r}")
    if not (-90.0 <= south <= 90.0 and -90.0 <= north <= 90.0):
        raise OSMQueryError(f"bbox latitudes out of range: {bbox!r}")
    if west >= east or south >= north:
        raise OSMQueryError(f"bbox is not well-formed (west<east, south<north): {bbox!r}")
    return (west, south, east, north)


def bbox_area_deg2(bbox: tuple[float, float, float, float]) -> float:
    """Return the area of a bbox in square degrees (very rough)."""
    west, south, east, north = bbox
    return max(0.0, east - west) * max(0.0, north - south)


def is_global_scope(
    bbox: tuple[float, float, float, float] | None,
    country: str | None,
    region: str | None,
    *,
    allow_global: bool = False,
) -> bool:
    """Return True when the query covers (effectively) the entire planet.

    Either:
    * No bbox, no country, and no region were provided.
    * The bbox area exceeds ``MAX_BBOX_AREA_DEG2`` and the caller did
      not explicitly opt-in via ``allow_global``.

    In both cases the caller should refuse to run a giant query unless
    ``allow_global`` is True (test mode only).
    """
    if country or region:
        return False
    if bbox is None:
        return True
    if bbox_area_deg2(bbox) > MAX_BBOX_AREA_DEG2 and not allow_global:
        return True
    return False


def build_overpass_query(
    *,
    bbox: tuple[float, float, float, float] | None = None,
    country: str | None = None,
    energy_keys: Iterable[tuple[str, str]] = DEFAULT_ENERGY_KEYS,
    query_limit: int = DEFAULT_QUERY_LIMIT,
) -> str:
    """Build an Overpass QL query for energy infrastructure.

    Args:
        bbox: ``(west, south, east, north)`` in degrees.
        country: ISO 3166-1 alpha-2 country code. Translated into a bbox
            via a built-in lookup table.
        energy_keys: Iterable of ``(key, value)`` pairs. A blank value
            matches any tag value.
        query_limit: Server-side cap passed as ``[maxsize:...]``.

    Raises:
        OSMQueryError: If neither bbox nor country is provided.
    """
    if bbox is None and not country:
        raise OSMQueryError(
            "Refusing to build an Overpass query without bbox or country scope"
        )

    if bbox is None and country:
        bbox = country_to_bbox(country)

    if bbox is None:
        # Should not happen given the guard above, but stay explicit.
        raise OSMQueryError("bbox resolved to None despite country scope")

    west, south, east, north = bbox
    bbox_str = f"{south},{west},{north},{east}"

    parts: list[str] = []
    parts.append("[out:json][timeout:60]")
    parts.append(f"[maxsize:{int(max(1024, query_limit))}]")
    parts.append(";")
    parts.append(f"(")
    for key, value in energy_keys:
        if not value:
            # value="any"
            parts.append(f'  node["{key}"]({bbox_str});')
            parts.append(f'  way["{key}"]({bbox_str});')
            parts.append(f'  relation["{key}"]({bbox_str});')
        else:
            parts.append(f'  node["{key}"="{value}"]({bbox_str});')
            parts.append(f'  way["{key}"="{value}"]({bbox_str});')
            parts.append(f'  relation["{key}"="{value}"]({bbox_str});')
    parts.append(");")
    parts.append("out body geom;")
    parts.append(">;" )
    parts.append("out skel qt;")
    return "\n".join(parts)


# Small built-in bbox table. Production runs should use --bbox instead,
# but this keeps a usable default for tiny smoke tests.
COUNTRY_BBOX: dict[str, tuple[float, float, float, float]] = {
    "US": (-125.0, 24.5, -66.5, 49.5),
    "CA": (-141.0, 41.5, -52.0, 84.0),
    "MX": (-118.5, 14.5, -86.5, 32.5),
    "GB": (-8.5, 49.5, 1.5, 61.0),
    "IE": (-10.5, 51.0, -6.0, 55.5),
    "DE": (5.5, 47.0, 15.5, 55.5),
    "FR": (-5.5, 41.0, 9.5, 51.5),
    "ES": (-9.5, 36.0, 4.5, 44.0),
    "IT": (6.5, 36.0, 18.5, 47.5),
    "PL": (14.0, 49.0, 24.5, 55.0),
    "IN": (68.0, 6.5, 97.5, 35.5),
    "CN": (73.0, 18.0, 135.0, 53.5),
    "JP": (128.0, 30.0, 146.0, 46.0),
    "AU": (112.0, -44.0, 154.0, -10.0),
    "BR": (-74.0, -34.0, -34.0, 5.5),
    "ZA": (16.0, -35.0, 33.0, -22.0),
}


def country_to_bbox(country: str) -> tuple[float, float, float, float] | None:
    """Return a small built-in bbox for known ISO-2 codes, else ``None``."""
    if not country:
        return None
    return COUNTRY_BBOX.get(country.strip().upper())


# --------------------------------------------------------------------- fetch


def run_overpass_query(
    query: str,
    *,
    endpoint: str = DEFAULT_OVERPASS_URL,
    timeout: int = 90,
) -> dict[str, Any]:
    """Send a query to Overpass and return the parsed JSON.

    Raises ``OSMHttpError`` on transport or non-200 responses.
    """
    data = urllib.parse.urlencode({"data": query}).encode("ascii")
    req = urllib.request.Request(
        endpoint,
        data=data,
        headers={"User-Agent": "god-eyes-fetching/wo-083c (energy-infrastructure)"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310
            status = int(getattr(resp, "status", None) or resp.getcode())
            if status >= 400:
                raise OSMHttpError(f"HTTP {status}")
            body = resp.read()
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as exc:
        raise OSMHttpError(f"Overpass request failed: {exc.__class__.__name__}") from exc
    try:
        return json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise OSMHttpError(f"Overpass returned invalid JSON: {exc}") from exc


def fetch_osm(
    *,
    csv_text: str | None = None,  # alias for tests; raw JSON text
    bbox: str | None = None,
    country: str | None = None,
    region: str | None = None,
    allow_global: bool = False,
    max_features: int | None = None,
    endpoint: str = DEFAULT_OVERPASS_URL,
    timeout: int = 90,
) -> dict[str, Any]:
    """Fetch OSM energy elements within a bounded scope.

    Args:
        csv_text: When provided, treated as the verbatim Overpass JSON
            response and parsed without making a network call. Useful
            for tests.
        bbox: ``"west,south,east,north"`` string.
        country: ISO-2 country code; resolved via the built-in table.
        region: Free-form region label used only for cache grouping.
        allow_global: Opt-in to a global query (test mode only).
        max_features: Optional client-side cap on the number of
            returned elements.
        endpoint: Overpass endpoint URL.
        timeout: Network timeout in seconds.

    Returns:
        Dictionary with:
        * ``ok`` (bool)
        * ``raw_text`` (str) — verbatim Overpass JSON (empty on failure)
        * ``elements`` (list[dict]) — parsed Overpass elements
        * ``bbox_used`` (tuple[float,float,float,float] | None)
        * ``scope_label`` (str) — cache key for the group
        * ``error`` (str | None)
        * ``fetched_at`` (str ISO 8601)
    """
    fetched_at = datetime.now(timezone.utc).isoformat()
    parsed_bbox = validate_bbox(bbox)
    scope_label = region or country or (
        f"bbox_{parsed_bbox[0]:.2f}_{parsed_bbox[1]:.2f}_{parsed_bbox[2]:.2f}_{parsed_bbox[3]:.2f}"
        if parsed_bbox
        else "global"
    )

    if is_global_scope(parsed_bbox, country, region, allow_global=allow_global):
        return {
            "ok": False,
            "raw_text": "",
            "elements": [],
            "bbox_used": parsed_bbox,
            "scope_label": scope_label,
            "error": (
                "Refusing to run a global / too-broad Overpass query; "
                "pass --bbox or --country, or use --allow-global in test mode only."
            ),
            "fetched_at": fetched_at,
        }

    if csv_text is not None:
        try:
            data = json.loads(csv_text)
        except json.JSONDecodeError as exc:
            return {
                "ok": False,
                "raw_text": csv_text or "",
                "elements": [],
                "bbox_used": parsed_bbox,
                "scope_label": scope_label,
                "error": f"Invalid Overpass JSON: {exc}",
                "fetched_at": fetched_at,
            }
    else:
        query = build_overpass_query(
            bbox=parsed_bbox if parsed_bbox else country_to_bbox(country or ""),
            country=country,
        )
        try:
            data = run_overpass_query(query, endpoint=endpoint, timeout=timeout)
        except OSMHttpError as exc:
            return {
                "ok": False,
                "raw_text": "",
                "elements": [],
                "bbox_used": parsed_bbox,
                "scope_label": scope_label,
                "error": str(exc),
                "fetched_at": fetched_at,
            }

    elements = list(data.get("elements", [])) if isinstance(data, dict) else []
    if max_features is not None and max_features >= 0:
        elements = elements[: int(max_features)]

    return {
        "ok": True,
        "raw_text": json.dumps(data),
        "elements": elements,
        "bbox_used": parsed_bbox,
        "scope_label": scope_label,
        "error": None,
        "fetched_at": fetched_at,
    }


# --------------------------------------------------------------------- helpers


def classify_osm_tags(tags: dict[str, str]) -> dict[str, str | None]:
    """Classify an OSM element's tags into a canonical feature dict.

    Returns:
        Dict with keys:
        * ``feature_type`` — one of the canonical types
        * ``category`` — canonical category (often mirrors feature_type)
        * ``fuel_type`` — only set for power plants (best effort)
        * ``voltage_kv`` — best effort for transmission lines / substations
        * ``pipeline_product`` — best effort for pipelines
    """
    if not tags:
        return {
            "feature_type": "unknown_energy_feature",
            "category": "unknown",
            "fuel_type": None,
            "voltage_kv": None,
            "pipeline_product": None,
        }

    power = tags.get("power")
    pipeline = tags.get("pipeline")
    man_made = tags.get("man_made")

    if power == "substation":
        return {
            "feature_type": "substation",
            "category": "substation",
            "fuel_type": None,
            "voltage_kv": _parse_voltage_kv(tags.get("voltage")),
            "pipeline_product": None,
        }
    if power in ("line", "cable", "minor_line"):
        return {
            "feature_type": "transmission_line",
            "category": "transmission_line",
            "fuel_type": None,
            "voltage_kv": _parse_voltage_kv(tags.get("voltage")),
            "pipeline_product": None,
        }
    if power in ("plant", "generator"):
        # Heuristic fuel_type from generator:source / plant:source / fuel:*
        fuel_tag = (
            tags.get("plant:source")
            or tags.get("generator:source")
            or tags.get("fuel")
            or tags.get("generator:method")
            or "unknown"
        )
        from energy_sources import wri_fuel_to_canonical

        category, fuel_type = wri_fuel_to_canonical(fuel_tag)
        return {
            "feature_type": "power_plant",
            "category": category,
            "fuel_type": fuel_type,
            "voltage_kv": None,
            "pipeline_product": None,
        }
    if man_made == "pipeline" or pipeline:
        product = _pipeline_product(pipeline or tags.get("substance") or tags.get("product"))
        feature = "oil_pipeline" if product in {"crude_oil", "refined_products"} else "gas_pipeline"
        if product == "lng":
            feature = "gas_pipeline"
        return {
            "feature_type": feature,
            "category": feature,
            "fuel_type": None,
            "voltage_kv": None,
            "pipeline_product": product,
        }

    return {
        "feature_type": "unknown_energy_feature",
        "category": "unknown",
        "fuel_type": None,
        "voltage_kv": None,
        "pipeline_product": None,
    }


def _parse_voltage_kv(value: str | None) -> float | None:
    """Parse an OSM ``voltage=...`` tag (e.g. ``"400000"`` V) to kV."""
    if not value:
        return None
    s = str(value).replace(" ", "")
    if not s:
        return None
    # Comma-separated like "110000;220000" — pick the highest.
    if ";" in s or "," in s:
        parts = [p for p in s.replace(",", ";").split(";") if p]
        vals = sorted({_to_float(p) for p in parts if _to_float(p) is not None})
        if not vals:
            return None
        return round(vals[-1] / 1000.0, 3)
    v = _to_float(s)
    if v is None or v <= 0:
        return None
    return round(v / 1000.0, 3)


def _to_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _pipeline_product(value: str | None) -> str:
    """Normalize a free-form OSM product tag to a DB-allowlist value."""
    if not value:
        return "unknown"
    s = str(value).strip().lower()
    if s in {"crude_oil", "oil", "crude"}:
        return "crude_oil"
    if s in {"refined_products", "refined", "products", "diesel", "gasoline", "kerosene"}:
        return "refined_products"
    if "oil" in s:
        return "crude_oil"
    if s in {"natural_gas", "gas", "ng", "methane"} or "gas" in s:
        return "natural_gas"
    if "lng" in s:
        return "lng"
    return "unknown"


def describe_osm() -> dict[str, Any]:
    """JSON-friendly description of the OSM source (for the worker banner)."""
    return {
        "source_id": SOURCE_ID,
        "endpoint": DEFAULT_OVERPASS_URL,
        "energy_keys": list(DEFAULT_ENERGY_KEYS),
        "country_bboxes": sorted(COUNTRY_BBOX),
        "max_bbox_area_deg2": MAX_BBOX_AREA_DEG2,
    }
