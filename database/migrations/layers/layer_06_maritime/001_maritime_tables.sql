-- WO-MAR-D-MARITIME-DATABASE-SCHEMA
-- Layer: layer_06_maritime
-- Purpose: Database foundation for AIS maritime sources, fetch runs,
-- latest vessel identity, latest positions, position history, and raw
-- evidence references.
-- Status: Additive, non-destructive. No raw data or live-source data.
-- Created: 2026-06-09

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS maritime_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id TEXT NOT NULL DEFAULT 'layer_06_maritime',
  source_id TEXT NOT NULL,
  source_family TEXT NOT NULL DEFAULT 'ais',
  source_type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  coverage TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  config_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT maritime_sources_source_id_unique
    UNIQUE (source_id),
  CONSTRAINT maritime_sources_layer_id_check
    CHECK (layer_id = 'layer_06_maritime'),
  CONSTRAINT maritime_sources_source_id_not_empty_check
    CHECK (btrim(source_id) <> ''),
  CONSTRAINT maritime_sources_source_family_not_empty_check
    CHECK (btrim(source_family) <> ''),
  CONSTRAINT maritime_sources_source_type_not_empty_check
    CHECK (btrim(source_type) <> ''),
  CONSTRAINT maritime_sources_display_name_not_empty_check
    CHECK (btrim(display_name) <> '')
);

CREATE TABLE IF NOT EXISTS maritime_fetch_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id TEXT NOT NULL DEFAULT 'layer_06_maritime',
  source_id TEXT NOT NULL,
  source_family TEXT NOT NULL DEFAULT 'ais',
  run_id TEXT NOT NULL,
  run_mode TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds DOUBLE PRECISION,
  total_messages INTEGER NOT NULL DEFAULT 0,
  position_messages INTEGER NOT NULL DEFAULT 0,
  static_messages INTEGER NOT NULL DEFAULT 0,
  other_messages INTEGER NOT NULL DEFAULT 0,
  unique_mmsi_count INTEGER NOT NULL DEFAULT 0,
  errors_json JSONB NOT NULL DEFAULT '[]'::JSONB,
  raw_path TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT maritime_fetch_runs_source_id_fk
    FOREIGN KEY (source_id) REFERENCES maritime_sources(source_id),
  CONSTRAINT maritime_fetch_runs_run_id_unique
    UNIQUE (source_id, run_id),
  CONSTRAINT maritime_fetch_runs_layer_id_check
    CHECK (layer_id = 'layer_06_maritime'),
  CONSTRAINT maritime_fetch_runs_source_id_not_empty_check
    CHECK (btrim(source_id) <> ''),
  CONSTRAINT maritime_fetch_runs_run_id_not_empty_check
    CHECK (btrim(run_id) <> ''),
  CONSTRAINT maritime_fetch_runs_run_mode_check
    CHECK (run_mode IN ('proof', 'raw_capture', 'continuous', 'normalize_from_cache')),
  CONSTRAINT maritime_fetch_runs_status_check
    CHECK (status IN ('running', 'completed', 'failed')),
  CONSTRAINT maritime_fetch_runs_duration_seconds_check
    CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  CONSTRAINT maritime_fetch_runs_ended_after_started_check
    CHECK (ended_at IS NULL OR ended_at >= started_at),
  CONSTRAINT maritime_fetch_runs_total_messages_check
    CHECK (total_messages >= 0),
  CONSTRAINT maritime_fetch_runs_position_messages_check
    CHECK (position_messages >= 0),
  CONSTRAINT maritime_fetch_runs_static_messages_check
    CHECK (static_messages >= 0),
  CONSTRAINT maritime_fetch_runs_other_messages_check
    CHECK (other_messages >= 0),
  CONSTRAINT maritime_fetch_runs_unique_mmsi_count_check
    CHECK (unique_mmsi_count >= 0)
);

