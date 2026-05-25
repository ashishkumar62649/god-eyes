-- WO-077-BORDERS-BOUNDARIES-DATABASE-SCHEMA
-- Layer: layer_02_borders_boundaries
-- Purpose: Schema-only foundation for future borders and boundaries records.
-- Status: Additive, non-destructive. No source approvals. No boundary rows.
-- Created: 2026-05-26

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

-- Future source metadata is stored here only after human/Kiro compliance review.
-- Default approval flags are deliberately false so this schema cannot imply that
-- any source is approved for India, non-India, or disputed-territory use.
CREATE TABLE IF NOT EXISTS border_boundary_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT UNIQUE NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT,
  license_name TEXT,
  license_url TEXT,
  attribution TEXT,
  approved_for_india BOOLEAN NOT NULL DEFAULT false,
  approved_for_non_india BOOLEAN NOT NULL DEFAULT false,
  india_conflict_checked BOOLEAN NOT NULL DEFAULT false,
  human_approved_by TEXT,
  human_approved_at TIMESTAMPTZ,
  approval_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT border_boundary_sources_source_id_not_empty_check
    CHECK (btrim(source_id) <> ''),
  CONSTRAINT border_boundary_sources_source_name_not_empty_check
    CHECK (btrim(source_name) <> ''),
  CONSTRAINT border_boundary_sources_human_approval_check
    CHECK (
      human_approved_at IS NULL
      OR human_approved_by IS NOT NULL
    )
);

-- Boundary geometry storage remains empty until source licensing, India
-- compliance, and disputed-territory gates are cleared by the required review.
CREATE TABLE IF NOT EXISTS border_boundaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id TEXT NOT NULL DEFAULT 'layer_02_borders_boundaries',
  source_id TEXT NOT NULL REFERENCES border_boundary_sources(source_id),
  source_object_id TEXT,
  boundary_type TEXT NOT NULL,
  boundary_level TEXT,
  country_iso2 TEXT,
  country_iso3 TEXT,
  admin_level INTEGER,
  name TEXT NOT NULL,
  name_local TEXT,
  display_name TEXT,
  disputed BOOLEAN NOT NULL DEFAULT false,
  dispute_status TEXT NOT NULL DEFAULT 'undisputed',
  india_sensitive BOOLEAN NOT NULL DEFAULT false,
  india_compliance_status TEXT NOT NULL DEFAULT 'not_applicable',
  geometry geometry(Geometry, 4326) NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}'::JSONB,
  valid_from DATE,
  valid_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT border_boundaries_layer_id_check
    CHECK (layer_id = 'layer_02_borders_boundaries'),
  CONSTRAINT border_boundaries_source_object_id_not_empty_check
    CHECK (source_object_id IS NULL OR btrim(source_object_id) <> ''),
  CONSTRAINT border_boundaries_boundary_type_check
    CHECK (
      boundary_type IN (
        'country_boundary',
        'admin_boundary',
        'coastline',
        'eez',
        'disputed_boundary',
        'claim_line',
        'line_of_control',
        'other'
      )
    ),
  CONSTRAINT border_boundaries_dispute_status_check
    CHECK (
      dispute_status IN (
        'undisputed',
        'disputed',
        'claimed',
        'occupied',
        'line_of_control',
        'provisional',
        'unknown'
      )
    ),
  CONSTRAINT border_boundaries_india_compliance_status_check
    CHECK (
      india_compliance_status IN (
        'not_applicable',
        'requires_soi_review',
        'soi_approved',
        'blocked'
      )
    ),
  CONSTRAINT border_boundaries_name_not_empty_check
    CHECK (btrim(name) <> ''),
  CONSTRAINT border_boundaries_admin_level_check
    CHECK (admin_level IS NULL OR admin_level >= 0),
  CONSTRAINT border_boundaries_country_iso2_check
    CHECK (country_iso2 IS NULL OR length(country_iso2) = 2),
  CONSTRAINT border_boundaries_country_iso3_check
    CHECK (country_iso3 IS NULL OR length(country_iso3) = 3),
  CONSTRAINT border_boundaries_properties_object_check
    CHECK (jsonb_typeof(properties) = 'object'),
  CONSTRAINT border_boundaries_geometry_srid_check
    CHECK (ST_SRID(geometry) = 4326),
  CONSTRAINT border_boundaries_geometry_not_empty_check
    CHECK (NOT ST_IsEmpty(geometry)),
  CONSTRAINT border_boundaries_valid_date_range_check
    CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from),
  CONSTRAINT border_boundaries_india_status_gate_check
    CHECK (
      india_sensitive = false
      OR india_compliance_status IN (
        'requires_soi_review',
        'soi_approved',
        'blocked'
      )
    )
);

-- Compliance reviews provide future audit trail for source and boundary approval.
-- They do not approve anything by themselves; rows require later human/Kiro work.
CREATE TABLE IF NOT EXISTS border_boundary_compliance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_scope TEXT NOT NULL,
  source_id TEXT REFERENCES border_boundary_sources(source_id),
  boundary_id UUID REFERENCES border_boundaries(id),
  review_status TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  evidence_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT border_boundary_compliance_reviews_scope_check
    CHECK (
      review_scope IN (
        'source_license',
        'india_compliance',
        'non_india_license',
        'disputed_territory',
        'data_quality',
        'other'
      )
    ),
  CONSTRAINT border_boundary_compliance_reviews_status_check
    CHECK (
      review_status IN (
        'pending',
        'pass',
        'fail',
        'blocked'
      )
    ),
  CONSTRAINT border_boundary_compliance_reviews_reviewed_check
    CHECK (
      reviewed_at IS NULL
      OR reviewed_by IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_border_boundary_sources_source_id
  ON border_boundary_sources(source_id);

CREATE INDEX IF NOT EXISTS idx_border_boundaries_geometry_gist
  ON border_boundaries USING GiST(geometry);

CREATE INDEX IF NOT EXISTS idx_border_boundaries_source_id
  ON border_boundaries(source_id);

CREATE INDEX IF NOT EXISTS idx_border_boundaries_boundary_type
  ON border_boundaries(boundary_type);

CREATE INDEX IF NOT EXISTS idx_border_boundaries_country_iso2
  ON border_boundaries(country_iso2);

CREATE INDEX IF NOT EXISTS idx_border_boundaries_country_iso3
  ON border_boundaries(country_iso3);

CREATE INDEX IF NOT EXISTS idx_border_boundaries_disputed
  ON border_boundaries(disputed);

CREATE INDEX IF NOT EXISTS idx_border_boundaries_india_sensitive
  ON border_boundaries(india_sensitive);

CREATE INDEX IF NOT EXISTS idx_border_boundaries_india_compliance_status
  ON border_boundaries(india_compliance_status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_border_boundaries_source_object_dedupe
  ON border_boundaries(source_id, source_object_id)
  WHERE source_object_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_border_boundary_compliance_reviews_source_id
  ON border_boundary_compliance_reviews(source_id);

CREATE INDEX IF NOT EXISTS idx_border_boundary_compliance_reviews_boundary_id
  ON border_boundary_compliance_reviews(boundary_id);

CREATE INDEX IF NOT EXISTS idx_border_boundary_compliance_reviews_review_status
  ON border_boundary_compliance_reviews(review_status);
