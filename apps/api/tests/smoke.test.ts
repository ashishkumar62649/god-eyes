import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { healthRoutes } from '../src/routes/health.js';
import { layerRoutes } from '../src/routes/layers.js';
import { objectRoutes } from '../src/routes/objects.js';

describe('API Smoke Tests', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(healthRoutes);
    await app.register(layerRoutes);
    await app.register(objectRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health should work even without database', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBeDefined();
    expect(body.service).toBe('god-eyes-api');
    expect(body.timestamp).toBeDefined();
    expect(body.database).toBeDefined();
  });

  it('GET /api/layers should return Layer 0 and Layer 1', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.layers).toBeDefined();
    expect(body.layers.length).toBeGreaterThanOrEqual(2);

    const layerIds = body.layers.map((l: { layerId: string }) => l.layerId);
    expect(layerIds).toContain('layer_00_globe_core');
    expect(layerIds).toContain('layer_01_aviation');
  });

  it('GET /api/layers/:layerId/status should work for known layers', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/status',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.layerId).toBe('layer_01_aviation');
    expect(body.status).toBeDefined();
    expect(body.objectCounts).toBeDefined();
  });

  it('GET /api/layers/:layerId/status should return 404 for unknown layer', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/unknown_layer/status',
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('INVALID_LAYER');
  });

  it('GET /api/layers/layer_01_aviation/objects with invalid objectType should return 400', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=unknown',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('API error response shape should be consistent', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/unknown_layer/status',
    });

    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBeDefined();
    expect(body.error.message).toBeDefined();
    expect(body.error.details).toBeDefined();
  });
});