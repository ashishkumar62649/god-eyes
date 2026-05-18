// Public profile service - handles cache logic and response building

import { PublicProfileResponse, PublicProfileStatus } from './types.js';
import * as repository from './repository.js';

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function isCacheStale(fetchedAt: string | null): boolean {
  if (!fetchedAt) return true;
  const fetched = new Date(fetchedAt).getTime();
  return Date.now() - fetched > CACHE_TTL_MS;
}

function buildFetchingResponse(airportId: string): PublicProfileResponse {
  return {
    status: 'fetching' as PublicProfileStatus,
    cached: false,
    profile: null,
    fetchedAt: null,
    expiresAt: null,
    attribution: null,
  };
}

function buildOkResponse(profile: PublicProfileResponse): PublicProfileResponse {
  return {
    ...profile,
    status: 'ok',
    cached: true,
  };
}

function buildStaleResponse(profile: PublicProfileResponse): PublicProfileResponse {
  return {
    ...profile,
    status: 'stale',
    cached: true,
  };
}

function buildNoProfileFoundResponse(): PublicProfileResponse {
  return {
    status: 'no_profile_found',
    cached: false,
    profile: null,
    fetchedAt: null,
    expiresAt: null,
    attribution: null,
  };
}

function buildLowConfidenceResponse(existing: PublicProfileResponse | null): PublicProfileResponse {
  return {
    status: 'low_confidence_match',
    cached: !!existing,
    profile: existing?.profile ?? null,
    fetchedAt: existing?.fetchedAt ?? null,
    expiresAt: existing?.expiresAt ?? null,
    attribution: existing?.attribution ?? null,
  };
}

function buildErrorResponse(message: string): PublicProfileResponse {
  return {
    status: 'error',
    cached: false,
    profile: null,
    fetchedAt: null,
    expiresAt: null,
    attribution: null,
  };
}

export async function handlePublicProfile(airportId: string): Promise<PublicProfileResponse> {
  try {
    // First resolve airport identity - airportId must exist in aviation_airports
    const identity = await repository.resolveAirportIdentity(airportId);
    if (!identity) {
      // Airport doesn't exist in our database
      return buildNoProfileFoundResponse();
    }

    // Check fresh cache first
    const cached = await repository.getCachedProfile(airportId);

    if (cached) {
      // Cache hit
      if (cached.status === 'no_profile_found') {
        return cached;
      }

      if (cached.status === 'low_confidence_match') {
        return buildLowConfidenceResponse(cached);
      }

      // Check if stale
      if (isCacheStale(cached.fetchedAt)) {
        // Stale cache - return stale data and queue refresh
        await repository.markStaleAndQueueRefresh(airportId);
        return buildStaleResponse(cached);
      }

      // Fresh cache hit
      return buildOkResponse(cached);
    }

    // Cache miss - check for stale profile
    const stale = await repository.getStaleProfile(airportId);
    if (stale) {
      // Return stale and queue refresh
      await repository.markStaleAndQueueRefresh(airportId);
      return buildStaleResponse(stale);
    }

    // No cache at all - check for in-progress fetch
    const hasInProgress = await repository.hasInProgressFetch(airportId);
    if (hasInProgress) {
      return buildFetchingResponse(airportId);
    }

    // No cache, no in-progress fetch - create fetch run and return fetching
    // TODO: Actual fetcher integration would go here
    await repository.createFetchRun(airportId);
    return buildFetchingResponse(airportId);
  } catch (error) {
    console.error('Public profile error:', error);
    return buildErrorResponse('Failed to fetch airport profile');
  }
}
