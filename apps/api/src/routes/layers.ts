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
    status: 'active' as const,
    dataStatus: 'static' as const,
    description: 'Country borders and administrative boundaries (MVP/local-dev via Natural Earth).',
    sourceRule: 'Static GeoJSON source (Natural Earth Admin-0). Seeded to DB. MVP/local-dev only; not production boundary-compliant.',
    apiStatus: 'active',
    frontendStatus: 'active',
    safetyNotes: 'Country borders are politically sensitive. MVP/local-dev only; not Survey of India compliant; not production-approved. Disputed territories require individual review.',
    isEnabled: true,
    isImplemented: true,
  },
  {
    layerId: 'layer_03_earth_events',
    name: 'Earth Events',
    category: 'Natural Phenomena',
    status: 'active' as const,
    dataStatus: 'live' as const,
    description: 'Earthquakes and natural-event tracking from authoritative public feeds.',
    sourceRule: 'USGS earthquake feed (standard fetcher/normalizer pattern). Additional event feeds may be added by approved work order.',
    apiStatus: 'active',
    frontendStatus: 'active',
    safetyNotes: 'Earthquake/tsunami alerts are time-critical. Cache must be short (< 5 min). Must not cause alert fatigue.',
    isEnabled: true,
    isImplemented: true,
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
    isEnabled: false,
    isImplemented: false,
  },
  {
    layerId: 'layer_05_space_satellites',
    name: 'Space & Satellites',
    category: 'Space',
    status: 'active' as const,
    dataStatus: 'live' as const,
    description: 'Satellite objects, orbital tracks, and space-debris visualization.',
    sourceRule: 'Public TLE feeds (Space-Track, CelesTrak). Standard fetcher/normalizer pattern. Live data requires the satellite worker to be running.',
    apiStatus: 'active',
    frontendStatus: 'active',
    safetyNotes: 'Debris tracking may be sensitive. Use public TLE data only. No classified satellite references.',
    isEnabled: false,
    isImplemented: true,
  },
  {
    layerId: 'layer_06_maritime',
    name: 'Maritime',
    category: 'Transportation',
    status: 'active' as const,
    dataStatus: 'live' as const,
    description: 'Vessel positions, ports, and maritime traffic visualization.',
    sourceRule: 'AIS data source family (e.g. AISStream). Standard fetcher/normalizer pattern. Live data requires the maritime worker to be running.',
    apiStatus: 'active',
    frontendStatus: 'active',
    safetyNotes: 'AIS data has privacy implications for private vessels. Consider filtering certain vessel types.',
    isEnabled: false,
    isImplemented: true,
  },
  {
    layerId: 'layer_07_weather',
    name: 'Weather / Live Weather',
    category: 'Natural Phenomena',
    status: 'active' as const,
    dataStatus: 'live' as const,
    description: 'Point/grid weather observations and forecasts (temperature, wind, precipitation).',
    sourceRule: 'Open-Meteo (point/grid weather data). Standard fetcher/normalizer pattern. No API key required for fetching.',
    apiStatus: 'active',
    frontendStatus: 'active',
    safetyNotes: 'Model/grid-based weather (not street-level exact). Grid-cell resolution varies by model. Open-Meteo CC-BY 4.0 attribution required.',
    isEnabled: false,
    isImplemented: true,
  },
  {
    layerId: 'layer_08_news_osint',
    name: 'News & OSINT',
    category: 'Intelligence',
    status: 'active' as const,
    dataStatus: 'live' as const,
    description: 'Geolocated disaster/event and open-source intelligence items (globe markers + list).',
    sourceRule: 'GDACS and GDELT event/news source families. Standard fetcher/normalizer pattern. Live data requires the news worker to be running.',
    apiStatus: 'active',
    frontendStatus: 'active',
    safetyNotes: 'OSINT sources must be vetted. No PII. Respect copyright and fair use. Source attribution required for every item.',
    isEnabled: false,
    isImplemented: true,
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
    isEnabled: false,
    isImplemented: false,
  },
  {
    layerId: 'layer_10_energy_infrastructure',
    name: 'Energy Infrastructure',
    category: 'Infrastructure',
    status: 'active' as const,
    dataStatus: 'static' as const,
    description: 'Power plants, substations, transmission lines, pipelines, and terminals.',
    sourceRule: 'Public/open data source families (WRI, OpenStreetMap, Global Energy Monitor). Seeded to DB.',
    apiStatus: 'active',
    frontendStatus: 'active',
    safetyNotes: 'Public/open data only. No targeting/sabotage guidance. No real-time operational data.',
    isEnabled: true,
    isImplemented: true,
  },
];

// Known object types per layer for the GET /api/layers summary list.
// Layers without an explicit entry report an empty objectTypes array.
const LAYER_OBJECT_TYPES: Record<string, string[]> = {
  layer_01_aviation: [
    'airport',
    'runway',
    'navaid',
    'airport_frequency',
    'country',
    'region',
  ],
};

const generatedAt = () => new Date().toISOString();

export async function layerRoutes(fastify: FastifyInstance) {
  // GET /api/layers - List all available layers
  fastify.get<{ Querystring: LayerQueryParams }>(
    '/api/layers',
    async (_request, _reply) => {
      const dbStatus = await checkDatabaseStatus();
      const dbConnected = dbStatus.status === 'connected';

      // Derive the list from the same canonical LAYER_REGISTRY so this
      // endpoint can never contradict GET /api/layers/registry.
      const layers = LAYER_REGISTRY.map((entry) => {
        let status: 'available' | 'unavailable' | 'not_configured';
        if (!entry.isImplemented) {
          status = 'not_configured';
        } else if (entry.layerId === 'layer_00_globe_core') {
          // Foundation layer is frontend-only; no database dependency.
          status = 'available';
        } else {
          status = dbConnected ? 'available' : 'unavailable';
        }

        return {
          layerId: entry.layerId,
          name: entry.name,
          status,
          description: entry.description,
          objectTypes: LAYER_OBJECT_TYPES[entry.layerId] ?? [],
        };
      });

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

  // GET /api/layers/registry - Official layer registry (all 11 layers, 00-10)
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

      // All other registered layers: return a sane, contract-valid status.
      // objectCounts in the shared contract are aviation-specific; for
      // non-aviation layers they are reported as zero (structural, not fake).
      const layer = LAYER_REGISTRY.find((l) => l.layerId === layerId);
      if (layer) {
        const dbStatus = await checkDatabaseStatus();
        const dbConnected = dbStatus.status === 'connected';
        return LayerStatusResponseSchema.parse({
          layerId: layer.layerId,
          status: layer.isImplemented
            ? (dbConnected ? 'ok' : 'degraded')
            : 'not_configured',
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
            status: dbConnected ? 'connected' : 'offline',
          },
        });
      }

      // Truly unknown layer (not present in the registry)
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