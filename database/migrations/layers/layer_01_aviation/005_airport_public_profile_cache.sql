-- WO-032B: Airport Public Profile Cache Tables
-- Layer: layer_01_aviation
-- Purpose: Store cached airport public profiles from Wikipedia/Wikidata
-- Status: Additive, non-destructive. No mutations to existing aviation_airports.
-- Created: 2026-05-18

-- Create pgcrypto extension for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Table 1: airport_public_profiles
-- Stores current cache state for one airport public profile
CREATE TABLE IF NOT EXISTS airport_public_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id TEXT NOT NULL DEFAULT 'layer_01_aviation',
  source_id TEXT NOT NULL DEFAULT 'ourairports',
  source_airport_id TEXT NOT NULL,
  airport_id UUID REFERENCES aviation_airports(id),
  airport_ident TEXT,
  iata_code TEXT,
  airport_name TEXT,
  iso_country TEXT,
  profile_status TEXT NOT NULL DEFAULT 'missing',
  visibility_status TEXT NOT NULL DEFAULT 'internal',
  current_version_id UUID,
  latest_fetch_run_id UUID,
  latest_successful_fetch_run_id UUID,
  profile_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  profile_summary TEXT,
  wikipedia_page_title TEXT,
  wikipedia_page_id TEXT,
  wikipedia_revision_id TEXT,
  wikipedia_url TEXT,
  wikidata_qid TEXT,
  wikidata_revision_id TEXT,
  wikidata_url TEXT,
  source_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_attribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  cache_key TEXT NOT NULL,
  cache_state TEXT NOT NULL DEFAULT 'empty',
  cache_ttl_seconds INTEGER NOT NULL DEFAULT 2592000,
  stale_while_revalidate_seconds INTEGER DEFAULT 86400,
  fetched_at TIMESTAMPTZ,
  last_successful_fetch_at TIMESTAMPTZ,
  last_changed_at TIMESTAMPTZ,
  stale_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  next_refresh_at TIMESTAMPTZ,
  refresh_priority INTEGER NOT NULL DEFAULT 100,
  refresh_error_count INTEGER NOT NULL DEFAULT 0,
  last_error_code TEXT,
  last_error_message TEXT,
  content_hash TEXT,
  source_content_hash TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT airport_public_profiles_source_identity_key UNIQUE(layer_id, source_id, source_airport_id),
  CONSTRAINT airport_public_profiles_cache_key_key UNIQUE(cache_key)
);

-- Indexes for airport_public_profiles
CREATE INDEX IF NOT EXISTS idx_airport_public_profiles_layer_source_object
  ON airport_public_profiles(layer_id, source_id, source_airport_id);

CREATE INDEX IF NOT EXISTS idx_airport_public_profiles_airport_id
  ON airport_public_profiles(airport_id) WHERE airport_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_public_profiles_cache_state
  ON airport_public_profiles(cache_state);

CREATE INDEX IF NOT EXISTS idx_airport_public_profiles_profile_status
  ON airport_public_profiles(profile_status);

CREATE INDEX IF NOT EXISTS idx_airport_public_profiles_stale_at
  ON airport_public_profiles(stale_at) WHERE stale_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_public_profiles_next_refresh_at
  ON airport_public_profiles(next_refresh_at, refresh_priority) WHERE next_refresh_at IS NOT NULL;

-- Table 2: airport_public_profile_versions
-- Stores append-only history for public profile payloads
CREATE TABLE IF NOT EXISTS airport_public_profile_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL,
  fetch_run_id UUID,
  layer_id TEXT NOT NULL DEFAULT 'layer_01_aviation',
  source_id TEXT NOT NULL DEFAULT 'ourairports',
  source_airport_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  previous_version_id UUID,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  version_status TEXT NOT NULL DEFAULT 'current',
  profile_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  profile_summary TEXT,
  wikipedia_page_title TEXT,
  wikipedia_page_id TEXT,
  wikipedia_revision_id TEXT,
  wikipedia_url TEXT,
  wikidata_qid TEXT,
  wikidata_revision_id TEXT,
  wikidata_url TEXT,
  source_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_attribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_hash TEXT NOT NULL,
  source_content_hash TEXT,
  diff_from_previous JSONB NOT NULL DEFAULT '{}'::jsonb,
  change_summary TEXT,
  change_reason TEXT,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ,
  normalized_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_by TEXT NOT NULL DEFAULT 'fetcher',
  review_status TEXT NOT NULL DEFAULT 'not_required',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT airport_public_profile_versions_profile_version_key UNIQUE(profile_id, version_number),
  CONSTRAINT airport_public_profile_versions_profile_content_hash_key UNIQUE(profile_id, content_hash)
);

-- Partial unique index for current version
CREATE UNIQUE INDEX IF NOT EXISTS idx_airport_public_profile_versions_current
  ON airport_public_profile_versions(profile_id) WHERE is_current = TRUE;

