// HTTP route handlers for Layer 01 — Aviation Aircraft. No SQL, no business logic here.
//
// Clean public slug aliases added per API-POLICY-001:
//   /api/layers/aviation/aircraft/latest        (alias for /api/aviation/aircraft/latest)
//   /api/layers/aviation/aircraft/:sourceObjectId (alias for /api/aviation/aircraft/:sourceObjectId)
//
// Old paths remain registered for compatibility and are not removed in this work order.
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  AircraftLatestListResponseSchema,
  AircraftDetailResponseSchema,
  ErrorCodes,
} from '@god-eyes/contracts';
import { parseBbox, parseLimit, parseIncludeStale, type BBox } from './validation.js';
import { getLatestAircraft, getAircraftDetail, checkDatabaseStatus } from './service.js';
import type { LatestAircraftQuerystring, AircraftParams } from './types.js';

const LAYER_ID = 'layer_01_aviation';
const PUBLIC_SLUG = 'aviation';

const DB_OFFLINE_ERROR = {
  code: ErrorCodes.DATABASE_OFFLINE,
  message: 'Database is not available.',
  details: {},
};

const INTERNAL_LIST_ERROR = {
  code: ErrorCodes.INTERNAL_ERROR,
  message: 'An internal error occurred while fetching live aircraft data.',
  details: {},
};

const INTERNAL_DETAIL_ERROR = {
  code: ErrorCodes.INTERNAL_ERROR,
  message: 'An internal error occurred while fetching aircraft detail.',
  details: {},
};

export async function aviationAircraftRoutes(fastify: FastifyInstance) {
  // Each handler is defined once and registered under both the legacy
  // domain path and the new clean public slug path.

  // Latest aircraft
  const latestHandler = async (request: FastifyRequest<{ Querystring: LatestAircraftQuerystring }>, reply: FastifyReply) => {
    const { limit: rawLimit, bbox: rawBbox, includeStale: rawIncludeStale } = request.query;

    const parsedLimit = parseLimit(rawLimit);
    if (parsedLimit.error) {
      reply.code(400);
      return { error: parsedLimit.error };
    }

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

    const includeStale = parseIncludeStale(rawIncludeStale);

    const dbStatus = await checkDatabaseStatus();
    if (dbStatus.status === 'offline') {
      reply.code(503);
      return { error: DB_OFFLINE_ERROR };
    }

    let aircraft;
    try {
      aircraft = await getLatestAircraft({ bbox, limit: parsedLimit.value, includeStale });
    } catch {
      reply.code(500);
      return { error: INTERNAL_LIST_ERROR };
    }

    return AircraftLatestListResponseSchema.parse({
      aircraft,
      metadata: {
        count: aircraft.length,
        generatedAt: new Date().toISOString(),
      },
    });
  };

  fastify.get<{ Querystring: LatestAircraftQuerystring }>('/api/aviation/aircraft/latest', latestHandler);
  fastify.get<{ Querystring: LatestAircraftQuerystring }>(`/api/layers/${PUBLIC_SLUG}/aircraft/latest`, latestHandler);

  // Aircraft detail
  const detailHandler = async (request: FastifyRequest<{ Params: AircraftParams }>, reply: FastifyReply) => {
    const { sourceObjectId } = request.params;

    const dbStatus = await checkDatabaseStatus();
    if (dbStatus.status === 'offline') {
      reply.code(503);
      return { error: DB_OFFLINE_ERROR };
    }

    let aircraft;
    try {
      aircraft = await getAircraftDetail(sourceObjectId);
    } catch {
      reply.code(500);
      return { error: INTERNAL_DETAIL_ERROR };
    }

    if (!aircraft) {
      reply.code(404);
      return {
        error: {
          code: ErrorCodes.OBJECT_NOT_FOUND,
          message: `Aircraft with source object ID '${sourceObjectId}' was not found.`,
          details: { sourceObjectId },
        },
      };
    }

    return AircraftDetailResponseSchema.parse({
      aircraft,
    });
  };

  fastify.get<{ Params: AircraftParams }>('/api/aviation/aircraft/:sourceObjectId', detailHandler);
  fastify.get<{ Params: AircraftParams }>(`/api/layers/${PUBLIC_SLUG}/aircraft/:sourceObjectId`, detailHandler);

  // Suppress LAYER_ID unused warning: kept intentionally for future metadata symmetry with other layer routes.
  void LAYER_ID;
}