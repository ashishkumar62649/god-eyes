-- WO-032B: Airport Public Profile Cache Table
-- Stores enriched public profile data for airports
-- Sources: OurAirports (identity), English Wikipedia (summary), Wikidata (facts)

CREATE TABLE IF NOT EXISTS aviation_airport_public_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airport_id UUID NOT NULL REFERENCES aviation_airports(id) ON DELETE CASCADE,
  
  -- Profile content
  profile_data JSONB NOT NULL,
  
  -- Source tracking
  identity_source TEXT,          -- e.g., 'OurAirports'
  summary_source TEXT,           -- e.g., 'en.wikipedia.org'
  facts_source TEXT,             -- e.g., 'wikidata.org'
  
  -- Match metadata
  match_method TEXT,             -- 'exact', 'iata_match', 'icao_match', 'fuzzy', 'manual'
  match_confidence TEXT,         -- 'high', 'medium', 'low'
  
  -- Status sentinels
  status TEXT NOT NULL DEFAULT 'ok', -- 'ok', 'no_profile_found', 'low_confidence_match'
  
  -- Cache timing
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Fetch tracking
  fetch_run_id UUID,             -- Links to fetch_runs table if available
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(airport_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_aviation_public_profiles_airport_id
  ON aviation_airport_public_profiles(airport_id);

CREATE INDEX IF NOT EXISTS idx_aviation_public_profiles_status
  ON aviation_airport_public_profiles(status);

CREATE INDEX IF NOT EXISTS idx_aviation_public_profiles_expires_at
  ON aviation_airport_public_profiles(expires_at);

CREATE INDEX IF NOT EXISTS idx_aviation_public_profiles_match_confidence
  ON aviation_airport_public_profiles(match_confidence);

-- Track fetch runs for public profiles
CREATE TABLE IF NOT EXISTS aviation_public_profile_fetch_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airport_id UUID NOT NULL REFERENCES aviation_airports(id) ON DELETE CASCADE,
  
  status TEXT NOT NULL DEFAULT 'queued', -- 'queued', 'in_progress', 'completed', 'failed'
  
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aviation_fetch_runs_airport_id
  ON aviation_public_profile_fetch_runs(airport_id);

CREATE INDEX IF NOT EXISTS idx_aviation_fetch_runs_status
  ON aviation_public_profile_fetch_runs(status);

CREATE INDEX IF NOT EXISTS idx_aviation_fetch_runs_created_at
  ON aviation_public_profile_fetch_runs(created_at);
