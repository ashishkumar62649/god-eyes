"""Global Energy Monitor client (Layer 10 P3 source, license-blocked live).

The Global Energy Monitor (GEM) publishes several open datasets that
cover oil/gas pipelines, LNG terminals, and major oil/gas terminals.
Each GEM dataset has its own license page, and per-dataset
verification has not yet been completed for the MVP. To stay
defensible, the live download path is **disabled by default** and the
client fails fast with a clear, recorded message.

The rest of the pipeline is fully prepared for GEM data:

* The mock recorder accepts lists of well-formed GEM record dicts and
  hands them to the normalizer in exactly the same shape a real
  future download would produce.
* ``fetch_gem`` returns a failure envelope with
  ``ok=False`` and ``error="Global Energy Monitor source requires
  license/download verification before live download."`` so the
  worker can record it in the manifest and continue with the other
  sources.

No scraping of public web pages is performed under any circumstance.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from energy_sources import GEM_CONFIG, SOURCE_GEM

LAYER_ID = "layer_10_energy_infrastructure"
SOURCE_ID = SOURCE_GEM

LICENSE_BLOCKED_MESSAGE = (
    "Global Energy Monitor source requires license/download verification "
    "before live download."
)

# Default mock groups the worker can use to exercise the rest of the
# pipeline (normalizer, DB writer, manifests). Each group's mock file is
# a JSON list of well-formed GEM-shaped record dicts.
DEFAULT_MOCK_GROUPS: tuple[str, ...] = (
    "mock_gas_pipelines",
    "mock_oil_pipelines",
    "mock_lng_terminals",
    "mock_oil_terminals",
    "mock_gas_terminals",
)


class GEMNotVerifiedError(RuntimeError):
    """Raised when a live GEM download is attempted before license verification."""


def _fetched_at() -> str:
    return datetime.now(timezone.utc).isoformat()


def fetch_gem(
    *,
    group: str | None = None,
    mock_records: list[dict[str, Any]] | None = None,
    mock_path: str | Path | None = None,
    csv_text: str | None = None,
) -> dict[str, Any]:
    """Fetch a GEM group.

    Live download is disabled. The function returns one of:

    * A failure envelope with ``ok=False`` and
      ``error == LICENSE_BLOCKED_MESSAGE`` when no mock is provided.
    * A success envelope with the provided ``mock_records`` (or records
      loaded from ``mock_path`` / ``csv_text``), normalized to a list
      of plain dicts so the rest of the pipeline can run unchanged.

    Args:
        group: Cache group label (e.g. ``"mock_gas_pipelines"``).
        mock_records: Pre-built list of GEM-shaped record dicts.
        mock_path: Path to a JSON file containing such a list.
        csv_text: Alternative JSON text payload (for tests).
    """
    fetched_at = _fetched_at()
    group_label = group or "default"

    if mock_records is None and mock_path is None and csv_text is None:
        return {
            "ok": False,
            "records": [],
            "raw_text": "",
            "group": group_label,
            "error": LICENSE_BLOCKED_MESSAGE,
            "fetched_at": fetched_at,
            "license_verified": GEM_CONFIG.license_verified,
        }

    if mock_records is not None:
        records = list(mock_records)
        raw_text = json.dumps(records)
    elif mock_path is not None:
        path = Path(mock_path)
        raw_text = path.read_text(encoding="utf-8")
        records = json.loads(raw_text)
        if not isinstance(records, list):
            return {
                "ok": False,
                "records": [],
                "raw_text": raw_text,
                "group": group_label,
                "error": "GEM mock file must contain a JSON list of records",
                "fetched_at": fetched_at,
                "license_verified": GEM_CONFIG.license_verified,
            }
    else:
        assert csv_text is not None  # type narrowing for mypy
        raw_text = csv_text
        try:
            records = json.loads(csv_text)
        except json.JSONDecodeError as exc:
            return {
                "ok": False,
                "records": [],
                "raw_text": raw_text,
                "group": group_label,
                "error": f"Invalid GEM mock JSON: {exc}",
                "fetched_at": fetched_at,
                "license_verified": GEM_CONFIG.license_verified,
            }
        if not isinstance(records, list):
            return {
                "ok": False,
                "records": [],
                "raw_text": raw_text,
                "group": group_label,
                "error": "GEM mock must contain a JSON list of records",
                "fetched_at": fetched_at,
                "license_verified": GEM_CONFIG.license_verified,
            }

    cleaned: list[dict[str, Any]] = []
    for rec in records:
        if not isinstance(rec, dict):
            continue
        cleaned.append(rec)

    return {
        "ok": True,
        "records": cleaned,
        "raw_text": raw_text,
        "group": group_label,
        "error": None,
        "fetched_at": fetched_at,
        "license_verified": GEM_CONFIG.license_verified,
    }


def classify_gem_record(record: dict[str, Any]) -> dict[str, str | None]:
    """Map a GEM record dict to a canonical feature dict.

    Expected record fields (best effort — GEM publishes slightly
    different schemas per dataset):

    * ``id`` / ``gem_id`` / ``object_id`` — required
    * ``name`` / ``project``
    * ``country`` / ``countries`` — ISO 2-letter or 3-letter
    * ``status``
    * ``type`` / ``category`` — pipeline / terminal
    * ``subtype`` / ``product`` — gas / oil / lng
    * ``length_km`` / ``length``
    * ``operator`` / ``owner``
    * ``geometry`` (GeoJSON dict) OR ``lat``/``lon`` / ``route`` (line)
    """
    if not isinstance(record, dict):
        return {
            "feature_type": "unknown_energy_feature",
            "category": "unknown",
            "pipeline_product": None,
            "terminal_type": None,
        }

    rtype = (record.get("type") or record.get("category") or "").lower()
    sub = (record.get("subtype") or record.get("product") or "").lower()

    if "pipeline" in rtype or "pipeline" in sub:
        if "oil" in sub and "gas" not in sub:
            return {
                "feature_type": "oil_pipeline",
                "category": "oil_pipeline",
                "pipeline_product": "crude_oil",
                "terminal_type": None,
            }
        if "gas" in sub or "lng" in sub:
            return {
                "feature_type": "gas_pipeline",
                "category": "gas_pipeline",
                "pipeline_product": "natural_gas",
                "terminal_type": None,
            }
        # Fall back to "gas_pipeline" since the dataset skews gas-heavy
        # and we still need a DB-allowlist value.
        return {
            "feature_type": "gas_pipeline",
            "category": "gas_pipeline",
            "pipeline_product": "natural_gas",
            "terminal_type": None,
        }

    if "lng" in rtype or "lng" in sub:
        return {
            "feature_type": "lng_terminal",
            "category": "lng_terminal",
            "pipeline_product": None,
            "terminal_type": _gem_terminal_type(record),
        }
    if "terminal" in rtype:
        if "oil" in sub:
            return {
                "feature_type": "oil_terminal",
                "category": "oil_terminal",
                "pipeline_product": None,
                "terminal_type": _gem_terminal_type(record),
            }
        if "gas" in sub:
            return {
                "feature_type": "gas_terminal",
                "category": "gas_terminal",
                "pipeline_product": None,
                "terminal_type": _gem_terminal_type(record),
            }
        return {
            "feature_type": "gas_terminal",
            "category": "gas_terminal",
            "pipeline_product": None,
            "terminal_type": _gem_terminal_type(record),
        }

    return {
        "feature_type": "unknown_energy_feature",
        "category": "unknown",
        "pipeline_product": None,
        "terminal_type": None,
    }


def _gem_terminal_type(record: dict[str, Any]) -> str:
    """Map a free-form terminal role to the DB-allowlist value."""
    role = (record.get("role") or record.get("terminal_type") or "").lower()
    if role in {"import", "imports"}:
        return "import"
    if role in {"export", "exports"}:
        return "export"
    if role in {"storage"}:
        return "storage"
    if role in {"transfer", "transhipment", "transshipment"}:
        return "transfer"
    return "unknown"


def gem_source_id() -> str:
    return SOURCE_ID


def describe_gem() -> dict[str, Any]:
    """JSON-friendly description of the GEM source (for the worker banner)."""
    return {
        "source_id": SOURCE_GEM,
        "name": GEM_CONFIG.name,
        "license": GEM_CONFIG.license_name,
        "license_url": GEM_CONFIG.license_url,
        "license_verified": GEM_CONFIG.license_verified,
        "live_download_enabled": False,
        "mock_groups": list(DEFAULT_MOCK_GROUPS),
    }
