// Simple API client for GOD EYES
import type { 
  LayerObjectsListResponse, 
  AirportObject,
  LayerStatusResponse 
} from '@god-eyes/contracts';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export async function fetchAirports(limit: number = 500): Promise<AirportObject[]> {
  const url = `${API_BASE_URL}/api/layers/layer_01_aviation/objects?objectType=airport&limit=${limit}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to fetch airports: ${response.status}`);
  }
  
  const data: LayerObjectsListResponse = await response.json();
  return data.items;
}

export async function fetchLayerStatus(layerId: string): Promise<LayerStatusResponse> {
  const url = `${API_BASE_URL}/api/layers/${layerId}/status`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch layer status: ${response.status}`);
  }
  
  return response.json();
}
