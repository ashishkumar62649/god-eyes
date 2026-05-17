import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { healthRoutes } from '../src/routes/health.js';
import { layerRoutes } from '../src/routes/layers.js';
import { objectRoutes } from '../src/routes/objects.js';

describe('API Production Hardening Tests', () => {
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

  // Response metadata tests
  describe('Response Metadata', () => {
    it('GET /api/layers should include metadata', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/layers',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.metadata).toBeDefined();
      expect(body.metadata.mode).toBe('standard');
      expect(body.metadata.returnedCount).toBeDefined();
      expect(body.metadata.generatedAt).toBeDefined();
    });

    it('GET /api/layers/:layerId/objects should include metadata', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/layers/layer_01_aviation/objects?objectType=airport',
      });

      // Database may be offline in test environment — 503 is valid
      if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        expect(body.metadata).toBeDefined();
        expect(body.metadata.mode).toBeDefined();
        expect(body.metadata.generatedAt).toBeDefined();
      } else {
        expect(response.statusCode).toBe(503);
      }
    });

    it('GET /api/layers/:layerId/objects should include filtersApplied in metadata', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/layers/layer_01_aviation/objects?objectType=airport&country=US',
      });

      // Database may be offline in test environment — 503 is valid
      if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        expect(body.metadata).toBeDefined();
        expect(body.metadata.filtersApplied).toBeDefined();
        expect(body.metadata.filtersApplied?.country).toBe('US');
      } else {
        expect(response.statusCode).toBe(503);
      }
    });
  });

  // Invalid query parameter tests
  describe('Invalid Query Parameters', () => {
    it('GET /api/layers/:layerId/objects without objectType should return 400', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/layers/layer_01_aviation/objects',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('INVALID_QUERY');
      expect(body.error.message).toContain('objectType');
    });

    it('GET /api/layers/:layerId/objects with invalid limit should be capped at max', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/layers/layer_01_aviation/objects?objectType=airport&limit=9999',
      });

      // Database may be offline in test environment — 503 is valid
      if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        expect(body.pagination.limit).toBe(500); // Max list limit
      } else {
        expect(response.statusCode).toBe(503);
      }
    });

    it('GET /api/layers/:layerId/objects with negative offset should return 400', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/layers/layer_01_aviation/objects?objectType=airport&offset=-10',
      });

      // WO-008 strict validation: negative offset is an error
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('INVALID_LIMIT');
    });
  });

  // Error response consistency tests
  describe('Error Response Consistency', () => {
    it('Error responses should have code and message', async () => {
      const testCases = [
        { url: '/api/layers/unknown_layer/status', expectedStatus: 404 },
        { url: '/api/layers/layer_01_aviation/objects?objectType=unknown', expectedStatus: 400 },
      ];

      for (const testCase of testCases) {
        const response = await app.inject({
          method: 'GET',
          url: testCase.url,
        });

        expect(response.statusCode).toBe(testCase.expectedStatus);
        const body = JSON.parse(response.body);
        expect(body.error).toBeDefined();
        expect(body.error.code).toBeDefined();
        expect(body.error.message).toBeDefined();
      }
    });

    it('INVALID_LAYER error should include details', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/layers/unknown_layer/status',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.details).toBeDefined();
    });
  });
});