CREATE TABLE IF NOT EXISTS maritime_vessels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id TEXT NOT NULL DEFAULT 'layer_06_maritime',
  source_id TEXT NOT NULL,
  source_family TEXT NOT NULL DEFAULT 'ais',
  source_object_id TEXT NOT NULL,
  mmsi BIGINT NOT NULL,
  dedupe_key TEXT NOT NULL,

  imo BIGINT,
  callsign TEXT,
  vessel_name TEXT,
  vessel_type_code INTEGER,
  vessel_type TEXT,
  destination TEXT,
  eta_month INTEGER,
  eta_day INTEGER,
  eta_hour INTEGER,
  eta_minute INTEGER,
  eta_display TEXT,
  draught_meters DOUBLE PRECISION,
  dimension_a DOUBLE PRECISION,
  dimension_b DOUBLE PRECISION,
  dimension_c DOUBLE PRECISION,
  dimension_d DOUBLE PRECISION,
  length_meters DOUBLE PRECISION,
  width_meters DOUBLE PRECISION,

  last_position_at TIMESTAMPTZ,
  last_received_at TIMESTAMPTZ,
  raw_evidence_uri TEXT,
  provider_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT maritime_vessels_source_id_fk
    FOREIGN KEY (source_id) REFERENCES maritime_sources(source_id),
  CONSTRAINT maritime_vessels_source_mmsi_unique
    UNIQUE (source_id, mmsi),
  CONSTRAINT maritime_vessels_dedupe_key_unique
    UNIQUE (dedupe_key),
  CONSTRAINT maritime_vessels_layer_id_check
    CHECK (layer_id = 'layer_06_maritime'),
  CONSTRAINT maritime_vessels_source_object_id_mmsi_check
    CHECK (source_object_id = mmsi::TEXT),
  CONSTRAINT maritime_vessels_dedupe_key_check
    CHECK (dedupe_key = source_id || ':' || mmsi::TEXT),
  CONSTRAINT maritime_vessels_mmsi_check
    CHECK (mmsi > 0),
  CONSTRAINT maritime_vessels_imo_check
    CHECK (imo IS NULL OR imo > 0),
  CONSTRAINT maritime_vessels_eta_month_check
    CHECK (eta_month IS NULL OR (eta_month >= 1 AND eta_month <= 12)),
  CONSTRAINT maritime_vessels_eta_day_check
    CHECK (eta_day IS NULL OR (eta_day >= 1 AND eta_day <= 31)),
  CONSTRAINT maritime_vessels_eta_hour_check
    CHECK (eta_hour IS NULL OR (eta_hour >= 0 AND eta_hour <= 23)),
  CONSTRAINT maritime_vessels_eta_minute_check
    CHECK (eta_minute IS NULL OR (eta_minute >= 0 AND eta_minute <= 59)),
  CONSTRAINT maritime_vessels_draught_meters_check
    CHECK (draught_meters IS NULL OR draught_meters >= 0),
  CONSTRAINT maritime_vessels_dimensions_check
    CHECK (
      (dimension_a IS NULL OR dimension_a >= 0)
      AND (dimension_b IS NULL OR dimension_b >= 0)
      AND (dimension_c IS NULL OR dimension_c >= 0)
      AND (dimension_d IS NULL OR dimension_d >= 0)
      AND (length_meters IS NULL OR length_meters >= 0)
      AND (width_meters IS NULL OR width_meters >= 0)
    ),
  CONSTRAINT maritime_vessels_last_received_after_position_check
    CHECK (last_position_at IS NULL OR last_received_at IS NULL OR last_received_at >= last_position_at)
);

CREATE TABLE IF NOT EXISTS maritime_positions_latest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id TEXT NOT NULL DEFAULT 'layer_06_maritime',
  source_id TEXT NOT NULL,
  source_family TEXT NOT NULL DEFAULT 'ais',
  source_object_id TEXT NOT NULL,
  mmsi BIGINT NOT NULL,
  dedupe_key TEXT NOT NULL,

  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  geom GEOMETRY(Point, 4326),
  speed_over_ground DOUBLE PRECISION,
  course_over_ground DOUBLE PRECISION,
  true_heading INTEGER,
  navigation_status INTEGER,
  navigation_status_text TEXT,
  position_accuracy BOOLEAN,
  ais_timestamp_second INTEGER,
  metadata_time_utc TEXT,
  received_at TIMESTAMPTZ NOT NULL,
  raw_evidence_uri TEXT NOT NULL,
  provider_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT maritime_positions_latest_source_id_fk
    FOREIGN KEY (source_id) REFERENCES maritime_sources(source_id),
  CONSTRAINT maritime_positions_latest_source_mmsi_unique
    UNIQUE (source_id, mmsi),
  CONSTRAINT maritime_positions_latest_dedupe_key_unique
    UNIQUE (dedupe_key),
  CONSTRAINT maritime_positions_latest_layer_id_check
    CHECK (layer_id = 'layer_06_maritime'),
  CONSTRAINT maritime_positions_latest_source_object_id_mmsi_check
    CHECK (source_object_id = mmsi::TEXT),
  CONSTRAINT maritime_positions_latest_dedupe_key_check
    CHECK (dedupe_key = source_id || ':' || mmsi::TEXT),
  CONSTRAINT maritime_positions_latest_mmsi_check
    CHECK (mmsi > 0),
  CONSTRAINT maritime_positions_latest_latitude_check
    CHECK (latitude >= -90 AND latitude <= 90),
  CONSTRAINT maritime_positions_latest_longitude_check
    CHECK (longitude >= -180 AND longitude <= 180),
  CONSTRAINT maritime_positions_latest_geom_srid_check
    CHECK (geom IS NULL OR ST_SRID(geom) = 4326),
  CONSTRAINT maritime_positions_latest_geom_not_empty_check
    CHECK (geom IS NULL OR NOT ST_IsEmpty(geom)),
  CONSTRAINT maritime_positions_latest_speed_over_ground_check
    CHECK (speed_over_ground IS NULL OR speed_over_ground >= 0),
  CONSTRAINT maritime_positions_latest_course_over_ground_check
    CHECK (course_over_ground IS NULL OR (course_over_ground >= 0 AND course_over_ground <= 360)),
  CONSTRAINT maritime_positions_latest_true_heading_check
    CHECK (true_heading IS NULL OR (true_heading >= 0 AND true_heading <= 359)),
  CONSTRAINT maritime_positions_latest_navigation_status_check
    CHECK (navigation_status IS NULL OR (navigation_status >= 0 AND navigation_status <= 15)),
  CONSTRAINT maritime_positions_latest_ais_timestamp_second_check
    CHECK (ais_timestamp_second IS NULL OR (ais_timestamp_second >= 0 AND ais_timestamp_second <= 60)),
  CONSTRAINT maritime_positions_latest_raw_evidence_uri_not_empty_check
    CHECK (btrim(raw_evidence_uri) <> '')
);

