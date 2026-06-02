import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { energyInfrastructureRoutes } from '../src/routes/energy/infrastructure.js';
import { query } from '../src/lib/db.js';

const MOCK_FEATURES = [
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    layerId: 'layer_10_energy_infrastructure',
    sourceId: 'wri_global_power_plant_database',
    sourceObjectId: 'WRI1000001',
    featureType: 'power_plant',
    category: 'nuclear_power',
    name: 'Example Nuclear Plant',
    operator: 'Example Energy Corp',
    owner: 'Example Holdings',
    country: 'US',
    status: 'operational',
    fuelType: 'nuclear',
    capacityMw: '1200.0',
    voltageKv: null,
    pipelineProduct: null,
    pipelineLengthKm: null,
    terminalType: null,
    geometry: { type: 'Point', coordinates: [-87.6298, 41.8781] },
    centroidLat: '41.8781',
    centroidLon: '-87.6298',
    sourceConfidence: '0.9',
    sourceUpdatedAt: '2025-01-01T00:00:00.000Z',
    firstSeenAt: '2026-06-02T06:43:07.000Z',
    lastSeenAt: '2026-06-02T06:43:07.000Z',
  },
  {
    id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    layerId: 'layer_10_energy_infrastructure',
    sourceId: 'osm_energy_infrastructure',
    sourceObjectId: 'OSM2000001',
    featureType: 'substation',
    category: 'substation',
    name: 'Main Substation Alpha',
    operator: 'GridCo',
    owner: null,
    country: 'DE',
    status: 'operational',
    fuelType: null,
    capacityMw: null,
    voltageKv: '380.0',
    pipelineProduct: null,
    pipelineLengthKm: null,
    terminalType: null,
    geometry: { type: 'Point', coordinates: [13.4050, 52.5200] },
    centroidLat: '52.5200',
    centroidLon: '13.4050',
    sourceConfidence: '0.7',
    sourceUpdatedAt: '2026-05-01T00:00:00.000Z',
    firstSeenAt: '2026-06-02T06:43:07.000Z',
    lastSeenAt: '2026-06-02T06:43:07.000Z',
  },
  {
    id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    layerId: 'layer_10_energy_infrastructure',
    sourceId: 'global_energy_monitor_energy',
    sourceObjectId: 'GEM3000001',
    featureType: 'gas_pipeline',
    category: 'gas_pipeline',
    name: 'Nord Stream Pipeline',
    operator: 'Nord Stream AG',
    owner: 'Gazprom',
    country: 'RU',
    status: 'operational',
    fuelType: null,
    capacityMw: null,
    voltageKv: null,
    pipelineProduct: 'natural_gas',
    pipelineLengthKm: '1234.5',
    terminalType: null,
    geometry: { type: 'LineString', coordinates: [[30.0, 60.0], [28.0, 58.0], [25.0, 55.0]] },
    centroidLat: '57.5',
    centroidLon: '27.5',
    sourceConfidence: '0.8',
    sourceUpdatedAt: '2025-12-01T00:00:00.000Z',
    firstSeenAt: '2026-06-02T06:43:07.000Z',
    lastSeenAt: '2026-06-02T06:43:07.000Z',
  },
];

