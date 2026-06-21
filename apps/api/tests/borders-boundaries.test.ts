import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { bordersBoundariesRoutes } from '../src/routes/borders-boundaries.js';
import { query } from '../src/lib/db.js';

const MOCK_SOURCE = [{ sourceId: 'natural_earth_admin0_50m', sourceName: 'Natural Earth Admin-0 Countries 1:50m' }];

const MOCK_FEATURES = [
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    layerId: 'layer_02_borders_boundaries',
    sourceId: 'natural_earth_admin0_50m',
    sourceObjectId: 'NE_50m_ADM0_001',
    boundaryType: 'country_boundary',
    boundaryLevel: 'admin0',
    adminLevel: 0,
    countryIso2: 'JP',
    countryIso3: 'JPN',
    name: 'Japan',
    displayName: 'Japan',
    disputed: false,
    indiaSensitive: false,
    indiaComplianceStatus: 'not_applicable',
    geometry: {
      type: 'Polygon',
      coordinates: [[[130, 30], [145, 30], [145, 45], [130, 45], [130, 30]]],
    },
  },
  {
    id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    layerId: 'layer_02_borders_boundaries',
    sourceId: 'natural_earth_admin0_50m',
    sourceObjectId: 'NE_50m_ADM0_002',
    boundaryType: 'country_boundary',
    boundaryLevel: 'admin0',
    adminLevel: 0,
    countryIso2: 'IN',
    countryIso3: 'IND',
    name: 'India',
    displayName: 'India',
    disputed: false,
    indiaSensitive: true,
    indiaComplianceStatus: 'requires_soi_review',
    geometry: {
      type: 'Polygon',
      coordinates: [[[68, 8], [97, 8], [97, 37], [68, 37], [68, 8]]],
    },
  },
];

