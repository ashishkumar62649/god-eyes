import type {
  NewsItemsListResponse,
  NewsMarkersListResponse,
  NewsStatsResponse,
  NewsSourcesResponse,
  NewsFetchRunsResponse,
} from '@god-eyes/contracts';

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:4000';

/**
 * Public slug used in API URLs for the News & OSINT layer (per API-POLICY-001).
 * The internal layer ID `NEWS_LAYER_ID` is preserved for folder identity,
 * UI registration, and registry keys — it is intentionally not used in the
 * public API URL.
 */
const NEWS_PUBLIC_SLUG = 'news';

const BASE = `/api/layers/${NEWS_PUBLIC_SLUG}`;

export const NEWS_ITEMS_PATH = `${BASE}/items`;
export const NEWS_MARKERS_PATH = `${BASE}/markers`;
export const NEWS_STATS_PATH = `${BASE}/stats`;
export const NEWS_SOURCES_PATH = `${BASE}/sources`;
export const NEWS_FETCH_RUNS_PATH = `${BASE}/fetch-runs`;

export interface NewsItemsParams {
  limit?: number;
  offset?: number;
  sourceId?: string | null;
  severity?: string | null;
  subcategory?: string | null;
  country?: string | null;
  markerReadyOnly?: boolean;
}

export interface NewsMarkersParams {
  limit?: number;
  offset?: number;
  sourceId?: string | null;
}

function appendIfPresent(url: URL, key: string, value: string | number | null | undefined): void {
  if (value !== null && value !== undefined && value !== '') {
    url.searchParams.set(key, String(value));
  }
}

/** Fetches paginated news items from the GOD EYES API. */
export async function fetchNewsItems(
  params: NewsItemsParams = {},
  signal?: AbortSignal
): Promise<NewsItemsListResponse> {
  const url = new URL(`${API_BASE_URL}${NEWS_ITEMS_PATH}`);
  appendIfPresent(url, 'limit', params.limit);
  appendIfPresent(url, 'offset', params.offset);
  appendIfPresent(url, 'source_id', params.sourceId);
  appendIfPresent(url, 'severity', params.severity);
  appendIfPresent(url, 'subcategory', params.subcategory);
  appendIfPresent(url, 'country', params.country);
  if (params.markerReadyOnly) url.searchParams.set('marker_ready', 'true');

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to fetch news items: ${res.status}`);
  }
  return res.json();
}

/** Fetches marker-ready Point records for globe rendering. */
export async function fetchNewsMarkers(
  params: NewsMarkersParams = {},
  signal?: AbortSignal
): Promise<NewsMarkersListResponse> {
  const url = new URL(`${API_BASE_URL}${NEWS_MARKERS_PATH}`);
  appendIfPresent(url, 'limit', params.limit);
  appendIfPresent(url, 'offset', params.offset);
  appendIfPresent(url, 'source_id', params.sourceId);

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to fetch news markers: ${res.status}`);
  }
  return res.json();
}

/** Fetches Layer 08 stats. */
export async function fetchNewsStats(signal?: AbortSignal): Promise<NewsStatsResponse> {
  const url = `${API_BASE_URL}${NEWS_STATS_PATH}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to fetch news stats: ${res.status}`);
  }
  return res.json();
}

/** Fetches registered sources for Layer 08. */
export async function fetchNewsSources(signal?: AbortSignal): Promise<NewsSourcesResponse> {
  const url = `${API_BASE_URL}${NEWS_SOURCES_PATH}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to fetch news sources: ${res.status}`);
  }
  return res.json();
}

/** Fetches recent fetch run history for Layer 08. */
export async function fetchNewsFetchRuns(
  limit = 5,
  signal?: AbortSignal
): Promise<NewsFetchRunsResponse> {
  const url = new URL(`${API_BASE_URL}${NEWS_FETCH_RUNS_PATH}`);
  url.searchParams.set('limit', String(limit));

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to fetch news fetch-runs: ${res.status}`);
  }
  return res.json();
}
