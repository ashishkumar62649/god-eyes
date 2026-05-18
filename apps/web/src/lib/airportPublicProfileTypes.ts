// Local frontend types for GET /api/airports/:airportId/public-profile
// Mirrors apps/api/src/routes/public-profile/types.ts exactly.
// Replace with @god-eyes/contracts import once contracts package is updated.

export type AirportPublicProfileStatus =
  | 'ok'
  | 'stale'
  | 'fetching'
  | 'no_profile_found'
  | 'low_confidence_match'
  | 'error';

export interface PublicProfileAttribution {
  source: string;
  matchMethod: string;
  matchConfidence: string;
}

export interface PublicProfileData {
  id: string;
  name: string;
  iataCode: string | null;
  icaoCode: string | null;
  location: {
    latitude: number | null;
    longitude: number | null;
    city: string | null;
    country: string | null;
  };
  summary: string | null;
  facts: Record<string, unknown> | null;
}

export interface AirportPublicProfileResponse {
  status: AirportPublicProfileStatus;
  cached: boolean;
  profile: PublicProfileData | null;
  fetchedAt: string | null;
  expiresAt: string | null;
  attribution: PublicProfileAttribution | null;
}
