-- WO-083B - Layer 10 Energy Infrastructure database schema
-- Layer: layer_10_energy_infrastructure
-- Purpose: Database foundation for public static energy infrastructure features.
-- Status: Additive, non-destructive. No seed data.
-- Created: 2026-06-02

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS energy_infrastructure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id TEXT NOT NULL DEFAULT 'layer_10_energy_infrastructure',
  source_id TEXT NOT NULL,
  source_object_id TEXT NOT NULL,

  feature_type TEXT NOT NULL,
  category TEXT NOT NULL,
  geometry_type TEXT NOT NULL,

  name TEXT,
  operator TEXT,
  owner TEXT,
  country TEXT,
  status TEXT,

  fuel_type TEXT,
  capacity_mw DOUBLE PRECISION,
  voltage_kv DOUBLE PRECISION,

  pipeline_product TEXT,
  pipeline_length_km DOUBLE PRECISION,

  terminal_type TEXT,

  geom geometry(Geometry, 4326) NOT NULL,
  centroid_lat DOUBLE PRECISION NOT NULL,
  centroid_lon DOUBLE PRECISION NOT NULL,
  bbox geometry(Geometry, 4326),

  source_confidence DOUBLE PRECISION,
  source_updated_at TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_source_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT energy_infrastructure_layer_id_check
    CHECK (layer_id = 'layer_10_energy_infrastructure'),
  CONSTRAINT energy_infrastructure_source_object_unique
    UNIQUE (source_id, source_object_id),
  CONSTRAINT energy_infrastructure_source_id_not_empty_check
    CHECK (btrim(source_id) <> ''),
  CONSTRAINT energy_infrastructure_source_object_id_not_empty_check
    CHECK (btrim(source_object_id) <> ''),
  CONSTRAINT energy_infrastructure_source_id_check
    CHECK (source_id IN (
      'wri_global_power_plant_database',
      'osm_energy_infrastructure',
      'global_energy_monitor_energy'
    )),
  CONSTRAINT energy_infrastructure_feature_type_check
    CHECK (feature_type IN (
      'power_plant',
      'substation',
      'transmission_line',
      'oil_pipeline',
      'gas_pipeline',
      'lng_terminal',
      'oil_terminal',
      'gas_terminal',
      'unknown_energy_feature'
    )),
  CONSTRAINT energy_infrastructure_category_check
    CHECK (category IN (
      'nuclear_power',
      'coal_power',
      'gas_power',
      'oil_power',
      'hydro_power',
      'solar_power',
      'wind_power',
      'biomass_power',
      'geothermal_power',
      'other_power',
      'substation',
      'transmission_line',
      'oil_pipeline',
      'gas_pipeline',
      'lng_terminal',
      'oil_terminal',
      'gas_terminal',
      'unknown'
    )),
  CONSTRAINT energy_infrastructure_geometry_type_check
    CHECK (geometry_type IN ('point', 'line', 'polygon')),
  CONSTRAINT energy_infrastructure_geometry_type_matches_geom_check
    CHECK (
      (geometry_type = 'point' AND GeometryType(geom) IN ('POINT', 'MULTIPOINT'))
      OR (geometry_type = 'line' AND GeometryType(geom) IN ('LINESTRING', 'MULTILINESTRING'))
      OR (geometry_type = 'polygon' AND GeometryType(geom) IN ('POLYGON', 'MULTIPOLYGON'))
    ),
  CONSTRAINT energy_infrastructure_status_check
    CHECK (status IS NULL OR status IN (
      'operational',
      'planned',
      'construction',
      'proposed',
      'decommissioned',
      'retired',
      'unknown'
    )),
  CONSTRAINT energy_infrastructure_fuel_type_check
    CHECK (fuel_type IS NULL OR fuel_type IN (
      'nuclear',
      'coal',
      'gas',
      'oil',
      'hydro',
      'solar',
      'wind',
      'biomass',
      'geothermal',
      'other',
      'unknown'
    )),
  CONSTRAINT energy_infrastructure_pipeline_product_check
    CHECK (pipeline_product IS NULL OR pipeline_product IN (
      'crude_oil',
      'refined_products',
      'natural_gas',
      'lng',
      'unknown'
    )),
  CONSTRAINT energy_infrastructure_terminal_type_check
    CHECK (terminal_type IS NULL OR terminal_type IN (
      'import',
      'export',
      'storage',
      'transfer',
      'unknown'
    )),
  CONSTRAINT energy_infrastructure_geom_srid_check
    CHECK (ST_SRID(geom) = 4326),
  CONSTRAINT energy_infrastructure_geom_not_empty_check
    CHECK (NOT ST_IsEmpty(geom)),
  CONSTRAINT energy_infrastructure_bbox_srid_check
    CHECK (bbox IS NULL OR ST_SRID(bbox) = 4326),
  CONSTRAINT energy_infrastructure_bbox_not_empty_check
    CHECK (bbox IS NULL OR NOT ST_IsEmpty(bbox)),
  CONSTRAINT energy_infrastructure_centroid_lat_check
    CHECK (centroid_lat >= -90 AND centroid_lat <= 90),
  CONSTRAINT energy_infrastructure_centroid_lon_check
    CHECK (centroid_lon >= -180 AND centroid_lon <= 180),
  CONSTRAINT energy_infrastructure_source_confidence_check
    CHECK (source_confidence IS NULL OR (source_confidence >= 0 AND source_confidence <= 1)),
  CONSTRAINT energy_infrastructure_capacity_mw_check
    CHECK (capacity_mw IS NULL OR capacity_mw >= 0),
  CONSTRAINT energy_infrastructure_voltage_kv_check
    CHECK (voltage_kv IS NULL OR voltage_kv >= 0),
  CONSTRAINT energy_infrastructure_pipeline_length_km_check
    CHECK (pipeline_length_km IS NULL OR pipeline_length_km >= 0),
  CONSTRAINT energy_infrastructure_last_seen_after_first_seen_check
    CHECK (last_seen_at >= first_seen_at)
);

