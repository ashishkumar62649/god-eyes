import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { checkDatabaseStatus, query } from '../lib/db.js';
import {
  LayerObjectsListResponseSchema,
  LayerObjectDetailResponseSchema,
  ErrorCodes,
  NotImplementedResponseSchema,
  AirportClusterObjectSchema,
} from '@god-eyes/contracts';

// Valid airport categories
const VALID_CATEGORIES = [
  'international_or_major_airport',
  'regional_or_domestic_airport',
  'small_airfield',
  'heliport',
  'water_landing_site',
  'balloonport',
  'closed_or_abandoned',
  'unknown',
] as const;

export type ValidCategory = (typeof VALID_CATEGORIES)[number];

interface ObjectsQueryParams {
  objectType: string;
  limit?: string;
  offset?: string;
  bbox?: string;
  country?: string;
  category?: string;
  search?: string;
  mode?: string;
  zoom?: string;
}

interface ObjectsParams {
  layerId: string;
}

// Limit policy (documented):
// - Default limit: 500
// - General list max: 500 (production safety guard from WO-012)
// - Viewport/query max (bbox present): 1000 (WO-008 spatial queries may need more)
const MAX_LIST_LIMIT = 500;
const MAX_VIEWPORT_LIMIT = 1000;
const DEFAULT_LIMIT = 500;

interface ObjectDetailParams {
  layerId: string;
  objectId: string;
}

// Bounding box parsed from string
interface ParsedBBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
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
  created_at: Date | string;
  updated_at: Date | string;
}

function toContractDateTime(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}

export function rowToAirportObject(row: AirportRow) {
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
    createdAt: toContractDateTime(row.created_at),
    updatedAt: toContractDateTime(row.updated_at),
  };
}

// ==================== Validation Functions ====================

function parseBBox(bboxStr: string): ParsedBBox | null {
  const parts = bboxStr.split(',');
  if (parts.length !== 4) return null;

  const [minLon, minLat, maxLon, maxLat] = parts.map((p) => parseFloat(p.trim()));
  if ([minLon, minLat, maxLon, maxLat].some((v) => isNaN(v))) return null;

  return { minLon, minLat, maxLon, maxLat };
}

function validateBBox(bbox: ParsedBBox): string | null {
  if (bbox.minLon < -180 || bbox.minLon > 180) return 'minLon must be between -180 and 180';
  if (bbox.maxLon < -180 || bbox.maxLon > 180) return 'maxLon must be between -180 and 180';
  if (bbox.minLat < -90 || bbox.minLat > 90) return 'minLat must be between -90 and 90';
  if (bbox.maxLat < -90 || bbox.maxLat > 90) return 'maxLat must be between -90 and 90';
  if (bbox.minLon >= bbox.maxLon) return 'minLon must be less than maxLon';
  if (bbox.minLat >= bbox.maxLat) return 'minLat must be less than maxLat';
  return null;
}

function validateCategory(category: string): string | null {
  if (!VALID_CATEGORIES.includes(category as ValidCategory)) {
    return `Invalid category. Allowed: ${VALID_CATEGORIES.join(', ')}`;
  }
  return null;
}

function validateLimit(limitStr: string | undefined, maxLimit: number = MAX_LIST_LIMIT): { limit: number; valid: boolean; error: string | null } {
  if (limitStr === undefined) {
    return { limit: DEFAULT_LIMIT, valid: true, error: null };
  }

  const parsed = parseInt(limitStr, 10);
  if (isNaN(parsed) || parsed < 1) {
    return { limit: parsed, valid: false, error: 'limit must be a positive integer' };
  }
  if (parsed > maxLimit) {
    return { limit: maxLimit, valid: true, error: null }; // clamp to max
  }
  return { limit: parsed, valid: true, error: null };
}

