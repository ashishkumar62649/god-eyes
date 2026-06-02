import { FastifyInstance } from 'fastify';
import { checkDatabaseStatus, query } from '../../lib/db.js';
import {
  EnergyInfrastructureListResponseSchema,
  EnergyInfrastructureDetailResponseSchema,
  EnergyCategoriesResponseSchema,
  EnergySourcesResponseSchema,
  ErrorCodes,
} from '@god-eyes/contracts';

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 10000;
const LAYER_ID = 'layer_10_energy_infrastructure';
const LAYER_DISPLAY_NAME = 'Energy Infrastructure';

const CANONICAL_SOURCES = [
  {
    source_id: 'wri_global_power_plant_database',
    name: 'WRI Global Power Plant Database',
    homepage: 'https://datasets.wri.org/dataset/globalpowerplantdatabase',
    featureTypes: ['power_plant'],
    license: 'CC BY 4.0',
    attributionRequired: true,
  },
  {
    source_id: 'osm_energy_infrastructure',
    name: 'OpenStreetMap Energy Infrastructure',
    homepage: 'https://www.openstreetmap.org/',
    featureTypes: [
      'substation',
      'transmission_line',
      'power_plant',
      'oil_pipeline',
      'gas_pipeline',
    ],
    license: 'ODbL',
    attributionRequired: true,
  },
  {
    source_id: 'global_energy_monitor_energy',
    name: 'Global Energy Monitor',
    homepage: 'https://globalenergymonitor.org/',
    featureTypes: [
      'oil_pipeline',
      'gas_pipeline',
      'lng_terminal',
      'oil_terminal',
      'gas_terminal',
    ],
    license: 'CC BY 4.0',
    attributionRequired: true,
  },
];

interface EnergyInfrastructureQuerystring {
  limit?: string;
  offset?: string;
  bbox?: string;
  country?: string;
  sourceId?: string;
  featureType?: string;
  category?: string;
  status?: string;
  fuelType?: string;
  minCapacityMw?: string;
  maxCapacityMw?: string;
  minVoltageKv?: string;
  maxVoltageKv?: string;
  pipelineProduct?: string;
  terminalType?: string;
}

interface FeatureIdParams {
  featureId: string;
}

interface BBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

