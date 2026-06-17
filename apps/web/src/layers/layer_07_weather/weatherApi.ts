import type { WeatherListResponse } from '@god-eyes/contracts';

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:4000';

/**
 * Public slug used in API URLs for the Weather layer (per API-POLICY-001).
 * The internal layer ID `WEATHER_LAYER_ID` is preserved for folder identity,
 * UI registration, and registry keys — it is intentionally not used in the
 * public API URL.
 */
const WEATHER_PUBLIC_SLUG = 'weather';

/** GOD EYES API path for current weather observations (MVP). */
export const WEATHER_CURRENT_PATH = `/api/layers/${WEATHER_PUBLIC_SLUG}/current`;

export interface WeatherCurrentParams {
  /** Bounding box: minLon,minLat,maxLon,maxLat */
  bbox?: string | null;
  /** Source filter — defaults to open-meteo upstream. */
  sourceId?: string | null;
  limit?: number;
  offset?: number;
}

/**
 * Fetches current weather observations from the GOD EYES API.
 *
 * The frontend NEVER calls Open-Meteo directly — only the GOD EYES endpoint.
 * Query params are appended via URLSearchParams so values are always encoded
 * and only defined params are sent.
 */
export async function fetchCurrentWeather(
  params: WeatherCurrentParams = {},
  signal?: AbortSignal
): Promise<WeatherListResponse> {
  const url = new URL(`${API_BASE_URL}${WEATHER_CURRENT_PATH}`);

  if (params.bbox) url.searchParams.set('bbox', params.bbox);
  if (params.sourceId) url.searchParams.set('source_id', params.sourceId);
  if (params.limit !== undefined && Number.isFinite(params.limit)) {
    url.searchParams.set('limit', String(params.limit));
  }
  if (
    params.offset !== undefined &&
    Number.isFinite(params.offset) &&
    params.offset > 0
  ) {
    url.searchParams.set('offset', String(params.offset));
  }

  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData?.error?.message ||
        `Failed to fetch current weather: ${response.status}`
    );
  }

  return response.json();
}
