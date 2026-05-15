export * from './constants.js';
export * from './validation.js';
export * from './errors.js';
export * from './metadata.js';
export * from './types.js';
export * from './mapper.js';
export * from './points.js';
export * from './clusters.js';

import { FastifyInstance, FastifyReply } from 'fastify';
import { checkDatabaseStatus, query } from '../../lib/db.js';
import {
  LayerObjectsListResponseSchema,
  LayerObjectDetailResponseSchema,
  ErrorCodes,
  NotImplementedResponseSchema,
} from '@god-eyes/contracts';
import {
  SUPPORTED_LAYER,
  SUPPORTED_OBJECT_TYPE,
} from './constants.js';
import {
  parseBBox,
  validateBBox,
  validateCategory,
  validateLimit,
  validateOffset,
  validateMode,
  validateZoom,
  getEffectiveMaxLimit,
  ParsedBBox,
  ValidationResult,
} from './validation.js';
import {
  invalidQueryError,
  invalidBBoxError,
  invalidCategoryError,
  invalidModeError,
  invalidLimitError,
  missingBBoxError,
  invalidLayerError,
  databaseOfflineError,
  tablesUnavailableError,
  objectNotFoundError,
  ErrorResponse,
} from './errors.js';
import { rowToAirportObject } from './mapper.js';
import { AirportRow } from './types.js';
import { handlePointsMode, PointsQueryParams } from './points.js';
import { handleClusterMode } from './clusters.js';

interface ObjectsQueryParams {
  objectType: string;
  limit?: string;
  offset?: string;
  bbox?: string;
  country?: string;
  category?: string;
  search?: string;
  mode?: string;
  zoom?: string;
}

interface ObjectsParams {
  layerId: string;
}

interface ObjectDetailParams {
  layerId: string;
  objectId: string;
}

// Helper to send error response with status code
function sendError(reply: FastifyReply, statusCode: number, error: ErrorResponse) {
  reply.code(statusCode);
  return error;
}

export async function objectRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Params: ObjectsParams;
    Querystring: ObjectsQueryParams;
  }>('/api/layers/:layerId/objects', async (request, reply) => {
    const { layerId } = request.params;
    const {
      objectType,
      limit: limitStr,
      offset: offsetStr,
      bbox: bboxStr,
      country,
      category,
      search,
      mode: modeStr,
      zoom: zoomStr,
    } = request.query;

    // ---- Basic validation ----

    // Validate required parameter (WO-012 production hardening)
    if (!objectType) {
      return sendError(reply, 400, invalidQueryError('objectType is required.', {}));
    }

    // Only layer_01_aviation is supported
    if (layerId !== SUPPORTED_LAYER) {
      return sendError(reply, 404, invalidLayerError(layerId));
    }

    // Only airport object type is implemented
    if (objectType !== SUPPORTED_OBJECT_TYPE) {
      reply.code(400);
      return NotImplementedResponseSchema.parse({
        error: {
          code: ErrorCodes.NOT_IMPLEMENTED,
          message: `Object type '${objectType}' is not implemented.`,
          supportedTypes: [SUPPORTED_OBJECT_TYPE],
        },
      });
    }

    // Validate bbox
    let parsedBBox: ParsedBBox | null = null;
    if (bboxStr !== undefined) {
      parsedBBox = parseBBox(bboxStr);
      if (parsedBBox === null) {
        return sendError(reply, 400, invalidBBoxError('bbox must be in format minLon,minLat,maxLon,maxLat', { received: bboxStr }));
      }
      const bboxError = validateBBox(parsedBBox);
      if (bboxError !== null) {
        return sendError(reply, 400, invalidBBoxError(bboxError, {
          minLon: parsedBBox.minLon,
          minLat: parsedBBox.minLat,
          maxLon: parsedBBox.maxLon,
          maxLat: parsedBBox.maxLat,
        }));
      }
    }

    // Validate category
    if (category !== undefined) {
      const catError = validateCategory(category);
      if (catError !== null) {
        return sendError(reply, 400, invalidCategoryError(catError, { received: category }));
      }
    }

    // Validate mode
    const modeValidation: ValidationResult<'points' | 'clusters'> = validateMode(modeStr);
    if (!modeValidation.valid) {
      return sendError(reply, 400, invalidModeError(modeValidation.error!, { received: modeStr }));
    }
    const mode = modeValidation.value;

    // Validate zoom (reserved for future cluster behavior)
    const zoomValidation: ValidationResult<number | null> = validateZoom(zoomStr);
    if (!zoomValidation.valid) {
      return sendError(reply, 400, invalidQueryError(zoomValidation.error!, { received: zoomStr }));
    }
    const zoom = zoomValidation.value;

    // Clusters require bbox
    if (mode === 'clusters' && parsedBBox === null) {
      return sendError(reply, 400, missingBBoxError({ hint: 'Use bbox=minLon,minLat,maxLon,maxLat' }));
    }

    // Validate limit/offset — viewport queries (bbox) allow up to 1000, general list max 500
    const effectiveMaxLimit = getEffectiveMaxLimit(parsedBBox !== null);
    const limitResult = validateLimit(limitStr, effectiveMaxLimit);
    if (!limitResult.valid) {
      return sendError(reply, 400, invalidLimitError(limitResult.error!, { received: limitStr }));
    }
    const limit = limitResult.value;

    const offsetResult = validateOffset(offsetStr);
    if (!offsetResult.valid) {
      return sendError(reply, 400, invalidLimitError(offsetResult.error!, { received: offsetStr }));
    }
    const offset = offsetResult.value;

    // ---- Database check ----
    const dbStatus = await checkDatabaseStatus();
    if (dbStatus.status === 'offline') {
      return sendError(reply, 503, databaseOfflineError());
    }

    // ---- Mode: clusters ----
    if (mode === 'clusters') {
      try {
        return await handleClusterMode(parsedBBox!, zoom, limit);
      } catch (error) {
        return sendError(reply, 503, tablesUnavailableError());
      }
    }

    // ---- Mode: points ----
    try {
      const params: PointsQueryParams = {
        bbox: parsedBBox,
        country,
        category,
        search,
        limit,
        offset,
      };
      return await handlePointsMode(params);
    } catch (error) {
      return sendError(reply, 503, tablesUnavailableError());
    }
  });

  // GET /api/layers/:layerId/objects/:objectId - Get detail for one object
  fastify.get<{
    Params: ObjectDetailParams;
  }>('/api/layers/:layerId/objects/:objectId', async (request, reply) => {
    const { layerId, objectId } = request.params;

    if (layerId !== SUPPORTED_LAYER) {
      return sendError(reply, 404, invalidLayerError(layerId));
    }

    const dbStatus = await checkDatabaseStatus();
    if (dbStatus.status === 'offline') {
      return sendError(reply, 503, databaseOfflineError());
    }

    try {
      const rows = await query<AirportRow>(
        'SELECT * FROM aviation_airports WHERE id = $1',
        [objectId]
      );

      if (rows.length === 0) {
        return sendError(reply, 404, objectNotFoundError(objectId));
      }

      return LayerObjectDetailResponseSchema.parse(rowToAirportObject(rows[0]));
    } catch (error) {
      return sendError(reply, 503, tablesUnavailableError());
    }
  });
}