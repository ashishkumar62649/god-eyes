import { SearchResult } from './searchTypes';
import { fetchAviationLayerObjects } from './api';
import { AirportObject } from '@god-eyes/contracts';

/**
 * Searches for airports using the GOD EYES aviation API.
 */
export async function searchAirports(query: string): Promise<SearchResult[]> {
  if (query.trim().length < 2) return [];

  try {
    // Search airports using the API search parameter
    const response = await fetchAviationLayerObjects(
      'points',
      '-180,-90,180,90', // Global bbox
      undefined,
      10, 
      undefined,
      query
    );

    return response.items
      .filter((item: any): item is AirportObject => 
        item.objectType === 'airport' && 
        typeof item.position.latitude === 'number' && 
        typeof item.position.longitude === 'number'
      )
      .map(airport => ({
        id: `airport-${airport.id}`,
        type: 'Airport',
        title: airport.name,
        subtitle: `${airport.ident}${airport.iataCode ? ` / ${airport.iataCode}` : ''} · ${airport.municipality || ''}${airport.municipality ? ', ' : ''}${airport.country}`,
        position: {
          latitude: airport.position.latitude as number,
          longitude: airport.position.longitude as number
        },
        rawData: airport
      }));
  } catch (err) {
    // Re-throw to allow SearchCommand to handle the offline/error state
    throw err;
  }
}

/**
 * Place/City/Landmark search is currently disabled/future work.
 */
export async function searchPlaces(_query: string): Promise<SearchResult[]> {
  // Cesium IonGeocoderService was unreliable in some environments.
  // Future implementation should use a more robust or local provider.
  return [];
}
