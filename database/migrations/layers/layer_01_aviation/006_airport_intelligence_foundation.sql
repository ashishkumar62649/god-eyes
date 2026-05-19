-- WO-036-DB-FOUNDATION: Airport Intelligence Module Cache Foundation
-- Layer: layer_01_aviation
-- Purpose: Stage 1 cache foundation for modular airport intelligence.
-- Status: Additive, non-destructive. No mutations to existing aviation_airports
-- or airport_public_profile_* tables.
-- Created: 2026-05-19

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Shared Stage 1 vocabularies:
-- module_key: overview, capability, capacity, traffic, infrastructure, sources, advanced_details
-- module_status: ok, fetching, stale, no_data, low_confidence, error
-- cache_state: fresh, stale, expired, refresh_queued, refresh_running, failed

CREATE TABLE IF NOT EXISTS airport_intelligence_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airport_id UUID NOT NULL REFERENCES aviation_airports(id),
  module_key TEXT NOT NULL,
  module_status TEXT NOT NULL,
  cache_state TEXT NOT NULL,
  cache_ttl_seconds INTEGER NOT NULL DEFAULT 2592000,
  confidence_label TEXT,
  confidence_score NUMERIC(5,4),
  data_payload JSONB,
  summary_payload JSONB,
  source_summary JSONB,
  error_code TEXT,
  error_message TEXT,
  fetched_at TIMESTAMPTZ,
  stale_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  next_refresh_at TIMESTAMPTZ,
  refresh_error_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT airport_intelligence_modules_airport_module_key UNIQUE(airport_id, module_key),
  CONSTRAINT airport_intelligence_modules_module_key_check
    CHECK (module_key IN (
      'overview',
      'capability',
      'capacity',
      'traffic',
      'infrastructure',
      'sources',
      'advanced_details'
    )),
  CONSTRAINT airport_intelligence_modules_module_status_check
    CHECK (module_status IN (
      'ok',
      'fetching',
      'stale',
      'no_data',
      'low_confidence',
      'error'
    )),
  CONSTRAINT airport_intelligence_modules_cache_state_check
    CHECK (cache_state IN (
      'fresh',
      'stale',
      'expired',
      'refresh_queued',
      'refresh_running',
      'failed'
    )),
  CONSTRAINT airport_intelligence_modules_confidence_score_check
    CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
  CONSTRAINT airport_intelligence_modules_cache_ttl_seconds_check
    CHECK (cache_ttl_seconds > 0),
  CONSTRAINT airport_intelligence_modules_refresh_error_count_check
    CHECK (refresh_error_count >= 0),
  CONSTRAINT airport_intelligence_modules_stale_after_fetched_check
    CHECK (stale_at IS NULL OR fetched_at IS NULL OR stale_at > fetched_at),
  CONSTRAINT airport_intelligence_modules_expires_after_fetched_check
    CHECK (expires_at IS NULL OR fetched_at IS NULL OR expires_at > fetched_at)
);

CREATE INDEX IF NOT EXISTS idx_airport_intelligence_modules_airport_id
  ON airport_intelligence_modules(airport_id);

CREATE INDEX IF NOT EXISTS idx_airport_intelligence_modules_module_status
  ON airport_intelligence_modules(module_key, module_status);

CREATE INDEX IF NOT EXISTS idx_airport_intelligence_modules_cache_state
  ON airport_intelligence_modules(cache_state);

CREATE INDEX IF NOT EXISTS idx_airport_intelligence_modules_next_refresh_at
  ON airport_intelligence_modules(next_refresh_at) WHERE next_refresh_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_intelligence_modules_stale_at
  ON airport_intelligence_modules(stale_at) WHERE stale_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_intelligence_modules_expires_at
  ON airport_intelligence_modules(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_intelligence_modules_confidence_score
  ON airport_intelligence_modules(confidence_score) WHERE confidence_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_intelligence_modules_data_payload_gin
  ON airport_intelligence_modules USING GIN(data_payload);

CREATE INDEX IF NOT EXISTS idx_airport_intelligence_modules_source_summary_gin
  ON airport_intelligence_modules USING GIN(source_summary);

CREATE TABLE IF NOT EXISTS airport_source_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airport_id UUID NOT NULL REFERENCES aviation_airports(id),
  module_key TEXT,
  source_type TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT,
  source_entity_id TEXT,
  source_license TEXT,
  source_license_url TEXT,
  attribution_text TEXT,
  retrieved_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  confidence_label TEXT,
  confidence_score NUMERIC(5,4),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT airport_source_links_module_key_check
    CHECK (module_key IS NULL OR module_key IN (
      'overview',
      'capability',
      'capacity',
      'traffic',
      'infrastructure',
      'sources',
      'advanced_details'
    )),
  CONSTRAINT airport_source_links_source_type_check
    CHECK (source_type IN (
      'ourairports',
      'wikipedia',
      'wikidata',
      'osm',
      'bts',
      'eurostat',
      'official_website',
      'annual_report',
      'national_authority',
      'faa',
      'eurocontrol',
      'other'
    )),
  CONSTRAINT airport_source_links_source_name_check
    CHECK (btrim(source_name) <> ''),
  CONSTRAINT airport_source_links_confidence_score_check
    CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1))
);

CREATE INDEX IF NOT EXISTS idx_airport_source_links_airport_id
  ON airport_source_links(airport_id);

CREATE INDEX IF NOT EXISTS idx_airport_source_links_airport_module
  ON airport_source_links(airport_id, module_key);

