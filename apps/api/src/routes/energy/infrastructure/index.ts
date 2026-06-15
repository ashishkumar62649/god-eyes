import { FastifyInstance } from 'fastify';
import {
  EnergyInfrastructureListResponseSchema, EnergyInfrastructureDetailResponseSchema,
  EnergyCategoriesResponseSchema, EnergySourcesResponseSchema, ErrorCodes,
} from '@god-eyes/contracts';
import { parseBbox, parseLimit, parseOffset, MAX_LIMIT } from './validation.js';
import { getInfrastructureList, getInfrastructureDetail, getCategories, getSourcesWithCounts, checkDatabaseStatus } from './service.js';
import type { EnergyInfrastructureQuerystring, FeatureIdParams } from './types.js';

const LAYER_ID = 'layer_10_energy_infrastructure';
const DB_OFFLINE = { code: ErrorCodes.DATABASE_OFFLINE, message: 'Database is not available.', details: {} };
const INTERNAL = { code: ErrorCodes.INTERNAL_ERROR, message: 'An internal error occurred.', details: {} };

export async function energyInfrastructureRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: EnergyInfrastructureQuerystring }>(
    '/api/energy/infrastructure',
    async (request, reply) => {
      const q = request.query;
      const parsedLimit = parseLimit(q.limit);
      if (parsedLimit.error) { reply.code(400); return { error: { code: parsedLimit.error.code, message: parsedLimit.error.message, details: { provided: q.limit } } }; }
      const parsedOffset = parseOffset(q.offset);
      if (parsedOffset.error) { reply.code(400); return { error: { code: parsedOffset.error.code, message: parsedOffset.error.message, details: { provided: q.offset } } }; }

      let bbox = null;
      if (q.bbox) {
        bbox = parseBbox(q.bbox);
        if (!bbox) { reply.code(400); return { error: { code: ErrorCodes.INVALID_BBOX, message: 'Invalid bbox format. Expected: west,south,east,north. Valid ranges: lon [-180,180], lat [-90,90].', details: { provided: q.bbox } } }; }
      }

      const dbStatus = await checkDatabaseStatus();
      if (dbStatus.status === 'offline') { reply.code(503); return { error: DB_OFFLINE }; }

      let result;
      try {
        result = await getInfrastructureList({
          filters: { country: q.country, sourceId: q.sourceId, featureType: q.featureType, category: q.category, status: q.status, fuelType: q.fuelType, minCapacityMw: q.minCapacityMw, maxCapacityMw: q.maxCapacityMw, minVoltageKv: q.minVoltageKv, maxVoltageKv: q.maxVoltageKv, pipelineProduct: q.pipelineProduct, terminalType: q.terminalType, bbox },
          limit: parsedLimit.value, offset: parsedOffset.value,
        });
      } catch { reply.code(500); return { error: INTERNAL }; }

      const activeFilters: Record<string, unknown> = {};
      const filterMap = { bbox: q.bbox, country: q.country, sourceId: q.sourceId, featureType: q.featureType, category: q.category, status: q.status, fuelType: q.fuelType, minCapacityMw: q.minCapacityMw, maxCapacityMw: q.maxCapacityMw, minVoltageKv: q.minVoltageKv, maxVoltageKv: q.maxVoltageKv, pipelineProduct: q.pipelineProduct, terminalType: q.terminalType };
      for (const [key, value] of Object.entries(filterMap)) { if (value !== undefined && value !== '') activeFilters[key] = value; }

      const requestedLimit = q.limit !== undefined ? Number(q.limit) : parsedLimit.value;

      // Non-critical source summary
      let sourceSummary: Record<string, { featureCount: number; lastUpdated: string | null }> | undefined;
      try {
        const sources = await getSourcesWithCounts();
        sourceSummary = {};
        for (const s of sources) sourceSummary[s.sourceId] = { featureCount: s.featureCount, lastUpdated: s.lastUpdated };
      } catch { /* non-critical */ }

      return EnergyInfrastructureListResponseSchema.parse({
        features: result.features,
        metadata: { layerId: LAYER_ID, count: result.totalCount, returnedCount: result.features.length, requestedLimit, appliedLimit: parsedLimit.value, maxLimit: MAX_LIMIT, activeFilters: Object.keys(activeFilters).length > 0 ? activeFilters : undefined, generatedAt: new Date().toISOString(), estimated: false, staticData: true, sourceSummary: sourceSummary && Object.keys(sourceSummary).length > 0 ? sourceSummary : undefined },
      });
    }
  );

  // /categories must be registered BEFORE /:featureId to avoid param capture
  fastify.get(
    '/api/energy/infrastructure/categories',
    async (_request, reply) => {
      const dbStatus = await checkDatabaseStatus();
      if (dbStatus.status === 'offline') { reply.code(503); return { error: DB_OFFLINE }; }
      let categories: Awaited<ReturnType<typeof getCategories>> = [];
      try { categories = await getCategories(); } catch { /* non-critical */ }
      return EnergyCategoriesResponseSchema.parse({ categories, metadata: { layerId: LAYER_ID, generatedAt: new Date().toISOString() } });
    }
  );

  fastify.get(
    '/api/energy/infrastructure/sources',
    async (_request, _reply) => {
      const dbStatus = await checkDatabaseStatus();
      let sources;
      if (dbStatus.status === 'connected') {
        sources = await getSourcesWithCounts();
      } else {
        const { CANONICAL_SOURCES } = await import('./service.js');
        sources = CANONICAL_SOURCES.map((s) => ({ sourceId: s.source_id, name: s.name, homepage: s.homepage, featureTypes: s.featureTypes, featureCount: 0, lastUpdated: null, license: s.license, attributionRequired: s.attributionRequired }));
      }
      return EnergySourcesResponseSchema.parse({ sources, metadata: { layerId: LAYER_ID, generatedAt: new Date().toISOString() } });
    }
  );

  fastify.get<{ Params: FeatureIdParams }>(
    '/api/energy/infrastructure/:featureId',
    async (request, reply) => {
      const { featureId } = request.params;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(featureId)) { reply.code(400); return { error: { code: ErrorCodes.INVALID_QUERY, message: 'featureId must be a valid UUID.', details: { provided: featureId } } }; }

      const dbStatus = await checkDatabaseStatus();
      if (dbStatus.status === 'offline') { reply.code(503); return { error: DB_OFFLINE }; }

      let feature;
      try { feature = await getInfrastructureDetail(featureId); }
      catch { reply.code(500); return { error: { ...INTERNAL, message: 'An internal error occurred while fetching the energy feature.' } }; }

      if (!feature) { reply.code(404); return { error: { code: ErrorCodes.OBJECT_NOT_FOUND, message: `Energy feature not found: ${featureId}`, details: { featureId } } }; }
      return EnergyInfrastructureDetailResponseSchema.parse({ feature });
    }
  );
}
