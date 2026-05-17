CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS fetch_runs (
  id TEXT PRIMARY KEY,
  layer_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  record_count INTEGER NOT NULL DEFAULT 0 CHECK (record_count >= 0),
  file_count INTEGER NOT NULL DEFAULT 0 CHECK (file_count >= 0),
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fetch_runs_layer_id
  ON fetch_runs(layer_id);

CREATE INDEX IF NOT EXISTS idx_fetch_runs_source_id
  ON fetch_runs(source_id);

CREATE INDEX IF NOT EXISTS idx_fetch_runs_layer_source_started
  ON fetch_runs(layer_id, source_id, started_at DESC);

CREATE TABLE IF NOT EXISTS raw_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fetch_run_id TEXT NOT NULL REFERENCES fetch_runs(id) ON DELETE CASCADE,
  layer_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  object_type TEXT NOT NULL,
  filename TEXT NOT NULL,
  storage_bucket TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  storage_uri TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL CHECK (byte_size > 0),
  checksum_sha256 TEXT NOT NULL CHECK (length(checksum_sha256) = 64),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (validation_status IN ('pending', 'valid', 'invalid')),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(fetch_run_id, filename),
  UNIQUE(storage_bucket, storage_key)
);

CREATE INDEX IF NOT EXISTS idx_raw_objects_fetch_run_id
  ON raw_objects(fetch_run_id);

CREATE INDEX IF NOT EXISTS idx_raw_objects_layer_id
  ON raw_objects(layer_id);

CREATE INDEX IF NOT EXISTS idx_raw_objects_source_id
  ON raw_objects(source_id);

CREATE INDEX IF NOT EXISTS idx_raw_objects_layer_source
  ON raw_objects(layer_id, source_id);

CREATE INDEX IF NOT EXISTS idx_raw_objects_raw_object_id
  ON raw_objects(id);
