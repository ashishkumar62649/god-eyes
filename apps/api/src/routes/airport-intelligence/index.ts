import { FastifyInstance } from 'fastify';
import { getAirportIntelligence } from './service.js';

interface AirportIntelligenceParams {
  airportId: string;
}

export async function airportIntelligenceRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Params: AirportIntelligenceParams;
  }>('/api/airports/:airportId/intelligence', async (request, reply) => {
    const { airportId } = request.params;

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
      const result = await getAirportIntelligence(airportId);

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
