-- WO-NEWS-D1
-- Layer: layer_08_news_osint
-- Purpose: Source-flexible storage for news and event sources, fetch runs,
-- latest normalized items, history snapshots, and raw evidence references.
-- Status: Additive, non-destructive. No ingestion or raw payload storage.
-- Created: 2026-06-11

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS news_sources (
  source_id TEXT PRIMARY KEY,
  layer_id TEXT NOT NULL DEFAULT 'layer_08_news_osint',
  source_family TEXT NOT NULL,
  display_name TEXT NOT NULL,
  endpoint_url TEXT NOT NULL,
  auth_type TEXT NOT NULL DEFAULT 'none',
  auth_env_var TEXT,
  attribution TEXT NOT NULL,
  license TEXT,
  update_frequency_minutes INTEGER,
  rate_limit_requests_per_day INTEGER,
  rate_limit_requests_per_minute INTEGER,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_fetched_at TIMESTAMPTZ,
  last_error TEXT,
  provider_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT news_sources_layer_id_check
    CHECK (layer_id = 'layer_08_news_osint'),
  CONSTRAINT news_sources_source_id_not_empty_check
    CHECK (btrim(source_id) <> ''),
  CONSTRAINT news_sources_source_family_not_empty_check
    CHECK (btrim(source_family) <> ''),
  CONSTRAINT news_sources_display_name_not_empty_check
    CHECK (btrim(display_name) <> ''),
  CONSTRAINT news_sources_endpoint_url_not_empty_check
    CHECK (btrim(endpoint_url) <> ''),
  CONSTRAINT news_sources_auth_type_not_empty_check
    CHECK (btrim(auth_type) <> ''),
  CONSTRAINT news_sources_attribution_not_empty_check
    CHECK (btrim(attribution) <> ''),
  CONSTRAINT news_sources_update_frequency_check
    CHECK (update_frequency_minutes IS NULL OR update_frequency_minutes > 0),
  CONSTRAINT news_sources_daily_rate_limit_check
    CHECK (rate_limit_requests_per_day IS NULL OR rate_limit_requests_per_day > 0),
  CONSTRAINT news_sources_minute_rate_limit_check
    CHECK (rate_limit_requests_per_minute IS NULL OR rate_limit_requests_per_minute > 0)
);

CREATE TABLE IF NOT EXISTS news_fetch_runs (
  fetch_run_id TEXT PRIMARY KEY,
  layer_id TEXT NOT NULL DEFAULT 'layer_08_news_osint',
  source_id TEXT NOT NULL,
  source_family TEXT NOT NULL,
  run_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  fetched_item_count INTEGER NOT NULL DEFAULT 0,
  normalized_item_count INTEGER NOT NULL DEFAULT 0,
  marker_ready_count INTEGER NOT NULL DEFAULT 0,
  skipped_item_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  raw_output_uri TEXT,
  normalized_output_uri TEXT,
  provider_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT news_fetch_runs_source_id_fk
    FOREIGN KEY (source_id) REFERENCES news_sources(source_id),
  CONSTRAINT news_fetch_runs_layer_id_check
    CHECK (layer_id = 'layer_08_news_osint'),
  CONSTRAINT news_fetch_runs_source_family_not_empty_check
    CHECK (btrim(source_family) <> ''),
  CONSTRAINT news_fetch_runs_run_type_not_empty_check
    CHECK (btrim(run_type) <> ''),
  CONSTRAINT news_fetch_runs_status_check
    CHECK (status IN ('running', 'success', 'partial', 'failed')),
  CONSTRAINT news_fetch_runs_completed_after_started_check
    CHECK (completed_at IS NULL OR completed_at >= started_at),
  CONSTRAINT news_fetch_runs_fetched_count_check
    CHECK (fetched_item_count >= 0),
  CONSTRAINT news_fetch_runs_normalized_count_check
    CHECK (normalized_item_count >= 0),
  CONSTRAINT news_fetch_runs_marker_ready_count_check
    CHECK (marker_ready_count >= 0),
  CONSTRAINT news_fetch_runs_skipped_count_check
    CHECK (skipped_item_count >= 0),
  CONSTRAINT news_fetch_runs_normalized_not_over_fetched_check
    CHECK (normalized_item_count <= fetched_item_count),
  CONSTRAINT news_fetch_runs_marker_ready_not_over_normalized_check
    CHECK (marker_ready_count <= normalized_item_count),
  CONSTRAINT news_fetch_runs_skipped_not_over_fetched_check
    CHECK (skipped_item_count <= fetched_item_count)
);

