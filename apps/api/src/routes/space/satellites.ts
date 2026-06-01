import { FastifyInstance } from 'fastify';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'node:http';
import { checkDatabaseStatus, query } from '../../lib/db.js';
import {
  SpaceSatellitesListResponseSchema,
  SpaceSatelliteDetailResponseSchema,
  SpaceCategoriesResponseSchema,
  ErrorCodes,
} from '@god-eyes/contracts';
import {
  SpaceSatellitesBroadcaster,
  SpaceSatelliteFilter,
  applyFilters,
  buildEmptySnapshot,
} from './space-satellites-broadcaster.js';

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 75000;

interface SpaceListQuerystring {
  limit?: string;
  category?: string;
  objectType?: string;
  orbitClass?: string;
  sourceId?: string;
  importantOnly?: string;
  minAltitude?: string;
  maxAltitude?: string;
}

interface SatelliteParams {
  satelliteId: string;
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

function parseBoolean(raw: string | undefined): boolean | undefined {
  if (raw === undefined || raw === '') return undefined;
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return undefined;
}

function parseNumeric(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === '') return undefined;
  const n = Number(raw);
  if (isNaN(n)) return undefined;
  return n;
}

function parseCommaList(raw: string | undefined): string[] | undefined {
  if (raw === undefined || raw === '') return undefined;
  return raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return String(value);
}

interface SatelliteRow {
  satelliteId: string;
  noradId: number | null;
  name: string;
  objectType: string;
  category: string;
  orbitClass: string;
  country: string | null;
  launchDate: string | null;
  latitude: number;
  longitude: number;
  altitudeKm: number | null;
  velocityKms: number | null;
  headingDeg: number | null;
  visualShape: string;
  visualColor: string;
  important: boolean;
  estimatedAt: string;
  sourceId: string;
  sourceObjectId: string;
  sourceAgeSeconds: number | null;
  operator?: string | null;
}

function rowToItem(row: SatelliteRow) {
  return {
    satelliteId: row.satelliteId,
    noradId: row.noradId,
    name: row.name,
    objectType: row.objectType,
    category: row.category,
    orbitClass: row.orbitClass,
    country: row.country,
    launchDate: row.launchDate,
    position: {
      latitude: row.latitude,
      longitude: row.longitude,
      altitudeKm: row.altitudeKm,
    },
    velocity: {
      speedKms: row.velocityKms,
    },
    headingDeg: row.headingDeg,
    visualShape: row.visualShape,
    visualColor: row.visualColor,
    important: row.important,
    estimatedAt: row.estimatedAt,
    sourceId: row.sourceId,
    sourceObjectId: row.sourceObjectId,
    sourceAgeSeconds: row.sourceAgeSeconds,
  };
}

