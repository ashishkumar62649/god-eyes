import type { WeatherObservationItem } from '@god-eyes/contracts';

export const WEATHER_LAYER_ID = 'layer_07_weather';
export const WEATHER_ATTRIBUTION =
  'Weather data provided by Open-Meteo under CC-BY 4.0 licence.';

/**
 * Frontend render model for a weather observation.
 *
 * `kind: 'weather'` is a discriminator so the marker payload can be told apart
 * from other selectable objects (airports, vessels, energy features). Marker
 * placement always uses the resolved (grid) coordinates.
 */
export interface WeatherRenderItem {
  kind: 'weather';
  observationId: string;
  locationId: string;
  sourceId: string;
  // Resolved (grid) coordinates — used for marker placement.
  latitude: number;
  longitude: number;
  // Requested coordinates — kept for optional debug display.
  requestedLatitude: number | null;
  requestedLongitude: number | null;
  elevationM: number | null;
  // Weather fields.
  temperatureC: number;
  apparentTemperatureC: number | null;
  humidityPercent: number | null;
  pressureHpa: number | null;
  windSpeedKph: number | null;
  windDirectionDeg: number | null;
  windGustKph: number | null;
  precipitationMm: number | null;
  precipitationProbabilityPercent: number | null;
  cloudCoverPercent: number | null;
  weatherCode: number | null;
  weatherLabel: string | null;
  // Provenance / freshness.
  forecastFor: string;
  fetchedAt: string;
  isStale: boolean;
  attribution: string;
  // Safe provider metadata subset (may be absent).
  surfacePressureHpa: number | null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function numberOrNull(value: unknown): number | null {
  return isFiniteNumber(value) ? value : null;
}

/**
 * Maps a single API observation item into the frontend render model.
 *
 * Returns `null` for items that cannot be safely rendered:
 *  - missing/invalid resolved coordinates
 *  - missing/invalid temperature_c
 */
export function mapObservationToRenderItem(
  item: WeatherObservationItem | null | undefined
): WeatherRenderItem | null {
  if (!item || typeof item !== 'object') return null;

  const resolved = item.coordinates?.resolved;
  const lat = resolved?.latitude;
  const lon = resolved?.longitude;

  // Skip items with missing/invalid resolved coordinates.
  if (
    !isFiniteNumber(lat) ||
    !isFiniteNumber(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return null;
  }

  // Skip items with missing/invalid temperature.
  const temperatureC = item.weather?.temperature_c;
  if (!isFiniteNumber(temperatureC)) {
    return null;
  }

  const requested = item.coordinates?.requested;
  const providerMeta = item.provider_metadata ?? null;

  return {
    kind: 'weather',
    observationId: String(item.observation_id),
    locationId: String(item.location_id),
    sourceId: String(item.source_id),
    latitude: lat,
    longitude: lon,
    requestedLatitude: numberOrNull(requested?.latitude),
    requestedLongitude: numberOrNull(requested?.longitude),
    elevationM: numberOrNull(item.coordinates?.elevation_m),
    temperatureC,
    apparentTemperatureC: numberOrNull(item.weather?.apparent_temperature_c),
    humidityPercent: numberOrNull(item.weather?.humidity_percent),
    pressureHpa: numberOrNull(item.weather?.pressure_hpa),
    windSpeedKph: numberOrNull(item.weather?.wind_speed_kph),
    windDirectionDeg: numberOrNull(item.weather?.wind_direction_deg),
    windGustKph: numberOrNull(item.weather?.wind_gust_kph),
    precipitationMm: numberOrNull(item.weather?.precipitation_mm),
    precipitationProbabilityPercent: numberOrNull(
      item.weather?.precipitation_probability_percent
    ),
    cloudCoverPercent: numberOrNull(item.weather?.cloud_cover_percent),
    weatherCode: numberOrNull(item.weather?.weather_code),
    weatherLabel:
      typeof item.weather?.weather_label === 'string'
        ? item.weather.weather_label
        : null,
    forecastFor: String(item.forecast_for ?? ''),
    fetchedAt: String(item.fetched_at ?? ''),
    isStale: Boolean(item.is_stale),
    attribution:
      typeof item.attribution === 'string' && item.attribution.length > 0
        ? item.attribution
        : WEATHER_ATTRIBUTION,
    surfacePressureHpa: numberOrNull(providerMeta?.surface_pressure_hpa),
  };
}

/**
 * Maps an array of API observation items into render items, skipping any
 * invalid/unmappable entries defensively.
 */
export function mapObservationsToRenderItems(
  items: Array<WeatherObservationItem | null | undefined> | null | undefined
): WeatherRenderItem[] {
  if (!Array.isArray(items)) return [];
  const result: WeatherRenderItem[] = [];
  for (const item of items) {
    const mapped = mapObservationToRenderItem(item);
    if (mapped) result.push(mapped);
  }
  return result;
}
