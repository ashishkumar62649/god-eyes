import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { maritimeRoutes } from '../src/routes/maritime.js';
import { query } from '../src/lib/db.js';

const NOW = new Date('2026-06-09T12:05:00.000Z');

const MOCK_VESSELS = [
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    layerId: 'layer_06_maritime',
    sourceId: 'aisstream',
    mmsi: 258674000,
    dedupeKey: 'aisstream:258674000',
    latitude: 57.65717,
    longitude: 11.88733,
    speedOverGround: 12.1,
    courseOverGround: 173.4,
    trueHeading: 172,
    navigationStatus: 0,
    navigationStatusText: 'under_way_using_engine',
    positionAccuracy: null,
    receivedAt: new Date('2026-06-09T12:04:31.743Z'),
    vesselName: null,
    vesselType: null,
    vesselTypeCode: null,
    callsign: null,
    imo: null,
    destination: null,
    lengthMeters: null,
    widthMeters: null,
  },
  {
    id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    layerId: 'layer_06_maritime',
    sourceId: 'aisstream',
    mmsi: 276756000,
    dedupeKey: 'aisstream:276756000',
    latitude: 59.90433,
    longitude: 10.74133,
    speedOverGround: 0,
    courseOverGround: 360.0,
    trueHeading: null,
    navigationStatus: 1,
    navigationStatusText: 'at_anchor',
    positionAccuracy: null,
    receivedAt: new Date('2026-06-09T12:04:32.123Z'),
    vesselName: null,
    vesselType: null,
    vesselTypeCode: null,
    callsign: null,
    imo: null,
    destination: null,
    lengthMeters: null,
    widthMeters: null,
  },
  {
    id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    layerId: 'layer_06_maritime',
    sourceId: 'aisstream',
    mmsi: 215105000,
    dedupeKey: 'aisstream:215105000',
    latitude: 55.61267,
    longitude: 12.99533,
    speedOverGround: 8.9,
    courseOverGround: 38.3,
    trueHeading: 38,
    navigationStatus: 0,
    navigationStatusText: 'under_way_using_engine',
    positionAccuracy: null,
    receivedAt: new Date('2026-06-09T12:04:34.345Z'),
    vesselName: null,
    vesselType: null,
    vesselTypeCode: null,
    callsign: null,
    imo: null,
    destination: null,
    lengthMeters: null,
    widthMeters: null,
  },
];

const MOCK_VESSELS_WITH_NAMES = MOCK_VESSELS.map((v, i) => {
  if (i === 0) {
    return {
      ...v,
      vesselName: 'LANDRATH KUESTER',
      vesselType: 'tanker',
      vesselTypeCode: 80,
      callsign: null,
      imo: null,
      destination: 'ROTTERDAM',
      lengthMeters: 100,
      widthMeters: 30,
    };
  }
  if (i === 1) {
    return {
      ...v,
      vesselName: 'GEOSURVEYOR X',
      vesselType: 'cargo',
      vesselTypeCode: 70,
      callsign: 'C6CU7',
      imo: 9615897,
      destination: 'KIEL',
      lengthMeters: 130,
      widthMeters: 40,
    };
  }
  return v;
});

const MOCK_DETAIL = {
  ...MOCK_VESSELS_WITH_NAMES[0],
  rawEvidenceUri: 'raw/layer_06_maritime/aisstream/2026/06/09/run_20260609T120430Z/raw_messages.jsonl',
  draughtMeters: null,
  etaMonth: null,
  etaDay: null,
  etaHour: null,
  etaMinute: null,
  etaDisplay: null,
  lastPositionAt: new Date('2026-06-09T12:04:31.743Z'),
  lastReceivedAt: new Date('2026-06-09T12:04:31.743Z'),
};

const MOCK_STATS = [{
  totalVessels: 3,
  activeVessels: 3,
  staleVessels: 0,
  lastUpdated: new Date('2026-06-09T12:04:34.345Z'),
}];

const MOCK_VESSEL_TYPES = [
  { vesselType: 'tanker', count: 1 },
  { vesselType: 'cargo', count: 1 },
];

const MOCK_POSITIONS = [
  {
    latitude: 57.65717,
    longitude: 11.88733,
    speedOverGround: 12.1,
    courseOverGround: 173.4,
    trueHeading: 172,
    receivedAt: new Date('2026-06-09T12:04:31.743Z'),
  },
  {
    latitude: 57.65,
    longitude: 11.88,
    speedOverGround: 12.0,
    courseOverGround: 174.0,
    trueHeading: 173,
    receivedAt: new Date('2026-06-09T12:03:31.743Z'),
  },
];

