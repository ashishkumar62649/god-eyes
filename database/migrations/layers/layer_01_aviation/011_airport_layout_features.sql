-- WO-054-DB-AIRPORT-LAYOUT-FEATURES: Airport Infrastructure Layout Database Foundation
-- Layer: layer_01_aviation
-- Purpose: Store source-backed airport infrastructure/layout geometry for later API and frontend overlays.
-- Status: Additive, non-destructive. No mutations to existing aviation,
-- public-profile, intelligence, capacity, traffic, derived intelligence, or image asset tables.
-- Created: 2026-05-23

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS airport_layout_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airport_id UUID NOT NULL REFERENCES aviation_airports(id) ON DELETE CASCADE,
  layer_id TEXT NOT NULL DEFAULT 'layer_01_aviation',
  feature_type TEXT NOT NULL,
  feature_subtype TEXT,
  feature_name TEXT,
  source_type TEXT NOT NULL,
  source_name TEXT,
  source_url TEXT,
  source_object_id TEXT,
  source_entity_id TEXT,
  geometry geometry(Geometry, 4326) NOT NULL,
  geometry_type TEXT NOT NULL,
  centroid geometry(Point, 4326),
  bbox geometry(Polygon, 4326),
  confidence_label TEXT NOT NULL DEFAULT 'unknown',
  confidence_score NUMERIC(4,3),
  rank INTEGER NOT NULL DEFAULT 100,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_checked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  content_hash TEXT,
  raw_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  diagnostics JSONB NOT NULL DEFAULT '{}'::JSONB,
  CONSTRAINT airport_layout_features_layer_id_check
    CHECK (layer_id = 'layer_01_aviation'),
  CONSTRAINT airport_layout_features_feature_type_check
    CHECK (feature_type IN ('runway', 'taxiway', 'apron', 'terminal', 'gate', 'stand', 'tower', 'helipad', 'boundary', 'service_road', 'parking', 'hangar', 'fuel', 'navigation_aid', 'unknown')),
  CONSTRAINT airport_layout_features_source_type_check
    CHECK (source_type IN ('ourairports', 'openstreetmap', 'wikidata', 'official_site', 'manual', 'derived', 'other')),
  CONSTRAINT airport_layout_features_geometry_type_check
    CHECK (geometry_type IN ('point', 'line', 'polygon', 'multipoint', 'multilinestring', 'multipolygon', 'geometry')),
  CONSTRAINT airport_layout_features_confidence_label_check
    CHECK (confidence_label IN ('high', 'medium', 'low', 'unknown')),
  CONSTRAINT airport_layout_features_confidence_score_check
    CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
  CONSTRAINT airport_layout_features_rank_check
    CHECK (rank >= 0),
  CONSTRAINT airport_layout_features_expires_after_fetched_check
    CHECK (expires_at IS NULL OR expires_at > fetched_at),
  CONSTRAINT airport_layout_features_last_checked_after_fetched_check
    CHECK (last_checked_at IS NULL OR last_checked_at >= fetched_at),
  CONSTRAINT airport_layout_features_geometry_srid_check
    CHECK (ST_SRID(geometry) = 4326),
  CONSTRAINT airport_layout_features_geometry_not_empty_check
    CHECK (NOT ST_IsEmpty(geometry)),
  CONSTRAINT airport_layout_features_centroid_srid_check
    CHECK (centroid IS NULL OR ST_SRID(centroid) = 4326),
  CONSTRAINT airport_layout_features_bbox_srid_check
    CHECK (bbox IS NULL OR ST_SRID(bbox) = 4326),
  CONSTRAINT airport_layout_features_source_object_id_not_empty_check
    CHECK (source_object_id IS NULL OR btrim(source_object_id) <> ''),
  CONSTRAINT airport_layout_features_content_hash_not_empty_check
    CHECK (content_hash IS NULL OR btrim(content_hash) <> '')
);

