import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { airportLayoutFeaturesRoutes } from '../src/routes/airport-layout-features/index.js';

vi.mock('../src/routes/airport-layout-features/repository.js', () => ({
  getAirportLayoutFeatures: vi.fn(),
  getAirportLayoutFeatureSummary: vi.fn(),
  airportExists: vi.fn(),
}));

import * as repository from '../src/routes/airport-layout-features/repository.js';

const AIRPORT_ID = '5209e070-54e7-45af-a2ef-afa20905085c';

function makeActiveRow(featureName: string, rank: number = 50) {
  return {
    id: `id-${featureName}`,
    feature_type: 'runway',
    feature_subtype: 'active',
    feature_name: featureName,
    source_type: 'ourairports',
    geometry: `LINESTRING(-72.6832 41.9389, -72.6732 41.9489)`,
    geometry_type: 'line',
    centroid: `POINT(-72.6782 41.9439)`,
    is_active: true,
    confidence_label: 'high',
    confidence_score: 0.95,
    rank,
    is_primary: true,
    fetched_at: new Date('2026-05-23T12:00:00Z'),
  };
}

function makeInactiveRow(featureName: string, rank: number = 150) {
  return {
    id: `id-${featureName}`,
    feature_type: 'runway',
    feature_subtype: 'closed',
    feature_name: featureName,
    source_type: 'ourairports',
    geometry: `LINESTRING(-72.6832 41.9389, -72.6732 41.9489)`,
    geometry_type: 'line',
    centroid: `POINT(-72.6782 41.9439)`,
    is_active: false,
    confidence_label: 'medium',
    confidence_score: 0.7,
    rank,
    is_primary: false,
    fetched_at: new Date('2026-05-23T12:00:00Z'),
  };
}

const ACTIVE_RW_06_24 = makeActiveRow('06/24', 50);
const ACTIVE_RW_15_33 = makeActiveRow('15/33', 60);
const INACTIVE_RW_01_19 = makeInactiveRow('1/19', 150);

const ACTIVE_RUNWAYS = [ACTIVE_RW_06_24, ACTIVE_RW_15_33];
const ALL_RUNWAYS = [...ACTIVE_RUNWAYS, INACTIVE_RW_01_19];

