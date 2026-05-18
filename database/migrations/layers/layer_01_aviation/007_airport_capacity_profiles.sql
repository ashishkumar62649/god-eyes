-- WO-037-DB-CAPACITY: Airport Capacity Profiles
-- Layer: layer_01_aviation
-- Purpose: Stage 2 source-backed capacity profile cache.
-- Status: Additive, non-destructive. No mutations to existing aviation,
-- public-profile, or airport intelligence foundation tables.
-- Created: 2026-05-19

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS airport_capacity_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airport_id UUID NOT NULL REFERENCES aviation_airports(id),
  module_id UUID REFERENCES airport_intelligence_modules(id),
  primary_source_link_id UUID REFERENCES airport_source_links(id),
  annual_passenger_capacity BIGINT,
  terminal_capacity BIGINT,
  runway_movement_capacity_per_hour INTEGER,
  terminal_count INTEGER,
  gate_count INTEGER,
  stand_count INTEGER,
  aircraft_stand_count INTEGER,
  check_in_counter_count INTEGER,
  baggage_belt_count INTEGER,
  capacity_year INTEGER,
  capacity_basis TEXT,
  confidence_label TEXT,
  confidence_score NUMERIC(5,4),
  capacity_status TEXT NOT NULL DEFAULT 'no_data',
  notes TEXT,
  data_payload JSONB,
  source_summary JSONB,
  retrieved_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ,
  stale_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  next_refresh_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT airport_capacity_profiles_airport_id_key UNIQUE(airport_id),
  CONSTRAINT airport_capacity_profiles_capacity_status_check
    CHECK (capacity_status IN ('ok', 'stale', 'fetching', 'no_data', 'low_confidence', 'error')),
  CONSTRAINT airport_capacity_profiles_capacity_basis_check
    CHECK (capacity_basis IS NULL OR capacity_basis IN (
      'official_declared',
      'annual_report',
      'authority_dataset',
      'airport_website',
      'osm_count',
      'wikidata',
      'wikipedia_extract',
      'other'
    )),
  CONSTRAINT airport_capacity_profiles_annual_passenger_capacity_check
    CHECK (annual_passenger_capacity IS NULL OR annual_passenger_capacity >= 0),
  CONSTRAINT airport_capacity_profiles_terminal_capacity_check
    CHECK (terminal_capacity IS NULL OR terminal_capacity >= 0),
  CONSTRAINT airport_capacity_profiles_runway_movement_capacity_check
    CHECK (runway_movement_capacity_per_hour IS NULL OR runway_movement_capacity_per_hour >= 0),
  CONSTRAINT airport_capacity_profiles_terminal_count_check
    CHECK (terminal_count IS NULL OR terminal_count >= 0),
  CONSTRAINT airport_capacity_profiles_gate_count_check
    CHECK (gate_count IS NULL OR gate_count >= 0),
  CONSTRAINT airport_capacity_profiles_stand_count_check
    CHECK (stand_count IS NULL OR stand_count >= 0),
  CONSTRAINT airport_capacity_profiles_aircraft_stand_count_check
    CHECK (aircraft_stand_count IS NULL OR aircraft_stand_count >= 0),
  CONSTRAINT airport_capacity_profiles_check_in_counter_count_check
    CHECK (check_in_counter_count IS NULL OR check_in_counter_count >= 0),
  CONSTRAINT airport_capacity_profiles_baggage_belt_count_check
    CHECK (baggage_belt_count IS NULL OR baggage_belt_count >= 0),
  CONSTRAINT airport_capacity_profiles_capacity_year_check
    CHECK (capacity_year IS NULL OR (capacity_year >= 1900 AND capacity_year <= 2200)),
  CONSTRAINT airport_capacity_profiles_confidence_score_check
    CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
  CONSTRAINT airport_capacity_profiles_stale_after_fetched_check
    CHECK (stale_at IS NULL OR fetched_at IS NULL OR stale_at > fetched_at),
  CONSTRAINT airport_capacity_profiles_expires_after_fetched_check
    CHECK (expires_at IS NULL OR fetched_at IS NULL OR expires_at > fetched_at),
  CONSTRAINT airport_capacity_profiles_source_backed_ok_check
    CHECK (
      capacity_status <> 'ok'
      OR primary_source_link_id IS NOT NULL
      OR source_summary IS NOT NULL
      OR data_payload IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_airport_capacity_profiles_airport_id
  ON airport_capacity_profiles(airport_id);

CREATE INDEX IF NOT EXISTS idx_airport_capacity_profiles_module_id
  ON airport_capacity_profiles(module_id) WHERE module_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_capacity_profiles_primary_source_link_id
  ON airport_capacity_profiles(primary_source_link_id) WHERE primary_source_link_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_capacity_profiles_capacity_status
  ON airport_capacity_profiles(capacity_status);

CREATE INDEX IF NOT EXISTS idx_airport_capacity_profiles_capacity_year
  ON airport_capacity_profiles(capacity_year) WHERE capacity_year IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_capacity_profiles_annual_passenger_capacity
  ON airport_capacity_profiles(annual_passenger_capacity) WHERE annual_passenger_capacity IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_capacity_profiles_terminal_count
  ON airport_capacity_profiles(terminal_count) WHERE terminal_count IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_capacity_profiles_gate_count
  ON airport_capacity_profiles(gate_count) WHERE gate_count IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_capacity_profiles_stand_count
  ON airport_capacity_profiles(stand_count) WHERE stand_count IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_capacity_profiles_confidence_score
  ON airport_capacity_profiles(confidence_score) WHERE confidence_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_capacity_profiles_stale_at
  ON airport_capacity_profiles(stale_at) WHERE stale_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_capacity_profiles_expires_at
  ON airport_capacity_profiles(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_capacity_profiles_next_refresh_at
  ON airport_capacity_profiles(next_refresh_at) WHERE next_refresh_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_capacity_profiles_data_payload_gin
  ON airport_capacity_profiles USING GIN(data_payload);

CREATE INDEX IF NOT EXISTS idx_airport_capacity_profiles_source_summary_gin
  ON airport_capacity_profiles USING GIN(source_summary);
