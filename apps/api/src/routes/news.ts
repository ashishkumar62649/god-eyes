import { FastifyInstance } from 'fastify';
import { checkDatabaseStatus, query } from '../lib/db.js';
import {
  NewsItemsListResponseSchema,
  NewsMarkersListResponseSchema,
  NewsSourcesResponseSchema,
  NewsFetchRunsResponseSchema,
  NewsStatsResponseSchema,
  ErrorCodes,
} from '@god-eyes/contracts';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_MARKER_LIMIT = 500;
const DEFAULT_OFFSET = 0;
const MAX_OFFSET = 10000;
const LAYER_ID = 'layer_08_news_osint';

interface ItemsQuerystring {
  source_id?: string;
  category?: string;
  subcategory?: string;
  severity?: string;
  country_code?: string;
  marker_ready?: string;
  has_coordinates?: string;
  geometry_type?: string;
  published_after?: string;
  published_before?: string;
  search?: string;
  limit?: string;
  offset?: string;
  order?: string;
}

interface MarkersQuerystring {
  source_id?: string;
  category?: string;
  subcategory?: string;
  severity?: string;
  country_code?: string;
  published_after?: string;
  published_before?: string;
  limit?: string;
  bounds?: string;
}

interface FetchRunsQuerystring {
  source_id?: string;
  status?: string;
  limit?: string;
  offset?: string;
}

interface NewsItemRow {
  item_id: string;
  layer_id: string;
  source_id: string;
  source_family: string;
  source_object_id: string | null;
  source_url: string | null;
  title: string;
  summary: string | null;
  content_type: string;
  published_at: Date | string | null;
  source_updated_at: Date | string | null;
  fetched_at: Date | string;
  first_seen_at: Date | string;
  last_seen_at: Date | string;
  location_confidence: string;
  country_code: string | null;
  country_name: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  geometry_type: string | null;
  geo_source: string | null;
  has_coordinates: boolean;
  marker_ready: boolean;
  category: string;
  subcategory: string | null;
  severity: string;
  source_domain: string | null;
  source_language: string | null;
  source_country: string | null;
  confidence_score: number | null;
  attribution: string;
  is_active: boolean;
}

interface NewsMarkerRow {
  item_id: string;
  title: string;
  source_id: string;
  source_url: string | null;
  latitude: number;
  longitude: number;
  country_code: string | null;
  country_name: string | null;
  category: string;
  subcategory: string | null;
  severity: string;
  published_at: Date | string | null;
  source_updated_at: Date | string | null;
  marker_ready: boolean;
  attribution: string;
}

interface NewsSourceRow {
  source_id: string;
  layer_id: string;
  source_family: string;
  display_name: string;
  endpoint_url: string;
  auth_type: string;
  attribution: string;
  license: string | null;
  enabled: boolean;
  last_fetched_at: Date | string | null;
  last_error: string | null;
  update_frequency_minutes: number | null;
}

interface NewsFetchRunRow {
  fetch_run_id: string;
  layer_id: string;
  source_id: string;
  source_family: string;
  run_type: string;
  status: string;
  started_at: Date | string;
  completed_at: Date | string | null;
  fetched_item_count: number;
  normalized_item_count: number;
  marker_ready_count: number;
  skipped_item_count: number;
  error_message: string | null;
  created_at: Date | string;
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

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return String(value);
}

function toIsoStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}