describe('Airport Layout Features API', () => {
  let app: Fastify.FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(airportLayoutFeaturesRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(repository.airportExists).mockResolvedValue(true);
    vi.mocked(repository.getAirportLayoutFeatures).mockResolvedValue(ACTIVE_RUNWAYS);
    vi.mocked(repository.getAirportLayoutFeatureSummary).mockResolvedValue({
      totalFeatures: 2,
      byType: { runway: 2 },
      sourceTypes: ['ourairports'],
      hasRunways: true,
      hasTaxiways: false,
      hasAprons: false,
      hasTerminals: false,
    });
  });

  it('should return 404 for unknown airport id', async () => {
    vi.mocked(repository.airportExists).mockResolvedValue(false);

    const response = await app.inject({
      method: 'GET',
      url: `/api/airports/00000000-0000-0000-0000-000000000000/layout-features`,
    });

    expect(response.statusCode).toBe(404);
    const body = response.json();
    expect(body.status).toBe('not_found');
  });

  it('should return no_data when no features exist', async () => {
    vi.mocked(repository.getAirportLayoutFeatures).mockResolvedValue([]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/airports/${AIRPORT_ID}/layout-features`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('no_data');
    expect(body.features).toEqual([]);
    expect(body.summary).toBeNull();
  });

  it('should return only active features by default', async () => {
    vi.mocked(repository.getAirportLayoutFeatures).mockResolvedValue(ACTIVE_RUNWAYS);
    vi.mocked(repository.getAirportLayoutFeatureSummary).mockResolvedValue({
      totalFeatures: 2,
      byType: { runway: 2 },
      sourceTypes: ['ourairports'],
      hasRunways: true,
      hasTaxiways: false,
      hasAprons: false,
      hasTerminals: false,
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/airports/${AIRPORT_ID}/layout-features`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('ok');
    expect(body.features).toHaveLength(2);
    expect(body.features[0].featureName).toBe('06/24');
    expect(body.features[1].featureName).toBe('15/33');
    expect(body.summary.totalFeatures).toBe(2);
    expect(body.summary.byType.runway).toBe(2);

    expect(repository.getAirportLayoutFeatures).toHaveBeenCalledWith(AIRPORT_ID, false, null);
  });

  it('should include inactive features when includeInactive=true', async () => {
    vi.mocked(repository.getAirportLayoutFeatures).mockResolvedValue(ALL_RUNWAYS);
    vi.mocked(repository.getAirportLayoutFeatureSummary).mockResolvedValue({
      totalFeatures: 3,
      byType: { runway: 3 },
      sourceTypes: ['ourairports'],
      hasRunways: true,
      hasTaxiways: false,
      hasAprons: false,
      hasTerminals: false,
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/airports/${AIRPORT_ID}/layout-features?includeInactive=true`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('ok');
    expect(body.features).toHaveLength(3);
    expect(body.summary.totalFeatures).toBe(3);

    expect(repository.getAirportLayoutFeatures).toHaveBeenCalledWith(AIRPORT_ID, true, null);
  });

  it('should return isActive field on features', async () => {
    vi.mocked(repository.getAirportLayoutFeatures).mockResolvedValue(ALL_RUNWAYS);
    vi.mocked(repository.getAirportLayoutFeatureSummary).mockResolvedValue({
      totalFeatures: 3,
      byType: { runway: 3 },
      sourceTypes: ['ourairports'],
      hasRunways: true,
      hasTaxiways: false,
      hasAprons: false,
      hasTerminals: false,
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/airports/${AIRPORT_ID}/layout-features?includeInactive=true`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    const activeFeatures = body.features.filter((f: any) => f.isActive === true);
    const inactiveFeatures = body.features.filter((f: any) => f.isActive === false);

    expect(activeFeatures).toHaveLength(2);
    expect(inactiveFeatures).toHaveLength(1);
    expect(inactiveFeatures[0].featureName).toBe('1/19');
  });

  it('should filter by featureType=runway', async () => {
    vi.mocked(repository.getAirportLayoutFeatures).mockResolvedValue(ACTIVE_RUNWAYS);
    vi.mocked(repository.getAirportLayoutFeatureSummary).mockResolvedValue({
      totalFeatures: 2,
      byType: { runway: 2 },
      sourceTypes: ['ourairports'],
      hasRunways: true,
      hasTaxiways: false,
      hasAprons: false,
      hasTerminals: false,
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/airports/${AIRPORT_ID}/layout-features?featureType=runway`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('ok');
    expect(body.features).toHaveLength(2);

    expect(repository.getAirportLayoutFeatures).toHaveBeenCalledWith(AIRPORT_ID, false, 'runway');
  });

  it('should return generatedAt timestamp', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/airports/${AIRPORT_ID}/layout-features`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.generatedAt).toBeDefined();
    expect(new Date(body.generatedAt).toISOString()).toBeDefined();
  });

  it('should not expose raw_metadata or diagnostics in response', async () => {
    vi.mocked(repository.getAirportLayoutFeatures).mockResolvedValue(ALL_RUNWAYS);

    const response = await app.inject({
      method: 'GET',
      url: `/api/airports/${AIRPORT_ID}/layout-features?includeInactive=true`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    for (const feature of body.features) {
      expect(feature).not.toHaveProperty('raw_metadata');
      expect(feature).not.toHaveProperty('diagnostics');
    }
  });

  it('should use includeInactive=false for summary when default', async () => {
    vi.mocked(repository.getAirportLayoutFeatures).mockResolvedValue(ACTIVE_RUNWAYS);
    vi.mocked(repository.getAirportLayoutFeatureSummary).mockResolvedValue({
      totalFeatures: 2,
      byType: { runway: 2 },
      sourceTypes: ['ourairports'],
      hasRunways: true,
      hasTaxiways: false,
      hasAprons: false,
      hasTerminals: false,
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/airports/${AIRPORT_ID}/layout-features`,
    });

    expect(response.statusCode).toBe(200);
    expect(repository.getAirportLayoutFeatureSummary).toHaveBeenCalledWith(AIRPORT_ID, false);
  });

  it('should use includeInactive=true for summary when requested', async () => {
    vi.mocked(repository.getAirportLayoutFeatures).mockResolvedValue(ALL_RUNWAYS);
    vi.mocked(repository.getAirportLayoutFeatureSummary).mockResolvedValue({
      totalFeatures: 3,
      byType: { runway: 3 },
      sourceTypes: ['ourairports'],
      hasRunways: true,
      hasTaxiways: false,
      hasAprons: false,
      hasTerminals: false,
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/airports/${AIRPORT_ID}/layout-features?includeInactive=true`,
    });

    expect(response.statusCode).toBe(200);
    expect(repository.getAirportLayoutFeatureSummary).toHaveBeenCalledWith(AIRPORT_ID, true);
  });

  it('should return 400 when airportId is empty', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/airports/   /layout-features`,
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.status).toBe('error');
  });
});
