CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS airport_public_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id TEXT NOT NULL DEFAULT 'layer_01_aviation',
  source_id TEXT NOT NULL,
  source_airport_id TEXT NOT NULL,
  airport_id UUID REFERENCES aviation_airports(id),
  airport_ident TEXT,
  iata_code TEXT,
  airport_name TEXT,
  iso_country TEXT,
  profile_status TEXT NOT NULL DEFAULT 'missing',
  cache_state TEXT NOT NULL DEFAULT 'empty',
  cache_ttl_seconds INTEGER NOT NULL DEFAULT 2592000,
  fetched_at TIMESTAMPTZ,
  last_successful_fetch_at TIMESTAMPTZ,
  stale_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  next_refresh_at TIMESTAMPTZ,
  refresh_error_count INTEGER NOT NULL DEFAULT 0,
  last_error_code TEXT,
  last_error_message TEXT,
  profile_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  profile_summary TEXT,
  source_urls JSONB NOT NULL DEFAULT '[]'::JSONB,
  source_attribution JSONB NOT NULL DEFAULT '{}'::JSONB,
  cache_key TEXT NOT NULL,
  content_hash TEXT,
  source_content_hash TEXT,
  current_version_id UUID,
  latest_fetch_run_id UUID,
  latest_successful_fetch_run_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT airport_public_profiles_layer_check
    CHECK (layer_id = 'layer_01_aviation'),
  CONSTRAINT airport_public_profiles_source_identity_key
    UNIQUE(layer_id, source_id, source_airport_id),
  CONSTRAINT airport_public_profiles_cache_key_key
    UNIQUE(cache_key),
  CONSTRAINT airport_public_profiles_profile_status_check
    CHECK (
      profile_status IN (
        'missing',
        'cached',
        'stale',
        'expired',
        'blocked',
        'failed',
        'review_required',
        'no_match'
      )
    ),
  CONSTRAINT airport_public_profiles_cache_state_check
    CHECK (
      cache_state IN (
        'empty',
        'fresh',
        'stale',
        'expired',
        'refreshing',
        'error'
      )
    ),
  CONSTRAINT airport_public_profiles_cache_ttl_seconds_check
    CHECK (cache_ttl_seconds > 0),
  CONSTRAINT airport_public_profiles_refresh_error_count_check
    CHECK (refresh_error_count >= 0)
);

CREATE TABLE IF NOT EXISTS airport_public_profile_fetch_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES airport_public_profiles(id) ON DELETE SET NULL,
  produced_version_id UUID,
  layer_id TEXT NOT NULL DEFAULT 'layer_01_aviation',
  source_id TEXT NOT NULL,
  source_airport_id TEXT NOT NULL,
  airport_ident TEXT,
  run_type TEXT NOT NULL,
  run_status TEXT NOT NULL DEFAULT 'queued',
  cache_result TEXT,
  idempotency_key TEXT,
  in_progress_key TEXT,
  lock_expires_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  requested_urls JSONB NOT NULL DEFAULT '[]'::JSONB,
  successful_urls JSONB NOT NULL DEFAULT '[]'::JSONB,
  failed_urls JSONB NOT NULL DEFAULT '[]'::JSONB,
  http_statuses JSONB NOT NULL DEFAULT '{}'::JSONB,
  fetcher_name TEXT,
  fetcher_version TEXT,
  parser_name TEXT,
  parser_version TEXT,
  records_examined INTEGER NOT NULL DEFAULT 0,
  bytes_fetched BIGINT NOT NULL DEFAULT 0,
  source_content_hash TEXT,
  normalized_content_hash TEXT,
  content_changed BOOLEAN,
  stale_before_run BOOLEAN NOT NULL DEFAULT false,
  stale_after_run BOOLEAN NOT NULL DEFAULT false,
  next_refresh_at TIMESTAMPTZ,
  retry_after_at TIMESTAMPTZ,
  error_code TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT airport_public_profile_fetch_runs_layer_check
    CHECK (layer_id = 'layer_01_aviation'),
  CONSTRAINT airport_public_profile_fetch_runs_idempotency_key_key
    UNIQUE(idempotency_key),
  CONSTRAINT airport_public_profile_fetch_runs_run_type_check
    CHECK (
      run_type IN (
        'initial_fetch',
        'lazy_fetch',
        'scheduled_refresh',
        'manual_refresh',
        'retry'
      )
    ),
  CONSTRAINT airport_public_profile_fetch_runs_run_status_check
    CHECK (
      run_status IN (
        'queued',
        'running',
        'completed',
        'failed',
        'skipped',
        'blocked',
        'no_match'
      )
    ),
  CONSTRAINT airport_public_profile_fetch_runs_cache_result_check
    CHECK (
      cache_result IS NULL
      OR cache_result IN (
        'created',
        'updated',
        'unchanged',
        'stale_marked',
        'expired_marked',
        'failed',
        'no_match'
      )
    ),
  CONSTRAINT airport_public_profile_fetch_runs_duration_ms_check
    CHECK (duration_ms IS NULL OR duration_ms >= 0),
  CONSTRAINT airport_public_profile_fetch_runs_records_examined_check
    CHECK (records_examined >= 0),
  CONSTRAINT airport_public_profile_fetch_runs_bytes_fetched_check
    CHECK (bytes_fetched >= 0)
);

