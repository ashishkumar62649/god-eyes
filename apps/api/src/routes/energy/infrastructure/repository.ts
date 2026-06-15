import { query } from '../../../lib/db.js';
import type { BBox, EnergyFeatureRow, EnergyFeatureDetailRow, CategoryRow, SourceCountRow } from './types.js';

const DATA_SELECT = `
  id, layer_id AS "layerId", source_id AS "sourceId", source_object_id AS "sourceObjectId",
  feature_type AS "featureType", category, name, operator, owner, country, status,
  fuel_type AS "fuelType", capacity_mw AS "capacityMw", voltage_kv AS "voltageKv",
  pipeline_product AS "pipelineProduct", pipeline_length_km AS "pipelineLengthKm",
  terminal_type AS "terminalType", ST_AsGeoJSON(geom)::json AS geometry,
  centroid_lat AS "centroidLat", centroid_lon AS "centroidLon",
  source_confidence AS "sourceConfidence", source_updated_at AS "sourceUpdatedAt",
  first_seen_at AS "firstSeenAt", last_seen_at AS "lastSeenAt"
`;

function buildWhere(q: {
  country?: string; sourceId?: string; featureType?: string; category?: string;
  status?: string; fuelType?: string; minCapacityMw?: string; maxCapacityMw?: string;
  minVoltageKv?: string; maxVoltageKv?: string; pipelineProduct?: string; terminalType?: string;
  bbox?: BBox | null;
}): { conditions: string[]; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (q.country) { conditions.push(`country = $${i++}`); params.push(q.country); }
  if (q.sourceId) { conditions.push(`source_id = $${i++}`); params.push(q.sourceId); }
  if (q.featureType) { conditions.push(`feature_type = $${i++}`); params.push(q.featureType); }
  if (q.category) { conditions.push(`category = $${i++}`); params.push(q.category); }
  if (q.status) { conditions.push(`status = $${i++}`); params.push(q.status); }
  if (q.fuelType) { conditions.push(`fuel_type = $${i++}`); params.push(q.fuelType); }
  if (q.minCapacityMw) { conditions.push(`capacity_mw >= $${i++}`); params.push(Number(q.minCapacityMw)); }
  if (q.maxCapacityMw) { conditions.push(`capacity_mw <= $${i++}`); params.push(Number(q.maxCapacityMw)); }
  if (q.minVoltageKv) { conditions.push(`voltage_kv >= $${i++}`); params.push(Number(q.minVoltageKv)); }
  if (q.maxVoltageKv) { conditions.push(`voltage_kv <= $${i++}`); params.push(Number(q.maxVoltageKv)); }
  if (q.pipelineProduct) { conditions.push(`pipeline_product = $${i++}`); params.push(q.pipelineProduct); }
  if (q.terminalType) { conditions.push(`terminal_type = $${i++}`); params.push(q.terminalType); }
  if (q.bbox) {
    conditions.push(`ST_Intersects(geom, ST_MakeEnvelope($${i}, $${i+1}, $${i+2}, $${i+3}, 4326))`);
    params.push(q.bbox.minLon, q.bbox.minLat, q.bbox.maxLon, q.bbox.maxLat);
    i += 4;
  }

  return { conditions, params };
}

export async function queryInfrastructureList(params: {
  filters: { country?: string; sourceId?: string; featureType?: string; category?: string; status?: string; fuelType?: string; minCapacityMw?: string; maxCapacityMw?: string; minVoltageKv?: string; maxVoltageKv?: string; pipelineProduct?: string; terminalType?: string; bbox?: BBox | null };
  limit: number;
  offset: number;
}): Promise<{ rows: EnergyFeatureRow[]; totalCount: number }> {
  const { conditions, params: filterParams } = buildWhere(params.filters);
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const p = filterParams.length + 1;

  const [countRows, dataRows] = await Promise.all([
    query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM energy_infrastructure ${whereClause}`, filterParams),
    query<EnergyFeatureRow>(`SELECT ${DATA_SELECT} FROM energy_infrastructure ${whereClause} ORDER BY name NULLS LAST, id LIMIT $${p} OFFSET $${p+1}`, [...filterParams, params.limit, params.offset]),
  ]);

  return { rows: dataRows, totalCount: countRows[0]?.count ?? 0 };
}

export async function queryInfrastructureDetail(featureId: string): Promise<EnergyFeatureDetailRow | null> {
  const rows = await query<EnergyFeatureDetailRow>(
    `SELECT ${DATA_SELECT}, ST_AsGeoJSON(bbox)::json AS bbox, raw_source_json AS "rawSourceJson" FROM energy_infrastructure WHERE id = $1`,
    [featureId],
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function queryCategories(): Promise<CategoryRow[]> {
  return query<CategoryRow>(
    `SELECT feature_type AS "featureType", category, COUNT(*)::int AS count, SUM(capacity_mw) AS "totalCapacityMw", SUM(pipeline_length_km) AS "totalPipelineLengthKm" FROM energy_infrastructure GROUP BY feature_type, category ORDER BY category`,
  );
}

export async function querySourceCounts(): Promise<SourceCountRow[]> {
  return query<SourceCountRow>(
    `SELECT source_id AS "sourceId", COUNT(*)::int AS "featureCount", MAX(source_updated_at) AS "lastUpdated" FROM energy_infrastructure GROUP BY source_id`,
  );
}
