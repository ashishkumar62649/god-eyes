import { query } from '../../lib/db.js';
import { AirportRow } from './types.js';
import { rowToAirportObject, rowToAirportMarkerObject } from './mapper.js';
import { buildFiltersApplied, buildListMetadata } from './metadata.js';
import { ParsedBBox } from './validation.js';
import {
  LayerObjectsListResponseSchema,
  ErrorCodes,
  PayloadProfile,
  PayloadProfiles,
  AirportMarkerObject,
  AirportObject,
} from '@god-eyes/contracts';
import { tablesUnavailableError } from './errors.js';

export interface PointsQueryParams {
  bbox: ParsedBBox | null;
  country?: string;
  category?: string;
  search?: string;
  limit: number;
  offset: number;
  fields: PayloadProfile;
}

export interface PointsResult {
  items: AirportObject[] | AirportMarkerObject[];
  total: number;
  filtersApplied: ReturnType<typeof buildFiltersApplied>;
}

export function buildPointsSql(params: PointsQueryParams): { sql: string; params: unknown[]; paramIndex: number } {
  // In marker mode, select only needed columns for globe rendering
  const isMarker = params.fields === PayloadProfiles.MARKER;
  const selectColumns = isMarker
    ? 'id, layer_id, source_id, source_airport_id, ident, type_source, category_normalized, name, latitude_deg, longitude_deg, elevation_ft, iso_country, iso_region, municipality, iata_code, created_at, updated_at'
    : '*';

  let sql = `SELECT ${selectColumns} FROM aviation_airports WHERE 1=1`;
  const queryParams: unknown[] = [];
  let paramIndex = 1;

  // BBox filter using longitude/latitude columns
  if (params.bbox !== null) {
    const minLon = Math.max(params.bbox.minLon, -180);
    const maxLon = Math.min(params.bbox.maxLon, 180);
    const minLat = Math.max(params.bbox.minLat, -90);
    const maxLat = Math.min(params.bbox.maxLat, 90);

    sql += ` AND longitude_deg BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
    queryParams.push(minLon, maxLon);
    paramIndex += 2;

    sql += ` AND latitude_deg BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
    queryParams.push(minLat, maxLat);
    paramIndex += 2;
  }

  if (params.country) {
    sql += ` AND iso_country = $${paramIndex}`;
    queryParams.push(params.country.toUpperCase());
    paramIndex++;
  }

  if (params.category) {
    sql += ` AND category_normalized = $${paramIndex}`;
    queryParams.push(params.category);
    paramIndex++;
  }

  if (params.search) {
    sql += ` AND (name ILIKE $${paramIndex} OR ident ILIKE $${paramIndex} OR iata_code ILIKE $${paramIndex})`;
    queryParams.push(`%${params.search}%`);
    paramIndex++;
  }

  return { sql, params: queryParams, paramIndex };
}

export async function executePointsQuery(params: PointsQueryParams): Promise<PointsResult> {
  const { sql: baseSql, params: baseParams, paramIndex } = buildPointsSql(params);

  // Get total count (without pagination)
  const countSql = baseSql.replace(/SELECT .+ FROM/, 'SELECT COUNT(*) as count FROM');
  const countResult = await query<{ count: string }>(countSql, baseParams);
  const totalCount = parseInt(countResult[0]?.count || '0', 10);

  // Add pagination
  const paginatedSql = `${baseSql} ORDER BY name LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  const paginatedParams = [...baseParams, params.limit, params.offset];

  const rows = await query<AirportRow>(paginatedSql, paginatedParams);

  // Map based on profile
  const isMarker = params.fields === PayloadProfiles.MARKER;
  const items = isMarker
    ? rows.map(rowToAirportMarkerObject)
    : rows.map(rowToAirportObject);

  const filtersApplied = buildFiltersApplied(
    params.bbox !== null,
    params.country,
    params.category,
    params.search
  );

  return {
    items,
    total: totalCount,
    filtersApplied,
  };
}

export function buildPointsResponse(
  result: PointsResult,
  limit: number,
  offset: number,
  fields: PayloadProfile,
  search?: string
) {
  const hasBBox = result.filtersApplied?.bbox === true;
  const metadata = buildListMetadata(hasBBox, result.filtersApplied, search);

  // Add fields profile to metadata if marker mode
  const metadataWithFields = fields === PayloadProfiles.MARKER
    ? { ...metadata, fields: 'marker' }
    : metadata;

  return LayerObjectsListResponseSchema.parse({
    items: result.items,
    pagination: {
      limit,
      offset,
      returned: result.items.length,
      total: result.total,
    },
    mode: 'points' as const,
    metadata: metadataWithFields,
  });
}

export async function handlePointsMode(params: PointsQueryParams) {
  try {
    const result = await executePointsQuery(params);
    return buildPointsResponse(result, params.limit, params.offset, params.fields, params.search);
  } catch (error) {
    throw new Error(ErrorCodes.DATABASE_OFFLINE);
  }
}