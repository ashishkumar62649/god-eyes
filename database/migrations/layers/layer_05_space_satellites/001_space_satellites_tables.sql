-- WO-082B-SPACE-SATELLITES-DATABASE-MIGRATION
-- Layer: layer_05_space_satellites
-- Purpose: Database foundation for public orbital object catalog records
-- and latest computed positions for render/API consumption.
-- Status: Additive, non-destructive. No seed data.
-- Created: 2026-05-31

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS space_satellites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id TEXT NOT NULL DEFAULT 'layer_05_space_satellites',
  source_id TEXT NOT NULL,
  source_object_id TEXT NOT NULL,

  norad_cat_id INTEGER,
  name TEXT NOT NULL,
  object_type TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'unknown',
  orbit_class TEXT NOT NULL DEFAULT 'unknown',
  country TEXT,
  operator_or_owner TEXT,
  launch_date DATE,

  tle_line1 TEXT,
  tle_line2 TEXT,
  orbital_epoch_at TIMESTAMPTZ,
  source_updated_at TIMESTAMPTZ,

  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_important BOOLEAN NOT NULL DEFAULT FALSE,
  raw_source_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT space_satellites_layer_id_check
    CHECK (layer_id = 'layer_05_space_satellites'),
  CONSTRAINT space_satellites_source_object_unique
    UNIQUE (source_id, source_object_id),
  CONSTRAINT space_satellites_norad_cat_id_unique
    UNIQUE (norad_cat_id),
  CONSTRAINT space_satellites_source_id_not_empty_check
    CHECK (btrim(source_id) <> ''),
  CONSTRAINT space_satellites_source_object_id_not_empty_check
    CHECK (btrim(source_object_id) <> ''),
  CONSTRAINT space_satellites_name_not_empty_check
    CHECK (btrim(name) <> ''),
  CONSTRAINT space_satellites_norad_cat_id_check
    CHECK (norad_cat_id IS NULL OR norad_cat_id > 0),
  CONSTRAINT space_satellites_object_type_check
    CHECK (object_type IN (
      'satellite',
      'debris',
      'rocket_body',
      'inactive_payload',
      'unknown'
    )),
  CONSTRAINT space_satellites_category_check
    CHECK (category IN (
      'starlink',
      'communications',
      'navigation',
      'weather',
      'earth_observation',
      'science',
      'crewed_or_station',
      'debris',
      'rocket_body',
      'inactive_payload',
      'unknown'
    )),
  CONSTRAINT space_satellites_orbit_class_check
    CHECK (orbit_class IN (
      'vleo',
      'leo',
      'meo',
      'geo',
      'heo',
      'unknown'
    )),
  CONSTRAINT space_satellites_last_seen_after_first_seen_check
    CHECK (last_seen_at >= first_seen_at)
);

