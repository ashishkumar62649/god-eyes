// Public profile repository - DB-backed implementation
// Matches approved WO-032B schema:
// - airport_public_profiles (has airport_id FK to aviation_airports)
// - airport_public_profile_fetch_runs (uses profile_id, NOT airport_id)
// - airport_public_profile_versions

import { query } from '../../lib/db.js';
import {
  PublicProfileResponse,
  PublicProfileStatus,
  PublicProfileData,
  PublicProfileAttribution,
} from './types.js';

const AVIATION_LAYER = 'layer_01_aviation';
const DEFAULT_SOURCE = 'ourairports';

interface AirportIdentityRow {
  id: string;
  source_id: string;
  source_airport_id: string;
  ident: string;
  iata_code: string | null;
  name: string;
  iso_country: string | null;
  municipality: string | null;
}

interface ProfileRow {
  id: string;
  airport_id: string | null;
  layer_id: string;
  source_id: string;
  source_airport_id: string;
  airport_ident: string | null;
  profile_status: string;
  cache_state: string;
  stale_at: Date | string | null;
  expires_at: Date | string | null;
  fetched_at: Date | string | null;
  profile_payload: Record<string, unknown>;
  profile_summary: string | null;
  source_attribution: Record<string, unknown>;
  source_urls: Record<string, unknown>[];
  current_version_id: string | null;
  latest_fetch_run_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface FetchRunRow {
  id: string;
  profile_id: string | null;
  layer_id: string;
  source_id: string;
  source_airport_id: string;
  airport_ident: string | null;
  run_type: string;
  run_status: string;
  started_at: Date | string;
  completed_at: Date | string | null;
  error_message: string | null;
  created_at: Date | string;
}

function toDate(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function mapProfileStatusToResponseStatus(profileStatus: string, cacheState: string): PublicProfileStatus {
  if (profileStatus === 'missing' || profileStatus === 'no_match') {
    return 'no_profile_found';
  }
  if (profileStatus === 'review_required') {
    return 'low_confidence_match';
  }
  if (cacheState === 'stale' || cacheState === 'expired') {
    return 'stale';
  }
  if (cacheState === 'fresh') {
    return 'ok';
  }
  return 'ok';
}

function rowToResponse(row: ProfileRow): PublicProfileResponse {
  const status = mapProfileStatusToResponseStatus(row.profile_status, row.cache_state);
  const profilePayload = row.profile_payload as unknown as PublicProfileData | null;
  const sourceAttr = row.source_attribution as unknown as PublicProfileAttribution | null;

  return {
    status,
    cached: row.cache_state === 'fresh' || row.cache_state === 'stale',
    profile: profilePayload,
    fetchedAt: toDate(row.fetched_at),
    expiresAt: toDate(row.expires_at),
    attribution: sourceAttr ?? (row.source_id ? {
      source: row.source_id,
      matchMethod: 'exact',
      matchConfidence: 'high',
    } : null),
  };
}

export async function resolveAirportIdentity(airportId: string): Promise<AirportIdentityRow | null> {
  const rows = await query<AirportIdentityRow>(
    `SELECT id, source_id, source_airport_id, ident, iata_code, name, iso_country, municipality
     FROM aviation_airports
     WHERE id = $1`,
    [airportId]
  );

  return rows.length > 0 ? rows[0] : null;
}

export async function getCachedProfile(airportId: string): Promise<PublicProfileResponse | null> {
  const rows = await query<ProfileRow>(
    `SELECT * FROM airport_public_profiles
     WHERE airport_id = $1
     AND cache_state IN ('fresh', 'stale')
     AND (expires_at IS NULL OR expires_at > NOW())
     LIMIT 1`,
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
     ORDER BY fetched_at DESC
     LIMIT 1`,
    [airportId]
  );

  if (rows.length === 0) {
    return null;
  }

  return rowToResponse(rows[0]);
}

export async function getProfileById(airportId: string): Promise<ProfileRow | null> {
  const rows = await query<ProfileRow>(
    `SELECT * FROM airport_public_profiles
     WHERE airport_id = $1
     LIMIT 1`,
    [airportId]
  );

  return rows.length > 0 ? rows[0] : null;
}

export async function markStaleAndQueueRefresh(airportId: string): Promise<void> {
  // First get the profile to find profile_id and source identity
  const profile = await getProfileById(airportId);
  if (!profile) return;

  // Create a fetch run using profile_id and source identity
  await query(
    `INSERT INTO airport_public_profile_fetch_runs (
      profile_id, layer_id, source_id, source_airport_id, airport_ident,
      run_type, run_status, started_at
    ) VALUES ($1, $2, $3, $4, $5, 'scheduled_refresh', 'queued', NOW())`,
    [
      profile.id,
      AVIATION_LAYER,
      profile.source_id,
      profile.source_airport_id,
      profile.airport_ident,
    ]
  );
}

export async function hasInProgressFetch(airportId: string): Promise<boolean> {
  // Check fetch runs via profile_id (fetch_runs does NOT have airport_id column)
  const rows = await query<FetchRunRow>(
    `SELECT fr.id
     FROM airport_public_profile_fetch_runs fr
     INNER JOIN airport_public_profiles p ON fr.profile_id = p.id
     WHERE p.airport_id = $1
     AND fr.run_status IN ('queued', 'running')
     AND fr.started_at > NOW() - INTERVAL '1 hour'
     ORDER BY fr.started_at DESC
     LIMIT 1`,
    [airportId]
  );

  return rows.length > 0;
}

export async function createFetchRun(airportId: string): Promise<string> {
  // First resolve airport identity
  const identity = await resolveAirportIdentity(airportId);
  if (!identity) {
    throw new Error(`Airport not found: ${airportId}`);
  }

  // Check if profile already exists
  const existingProfile = await getProfileById(airportId);

  const rows = await query<FetchRunRow>(
    `INSERT INTO airport_public_profile_fetch_runs (
      profile_id, layer_id, source_id, source_airport_id, airport_ident,
      run_type, run_status, started_at
    ) VALUES ($1, $2, $3, $4, $5, 'lazy_fetch', 'running', NOW())
    RETURNING id`,
    [
      existingProfile?.id ?? null,
      AVIATION_LAYER,
      identity.source_id ?? DEFAULT_SOURCE,
      identity.source_airport_id,
      identity.ident,
    ]
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
  const staleAt = new Date(now.getTime() + ttlMs);
  const expiresAt = new Date(now.getTime() + ttlMs * 1.5);

  const identity = await resolveAirportIdentity(airportId);
  if (!identity) {
    throw new Error(`Airport not found: ${airportId}`);
  }

  const rows = await query<ProfileRow>(
    `INSERT INTO airport_public_profiles (
      airport_id, layer_id, source_id, source_airport_id, airport_ident,
      profile_payload, profile_summary, source_attribution,
      profile_status, cache_state,
      fetched_at, stale_at, expires_at,
      cache_key
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    ON CONFLICT (layer_id, source_id, source_airport_id) DO UPDATE SET
      profile_payload = EXCLUDED.profile_payload,
      profile_summary = EXCLUDED.profile_summary,
      source_attribution = EXCLUDED.source_attribution,
      profile_status = EXCLUDED.profile_status,
      cache_state = EXCLUDED.cache_state,
      fetched_at = EXCLUDED.fetched_at,
      stale_at = EXCLUDED.stale_at,
      expires_at = EXCLUDED.expires_at,
      updated_at = NOW()
    RETURNING *`,
    [
      airportId,
      AVIATION_LAYER,
      attribution.source,
      identity.source_airport_id,
      identity.ident,
      profile,
      profile.summary ?? null,
      attribution,
      'cached',
      'fresh',
      now,
      staleAt,
      expiresAt,
      `${AVIATION_LAYER}:${attribution.source}:${identity.source_airport_id}`,
    ]
  );

  return rowToResponse(rows[0]);
}

export async function saveNoProfileFound(airportId: string): Promise<PublicProfileResponse> {
  const now = new Date();
  const staleAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours for negative cache

  const identity = await resolveAirportIdentity(airportId);
  if (!identity) {
    throw new Error(`Airport not found: ${airportId}`);
  }

  const rows = await query<ProfileRow>(
    `INSERT INTO airport_public_profiles (
      airport_id, layer_id, source_id, source_airport_id, airport_ident,
      profile_payload, profile_status, cache_state,
      fetched_at, stale_at, cache_key
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (layer_id, source_id, source_airport_id) DO UPDATE SET
      profile_status = EXCLUDED.profile_status,
      cache_state = EXCLUDED.cache_state,
      fetched_at = EXCLUDED.fetched_at,
      stale_at = EXCLUDED.stale_at,
      updated_at = NOW()
    RETURNING *`,
    [
      airportId,
      AVIATION_LAYER,
      DEFAULT_SOURCE,
      identity.source_airport_id,
      identity.ident,
      {},
      'missing',
      'empty',
      now,
      staleAt,
      `${AVIATION_LAYER}:${DEFAULT_SOURCE}:${identity.source_airport_id}`,
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
  const staleAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days for low confidence

  const identity = await resolveAirportIdentity(airportId);
  if (!identity) {
    throw new Error(`Airport not found: ${airportId}`);
  }

  const rows = await query<ProfileRow>(
    `INSERT INTO airport_public_profiles (
      airport_id, layer_id, source_id, source_airport_id, airport_ident,
      profile_payload, source_attribution,
      profile_status, cache_state,
      fetched_at, stale_at, cache_key
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (layer_id, source_id, source_airport_id) DO UPDATE SET
      profile_payload = EXCLUDED.profile_payload,
      source_attribution = EXCLUDED.source_attribution,
      profile_status = EXCLUDED.profile_status,
      cache_state = EXCLUDED.cache_state,
      fetched_at = EXCLUDED.fetched_at,
      stale_at = EXCLUDED.stale_at,
      updated_at = NOW()
    RETURNING *`,
    [
      airportId,
      AVIATION_LAYER,
      attribution.source,
      identity.source_airport_id,
      identity.ident,
      profile ?? {},
      attribution,
      'review_required',
      'fresh',
      now,
      staleAt,
      `${AVIATION_LAYER}:${attribution.source}:${identity.source_airport_id}`,
    ]
  );

  return rowToResponse(rows[0]);
}
