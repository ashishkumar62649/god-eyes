import { checkDatabaseStatus } from '../../../lib/db.js';
import { queryInfrastructureList, queryInfrastructureDetail, queryCategories, querySourceCounts } from './repository.js';
import { rowToFeature, toIsoString } from './mapper.js';
import type { BBox } from './types.js';

export { checkDatabaseStatus };

// Static canonical sources — stays in service (not DB-driven)
export const CANONICAL_SOURCES = [
  { source_id: 'wri_global_power_plant_database', name: 'WRI Global Power Plant Database', homepage: 'https://datasets.wri.org/dataset/globalpowerplantdatabase', featureTypes: ['power_plant'], license: 'CC BY 4.0', attributionRequired: true },
  { source_id: 'osm_energy_infrastructure', name: 'OpenStreetMap Energy Infrastructure', homepage: 'https://www.openstreetmap.org/', featureTypes: ['substation', 'transmission_line', 'power_plant', 'oil_pipeline', 'gas_pipeline'], license: 'ODbL', attributionRequired: true },
  { source_id: 'global_energy_monitor_energy', name: 'Global Energy Monitor', homepage: 'https://globalenergymonitor.org/', featureTypes: ['oil_pipeline', 'gas_pipeline', 'lng_terminal', 'oil_terminal', 'gas_terminal'], license: 'CC BY 4.0', attributionRequired: true },
];

export async function getInfrastructureList(params: {
  filters: { country?: string; sourceId?: string; featureType?: string; category?: string; status?: string; fuelType?: string; minCapacityMw?: string; maxCapacityMw?: string; minVoltageKv?: string; maxVoltageKv?: string; pipelineProduct?: string; terminalType?: string; bbox?: BBox | null };
  limit: number; offset: number;
}) {
  const { rows, totalCount } = await queryInfrastructureList(params);
  return { features: rows.map(rowToFeature), totalCount };
}

export async function getInfrastructureDetail(featureId: string) {
  const row = await queryInfrastructureDetail(featureId);
  if (!row) return null;
  return { ...rowToFeature(row), bbox: row.bbox ?? null, rawSourceJson: row.rawSourceJson ?? null };
}

export async function getCategories() {
  const rows = await queryCategories();
  return rows.map((r) => ({
    name: r.category,
    featureType: r.featureType,
    count: r.count,
    totalCapacityMw: r.totalCapacityMw !== null ? Number(r.totalCapacityMw) : undefined,
    totalPipelineLengthKm: r.totalPipelineLengthKm !== null ? Number(r.totalPipelineLengthKm) : undefined,
  }));
}

export async function getSourcesWithCounts() {
  let dbCounts: Map<string, { featureCount: number; lastUpdated: string | null }> = new Map();
  try {
    const rows = await querySourceCounts();
    for (const r of rows) dbCounts.set(r.sourceId, { featureCount: r.featureCount, lastUpdated: r.lastUpdated });
  } catch { /* non-critical */ }

  return CANONICAL_SOURCES.map((s) => {
    const dbCount = dbCounts.get(s.source_id);
    return {
      sourceId: s.source_id, name: s.name, homepage: s.homepage, featureTypes: s.featureTypes,
      featureCount: dbCount?.featureCount ?? 0,
      lastUpdated: dbCount?.lastUpdated ?? null,
      license: s.license, attributionRequired: s.attributionRequired,
    };
  });
}
