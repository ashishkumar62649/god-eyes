import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { airportIntelligenceRoutes } from '../src/routes/airport-intelligence/index.js';

vi.mock('../src/routes/airport-intelligence/repository.js', () => ({
  getAirportBase: vi.fn(),
  getPublicProfile: vi.fn(),
  getIntelligenceModules: vi.fn(),
  getSourceLinks: vi.fn(),
  getDerivedIntelligence: vi.fn(),
  getCapacityProfile: vi.fn(),
  getTrafficMetrics: vi.fn(),
}));

import * as repository from '../src/routes/airport-intelligence/repository.js';

const MOCK_AIRPORT_BASE = {
  id: '5209e070-54e7-45af-a2ef-afa20905085c',
  name: 'Bradley International Airport',
  iata_code: 'BDL',
  gps_code: 'KBDL',
  municipality: 'Hartford',
  iso_country: 'US',
  wikipedia_link: 'https://en.wikipedia.org/wiki/Bradley_International_Airport',
  elevation_ft: 173,
};

const MOCK_PUBLIC_PROFILE = {
  id: 'profile-id-1',
  airport_id: '5209e070-54e7-45af-a2ef-afa20905085c',
  profile_payload: {
    id: '5209e070-54e7-45af-a2ef-afa20905085c',
    name: 'Bradley International Airport',
    summary: 'Bradley International Airport is a public airport in Connecticut.',
    iataCode: 'BDL',
    icaoCode: 'KBDL',
    imageUrl: 'https://example.com/bdl.jpg',
    location: { latitude: 41.9389, longitude: -72.6832, city: 'Hartford', country: 'US' },
    openedDate: null,
    shortDescription: 'Airport near Hartford, Connecticut, USA',
  },
  profile_summary: 'Bradley International Airport is a public airport in Connecticut.',
  source_attribution: { wikipedia: { url: 'https://en.wikipedia.org/wiki/Bradley_International_Airport', title: 'Bradley International Airport' } },
  source_urls: [{ url: 'https://en.wikipedia.org/wiki/Bradley_International_Airport' }],
  wikipedia_url: 'https://en.wikipedia.org/wiki/Bradley_International_Airport',
  wikidata_url: null,
};

const MOCK_OVERVIEW_MODULE_LIVE_SHAPE = {
  id: 'module-overview-1',
  airport_id: '5209e070-54e7-45af-a2ef-afa20905085c',
  module_key: 'overview',
  module_status: 'ok',
  cache_state: 'fresh',
  confidence_label: 'high',
  confidence_score: 0.8,
  data_payload: {
    map_popup: {
      airport_name: 'Bradley International Airport',
      iata: 'BDL',
      icao: 'KBDL',
      city: 'Hartford',
      country: 'US',
      image_url: 'https://upload.wikimedia.org/wikipedia/en/thumb/b/b1/Bradley_INTL_Logo.svg/330px-Bradley_INTL_Logo.svg.png',
      short_summary: 'Airport near Hartford, Connecticut, USA',
      badges: ['IATA: BDL', 'ICAO: KBDL', 'US'],
      opened_date: null,
      opened_year: null,
      quick_stats: {
        runway_count: 3,
        longest_runway_ft: 9510,
      },
      confidence_label: 'high',
    },
    processed_at: '2026-05-19T21:13:14.602164+00:00',
    wikidata_qid: 'Q1420233',
    wikipedia_title: 'Bradley International Airport',
  },
  summary_payload: { summary: 'Overview summary' },
  source_summary: { wikipedia: { url: 'https://en.wikipedia.org/wiki/Bradley_International_Airport' } },
  fetched_at: new Date(),
  stale_at: new Date(Date.now() + 86400000),
  expires_at: new Date(Date.now() + 172800000),
};

const MOCK_CAPABILITY_MODULE = {
  id: 'module-capability-1',
  airport_id: '5209e070-54e7-45af-a2ef-afa20905085c',
  module_key: 'capability',
  module_status: 'ok',
  cache_state: 'fresh',
  confidence_label: 'high',
  confidence_score: 0.8,
  data_payload: {
    tags: ['scheduled_service', 'international', 'large_aircraft_capable'],
    surfaces: ['ASP'],
    runway_count: 3,
    longest_runway_ft: 9510,
    scheduled_service: 'yes',
  },
  summary_payload: null,
  source_summary: null,
  fetched_at: new Date(),
  stale_at: null,
  expires_at: null,
};

