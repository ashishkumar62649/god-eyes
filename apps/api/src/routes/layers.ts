import { FastifyInstance } from 'fastify';
import { checkDatabaseStatus } from '../lib/db.js';
import {
  LayersListResponseSchema,
  LayerStatusResponseSchema,
  LayerRegistryResponseSchema,
  LayerRegistrySingleResponseSchema,
  ErrorCodes,
  LayerListMetadataSchema,
} from '@god-eyes/contracts';

interface LayerQueryParams {
  objectType?: string;
}

interface LayerStatusParams {
  layerId: string;
}

interface LayerIdParams {
  layerId: string;
}

const LAYER_REGISTRY = [
  {
    layerId: 'layer_00_globe_core',
    name: 'Globe Core',
    category: 'Foundation',
    status: 'active' as const,
    dataStatus: 'static' as const,
    description: 'Core 3D globe visualization, camera controls, base map, and layer management system.',
    sourceRule: 'No external sources. Frontend-only foundation layer.',
    apiStatus: 'ready',
    frontendStatus: 'implemented',
    safetyNotes: 'Foundation layer — must never crash. Must maintain 60 FPS.',
    isEnabled: true,
    isImplemented: true,
  },
  {
    layerId: 'layer_01_aviation',
    name: 'Aviation',
    category: 'Transportation',
    status: 'active' as const,
    dataStatus: 'live' as const,
    description: 'Aviation reference data including airports, runways, navaids, flight routes, and aircraft positions.',
    sourceRule: 'Sources in source catalog. Fetchers and normalizers follow standard layer pattern.',
    apiStatus: 'ready',
    frontendStatus: 'implemented',
    safetyNotes: 'Real-time tracking data cached 1-5 min. No PII.',
    isEnabled: true,
    isImplemented: true,
  },
  {
    layerId: 'layer_02_borders_boundaries',
    name: 'Borders & Boundaries',
    category: 'Geography',
    status: 'coming_soon' as const,
    dataStatus: 'static' as const,
    description: 'Country borders, administrative boundaries, and disputed territories.',
    sourceRule: 'Static GeoJSON sources (Natural Earth, UN). No real-time fetchers for MVP.',
    apiStatus: 'coming_soon',
    frontendStatus: 'coming_soon',
    safetyNotes: 'Country borders are politically sensitive. Use authoritative sources. No disputed territory rendering without explicit spec.',
    isEnabled: true,
    isImplemented: false,
  },
  {
    layerId: 'layer_03_earth_events',
    name: 'Earth Events',
    category: 'Natural Phenomena',
    status: 'coming_soon' as const,
    dataStatus: 'live' as const,
    description: 'Earthquakes, volcanic activity, weather alerts, and natural disaster tracking.',
    sourceRule: 'USGS earthquake API, volcanic activity feeds, weather alerts. Standard fetcher/normalizer pattern.',
    apiStatus: 'coming_soon',
    frontendStatus: 'coming_soon',
    safetyNotes: 'Earthquake/tsunami alerts are time-critical. Cache must be short (< 5 min). Must not cause alert fatigue.',
    isEnabled: true,
    isImplemented: false,
  },
  {
    layerId: 'layer_04_public_military_security',
    name: 'Public Military & Security',
    category: 'Security',
    status: 'coming_soon' as const,
    dataStatus: 'static' as const,
    description: 'Public-only open-source military and security data. Static markers only.',
    sourceRule: 'Public-only sources for MVP. No classified, no sensitive-source feeds. Static datasets only.',
    apiStatus: 'coming_soon',
    frontendStatus: 'coming_soon',
    safetyNotes: 'HIGH SAFETY: Public-only. Static-only. No real-time tracking. No sensitive coordinate data. All data from open, published, verifiable sources. UI disclaimer required.',
    isEnabled: true,
    isImplemented: false,
  },
  {
    layerId: 'layer_05_space_satellites',
    name: 'Space & Satellites',
    category: 'Space',
    status: 'coming_soon' as const,
    dataStatus: 'live' as const,
    description: 'Satellite objects, orbital tracks, space debris visualization.',
    sourceRule: 'Public TLE feeds (Space-Track, CelesTrak). Satellite catalog sources. Standard fetcher/normalizer pattern.',
    apiStatus: 'coming_soon',
    frontendStatus: 'coming_soon',
    safetyNotes: 'Debris tracking may be sensitive. Use public TLE data only. No classified satellite references.',
    isEnabled: true,
    isImplemented: false,
  },
  {
    layerId: 'layer_06_maritime',
    name: 'Maritime',
    category: 'Transportation',
    status: 'coming_soon' as const,
    dataStatus: 'live' as const,
    description: 'Vessel positions, ports, and maritime traffic visualization.',
    sourceRule: 'AIS data providers (MarineTraffic, AISHub). Vessel position feeds. Standard fetcher/normalizer pattern.',
    apiStatus: 'coming_soon',
    frontendStatus: 'coming_soon',
    safetyNotes: 'AIS data has privacy implications for private vessels. Consider filtering certain vessel types.',
    isEnabled: true,
    isImplemented: false,
  },
  {
    layerId: 'layer_07_infrastructure',
    name: 'Infrastructure',
    category: 'Infrastructure',
    status: 'coming_soon' as const,
    dataStatus: 'static' as const,
    description: 'Power grids, fiber optic cables, water systems, and transportation networks.',
    sourceRule: 'Public infrastructure datasets. Static GeoJSON or seeded DB. No real-time fetchers for MVP.',
    apiStatus: 'coming_soon',
    frontendStatus: 'coming_soon',
    safetyNotes: 'Infrastructure data is sensitive in aggregate. Use public/open datasets only. No critical infrastructure detail that aids targeting.',
    isEnabled: true,
    isImplemented: false,
  },
  {
    layerId: 'layer_08_news_osint',
    name: 'News & OSINT',
    category: 'Intelligence',
    status: 'coming_soon' as const,
    dataStatus: 'live' as const,
    description: 'Geotagged news and open-source intelligence aggregation.',
    sourceRule: 'RSS/API news feeds, OSINT aggregators. Geotagged news sources. Standard fetcher/normalizer pattern.',
    apiStatus: 'coming_soon',
    frontendStatus: 'coming_soon',
    safetyNotes: 'OSINT sources must be vetted. No fake news/propaganda. Respect copyright and fair use. Must include source attribution for every item.',
    isEnabled: true,
    isImplemented: false,
  },
  {
    layerId: 'layer_09_user_shapes',
    name: 'User Shapes',
    category: 'User Content',
    status: 'coming_soon' as const,
    dataStatus: 'static' as const,
    description: 'User-created polygons, lines, and markers persisted across sessions.',
    sourceRule: 'User-created geometry stored in database. No external fetchers. API writes from frontend.',
    apiStatus: 'coming_soon',
    frontendStatus: 'coming_soon',
    safetyNotes: 'Must authenticate all writes. Validate geometry to prevent malformed data. Rate-limit per user. Users own their shapes.',
    isEnabled: true,
    isImplemented: false,
  },
];