function validateOffset(offsetStr: string | undefined): { offset: number; valid: boolean; error: string | null } {
  const parsed = parseInt(offsetStr || '0', 10);
  if (isNaN(parsed) || parsed < 0) {
    return { offset: parsed, valid: false, error: 'offset must be a non-negative integer' };
  }
  return { offset: parsed, valid: true, error: null };
}

function validateMode(mode: string | undefined): { mode: 'points' | 'clusters'; valid: boolean; error: string | null } {
  if (!mode || mode === 'points') return { mode: 'points', valid: true, error: null };
  if (mode === 'clusters') return { mode: 'clusters', valid: true, error: null };
  return { mode: 'points', valid: false, error: "mode must be 'points' or 'clusters'" };
}

function validateZoom(zoomStr: string | undefined): { zoom: number | null; valid: boolean; error: string | null } {
  if (!zoomStr) return { zoom: null, valid: true, error: null };

  const parsed = parseInt(zoomStr, 10);
  if (isNaN(parsed) || parsed < 0 || parsed > 22) {
    return { zoom: parsed, valid: false, error: 'zoom must be a number between 0 and 22' };
  }
  return { zoom: parsed, valid: true, error: null };
}

function makeErrorResponse(code: string, message: string, details: Record<string, unknown> = {}) {
  return {
    error: {
      code,
      message,
      details,
    },
  };
}

// ==================== Cluster Helper ====================

interface ClusterRow {
  cluster_id: string;
  center_lon: string;
  center_lat: string;
  airport_count: string;
  min_lon: string;
  min_lat: string;
  max_lon: string;
  max_lat: string;
  heliport_count: string | null;
  small_airfield_count: string | null;
  international_or_major_airport_count: string | null;
  regional_or_domestic_airport_count: string | null;
  water_landing_site_count: string | null;
  balloonport_count: string | null;
  closed_or_abandoned_count: string | null;
  unknown_count: string | null;
}

function buildClusterResponse(
  rows: ClusterRow[],
  bbox: ParsedBBox,
  zoom: number | null
) {
  const items = rows.map((row) => {
    const breakdown: Record<string, number> = {};
    const catCounts: Array<{ col: string; name: string }> = [
      { col: 'heliport_count', name: 'heliport' },
      { col: 'small_airfield_count', name: 'small_airfield' },
      { col: 'international_or_major_airport_count', name: 'international_or_major_airport' },
      { col: 'regional_or_domestic_airport_count', name: 'regional_or_domestic_airport' },
      { col: 'water_landing_site_count', name: 'water_landing_site' },
      { col: 'balloonport_count', name: 'balloonport' },
      { col: 'closed_or_abandoned_count', name: 'closed_or_abandoned' },
      { col: 'unknown_count', name: 'unknown' },
    ];

    for (const { col, name } of catCounts) {
      const val = row[col as keyof ClusterRow];
      if (val !== null) {
        breakdown[name] = parseInt(val as string, 10);
      }
    }

    return {
      id: `cluster:${row.cluster_id}`,
      layerId: 'layer_01_aviation' as const,
      objectType: 'airport_cluster' as const,
      count: parseInt(row.airport_count, 10),
      position: {
        latitude: parseFloat(row.center_lat),
        longitude: parseFloat(row.center_lon),
      },
      bbox: {
        minLongitude: parseFloat(row.min_lon),
        minLatitude: parseFloat(row.min_lat),
        maxLongitude: parseFloat(row.max_lon),
        maxLatitude: parseFloat(row.max_lat),
      },
      categoryBreakdown: breakdown,
    };
  });

  return items;
}

// Determine cluster grid size based on zoom level
function getClusterGridSize(zoom: number | null): number {
  if (zoom === null) return 5; // degrees, fallback
  if (zoom < 4) return 20;
  if (zoom < 6) return 10;
  if (zoom < 8) return 5;
  if (zoom < 10) return 2;
  return 1;
}

// ==================== Route ====================

