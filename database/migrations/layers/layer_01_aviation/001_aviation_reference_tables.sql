CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS aviation_airports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_airport_id TEXT NOT NULL,
  ident TEXT NOT NULL,
  type_source TEXT NOT NULL,
  category_normalized TEXT NOT NULL,
  name TEXT NOT NULL,
  latitude_deg DOUBLE PRECISION,
  longitude_deg DOUBLE PRECISION,
  elevation_ft INTEGER,
  continent TEXT,
  iso_country TEXT,
  iso_region TEXT,
  municipality TEXT,
  scheduled_service TEXT,
  gps_code TEXT,
  iata_code TEXT,
  local_code TEXT,
  home_link TEXT,
  wikipedia_link TEXT,
  keywords TEXT,
  geom geometry(Point, 4326),
  raw_object_id UUID NOT NULL REFERENCES raw_objects(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_id, source_airport_id)
);

CREATE INDEX IF NOT EXISTS idx_aviation_airports_layer_id
  ON aviation_airports(layer_id);
CREATE INDEX IF NOT EXISTS idx_aviation_airports_source_id
  ON aviation_airports(source_id);
CREATE INDEX IF NOT EXISTS idx_aviation_airports_source_airport_id
  ON aviation_airports(source_airport_id);
CREATE INDEX IF NOT EXISTS idx_aviation_airports_ident
  ON aviation_airports(ident);
CREATE INDEX IF NOT EXISTS idx_aviation_airports_iata_code
  ON aviation_airports(iata_code)
  WHERE iata_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_aviation_airports_iso_country
  ON aviation_airports(iso_country);
CREATE INDEX IF NOT EXISTS idx_aviation_airports_category_normalized
  ON aviation_airports(category_normalized);
CREATE INDEX IF NOT EXISTS idx_aviation_airports_raw_object_id
  ON aviation_airports(raw_object_id);
CREATE INDEX IF NOT EXISTS idx_aviation_airports_geom
  ON aviation_airports USING GIST(geom);

CREATE TABLE IF NOT EXISTS aviation_runways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_runway_id TEXT NOT NULL,
  airport_ref INTEGER,
  airport_ident TEXT,
  length_ft INTEGER,
  width_ft INTEGER,
  surface TEXT,
  lighted BOOLEAN,
  closed BOOLEAN,
  le_ident TEXT,
  le_latitude_deg DOUBLE PRECISION,
  le_longitude_deg DOUBLE PRECISION,
  le_elevation_ft INTEGER,
  "le_heading_degT" DOUBLE PRECISION,
  le_displaced_threshold_ft INTEGER,
  he_ident TEXT,
  he_latitude_deg DOUBLE PRECISION,
  he_longitude_deg DOUBLE PRECISION,
  he_elevation_ft INTEGER,
  "he_heading_degT" DOUBLE PRECISION,
  he_displaced_threshold_ft INTEGER,
  raw_object_id UUID NOT NULL REFERENCES raw_objects(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_id, source_runway_id)
);

CREATE INDEX IF NOT EXISTS idx_aviation_runways_layer_id
  ON aviation_runways(layer_id);
CREATE INDEX IF NOT EXISTS idx_aviation_runways_source_id
  ON aviation_runways(source_id);
CREATE INDEX IF NOT EXISTS idx_aviation_runways_source_runway_id
  ON aviation_runways(source_runway_id);
CREATE INDEX IF NOT EXISTS idx_aviation_runways_airport_ident
  ON aviation_runways(airport_ident);
CREATE INDEX IF NOT EXISTS idx_aviation_runways_raw_object_id
  ON aviation_runways(raw_object_id);

CREATE TABLE IF NOT EXISTS aviation_navaids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_navaid_id TEXT NOT NULL,
  filename TEXT,
  ident TEXT,
  name TEXT,
  type TEXT,
  frequency_khz INTEGER,
  latitude_deg DOUBLE PRECISION,
  longitude_deg DOUBLE PRECISION,
  elevation_ft INTEGER,
  iso_country TEXT,
  dme_frequency_khz INTEGER,
  dme_channel TEXT,
  dme_latitude_deg DOUBLE PRECISION,
  dme_longitude_deg DOUBLE PRECISION,
  dme_elevation_ft INTEGER,
  slaved_variation_deg DOUBLE PRECISION,
  magnetic_variation_deg DOUBLE PRECISION,
  "usageType" TEXT,
  power TEXT,
  associated_airport TEXT,
  geom geometry(Point, 4326),
  raw_object_id UUID NOT NULL REFERENCES raw_objects(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_id, source_navaid_id)
);

