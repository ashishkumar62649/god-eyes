"""Energy Sources — Source catalog for Layer 10 Energy Infrastructure.

Defines the canonical ``source_id`` values, default groups/regions,
license metadata, and feature-type hints consumed by the
fetch-orchestrator layer. Pure data, no I/O, no network.

If the project adds new energy sources, update both this module and
the DB constraint ``energy_infrastructure_source_id_check`` in
``database/migrations/layers/layer_10_energy_infrastructure/001_energy_infrastructure_tables.sql``.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

LAYER_ID = "layer_10_energy_infrastructure"

# Canonical source ids — keep in lock-step with the DB allowlist.
SOURCE_WRI = "wri_global_power_plant_database"
SOURCE_OSM = "osm_energy_infrastructure"
SOURCE_GEM = "global_energy_monitor_energy"

CANONICAL_SOURCES: tuple[str, ...] = (
    SOURCE_WRI,
    SOURCE_OSM,
    SOURCE_GEM,
)

# Valid canonical feature_type values — match the DB constraint.
FEATURE_TYPE_POWER_PLANT = "power_plant"
FEATURE_TYPE_SUBSTATION = "substation"
FEATURE_TYPE_TRANSMISSION_LINE = "transmission_line"
FEATURE_TYPE_OIL_PIPELINE = "oil_pipeline"
FEATURE_TYPE_GAS_PIPELINE = "gas_pipeline"
FEATURE_TYPE_LNG_TERMINAL = "lng_terminal"
FEATURE_TYPE_OIL_TERMINAL = "oil_terminal"
FEATURE_TYPE_GAS_TERMINAL = "gas_terminal"
FEATURE_TYPE_UNKNOWN = "unknown_energy_feature"

CANONICAL_FEATURE_TYPES: frozenset[str] = frozenset(
    {
        FEATURE_TYPE_POWER_PLANT,
        FEATURE_TYPE_SUBSTATION,
        FEATURE_TYPE_TRANSMISSION_LINE,
        FEATURE_TYPE_OIL_PIPELINE,
        FEATURE_TYPE_GAS_PIPELINE,
        FEATURE_TYPE_LNG_TERMINAL,
        FEATURE_TYPE_OIL_TERMINAL,
        FEATURE_TYPE_GAS_TERMINAL,
        FEATURE_TYPE_UNKNOWN,
    }
)

# Valid canonical category values — match the DB constraint.
CATEGORY_VALUES: frozenset[str] = frozenset(
    {
        "nuclear_power",
        "coal_power",
        "gas_power",
        "oil_power",
        "hydro_power",
        "solar_power",
        "wind_power",
        "biomass_power",
        "geothermal_power",
        "other_power",
        "substation",
        "transmission_line",
        "oil_pipeline",
        "gas_pipeline",
        "lng_terminal",
        "oil_terminal",
        "gas_terminal",
        "unknown",
    }
)

# Status values — match the DB constraint (upper bound: declared enum).
STATUS_VALUES: frozenset[str] = frozenset(
    {
        "operational",
        "planned",
        "construction",
        "proposed",
        "decommissioned",
        "retired",
        "unknown",
    }
)

# Fuel type values — match the DB constraint.
FUEL_TYPE_VALUES: frozenset[str] = frozenset(
    {
        "nuclear",
        "coal",
        "gas",
        "oil",
        "hydro",
        "solar",
        "wind",
        "biomass",
        "geothermal",
        "other",
        "unknown",
    }
)

# Pipeline product values — match the DB constraint.
PIPELINE_PRODUCT_VALUES: frozenset[str] = frozenset(
    {
        "crude_oil",
        "refined_products",
        "natural_gas",
        "lng",
        "unknown",
    }
)

# Terminal type values — match the DB constraint.
TERMINAL_TYPE_VALUES: frozenset[str] = frozenset(
    {
        "import",
        "export",
        "storage",
        "transfer",
        "unknown",
    }
)

# Geometry type values — match the DB constraint.
GEOMETRY_TYPE_VALUES: frozenset[str] = frozenset({"point", "line", "polygon"})


@dataclass(frozen=True)
class EnergySourceConfig:
    """Static configuration for a single energy source."""

    source_id: str
    name: str
    homepage: str
    license_name: str
    license_url: str
    feature_types: tuple[str, ...]
    default_groups: tuple[str, ...]
    # WRI / GEM may need a stable direct URL to download; OSM uses Overpass.
    default_download_url: str | None = None
    notes: str = ""
    license_verified: bool = True


WRI_CONFIG = EnergySourceConfig(
    source_id=SOURCE_WRI,
    name="WRI Global Power Plant Database",
    homepage="https://datasets.wri.org/dataset/globalpowerplantdatabase",
    license_name="CC BY 4.0",
    license_url="https://creativecommons.org/licenses/by/4.0/",
    feature_types=(FEATURE_TYPE_POWER_PLANT,),
    default_groups=("latest",),
    default_download_url=(
        "https://wri-dataportal-prod.s3.amazonaws.com/"
        "globalpowerplantdatabase/global_power_plant_database.csv"
    ),
    notes=(
        "Direct CSV download. URL has been stable historically; the fetcher "
        "treats 404/403 as a recoverable failure and falls back to the cache."
    ),
    license_verified=True,
)

OSM_CONFIG = EnergySourceConfig(
    source_id=SOURCE_OSM,
    name="OpenStreetMap Energy Infrastructure (Overpass API)",
    homepage="https://www.openstreetmap.org/",
    license_name="ODbL",
    license_url="https://www.openstreetmap.org/copyright",
    feature_types=(
        FEATURE_TYPE_POWER_PLANT,
        FEATURE_TYPE_SUBSTATION,
        FEATURE_TYPE_TRANSMISSION_LINE,
        FEATURE_TYPE_OIL_PIPELINE,
        FEATURE_TYPE_GAS_PIPELINE,
    ),
    default_groups=("latest",),
    default_download_url=None,
    notes=(
        "Overpass query is built per region/bbox. The fetcher refuses "
        "global queries by default to keep Overpass polite."
    ),
    license_verified=True,
)

GEM_CONFIG = EnergySourceConfig(
    source_id=SOURCE_GEM,
    name="Global Energy Monitor",
    homepage="https://globalenergymonitor.org/",
    license_name="CC BY 4.0 (per-dataset verification required)",
    license_url="https://creativecommons.org/licenses/by/4.0/",
    feature_types=(
        FEATURE_TYPE_OIL_PIPELINE,
        FEATURE_TYPE_GAS_PIPELINE,
        FEATURE_TYPE_LNG_TERMINAL,
        FEATURE_TYPE_OIL_TERMINAL,
        FEATURE_TYPE_GAS_TERMINAL,
    ),
    default_groups=("mock_gas_pipelines", "mock_lng_terminals"),
    default_download_url=None,
    notes=(
        "Live download is BLOCKED pending per-dataset license verification. "
        "The client fails fast with a clear message; the normalizer still "
        "accepts mocked records so the rest of the pipeline is ready."
    ),
    license_verified=False,
)

SOURCE_CONFIGS: dict[str, EnergySourceConfig] = {
    SOURCE_WRI: WRI_CONFIG,
    SOURCE_OSM: OSM_CONFIG,
    SOURCE_GEM: GEM_CONFIG,
}


def get_source_config(source_id: str) -> EnergySourceConfig:
    """Return the static config for ``source_id`` or raise ``ValueError``."""
    if source_id not in SOURCE_CONFIGS:
        raise ValueError(
            f"Unknown energy source_id: {source_id!r}. "
            f"Valid: {sorted(SOURCE_CONFIGS)}"
        )
    return SOURCE_CONFIGS[source_id]


def is_canonical_source(source_id: str) -> bool:
    return source_id in CANONICAL_SOURCES


def canonical_sources() -> list[dict[str, Any]]:
    """Return a JSON-friendly list of source metadata, for the API/tests."""
    return [
        {
            "source_id": cfg.source_id,
            "name": cfg.name,
            "homepage": cfg.homepage,
            "featureTypes": list(cfg.feature_types),
            "license": cfg.license_name,
            "licenseUrl": cfg.license_url,
            "licenseVerified": cfg.license_verified,
        }
        for cfg in SOURCE_CONFIGS.values()
    ]


# --- WRI fuel-type normalization map ---------------------------------------

# WRI primary_fuel values are free-form strings. Map the common ones to
# canonical categories and fuel types. Unrecognized values become
# "other_power" / "other" so they still pass the DB constraint.
WRI_FUEL_MAP: dict[str, tuple[str, str]] = {
    # canonical_category, fuel_type
    "nuclear": ("nuclear_power", "nuclear"),
    "coal": ("coal_power", "coal"),
    "gas": ("gas_power", "gas"),
    "oil": ("oil_power", "oil"),
    "hydro": ("hydro_power", "hydro"),
    "solar": ("solar_power", "solar"),
    "wind": ("wind_power", "wind"),
    "biomass": ("biomass_power", "biomass"),
    "waste": ("biomass_power", "biomass"),
    "geothermal": ("geothermal_power", "geothermal"),
    "other": ("other_power", "other"),
    "unknown": ("other_power", "unknown"),
    "cogeneration": ("other_power", "other"),
    "storage": ("other_power", "other"),
    "waveandtidal": ("other_power", "other"),
    "petcoke": ("oil_power", "oil"),
}


def wri_fuel_to_canonical(primary_fuel: str | None) -> tuple[str, str]:
    """Map a WRI ``primary_fuel`` value to ``(category, fuel_type)``."""
    if not primary_fuel:
        return ("other_power", "unknown")
    key = primary_fuel.strip().lower()
    if key in WRI_FUEL_MAP:
        return WRI_FUEL_MAP[key]
    # Common variants the dataset has shipped with. Order matters:
    # biomass/biogas must be checked before generic "gas" because
    # "biogas" contains "gas".
    if "nuclear" in key:
        return ("nuclear_power", "nuclear")
    if "coal" in key:
        return ("coal_power", "coal")
    if "biomass" in key or "biogas" in key or "waste" in key:
        return ("biomass_power", "biomass")
    if "gas" in key or "ccgt" in key or "ocgt" in key:
        return ("gas_power", "gas")
    if "oil" in key or "diesel" in key or "fuel oil" in key or "petcoke" in key:
        return ("oil_power", "oil")
    if "hydro" in key or "pumped" in key:
        return ("hydro_power", "hydro")
    if "solar" in key or "photovoltaic" in key or "pv" == key:
        return ("solar_power", "solar")
    if "wind" in key:
        return ("wind_power", "wind")
    if "geothermal" in key:
        return ("geothermal_power", "geothermal")
    return ("other_power", "other")
