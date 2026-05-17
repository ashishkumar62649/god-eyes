import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { healthRoutes } from '../src/routes/health.js';
import { layerRoutes } from '../src/routes/layers.js';
import { objectRoutes } from '../src/routes/objects.js';

describe('Aviation Preload Mode (WO-030A) — Resident Cache API', () => {
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

  const VALID_CATEGORIES = [
    'international_or_major_airport',
    'regional_or_domestic_airport',
    'small_airfield',
    'heliport',
    'water_landing_site',
    'balloonport',
    'closed_or_abandoned',
    'unknown',
  ];

  // ---- Category fetch tests ----

  it('preload mode: each valid category can be fetched without 400', async () => {
    for (const cat of VALID_CATEGORIES) {
      const response = await app.inject({
        method: 'GET',
        url: `/api/layers/layer_01_aviation/objects?objectType=airport&mode=preload&category=${cat}`,
      });
      // Should not 400 for valid categories
      expect(response.statusCode).not.toBe(400);
      expect([200, 503]).toContain(response.statusCode);
    }
  });

  it('preload mode: invalid category is rejected with 400', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=preload&category=not_real_category',
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_CATEGORY');
  });

  it('preload mode: missing category returns 400', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=preload',
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_QUERY');
    expect(body.error.message).toContain('category is required');
  });

  // ---- High-limit preload tests ----

  it('preload mode: high limit (100000) is accepted without 400', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=preload&category=small_airfield&limit=100000',
    });
    // Should not 400 — limit should be accepted or clamped
    expect(response.statusCode).not.toBe(400);
    expect([200, 503]).toContain(response.statusCode);
  });

  it('preload mode: limit above MAX_PRELOAD_LIMIT is clamped', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=preload&category=heliport&limit=999999',
    });
    expect(response.statusCode).not.toBe(400);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      expect(body.metadata.returnedCount).toBeLessThanOrEqual(100000);
    }
  });

  it('preload mode: default limit is MAX_PRELOAD_LIMIT when not specified', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=preload&category=international_or_major_airport',
    });
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      // Should return all international airports (expected ~1182)
      expect(body.metadata.totalCount).toBeGreaterThan(0);
      expect(body.metadata.returnedCount).toBeGreaterThan(0);
    }
  });

  // ---- Response shape tests ----

  it('preload mode: response has items array and metadata object', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=preload&category=heliport&limit=5',
    });
    if (response.statusCode !== 200) return;

    const body = JSON.parse(response.body);
    expect(body.items).toBeDefined();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.metadata).toBeDefined();
  });

  it('preload mode: metadata has required fields', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=preload&category=small_airfield&limit=5',
    });
    if (response.statusCode !== 200) return;

    const body = JSON.parse(response.body);
    const meta = body.metadata;
    expect(meta.mode).toBe('preload');
    expect(meta.category).toBe('small_airfield');
    expect(meta.returnedCount).toBeDefined();
    expect(meta.totalCount).toBeDefined();
    expect(meta.generatedAt).toBeDefined();
    expect(meta.summary).toBeDefined();
    expect(Array.isArray(meta.summary)).toBe(true);
  });

  it('preload mode: summary includes all categories with counts', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=preload&category=heliport&limit=1',
    });
    if (response.statusCode !== 200) return;

    const body = JSON.parse(response.body);
    const summary = body.metadata.summary;
    expect(summary.length).toBeGreaterThanOrEqual(7);

    // Each summary entry should have category and count
    for (const entry of summary) {
      expect(entry.category).toBeDefined();
      expect(typeof entry.count).toBe('number');
      expect(entry.count).toBeGreaterThanOrEqual(0);
    }
  });

  it('preload mode: each item has required lightweight fields', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=preload&category=international_or_major_airport&limit=3',
    });
    if (response.statusCode !== 200) return;

    const body = JSON.parse(response.body);
    if (body.items.length === 0) return;

    for (const item of body.items) {
      // Required fields
      expect(item.id).toBeDefined();
      expect(item.ident).toBeDefined();
      expect(item.name).toBeDefined();
      expect(item.category).toBeDefined();
      expect(item.latitude).toBeDefined();
      expect(item.longitude).toBeDefined();
      expect(item.country).toBeDefined();
      expect(item).toHaveProperty('region');
      expect(item).toHaveProperty('municipality');
      expect(item).toHaveProperty('iataCode');
      expect(item).toHaveProperty('gpsCode');
      expect(item).toHaveProperty('elevationFt');
      expect(item).toHaveProperty('status');

      // Should NOT have heavy fields
      expect(item.sourceId).toBeUndefined();
      expect(item.sourceObjectId).toBeUndefined();
      expect(item.typeSource).toBeUndefined();
      expect(item.layerId).toBeUndefined();
      expect(item.objectType).toBeUndefined();
      expect(item.createdAt).toBeUndefined();
      expect(item.updatedAt).toBeUndefined();
    }
  });

  it('preload mode: category in items matches requested category', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=preload&category=balloonport&limit=10',
    });
    if (response.statusCode !== 200) return;

    const body = JSON.parse(response.body);
    for (const item of body.items) {
      expect(item.category).toBe('balloonport');
    }
  });

  it('preload mode: totalCount matches returnedCount when limit is high enough', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=preload&category=water_landing_site&limit=100000',
    });
    if (response.statusCode !== 200) return;

    const body = JSON.parse(response.body);
    // With a high limit, returnedCount should equal totalCount
    expect(body.metadata.returnedCount).toBe(body.metadata.totalCount);
  });

  // ---- Invalid input tests ----

  it('preload mode: invalid limit returns 400', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=preload&category=heliport&limit=-1',
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_LIMIT');
  });

  it('preload mode: non-numeric limit returns 400', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=preload&category=heliport&limit=abc',
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_LIMIT');
  });

  // ---- Backward compatibility tests ----

  it('preload mode: existing points mode still works', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=points&limit=5',
    });
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      expect(body.mode).toBe('points');
      expect(body.items).toBeDefined();
      expect(body.pagination).toBeDefined();
    }
  });

  it('preload mode: existing clusters mode still works', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=clusters&bbox=-125,25,-65,50&limit=10',
    });
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      expect(body.mode).toBe('clusters');
    }
  });

  it('preload mode: existing density mode still works', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=density&bbox=-125,25,-65,50&limit=10',
    });
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      expect(body.mode).toBe('density');
    }
  });

  it('preload mode: existing detail endpoint still works', async () => {
    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&limit=1',
    });
    if (listResponse.statusCode !== 200) return;
    const listBody = JSON.parse(listResponse.body);
    if (listBody.items.length === 0) return;

    const airportId = listBody.items[0].id;
    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/layer_01_aviation/objects/${airportId}/detail`,
    });
    expect([200, 503, 404]).toContain(response.statusCode);
  });

  it('preload mode: existing bbox/tile endpoint still works', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&bbox=-125,25,-65,50&limit=100',
    });
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      expect(body.mode).toBe('points');
      expect(body.pagination.limit).toBeLessThanOrEqual(1000);
    }
  });

  it('preload mode: invalid mode still returns 400', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=invalid_mode',
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_MODE');
    expect(body.error.message).toContain('preload');
  });
});