const MOCK_INFRASTRUCTURE_MODULE = {
  id: 'module-infrastructure-1',
  airport_id: '5209e070-54e7-45af-a2ef-afa20905085c',
  module_key: 'infrastructure',
  module_status: 'ok',
  cache_state: 'fresh',
  confidence_label: 'high',
  confidence_score: 0.95,
  data_payload: {
    surfaces: ['ASP'],
    runway_count: 3,
    longest_runway_ft: 9510,
    runway_capability: 'large_aircraft',
  },
  summary_payload: null,
  source_summary: null,
  fetched_at: new Date(),
  stale_at: null,
  expires_at: null,
};

const MOCK_DERIVED_INTELLIGENCE = {
  id: 'derived-1',
  airport_id: '5209e070-54e7-45af-a2ef-afa20905085c',
  intelligence_status: 'ok',
  airport_class: null,
  runway_capability: 'large_aircraft',
  operating_role: null,
  capability_tags: ['scheduled_service', 'international', 'multiple_runways', 'large_aircraft_capable', 'jet_capable', 'profile_verified'],
  confidence_score: 0.7,
  longest_runway_ft: 9510,
  runway_count: 3,
  intelligence_summary: null,
  capability_summary: '6 capability tags identified',
};

const MOCK_SOURCE_LINKS = [
  {
    id: 'source-1',
    airport_id: '5209e070-54e7-45af-a2ef-afa20905085c',
    module_key: 'overview',
    source_type: 'wikipedia',
    source_name: 'Wikipedia REST API',
    source_url: 'https://en.wikipedia.org/wiki/Bradley_International_Airport',
    source_entity_id: 'Bradley International Airport',
    attribution_text: null,
    is_primary: true,
    confidence_label: 'high',
    confidence_score: 0.95,
  },
  {
    id: 'source-2',
    airport_id: '5209e070-54e7-45af-a2ef-afa20905085c',
    module_key: 'overview',
    source_type: 'wikidata',
    source_name: 'Wikidata',
    source_url: null,
    source_entity_id: 'Q1420233',
    attribution_text: null,
    is_primary: false,
    confidence_label: 'high',
    confidence_score: 0.9,
  },
  {
    id: 'source-3',
    airport_id: '5209e070-54e7-45af-a2ef-afa20905085c',
    module_key: null,
    source_type: 'ourairports',
    source_name: 'OurAirports Dataset',
    source_url: null,
    source_entity_id: null,
    attribution_text: null,
    is_primary: true,
    confidence_label: 'high',
    confidence_score: 0.9,
  },
];

