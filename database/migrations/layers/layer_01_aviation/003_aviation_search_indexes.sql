CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_aviation_airports_search_name_trgm
  ON aviation_airports USING GIN (lower(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_aviation_airports_search_ident_trgm
  ON aviation_airports USING GIN (lower(ident) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_aviation_airports_search_iata_trgm
  ON aviation_airports USING GIN (lower(iata_code) gin_trgm_ops)
  WHERE iata_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aviation_airports_search_municipality_trgm
  ON aviation_airports USING GIN (lower(municipality) gin_trgm_ops)
  WHERE municipality IS NOT NULL;
