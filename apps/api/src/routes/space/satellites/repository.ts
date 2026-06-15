import { query } from '../../../lib/db.js';
import type { SatelliteRow } from './types.js';

const LAYER = 'layer_05_space_satellites';

const SAT_SELECT = `
  s.id::text AS "satelliteId", s.norad_cat_id AS "noradId", s.name,
  p.object_type AS "objectType", p.category, p.orbit_class AS "orbitClass",
  s.country, s.launch_date::text AS "launchDate",
  p.latitude, p.longitude, p.altitude_km AS "altitudeKm", p.velocity_kms AS "velocityKms",
  p.heading_deg AS "headingDeg", p.visual_shape AS "visualShape", p.visual_color AS "visualColor",
  p.is_important AS "important", p.estimated_at::text AS "estimatedAt",
  p.source_id AS "sourceId", p.source_object_id AS "sourceObjectId",
  p.source_age_seconds AS "sourceAgeSeconds"
`;

export async function listSatellites(params: {
  category?: string[]; objectType?: string[]; orbitClass?: string[]; sourceId?: string[];
  importantOnly?: boolean; minAltitude?: number; maxAltitude?: number; limit: number;
}): Promise<SatelliteRow[]> {
  const conditions: string[] = [];
  const sqlParams: unknown[] = [];
  let p = 1;

  if (params.category?.length) { const ph = params.category.map(() => `$${p++}`).join(', '); conditions.push(`p.category IN (${ph})`); sqlParams.push(...params.category); }
  if (params.objectType?.length) { const ph = params.objectType.map(() => `$${p++}`).join(', '); conditions.push(`p.object_type IN (${ph})`); sqlParams.push(...params.objectType); }
  if (params.orbitClass?.length) { const ph = params.orbitClass.map(() => `$${p++}`).join(', '); conditions.push(`p.orbit_class IN (${ph})`); sqlParams.push(...params.orbitClass); }
  if (params.sourceId?.length) { const ph = params.sourceId.map(() => `$${p++}`).join(', '); conditions.push(`p.source_id IN (${ph})`); sqlParams.push(...params.sourceId); }
  if (params.importantOnly) conditions.push(`p.is_important = TRUE`);
  if (params.minAltitude !== undefined) { conditions.push(`p.altitude_km >= $${p++}`); sqlParams.push(params.minAltitude); }
  if (params.maxAltitude !== undefined) { conditions.push(`p.altitude_km <= $${p++}`); sqlParams.push(params.maxAltitude); }

  const extra = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
  sqlParams.push(params.limit);

  return query<SatelliteRow>(
    `SELECT ${SAT_SELECT} FROM space_satellites s JOIN space_satellite_positions_latest p ON s.id = p.satellite_id WHERE s.layer_id = '${LAYER}' AND p.layer_id = '${LAYER}' ${extra} ORDER BY s.name ASC LIMIT $${p}`,
    sqlParams,
  );
}

export async function getSatelliteById(satelliteId: string): Promise<SatelliteRow | null> {
  const rows = await query<SatelliteRow>(
    `SELECT ${SAT_SELECT}, s.operator_or_owner AS "operator" FROM space_satellites s JOIN space_satellite_positions_latest p ON s.id = p.satellite_id WHERE s.id = $1 AND s.layer_id = '${LAYER}' AND p.layer_id = '${LAYER}'`,
    [satelliteId],
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function getCategories() {
  const [categories, objectTypes, orbitClasses, totals] = await Promise.all([
    query<{ category: string; count: number }>(`SELECT category, COUNT(*)::int AS count FROM space_satellite_positions_latest WHERE layer_id = '${LAYER}' GROUP BY category ORDER BY count DESC`),
    query<{ objectType: string; count: number }>(`SELECT object_type AS "objectType", COUNT(*)::int AS count FROM space_satellite_positions_latest WHERE layer_id = '${LAYER}' GROUP BY object_type ORDER BY count DESC`),
    query<{ orbitClass: string; count: number }>(`SELECT orbit_class AS "orbitClass", COUNT(*)::int AS count FROM space_satellite_positions_latest WHERE layer_id = '${LAYER}' GROUP BY orbit_class ORDER BY count DESC`),
    query<{ total_count: number; important_count: number }>(`SELECT COUNT(*)::int AS total_count, SUM(CASE WHEN is_important = TRUE THEN 1 ELSE 0 END)::int AS important_count FROM space_satellite_positions_latest WHERE layer_id = '${LAYER}'`),
  ]);
  return { categories, objectTypes, orbitClasses, totals };
}