async function listSatellites(params: {
  category?: string[];
  objectType?: string[];
  orbitClass?: string[];
  sourceId?: string[];
  importantOnly?: boolean;
  minAltitude?: number;
  maxAltitude?: number;
  limit: number;
}): Promise<SatelliteRow[]> {
  const conditions: string[] = [];
  const sqlParams: unknown[] = [];
  let paramIndex = 1;

  if (params.category && params.category.length > 0) {
    const placeholders = params.category.map(() => `$${paramIndex++}`).join(', ');
    conditions.push(`p.category IN (${placeholders})`);
    sqlParams.push(...params.category);
  }

  if (params.objectType && params.objectType.length > 0) {
    const placeholders = params.objectType.map(() => `$${paramIndex++}`).join(', ');
    conditions.push(`p.object_type IN (${placeholders})`);
    sqlParams.push(...params.objectType);
  }

  if (params.orbitClass && params.orbitClass.length > 0) {
    const placeholders = params.orbitClass.map(() => `$${paramIndex++}`).join(', ');
    conditions.push(`p.orbit_class IN (${placeholders})`);
    sqlParams.push(...params.orbitClass);
  }

  if (params.sourceId && params.sourceId.length > 0) {
    const placeholders = params.sourceId.map(() => `$${paramIndex++}`).join(', ');
    conditions.push(`p.source_id IN (${placeholders})`);
    sqlParams.push(...params.sourceId);
  }

  if (params.importantOnly) {
    conditions.push(`p.is_important = TRUE`);
  }

  if (params.minAltitude !== undefined && params.minAltitude !== null) {
    conditions.push(`p.altitude_km >= $${paramIndex++}`);
    sqlParams.push(params.minAltitude);
  }

  if (params.maxAltitude !== undefined && params.maxAltitude !== null) {
    conditions.push(`p.altitude_km <= $${paramIndex++}`);
    sqlParams.push(params.maxAltitude);
  }

  const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT
      s.id::text AS "satelliteId",
      s.norad_cat_id AS "noradId",
      s.name,
      p.object_type AS "objectType",
      p.category,
      p.orbit_class AS "orbitClass",
      s.country,
      s.launch_date::text AS "launchDate",
      p.latitude,
      p.longitude,
      p.altitude_km AS "altitudeKm",
      p.velocity_kms AS "velocityKms",
      p.heading_deg AS "headingDeg",
      p.visual_shape AS "visualShape",
      p.visual_color AS "visualColor",
      p.is_important AS "important",
      p.estimated_at::text AS "estimatedAt",
      p.source_id AS "sourceId",
      p.source_object_id AS "sourceObjectId",
      p.source_age_seconds AS "sourceAgeSeconds"
    FROM space_satellites s
    JOIN space_satellite_positions_latest p ON s.id = p.satellite_id
    WHERE s.layer_id = 'layer_05_space_satellites'
      AND p.layer_id = 'layer_05_space_satellites'
      ${whereClause}
    ORDER BY s.name ASC
    LIMIT $${paramIndex}
  `;
  sqlParams.push(params.limit);

  return query<SatelliteRow>(sql, sqlParams);
}

async function getSatelliteById(satelliteId: string): Promise<SatelliteRow | null> {
  const sql = `
    SELECT
      s.id::text AS "satelliteId",
      s.norad_cat_id AS "noradId",
      s.name,
      p.object_type AS "objectType",
      p.category,
      p.orbit_class AS "orbitClass",
      s.country,
      s.launch_date::text AS "launchDate",
      s.operator_or_owner AS "operator",
      p.latitude,
      p.longitude,
      p.altitude_km AS "altitudeKm",
      p.velocity_kms AS "velocityKms",
      p.heading_deg AS "headingDeg",
      p.visual_shape AS "visualShape",
      p.visual_color AS "visualColor",
      p.is_important AS "important",
      p.estimated_at::text AS "estimatedAt",
      p.source_id AS "sourceId",
      p.source_object_id AS "sourceObjectId",
      p.source_age_seconds AS "sourceAgeSeconds"
    FROM space_satellites s
    JOIN space_satellite_positions_latest p ON s.id = p.satellite_id
    WHERE s.id = $1
      AND s.layer_id = 'layer_05_space_satellites'
      AND p.layer_id = 'layer_05_space_satellites'
  `;
  const rows = await query<SatelliteRow>(sql, [satelliteId]);
  return rows.length > 0 ? rows[0] : null;
}

function rowToDetail(row: SatelliteRow) {
  const item = rowToItem(row);
  return {
    ...item,
    operator: row.operator ?? null,
  };
}

export async function spaceSatellitesRoutes(fastify: FastifyInstance) {
  // GET /api/space/satellites
  fastify.get<{ Querystring: SpaceListQuerystring }>(
    '/api/space/satellites',
    async (request, reply) => {
      const {
        limit: rawLimit,
        category: rawCategory,
        objectType: rawObjectType,
        orbitClass: rawOrbitClass,
        sourceId: rawSourceId,
        importantOnly: rawImportantOnly,
        minAltitude: rawMinAltitude,
        maxAltitude: rawMaxAltitude,
      } = request.query;

      const parsedLimit = parseLimit(rawLimit);
      if (parsedLimit.error) {
        reply.code(400);
        return { error: parsedLimit.error };
      }

      const importantOnly = parseBoolean(rawImportantOnly);
      const minAltitude = parseNumeric(rawMinAltitude);
      const maxAltitude = parseNumeric(rawMaxAltitude);
      const category = parseCommaList(rawCategory);
      const objectType = parseCommaList(rawObjectType);
      const orbitClass = parseCommaList(rawOrbitClass);
      const sourceId = parseCommaList(rawSourceId);

      if (minAltitude !== undefined && (isNaN(minAltitude) || minAltitude < 0)) {
        reply.code(400);
        return { error: { code: ErrorCodes.INVALID_QUERY, message: 'minAltitude must be a non-negative number.', details: { provided: rawMinAltitude } } };
      }

      if (maxAltitude !== undefined && (isNaN(maxAltitude) || maxAltitude < 0)) {
        reply.code(400);
        return { error: { code: ErrorCodes.INVALID_QUERY, message: 'maxAltitude must be a non-negative number.', details: { provided: rawMaxAltitude } } };
      }

      const dbStatus = await checkDatabaseStatus();
      if (dbStatus.status === 'offline') {
        reply.code(503);
        return { error: { code: ErrorCodes.DATABASE_OFFLINE, message: 'Database is not available.', details: {} } };
      }

      let rows: SatelliteRow[];
      try {
        rows = await listSatellites({
          category,
          objectType,
          orbitClass,
          sourceId,
          importantOnly,
          minAltitude,
          maxAltitude,
          limit: parsedLimit.value,
        });
      } catch {
        reply.code(500);
        return { error: { code: ErrorCodes.INTERNAL_ERROR, message: 'An internal error occurred while fetching satellite data.', details: {} } };
      }

      const satellites = rows.map(rowToItem);

      const requestedLimit = rawLimit !== undefined && rawLimit !== '' ? parseInt(rawLimit, 10) : undefined;

      const activeFilters: Record<string, unknown> = {};
      if (category) activeFilters.category = category;
      if (objectType) activeFilters.objectType = objectType;
      if (orbitClass) activeFilters.orbitClass = orbitClass;
      if (sourceId) activeFilters.sourceId = sourceId;
      if (importantOnly !== undefined) activeFilters.importantOnly = importantOnly;
      if (minAltitude !== undefined) activeFilters.minAltitude = minAltitude;
      if (maxAltitude !== undefined) activeFilters.maxAltitude = maxAltitude;

      return SpaceSatellitesListResponseSchema.parse({
        satellites,
        metadata: {
          count: satellites.length,
          requestedLimit: requestedLimit !== undefined && !isNaN(requestedLimit) ? requestedLimit : undefined,
          appliedLimit: parsedLimit.value,
          maxLimit: MAX_LIMIT,
          activeFilters: Object.keys(activeFilters).length > 0 ? activeFilters : undefined,
          generatedAt: new Date().toISOString(),
          estimated: true,
          layerId: 'layer_05_space_satellites',
        },
      });
    },
  );

  // GET /api/space/satellites/categories
  fastify.get(
    '/api/space/satellites/categories',
    async (request, reply) => {
      const dbStatus = await checkDatabaseStatus();
      if (dbStatus.status === 'offline') {
        reply.code(503);
        return { error: { code: ErrorCodes.DATABASE_OFFLINE, message: 'Database is not available.', details: {} } };
      }

      try {
        const categorySql = `
          SELECT category, COUNT(*)::int AS count
          FROM space_satellite_positions_latest
          WHERE layer_id = 'layer_05_space_satellites'
          GROUP BY category
          ORDER BY count DESC
        `;
        const objectTypeSql = `
          SELECT object_type AS "objectType", COUNT(*)::int AS count
          FROM space_satellite_positions_latest
          WHERE layer_id = 'layer_05_space_satellites'
          GROUP BY object_type
          ORDER BY count DESC
        `;
        const orbitClassSql = `
          SELECT orbit_class AS "orbitClass", COUNT(*)::int AS count
          FROM space_satellite_positions_latest
          WHERE layer_id = 'layer_05_space_satellites'
          GROUP BY orbit_class
          ORDER BY count DESC
        `;
        const totalsSql = `
          SELECT
            COUNT(*)::int AS total_count,
            SUM(CASE WHEN is_important = TRUE THEN 1 ELSE 0 END)::int AS important_count
          FROM space_satellite_positions_latest
          WHERE layer_id = 'layer_05_space_satellites'
        `;

        const [categories, objectTypes, orbitClasses, totals] = await Promise.all([
          query<{ category: string; count: number }>(categorySql),
          query<{ objectType: string; count: number }>(objectTypeSql),
          query<{ orbitClass: string; count: number }>(orbitClassSql),
          query<{ total_count: number; important_count: number }>(totalsSql),
        ]);

        return SpaceCategoriesResponseSchema.parse({
          categories: categories.map((c) => ({ category: c.category, count: c.count })),
          objectTypes: objectTypes.map((o) => ({ objectType: o.objectType, count: o.count })),
          orbitClasses: orbitClasses.map((o) => ({ orbitClass: o.orbitClass, count: o.count })),
          totalCount: totals.length > 0 ? totals[0].total_count : 0,
          importantCount: totals.length > 0 ? totals[0].important_count : 0,
          metadata: {
            generatedAt: new Date().toISOString(),
            layerId: 'layer_05_space_satellites',
            estimated: true,
          },
        });
      } catch {
        reply.code(500);
        return { error: { code: ErrorCodes.INTERNAL_ERROR, message: 'An internal error occurred while fetching satellite categories.', details: {} } };
      }
    },
  );

  // GET /api/space/satellites/:satelliteId
  fastify.get<{ Params: SatelliteParams }>(
    '/api/space/satellites/:satelliteId',
    async (request, reply) => {
      const { satelliteId } = request.params;

      const dbStatus = await checkDatabaseStatus();
      if (dbStatus.status === 'offline') {
        reply.code(503);
        return { error: { code: ErrorCodes.DATABASE_OFFLINE, message: 'Database is not available.', details: {} } };
      }

      let row: SatelliteRow | null;
      try {
        row = await getSatelliteById(satelliteId);
      } catch {
        reply.code(500);
        return { error: { code: ErrorCodes.INTERNAL_ERROR, message: 'An internal error occurred while fetching satellite detail.', details: {} } };
      }

      if (!row) {
        reply.code(404);
        return { error: { code: ErrorCodes.OBJECT_NOT_FOUND, message: `Satellite with ID '${satelliteId}' was not found.`, details: { satelliteId } } };
      }

      return SpaceSatelliteDetailResponseSchema.parse({
        satellite: rowToDetail(row),
      });
    },
  );
}

// --- WebSocket ---

interface SubscribeMsg {
  type: 'space.satellites.subscribe';
  filters?: SpaceSatelliteFilter;
}

interface PingMsg {
  type: 'ping';
}

type ClientMessage = SubscribeMsg | PingMsg;

function sendJson(ws: WebSocket, data: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

export function attachSpaceSatellitesWebSocket(
  fastify: FastifyInstance,
  broadcaster?: SpaceSatellitesBroadcaster,
): { broadcaster: SpaceSatellitesBroadcaster; wss: WebSocketServer } {
  const bc = broadcaster ?? new SpaceSatellitesBroadcaster();
  const wss = new WebSocketServer({ noServer: true });
  const clientFilters = new Map<WebSocket, SpaceSatelliteFilter>();

  wss.on('connection', (ws: WebSocket) => {
    const filters: SpaceSatelliteFilter = {};
    clientFilters.set(ws, filters);

    // Send initial snapshot
    const snap = bc.getLatestSnapshot();
    if (snap) {
      const filtered = Object.keys(filters).length > 0 ? applyFilters(snap, filters) : snap;
      sendJson(ws, filtered);
    } else {
      sendJson(ws, buildEmptySnapshot());
    }

    ws.on('message', (raw: Buffer) => {
      try {
        const data = JSON.parse(raw.toString('utf-8'));
        if (typeof data?.type !== 'string') {
          sendJson(ws, { type: 'space.satellites.error', code: 'INVALID_MESSAGE', message: 'Invalid message format' });
          return;
        }

        switch (data.type) {
          case 'space.satellites.subscribe': {
            const newFilters: SpaceSatelliteFilter = {};
            if (data.filters) {
              if (Array.isArray(data.filters.category)) newFilters.category = data.filters.category;
              if (Array.isArray(data.filters.objectType)) newFilters.objectType = data.filters.objectType;
              if (Array.isArray(data.filters.orbitClass)) newFilters.orbitClass = data.filters.orbitClass;
              if (Array.isArray(data.filters.sourceId)) newFilters.sourceId = data.filters.sourceId;
              if (typeof data.filters.importantOnly === 'boolean') newFilters.importantOnly = data.filters.importantOnly;
              if (typeof data.filters.minAltitude === 'number') newFilters.minAltitude = data.filters.minAltitude;
              if (typeof data.filters.maxAltitude === 'number') newFilters.maxAltitude = data.filters.maxAltitude;
              if (typeof data.filters.limit === 'number') newFilters.limit = data.filters.limit;
            }
            clientFilters.set(ws, newFilters);

            const snap = bc.getLatestSnapshot();
            if (snap) {
              const filtered = applyFilters(snap, newFilters);
              sendJson(ws, filtered);
            } else {
              sendJson(ws, buildEmptySnapshot());
            }
            break;
          }
          case 'ping':
            sendJson(ws, { type: 'pong', serverTime: new Date().toISOString() });
            break;
          default:
            sendJson(ws, { type: 'space.satellites.error', code: 'UNKNOWN_TYPE', message: `Unknown message type: ${data.type}` });
        }
      } catch {
        sendJson(ws, { type: 'space.satellites.error', code: 'PARSE_ERROR', message: 'Failed to parse message JSON' });
      }
    });

    ws.on('close', () => clientFilters.delete(ws));
    ws.on('error', () => clientFilters.delete(ws));
  });

  bc.onReady = (snapshot) => {
    for (const ws of wss.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        const filters = clientFilters.get(ws);
        if (filters && Object.keys(filters).length > 0) {
          sendJson(ws, applyFilters(snapshot, filters));
        } else {
          sendJson(ws, snapshot);
        }
      }
    }
  };

  bc.onSnapshot = (snapshot) => {
    for (const ws of wss.clients) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const filters = clientFilters.get(ws);
      if (filters && Object.keys(filters).length > 0) {
        sendJson(ws, applyFilters(snapshot, filters));
      } else {
        sendJson(ws, snapshot);
      }
    }
  };

  bc.onError = (err) => {
    for (const ws of wss.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        sendJson(ws, { type: 'space.satellites.error', code: err.code, message: err.message });
      }
    }
  };

  bc.start();
  return { broadcaster: bc, wss };
}

export function upgradeSpaceSatellitesWebSocket(fastify: FastifyInstance, wss: WebSocketServer): void {
  const server = fastify.server;
  if (!server) return;
  server.on('upgrade', (req: IncomingMessage, socket, head) => {
    if (req.url === '/ws/space/satellites/live') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
  });
}
