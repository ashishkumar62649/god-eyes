import { FastifyInstance } from 'fastify';
import { checkDatabaseStatus, query } from '../lib/db.js';
import {
  BordersBoundariesFeatureCollectionSchema,
  ErrorCodes,
} from '@god-eyes/contracts';

const DEFAULT_LIMIT = 250;
const MAX_LIMIT = 500;
const DEFAULT_SOURCE_ID = 'natural_earth_admin0_50m';
const CAVEAT = 'Natural Earth Admin-0 Countries 1:50m is MVP/local/dev only; not production-approved; not Survey of India / Government of India compliant.';

interface BordersBoundariesQuerystring {
  limit?: string;
  bbox?: string;
  source_id?: string;
  simplify?: string;
}

interface BBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

function parseBbox(raw: string): BBox | null {
  const parts = raw.split(',').map((p) => p.trim());
  if (parts.length !== 4) return null;

  const [minLon, minLat, maxLon, maxLat] = parts.map(Number);

  if (
    isNaN(minLon) || isNaN(minLat) || isNaN(maxLon) || isNaN(maxLat) ||
    minLon < -180 || minLon > 180 ||
    maxLon < -180 || maxLon > 180 ||
    minLat < -90 || minLat > 90 ||
    maxLat < -90 || maxLat > 90 ||
    minLon >= maxLon || minLat >= maxLat
  ) {
    return null;
  }

  return { minLon, minLat, maxLon, maxLat };
}

function parseLimit(raw: string | undefined): { value: number; error: { code: string; message: string } | null } {
  if (raw === undefined || raw === '') {
    return { value: DEFAULT_LIMIT, error: null };
  }

  const n = Number(raw);
  if (isNaN(n) || !Number.isInteger(n) || n < 1) {
    return { value: DEFAULT_LIMIT, error: { code: ErrorCodes.INVALID_LIMIT, message: 'Limit must be a positive integer.' } };
  }

  return { value: Math.min(n, MAX_LIMIT), error: null };
}

function parseSimplify(raw: string | undefined): { value: number; error: { code: string; message: string } | null } {
  if (raw === undefined || raw === '') {
    return { value: 0.05, error: null };
  }

  const n = Number(raw);
  if (isNaN(n) || n < 0) {
    return { value: 0.05, error: { code: ErrorCodes.INVALID_QUERY, message: 'Simplify must be a non-negative number.' } };
  }

  return { value: Math.min(n, 1), error: null };
}

interface SourceRow {
  sourceId: string;
  sourceName: string | null;
}

interface BorderBoundaryRow {
  id: string;
  layerId: string;
  sourceId: string;
  sourceObjectId: string | null;
  boundaryType: string;
  boundaryLevel: string | null;
  adminLevel: number | null;
  countryIso2: string | null;
  countryIso3: string | null;
  name: string;
  displayName: string | null;
  disputed: boolean;
  indiaSensitive: boolean;
  indiaComplianceStatus: string;
  geometry: Record<string, unknown>;
}

