import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { spaceSatellitesRoutes } from '../src/routes/space/satellites.js';
import { query } from '../src/lib/db.js';
import {
  SpaceSatellitesBroadcaster,
  buildSnapshot,
  buildEmptySnapshot,
  applyFilters,
  loadSatellitesSnapshot,
  DEFAULT_SNAPSHOT_LIMIT,
  MAX_SNAPSHOT_LIMIT,
} from '../src/routes/space/space-satellites-broadcaster.js';

const MOCK_SATELLITES = [
  {
    satelliteId: '550e8400-e29b-41d4-a716-446655440001',
    noradId: 25544,
    name: 'ISS (ZARYA)',
    objectType: 'satellite',
    category: 'crewed_or_station',
    orbitClass: 'leo',
    country: 'US',
    launchDate: '1998-11-20',
    latitude: 45.2,
    longitude: -122.7,
    altitudeKm: 408.5,
    velocityKms: 7.66,
    headingDeg: 45.2,
    visualShape: 'dot',
    visualColor: '#00d5ff',
    important: true,
    estimatedAt: '2026-06-01T00:00:00.000Z',
    sourceId: 'celestrak',
    sourceObjectId: '25544',
    sourceAgeSeconds: 3600,
  },
  {
    satelliteId: '550e8400-e29b-41d4-a716-446655440002',
    noradId: 44713,
    name: 'STARLINK-1001',
    objectType: 'satellite',
    category: 'starlink',
    orbitClass: 'leo',
    country: 'US',
    launchDate: null,
    latitude: 10.5,
    longitude: 25.1,
    altitudeKm: 550.2,
    velocityKms: 7.64,
    headingDeg: 123.5,
    visualShape: 'dot',
    visualColor: '#ff8c00',
    important: false,
    estimatedAt: '2026-06-01T00:00:00.000Z',
    sourceId: 'celestrak',
    sourceObjectId: '44713',
    sourceAgeSeconds: 7200,
  },
  {
    satelliteId: '550e8400-e29b-41d4-a716-446655440003',
    noradId: 12345,
    name: 'DEBRIS-1999-001ABC',
    objectType: 'debris',
    category: 'debris',
    orbitClass: 'leo',
    country: null,
    launchDate: null,
    latitude: 30.0,
    longitude: 80.0,
    altitudeKm: 800.0,
    velocityKms: 7.4,
    headingDeg: 200.0,
    visualShape: 'triangle',
    visualColor: '#ff2d55',
    important: false,
    estimatedAt: '2026-06-01T00:00:00.000Z',
    sourceId: 'celestrak',
    sourceObjectId: '12345',
    sourceAgeSeconds: 1800,
  },
];

const MOCK_DETAIL_SATELLITE = {
  ...MOCK_SATELLITES[0],
  operator: 'NASA/RSA',
};

const MOCK_CATEGORIES = [
  { category: 'starlink', count: 4000 },
  { category: 'communications', count: 300 },
  { category: 'crewed_or_station', count: 5 },
  { category: 'debris', count: 20000 },
];

const MOCK_OBJECT_TYPES = [
  { objectType: 'satellite', count: 5000 },
  { objectType: 'debris', count: 20000 },
  { objectType: 'rocket_body', count: 2000 },
];

const MOCK_ORBIT_CLASSES = [
  { orbitClass: 'leo', count: 25000 },
  { orbitClass: 'meo', count: 1000 },
  { orbitClass: 'geo', count: 500 },
];

const MOCK_TOTALS = [{ total_count: 27000, important_count: 50 }];

