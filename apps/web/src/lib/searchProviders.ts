import { SearchResult } from './searchTypes';
import { fetchAviationLayerObjects } from './api';
import { AirportObject } from '@god-eyes/contracts';
import { IonGeocoderService, Cartesian3, Cartographic, Math as CesiumMath } from 'cesium';

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
    console.error('Airport search failed:', err);
    return [];
  }
}

export async function searchPlaces(query: string): Promise<SearchResult[]> {
  if (query.trim().length < 3) return [];

  try {
    // NOTE: IonGeocoderService works without scene in newer versions for basic geocoding, 
    // but the types might require it. We'll use a simple any cast if needed or documentation says otherwise.
    const geocoder = new (IonGeocoderService as any)();
    const results = await geocoder.geocode(query);

    return results.map((res: any, index: number) => {
      // res.destination is often a Rectangle or Cartesian3
      // We need to get lon/lat
      let lat = 0;
      let lon = 0;

      if (res.destination instanceof Cartesian3) {
        const cartographic = Cartographic.fromCartesian(res.destination);
        lat = CesiumMath.toDegrees(cartographic.latitude);
        lon = CesiumMath.toDegrees(cartographic.longitude);
      } else if (res.destination && typeof res.destination.west === 'number') {
        // It's a Rectangle
        lat = CesiumMath.toDegrees((res.destination.north + res.destination.south) / 2);
        lon = CesiumMath.toDegrees((res.destination.east + res.destination.west) / 2);
      }

      return {
        id: `place-${index}-${res.displayName}`,
        type: 'Place',
        title: res.displayName,
        subtitle: 'GEOGRAPHIC LOCATION',
        position: { latitude: lat, longitude: lon }
      };
    });
  } catch (err) {
    // console.error('Place search failed:', err);
    return [];
  }
}
