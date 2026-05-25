import { FastifyInstance } from 'fastify';
import { checkDatabaseStatus, query } from '../lib/db.js';
import {
  EarthEventsLatestResponseSchema,
  ErrorCodes,
} from '@god-eyes/contracts';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

interface EarthEventsLatestQuerystring {
  limit?: string;
  bbox?: string;
  event_type?: string;
  since?: string;
}

interface BBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

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

function parseLimit(raw: string | undefined): { value: number; error: { code: string; message: string } | null } {
  if (raw === undefined || raw === '') {
    return { value: DEFAULT_LIMIT, error: null };
  }

  const n = Number(raw);
  if (isNaN(n) || !Number.isInteger(n) || n < 1) {
    return { value: DEFAULT_LIMIT, error: { code: ErrorCodes.INVALID_LIMIT, message: 'Limit must be a positive integer.' } };
  }

  return { value: Math.min(n, MAX_LIMIT), error: null };
}

function isValidIsoDatetime(raw: string): boolean {
  const d = new Date(raw);
  return d instanceof Date && !isNaN(d.getTime()) && raw.includes('T');
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return String(value);
}

interface EarthEventRow {
  id: string;
  layerId: string;
  sourceId: string;
  sourceObjectId: string;
  eventType: string;
  magnitude: string | null;
  magnitudeType: string | null;
  depthKm: string | null;
  place: string | null;
  alertLevel: string | null;
  significance: string | null;
  tsunami: boolean;
  geometry: { type: 'Point'; coordinates: [number, number] };
  sourceUrl: string | null;
  observedAt: string | Date;
  updatedAt: string | Date;
  fetchedAt: string | Date;
}

function rowToEvent(row: EarthEventRow) {
  return {
    id: row.id,
    layerId: row.layerId,
    sourceId: row.sourceId,
    sourceObjectId: row.sourceObjectId,
    eventType: row.eventType,
    magnitude: row.magnitude !== null ? Number(row.magnitude) : null,
    magnitudeType: row.magnitudeType,
    depthKm: row.depthKm !== null ? Number(row.depthKm) : null,
    place: row.place,
    alertLevel: row.alertLevel,
    significance: row.significance !== null ? Number(row.significance) : null,
    tsunami: row.tsunami,
    geometry: row.geometry,
    sourceUrl: row.sourceUrl,
    observedAt: toIsoString(row.observedAt),
    updatedAt: toIsoString(row.updatedAt),
    fetchedAt: toIsoString(row.fetchedAt),
  };
}

export async function earthEventsRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: EarthEventsLatestQuerystring }>(
    '/api/earth-events/latest',
    async (request, reply) => {
      const { limit: rawLimit, bbox: rawBbox, event_type: rawEventType, since: rawSince } = request.query;

      // Validate limit
      const parsed = parseLimit(rawLimit);
      if (parsed.error) {
        reply.code(400);
        return {
          error: {
            code: parsed.error.code,
            message: parsed.error.message,
            details: { provided: rawLimit },
          },
        };
      }
      const limit = parsed.value;

      // Validate bbox
      let bbox: BBox | null = null;
      if (rawBbox !== undefined && rawBbox !== '') {
        bbox = parseBbox(rawBbox);
        if (!bbox) {
          reply.code(400);
          return {
            error: {
              code: ErrorCodes.INVALID_BBOX,
              message: 'Invalid bbox format. Expected: minLon,minLat,maxLon,maxLat. Valid ranges: lon [-180,180], lat [-90,90].',
              details: { provided: rawBbox },
            },
          };
        }
      }

      // Validate since
      if (rawSince !== undefined && rawSince !== '') {
        if (!isValidIsoDatetime(rawSince)) {
          reply.code(400);
          return {
            error: {
              code: ErrorCodes.INVALID_QUERY,
              message: 'Invalid since format. Expected ISO 8601 datetime (e.g. 2026-01-01T00:00:00Z).',
              details: { provided: rawSince },
            },
          };
        }
      }

      // Check database
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

      // Build query
      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (rawEventType !== undefined && rawEventType !== '') {
        conditions.push(`event_type = $${paramIndex++}`);
        params.push(rawEventType);
      }

      if (bbox) {
        conditions.push(`ST_Intersects(geometry, ST_MakeEnvelope($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, 4326))`);
        params.push(bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat);
        paramIndex += 4;
      }

      if (rawSince !== undefined && rawSince !== '') {
        conditions.push(`observed_at >= $${paramIndex++}`);
        params.push(rawSince);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const sql = `
        SELECT
          id,
          layer_id AS "layerId",
          source_id AS "sourceId",
          source_object_id AS "sourceObjectId",
          event_type AS "eventType",
          magnitude,
          magnitude_type AS "magnitudeType",
          depth_km AS "depthKm",
          place,
          alert_level AS "alertLevel",
          significance,
          tsunami,
          ST_AsGeoJSON(geometry)::json AS geometry,
          source_url AS "sourceUrl",
          observed_at AS "observedAt",
          updated_at AS "updatedAt",
          fetched_at AS "fetchedAt"
        FROM earth_events_latest
        ${whereClause}
        ORDER BY observed_at DESC
        LIMIT $${paramIndex}
      `;
      params.push(limit);

      // Execute query
      let rows: EarthEventRow[];
      try {
        rows = await query<EarthEventRow>(sql, params);
      } catch {
        reply.code(500);
        return {
          error: {
            code: ErrorCodes.INTERNAL_ERROR,
            message: 'An internal error occurred while fetching earth events.',
            details: {},
          },
        };
      }

      const events = rows.map(rowToEvent);

      return EarthEventsLatestResponseSchema.parse({
        events,
        metadata: {
          count: events.length,
          generatedAt: new Date().toISOString(),
        },
      });
    }
  );
}
