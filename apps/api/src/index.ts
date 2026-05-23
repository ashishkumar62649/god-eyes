import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './lib/config.js';
import { healthRoutes } from './routes/health.js';
import { layerRoutes } from './routes/layers.js';
import { objectRoutes } from './routes/objects.js';
import { publicProfileRoutes } from './routes/public-profile/index.js';
import { airportIntelligenceRoutes } from './routes/airport-intelligence/index.js';
import { airportLayoutFeaturesRoutes } from './routes/airport-layout-features/index.js';

const fastify = Fastify({
  logger: config.nodeEnv !== 'test',
});

async function start() {
  try {
    // Register CORS - restricted to localhost for production safety
    // Frontend runs on localhost:5174 (Vite default)
    await fastify.register(cors, {
      origin: ['http://localhost:5173', 'http://localhost:5174'],
      credentials: true,
    });

    // Register routes
    await fastify.register(healthRoutes);
    await fastify.register(layerRoutes);
    await fastify.register(objectRoutes);
    await fastify.register(publicProfileRoutes);
    await fastify.register(airportIntelligenceRoutes);
    await fastify.register(airportLayoutFeaturesRoutes);

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
