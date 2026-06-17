import Fastify from 'fastify';
import cors from '@fastify/cors';
import { IncomingMessage } from 'node:http';
import { config } from './lib/config.js';
import { healthRoutes } from './routes/health.js';
import { layerRoutes } from './routes/layers.js';
import { objectRoutes } from './routes/objects.js';
import { publicProfileRoutes } from './routes/public-profile/index.js';
import { airportIntelligenceRoutes } from './routes/airport-intelligence/index.js';
import { airportLayoutFeaturesRoutes } from './routes/airport-layout-features/index.js';
import { earthEventsRoutes } from './routes/earth-events.js';
import { bordersBoundariesRoutes } from './routes/borders-boundaries.js';
import { aviationAircraftRoutes } from './routes/aviation-aircraft.js';
import { attachLiveAircraftWebSocket } from './routes/live-aircraft.js';
import { spaceSatellitesRoutes, attachSpaceSatellitesWebSocket } from './routes/space/satellites.js';
import { energyInfrastructureRoutes } from './routes/energy/infrastructure/index.js';
import { maritimeRoutes } from './routes/maritime/index.js';
import { weatherRoutes } from './routes/weather/index.js';
import { newsRoutes } from './routes/news/index.js';

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
    await fastify.register(earthEventsRoutes);
    await fastify.register(bordersBoundariesRoutes);
    await fastify.register(aviationAircraftRoutes);
    await fastify.register(spaceSatellitesRoutes);
    await fastify.register(energyInfrastructureRoutes);
    await fastify.register(maritimeRoutes);
    await fastify.register(weatherRoutes);
    await fastify.register(newsRoutes);

    // Health check at root
    fastify.get('/', async (_request, _reply) => {
      return { service: 'god-eyes-api', status: 'running' };
    });

    // Start server
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    fastify.log.info(`Server running on http://localhost:${config.port}`);

    // Attach WebSocket broadcasters (non-blocking, no DB required at startup)
    const { wss: aviationWss } = attachLiveAircraftWebSocket(fastify);
    const { wss: spaceWss } = attachSpaceSatellitesWebSocket(fastify);
    fastify.log.info('Live aircraft WebSocket broadcaster started on /ws/aviation/aircraft/live');
    fastify.log.info('Space satellites WebSocket broadcaster started on /ws/space/satellites/live');

    // Single combined upgrade handler for all known WS paths
    const server = fastify.server;
    if (server) {
      server.on('upgrade', (req: IncomingMessage, socket, head) => {
        if (req.url === '/ws/aviation/aircraft/live') {
          aviationWss.handleUpgrade(req, socket, head, (ws) => aviationWss.emit('connection', ws, req));
        } else if (req.url === '/ws/space/satellites/live') {
          spaceWss.handleUpgrade(req, socket, head, (ws) => spaceWss.emit('connection', ws, req));
        } else {
          socket.destroy();
        }
      });
    }
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
