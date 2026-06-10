import { FastifyInstance } from 'fastify';
import { checkDatabaseStatus, query } from '../lib/db.js';
import {
  WeatherListResponseSchema,
  WeatherNearbyResponseSchema,
  WeatherSourcesResponseSchema,
  WeatherFetchRunsResponseSchema,
  ErrorCodes,
} from '@god-eyes/contracts';

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 5000;
const DEFAULT_OFFSET = 0;
const MAX_OFFSET = 10000;
const LAYER_ID = 'layer_07_weather';
const DEFAULT_SOURCE_ID = 'open-meteo';
const NEARBY_DEFAULT_RADIUS_KM = 200;
const NEARBY_MAX_RADIUS_KM = 1000;
const NEARBY_DEFAULT_LIMIT = 50;

interface WeatherQuerystring {
  bbox?: string;
  observation_type?: string;
  source_id?: string;
  forecast_from?: string;
  forecast_to?: string;
  limit?: string;
  offset?: string;
}

interface NearbyQuerystring {
  lat: string;
  lon: string;
  radius_km?: string;
  observation_type?: string;
  source_id?: string;
  limit?: string;
}

interface FetchRunsQuerystring {
  source_id?: string;
  status?: string;
  limit?: string;
  offset?: string;
}

interface BBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

interface WeatherObservationRow {
  observation_id: string;
  layer_id: string;
  source_id: string;
  location_id: string;
  observation_type: string;
  requested_latitude: number;
  requested_longitude: number;
  resolved_latitude: number;
  resolved_longitude: number;
  elevation_m: number | null;
  temperature_c: number;
  apparent_temperature_c: number | null;
  wind_speed_kph: number | null;
  wind_direction_deg: number | null;
  wind_gust_kph: number | null;
  humidity_percent: number | null;
  pressure_hpa: number | null;
  precipitation_mm: number | null;
  precipitation_probability_percent: number | null;
  cloud_cover_percent: number | null;
  weather_code: number | null;
  weather_label: string | null;
  forecast_for: Date | string;
  fetched_at: Date | string;
  is_stale: boolean;
  raw_evidence_uri: string | null;
  surfacePressureHpa: string | null;
  generationTimeMs: string | null;
  attribution: string;
}

interface WeatherNearbyRow extends WeatherObservationRow {
  distance_km: number;
}

interface WeatherSourceRow {
  source_id: string;
  source_name: string;
  source_url: string | null;
  licence: string | null;
  attribution: string | null;
  is_active: boolean;
}

interface WeatherFetchRunRow {
  fetch_run_id: string;
  source_id: string;
  layer_id: string;
  grid_resolution: string;
  total_cells: number;
  successful_cells: number;
  failed_cells: number;
  fetch_started_at: Date | string;
  fetch_completed_at: Date | string | null;
  api_calls_made: number;
  raw_storage_path: string | null;
  status: string;
  error_message: string | null;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (!isNaN(n) && isFinite(n)) return n;
  }
  return 0;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (!isNaN(n) && isFinite(n)) return n;
  }
  return null;
}

function toIntegerOrNull(value: unknown): number | null {
  const n = toNumberOrNull(value);
  if (n === null) return null;
  return Math.round(n);
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return String(value);
}

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

function parseBbox(raw: string): BBox | null {
  const parts = raw.split(',').map((p) => p.trim());
  if (parts.length !== 4) return null;

  const [minLon, minLat, maxLon, maxLat] = parts.map(Number);

  if (
    isNaN(minLon) || isNaN(minLat) || isNaN(maxLon) || isNaN(maxLat) ||
    minLon < -180 || minLon > 180 ||
    maxLon < -180 || maxLon > 180 ||
    minLat < -90 || minLat > 90 ||
    maxLat < -90 || maxLat > 90 ||
    minLon >= maxLon || minLat >= maxLat
  ) {
    return null;
  }

  return { minLon, minLat, maxLon, maxLat };
}

