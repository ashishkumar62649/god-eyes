-- WO-039-DB-DERIVED: Airport Derived Intelligence
-- Layer: layer_01_aviation
-- Purpose: Stage 4 current derived intelligence profile cache.
-- Status: Additive, non-destructive. No mutations to existing aviation,
-- public-profile, intelligence foundation, capacity, or traffic tables.
-- Created: 2026-05-19

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS airport_derived_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airport_id UUID NOT NULL REFERENCES aviation_airports(id),
  module_id UUID REFERENCES airport_intelligence_modules(id),
  capacity_profile_id UUID REFERENCES airport_capacity_profiles(id),
  intelligence_status TEXT NOT NULL DEFAULT 'no_data',
  airport_class TEXT,
  traffic_scale TEXT,
  capacity_scale TEXT,
  runway_capability TEXT,
  operating_role TEXT,
  capability_tags TEXT[] NOT NULL DEFAULT '{}',
  risk_flags TEXT[] NOT NULL DEFAULT '{}',
  source_flags TEXT[] NOT NULL DEFAULT '{}',
  confidence_score NUMERIC(5,4),
  utilization_pct NUMERIC(7,4),
  year_over_year_growth_pct NUMERIC(8,4),
  five_year_growth_pct NUMERIC(8,4),
  latest_passenger_year INTEGER,
  latest_passenger_value BIGINT,
  latest_movement_year INTEGER,
  latest_movement_value BIGINT,
  longest_runway_ft INTEGER,
  runway_count INTEGER,
  intelligence_summary TEXT,
  capability_summary TEXT,
  traffic_summary TEXT,
  capacity_summary TEXT,
  source_summary JSONB,
  input_snapshot JSONB,
  data_payload JSONB,
  source_hash TEXT,
  generated_at TIMESTAMPTZ,
  stale_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  next_refresh_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT airport_derived_intelligence_airport_id_key UNIQUE(airport_id),
  CONSTRAINT airport_derived_intelligence_status_check
    CHECK (intelligence_status IN ('ok', 'stale', 'fetching', 'no_data', 'low_confidence', 'error')),
  CONSTRAINT airport_derived_intelligence_airport_class_check
    CHECK (airport_class IS NULL OR airport_class IN (
      'global_hub',
      'major_international',
      'international',
      'regional',
      'local',
      'general_aviation',
      'cargo',
      'military',
      'heliport',
      'seaplane',
      'closed',
      'unknown'
    )),
  CONSTRAINT airport_derived_intelligence_traffic_scale_check
    CHECK (traffic_scale IS NULL OR traffic_scale IN ('very_high', 'high', 'medium', 'low', 'minimal', 'unknown')),
  CONSTRAINT airport_derived_intelligence_capacity_scale_check
    CHECK (capacity_scale IS NULL OR capacity_scale IN ('very_high', 'high', 'medium', 'low', 'minimal', 'unknown')),
  CONSTRAINT airport_derived_intelligence_runway_capability_check
    CHECK (runway_capability IS NULL OR runway_capability IN (
      'large_aircraft',
      'jet_capable',
      'regional_jet',
      'turboprop',
      'light_aircraft',
      'heliport_only',
      'seaplane_only',
      'unknown'
    )),
  CONSTRAINT airport_derived_intelligence_operating_role_check
    CHECK (operating_role IS NULL OR operating_role IN (
      'passenger',
      'cargo',
      'mixed',
      'general_aviation',
      'military',
      'emergency',
      'closed',
      'unknown'
    )),
  CONSTRAINT airport_derived_intelligence_confidence_score_check
    CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
  CONSTRAINT airport_derived_intelligence_utilization_pct_check
    CHECK (utilization_pct IS NULL OR utilization_pct >= 0),
  CONSTRAINT airport_derived_intelligence_yoy_growth_check
    CHECK (year_over_year_growth_pct IS NULL OR (year_over_year_growth_pct >= -100 AND year_over_year_growth_pct <= 10000)),
  CONSTRAINT airport_derived_intelligence_five_year_growth_check
    CHECK (five_year_growth_pct IS NULL OR (five_year_growth_pct >= -100 AND five_year_growth_pct <= 10000)),
  CONSTRAINT airport_derived_intelligence_latest_passenger_year_check
    CHECK (latest_passenger_year IS NULL OR (latest_passenger_year >= 1900 AND latest_passenger_year <= 2200)),
  CONSTRAINT airport_derived_intelligence_latest_movement_year_check
    CHECK (latest_movement_year IS NULL OR (latest_movement_year >= 1900 AND latest_movement_year <= 2200)),
  CONSTRAINT airport_derived_intelligence_latest_passenger_value_check
    CHECK (latest_passenger_value IS NULL OR latest_passenger_value >= 0),
  CONSTRAINT airport_derived_intelligence_latest_movement_value_check
    CHECK (latest_movement_value IS NULL OR latest_movement_value >= 0),
  CONSTRAINT airport_derived_intelligence_longest_runway_ft_check
    CHECK (longest_runway_ft IS NULL OR longest_runway_ft >= 0),
  CONSTRAINT airport_derived_intelligence_runway_count_check
    CHECK (runway_count IS NULL OR runway_count >= 0),
  CONSTRAINT airport_derived_intelligence_stale_after_generated_check
    CHECK (stale_at IS NULL OR generated_at IS NULL OR stale_at > generated_at),
  CONSTRAINT airport_derived_intelligence_expires_after_generated_check
    CHECK (expires_at IS NULL OR generated_at IS NULL OR expires_at > generated_at),
  CONSTRAINT airport_derived_intelligence_derived_backed_ok_check
    CHECK (
      intelligence_status <> 'ok'
      OR input_snapshot IS NOT NULL
      OR source_summary IS NOT NULL
      OR data_payload IS NOT NULL
      OR capacity_profile_id IS NOT NULL
      OR latest_passenger_value IS NOT NULL
      OR longest_runway_ft IS NOT NULL
      OR cardinality(capability_tags) > 0
    ),
  CONSTRAINT airport_derived_intelligence_low_confidence_check
    CHECK (intelligence_status <> 'low_confidence' OR confidence_score IS NULL OR confidence_score < 0.5)
);

