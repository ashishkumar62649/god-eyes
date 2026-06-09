import { FastifyInstance } from 'fastify';
import { checkDatabaseStatus, query } from '../lib/db.js';
import {
  MaritimeObjectsListResponseSchema,
  MaritimeVesselDetailResponseSchema,
  MaritimeStatsResponseSchema,
  MaritimePositionHistoryResponseSchema,
  ErrorCodes,
} from '@god-eyes/contracts';

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 10000;
const DEFAULT_OFFSET = 0;
const MAX_OFFSET = 10000;
const LAYER_ID = 'layer_06_maritime';

interface ObjectsQuerystring {
  bbox?: string;
  vessel_type?: string;
  min_speed?: string;
  max_speed?: string;
  updated_since?: string;
  mmsi?: string;
  search?: string;
  limit?: string;
  offset?: string;
}

interface ObjectIdParams {
  objectId: string;
}

interface MmsiParams {
  mmsi: string;
}

interface PositionsQuerystring {
  hours?: string;
  limit?: string;
}

interface BBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

interface VesselObjectRow {
  id: string;
  layerId: string;
  sourceId: string;
  mmsi: number;
  dedupeKey: string;
  latitude: number;
  longitude: number;
  speedOverGround: number | null;
  courseOverGround: number | null;
  trueHeading: number | null;
  navigationStatus: number | null;
  navigationStatusText: string | null;
  positionAccuracy: boolean | null;
  receivedAt: Date | string;
  vesselName: string | null;
  vesselType: string | null;
  vesselTypeCode: number | null;
  callsign: string | null;
  imo: number | null;
  destination: string | null;
  lengthMeters: number | null;
  widthMeters: number | null;
}

interface VesselDetailRow extends VesselObjectRow {
  rawEvidenceUri: string | null;
  draughtMeters: number | null;
  etaMonth: number | null;
  etaDay: number | null;
  etaHour: number | null;
  etaMinute: number | null;
  etaDisplay: string | null;
  lastPositionAt: Date | string | null;
  lastReceivedAt: Date | string | null;
}

interface StatsRow {
  totalVessels: number;
  activeVessels: number;
  staleVessels: number;
  lastUpdated: Date | string | null;
}

interface VesselTypeRow {
  vesselType: string | null;
  count: number;
}

interface PositionHistoryRow {
  latitude: number;
  longitude: number;
  speedOverGround: number | null;
  courseOverGround: number | null;
  trueHeading: number | null;
  receivedAt: Date | string;
}

interface VesselNameRow {
  vesselName: string | null;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (!isNaN(n) && isFinite(n)) return n;
  }
  return 0;
}

function toInteger(value: unknown): number {
  return Math.round(toNumber(value));
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (!isNaN(n) && isFinite(n)) return n;
  }
  return null;
}

function toIntegerOrNull(value: unknown): number | null {
  const n = toNumberOrNull(value);
  if (n === null) return null;
  return Math.round(n);
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return String(value);
}

function parseBbox(raw: string): BBox | null {
  const parts = raw.split(',').map((p) => p.trim());
  if (parts.length !== 4) return null;

  const [minLon, minLat, maxLon, maxLat] = parts.map(Number);

  if (
    isNaN(minLon) || isNaN(minLat) || isNaN(maxLon) || isNaN(maxLat) ||
    minLon < -180 || minLon > 180 ||
    maxLon < -180 || maxLon > 180 ||
    minLat < -90 || minLat > 90 ||
    maxLat < -90 || maxLat > 90 ||
    minLon >= maxLon || minLat >= maxLat
  ) {
    return null;
  }

  return { minLon, minLat, maxLon, maxLat };
}

function parseLimit(raw: string | undefined): { value: number; error: { code: string; message: string; details: Record<string, unknown> } | null } {
  if (raw === undefined || raw === '') {
    return { value: DEFAULT_LIMIT, error: null };
  }

  const n = Number(raw);
  if (isNaN(n) || !Number.isInteger(n) || n < 1) {
    return { value: DEFAULT_LIMIT, error: { code: ErrorCodes.INVALID_LIMIT, message: 'Limit must be a positive integer.', details: { provided: raw } } };
  }

  return { value: Math.min(n, MAX_LIMIT), error: null };
}

