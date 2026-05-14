import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { checkDatabaseStatus, query } from '../lib/db.js';
import {
  LayerObjectsListResponseSchema,
  LayerObjectDetailResponseSchema,
  ErrorCodes,
  NotImplementedResponseSchema,
} from '@god-eyes/contracts';

interface ObjectsQueryParams {
  objectType: string;
  limit?: string;
  offset?: string;
  bbox?: string;
  country?: string;
  category?: string;
  search?: string;
}

interface ObjectsParams {
  layerId: string;
}

interface ObjectDetailParams {
  layerId: string;
  objectId: string;
}

// Airport row from database
interface AirportRow {
  id: string;
  layer_id: string;
  source_id: string;
  source_airport_id: string;
  ident: string;
  type_source: string;
  category_normalized: string;
  name: string;
  latitude_deg: number | null;
  longitude_deg: number | null;
  elevation_ft: number | null;
  iso_country: string | null;
  iso_region: string | null;
  municipality: string | null;
  iata_code: string | null;
  created_at: string;
  updated_at: string;
}

function rowToAirportObject(row: AirportRow) {
  return {
    id: row.id,
    layerId: row.layer_id,
    objectType: 'airport' as const,
    sourceId: row.source_id,
    sourceObjectId: row.source_airport_id,
    name: row.name,
    ident: row.ident,
    iataCode: row.iata_code,
    category: row.category_normalized,
    typeSource: row.type_source,
    country: row.iso_country,
    region: row.iso_region,
    municipality: row.municipality,
    position: {
      latitude: row.latitude_deg,
      longitude: row.longitude_deg,
    },
    elevationFt: row.elevation_ft,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function objectRoutes(fastify: FastifyInstance) {
  // GET /api/layers/:layerId/objects - List objects for a layer
  fastify.get<{
    Params: ObjectsParams;
    Querystring: ObjectsQueryParams;
  }>('/api/layers/:layerId/objects', async (request, reply) => {
    const { layerId } = request.params;
    const {
      objectType,
      limit = '100',
      offset = '0',
      country,
      category,
      search,
    } = request.query;

    // Validate limit and offset
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

    // Only layer_01_aviation is supported for now
    if (layerId !== 'layer_01_aviation') {
      reply.code(404);
      return {
        error: {
          code: ErrorCodes.INVALID_LAYER,
          message: `Layer ${layerId} is not supported.`,
          details: {},
        },
      };
    }

    // Only airport object type is implemented
    if (objectType !== 'airport') {
      reply.code(400);
      return NotImplementedResponseSchema.parse({
        error: {
          code: ErrorCodes.NOT_IMPLEMENTED,
          message: `Object type '${objectType}' is not implemented.`,
          supportedTypes: ['airport'],
        },
      });
    }

    const dbStatus = await checkDatabaseStatus();
    if (dbStatus.status === 'offline') {
      reply.code(503);
      return {
        error: {
          code: ErrorCodes.DATABASE_OFFLINE,
          message: 'Database is not available.',
          details: {},
        },
      };
    }

    // Build query
    let sql = 'SELECT * FROM aviation_airports WHERE 1=1';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (country) {
      sql += ` AND iso_country = $${paramIndex}`;
      params.push(country.toUpperCase());
      paramIndex++;
    }

    if (category) {
      sql += ` AND category_normalized = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (search) {
      sql += ` AND (name ILIKE $${paramIndex} OR ident ILIKE $${paramIndex} OR iata_code ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Get total count
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = await query<{ count: string }>(countSql, params);
    const totalCount = parseInt(countResult[0]?.count || '0', 10);

    // Add pagination
    sql += ` ORDER BY name LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parsedLimit, parsedOffset);

    try {
      const rows = await query<AirportRow>(sql, params);
      const items = rows.map(rowToAirportObject);

      return LayerObjectsListResponseSchema.parse({
        items,
        pagination: {
          limit: parsedLimit,
          offset: parsedOffset,
          returned: items.length,
          total: totalCount,
        },
      });
    } catch (error) {
      // Table might not exist
      reply.code(503);
      return {
        error: {
          code: ErrorCodes.DATABASE_OFFLINE,
          message: 'Aviation tables not available.',
          details: {},
        },
      };
    }
  });

  // GET /api/layers/:layerId/objects/:objectId - Get detail for one object
  fastify.get<{
    Params: ObjectDetailParams;
  }>('/api/layers/:layerId/objects/:objectId', async (request, reply) => {
    const { layerId, objectId } = request.params;

    // Only layer_01_aviation is supported for now
    if (layerId !== 'layer_01_aviation') {
      reply.code(404);
      return {
        error: {
          code: ErrorCodes.INVALID_LAYER,
          message: `Layer ${layerId} is not supported.`,
          details: {},
        },
      };
    }

    const dbStatus = await checkDatabaseStatus();
    if (dbStatus.status === 'offline') {
      reply.code(503);
      return {
        error: {
          code: ErrorCodes.DATABASE_OFFLINE,
          message: 'Database is not available.',
          details: {},
        },
      };
    }

    try {
      const rows = await query<AirportRow>(
        'SELECT * FROM aviation_airports WHERE id = $1',
        [objectId]
      );

      if (rows.length === 0) {
        reply.code(404);
        return {
          error: {
            code: ErrorCodes.OBJECT_NOT_FOUND,
            message: `Airport not found: ${objectId}`,
            details: {},
          },
        };
      }

      return LayerObjectDetailResponseSchema.parse(rowToAirportObject(rows[0]));
    } catch (error) {
      // Table might not exist
      reply.code(503);
      return {
        error: {
          code: ErrorCodes.DATABASE_OFFLINE,
          message: 'Aviation tables not available.',
          details: {},
        },
      };
    }
  });
}