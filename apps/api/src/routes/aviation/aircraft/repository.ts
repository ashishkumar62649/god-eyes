// Database access for the aviation aircraft route. All SQL queries live here.
import { query } from '../../../lib/db.js';
import type { BBox, AircraftLatestRow } from './types.js';

export async function listLatestAircraft(params: {
  bbox: BBox | null;
  limit: number;
  includeStale: boolean;
}): Promise<AircraftLatestRow[]> {
  const { bbox, limit, includeStale } = params;
  const conditions: string[] = [];
  const sqlParams: unknown[] = [];
  let paramIndex = 1;

  if (!includeStale) {
    conditions.push(`stale_after > $${paramIndex++}::timestamptz`);
    sqlParams.push('now()');
  }

  if (bbox) {
    conditions.push(`lon >= $${paramIndex}`);
    sqlParams.push(bbox.minLon);
    paramIndex++;
    conditions.push(`lon <= $${paramIndex}`);
    sqlParams.push(bbox.maxLon);
    paramIndex++;
    conditions.push(`lat >= $${paramIndex}`);
    sqlParams.push(bbox.minLat);
    paramIndex++;
    conditions.push(`lat <= $${paramIndex}`);
    sqlParams.push(bbox.maxLat);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT
      source_id AS "sourceId",
      source_object_id AS "sourceObjectId",
      callsign,
      registration,
      aircraft_type AS "aircraftType",
      db_flags AS "dbFlags",
      is_military AS "isMilitary",
      is_interesting AS "isInteresting",
      is_pia AS "isPia",
      is_ladd AS "isLadd",
      source_message_type AS "sourceMessageType",
      lat,
      lon,
      altitude_baro_ft AS "altitudeBaroFt",
      altitude_geom_ft AS "altitudeGeomFt",
      on_ground AS "onGround",
      ground_speed_kt AS "groundSpeedKt",
      track_deg AS "trackDeg",
      heading_mag_deg AS "headingMagDeg",
      heading_true_deg AS "headingTrueDeg",
      vertical_rate_fpm AS "verticalRateFpm",
      geom_rate_fpm AS "geomRateFpm",
      squawk,
      emergency,
      seen_seconds AS "seenSeconds",
      seen_pos_seconds AS "seenPosSeconds",
      observed_at AS "observedAt",
      received_at AS "receivedAt",
      stale_after AS "staleAfter",
      first_seen_at AS "firstSeenAt",
      last_seen_at AS "lastSeenAt"
    FROM aviation_aircraft_latest
    ${whereClause}
    ORDER BY observed_at DESC
    LIMIT $${paramIndex}
  `;
  sqlParams.push(limit);

  return query<AircraftLatestRow>(sql, sqlParams);
}

export async function getAircraftBySourceObjectId(sourceObjectId: string): Promise<AircraftLatestRow | null> {
  const sql = `
    SELECT
      source_id AS "sourceId",
      source_object_id AS "sourceObjectId",
      callsign,
      registration,
      aircraft_type AS "aircraftType",
      db_flags AS "dbFlags",
      is_military AS "isMilitary",
      is_interesting AS "isInteresting",
      is_pia AS "isPia",
      is_ladd AS "isLadd",
      source_message_type AS "sourceMessageType",
      lat,
      lon,
      altitude_baro_ft AS "altitudeBaroFt",
      altitude_geom_ft AS "altitudeGeomFt",
      on_ground AS "onGround",
      ground_speed_kt AS "groundSpeedKt",
      track_deg AS "trackDeg",
      heading_mag_deg AS "headingMagDeg",
      heading_true_deg AS "headingTrueDeg",
      vertical_rate_fpm AS "verticalRateFpm",
      geom_rate_fpm AS "geomRateFpm",
      squawk,
      emergency,
      seen_seconds AS "seenSeconds",
      seen_pos_seconds AS "seenPosSeconds",
      observed_at AS "observedAt",
      received_at AS "receivedAt",
      stale_after AS "staleAfter",
      first_seen_at AS "firstSeenAt",
      last_seen_at AS "lastSeenAt",
      raw_json AS "rawJson"
    FROM aviation_aircraft_latest
    WHERE source_id = $1
      AND source_object_id = $2
  `;
  const rows = await query<AircraftLatestRow>(sql, ['airplanes_live_v2', sourceObjectId]);
  return rows.length > 0 ? rows[0] : null;
}