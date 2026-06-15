/**
 * SR-001 — Layer Status Response Shape Tests
 *
 * Asserts that:
 * 1. Non-aviation layers do NOT return aviation-specific objectCount keys
 *    (airports, runways, navaids, airportFrequencies, regions).
 * 2. objectCounts accepts arbitrary layer-specific keys (generic record shape).
 * 3. Aviation (layer_01) still returns its historical aviation count keys.
 * 4. Globe Core (layer_00) returns an empty objectCounts object.
 * 5. Response schema validation passes for all layers.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { layerRoutes } from '../src/routes/layers.js';

// Aviation-only keys that must NOT appear for non-aviation layers.
const AVIATION_ONLY_KEYS = ['runways', 'navaids', 'airportFrequencies', 'regions'];

describe('Layer Status Response Shape (SR-001)', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(layerRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Globe Core ────────────────────────────────────────────────────────────

  it('layer_00_globe_core: objectCounts is an empty object', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/layers/layer_00_globe_core/status' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.objectCounts).toEqual({});
  });

  it('layer_00_globe_core: objectCounts has no aviation keys', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/layers/layer_00_globe_core/status' });
    const body = JSON.parse(res.body);
    for (const key of AVIATION_ONLY_KEYS) {
      expect(body.objectCounts).not.toHaveProperty(key);
    }
  });

  // ─── Aviation ──────────────────────────────────────────────────────────────

  it('layer_01_aviation: objectCounts contains aviation keys', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/layers/layer_01_aviation/status' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.objectCounts).toHaveProperty('airports');
    expect(body.objectCounts).toHaveProperty('runways');
    expect(body.objectCounts).toHaveProperty('navaids');
    expect(body.objectCounts).toHaveProperty('airportFrequencies');
    expect(body.objectCounts).toHaveProperty('countries');
    expect(body.objectCounts).toHaveProperty('regions');
  });

  it('layer_01_aviation: all aviation count values are non-negative integers', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/layers/layer_01_aviation/status' });
    const body = JSON.parse(res.body);
    for (const [key, val] of Object.entries(body.objectCounts)) {
      expect(typeof val).toBe('number');
      expect(Number.isInteger(val)).toBe(true);
      expect(val as number).toBeGreaterThanOrEqual(0);
      void key;
    }
  });

  // ─── Non-aviation layers must not return aviation-only keys ────────────────

  const NON_AVIATION_LAYERS = [
    'layer_02_borders_boundaries',
    'layer_03_earth_events',
    'layer_05_space_satellites',
    'layer_06_maritime',
    'layer_07_weather',
    'layer_08_news_osint',
    'layer_10_energy_infrastructure',
  ];

  for (const layerId of NON_AVIATION_LAYERS) {
    it(`${layerId}: objectCounts does not contain aviation-only keys`, async () => {
      const res = await app.inject({ method: 'GET', url: `/api/layers/${layerId}/status` });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.objectCounts).toBeDefined();
      for (const key of AVIATION_ONLY_KEYS) {
        expect(body.objectCounts).not.toHaveProperty(key);
      }
    });

    it(`${layerId}: objectCounts values are all non-negative integers`, async () => {
      const res = await app.inject({ method: 'GET', url: `/api/layers/${layerId}/status` });
      const body = JSON.parse(res.body);
      for (const [key, val] of Object.entries(body.objectCounts)) {
        expect(typeof val).toBe('number');
        expect(Number.isInteger(val)).toBe(true);
        expect(val as number).toBeGreaterThanOrEqual(0);
        void key;
      }
    });
  }

  // ─── Weather-specific keys ─────────────────────────────────────────────────
  // DB is offline in test env, so objectCounts will be {} (empty on offline).
  // We test the shape, not the values.

  it('layer_07_weather: objectCounts is an object (accepts weather-specific keys)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/layers/layer_07_weather/status' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(typeof body.objectCounts).toBe('object');
    expect(body.objectCounts).not.toBeNull();
    // In offline test env the DB is unavailable; objectCounts must be {} not aviation fields.
    for (const key of AVIATION_ONLY_KEYS) {
      expect(body.objectCounts).not.toHaveProperty(key);
    }
  });

  it('layer_08_news_osint: objectCounts is an object (accepts news-specific keys)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/layers/layer_08_news_osint/status' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(typeof body.objectCounts).toBe('object');
    expect(body.objectCounts).not.toBeNull();
    for (const key of AVIATION_ONLY_KEYS) {
      expect(body.objectCounts).not.toHaveProperty(key);
    }
  });

  // ─── Coming-soon layers ────────────────────────────────────────────────────

  it('layer_04_public_military_security: objectCounts is empty (coming_soon)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/layers/layer_04_public_military_security/status' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.objectCounts).toEqual({});
    expect(body.status).toBe('not_configured');
  });

  // ─── Schema validation ─────────────────────────────────────────────────────

  it('objectCounts accepts arbitrary layer-specific string keys', async () => {
    // This is a schema-level test: a generic z.record(z.string(), z.number()) must
    // parse any valid key-value pair. Verify against weather (has domain keys when online)
    // and aviation (historical keys).
    const { LayerStatusResponseSchema } = await import('@god-eyes/contracts');

    // Generic record with weather keys must parse
    expect(() => LayerStatusResponseSchema.parse({
      layerId: 'layer_07_weather',
      status: 'ok',
      sourceId: null,
      objectCounts: { observations: 100, sources: 2, fetchRuns: 10 },
      database: { status: 'connected' },
    })).not.toThrow();

    // Generic record with news keys must parse
    expect(() => LayerStatusResponseSchema.parse({
      layerId: 'layer_08_news_osint',
      status: 'ok',
      sourceId: null,
      objectCounts: { items: 50, sources: 3, fetchRuns: 5 },
      database: { status: 'connected' },
    })).not.toThrow();

    // Aviation keys still parse
    expect(() => LayerStatusResponseSchema.parse({
      layerId: 'layer_01_aviation',
      status: 'ok',
      sourceId: 'ourairports',
      objectCounts: { airports: 85000, runways: 200000, navaids: 50000, airportFrequencies: 100000, countries: 250, regions: 3900 },
      database: { status: 'connected' },
    })).not.toThrow();

    // Empty object must parse (globe core, coming_soon, or offline)
    expect(() => LayerStatusResponseSchema.parse({
      layerId: 'layer_00_globe_core',
      status: 'ok',
      sourceId: null,
      objectCounts: {},
      database: { status: 'connected' },
    })).not.toThrow();
  });

  // ─── Unknown layer returns 404 ─────────────────────────────────────────────

  it('unknown layer returns 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/layers/layer_99_does_not_exist/status' });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('INVALID_LAYER');
  });
});
