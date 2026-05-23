from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

sys.path.insert(0, str(REPO_ROOT / "packages" / "schemas"))
sys.path.insert(0, str(REPO_ROOT / "services" / "normalizer" / "src" / "layers" / "layer_01_aviation"))

from airport_layout_features_normalizer import (
    normalize_runway_to_layout_feature,
    normalize_runways,
    feature_to_db_record,
    NormalizedLayoutFeature,
    LAYER_ID,
    SOURCE_TYPE,
)

KBDL_AIRPORT_ID = "5209e070-54e7-45af-a2ef-afa20905085c"


def make_runway(
    source_runway_id: str,
    le_ident: str = "06",
    he_ident: str = "24",
    le_lat: float = 41.9389,
    le_lon: float = -72.6832,
    he_lat: float = 41.9489,
    he_lon: float = -72.6732,
    closed: bool = False,
    length_ft: int | None = 9500,
    width_ft: int | None = 150,
    surface: str | None = "ASP",
    lighted: bool = True,
) -> dict:
    return {
        "source_runway_id": source_runway_id,
        "le_ident": le_ident,
        "he_ident": he_ident,
        "le_latitude_deg": le_lat,
        "le_longitude_deg": le_lon,
        "he_latitude_deg": he_lat,
        "he_longitude_deg": he_lon,
        "le_elevation_ft": 100,
        "he_elevation_ft": 100,
        "le_heading_degT": 60,
        "he_heading_degT": 240,
        "le_displaced_threshold_ft": None,
        "he_displaced_threshold_ft": None,
        "length_ft": length_ft,
        "width_ft": width_ft,
        "surface": surface,
        "lighted": lighted,
        "closed": closed,
    }


def make_runway_no_geometry(
    source_runway_id: str,
    le_ident: str = "06",
    he_ident: str = "24",
    closed: bool = False,
) -> dict:
    return {
        "source_runway_id": source_runway_id,
        "le_ident": le_ident,
        "he_ident": he_ident,
        "le_latitude_deg": None,
        "le_longitude_deg": None,
        "he_latitude_deg": None,
        "he_longitude_deg": None,
        "le_elevation_ft": None,
        "he_elevation_ft": None,
        "le_heading_degT": None,
        "he_heading_degT": None,
        "le_displaced_threshold_ft": None,
        "he_displaced_threshold_ft": None,
        "length_ft": None,
        "width_ft": None,
        "surface": None,
        "lighted": None,
        "closed": closed,
    }


class TestNormalizeRunwayToLayoutFeature:
    def test_closed_runway_normalizes_to_is_active_false(self):
        runway = make_runway(source_runway_id="RW01", closed=True)
        feature = normalize_runway_to_layout_feature(runway, KBDL_AIRPORT_ID)
        assert feature is not None
        assert feature.is_active is False
        assert feature.feature_subtype == "closed"
        assert feature.raw_metadata["closed"] is True
        assert feature.is_primary is False
        assert feature.confidence_label == "medium"
        assert feature.confidence_score == 0.7
        assert feature.rank == 150

    def test_open_runway_normalizes_to_is_active_true(self):
        runway = make_runway(source_runway_id="RW02", closed=False)
        feature = normalize_runway_to_layout_feature(runway, KBDL_AIRPORT_ID)
        assert feature is not None
        assert feature.is_active is True
        assert feature.feature_subtype == "active"
        assert feature.raw_metadata["closed"] is False
        assert feature.is_primary is True
        assert feature.confidence_label == "high"
        assert feature.confidence_score == 0.95
        assert feature.rank == 50

    def test_open_runway_defaults_to_is_active_true_when_closed_missing(self):
        runway = make_runway(source_runway_id="RW03")
        del runway["closed"]
        feature = normalize_runway_to_layout_feature(runway, KBDL_AIRPORT_ID)
        assert feature is not None
        assert feature.is_active is True
        assert feature.feature_subtype == "active"
        assert feature.raw_metadata["closed"] is False

    def test_no_fake_geometry_inserted(self):
        runway = make_runway_no_geometry(source_runway_id="RW04", closed=True)
        feature = normalize_runway_to_layout_feature(runway, KBDL_AIRPORT_ID)
        assert feature is None

    def test_no_geometry_returns_none_even_for_open_runway(self):
        runway = make_runway_no_geometry(source_runway_id="RW05", closed=False)
        feature = normalize_runway_to_layout_feature(runway, KBDL_AIRPORT_ID)
        assert feature is None

    def test_preserves_closed_in_raw_metadata(self):
        runway = make_runway(source_runway_id="RW06", closed=True)
        feature = normalize_runway_to_layout_feature(runway, KBDL_AIRPORT_ID)
        assert feature.raw_metadata["closed"] is True
        assert "length_ft" in feature.raw_metadata
        assert "surface" in feature.raw_metadata
        assert "lighted" in feature.raw_metadata

    def test_preserves_closed_in_feature_subtype(self):
        runway = make_runway(source_runway_id="RW07", closed=True)
        feature = normalize_runway_to_layout_feature(runway, KBDL_AIRPORT_ID)
        assert feature.feature_subtype == "closed"

    def test_feature_to_db_record_preserves_is_active(self):
        runway = make_runway(source_runway_id="RW08", closed=True)
        feature = normalize_runway_to_layout_feature(runway, KBDL_AIRPORT_ID)
        record = feature_to_db_record(feature)
        assert record["is_active"] is False
        assert record["feature_subtype"] == "closed"
        assert record["raw_metadata"]["closed"] is True

    def test_open_runway_feature_to_db_record(self):
        runway = make_runway(source_runway_id="RW09", closed=False)
        feature = normalize_runway_to_layout_feature(runway, KBDL_AIRPORT_ID)
        record = feature_to_db_record(feature)
        assert record["is_active"] is True
        assert record["feature_subtype"] == "active"
        assert record["raw_metadata"]["closed"] is False

    def test_normalize_runways_filters_none(self):
        open_rwy = make_runway(source_runway_id="RW10", closed=False)
        closed_rwy = make_runway(source_runway_id="RW11", closed=True)
        no_geom_rwy = make_runway_no_geometry(source_runway_id="RW12")
        features = normalize_runways([open_rwy, closed_rwy, no_geom_rwy], KBDL_AIRPORT_ID)
        assert len(features) == 2
        assert features[0].is_active is True
        assert features[0].source_object_id == "RW10"
        assert features[1].is_active is False
        assert features[1].source_object_id == "RW11"

    def test_upsert_deactivates_when_closed_flag_added(self):
        record = {
            "airport_id": KBDL_AIRPORT_ID,
            "source_object_id": "RW13",
            "is_active": False,
            "feature_subtype": "closed",
        }
        assert record["is_active"] is False
        assert record["feature_subtype"] == "closed"
