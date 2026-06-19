import { query } from '../../lib/db.js';
import type { EarthEventRow } from './types.js';
import type { BBox } from './validation.js';

export const LAYER_ID = 'layer_03_earth_events';

export async function queryLatest(params: {
  eventType: string | null;
  bbox: BBox | null;
  since: string | null;
  limit: number;
}): Promise<EarthEventRow[]> {
  const { eventType, bbox, since, limit } = params;

  const conditions: string[] = [];
  const sqlParams: unknown[] = [];
  let paramIndex = 1;

  if (eventType !== null) {
    conditions.push(`event_type = $${paramIndex++}`);
    sqlParams.push(eventType);
  }

  if (bbox) {
    conditions.push(`ST_Intersects(geometry, ST_MakeEnvelope($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, 4326))`);
    sqlParams.push(bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat);
    paramIndex += 4;
  }

  if (since !== null) {
    conditions.push(`observed_at >= $${paramIndex++}`);
    sqlParams.push(since);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
      SELECT
        id,
        layer_id AS "layerId",
        source_id AS "sourceId",
        source_object_id AS "sourceObjectId",
        event_type AS "eventType",
        magnitude,
        magnitude_type AS "magnitudeType",
        depth_km AS "depthKm",
        place,
        alert_level AS "alertLevel",
        significance,
        tsunami,
        ST_AsGeoJSON(geometry)::json AS geometry,
        source_url AS "sourceUrl",
        observed_at AS "observedAt",
        updated_at AS "updatedAt",
        fetched_at AS "fetchedAt"
      FROM earth_events_latest
      ${whereClause}
      ORDER BY observed_at DESC
      LIMIT $${paramIndex}
    `;
  sqlParams.push(limit);

  return query<EarthEventRow>(sql, sqlParams);
}