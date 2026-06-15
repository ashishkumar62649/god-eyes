import { FastifyInstance } from 'fastify';
import {
  MaritimeObjectsListResponseSchema, MaritimeVesselDetailResponseSchema,
  MaritimeStatsResponseSchema, MaritimePositionHistoryResponseSchema, ErrorCodes,
} from '@god-eyes/contracts';
import { parseBbox, parseLimit, parseOffset, parseNumeric, parseMmsi, parseHours, parseHistoryLimit, isValidIsoDatetime } from './validation.js';
import { getVesselList, getVesselDetail, getMaritimeStats, getVesselPositionHistory, checkDatabaseStatus } from './service.js';
import { toInteger } from './mapper.js';
import type { ObjectsQuerystring, ObjectIdParams, MmsiParams, PositionsQuerystring } from './types.js';

const LAYER_ID = 'layer_06_maritime';
const DB_OFFLINE = { code: ErrorCodes.DATABASE_OFFLINE, message: 'Database is not available.', details: {} };
const INTERNAL = { code: ErrorCodes.INTERNAL_ERROR, message: 'An internal error occurred.', details: {} };

export async function maritimeRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: ObjectsQuerystring }>(
    `/api/layers/${LAYER_ID}/objects`,
    async (request, reply) => {
      const { bbox: rawBbox, vessel_type: rawVesselType, min_speed: rawMinSpeed, max_speed: rawMaxSpeed, updated_since: rawUpdatedSince, mmsi: rawMmsi, search: rawSearch, limit: rawLimit, offset: rawOffset } = request.query;

      const parsedLimit = parseLimit(rawLimit);
      if (parsedLimit.error) { reply.code(400); return { error: parsedLimit.error }; }
      const parsedOffset = parseOffset(rawOffset);
      if (parsedOffset.error) { reply.code(400); return { error: parsedOffset.error }; }

      let bbox = null;
      if (rawBbox) {
        bbox = parseBbox(rawBbox);
        if (!bbox) { reply.code(400); return { error: { code: ErrorCodes.INVALID_BBOX, message: 'Invalid bbox format. Expected: minLon,minLat,maxLon,maxLat. Valid ranges: lon [-180,180], lat [-90,90]. minLon < maxLon and minLat < maxLat required.', details: { provided: rawBbox } } }; }
      }

      if (rawUpdatedSince && !isValidIsoDatetime(rawUpdatedSince)) {
        reply.code(400); return { error: { code: ErrorCodes.INVALID_QUERY, message: 'Invalid updated_since format. Expected ISO 8601 datetime.', details: { provided: rawUpdatedSince } } };
      }

      const dbStatus = await checkDatabaseStatus();
      if (dbStatus.status === 'offline') { reply.code(503); return { error: DB_OFFLINE }; }

      let objects;
      try {
        objects = await getVesselList({
          bbox,
          vesselType: rawVesselType || null,
          minSpeed: parseNumeric(rawMinSpeed),
          maxSpeed: parseNumeric(rawMaxSpeed),
          updatedSince: rawUpdatedSince || null,
          mmsi: parseMmsi(rawMmsi),
          search: rawSearch || null,
          limit: parsedLimit.value,
          offset: parsedOffset.value,
        });
      } catch { reply.code(500); return { error: { ...INTERNAL, message: 'An internal error occurred while fetching maritime vessel data.' } }; }

      return MaritimeObjectsListResponseSchema.parse({
        objects,
        metadata: { count: objects.length, limit: parsedLimit.value, offset: parsedOffset.value, generatedAt: new Date().toISOString() },
      });
    }
  );

  fastify.get<{ Params: ObjectIdParams }>(
    `/api/layers/${LAYER_ID}/objects/:objectId`,
    async (request, reply) => {
      const { objectId } = request.params;
      const mmsi = Number(objectId);
      if (isNaN(mmsi) || !Number.isInteger(mmsi) || mmsi <= 0) {
        reply.code(400); return { error: { code: ErrorCodes.INVALID_QUERY, message: 'objectId must be a valid MMSI (positive integer).', details: { provided: objectId } } };
      }
      const dbStatus = await checkDatabaseStatus();
      if (dbStatus.status === 'offline') { reply.code(503); return { error: DB_OFFLINE }; }

      let vessel;
      try { vessel = await getVesselDetail(mmsi); }
      catch { reply.code(500); return { error: { ...INTERNAL, message: 'An internal error occurred while fetching vessel detail.' } }; }

      if (!vessel) { reply.code(404); return { error: { code: ErrorCodes.OBJECT_NOT_FOUND, message: `Vessel with MMSI ${mmsi} was not found.`, details: { mmsi } } }; }
      return MaritimeVesselDetailResponseSchema.parse({ vessel });
    }
  );

  fastify.get(
    `/api/layers/${LAYER_ID}/stats`,
    async (_request, reply) => {
      const dbStatus = await checkDatabaseStatus();
      if (dbStatus.status === 'offline') { reply.code(503); return { error: DB_OFFLINE }; }

      let result;
      try { result = await getMaritimeStats(); }
      catch { reply.code(500); return { error: { ...INTERNAL, message: 'An internal error occurred while fetching maritime stats.' } }; }

      return MaritimeStatsResponseSchema.parse({
        layerId: LAYER_ID,
        ...result,
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
        reply.code(400); return { error: { code: ErrorCodes.INVALID_QUERY, message: 'MMSI must be a positive integer.', details: { provided: rawMmsi } } };
      }
      const parsedHours = parseHours(rawHours);
      if (parsedHours.error) { reply.code(400); return { error: { code: parsedHours.error.code, message: parsedHours.error.message, details: { provided: rawHours } } }; }
      const parsedLimit = parseHistoryLimit(rawLimit);
      if (parsedLimit.error) { reply.code(400); return { error: { code: parsedLimit.error.code, message: parsedLimit.error.message, details: { provided: rawLimit } } }; }

      const dbStatus = await checkDatabaseStatus();
      if (dbStatus.status === 'offline') { reply.code(503); return { error: DB_OFFLINE }; }

      let result;
      try { result = await getVesselPositionHistory({ mmsi, hours: parsedHours.value, limit: parsedLimit.value }); }
      catch { reply.code(500); return { error: { ...INTERNAL, message: 'An internal error occurred while fetching position history.' } }; }

      return MaritimePositionHistoryResponseSchema.parse({
        mmsi: toInteger(mmsi),
        vesselName: result.vesselName,
        positions: result.positions,
        count: result.positions.length,
        layerId: LAYER_ID,
      });
    }
  );
}
