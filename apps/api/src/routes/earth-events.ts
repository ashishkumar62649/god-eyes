import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { checkDatabaseStatus, query } from '../lib/db.js';
import { toIsoString } from '../lib/typeUtils.js';
import { parseBbox, parseLimit, isValidIsoDatetime, BBox } from '../lib/requestValidation.js';
import {
  EarthEventsLatestResponseSchema,
  ErrorCodes,
} from '@god-eyes/contracts';

const LAYER_ID = 'layer_03_earth_events';
const PUBLIC_SLUG = 'earth-events';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

interface EarthEventsLatestQuerystring {
  limit?: string;
  bbox?: string;
  event_type?: string;
  since?: string;
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

// HTTP route handlers for Layer 03 — Earth Events. No SQL, no business logic here.
//
// Clean public slug aliases added per API-POLICY-001:
//   /api/layers/earth-events/latest  (alias for /api/earth-events/latest)
//
// Old paths remain registered for compatibility and are not removed in this work order.

export async function earthEventsRoutes(fastify: FastifyInstance) {
  // The handler is defined once and registered under both the legacy domain
  // path and the new clean public slug path. meta.layerId continues to use
  // the internal layer ID per API-POLICY-001.

  const latestHandler = async (request: FastifyRequest<{ Querystring: EarthEventsLatestQuerystring }>, reply: FastifyReply) => {
    const { limit: rawLimit, bbox: rawBbox, event_type: rawEventType, since: rawSince } = request.query;

    // Validate limit
    const parsed = parseLimit(rawLimit, DEFAULT_LIMIT, MAX_LIMIT);
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
  };

  fastify.get<{ Querystring: EarthEventsLatestQuerystring }>('/api/earth-events/latest', latestHandler);
  fastify.get<{ Querystring: EarthEventsLatestQuerystring }>(`/api/layers/${PUBLIC_SLUG}/latest`, latestHandler);

  // Suppress LAYER_ID unused warning: kept intentionally for future metadata symmetry with other layer routes.
  void LAYER_ID;
}
