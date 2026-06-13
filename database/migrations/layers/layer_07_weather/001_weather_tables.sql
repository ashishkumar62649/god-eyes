-- WO-WEATHER-D
-- Layer: layer_07_weather
-- Purpose: Database foundation for Open-Meteo source metadata, fetch runs,
-- requested/resolved locations, latest observations, observation history,
-- and raw evidence references.
-- Status: Additive, non-destructive. No ingestion or raw payload storage.
-- Created: 2026-06-10

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS weather_sources (
  source_id TEXT PRIMARY KEY,
  layer_id TEXT NOT NULL DEFAULT 'layer_07_weather',
  source_name TEXT NOT NULL,
  source_url TEXT,
  licence TEXT,
  attribution TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT weather_sources_layer_id_check
    CHECK (layer_id = 'layer_07_weather'),
  CONSTRAINT weather_sources_source_id_not_empty_check
    CHECK (btrim(source_id) <> ''),
  CONSTRAINT weather_sources_source_name_not_empty_check
    CHECK (btrim(source_name) <> '')
);

CREATE TABLE IF NOT EXISTS weather_fetch_runs (
  fetch_run_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  layer_id TEXT NOT NULL DEFAULT 'layer_07_weather',
  grid_resolution TEXT NOT NULL,
  total_cells INTEGER NOT NULL,
  successful_cells INTEGER NOT NULL DEFAULT 0,
  failed_cells INTEGER NOT NULL DEFAULT 0,
  fetch_started_at TIMESTAMPTZ NOT NULL,
  fetch_completed_at TIMESTAMPTZ,
  api_calls_made INTEGER NOT NULL DEFAULT 0,
  raw_storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT weather_fetch_runs_source_id_fk
    FOREIGN KEY (source_id) REFERENCES weather_sources(source_id),
  CONSTRAINT weather_fetch_runs_layer_id_check
    CHECK (layer_id = 'layer_07_weather'),
  CONSTRAINT weather_fetch_runs_grid_resolution_not_empty_check
    CHECK (btrim(grid_resolution) <> ''),
  CONSTRAINT weather_fetch_runs_total_cells_check
    CHECK (total_cells >= 0),
  CONSTRAINT weather_fetch_runs_successful_cells_check
    CHECK (successful_cells >= 0),
  CONSTRAINT weather_fetch_runs_failed_cells_check
    CHECK (failed_cells >= 0),
  CONSTRAINT weather_fetch_runs_cell_counts_check
    CHECK (successful_cells + failed_cells <= total_cells),
  CONSTRAINT weather_fetch_runs_api_calls_made_check
    CHECK (api_calls_made >= 0),
  CONSTRAINT weather_fetch_runs_status_check
    CHECK (status IN ('running', 'completed', 'failed', 'partial')),
  CONSTRAINT weather_fetch_runs_completed_after_started_check
    CHECK (fetch_completed_at IS NULL OR fetch_completed_at >= fetch_started_at)
);

CREATE TABLE IF NOT EXISTS weather_locations (
  location_id TEXT PRIMARY KEY,
  layer_id TEXT NOT NULL DEFAULT 'layer_07_weather',
  requested_latitude DOUBLE PRECISION NOT NULL,
  requested_longitude DOUBLE PRECISION NOT NULL,
  resolved_latitude DOUBLE PRECISION NOT NULL,
  resolved_longitude DOUBLE PRECISION NOT NULL,
  elevation_m DOUBLE PRECISION,
  grid_resolution TEXT NOT NULL,
  cell_note TEXT,
  geom GEOMETRY(Point, 4326) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT weather_locations_layer_id_check
    CHECK (layer_id = 'layer_07_weather'),
  CONSTRAINT weather_locations_location_id_not_empty_check
    CHECK (btrim(location_id) <> ''),
  CONSTRAINT weather_locations_requested_latitude_check
    CHECK (requested_latitude >= -90 AND requested_latitude <= 90),
  CONSTRAINT weather_locations_requested_longitude_check
    CHECK (requested_longitude >= -180 AND requested_longitude < 180),
  CONSTRAINT weather_locations_resolved_latitude_check
    CHECK (resolved_latitude >= -90 AND resolved_latitude <= 90),
  CONSTRAINT weather_locations_resolved_longitude_check
    CHECK (resolved_longitude >= -180 AND resolved_longitude <= 180),
  CONSTRAINT weather_locations_grid_resolution_not_empty_check
    CHECK (btrim(grid_resolution) <> ''),
  CONSTRAINT weather_locations_geom_srid_check
    CHECK (ST_SRID(geom) = 4326),
  CONSTRAINT weather_locations_geom_not_empty_check
    CHECK (NOT ST_IsEmpty(geom))
);