const MOCK_VESSEL_NAME = [{ vesselName: 'LANDRATH KUESTER' }];

describe('Maritime API', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(maritimeRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 1. Route registration - objects endpoint exists
  it('1. GET /api/layers/layer_06_maritime/objects should return successful response', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_VESSELS);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_06_maritime/objects',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.objects).toBeDefined();
    expect(body.metadata).toBeDefined();
    expect(body.metadata.count).toBe(3);
    expect(body.metadata.limit).toBe(1000);
    expect(body.metadata.offset).toBe(0);
    expect(body.metadata.generatedAt).toBeDefined();

    const obj = body.objects[0];
    expect(obj.id).toBe(MOCK_VESSELS[0].id);
    expect(obj.layerId).toBe('layer_06_maritime');
    expect(obj.sourceId).toBe('aisstream');
    expect(obj.mmsi).toBe(258674000);
    expect(obj.dedupeKey).toBe('aisstream:258674000');
    expect(obj.latitude).toBe(57.65717);
    expect(obj.longitude).toBe(11.88733);
    expect(obj.speedOverGround).toBe(12.1);
    expect(obj.courseOverGround).toBe(173.4);
    expect(obj.trueHeading).toBe(172);
    expect(obj.navigationStatus).toBe(0);
    expect(obj.navigationStatusText).toBe('under_way_using_engine');
    expect(obj.receivedAt).toBeTypeOf('string');
    expect(obj.dataAgeSeconds).toBeTypeOf('number');
  });

  // 2. Objects endpoint with full vessel data (names joined)
  it('2. GET /api/layers/layer_06_maritime/objects returns vessel names when joined', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_VESSELS_WITH_NAMES);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_06_maritime/objects',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.objects).toHaveLength(3);

    const tanker = body.objects[0];
    expect(tanker.vesselName).toBe('LANDRATH KUESTER');
    expect(tanker.vesselType).toBe('tanker');
    expect(tanker.vesselTypeCode).toBe(80);
    expect(tanker.destination).toBe('ROTTERDAM');
    expect(tanker.lengthMeters).toBe(100);
    expect(tanker.widthMeters).toBe(30);

    const cargo = body.objects[1];
    expect(cargo.vesselName).toBe('GEOSURVEYOR X');
    expect(cargo.vesselType).toBe('cargo');
    expect(cargo.vesselTypeCode).toBe(70);
    expect(cargo.callsign).toBe('C6CU7');
    expect(cargo.imo).toBe(9615897);
    expect(cargo.destination).toBe('KIEL');
    expect(cargo.lengthMeters).toBe(130);
    expect(cargo.widthMeters).toBe(40);
  });

  // 3. Bbox filter
  it('3. GET /api/layers/layer_06_maritime/objects should filter by bbox', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_VESSELS);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_06_maritime/objects?bbox=10,55,14,60',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.objects).toBeDefined();

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('ST_MakeEnvelope');
    expect(sql).toContain('geom &&');
  });

  // 4. vessel_type filter
  it('4. GET /api/layers/layer_06_maritime/objects should filter by vessel_type', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_VESSELS);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_06_maritime/objects?vessel_type=tanker',
    });

    expect(response.statusCode).toBe(200);

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('v.vessel_type =');
  });

  // 5. Speed filters
  it('5. GET /api/layers/layer_06_maritime/objects should filter by min_speed and max_speed', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_VESSELS);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_06_maritime/objects?min_speed=5&max_speed=15',
    });

    expect(response.statusCode).toBe(200);

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('speed_over_ground >=');
    expect(sql).toContain('speed_over_ground <=');
  });

  // 6. updated_since filter
  it('6. GET /api/layers/layer_06_maritime/objects should filter by updated_since', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_VESSELS);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_06_maritime/objects?updated_since=2026-06-09T12:00:00Z',
    });

    expect(response.statusCode).toBe(200);

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('received_at >=');
  });

  // 7. mmsi filter
  it('7. GET /api/layers/layer_06_maritime/objects should filter by mmsi', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_VESSELS[0]]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_06_maritime/objects?mmsi=258674000',
    });

    expect(response.statusCode).toBe(200);

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    const params = callArgs[1] as unknown[];
    expect(sql).toContain('p.mmsi =');
    expect(params).toContain(258674000);
  });

  // 8. search filter
  it('8. GET /api/layers/layer_06_maritime/objects should filter by search', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_VESSELS);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_06_maritime/objects?search=LANDRATH',
    });

    expect(response.statusCode).toBe(200);

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('ILIKE');
    expect(sql).toContain('vessel_name');
    expect(sql).toContain('callsign');
    expect(sql).toContain('mmsi::text');
  });

  // 9. limit/offset
  it('9. GET /api/layers/layer_06_maritime/objects should use limit and offset', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_VESSELS.slice(0, 1));

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_06_maritime/objects?limit=1&offset=2',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.metadata.limit).toBe(1);
    expect(body.metadata.offset).toBe(2);

    const callArgs = vi.mocked(query).mock.calls[0];
    const params = callArgs[1] as unknown[];
    const lastTwo = params.slice(-2);
    expect(lastTwo).toEqual([1, 2]);
  });

  // 10. Invalid bbox rejection
  it('10. GET /api/layers/layer_06_maritime/objects should reject invalid bbox', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_06_maritime/objects?bbox=invalid',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('INVALID_BBOX');
  });

  // 11. Invalid limit rejection
  it('11. GET /api/layers/layer_06_maritime/objects should reject invalid limit', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_06_maritime/objects?limit=abc',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('INVALID_LIMIT');
  });

  // 12. Object detail by MMSI
  it('12. GET /api/layers/layer_06_maritime/objects/:objectId returns vessel detail', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_DETAIL]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_06_maritime/objects/258674000',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.vessel).toBeDefined();
    expect(body.vessel.mmsi).toBe(258674000);
    expect(body.vessel.vesselName).toBe('LANDRATH KUESTER');
    expect(body.vessel.vesselType).toBe('tanker');
    expect(body.vessel.rawEvidenceUri).toBeDefined();
    expect(body.vessel.lastPositionAt).toBeDefined();
    expect(body.vessel.lastReceivedAt).toBeDefined();
  });

  // 13. Object detail 404
  it('13. GET /api/layers/layer_06_maritime/objects/:objectId returns 404 for unknown MMSI', async () => {
    vi.mocked(query).mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_06_maritime/objects/999999999',
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('OBJECT_NOT_FOUND');
  });

  // 14. Object detail invalid MMSI
  it('14. GET /api/layers/layer_06_maritime/objects/:objectId rejects invalid MMSI', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_06_maritime/objects/abc',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_QUERY');
  });

  // 15. Stats endpoint
  it('15. GET /api/layers/layer_06_maritime/stats returns layer summary', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce(MOCK_STATS)
      .mockResolvedValueOnce(MOCK_VESSEL_TYPES);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_06_maritime/stats',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.layerId).toBe('layer_06_maritime');
    expect(body.totalVessels).toBe(3);
    expect(body.activeVessels).toBe(3);
    expect(body.staleVessels).toBe(0);
    expect(body.byVesselType).toBeDefined();
    expect(body.byVesselType.tanker).toBe(1);
    expect(body.byVesselType.cargo).toBe(1);
    expect(body.lastUpdated).toBeTypeOf('string');
    expect(body.dataFreshnessSeconds).toBeTypeOf('number');
    expect(body.sourceId).toBe('aisstream');
    expect(body.generatedAt).toBeTypeOf('string');
  });

  // 16. Positions history endpoint
  it('16. GET /api/layers/layer_06_maritime/vessels/:mmsi/positions returns position history', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce(MOCK_VESSEL_NAME)
      .mockResolvedValueOnce(MOCK_POSITIONS);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_06_maritime/vessels/258674000/positions',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.mmsi).toBe(258674000);
    expect(body.vesselName).toBe('LANDRATH KUESTER');
    expect(body.positions).toHaveLength(2);
    expect(body.count).toBe(2);
    expect(body.layerId).toBe('layer_06_maritime');

    const pos = body.positions[0];
    expect(pos.latitude).toBe(57.65717);
    expect(pos.longitude).toBe(11.88733);
    expect(pos.speedOverGround).toBe(12.1);
    expect(pos.courseOverGround).toBe(173.4);
    expect(pos.trueHeading).toBe(172);
    expect(pos.receivedAt).toBeTypeOf('string');
  });

  // 17. Positions history hours param
  it('17. GET /api/layers/layer_06_maritime/vessels/:mmsi/positions accepts hours param', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce(MOCK_VESSEL_NAME)
      .mockResolvedValueOnce(MOCK_POSITIONS);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_06_maritime/vessels/258674000/positions?hours=12&limit=100',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.positions).toHaveLength(2);

    const callArgs = vi.mocked(query).mock.calls[1];
    const params = callArgs[1] as unknown[];
    expect(params).toContain(258674000);
    expect(params).toContain(12);
    expect(params).toContain(100);
  });

  // 18. Positions history no vessel name
  it('18. GET /api/layers/layer_06_maritime/vessels/:mmsi/positions returns null vesselName when unknown', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_06_maritime/vessels/999999999/positions',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.mmsi).toBe(999999999);
    expect(body.vesselName).toBeNull();
    expect(body.positions).toEqual([]);
    expect(body.count).toBe(0);
  });

  // 19. Positions history invalid MMSI
  it('19. GET /api/layers/layer_06_maritime/vessels/:mmsi/positions rejects invalid MMSI', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_06_maritime/vessels/abc/positions',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_QUERY');
  });

  // 20. Positions history invalid hours
  it('20. GET /api/layers/layer_06_maritime/vessels/:mmsi/positions rejects invalid hours', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_06_maritime/vessels/258674000/positions?hours=999',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_QUERY');
  });

  // 21. Empty database behavior
  it('21. GET /api/layers/layer_06_maritime/objects handles empty database', async () => {
    vi.mocked(query).mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_06_maritime/objects',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.objects).toEqual([]);
    expect(body.metadata.count).toBe(0);
  });

  // 22. Stats empty database
  it('22. GET /api/layers/layer_06_maritime/stats handles empty database', async () => {
    const emptyStats = [{ totalVessels: 0, activeVessels: 0, staleVessels: 0, lastUpdated: null }];
    vi.mocked(query)
      .mockResolvedValueOnce(emptyStats)
      .mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_06_maritime/stats',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.totalVessels).toBe(0);
    expect(body.activeVessels).toBe(0);
    expect(body.staleVessels).toBe(0);
    expect(body.byVesselType).toEqual({});
    expect(body.lastUpdated).toBeNull();
    expect(body.dataFreshnessSeconds).toBeNull();
  });

  // 23. No external network calls
  it('23. No external API calls from maritime endpoints', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    vi.mocked(query).mockResolvedValueOnce(MOCK_VESSELS);

    await app.inject({
      method: 'GET',
      url: '/api/layers/layer_06_maritime/objects',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  // 24. No frontend imports
  it('24. No frontend imports in maritime route (only db + contracts)', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/routes/maritime.ts', 'utf-8');
    expect(source).not.toContain('frontend');
    expect(source).not.toContain('components');
    expect(source).not.toContain('React');
    expect(source).not.toContain('jsx');
  });

  // 25. SQL is parameterized
  it('25. SQL is parameterized (no string interpolation)', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_VESSELS);

    await app.inject({
      method: 'GET',
      url: '/api/layers/layer_06_maritime/objects',
    });

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    const params = callArgs[1] as unknown[];

    expect(sql).toContain('$1');
    expect(params).toBeDefined();
    expect(params.length).toBeGreaterThanOrEqual(1);
  });

  // 26. No secrets exposed
  it('26. No secrets exposed in responses', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_VESSELS);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_06_maritime/objects',
    });

    const bodyStr = JSON.stringify(response.body);
    expect(bodyStr).not.toContain('password');
    expect(bodyStr).not.toContain('secret');
    expect(bodyStr).not.toContain('api_key');
    expect(bodyStr).not.toContain('token');
  });

  // 27. Internal error on DB failure
  it('27. Returns safe internal error on DB failure', async () => {
    vi.mocked(query).mockRejectedValueOnce(new Error('connection refused'));

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_06_maritime/objects',
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).not.toContain('SELECT');
    expect(body.error.message).not.toContain('connection');
  });

  // 28. Invalid offset rejection
  it('28. GET /api/layers/layer_06_maritime/objects should reject invalid offset', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_06_maritime/objects?offset=-1',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_QUERY');
  });

  // 29. Limit is capped at maximum
  it('29. limit is capped at MAX_LIMIT', async () => {
    vi.mocked(query).mockResolvedValueOnce([]);

    await app.inject({
      method: 'GET',
      url: '/api/layers/layer_06_maritime/objects?limit=99999',
    });

    const callArgs = vi.mocked(query).mock.calls[0];
    const params = callArgs[1] as unknown[];
    expect(params).toContain(10000);
  });

  // 30. Offset is capped at maximum
  it('30. offset is capped at MAX_OFFSET', async () => {
    vi.mocked(query).mockResolvedValueOnce([]);

    await app.inject({
      method: 'GET',
      url: '/api/layers/layer_06_maritime/objects?offset=99999',
    });

    const callArgs = vi.mocked(query).mock.calls[0];
    const params = callArgs[1] as unknown[];
    expect(params).toContain(10000);
  });
});