export async function objectRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Params: ObjectsParams;
    Querystring: ObjectsQueryParams;
  }>('/api/layers/:layerId/objects', async (request, reply) => {
    const { layerId } = request.params;
    const {
      objectType,
      limit: limitStr,
      offset: offsetStr,
      bbox: bboxStr,
      country,
      category,
      search,
      mode: modeStr,
      zoom: zoomStr,
    } = request.query;

    // ---- Basic validation ----

    // Validate required parameter (WO-012 production hardening)
    if (!objectType) {
      reply.code(400);
      return makeErrorResponse(ErrorCodes.INVALID_QUERY, 'objectType is required.', {});
    }

    // Only layer_01_aviation is supported
    if (layerId !== 'layer_01_aviation') {
      reply.code(404);
      return makeErrorResponse(ErrorCodes.INVALID_LAYER, `Layer ${layerId} is not supported.`);
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

    // Validate bbox
    let parsedBBox: ParsedBBox | null = null;
    if (bboxStr !== undefined) {
      parsedBBox = parseBBox(bboxStr);
      if (parsedBBox === null) {
        reply.code(400);
        return makeErrorResponse(
          ErrorCodes.INVALID_BBOX,
          'bbox must be in format minLon,minLat,maxLon,maxLat',
          { received: bboxStr }
        );
      }
      const bboxError = validateBBox(parsedBBox);
      if (bboxError !== null) {
        reply.code(400);
        return makeErrorResponse(ErrorCodes.INVALID_BBOX, bboxError, {
          minLon: parsedBBox.minLon,
          minLat: parsedBBox.minLat,
          maxLon: parsedBBox.maxLon,
          maxLat: parsedBBox.maxLat,
        });
      }
    }

    // Validate category
    if (category !== undefined) {
      const catError = validateCategory(category);
      if (catError !== null) {
        reply.code(400);
        return makeErrorResponse(ErrorCodes.INVALID_CATEGORY, catError, { received: category });
      }
    }

    // Validate mode
    const modeValidation = validateMode(modeStr);
    if (!modeValidation.valid) {
      reply.code(400);
      return makeErrorResponse(ErrorCodes.INVALID_MODE, modeValidation.error!, { received: modeStr });
    }
    const mode = modeValidation.mode;

    // Validate zoom (reserved for future cluster behavior)
    const zoomValidation = validateZoom(zoomStr);
    if (!zoomValidation.valid) {
      reply.code(400);
      return makeErrorResponse(ErrorCodes.INVALID_QUERY, zoomValidation.error!, { received: zoomStr });
    }
    const zoom = zoomValidation.zoom;

    // Clusters require bbox
    if (mode === 'clusters' && parsedBBox === null) {
      reply.code(400);
      return makeErrorResponse(
        ErrorCodes.MISSING_BBOX,
        'bbox is required when mode=clusters',
        { hint: 'Use bbox=minLon,minLat,maxLon,maxLat' }
      );
    }

    // Validate limit/offset — viewport queries (bbox) allow up to 1000, general list max 500
    const effectiveMaxLimit = parsedBBox !== null ? MAX_VIEWPORT_LIMIT : MAX_LIST_LIMIT;
    const limitResult = validateLimit(limitStr, effectiveMaxLimit);
    if (!limitResult.valid) {
      reply.code(400);
      return makeErrorResponse(ErrorCodes.INVALID_LIMIT, limitResult.error!, { received: limitStr });
    }
    const limit = limitResult.limit;

    const offsetResult = validateOffset(offsetStr);
    if (!offsetResult.valid) {
      reply.code(400);
      return makeErrorResponse(ErrorCodes.INVALID_LIMIT, offsetResult.error!, { received: offsetStr });
    }
    const offset = offsetResult.offset;

    // ---- Database check ----
    const dbStatus = await checkDatabaseStatus();
    if (dbStatus.status === 'offline') {
      reply.code(503);
      return makeErrorResponse(ErrorCodes.DATABASE_OFFLINE, 'Database is not available.');
    }

    // ---- Mode: clusters ----
    if (mode === 'clusters') {
      try {
        const gridSize = getClusterGridSize(zoom);

        // Clamp bbox to world bounds for SQL
        const sqlMinLon = Math.max(parsedBBox!.minLon, -180);
        const sqlMaxLon = Math.min(parsedBBox!.maxLon, 180);
        const sqlMinLat = Math.max(parsedBBox!.minLat, -90);
        const sqlMaxLat = Math.min(parsedBBox!.maxLat, 90);

        const clusterSql = `
          WITH clusters AS (
            SELECT
              FLOOR((longitude_deg - $1) / $5)::text
              || '_' || FLOOR((latitude_deg - $2) / $5)::text
              || '_' || $5::text
              || '_' || FLOOR((longitude_deg - $1) / $5)::int::text
              || '_' || FLOOR((latitude_deg - $2) / $5)::int::text
              AS cluster_id,
              AVG(longitude_deg) AS center_lon,
              AVG(latitude_deg) AS center_lat,
              COUNT(*) AS airport_count,
              MIN(longitude_deg) AS min_lon,
              MIN(latitude_deg) AS min_lat,
              MAX(longitude_deg) AS max_lon,
              MAX(latitude_deg) AS max_lat,
              category_normalized
            FROM aviation_airports
            WHERE longitude_deg IS NOT NULL
              AND latitude_deg IS NOT NULL
              AND longitude_deg BETWEEN $1 AND $3
              AND latitude_deg BETWEEN $2 AND $4
            GROUP BY
              FLOOR((longitude_deg - $1) / $5),
              FLOOR((latitude_deg - $2) / $5),
              $5,
              category_normalized
          )
          SELECT
            cluster_id,
            AVG(center_lon) AS center_lon,
            AVG(center_lat) AS center_lat,
            SUM(airport_count)::text AS airport_count,
            MIN(min_lon) AS min_lon,
            MIN(min_lat) AS min_lat,
            MAX(max_lon) AS max_lon,
            MAX(max_lat) AS max_lat,
            SUM(CASE WHEN category_normalized = 'heliport' THEN airport_count ELSE 0 END)::text AS heliport_count,
            SUM(CASE WHEN category_normalized = 'small_airfield' THEN airport_count ELSE 0 END)::text AS small_airfield_count,
            SUM(CASE WHEN category_normalized = 'international_or_major_airport' THEN airport_count ELSE 0 END)::text AS international_or_major_airport_count,
            SUM(CASE WHEN category_normalized = 'regional_or_domestic_airport' THEN airport_count ELSE 0 END)::text AS regional_or_domestic_airport_count,
            SUM(CASE WHEN category_normalized = 'water_landing_site' THEN airport_count ELSE 0 END)::text AS water_landing_site_count,
            SUM(CASE WHEN category_normalized = 'balloonport' THEN airport_count ELSE 0 END)::text AS balloonport_count,
            SUM(CASE WHEN category_normalized = 'closed_or_abandoned' THEN airport_count ELSE 0 END)::text AS closed_or_abandoned_count,
            SUM(CASE WHEN category_normalized = 'unknown' THEN airport_count ELSE 0 END)::text AS unknown_count
          FROM clusters
          GROUP BY cluster_id
          ORDER BY airport_count DESC
          LIMIT $6
        `;

        const clusterParams = [sqlMinLon, sqlMinLat, sqlMaxLon, sqlMaxLat, gridSize, limit];

        const clusterRows = await query<ClusterRow>(clusterSql, clusterParams);
        const items = buildClusterResponse(clusterRows, parsedBBox!, zoom);

        // Validate cluster items match schema
        const validatedItems = items.map((item) => AirportClusterObjectSchema.parse(item));

        return LayerObjectsListResponseSchema.parse({
          items: validatedItems,
          pagination: {
            limit,
            offset: 0,
            returned: validatedItems.length,
            total: validatedItems.length,
          },
          mode: 'clusters' as const,
          metadata: {
            mode: 'standard',
            bboxApplied: true,
            generatedAt: new Date().toISOString(),
          },
        });
      } catch (error) {
        // Table might not exist or query error
        reply.code(503);
        return makeErrorResponse(ErrorCodes.DATABASE_OFFLINE, 'Aviation tables not available.');
      }
    }

    // ---- Mode: points ----

    // Build parameterized SQL
    let sql = 'SELECT * FROM aviation_airports WHERE 1=1';
    const params: unknown[] = [];
    let paramIndex = 1;

    // BBox filter using PostGIS geometry
    if (parsedBBox !== null) {
      const minLon = Math.max(parsedBBox.minLon, -180);
      const maxLon = Math.min(parsedBBox.maxLon, 180);
      const minLat = Math.max(parsedBBox.minLat, -90);
      const maxLat = Math.min(parsedBBox.maxLat, 90);

      sql += ` AND longitude_deg BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      params.push(minLon, maxLon);
      paramIndex += 2;

      sql += ` AND latitude_deg BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      params.push(minLat, maxLat);
      paramIndex += 2;
    }

    const filtersApplied: Record<string, unknown> = {};
    if (parsedBBox !== null) {
      filtersApplied.bbox = true;
    }

    if (country) {
      sql += ` AND iso_country = $${paramIndex}`;
      params.push(country.toUpperCase());
      paramIndex++;
      filtersApplied.country = country.toUpperCase();
    }

    if (category) {
      sql += ` AND category_normalized = $${paramIndex}`;
      params.push(category);
      paramIndex++;
      filtersApplied.category = category;
    }

    if (search) {
      sql += ` AND (name ILIKE $${paramIndex} OR ident ILIKE $${paramIndex} OR iata_code ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
      filtersApplied.search = search;
    }

    const metadataMode = search ? 'search' : 'standard';

    // Get total count (without pagination)
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
    try {
      const countResult = await query<{ count: string }>(countSql, params);
      const totalCount = parseInt(countResult[0]?.count || '0', 10);

      // Add pagination
      sql += ` ORDER BY name LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const rows = await query<AirportRow>(sql, params);
      const items = rows.map(rowToAirportObject);

      return LayerObjectsListResponseSchema.parse({
        items,
        pagination: {
          limit,
          offset,
          returned: items.length,
          total: totalCount,
        },
        mode: 'points' as const,
        metadata: {
          mode: metadataMode,
          filtersApplied: Object.keys(filtersApplied).length > 0 ? filtersApplied : undefined,
          bboxApplied: parsedBBox !== null ? true : undefined,
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      reply.code(503);
      return makeErrorResponse(ErrorCodes.DATABASE_OFFLINE, 'Aviation tables not available.');
    }
  });

  // GET /api/layers/:layerId/objects/:objectId - Get detail for one object
  fastify.get<{
    Params: ObjectDetailParams;
  }>('/api/layers/:layerId/objects/:objectId', async (request, reply) => {
    const { layerId, objectId } = request.params;

    if (layerId !== 'layer_01_aviation') {
      reply.code(404);
      return makeErrorResponse(ErrorCodes.INVALID_LAYER, `Layer ${layerId} is not supported.`);
    }

    const dbStatus = await checkDatabaseStatus();
    if (dbStatus.status === 'offline') {
      reply.code(503);
      return makeErrorResponse(ErrorCodes.DATABASE_OFFLINE, 'Database is not available.');
    }

    try {
      const rows = await query<AirportRow>(
        'SELECT * FROM aviation_airports WHERE id = $1',
        [objectId]
      );

      if (rows.length === 0) {
        reply.code(404);
        return makeErrorResponse(ErrorCodes.OBJECT_NOT_FOUND, `Airport not found: ${objectId}`);
      }

      return LayerObjectDetailResponseSchema.parse(rowToAirportObject(rows[0]));
    } catch (error) {
      reply.code(503);
      return makeErrorResponse(ErrorCodes.DATABASE_OFFLINE, 'Aviation tables not available.');
    }
  });
}