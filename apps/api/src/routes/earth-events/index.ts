import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  EarthEventsLatestResponseSchema,
  ErrorCodes,
} from '@god-eyes/contracts';
import { parseBbox, parseLimit, isValidIsoDatetime, DEFAULT_LIMIT, MAX_LIMIT } from './validation.js';
import { getLatest, checkDatabaseStatus } from './service.js';
import type { EarthEventsLatestQuerystring } from './types.js';

const LAYER_ID = 'layer_03_earth_events';
const PUBLIC_SLUG = 'earth-events';

export async function earthEventsRoutes(fastify: FastifyInstance) {
  const latestHandler = async (request: FastifyRequest<{ Querystring: EarthEventsLatestQuerystring }>, reply: FastifyReply) => {
    const { limit: rawLimit, bbox: rawBbox, event_type: rawEventType, since: rawSince } = request.query;

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

    let bbox = null;
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

    let events;
    try {
      events = await getLatest({
        eventType: rawEventType !== undefined && rawEventType !== '' ? rawEventType : null,
        bbox,
        since: rawSince !== undefined && rawSince !== '' ? rawSince : null,
        limit,
      });
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

  void LAYER_ID;
}