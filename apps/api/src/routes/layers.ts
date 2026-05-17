import { FastifyInstance } from 'fastify';
import { checkDatabaseStatus } from '../lib/db.js';
import {
  LayersListResponseSchema,
  LayerStatusResponseSchema,
  ErrorCodes,
  LayerListMetadataSchema,
} from '@god-eyes/contracts';

interface LayerQueryParams {
  objectType?: string;
}

interface LayerStatusParams {
  layerId: string;
}

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
          generatedAt: new Date().toISOString(),
        },
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