function parseLimit(raw: string | undefined): { value: number; error: { code: string; message: string; details: Record<string, unknown> } | null } {
  if (raw === undefined || raw === '') {
    return { value: DEFAULT_LIMIT, error: null };
  }

  const n = Number(raw);
  if (isNaN(n) || !Number.isInteger(n) || n < 1) {
    return { value: DEFAULT_LIMIT, error: { code: ErrorCodes.INVALID_LIMIT, message: 'Limit must be a positive integer.', details: { provided: raw } } };
  }

  return { value: Math.min(n, MAX_LIMIT), error: null };
}

function parseOffset(raw: string | undefined): { value: number; error: { code: string; message: string; details: Record<string, unknown> } | null } {
  if (raw === undefined || raw === '') {
    return { value: DEFAULT_OFFSET, error: null };
  }

  const n = Number(raw);
  if (isNaN(n) || !Number.isInteger(n) || n < 0) {
    return { value: DEFAULT_OFFSET, error: { code: ErrorCodes.INVALID_QUERY, message: 'Offset must be a non-negative integer.', details: { provided: raw } } };
  }

  return { value: Math.min(n, MAX_OFFSET), error: null };
}

function isValidIsoDatetime(raw: string): boolean {
  const d = new Date(raw);
  return d instanceof Date && !isNaN(d.getTime()) && (raw.includes('T') || raw.includes(' '));
}

function rowToObservationItem(row: WeatherObservationRow) {
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
      ? {
          surface_pressure_hpa: surfacePressureHpa,
          generation_time_ms: generationTimeMs,
        }
      : null,
    attribution: row.attribution,
  };
}