interface ActiveFilters {
  bbox: string | null;
  country: string | null;
  sourceId: string | null;
  featureType: string | null;
  category: string | null;
  status: string | null;
  fuelType: string | null;
  minCapacityMw: string | null;
  maxCapacityMw: string | null;
  minVoltageKv: string | null;
  maxVoltageKv: string | null;
  pipelineProduct: string | null;
  terminalType: string | null;
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

function parseLimit(raw: string | undefined): { value: number; error: { code: string; message: string } | null } {
  if (raw === undefined || raw === '') {
    return { value: DEFAULT_LIMIT, error: null };
  }

  const n = Number(raw);
  if (isNaN(n) || !Number.isInteger(n) || n < 1) {
    return { value: DEFAULT_LIMIT, error: { code: ErrorCodes.INVALID_LIMIT, message: 'Limit must be a positive integer.' } };
  }

  return { value: Math.min(n, MAX_LIMIT), error: null };
}

function parseOffset(raw: string | undefined): { value: number; error: { code: string; message: string } | null } {
  if (raw === undefined || raw === '') {
    return { value: 0, error: null };
  }

  const n = Number(raw);
  if (isNaN(n) || !Number.isInteger(n) || n < 0) {
    return { value: 0, error: { code: ErrorCodes.INVALID_QUERY, message: 'Offset must be a non-negative integer.' } };
  }

  return { value: n, error: null };
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return String(value);
}

interface EnergyFeatureRow {
  id: string;
  layerId: string;
  sourceId: string;
  sourceObjectId: string;
  featureType: string;
  category: string;
  name: string | null;
  operator: string | null;
  owner: string | null;
  country: string | null;
  status: string | null;
  fuelType: string | null;
  capacityMw: string | null;
  voltageKv: string | null;
  pipelineProduct: string | null;
  pipelineLengthKm: string | null;
  terminalType: string | null;
  geometry: Record<string, unknown>;
  centroidLat: string;
  centroidLon: string;
  sourceConfidence: string | null;
  sourceUpdatedAt: string | Date | null;
  firstSeenAt: string | Date;
  lastSeenAt: string | Date;
}

interface EnergyFeatureDetailRow extends EnergyFeatureRow {
  bbox: Record<string, unknown> | null;
  rawSourceJson: Record<string, unknown> | null;
}

function rowToFeature(row: EnergyFeatureRow) {
  return {
    id: row.id,
    layerId: row.layerId,
    sourceId: row.sourceId,
    sourceObjectId: row.sourceObjectId,
    featureType: row.featureType,
    category: row.category,
    name: row.name,
    operator: row.operator,
    owner: row.owner,
    country: row.country,
    status: row.status,
    fuelType: row.fuelType,
    capacityMw: row.capacityMw !== null ? Number(row.capacityMw) : null,
    voltageKv: row.voltageKv !== null ? Number(row.voltageKv) : null,
    pipelineProduct: row.pipelineProduct,
    pipelineLengthKm: row.pipelineLengthKm !== null ? Number(row.pipelineLengthKm) : null,
    terminalType: row.terminalType,
    geometry: row.geometry,
    centroidLat: Number(row.centroidLat),
    centroidLon: Number(row.centroidLon),
    sourceConfidence: row.sourceConfidence !== null ? Number(row.sourceConfidence) : null,
    sourceUpdatedAt: row.sourceUpdatedAt !== null ? toIsoString(row.sourceUpdatedAt) : null,
    firstSeenAt: toIsoString(row.firstSeenAt),
    lastSeenAt: toIsoString(row.lastSeenAt),
  };
}

export async function energyInfrastructureRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: EnergyInfrastructureQuerystring }>(
    '/api/energy/infrastructure',
    async (request, reply) => {
      const q = request.query;

      const parsedLimit = parseLimit(q.limit);
      if (parsedLimit.error) {
        reply.code(400);
        return {
          error: {
            code: parsedLimit.error.code,
            message: parsedLimit.error.message,
            details: { provided: q.limit },
          },
        };
      }
      const limit = parsedLimit.value;
      const requestedLimit = q.limit !== undefined ? Number(q.limit) : limit;

      const parsedOffset = parseOffset(q.offset);
      if (parsedOffset.error) {
        reply.code(400);
        return {
          error: {
            code: parsedOffset.error.code,
            message: parsedOffset.error.message,
            details: { provided: q.offset },
          },
        };
      }
      const offset = parsedOffset.value;

      let bbox: BBox | null = null;
      if (q.bbox !== undefined && q.bbox !== '') {
        bbox = parseBbox(q.bbox);
        if (!bbox) {
          reply.code(400);
          return {
            error: {
              code: ErrorCodes.INVALID_BBOX,
              message: 'Invalid bbox format. Expected: west,south,east,north. Valid ranges: lon [-180,180], lat [-90,90].',
              details: { provided: q.bbox },
            },
          };
        }
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

      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (q.country !== undefined && q.country !== '') {
        conditions.push(`country = $${paramIndex++}`);
        params.push(q.country);
      }

      if (q.sourceId !== undefined && q.sourceId !== '') {
        conditions.push(`source_id = $${paramIndex++}`);
        params.push(q.sourceId);
      }

      if (q.featureType !== undefined && q.featureType !== '') {
        conditions.push(`feature_type = $${paramIndex++}`);
        params.push(q.featureType);
      }

      if (q.category !== undefined && q.category !== '') {
        conditions.push(`category = $${paramIndex++}`);
        params.push(q.category);
      }

      if (q.status !== undefined && q.status !== '') {
        conditions.push(`status = $${paramIndex++}`);
        params.push(q.status);
      }

      if (q.fuelType !== undefined && q.fuelType !== '') {
        conditions.push(`fuel_type = $${paramIndex++}`);
        params.push(q.fuelType);
      }

      if (q.minCapacityMw !== undefined && q.minCapacityMw !== '') {
        conditions.push(`capacity_mw >= $${paramIndex++}`);
        params.push(Number(q.minCapacityMw));
      }

      if (q.maxCapacityMw !== undefined && q.maxCapacityMw !== '') {
        conditions.push(`capacity_mw <= $${paramIndex++}`);
        params.push(Number(q.maxCapacityMw));
      }

      if (q.minVoltageKv !== undefined && q.minVoltageKv !== '') {
        conditions.push(`voltage_kv >= $${paramIndex++}`);
        params.push(Number(q.minVoltageKv));
      }

      if (q.maxVoltageKv !== undefined && q.maxVoltageKv !== '') {
        conditions.push(`voltage_kv <= $${paramIndex++}`);
        params.push(Number(q.maxVoltageKv));
      }

      if (q.pipelineProduct !== undefined && q.pipelineProduct !== '') {
        conditions.push(`pipeline_product = $${paramIndex++}`);
        params.push(q.pipelineProduct);
      }

      if (q.terminalType !== undefined && q.terminalType !== '') {
        conditions.push(`terminal_type = $${paramIndex++}`);
        params.push(q.terminalType);
      }

      if (bbox) {
        conditions.push(`ST_Intersects(geom, ST_MakeEnvelope($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, 4326))`);
        params.push(bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat);
        paramIndex += 4;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countSql = `SELECT COUNT(*)::int AS count FROM energy_infrastructure ${whereClause}`;
      let totalCount = 0;
      try {
        const countRows = await query<{ count: number }>(countSql, params);
        totalCount = countRows[0]?.count ?? 0;
      } catch {
        reply.code(500);
        return {
          error: {
            code: ErrorCodes.INTERNAL_ERROR,
            message: 'An internal error occurred while querying energy infrastructure.',
            details: {},
          },
        };
      }

      const dataSql = `
        SELECT
          id,
          layer_id AS "layerId",
          source_id AS "sourceId",
          source_object_id AS "sourceObjectId",
          feature_type AS "featureType",
          category,
          name,
          operator,
          owner,
          country,
          status,
          fuel_type AS "fuelType",
          capacity_mw AS "capacityMw",
          voltage_kv AS "voltageKv",
          pipeline_product AS "pipelineProduct",
          pipeline_length_km AS "pipelineLengthKm",
          terminal_type AS "terminalType",
          ST_AsGeoJSON(geom)::json AS geometry,
          centroid_lat AS "centroidLat",
          centroid_lon AS "centroidLon",
          source_confidence AS "sourceConfidence",
          source_updated_at AS "sourceUpdatedAt",
          first_seen_at AS "firstSeenAt",
          last_seen_at AS "lastSeenAt"
        FROM energy_infrastructure
        ${whereClause}
        ORDER BY name NULLS LAST, id
        LIMIT $${paramIndex}
        OFFSET $${paramIndex + 1}
      `;

      const dataParams = [...params, limit, offset];

      let rows: EnergyFeatureRow[];
      try {
        rows = await query<EnergyFeatureRow>(dataSql, dataParams);
      } catch {
        reply.code(500);
        return {
          error: {
            code: ErrorCodes.INTERNAL_ERROR,
            message: 'An internal error occurred while fetching energy infrastructure.',
            details: {},
          },
        };
      }

      const features = rows.map(rowToFeature);

      const activeFilters: ActiveFilters = {
        bbox: q.bbox ?? null,
        country: q.country ?? null,
        sourceId: q.sourceId ?? null,
        featureType: q.featureType ?? null,
        category: q.category ?? null,
        status: q.status ?? null,
        fuelType: q.fuelType ?? null,
        minCapacityMw: q.minCapacityMw ?? null,
        maxCapacityMw: q.maxCapacityMw ?? null,
        minVoltageKv: q.minVoltageKv ?? null,
        maxVoltageKv: q.maxVoltageKv ?? null,
        pipelineProduct: q.pipelineProduct ?? null,
        terminalType: q.terminalType ?? null,
      };

      const hasFilters = Object.values(activeFilters).some((v) => v !== null);
      const nonNullFilters: Record<string, unknown> = {};
      if (hasFilters) {
        for (const [key, value] of Object.entries(activeFilters)) {
          if (value !== null) {
            nonNullFilters[key] = value;
          }
        }
      }

      const sourceSummary: Record<string, { featureCount: number; lastUpdated: string | null }> = {};
      try {
        const sourceRows = await query<{ sourceId: string; featureCount: number; lastUpdated: string | null }>(
          `SELECT source_id AS "sourceId", COUNT(*)::int AS "featureCount", MAX(source_updated_at) AS "lastUpdated" FROM energy_infrastructure GROUP BY source_id`
        );
        for (const s of sourceRows) {
          sourceSummary[s.sourceId] = {
            featureCount: s.featureCount,
            lastUpdated: s.lastUpdated ? toIsoString(s.lastUpdated) : null,
          };
        }
      } catch {
        // Source summary is non-critical
      }

      return EnergyInfrastructureListResponseSchema.parse({
        features,
        metadata: {
          layerId: LAYER_ID,
          count: totalCount,
          returnedCount: features.length,
          requestedLimit,
          appliedLimit: limit,
          maxLimit: MAX_LIMIT,
          activeFilters: hasFilters ? nonNullFilters : undefined,
          generatedAt: new Date().toISOString(),
          estimated: false,
          staticData: true,
          sourceSummary: Object.keys(sourceSummary).length > 0 ? sourceSummary : undefined,
        },
      });
    }
  );

  fastify.get<{ Params: FeatureIdParams }>(
    '/api/energy/infrastructure/:featureId',
    async (request, reply) => {
      const { featureId } = request.params;

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(featureId)) {
        reply.code(400);
        return {
          error: {
            code: ErrorCodes.INVALID_QUERY,
            message: 'featureId must be a valid UUID.',
            details: { provided: featureId },
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

      const sql = `
        SELECT
          id,
          layer_id AS "layerId",
          source_id AS "sourceId",
          source_object_id AS "sourceObjectId",
          feature_type AS "featureType",
          category,
          name,
          operator,
          owner,
          country,
          status,
          fuel_type AS "fuelType",
          capacity_mw AS "capacityMw",
          voltage_kv AS "voltageKv",
          pipeline_product AS "pipelineProduct",
          pipeline_length_km AS "pipelineLengthKm",
          terminal_type AS "terminalType",
          ST_AsGeoJSON(geom)::json AS geometry,
          centroid_lat AS "centroidLat",
          centroid_lon AS "centroidLon",
          ST_AsGeoJSON(bbox)::json AS bbox,
          source_confidence AS "sourceConfidence",
          source_updated_at AS "sourceUpdatedAt",
          first_seen_at AS "firstSeenAt",
          last_seen_at AS "lastSeenAt",
          raw_source_json AS "rawSourceJson"
        FROM energy_infrastructure
        WHERE id = $1
      `;

      let rows: EnergyFeatureDetailRow[];
      try {
        rows = await query<EnergyFeatureDetailRow>(sql, [featureId]);
      } catch {
        reply.code(500);
        return {
          error: {
            code: ErrorCodes.INTERNAL_ERROR,
            message: 'An internal error occurred while fetching the energy feature.',
            details: {},
          },
        };
      }

      if (rows.length === 0) {
        reply.code(404);
        return {
          error: {
            code: ErrorCodes.OBJECT_NOT_FOUND,
            message: `Energy feature not found: ${featureId}`,
            details: { featureId },
          },
        };
      }

      const row = rows[0];
      const feature = {
        ...rowToFeature(row),
        bbox: row.bbox ?? null,
        rawSourceJson: row.rawSourceJson ?? null,
      };

      return EnergyInfrastructureDetailResponseSchema.parse({
        feature,
      });
    }
  );

  fastify.get(
    '/api/energy/infrastructure/categories',
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

      const sql = `
        SELECT
          feature_type AS "featureType",
          category,
          COUNT(*)::int AS count,
          SUM(capacity_mw) AS "totalCapacityMw",
          SUM(pipeline_length_km) AS "totalPipelineLengthKm"
        FROM energy_infrastructure
        GROUP BY feature_type, category
        ORDER BY category
      `;

      interface CategoryRow {
        featureType: string;
        category: string;
        count: number;
        totalCapacityMw: string | null;
        totalPipelineLengthKm: string | null;
      }

      let rows: CategoryRow[];
      try {
        rows = await query<CategoryRow>(sql);
      } catch {
        rows = [];
      }

      const categories = rows.map((r) => ({
        name: r.category,
        featureType: r.featureType,
        count: r.count,
        totalCapacityMw: r.totalCapacityMw !== null ? Number(r.totalCapacityMw) : undefined,
        totalPipelineLengthKm: r.totalPipelineLengthKm !== null ? Number(r.totalPipelineLengthKm) : undefined,
      }));

      return EnergyCategoriesResponseSchema.parse({
        categories,
        metadata: {
          layerId: LAYER_ID,
          generatedAt: new Date().toISOString(),
        },
      });
    }
  );

  fastify.get(
    '/api/energy/infrastructure/sources',
    async (_request, reply) => {
      const dbStatus = await checkDatabaseStatus();

      interface SourceCountRow {
        sourceId: string;
        featureCount: number;
        lastUpdated: string | null;
      }

      let dbCounts: Map<string, { featureCount: number; lastUpdated: string | null }> = new Map();

      if (dbStatus.status === 'connected') {
        try {
          const rows = await query<SourceCountRow>(
            `SELECT source_id AS "sourceId", COUNT(*)::int AS "featureCount", MAX(source_updated_at) AS "lastUpdated" FROM energy_infrastructure GROUP BY source_id`
          );
          for (const r of rows) {
            dbCounts.set(r.sourceId, {
              featureCount: r.featureCount,
              lastUpdated: r.lastUpdated,
            });
          }
        } catch {
          // Non-critical; fall back to hardcoded defaults
        }
      }

      const sources = CANONICAL_SOURCES.map((s) => {
        const dbCount = dbCounts.get(s.source_id);
        return {
          sourceId: s.source_id,
          name: s.name,
          homepage: s.homepage,
          featureTypes: s.featureTypes,
          featureCount: dbCount?.featureCount ?? 0,
          lastUpdated: dbCount?.lastUpdated ?? null,
          license: s.license,
          attributionRequired: s.attributionRequired,
        };
      });

      return EnergySourcesResponseSchema.parse({
        sources,
        metadata: {
          layerId: LAYER_ID,
          generatedAt: new Date().toISOString(),
        },
      });
    }
  );
}
