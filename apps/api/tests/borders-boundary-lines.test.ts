import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { bordersBoundaryLinesRoutes } from '../src/routes/borders-boundary-lines.js';
import { query } from '../src/lib/db.js';

const MOCK_ROWS = [
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    geometry: { type: 'LineString', coordinates: [[10, 20], [11, 21]] },
    properties: { name: 'Test Border 1' },
  },
  {
    id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    geometry: { type: 'MultiLineString', coordinates: [[[30, 40], [31, 41]]] },
    properties: { name: 'Test Border 2' },
  },
];

describe('Borders Boundary Lines API', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(bordersBoundaryLinesRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. GET /api/borders-boundaries/lines returns FeatureCollection', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_ROWS);

    const response = await app.inject({ method: 'GET', url: '/api/borders-boundaries/lines' });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.type).toBe('FeatureCollection');
    expect(body.features).toHaveLength(2);
    expect(body.features[0].type).toBe('Feature');
    expect(body.features[0].geometry.type).toBe('LineString');
    expect(body.meta).toBeDefined();
    expect(body.meta.count).toBe(2);
  });

  it('2. GET /api/borders-boundaries/lines returns 400 for invalid bbox', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/borders-boundaries/lines?bbox=invalid' });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_BBOX');
  });

  it('3. GET /api/borders-boundaries/lines returns 400 for invalid simplify', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/borders-boundaries/lines?simplify=-1' });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_QUERY');
  });

  it('4. GET /api/borders-boundaries/lines caps limit at 500', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_ROWS);

    await app.inject({ method: 'GET', url: '/api/borders-boundaries/lines?limit=9999' });
    const callArgs = vi.mocked(query).mock.calls[0];
    const params = callArgs[1] as unknown[];
    const lastParam = params[params.length - 1];
    expect(lastParam).toBe(500);
  });

  it('5. GET /api/borders-boundaries/lines meta caveat is present', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_ROWS);

    const response = await app.inject({ method: 'GET', url: '/api/borders-boundaries/lines' });
    const body = JSON.parse(response.body);
    expect(body.meta.caveat).toContain('MVP/local/dev only');
    expect(body.meta.caveat).toContain('not production-approved');
    expect(body.meta.caveat).toContain('not India-compliant');
  });

  it('6. GET /api/borders-boundaries/lines meta productionApproved is false', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_ROWS);

    const response = await app.inject({ method: 'GET', url: '/api/borders-boundaries/lines' });
    const body = JSON.parse(response.body);
    expect(body.meta.productionApproved).toBe(false);
  });

  it('7. GET /api/borders-boundaries/lines meta indiaCompliant is false', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_ROWS);

    const response = await app.inject({ method: 'GET', url: '/api/borders-boundaries/lines' });
    const body = JSON.parse(response.body);
    expect(body.meta.indiaCompliant).toBe(false);
  });

  it('8. GET /api/borders-boundaries/lines returns safe 500 on DB error', async () => {
    vi.mocked(query).mockRejectedValueOnce(new Error('connection refused'));

    const response = await app.inject({ method: 'GET', url: '/api/borders-boundaries/lines' });
    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).not.toContain('SELECT');
    expect(body.error.message).not.toContain('connection');
  });
});