-- Indexes for airport_public_profile_versions
CREATE INDEX IF NOT EXISTS idx_airport_public_profile_versions_profile_id
  ON airport_public_profile_versions(profile_id);

CREATE INDEX IF NOT EXISTS idx_airport_public_profile_versions_fetch_run_id
  ON airport_public_profile_versions(fetch_run_id) WHERE fetch_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_public_profile_versions_source_identity
  ON airport_public_profile_versions(layer_id, source_id, source_airport_id);

CREATE INDEX IF NOT EXISTS idx_airport_public_profile_versions_created_at
  ON airport_public_profile_versions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_airport_public_profile_versions_fetched_at
  ON airport_public_profile_versions(fetched_at DESC) WHERE fetched_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_public_profile_versions_valid_range
  ON airport_public_profile_versions(profile_id, valid_from DESC, valid_to);

CREATE INDEX IF NOT EXISTS idx_airport_public_profile_versions_content_hash
  ON airport_public_profile_versions(content_hash);

CREATE INDEX IF NOT EXISTS idx_airport_public_profile_versions_review_status
  ON airport_public_profile_versions(review_status);

-- Table 3: airport_public_profile_fetch_runs
-- Tracks every fetch attempt, including failures, in-progress runs, and no-match results
CREATE TABLE IF NOT EXISTS airport_public_profile_fetch_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID,
  produced_version_id UUID,
  layer_id TEXT NOT NULL DEFAULT 'layer_01_aviation',
  source_id TEXT NOT NULL DEFAULT 'ourairports',
  source_airport_id TEXT NOT NULL,
  airport_ident TEXT,
  run_type TEXT NOT NULL DEFAULT 'scheduled_refresh',
  run_status TEXT NOT NULL DEFAULT 'queued',
  cache_result TEXT,
  idempotency_key TEXT NOT NULL,
  in_progress_key TEXT NOT NULL,
  lock_expires_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  requested_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  successful_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  failed_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  http_statuses JSONB NOT NULL DEFAULT '{}'::jsonb,
  fetcher_name TEXT,
  fetcher_version TEXT,
  parser_name TEXT,
  parser_version TEXT,
  wikipedia_page_title TEXT,
  wikipedia_revision_id TEXT,
  wikidata_qid TEXT,
  wikidata_revision_id TEXT,
  records_examined INTEGER NOT NULL DEFAULT 0,
  bytes_fetched BIGINT NOT NULL DEFAULT 0,
  source_content_hash TEXT,
  normalized_content_hash TEXT,
  content_changed BOOLEAN,
  stale_before_run BOOLEAN NOT NULL DEFAULT FALSE,
  stale_after_run BOOLEAN NOT NULL DEFAULT FALSE,
  next_refresh_at TIMESTAMPTZ,
  retry_after_at TIMESTAMPTZ,
  error_code TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT airport_public_profile_fetch_runs_idempotency_key_key UNIQUE(idempotency_key)
);

-- Partial unique index for in-progress deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_airport_public_profile_fetch_runs_in_progress
  ON airport_public_profile_fetch_runs(in_progress_key) WHERE run_status IN ('queued', 'running');

-- Indexes for airport_public_profile_fetch_runs
CREATE INDEX IF NOT EXISTS idx_airport_public_profile_fetch_runs_profile_id
  ON airport_public_profile_fetch_runs(profile_id) WHERE profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_public_profile_fetch_runs_source_identity
  ON airport_public_profile_fetch_runs(layer_id, source_id, source_airport_id);

CREATE INDEX IF NOT EXISTS idx_airport_public_profile_fetch_runs_status_started
  ON airport_public_profile_fetch_runs(run_status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_airport_public_profile_fetch_runs_type_started
  ON airport_public_profile_fetch_runs(run_type, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_airport_public_profile_fetch_runs_completed_at
  ON airport_public_profile_fetch_runs(completed_at DESC) WHERE completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_public_profile_fetch_runs_cache_result
  ON airport_public_profile_fetch_runs(cache_result);

CREATE INDEX IF NOT EXISTS idx_airport_public_profile_fetch_runs_next_refresh_at
  ON airport_public_profile_fetch_runs(next_refresh_at) WHERE next_refresh_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_public_profile_fetch_runs_retry_after_at
  ON airport_public_profile_fetch_runs(retry_after_at) WHERE retry_after_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_public_profile_fetch_runs_error_code
  ON airport_public_profile_fetch_runs(error_code) WHERE error_code IS NOT NULL;

-- Foreign key constraints (added after all tables exist)
ALTER TABLE airport_public_profile_versions
  ADD CONSTRAINT fk_airport_public_profile_versions_profile_id
  FOREIGN KEY (profile_id) REFERENCES airport_public_profiles(id) ON DELETE CASCADE;

ALTER TABLE airport_public_profile_fetch_runs
  ADD CONSTRAINT fk_airport_public_profile_fetch_runs_profile_id
  FOREIGN KEY (profile_id) REFERENCES airport_public_profiles(id) ON DELETE SET NULL;