describe('Energy Infrastructure API', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(energyInfrastructureRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. GET /api/energy/infrastructure should return successful response with features', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([{ count: MOCK_FEATURES.length }])
      .mockResolvedValueOnce(MOCK_FEATURES)
      .mockResolvedValueOnce([
        { sourceId: 'wri_global_power_plant_database', featureCount: 1, lastUpdated: '2025-01-01T00:00:00.000Z' },
        { sourceId: 'osm_energy_infrastructure', featureCount: 1, lastUpdated: '2026-05-01T00:00:00.000Z' },
        { sourceId: 'global_energy_monitor_energy', featureCount: 1, lastUpdated: '2025-12-01T00:00:00.000Z' },
      ]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.features).toBeDefined();
    expect(body.features).toHaveLength(3);
    expect(body.metadata).toBeDefined();
    expect(body.metadata.layerId).toBe('layer_10_energy_infrastructure');
    expect(body.metadata.count).toBe(3);
    expect(body.metadata.returnedCount).toBe(3);
    expect(body.metadata.appliedLimit).toBe(1000);
    expect(body.metadata.maxLimit).toBe(10000);
    expect(body.metadata.estimated).toBe(false);
    expect(body.metadata.staticData).toBe(true);
    expect(body.metadata.generatedAt).toBeDefined();

    const f1 = body.features[0];
    expect(f1.id).toBe(MOCK_FEATURES[0].id);
    expect(f1.layerId).toBe('layer_10_energy_infrastructure');
    expect(f1.sourceId).toBe('wri_global_power_plant_database');
    expect(f1.featureType).toBe('power_plant');
    expect(f1.category).toBe('nuclear_power');
    expect(f1.name).toBe('Example Nuclear Plant');
    expect(f1.operator).toBe('Example Energy Corp');
    expect(f1.owner).toBe('Example Holdings');
    expect(f1.country).toBe('US');
    expect(f1.status).toBe('operational');
    expect(f1.fuelType).toBe('nuclear');
    expect(f1.capacityMw).toBe(1200.0);
    expect(f1.voltageKv).toBeNull();
    expect(f1.pipelineProduct).toBeNull();
    expect(f1.pipelineLengthKm).toBeNull();
    expect(f1.terminalType).toBeNull();
    expect(f1.geometry).toEqual({ type: 'Point', coordinates: [-87.6298, 41.8781] });
    expect(f1.centroidLat).toBe(41.8781);
    expect(f1.centroidLon).toBe(-87.6298);
    expect(f1.sourceConfidence).toBe(0.9);
    expect(f1.sourceUpdatedAt).toBe('2025-01-01T00:00:00.000Z');
    expect(f1.firstSeenAt).toBeTypeOf('string');
    expect(f1.lastSeenAt).toBeTypeOf('string');
  });

  it('2. GET /api/energy/infrastructure should return empty feature list when no data', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.features).toEqual([]);
    expect(body.metadata.count).toBe(0);
    expect(body.metadata.returnedCount).toBe(0);
  });

  it('3. GET /api/energy/infrastructure should use default limit', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure',
    });

    const callArgs = vi.mocked(query).mock.calls[1];
    const params = callArgs[1] as unknown[];
    const limitIndex = params.length - 2;
    expect(params[limitIndex]).toBe(1000);
  });

  it('4. GET /api/energy/infrastructure should cap maximum limit to 10000', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure?limit=99999',
    });

    const callArgs = vi.mocked(query).mock.calls[1];
    const params = callArgs[1] as unknown[];
    const limitIndex = params.length - 2;
    expect(params[limitIndex]).toBe(10000);
  });

  it('5. GET /api/energy/infrastructure should support offset pagination', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure?offset=50',
    });

    const callArgs = vi.mocked(query).mock.calls[1];
    const params = callArgs[1] as unknown[];
    const offsetValue = params[params.length - 1];
    expect(offsetValue).toBe(50);
  });

  it('6. GET /api/energy/infrastructure should filter by bbox', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([MOCK_FEATURES[0]])
      .mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure?bbox=-180,-90,180,90',
    });

    expect(response.statusCode).toBe(200);
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('ST_Intersects');
    expect(sql).toContain('ST_MakeEnvelope');
  });

  it('7. GET /api/energy/infrastructure should return 400 for invalid bbox', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure?bbox=invalid',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_BBOX');
  });

  it('8. GET /api/energy/infrastructure should return 400 for out-of-range bbox', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure?bbox=-200,-100,200,100',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_BBOX');
  });

  it('9. GET /api/energy/infrastructure should filter by sourceId', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([MOCK_FEATURES[0]])
      .mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure?sourceId=wri_global_power_plant_database',
    });

    expect(response.statusCode).toBe(200);
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('source_id = $1');
    expect(callArgs[1]).toContain('wri_global_power_plant_database');
  });

  it('10. GET /api/energy/infrastructure should filter by featureType', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([MOCK_FEATURES[1]])
      .mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure?featureType=substation',
    });

    expect(response.statusCode).toBe(200);
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('feature_type = $1');
  });

  it('11. GET /api/energy/infrastructure should filter by category', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([MOCK_FEATURES[0]])
      .mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure?category=nuclear_power',
    });

    expect(response.statusCode).toBe(200);
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('category = $1');
  });

  it('12. GET /api/energy/infrastructure should filter by country', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([MOCK_FEATURES[1]])
      .mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure?country=DE',
    });

    expect(response.statusCode).toBe(200);
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('country = $1');
  });

  it('13. GET /api/energy/infrastructure should filter by status', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([MOCK_FEATURES[0]])
      .mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure?status=operational',
    });

    expect(response.statusCode).toBe(200);
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('status = $1');
  });

  it('14. GET /api/energy/infrastructure should filter by fuelType', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([MOCK_FEATURES[0]])
      .mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure?fuelType=nuclear',
    });

    expect(response.statusCode).toBe(200);
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('fuel_type = $1');
  });

  it('15. GET /api/energy/infrastructure should filter by capacity range', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([MOCK_FEATURES[0]])
      .mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure?minCapacityMw=500&maxCapacityMw=2000',
    });

    expect(response.statusCode).toBe(200);
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('capacity_mw');
    expect(sql).toContain('>= $1');
    expect(sql).toContain('<= $2');
  });

  it('16. GET /api/energy/infrastructure should filter by voltage range', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([MOCK_FEATURES[1]])
      .mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure?minVoltageKv=100&maxVoltageKv=500',
    });

    expect(response.statusCode).toBe(200);
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('voltage_kv');
  });

  it('17. GET /api/energy/infrastructure should filter by pipelineProduct', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([MOCK_FEATURES[2]])
      .mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure?pipelineProduct=natural_gas',
    });

    expect(response.statusCode).toBe(200);
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('pipeline_product = $1');
  });

  it('18. GET /api/energy/infrastructure should filter by terminalType', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure?terminalType=import',
    });

    expect(response.statusCode).toBe(200);
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('terminal_type = $1');
  });

  it('19. GET /api/energy/infrastructure should include activeFilters metadata when filters applied', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([MOCK_FEATURES[0]])
      .mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure?country=US&featureType=power_plant&status=operational',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.metadata.activeFilters).toBeDefined();
    expect(body.metadata.activeFilters.country).toBe('US');
    expect(body.metadata.activeFilters.featureType).toBe('power_plant');
    expect(body.metadata.activeFilters.status).toBe('operational');
  });

  it('20. GET /api/energy/infrastructure should include sourceSummary in metadata', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([{ count: 3 }])
      .mockResolvedValueOnce(MOCK_FEATURES)
      .mockResolvedValueOnce([
        { sourceId: 'wri_global_power_plant_database', featureCount: 1, lastUpdated: '2025-01-01T00:00:00.000Z' },
      ]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.metadata.sourceSummary).toBeDefined();
    expect(body.metadata.sourceSummary.wri_global_power_plant_database).toBeDefined();
    expect(body.metadata.sourceSummary.wri_global_power_plant_database.featureCount).toBe(1);
  });

  it('21. GET /api/energy/infrastructure/:featureId should return a single feature', async () => {
    const detailRow = { ...MOCK_FEATURES[0], bbox: null, rawSourceJson: { source: 'wri' } };
    vi.mocked(query).mockResolvedValueOnce([detailRow]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/energy/infrastructure/${MOCK_FEATURES[0].id}`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.feature).toBeDefined();
    expect(body.feature.id).toBe(MOCK_FEATURES[0].id);
    expect(body.feature.featureType).toBe('power_plant');
    expect(body.feature.bbox).toBeNull();
    expect(body.feature.rawSourceJson).toEqual({ source: 'wri' });
  });

  it('22. GET /api/energy/infrastructure/:featureId should return 404 for missing feature', async () => {
    vi.mocked(query).mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure/00000000-0000-0000-0000-000000000000',
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('OBJECT_NOT_FOUND');
  });

  it('23. GET /api/energy/infrastructure/:featureId should return 400 for invalid UUID', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure/not-a-uuid',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_QUERY');
    expect(body.error.message).toContain('UUID');
  });

  it('24. GET /api/energy/infrastructure/categories should return category counts', async () => {
    vi.mocked(query).mockResolvedValueOnce([
      { featureType: 'power_plant', category: 'nuclear_power', count: 1, totalCapacityMw: '1200', totalPipelineLengthKm: null },
      { featureType: 'substation', category: 'substation', count: 1, totalCapacityMw: null, totalPipelineLengthKm: null },
      { featureType: 'gas_pipeline', category: 'gas_pipeline', count: 1, totalCapacityMw: null, totalPipelineLengthKm: '1234.5' },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure/categories',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.categories).toBeDefined();
    expect(body.categories).toHaveLength(3);
    expect(body.metadata.layerId).toBe('layer_10_energy_infrastructure');
    expect(body.metadata.generatedAt).toBeDefined();
    expect(body.categories[0].name).toBe('nuclear_power');
    expect(body.categories[0].count).toBe(1);
    expect(body.categories[0].totalCapacityMw).toBe(1200);
    expect(body.categories[2].totalPipelineLengthKm).toBe(1234.5);
  });

  it('25. GET /api/energy/infrastructure/categories should return empty array when table empty', async () => {
    vi.mocked(query).mockRejectedValueOnce(new Error('relation "energy_infrastructure" does not exist'));

    const response = await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure/categories',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.categories).toEqual([]);
  });

  it('26. GET /api/energy/infrastructure/sources should return source metadata', async () => {
    vi.mocked(query).mockResolvedValueOnce([
      { sourceId: 'wri_global_power_plant_database', featureCount: 100, lastUpdated: '2025-01-01T00:00:00.000Z' },
      { sourceId: 'osm_energy_infrastructure', featureCount: 50, lastUpdated: '2026-05-01T00:00:00.000Z' },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure/sources',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.sources).toBeDefined();
    expect(body.sources).toHaveLength(3);
    expect(body.metadata.layerId).toBe('layer_10_energy_infrastructure');

    const wriSource = body.sources.find((s: any) => s.sourceId === 'wri_global_power_plant_database');
    expect(wriSource).toBeDefined();
    expect(wriSource.name).toBe('WRI Global Power Plant Database');
    expect(wriSource.license).toBe('CC BY 4.0');
    expect(wriSource.attributionRequired).toBe(true);
    expect(wriSource.featureTypes).toContain('power_plant');
  });

  it('27. GET /api/energy/infrastructure/sources should return zero counts when DB not available', async () => {
    vi.mocked(query).mockRejectedValueOnce(new Error('connection refused'));

    const response = await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure/sources',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.sources).toHaveLength(3);
    expect(body.sources[0].featureCount).toBe(0);
  });

  it('28. SQL should use parameterized queries, not string interpolation', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([MOCK_FEATURES[0]])
      .mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: "/api/energy/infrastructure?country=US'; DROP TABLE energy_infrastructure; --",
    });

    expect(response.statusCode).toBe(200);
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('$1');
    expect(sql).not.toContain("DROP TABLE");

    const params = callArgs[1] as unknown[];
    expect(params[0]).toBe("US'; DROP TABLE energy_infrastructure; --");
  });

  it('29. Response should include safety/provenance metadata', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.metadata.staticData).toBe(true);
    expect(body.metadata.estimated).toBe(false);
    expect(body.metadata.generatedAt).toBeDefined();
    expect(body.metadata.layerId).toBe('layer_10_energy_infrastructure');
    expect(body.metadata.maxLimit).toBe(10000);
  });

  it('30. No WebSocket endpoint should exist for energy infrastructure', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/ws/energy/infrastructure',
    });

    // Fastify should return 404 for unregistered routes
    expect(response.statusCode).toBe(404);
  });

  it('31. GET /api/energy/infrastructure should handle Date objects from Postgres', async () => {
    const dateRows = [
      {
        ...MOCK_FEATURES[0],
        sourceUpdatedAt: new Date('2025-01-01T00:00:00.000Z'),
        firstSeenAt: new Date('2026-06-02T06:43:07.000Z'),
        lastSeenAt: new Date('2026-06-02T06:43:07.000Z'),
      },
    ];
    vi.mocked(query)
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce(dateRows)
      .mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.features).toHaveLength(1);
    expect(body.features[0].sourceUpdatedAt).toBeTypeOf('string');
    expect(body.features[0].firstSeenAt).toBeTypeOf('string');
    expect(body.features[0].lastSeenAt).toBe('2026-06-02T06:43:07.000Z');
  });

  it('32. GET /api/energy/infrastructure should return safe internal error on DB failure', async () => {
    vi.mocked(query).mockRejectedValueOnce(new Error('connection refused'));

    const response = await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure',
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).not.toContain('SELECT');
    expect(body.error.message).not.toContain('connection');
  });

  it('33. Route registration should work', async () => {
    expect(typeof energyInfrastructureRoutes).toBe('function');
  });

  it('34. Scope guard: No external API calls from energy endpoints', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    vi.mocked(query)
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('35. GET /api/energy/infrastructure should accept limit parameter', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure?limit=500',
    });

    expect(response.statusCode).toBe(200);
  });

  it('36. GET /api/energy/infrastructure should return 400 for invalid limit', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure?limit=-5',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_LIMIT');
  });

  it('37. GET /api/energy/infrastructure should handle offset', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure?offset=0',
    });

    expect(response.statusCode).toBe(200);
  });

  it('38. Combined multiple filters should produce correct parameterized SQL', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([MOCK_FEATURES[2]])
      .mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure?country=RU&sourceId=global_energy_monitor_energy&featureType=gas_pipeline&minCapacityMw=0&maxCapacityMw=5000',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.metadata.activeFilters).toBeDefined();
    expect(body.metadata.activeFilters.country).toBe('RU');
    expect(body.metadata.activeFilters.sourceId).toBe('global_energy_monitor_energy');
  });

  it('39. Response includes feature with fuelType null for non-power-plant features', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([MOCK_FEATURES[2]])
      .mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const pipeline = body.features[0];
    expect(pipeline.fuelType).toBeNull();
    expect(pipeline.capacityMw).toBeNull();
    expect(pipeline.pipelineProduct).toBe('natural_gas');
    expect(pipeline.pipelineLengthKm).toBe(1234.5);
  });

  it('40. sources endpoint returns canonical sources with attribution', async () => {
    vi.mocked(query).mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/energy/infrastructure/sources',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    for (const source of body.sources) {
      expect(source.attributionRequired).toBe(true);
      expect(source.license).toBeDefined();
      expect(source.homepage).toBeDefined();
    }
  });
});