CREATE TABLE IF NOT EXISTS maritime_position_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id TEXT NOT NULL DEFAULT 'layer_06_maritime',
  source_id TEXT NOT NULL,
  source_family TEXT NOT NULL DEFAULT 'ais',
  source_object_id TEXT NOT NULL,
  mmsi BIGINT NOT NULL,

  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  geom GEOMETRY(Point, 4326),
  speed_over_ground DOUBLE PRECISION,
  course_over_ground DOUBLE PRECISION,
  true_heading INTEGER,
  navigation_status INTEGER,
  ais_timestamp_second INTEGER,
  metadata_time_utc TEXT,
  received_at TIMESTAMPTZ NOT NULL,
  raw_evidence_uri TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT maritime_position_history_source_id_fk
    FOREIGN KEY (source_id) REFERENCES maritime_sources(source_id),
  CONSTRAINT maritime_position_history_layer_id_check
    CHECK (layer_id = 'layer_06_maritime'),
  CONSTRAINT maritime_position_history_source_object_id_mmsi_check
    CHECK (source_object_id = mmsi::TEXT),
  CONSTRAINT maritime_position_history_mmsi_check
    CHECK (mmsi > 0),
  CONSTRAINT maritime_position_history_latitude_check
    CHECK (latitude >= -90 AND latitude <= 90),
  CONSTRAINT maritime_position_history_longitude_check
    CHECK (longitude >= -180 AND longitude <= 180),
  CONSTRAINT maritime_position_history_geom_srid_check
    CHECK (geom IS NULL OR ST_SRID(geom) = 4326),
  CONSTRAINT maritime_position_history_geom_not_empty_check
    CHECK (geom IS NULL OR NOT ST_IsEmpty(geom)),
  CONSTRAINT maritime_position_history_speed_over_ground_check
    CHECK (speed_over_ground IS NULL OR speed_over_ground >= 0),
  CONSTRAINT maritime_position_history_course_over_ground_check
    CHECK (course_over_ground IS NULL OR (course_over_ground >= 0 AND course_over_ground <= 360)),
  CONSTRAINT maritime_position_history_true_heading_check
    CHECK (true_heading IS NULL OR (true_heading >= 0 AND true_heading <= 359)),
  CONSTRAINT maritime_position_history_navigation_status_check
    CHECK (navigation_status IS NULL OR (navigation_status >= 0 AND navigation_status <= 15)),
  CONSTRAINT maritime_position_history_ais_timestamp_second_check
    CHECK (ais_timestamp_second IS NULL OR (ais_timestamp_second >= 0 AND ais_timestamp_second <= 60)),
  CONSTRAINT maritime_position_history_raw_evidence_uri_not_empty_check
    CHECK (btrim(raw_evidence_uri) <> '')
);

CREATE TABLE IF NOT EXISTS maritime_raw_message_refs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id TEXT NOT NULL DEFAULT 'layer_06_maritime',
  source_id TEXT NOT NULL,
  source_family TEXT NOT NULL DEFAULT 'ais',
  fetch_run_id UUID REFERENCES maritime_fetch_runs(id),
  source_object_id TEXT,
  mmsi BIGINT,
  message_type TEXT NOT NULL,
  raw_evidence_uri TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  provider_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT maritime_raw_message_refs_source_id_fk
    FOREIGN KEY (source_id) REFERENCES maritime_sources(source_id),
  CONSTRAINT maritime_raw_message_refs_layer_id_check
    CHECK (layer_id = 'layer_06_maritime'),
  CONSTRAINT maritime_raw_message_refs_source_object_id_mmsi_check
    CHECK (source_object_id IS NULL OR mmsi IS NULL OR source_object_id = mmsi::TEXT),
  CONSTRAINT maritime_raw_message_refs_mmsi_check
    CHECK (mmsi IS NULL OR mmsi > 0),
  CONSTRAINT maritime_raw_message_refs_message_type_not_empty_check
    CHECK (btrim(message_type) <> ''),
  CONSTRAINT maritime_raw_message_refs_raw_evidence_uri_not_empty_check
    CHECK (btrim(raw_evidence_uri) <> '')
);