CREATE INDEX IF NOT EXISTS idx_airport_derived_intelligence_airport_id
  ON airport_derived_intelligence(airport_id);

CREATE INDEX IF NOT EXISTS idx_airport_derived_intelligence_module_id
  ON airport_derived_intelligence(module_id) WHERE module_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_derived_intelligence_capacity_profile_id
  ON airport_derived_intelligence(capacity_profile_id) WHERE capacity_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_derived_intelligence_status
  ON airport_derived_intelligence(intelligence_status);

CREATE INDEX IF NOT EXISTS idx_airport_derived_intelligence_airport_class
  ON airport_derived_intelligence(airport_class) WHERE airport_class IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_derived_intelligence_traffic_scale
  ON airport_derived_intelligence(traffic_scale) WHERE traffic_scale IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_derived_intelligence_capacity_scale
  ON airport_derived_intelligence(capacity_scale) WHERE capacity_scale IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_derived_intelligence_runway_capability
  ON airport_derived_intelligence(runway_capability) WHERE runway_capability IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_derived_intelligence_operating_role
  ON airport_derived_intelligence(operating_role) WHERE operating_role IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_derived_intelligence_confidence_score
  ON airport_derived_intelligence(confidence_score) WHERE confidence_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_derived_intelligence_utilization_pct
  ON airport_derived_intelligence(utilization_pct) WHERE utilization_pct IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_derived_intelligence_yoy_growth
  ON airport_derived_intelligence(year_over_year_growth_pct) WHERE year_over_year_growth_pct IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_derived_intelligence_latest_passenger_year
  ON airport_derived_intelligence(latest_passenger_year) WHERE latest_passenger_year IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_derived_intelligence_latest_passenger_value
  ON airport_derived_intelligence(latest_passenger_value) WHERE latest_passenger_value IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_derived_intelligence_longest_runway_ft
  ON airport_derived_intelligence(longest_runway_ft) WHERE longest_runway_ft IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_derived_intelligence_stale_at
  ON airport_derived_intelligence(stale_at) WHERE stale_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_derived_intelligence_expires_at
  ON airport_derived_intelligence(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_derived_intelligence_next_refresh_at
  ON airport_derived_intelligence(next_refresh_at) WHERE next_refresh_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_derived_intelligence_source_hash
  ON airport_derived_intelligence(source_hash) WHERE source_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_derived_intelligence_capability_tags_gin
  ON airport_derived_intelligence USING GIN(capability_tags);

CREATE INDEX IF NOT EXISTS idx_airport_derived_intelligence_risk_flags_gin
  ON airport_derived_intelligence USING GIN(risk_flags);

CREATE INDEX IF NOT EXISTS idx_airport_derived_intelligence_source_flags_gin
  ON airport_derived_intelligence USING GIN(source_flags);

CREATE INDEX IF NOT EXISTS idx_airport_derived_intelligence_input_snapshot_gin
  ON airport_derived_intelligence USING GIN(input_snapshot);

CREATE INDEX IF NOT EXISTS idx_airport_derived_intelligence_data_payload_gin
  ON airport_derived_intelligence USING GIN(data_payload);

CREATE INDEX IF NOT EXISTS idx_airport_derived_intelligence_source_summary_gin
  ON airport_derived_intelligence USING GIN(source_summary);
