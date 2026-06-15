import { FastifyInstance } from 'fastify';
import {
  SpaceSatellitesListResponseSchema, SpaceSatelliteDetailResponseSchema,
  SpaceCategoriesResponseSchema, ErrorCodes,
} from '@god-eyes/contracts';
import { parseLimit, parseBoolean, parseNumeric, parseCommaList, MAX_LIMIT } from './validation.js';
import { getSatelliteList, getSatelliteDetail, getSatelliteCategories, checkDatabaseStatus } from './service.js';
import type { SpaceListQuerystring, SatelliteParams } from './types.js';

const DB_OFFLINE = { code: ErrorCodes.DATABASE_OFFLINE, message: 'Database is not available.', details: {} };
const INTERNAL = { code: ErrorCodes.INTERNAL_ERROR, message: 'An internal error occurred.', details: {} };

export async function spaceSatellitesRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: SpaceListQuerystring }>(
    '/api/space/satellites',
    async (request, reply) => {
      const { limit: rawLimit, category: rawCategory, objectType: rawObjectType, orbitClass: rawOrbitClass, sourceId: rawSourceId, importantOnly: rawImportantOnly, minAltitude: rawMinAltitude, maxAltitude: rawMaxAltitude } = request.query;

      const parsedLimit = parseLimit(rawLimit);
      if (parsedLimit.error) { reply.code(400); return { error: parsedLimit.error }; }

      const importantOnly = parseBoolean(rawImportantOnly);
      const minAltitude = parseNumeric(rawMinAltitude);
      const maxAltitude = parseNumeric(rawMaxAltitude);

      if (minAltitude !== undefined && (isNaN(minAltitude) || minAltitude < 0)) { reply.code(400); return { error: { code: ErrorCodes.INVALID_QUERY, message: 'minAltitude must be a non-negative number.', details: { provided: rawMinAltitude } } }; }
      if (maxAltitude !== undefined && (isNaN(maxAltitude) || maxAltitude < 0)) { reply.code(400); return { error: { code: ErrorCodes.INVALID_QUERY, message: 'maxAltitude must be a non-negative number.', details: { provided: rawMaxAltitude } } }; }

      const dbStatus = await checkDatabaseStatus();
      if (dbStatus.status === 'offline') { reply.code(503); return { error: DB_OFFLINE }; }

      let satellites;
      try {
        satellites = await getSatelliteList({ category: parseCommaList(rawCategory), objectType: parseCommaList(rawObjectType), orbitClass: parseCommaList(rawOrbitClass), sourceId: parseCommaList(rawSourceId), importantOnly, minAltitude, maxAltitude, limit: parsedLimit.value });
      } catch { reply.code(500); return { error: { ...INTERNAL, message: 'An internal error occurred while fetching satellite data.' } }; }

      const activeFilters: Record<string, unknown> = {};
      const category = parseCommaList(rawCategory); if (category) activeFilters.category = category;
      const objectType = parseCommaList(rawObjectType); if (objectType) activeFilters.objectType = objectType;
      const orbitClass = parseCommaList(rawOrbitClass); if (orbitClass) activeFilters.orbitClass = orbitClass;
      const sourceId = parseCommaList(rawSourceId); if (sourceId) activeFilters.sourceId = sourceId;
      if (importantOnly !== undefined) activeFilters.importantOnly = importantOnly;
      if (minAltitude !== undefined) activeFilters.minAltitude = minAltitude;
      if (maxAltitude !== undefined) activeFilters.maxAltitude = maxAltitude;

      const requestedLimit = rawLimit !== undefined && rawLimit !== '' ? parseInt(rawLimit, 10) : undefined;

      return SpaceSatellitesListResponseSchema.parse({
        satellites,
        metadata: { count: satellites.length, requestedLimit: requestedLimit !== undefined && !isNaN(requestedLimit) ? requestedLimit : undefined, appliedLimit: parsedLimit.value, maxLimit: MAX_LIMIT, activeFilters: Object.keys(activeFilters).length > 0 ? activeFilters : undefined, generatedAt: new Date().toISOString(), estimated: true, layerId: 'layer_05_space_satellites' },
      });
    },
  );

  // /categories BEFORE /:satelliteId
  fastify.get(
    '/api/space/satellites/categories',
    async (request, reply) => {
      const dbStatus = await checkDatabaseStatus();
      if (dbStatus.status === 'offline') { reply.code(503); return { error: DB_OFFLINE }; }
      try {
        const data = await getSatelliteCategories();
        return SpaceCategoriesResponseSchema.parse({ ...data, metadata: { generatedAt: new Date().toISOString(), layerId: 'layer_05_space_satellites', estimated: true } });
      } catch { reply.code(500); return { error: { ...INTERNAL, message: 'An internal error occurred while fetching satellite categories.' } }; }
    },
  );

  fastify.get<{ Params: SatelliteParams }>(
    '/api/space/satellites/:satelliteId',
    async (request, reply) => {
      const { satelliteId } = request.params;
      const dbStatus = await checkDatabaseStatus();
      if (dbStatus.status === 'offline') { reply.code(503); return { error: DB_OFFLINE }; }
      let satellite;
      try { satellite = await getSatelliteDetail(satelliteId); }
      catch { reply.code(500); return { error: { ...INTERNAL, message: 'An internal error occurred while fetching satellite detail.' } }; }
      if (!satellite) { reply.code(404); return { error: { code: ErrorCodes.OBJECT_NOT_FOUND, message: `Satellite with ID '${satelliteId}' was not found.`, details: { satelliteId } } }; }
      return SpaceSatelliteDetailResponseSchema.parse({ satellite });
    },
  );
}