function parseOffset(raw: string | undefined): { value: number; error: { code: string; message: string; details: Record<string, unknown> } | null } {
  if (raw === undefined || raw === '') {
    return { value: DEFAULT_OFFSET, error: null };
  }

  const n = Number(raw);
  if (isNaN(n) || !Number.isInteger(n) || n < 0) {
    return { value: DEFAULT_OFFSET, error: { code: ErrorCodes.INVALID_QUERY, message: 'Offset must be a non-negative integer.', details: { provided: raw } } };
  }

  return { value: Math.min(n, MAX_OFFSET), error: null };
}

function parseNumeric(raw: string | undefined): number | null {
  if (raw === undefined || raw === '') return null;
  const n = Number(raw);
  if (isNaN(n)) return null;
  return n;
}

function parseMmsi(raw: string | undefined): number | null {
  if (raw === undefined || raw === '') return null;
  const n = Number(raw);
  if (isNaN(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

function parseHours(raw: string | undefined): { value: number; error: { code: string; message: string } | null } {
  if (raw === undefined || raw === '') {
    return { value: 24, error: null };
  }
  const n = Number(raw);
  if (isNaN(n) || !Number.isInteger(n) || n < 1 || n > 168) {
    return { value: 24, error: { code: ErrorCodes.INVALID_QUERY, message: 'Hours must be an integer between 1 and 168.' } };
  }
  return { value: n, error: null };
}

function parseHistoryLimit(raw: string | undefined): { value: number; error: { code: string; message: string } | null } {
  if (raw === undefined || raw === '') {
    return { value: 500, error: null };
  }
  const n = Number(raw);
  if (isNaN(n) || !Number.isInteger(n) || n < 1 || n > 5000) {
    return { value: 500, error: { code: ErrorCodes.INVALID_LIMIT, message: 'Limit must be an integer between 1 and 5000.' } };
  }
  return { value: n, error: null };
}

function isValidIsoDatetime(raw: string): boolean {
  const d = new Date(raw);
  return d instanceof Date && !isNaN(d.getTime()) && (raw.includes('T') || raw.includes(' '));
}

function rowToVesselObject(row: VesselObjectRow) {
  const receivedAt = toIsoString(row.receivedAt);
  const receivedMs = new Date(receivedAt).getTime();
  const dataAgeSeconds = isNaN(receivedMs) ? null : Math.floor((Date.now() - receivedMs) / 1000);

  return {
    id: row.id,
    layerId: LAYER_ID,
    sourceId: row.sourceId,
    mmsi: toInteger(row.mmsi),
    dedupeKey: row.dedupeKey,
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    speedOverGround: toNumberOrNull(row.speedOverGround),
    courseOverGround: toNumberOrNull(row.courseOverGround),
    trueHeading: toIntegerOrNull(row.trueHeading),
    navigationStatus: toIntegerOrNull(row.navigationStatus),
    navigationStatusText: row.navigationStatusText,
    positionAccuracy: row.positionAccuracy === null ? null : Boolean(row.positionAccuracy),
    receivedAt,
    dataAgeSeconds,
    vesselName: row.vesselName,
    vesselType: row.vesselType,
    vesselTypeCode: toIntegerOrNull(row.vesselTypeCode),
    callsign: row.callsign,
    imo: toIntegerOrNull(row.imo),
    destination: row.destination,
    lengthMeters: toNumberOrNull(row.lengthMeters),
    widthMeters: toNumberOrNull(row.widthMeters),
  };
}

function rowToVesselDetail(row: VesselDetailRow) {
  const base = rowToVesselObject(row);
  return {
    ...base,
    rawEvidenceUri: row.rawEvidenceUri,
    draughtMeters: toNumberOrNull(row.draughtMeters),
    etaMonth: toIntegerOrNull(row.etaMonth),
    etaDay: toIntegerOrNull(row.etaDay),
    etaHour: toIntegerOrNull(row.etaHour),
    etaMinute: toIntegerOrNull(row.etaMinute),
    etaDisplay: row.etaDisplay,
    lastPositionAt: row.lastPositionAt ? toIsoString(row.lastPositionAt) : null,
    lastReceivedAt: row.lastReceivedAt ? toIsoString(row.lastReceivedAt) : null,
  };
}

const LIST_SELECT_COLUMNS = `
  p.id,
  p.layer_id AS "layerId",
  p.source_id AS "sourceId",
  p.mmsi,
  p.dedupe_key AS "dedupeKey",
  p.latitude,
  p.longitude,
  p.speed_over_ground AS "speedOverGround",
  p.course_over_ground AS "courseOverGround",
  p.true_heading AS "trueHeading",
  p.navigation_status AS "navigationStatus",
  p.navigation_status_text AS "navigationStatusText",
  p.position_accuracy AS "positionAccuracy",
  p.received_at AS "receivedAt",
  v.vessel_name AS "vesselName",
  v.vessel_type AS "vesselType",
  v.vessel_type_code AS "vesselTypeCode",
  v.callsign,
  v.imo,
  v.destination,
  v.length_meters AS "lengthMeters",
  v.width_meters AS "widthMeters"
`;

const DETAIL_SELECT_COLUMNS = `
  p.id,
  p.layer_id AS "layerId",
  p.source_id AS "sourceId",
  p.mmsi,
  p.dedupe_key AS "dedupeKey",
  p.latitude,
  p.longitude,
  p.speed_over_ground AS "speedOverGround",
  p.course_over_ground AS "courseOverGround",
  p.true_heading AS "trueHeading",
  p.navigation_status AS "navigationStatus",
  p.navigation_status_text AS "navigationStatusText",
  p.position_accuracy AS "positionAccuracy",
  p.received_at AS "receivedAt",
  p.raw_evidence_uri AS "rawEvidenceUri",
  v.vessel_name AS "vesselName",
  v.vessel_type AS "vesselType",
  v.vessel_type_code AS "vesselTypeCode",
  v.callsign,
  v.imo,
  v.destination,
  v.length_meters AS "lengthMeters",
  v.width_meters AS "widthMeters",
  v.draught_meters AS "draughtMeters",
  v.eta_month AS "etaMonth",
  v.eta_day AS "etaDay",
  v.eta_hour AS "etaHour",
  v.eta_minute AS "etaMinute",
  v.eta_display AS "etaDisplay",
  v.last_position_at AS "lastPositionAt",
  v.last_received_at AS "lastReceivedAt"
`;

async function listVesselObjects(params: {
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
  let paramIndex = 2;

  if (bbox) {
    conditions.push(`p.geom && ST_MakeEnvelope($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, 4326)`);
    sqlParams.push(bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat);
    paramIndex += 4;
  }

  if (vesselType !== null) {
    conditions.push(`v.vessel_type = $${paramIndex}`);
    sqlParams.push(vesselType);
    paramIndex++;
  }

  if (minSpeed !== null) {
    conditions.push(`p.speed_over_ground >= $${paramIndex}`);
    sqlParams.push(minSpeed);
    paramIndex++;
  }

  if (maxSpeed !== null) {
    conditions.push(`p.speed_over_ground <= $${paramIndex}`);
    sqlParams.push(maxSpeed);
    paramIndex++;
  }

  if (updatedSince !== null) {
    conditions.push(`p.received_at >= $${paramIndex}`);
    sqlParams.push(updatedSince);
    paramIndex++;
  }

  if (mmsi !== null) {
    conditions.push(`p.mmsi = $${paramIndex}`);
    sqlParams.push(mmsi);
    paramIndex++;
  }

  if (search !== null && search !== '') {
    conditions.push(`(v.vessel_name ILIKE $${paramIndex} OR v.callsign ILIKE $${paramIndex} OR p.mmsi::text ILIKE $${paramIndex})`);
    sqlParams.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT ${LIST_SELECT_COLUMNS}
    FROM maritime_positions_latest p
    LEFT JOIN maritime_vessels v ON p.source_id = v.source_id AND p.mmsi = v.mmsi
    ${whereClause}
    ORDER BY p.received_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  sqlParams.push(limit, offset);

  return query<VesselObjectRow>(sql, sqlParams);
}

async function getVesselObjectByMmsi(mmsi: number): Promise<VesselDetailRow | null> {
  const sql = `
    SELECT ${DETAIL_SELECT_COLUMNS}
    FROM maritime_positions_latest p
    LEFT JOIN maritime_vessels v ON p.source_id = v.source_id AND p.mmsi = v.mmsi
    WHERE p.mmsi = $1
    LIMIT 1
  `;
  const rows = await query<VesselDetailRow>(sql, [mmsi]);
  return rows.length > 0 ? rows[0] : null;
}

async function getStats(): Promise<{ stats: StatsRow; byVesselType: VesselTypeRow[] }> {
  const statsSql = `
    SELECT
      COUNT(*)::int AS "totalVessels",
      COUNT(*) FILTER (WHERE p.received_at > NOW() - INTERVAL '1 hour')::int AS "activeVessels",
      COUNT(*) FILTER (WHERE p.received_at <= NOW() - INTERVAL '1 hour')::int AS "staleVessels",
      MAX(p.received_at) AS "lastUpdated"
    FROM maritime_positions_latest p
    WHERE p.layer_id = $1
  `;
  const statsRows = await query<StatsRow>(statsSql, [LAYER_ID]);
  const stats = statsRows[0] || { totalVessels: 0, activeVessels: 0, staleVessels: 0, lastUpdated: null };

  const typeSql = `
    SELECT v.vessel_type AS "vesselType", COUNT(*)::int AS count
    FROM maritime_positions_latest p
    LEFT JOIN maritime_vessels v ON p.source_id = v.source_id AND p.mmsi = v.mmsi
    WHERE p.layer_id = $1
    GROUP BY v.vessel_type
  `;
  const typeRows = await query<VesselTypeRow>(typeSql, [LAYER_ID]);

  return { stats, byVesselType: typeRows };
}

async function getPositionHistory(params: {
  mmsi: number;
  hours: number;
  limit: number;
}): Promise<{ positions: PositionHistoryRow[]; vesselName: string | null }> {
  const { mmsi, hours, limit } = params;

  const nameSql = `
    SELECT vessel_name AS "vesselName"
    FROM maritime_vessels
    WHERE mmsi = $1
    LIMIT 1
  `;
  const nameRows = await query<VesselNameRow>(nameSql, [mmsi]);
  const vesselName = nameRows.length > 0 ? nameRows[0].vesselName : null;

  const posSql = `
    SELECT
      latitude,
      longitude,
      speed_over_ground AS "speedOverGround",
      course_over_ground AS "courseOverGround",
      true_heading AS "trueHeading",
      received_at AS "receivedAt"
    FROM maritime_position_history
    WHERE mmsi = $1
      AND received_at > NOW() - INTERVAL '1 hour' * $2
    ORDER BY received_at DESC
    LIMIT $3
  `;
  const positions = await query<PositionHistoryRow>(posSql, [mmsi, hours, limit]);

  return { positions, vesselName };
}

export async function maritimeRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: ObjectsQuerystring }>(
    `/api/layers/${LAYER_ID}/objects`,
    async (request, reply) => {
      const { bbox: rawBbox, vessel_type: rawVesselType, min_speed: rawMinSpeed, max_speed: rawMaxSpeed, updated_since: rawUpdatedSince, mmsi: rawMmsi, search: rawSearch, limit: rawLimit, offset: rawOffset } = request.query;

      const parsedLimit = parseLimit(rawLimit);
      if (parsedLimit.error) {
        reply.code(400);
        return { error: parsedLimit.error };
      }

      const parsedOffset = parseOffset(rawOffset);
      if (parsedOffset.error) {
        reply.code(400);
        return { error: parsedOffset.error };
      }

      let bbox: BBox | null = null;
      if (rawBbox !== undefined && rawBbox !== '') {
        bbox = parseBbox(rawBbox);
        if (!bbox) {
          reply.code(400);
          return {
            error: {
              code: ErrorCodes.INVALID_BBOX,
              message: 'Invalid bbox format. Expected: minLon,minLat,maxLon,maxLat. Valid ranges: lon [-180,180], lat [-90,90]. minLon < maxLon and minLat < maxLat required.',
              details: { provided: rawBbox },
            },
          };
        }
      }

      const vesselType = rawVesselType !== undefined && rawVesselType !== '' ? rawVesselType : null;
      const minSpeed = parseNumeric(rawMinSpeed);
      const maxSpeed = parseNumeric(rawMaxSpeed);

      if (rawUpdatedSince !== undefined && rawUpdatedSince !== '') {
        if (!isValidIsoDatetime(rawUpdatedSince)) {
          reply.code(400);
          return {
            error: {
              code: ErrorCodes.INVALID_QUERY,
              message: 'Invalid updated_since format. Expected ISO 8601 datetime.',
              details: { provided: rawUpdatedSince },
            },
          };
        }
      }
      const updatedSince = rawUpdatedSince !== undefined && rawUpdatedSince !== '' ? rawUpdatedSince : null;

      const mmsi = parseMmsi(rawMmsi);
      const search = rawSearch !== undefined && rawSearch !== '' ? rawSearch : null;

      const dbStatus = await checkDatabaseStatus();
      if (dbStatus.status === 'offline') {
        reply.code(503);
        return {
          error: {
            code: ErrorCodes.DATABASE_OFFLINE,
            message: 'Database is not available.',
            details: {},
          },
        };
      }

      let rows: VesselObjectRow[];
      try {
        rows = await listVesselObjects({
          bbox,
          vesselType,
          minSpeed,
          maxSpeed,
          updatedSince,
          mmsi,
          search,
          limit: parsedLimit.value,
          offset: parsedOffset.value,
        });
      } catch {
        reply.code(500);
        return {
          error: {
            code: ErrorCodes.INTERNAL_ERROR,
            message: 'An internal error occurred while fetching maritime vessel data.',
            details: {},
          },
        };
      }

      const objects = rows.map(rowToVesselObject);

      return MaritimeObjectsListResponseSchema.parse({
        objects,
        metadata: {
          count: objects.length,
          limit: parsedLimit.value,
          offset: parsedOffset.value,
          generatedAt: new Date().toISOString(),
        },
      });
    }
  );

  fastify.get<{ Params: ObjectIdParams }>(
    `/api/layers/${LAYER_ID}/objects/:objectId`,
    async (request, reply) => {
      const { objectId } = request.params;

      const mmsi = Number(objectId);
      if (isNaN(mmsi) || !Number.isInteger(mmsi) || mmsi <= 0) {
        reply.code(400);
        return {
          error: {
            code: ErrorCodes.INVALID_QUERY,
            message: 'objectId must be a valid MMSI (positive integer).',
            details: { provided: objectId },
          },
        };
      }

      const dbStatus = await checkDatabaseStatus();
      if (dbStatus.status === 'offline') {
        reply.code(503);
        return {
          error: {
            code: ErrorCodes.DATABASE_OFFLINE,
            message: 'Database is not available.',
            details: {},
          },
        };
      }

      let row: VesselDetailRow | null;
      try {
        row = await getVesselObjectByMmsi(mmsi);
      } catch {
        reply.code(500);
        return {
          error: {
            code: ErrorCodes.INTERNAL_ERROR,
            message: 'An internal error occurred while fetching vessel detail.',
            details: {},
          },
        };
      }

      if (!row) {
        reply.code(404);
        return {
          error: {
            code: ErrorCodes.OBJECT_NOT_FOUND,
            message: `Vessel with MMSI ${mmsi} was not found.`,
            details: { mmsi },
          },
        };
      }

      return MaritimeVesselDetailResponseSchema.parse({
        vessel: rowToVesselDetail(row),
      });
    }
  );

  fastify.get(
    `/api/layers/${LAYER_ID}/stats`,
    async (_request, reply) => {
      const dbStatus = await checkDatabaseStatus();
      if (dbStatus.status === 'offline') {
        reply.code(503);
        return {
          error: {
            code: ErrorCodes.DATABASE_OFFLINE,
            message: 'Database is not available.',
            details: {},
          },
        };
      }

      let result: { stats: StatsRow; byVesselType: VesselTypeRow[] };
      try {
        result = await getStats();
      } catch {
        reply.code(500);
        return {
          error: {
            code: ErrorCodes.INTERNAL_ERROR,
            message: 'An internal error occurred while fetching maritime stats.',
            details: {},
          },
        };
      }

      const { stats, byVesselType } = result;
      const byVesselTypeRecord: Record<string, number> = {};
      for (const row of byVesselType) {
        const key = row.vesselType || 'unknown';
        byVesselTypeRecord[key] = toInteger(row.count);
      }

      let dataFreshnessSeconds: number | null = null;
      if (stats.lastUpdated) {
        const lastUpdated = new Date(toIsoString(stats.lastUpdated)).getTime();
        if (!isNaN(lastUpdated)) {
          dataFreshnessSeconds = Math.floor((Date.now() - lastUpdated) / 1000);
        }
      }

      return MaritimeStatsResponseSchema.parse({
        layerId: LAYER_ID,
        totalVessels: toInteger(stats.totalVessels),
        activeVessels: toInteger(stats.activeVessels),
        staleVessels: toInteger(stats.staleVessels),
        byVesselType: byVesselTypeRecord,
        lastUpdated: stats.lastUpdated ? toIsoString(stats.lastUpdated) : null,
        dataFreshnessSeconds,
        sourceId: 'aisstream',
        generatedAt: new Date().toISOString(),
      });
    }
  );

  fastify.get<{ Params: MmsiParams; Querystring: PositionsQuerystring }>(
    `/api/layers/${LAYER_ID}/vessels/:mmsi/positions`,
    async (request, reply) => {
      const { mmsi: rawMmsi } = request.params;
      const { hours: rawHours, limit: rawLimit } = request.query;

      const mmsi = Number(rawMmsi);
      if (isNaN(mmsi) || !Number.isInteger(mmsi) || mmsi <= 0) {
        reply.code(400);
        return {
          error: {
            code: ErrorCodes.INVALID_QUERY,
            message: 'MMSI must be a positive integer.',
            details: { provided: rawMmsi },
          },
        };
      }

      const parsedHours = parseHours(rawHours);
      if (parsedHours.error) {
        reply.code(400);
        return {
          error: {
            code: parsedHours.error.code,
            message: parsedHours.error.message,
            details: { provided: rawHours },
          },
        };
      }

      const parsedLimit = parseHistoryLimit(rawLimit);
      if (parsedLimit.error) {
        reply.code(400);
        return {
          error: {
            code: parsedLimit.error.code,
            message: parsedLimit.error.message,
            details: { provided: rawLimit },
          },
        };
      }

      const dbStatus = await checkDatabaseStatus();
      if (dbStatus.status === 'offline') {
        reply.code(503);
        return {
          error: {
            code: ErrorCodes.DATABASE_OFFLINE,
            message: 'Database is not available.',
            details: {},
          },
        };
      }

      let result: { positions: PositionHistoryRow[]; vesselName: string | null };
      try {
        result = await getPositionHistory({
          mmsi,
          hours: parsedHours.value,
          limit: parsedLimit.value,
        });
      } catch {
        reply.code(500);
        return {
          error: {
            code: ErrorCodes.INTERNAL_ERROR,
            message: 'An internal error occurred while fetching position history.',
            details: {},
          },
        };
      }

      const positions = result.positions.map((row) => ({
        latitude: toNumber(row.latitude),
        longitude: toNumber(row.longitude),
        speedOverGround: toNumberOrNull(row.speedOverGround),
        courseOverGround: toNumberOrNull(row.courseOverGround),
        trueHeading: toIntegerOrNull(row.trueHeading),
        receivedAt: toIsoString(row.receivedAt),
      }));

      return MaritimePositionHistoryResponseSchema.parse({
        mmsi: toInteger(mmsi),
        vesselName: result.vesselName,
        positions,
        count: positions.length,
        layerId: LAYER_ID,
      });
    }
  );
}