CREATE TABLE IF NOT EXISTS space_satellite_positions_latest (
  satellite_id UUID NOT NULL REFERENCES space_satellites(id) ON DELETE CASCADE,
  layer_id TEXT NOT NULL DEFAULT 'layer_05_space_satellites',
  source_id TEXT NOT NULL,
  source_object_id TEXT NOT NULL,
  norad_cat_id INTEGER,

  estimated_at TIMESTAMPTZ NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  altitude_km DOUBLE PRECISION,
  velocity_kms DOUBLE PRECISION,
  heading_deg DOUBLE PRECISION,

  orbit_class TEXT NOT NULL DEFAULT 'unknown',
  object_type TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'unknown',
  visual_shape TEXT NOT NULL,
  visual_color TEXT NOT NULL,
  is_important BOOLEAN NOT NULL DEFAULT FALSE,
  source_age_seconds INTEGER,
  computation_method TEXT NOT NULL,
  raw_position_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT space_satellite_positions_latest_satellite_unique
    UNIQUE (satellite_id),
  CONSTRAINT space_satellite_positions_latest_source_object_unique
    UNIQUE (source_id, source_object_id),
  CONSTRAINT space_satellite_positions_latest_layer_id_check
    CHECK (layer_id = 'layer_05_space_satellites'),
  CONSTRAINT space_satellite_positions_latest_source_id_not_empty_check
    CHECK (btrim(source_id) <> ''),
  CONSTRAINT space_satellite_positions_latest_source_object_id_not_empty_check
    CHECK (btrim(source_object_id) <> ''),
  CONSTRAINT space_satellite_positions_latest_norad_cat_id_check
    CHECK (norad_cat_id IS NULL OR norad_cat_id > 0),
  CONSTRAINT space_satellite_positions_latest_latitude_check
    CHECK (latitude >= -90 AND latitude <= 90),
  CONSTRAINT space_satellite_positions_latest_longitude_check
    CHECK (longitude >= -180 AND longitude <= 180),
  CONSTRAINT space_satellite_positions_latest_altitude_km_check
    CHECK (altitude_km IS NULL OR altitude_km >= 0),
  CONSTRAINT space_satellite_positions_latest_velocity_kms_check
    CHECK (velocity_kms IS NULL OR velocity_kms >= 0),
  CONSTRAINT space_satellite_positions_latest_heading_deg_check
    CHECK (heading_deg IS NULL OR (heading_deg >= 0 AND heading_deg <= 360)),
  CONSTRAINT space_satellite_positions_latest_source_age_seconds_check
    CHECK (source_age_seconds IS NULL OR source_age_seconds >= 0),
  CONSTRAINT space_satellite_positions_latest_object_type_check
    CHECK (object_type IN (
      'satellite',
      'debris',
      'rocket_body',
      'inactive_payload',
      'unknown'
    )),
  CONSTRAINT space_satellite_positions_latest_category_check
    CHECK (category IN (
      'starlink',
      'communications',
      'navigation',
      'weather',
      'earth_observation',
      'science',
      'crewed_or_station',
      'debris',
      'rocket_body',
      'inactive_payload',
      'unknown'
    )),
  CONSTRAINT space_satellite_positions_latest_orbit_class_check
    CHECK (orbit_class IN (
      'vleo',
      'leo',
      'meo',
      'geo',
      'heo',
      'unknown'
    )),
  CONSTRAINT space_satellite_positions_latest_visual_shape_check
    CHECK (visual_shape IN ('dot', 'triangle')),
  CONSTRAINT space_satellite_positions_latest_visual_color_check
    CHECK (lower(visual_color) NOT IN ('black', 'white', '#000000', '#ffffff', '#fff', '#000')),
  CONSTRAINT space_satellite_positions_latest_computation_method_not_empty_check
    CHECK (btrim(computation_method) <> '')
);

CREATE INDEX IF NOT EXISTS idx_space_satellites_norad_cat_id
  ON space_satellites(norad_cat_id);

CREATE INDEX IF NOT EXISTS idx_space_satellites_source_object
  ON space_satellites(source_id, source_object_id);

CREATE INDEX IF NOT EXISTS idx_space_satellites_layer_id
  ON space_satellites(layer_id);

CREATE INDEX IF NOT EXISTS idx_space_satellites_object_type
  ON space_satellites(object_type);

CREATE INDEX IF NOT EXISTS idx_space_satellites_category
  ON space_satellites(category);

CREATE INDEX IF NOT EXISTS idx_space_satellites_orbit_class
  ON space_satellites(orbit_class);

CREATE INDEX IF NOT EXISTS idx_space_satellites_is_important
  ON space_satellites(is_important)
  WHERE is_important = TRUE;

CREATE INDEX IF NOT EXISTS idx_space_satellites_active_updated
  ON space_satellites(is_active, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_space_satellite_positions_latest_satellite_id
  ON space_satellite_positions_latest(satellite_id);

CREATE INDEX IF NOT EXISTS idx_space_satellite_positions_latest_source_object
  ON space_satellite_positions_latest(source_id, source_object_id);

CREATE INDEX IF NOT EXISTS idx_space_satellite_positions_latest_estimated_at
  ON space_satellite_positions_latest(estimated_at DESC);

CREATE INDEX IF NOT EXISTS idx_space_satellite_positions_latest_updated_at
  ON space_satellite_positions_latest(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_space_satellite_positions_latest_active_render
  ON space_satellite_positions_latest(layer_id, category, object_type, orbit_class);
