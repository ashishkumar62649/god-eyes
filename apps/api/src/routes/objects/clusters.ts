import { query } from '../../lib/db.js';
import { ClusterRow } from './types.js';
import {
  LayerObjectsListResponseSchema,
  AirportClusterObjectSchema,
  ErrorCodes,
} from '@god-eyes/contracts';
import { ParsedBBox } from './validation.js';
import { buildListMetadata } from './metadata.js';

// Determine cluster grid size based on zoom level
export function getClusterGridSize(zoom: number | null): number {
  if (zoom === null) return 5; // degrees, fallback
  if (zoom < 4) return 20;
  if (zoom < 6) return 10;
  if (zoom < 8) return 5;
  if (zoom < 10) return 2;
  return 1;
}

export function buildClusterResponse(
  rows: ClusterRow[],
  bbox: ParsedBBox,
  zoom: number | null
) {
  const items = rows.map((row) => {
    const breakdown: Record<string, number> = {};
    const catCounts: Array<{ col: keyof ClusterRow; name: string }> = [
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
      const val = row[col];
      if (val !== null) {
        breakdown[name] = parseInt(val, 10);
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

export function buildClusterSql(bbox: ParsedBBox, gridSize: number, limit: number): { sql: string; params: unknown[] } {
  // Clamp bbox to world bounds for SQL
  const sqlMinLon = Math.max(bbox.minLon, -180);
  const sqlMaxLon = Math.min(bbox.maxLon, 180);
  const sqlMinLat = Math.max(bbox.minLat, -90);
  const sqlMaxLat = Math.min(bbox.maxLat, 90);

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

  return { sql: clusterSql, params: clusterParams };
}

export async function executeClusterQuery(bbox: ParsedBBox, zoom: number | null, limit: number) {
  const gridSize = getClusterGridSize(zoom);
  const { sql, params } = buildClusterSql(bbox, gridSize, limit);
  const rows = await query<ClusterRow>(sql, params);
  return rows;
}

export function buildClustersResponse(
  rows: ClusterRow[],
  bbox: ParsedBBox,
  zoom: number | null,
  limit: number
) {
  const items = buildClusterResponse(rows, bbox, zoom);

  // Validate cluster items match schema
  const validatedItems = items.map((item) => AirportClusterObjectSchema.parse(item));

  const metadata = buildListMetadata(true, { bbox: true });

  return LayerObjectsListResponseSchema.parse({
    items: validatedItems,
    pagination: {
      limit,
      offset: 0,
      returned: validatedItems.length,
      total: validatedItems.length,
    },
    mode: 'clusters' as const,
    metadata,
  });
}

export async function handleClusterMode(bbox: ParsedBBox, zoom: number | null, limit: number) {
  try {
    const rows = await executeClusterQuery(bbox, zoom, limit);
    return buildClustersResponse(rows, bbox, zoom, limit);
  } catch (error) {
    throw new Error(ErrorCodes.DATABASE_OFFLINE);
  }
}