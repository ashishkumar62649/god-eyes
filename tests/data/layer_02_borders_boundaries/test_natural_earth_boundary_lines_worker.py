"""Tests for Natural Earth Boundary Lines fetcher (WO-078E8)."""

import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT / "services" / "fetch-orchestrator" / "src" / "layers" / "layer_02_borders_boundaries"))

from natural_earth_boundary_lines_worker import (
    run_fetcher,
    NATURAL_EARTH_URL,
    SOURCE_ID,
    SOURCE_NAME,
    LAYER_ID,
    CAVEAT,
)


def test_dry_run_default_no_db_writes():
    """Dry-run mode must not write to database."""
    with patch("natural_earth_boundary_lines_worker.fetch_shapefile_zip", return_value=None):
        result = run_fetcher(dry_run=True)
    assert result["upserted"] == 0


def test_persist_requires_explicit_flag():
    """Without --persist, fetcher defaults to dry-run."""
    # run_fetcher defaults to dry_run=True
    with patch("natural_earth_boundary_lines_worker.fetch_shapefile_zip", return_value=None):
        result = run_fetcher()
    assert result["upserted"] == 0


def test_official_natural_earth_url_only():
    """Source URL must be the official Natural Earth CDN."""
    assert NATURAL_EARTH_URL == "https://naciscdn.org/naturalearth/50m/cultural/ne_50m_admin_0_boundary_lines_land.zip"


def test_no_raw_dataset_committed():
    """No raw shapefile data should exist in the repository."""
    data_dir = REPO_ROOT / "services" / "fetch-orchestrator" / "src" / "layers" / "layer_02_borders_boundaries"
    shp_files = list(data_dir.glob("*.shp")) + list(data_dir.glob("*.dbf")) + list(data_dir.glob("*.zip"))
    assert len(shp_files) == 0, f"Raw data files found: {shp_files}"


def test_source_metadata_mvp_local_dev_only():
    """Source metadata must declare MVP/local/dev only status."""
    assert "MVP/local/dev only" in CAVEAT
    assert SOURCE_ID == "natural_earth_admin0_boundary_lines_50m"
    assert SOURCE_NAME == "Natural Earth Admin-0 Boundary Lines 1:50m"
    assert LAYER_ID == "layer_02_borders_boundaries"


def test_no_india_compliance_claim():
    """Source must not claim India compliance."""
    assert "not India-compliant" in CAVEAT
    assert "india" not in SOURCE_NAME.lower() or "compliant" not in SOURCE_NAME.lower()


def test_idempotent_upsert_behavior():
    """Persist uses ON CONFLICT upsert — calling twice should not duplicate."""
    # Verify the persist_records function uses ON CONFLICT by inspecting source
    import inspect
    from natural_earth_boundary_lines_worker import persist_records
    source = inspect.getsource(persist_records)
    assert "ON CONFLICT" in source
    assert "DO UPDATE SET" in source


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