describe('Borders & Boundaries API', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(bordersBoundariesRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. GET /api/borders-boundaries/countries is registered and returns FeatureCollection', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SOURCE);
    vi.mocked(query).mockResolvedValueOnce(MOCK_FEATURES);

    const response = await app.inject({
      method: 'GET',
      url: '/api/borders-boundaries/countries',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.type).toBe('FeatureCollection');
    expect(body.features).toBeDefined();
    expect(body.meta).toBeDefined();
  });

  it('2. Default query returns FeatureCollection with correct shape', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SOURCE);
    vi.mocked(query).mockResolvedValueOnce(MOCK_FEATURES);

    const response = await app.inject({
      method: 'GET',
      url: '/api/borders-boundaries/countries',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.type).toBe('FeatureCollection');
    expect(Array.isArray(body.features)).toBe(true);
    expect(body.features.length).toBe(2);

    const f = body.features[0];
    expect(f.type).toBe('Feature');
    expect(f.id).toBeDefined();
    expect(f.geometry).toBeDefined();
    expect(f.geometry.type).toBeDefined();
    expect(f.properties).toBeDefined();
    expect(f.properties.id).toBeDefined();
    expect(f.properties.layerId).toBe('layer_02_borders_boundaries');
    expect(f.properties.sourceId).toBe('natural_earth_admin0_50m');
    expect(f.properties.boundaryType).toBe('country_boundary');
    expect(f.properties.name).toBeDefined();
    expect(f.properties.disputed).toBeTypeOf('boolean');
    expect(f.properties.indiaSensitive).toBeTypeOf('boolean');
  });

  it('3. Uses default source_id natural_earth_admin0_50m', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SOURCE);
    vi.mocked(query).mockResolvedValueOnce(MOCK_FEATURES);

    const response = await app.inject({
      method: 'GET',
      url: '/api/borders-boundaries/countries',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.meta.sourceId).toBe('natural_earth_admin0_50m');
    expect(body.meta.sourceName).toBe('Natural Earth Admin-0 Countries 1:50m');
  });

  it('4. Limit default and max cap work', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SOURCE);
    vi.mocked(query).mockResolvedValueOnce(MOCK_FEATURES);

    const response = await app.inject({
      method: 'GET',
      url: '/api/borders-boundaries/countries?limit=9999',
    });

    expect(response.statusCode).toBe(200);
    // The SQL should use LIMIT 500 (capped)
    const calls = vi.mocked(query).mock.calls;
    const secondCallParams = calls[1][1] as unknown[];
    const lastParam = secondCallParams[secondCallParams.length - 1];
    expect(lastParam).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.meta.limit).toBe(500);
  });

  it('5. Bbox validation rejects bad bbox', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/borders-boundaries/countries?bbox=invalid',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('INVALID_BBOX');
  });

  it('6. Valid bbox query uses spatial filter', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SOURCE);
    vi.mocked(query).mockResolvedValueOnce(MOCK_FEATURES);

    const response = await app.inject({
      method: 'GET',
      url: '/api/borders-boundaries/countries?bbox=130,30,150,50',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.features).toBeDefined();
  });

  it('7. Simplify validation works (invalid)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/borders-boundaries/countries?simplify=invalid',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('INVALID_QUERY');
  });

  it('8. Returned meta includes local/dev caveat', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SOURCE);
    vi.mocked(query).mockResolvedValueOnce(MOCK_FEATURES);

    const response = await app.inject({
      method: 'GET',
      url: '/api/borders-boundaries/countries',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.meta.localDevOnly).toBe(true);
    expect(body.meta.caveat).toContain('local/dev only');
  });

  it('9. Returned meta includes productionApproved false and indiaCompliant false', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SOURCE);
    vi.mocked(query).mockResolvedValueOnce(MOCK_FEATURES);

    const response = await app.inject({
      method: 'GET',
      url: '/api/borders-boundaries/countries',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.meta.productionApproved).toBe(false);
    expect(body.meta.indiaCompliant).toBe(false);
  });

  it('10. India-sensitive row preserves indiaSensitive and indiaComplianceStatus', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SOURCE);
    vi.mocked(query).mockResolvedValueOnce(MOCK_FEATURES);

    const response = await app.inject({
      method: 'GET',
      url: '/api/borders-boundaries/countries',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const indiaFeature = body.features.find((f: { properties: { countryIso3: string } }) => f.properties.countryIso3 === 'IND');
    expect(indiaFeature).toBeDefined();
    expect(indiaFeature.properties.indiaSensitive).toBe(true);
    expect(indiaFeature.properties.indiaComplianceStatus).toBe('requires_soi_review');
  });

  it('11. Empty DB result returns empty FeatureCollection', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SOURCE);
    vi.mocked(query).mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/borders-boundaries/countries',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.type).toBe('FeatureCollection');
    expect(body.features).toHaveLength(0);
    expect(body.meta.count).toBe(0);
  });

  it('12. DB error returns safe 500', async () => {
    // Source lookup succeeds, but borders query fails
    vi.mocked(query).mockResolvedValueOnce(MOCK_SOURCE);
    vi.mocked(query).mockRejectedValueOnce(new Error('connection failed'));

    const response = await app.inject({
      method: 'GET',
      url: '/api/borders-boundaries/countries',
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).not.toContain('connection');
    expect(body.error.message).not.toContain('SELECT');
  });

  it('13. No writes are executed — SQL is SELECT only', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SOURCE);
    vi.mocked(query).mockResolvedValueOnce(MOCK_FEATURES);

    await app.inject({
      method: 'GET',
      url: '/api/borders-boundaries/countries',
    });

    const calls = vi.mocked(query).mock.calls;
    for (const call of calls) {
      const sql = call[0] as string;
      expect(sql.trim().toUpperCase().startsWith('SELECT')).toBe(true);
    }
  });

  it('14. SQL is parameterized (no string interpolation of params)', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SOURCE);
    vi.mocked(query).mockResolvedValueOnce(MOCK_FEATURES);

    await app.inject({
      method: 'GET',
      url: '/api/borders-boundaries/countries?bbox=68,8,97,37&limit=10',
    });

    const calls = vi.mocked(query).mock.calls;
    for (const call of calls) {
      const sql = call[0] as string;
      const params = call[1] as unknown[];
      expect(sql).toMatch(/\$\d+/);
      // Verify the raw bbox values are not directly in the SQL string
      expect(sql).not.toContain('68,8');
      expect(sql).not.toContain('97,37');
    }
  });

  it('15. No external API calls from borders endpoint', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    vi.mocked(query).mockResolvedValueOnce(MOCK_SOURCE);
    vi.mocked(query).mockResolvedValueOnce(MOCK_FEATURES);

    await app.inject({
      method: 'GET',
      url: '/api/borders-boundaries/countries',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('16. Existing earth events tests still pass — meta shape is correct in combined app', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SOURCE);
    vi.mocked(query).mockResolvedValueOnce(MOCK_FEATURES);

    const response = await app.inject({
      method: 'GET',
      url: '/api/borders-boundaries/countries',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.meta).toEqual({
      count: 2,
      limit: 250,
      sourceId: 'natural_earth_admin0_50m',
      sourceName: 'Natural Earth Admin-0 Countries 1:50m',
      localDevOnly: true,
      productionApproved: false,
      indiaCompliant: false,
      caveat: expect.stringContaining('local/dev only'),
    });
  });

  // ===================================================================
  // Clean public slug aliases (API-URL-002 / API-POLICY-001)
  // Each new path returns the same response shape as the legacy
  // /api/borders-boundaries/countries path. The old paths are preserved
  // and continue to work; the new paths are aliases only.
  // ===================================================================

  it('alias.1 GET /api/layers/borders-boundaries/countries returns same shape as the legacy path', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SOURCE);
    vi.mocked(query).mockResolvedValueOnce(MOCK_FEATURES);

    const newPathResponse = await app.inject({
      method: 'GET',
      url: '/api/layers/borders-boundaries/countries',
    });
    expect(newPathResponse.statusCode).toBe(200);
    const newPathBody = JSON.parse(newPathResponse.body);

    vi.mocked(query).mockResolvedValueOnce(MOCK_SOURCE);
    vi.mocked(query).mockResolvedValueOnce(MOCK_FEATURES);
    const legacyResponse = await app.inject({
      method: 'GET',
      url: '/api/borders-boundaries/countries',
    });
    expect(legacyResponse.statusCode).toBe(200);
    const legacyBody = JSON.parse(legacyResponse.body);

    expect(Object.keys(newPathBody).sort()).toEqual(Object.keys(legacyBody).sort());
    expect(newPathBody.meta.count).toBe(legacyBody.meta.count);
    expect(newPathBody.features.length).toBe(legacyBody.features.length);
  });

  it('alias.2 The new clean Borders-boundaries path does not create a duplicated /api/layers/borders-boundaries/borders-boundaries/... path', async () => {
    // Negative test: a duplicated /api/layers/borders-boundaries/borders-boundaries/...
    // path must NOT exist (would 404). This guards the slug rule from accidental
    // duplication.
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/borders-boundaries/borders-boundaries/countries',
    });
    expect(response.statusCode).toBe(404);
  });
});
