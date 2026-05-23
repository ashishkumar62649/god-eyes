import { FastifyInstance } from 'fastify';
import { getAirportLayoutFeatures } from './service.js';

interface LayoutFeatureParams {
  airportId: string;
}

interface LayoutFeatureQuery {
  includeInactive?: string;
  featureType?: string;
}

export async function airportLayoutFeaturesRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Params: LayoutFeatureParams;
    Querystring: LayoutFeatureQuery;
  }>('/api/airports/:airportId/layout-features', async (request, reply) => {
    const { airportId } = request.params;
    const includeInactive = request.query.includeInactive === 'true';
    const featureType = request.query.featureType || null;

    if (!airportId || airportId.trim() === '') {
      reply.code(400);
      return {
        status: 'error' as const,
        airportId: null,
        generatedAt: new Date().toISOString(),
        error: 'airportId is required',
      };
    }

    try {
      const result = await getAirportLayoutFeatures(airportId, includeInactive, featureType);

      if (result.status === 'not_found') {
        reply.code(404);
      }

      return result;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return {
        status: 'error' as const,
        airportId,
        generatedAt: new Date().toISOString(),
        error: 'Internal server error',
      };
    }
  });
}