export async function bordersBoundariesRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: BordersBoundariesQuerystring }>(
    '/api/borders-boundaries/countries',
    async (request, reply) => {
      const { limit: rawLimit, bbox: rawBbox, source_id: rawSourceId, simplify: rawSimplify } = request.query;

      // Validate limit
      const parsedLimit = parseLimit(rawLimit);
      if (parsedLimit.error) {
        reply.code(400);
        return {
          error: {
            code: parsedLimit.error.code,
            message: parsedLimit.error.message,
            details: { provided: rawLimit },
          },
        };
      }
      const limit = parsedLimit.value;

      // Validate simplify
      const parsedSimplify = parseSimplify(rawSimplify);
      if (parsedSimplify.error) {
        reply.code(400);
        return {
          error: {
            code: parsedSimplify.error.code,
            message: parsedSimplify.error.message,
            details: { provided: rawSimplify },
          },
        };
      }
      const simplify = parsedSimplify.value;

      // Validate bbox
      let bbox: BBox | null = null;
      if (rawBbox !== undefined && rawBbox !== '') {
        bbox = parseBbox(rawBbox);
        if (!bbox) {
          reply.code(400);
          return {
            error: {
              code: ErrorCodes.INVALID_BBOX,
              message: 'Invalid bbox format. Expected: minLon,minLat,maxLon,maxLat. Valid ranges: lon [-180,180], lat [-90,90].',
              details: { provided: rawBbox },
            },
          };
        }
      }

      // Validate source_id
      const sourceId = (rawSourceId !== undefined && rawSourceId !== '') ? rawSourceId : DEFAULT_SOURCE_ID;
      if (!/^[a-zA-Z0-9_-]+$/.test(sourceId)) {
        reply.code(400);
        return {
          error: {
            code: ErrorCodes.INVALID_QUERY,
            message: 'Invalid source_id. Must contain only alphanumeric characters, hyphens, and underscores.',
            details: { provided: rawSourceId },
          },
        };
      }

      // Check database
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

      // Get source name
      let sourceName: string | null = null;
      try {
        const sourceRows = await query<SourceRow>(
          'SELECT source_id AS "sourceId", source_name AS "sourceName" FROM border_boundary_sources WHERE source_id = $1',
          [sourceId]
        );
        if (sourceRows.length > 0) {
          sourceName = sourceRows[0].sourceName;
        }
      } catch {
        // Source lookup failure is non-fatal; sourceName stays null
      }

      // Build query
      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      conditions.push('b.boundary_type = $' + paramIndex++);
      params.push('country_boundary');

      conditions.push('b.admin_level = $' + paramIndex++);
      params.push(0);

      conditions.push('b.source_id = $' + paramIndex++);
      params.push(sourceId);

      if (bbox) {
        conditions.push('ST_Intersects(b.geometry, ST_MakeEnvelope($' + paramIndex + ', $' + (paramIndex + 1) + ', $' + (paramIndex + 2) + ', $' + (paramIndex + 3) + ', 4326))');
        params.push(bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat);
        paramIndex += 4;
      }

      const whereClause = 'WHERE ' + conditions.join(' AND ');

      const geometryExpr = simplify > 0
        ? 'ST_AsGeoJSON(ST_SimplifyPreserveTopology(b.geometry, $' + paramIndex++ + '))::json AS geometry'
        : 'ST_AsGeoJSON(b.geometry)::json AS geometry';

      const sql = `
        SELECT
          b.id,
          b.layer_id AS "layerId",
          b.source_id AS "sourceId",
          b.source_object_id AS "sourceObjectId",
          b.boundary_type AS "boundaryType",
          b.boundary_level AS "boundaryLevel",
          b.admin_level AS "adminLevel",
          b.country_iso2 AS "countryIso2",
          b.country_iso3 AS "countryIso3",
          b.name,
          b.display_name AS "displayName",
          b.disputed,
          b.india_sensitive AS "indiaSensitive",
          b.india_compliance_status AS "indiaComplianceStatus",
          ${geometryExpr}
        FROM border_boundaries b
        ${whereClause}
        ORDER BY b.display_name NULLS LAST, b.name
        LIMIT $${paramIndex}
      `;

      if (simplify > 0) {
        params.push(simplify);
      }
      params.push(limit);

      // Execute query
      let rows: BorderBoundaryRow[];
      try {
        rows = await query<BorderBoundaryRow>(sql, params);
      } catch {
        reply.code(500);
        return {
          error: {
            code: ErrorCodes.INTERNAL_ERROR,
            message: 'An internal error occurred while fetching border boundaries.',
            details: {},
          },
        };
      }

      const features = rows.map((row) => ({
        type: 'Feature' as const,
        id: row.id,
        geometry: row.geometry,
        properties: {
          id: row.id,
          layerId: row.layerId,
          sourceId: row.sourceId,
          sourceObjectId: row.sourceObjectId,
          boundaryType: row.boundaryType,
          boundaryLevel: row.boundaryLevel,
          adminLevel: row.adminLevel,
          countryIso2: row.countryIso2,
          countryIso3: row.countryIso3,
          name: row.name,
          displayName: row.displayName,
          disputed: row.disputed,
          indiaSensitive: row.indiaSensitive,
          indiaComplianceStatus: row.indiaComplianceStatus,
        },
      }));

      return BordersBoundariesFeatureCollectionSchema.parse({
        type: 'FeatureCollection',
        features,
        meta: {
          count: features.length,
          limit,
          sourceId,
          sourceName,
          mvpLocalDevOnly: true,
          productionApproved: false,
          indiaCompliant: false,
          caveat: CAVEAT,
        },
      });
    }
  );
}
