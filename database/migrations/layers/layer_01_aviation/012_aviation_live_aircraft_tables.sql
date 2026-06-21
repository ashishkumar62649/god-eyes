-- WO-079B-AVIATION-LIVE-DATABASE-MIGRATIONS: Live aircraft time-series schema
-- Layer: layer_01_aviation
-- Purpose: Add source registry, latest aircraft state, observation history,
-- and raw batch evidence tables for Aviation live aircraft tracking.
-- Status: Additive, non-destructive. No fetcher, API, frontend, or raw data.
-- Created: 2026-05-28

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS aviation_aircraft_sources (
  source_id TEXT PRIMARY KEY,
  layer_id TEXT NOT NULL DEFAULT 'layer_01_aviation',
  display_name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  license_type TEXT NOT NULL,
  license_caveat TEXT,
  rate_limit_per_sec INTEGER NOT NULL DEFAULT 1,
  refresh_interval_s INTEGER NOT NULL DEFAULT 5,
  is_live BOOLEAN NOT NULL DEFAULT TRUE,
  is_historical BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT aviation_aircraft_sources_layer_id_check
    CHECK (layer_id = 'layer_01_aviation'),
  CONSTRAINT aviation_aircraft_sources_rate_limit_check
    CHECK (rate_limit_per_sec > 0),
  CONSTRAINT aviation_aircraft_sources_refresh_interval_check
    CHECK (refresh_interval_s > 0),
  CONSTRAINT aviation_aircraft_sources_source_id_not_empty_check
    CHECK (btrim(source_id) <> ''),
  CONSTRAINT aviation_aircraft_sources_display_name_not_empty_check
    CHECK (btrim(display_name) <> '')
);

CREATE TABLE IF NOT EXISTS aviation_aircraft_latest (
  id BIGSERIAL PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES aviation_aircraft_sources(source_id),
  source_object_id TEXT NOT NULL,
  layer_id TEXT NOT NULL DEFAULT 'layer_01_aviation',

  callsign TEXT,
  registration TEXT,
  aircraft_type TEXT,

  db_flags INTEGER,
  is_military BOOLEAN NOT NULL DEFAULT FALSE,
  is_interesting BOOLEAN NOT NULL DEFAULT FALSE,
  is_pia BOOLEAN NOT NULL DEFAULT FALSE,
  is_ladd BOOLEAN NOT NULL DEFAULT FALSE,

  source_message_type TEXT,

  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  geom GEOGRAPHY(Point, 4326),

  altitude_baro_ft DOUBLE PRECISION,
  altitude_geom_ft DOUBLE PRECISION,
  on_ground BOOLEAN,

  ground_speed_kt DOUBLE PRECISION,
  track_deg DOUBLE PRECISION,
  heading_mag_deg DOUBLE PRECISION,
  heading_true_deg DOUBLE PRECISION,
  vertical_rate_fpm DOUBLE PRECISION,
  geom_rate_fpm DOUBLE PRECISION,

  squawk TEXT,
  emergency TEXT,

  seen_seconds DOUBLE PRECISION,
  seen_pos_seconds DOUBLE PRECISION,
  observed_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stale_after TIMESTAMPTZ,

  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  raw_json JSONB,

  CONSTRAINT aviation_aircraft_latest_source_object_unique
    UNIQUE (source_id, source_object_id),
  CONSTRAINT aviation_aircraft_latest_layer_id_check
    CHECK (layer_id = 'layer_01_aviation'),
  CONSTRAINT aviation_aircraft_latest_source_object_id_not_empty_check
    CHECK (btrim(source_object_id) <> ''),
  CONSTRAINT aviation_aircraft_latest_latitude_check
    CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90)),
  CONSTRAINT aviation_aircraft_latest_longitude_check
    CHECK (lon IS NULL OR (lon >= -180 AND lon <= 180)),
  CONSTRAINT aviation_aircraft_latest_geom_requires_position_check
    CHECK (geom IS NULL OR (lat IS NOT NULL AND lon IS NOT NULL)),
  CONSTRAINT aviation_aircraft_latest_seen_seconds_check
    CHECK (seen_seconds IS NULL OR seen_seconds >= 0),
  CONSTRAINT aviation_aircraft_latest_seen_pos_seconds_check
    CHECK (seen_pos_seconds IS NULL OR seen_pos_seconds >= 0),
  CONSTRAINT aviation_aircraft_latest_stale_after_observed_check
    CHECK (stale_after IS NULL OR stale_after >= observed_at),
  CONSTRAINT aviation_aircraft_latest_last_seen_after_first_seen_check
    CHECK (last_seen_at >= first_seen_at)
);

