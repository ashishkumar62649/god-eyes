import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './lib/config.js';
import { healthRoutes } from './routes/health.js';
import { layerRoutes } from './routes/layers.js';
import { objectRoutes } from './routes/objects.js';

const fastify = Fastify({
  logger: config.nodeEnv !== 'test',
});

async function start() {
  try {
    // Register CORS
    await fastify.register(cors, {
      origin: true,
    });

    // Register routes
    await fastify.register(healthRoutes);
    await fastify.register(layerRoutes);
    await fastify.register(objectRoutes);

    // Health check at root
    fastify.get('/', async (_request, _reply) => {
      return { service: 'god-eyes-api', status: 'running' };
    });

    // Start server
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`Server running on http://localhost:${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();