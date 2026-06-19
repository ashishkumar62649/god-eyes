import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { checkDatabaseStatus, query } from '../lib/db.js';
import { toIsoString } from '../lib/typeUtils.js';
import { parseBbox, parseLimit, BBox } from '../lib/requestValidation.js';
import {
  AircraftLatestListResponseSchema,
  AircraftDetailResponseSchema,
  ErrorCodes,
} from '@god-eyes/contracts';

const LAYER_ID = 'layer_01_aviation';
const PUBLIC_SLUG = 'aviation';

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 20000;

interface LatestAircraftQuerystring {
  limit?: string;
  includeStale?: string;
  bbox?: string;
}

interface AircraftParams {
  sourceObjectId: string;
}

interface AircraftLatestRow {
  sourceId: string;
  sourceObjectId: string;
  callsign: string | null;
  registration: string | null;
  aircraftType: string | null;
  dbFlags: number | null;
  isMilitary: boolean;
  isInteresting: boolean;
  isPia: boolean;
  isLadd: boolean;
  sourceMessageType: string | null;
  lat: number | null;
  lon: number | null;
  altitudeBaroFt: number | null;
  altitudeGeomFt: number | null;
  onGround: boolean | null;
  groundSpeedKt: number | null;
  trackDeg: number | null;
  headingMagDeg: number | null;
  headingTrueDeg: number | null;
  verticalRateFpm: number | null;
  geomRateFpm: number | null;
  squawk: string | null;
  emergency: string | null;
  seenSeconds: number | null;
  seenPosSeconds: number | null;
  observedAt: Date | string;
  receivedAt: Date | string;
  staleAfter: Date | string | null;
  firstSeenAt: Date | string;
  lastSeenAt: Date | string;
  rawJson?: Record<string, unknown> | null;
}

function rowToLatest(row: AircraftLatestRow) {
  return {
    sourceId: row.sourceId,
    sourceObjectId: row.sourceObjectId,
    callsign: row.callsign,
    registration: row.registration,
    aircraftType: row.aircraftType,
    dbFlags: row.dbFlags,
    isMilitary: row.isMilitary,
    isInteresting: row.isInteresting,
    isPia: row.isPia,
    isLadd: row.isLadd,
    sourceMessageType: row.sourceMessageType,
    lat: row.lat,
    lon: row.lon,
    altitudeBaroFt: row.altitudeBaroFt,
    altitudeGeomFt: row.altitudeGeomFt,
    onGround: row.onGround,
    groundSpeedKt: row.groundSpeedKt,
    trackDeg: row.trackDeg,
    headingMagDeg: row.headingMagDeg,
    headingTrueDeg: row.headingTrueDeg,
    verticalRateFpm: row.verticalRateFpm,
    geomRateFpm: row.geomRateFpm,
    squawk: row.squawk,
    emergency: row.emergency,
    seenSeconds: row.seenSeconds,
    seenPosSeconds: row.seenPosSeconds,
    observedAt: toIsoString(row.observedAt),
    receivedAt: toIsoString(row.receivedAt),
    staleAfter: row.staleAfter ? toIsoString(row.staleAfter) : null,
    firstSeenAt: toIsoString(row.firstSeenAt),
    lastSeenAt: toIsoString(row.lastSeenAt),
  };
}

function rowToDetail(row: AircraftLatestRow) {
  const detail = rowToLatest(row) as ReturnType<typeof rowToLatest> & { rawJson?: Record<string, unknown> | null };
  if (row.rawJson !== undefined) {
    detail.rawJson = row.rawJson;
  }
  return detail;
}

function parseIncludeStale(raw: string | undefined): boolean {
  if (raw === undefined || raw === '') return false;
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return false;
}

async function listLatestAircraft(params: {
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

async function getAircraftBySourceObjectId(sourceObjectId: string): Promise<AircraftLatestRow | null> {
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

// HTTP route handlers for Layer 01 — Aviation. No SQL, no business logic here.
//
// Clean public slug aliases added per API-POLICY-001:
//   /api/layers/aviation/aircraft/latest        (alias for /api/aviation/aircraft/latest)
//   /api/layers/aviation/aircraft/:sourceObjectId (alias for /api/aviation/aircraft/:sourceObjectId)
//
// Old paths remain registered for compatibility and are not removed in this work order.

export async function aviationAircraftRoutes(fastify: FastifyInstance) {
  // Each handler is defined once and registered under both the legacy
  // domain path and the new clean public slug path.

  // Latest aircraft
  const latestHandler = async (request: FastifyRequest<{ Querystring: LatestAircraftQuerystring }>, reply: FastifyReply) => {
    const { limit: rawLimit, bbox: rawBbox, includeStale: rawIncludeStale } = request.query;

    const parsedLimit = parseLimit(rawLimit, DEFAULT_LIMIT, MAX_LIMIT, true);
    if (parsedLimit.error) {
      reply.code(400);
      return { error: parsedLimit.error };
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

    const includeStale = parseIncludeStale(rawIncludeStale);

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

    let rows: AircraftLatestRow[];
    try {
      rows = await listLatestAircraft({ bbox, limit: parsedLimit.value, includeStale });
    } catch {
      reply.code(500);
      return {
        error: {
          code: ErrorCodes.INTERNAL_ERROR,
          message: 'An internal error occurred while fetching live aircraft data.',
          details: {},
        },
      };
    }

    const aircraft = rows.map(rowToLatest);

    return AircraftLatestListResponseSchema.parse({
      aircraft,
      metadata: {
        count: aircraft.length,
        generatedAt: new Date().toISOString(),
      },
    });
  };

  fastify.get<{ Querystring: LatestAircraftQuerystring }>('/api/aviation/aircraft/latest', latestHandler);
  fastify.get<{ Querystring: LatestAircraftQuerystring }>(`/api/layers/${PUBLIC_SLUG}/aircraft/latest`, latestHandler);

  // Aircraft detail
  const detailHandler = async (request: FastifyRequest<{ Params: AircraftParams }>, reply: FastifyReply) => {
    const { sourceObjectId } = request.params;

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

    let row: AircraftLatestRow | null;
    try {
      row = await getAircraftBySourceObjectId(sourceObjectId);
    } catch {
      reply.code(500);
      return {
        error: {
          code: ErrorCodes.INTERNAL_ERROR,
          message: 'An internal error occurred while fetching aircraft detail.',
          details: {},
        },
      };
    }

    if (!row) {
      reply.code(404);
      return {
        error: {
          code: ErrorCodes.OBJECT_NOT_FOUND,
          message: `Aircraft with source object ID '${sourceObjectId}' was not found.`,
          details: { sourceObjectId },
        },
      };
    }

    return AircraftDetailResponseSchema.parse({
      aircraft: rowToDetail(row),
    });
  };

  fastify.get<{ Params: AircraftParams }>('/api/aviation/aircraft/:sourceObjectId', detailHandler);
  fastify.get<{ Params: AircraftParams }>(`/api/layers/${PUBLIC_SLUG}/aircraft/:sourceObjectId`, detailHandler);

  // Suppress LAYER_ID unused warning: kept intentionally for future metadata symmetry with other layer routes.
  void LAYER_ID;
}
