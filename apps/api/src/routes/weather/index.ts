// HTTP route handlers for Layer 07 — Weather. No SQL, no business logic here.
//
// Clean public slug aliases added per API-POLICY-001:
//   /api/layers/weather/latest      (alias for /api/layers/layer_07_weather/weather/latest)
//   /api/layers/weather/current    (alias for /api/layers/layer_07_weather/weather/current)
//   /api/layers/weather/hourly     (alias for /api/layers/layer_07_weather/weather/hourly)
//   /api/layers/weather/nearby     (alias for /api/layers/layer_07_weather/weather/nearby)
//   /api/layers/weather/sources    (alias for /api/layers/layer_07_weather/weather/sources)
//   /api/layers/weather/fetch-runs (alias for /api/layers/layer_07_weather/weather/fetch-runs)
//
// Old paths remain registered for compatibility and are not removed in this work order.
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  WeatherListResponseSchema,
  WeatherNearbyResponseSchema,
  WeatherSourcesResponseSchema,
  WeatherFetchRunsResponseSchema,
  ErrorCodes,
} from '@god-eyes/contracts';
import { parseBbox, parseLimit, parseOffset, parseNearbyLimit, isValidIsoDatetime, NEARBY_DEFAULT_RADIUS_KM, NEARBY_MAX_RADIUS_KM } from './validation.js';
import { getObservations, getNearby, getSources, getFetchRuns, checkDatabaseStatus } from './service.js';
import type { WeatherQuerystring, NearbyQuerystring, FetchRunsQuerystring } from './types.js';

const LAYER_ID = 'layer_07_weather';
const PUBLIC_SLUG = 'weather';
const DEFAULT_SOURCE_ID_FALLBACK = 'open-meteo';

const DB_OFFLINE_ERROR = {
  code: ErrorCodes.DATABASE_OFFLINE,
  message: 'Database is not available.',
  details: {},
};

const INTERNAL_ERROR = {
  code: ErrorCodes.INTERNAL_ERROR,
  message: 'An internal error occurred.',
  details: {},
};

