import { FastifyInstance } from 'fastify';
import { checkDatabaseStatus, query } from '../lib/db.js';
import { ErrorCodes } from '@god-eyes/contracts';

const DEFAULT_LIMIT = 250;
const MAX_LIMIT = 500;
const DEFAULT_SOURCE_ID = 'natural_earth_admin0_boundary_lines_50m';
const SOURCE_NAME = 'Natural Earth Admin-0 Boundary Lines 1:50m';
const CAVEAT = 'Natural Earth Admin-0 Boundary Lines 1:50m is MVP/local/dev only; not production-approved; not India-compliant.';

interface LinesQuerystring {
  limit?: string;
  bbox?: string;
  source_id?: string;
  simplify?: string;
  line_type?: string;
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
  ) return null;
  return { minLon, minLat, maxLon, maxLat };
}

function parseLimit(raw: string | undefined): { value: number; error: { code: string; message: string } | null } {
  if (raw === undefined || raw === '') return { value: DEFAULT_LIMIT, error: null };
  const n = Number(raw);
  if (isNaN(n) || !Number.isInteger(n) || n < 1)
    return { value: DEFAULT_LIMIT, error: { code: ErrorCodes.INVALID_LIMIT, message: 'Limit must be a positive integer.' } };
  return { value: Math.min(n, MAX_LIMIT), error: null };
}

function parseSimplify(raw: string | undefined): { value: number; error: { code: string; message: string } | null } {
  if (raw === undefined || raw === '') return { value: 0, error: null };
  const n = Number(raw);
  if (isNaN(n) || n < 0)
    return { value: 0, error: { code: ErrorCodes.INVALID_QUERY, message: 'Simplify must be a non-negative number.' } };
  return { value: Math.min(n, 1.0), error: null };
}

interface BoundaryLineRow {
  id: string;
  geometry: Record<string, unknown>;
  properties: Record<string, unknown>;
}

export async function bordersBoundaryLinesRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: LinesQuerystring }>(
    '/api/borders-boundaries/lines',
    async (request, reply) => {
      const { limit: rawLimit, bbox: rawBbox, source_id: rawSourceId, simplify: rawSimplify, line_type: rawLineType } = request.query;

      const parsedLimit = parseLimit(rawLimit);
      if (parsedLimit.error) {
        reply.code(400);
        return { error: { code: parsedLimit.error.code, message: parsedLimit.error.message, details: { provided: rawLimit } } };
      }
      const limit = parsedLimit.value;

      const parsedSimplify = parseSimplify(rawSimplify);
      if (parsedSimplify.error) {
        reply.code(400);
        return { error: { code: parsedSimplify.error.code, message: parsedSimplify.error.message, details: { provided: rawSimplify } } };
      }
      const simplify = parsedSimplify.value;

      let bbox: BBox | null = null;
      if (rawBbox !== undefined && rawBbox !== '') {
        bbox = parseBbox(rawBbox);
        if (!bbox) {
          reply.code(400);
          return { error: { code: ErrorCodes.INVALID_BBOX, message: 'Invalid bbox format. Expected: minLon,minLat,maxLon,maxLat.', details: { provided: rawBbox } } };
        }
      }

      const sourceId = (rawSourceId && rawSourceId !== '') ? rawSourceId : DEFAULT_SOURCE_ID;
      const lineType = (rawLineType && rawLineType !== '') ? rawLineType : 'land';

      const dbStatus = await checkDatabaseStatus();
      if (dbStatus.status === 'offline') {
        reply.code(503);
        return { error: { code: ErrorCodes.DATABASE_OFFLINE, message: 'Database is not available.', details: {} } };
      }

      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      conditions.push(`source_id = $${paramIndex++}`);
      params.push(sourceId);

      conditions.push(`line_type = $${paramIndex++}`);
      params.push(lineType);

      if (bbox) {
        conditions.push(`ST_Intersects(geometry, ST_MakeEnvelope($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, 4326))`);
        params.push(bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat);
        paramIndex += 4;
      }

      const whereClause = 'WHERE ' + conditions.join(' AND ');

      let geometryExpr: string;
      if (simplify > 0) {
        geometryExpr = `ST_AsGeoJSON(ST_SimplifyPreserveTopology(geometry, $${paramIndex++}))::json AS geometry`;
        params.push(simplify);
      } else {
        geometryExpr = 'ST_AsGeoJSON(geometry)::json AS geometry';
      }

      const sql = `
        SELECT id, ${geometryExpr}, properties
        FROM borders_boundary_lines
        ${whereClause}
        LIMIT $${paramIndex}
      `;
      params.push(limit);

      let rows: BoundaryLineRow[];
      try {
        rows = await query<BoundaryLineRow>(sql, params);
      } catch {
        reply.code(500);
        return { error: { code: ErrorCodes.INTERNAL_ERROR, message: 'An internal error occurred while fetching boundary lines.', details: {} } };
      }

      const features = rows.map((row) => ({
        type: 'Feature' as const,
        geometry: row.geometry,
        properties: row.properties,
      }));

      return {
        type: 'FeatureCollection',
        features,
        meta: {
          count: features.length,
          sourceId,
          sourceName: SOURCE_NAME,
          mvpLocalDevOnly: true,
          productionApproved: false,
          indiaCompliant: false,
          caveat: CAVEAT,
        },
      };
    }
  );
}
