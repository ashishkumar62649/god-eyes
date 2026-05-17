import { SearchResult } from './searchTypes';

export function parseCoordinates(query: string): SearchResult | null {
  // Regex to match "lat, lon" or "lat lon"
  // Supports decimals, signs
  const coordRegex = /^([-+]?\d{1,2}(?:\.\d+)?)\s*[,|\s]\s*([-+]?\d{1,3}(?:\.\d+)?)$/;
  const match = query.trim().match(coordRegex);

  if (match) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);

    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return {
        id: `coord-${lat}-${lon}`,
        type: 'Coordinates',
        title: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
        subtitle: 'GEOGRAPHIC COORDINATES',
        position: {
          latitude: lat,
          longitude: lon
        }
      };
    }
  }

  return null;
}
