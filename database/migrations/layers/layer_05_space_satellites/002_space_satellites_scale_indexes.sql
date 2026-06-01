-- WO-082B2 - Layer 05 scale indexes for full satellite catalog reads
-- Layer: layer_05_space_satellites
-- Purpose: Additive indexes for 67k+ catalog/latest-position rows.
-- Status: Additive, non-destructive. No seed data.
-- Created: 2026-06-01

CREATE INDEX IF NOT EXISTS idx_space_satellites_source_id
  ON space_satellites(source_id);

CREATE INDEX IF NOT EXISTS idx_space_satellites_source_object_id
  ON space_satellites(source_object_id);

CREATE INDEX IF NOT EXISTS idx_space_satellites_source_filters
  ON space_satellites(source_id, object_type, category, orbit_class);

CREATE INDEX IF NOT EXISTS idx_space_satellites_source_important_filters
  ON space_satellites(source_id, object_type, category, orbit_class)
  WHERE is_important = TRUE;

CREATE INDEX IF NOT EXISTS idx_space_satellite_positions_latest_source_id
  ON space_satellite_positions_latest(source_id);

CREATE INDEX IF NOT EXISTS idx_space_satellite_positions_latest_source_object_id
  ON space_satellite_positions_latest(source_object_id);

CREATE INDEX IF NOT EXISTS idx_space_satellite_positions_latest_norad_cat_id
  ON space_satellite_positions_latest(norad_cat_id);

CREATE INDEX IF NOT EXISTS idx_space_satellite_positions_latest_object_type
  ON space_satellite_positions_latest(object_type);

CREATE INDEX IF NOT EXISTS idx_space_satellite_positions_latest_category
  ON space_satellite_positions_latest(category);

CREATE INDEX IF NOT EXISTS idx_space_satellite_positions_latest_orbit_class
  ON space_satellite_positions_latest(orbit_class);

CREATE INDEX IF NOT EXISTS idx_space_satellite_positions_latest_altitude_km
  ON space_satellite_positions_latest(altitude_km);

CREATE INDEX IF NOT EXISTS idx_space_satellite_positions_latest_important
  ON space_satellite_positions_latest(is_important)
  WHERE is_important = TRUE;

CREATE INDEX IF NOT EXISTS idx_space_satellite_positions_latest_source_filters
  ON space_satellite_positions_latest(source_id, object_type, category, orbit_class);

CREATE INDEX IF NOT EXISTS idx_space_satellite_positions_latest_source_estimated
  ON space_satellite_positions_latest(source_id, estimated_at DESC);

CREATE INDEX IF NOT EXISTS idx_space_satellite_positions_latest_source_altitude
  ON space_satellite_positions_latest(source_id, altitude_km)
  WHERE altitude_km IS NOT NULL;
