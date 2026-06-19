// Database access for the borders-boundaries route. All SQL queries live here.
import { query } from '../../lib/db.js';
import type { SourceRow, BorderBoundaryRow, BBox } from './types.js';

export async function querySourceName(sourceId: string): Promise<SourceRow[]> {
  return query<SourceRow>(
    'SELECT source_id AS "sourceId", source_name AS "sourceName" FROM border_boundary_sources WHERE source_id = $1',
    [sourceId],
  );
}

export async function queryBorderBoundaries(params: {
  sourceId: string;
  bbox: BBox | null;
  simplify: number;
  limit: number;
}): Promise<BorderBoundaryRow[]> {
  const { sourceId, bbox, simplify, limit } = params;
  const conditions: string[] = [];
  const sqlParams: unknown[] = [];
  let paramIndex = 1;

  conditions.push('b.boundary_type = $' + paramIndex++);
  sqlParams.push('country_boundary');

  conditions.push('b.admin_level = $' + paramIndex++);
  sqlParams.push(0);

  conditions.push('b.source_id = $' + paramIndex++);
  sqlParams.push(sourceId);

  if (bbox) {
    conditions.push('ST_Intersects(b.geometry, ST_MakeEnvelope($' + paramIndex + ', $' + (paramIndex + 1) + ', $' + (paramIndex + 2) + ', $' + (paramIndex + 3) + ', 4326))');
    sqlParams.push(bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat);
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
    sqlParams.push(simplify);
  }
  sqlParams.push(limit);

  return query<BorderBoundaryRow>(sql, sqlParams);
}