CREATE INDEX IF NOT EXISTS idx_energy_infrastructure_source_id
  ON energy_infrastructure(source_id);

CREATE INDEX IF NOT EXISTS idx_energy_infrastructure_source_object_id
  ON energy_infrastructure(source_object_id);

CREATE INDEX IF NOT EXISTS idx_energy_infrastructure_feature_type
  ON energy_infrastructure(feature_type);

CREATE INDEX IF NOT EXISTS idx_energy_infrastructure_category
  ON energy_infrastructure(category);

CREATE INDEX IF NOT EXISTS idx_energy_infrastructure_country
  ON energy_infrastructure(country);

CREATE INDEX IF NOT EXISTS idx_energy_infrastructure_status
  ON energy_infrastructure(status);

CREATE INDEX IF NOT EXISTS idx_energy_infrastructure_fuel_type
  ON energy_infrastructure(fuel_type);

CREATE INDEX IF NOT EXISTS idx_energy_infrastructure_capacity_mw
  ON energy_infrastructure(capacity_mw);

CREATE INDEX IF NOT EXISTS idx_energy_infrastructure_voltage_kv
  ON energy_infrastructure(voltage_kv);

CREATE INDEX IF NOT EXISTS idx_energy_infrastructure_pipeline_product
  ON energy_infrastructure(pipeline_product);

CREATE INDEX IF NOT EXISTS idx_energy_infrastructure_terminal_type
  ON energy_infrastructure(terminal_type);

CREATE INDEX IF NOT EXISTS idx_energy_infrastructure_source_updated_at
  ON energy_infrastructure(source_updated_at);

CREATE INDEX IF NOT EXISTS idx_energy_infrastructure_last_seen_at
  ON energy_infrastructure(last_seen_at);

CREATE INDEX IF NOT EXISTS idx_energy_infrastructure_geom_gist
  ON energy_infrastructure USING GiST(geom);

CREATE INDEX IF NOT EXISTS idx_energy_infrastructure_bbox_gist
  ON energy_infrastructure USING GiST(bbox);

CREATE INDEX IF NOT EXISTS idx_energy_infrastructure_source_feature
  ON energy_infrastructure(source_id, feature_type);

CREATE INDEX IF NOT EXISTS idx_energy_infrastructure_country_feature
  ON energy_infrastructure(country, feature_type);

CREATE INDEX IF NOT EXISTS idx_energy_infrastructure_category_status
  ON energy_infrastructure(category, status);

CREATE INDEX IF NOT EXISTS idx_energy_infrastructure_fuel_capacity
  ON energy_infrastructure(fuel_type, capacity_mw);

CREATE INDEX IF NOT EXISTS idx_energy_infrastructure_pipeline_product_length
  ON energy_infrastructure(pipeline_product, pipeline_length_km);
