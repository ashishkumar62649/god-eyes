// Public profile response types

export type PublicProfileStatus =
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

export interface PublicProfileResponse {
  status: PublicProfileStatus;
  cached: boolean;
  profile: PublicProfileData | null;
  fetchedAt: string | null;
  expiresAt: string | null;
  attribution: PublicProfileAttribution | null;
}