CREATE TABLE IF NOT EXISTS weather_observations_latest (
  observation_id TEXT PRIMARY KEY,
  layer_id TEXT NOT NULL DEFAULT 'layer_07_weather',
  source_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  observation_type TEXT NOT NULL,
  temperature_c DOUBLE PRECISION NOT NULL,
  apparent_temperature_c DOUBLE PRECISION,
  wind_speed_kph DOUBLE PRECISION,
  wind_direction_deg DOUBLE PRECISION,
  wind_gust_kph DOUBLE PRECISION,
  humidity_percent INTEGER,
  pressure_hpa DOUBLE PRECISION,
  precipitation_mm DOUBLE PRECISION,
  precipitation_probability_percent INTEGER,
  cloud_cover_percent INTEGER,
  weather_code INTEGER,
  weather_label TEXT,
  forecast_for TIMESTAMPTZ NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  is_stale BOOLEAN NOT NULL DEFAULT FALSE,
  provider_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  raw_evidence_uri TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT weather_observations_latest_source_id_fk
    FOREIGN KEY (source_id) REFERENCES weather_sources(source_id),
  CONSTRAINT weather_observations_latest_location_id_fk
    FOREIGN KEY (location_id) REFERENCES weather_locations(location_id),
  CONSTRAINT weather_observations_latest_layer_id_check
    CHECK (layer_id = 'layer_07_weather'),
  CONSTRAINT weather_observations_latest_observation_type_check
    CHECK (observation_type IN ('current', 'hourly')),
  CONSTRAINT weather_observations_latest_humidity_percent_check
    CHECK (humidity_percent IS NULL OR (humidity_percent >= 0 AND humidity_percent <= 100)),
  CONSTRAINT weather_observations_latest_precipitation_probability_check
    CHECK (
      precipitation_probability_percent IS NULL
      OR (precipitation_probability_percent >= 0 AND precipitation_probability_percent <= 100)
    ),
  CONSTRAINT weather_observations_latest_cloud_cover_percent_check
    CHECK (cloud_cover_percent IS NULL OR (cloud_cover_percent >= 0 AND cloud_cover_percent <= 100)),
  CONSTRAINT weather_observations_latest_wind_direction_deg_check
    CHECK (wind_direction_deg IS NULL OR (wind_direction_deg >= 0 AND wind_direction_deg <= 360))
);

CREATE TABLE IF NOT EXISTS weather_observation_history (
  history_id TEXT PRIMARY KEY,
  observation_id TEXT NOT NULL,
  layer_id TEXT NOT NULL DEFAULT 'layer_07_weather',
  source_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  observation_type TEXT NOT NULL,
  temperature_c DOUBLE PRECISION NOT NULL,
  apparent_temperature_c DOUBLE PRECISION,
  wind_speed_kph DOUBLE PRECISION,
  wind_direction_deg DOUBLE PRECISION,
  wind_gust_kph DOUBLE PRECISION,
  humidity_percent INTEGER,
  pressure_hpa DOUBLE PRECISION,
  precipitation_mm DOUBLE PRECISION,
  precipitation_probability_percent INTEGER,
  cloud_cover_percent INTEGER,
  weather_code INTEGER,
  weather_label TEXT,
  forecast_for TIMESTAMPTZ NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  provider_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  raw_evidence_uri TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT weather_observation_history_source_id_fk
    FOREIGN KEY (source_id) REFERENCES weather_sources(source_id),
  CONSTRAINT weather_observation_history_location_id_fk
    FOREIGN KEY (location_id) REFERENCES weather_locations(location_id),
  CONSTRAINT weather_observation_history_layer_id_check
    CHECK (layer_id = 'layer_07_weather'),
  CONSTRAINT weather_observation_history_observation_type_check
    CHECK (observation_type IN ('current', 'hourly')),
  CONSTRAINT weather_observation_history_humidity_percent_check
    CHECK (humidity_percent IS NULL OR (humidity_percent >= 0 AND humidity_percent <= 100)),
  CONSTRAINT weather_observation_history_precipitation_probability_check
    CHECK (
      precipitation_probability_percent IS NULL
      OR (precipitation_probability_percent >= 0 AND precipitation_probability_percent <= 100)
    ),
  CONSTRAINT weather_observation_history_cloud_cover_percent_check
    CHECK (cloud_cover_percent IS NULL OR (cloud_cover_percent >= 0 AND cloud_cover_percent <= 100)),
  CONSTRAINT weather_observation_history_wind_direction_deg_check
    CHECK (wind_direction_deg IS NULL OR (wind_direction_deg >= 0 AND wind_direction_deg <= 360))
);