CREATE TABLE IF NOT EXISTS airport_public_profile_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES airport_public_profiles(id) ON DELETE CASCADE,
  fetch_run_id UUID REFERENCES airport_public_profile_fetch_runs(id) ON DELETE SET NULL,
  layer_id TEXT NOT NULL DEFAULT 'layer_01_aviation',
  source_id TEXT NOT NULL,
  source_airport_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  previous_version_id UUID REFERENCES airport_public_profile_versions(id),
  is_current BOOLEAN NOT NULL DEFAULT false,
  version_status TEXT NOT NULL DEFAULT 'draft',
  profile_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  profile_summary TEXT,
  source_urls JSONB NOT NULL DEFAULT '[]'::JSONB,
  source_attribution JSONB NOT NULL DEFAULT '{}'::JSONB,
  raw_source_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  content_hash TEXT NOT NULL,
  source_content_hash TEXT,
  diff_from_previous JSONB NOT NULL DEFAULT '{}'::JSONB,
  change_summary TEXT,
  change_reason TEXT,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ,
  normalized_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'not_required',
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT airport_public_profile_versions_layer_check
    CHECK (layer_id = 'layer_01_aviation'),
  CONSTRAINT airport_public_profile_versions_profile_version_key
    UNIQUE(profile_id, version_number),
  CONSTRAINT airport_public_profile_versions_profile_content_hash_key
    UNIQUE(profile_id, content_hash),
  CONSTRAINT airport_public_profile_versions_version_number_check
    CHECK (version_number > 0),
  CONSTRAINT airport_public_profile_versions_version_status_check
    CHECK (
      version_status IN (
        'draft',
        'current',
        'superseded',
        'rejected',
        'archived'
      )
    ),
  CONSTRAINT airport_public_profile_versions_change_reason_check
    CHECK (
      change_reason IS NULL
      OR change_reason IN (
        'initial_fetch',
        'source_changed',
        'manual_review',
        'cache_refresh',
        'no_change_metadata_update'
      )
    ),
  CONSTRAINT airport_public_profile_versions_review_status_check
    CHECK (
      review_status IN (
        'not_required',
        'pending',
        'approved',
        'rejected'
      )
    )
);

CREATE INDEX IF NOT EXISTS idx_airport_public_profiles_airport_id
  ON airport_public_profiles(airport_id)
  WHERE airport_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_public_profiles_layer_source_object
  ON airport_public_profiles(layer_id, source_id, source_airport_id);

CREATE INDEX IF NOT EXISTS idx_airport_public_profiles_cache_state
  ON airport_public_profiles(cache_state);

CREATE INDEX IF NOT EXISTS idx_airport_public_profiles_profile_status
  ON airport_public_profiles(profile_status);

CREATE INDEX IF NOT EXISTS idx_airport_public_profiles_stale_at
  ON airport_public_profiles(stale_at)
  WHERE stale_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_public_profiles_next_refresh_at
  ON airport_public_profiles(next_refresh_at)
  WHERE next_refresh_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_public_profiles_current_version_id
  ON airport_public_profiles(current_version_id)
  WHERE current_version_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_public_profiles_latest_fetch_run_id
  ON airport_public_profiles(latest_fetch_run_id)
  WHERE latest_fetch_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_public_profiles_latest_successful_fetch_run_id
  ON airport_public_profiles(latest_successful_fetch_run_id)
  WHERE latest_successful_fetch_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_public_profile_versions_profile_id
  ON airport_public_profile_versions(profile_id);

CREATE INDEX IF NOT EXISTS idx_airport_public_profile_versions_fetch_run_id
  ON airport_public_profile_versions(fetch_run_id)
  WHERE fetch_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_public_profile_versions_source_identity
  ON airport_public_profile_versions(layer_id, source_id, source_airport_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_airport_public_profile_versions_current
  ON airport_public_profile_versions(profile_id)
  WHERE is_current;

CREATE INDEX IF NOT EXISTS idx_airport_public_profile_versions_created_at
  ON airport_public_profile_versions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_airport_public_profile_versions_fetched_at
  ON airport_public_profile_versions(fetched_at DESC)
  WHERE fetched_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_public_profile_versions_review_status
  ON airport_public_profile_versions(review_status);

CREATE INDEX IF NOT EXISTS idx_airport_public_profile_fetch_runs_profile_id
  ON airport_public_profile_fetch_runs(profile_id)
  WHERE profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_public_profile_fetch_runs_source_identity
  ON airport_public_profile_fetch_runs(layer_id, source_id, source_airport_id);

CREATE INDEX IF NOT EXISTS idx_airport_public_profile_fetch_runs_status_started
  ON airport_public_profile_fetch_runs(run_status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_airport_public_profile_fetch_runs_type_started
  ON airport_public_profile_fetch_runs(run_type, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_airport_public_profile_fetch_runs_completed_at
  ON airport_public_profile_fetch_runs(completed_at DESC)
  WHERE completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_public_profile_fetch_runs_cache_result
  ON airport_public_profile_fetch_runs(cache_result)
  WHERE cache_result IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_public_profile_fetch_runs_next_refresh_at
  ON airport_public_profile_fetch_runs(next_refresh_at)
  WHERE next_refresh_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_public_profile_fetch_runs_retry_after_at
  ON airport_public_profile_fetch_runs(retry_after_at)
  WHERE retry_after_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_public_profile_fetch_runs_error_code
  ON airport_public_profile_fetch_runs(error_code)
  WHERE error_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airport_public_profile_fetch_runs_produced_version_id
  ON airport_public_profile_fetch_runs(produced_version_id)
  WHERE produced_version_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_airport_public_profile_fetch_runs_in_progress
  ON airport_public_profile_fetch_runs(in_progress_key)
  WHERE run_status IN ('queued', 'running');
