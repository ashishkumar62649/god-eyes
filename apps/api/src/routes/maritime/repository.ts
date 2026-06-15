import { query } from '../../lib/db.js';
import type { BBox, VesselObjectRow, VesselDetailRow, StatsRow, VesselTypeRow, PositionHistoryRow, VesselNameRow } from './types.js';

const LAYER_ID = 'layer_06_maritime';

const LIST_SELECT = `
  p.id, p.layer_id AS "layerId", p.source_id AS "sourceId", p.mmsi, p.dedupe_key AS "dedupeKey",
  p.latitude, p.longitude, p.speed_over_ground AS "speedOverGround",
  p.course_over_ground AS "courseOverGround", p.true_heading AS "trueHeading",
  p.navigation_status AS "navigationStatus", p.navigation_status_text AS "navigationStatusText",
  p.position_accuracy AS "positionAccuracy", p.received_at AS "receivedAt",
  v.vessel_name AS "vesselName", v.vessel_type AS "vesselType", v.vessel_type_code AS "vesselTypeCode",
  v.callsign, v.imo, v.destination, v.length_meters AS "lengthMeters", v.width_meters AS "widthMeters"
`;

const DETAIL_SELECT = `
  ${LIST_SELECT},
  p.raw_evidence_uri AS "rawEvidenceUri",
  v.draught_meters AS "draughtMeters", v.eta_month AS "etaMonth", v.eta_day AS "etaDay",
  v.eta_hour AS "etaHour", v.eta_minute AS "etaMinute", v.eta_display AS "etaDisplay",
  v.last_position_at AS "lastPositionAt", v.last_received_at AS "lastReceivedAt"
`;

export async function listVesselObjects(params: {
  bbox: BBox | null;
  vesselType: string | null;
  minSpeed: number | null;
  maxSpeed: number | null;
  updatedSince: string | null;
  mmsi: number | null;
  search: string | null;
  limit: number;
  offset: number;
}): Promise<VesselObjectRow[]> {
  const { bbox, vesselType, minSpeed, maxSpeed, updatedSince, mmsi, search, limit, offset } = params;
  const conditions: string[] = [`p.layer_id = $1`];
  const sqlParams: unknown[] = [LAYER_ID];
  let p = 2;

  if (bbox) { conditions.push(`p.geom && ST_MakeEnvelope($${p}, $${p+1}, $${p+2}, $${p+3}, 4326)`); sqlParams.push(bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat); p += 4; }
  if (vesselType !== null) { conditions.push(`v.vessel_type = $${p}`); sqlParams.push(vesselType); p++; }
  if (minSpeed !== null) { conditions.push(`p.speed_over_ground >= $${p}`); sqlParams.push(minSpeed); p++; }
  if (maxSpeed !== null) { conditions.push(`p.speed_over_ground <= $${p}`); sqlParams.push(maxSpeed); p++; }
  if (updatedSince !== null) { conditions.push(`p.received_at >= $${p}`); sqlParams.push(updatedSince); p++; }
  if (mmsi !== null) { conditions.push(`p.mmsi = $${p}`); sqlParams.push(mmsi); p++; }
  if (search !== null && search !== '') { conditions.push(`(v.vessel_name ILIKE $${p} OR v.callsign ILIKE $${p} OR p.mmsi::text ILIKE $${p})`); sqlParams.push(`%${search}%`); p++; }

  return query<VesselObjectRow>(
    `SELECT ${LIST_SELECT} FROM maritime_positions_latest p LEFT JOIN maritime_vessels v ON p.source_id = v.source_id AND p.mmsi = v.mmsi WHERE ${conditions.join(' AND ')} ORDER BY p.received_at DESC LIMIT $${p} OFFSET $${p+1}`,
    [...sqlParams, limit, offset],
  );
}

export async function getVesselByMmsi(mmsi: number): Promise<VesselDetailRow | null> {
  const rows = await query<VesselDetailRow>(
    `SELECT ${DETAIL_SELECT} FROM maritime_positions_latest p LEFT JOIN maritime_vessels v ON p.source_id = v.source_id AND p.mmsi = v.mmsi WHERE p.mmsi = $1 LIMIT 1`,
    [mmsi],
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function getStats(): Promise<{ stats: StatsRow; byVesselType: VesselTypeRow[] }> {
  const [statsRows, typeRows] = await Promise.all([
    query<StatsRow>(
      `SELECT COUNT(*)::int AS "totalVessels", COUNT(*) FILTER (WHERE p.received_at > NOW() - INTERVAL '1 hour')::int AS "activeVessels", COUNT(*) FILTER (WHERE p.received_at <= NOW() - INTERVAL '1 hour')::int AS "staleVessels", MAX(p.received_at) AS "lastUpdated" FROM maritime_positions_latest p WHERE p.layer_id = $1`,
      [LAYER_ID],
    ),
    query<VesselTypeRow>(
      `SELECT v.vessel_type AS "vesselType", COUNT(*)::int AS count FROM maritime_positions_latest p LEFT JOIN maritime_vessels v ON p.source_id = v.source_id AND p.mmsi = v.mmsi WHERE p.layer_id = $1 GROUP BY v.vessel_type`,
      [LAYER_ID],
    ),
  ]);
  const stats = statsRows[0] || { totalVessels: 0, activeVessels: 0, staleVessels: 0, lastUpdated: null };
  return { stats, byVesselType: typeRows };
}

export async function getPositionHistory(params: {
  mmsi: number;
  hours: number;
  limit: number;
}): Promise<{ positions: PositionHistoryRow[]; vesselName: string | null }> {
  const { mmsi, hours, limit } = params;
  const [nameRows, positions] = await Promise.all([
    query<VesselNameRow>(`SELECT vessel_name AS "vesselName" FROM maritime_vessels WHERE mmsi = $1 LIMIT 1`, [mmsi]),
    query<PositionHistoryRow>(
      `SELECT latitude, longitude, speed_over_ground AS "speedOverGround", course_over_ground AS "courseOverGround", true_heading AS "trueHeading", received_at AS "receivedAt" FROM maritime_position_history WHERE mmsi = $1 AND received_at > NOW() - INTERVAL '1 hour' * $2 ORDER BY received_at DESC LIMIT $3`,
      [mmsi, hours, limit],
    ),
  ]);
  return { positions, vesselName: nameRows.length > 0 ? nameRows[0].vesselName : null };
}