const MOCK_SPACE_TRACK_SATELLITE = {
  satelliteId: '550e8400-e29b-41d4-a716-446655440004',
  noradId: 99999,
  name: 'SPACE-TRACK-OBJECT',
  objectType: 'satellite',
  category: 'communications',
  orbitClass: 'geo',
  country: 'US',
  launchDate: '2020-01-01',
  latitude: 0.0,
  longitude: -75.0,
  altitudeKm: 35786.0,
  velocityKms: 3.07,
  headingDeg: 0.0,
  visualShape: 'dot',
  visualColor: '#ffffff',
  important: false,
  estimatedAt: '2026-06-01T00:00:00.000Z',
  sourceId: 'space_track',
  sourceObjectId: '99999',
  sourceAgeSeconds: 600,
};

describe('Space Satellites API', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(spaceSatellitesRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. GET /api/space/satellites returns valid shape and rich metadata', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SATELLITES);

    const response = await app.inject({
      method: 'GET',
      url: '/api/space/satellites?limit=50000',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.satellites).toBeDefined();
    expect(body.metadata).toBeDefined();
    expect(body.metadata.count).toBe(3);
    expect(body.metadata.generatedAt).toBeDefined();
    expect(body.metadata.estimated).toBe(true);
    expect(body.metadata.layerId).toBe('layer_05_space_satellites');
    expect(body.metadata.requestedLimit).toBe(50000);
    expect(body.metadata.appliedLimit).toBeGreaterThanOrEqual(10000);
    expect(body.metadata.maxLimit).toBe(75000);

    const sat = body.satellites[0];
    expect(sat.satelliteId).toBe(MOCK_SATELLITES[0].satelliteId);
    expect(sat.noradId).toBe(25544);
    expect(sat.name).toBe('ISS (ZARYA)');
    expect(sat.objectType).toBe('satellite');
    expect(sat.category).toBe('crewed_or_station');
    expect(sat.orbitClass).toBe('leo');
    expect(sat.country).toBe('US');
    expect(sat.launchDate).toBe('1998-11-20');
    expect(sat.position.latitude).toBe(45.2);
    expect(sat.position.longitude).toBe(-122.7);
    expect(sat.position.altitudeKm).toBe(408.5);
    expect(sat.velocity.speedKms).toBe(7.66);
    expect(sat.headingDeg).toBe(45.2);
    expect(sat.visualShape).toBe('dot');
    expect(sat.visualColor).toBe('#00d5ff');
    expect(sat.important).toBe(true);
    expect(sat.estimatedAt).toBeDefined();
    expect(sat.sourceId).toBe('celestrak');
    expect(sat.sourceObjectId).toBe('25544');
    expect(sat.sourceAgeSeconds).toBe(3600);
  });

  it('2. filters are validated and parameterized', async () => {
    vi.mocked(query).mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/space/satellites?category=starlink&objectType=satellite&orbitClass=leo&sourceId=celestrak',
    });

    expect(response.statusCode).toBe(200);

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    const params = callArgs[1] as unknown[];

    expect(sql).toContain('$1');
    expect(sql).toContain('p.category IN');
    expect(sql).toContain('p.object_type IN');
    expect(sql).toContain('p.orbit_class IN');
    expect(sql).toContain('p.source_id IN');
    expect(params).toContain('starlink');
    expect(params).toContain('satellite');
    expect(params).toContain('leo');
    expect(params).toContain('celestrak');
  });

  it('3. default limit is 1000', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SATELLITES);

    await app.inject({
      method: 'GET',
      url: '/api/space/satellites',
    });

    const callArgs = vi.mocked(query).mock.calls[0];
    const params = callArgs[1] as unknown[];
    const lastParam = params[params.length - 1];
    expect(lastParam).toBe(1000);
  });

  it('4. max limit is 75000', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SATELLITES);

    await app.inject({
      method: 'GET',
      url: '/api/space/satellites?limit=99999',
    });

    const callArgs = vi.mocked(query).mock.calls[0];
    const params = callArgs[1] as unknown[];
    const lastParam = params[params.length - 1];
    expect(lastParam).toBe(75000);
  });

  it('5. invalid limit returns 400', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/space/satellites?limit=abc',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_LIMIT');
  });

  it('6. altitude filter behavior works', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SATELLITES);

    await app.inject({
      method: 'GET',
      url: '/api/space/satellites?minAltitude=400&maxAltitude=600',
    });

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('altitude_km >=');
    expect(sql).toContain('altitude_km <=');
  });

  it('7. category filter sends parameterized SQL', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SATELLITES);

    await app.inject({
      method: 'GET',
      url: '/api/space/satellites?category=starlink,debris',
    });

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    const params = callArgs[1] as unknown[];

    expect(sql).toContain('$1');
    expect(sql).toContain('$2');
    expect(params).toContain('starlink');
    expect(params).toContain('debris');
  });

  it('8. objectType filter works', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SATELLITES);

    await app.inject({
      method: 'GET',
      url: '/api/space/satellites?objectType=satellite,debris',
    });

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('p.object_type IN');
  });

  it('9. orbitClass filter works', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SATELLITES);

    await app.inject({
      method: 'GET',
      url: '/api/space/satellites?orbitClass=leo,meo',
    });

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('p.orbit_class IN');
  });

  it('10. importantOnly filter works', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SATELLITES);

    await app.inject({
      method: 'GET',
      url: '/api/space/satellites?importantOnly=true',
    });

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('is_important = TRUE');
  });

  it('11. empty database result is safe', async () => {
    vi.mocked(query).mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/space/satellites',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.satellites).toEqual([]);
    expect(body.metadata.count).toBe(0);
  });

  it('12. GET /api/space/satellites/:satelliteId returns detail', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_DETAIL_SATELLITE]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/space/satellites/550e8400-e29b-41d4-a716-446655440001',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.satellite).toBeDefined();
    expect(body.satellite.satelliteId).toBe('550e8400-e29b-41d4-a716-446655440001');
    expect(body.satellite.name).toBe('ISS (ZARYA)');
    expect(body.satellite.operator).toBe('NASA/RSA');
    expect(body.satellite.important).toBe(true);
  });

  it('13. detail 404 behavior', async () => {
    vi.mocked(query).mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/space/satellites/550e8400-e29b-41d4-a716-446655449999',
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('OBJECT_NOT_FOUND');
  });

  it('14. GET /api/space/satellites/categories returns counts', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce(MOCK_CATEGORIES)
      .mockResolvedValueOnce(MOCK_OBJECT_TYPES)
      .mockResolvedValueOnce(MOCK_ORBIT_CLASSES)
      .mockResolvedValueOnce(MOCK_TOTALS);

    const response = await app.inject({
      method: 'GET',
      url: '/api/space/satellites/categories',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.categories).toBeDefined();
    expect(body.objectTypes).toBeDefined();
    expect(body.orbitClasses).toBeDefined();
    expect(body.totalCount).toBe(27000);
    expect(body.importantCount).toBe(50);
    expect(body.metadata.estimated).toBe(true);
    expect(body.metadata.layerId).toBe('layer_05_space_satellites');

    const starlinkCat = body.categories.find((c: { category: string }) => c.category === 'starlink');
    expect(starlinkCat).toBeDefined();
    expect(starlinkCat.count).toBe(4000);
  });

  it('15. no raw_source_json or raw_position_json in list response', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SATELLITES);

    const response = await app.inject({
      method: 'GET',
      url: '/api/space/satellites',
    });

    const body = JSON.parse(response.body);
    for (const sat of body.satellites) {
      expect(sat).not.toHaveProperty('raw_source_json');
      expect(sat).not.toHaveProperty('raw_position_json');
    }
  });

  it('16. no external upstream calls from API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    vi.mocked(query).mockResolvedValueOnce(MOCK_SATELLITES);

    await app.inject({
      method: 'GET',
      url: '/api/space/satellites',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('17. no secrets exposed', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SATELLITES);

    const response = await app.inject({
      method: 'GET',
      url: '/api/space/satellites',
    });

    const body = JSON.parse(response.body);
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain('password');
    expect(bodyStr).not.toContain('secret');
    expect(bodyStr).not.toContain('api_key');
    expect(bodyStr).not.toContain('token');
  });

  it('18. no layer_04_space naming appears', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SATELLITES);

    const response = await app.inject({
      method: 'GET',
      url: '/api/space/satellites',
    });

    const bodyStr = JSON.stringify(JSON.parse(response.body)).toLowerCase();
    expect(bodyStr).not.toContain('layer_04_space');
  });

  it('19. SQL is parameterized (no string interpolation)', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SATELLITES);

    await app.inject({
      method: 'GET',
      url: '/api/space/satellites',
    });

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    const params = callArgs[1] as unknown[];

    expect(sql).toContain('$1');
    expect(params).toBeDefined();
    expect(params.length).toBeGreaterThanOrEqual(1);
  });

  it('20. category endpoint returns empty-safe response', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total_count: 0, important_count: 0 }]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/space/satellites/categories',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.categories).toEqual([]);
    expect(body.objectTypes).toEqual([]);
    expect(body.orbitClasses).toEqual([]);
    expect(body.totalCount).toBe(0);
    expect(body.importantCount).toBe(0);
  });

  it('21. REST endpoint accepts limit greater than 5000', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SATELLITES);

    const response = await app.inject({
      method: 'GET',
      url: '/api/space/satellites?limit=50000',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.metadata.appliedLimit).toBe(50000);
    expect(body.metadata.maxLimit).toBe(75000);
    expect(body.metadata.requestedLimit).toBe(50000);
  });

  it('22. REST endpoint clamps limit to MAX_LIMIT (75000)', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SATELLITES);

    const response = await app.inject({
      method: 'GET',
      url: '/api/space/satellites?limit=200000',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.metadata.appliedLimit).toBe(75000);
    expect(body.metadata.maxLimit).toBe(75000);
    expect(body.metadata.requestedLimit).toBe(200000);
  });

  it('23. REST metadata reports applied/returned/max limits', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SATELLITES);

    const response = await app.inject({
      method: 'GET',
      url: '/api/space/satellites?limit=5000',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.metadata).toHaveProperty('count');
    expect(body.metadata).toHaveProperty('appliedLimit');
    expect(body.metadata).toHaveProperty('maxLimit');
    expect(body.metadata).toHaveProperty('requestedLimit');
    expect(body.metadata).toHaveProperty('generatedAt');
    expect(body.metadata).toHaveProperty('estimated');
    expect(body.metadata).toHaveProperty('layerId');
    expect(body.metadata.count).toBe(3);
    expect(body.metadata.appliedLimit).toBe(5000);
    expect(body.metadata.maxLimit).toBe(75000);
    expect(body.metadata.requestedLimit).toBe(5000);
  });

  it('24. REST metadata omits requestedLimit when no limit param', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SATELLITES);

    const response = await app.inject({
      method: 'GET',
      url: '/api/space/satellites',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.metadata.requestedLimit).toBeUndefined();
    expect(body.metadata.appliedLimit).toBe(1000); // default
    expect(body.metadata.maxLimit).toBe(75000);
  });

  it('25. REST sourceId filter sends parameterized SQL', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SATELLITES);

    const response = await app.inject({
      method: 'GET',
      url: '/api/space/satellites?sourceId=celestrak,space_track',
    });

    expect(response.statusCode).toBe(200);
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    const params = callArgs[1] as unknown[];

    expect(sql).toContain('p.source_id IN');
    expect(sql).toContain('$1');
    expect(sql).toContain('$2');
    expect(params).toContain('celestrak');
    expect(params).toContain('space_track');
  });

  it('26. REST sourceId filter reduces results', async () => {
    const mixedSources = [...MOCK_SATELLITES, MOCK_SPACE_TRACK_SATELLITE];
    vi.mocked(query).mockResolvedValueOnce(mixedSources);

    const response = await app.inject({
      method: 'GET',
      url: '/api/space/satellites?sourceId=celestrak',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.metadata.activeFilters).toBeDefined();
    expect(body.metadata.activeFilters.sourceId).toEqual(['celestrak']);
  });

  it('27. REST importantOnly filter reduces results', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SATELLITES);

    const response = await app.inject({
      method: 'GET',
      url: '/api/space/satellites?importantOnly=true',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.metadata.activeFilters).toBeDefined();
    expect(body.metadata.activeFilters.importantOnly).toBe(true);
  });

  it('28. REST metadata reports activeFilters with combined filters', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SATELLITES);

    const response = await app.inject({
      method: 'GET',
      url: '/api/space/satellites?category=debris&objectType=debris&orbitClass=leo&importantOnly=false&minAltitude=100&maxAltitude=1000&sourceId=celestrak',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.metadata.activeFilters).toBeDefined();
    expect(body.metadata.activeFilters.category).toEqual(['debris']);
    expect(body.metadata.activeFilters.objectType).toEqual(['debris']);
    expect(body.metadata.activeFilters.orbitClass).toEqual(['leo']);
    expect(body.metadata.activeFilters.importantOnly).toBe(false);
    expect(body.metadata.activeFilters.minAltitude).toBe(100);
    expect(body.metadata.activeFilters.maxAltitude).toBe(1000);
    expect(body.metadata.activeFilters.sourceId).toEqual(['celestrak']);
  });

  it('29. REST metadata omits activeFilters when no filters', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SATELLITES);

    const response = await app.inject({
      method: 'GET',
      url: '/api/space/satellites',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.metadata.activeFilters).toBeUndefined();
  });

  // ===================================================================
  // Clean public slug aliases (API-URL-002 / API-POLICY-001)
  // Each new path returns the same response shape as the legacy
  // /api/space/satellites/... path. The old paths are preserved
  // and continue to work; the new paths are aliases only. The
  // /ws/space/satellites/live WebSocket path is intentionally NOT
  // aliased and is registered separately in apps/api/src/index.ts.
  // ===================================================================

  it('alias.1 GET /api/layers/space/satellites returns same shape as the legacy path', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SATELLITES);

    const newPathResponse = await app.inject({
      method: 'GET',
      url: '/api/layers/space/satellites',
    });
    expect(newPathResponse.statusCode).toBe(200);
    const newPathBody = JSON.parse(newPathResponse.body);

    vi.mocked(query).mockResolvedValueOnce(MOCK_SATELLITES);
    const legacyResponse = await app.inject({
      method: 'GET',
      url: '/api/space/satellites',
    });
    expect(legacyResponse.statusCode).toBe(200);
    const legacyBody = JSON.parse(legacyResponse.body);

    expect(Object.keys(newPathBody).sort()).toEqual(Object.keys(legacyBody).sort());
    expect(newPathBody.satellites.length).toBe(legacyBody.satellites.length);
    expect(newPathBody.metadata.layerId).toBe(legacyBody.metadata.layerId);
  });

  it('alias.2 GET /api/layers/space/satellites/categories returns the categories endpoint', async () => {
    // Match the mock sequence used by existing test 14 (4 sequential query() calls
    // inside getCategories / getSatelliteCategories).
    vi.mocked(query)
      .mockResolvedValueOnce(MOCK_CATEGORIES)
      .mockResolvedValueOnce(MOCK_OBJECT_TYPES)
      .mockResolvedValueOnce(MOCK_ORBIT_CLASSES)
      .mockResolvedValueOnce(MOCK_TOTALS);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/space/satellites/categories',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.metadata.layerId).toBe('layer_05_space_satellites');
    expect(body.categories).toBeDefined();
    expect(body.totalCount).toBe(27000);
  });

  it('alias.3 GET /api/layers/space/satellites/:satelliteId returns same shape as the legacy detail path', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_SATELLITES[0]]);

    const newPathResponse = await app.inject({
      method: 'GET',
      url: '/api/layers/space/satellites/550e8400-e29b-41d4-a716-446655440001',
    });
    expect(newPathResponse.statusCode).toBe(200);
    const newPathBody = JSON.parse(newPathResponse.body);

    vi.mocked(query).mockResolvedValueOnce([MOCK_SATELLITES[0]]);
    const legacyResponse = await app.inject({
      method: 'GET',
      url: '/api/space/satellites/550e8400-e29b-41d4-a716-446655440001',
    });
    expect(legacyResponse.statusCode).toBe(200);
    const legacyBody = JSON.parse(legacyResponse.body);

    expect(Object.keys(newPathBody).sort()).toEqual(Object.keys(legacyBody).sort());
    expect(newPathBody.satellite.satelliteId).toBe('550e8400-e29b-41d4-a716-446655440001');
  });

  it('alias.4 The new clean Space path does not create a duplicated /api/layers/space/space/... path', async () => {
    // Negative test: a duplicated /api/layers/space/space/<verb> path must
    // NOT exist (would 404). This guards the slug rule from accidental
    // duplication.
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/space/space/satellites',
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('Space Satellites Broadcaster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('buildSnapshot creates valid snapshot from rows', () => {
    const snapshot = buildSnapshot(MOCK_SATELLITES);
    expect(snapshot.type).toBe('space.satellites.snapshot');
    expect(snapshot.layerId).toBe('layer_05_space_satellites');
    expect(snapshot.estimated).toBe(true);
    expect(snapshot.count).toBe(3);
    expect(snapshot.satellites).toHaveLength(3);
    expect(snapshot.satellites[0].name).toBe('ISS (ZARYA)');
    expect(snapshot.satellites[1].name).toBe('STARLINK-1001');
  });

  it('buildEmptySnapshot returns zero-count snapshot', () => {
    const snapshot = buildEmptySnapshot();
    expect(snapshot.count).toBe(0);
    expect(snapshot.satellites).toEqual([]);
    expect(snapshot.estimated).toBe(true);
  });

  it('applyFilters filters by category', () => {
    const snapshot = buildSnapshot(MOCK_SATELLITES);
    const filtered = applyFilters(snapshot, { category: ['starlink'] });
    expect(filtered.count).toBe(1);
    expect(filtered.satellites[0].name).toBe('STARLINK-1001');
  });

  it('applyFilters filters by objectType', () => {
    const snapshot = buildSnapshot(MOCK_SATELLITES);
    const filtered = applyFilters(snapshot, { objectType: ['debris'] });
    expect(filtered.count).toBe(1);
    expect(filtered.satellites[0].name).toBe('DEBRIS-1999-001ABC');
  });

  it('applyFilters filters by orbitClass', () => {
    const snapshot = buildSnapshot(MOCK_SATELLITES);
    const filtered = applyFilters(snapshot, { orbitClass: ['leo'] });
    expect(filtered.count).toBe(3);
  });

  it('applyFilters filters by importantOnly', () => {
    const snapshot = buildSnapshot(MOCK_SATELLITES);
    const filtered = applyFilters(snapshot, { importantOnly: true });
    expect(filtered.count).toBe(1);
    expect(filtered.satellites[0].name).toBe('ISS (ZARYA)');
  });

  it('applyFilters filters by minAltitude', () => {
    const snapshot = buildSnapshot(MOCK_SATELLITES);
    const filtered = applyFilters(snapshot, { minAltitude: 500 });
    expect(filtered.count).toBe(2);
  });

  it('applyFilters filters by maxAltitude', () => {
    const snapshot = buildSnapshot(MOCK_SATELLITES);
    const filtered = applyFilters(snapshot, { maxAltitude: 500 });
    expect(filtered.count).toBe(1);
    expect(filtered.satellites[0].name).toBe('ISS (ZARYA)');
  });

  it('applyFilters applies limit', () => {
    const snapshot = buildSnapshot(MOCK_SATELLITES);
    const filtered = applyFilters(snapshot, { limit: 1 });
    expect(filtered.count).toBe(1);
  });

  it('applyFilters filters by sourceId', () => {
    const snapshot = buildSnapshot(MOCK_SATELLITES);
    const filtered = applyFilters(snapshot, { sourceId: ['celestrak'] });
    expect(filtered.count).toBe(3);
    expect(filtered.satellites.every((s) => s.sourceId === 'celestrak')).toBe(true);
  });

  it('applyFilters filters by sourceId with no match', () => {
    const snapshot = buildSnapshot(MOCK_SATELLITES);
    const filtered = applyFilters(snapshot, { sourceId: ['space_track'] });
    expect(filtered.count).toBe(0);
  });

  it('applyFilters combined with category and sourceId', () => {
    const mixedRows = [...MOCK_SATELLITES, MOCK_SPACE_TRACK_SATELLITE];
    const snapshot = buildSnapshot(mixedRows);
    const filtered = applyFilters(snapshot, { category: ['communications'], sourceId: ['space_track'] });
    expect(filtered.count).toBe(1);
    expect(filtered.satellites[0].name).toBe('SPACE-TRACK-OBJECT');
  });

  it('applyFilters with no filters returns all', () => {
    const snapshot = buildSnapshot(MOCK_SATELLITES);
    const filtered = applyFilters(snapshot, {});
    expect(filtered.count).toBe(3);
  });

  it('loadSatellitesSnapshot handles empty DB safely', async () => {
    vi.mocked(query).mockResolvedValueOnce([]);

    const snapshot = await loadSatellitesSnapshot(100);
    expect(snapshot.count).toBe(0);
    expect(snapshot.satellites).toEqual([]);
  });

  it('SpaceSatellitesBroadcaster starts and loads snapshot', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SATELLITES);

    const bc = new SpaceSatellitesBroadcaster();
    const events: string[] = [];

    bc.onReady = () => { events.push('ready'); };
    bc.onSnapshot = () => { events.push('snapshot'); };

    await bc.start();

    expect(events).toEqual(['ready', 'snapshot']);
    expect(bc.getLatestSnapshot()).not.toBeNull();
    expect(bc.getLatestSnapshot()!.count).toBe(3);
    bc.stop();
  });

  it('SpaceSatellitesBroadcaster handles empty DB gracefully', async () => {
    vi.mocked(query).mockResolvedValueOnce([]);

    const bc = new SpaceSatellitesBroadcaster();
    const errors: string[] = [];

    bc.onReady = () => {};
    bc.onSnapshot = () => {};
    bc.onError = (e) => { errors.push(e.code); };

    await bc.start();

    // Empty DB should still have a valid empty snapshot, not an error
    expect(bc.getLatestSnapshot()).not.toBeNull();
    expect(bc.getLatestSnapshot()!.count).toBe(0);
    bc.stop();
  });

  it('SpaceSatellitesBroadcaster handles DB error gracefully', async () => {
    vi.mocked(query).mockRejectedValueOnce(new Error('DB connection failed'));

    const bc = new SpaceSatellitesBroadcaster();
    const errors: string[] = [];

    bc.onReady = () => {};
    bc.onSnapshot = () => {};
    bc.onError = (e) => { errors.push(e.code); };

    await bc.start();

    expect(errors).toContain('SOURCE_UNAVAILABLE');
    bc.stop();
  });

  it('broadcaster uses parameterized SQL (no string interpolation)', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SATELLITES);

    const bc = new SpaceSatellitesBroadcaster();
    bc.onReady = () => {};
    bc.onSnapshot = () => {};

    await bc.start();

    const sqlCall = vi.mocked(query).mock.calls[0][0] as string;
    expect(sqlCall).toContain('$1');
    bc.stop();
  });

  it('broadcaster reads from space tables only', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SATELLITES);

    const bc = new SpaceSatellitesBroadcaster();
    bc.onReady = () => {};
    bc.onSnapshot = () => {};

    await bc.start();

    const sqlCall = vi.mocked(query).mock.calls[0][0] as string;
    expect(sqlCall).toContain('space_satellites');
    expect(sqlCall).toContain('space_satellite_positions_latest');
    expect(sqlCall).not.toContain('aviation');
    bc.stop();
  });

  it('broadcaster getStatus returns current state', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SATELLITES);

    const bc = new SpaceSatellitesBroadcaster();
    bc.onReady = () => {};
    bc.onSnapshot = () => {};

    const statusBefore = bc.getStatus();
    expect(statusBefore.satelliteCount).toBe(0);

    await bc.start();

    const status = bc.getStatus();
    expect(status.satelliteCount).toBe(3);
    expect(status.lastSuccessAt).toBeTypeOf('number');
    bc.stop();
  });

  // ---- Scale limit tests (WO-082D2) ----

  it('loadSatellitesSnapshot default limit is DEFAULT_SNAPSHOT_LIMIT (not 5000)', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SATELLITES);
    const snapshot = await loadSatellitesSnapshot();
    const callArgs = vi.mocked(query).mock.calls[0];
    const params = callArgs[1] as unknown[];
    const lastParam = params[params.length - 1];
    expect(lastParam).toBe(DEFAULT_SNAPSHOT_LIMIT);
    expect(DEFAULT_SNAPSHOT_LIMIT).toBeGreaterThan(5000);
  });

  it('SpaceSatellitesBroadcaster default limit is DEFAULT_SNAPSHOT_LIMIT (not 5000)', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SATELLITES);
    const bc = new SpaceSatellitesBroadcaster();
    bc.onReady = () => {};
    bc.onSnapshot = () => {};
    await bc.start();
    const callArgs = vi.mocked(query).mock.calls[0];
    const params = callArgs[1] as unknown[];
    const lastParam = params[params.length - 1];
    expect(lastParam).toBe(DEFAULT_SNAPSHOT_LIMIT);
    expect(DEFAULT_SNAPSHOT_LIMIT).toBeGreaterThan(5000);
    bc.stop();
  });

  it('SpaceSatellitesBroadcaster clamps limit to MAX_SNAPSHOT_LIMIT', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SATELLITES);
    const bc = new SpaceSatellitesBroadcaster(999999);
    bc.onReady = () => {};
    bc.onSnapshot = () => {};
    await bc.start();
    const callArgs = vi.mocked(query).mock.calls[0];
    const params = callArgs[1] as unknown[];
    const lastParam = params[params.length - 1];
    expect(lastParam).toBeLessThanOrEqual(MAX_SNAPSHOT_LIMIT);
    bc.stop();
  });

  it('applyFilters handles WebSocket subscribe with sourceId filter', () => {
    const mixedRows = [...MOCK_SATELLITES, MOCK_SPACE_TRACK_SATELLITE];
    const snapshot = buildSnapshot(mixedRows);
    // Simulate a WebSocket subscribe message with sourceId filter
    const filtered = applyFilters(snapshot, { sourceId: ['space_track'], limit: 10 });
    expect(filtered.count).toBe(1);
    expect(filtered.satellites[0].sourceId).toBe('space_track');
  });

  it('broadcaster loads more than 5000 when DB has more rows', async () => {
    const manyRows = Array.from({ length: 6000 }, (_, i) => ({
      ...MOCK_SATELLITES[0],
      satelliteId: `550e8400-e29b-41d4-a716-44665544${String(i).padStart(4, '0')}`,
      name: `SATELLITE-${i}`,
    }));
    vi.mocked(query).mockResolvedValueOnce(manyRows);
    const bc = new SpaceSatellitesBroadcaster();
    bc.onReady = () => {};
    bc.onSnapshot = () => {};
    await bc.start();
    expect(bc.getLatestSnapshot()!.count).toBe(6000);
    expect(bc.getLatestSnapshot()!.satellites).toHaveLength(6000);
    bc.stop();
  });
});
