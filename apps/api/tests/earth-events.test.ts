import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { earthEventsRoutes } from '../src/routes/earth-events.js';
import { query } from '../src/lib/db.js';

const MOCK_EVENTS = [
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    layerId: 'layer_03_earth_events',
    sourceId: 'usgs_earthquake',
    sourceObjectId: 'usgs_12345',
    eventType: 'earthquake',
    magnitude: '5.2',
    magnitudeType: 'mb',
    depthKm: '10.5',
    place: '10 km NE of Tokyo',
    alertLevel: 'yellow',
    significance: 500,
    tsunami: false,
    geometry: { type: 'Point', coordinates: [139.7, 35.7] },
    sourceUrl: 'https://earthquake.usgs.gov/earthquakes/eventpage/usgs_12345',
    observedAt: '2026-05-25T12:00:00.000Z',
    updatedAt: '2026-05-25T12:05:00.000Z',
    fetchedAt: '2026-05-25T12:06:00.000Z',
  },
  {
    id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    layerId: 'layer_03_earth_events',
    sourceId: 'usgs_earthquake',
    sourceObjectId: 'usgs_67890',
    eventType: 'earthquake',
    magnitude: '3.1',
    magnitudeType: 'ml',
    depthKm: '5.0',
    place: 'Near Hachinohe, Japan',
    alertLevel: null,
    significance: 120,
    tsunami: false,
    geometry: { type: 'Point', coordinates: [141.5, 40.5] },
    sourceUrl: 'https://earthquake.usgs.gov/earthquakes/eventpage/usgs_67890',
    observedAt: '2026-05-25T10:00:00.000Z',
    updatedAt: '2026-05-25T10:03:00.000Z',
    fetchedAt: '2026-05-25T10:05:00.000Z',
  },
];

