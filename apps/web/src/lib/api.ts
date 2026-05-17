import type { 
  LayerObjectsListResponse, 
  AirportObject,
  AirportDetailResponse,
  LayerStatusResponse 
} from '@god-eyes/contracts';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

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
): Promise<LayerObjectsListResponse> {
  const url = new URL(`${API_BASE_URL}/api/layers/layer_01_aviation/objects`);
  url.searchParams.append('objectType', 'airport');
  url.searchParams.append('mode', mode);
  url.searchParams.append('bbox', bbox);
  
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

  const response = await fetch(url.toString(), { signal: abortSignal });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to fetch aviation objects: ${response.status}`);
  }
  
  return await response.json();
}

export async function fetchLayerStatus(layerId: string): Promise<LayerStatusResponse> {
  const url = `${API_BASE_URL}/api/layers/${layerId}/status`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch layer status: ${response.status}`);
  }
  
  return response.json();
}

// Fetch multiple backend categories in parallel (one request per category).
// API supports only ONE category per request. Merges + dedupes by stable id.
export async function fetchAviationCategoryBatch(
  bbox: string,
  mode: 'points' | 'clusters',
  categories: string[],
  limit: number = 1000,
  abortSignal?: AbortSignal,
  zoom?: number,
): Promise<AirportObject[]> {
  if (categories.length === 0) return [];

  const seen = new Set<string>();
  const merged: AirportObject[] = [];

  await Promise.all(categories.map(async (cat) => {
    if (abortSignal?.aborted) return;
    try {
      const response = await fetchAviationLayerObjects(
        mode, bbox, zoom, limit, abortSignal, undefined, cat,
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
  }));

  return merged;
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