CREATE TABLE IF NOT EXISTS weather_raw_message_refs (
  raw_ref_id TEXT PRIMARY KEY,
  fetch_run_id TEXT,
  source_id TEXT NOT NULL,
  layer_id TEXT NOT NULL DEFAULT 'layer_07_weather',
  raw_evidence_uri TEXT NOT NULL,
  batch_index INTEGER,
  coordinate_count INTEGER,
  response_status INTEGER,
  response_headers JSONB NOT NULL DEFAULT '{}'::JSONB,
  request_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  observed_fields JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT weather_raw_message_refs_fetch_run_id_fk
    FOREIGN KEY (fetch_run_id) REFERENCES weather_fetch_runs(fetch_run_id),
  CONSTRAINT weather_raw_message_refs_source_id_fk
    FOREIGN KEY (source_id) REFERENCES weather_sources(source_id),
  CONSTRAINT weather_raw_message_refs_layer_id_check
    CHECK (layer_id = 'layer_07_weather'),
  CONSTRAINT weather_raw_message_refs_raw_evidence_uri_not_empty_check
    CHECK (btrim(raw_evidence_uri) <> ''),
  CONSTRAINT weather_raw_message_refs_batch_index_check
    CHECK (batch_index IS NULL OR batch_index >= 0),
  CONSTRAINT weather_raw_message_refs_coordinate_count_check
    CHECK (coordinate_count IS NULL OR coordinate_count >= 0),
  CONSTRAINT weather_raw_message_refs_response_status_check
    CHECK (response_status IS NULL OR (response_status >= 100 AND response_status <= 599))
);

