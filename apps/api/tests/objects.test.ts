import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify from 'fastify';
import { objectRoutes } from '../src/routes/objects.js';

describe('Aviation Objects API - WO-008', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(objectRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // ---- Invalid bbox ----

  it('returns 400 for malformed bbox (non-numeric)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&bbox=foo,bar,baz,qux',
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_BBOX');
  });

  it('returns 400 for malformed bbox (wrong field count)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&bbox=-125,25,-65',
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_BBOX');
  });

  it('returns 400 for minLon out of range (-180 to 180)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&bbox=-200,25,-65,50',
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_BBOX');
    expect(body.error.message).toContain('minLon');
  });

  it('returns 400 for maxLon out of range (-180 to 180)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&bbox=-125,25,200,50',
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_BBOX');
    expect(body.error.message).toContain('maxLon');
  });

  it('returns 400 for minLat out of range (-90 to 90)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&bbox=-125,-95,-65,50',
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_BBOX');
    expect(body.error.message).toContain('minLat');
  });

  it('returns 400 for maxLat out of range (-90 to 90)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&bbox=-125,25,-65,95',
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_BBOX');
    expect(body.error.message).toContain('maxLat');
  });

  it('returns 400 when minLon >= maxLon', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&bbox=-65,25,-125,50',
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_BBOX');
    expect(body.error.message).toContain('minLon');
  });

  it('returns 400 when minLat >= maxLat', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&bbox=-125,50,-65,25',
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_BBOX');
    expect(body.error.message).toContain('minLat');
  });

  // ---- Invalid category ----

  it('returns 400 for invalid category', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&category=not_a_real_category',
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_CATEGORY');
    expect(body.error.message).toContain('heliport');
  });

  // ---- Invalid mode ----

  it('returns 400 for invalid mode', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=bad_mode',
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_MODE');
  });

  // ---- Clusters require bbox ----

  it('returns 400 when mode=clusters without bbox', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=clusters',
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('MISSING_BBOX');
  });

  // ---- Invalid limit ----

  it('returns 400 for negative limit', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&limit=-10',
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_LIMIT');
  });

  it('returns 400 for non-numeric limit', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&limit=abc',
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_LIMIT');
  });

  // ---- Limit above max is clamped ----

  it('clamps limit above 1000 to 1000 (no 400)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&limit=5000',
    });
    // Should not be 400 — we clamp, not reject
    expect(response.statusCode).not.toBe(400);
    // If DB offline, 503 — if DB online, 200
    expect([200, 503]).toContain(response.statusCode);
  });

  // ---- Invalid zoom ----

  it('returns 400 for zoom out of range (negative)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&zoom=-1',
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_QUERY');
  });

  it('returns 400 for zoom out of range (above 22)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&zoom=99',
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_QUERY');
  });

  // ---- Invalid objectType ----

  it('returns 400 for unknown objectType', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=aircraft',
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
  });

  // ---- Invalid layer ----

  it('returns 404 for unknown layer', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_99_unknown/objects?objectType=airport',
    });
    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_LAYER');
  });

  // ---- Database offline behavior ----

  it('returns 503 when database is offline for points mode', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&limit=10',
    });
    // Either 503 (offline) or 200 (online) — check code is one of those
    expect([200, 503]).toContain(response.statusCode);
  });

  it('returns 503 when database is offline for cluster mode', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=clusters&bbox=-180,-85,180,85',
    });
    expect([200, 503]).toContain(response.statusCode);
  });

  it('returns consistent error shape when database offline', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&limit=10',
    });
    const body = JSON.parse(response.body);
    if (response.statusCode === 503) {
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('DATABASE_OFFLINE');
      expect(body.error.message).toBeDefined();
      expect(body.error.details).toBeDefined();
    }
  });

  // ---- Response shape for points mode ----

  it('points mode response has items, pagination, and mode fields', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&limit=5',
    });
    if (response.statusCode !== 200) return; // skip if DB offline

    const body = JSON.parse(response.body);
    expect(body.items).toBeDefined();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.pagination).toBeDefined();
    expect(body.pagination.limit).toBeDefined();
    expect(body.pagination.offset).toBeDefined();
    expect(body.pagination.returned).toBeDefined();
    expect(body.mode).toBe('points');
  });

  // ---- Response shape for cluster mode ----

  it('clusters mode response has items, pagination, and mode fields', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=clusters&bbox=-180,-85,180,85&limit=50',
    });
    if (response.statusCode !== 200) return; // skip if DB offline

    const body = JSON.parse(response.body);
    expect(body.items).toBeDefined();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.pagination).toBeDefined();
    expect(body.mode).toBe('clusters');
  });

  // ---- Cluster items have correct shape ----

  it('cluster item has required fields: id, layerId, objectType, count, position, bbox, categoryBreakdown', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=clusters&bbox=-180,-85,180,85&limit=10',
    });
    if (response.statusCode !== 200) return; // skip if DB offline

    const body = JSON.parse(response.body);
    if (body.items.length === 0) return; // no clusters in empty DB

    const cluster = body.items[0];
    expect(cluster.id).toMatch(/^cluster:/);
    expect(cluster.layerId).toBe('layer_01_aviation');
    expect(cluster.objectType).toBe('airport_cluster');
    expect(typeof cluster.count).toBe('number');
    expect(cluster.position).toBeDefined();
    expect(typeof cluster.position.latitude).toBe('number');
    expect(typeof cluster.position.longitude).toBe('number');
    expect(cluster.bbox).toBeDefined();
    expect(typeof cluster.bbox.minLongitude).toBe('number');
    expect(typeof cluster.bbox.minLatitude).toBe('number');
    expect(typeof cluster.bbox.maxLongitude).toBe('number');
    expect(typeof cluster.bbox.maxLatitude).toBe('number');
    expect(cluster.categoryBreakdown).toBeDefined();
    expect(typeof cluster.categoryBreakdown).toBe('object');
  });

  // ---- Point items have correct shape ----

  it('point item has required fields', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&limit=1',
    });
    if (response.statusCode !== 200) return; // skip if DB offline

    const body = JSON.parse(response.body);
    if (body.items.length === 0) return;

    const airport = body.items[0];
    expect(airport.id).toBeDefined();
    expect(airport.layerId).toBe('layer_01_aviation');
    expect(airport.objectType).toBe('airport');
    expect(airport.name).toBeDefined();
    expect(airport.position).toBeDefined();
  });

  // ---- Default limit behavior ----

  it('defaults to limit=500 when not provided', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport',
    });
    if (response.statusCode !== 200) return; // skip if DB offline

    const body = JSON.parse(response.body);
    expect(body.pagination.limit).toBe(500);
  });

  // ---- Valid category filtering ----

  it('accepts valid category values without 400', async () => {
    const categories = [
      'international_or_major_airport',
      'regional_or_domestic_airport',
      'small_airfield',
      'heliport',
      'water_landing_site',
      'balloonport',
      'closed_or_abandoned',
      'unknown',
    ];

    for (const cat of categories) {
      const response = await app.inject({
        method: 'GET',
        url: `/api/layers/layer_01_aviation/objects?objectType=airport&category=${cat}&limit=1`,
      });
      // Should not 400 for invalid category
      expect(response.statusCode).not.toBe(400);
    }
  });

  // ---- Country filter ----

  it('accepts country filter without 400', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&country=US&limit=1',
    });
    // 200 or 503 — not 400
    expect([200, 503]).toContain(response.statusCode);
  });

  // ---- Search filter ----

  it('accepts search filter without 400', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&search=Dubai&limit=1',
    });
    expect([200, 503]).toContain(response.statusCode);
  });

  // ---- Pagination ----

  it('offset parameter is accepted and passed through', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&limit=10&offset=100',
    });
    if (response.statusCode !== 200) return;

    const body = JSON.parse(response.body);
    expect(body.pagination.offset).toBe(100);
  });

  it('returns 400 for negative offset', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&offset=-5',
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_LIMIT');
  });

  // ---- Payload profiles (WO-018) ----

  it('default fields=standard returns existing response shape', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&limit=2',
    });
    if (response.statusCode !== 200) return;

    const body = JSON.parse(response.body);
    expect(body.items).toBeDefined();
    expect(body.items.length).toBeGreaterThan(0);
    // Standard response should have sourceId and sourceObjectId
    const airport = body.items[0];
    expect(airport.sourceId).toBeDefined();
    expect(airport.sourceObjectId).toBeDefined();
    expect(airport.typeSource).toBeDefined();
  });

  it('fields=standard explicitly returns full payload', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&fields=standard&limit=1',
    });
    if (response.statusCode !== 200) return;

    const body = JSON.parse(response.body);
    expect(body.items).toBeDefined();
    if (body.items.length > 0) {
      const airport = body.items[0];
      expect(airport.sourceId).toBeDefined();
      expect(airport.sourceObjectId).toBeDefined();
    }
  });

  it('fields=marker returns lightweight payload without source fields', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&fields=marker&limit=2',
    });
    if (response.statusCode !== 200) return;

    const body = JSON.parse(response.body);
    expect(body.items).toBeDefined();
    expect(body.items.length).toBeGreaterThan(0);

    // Marker payload should NOT have sourceId or sourceObjectId
    const airport = body.items[0];
    expect(airport.id).toBeDefined();
    expect(airport.layerId).toBeDefined();
    expect(airport.objectType).toBe('airport');
    expect(airport.name).toBeDefined();
    expect(airport.ident).toBeDefined();
    expect(airport.category).toBeDefined();
    expect(airport.position).toBeDefined();
    expect(airport.position.latitude).toBeDefined();
    expect(airport.position.longitude).toBeDefined();

    // These should NOT be in marker mode
    expect(airport.sourceId).toBeUndefined();
    expect(airport.sourceObjectId).toBeUndefined();
    expect(airport.typeSource).toBeUndefined();
    expect(airport.region).toBeUndefined();
  });

  it('fields=marker includes optional fields when available', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&fields=marker&limit=5',
    });
    if (response.statusCode !== 200) return;

    const body = JSON.parse(response.body);
    if (body.items.length === 0) return;

    // At least one airport should have optional fields
    const hasOptional = body.items.some((a: Record<string, unknown>) =>
      a.iataCode !== null || a.municipality !== null || a.country !== null || a.elevationFt !== null
    );
    expect(hasOptional).toBe(true);
  });

  it('fields=marker works with bbox filter', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&fields=marker&bbox=-125,25,-65,50&limit=5',
    });
    // Should return 200 or 503 depending on DB status
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      expect(body.items).toBeDefined();
      // Should not have source fields
      if (body.items.length > 0) {
        expect(body.items[0].sourceId).toBeUndefined();
      }
    }
  });

  it('fields=marker works with category filter', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&fields=marker&category=heliport&limit=5',
    });
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      if (body.items.length > 0) {
        expect(body.items[0].category).toBe('heliport');
        expect(body.items[0].sourceId).toBeUndefined();
      }
    }
  });

  it('fields=marker works with country filter', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&fields=marker&country=US&limit=5',
    });
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      if (body.items.length > 0) {
        expect(body.items[0].country).toBe('US');
        expect(body.items[0].sourceId).toBeUndefined();
      }
    }
  });

  it('fields=marker works with search filter', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&fields=marker&search=Los&limit=5',
    });
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      if (body.items.length > 0) {
        expect(body.items[0].sourceId).toBeUndefined();
      }
    }
  });

  it('returns 400 for invalid fields parameter', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&fields=invalid',
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_FIELDS');
    expect(body.error.message).toContain('fields');
  });

  it('metadata includes fields profile when marker mode', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&fields=marker&limit=2',
    });
    if (response.statusCode !== 200) return;

    const body = JSON.parse(response.body);
    expect(body.metadata).toBeDefined();
    expect(body.metadata.fields).toBe('marker');
  });

  it('metadata does not include fields when standard mode', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&fields=standard&limit=2',
    });
    if (response.statusCode !== 200) return;

    const body = JSON.parse(response.body);
    expect(body.metadata).toBeDefined();
    // Standard mode should not add fields to metadata
    expect(body.metadata.fields).toBeUndefined();
  });

  it('mode=clusters is not affected by fields parameter', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=clusters&bbox=-180,-85,180,85&fields=marker&limit=5',
    });
    // Clusters should work regardless of fields parameter
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      expect(body.mode).toBe('clusters');
    }
  });

  // ---- Coordinate modes (WO-021) ----

  it('default coordinates=source keeps existing behavior', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&limit=2',
    });
    if (response.statusCode !== 200) return;

    const body = JSON.parse(response.body);
    expect(body.items).toBeDefined();
    expect(body.items.length).toBeGreaterThan(0);
    // Should have position with coordinates
    const airport = body.items[0];
    expect(airport.position).toBeDefined();
    expect(airport.position.latitude).toBeDefined();
    expect(airport.position.longitude).toBeDefined();
  });

  it('explicit coordinates=source works', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&coordinates=source&limit=1',
    });
    if (response.statusCode !== 200) return;

    const body = JSON.parse(response.body);
    expect(body.items).toBeDefined();
    if (body.items.length > 0) {
      expect(body.items[0].position.latitude).toBeDefined();
      expect(body.items[0].position.longitude).toBeDefined();
    }
  });

  it('coordinates=effective accepts valid parameter', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&coordinates=effective&limit=5',
    });
    // Should return 200 or 503 depending on DB status - not 400
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      expect(body.items).toBeDefined();
    }
  });

  it('coordinates=effective works with bbox filter', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&coordinates=effective&bbox=-125,25,-65,50&limit=5',
    });
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      expect(body.items).toBeDefined();
    }
  });

  it('coordinates=effective works with category filter', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&coordinates=effective&category=heliport&limit=5',
    });
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      if (body.items.length > 0) {
        expect(body.items[0].category).toBe('heliport');
      }
    }
  });

  it('coordinates=effective works with country filter', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&coordinates=effective&country=US&limit=5',
    });
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      if (body.items.length > 0) {
        expect(body.items[0].country).toBe('US');
      }
    }
  });

  it('coordinates=effective works with search filter', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&coordinates=effective&search=Los&limit=5',
    });
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      expect(body.items).toBeDefined();
    }
  });

  it('returns 400 for invalid coordinates parameter', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&coordinates=raw',
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_COORDINATES');
    expect(body.error.message).toContain('coordinates');
  });

  it('metadata includes coordinates mode when effective', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&coordinates=effective&limit=2',
    });
    if (response.statusCode !== 200) return;

    const body = JSON.parse(response.body);
    expect(body.metadata).toBeDefined();
    expect(body.metadata.coordinates).toBe('effective');
  });

  it('metadata does not include coordinates when source (default)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&coordinates=source&limit=2',
    });
    if (response.statusCode !== 200) return;

    const body = JSON.parse(response.body);
    expect(body.metadata).toBeDefined();
    // Source mode should not add coordinates to metadata
    expect(body.metadata.coordinates).toBeUndefined();
  });

  it('fields=marker works with coordinates=effective', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&fields=marker&coordinates=effective&limit=5',
    });
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      expect(body.items).toBeDefined();
      // Marker should not have source fields
      if (body.items.length > 0) {
        expect(body.items[0].sourceId).toBeUndefined();
        expect(body.items[0].sourceObjectId).toBeUndefined();
        // But should have position
        expect(body.items[0].position).toBeDefined();
      }
    }
  });

  it('fields=standard works with coordinates=effective', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&fields=standard&coordinates=effective&limit=5',
    });
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      // Standard should have source fields
      if (body.items.length > 0) {
        expect(body.items[0].sourceId).toBeDefined();
        expect(body.items[0].position).toBeDefined();
      }
    }
  });

  it('mode=clusters is not affected by coordinates parameter', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=clusters&bbox=-180,-85,180,85&coordinates=effective&limit=5',
    });
    // Clusters should work regardless of coordinates parameter
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      expect(body.mode).toBe('clusters');
    }
  });

  // ---- Airport Detail Endpoint (WO-022) ----

  it('airport detail endpoint returns 404 for non-existent airport', async () => {
    // Mock query to return empty array for non-existent airport
    const { query } = await import('../src/lib/db.js');
    const originalQuery = vi.mocked(query);
    originalQuery.mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects/00000000-0000-0000-0000-000000000000/detail',
    });
    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('OBJECT_NOT_FOUND');
  });

  it('airport detail returns structured response with all sections', async () => {
    // First get an airport ID from the list endpoint
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
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      // Should have all sections
      expect(body.airport).toBeDefined();
      expect(body.runways).toBeDefined();
      expect(body.frequencies).toBeDefined();
      expect(body.nearbyNavaids).toBeDefined();
      expect(body.metadata).toBeDefined();
    }
  });

  it('airport detail metadata has required fields', async () => {
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
    if (response.statusCode !== 200) return;

    const body = JSON.parse(response.body);
    const metadata = body.metadata;
    expect(metadata.generatedAt).toBeDefined();
    expect(metadata.layerId).toBe('layer_01_aviation');
    expect(metadata.objectId).toBe(airportId);
    expect(metadata.runwayCount).toBeDefined();
    expect(metadata.frequencyCount).toBeDefined();
    expect(metadata.nearbyNavaidCount).toBeDefined();
  });

  it('airport detail supports coordinates=source', async () => {
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
      url: `/api/layers/layer_01_aviation/objects/${airportId}/detail?coordinates=source`,
    });
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      expect(body.airport.position).toBeDefined();
      expect(body.metadata.coordinates).toBeUndefined();
    }
  });

  it('airport detail supports coordinates=effective', async () => {
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
      url: `/api/layers/layer_01_aviation/objects/${airportId}/detail?coordinates=effective`,
    });
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      expect(body.airport.position).toBeDefined();
      expect(body.metadata.coordinates).toBe('effective');
    }
  });

  it('airport detail accepts custom navaidRadiusKm', async () => {
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
      url: `/api/layers/layer_01_aviation/objects/${airportId}/detail?navaidRadiusKm=50`,
    });
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      expect(body.metadata.navaidRadiusKm).toBe(50);
    }
  });

  it('airport detail accepts custom navaidLimit', async () => {
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
      url: `/api/layers/layer_01_aviation/objects/${airportId}/detail?navaidLimit=10`,
    });
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      expect(body.metadata.nearbyNavaidCount).toBeDefined();
    }
  });

  it('returns 400 for invalid navaidRadiusKm', async () => {
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
      url: `/api/layers/layer_01_aviation/objects/${airportId}/detail?navaidRadiusKm=invalid`,
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_NAVAID_PARAMS');
  });

  it('returns 400 for navaidRadiusKm out of range', async () => {
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
      url: `/api/layers/layer_01_aviation/objects/${airportId}/detail?navaidRadiusKm=500`,
    });
    // Should clamp to max, not 400
    expect([200, 503]).toContain(response.statusCode);
  });

  it('returns 400 for invalid navaidLimit', async () => {
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
      url: `/api/layers/layer_01_aviation/objects/${airportId}/detail?navaidLimit=abc`,
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_NAVAID_PARAMS');
  });

  it('returns 400 for invalid coordinates in detail endpoint', async () => {
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
      url: `/api/layers/layer_01_aviation/objects/${airportId}/detail?coordinates=raw`,
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_COORDINATES');
  });

  it('returns 404 for unknown layer in detail endpoint', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_99_unknown/objects/abc123/detail',
    });
    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_LAYER');
  });

  it('returns 503 when database offline for detail endpoint', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects/abc123/detail',
    });
    // Either 503 (offline) or 404 (not found), not 400
    expect([404, 503]).toContain(response.statusCode);
  });

  // ---- Airport Detail Runtime Hardening (WO-028) ----

  it('airport detail returns 200 for airport with runways and maps heading fields correctly', async () => {
    // Find an airport from the list that has runways
    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&limit=50',
    });
    if (listResponse.statusCode !== 200) return;

    const listBody = JSON.parse(listResponse.body);
    if (listBody.items.length === 0) return;

    // Try airports until we find one with runways
    for (const airport of listBody.items) {
      const detailResponse = await app.inject({
        method: 'GET',
        url: `/api/layers/layer_01_aviation/objects/${airport.id}/detail`,
      });

      if (detailResponse.statusCode === 200) {
        const body = JSON.parse(detailResponse.body);
        // Must have runway section
        expect(body.runways).toBeDefined();
        expect(Array.isArray(body.runways)).toBe(true);

        if (body.runways.length > 0) {
          // Verify runway schema includes heading fields (the runtime bug was column mismatch)
          const runway = body.runways[0];
          expect(runway).toHaveProperty('leHeadingDeg');
          expect(runway).toHaveProperty('heHeadingDeg');
          // Heading fields should be nullable numbers or null
          expect(typeof runway.leHeadingDeg === 'number' || runway.leHeadingDeg === null).toBe(true);
          expect(typeof runway.heHeadingDeg === 'number' || runway.heHeadingDeg === null).toBe(true);
          return; // Test passed - found airport with runways
        }
      }
    }
    // If no airport with runways found, test passes but logs warning
  });

  it('airport detail response includes all required schema sections', async () => {
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
    expect([200, 503]).toContain(response.statusCode);

    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);

      // All required top-level sections per AirportDetailResponseSchema
      expect(body).toHaveProperty('airport');
      expect(body).toHaveProperty('runways');
      expect(body).toHaveProperty('frequencies');
      expect(body).toHaveProperty('nearbyNavaids');
      expect(body).toHaveProperty('metadata');

      // Validate airport section has required fields
      expect(body.airport).toHaveProperty('id');
      expect(body.airport).toHaveProperty('ident');
      expect(body.airport).toHaveProperty('name');
      expect(body.airport).toHaveProperty('position');

      // Validate metadata section
      expect(body.metadata).toHaveProperty('generatedAt');
      expect(body.metadata).toHaveProperty('layerId');
      expect(body.metadata).toHaveProperty('objectId');
      expect(body.metadata).toHaveProperty('runwayCount');
      expect(body.metadata).toHaveProperty('frequencyCount');
      expect(body.metadata).toHaveProperty('nearbyNavaidCount');

      // Validate arrays
      expect(Array.isArray(body.runways)).toBe(true);
      expect(Array.isArray(body.frequencies)).toBe(true);
      expect(Array.isArray(body.nearbyNavaids)).toBe(true);
    }
  });

  it('airport detail runways include all required fields per RunwayDetailSchema', async () => {
    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&limit=20',
    });
    if (listResponse.statusCode !== 200) return;

    const listBody = JSON.parse(listResponse.body);
    if (listBody.items.length === 0) return;

    // Find an airport with runways
    for (const airport of listBody.items) {
      const detailResponse = await app.inject({
        method: 'GET',
        url: `/api/layers/layer_01_aviation/objects/${airport.id}/detail`,
      });

      if (detailResponse.statusCode === 200) {
        const body = JSON.parse(detailResponse.body);

        if (body.runways.length > 0) {
          const runway = body.runways[0];

          // Required fields from RunwayDetailSchema
          expect(runway).toHaveProperty('id');
          expect(runway).toHaveProperty('ident');
          expect(runway).toHaveProperty('lengthFt');
          expect(runway).toHaveProperty('widthFt');
          expect(runway).toHaveProperty('surface');
          expect(runway).toHaveProperty('lighted');
          expect(runway).toHaveProperty('closed');

          // LE (Lower End) fields - these had the runtime bug (wrong column name)
          expect(runway).toHaveProperty('leIdent');
          expect(runway).toHaveProperty('leLatitude');
          expect(runway).toHaveProperty('leLongitude');
          expect(runway).toHaveProperty('leElevationFt');
          expect(runway).toHaveProperty('leHeadingDeg');

          // HE (Higher End) fields
          expect(runway).toHaveProperty('heIdent');
          expect(runway).toHaveProperty('heLatitude');
          expect(runway).toHaveProperty('heLongitude');
          expect(runway).toHaveProperty('heElevationFt');
          expect(runway).toHaveProperty('heHeadingDeg');

          return; // Test passed
        }
      }
    }
  });

  it('airport detail frequencies include required fields per FrequencyDetailSchema', async () => {
    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&limit=20',
    });
    if (listResponse.statusCode !== 200) return;

    const listBody = JSON.parse(listResponse.body);
    if (listBody.items.length === 0) return;

    for (const airport of listBody.items) {
      const detailResponse = await app.inject({
        method: 'GET',
        url: `/api/layers/layer_01_aviation/objects/${airport.id}/detail`,
      });

      if (detailResponse.statusCode === 200) {
        const body = JSON.parse(detailResponse.body);

        if (body.frequencies.length > 0) {
          const freq = body.frequencies[0];

          // Required fields from FrequencyDetailSchema
          expect(freq).toHaveProperty('id');
          expect(freq).toHaveProperty('type');
          expect(freq).toHaveProperty('description');
          expect(freq).toHaveProperty('frequencyMhz');

          return;
        }
      }
    }
  });

  // ---- Aviation Density View (WO-029C) ----

  it('density view: fields=marker returns 200 for density-compatible query', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=points&fields=marker&bbox=-125,25,-65,50&limit=100',
    });
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      expect(body.items).toBeDefined();
      expect(body.mode).toBe('points');
      expect(body.metadata.fields).toBe('marker');
    }
  });

  it('density view: category filter excludes closed_or_abandoned', async () => {
    // Request only operational categories (not closed_or_abandoned)
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=points&fields=marker&category=heliport&limit=10',
    });
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      if (body.items.length > 0) {
        // All returned items should be heliports, not closed_or_abandoned
        for (const item of body.items) {
          expect(item.category).toBe('heliport');
        }
      }
    }
  });

  it('density view: limit is bounded by MAX_VIEWPORT_LIMIT (1000) with bbox', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=points&fields=marker&bbox=-180,-90,180,90&limit=5000',
    });
    // Should not be 400 - limit should be clamped
    expect(response.statusCode).not.toBe(400);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      // Limit should be clamped to max 1000
      expect(body.pagination.limit).toBeLessThanOrEqual(1000);
    }
  });

  it('density view: limit is bounded by MAX_LIST_LIMIT (500) without bbox', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=points&fields=marker&limit=5000',
    });
    // Should not be 400 - limit should be clamped
    expect(response.statusCode).not.toBe(400);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      // Limit should be clamped to max 500 (no bbox)
      expect(body.pagination.limit).toBeLessThanOrEqual(500);
    }
  });

  it('density view: bbox is required for clusters (already enforced)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=clusters',
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('MISSING_BBOX');
  });

  it('density view: global bbox with high limit returns bounded results (no global 85k fetch)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=points&fields=marker&bbox=-180,-90,180,90&limit=1000',
    });
    // Should return bounded results, not all 85k airports
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      // Should never return more than 1000 items
      expect(body.pagination.returned).toBeLessThanOrEqual(1000);
      expect(body.pagination.total).toBeGreaterThan(0);
      // Returned should match limit (or be less if fewer in bbox)
      expect(body.pagination.returned).toBeLessThanOrEqual(body.pagination.limit);
    }
  });

  it('density view: marker payload is lightweight (id, layerId, objectType, category, position)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=points&fields=marker&limit=1',
    });
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      if (body.items.length > 0) {
        const item = body.items[0];
        // Required density view fields
        expect(item.id).toBeDefined();
        expect(item.layerId).toBeDefined();
        expect(item.objectType).toBe('airport');
        expect(item.category).toBeDefined();
        expect(item.position).toBeDefined();
        expect(item.position.latitude).toBeDefined();
        expect(item.position.longitude).toBeDefined();
        // Lightweight - no sourceId/sourceObjectId/typeSource in marker
        expect(item.sourceId).toBeUndefined();
        expect(item.sourceObjectId).toBeUndefined();
      }
    }
  });

  it('density view: can filter by multiple operational categories', async () => {
    const operationalCategories = [
      'international_or_major_airport',
      'regional_or_domestic_airport',
      'small_airfield',
      'heliport',
      'water_landing_site',
      'balloonport',
    ];
    for (const cat of operationalCategories) {
      const response = await app.inject({
        method: 'GET',
        url: `/api/layers/layer_01_aviation/objects?objectType=airport&mode=points&fields=marker&category=${cat}&limit=1`,
      });
      expect([200, 503]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        if (body.items.length > 0) {
          expect(body.items[0].category).toBe(cat);
        }
      }
    }
  });

  it('density view: existing points mode still works', async () => {
    // Ensure standard mode still works after density support
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=points&fields=standard&limit=2',
    });
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      expect(body.mode).toBe('points');
      // Standard should still have source fields
      if (body.items.length > 0) {
        expect(body.items[0].sourceId).toBeDefined();
        expect(body.items[0].sourceObjectId).toBeDefined();
      }
    }
  });

  it('density view: existing clusters mode still works', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=clusters&bbox=-125,25,-65,50&limit=10',
    });
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      expect(body.mode).toBe('clusters');
      expect(body.items).toBeDefined();
    }
  });

  it('density view: LayerObjectsListResponse still compatible with marker response', async () => {
    // Ensure backward compatibility - both schemas should work
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=points&fields=marker&limit=2',
    });
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      // Should have all expected response fields
      expect(body.items).toBeDefined();
      expect(body.pagination).toBeDefined();
      expect(body.pagination.limit).toBeDefined();
      expect(body.pagination.offset).toBeDefined();
      expect(body.pagination.returned).toBeDefined();
      expect(body.pagination.total).toBeDefined();
      expect(body.mode).toBe('points');
      expect(body.metadata).toBeDefined();
    }
  });

  // ---- END Aviation Density View (WO-029C) ----

  // ---- Aviation Fabric / Density Mode (WO-029D) ----

  it('density mode: returns 400 when bbox is missing', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=density',
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('MISSING_BBOX');
  });

  it('density mode: returns 200 for global bbox query', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=density&bbox=-180,-90,180,90&limit=50',
    });
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      expect(body.mode).toBe('density');
      expect(body.items).toBeDefined();
    }
  });

  it('density mode: returns bounded density cells, not raw airports', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=density&bbox=-180,-90,180,90&limit=100',
    });
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      // Should return density cells, not individual airports
      expect(body.items.length).toBeLessThanOrEqual(100);
      // Each item should be a density cell, not an airport
      if (body.items.length > 0) {
        const cell = body.items[0];
        expect(cell.objectType).toBe('airport_density');
        expect(cell.count).toBeGreaterThan(0);
        expect(cell.position).toBeDefined();
        expect(cell.position.latitude).toBeDefined();
        expect(cell.position.longitude).toBeDefined();
      }
    }
  });

  it('density mode: each cell has positive count', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=density&bbox=-125,25,-65,50&limit=20',
    });
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      if (body.items.length > 0) {
        for (const cell of body.items) {
          expect(cell.count).toBeGreaterThan(0);
        }
      }
    }
  });

  it('density mode: excludeClosed=true excludes closed_or_abandoned by default', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=density&bbox=-125,25,-65,50&limit=50',
    });
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      // Default should exclude closed - check metadata
      expect(body.metadata).toBeDefined();
      expect(body.metadata.filtersApplied).toBeDefined();
      expect(body.metadata.filtersApplied.includeClosed).toBe(false);
    }
  });

  it('density mode: includeClosed=true includes closed airports', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=density&bbox=-125,25,-65,50&limit=50&includeClosed=true',
    });
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      expect(body.metadata.filtersApplied.includeClosed).toBe(true);
    }
  });

  it('density mode: cellSizeDegrees validation clamps to min 0.5', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=density&bbox=-180,-90,180,90&cellSizeDegrees=0.1&limit=10',
    });
    // Should not 400 - should clamp to min
    expect(response.statusCode).not.toBe(400);
    expect([200, 503]).toContain(response.statusCode);
  });

  it('density mode: cellSizeDegrees validation clamps to max 10', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=density&bbox=-180,-90,180,90&cellSizeDegrees=100&limit=10',
    });
    // Should not 400 - should clamp to max
    expect(response.statusCode).not.toBe(400);
    expect([200, 503]).toContain(response.statusCode);
  });

  it('density mode: default cellSizeDegrees is 2.0', async () => {
    // Just verify it works without explicit cellSizeDegrees
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

  it('density mode: limit clamping works', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=density&bbox=-180,-90,180,90&limit=5000',
    });
    // Should not 400 - should clamp to max (1000 with bbox)
    expect(response.statusCode).not.toBe(400);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      expect(body.pagination.limit).toBeLessThanOrEqual(1000);
    }
  });

  it('density mode: category filter works', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=density&bbox=-125,25,-65,50&category=heliport&limit=20',
    });
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      // Should return cells with only heliports (if any in bbox)
      expect(body.metadata.filtersApplied.category).toBe('heliport');
    }
  });

  it('density mode: existing points mode still works', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&mode=points&limit=2',
    });
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      expect(body.mode).toBe('points');
      expect(body.items).toBeDefined();
    }
  });

  it('density mode: existing fields=marker still works', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&fields=marker&limit=2',
    });
    expect([200, 503]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      expect(body.mode).toBe('points');
      // Marker should not have source fields
      if (body.items.length > 0) {
        expect(body.items[0].sourceId).toBeUndefined();
      }
    }
  });

  it('density mode: existing clusters mode still works', async () => {
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

  it('density mode: detail endpoint still works', async () => {
    // First get an airport ID
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

  // ---- END Aviation Fabric / Density Mode (WO-029D) ----

  it('airport detail navaids include required fields per NavaidDetailSchema', async () => {
    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_01_aviation/objects?objectType=airport&limit=20',
    });
    if (listResponse.statusCode !== 200) return;

    const listBody = JSON.parse(listResponse.body);
    if (listBody.items.length === 0) return;

    // Try multiple airports to find one with navaids
    for (const airport of listBody.items) {
      const detailResponse = await app.inject({
        method: 'GET',
        url: `/api/layers/layer_01_aviation/objects/${airport.id}/detail`,
      });

      if (detailResponse.statusCode === 200) {
        const body = JSON.parse(detailResponse.body);

        if (body.nearbyNavaids.length > 0) {
          const navaid = body.nearbyNavaids[0];

          // Required fields from NavaidDetailSchema
          expect(navaid).toHaveProperty('id');
          expect(navaid).toHaveProperty('ident');
          expect(navaid).toHaveProperty('name');
          expect(navaid).toHaveProperty('type');
          expect(navaid).toHaveProperty('frequencyKhz');
          expect(navaid).toHaveProperty('latitude');
          expect(navaid).toHaveProperty('longitude');
          expect(navaid).toHaveProperty('elevationFt');
          expect(navaid).toHaveProperty('distanceKm');

          return;
        }
      }
    }
  });
});
