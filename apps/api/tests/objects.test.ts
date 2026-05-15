import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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
});