CREATE TABLE IF NOT EXISTS news_items_latest (
  item_id TEXT PRIMARY KEY,
  layer_id TEXT NOT NULL DEFAULT 'layer_08_news_osint',
  source_id TEXT NOT NULL,
  source_family TEXT NOT NULL,
  source_object_id TEXT,
  dedupe_key TEXT NOT NULL,
  source_url TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  content_type TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  source_updated_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  location_confidence TEXT NOT NULL,
  country_code TEXT,
  country_name TEXT,
  region TEXT,
  city TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  geom GEOMETRY(Point, 4326),
  geometry_type TEXT,
  geo_source TEXT,
  has_coordinates BOOLEAN NOT NULL DEFAULT FALSE,
  marker_ready BOOLEAN NOT NULL DEFAULT FALSE,
  category TEXT NOT NULL,
  subcategory TEXT,
  severity TEXT NOT NULL DEFAULT 'unknown',
  source_domain TEXT,
  source_language TEXT,
  source_country TEXT,
  confidence_score DOUBLE PRECISION,
  duplicate_of TEXT,
  raw_evidence_uri TEXT,
  attribution TEXT NOT NULL,
  provider_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT news_items_latest_source_id_fk
    FOREIGN KEY (source_id) REFERENCES news_sources(source_id),
  CONSTRAINT news_items_latest_layer_id_check
    CHECK (layer_id = 'layer_08_news_osint'),
  CONSTRAINT news_items_latest_item_id_not_empty_check
    CHECK (btrim(item_id) <> ''),
  CONSTRAINT news_items_latest_source_family_not_empty_check
    CHECK (btrim(source_family) <> ''),
  CONSTRAINT news_items_latest_dedupe_key_not_empty_check
    CHECK (btrim(dedupe_key) <> ''),
  CONSTRAINT news_items_latest_title_not_empty_check
    CHECK (btrim(title) <> ''),
  CONSTRAINT news_items_latest_content_type_not_empty_check
    CHECK (btrim(content_type) <> ''),
  CONSTRAINT news_items_latest_location_confidence_not_empty_check
    CHECK (btrim(location_confidence) <> ''),
  CONSTRAINT news_items_latest_category_not_empty_check
    CHECK (btrim(category) <> ''),
  CONSTRAINT news_items_latest_severity_not_empty_check
    CHECK (btrim(severity) <> ''),
  CONSTRAINT news_items_latest_attribution_not_empty_check
    CHECK (btrim(attribution) <> ''),
  CONSTRAINT news_items_latest_seen_order_check
    CHECK (last_seen_at >= first_seen_at),
  CONSTRAINT news_items_latest_latitude_check
    CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  CONSTRAINT news_items_latest_longitude_check
    CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
  CONSTRAINT news_items_latest_coordinate_pair_check
    CHECK ((latitude IS NULL) = (longitude IS NULL)),
  CONSTRAINT news_items_latest_has_coordinates_check
    CHECK (has_coordinates = (latitude IS NOT NULL AND longitude IS NOT NULL)),
  CONSTRAINT news_items_latest_marker_ready_check
    CHECK (NOT marker_ready OR (has_coordinates AND geometry_type = 'Point' AND geom IS NOT NULL)),
  CONSTRAINT news_items_latest_marker_geometry_only_check
    CHECK (marker_ready OR geom IS NULL),
  CONSTRAINT news_items_latest_geom_srid_check
    CHECK (geom IS NULL OR ST_SRID(geom) = 4326),
  CONSTRAINT news_items_latest_geom_not_empty_check
    CHECK (geom IS NULL OR NOT ST_IsEmpty(geom)),
  CONSTRAINT news_items_latest_geom_coordinates_check
    CHECK (
      geom IS NULL
      OR (ST_Y(geom) = latitude AND ST_X(geom) = longitude)
    ),
  CONSTRAINT news_items_latest_confidence_score_check
    CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1))
);

CREATE TABLE IF NOT EXISTS news_item_history (
  history_id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  layer_id TEXT NOT NULL DEFAULT 'layer_08_news_osint',
  source_id TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  changed_fields TEXT[],
  fetch_run_id TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT news_item_history_item_id_fk
    FOREIGN KEY (item_id) REFERENCES news_items_latest(item_id),
  CONSTRAINT news_item_history_source_id_fk
    FOREIGN KEY (source_id) REFERENCES news_sources(source_id),
  CONSTRAINT news_item_history_fetch_run_id_fk
    FOREIGN KEY (fetch_run_id) REFERENCES news_fetch_runs(fetch_run_id),
  CONSTRAINT news_item_history_layer_id_check
    CHECK (layer_id = 'layer_08_news_osint'),
  CONSTRAINT news_item_history_history_id_not_empty_check
    CHECK (btrim(history_id) <> ''),
  CONSTRAINT news_item_history_dedupe_key_not_empty_check
    CHECK (btrim(dedupe_key) <> ''),
  CONSTRAINT news_item_history_version_check
    CHECK (version > 0),
  CONSTRAINT news_item_history_snapshot_object_check
    CHECK (jsonb_typeof(snapshot) = 'object')
);

