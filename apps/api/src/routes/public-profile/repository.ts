// Public profile repository - DB-backed implementation

import { query } from '../../lib/db.js';
import {
  PublicProfileResponse,
  PublicProfileStatus,
  PublicProfileData,
  PublicProfileAttribution,
} from './types.js';

interface ProfileRow {
  id: string;
  airport_id: string;
  profile_data: Record<string, unknown>;
  identity_source: string | null;
  summary_source: string | null;
  facts_source: string | null;
  match_method: string | null;
  match_confidence: string | null;
  status: string;
  fetched_at: Date | string;
  expires_at: Date | string;
  fetch_run_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface FetchRunRow {
  id: string;
  airport_id: string;
  status: string;
  started_at: Date | string | null;
  completed_at: Date | string | null;
  error_message: string | null;
  retry_count: number;
  created_at: Date | string;
  updated_at: Date | string;
}

function toDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function rowToResponse(row: ProfileRow): PublicProfileResponse {
  const profileData = row.profile_data as unknown as PublicProfileData | null;
  
  return {
    status: row.status as PublicProfileStatus,
    cached: true,
    profile: profileData,
    fetchedAt: toDate(row.fetched_at),
    expiresAt: toDate(row.expires_at),
    attribution: row.match_method ? {
      source: row.identity_source ?? 'unknown',
      matchMethod: row.match_method,
      matchConfidence: row.match_confidence ?? 'unknown',
    } : null,
  };
}

export async function getCachedProfile(airportId: string): Promise<PublicProfileResponse | null> {
  const rows = await query<ProfileRow>(
    `SELECT * FROM airport_public_profiles 
     WHERE airport_id = $1 
     AND expires_at > NOW()`,
    [airportId]
  );

  if (rows.length === 0) {
    return null;
  }

  return rowToResponse(rows[0]);
}

export async function getStaleProfile(airportId: string): Promise<PublicProfileResponse | null> {
  const rows = await query<ProfileRow>(
    `SELECT * FROM airport_public_profiles 
     WHERE airport_id = $1 
     ORDER BY expires_at DESC 
     LIMIT 1`,
    [airportId]
  );

  if (rows.length === 0) {
    return null;
  }

  return rowToResponse(rows[0]);
}

export async function markStaleAndQueueRefresh(airportId: string): Promise<void> {
  // Create a new fetch run for background refresh
  await query(
    `INSERT INTO airport_public_profile_fetch_runs (airport_id, status, started_at)
     VALUES ($1, 'queued', NULL)`,
    [airportId]
  );
}

export async function hasInProgressFetch(airportId: string): Promise<boolean> {
  const rows = await query<FetchRunRow>(
    `SELECT id FROM airport_public_profile_fetch_runs 
     WHERE airport_id = $1 
     AND status IN ('queued', 'in_progress')
     AND created_at > NOW() - INTERVAL '1 hour'
     ORDER BY created_at DESC 
     LIMIT 1`,
    [airportId]
  );

  return rows.length > 0;
}

export async function createFetchRun(airportId: string): Promise<string> {
  const rows = await query<FetchRunRow>(
    `INSERT INTO airport_public_profile_fetch_runs (airport_id, status, started_at)
     VALUES ($1, 'in_progress', NOW())
     RETURNING id`,
    [airportId]
  );

  return rows[0].id;
}

export async function saveProfile(
  airportId: string,
  profile: PublicProfileData,
  attribution: PublicProfileAttribution,
  ttlMs: number = 30 * 24 * 60 * 60 * 1000 // 30 days
): Promise<PublicProfileResponse> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  const rows = await query<ProfileRow>(
    `INSERT INTO airport_public_profiles (
      airport_id,
      profile_data,
      identity_source,
      summary_source,
      facts_source,
      match_method,
      match_confidence,
      status,
      fetched_at,
      expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (airport_id) DO UPDATE SET
      profile_data = EXCLUDED.profile_data,
      identity_source = EXCLUDED.identity_source,
      summary_source = EXCLUDED.summary_source,
      facts_source = EXCLUDED.facts_source,
      match_method = EXCLUDED.match_method,
      match_confidence = EXCLUDED.match_confidence,
      status = EXCLUDED.status,
      fetched_at = EXCLUDED.fetched_at,
      expires_at = EXCLUDED.expires_at,
      updated_at = NOW()
    RETURNING *`,
    [
      airportId,
      profile,
      attribution.source,
      null, // summary_source - would be set by fetcher
      null, // facts_source - would be set by fetcher
      attribution.matchMethod,
      attribution.matchConfidence,
      'ok',
      now,
      expiresAt,
    ]
  );

  return rowToResponse(rows[0]);
}

export async function saveNoProfileFound(airportId: string): Promise<PublicProfileResponse> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours for negative cache

  const rows = await query<ProfileRow>(
    `INSERT INTO airport_public_profiles (
      airport_id,
      profile_data,
      status,
      fetched_at,
      expires_at
    ) VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (airport_id) DO UPDATE SET
      status = EXCLUDED.status,
      fetched_at = EXCLUDED.fetched_at,
      expires_at = EXCLUDED.expires_at,
      updated_at = NOW()
    RETURNING *`,
    [
      airportId,
      null,
      'no_profile_found',
      now,
      expiresAt,
    ]
  );

  return rowToResponse(rows[0]);
}

export async function saveLowConfidenceMatch(
  airportId: string,
  profile: PublicProfileData | null,
  attribution: PublicProfileAttribution
): Promise<PublicProfileResponse> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days for low confidence

  const rows = await query<ProfileRow>(
    `INSERT INTO airport_public_profiles (
      airport_id,
      profile_data,
      identity_source,
      match_method,
      match_confidence,
      status,
      fetched_at,
      expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (airport_id) DO UPDATE SET
      profile_data = EXCLUDED.profile_data,
      identity_source = EXCLUDED.identity_source,
      match_method = EXCLUDED.match_method,
      match_confidence = EXCLUDED.match_confidence,
      status = EXCLUDED.status,
      fetched_at = EXCLUDED.fetched_at,
      expires_at = EXCLUDED.expires_at,
      updated_at = NOW()
    RETURNING *`,
    [
      airportId,
      profile,
      attribution.source,
      attribution.matchMethod,
      attribution.matchConfidence,
      'low_confidence_match',
      now,
      expiresAt,
    ]
  );

  return rowToResponse(rows[0]);
}
