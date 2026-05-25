-- WO-071-EARTH-EVENTS-DATABASE-MIGRATION
-- Layer: layer_03_earth_events
-- Purpose: Database foundation for public natural event latest snapshots and history.
-- Status: Additive, non-destructive. No seed data.
-- Created: 2026-05-25

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS earth_events_latest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id TEXT NOT NULL DEFAULT 'layer_03_earth_events',
  source_id TEXT NOT NULL,
  source_object_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  magnitude NUMERIC(6,3),
  magnitude_type TEXT,
  depth_km NUMERIC(8,3),
  place TEXT,
  alert_level TEXT,
  significance INTEGER,
  tsunami BOOLEAN NOT NULL DEFAULT false,
  geometry geometry(Point, 4326) NOT NULL,
  source_url TEXT,
  observed_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  properties_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT earth_events_latest_layer_id_check
    CHECK (layer_id = 'layer_03_earth_events'),
  CONSTRAINT earth_events_latest_source_id_not_empty_check
    CHECK (btrim(source_id) <> ''),
  CONSTRAINT earth_events_latest_source_object_id_not_empty_check
    CHECK (btrim(source_object_id) <> ''),
  CONSTRAINT earth_events_latest_event_type_not_empty_check
    CHECK (btrim(event_type) <> ''),
  CONSTRAINT earth_events_latest_magnitude_check
    CHECK (magnitude IS NULL OR (magnitude >= -10 AND magnitude <= 20)),
  CONSTRAINT earth_events_latest_depth_km_check
    CHECK (depth_km IS NULL OR depth_km >= -100),
  CONSTRAINT earth_events_latest_significance_check
    CHECK (significance IS NULL OR significance >= 0),
  CONSTRAINT earth_events_latest_geometry_srid_check
    CHECK (ST_SRID(geometry) = 4326),
  CONSTRAINT earth_events_latest_geometry_not_empty_check
    CHECK (NOT ST_IsEmpty(geometry)),
  CONSTRAINT earth_events_latest_source_identity_key
    UNIQUE(source_id, source_object_id)
);

CREATE TABLE IF NOT EXISTS earth_events_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id TEXT NOT NULL DEFAULT 'layer_03_earth_events',
  source_id TEXT NOT NULL,
  source_object_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  magnitude NUMERIC(6,3),
  depth_km NUMERIC(8,3),
  place TEXT,
  alert_level TEXT,
  geometry geometry(Point, 4326) NOT NULL,
  source_url TEXT,
  observed_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  properties_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT earth_events_history_layer_id_check
    CHECK (layer_id = 'layer_03_earth_events'),
  CONSTRAINT earth_events_history_source_id_not_empty_check
    CHECK (btrim(source_id) <> ''),
  CONSTRAINT earth_events_history_source_object_id_not_empty_check
    CHECK (btrim(source_object_id) <> ''),
  CONSTRAINT earth_events_history_event_type_not_empty_check
    CHECK (btrim(event_type) <> ''),
  CONSTRAINT earth_events_history_magnitude_check
    CHECK (magnitude IS NULL OR (magnitude >= -10 AND magnitude <= 20)),
  CONSTRAINT earth_events_history_depth_km_check
    CHECK (depth_km IS NULL OR depth_km >= -100),
  CONSTRAINT earth_events_history_geometry_srid_check
    CHECK (ST_SRID(geometry) = 4326),
  CONSTRAINT earth_events_history_geometry_not_empty_check
    CHECK (NOT ST_IsEmpty(geometry))
);

CREATE INDEX IF NOT EXISTS idx_earth_events_latest_geometry_gist
  ON earth_events_latest USING GiST(geometry);

CREATE INDEX IF NOT EXISTS idx_earth_events_latest_observed_at
  ON earth_events_latest(observed_at);

CREATE INDEX IF NOT EXISTS idx_earth_events_latest_event_type
  ON earth_events_latest(event_type);

CREATE INDEX IF NOT EXISTS idx_earth_events_history_source_object_updated
  ON earth_events_history(source_id, source_object_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_earth_events_history_created_at
  ON earth_events_history(created_at);

CREATE INDEX IF NOT EXISTS idx_earth_events_history_geometry_gist
  ON earth_events_history USING GiST(geometry);
