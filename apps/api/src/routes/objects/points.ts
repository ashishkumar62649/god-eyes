import { query } from '../../lib/db.js';
import { AirportRow } from './types.js';
import { rowToAirportObject, rowToAirportMarkerObject } from './mapper.js';
import { buildFiltersApplied, buildListMetadata } from './metadata.js';
import { ParsedBBox } from './validation.js';
import {
  LayerObjectsListResponseSchema,
  AirportMarkerObjectsListResponseSchema,
  ErrorCodes,
  PayloadProfile,
  PayloadProfiles,
  CoordinateMode,
  CoordinateModes,
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
  coordinates: CoordinateMode;
}

export interface PointsResult {
  items: AirportObject[] | AirportMarkerObject[];
  total: number;
  filtersApplied: ReturnType<typeof buildFiltersApplied>;
}

// SQL join to get effective coordinates with override fallback
const OVERRIDE_COLUMNS = `
  a.id, a.layer_id, a.source_id, a.source_airport_id, a.ident, a.type_source,
  a.category_normalized, a.name, a.latitude_deg, a.longitude_deg,
  a.elevation_ft, a.iso_country, a.iso_region, a.municipality, a.iata_code,
  a.created_at, a.updated_at,
  o.override_latitude, o.override_longitude, o.id as override_id,
  o.confidence_score as override_confidence
`;

export function buildPointsSql(params: PointsQueryParams): { sql: string; params: unknown[]; paramIndex: number } {
  const isMarker = params.fields === PayloadProfiles.MARKER;
  const isEffective = params.coordinates === CoordinateModes.EFFECTIVE;

  let sql: string;
  let paramIndex = 1;
  const queryParams: unknown[] = [];

  if (isEffective) {
    // Join with active approved overrides - use COALESCE to prefer override, fallback to source
    sql = `
      SELECT ${isMarker
        ? `a.id, a.layer_id, a.source_id, a.source_airport_id, a.ident, a.type_source,
            a.category_normalized, a.name, a.latitude_deg, a.longitude_deg,
            a.elevation_ft, a.iso_country, a.iso_region, a.municipality, a.iata_code,
            a.created_at, a.updated_at,
            COALESCE(o.override_latitude, a.latitude_deg) as effective_latitude,
            COALESCE(o.override_longitude, a.longitude_deg) as effective_longitude,
            o.id as override_id, o.confidence_score as override_confidence`
        : OVERRIDE_COLUMNS + `,
            COALESCE(o.override_latitude, a.latitude_deg) as effective_latitude,
            COALESCE(o.override_longitude, a.longitude_deg) as effective_longitude`
      }
      FROM aviation_airports a
      LEFT JOIN aviation_coordinate_overrides o
        ON a.source_id = o.source_id
        AND a.source_airport_id = o.source_object_id
        AND o.active = true
      WHERE 1=1`;
  } else {
    // Default source coordinates - no join needed
    const selectColumns = isMarker
      ? 'id, layer_id, source_id, source_airport_id, ident, type_source, category_normalized, name, latitude_deg, longitude_deg, elevation_ft, iso_country, iso_region, municipality, iata_code, created_at, updated_at'
      : '*';
    sql = `SELECT ${selectColumns} FROM aviation_airports WHERE 1=1`;
  }

  // BBox filter using longitude/latitude columns
  if (params.bbox !== null) {
    const minLon = Math.max(params.bbox.minLon, -180);
    const maxLon = Math.min(params.bbox.maxLon, 180);
    const minLat = Math.max(params.bbox.minLat, -90);
    const maxLat = Math.min(params.bbox.maxLat, 90);

    // Use effective coordinates with alias "a" when isEffective=true,
    // otherwise use source columns without table alias
    const latCol = isEffective ? 'COALESCE(o.override_latitude, a.latitude_deg)' : 'latitude_deg';
    const lonCol = isEffective ? 'COALESCE(o.override_longitude, a.longitude_deg)' : 'longitude_deg';

    sql += ` AND ${lonCol} BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
    queryParams.push(minLon, maxLon);
    paramIndex += 2;

    sql += ` AND ${latCol} BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
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

// Extended row type for effective coordinates
interface AirportRowWithOverride extends AirportRow {
  effective_latitude?: number | null;
  effective_longitude?: number | null;
  override_id?: string | null;
  override_confidence?: string | null;
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

  const isEffective = params.coordinates === CoordinateModes.EFFECTIVE;
  const rows = isEffective
    ? await query<AirportRowWithOverride>(paginatedSql, paginatedParams)
    : await query<AirportRow>(paginatedSql, paginatedParams);

  // Map based on profile and coordinate mode
  const isMarker = params.fields === PayloadProfiles.MARKER;
  const items = isMarker
    ? rows.map((row) => {
        if (isEffective && 'effective_latitude' in row) {
          return rowToAirportMarkerObject(row as AirportRowWithOverride);
        }
        return rowToAirportMarkerObject(row as AirportRow);
      })
    : rows.map((row) => {
        if (isEffective && 'effective_latitude' in row) {
          return rowToAirportObjectWithEffective(row as AirportRowWithOverride);
        }
        return rowToAirportObject(row as AirportRow);
      });

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

// Mapper for effective coordinates - simpler version without contract-breaking metadata
function rowToAirportObjectWithEffective(row: AirportRowWithOverride): AirportObject {
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
      latitude: row.effective_latitude ?? row.latitude_deg,
      longitude: row.effective_longitude ?? row.longitude_deg,
    },
    elevationFt: row.elevation_ft,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

export function buildPointsResponse(
  result: PointsResult,
  limit: number,
  offset: number,
  fields: PayloadProfile,
  coordinates: CoordinateMode,
  search?: string
) {
  const hasBBox = result.filtersApplied?.bbox === true;
  const metadata = buildListMetadata(hasBBox, result.filtersApplied, search);

  // Add fields and coordinates profile to metadata
  const metadataExtras: Record<string, unknown> = {};
  if (fields === PayloadProfiles.MARKER) {
    metadataExtras.fields = 'marker';
  }
  if (coordinates === CoordinateModes.EFFECTIVE) {
    metadataExtras.coordinates = 'effective';
  }

  const metadataWithExtras = Object.keys(metadataExtras).length > 0
    ? { ...metadata, ...metadataExtras }
    : metadata;

  const responseData = {
    items: result.items,
    pagination: {
      limit,
      offset,
      returned: result.items.length,
      total: result.total,
    },
    mode: 'points' as const,
    metadata: metadataWithExtras,
  };

  // Use marker-specific schema for marker profile, default schema otherwise
  if (fields === PayloadProfiles.MARKER) {
    return AirportMarkerObjectsListResponseSchema.parse(responseData);
  }
  return LayerObjectsListResponseSchema.parse(responseData);
}

export async function handlePointsMode(params: PointsQueryParams) {
  try {
    const result = await executePointsQuery(params);
    return buildPointsResponse(result, params.limit, params.offset, params.fields, params.coordinates, params.search);
  } catch (error) {
    throw new Error(ErrorCodes.DATABASE_OFFLINE);
  }
}