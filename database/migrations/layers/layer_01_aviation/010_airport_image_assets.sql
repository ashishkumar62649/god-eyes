-- WO-050-DB-AIRPORT-IMAGE-ASSETS: Airport Image Gallery Database Foundation
-- Layer: layer_01_aviation
-- Purpose: Store multiple source-backed airport image assets for later API and frontend gallery use.
-- Status: Additive, non-destructive. No mutations to existing aviation,
-- public-profile, intelligence, capacity, traffic, or derived intelligence tables.
-- Created: 2026-05-21

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS airport_image_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airport_id UUID NOT NULL REFERENCES aviation_airports(id) ON DELETE CASCADE,
  layer_id TEXT NOT NULL DEFAULT 'layer_01_aviation',
  source_id TEXT,
  source_object_id TEXT,
  source_type TEXT NOT NULL,
  source_name TEXT,
  source_url TEXT,
  source_file_title TEXT,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  original_url TEXT,
  caption TEXT,
  description TEXT,
  attribution_text TEXT,
  license_name TEXT,
  license_url TEXT,
  width_px INTEGER,
  height_px INTEGER,
  media_type TEXT,
  image_kind TEXT NOT NULL DEFAULT 'unknown',
  is_hero BOOLEAN NOT NULL DEFAULT FALSE,
  rank INTEGER NOT NULL DEFAULT 100,
  confidence_label TEXT NOT NULL DEFAULT 'unknown',
  confidence_score NUMERIC(4,3),
  content_hash TEXT,
  source_entity_id TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_checked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  diagnostics JSONB NOT NULL DEFAULT '{}'::JSONB,
  CONSTRAINT airport_image_assets_airport_image_url_key UNIQUE(airport_id, image_url),
  CONSTRAINT airport_image_assets_layer_id_check
    CHECK (layer_id = 'layer_01_aviation'),
  CONSTRAINT airport_image_assets_source_type_check
    CHECK (source_type IN ('wikimedia_commons', 'wikipedia', 'wikidata', 'official_site', 'manual', 'other')),
  CONSTRAINT airport_image_assets_image_kind_check
    CHECK (image_kind IN ('photo', 'logo', 'map', 'terminal', 'runway', 'aerial', 'tower', 'interior', 'unknown')),
  CONSTRAINT airport_image_assets_confidence_label_check
    CHECK (confidence_label IN ('high', 'medium', 'low', 'unknown')),
  CONSTRAINT airport_image_assets_image_url_not_empty_check
    CHECK (btrim(image_url) <> ''),
  CONSTRAINT airport_image_assets_rank_check
    CHECK (rank >= 0),
  CONSTRAINT airport_image_assets_width_px_check
    CHECK (width_px IS NULL OR width_px > 0),
  CONSTRAINT airport_image_assets_height_px_check
    CHECK (height_px IS NULL OR height_px > 0),
  CONSTRAINT airport_image_assets_confidence_score_check
    CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
  CONSTRAINT airport_image_assets_expires_after_fetched_check
    CHECK (expires_at IS NULL OR expires_at > fetched_at),
  CONSTRAINT airport_image_assets_last_checked_after_fetched_check
    CHECK (last_checked_at IS NULL OR last_checked_at >= fetched_at)
);

CREATE INDEX IF NOT EXISTS idx_airport_image_assets_airport_id
  ON airport_image_assets(airport_id);

CREATE INDEX IF NOT EXISTS idx_airport_image_assets_airport_rank
  ON airport_image_assets(airport_id, rank);

CREATE INDEX IF NOT EXISTS idx_airport_image_assets_airport_is_hero
  ON airport_image_assets(airport_id, is_hero);

CREATE INDEX IF NOT EXISTS idx_airport_image_assets_airport_image_kind
  ON airport_image_assets(airport_id, image_kind);

CREATE INDEX IF NOT EXISTS idx_airport_image_assets_source_type
  ON airport_image_assets(source_type);

CREATE INDEX IF NOT EXISTS idx_airport_image_assets_confidence_label
  ON airport_image_assets(confidence_label);

CREATE INDEX IF NOT EXISTS idx_airport_image_assets_fetched_at
  ON airport_image_assets(fetched_at);

CREATE INDEX IF NOT EXISTS idx_airport_image_assets_expires_at
  ON airport_image_assets(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_image_assets_content_hash
  ON airport_image_assets(content_hash) WHERE content_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_image_assets_source_entity_id
  ON airport_image_assets(source_entity_id) WHERE source_entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_image_assets_source_object_id
  ON airport_image_assets(source_object_id) WHERE source_object_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_image_assets_raw_metadata_gin
  ON airport_image_assets USING GIN(raw_metadata);

CREATE INDEX IF NOT EXISTS idx_airport_image_assets_diagnostics_gin
  ON airport_image_assets USING GIN(diagnostics);

CREATE UNIQUE INDEX IF NOT EXISTS idx_airport_image_assets_single_hero
  ON airport_image_assets(airport_id)
  WHERE is_hero = TRUE;