CREATE INDEX IF NOT EXISTS idx_airport_source_links_source_type
  ON airport_source_links(source_type);

CREATE INDEX IF NOT EXISTS idx_airport_source_links_source_entity_id
  ON airport_source_links(source_entity_id) WHERE source_entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_source_links_is_primary
  ON airport_source_links(is_primary) WHERE is_primary = TRUE;

CREATE INDEX IF NOT EXISTS idx_airport_source_links_retrieved_at
  ON airport_source_links(retrieved_at) WHERE retrieved_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_source_links_confidence_score
  ON airport_source_links(confidence_score) WHERE confidence_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_source_links_metadata_gin
  ON airport_source_links USING GIN(metadata);

CREATE UNIQUE INDEX IF NOT EXISTS idx_airport_source_links_entity_dedupe
  ON airport_source_links(airport_id, COALESCE(module_key, ''), source_type, source_entity_id)
  WHERE source_entity_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_airport_source_links_url_dedupe
  ON airport_source_links(airport_id, COALESCE(module_key, ''), source_type, source_url)
  WHERE source_entity_id IS NULL AND source_url IS NOT NULL;

CREATE TABLE IF NOT EXISTS airport_intelligence_fetch_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airport_id UUID NOT NULL REFERENCES aviation_airports(id),
  module_key TEXT NOT NULL,
  run_type TEXT NOT NULL,
  run_status TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  requested_by TEXT,
  source_type TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  lock_expires_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 2,
  duration_ms INTEGER,
  result_status TEXT,
  produced_module_id UUID REFERENCES airport_intelligence_modules(id),
  error_code TEXT,
  error_message TEXT,
  metadata JSONB,
  in_progress_key TEXT GENERATED ALWAYS AS (
    airport_id::TEXT || ':' || module_key || ':' || run_type
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT airport_intelligence_fetch_runs_module_key_check
    CHECK (module_key IN (
      'overview',
      'capability',
      'capacity',
      'traffic',
      'infrastructure',
      'sources',
      'advanced_details'
    )),
  CONSTRAINT airport_intelligence_fetch_runs_run_type_check
    CHECK (run_type IN (
      'lazy_fetch',
      'refresh',
      'backfill',
      'manual',
      'retry'
    )),
  CONSTRAINT airport_intelligence_fetch_runs_run_status_check
    CHECK (run_status IN (
      'queued',
      'running',
      'completed',
      'failed',
      'cancelled',
      'skipped'
    )),
  CONSTRAINT airport_intelligence_fetch_runs_result_status_check
    CHECK (result_status IS NULL OR result_status IN (
      'ok',
      'stale',
      'no_data',
      'low_confidence',
      'error',
      'unchanged'
    )),
  CONSTRAINT airport_intelligence_fetch_runs_source_type_check
    CHECK (source_type IS NULL OR source_type IN (
      'ourairports',
      'wikipedia',
      'wikidata',
      'osm',
      'bts',
      'eurostat',
      'official_website',
      'annual_report',
      'national_authority',
      'faa',
      'eurocontrol',
      'other'
    )),
  CONSTRAINT airport_intelligence_fetch_runs_retry_count_check
    CHECK (retry_count >= 0),
  CONSTRAINT airport_intelligence_fetch_runs_max_retries_check
    CHECK (max_retries >= 0),
  CONSTRAINT airport_intelligence_fetch_runs_priority_check
    CHECK (priority >= 0),
  CONSTRAINT airport_intelligence_fetch_runs_duration_ms_check
    CHECK (duration_ms IS NULL OR duration_ms >= 0),
  CONSTRAINT airport_intelligence_fetch_runs_completed_after_started_check
    CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at),
  CONSTRAINT airport_intelligence_fetch_runs_next_retry_status_check
    CHECK (next_retry_at IS NULL OR run_status IN ('queued', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_airport_intelligence_fetch_runs_airport_id
  ON airport_intelligence_fetch_runs(airport_id);

CREATE INDEX IF NOT EXISTS idx_airport_intelligence_fetch_runs_airport_module
  ON airport_intelligence_fetch_runs(airport_id, module_key);

CREATE INDEX IF NOT EXISTS idx_airport_intelligence_fetch_runs_module_status
  ON airport_intelligence_fetch_runs(module_key, run_status);

CREATE INDEX IF NOT EXISTS idx_airport_intelligence_fetch_runs_status_priority_created
  ON airport_intelligence_fetch_runs(run_status, priority, created_at);

CREATE INDEX IF NOT EXISTS idx_airport_intelligence_fetch_runs_lock_expires_at
  ON airport_intelligence_fetch_runs(lock_expires_at) WHERE lock_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_intelligence_fetch_runs_next_retry_at
  ON airport_intelligence_fetch_runs(next_retry_at) WHERE next_retry_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_intelligence_fetch_runs_source_type
  ON airport_intelligence_fetch_runs(source_type) WHERE source_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_intelligence_fetch_runs_produced_module_id
  ON airport_intelligence_fetch_runs(produced_module_id) WHERE produced_module_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_intelligence_fetch_runs_metadata_gin
  ON airport_intelligence_fetch_runs USING GIN(metadata);

CREATE UNIQUE INDEX IF NOT EXISTS idx_airport_intelligence_fetch_runs_active_dedupe
  ON airport_intelligence_fetch_runs(in_progress_key)
  WHERE run_status IN ('queued', 'running');
