import { FastifyInstance } from 'fastify';
import { checkDatabaseStatus } from '../lib/db.js';
import { HealthResponseSchema } from '@god-eyes/contracts';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/api/health', async (_request, _reply) => {
    const dbStatus = await checkDatabaseStatus();

    const response = {
      status: dbStatus.status === 'connected' ? 'ok' : 'degraded',
      service: 'god-eyes-api',
      timestamp: new Date().toISOString(),
      database: {
        status: dbStatus.status,
        latencyMs: dbStatus.latencyMs,
        message: dbStatus.message,
      },
    };

    return HealthResponseSchema.parse(response);
  });
}