CREATE TABLE IF NOT EXISTS news_raw_message_refs (
  raw_ref_id TEXT PRIMARY KEY,
  fetch_run_id TEXT,
  layer_id TEXT NOT NULL DEFAULT 'layer_08_news_osint',
  source_id TEXT NOT NULL,
  source_object_id TEXT,
  dedupe_key TEXT,
  raw_evidence_uri TEXT NOT NULL,
  raw_file_offset BIGINT,
  raw_file_line INTEGER,
  provider_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT news_raw_message_refs_fetch_run_id_fk
    FOREIGN KEY (fetch_run_id) REFERENCES news_fetch_runs(fetch_run_id),
  CONSTRAINT news_raw_message_refs_source_id_fk
    FOREIGN KEY (source_id) REFERENCES news_sources(source_id),
  CONSTRAINT news_raw_message_refs_layer_id_check
    CHECK (layer_id = 'layer_08_news_osint'),
  CONSTRAINT news_raw_message_refs_raw_ref_id_not_empty_check
    CHECK (btrim(raw_ref_id) <> ''),
  CONSTRAINT news_raw_message_refs_raw_evidence_uri_not_empty_check
    CHECK (btrim(raw_evidence_uri) <> ''),
  CONSTRAINT news_raw_message_refs_file_offset_check
    CHECK (raw_file_offset IS NULL OR raw_file_offset >= 0),
  CONSTRAINT news_raw_message_refs_file_line_check
    CHECK (raw_file_line IS NULL OR raw_file_line >= 1)
);

CREATE OR REPLACE FUNCTION news_set_marker_geom()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.marker_ready AND NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  ELSE
    NEW.geom := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_news_items_latest_set_marker_geom ON news_items_latest;
CREATE TRIGGER trg_news_items_latest_set_marker_geom
BEFORE INSERT OR UPDATE OF latitude, longitude, marker_ready
ON news_items_latest
FOR EACH ROW
EXECUTE FUNCTION news_set_marker_geom();

CREATE INDEX IF NOT EXISTS idx_news_sources_enabled
  ON news_sources(enabled);

CREATE INDEX IF NOT EXISTS idx_news_fetch_runs_source_id
  ON news_fetch_runs(source_id);

CREATE INDEX IF NOT EXISTS idx_news_fetch_runs_started_at
  ON news_fetch_runs(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_fetch_runs_status
  ON news_fetch_runs(status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_news_items_latest_dedupe_key
  ON news_items_latest(dedupe_key);

CREATE INDEX IF NOT EXISTS idx_news_items_latest_source_id
  ON news_items_latest(source_id);

CREATE INDEX IF NOT EXISTS idx_news_items_latest_published_at
  ON news_items_latest(published_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_items_latest_fetched_at
  ON news_items_latest(fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_items_latest_category
  ON news_items_latest(category);

CREATE INDEX IF NOT EXISTS idx_news_items_latest_subcategory
  ON news_items_latest(subcategory);

CREATE INDEX IF NOT EXISTS idx_news_items_latest_severity
  ON news_items_latest(severity);

CREATE INDEX IF NOT EXISTS idx_news_items_latest_country_code
  ON news_items_latest(country_code);

CREATE INDEX IF NOT EXISTS idx_news_items_latest_marker_ready
  ON news_items_latest(marker_ready);

CREATE INDEX IF NOT EXISTS idx_news_items_latest_marker_published
  ON news_items_latest(marker_ready, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_items_latest_marker_geom_gist
  ON news_items_latest USING GiST(geom)
  WHERE marker_ready = TRUE AND geom IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_news_items_latest_provider_metadata_gin
  ON news_items_latest USING GIN(provider_metadata);

CREATE UNIQUE INDEX IF NOT EXISTS idx_news_item_history_item_version
  ON news_item_history(item_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_news_item_history_dedupe_key
  ON news_item_history(dedupe_key);

CREATE INDEX IF NOT EXISTS idx_news_item_history_source_id
  ON news_item_history(source_id);

CREATE INDEX IF NOT EXISTS idx_news_item_history_recorded_at
  ON news_item_history(recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_raw_refs_fetch_run_id
  ON news_raw_message_refs(fetch_run_id);

CREATE INDEX IF NOT EXISTS idx_news_raw_refs_source_id
  ON news_raw_message_refs(source_id);

CREATE INDEX IF NOT EXISTS idx_news_raw_refs_source_object_id
  ON news_raw_message_refs(source_object_id);

CREATE INDEX IF NOT EXISTS idx_news_raw_refs_dedupe_key
  ON news_raw_message_refs(dedupe_key);

INSERT INTO news_sources (
  source_id,
  layer_id,
  source_family,
  display_name,
  endpoint_url,
  auth_type,
  attribution,
  license,
  enabled
)
VALUES (
  'gdacs',
  'layer_08_news_osint',
  'disaster_alert',
  'Global Disaster Alert and Coordination System',
  'https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP',
  'none',
  'GDACS data is provided under Creative Commons Attribution 4.0 International (CC BY 4.0) license.',
  'CC BY 4.0',
  TRUE
)
ON CONFLICT (source_id) DO UPDATE SET
  layer_id = EXCLUDED.layer_id,
  source_family = EXCLUDED.source_family,
  display_name = EXCLUDED.display_name,
  endpoint_url = EXCLUDED.endpoint_url,
  auth_type = EXCLUDED.auth_type,
  attribution = EXCLUDED.attribution,
  license = EXCLUDED.license,
  enabled = EXCLUDED.enabled,
  updated_at = NOW();
