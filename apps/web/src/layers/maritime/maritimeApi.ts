import type {
  MaritimeObjectsListResponse,
  MaritimeVesselDetailResponse,
  MaritimeStatsResponse,
} from '@god-eyes/contracts';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:4000';

export async function fetchMaritimeObjects(
  params: {
    bbox?: string | null;
    vessel_type?: string | null;
    search?: string | null;
    limit?: number;
  } = {},
  signal?: AbortSignal
): Promise<MaritimeObjectsListResponse> {
  const url = new URL(`${API_BASE_URL}/api/layers/layer_06_maritime/objects`);

  if (params.bbox) url.searchParams.set('bbox', params.bbox);
  if (params.vessel_type) url.searchParams.set('vessel_type', params.vessel_type);
  if (params.search) url.searchParams.set('search', params.search);
  if (params.limit !== undefined) url.searchParams.set('limit', String(params.limit));

  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to fetch maritime objects: ${response.status}`);
  }

  return response.json();
}

export async function fetchVesselDetail(
  mmsi: number,
  signal?: AbortSignal
): Promise<MaritimeVesselDetailResponse> {
  const url = `${API_BASE_URL}/api/layers/layer_06_maritime/objects/${mmsi}`;

  const response = await fetch(url, { signal });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to fetch vessel details: ${response.status}`);
  }

  return response.json();
}

export async function fetchMaritimeStats(
  signal?: AbortSignal
): Promise<MaritimeStatsResponse> {
  const url = `${API_BASE_URL}/api/layers/layer_06_maritime/stats`;

  const response = await fetch(url, { signal });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to fetch maritime statistics: ${response.status}`);
  }

  return response.json();
}
