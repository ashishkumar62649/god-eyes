// Public profile service - handles cache logic and response building

import { PublicProfileResponse, PublicProfileStatus, PublicProfileRepository } from './types.js';

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// TODO: Replace with actual repository implementation when DB migration is ready
let repository: PublicProfileRepository | null = null;

export function setPublicProfileRepository(repo: PublicProfileRepository): void {
  repository = repo;
}

function requireRepository(): PublicProfileRepository {
  if (!repository) {
    throw new Error('Public profile repository not initialized. DB migration WO-032B required.');
  }
  return repository;
}

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
    const repo = requireRepository();

    // Check cache first
    const cached = await repo.getCachedProfile(airportId);

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
        await repo.markStaleAndQueueRefresh(airportId);
        return buildStaleResponse(cached);
      }

      // Fresh cache hit
      return buildOkResponse(cached);
    }

    // Cache miss - start fetching
    // TODO: Implement async fetch/queue logic
    return buildFetchingResponse(airportId);
  } catch (error) {
    return buildErrorResponse('Failed to fetch airport profile');
  }
}