describe('Earth Events API', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(earthEventsRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. GET /api/earth-events/latest should return successful response', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_EVENTS);

    const response = await app.inject({
      method: 'GET',
      url: '/api/earth-events/latest',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.events).toBeDefined();
    expect(body.metadata).toBeDefined();
    expect(body.metadata.count).toBe(2);
    expect(body.metadata.generatedAt).toBeDefined();

    const event = body.events[0];
    expect(event.id).toBe(MOCK_EVENTS[0].id);
    expect(event.layerId).toBe('layer_03_earth_events');
    expect(event.sourceId).toBe('usgs_earthquake');
    expect(event.eventType).toBe('earthquake');
    expect(event.magnitude).toBe(5.2);
    expect(event.magnitudeType).toBe('mb');
    expect(event.depthKm).toBe(10.5);
    expect(event.place).toBe('10 km NE of Tokyo');
    expect(event.alertLevel).toBe('yellow');
    expect(event.significance).toBe(500);
    expect(event.tsunami).toBe(false);
    expect(event.geometry).toEqual({ type: 'Point', coordinates: [139.7, 35.7] });
    expect(event.sourceUrl).toBe(MOCK_EVENTS[0].sourceUrl);
    expect(event.observedAt).toBeTypeOf('string');
    expect(event.updatedAt).toBeTypeOf('string');
    expect(event.fetchedAt).toBeTypeOf('string');
    expect(new Date(event.observedAt).toISOString()).toBe(event.observedAt);
    expect(new Date(event.updatedAt).toISOString()).toBe(event.updatedAt);
    expect(new Date(event.fetchedAt).toISOString()).toBe(event.fetchedAt);
  });

  it('2. GET /api/earth-events/latest handles Date objects from Postgres without Zod error', async () => {
    const dateRows = [
      {
        ...MOCK_EVENTS[0],
        observedAt: new Date('2026-05-25T12:00:00.000Z'),
        updatedAt: new Date('2026-05-25T12:05:00.000Z'),
        fetchedAt: new Date('2026-05-25T12:06:00.000Z'),
      },
      {
        ...MOCK_EVENTS[1],
        observedAt: new Date('2026-05-25T10:00:00.000Z'),
        updatedAt: new Date('2026-05-25T10:03:00.000Z'),
        fetchedAt: new Date('2026-05-25T10:05:00.000Z'),
      },
    ];
    vi.mocked(query).mockResolvedValueOnce(dateRows);

    const response = await app.inject({
      method: 'GET',
      url: '/api/earth-events/latest',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.events).toHaveLength(2);
    expect(body.events[0].observedAt).toBeTypeOf('string');
    expect(body.events[1].updatedAt).toBeTypeOf('string');
    expect(body.events[0].fetchedAt).toBeTypeOf('string');
    expect(body.events[0].observedAt).toBe('2026-05-25T12:00:00.000Z');
  });

  it('3. GET /api/earth-events/latest should filter by bbox', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_EVENTS);

    const response = await app.inject({
      method: 'GET',
      url: '/api/earth-events/latest?bbox=130,30,150,50',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.events).toBeDefined();
  });

  it('4. GET /api/earth-events/latest should use default limit', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_EVENTS);

    const response = await app.inject({
      method: 'GET',
      url: '/api/earth-events/latest',
    });

    expect(response.statusCode).toBe(200);
  });

  it('5. GET /api/earth-events/latest should cap maximum limit', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_EVENTS);

    const response = await app.inject({
      method: 'GET',
      url: '/api/earth-events/latest?limit=9999',
    });

    expect(response.statusCode).toBe(200);
    // The SQL should use LIMIT 200 (capped), not 9999
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    const params = callArgs[1] as unknown[];
    const lastParam = params[params.length - 1];
    expect(lastParam).toBe(200);
  });

  it('6. GET /api/earth-events/latest should filter by event_type', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_EVENTS);

    const response = await app.inject({
      method: 'GET',
      url: '/api/earth-events/latest?event_type=earthquake',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.events).toBeDefined();
  });

  it('7. GET /api/earth-events/latest should filter by since', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_EVENTS);

    const response = await app.inject({
      method: 'GET',
      url: '/api/earth-events/latest?since=2026-01-01T00:00:00Z',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.events).toBeDefined();
  });

  it('8. GET /api/earth-events/latest should return 400 for invalid bbox', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/earth-events/latest?bbox=invalid',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('INVALID_BBOX');
    expect(body.error.message).toBeDefined();
    expect(body.error.details).toBeDefined();
  });

  it('9. GET /api/earth-events/latest should return 400 for invalid since', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/earth-events/latest?since=not-a-date',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('INVALID_QUERY');
    expect(body.error.message).toContain('since');
    expect(body.error.details).toBeDefined();
  });

  it('10. GET /api/earth-events/latest should return safe internal error on DB failure', async () => {
    vi.mocked(query).mockRejectedValueOnce(new Error('connection refused'));

    const response = await app.inject({
      method: 'GET',
      url: '/api/earth-events/latest',
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    // No SQL details in error message
    expect(body.error.message).not.toContain('SELECT');
    expect(body.error.message).not.toContain('connection');
  });

  it('11. No external API calls from earth events endpoint', async () => {
    // Spy on global fetch to verify no external calls
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    vi.mocked(query).mockResolvedValueOnce(MOCK_EVENTS);

    await app.inject({
      method: 'GET',
      url: '/api/earth-events/latest',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  // ===================================================================
  // Clean public slug aliases (API-URL-002 / API-POLICY-001)
  // Each new path returns the same response shape as the legacy
  // /api/earth-events/latest path. The old paths are preserved
  // and continue to work; the new paths are aliases only.
  // ===================================================================

  it('alias.1 GET /api/layers/earth-events/latest returns same shape as the legacy path', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_EVENTS);

    const newPathResponse = await app.inject({
      method: 'GET',
      url: '/api/layers/earth-events/latest',
    });
    expect(newPathResponse.statusCode).toBe(200);
    const newPathBody = JSON.parse(newPathResponse.body);

    vi.mocked(query).mockResolvedValueOnce(MOCK_EVENTS);
    const legacyResponse = await app.inject({
      method: 'GET',
      url: '/api/earth-events/latest',
    });
    expect(legacyResponse.statusCode).toBe(200);
    const legacyBody = JSON.parse(legacyResponse.body);

    expect(Object.keys(newPathBody).sort()).toEqual(Object.keys(legacyBody).sort());
    expect(newPathBody.events.length).toBe(legacyBody.events.length);
    expect(newPathBody.metadata.count).toBe(legacyBody.metadata.count);
  });

  it('alias.2 The new clean Earth-events path does not create a duplicated /api/layers/earth-events/earth-events/... path', async () => {
    // Negative test: a duplicated /api/layers/earth-events/earth-events/...
    // path must NOT exist (would 404). This guards the slug rule from accidental
    // duplication.
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/earth-events/earth-events/latest',
    });
    expect(response.statusCode).toBe(404);
  });
});
