import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { aviationAircraftRoutes } from '../src/routes/aviation-aircraft.js';
import { query } from '../src/lib/db.js';

const MOCK_AIRCRAFT = [
  {
    sourceId: 'airplanes_live_v2',
    sourceObjectId: 'abc123',
    callsign: 'UAL123',
    registration: 'N12345',
    aircraftType: 'B738',
    dbFlags: 0,
    isMilitary: false,
    isInteresting: false,
    isPia: false,
    isLadd: false,
    sourceMessageType: 'ads-b',
    lat: 35.7,
    lon: 139.7,
    altitudeBaroFt: 35000,
    altitudeGeomFt: 35200,
    onGround: false,
    groundSpeedKt: 450,
    trackDeg: 270,
    headingMagDeg: 268,
    headingTrueDeg: 269,
    verticalRateFpm: 0,
    geomRateFpm: 0,
    squawk: '1200',
    emergency: null,
    seenSeconds: 2,
    seenPosSeconds: 2,
    observedAt: '2026-05-29T10:00:00.000Z',
    receivedAt: '2026-05-29T10:00:10.000Z',
    staleAfter: '2026-05-29T10:01:30.000Z',
    firstSeenAt: '2026-05-29T09:30:00.000Z',
    lastSeenAt: '2026-05-29T10:00:10.000Z',
  },
  {
    sourceId: 'airplanes_live_v2',
    sourceObjectId: 'def456',
    callsign: 'JAL888',
    registration: 'JA8888',
    aircraftType: 'A359',
    dbFlags: 4,
    isMilitary: false,
    isInteresting: false,
    isPia: true,
    isLadd: false,
    sourceMessageType: 'ads-b',
    lat: 35.5,
    lon: 139.5,
    altitudeBaroFt: 37000,
    altitudeGeomFt: 37100,
    onGround: false,
    groundSpeedKt: 480,
    trackDeg: 90,
    headingMagDeg: 92,
    headingTrueDeg: 93,
    verticalRateFpm: 100,
    geomRateFpm: 95,
    squawk: '6500',
    emergency: null,
    seenSeconds: 5,
    seenPosSeconds: 5,
    observedAt: '2026-05-29T09:55:00.000Z',
    receivedAt: '2026-05-29T09:55:10.000Z',
    staleAfter: '2026-05-29T09:56:30.000Z',
    firstSeenAt: '2026-05-29T09:00:00.000Z',
    lastSeenAt: '2026-05-29T09:55:10.000Z',
  },
];

const STALE_AIRCRAFT = [
  {
    sourceId: 'airplanes_live_v2',
    sourceObjectId: 'stale001',
    callsign: 'STL001',
    registration: 'NSTALE',
    aircraftType: 'C172',
    dbFlags: 0,
    isMilitary: false,
    isInteresting: false,
    isPia: false,
    isLadd: false,
    sourceMessageType: 'ads-b',
    lat: 36.0,
    lon: 140.0,
    altitudeBaroFt: 5000,
    altitudeGeomFt: 5100,
    onGround: false,
    groundSpeedKt: 120,
    trackDeg: 180,
    headingMagDeg: 178,
    headingTrueDeg: 179,
    verticalRateFpm: -500,
    geomRateFpm: -480,
    squawk: '7000',
    emergency: null,
    seenSeconds: 300,
    seenPosSeconds: 300,
    observedAt: '2026-05-29T08:00:00.000Z',
    receivedAt: '2026-05-29T08:00:10.000Z',
    staleAfter: '2026-05-29T08:01:30.000Z',
    firstSeenAt: '2026-05-29T07:30:00.000Z',
    lastSeenAt: '2026-05-29T08:00:10.000Z',
  },
];

const MOCK_DETAIL_AIRCRAFT = {
  ...MOCK_AIRCRAFT[0],
  rawJson: { hex: 'abc123', flight: 'UAL123' },
};