function buildObservationQuery(params: {
  bbox: BBox | null;
  observationType: string | null;
  sourceId: string | null;
  forecastFrom: string | null;
  forecastTo: string | null;
  limit: number;
  offset: number;
}): { sql: string; sqlParams: unknown[] } {
  const { bbox, observationType, sourceId, forecastFrom, forecastTo, limit, offset } = params;
  const conditions: string[] = [`o.layer_id = $1`];
  const sqlParams: unknown[] = [LAYER_ID];
  let paramIndex = 2;

  if (bbox) {
    conditions.push(`l.geom && ST_MakeEnvelope($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, 4326)`);
    sqlParams.push(bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat);
    paramIndex += 4;
  }

  if (observationType !== null) {
    conditions.push(`o.observation_type = $${paramIndex}`);
    sqlParams.push(observationType);
    paramIndex++;
  }

  if (sourceId !== null) {
    conditions.push(`o.source_id = $${paramIndex}`);
    sqlParams.push(sourceId);
    paramIndex++;
  }

  if (forecastFrom !== null) {
    conditions.push(`o.forecast_for >= $${paramIndex}`);
    sqlParams.push(forecastFrom);
    paramIndex++;
  }

  if (forecastTo !== null) {
    conditions.push(`o.forecast_for <= $${paramIndex}`);
    sqlParams.push(forecastTo);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT ${OBSERVATION_SELECT_COLUMNS}
    FROM weather_observations_latest o
    JOIN weather_locations l ON o.location_id = l.location_id
    JOIN weather_sources s ON o.source_id = s.source_id
    ${whereClause}
    ORDER BY o.forecast_for DESC, o.fetched_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  sqlParams.push(limit, offset);

  return { sql, sqlParams };
}

async function queryObservations(params: {
  bbox: BBox | null;
  observationType: string | null;
  sourceId: string | null;
  forecastFrom: string | null;
  forecastTo: string | null;
  limit: number;
  offset: number;
}): Promise<WeatherObservationRow[]> {
  const { sql, sqlParams } = buildObservationQuery(params);
  return query<WeatherObservationRow>(sql, sqlParams);
}

async function queryNearby(params: {
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
  let paramIndex = 2;

  const radiusMeters = radiusKm * 1000;

  conditions.push(`ST_DWithin(l.geom::geography, ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex + 1}), 4326)::geography, $${paramIndex + 2})`);
  sqlParams.push(lon, lat, radiusMeters);
  paramIndex += 3;

  if (observationType !== null) {
    conditions.push(`o.observation_type = $${paramIndex}`);
    sqlParams.push(observationType);
    paramIndex++;
  }

  if (sourceId !== null) {
    conditions.push(`o.source_id = $${paramIndex}`);
    sqlParams.push(sourceId);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Reference the distance alias from the subquery for ORDER BY
  const sql = `
    SELECT sub.*, ST_DistanceSphere(sub.geom, ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex + 1}), 4326)) / 1000.0 AS distance_km
    FROM (
      SELECT
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
        s.attribution,
        l.geom
      FROM weather_observations_latest o
      JOIN weather_locations l ON o.location_id = l.location_id
      JOIN weather_sources s ON o.source_id = s.source_id
      ${whereClause}
    ) sub
    ORDER BY distance_km ASC
    LIMIT $${paramIndex + 2}
  `;
  sqlParams.push(lon, lat, limit);

  return query<WeatherNearbyRow>(sql, sqlParams);
}

export async function weatherRoutes(fastify: FastifyInstance) {
  // A. Latest weather observations
  fastify.get<{ Querystring: WeatherQuerystring }>(
    `/api/layers/${LAYER_ID}/weather/latest`,
    async (request, reply) => {
      const { bbox: rawBbox, observation_type: rawObservationType, source_id: rawSourceId, forecast_from: rawForecastFrom, forecast_to: rawForecastTo, limit: rawLimit, offset: rawOffset } = request.query;

      const parsedLimit = parseLimit(rawLimit);
      if (parsedLimit.error) {
        reply.code(400);
        return { error: parsedLimit.error };
      }

      const parsedOffset = parseOffset(rawOffset);
      if (parsedOffset.error) {
        reply.code(400);
        return { error: parsedOffset.error };
      }

      if (rawObservationType !== undefined && rawObservationType !== '') {
        if (!['current', 'hourly'].includes(rawObservationType)) {
          reply.code(400);
          return {
            error: {
              code: ErrorCodes.INVALID_QUERY,
              message: 'Invalid observation_type. Must be "current" or "hourly".',
              details: { provided: rawObservationType },
            },
          };
        }
      }
      const observationType = rawObservationType !== undefined && rawObservationType !== '' ? rawObservationType : null;

      let bbox: BBox | null = null;
      if (rawBbox !== undefined && rawBbox !== '') {
        bbox = parseBbox(rawBbox);
        if (!bbox) {
          reply.code(400);
          return {
            error: {
              code: ErrorCodes.INVALID_BBOX,
              message: 'Invalid bbox format. Expected: minLon,minLat,maxLon,maxLat. Valid ranges: lon [-180,180], lat [-90,90]. minLon < maxLon and minLat < maxLat required.',
              details: { provided: rawBbox },
            },
          };
        }
      }

      const sourceId = rawSourceId !== undefined && rawSourceId !== '' ? rawSourceId : null;

      if (rawForecastFrom !== undefined && rawForecastFrom !== '') {
        if (!isValidIsoDatetime(rawForecastFrom)) {
          reply.code(400);
          return {
            error: {
              code: ErrorCodes.INVALID_QUERY,
              message: 'Invalid forecast_from format. Expected ISO 8601 datetime.',
              details: { provided: rawForecastFrom },
            },
          };
        }
      }
      const forecastFrom = rawForecastFrom !== undefined && rawForecastFrom !== '' ? rawForecastFrom : null;

      if (rawForecastTo !== undefined && rawForecastTo !== '') {
        if (!isValidIsoDatetime(rawForecastTo)) {
          reply.code(400);
          return {
            error: {
              code: ErrorCodes.INVALID_QUERY,
              message: 'Invalid forecast_to format. Expected ISO 8601 datetime.',
              details: { provided: rawForecastTo },
            },
          };
        }
      }
      const forecastTo = rawForecastTo !== undefined && rawForecastTo !== '' ? rawForecastTo : null;

      if (forecastFrom !== null && forecastTo !== null && new Date(forecastFrom) > new Date(forecastTo)) {
        reply.code(400);
        return {
          error: {
            code: ErrorCodes.INVALID_QUERY,
            message: 'forecast_from must be before or equal to forecast_to.',
            details: { forecast_from: forecastFrom, forecast_to: forecastTo },
          },
        };
      }

      const dbStatus = await checkDatabaseStatus();
      if (dbStatus.status === 'offline') {
        reply.code(503);
        return {
          error: {
            code: ErrorCodes.DATABASE_OFFLINE,
            message: 'Database is not available.',
            details: {},
          },
        };
      }

      let rows: WeatherObservationRow[];
      try {
        rows = await queryObservations({
          bbox,
          observationType,
          sourceId,
          forecastFrom,
          forecastTo,
          limit: parsedLimit.value,
          offset: parsedOffset.value,
        });
      } catch {
        reply.code(500);
        return {
          error: {
            code: ErrorCodes.INTERNAL_ERROR,
            message: 'An internal error occurred while fetching weather observations.',
            details: {},
          },
        };
      }

      const data = rows.map(rowToObservationItem);

      return WeatherListResponseSchema.parse({
        data,
        meta: {
          layer_id: LAYER_ID,
          count: data.length,
          limit: parsedLimit.value,
          offset: parsedOffset.value,
          source_id: sourceId || DEFAULT_SOURCE_ID,
          attribution: data.length > 0 ? data[0].attribution : 'Weather data provided by Open-Meteo under CC-BY 4.0 licence.',
        },
      });
    }
  );

  // B. Current weather observations (convenience endpoint)
  fastify.get<{ Querystring: WeatherQuerystring }>(
    `/api/layers/${LAYER_ID}/weather/current`,
    async (request, reply) => {
      const { bbox: rawBbox, source_id: rawSourceId, limit: rawLimit, offset: rawOffset } = request.query;

      const parsedLimit = parseLimit(rawLimit);
      if (parsedLimit.error) {
        reply.code(400);
        return { error: parsedLimit.error };
      }

      const parsedOffset = parseOffset(rawOffset);
      if (parsedOffset.error) {
        reply.code(400);
        return { error: parsedOffset.error };
      }

      let bbox: BBox | null = null;
      if (rawBbox !== undefined && rawBbox !== '') {
        bbox = parseBbox(rawBbox);
        if (!bbox) {
          reply.code(400);
          return {
            error: {
              code: ErrorCodes.INVALID_BBOX,
              message: 'Invalid bbox format. Expected: minLon,minLat,maxLon,maxLat.',
              details: { provided: rawBbox },
            },
          };
        }
      }

      const sourceId = rawSourceId !== undefined && rawSourceId !== '' ? rawSourceId : null;

      const dbStatus = await checkDatabaseStatus();
      if (dbStatus.status === 'offline') {
        reply.code(503);
        return {
          error: {
            code: ErrorCodes.DATABASE_OFFLINE,
            message: 'Database is not available.',
            details: {},
          },
        };
      }

      let rows: WeatherObservationRow[];
      try {
        rows = await queryObservations({
          bbox,
          observationType: 'current',
          sourceId,
          forecastFrom: null,
          forecastTo: null,
          limit: parsedLimit.value,
          offset: parsedOffset.value,
        });
      } catch {
        reply.code(500);
        return {
          error: {
            code: ErrorCodes.INTERNAL_ERROR,
            message: 'An internal error occurred while fetching current weather observations.',
            details: {},
          },
        };
      }

      const data = rows.map(rowToObservationItem);

      return WeatherListResponseSchema.parse({
        data,
        meta: {
          layer_id: LAYER_ID,
          count: data.length,
          limit: parsedLimit.value,
          offset: parsedOffset.value,
          source_id: sourceId || DEFAULT_SOURCE_ID,
          attribution: data.length > 0 ? data[0].attribution : 'Weather data provided by Open-Meteo under CC-BY 4.0 licence.',
        },
      });
    }
  );

  // C. Hourly weather observations (convenience endpoint)
  fastify.get<{ Querystring: WeatherQuerystring }>(
    `/api/layers/${LAYER_ID}/weather/hourly`,
    async (request, reply) => {
      const { bbox: rawBbox, source_id: rawSourceId, forecast_from: rawForecastFrom, forecast_to: rawForecastTo, limit: rawLimit, offset: rawOffset } = request.query;

      const parsedLimit = parseLimit(rawLimit);
      if (parsedLimit.error) {
        reply.code(400);
        return { error: parsedLimit.error };
      }

      const parsedOffset = parseOffset(rawOffset);
      if (parsedOffset.error) {
        reply.code(400);
        return { error: parsedOffset.error };
      }

      let bbox: BBox | null = null;
      if (rawBbox !== undefined && rawBbox !== '') {
        bbox = parseBbox(rawBbox);
        if (!bbox) {
          reply.code(400);
          return {
            error: {
              code: ErrorCodes.INVALID_BBOX,
              message: 'Invalid bbox format. Expected: minLon,minLat,maxLon,maxLat.',
              details: { provided: rawBbox },
            },
          };
        }
      }

      const sourceId = rawSourceId !== undefined && rawSourceId !== '' ? rawSourceId : null;

      if (rawForecastFrom !== undefined && rawForecastFrom !== '') {
        if (!isValidIsoDatetime(rawForecastFrom)) {
          reply.code(400);
          return {
            error: {
              code: ErrorCodes.INVALID_QUERY,
              message: 'Invalid forecast_from format. Expected ISO 8601 datetime.',
              details: { provided: rawForecastFrom },
            },
          };
        }
      }
      const forecastFrom = rawForecastFrom !== undefined && rawForecastFrom !== '' ? rawForecastFrom : null;

      if (rawForecastTo !== undefined && rawForecastTo !== '') {
        if (!isValidIsoDatetime(rawForecastTo)) {
          reply.code(400);
          return {
            error: {
              code: ErrorCodes.INVALID_QUERY,
              message: 'Invalid forecast_to format. Expected ISO 8601 datetime.',
              details: { provided: rawForecastTo },
            },
          };
        }
      }
      const forecastTo = rawForecastTo !== undefined && rawForecastTo !== '' ? rawForecastTo : null;

      if (forecastFrom !== null && forecastTo !== null && new Date(forecastFrom) > new Date(forecastTo)) {
        reply.code(400);
        return {
          error: {
            code: ErrorCodes.INVALID_QUERY,
            message: 'forecast_from must be before or equal to forecast_to.',
            details: { forecast_from: forecastFrom, forecast_to: forecastTo },
          },
        };
      }

      const dbStatus = await checkDatabaseStatus();
      if (dbStatus.status === 'offline') {
        reply.code(503);
        return {
          error: {
            code: ErrorCodes.DATABASE_OFFLINE,
            message: 'Database is not available.',
            details: {},
          },
        };
      }

      let rows: WeatherObservationRow[];
      try {
        rows = await queryObservations({
          bbox,
          observationType: 'hourly',
          sourceId,
          forecastFrom,
          forecastTo,
          limit: parsedLimit.value,
          offset: parsedOffset.value,
        });
      } catch {
        reply.code(500);
        return {
          error: {
            code: ErrorCodes.INTERNAL_ERROR,
            message: 'An internal error occurred while fetching hourly weather observations.',
            details: {},
          },
        };
      }

      const data = rows.map(rowToObservationItem);

      return WeatherListResponseSchema.parse({
        data,
        meta: {
          layer_id: LAYER_ID,
          count: data.length,
          limit: parsedLimit.value,
          offset: parsedOffset.value,
          source_id: sourceId || DEFAULT_SOURCE_ID,
          attribution: data.length > 0 ? data[0].attribution : 'Weather data provided by Open-Meteo under CC-BY 4.0 licence.',
        },
      });
    }
  );

  // D. Nearby weather
  fastify.get<{ Querystring: NearbyQuerystring }>(
    `/api/layers/${LAYER_ID}/weather/nearby`,
    async (request, reply) => {
      const { lat: rawLat, lon: rawLon, radius_km: rawRadiusKm, observation_type: rawObservationType, source_id: rawSourceId, limit: rawLimit } = request.query;

      const lat = Number(rawLat);
      const lon = Number(rawLon);

      if (isNaN(lat) || lat < -90 || lat > 90) {
        reply.code(400);
        return {
          error: {
            code: ErrorCodes.INVALID_QUERY,
            message: 'Invalid lat. Must be a number between -90 and 90.',
            details: { provided: rawLat },
          },
        };
      }

      if (isNaN(lon) || lon < -180 || lon > 180) {
        reply.code(400);
        return {
          error: {
            code: ErrorCodes.INVALID_QUERY,
            message: 'Invalid lon. Must be a number between -180 and 180.',
            details: { provided: rawLon },
          },
        };
      }

      let radiusKm = NEARBY_DEFAULT_RADIUS_KM;
      if (rawRadiusKm !== undefined && rawRadiusKm !== '') {
        const r = Number(rawRadiusKm);
        if (isNaN(r) || r <= 0 || r > NEARBY_MAX_RADIUS_KM) {
          reply.code(400);
          return {
            error: {
              code: ErrorCodes.INVALID_QUERY,
              message: `Invalid radius_km. Must be a positive number up to ${NEARBY_MAX_RADIUS_KM}.`,
              details: { provided: rawRadiusKm },
            },
          };
        }
        radiusKm = r;
      }

      if (rawObservationType !== undefined && rawObservationType !== '') {
        if (!['current', 'hourly'].includes(rawObservationType)) {
          reply.code(400);
          return {
            error: {
              code: ErrorCodes.INVALID_QUERY,
              message: 'Invalid observation_type. Must be "current" or "hourly".',
              details: { provided: rawObservationType },
            },
          };
        }
      }
      const observationType = rawObservationType !== undefined && rawObservationType !== '' ? rawObservationType : null;

      const sourceId = rawSourceId !== undefined && rawSourceId !== '' ? rawSourceId : null;

      let nearbyLimit = NEARBY_DEFAULT_LIMIT;
      if (rawLimit !== undefined && rawLimit !== '') {
        const n = Number(rawLimit);
        if (isNaN(n) || !Number.isInteger(n) || n < 1 || n > MAX_LIMIT) {
          reply.code(400);
          return {
            error: {
              code: ErrorCodes.INVALID_LIMIT,
              message: `Limit must be an integer between 1 and ${MAX_LIMIT}.`,
              details: { provided: rawLimit },
            },
          };
        }
        nearbyLimit = n;
      }

      const dbStatus = await checkDatabaseStatus();
      if (dbStatus.status === 'offline') {
        reply.code(503);
        return {
          error: {
            code: ErrorCodes.DATABASE_OFFLINE,
            message: 'Database is not available.',
            details: {},
          },
        };
      }

      let rows: WeatherNearbyRow[];
      try {
        rows = await queryNearby({
          lat,
          lon,
          radiusKm,
          observationType,
          sourceId,
          limit: nearbyLimit,
        });
      } catch {
        reply.code(500);
        return {
          error: {
            code: ErrorCodes.INTERNAL_ERROR,
            message: 'An internal error occurred while fetching nearby weather observations.',
            details: {},
          },
        };
      }

      const data = rows.map((row) => {
        const item = rowToObservationItem(row);
        return {
          ...item,
          distance_km: toNumber((row as WeatherNearbyRow).distance_km),
        };
      });

      return WeatherNearbyResponseSchema.parse({
        data,
        meta: {
          layer_id: LAYER_ID,
          count: data.length,
          limit: nearbyLimit,
          offset: 0,
          source_id: sourceId || DEFAULT_SOURCE_ID,
          attribution: data.length > 0 ? data[0].attribution : 'Weather data provided by Open-Meteo under CC-BY 4.0 licence.',
          lat,
          lon,
          radius_km: radiusKm,
        },
      });
    }
  );

  // E. Weather sources
  fastify.get(
    `/api/layers/${LAYER_ID}/weather/sources`,
    async (_request, reply) => {
      const dbStatus = await checkDatabaseStatus();
      if (dbStatus.status === 'offline') {
        reply.code(503);
        return {
          error: {
            code: ErrorCodes.DATABASE_OFFLINE,
            message: 'Database is not available.',
            details: {},
          },
        };
      }

      let rows: WeatherSourceRow[];
      try {
        rows = await query<WeatherSourceRow>(
          `SELECT source_id, source_name, source_url, licence, attribution, is_active
           FROM weather_sources
           WHERE layer_id = $1
           ORDER BY source_name`,
          [LAYER_ID],
        );
      } catch {
        reply.code(500);
        return {
          error: {
            code: ErrorCodes.INTERNAL_ERROR,
            message: 'An internal error occurred while fetching weather sources.',
            details: {},
          },
        };
      }

      return WeatherSourcesResponseSchema.parse({
        data: rows.map((row) => ({
          source_id: row.source_id,
          source_name: row.source_name,
          source_url: row.source_url,
          licence: row.licence,
          attribution: row.attribution,
          is_active: row.is_active,
        })),
        meta: {
          count: rows.length,
          layer_id: LAYER_ID,
        },
      });
    }
  );

  // F. Fetch runs (admin/debug endpoint)
  fastify.get<{ Querystring: FetchRunsQuerystring }>(
    `/api/layers/${LAYER_ID}/weather/fetch-runs`,
    async (request, reply) => {
      const { source_id: rawSourceId, status: rawStatus, limit: rawLimit, offset: rawOffset } = request.query;

      const parsedLimit = parseLimit(rawLimit);
      if (parsedLimit.error) {
        reply.code(400);
        return { error: parsedLimit.error };
      }

      const parsedOffset = parseOffset(rawOffset);
      if (parsedOffset.error) {
        reply.code(400);
        return { error: parsedOffset.error };
      }

      const sourceId = rawSourceId !== undefined && rawSourceId !== '' ? rawSourceId : null;

      if (rawStatus !== undefined && rawStatus !== '') {
        if (!['running', 'completed', 'failed', 'partial'].includes(rawStatus)) {
          reply.code(400);
          return {
            error: {
              code: ErrorCodes.INVALID_QUERY,
              message: 'Invalid status. Must be one of: running, completed, failed, partial.',
              details: { provided: rawStatus },
            },
          };
        }
      }
      const status = rawStatus !== undefined && rawStatus !== '' ? rawStatus : null;

      const dbStatus = await checkDatabaseStatus();
      if (dbStatus.status === 'offline') {
        reply.code(503);
        return {
          error: {
            code: ErrorCodes.DATABASE_OFFLINE,
            message: 'Database is not available.',
            details: {},
          },
        };
      }

      let rows: WeatherFetchRunRow[];
      try {
        const conditions: string[] = [`f.layer_id = $1`];
        const sqlParams: unknown[] = [LAYER_ID];
        let paramIndex = 2;

        if (sourceId !== null) {
          conditions.push(`f.source_id = $${paramIndex}`);
          sqlParams.push(sourceId);
          paramIndex++;
        }

        if (status !== null) {
          conditions.push(`f.status = $${paramIndex}`);
          sqlParams.push(status);
          paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const sql = `
          SELECT
            f.fetch_run_id,
            f.source_id,
            f.layer_id,
            f.grid_resolution,
            f.total_cells,
            f.successful_cells,
            f.failed_cells,
            f.fetch_started_at,
            f.fetch_completed_at,
            f.api_calls_made,
            f.raw_storage_path,
            f.status,
            f.error_message
          FROM weather_fetch_runs f
          ${whereClause}
          ORDER BY f.fetch_started_at DESC
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
        sqlParams.push(parsedLimit.value, parsedOffset.value);

        rows = await query<WeatherFetchRunRow>(sql, sqlParams);
      } catch {
        reply.code(500);
        return {
          error: {
            code: ErrorCodes.INTERNAL_ERROR,
            message: 'An internal error occurred while fetching fetch runs.',
            details: {},
          },
        };
      }

      return WeatherFetchRunsResponseSchema.parse({
        data: rows.map((row) => ({
          fetch_run_id: row.fetch_run_id,
          source_id: row.source_id,
          layer_id: LAYER_ID,
          grid_resolution: row.grid_resolution,
          total_cells: row.total_cells,
          successful_cells: row.successful_cells,
          failed_cells: row.failed_cells,
          fetch_started_at: toIsoString(row.fetch_started_at),
          fetch_completed_at: row.fetch_completed_at ? toIsoString(row.fetch_completed_at) : null,
          api_calls_made: row.api_calls_made,
          raw_storage_path: row.raw_storage_path,
          status: row.status,
          error_message: row.error_message,
        })),
        meta: {
          count: rows.length,
          limit: parsedLimit.value,
          offset: parsedOffset.value,
          layer_id: LAYER_ID,
        },
      });
    }
  );
}
