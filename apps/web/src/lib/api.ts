import type {
  LayerObjectsListResponse,
  AirportObject,
  AirportDetailResponse,
  LayerStatusResponse,
  LayerRegistryResponse,
  EarthEventsLatestResponse,
  BordersBoundariesFeatureCollection,
} from '@god-eyes/contracts';
import type { AirportPublicProfileResponse } from './airportPublicProfileTypes';
import type { AirportIntelligenceResponse } from './airportIntelligenceTypes';
import type { AirportLayoutFeaturesResponse } from './airportLayoutTypes';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
const CACHE_TTL_MS = 60_000;
const CACHE_MAX = 50;
const CONCURRENCY_LIMIT = 4;

interface CacheEntry {
  data: AirportObject[];
  ts: number;
}
const responseCache = new Map<string, CacheEntry>();

function pruneCache(): void {
  if (responseCache.size <= CACHE_MAX) return;
  const oldest = responseCache.keys().next().value;
  if (oldest) responseCache.delete(oldest);
}

export function clearAviationCache(): void {
  responseCache.clear();
}

export async function fetchAirports(limit: number = 500): Promise<AirportObject[]> {
  const url = `${API_BASE_URL}/api/layers/layer_01_aviation/objects?objectType=airport&mode=points&limit=${limit}`;

  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to fetch airports: ${response.status}`);
  }

  const data: LayerObjectsListResponse = await response.json();
  const airports = data.items.filter((item: any): item is AirportObject => item.objectType === 'airport');
  return airports;
}

export async function fetchAviationLayerObjects(
  mode: 'points' | 'clusters',
  bbox: string,
  zoom?: number,
  limit: number = 1000,
  abortSignal?: AbortSignal,
  search?: string,
  category?: string,
  fields?: string,
  offset?: number,
): Promise<LayerObjectsListResponse> {
  const url = new URL(`${API_BASE_URL}/api/layers/layer_01_aviation/objects`);
  url.searchParams.append('objectType', 'airport');
  url.searchParams.append('mode', mode);
  url.searchParams.append('bbox', bbox);

  if (fields) {
    url.searchParams.append('fields', fields);
  }
  if (search) {
    url.searchParams.append('search', search);
  }
  if (category) {
    url.searchParams.append('category', category);
  }
  if (mode === 'points') {
    url.searchParams.append('limit', limit.toString());
  } else if (mode === 'clusters' && zoom !== undefined) {
    url.searchParams.append('zoom', zoom.toString());
  }
  if (offset !== undefined && offset > 0) {
    url.searchParams.append('offset', offset.toString());
  }

  const response = await fetch(url.toString(), { signal: abortSignal });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to fetch aviation objects: ${response.status}`);
  }

  return await response.json();
}

// Fetch multiple backend categories in parallel (one request per category).
// API supports only ONE category per request. Uses client-side cache + concurrency limit.
export async function fetchAviationCategoryBatch(
  bbox: string,
  mode: 'points' | 'clusters',
  categories: string[],
  limit: number = 1000,
  abortSignal?: AbortSignal,
  zoom?: number,
  requestKey?: string,
): Promise<AirportObject[]> {
  if (categories.length === 0) return [];

  // Check response cache
  if (requestKey) {
    const cached = responseCache.get(requestKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  const seen = new Set<string>();
  const merged: AirportObject[] = [];

  // Process categories with concurrency limit
  const queue = [...categories];
  const workers: Promise<void>[] = [];
  for (let i = 0; i < CONCURRENCY_LIMIT; i++) {
    workers.push((async () => {
      while (queue.length > 0) {
        const cat = queue.shift()!;
        if (abortSignal?.aborted) return;
        try {
          const response = await fetchAviationLayerObjects(
            mode, bbox, zoom, limit, abortSignal, undefined, cat, 'marker',
          );
          for (const item of response.items) {
            if (item.objectType !== 'airport') continue;
            if (seen.has(item.id)) continue;
            seen.add(item.id);
            merged.push(item);
          }
        } catch (err: any) {
          if (err.name === 'AbortError') return;
          throw err;
        }
      }
    })());
  }
  await Promise.all(workers);

  // Store in cache
  if (requestKey) {
    pruneCache();
    responseCache.set(requestKey, { data: merged, ts: Date.now() });
  }

  return merged;
}

export async function fetchLayerStatus(layerId: string): Promise<LayerStatusResponse> {
  const url = `${API_BASE_URL}/api/layers/${layerId}/status`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch layer status: ${response.status}`);
  }

  return response.json();
}

export async function fetchLayerRegistry(): Promise<LayerRegistryResponse> {
  const url = `${API_BASE_URL}/api/layers/registry`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch layer registry: ${response.status}`);
  }
  return response.json();
}