CREATE INDEX IF NOT EXISTS idx_aviation_navaids_layer_id
  ON aviation_navaids(layer_id);
CREATE INDEX IF NOT EXISTS idx_aviation_navaids_source_id
  ON aviation_navaids(source_id);
CREATE INDEX IF NOT EXISTS idx_aviation_navaids_source_navaid_id
  ON aviation_navaids(source_navaid_id);
CREATE INDEX IF NOT EXISTS idx_aviation_navaids_ident
  ON aviation_navaids(ident);
CREATE INDEX IF NOT EXISTS idx_aviation_navaids_iso_country
  ON aviation_navaids(iso_country);
CREATE INDEX IF NOT EXISTS idx_aviation_navaids_raw_object_id
  ON aviation_navaids(raw_object_id);
CREATE INDEX IF NOT EXISTS idx_aviation_navaids_geom
  ON aviation_navaids USING GIST(geom);

CREATE TABLE IF NOT EXISTS aviation_airport_frequencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_frequency_id TEXT NOT NULL,
  airport_ref INTEGER,
  airport_ident TEXT,
  type TEXT,
  description TEXT,
  frequency_mhz DOUBLE PRECISION,
  raw_object_id UUID NOT NULL REFERENCES raw_objects(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_id, source_frequency_id)
);

CREATE INDEX IF NOT EXISTS idx_aviation_airport_frequencies_layer_id
  ON aviation_airport_frequencies(layer_id);
CREATE INDEX IF NOT EXISTS idx_aviation_airport_frequencies_source_id
  ON aviation_airport_frequencies(source_id);
CREATE INDEX IF NOT EXISTS idx_aviation_airport_frequencies_source_frequency_id
  ON aviation_airport_frequencies(source_frequency_id);
CREATE INDEX IF NOT EXISTS idx_aviation_airport_frequencies_airport_ident
  ON aviation_airport_frequencies(airport_ident);
CREATE INDEX IF NOT EXISTS idx_aviation_airport_frequencies_raw_object_id
  ON aviation_airport_frequencies(raw_object_id);

CREATE TABLE IF NOT EXISTS aviation_countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_country_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  continent TEXT,
  wikipedia_link TEXT,
  keywords TEXT,
  raw_object_id UUID NOT NULL REFERENCES raw_objects(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_id, source_country_id),
  UNIQUE(source_id, code)
);

CREATE INDEX IF NOT EXISTS idx_aviation_countries_layer_id
  ON aviation_countries(layer_id);
CREATE INDEX IF NOT EXISTS idx_aviation_countries_source_id
  ON aviation_countries(source_id);
CREATE INDEX IF NOT EXISTS idx_aviation_countries_source_country_id
  ON aviation_countries(source_country_id);
CREATE INDEX IF NOT EXISTS idx_aviation_countries_code
  ON aviation_countries(code);
CREATE INDEX IF NOT EXISTS idx_aviation_countries_raw_object_id
  ON aviation_countries(raw_object_id);

CREATE TABLE IF NOT EXISTS aviation_regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_region_id TEXT NOT NULL,
  code TEXT NOT NULL,
  local_code TEXT,
  name TEXT NOT NULL,
  continent TEXT,
  iso_country TEXT,
  wikipedia_link TEXT,
  keywords TEXT,
  raw_object_id UUID NOT NULL REFERENCES raw_objects(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_id, source_region_id),
  UNIQUE(source_id, code)
);

CREATE INDEX IF NOT EXISTS idx_aviation_regions_layer_id
  ON aviation_regions(layer_id);
CREATE INDEX IF NOT EXISTS idx_aviation_regions_source_id
  ON aviation_regions(source_id);
CREATE INDEX IF NOT EXISTS idx_aviation_regions_source_region_id
  ON aviation_regions(source_region_id);
CREATE INDEX IF NOT EXISTS idx_aviation_regions_code
  ON aviation_regions(code);
CREATE INDEX IF NOT EXISTS idx_aviation_regions_iso_country
  ON aviation_regions(iso_country);
CREATE INDEX IF NOT EXISTS idx_aviation_regions_raw_object_id
  ON aviation_regions(raw_object_id);