function parseLimit(raw: string | undefined, maxLimit = MAX_LIMIT): { value: number; error: { code: string; message: string; details: Record<string, unknown> } | null } {
  if (raw === undefined || raw === '') {
    return { value: maxLimit === MAX_MARKER_LIMIT ? MAX_MARKER_LIMIT : DEFAULT_LIMIT, error: null };
  }

  const n = Number(raw);
  if (isNaN(n) || !Number.isInteger(n) || n < 1) {
    return { value: DEFAULT_LIMIT, error: { code: ErrorCodes.INVALID_LIMIT, message: 'Limit must be a positive integer.', details: { provided: raw } } };
  }

  return { value: Math.min(n, maxLimit), error: null };
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

const NEWS_ITEM_SELECT_COLUMNS = `
  i.item_id,
  i.layer_id,
  i.source_id,
  i.source_family,
  i.source_object_id,
  i.source_url,
  i.title,
  i.summary,
  i.content_type,
  i.published_at,
  i.source_updated_at,
  i.fetched_at,
  i.first_seen_at,
  i.last_seen_at,
  i.location_confidence,
  i.country_code,
  i.country_name,
  i.region,
  i.city,
  i.latitude,
  i.longitude,
  i.geometry_type,
  i.geo_source,
  i.has_coordinates,
  i.marker_ready,
  i.category,
  i.subcategory,
  i.severity,
  i.source_domain,
  i.source_language,
  i.source_country,
  i.confidence_score,
  i.attribution,
  i.is_active
`;

function rowToNewsItem(row: NewsItemRow) {
  return {
    item_id: row.item_id,
    layer_id: row.layer_id,
    source_id: row.source_id,
    source_family: row.source_family,
    source_object_id: row.source_object_id,
    source_url: row.source_url,
    title: row.title,
    summary: row.summary,
    content_type: row.content_type,
    published_at: toIsoStringOrNull(row.published_at),
    source_updated_at: toIsoStringOrNull(row.source_updated_at),
    fetched_at: toIsoString(row.fetched_at),
    first_seen_at: toIsoString(row.first_seen_at),
    last_seen_at: toIsoString(row.last_seen_at),
    location: {
      confidence: row.location_confidence,
      country_code: row.country_code,
      country_name: row.country_name,
      region: row.region,
      city: row.city,
      latitude: toNumberOrNull(row.latitude),
      longitude: toNumberOrNull(row.longitude),
      geometry_type: row.geometry_type,
      geo_source: row.geo_source,
      has_coordinates: row.has_coordinates,
      marker_ready: row.marker_ready,
    },
    category: row.category,
    subcategory: row.subcategory,
    severity: row.severity,
    source_domain: row.source_domain,
    source_language: row.source_language,
    source_country: row.source_country,
    confidence_score: toNumberOrNull(row.confidence_score),
    attribution: row.attribution,
    is_active: row.is_active,
  };
}

function rowToNewsMarker(row: NewsMarkerRow) {
  return {
    item_id: row.item_id,
    title: row.title,
    source_id: row.source_id,
    source_url: row.source_url,
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    country_code: row.country_code,
    country_name: row.country_name,
    category: row.category,
    subcategory: row.subcategory,
    severity: row.severity,
    published_at: toIsoStringOrNull(row.published_at),
    source_updated_at: toIsoStringOrNull(row.source_updated_at),
    marker_ready: row.marker_ready,
    attribution: row.attribution,
  };
}

function buildItemsQuery(params: {
  sourceId: string | null;
  category: string | null;
  subcategory: string | null;
  severity: string | null;
  countryCode: string | null;
  markerReady: boolean | null;
  hasCoordinates: boolean | null;
  geometryType: string | null;
  publishedAfter: string | null;
  publishedBefore: string | null;
  search: string | null;
  limit: number;
  offset: number;
  order: string;
}): { sql: string; sqlParams: unknown[]; countSql: string; countParams: unknown[] } {
  const { sourceId, category, subcategory, severity, countryCode, markerReady, hasCoordinates, geometryType, publishedAfter, publishedBefore, search, limit, offset, order } = params;
  const conditions: string[] = [`i.layer_id = $1`];
  const sqlParams: unknown[] = [LAYER_ID];
  let paramIndex = 2;

  if (sourceId !== null) {
    conditions.push(`i.source_id = $${paramIndex}`);
    sqlParams.push(sourceId);
    paramIndex++;
  }

  if (category !== null) {
    conditions.push(`i.category = $${paramIndex}`);
    sqlParams.push(category);
    paramIndex++;
  }

  if (subcategory !== null) {
    conditions.push(`i.subcategory = $${paramIndex}`);
    sqlParams.push(subcategory);
    paramIndex++;
  }

  if (severity !== null) {
    conditions.push(`i.severity = $${paramIndex}`);
    sqlParams.push(severity);
    paramIndex++;
  }

  if (countryCode !== null) {
    conditions.push(`i.country_code = $${paramIndex}`);
    sqlParams.push(countryCode);
    paramIndex++;
  }

  if (markerReady !== null) {
    conditions.push(`i.marker_ready = $${paramIndex}`);
    sqlParams.push(markerReady);
    paramIndex++;
  }

  if (hasCoordinates !== null) {
    conditions.push(`i.has_coordinates = $${paramIndex}`);
    sqlParams.push(hasCoordinates);
    paramIndex++;
  }

  if (geometryType !== null) {
    conditions.push(`i.geometry_type = $${paramIndex}`);
    sqlParams.push(geometryType);
    paramIndex++;
  }

  if (publishedAfter !== null) {
    conditions.push(`i.published_at >= $${paramIndex}`);
    sqlParams.push(publishedAfter);
    paramIndex++;
  }

  if (publishedBefore !== null) {
    conditions.push(`i.published_at <= $${paramIndex}`);
    sqlParams.push(publishedBefore);
    paramIndex++;
  }

  if (search !== null) {
    conditions.push(`(i.title ILIKE $${paramIndex} OR i.summary ILIKE $${paramIndex})`);
    sqlParams.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderDir = order === 'asc' ? 'ASC' : 'DESC';

  const sql = `
    SELECT ${NEWS_ITEM_SELECT_COLUMNS}
    FROM news_items_latest i
    ${whereClause}
    ORDER BY i.published_at ${orderDir} NULLS LAST, i.fetched_at ${orderDir} NULLS LAST
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  const dataSqlParams = [...sqlParams, limit, offset];

  const countSql = `
    SELECT COUNT(*) AS total
    FROM news_items_latest i
    ${whereClause}
  `;
  const countSqlParams = [...sqlParams];

  return { sql, sqlParams: dataSqlParams, countSql, countParams: countSqlParams };
}

export async function newsRoutes(fastify: FastifyInstance) {
  // A. News items list
  fastify.get<{ Querystring: ItemsQuerystring }>(
    `/api/layers/${LAYER_ID}/news/items`,
    async (request, reply) => {
      const { source_id: rawSourceId, category: rawCategory, subcategory: rawSubcategory, severity: rawSeverity, country_code: rawCountryCode, marker_ready: rawMarkerReady, has_coordinates: rawHasCoordinates, geometry_type: rawGeometryType, published_after: rawPublishedAfter, published_before: rawPublishedBefore, search: rawSearch, limit: rawLimit, offset: rawOffset, order: rawOrder } = request.query;

      const parsedLimit = parseLimit(rawLimit, MAX_LIMIT);
      if (parsedLimit.error) {
        reply.code(400);
        return { error: parsedLimit.error };
      }

      const parsedOffset = parseOffset(rawOffset);
      if (parsedOffset.error) {
        reply.code(400);
        return { error: parsedOffset.error };
      }

      if (rawOrder !== undefined && rawOrder !== '') {
        if (!['asc', 'desc'].includes(rawOrder)) {
          reply.code(400);
          return {
            error: {
              code: ErrorCodes.INVALID_QUERY,
              message: 'Invalid order. Must be "asc" or "desc".',
              details: { provided: rawOrder },
            },
          };
        }
      }
      const order = rawOrder !== undefined && rawOrder !== '' ? rawOrder : 'desc';

      let markerReady: boolean | null = null;
      if (rawMarkerReady !== undefined && rawMarkerReady !== '') {
        if (rawMarkerReady !== 'true' && rawMarkerReady !== 'false') {
          reply.code(400);
          return {
            error: {
              code: ErrorCodes.INVALID_QUERY,
              message: 'Invalid marker_ready. Must be "true" or "false".',
              details: { provided: rawMarkerReady },
            },
          };
        }
        markerReady = rawMarkerReady === 'true';
      }

      let hasCoordinates: boolean | null = null;
      if (rawHasCoordinates !== undefined && rawHasCoordinates !== '') {
        if (rawHasCoordinates !== 'true' && rawHasCoordinates !== 'false') {
          reply.code(400);
          return {
            error: {
              code: ErrorCodes.INVALID_QUERY,
              message: 'Invalid has_coordinates. Must be "true" or "false".',
              details: { provided: rawHasCoordinates },
            },
          };
        }
        hasCoordinates = rawHasCoordinates === 'true';
      }

      const sourceId = rawSourceId !== undefined && rawSourceId !== '' ? rawSourceId : null;
      const category = rawCategory !== undefined && rawCategory !== '' ? rawCategory : null;
      const subcategory = rawSubcategory !== undefined && rawSubcategory !== '' ? rawSubcategory : null;
      const severity = rawSeverity !== undefined && rawSeverity !== '' ? rawSeverity : null;
      const countryCode = rawCountryCode !== undefined && rawCountryCode !== '' ? rawCountryCode : null;
      const geometryType = rawGeometryType !== undefined && rawGeometryType !== '' ? rawGeometryType : null;

      if (rawPublishedAfter !== undefined && rawPublishedAfter !== '') {
        if (!isValidIsoDatetime(rawPublishedAfter)) {
          reply.code(400);
          return {
            error: {
              code: ErrorCodes.INVALID_QUERY,
              message: 'Invalid published_after format. Expected ISO 8601 datetime.',
              details: { provided: rawPublishedAfter },
            },
          };
        }
      }
      const publishedAfter = rawPublishedAfter !== undefined && rawPublishedAfter !== '' ? rawPublishedAfter : null;

      if (rawPublishedBefore !== undefined && rawPublishedBefore !== '') {
        if (!isValidIsoDatetime(rawPublishedBefore)) {
          reply.code(400);
          return {
            error: {
              code: ErrorCodes.INVALID_QUERY,
              message: 'Invalid published_before format. Expected ISO 8601 datetime.',
              details: { provided: rawPublishedBefore },
            },
          };
        }
      }
      const publishedBefore = rawPublishedBefore !== undefined && rawPublishedBefore !== '' ? rawPublishedBefore : null;

      if (publishedAfter !== null && publishedBefore !== null && new Date(publishedAfter) > new Date(publishedBefore)) {
        reply.code(400);
        return {
          error: {
            code: ErrorCodes.INVALID_QUERY,
            message: 'published_after must be before or equal to published_before.',
            details: { published_after: publishedAfter, published_before: publishedBefore },
          },
        };
      }

      const search = rawSearch !== undefined && rawSearch !== '' ? rawSearch : null;

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

      const queryParams = {
        sourceId,
        category,
        subcategory,
        severity,
        countryCode,
        markerReady,
        hasCoordinates,
        geometryType,
        publishedAfter,
        publishedBefore,
        search,
        limit: parsedLimit.value,
        offset: parsedOffset.value,
        order,
      };

      const { sql, sqlParams: dataSqlParams, countSql, countParams } = buildItemsQuery(queryParams);

      let rows: NewsItemRow[];
      let totalCount = 0;
      try {
        rows = await query<NewsItemRow>(sql, dataSqlParams);
        const countResult = await query<{ total: number }>(countSql, countParams);
        totalCount = countResult.length > 0 ? Number(countResult[0].total) : 0;
      } catch {
        reply.code(500);
        return {
          error: {
            code: ErrorCodes.INTERNAL_ERROR,
            message: 'An internal error occurred while fetching news items.',
            details: {},
          },
        };
      }

      const data = rows.map(rowToNewsItem);

      return NewsItemsListResponseSchema.parse({
        data,
        meta: {
          layer_id: LAYER_ID,
          count: data.length,
          limit: parsedLimit.value,
          offset: parsedOffset.value,
          total: totalCount,
        },
      });
    }
  );

  // B. News markers (Point only, marker_ready = true, geom IS NOT NULL)
  fastify.get<{ Querystring: MarkersQuerystring }>(
    `/api/layers/${LAYER_ID}/news/markers`,
    async (request, reply) => {
      const { source_id: rawSourceId, category: rawCategory, subcategory: rawSubcategory, severity: rawSeverity, country_code: rawCountryCode, published_after: rawPublishedAfter, published_before: rawPublishedBefore, limit: rawLimit, bounds: rawBounds } = request.query;

      const parsedLimit = parseLimit(rawLimit, MAX_MARKER_LIMIT);
      if (parsedLimit.error) {
        reply.code(400);
        return { error: parsedLimit.error };
      }

      const sourceId = rawSourceId !== undefined && rawSourceId !== '' ? rawSourceId : null;
      const category = rawCategory !== undefined && rawCategory !== '' ? rawCategory : null;
      const subcategory = rawSubcategory !== undefined && rawSubcategory !== '' ? rawSubcategory : null;
      const severity = rawSeverity !== undefined && rawSeverity !== '' ? rawSeverity : null;
      const countryCode = rawCountryCode !== undefined && rawCountryCode !== '' ? rawCountryCode : null;

      if (rawPublishedAfter !== undefined && rawPublishedAfter !== '') {
        if (!isValidIsoDatetime(rawPublishedAfter)) {
          reply.code(400);
          return {
            error: {
              code: ErrorCodes.INVALID_QUERY,
              message: 'Invalid published_after format. Expected ISO 8601 datetime.',
              details: { provided: rawPublishedAfter },
            },
          };
        }
      }
      const publishedAfter = rawPublishedAfter !== undefined && rawPublishedAfter !== '' ? rawPublishedAfter : null;

      if (rawPublishedBefore !== undefined && rawPublishedBefore !== '') {
        if (!isValidIsoDatetime(rawPublishedBefore)) {
          reply.code(400);
          return {
            error: {
              code: ErrorCodes.INVALID_QUERY,
              message: 'Invalid published_before format. Expected ISO 8601 datetime.',
              details: { provided: rawPublishedBefore },
            },
          };
        }
      }
      const publishedBefore = rawPublishedBefore !== undefined && rawPublishedBefore !== '' ? rawPublishedBefore : null;

      if (publishedAfter !== null && publishedBefore !== null && new Date(publishedAfter) > new Date(publishedBefore)) {
        reply.code(400);
        return {
          error: {
            code: ErrorCodes.INVALID_QUERY,
            message: 'published_after must be before or equal to published_before.',
            details: { published_after: publishedAfter, published_before: publishedBefore },
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

      const conditions: string[] = [`i.layer_id = $1`, `i.marker_ready = TRUE`, `i.geom IS NOT NULL`];
      const sqlParams: unknown[] = [LAYER_ID];
      let paramIndex = 2;

      if (sourceId !== null) {
        conditions.push(`i.source_id = $${paramIndex}`);
        sqlParams.push(sourceId);
        paramIndex++;
      }

      if (category !== null) {
        conditions.push(`i.category = $${paramIndex}`);
        sqlParams.push(category);
        paramIndex++;
      }

      if (subcategory !== null) {
        conditions.push(`i.subcategory = $${paramIndex}`);
        sqlParams.push(subcategory);
        paramIndex++;
      }

      if (severity !== null) {
        conditions.push(`i.severity = $${paramIndex}`);
        sqlParams.push(severity);
        paramIndex++;
      }

      if (countryCode !== null) {
        conditions.push(`i.country_code = $${paramIndex}`);
        sqlParams.push(countryCode);
        paramIndex++;
      }

      if (publishedAfter !== null) {
        conditions.push(`i.published_at >= $${paramIndex}`);
        sqlParams.push(publishedAfter);
        paramIndex++;
      }

      if (publishedBefore !== null) {
        conditions.push(`i.published_at <= $${paramIndex}`);
        sqlParams.push(publishedBefore);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const sql = `
        SELECT
          i.item_id,
          i.title,
          i.source_id,
          i.source_url,
          i.latitude,
          i.longitude,
          i.country_code,
          i.country_name,
          i.category,
          i.subcategory,
          i.severity,
          i.published_at,
          i.source_updated_at,
          i.marker_ready,
          i.attribution
        FROM news_items_latest i
        ${whereClause}
        ORDER BY i.published_at DESC NULLS LAST, i.fetched_at DESC NULLS LAST
        LIMIT $${paramIndex}
      `;
      sqlParams.push(parsedLimit.value);

      let rows: NewsMarkerRow[];
      try {
        rows = await query<NewsMarkerRow>(sql, sqlParams);
      } catch {
        reply.code(500);
        return {
          error: {
            code: ErrorCodes.INTERNAL_ERROR,
            message: 'An internal error occurred while fetching news markers.',
            details: {},
          },
        };
      }

      const data = rows.map(rowToNewsMarker);

      return NewsMarkersListResponseSchema.parse({
        data,
        meta: {
          layer_id: LAYER_ID,
          count: data.length,
          limit: parsedLimit.value,
        },
      });
    }
  );

  // C. News sources
  fastify.get(
    `/api/layers/${LAYER_ID}/news/sources`,
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

      let rows: NewsSourceRow[];
      try {
        rows = await query<NewsSourceRow>(
          `SELECT
            source_id,
            layer_id,
            source_family,
            display_name,
            endpoint_url,
            auth_type,
            attribution,
            license,
            enabled,
            last_fetched_at,
            last_error,
            update_frequency_minutes
           FROM news_sources
           WHERE layer_id = $1
           ORDER BY display_name`,
          [LAYER_ID],
        );
      } catch {
        reply.code(500);
        return {
          error: {
            code: ErrorCodes.INTERNAL_ERROR,
            message: 'An internal error occurred while fetching news sources.',
            details: {},
          },
        };
      }

      return NewsSourcesResponseSchema.parse({
        data: rows.map((row) => ({
          source_id: row.source_id,
          layer_id: row.layer_id,
          source_family: row.source_family,
          display_name: row.display_name,
          endpoint_url: row.endpoint_url,
          auth_type: row.auth_type,
          attribution: row.attribution,
          license: row.license,
          enabled: row.enabled,
          last_fetched_at: toIsoStringOrNull(row.last_fetched_at),
          last_error: row.last_error,
          update_frequency_minutes: row.update_frequency_minutes,
        })),
        meta: {
          count: rows.length,
          layer_id: LAYER_ID,
        },
      });
    }
  );

  // D. Fetch runs
  fastify.get<{ Querystring: FetchRunsQuerystring }>(
    `/api/layers/${LAYER_ID}/news/fetch-runs`,
    async (request, reply) => {
      const { source_id: rawSourceId, status: rawStatus, limit: rawLimit, offset: rawOffset } = request.query;

      const parsedLimit = parseLimit(rawLimit, MAX_LIMIT);
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
        if (!['running', 'success', 'partial', 'failed'].includes(rawStatus)) {
          reply.code(400);
          return {
            error: {
              code: ErrorCodes.INVALID_QUERY,
              message: 'Invalid status. Must be one of: running, success, partial, failed.',
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

      let rows: NewsFetchRunRow[];
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
            f.layer_id,
            f.source_id,
            f.source_family,
            f.run_type,
            f.status,
            f.started_at,
            f.completed_at,
            f.fetched_item_count,
            f.normalized_item_count,
            f.marker_ready_count,
            f.skipped_item_count,
            f.error_message,
            f.created_at
          FROM news_fetch_runs f
          ${whereClause}
          ORDER BY f.started_at DESC
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
        sqlParams.push(parsedLimit.value, parsedOffset.value);

        rows = await query<NewsFetchRunRow>(sql, sqlParams);
      } catch {
        reply.code(500);
        return {
          error: {
            code: ErrorCodes.INTERNAL_ERROR,
            message: 'An internal error occurred while fetching news fetch runs.',
            details: {},
          },
        };
      }

      return NewsFetchRunsResponseSchema.parse({
        data: rows.map((row) => ({
          fetch_run_id: row.fetch_run_id,
          layer_id: row.layer_id,
          source_id: row.source_id,
          source_family: row.source_family,
          run_type: row.run_type,
          status: row.status,
          started_at: toIsoString(row.started_at),
          completed_at: toIsoStringOrNull(row.completed_at),
          fetched_item_count: row.fetched_item_count,
          normalized_item_count: row.normalized_item_count,
          marker_ready_count: row.marker_ready_count,
          skipped_item_count: row.skipped_item_count,
          error_message: row.error_message,
          created_at: toIsoString(row.created_at),
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

  // E. News stats
  fastify.get(
    `/api/layers/${LAYER_ID}/news/stats`,
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

      try {
        const [totalRows, markerRows, geomRows, sourceRows, categoryRows, subcategoryRows, severityRows, geometryTypeRows, latestRunRows, fakeCoordRows] = await Promise.all([
          query<{ count: number }>(`SELECT COUNT(*) AS count FROM news_items_latest WHERE layer_id = $1`, [LAYER_ID]),
          query<{ count: number }>(`SELECT COUNT(*) AS count FROM news_items_latest WHERE layer_id = $1 AND marker_ready = TRUE`, [LAYER_ID]),
          query<{ count: number }>(`SELECT COUNT(*) AS count FROM news_items_latest WHERE layer_id = $1 AND geom IS NOT NULL`, [LAYER_ID]),
          query<{ source_id: string; count: number }>(`SELECT source_id, COUNT(*) AS count FROM news_items_latest WHERE layer_id = $1 GROUP BY source_id ORDER BY source_id`, [LAYER_ID]),
          query<{ category: string; count: number }>(`SELECT category, COUNT(*) AS count FROM news_items_latest WHERE layer_id = $1 GROUP BY category ORDER BY category`, [LAYER_ID]),
          query<{ subcategory: string; count: number }>(`SELECT subcategory, COUNT(*) AS count FROM news_items_latest WHERE layer_id = $1 AND subcategory IS NOT NULL GROUP BY subcategory ORDER BY subcategory`, [LAYER_ID]),
          query<{ severity: string; count: number }>(`SELECT severity, COUNT(*) AS count FROM news_items_latest WHERE layer_id = $1 GROUP BY severity ORDER BY severity`, [LAYER_ID]),
          query<{ geometry_type: string; count: number }>(`SELECT COALESCE(geometry_type, 'none') AS geometry_type, COUNT(*) AS count FROM news_items_latest WHERE layer_id = $1 GROUP BY geometry_type ORDER BY geometry_type`, [LAYER_ID]),
          query<{ fetch_run_id: string }>(`SELECT fetch_run_id FROM news_fetch_runs WHERE layer_id = $1 ORDER BY started_at DESC LIMIT 1`, [LAYER_ID]),
          query<{ count: number }>(`SELECT COUNT(*) AS count FROM news_items_latest WHERE layer_id = $1 AND geometry_type IN ('LineString', 'Polygon') AND (latitude IS NOT NULL OR longitude IS NOT NULL OR geom IS NOT NULL OR marker_ready = TRUE)`, [LAYER_ID]),
        ]);

        const totalItems = totalRows.length > 0 ? Number(totalRows[0].count) : 0;
        const markerReadyItems = markerRows.length > 0 ? Number(markerRows[0].count) : 0;
        const itemsWithGeom = geomRows.length > 0 ? Number(geomRows[0].count) : 0;
        const latestFetchRun = latestRunRows.length > 0 ? latestRunRows[0].fetch_run_id : null;
        const fakeCoordinateRiskCount = fakeCoordRows.length > 0 ? Number(fakeCoordRows[0].count) : 0;

        return NewsStatsResponseSchema.parse({
          layer_id: LAYER_ID,
          total_items: totalItems,
          marker_ready_items: markerReadyItems,
          items_with_geom: itemsWithGeom,
          by_source: sourceRows.map(r => ({ source_id: r.source_id, count: Number(r.count) })),
          by_category: categoryRows.map(r => ({ category: r.category, count: Number(r.count) })),
          by_subcategory: subcategoryRows.map(r => ({ subcategory: r.subcategory, count: Number(r.count) })),
          by_severity: severityRows.map(r => ({ severity: r.severity, count: Number(r.count) })),
          by_geometry_type: geometryTypeRows.map(r => ({ geometry_type: r.geometry_type, count: Number(r.count) })),
          latest_fetch_run: latestFetchRun,
          fake_coordinate_risk_count: fakeCoordinateRiskCount,
        });
      } catch {
        reply.code(500);
        return {
          error: {
            code: ErrorCodes.INTERNAL_ERROR,
            message: 'An internal error occurred while fetching news stats.',
            details: {},
          },
        };
      }
    }
  );
}
