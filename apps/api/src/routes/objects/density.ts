import { query } from '../../lib/db.js';
import { ParsedBBox } from './validation.js';
import {
  AirportDensityResponseSchema,
  ErrorCodes,
} from '@god-eyes/contracts';
import { tablesUnavailableError } from './errors.js';

export interface DensityQueryParams {
  bbox: ParsedBBox;
  cellSizeDegrees: number;
  includeClosed: boolean;
  category?: string;
  limit: number;
  offset: number;
}

export interface DensityResult {
  cells: DensityCell[];
  total: number;
  filtersApplied: {
    bbox: boolean;
    category?: string;
    includeClosed: boolean;
  };
}

interface DensityCell {
  id: string;
  layerId: string;
  objectType: 'airport_density';
  count: number;
  position: { latitude: number; longitude: number };
  bbox: { minLongitude: number; minLatitude: number; maxLongitude: number; maxLatitude: number };
  categoryCounts?: Record<string, number>;
}

const LAYER_ID = 'layer_01_aviation';

export function buildDensitySql(params: DensityQueryParams): { sql: string; params: unknown[] } {
  const { bbox, cellSizeDegrees, includeClosed, category } = params;

  // Clamp bbox to world bounds
  const minLon = Math.max(bbox.minLon, -180);
  const maxLon = Math.min(bbox.maxLon, 180);
  const minLat = Math.max(bbox.minLat, -90);
  const maxLat = Math.min(bbox.maxLat, 90);

  // Calculate cell boundaries using floor
  const cellLatStart = Math.floor(minLat / cellSizeDegrees) * cellSizeDegrees;
  const cellLonStart = Math.floor(minLon / cellSizeDegrees) * cellSizeDegrees;

  // Build WHERE clause
  let whereClause = 'WHERE longitude_deg BETWEEN $1 AND $2 AND latitude_deg BETWEEN $3 AND $4';
  const queryParams: unknown[] = [minLon, maxLon, minLat, maxLat];
  let paramIndex = 5;

  // Exclude closed_or_abandoned by default (unless includeClosed is true)
  if (!includeClosed) {
    whereClause += ` AND category_normalized != 'closed_or_abandoned'`;
  }

  // Add category filter if provided
  if (category) {
    whereClause += ` AND category_normalized = $${paramIndex}`;
    queryParams.push(category);
    paramIndex++;
  }

  // SQL with grid cell aggregation
  const sql = `
    SELECT
      -- Cell ID based on grid position
      'density:' || FLOOR(latitude_deg / ${cellSizeDegrees}) * ${cellSizeDegrees} || ':' ||
        FLOOR(longitude_deg / ${cellSizeDegrees}) * ${cellSizeDegrees} as cell_id,
      COUNT(*) as airport_count,
      -- Centroid position
      AVG(latitude_deg) as avg_latitude,
      AVG(longitude_deg) as avg_longitude,
      -- Cell bounds
      MIN(latitude_deg) as min_lat,
      MAX(latitude_deg) as max_lat,
      MIN(longitude_deg) as min_lon,
      MAX(longitude_deg) as max_lon
    FROM aviation_airports
    ${whereClause}
    GROUP BY
      FLOOR(latitude_deg / ${cellSizeDegrees}) * ${cellSizeDegrees},
      FLOOR(longitude_deg / ${cellSizeDegrees}) * ${cellSizeDegrees}
    ORDER BY airport_count DESC
  `;

  return { sql, params: queryParams };
}

export async function executeDensityQuery(params: DensityQueryParams): Promise<DensityResult> {
  const { sql, params: queryParams } = buildDensitySql(params);

  // Get total cell count
  const countSql = sql.replace(/SELECT .+ FROM/, 'SELECT COUNT(*) as count FROM')
    .replace(/GROUP BY.+$/, '')
    .replace(/ORDER BY.+$/, '');
  const countResult = await query<{ count: string }>(countSql, queryParams);
  const totalCells = parseInt(countResult[0]?.count || '0', 10);

  // Add pagination
  const paginatedSql = `${sql} LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
  const paginatedParams = [...queryParams, params.limit, params.offset];

  const rows = await query<{
    cell_id: string;
    airport_count: string;
    avg_latitude: string;
    avg_longitude: string;
    min_lat: string;
    max_lat: string;
    min_lon: string;
    max_lon: string;
  }>(paginatedSql, paginatedParams);

  const cells: DensityCell[] = rows.map((row) => ({
    id: row.cell_id,
    layerId: LAYER_ID,
    objectType: 'airport_density' as const,
    count: parseInt(row.airport_count, 10),
    position: {
      latitude: parseFloat(row.avg_latitude),
      longitude: parseFloat(row.avg_longitude),
    },
    bbox: {
      minLongitude: parseFloat(row.min_lon),
      minLatitude: parseFloat(row.min_lat),
      maxLongitude: parseFloat(row.max_lon),
      maxLatitude: parseFloat(row.max_lat),
    },
  }));

  return {
    cells,
    total: totalCells,
    filtersApplied: {
      bbox: true,
      category: params.category,
      includeClosed: params.includeClosed,
    },
  };
}

export function buildDensityResponse(
  result: DensityResult,
  limit: number,
  offset: number
) {
  const responseData = {
    items: result.cells,
    pagination: {
      limit,
      offset,
      returned: result.cells.length,
      total: result.total,
    },
    mode: 'density' as const,
    metadata: {
      filtersApplied: result.filtersApplied,
    },
  };

  return AirportDensityResponseSchema.parse(responseData);
}

export async function handleDensityMode(params: DensityQueryParams) {
  try {
    const result = await executeDensityQuery(params);
    return buildDensityResponse(result, params.limit, params.offset);
  } catch (error) {
    throw new Error(ErrorCodes.DATABASE_OFFLINE);
  }
}