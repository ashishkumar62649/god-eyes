CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS aviation_coordinate_quality_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id TEXT NOT NULL DEFAULT 'layer_01_aviation',
  object_type TEXT NOT NULL DEFAULT 'airport',
  source_id TEXT NOT NULL,
  source_object_id TEXT NOT NULL,
  airport_ident TEXT,
  quality_status TEXT NOT NULL,
  precision_estimate_meters NUMERIC,
  notes TEXT,
  evidence_url TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT aviation_coordinate_quality_reviews_layer_check
    CHECK (layer_id = 'layer_01_aviation'),
  CONSTRAINT aviation_coordinate_quality_reviews_object_type_check
    CHECK (object_type = 'airport'),
  CONSTRAINT aviation_coordinate_quality_reviews_status_check
    CHECK (
      quality_status IN (
        'unreviewed',
        'visually_verified',
        'approximate',
        'suspected_offset',
        'source_error',
        'closed_or_obsolete'
      )
    ),
  CONSTRAINT aviation_coordinate_quality_reviews_precision_check
    CHECK (precision_estimate_meters IS NULL OR precision_estimate_meters >= 0)
);

CREATE INDEX IF NOT EXISTS idx_aviation_coordinate_quality_reviews_source
  ON aviation_coordinate_quality_reviews(source_id, source_object_id);

CREATE INDEX IF NOT EXISTS idx_aviation_coordinate_quality_reviews_airport_ident
  ON aviation_coordinate_quality_reviews(airport_ident)
  WHERE airport_ident IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aviation_coordinate_quality_reviews_status
  ON aviation_coordinate_quality_reviews(quality_status);

CREATE TABLE IF NOT EXISTS aviation_coordinate_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id TEXT NOT NULL DEFAULT 'layer_01_aviation',
  object_type TEXT NOT NULL DEFAULT 'airport',
  source_id TEXT NOT NULL,
  source_object_id TEXT NOT NULL,
  airport_ident TEXT,
  original_latitude NUMERIC NOT NULL,
  original_longitude NUMERIC NOT NULL,
  override_latitude NUMERIC NOT NULL,
  override_longitude NUMERIC NOT NULL,
  override_reason TEXT NOT NULL,
  confidence_score NUMERIC,
  evidence_url TEXT,
  reviewed_by TEXT,
  approved_by TEXT,
  active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT aviation_coordinate_overrides_layer_check
    CHECK (layer_id = 'layer_01_aviation'),
  CONSTRAINT aviation_coordinate_overrides_object_type_check
    CHECK (object_type = 'airport'),
  CONSTRAINT aviation_coordinate_overrides_original_latitude_check
    CHECK (original_latitude >= -90 AND original_latitude <= 90),
  CONSTRAINT aviation_coordinate_overrides_original_longitude_check
    CHECK (original_longitude >= -180 AND original_longitude <= 180),
  CONSTRAINT aviation_coordinate_overrides_override_latitude_check
    CHECK (override_latitude >= -90 AND override_latitude <= 90),
  CONSTRAINT aviation_coordinate_overrides_override_longitude_check
    CHECK (override_longitude >= -180 AND override_longitude <= 180),
  CONSTRAINT aviation_coordinate_overrides_confidence_score_check
    CHECK (
      confidence_score IS NULL
      OR (confidence_score >= 0 AND confidence_score <= 1)
    ),
  CONSTRAINT aviation_coordinate_overrides_reason_not_blank_check
    CHECK (btrim(override_reason) <> '')
);

CREATE INDEX IF NOT EXISTS idx_aviation_coordinate_overrides_source
  ON aviation_coordinate_overrides(source_id, source_object_id);

CREATE INDEX IF NOT EXISTS idx_aviation_coordinate_overrides_airport_ident
  ON aviation_coordinate_overrides(airport_ident)
  WHERE airport_ident IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aviation_coordinate_overrides_active
  ON aviation_coordinate_overrides(active);

CREATE UNIQUE INDEX IF NOT EXISTS idx_aviation_coordinate_overrides_one_active_per_source
  ON aviation_coordinate_overrides(source_id, source_object_id)
  WHERE active;
