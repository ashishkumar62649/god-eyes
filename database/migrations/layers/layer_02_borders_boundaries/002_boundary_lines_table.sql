-- WO-078E8: Boundary Lines table for line-based border rendering.
-- Layer: layer_02_borders_boundaries
-- Purpose: Store LineString/MultiLineString boundary geometries from Natural Earth.
-- Status: Additive, non-destructive.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS borders_boundary_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id TEXT NOT NULL DEFAULT 'layer_02_borders_boundaries',
  source_id TEXT NOT NULL,
  source_object_id TEXT NOT NULL,
  line_type TEXT NOT NULL DEFAULT 'land',
  geometry geometry(Geometry, 4326) NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_borders_boundary_lines_layer_id
  ON borders_boundary_lines(layer_id);

CREATE INDEX IF NOT EXISTS idx_borders_boundary_lines_source_id
  ON borders_boundary_lines(source_id);

CREATE INDEX IF NOT EXISTS idx_borders_boundary_lines_geometry_gist
  ON borders_boundary_lines USING GiST(geometry);

CREATE UNIQUE INDEX IF NOT EXISTS idx_borders_boundary_lines_source_object_dedupe
  ON borders_boundary_lines(source_id, source_object_id);