export async function weatherRoutes(fastify: FastifyInstance) {
  // Each handler is defined once and registered under both the legacy layer-ID
  // path and the new clean public slug path. meta.layer_id continues to use
  // the internal layer ID per API-POLICY-001.

  // A. Latest weather observations
  const latestHandler = async (request: FastifyRequest<{ Querystring: WeatherQuerystring }>, reply: FastifyReply) => {
    const { bbox: rawBbox, observation_type: rawObservationType, source_id: rawSourceId, forecast_from: rawForecastFrom, forecast_to: rawForecastTo, limit: rawLimit, offset: rawOffset } = request.query;

    const parsedLimit = parseLimit(rawLimit);
    if (parsedLimit.error) { reply.code(400); return { error: parsedLimit.error }; }

    const parsedOffset = parseOffset(rawOffset);
    if (parsedOffset.error) { reply.code(400); return { error: parsedOffset.error }; }

    if (rawObservationType !== undefined && rawObservationType !== '') {
      if (!['current', 'hourly'].includes(rawObservationType)) {
        reply.code(400);
        return { error: { code: ErrorCodes.INVALID_QUERY, message: 'Invalid observation_type. Must be "current" or "hourly".', details: { provided: rawObservationType } } };
      }
    }
    const observationType = rawObservationType || null;

    let bbox = null;
    if (rawBbox) {
      bbox = parseBbox(rawBbox);
      if (!bbox) {
        reply.code(400);
        return { error: { code: ErrorCodes.INVALID_BBOX, message: 'Invalid bbox format. Expected: minLon,minLat,maxLon,maxLat. Valid ranges: lon [-180,180], lat [-90,90]. minLon < maxLon and minLat < maxLat required.', details: { provided: rawBbox } } };
      }
    }

    const sourceId = rawSourceId || null;

    if (rawForecastFrom && !isValidIsoDatetime(rawForecastFrom)) {
      reply.code(400);
      return { error: { code: ErrorCodes.INVALID_QUERY, message: 'Invalid forecast_from format. Expected ISO 8601 datetime.', details: { provided: rawForecastFrom } } };
    }
    const forecastFrom = rawForecastFrom || null;

    if (rawForecastTo && !isValidIsoDatetime(rawForecastTo)) {
      reply.code(400);
      return { error: { code: ErrorCodes.INVALID_QUERY, message: 'Invalid forecast_to format. Expected ISO 8601 datetime.', details: { provided: rawForecastTo } } };
    }
    const forecastTo = rawForecastTo || null;

    if (forecastFrom && forecastTo && new Date(forecastFrom) > new Date(forecastTo)) {
      reply.code(400);
      return { error: { code: ErrorCodes.INVALID_QUERY, message: 'forecast_from must be before or equal to forecast_to.', details: { forecast_from: forecastFrom, forecast_to: forecastTo } } };
    }

    const dbStatus = await checkDatabaseStatus();
    if (dbStatus.status === 'offline') { reply.code(503); return { error: DB_OFFLINE_ERROR }; }

    let data;
    try {
      data = await getObservations({ bbox, observationType, sourceId, forecastFrom, forecastTo, limit: parsedLimit.value, offset: parsedOffset.value });
    } catch {
      reply.code(500); return { error: INTERNAL_ERROR };
    }

    return WeatherListResponseSchema.parse({
      data,
      meta: { layer_id: LAYER_ID, count: data.length, limit: parsedLimit.value, offset: parsedOffset.value, source_id: sourceId || DEFAULT_SOURCE_ID_FALLBACK, attribution: data.length > 0 ? data[0].attribution : 'Weather data provided by Open-Meteo under CC-BY 4.0 licence.' },
    });
  };

  fastify.get<{ Querystring: WeatherQuerystring }>(`/api/layers/${LAYER_ID}/weather/latest`, latestHandler);
  fastify.get<{ Querystring: WeatherQuerystring }>(`/api/layers/${PUBLIC_SLUG}/latest`, latestHandler);

  // B. Current weather observations
  const currentHandler = async (request: FastifyRequest<{ Querystring: WeatherQuerystring }>, reply: FastifyReply) => {
    const { bbox: rawBbox, source_id: rawSourceId, limit: rawLimit, offset: rawOffset } = request.query;

    const parsedLimit = parseLimit(rawLimit);
    if (parsedLimit.error) { reply.code(400); return { error: parsedLimit.error }; }

    const parsedOffset = parseOffset(rawOffset);
    if (parsedOffset.error) { reply.code(400); return { error: parsedOffset.error }; }

    let bbox = null;
    if (rawBbox) {
      bbox = parseBbox(rawBbox);
      if (!bbox) {
        reply.code(400);
        return { error: { code: ErrorCodes.INVALID_BBOX, message: 'Invalid bbox format. Expected: minLon,minLat,maxLon,maxLat.', details: { provided: rawBbox } } };
      }
    }

    const sourceId = rawSourceId || null;
    const dbStatus = await checkDatabaseStatus();
    if (dbStatus.status === 'offline') { reply.code(503); return { error: DB_OFFLINE_ERROR }; }

    let data;
    try {
      data = await getObservations({ bbox, observationType: 'current', sourceId, forecastFrom: null, forecastTo: null, limit: parsedLimit.value, offset: parsedOffset.value });
    } catch {
      reply.code(500); return { error: INTERNAL_ERROR };
    }

    return WeatherListResponseSchema.parse({
      data,
      meta: { layer_id: LAYER_ID, count: data.length, limit: parsedLimit.value, offset: parsedOffset.value, source_id: sourceId || DEFAULT_SOURCE_ID_FALLBACK, attribution: data.length > 0 ? data[0].attribution : 'Weather data provided by Open-Meteo under CC-BY 4.0 licence.' },
    });
  };

  fastify.get<{ Querystring: WeatherQuerystring }>(`/api/layers/${LAYER_ID}/weather/current`, currentHandler);
  fastify.get<{ Querystring: WeatherQuerystring }>(`/api/layers/${PUBLIC_SLUG}/current`, currentHandler);

  // C. Hourly weather observations
  const hourlyHandler = async (request: FastifyRequest<{ Querystring: WeatherQuerystring }>, reply: FastifyReply) => {
    const { bbox: rawBbox, source_id: rawSourceId, forecast_from: rawForecastFrom, forecast_to: rawForecastTo, limit: rawLimit, offset: rawOffset } = request.query;

    const parsedLimit = parseLimit(rawLimit);
    if (parsedLimit.error) { reply.code(400); return { error: parsedLimit.error }; }

    const parsedOffset = parseOffset(rawOffset);
    if (parsedOffset.error) { reply.code(400); return { error: parsedOffset.error }; }

    let bbox = null;
    if (rawBbox) {
      bbox = parseBbox(rawBbox);
      if (!bbox) {
        reply.code(400);
        return { error: { code: ErrorCodes.INVALID_BBOX, message: 'Invalid bbox format. Expected: minLon,minLat,maxLon,maxLat.', details: { provided: rawBbox } } };
      }
    }

    const sourceId = rawSourceId || null;

    if (rawForecastFrom && !isValidIsoDatetime(rawForecastFrom)) {
      reply.code(400);
      return { error: { code: ErrorCodes.INVALID_QUERY, message: 'Invalid forecast_from format. Expected ISO 8601 datetime.', details: { provided: rawForecastFrom } } };
    }
    const forecastFrom = rawForecastFrom || null;

    if (rawForecastTo && !isValidIsoDatetime(rawForecastTo)) {
      reply.code(400);
      return { error: { code: ErrorCodes.INVALID_QUERY, message: 'Invalid forecast_to format. Expected ISO 8601 datetime.', details: { provided: rawForecastTo } } };
    }
    const forecastTo = rawForecastTo || null;

    if (forecastFrom && forecastTo && new Date(forecastFrom) > new Date(forecastTo)) {
      reply.code(400);
      return { error: { code: ErrorCodes.INVALID_QUERY, message: 'forecast_from must be before or equal to forecast_to.', details: { forecast_from: forecastFrom, forecast_to: forecastTo } } };
    }

    const dbStatus = await checkDatabaseStatus();
    if (dbStatus.status === 'offline') { reply.code(503); return { error: DB_OFFLINE_ERROR }; }

    let data;
    try {
      data = await getObservations({ bbox, observationType: 'hourly', sourceId, forecastFrom, forecastTo, limit: parsedLimit.value, offset: parsedOffset.value });
    } catch {
      reply.code(500); return { error: INTERNAL_ERROR };
    }

    return WeatherListResponseSchema.parse({
      data,
      meta: { layer_id: LAYER_ID, count: data.length, limit: parsedLimit.value, offset: parsedOffset.value, source_id: sourceId || DEFAULT_SOURCE_ID_FALLBACK, attribution: data.length > 0 ? data[0].attribution : 'Weather data provided by Open-Meteo under CC-BY 4.0 licence.' },
    });
  };

  fastify.get<{ Querystring: WeatherQuerystring }>(`/api/layers/${LAYER_ID}/weather/hourly`, hourlyHandler);
  fastify.get<{ Querystring: WeatherQuerystring }>(`/api/layers/${PUBLIC_SLUG}/hourly`, hourlyHandler);

  // D. Nearby weather
  const nearbyHandler = async (request: FastifyRequest<{ Querystring: NearbyQuerystring }>, reply: FastifyReply) => {
    const { lat: rawLat, lon: rawLon, radius_km: rawRadiusKm, observation_type: rawObservationType, source_id: rawSourceId, limit: rawLimit } = request.query;

    const lat = Number(rawLat);
    const lon = Number(rawLon);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      reply.code(400);
      return { error: { code: ErrorCodes.INVALID_QUERY, message: 'Invalid lat. Must be a number between -90 and 90.', details: { provided: rawLat } } };
    }
    if (isNaN(lon) || lon < -180 || lon > 180) {
      reply.code(400);
      return { error: { code: ErrorCodes.INVALID_QUERY, message: 'Invalid lon. Must be a number between -180 and 180.', details: { provided: rawLon } } };
    }

    let radiusKm = NEARBY_DEFAULT_RADIUS_KM;
    if (rawRadiusKm) {
      const r = Number(rawRadiusKm);
      if (isNaN(r) || r <= 0 || r > NEARBY_MAX_RADIUS_KM) {
        reply.code(400);
        return { error: { code: ErrorCodes.INVALID_QUERY, message: `Invalid radius_km. Must be a positive number up to ${NEARBY_MAX_RADIUS_KM}.`, details: { provided: rawRadiusKm } } };
      }
      radiusKm = r;
    }

    if (rawObservationType && !['current', 'hourly'].includes(rawObservationType)) {
      reply.code(400);
      return { error: { code: ErrorCodes.INVALID_QUERY, message: 'Invalid observation_type. Must be "current" or "hourly".', details: { provided: rawObservationType } } };
    }
    const observationType = rawObservationType || null;
    const sourceId = rawSourceId || null;

    const parsedLimit = parseNearbyLimit(rawLimit);
    if (parsedLimit.error) { reply.code(400); return { error: parsedLimit.error }; }

    const dbStatus = await checkDatabaseStatus();
    if (dbStatus.status === 'offline') { reply.code(503); return { error: DB_OFFLINE_ERROR }; }

    let data;
    try {
      data = await getNearby({ lat, lon, radiusKm, observationType, sourceId, limit: parsedLimit.value });
    } catch {
      reply.code(500); return { error: INTERNAL_ERROR };
    }

    return WeatherNearbyResponseSchema.parse({
      data,
      meta: { layer_id: LAYER_ID, count: data.length, limit: parsedLimit.value, offset: 0, source_id: sourceId || DEFAULT_SOURCE_ID_FALLBACK, attribution: data.length > 0 ? data[0].attribution : 'Weather data provided by Open-Meteo under CC-BY 4.0 licence.', lat, lon, radius_km: radiusKm },
    });
  };

  fastify.get<{ Querystring: NearbyQuerystring }>(`/api/layers/${LAYER_ID}/weather/nearby`, nearbyHandler);
  fastify.get<{ Querystring: NearbyQuerystring }>(`/api/layers/${PUBLIC_SLUG}/nearby`, nearbyHandler);

  // E. Weather sources
  const sourcesHandler = async (_request: FastifyRequest, reply: FastifyReply) => {
    const dbStatus = await checkDatabaseStatus();
    if (dbStatus.status === 'offline') { reply.code(503); return { error: DB_OFFLINE_ERROR }; }

    let data;
    try {
      data = await getSources();
    } catch {
      reply.code(500); return { error: { ...INTERNAL_ERROR, message: 'An internal error occurred while fetching weather sources.' } };
    }

    return WeatherSourcesResponseSchema.parse({ data, meta: { count: data.length, layer_id: LAYER_ID } });
  };

  fastify.get(`/api/layers/${LAYER_ID}/weather/sources`, sourcesHandler);
  fastify.get(`/api/layers/${PUBLIC_SLUG}/sources`, sourcesHandler);

  // F. Fetch runs
  const fetchRunsHandler = async (request: FastifyRequest<{ Querystring: FetchRunsQuerystring }>, reply: FastifyReply) => {
    const { source_id: rawSourceId, status: rawStatus, limit: rawLimit, offset: rawOffset } = request.query;

    const parsedLimit = parseLimit(rawLimit);
    if (parsedLimit.error) { reply.code(400); return { error: parsedLimit.error }; }

    const parsedOffset = parseOffset(rawOffset);
    if (parsedOffset.error) { reply.code(400); return { error: parsedOffset.error }; }

    const sourceId = rawSourceId || null;

    if (rawStatus && !['running', 'completed', 'failed', 'partial'].includes(rawStatus)) {
      reply.code(400);
      return { error: { code: ErrorCodes.INVALID_QUERY, message: 'Invalid status. Must be one of: running, completed, failed, partial.', details: { provided: rawStatus } } };
    }
    const status = rawStatus || null;

    const dbStatus = await checkDatabaseStatus();
    if (dbStatus.status === 'offline') { reply.code(503); return { error: DB_OFFLINE_ERROR }; }

    let data;
    try {
      data = await getFetchRuns({ sourceId, status, limit: parsedLimit.value, offset: parsedOffset.value });
    } catch {
      reply.code(500); return { error: { ...INTERNAL_ERROR, message: 'An internal error occurred while fetching fetch runs.' } };
    }

    return WeatherFetchRunsResponseSchema.parse({ data, meta: { count: data.length, limit: parsedLimit.value, offset: parsedOffset.value, layer_id: LAYER_ID } });
  };

  fastify.get<{ Querystring: FetchRunsQuerystring }>(`/api/layers/${LAYER_ID}/weather/fetch-runs`, fetchRunsHandler);
  fastify.get<{ Querystring: FetchRunsQuerystring }>(`/api/layers/${PUBLIC_SLUG}/fetch-runs`, fetchRunsHandler);
}