describe('Airport Intelligence API', () => {
  let app: Fastify.FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(airportIntelligenceRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(repository.getAirportBase).mockResolvedValue(MOCK_AIRPORT_BASE);
    vi.mocked(repository.getPublicProfile).mockResolvedValue(null);
    vi.mocked(repository.getIntelligenceModules).mockResolvedValue([]);
    vi.mocked(repository.getSourceLinks).mockResolvedValue([]);
    vi.mocked(repository.getDerivedIntelligence).mockResolvedValue(null);
    vi.mocked(repository.getCapacityProfile).mockResolvedValue(null);
    vi.mocked(repository.getTrafficMetrics).mockResolvedValue([]);
  });

  describe('GET /api/airports/:airportId/intelligence', () => {
    it('should return 404 for unknown airport id', async () => {
      vi.mocked(repository.getAirportBase).mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/airports/00000000-0000-0000-0000-000000000000/intelligence',
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.status).toBe('not_found');
      expect(body.airportId).toBe('00000000-0000-0000-0000-000000000000');
    });

    it('should return 200 with no_data when airport exists but intelligence rows missing', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/airports/5209e070-54e7-45af-a2ef-afa20905085c/intelligence',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe('no_data');
      expect(body.airportId).toBe('5209e070-54e7-45af-a2ef-afa20905085c');
    });

    it('should return 200 ok when modules/source links/derived intelligence exist', async () => {
      vi.mocked(repository.getIntelligenceModules).mockResolvedValue([
        MOCK_OVERVIEW_MODULE_LIVE_SHAPE,
        MOCK_CAPABILITY_MODULE,
        MOCK_INFRASTRUCTURE_MODULE,
      ]);
      vi.mocked(repository.getSourceLinks).mockResolvedValue(MOCK_SOURCE_LINKS);
      vi.mocked(repository.getDerivedIntelligence).mockResolvedValue(MOCK_DERIVED_INTELLIGENCE);

      const response = await app.inject({
        method: 'GET',
        url: '/api/airports/5209e070-54e7-45af-a2ef-afa20905085c/intelligence',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe('ok');
    });

    it('should return mapPopup correctly from nested map_popup in overview module payload', async () => {
      vi.mocked(repository.getIntelligenceModules).mockResolvedValue([MOCK_OVERVIEW_MODULE_LIVE_SHAPE]);
      vi.mocked(repository.getDerivedIntelligence).mockResolvedValue(MOCK_DERIVED_INTELLIGENCE);

      const response = await app.inject({
        method: 'GET',
        url: '/api/airports/5209e070-54e7-45af-a2ef-afa20905085c/intelligence',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.mapPopup).toBeDefined();
      expect(body.mapPopup.airportName).toBe('Bradley International Airport');
      expect(body.mapPopup.iata).toBe('BDL');
      expect(body.mapPopup.icao).toBe('KBDL');
      expect(body.mapPopup.city).toBe('Hartford');
      expect(body.mapPopup.country).toBe('US');
      expect(body.mapPopup.imageUrl).toBe('https://upload.wikimedia.org/wikipedia/en/thumb/b/b1/Bradley_INTL_Logo.svg/330px-Bradley_INTL_Logo.svg.png');
      expect(body.mapPopup.shortSummary).toBe('Airport near Hartford, Connecticut, USA');
      expect(body.mapPopup.badges).toEqual(['IATA: BDL', 'ICAO: KBDL', 'US']);
      expect(body.mapPopup.openedDate).toBeNull();
      expect(body.mapPopup.openedYear).toBeNull();
      expect(body.mapPopup.quickStats.runwayCount).toBe(3);
      expect(body.mapPopup.quickStats.longestRunwayFt).toBe(9510);
      expect(body.mapPopup.confidenceLabel).toBe('high');
    });

    it('should fallback mapPopup from base airport/public profile when no overview module payload', async () => {
      vi.mocked(repository.getPublicProfile).mockResolvedValue(MOCK_PUBLIC_PROFILE);
      vi.mocked(repository.getDerivedIntelligence).mockResolvedValue(MOCK_DERIVED_INTELLIGENCE);

      const response = await app.inject({
        method: 'GET',
        url: '/api/airports/5209e070-54e7-45af-a2ef-afa20905085c/intelligence',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.mapPopup.airportName).toBe('Bradley International Airport');
      expect(body.mapPopup.iata).toBe('BDL');
      expect(body.mapPopup.icao).toBe('KBDL');
      expect(body.mapPopup.city).toBe('Hartford');
      expect(body.mapPopup.country).toBe('US');
    });

    it('should return capacity no_data when capacity table has no row', async () => {
      vi.mocked(repository.getIntelligenceModules).mockResolvedValue([MOCK_OVERVIEW_MODULE_LIVE_SHAPE]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/airports/5209e070-54e7-45af-a2ef-afa20905085c/intelligence',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.capacity.status).toBe('no_data');
      expect(body.capacity.data).toBeNull();
    });

    it('should return traffic no_data when traffic table has no row', async () => {
      vi.mocked(repository.getIntelligenceModules).mockResolvedValue([MOCK_OVERVIEW_MODULE_LIVE_SHAPE]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/airports/5209e070-54e7-45af-a2ef-afa20905085c/intelligence',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.traffic.status).toBe('no_data');
      expect(body.traffic.data).toEqual([]);
    });

    it('should return source links correctly', async () => {
      vi.mocked(repository.getSourceLinks).mockResolvedValue(MOCK_SOURCE_LINKS);

      const response = await app.inject({
        method: 'GET',
        url: '/api/airports/5209e070-54e7-45af-a2ef-afa20905085c/intelligence',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.sources.status).toBe('ok');
      expect(body.sources.items).toHaveLength(3);
      expect(body.sources.items[0].sourceType).toBe('wikipedia');
      expect(body.sources.items[0].sourceName).toBe('Wikipedia REST API');
      expect(body.sources.items[0].isPrimary).toBe(true);
      expect(body.sources.items[2].sourceType).toBe('ourairports');
    });

    it('should return overview from overview module with nested map_popup', async () => {
      vi.mocked(repository.getIntelligenceModules).mockResolvedValue([MOCK_OVERVIEW_MODULE_LIVE_SHAPE]);
      vi.mocked(repository.getPublicProfile).mockResolvedValue(MOCK_PUBLIC_PROFILE);

      const response = await app.inject({
        method: 'GET',
        url: '/api/airports/5209e070-54e7-45af-a2ef-afa20905085c/intelligence',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.overview.status).toBe('ok');
      expect(body.overview.summary).toBe('Airport near Hartford, Connecticut, USA');
    });

    it('should return capability from derived intelligence', async () => {
      vi.mocked(repository.getDerivedIntelligence).mockResolvedValue(MOCK_DERIVED_INTELLIGENCE);

      const response = await app.inject({
        method: 'GET',
        url: '/api/airports/5209e070-54e7-45af-a2ef-afa20905085c/intelligence',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.capability.status).toBe('partial');
      expect(body.capability.runwayCapability).toBe('large_aircraft');
      expect(body.capability.tags).toContain('scheduled_service');
    });

    it('should return infrastructure from derived intelligence', async () => {
      vi.mocked(repository.getDerivedIntelligence).mockResolvedValue(MOCK_DERIVED_INTELLIGENCE);

      const response = await app.inject({
        method: 'GET',
        url: '/api/airports/5209e070-54e7-45af-a2ef-afa20905085c/intelligence',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.infrastructure.status).toBe('ok');
      expect(body.infrastructure.runwayCount).toBe(3);
      expect(body.infrastructure.longestRunwayFt).toBe(9510);
      expect(body.infrastructure.runwayCapability).toBe('large_aircraft');
    });

    it('should return capacity ok when capacity profile exists', async () => {
      vi.mocked(repository.getCapacityProfile).mockResolvedValue({
        id: 'capacity-1',
        airport_id: '5209e070-54e7-45af-a2ef-afa20905085c',
        annual_passenger_capacity: 7000000,
        terminal_capacity: null,
        runway_movement_capacity_per_hour: 60,
        terminal_count: 1,
        gate_count: 26,
        stand_count: null,
        aircraft_stand_count: null,
        check_in_counter_count: null,
        baggage_belt_count: null,
        capacity_year: 2024,
        capacity_basis: 'official_declared',
        confidence_label: 'high',
        confidence_score: 0.85,
        capacity_status: 'ok',
        notes: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/airports/5209e070-54e7-45af-a2ef-afa20905085c/intelligence',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.capacity.status).toBe('ok');
      expect(body.capacity.data).not.toBeNull();
      expect(body.capacity.data.annualPassengerCapacity).toBe(7000000);
      expect(body.capacity.data.capacityYear).toBe(2024);
    });

    it('should return traffic ok when traffic metrics exist', async () => {
      vi.mocked(repository.getTrafficMetrics).mockResolvedValue([
        {
          id: 'traffic-1',
          airport_id: '5209e070-54e7-45af-a2ef-afa20905085c',
          metric_type: 'passengers_total',
          period_year: 2024,
          metric_value: 6800000,
          metric_unit: 'passengers',
          confidence_label: 'high',
          confidence_score: 0.9,
        },
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/airports/5209e070-54e7-45af-a2ef-afa20905085c/intelligence',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.traffic.status).toBe('ok');
      expect(body.traffic.data).toHaveLength(1);
      expect(body.traffic.data[0].metricType).toBe('passengers_total');
      expect(body.traffic.data[0].metricValue).toBe(6800000);
    });

    it('should return advanced module statuses', async () => {
      vi.mocked(repository.getIntelligenceModules).mockResolvedValue([
        MOCK_OVERVIEW_MODULE_LIVE_SHAPE,
        MOCK_CAPABILITY_MODULE,
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/airports/5209e070-54e7-45af-a2ef-afa20905085c/intelligence',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.advanced.moduleStatuses).toHaveLength(2);
      expect(body.advanced.moduleStatuses[0].moduleKey).toBe('overview');
      expect(body.advanced.moduleStatuses[1].moduleKey).toBe('capability');
      expect(body.advanced.cache).toHaveProperty('overview');
      expect(body.advanced.cache).toHaveProperty('capability');
    });

    it('should return partial status when some modules exist but not all core modules', async () => {
      vi.mocked(repository.getIntelligenceModules).mockResolvedValue([MOCK_OVERVIEW_MODULE_LIVE_SHAPE]);
      vi.mocked(repository.getSourceLinks).mockResolvedValue(MOCK_SOURCE_LINKS);

      const response = await app.inject({
        method: 'GET',
        url: '/api/airports/5209e070-54e7-45af-a2ef-afa20905085c/intelligence',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe('partial');
    });

    it('should return null openedDate when not available', async () => {
      vi.mocked(repository.getIntelligenceModules).mockResolvedValue([MOCK_OVERVIEW_MODULE_LIVE_SHAPE]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/airports/5209e070-54e7-45af-a2ef-afa20905085c/intelligence',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.mapPopup.openedDate).toBeNull();
      expect(body.mapPopup.openedYear).toBeNull();
    });

    it('should not crash when any intelligence table is empty', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/airports/5209e070-54e7-45af-a2ef-afa20905085c/intelligence',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('mapPopup');
      expect(body).toHaveProperty('overview');
      expect(body).toHaveProperty('capability');
      expect(body).toHaveProperty('infrastructure');
      expect(body).toHaveProperty('capacity');
      expect(body).toHaveProperty('traffic');
      expect(body).toHaveProperty('sources');
      expect(body).toHaveProperty('advanced');
    });

    it('should return generatedAt timestamp', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/airports/5209e070-54e7-45af-a2ef-afa20905085c/intelligence',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.generatedAt).toBeDefined();
      expect(new Date(body.generatedAt).toISOString()).toBeDefined();
    });

    it('should return sources missing when no source links exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/airports/5209e070-54e7-45af-a2ef-afa20905085c/intelligence',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.sources.status).toBe('missing');
      expect(body.sources.items).toEqual([]);
    });

    it('should not crash when data_payload is null on a module', async () => {
      vi.mocked(repository.getIntelligenceModules).mockResolvedValue([
        {
          id: 'module-null-payload',
          airport_id: '5209e070-54e7-45af-a2ef-afa20905085c',
          module_key: 'overview',
          module_status: 'ok',
          cache_state: 'fresh',
          confidence_label: null,
          confidence_score: null,
          data_payload: null,
          summary_payload: null,
          source_summary: null,
          fetched_at: null,
          stale_at: null,
          expires_at: null,
        },
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/airports/5209e070-54e7-45af-a2ef-afa20905085c/intelligence',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe('partial');
      expect(body.mapPopup.airportName).toBe('Bradley International Airport');
    });

    it('should handle live-like DB row shape from ingest worker without crash', async () => {
      vi.mocked(repository.getIntelligenceModules).mockResolvedValue([
        MOCK_OVERVIEW_MODULE_LIVE_SHAPE,
        MOCK_CAPABILITY_MODULE,
        MOCK_INFRASTRUCTURE_MODULE,
        {
          id: 'module-advanced',
          airport_id: '5209e070-54e7-45af-a2ef-afa20905085c',
          module_key: 'advanced_details',
          module_status: 'ok',
          cache_state: 'fresh',
          confidence_label: 'high',
          confidence_score: 0.7,
          data_payload: {
            opened_date: null,
            opened_year: null,
            wikidata_qid: 'Q1420233',
            wikipedia_title: 'Bradley International Airport',
          },
          summary_payload: null,
          source_summary: { wikidata: null, wikipedia: { url: 'https://en.wikipedia.org/wiki/Bradley_International_Airport' } },
          fetched_at: new Date(),
          stale_at: null,
          expires_at: null,
        },
        {
          id: 'module-sources',
          airport_id: '5209e070-54e7-45af-a2ef-afa20905085c',
          module_key: 'sources',
          module_status: 'ok',
          cache_state: 'fresh',
          confidence_label: 'high',
          confidence_score: 0.9,
          data_payload: {
            source_links: ['ourairports', 'wikipedia', 'wikidata'],
            sources_used: ['wikipedia', 'wikidata'],
          },
          summary_payload: null,
          source_summary: null,
          fetched_at: new Date(),
          stale_at: null,
          expires_at: null,
        },
      ]);
      vi.mocked(repository.getSourceLinks).mockResolvedValue(MOCK_SOURCE_LINKS);
      vi.mocked(repository.getDerivedIntelligence).mockResolvedValue(MOCK_DERIVED_INTELLIGENCE);

      const response = await app.inject({
        method: 'GET',
        url: '/api/airports/5209e070-54e7-45af-a2ef-afa20905085c/intelligence',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe('ok');
      expect(body.mapPopup).toBeDefined();
      expect(body.overview).toBeDefined();
      expect(body.capability).toBeDefined();
      expect(body.infrastructure).toBeDefined();
      expect(body.capacity.status).toBe('no_data');
      expect(body.traffic.status).toBe('no_data');
      expect(body.sources.status).toBe('ok');
      expect(body.advanced.moduleStatuses).toHaveLength(5);
    });
  });
});