const generatedAt = () => new Date().toISOString();

export async function layerRoutes(fastify: FastifyInstance) {
  // GET /api/layers - List all available layers
  fastify.get<{ Querystring: LayerQueryParams }>(
    '/api/layers',
    async (_request, _reply) => {
      const dbStatus = await checkDatabaseStatus();
      const dbConnected = dbStatus.status === 'connected';

      const layers = [
        {
          layerId: 'layer_00_globe_core',
          name: 'Globe Core',
          status: 'available' as const,
          description: 'Core Cesium globe visualization and layer management.',
          objectTypes: [] as string[],
        },
        {
          layerId: 'layer_01_aviation',
          name: 'Aviation',
          status: dbConnected ? 'available' as const : 'unavailable' as const,
          description:
            'Aviation reference data including airports, runways, navaids, countries, regions, and frequencies.',
          objectTypes: [
            'airport',
            'runway',
            'navaid',
            'airport_frequency',
            'country',
            'region',
          ],
        },
      ];

      return LayersListResponseSchema.parse({
        layers,
        metadata: {
          mode: 'standard',
          returnedCount: layers.length,
          generatedAt: generatedAt(),
        },
      });
    }
  );

  // GET /api/layers/registry - Official layer registry (all 10 layers)
  fastify.get(
    '/api/layers/registry',
    async (_request, _reply) => {
      return LayerRegistryResponseSchema.parse({
        layers: LAYER_REGISTRY,
        metadata: {
          total: LAYER_REGISTRY.length,
          generatedAt: generatedAt(),
        },
      });
    }
  );

  // GET /api/layers/:layerId - Get a single layer by ID
  fastify.get<{ Params: LayerIdParams }>(
    '/api/layers/:layerId',
    async (request, reply) => {
      const { layerId } = request.params;

      const layer = LAYER_REGISTRY.find((l) => l.layerId === layerId);

      if (!layer) {
        reply.code(404);
        return {
          error: {
            code: ErrorCodes.INVALID_LAYER,
            message: `Unknown layer: ${layerId}`,
            details: {},
          },
        };
      }

      return LayerRegistrySingleResponseSchema.parse({
        layer,
      });
    }
  );

  // GET /api/layers/:layerId/status - Get status for a specific layer
  fastify.get<{ Params: LayerStatusParams }>(
    '/api/layers/:layerId/status',
    async (request, reply) => {
      const { layerId } = request.params;

      if (layerId === 'layer_00_globe_core') {
        return LayerStatusResponseSchema.parse({
          layerId: 'layer_00_globe_core',
          status: 'ok',
          sourceId: null,
          objectCounts: {
            airports: 0,
            runways: 0,
            navaids: 0,
            airportFrequencies: 0,
            countries: 0,
            regions: 0,
          },
          database: {
            status: 'connected',
          },
        });
      }

      if (layerId === 'layer_01_aviation') {
        const dbStatus = await checkDatabaseStatus();

        if (dbStatus.status === 'offline') {
          return LayerStatusResponseSchema.parse({
            layerId: 'layer_01_aviation',
            status: 'degraded',
            sourceId: 'ourairports',
            objectCounts: {
              airports: 0,
              runways: 0,
              navaids: 0,
              airportFrequencies: 0,
              countries: 0,
              regions: 0,
            },
            database: {
              status: 'offline',
            },
          });
        }

        // Try to count records from aviation tables
        try {
          const { query } = await import('../lib/db.js');
          const counts = {
            airports: 0,
            runways: 0,
            navaids: 0,
            airportFrequencies: 0,
            countries: 0,
            regions: 0,
          };

          try {
            const airports = await query<{ count: string }>(
              'SELECT COUNT(*) as count FROM aviation_airports'
            );
            counts.airports = parseInt(airports[0]?.count || '0', 10);
          } catch {
            // Table might not exist yet
          }

          try {
            const runways = await query<{ count: string }>(
              'SELECT COUNT(*) as count FROM aviation_runways'
            );
            counts.runways = parseInt(runways[0]?.count || '0', 10);
          } catch {
            // Table might not exist yet
          }

          try {
            const navaids = await query<{ count: string }>(
              'SELECT COUNT(*) as count FROM aviation_navaids'
            );
            counts.navaids = parseInt(navaids[0]?.count || '0', 10);
          } catch {
            // Table might not exist yet
          }

          try {
            const freqs = await query<{ count: string }>(
              'SELECT COUNT(*) as count FROM aviation_airport_frequencies'
            );
            counts.airportFrequencies = parseInt(freqs[0]?.count || '0', 10);
          } catch {
            // Table might not exist yet
          }

          try {
            const countries = await query<{ count: string }>(
              'SELECT COUNT(*) as count FROM aviation_countries'
            );
            counts.countries = parseInt(countries[0]?.count || '0', 10);
          } catch {
            // Table might not exist yet
          }

          try {
            const regions = await query<{ count: string }>(
              'SELECT COUNT(*) as count FROM aviation_regions'
            );
            counts.regions = parseInt(regions[0]?.count || '0', 10);
          } catch {
            // Table might not exist yet
          }

          return LayerStatusResponseSchema.parse({
            layerId: 'layer_01_aviation',
            status: counts.airports > 0 ? 'ok' : 'degraded',
            sourceId: 'ourairports',
            objectCounts: counts,
            database: {
              status: 'connected',
            },
          });
        } catch {
          return LayerStatusResponseSchema.parse({
            layerId: 'layer_01_aviation',
            status: 'degraded',
            sourceId: 'ourairports',
            objectCounts: {
              airports: 0,
              runways: 0,
              navaids: 0,
              airportFrequencies: 0,
              countries: 0,
              regions: 0,
            },
            database: {
              status: 'connected',
            },
          });
        }
      }

      // Unknown layer
      reply.code(404);
      return {
        error: {
          code: ErrorCodes.INVALID_LAYER,
          message: `Unknown layer: ${layerId}`,
          details: {},
        },
      };
    }
  );
}