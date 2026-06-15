// Database access for the weather route. All SQL queries live here.
import { query } from '../../lib/db.js';
import type { BBox, WeatherObservationRow, WeatherNearbyRow, WeatherSourceRow, WeatherFetchRunRow } from './types.js';

const LAYER_ID = 'layer_07_weather';

const OBSERVATION_SELECT_COLUMNS = `
  o.observation_id,
  o.layer_id,
  o.source_id,
  o.location_id,
  o.observation_type,
  l.requested_latitude,
  l.requested_longitude,
  l.resolved_latitude,
  l.resolved_longitude,
  l.elevation_m,
  o.temperature_c,
  o.apparent_temperature_c,
  o.wind_speed_kph,
  o.wind_direction_deg,
  o.wind_gust_kph,
  o.humidity_percent,
  o.pressure_hpa,
  o.precipitation_mm,
  o.precipitation_probability_percent,
  o.cloud_cover_percent,
  o.weather_code,
  o.weather_label,
  o.forecast_for,
  o.fetched_at,
  o.is_stale,
  o.raw_evidence_uri,
  o.provider_metadata->>'surface_pressure_hpa' AS "surfacePressureHpa",
  o.provider_metadata->>'generation_time_ms' AS "generationTimeMs",
  s.attribution
`;

export async function queryObservations(params: {
  bbox: BBox | null;
  observationType: string | null;
  sourceId: string | null;
  forecastFrom: string | null;
  forecastTo: string | null;
  limit: number;
  offset: number;
}): Promise<WeatherObservationRow[]> {
  const { bbox, observationType, sourceId, forecastFrom, forecastTo, limit, offset } = params;
  const conditions: string[] = [`o.layer_id = $1`];
  const sqlParams: unknown[] = [LAYER_ID];
  let p = 2;

  if (bbox) {
    conditions.push(`l.geom && ST_MakeEnvelope($${p}, $${p + 1}, $${p + 2}, $${p + 3}, 4326)`);
    sqlParams.push(bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat);
    p += 4;
  }
  if (observationType !== null) { conditions.push(`o.observation_type = $${p}`); sqlParams.push(observationType); p++; }
  if (sourceId !== null) { conditions.push(`o.source_id = $${p}`); sqlParams.push(sourceId); p++; }
  if (forecastFrom !== null) { conditions.push(`o.forecast_for >= $${p}`); sqlParams.push(forecastFrom); p++; }
  if (forecastTo !== null) { conditions.push(`o.forecast_for <= $${p}`); sqlParams.push(forecastTo); p++; }

  const sql = `
    SELECT ${OBSERVATION_SELECT_COLUMNS}
    FROM weather_observations_latest o
    JOIN weather_locations l ON o.location_id = l.location_id
    JOIN weather_sources s ON o.source_id = s.source_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY o.forecast_for DESC, o.fetched_at DESC
    LIMIT $${p} OFFSET $${p + 1}
  `;
  sqlParams.push(limit, offset);

  return query<WeatherObservationRow>(sql, sqlParams);
}

export async function queryNearby(params: {
  lat: number;
  lon: number;
  radiusKm: number;
  observationType: string | null;
  sourceId: string | null;
  limit: number;
}): Promise<WeatherNearbyRow[]> {
  const { lat, lon, radiusKm, observationType, sourceId, limit } = params;
  const conditions: string[] = [`o.layer_id = $1`];
  const sqlParams: unknown[] = [LAYER_ID];
  let p = 2;

  conditions.push(`ST_DWithin(l.geom::geography, ST_SetSRID(ST_MakePoint($${p}, $${p + 1}), 4326)::geography, $${p + 2})`);
  sqlParams.push(lon, lat, radiusKm * 1000);
  p += 3;

  if (observationType !== null) { conditions.push(`o.observation_type = $${p}`); sqlParams.push(observationType); p++; }
  if (sourceId !== null) { conditions.push(`o.source_id = $${p}`); sqlParams.push(sourceId); p++; }

  const sql = `
    SELECT sub.*, ST_DistanceSphere(sub.geom, ST_SetSRID(ST_MakePoint($${p}, $${p + 1}), 4326)) / 1000.0 AS distance_km
    FROM (
      SELECT
        o.observation_id, o.layer_id, o.source_id, o.location_id, o.observation_type,
        l.requested_latitude, l.requested_longitude, l.resolved_latitude, l.resolved_longitude,
        l.elevation_m, o.temperature_c, o.apparent_temperature_c, o.wind_speed_kph,
        o.wind_direction_deg, o.wind_gust_kph, o.humidity_percent, o.pressure_hpa,
        o.precipitation_mm, o.precipitation_probability_percent, o.cloud_cover_percent,
        o.weather_code, o.weather_label, o.forecast_for, o.fetched_at, o.is_stale,
        o.raw_evidence_uri,
        o.provider_metadata->>'surface_pressure_hpa' AS "surfacePressureHpa",
        o.provider_metadata->>'generation_time_ms' AS "generationTimeMs",
        s.attribution, l.geom
      FROM weather_observations_latest o
      JOIN weather_locations l ON o.location_id = l.location_id
      JOIN weather_sources s ON o.source_id = s.source_id
      WHERE ${conditions.join(' AND ')}
    ) sub
    ORDER BY distance_km ASC
    LIMIT $${p + 2}
  `;
  sqlParams.push(lon, lat, limit);

  return query<WeatherNearbyRow>(sql, sqlParams);
}

export async function querySources(): Promise<WeatherSourceRow[]> {
  return query<WeatherSourceRow>(
    `SELECT source_id, source_name, source_url, licence, attribution, is_active
     FROM weather_sources
     WHERE layer_id = $1
     ORDER BY source_name`,
    [LAYER_ID],
  );
}

export async function queryFetchRuns(params: {
  sourceId: string | null;
  status: string | null;
  limit: number;
  offset: number;
}): Promise<WeatherFetchRunRow[]> {
  const { sourceId, status, limit, offset } = params;
  const conditions: string[] = [`f.layer_id = $1`];
  const sqlParams: unknown[] = [LAYER_ID];
  let p = 2;

  if (sourceId !== null) { conditions.push(`f.source_id = $${p}`); sqlParams.push(sourceId); p++; }
  if (status !== null) { conditions.push(`f.status = $${p}`); sqlParams.push(status); p++; }

  const sql = `
    SELECT
      f.fetch_run_id, f.source_id, f.layer_id, f.grid_resolution, f.total_cells,
      f.successful_cells, f.failed_cells, f.fetch_started_at, f.fetch_completed_at,
      f.api_calls_made, f.raw_storage_path, f.status, f.error_message
    FROM weather_fetch_runs f
    WHERE ${conditions.join(' AND ')}
    ORDER BY f.fetch_started_at DESC
    LIMIT $${p} OFFSET $${p + 1}
  `;
  sqlParams.push(limit, offset);

  return query<WeatherFetchRunRow>(sql, sqlParams);
}
