import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  BordersBoundariesFeatureCollectionSchema,
  ErrorCodes,
} from '@god-eyes/contracts';
import { parseBbox, parseLimit, parseSimplify } from './validation.js';
import { getCountries, checkDatabaseStatus } from './service.js';
import type { BordersBoundariesQuerystring, BBox } from './types.js';

const LAYER_ID = 'layer_02_borders_boundaries';
const PUBLIC_SLUG = 'borders-boundaries';
const DEFAULT_SOURCE_ID = 'natural_earth_admin0_50m';

const DB_OFFLINE = {
  code: ErrorCodes.DATABASE_OFFLINE,
  message: 'Database is not available.',
  details: {},
};

const INTERNAL_ERROR = {
  code: ErrorCodes.INTERNAL_ERROR,
  message: 'An internal error occurred while fetching border boundaries.',
  details: {},
};

// HTTP route handlers for Layer 02 — Borders & Boundaries. No SQL, no business logic here.
//
// Clean public slug aliases added per API-POLICY-001:
//   /api/layers/borders-boundaries/countries  (alias for /api/borders-boundaries/countries)
//
// Old paths remain registered for compatibility and are not removed in this work order.

export async function bordersBoundariesRoutes(fastify: FastifyInstance) {
  // The handler is defined once and registered under both the legacy domain
  // path and the new clean public slug path. meta.layerId continues to use
  // the internal layer ID per API-POLICY-001.

  const countriesHandler = async (request: FastifyRequest<{ Querystring: BordersBoundariesQuerystring }>, reply: FastifyReply) => {
    const { limit: rawLimit, bbox: rawBbox, source_id: rawSourceId, simplify: rawSimplify } = request.query;

    // Validate limit
    const parsedLimit = parseLimit(rawLimit);
    if (parsedLimit.error) {
      reply.code(400);
      return {
        error: {
          code: parsedLimit.error.code,
          message: parsedLimit.error.message,
          details: { provided: rawLimit },
        },
      };
    }
    const limit = parsedLimit.value;

    // Validate simplify
    const parsedSimplify = parseSimplify(rawSimplify);
    if (parsedSimplify.error) {
      reply.code(400);
      return {
        error: {
          code: parsedSimplify.error.code,
          message: parsedSimplify.error.message,
          details: { provided: rawSimplify },
        },
      };
    }
    const simplify = parsedSimplify.value;

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

    // Validate source_id
    const sourceId = (rawSourceId !== undefined && rawSourceId !== '') ? rawSourceId : DEFAULT_SOURCE_ID;
    if (!/^[a-zA-Z0-9_-]+$/.test(sourceId)) {
      reply.code(400);
      return {
        error: {
          code: ErrorCodes.INVALID_QUERY,
          message: 'Invalid source_id. Must contain only alphanumeric characters, hyphens, and underscores.',
          details: { provided: rawSourceId },
        },
      };
    }

    // Check database
    const dbStatus = await checkDatabaseStatus();
    if (dbStatus.status === 'offline') {
      reply.code(503);
      return { error: DB_OFFLINE };
    }

    // Execute
    let result;
    try {
      result = await getCountries({ sourceId, bbox, simplify, limit });
    } catch {
      reply.code(500);
      return { error: INTERNAL_ERROR };
    }

    return BordersBoundariesFeatureCollectionSchema.parse(result);
  };

  fastify.get<{ Querystring: BordersBoundariesQuerystring }>('/api/borders-boundaries/countries', countriesHandler);
  fastify.get<{ Querystring: BordersBoundariesQuerystring }>(`/api/layers/${PUBLIC_SLUG}/countries`, countriesHandler);

  // Suppress LAYER_ID unused warning: kept intentionally for future metadata symmetry with other layer routes.
  void LAYER_ID;
}