CREATE OR REPLACE FUNCTION weather_set_location_geom()
RETURNS TRIGGER AS $$
BEGIN
  NEW.geom := ST_SetSRID(
    ST_MakePoint(NEW.resolved_longitude, NEW.resolved_latitude),
    4326
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_weather_locations_set_geom ON weather_locations;
CREATE TRIGGER trg_weather_locations_set_geom
BEFORE INSERT OR UPDATE OF resolved_latitude, resolved_longitude
ON weather_locations
FOR EACH ROW
EXECUTE FUNCTION weather_set_location_geom();

CREATE INDEX IF NOT EXISTS idx_weather_sources_active
  ON weather_sources(is_active)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_weather_fetch_runs_source_id
  ON weather_fetch_runs(source_id);

CREATE INDEX IF NOT EXISTS idx_weather_fetch_runs_started_at
  ON weather_fetch_runs(fetch_started_at DESC);

CREATE INDEX IF NOT EXISTS idx_weather_fetch_runs_status
  ON weather_fetch_runs(status);

CREATE INDEX IF NOT EXISTS idx_weather_locations_requested_coords
  ON weather_locations(requested_latitude, requested_longitude);

CREATE INDEX IF NOT EXISTS idx_weather_locations_resolved_coords
  ON weather_locations(resolved_latitude, resolved_longitude);

CREATE INDEX IF NOT EXISTS idx_weather_locations_geom_gist
  ON weather_locations USING GiST(geom);

CREATE UNIQUE INDEX IF NOT EXISTS idx_weather_latest_location_source_type_time
  ON weather_observations_latest(location_id, source_id, observation_type, forecast_for);

CREATE INDEX IF NOT EXISTS idx_weather_latest_location_id
  ON weather_observations_latest(location_id);

CREATE INDEX IF NOT EXISTS idx_weather_latest_source_id
  ON weather_observations_latest(source_id);

CREATE INDEX IF NOT EXISTS idx_weather_latest_observation_type
  ON weather_observations_latest(observation_type);

CREATE INDEX IF NOT EXISTS idx_weather_latest_forecast_for
  ON weather_observations_latest(forecast_for DESC);

CREATE INDEX IF NOT EXISTS idx_weather_latest_fetched_at
  ON weather_observations_latest(fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_weather_latest_not_stale
  ON weather_observations_latest(is_stale)
  WHERE is_stale = FALSE;

CREATE INDEX IF NOT EXISTS idx_weather_latest_temperature_c
  ON weather_observations_latest(temperature_c);

CREATE INDEX IF NOT EXISTS idx_weather_latest_weather_code
  ON weather_observations_latest(weather_code);

CREATE INDEX IF NOT EXISTS idx_weather_latest_provider_metadata_gin
  ON weather_observations_latest USING GIN(provider_metadata);

CREATE INDEX IF NOT EXISTS idx_weather_history_observation_id
  ON weather_observation_history(observation_id);

CREATE INDEX IF NOT EXISTS idx_weather_history_location_id
  ON weather_observation_history(location_id);

CREATE INDEX IF NOT EXISTS idx_weather_history_source_id
  ON weather_observation_history(source_id);

CREATE INDEX IF NOT EXISTS idx_weather_history_observation_type
  ON weather_observation_history(observation_type);

CREATE INDEX IF NOT EXISTS idx_weather_history_forecast_for
  ON weather_observation_history(forecast_for DESC);

CREATE INDEX IF NOT EXISTS idx_weather_history_fetched_at
  ON weather_observation_history(fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_weather_history_temperature_c
  ON weather_observation_history(temperature_c);

CREATE INDEX IF NOT EXISTS idx_weather_history_weather_code
  ON weather_observation_history(weather_code);

CREATE INDEX IF NOT EXISTS idx_weather_history_provider_metadata_gin
  ON weather_observation_history USING GIN(provider_metadata);

CREATE INDEX IF NOT EXISTS idx_weather_raw_refs_fetch_run_id
  ON weather_raw_message_refs(fetch_run_id);

CREATE INDEX IF NOT EXISTS idx_weather_raw_refs_source_id
  ON weather_raw_message_refs(source_id);

CREATE INDEX IF NOT EXISTS idx_weather_raw_refs_batch_index
  ON weather_raw_message_refs(batch_index);

CREATE INDEX IF NOT EXISTS idx_weather_raw_refs_raw_evidence_uri
  ON weather_raw_message_refs(raw_evidence_uri);

CREATE INDEX IF NOT EXISTS idx_weather_raw_refs_request_metadata_gin
  ON weather_raw_message_refs USING GIN(request_metadata);

CREATE INDEX IF NOT EXISTS idx_weather_raw_refs_observed_fields_gin
  ON weather_raw_message_refs USING GIN(observed_fields);

INSERT INTO weather_sources (
  source_id,
  layer_id,
  source_name,
  source_url,
  licence,
  attribution,
  is_active
)
VALUES (
  'open-meteo',
  'layer_07_weather',
  'Open-Meteo',
  'https://open-meteo.com/',
  'CC-BY 4.0',
  'Weather data provided by Open-Meteo under CC-BY 4.0 licence.',
  TRUE
)
ON CONFLICT (source_id) DO UPDATE SET
  layer_id = EXCLUDED.layer_id,
  source_name = EXCLUDED.source_name,
  source_url = EXCLUDED.source_url,
  licence = EXCLUDED.licence,
  attribution = EXCLUDED.attribution,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