CREATE TABLE IF NOT EXISTS aviation_aircraft_observations (
  id BIGSERIAL PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES aviation_aircraft_sources(source_id),
  source_object_id TEXT NOT NULL,
  layer_id TEXT NOT NULL DEFAULT 'layer_01_aviation',

  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  geom GEOGRAPHY(Point, 4326),

  altitude_baro_ft DOUBLE PRECISION,
  altitude_geom_ft DOUBLE PRECISION,
  on_ground BOOLEAN,
  ground_speed_kt DOUBLE PRECISION,
  track_deg DOUBLE PRECISION,
  vertical_rate_fpm DOUBLE PRECISION,

  callsign TEXT,
  squawk TEXT,
  emergency TEXT,
  is_military BOOLEAN,
  is_pia BOOLEAN,
  is_ladd BOOLEAN,

  observed_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT aviation_aircraft_observations_source_object_observed_unique
    UNIQUE (source_id, source_object_id, observed_at),
  CONSTRAINT aviation_aircraft_observations_layer_id_check
    CHECK (layer_id = 'layer_01_aviation'),
  CONSTRAINT aviation_aircraft_observations_source_object_id_not_empty_check
    CHECK (btrim(source_object_id) <> ''),
  CONSTRAINT aviation_aircraft_observations_latitude_check
    CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90)),
  CONSTRAINT aviation_aircraft_observations_longitude_check
    CHECK (lon IS NULL OR (lon >= -180 AND lon <= 180)),
  CONSTRAINT aviation_aircraft_observations_geom_requires_position_check
    CHECK (geom IS NULL OR (lat IS NOT NULL AND lon IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS aviation_aircraft_raw_batches (
  id BIGSERIAL PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES aviation_aircraft_sources(source_id),
  layer_id TEXT NOT NULL DEFAULT 'layer_01_aviation',
  endpoint TEXT NOT NULL,
  fetch_params JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  http_status INTEGER,
  aircraft_count INTEGER,
  source_now_ts DOUBLE PRECISION,
  source_ctime_ts DOUBLE PRECISION,
  source_ptime_ms DOUBLE PRECISION,
  raw_sample JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT aviation_aircraft_raw_batches_layer_id_check
    CHECK (layer_id = 'layer_01_aviation'),
  CONSTRAINT aviation_aircraft_raw_batches_endpoint_not_empty_check
    CHECK (btrim(endpoint) <> ''),
  CONSTRAINT aviation_aircraft_raw_batches_aircraft_count_check
    CHECK (aircraft_count IS NULL OR aircraft_count >= 0),
  CONSTRAINT aviation_aircraft_raw_batches_http_status_check
    CHECK (http_status IS NULL OR (http_status >= 100 AND http_status <= 599))
);

INSERT INTO aviation_aircraft_sources (
  source_id,
  layer_id,
  display_name,
  base_url,
  license_type,
  license_caveat,
  rate_limit_per_sec,
  refresh_interval_s,
  is_live,
  is_historical,
  is_active,
  notes
)
VALUES
  (
    'airplanes_live_v2',
    'layer_01_aviation',
    'Airplanes.live REST API v2',
    'http://api.airplanes.live/v2/',
    'non_commercial',
    'Airplanes.live is non-commercial public ADS-B/MLAT data with no SLA and no uptime guarantee. There is no global civil aircraft endpoint; civil aircraft are limited to the camera region via /point while military/LADD/PIA endpoints are global. Not authoritative aviation data.',
    1,
    5,
    TRUE,
    FALSE,
    TRUE,
    'Current-build live source. Fetch /mil, /ladd, /pia, and one /point camera-region request per 5-second cycle; do not tile the globe.'
  ),
  (
    'opensky_trino',
    'layer_01_aviation',
    'OpenSky Network Trino',
    'https://opensky-network.org/',
    'research_restricted',
    'OpenSky Network Trino is historical/future-only for GOD EYES and requires application approval. Access is intended for university-affiliated researchers, governmental organisations, aviation authorities, or separately licensed private/commercial entities. Not used for current-build live tracking.',
    1,
    86400,
    FALSE,
    TRUE,
    FALSE,
    'Future historical backfill source for state_vectors_data4 after access approval; not a live current-build dependency.'
  )
ON CONFLICT (source_id) DO UPDATE SET
  layer_id = EXCLUDED.layer_id,
  display_name = EXCLUDED.display_name,
  base_url = EXCLUDED.base_url,
  license_type = EXCLUDED.license_type,
  license_caveat = EXCLUDED.license_caveat,
  rate_limit_per_sec = EXCLUDED.rate_limit_per_sec,
  refresh_interval_s = EXCLUDED.refresh_interval_s,
  is_live = EXCLUDED.is_live,
  is_historical = EXCLUDED.is_historical,
  is_active = EXCLUDED.is_active,
  notes = EXCLUDED.notes,
  updated_at = NOW();

CREATE INDEX IF NOT EXISTS idx_aviation_aircraft_sources_layer_id
  ON aviation_aircraft_sources(layer_id);

CREATE INDEX IF NOT EXISTS idx_aviation_aircraft_sources_active
  ON aviation_aircraft_sources(is_active);

CREATE INDEX IF NOT EXISTS idx_aviation_aircraft_latest_source_object
  ON aviation_aircraft_latest(source_id, source_object_id);

CREATE INDEX IF NOT EXISTS idx_aviation_aircraft_latest_observed_at
  ON aviation_aircraft_latest(observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_aviation_aircraft_latest_stale_after
  ON aviation_aircraft_latest(stale_after);

CREATE INDEX IF NOT EXISTS idx_aviation_aircraft_latest_geom_gist
  ON aviation_aircraft_latest USING GiST(geom);

CREATE INDEX IF NOT EXISTS idx_aviation_aircraft_latest_is_military
  ON aviation_aircraft_latest(is_military)
  WHERE is_military = TRUE;

CREATE INDEX IF NOT EXISTS idx_aviation_aircraft_latest_is_interesting
  ON aviation_aircraft_latest(is_interesting)
  WHERE is_interesting = TRUE;

CREATE INDEX IF NOT EXISTS idx_aviation_aircraft_latest_is_pia
  ON aviation_aircraft_latest(is_pia)
  WHERE is_pia = TRUE;

CREATE INDEX IF NOT EXISTS idx_aviation_aircraft_latest_is_ladd
  ON aviation_aircraft_latest(is_ladd)
  WHERE is_ladd = TRUE;

CREATE INDEX IF NOT EXISTS idx_aviation_aircraft_observations_source_object_time
  ON aviation_aircraft_observations(source_id, source_object_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_aviation_aircraft_observations_observed_at
  ON aviation_aircraft_observations(observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_aviation_aircraft_observations_geom_gist
  ON aviation_aircraft_observations USING GiST(geom);

CREATE INDEX IF NOT EXISTS idx_aviation_aircraft_observations_is_military
  ON aviation_aircraft_observations(is_military)
  WHERE is_military = TRUE;

CREATE INDEX IF NOT EXISTS idx_aviation_aircraft_observations_is_pia
  ON aviation_aircraft_observations(is_pia)
  WHERE is_pia = TRUE;

CREATE INDEX IF NOT EXISTS idx_aviation_aircraft_observations_is_ladd
  ON aviation_aircraft_observations(is_ladd)
  WHERE is_ladd = TRUE;

CREATE INDEX IF NOT EXISTS idx_aviation_aircraft_raw_batches_fetched_at
  ON aviation_aircraft_raw_batches(fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_aviation_aircraft_raw_batches_source_fetched
  ON aviation_aircraft_raw_batches(source_id, fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_aviation_aircraft_raw_batches_endpoint
  ON aviation_aircraft_raw_batches(endpoint);

CREATE INDEX IF NOT EXISTS idx_aviation_aircraft_raw_batches_http_status
  ON aviation_aircraft_raw_batches(http_status)
  WHERE http_status IS NOT NULL;
