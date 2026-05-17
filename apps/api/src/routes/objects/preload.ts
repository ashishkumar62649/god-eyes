import { query } from '../../lib/db.js';
import {
  AirportPreloadListResponseSchema,
  AirportPreloadObject,
  ErrorCodes,
} from '@god-eyes/contracts';
import { VALID_CATEGORIES } from './constants.js';
import { tablesUnavailableError } from './errors.js';

export interface PreloadQueryParams {
  category: string;
  limit: number;
}

export interface PreloadCategoryCount {
  category: string;
  count: string;
}

const PRELOAD_COLUMNS = `
  id,
  ident,
  name,
  category_normalized as category,
  latitude_deg as latitude,
  longitude_deg as longitude,
  iso_country as country,
  iso_region as region,
  municipality,
  iata_code as "iataCode",
  gps_code as "gpsCode",
  local_code as "icaoCode",
  elevation_ft as "elevationFt",
  type_source as status
`;

export function buildPreloadSql(params: PreloadQueryParams): { sql: string; countSql: string; sqlParams: unknown[] } {
  const sqlParams: unknown[] = [];
  let paramIndex = 1;

  let whereClause = 'WHERE 1=1';

  if (params.category) {
    whereClause += ` AND category_normalized = $${paramIndex}`;
    sqlParams.push(params.category);
    paramIndex++;
  }

  const baseSql = `SELECT ${PRELOAD_COLUMNS} FROM aviation_airports ${whereClause}`;
  const countSql = `SELECT COUNT(*) as count FROM aviation_airports ${whereClause}`;

  const paginatedSql = `${baseSql} ORDER BY name LIMIT $${paramIndex}`;
  sqlParams.push(params.limit);

  return { sql: paginatedSql, countSql, sqlParams };
}

export async function executePreloadQuery(params: PreloadQueryParams): Promise<{
  items: AirportPreloadObject[];
  totalCount: number;
  category: string;
}> {
  const { sql, countSql, sqlParams } = buildPreloadSql(params);

  const countResult = await query<{ count: string }>(countSql, sqlParams.slice(0, -1));
  const totalCount = parseInt(countResult[0]?.count || '0', 10);

  const rows = await query<AirportPreloadObject>(sql, sqlParams);

  return {
    items: rows,
    totalCount,
    category: params.category,
  };
}

export async function fetchCategorySummary(): Promise<{ category: string; count: number }[]> {
  const rows = await query<PreloadCategoryCount>(
    `SELECT category_normalized as category, COUNT(*) as count
     FROM aviation_airports
     GROUP BY category_normalized
     ORDER BY count DESC`
  );

  return rows.map((row) => ({
    category: row.category,
    count: parseInt(row.count, 10),
  }));
}

export function buildPreloadResponse(
  result: Awaited<ReturnType<typeof executePreloadQuery>>,
  limit: number,
  summary?: { category: string; count: number }[]
) {
  const responseData = {
    items: result.items,
    metadata: {
      mode: 'preload' as const,
      category: result.category,
      returnedCount: result.items.length,
      totalCount: result.totalCount,
      generatedAt: new Date().toISOString(),
      summary,
    },
  };

  return AirportPreloadListResponseSchema.parse(responseData);
}

export async function handlePreloadMode(params: PreloadQueryParams) {
  try {
    const result = await executePreloadQuery(params);
    const summary = await fetchCategorySummary();
    return buildPreloadResponse(result, params.limit, summary);
  } catch (error) {
    throw new Error(ErrorCodes.DATABASE_OFFLINE);
  }
}