describe('Aviation Live Aircraft API', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(aviationAircraftRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. GET /api/aviation/aircraft/latest returns aircraft', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_AIRCRAFT);

    const response = await app.inject({
      method: 'GET',
      url: '/api/aviation/aircraft/latest',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.aircraft).toBeDefined();
    expect(body.metadata).toBeDefined();
    expect(body.metadata.count).toBe(2);
    expect(body.metadata.generatedAt).toBeDefined();

    const ac = body.aircraft[0];
    expect(ac.sourceId).toBe('airplanes_live_v2');
    expect(ac.sourceObjectId).toBe('abc123');
    expect(ac.callsign).toBe('UAL123');
    expect(ac.registration).toBe('N12345');
    expect(ac.aircraftType).toBe('B738');
    expect(ac.dbFlags).toBe(0);
    expect(ac.isMilitary).toBe(false);
    expect(ac.isInteresting).toBe(false);
    expect(ac.isPia).toBe(false);
    expect(ac.isLadd).toBe(false);
    expect(ac.sourceMessageType).toBe('ads-b');
    expect(ac.lat).toBe(35.7);
    expect(ac.lon).toBe(139.7);
    expect(ac.altitudeBaroFt).toBe(35000);
    expect(ac.altitudeGeomFt).toBe(35200);
    expect(ac.onGround).toBe(false);
    expect(ac.groundSpeedKt).toBe(450);
    expect(ac.trackDeg).toBe(270);
    expect(ac.headingMagDeg).toBe(268);
    expect(ac.headingTrueDeg).toBe(269);
    expect(ac.verticalRateFpm).toBe(0);
    expect(ac.geomRateFpm).toBe(0);
    expect(ac.squawk).toBe('1200');
    expect(ac.emergency).toBeNull();
    expect(ac.seenSeconds).toBe(2);
    expect(ac.seenPosSeconds).toBe(2);
    expect(ac.observedAt).toBeTypeOf('string');
    expect(ac.receivedAt).toBeTypeOf('string');
    expect(ac.staleAfter).toBeTypeOf('string');
    expect(ac.firstSeenAt).toBeTypeOf('string');
    expect(ac.lastSeenAt).toBeTypeOf('string');

    expect(ac).not.toHaveProperty('rawJson');
  });

  it('2. GET /api/aviation/aircraft/latest excludes stale by default', async () => {
    // SQL should include stale_after > $1::timestamptz
    vi.mocked(query).mockResolvedValueOnce(MOCK_AIRCRAFT);

    const response = await app.inject({
      method: 'GET',
      url: '/api/aviation/aircraft/latest',
    });

    expect(response.statusCode).toBe(200);

    // Verify SQL includes stale_after filter
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('stale_after');
  });

  it('3. includeStale=true returns stale aircraft', async () => {
    vi.mocked(query).mockResolvedValueOnce(STALE_AIRCRAFT);

    const response = await app.inject({
      method: 'GET',
      url: '/api/aviation/aircraft/latest?includeStale=true',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.aircraft).toHaveLength(1);

    // Verify no stale_after WHERE condition in SQL (column alias still present)
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).not.toContain('WHERE');
  });

  it('4. limit is capped at MAX_LIMIT (5000)', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_AIRCRAFT);

    const response = await app.inject({
      method: 'GET',
      url: '/api/aviation/aircraft/latest?limit=9999',
    });

    expect(response.statusCode).toBe(200);

    const callArgs = vi.mocked(query).mock.calls[0];
    const params = callArgs[1] as unknown[];
    const lastParam = params[params.length - 1];
    expect(lastParam).toBe(5000);
  });

  it('5. bbox validates format', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_AIRCRAFT);

    const response = await app.inject({
      method: 'GET',
      url: '/api/aviation/aircraft/latest?bbox=130,30,150,50',
    });

    expect(response.statusCode).toBe(200);
  });

  it('6. bad bbox returns 400', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/aviation/aircraft/latest?bbox=invalid',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('INVALID_BBOX');
  });

  it('7. bad bbox with reversed lon returns 400', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/aviation/aircraft/latest?bbox=150,30,130,50',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('INVALID_BBOX');
  });

  it('8. bbox filter uses lat/lon bounds in SQL', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_AIRCRAFT);

    const response = await app.inject({
      method: 'GET',
      url: '/api/aviation/aircraft/latest?bbox=130,30,150,50',
    });

    expect(response.statusCode).toBe(200);

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    const params = callArgs[1] as unknown[];

    expect(sql).toContain('lon >=');
    expect(sql).toContain('lat >=');
    expect(sql).toContain('lon <=');
    expect(sql).toContain('lat <=');

    expect(params).toContain(130);
    expect(params).toContain(30);
    expect(params).toContain(150);
    expect(params).toContain(50);
  });

  it('9. detail endpoint returns one aircraft', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_DETAIL_AIRCRAFT]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/aviation/aircraft/abc123',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.aircraft).toBeDefined();
    expect(body.aircraft.sourceObjectId).toBe('abc123');
    expect(body.aircraft.callsign).toBe('UAL123');
    expect(body.aircraft.rawJson).toBeDefined();
    expect(body.aircraft.rawJson.hex).toBe('abc123');
  });

  it('10. detail endpoint returns 404 for missing aircraft', async () => {
    vi.mocked(query).mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/aviation/aircraft/nonexistent',
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('OBJECT_NOT_FOUND');
  });

  it('11. no raw_json exposed in list response', async () => {
    const rowsWithRaw = MOCK_AIRCRAFT.map((ac) => ({ ...ac, rawJson: { hex: 'test' } }));
    vi.mocked(query).mockResolvedValueOnce(rowsWithRaw);

    const response = await app.inject({
      method: 'GET',
      url: '/api/aviation/aircraft/latest',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.aircraft).toHaveLength(2);
    for (const ac of body.aircraft) {
      expect(ac).not.toHaveProperty('rawJson');
    }
  });

  it('12. SQL is parameterized (no string interpolation)', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_AIRCRAFT);

    await app.inject({
      method: 'GET',
      url: '/api/aviation/aircraft/latest',
    });

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    const params = callArgs[1] as unknown[];

    expect(sql).toContain('$1');
    expect(sql).toContain('$2');
    expect(params).toBeDefined();
    expect(params.length).toBeGreaterThanOrEqual(1);
  });

  it('13. detail endpoint SQL uses parameterized query', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_DETAIL_AIRCRAFT]);

    await app.inject({
      method: 'GET',
      url: '/api/aviation/aircraft/abc123',
    });

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    const params = callArgs[1] as unknown[];

    expect(sql).toContain('$1');
    expect(sql).toContain('$2');
    expect(params).toEqual(['airplanes_live_v2', 'abc123']);
  });

  it('14. no external API calls from aviation aircraft endpoint', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    vi.mocked(query).mockResolvedValueOnce(MOCK_AIRCRAFT);

    await app.inject({
      method: 'GET',
      url: '/api/aviation/aircraft/latest',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('15. limit must be numeric integer', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/aviation/aircraft/latest?limit=abc',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_LIMIT');
  });

  it('16. bad bbox with out of range lat returns 400', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/aviation/aircraft/latest?bbox=130,-100,150,50',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_BBOX');
  });

  it('17. bad bbox with out of range lon returns 400', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/aviation/aircraft/latest?bbox=-200,30,150,50',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_BBOX');
  });

  it('18. includeStale=false behaves same as default', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_AIRCRAFT);

    await app.inject({
      method: 'GET',
      url: '/api/aviation/aircraft/latest?includeStale=false',
    });

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('stale_after');
  });

  it('19. includeStale=0 behaves same as default', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_AIRCRAFT);

    await app.inject({
      method: 'GET',
      url: '/api/aviation/aircraft/latest?includeStale=0',
    });

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('stale_after');
  });
});
