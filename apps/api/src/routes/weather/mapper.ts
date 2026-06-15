// Converts database row shapes to API response shapes for the weather route.
import type { WeatherObservationRow, WeatherNearbyRow } from './types.js';

const LAYER_ID = 'layer_07_weather';

export function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (!isNaN(n) && isFinite(n)) return n;
  }
  return 0;
}

export function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (!isNaN(n) && isFinite(n)) return n;
  }
  return null;
}

export function toIntegerOrNull(value: unknown): number | null {
  const n = toNumberOrNull(value);
  return n === null ? null : Math.round(n);
}

export function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return String(value);
}

export function rowToObservationItem(row: WeatherObservationRow) {
  const surfacePressureHpa = toNumberOrNull(row.surfacePressureHpa);
  const generationTimeMs = toNumberOrNull(row.generationTimeMs);

  return {
    observation_id: row.observation_id,
    observation_type: row.observation_type,
    layer_id: LAYER_ID,
    source_id: row.source_id,
    location_id: row.location_id,
    coordinates: {
      requested: {
        latitude: toNumber(row.requested_latitude),
        longitude: toNumber(row.requested_longitude),
      },
      resolved: {
        latitude: toNumber(row.resolved_latitude),
        longitude: toNumber(row.resolved_longitude),
      },
      elevation_m: toNumberOrNull(row.elevation_m),
    },
    weather: {
      temperature_c: toNumber(row.temperature_c),
      apparent_temperature_c: toNumberOrNull(row.apparent_temperature_c),
      wind_speed_kph: toNumberOrNull(row.wind_speed_kph),
      wind_direction_deg: toNumberOrNull(row.wind_direction_deg),
      wind_gust_kph: toNumberOrNull(row.wind_gust_kph),
      humidity_percent: toIntegerOrNull(row.humidity_percent),
      pressure_hpa: toNumberOrNull(row.pressure_hpa),
      precipitation_mm: toNumberOrNull(row.precipitation_mm),
      precipitation_probability_percent: toIntegerOrNull(row.precipitation_probability_percent),
      cloud_cover_percent: toIntegerOrNull(row.cloud_cover_percent),
      weather_code: toIntegerOrNull(row.weather_code),
      weather_label: row.weather_label,
    },
    forecast_for: toIsoString(row.forecast_for),
    fetched_at: toIsoString(row.fetched_at),
    is_stale: row.is_stale,
    raw_evidence_uri: row.raw_evidence_uri,
    provider_metadata: surfacePressureHpa !== null || generationTimeMs !== null
      ? { surface_pressure_hpa: surfacePressureHpa, generation_time_ms: generationTimeMs }
      : null,
    attribution: row.attribution,
  };
}

export function rowToNearbyItem(row: WeatherNearbyRow) {
  return {
    ...rowToObservationItem(row),
    distance_km: toNumber(row.distance_km),
  };
}