CREATE OR REPLACE FUNCTION maritime_set_position_geom()
RETURNS TRIGGER AS $$
BEGIN
  NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_maritime_positions_latest_set_geom ON maritime_positions_latest;
CREATE TRIGGER trg_maritime_positions_latest_set_geom
BEFORE INSERT OR UPDATE OF latitude, longitude
ON maritime_positions_latest
FOR EACH ROW
EXECUTE FUNCTION maritime_set_position_geom();

DROP TRIGGER IF EXISTS trg_maritime_position_history_set_geom ON maritime_position_history;
CREATE TRIGGER trg_maritime_position_history_set_geom
BEFORE INSERT OR UPDATE OF latitude, longitude
ON maritime_position_history
FOR EACH ROW
EXECUTE FUNCTION maritime_set_position_geom();

CREATE INDEX IF NOT EXISTS idx_maritime_sources_layer_source
  ON maritime_sources(layer_id, source_id);

CREATE INDEX IF NOT EXISTS idx_maritime_sources_active
  ON maritime_sources(is_active)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_maritime_fetch_runs_layer_source
  ON maritime_fetch_runs(layer_id, source_id);

CREATE INDEX IF NOT EXISTS idx_maritime_fetch_runs_started_at
  ON maritime_fetch_runs(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_maritime_fetch_runs_status
  ON maritime_fetch_runs(status);

CREATE INDEX IF NOT EXISTS idx_maritime_vessels_layer_source
  ON maritime_vessels(layer_id, source_id);

CREATE INDEX IF NOT EXISTS idx_maritime_vessels_source_object
  ON maritime_vessels(source_id, source_object_id);

CREATE INDEX IF NOT EXISTS idx_maritime_vessels_mmsi
  ON maritime_vessels(mmsi);

CREATE INDEX IF NOT EXISTS idx_maritime_vessels_vessel_type
  ON maritime_vessels(vessel_type);

CREATE INDEX IF NOT EXISTS idx_maritime_vessels_last_received_at
  ON maritime_vessels(last_received_at DESC);

CREATE INDEX IF NOT EXISTS idx_maritime_positions_latest_layer_source
  ON maritime_positions_latest(layer_id, source_id);

CREATE INDEX IF NOT EXISTS idx_maritime_positions_latest_source_object
  ON maritime_positions_latest(source_id, source_object_id);

CREATE INDEX IF NOT EXISTS idx_maritime_positions_latest_mmsi
  ON maritime_positions_latest(mmsi);

CREATE INDEX IF NOT EXISTS idx_maritime_positions_latest_received_at
  ON maritime_positions_latest(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_maritime_positions_latest_geom_gist
  ON maritime_positions_latest USING GiST(geom);

CREATE INDEX IF NOT EXISTS idx_maritime_positions_latest_bbox
  ON maritime_positions_latest(longitude, latitude);

CREATE INDEX IF NOT EXISTS idx_maritime_position_history_layer_source
  ON maritime_position_history(layer_id, source_id);

CREATE INDEX IF NOT EXISTS idx_maritime_position_history_source_object_time
  ON maritime_position_history(source_id, source_object_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_maritime_position_history_mmsi
  ON maritime_position_history(mmsi);

CREATE INDEX IF NOT EXISTS idx_maritime_position_history_received_at
  ON maritime_position_history(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_maritime_position_history_geom_gist
  ON maritime_position_history USING GiST(geom);

CREATE INDEX IF NOT EXISTS idx_maritime_raw_message_refs_layer_source
  ON maritime_raw_message_refs(layer_id, source_id);

CREATE INDEX IF NOT EXISTS idx_maritime_raw_message_refs_run
  ON maritime_raw_message_refs(fetch_run_id);

CREATE INDEX IF NOT EXISTS idx_maritime_raw_message_refs_mmsi
  ON maritime_raw_message_refs(mmsi);

CREATE INDEX IF NOT EXISTS idx_maritime_raw_message_refs_message_type
  ON maritime_raw_message_refs(message_type);

CREATE INDEX IF NOT EXISTS idx_maritime_raw_message_refs_received_at
  ON maritime_raw_message_refs(received_at DESC);
