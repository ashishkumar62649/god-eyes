-- WO-038-DB-TRAFFIC: Airport Annual Traffic Metrics
-- Layer: layer_01_aviation
-- Purpose: Stage 3 source-backed annual traffic metrics cache.
-- Status: Additive, non-destructive. No mutations to existing aviation,
-- public-profile, airport intelligence foundation, or capacity tables.
-- Created: 2026-05-19

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS airport_traffic_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airport_id UUID NOT NULL REFERENCES aviation_airports(id),
  module_id UUID REFERENCES airport_intelligence_modules(id),
  primary_source_link_id UUID REFERENCES airport_source_links(id),
  metric_type TEXT NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'annual',
  period_year INTEGER NOT NULL,
  period_start DATE,
  period_end DATE,
  metric_value NUMERIC(20,4) NOT NULL,
  metric_unit TEXT NOT NULL,
  traffic_status TEXT NOT NULL DEFAULT 'ok',
  confidence_label TEXT,
  confidence_score NUMERIC(5,4),
  source_summary JSONB,
  data_payload JSONB,
  notes TEXT,
  retrieved_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ,
  stale_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  next_refresh_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT airport_traffic_metrics_airport_metric_year_key UNIQUE(airport_id, metric_type, period_type, period_year),
  CONSTRAINT airport_traffic_metrics_metric_type_check
    CHECK (metric_type IN (
      'passengers_total',
      'passengers_domestic',
      'passengers_international',
      'aircraft_movements',
      'cargo_tonnes',
      'freight_tonnes',
      'mail_tonnes',
      'cargo_kg',
      'freight_kg',
      'mail_kg',
      'routes_count',
      'destinations_count',
      'seats_total',
      'other'
    )),
  CONSTRAINT airport_traffic_metrics_period_type_check
    CHECK (period_type = 'annual'),
  CONSTRAINT airport_traffic_metrics_metric_unit_check
    CHECK (metric_unit IN (
      'passengers',
      'movements',
      'tonnes',
      'kg',
      'routes',
      'destinations',
      'seats',
      'count',
      'other'
    )),
  CONSTRAINT airport_traffic_metrics_traffic_status_check
    CHECK (traffic_status IN ('ok', 'stale', 'fetching', 'no_data', 'low_confidence', 'error')),
  CONSTRAINT airport_traffic_metrics_metric_value_check
    CHECK (metric_value >= 0),
  CONSTRAINT airport_traffic_metrics_period_year_check
    CHECK (period_year >= 1900 AND period_year <= 2200),
  CONSTRAINT airport_traffic_metrics_confidence_score_check
    CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
  CONSTRAINT airport_traffic_metrics_period_dates_check
    CHECK (period_start IS NULL OR period_end IS NULL OR period_start <= period_end),
  CONSTRAINT airport_traffic_metrics_stale_after_fetched_check
    CHECK (stale_at IS NULL OR fetched_at IS NULL OR stale_at > fetched_at),
  CONSTRAINT airport_traffic_metrics_expires_after_fetched_check
    CHECK (expires_at IS NULL OR fetched_at IS NULL OR expires_at > fetched_at),
  CONSTRAINT airport_traffic_metrics_source_backed_ok_check
    CHECK (
      traffic_status <> 'ok'
      OR primary_source_link_id IS NOT NULL
      OR source_summary IS NOT NULL
      OR data_payload IS NOT NULL
    ),
  CONSTRAINT airport_traffic_metrics_unit_consistency_check
    CHECK (
      (metric_type NOT IN ('passengers_total', 'passengers_domestic', 'passengers_international')
        OR metric_unit = 'passengers')
      AND (metric_type <> 'aircraft_movements' OR metric_unit = 'movements')
      AND (RIGHT(metric_type, 7) <> '_tonnes' OR metric_unit = 'tonnes')
      AND (RIGHT(metric_type, 3) <> '_kg' OR metric_unit = 'kg')
      AND (metric_type <> 'routes_count' OR metric_unit = 'routes')
      AND (metric_type <> 'destinations_count' OR metric_unit = 'destinations')
      AND (metric_type <> 'seats_total' OR metric_unit = 'seats')
    )
);

CREATE INDEX IF NOT EXISTS idx_airport_traffic_metrics_airport_id
  ON airport_traffic_metrics(airport_id);

CREATE INDEX IF NOT EXISTS idx_airport_traffic_metrics_module_id
  ON airport_traffic_metrics(module_id) WHERE module_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_traffic_metrics_primary_source_link_id
  ON airport_traffic_metrics(primary_source_link_id) WHERE primary_source_link_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_traffic_metrics_metric_type
  ON airport_traffic_metrics(metric_type);

CREATE INDEX IF NOT EXISTS idx_airport_traffic_metrics_period_year
  ON airport_traffic_metrics(period_year);

CREATE INDEX IF NOT EXISTS idx_airport_traffic_metrics_period_type_year
  ON airport_traffic_metrics(period_type, period_year);

CREATE INDEX IF NOT EXISTS idx_airport_traffic_metrics_airport_metric_year
  ON airport_traffic_metrics(airport_id, metric_type, period_year);

CREATE INDEX IF NOT EXISTS idx_airport_traffic_metrics_traffic_status
  ON airport_traffic_metrics(traffic_status);

CREATE INDEX IF NOT EXISTS idx_airport_traffic_metrics_metric_value
  ON airport_traffic_metrics(metric_value);

CREATE INDEX IF NOT EXISTS idx_airport_traffic_metrics_confidence_score
  ON airport_traffic_metrics(confidence_score) WHERE confidence_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_traffic_metrics_stale_at
  ON airport_traffic_metrics(stale_at) WHERE stale_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_traffic_metrics_expires_at
  ON airport_traffic_metrics(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_traffic_metrics_next_refresh_at
  ON airport_traffic_metrics(next_refresh_at) WHERE next_refresh_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_traffic_metrics_data_payload_gin
  ON airport_traffic_metrics USING GIN(data_payload);

CREATE INDEX IF NOT EXISTS idx_airport_traffic_metrics_source_summary_gin
  ON airport_traffic_metrics USING GIN(source_summary);
