// HTTP route handlers for Layer 08 — News & OSINT. No SQL, no business logic here.
import { FastifyInstance } from 'fastify';
import {
  NewsItemsListResponseSchema,
  NewsMarkersListResponseSchema,
  NewsSourcesResponseSchema,
  NewsFetchRunsResponseSchema,
  NewsStatsResponseSchema,
  ErrorCodes,
} from '@god-eyes/contracts';
import { parseLimit, parseOffset, isValidIsoDatetime, MAX_LIMIT, MAX_MARKER_LIMIT } from './validation.js';
import { getItems, getMarkers, getSources, getFetchRuns, getStats, checkDatabaseStatus } from './service.js';
import type { ItemsQuerystring, MarkersQuerystring, FetchRunsQuerystring } from './types.js';

const LAYER_ID = 'layer_08_news_osint';

const DB_OFFLINE_ERROR = { code: ErrorCodes.DATABASE_OFFLINE, message: 'Database is not available.', details: {} };
const INTERNAL_ERROR = { code: ErrorCodes.INTERNAL_ERROR, message: 'An internal error occurred.', details: {} };

export async function newsRoutes(fastify: FastifyInstance) {
  // A. News items list
  fastify.get<{ Querystring: ItemsQuerystring }>(
    `/api/layers/${LAYER_ID}/news/items`,
    async (request, reply) => {
      const { source_id: rawSourceId, category: rawCategory, subcategory: rawSubcategory, severity: rawSeverity, country_code: rawCountryCode, marker_ready: rawMarkerReady, has_coordinates: rawHasCoordinates, geometry_type: rawGeometryType, published_after: rawPublishedAfter, published_before: rawPublishedBefore, search: rawSearch, limit: rawLimit, offset: rawOffset, order: rawOrder } = request.query;

      const parsedLimit = parseLimit(rawLimit, MAX_LIMIT);
      if (parsedLimit.error) { reply.code(400); return { error: parsedLimit.error }; }

      const parsedOffset = parseOffset(rawOffset);
      if (parsedOffset.error) { reply.code(400); return { error: parsedOffset.error }; }

      if (rawOrder && !['asc', 'desc'].includes(rawOrder)) {
        reply.code(400);
        return { error: { code: ErrorCodes.INVALID_QUERY, message: 'Invalid order. Must be "asc" or "desc".', details: { provided: rawOrder } } };
      }
      const order = rawOrder || 'desc';

      let markerReady: boolean | null = null;
      if (rawMarkerReady) {
        if (rawMarkerReady !== 'true' && rawMarkerReady !== 'false') {
          reply.code(400);
          return { error: { code: ErrorCodes.INVALID_QUERY, message: 'Invalid marker_ready. Must be "true" or "false".', details: { provided: rawMarkerReady } } };
        }
        markerReady = rawMarkerReady === 'true';
      }

      let hasCoordinates: boolean | null = null;
      if (rawHasCoordinates) {
        if (rawHasCoordinates !== 'true' && rawHasCoordinates !== 'false') {
          reply.code(400);
          return { error: { code: ErrorCodes.INVALID_QUERY, message: 'Invalid has_coordinates. Must be "true" or "false".', details: { provided: rawHasCoordinates } } };
        }
        hasCoordinates = rawHasCoordinates === 'true';
      }

      if (rawPublishedAfter && !isValidIsoDatetime(rawPublishedAfter)) {
        reply.code(400);
        return { error: { code: ErrorCodes.INVALID_QUERY, message: 'Invalid published_after format. Expected ISO 8601 datetime.', details: { provided: rawPublishedAfter } } };
      }
      const publishedAfter = rawPublishedAfter || null;

      if (rawPublishedBefore && !isValidIsoDatetime(rawPublishedBefore)) {
        reply.code(400);
        return { error: { code: ErrorCodes.INVALID_QUERY, message: 'Invalid published_before format. Expected ISO 8601 datetime.', details: { provided: rawPublishedBefore } } };
      }
      const publishedBefore = rawPublishedBefore || null;

      if (publishedAfter && publishedBefore && new Date(publishedAfter) > new Date(publishedBefore)) {
        reply.code(400);
        return { error: { code: ErrorCodes.INVALID_QUERY, message: 'published_after must be before or equal to published_before.', details: { published_after: publishedAfter, published_before: publishedBefore } } };
      }

      const dbStatus = await checkDatabaseStatus();
      if (dbStatus.status === 'offline') { reply.code(503); return { error: DB_OFFLINE_ERROR }; }

      let result;
      try {
        result = await getItems({
          sourceId: rawSourceId || null,
          category: rawCategory || null,
          subcategory: rawSubcategory || null,
          severity: rawSeverity || null,
          countryCode: rawCountryCode || null,
          markerReady,
          hasCoordinates,
          geometryType: rawGeometryType || null,
          publishedAfter,
          publishedBefore,
          search: rawSearch || null,
          limit: parsedLimit.value,
          offset: parsedOffset.value,
          order,
        });
      } catch {
        reply.code(500); return { error: INTERNAL_ERROR };
      }

      return NewsItemsListResponseSchema.parse({
        data: result.data,
        meta: { layer_id: LAYER_ID, count: result.data.length, limit: parsedLimit.value, offset: parsedOffset.value, total: result.total },
      });
    }
  );

  // B. News markers
  fastify.get<{ Querystring: MarkersQuerystring }>(
    `/api/layers/${LAYER_ID}/news/markers`,
    async (request, reply) => {
      const { source_id: rawSourceId, category: rawCategory, subcategory: rawSubcategory, severity: rawSeverity, country_code: rawCountryCode, published_after: rawPublishedAfter, published_before: rawPublishedBefore, limit: rawLimit } = request.query;

      const parsedLimit = parseLimit(rawLimit, MAX_MARKER_LIMIT);
      if (parsedLimit.error) { reply.code(400); return { error: parsedLimit.error }; }

      if (rawPublishedAfter && !isValidIsoDatetime(rawPublishedAfter)) {
        reply.code(400);
        return { error: { code: ErrorCodes.INVALID_QUERY, message: 'Invalid published_after format. Expected ISO 8601 datetime.', details: { provided: rawPublishedAfter } } };
      }
      const publishedAfter = rawPublishedAfter || null;

      if (rawPublishedBefore && !isValidIsoDatetime(rawPublishedBefore)) {
        reply.code(400);
        return { error: { code: ErrorCodes.INVALID_QUERY, message: 'Invalid published_before format. Expected ISO 8601 datetime.', details: { provided: rawPublishedBefore } } };
      }
      const publishedBefore = rawPublishedBefore || null;

      if (publishedAfter && publishedBefore && new Date(publishedAfter) > new Date(publishedBefore)) {
        reply.code(400);
        return { error: { code: ErrorCodes.INVALID_QUERY, message: 'published_after must be before or equal to published_before.', details: { published_after: publishedAfter, published_before: publishedBefore } } };
      }

      const dbStatus = await checkDatabaseStatus();
      if (dbStatus.status === 'offline') { reply.code(503); return { error: DB_OFFLINE_ERROR }; }

      let data;
      try {
        data = await getMarkers({ sourceId: rawSourceId || null, category: rawCategory || null, subcategory: rawSubcategory || null, severity: rawSeverity || null, countryCode: rawCountryCode || null, publishedAfter, publishedBefore, limit: parsedLimit.value });
      } catch {
        reply.code(500); return { error: INTERNAL_ERROR };
      }

      return NewsMarkersListResponseSchema.parse({ data, meta: { layer_id: LAYER_ID, count: data.length, limit: parsedLimit.value } });
    }
  );

  // C. News sources
  fastify.get(
    `/api/layers/${LAYER_ID}/news/sources`,
    async (_request, reply) => {
      const dbStatus = await checkDatabaseStatus();
      if (dbStatus.status === 'offline') { reply.code(503); return { error: DB_OFFLINE_ERROR }; }

      let data;
      try {
        data = await getSources();
      } catch {
        reply.code(500); return { error: INTERNAL_ERROR };
      }

      return NewsSourcesResponseSchema.parse({ data, meta: { count: data.length, layer_id: LAYER_ID } });
    }
  );

  // D. Fetch runs
  fastify.get<{ Querystring: FetchRunsQuerystring }>(
    `/api/layers/${LAYER_ID}/news/fetch-runs`,
    async (request, reply) => {
      const { source_id: rawSourceId, status: rawStatus, limit: rawLimit, offset: rawOffset } = request.query;

      const parsedLimit = parseLimit(rawLimit, MAX_LIMIT);
      if (parsedLimit.error) { reply.code(400); return { error: parsedLimit.error }; }

      const parsedOffset = parseOffset(rawOffset);
      if (parsedOffset.error) { reply.code(400); return { error: parsedOffset.error }; }

      if (rawStatus && !['running', 'success', 'partial', 'failed'].includes(rawStatus)) {
        reply.code(400);
        return { error: { code: ErrorCodes.INVALID_QUERY, message: 'Invalid status. Must be one of: running, success, partial, failed.', details: { provided: rawStatus } } };
      }

      const dbStatus = await checkDatabaseStatus();
      if (dbStatus.status === 'offline') { reply.code(503); return { error: DB_OFFLINE_ERROR }; }

      let data;
      try {
        data = await getFetchRuns({ sourceId: rawSourceId || null, status: rawStatus || null, limit: parsedLimit.value, offset: parsedOffset.value });
      } catch {
        reply.code(500); return { error: INTERNAL_ERROR };
      }

      return NewsFetchRunsResponseSchema.parse({ data, meta: { count: data.length, limit: parsedLimit.value, offset: parsedOffset.value, layer_id: LAYER_ID } });
    }
  );

  // E. News stats
  fastify.get(
    `/api/layers/${LAYER_ID}/news/stats`,
    async (_request, reply) => {
      const dbStatus = await checkDatabaseStatus();
      if (dbStatus.status === 'offline') { reply.code(503); return { error: DB_OFFLINE_ERROR }; }

      try {
        const stats = await getStats(LAYER_ID);
        return NewsStatsResponseSchema.parse(stats);
      } catch {
        reply.code(500); return { error: INTERNAL_ERROR };
      }
    }
  );
}