export async function fetchEarthEventsLatest(
  params: { limit?: number; event_type?: string } = {},
  abortSignal?: AbortSignal,
): Promise<EarthEventsLatestResponse> {
  const url = new URL(`${API_BASE_URL}/api/earth-events/latest`);
  url.searchParams.set('event_type', params.event_type ?? 'earthquake');
  url.searchParams.set('limit', String(Math.min(params.limit ?? 200, 200)));
  const response = await fetch(url.toString(), { signal: abortSignal });
  if (!response.ok) {
    throw new Error(`Failed to fetch earth events: ${response.status}`);
  }
  return response.json();
}

export async function fetchBordersBoundariesCountries(
  params: { limit?: number; simplify?: number } = {},
  abortSignal?: AbortSignal,
): Promise<BordersBoundariesFeatureCollection> {
  const url = new URL(`${API_BASE_URL}/api/borders-boundaries/countries`);
  url.searchParams.set('limit', String(params.limit ?? 250));
  url.searchParams.set('simplify', String(params.simplify ?? 0.05));
  const response = await fetch(url.toString(), { signal: abortSignal });
  if (!response.ok) {
    throw new Error(`Failed to fetch borders: ${response.status}`);
  }
  return response.json();
}

export async function fetchAviationPreload(
  category: string,
  abortSignal?: AbortSignal,
): Promise<LayerObjectsListResponse> {
  const url = new URL(`${API_BASE_URL}/api/layers/layer_01_aviation/objects`);
  url.searchParams.append('objectType', 'airport');
  url.searchParams.append('mode', 'preload');
  url.searchParams.append('category', category);

  const response = await fetch(url.toString(), { signal: abortSignal });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to preload aviation category: ${response.status}`);
  }

  return await response.json();
}

export async function fetchAirportDetail(
  objectId: string,
  abortSignal?: AbortSignal
): Promise<AirportDetailResponse> {
  const url = `${API_BASE_URL}/api/layers/layer_01_aviation/objects/${objectId}/detail`;

  const response = await fetch(url, { signal: abortSignal });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to fetch airport detail: ${response.status}`);
  }

  return response.json();
}

export async function fetchAirportPublicProfile(
  airportId: string,
  abortSignal?: AbortSignal,
): Promise<AirportPublicProfileResponse> {
  const url = `${API_BASE_URL}/api/airports/${encodeURIComponent(airportId)}/public-profile`;
  const response = await fetch(url, { signal: abortSignal });
  // The API returns a typed body even on 4xx/5xx — parse it directly.
  // Only throw on network-level failures (response not received).
  const body: AirportPublicProfileResponse = await response.json().catch(() => {
    throw new Error(`Failed to fetch airport public profile: ${response.status}`);
  });
  return body;
}

export async function getAirportIntelligence(
  airportId: string,
  abortSignal?: AbortSignal,
): Promise<AirportIntelligenceResponse> {
  const url = `${API_BASE_URL}/api/airports/${encodeURIComponent(airportId)}/intelligence`;
  const response = await fetch(url, { signal: abortSignal });
  const body = await response.json().catch(() => {
    throw new Error(`Failed to fetch airport intelligence: ${response.status}`);
  });

  // Normalize mapPopup to match AirportIntelMapPopup — support both API shapes.
  if (body?.mapPopup) {
    const p = body.mapPopup;
    const qs = p.quickStats ?? {};
    body.mapPopup = {
      ...p,
      iataCode:        p.iataCode        ?? p.iata             ?? null,
      icaoCode:        p.icaoCode        ?? p.icao             ?? null,
      imageUrl:        p.imageUrl        ?? p.image_url        ?? null,
      shortSummary:    p.shortSummary    ?? p.short_summary    ?? null,
      confidenceLabel: p.confidenceLabel ?? p.confidence_label ?? null,
      runwayCount:     p.runwayCount     ?? qs.runwayCount     ?? null,
      longestRunwayFt: p.longestRunwayFt ?? qs.longestRunwayFt ?? null,
      badges:          Array.isArray(p.badges) ? p.badges : [],
    };
  }

  // Normalize images field — ensure items is always an array.
  if (body?.images) {
    const img = body.images;
    body.images = {
      status:    img.status ?? 'no_data',
      heroImage: img.heroImage ?? null,
      items:     Array.isArray(img.items) ? img.items : [],
    };
  } else {
    body.images = null;
  }

  return body as AirportIntelligenceResponse;
}

export async function getAirportLayoutFeatures(
  airportId: string,
  abortSignal?: AbortSignal,
): Promise<AirportLayoutFeaturesResponse> {
  const url = `${API_BASE_URL}/api/airports/${encodeURIComponent(airportId)}/layout-features`;
  const response = await fetch(url, { signal: abortSignal });
  const body = await response.json().catch(() => {
    throw new Error(`Failed to fetch airport layout features: ${response.status}`);
  });
  return body as AirportLayoutFeaturesResponse;
}