CREATE TABLE IF NOT EXISTS airport_layout_fetch_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airport_id UUID REFERENCES aviation_airports(id) ON DELETE CASCADE,
  layer_id TEXT NOT NULL DEFAULT 'layer_01_aviation',
  source_type TEXT NOT NULL,
  run_status TEXT NOT NULL DEFAULT 'queued',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  features_found INTEGER NOT NULL DEFAULT 0,
  features_written INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  diagnostics JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT airport_layout_fetch_runs_layer_id_check
    CHECK (layer_id = 'layer_01_aviation'),
  CONSTRAINT airport_layout_fetch_runs_source_type_check
    CHECK (source_type IN ('ourairports', 'openstreetmap', 'wikidata', 'official_site', 'manual', 'derived', 'other')),
  CONSTRAINT airport_layout_fetch_runs_status_check
    CHECK (run_status IN ('queued', 'running', 'success', 'partial', 'failed', 'skipped')),
  CONSTRAINT airport_layout_fetch_runs_finished_requires_started_check
    CHECK (finished_at IS NULL OR started_at IS NOT NULL),
  CONSTRAINT airport_layout_fetch_runs_finished_after_started_check
    CHECK (finished_at IS NULL OR finished_at >= started_at),
  CONSTRAINT airport_layout_fetch_runs_features_found_check
    CHECK (features_found >= 0),
  CONSTRAINT airport_layout_fetch_runs_features_written_check
    CHECK (features_written >= 0)
);

CREATE INDEX IF NOT EXISTS idx_airport_layout_features_airport_id
  ON airport_layout_features(airport_id);

CREATE INDEX IF NOT EXISTS idx_airport_layout_features_airport_feature_type
  ON airport_layout_features(airport_id, feature_type);

CREATE INDEX IF NOT EXISTS idx_airport_layout_features_airport_source_type
  ON airport_layout_features(airport_id, source_type);

CREATE INDEX IF NOT EXISTS idx_airport_layout_features_airport_is_active
  ON airport_layout_features(airport_id, is_active);

CREATE INDEX IF NOT EXISTS idx_airport_layout_features_airport_rank
  ON airport_layout_features(airport_id, rank);

CREATE INDEX IF NOT EXISTS idx_airport_layout_features_feature_type
  ON airport_layout_features(feature_type);

CREATE INDEX IF NOT EXISTS idx_airport_layout_features_source_type
  ON airport_layout_features(source_type);

CREATE INDEX IF NOT EXISTS idx_airport_layout_features_confidence_label
  ON airport_layout_features(confidence_label);

CREATE INDEX IF NOT EXISTS idx_airport_layout_features_fetched_at
  ON airport_layout_features(fetched_at);

CREATE INDEX IF NOT EXISTS idx_airport_layout_features_expires_at
  ON airport_layout_features(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_layout_features_content_hash
  ON airport_layout_features(content_hash) WHERE content_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_layout_features_source_object_id
  ON airport_layout_features(source_object_id) WHERE source_object_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_layout_features_geometry_gist
  ON airport_layout_features USING GiST(geometry);

CREATE INDEX IF NOT EXISTS idx_airport_layout_features_centroid_gist
  ON airport_layout_features USING GiST(centroid);

CREATE INDEX IF NOT EXISTS idx_airport_layout_features_bbox_gist
  ON airport_layout_features USING GiST(bbox);

CREATE INDEX IF NOT EXISTS idx_airport_layout_features_raw_metadata_gin
  ON airport_layout_features USING GIN(raw_metadata);

CREATE INDEX IF NOT EXISTS idx_airport_layout_features_diagnostics_gin
  ON airport_layout_features USING GIN(diagnostics);

CREATE UNIQUE INDEX IF NOT EXISTS idx_airport_layout_features_source_object_dedupe
  ON airport_layout_features(airport_id, source_type, source_object_id)
  WHERE source_object_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_airport_layout_features_content_hash_dedupe
  ON airport_layout_features(airport_id, feature_type, content_hash)
  WHERE content_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_layout_fetch_runs_airport_id
  ON airport_layout_fetch_runs(airport_id);

CREATE INDEX IF NOT EXISTS idx_airport_layout_fetch_runs_source_type
  ON airport_layout_fetch_runs(source_type);

CREATE INDEX IF NOT EXISTS idx_airport_layout_fetch_runs_run_status
  ON airport_layout_fetch_runs(run_status);

CREATE INDEX IF NOT EXISTS idx_airport_layout_fetch_runs_created_at
  ON airport_layout_fetch_runs(created_at);

CREATE INDEX IF NOT EXISTS idx_airport_layout_fetch_runs_started_at
  ON airport_layout_fetch_runs(started_at) WHERE started_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_layout_fetch_runs_finished_at
  ON airport_layout_fetch_runs(finished_at) WHERE finished_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_layout_fetch_runs_diagnostics_gin
  ON airport_layout_fetch_runs USING GIN(diagnostics);
