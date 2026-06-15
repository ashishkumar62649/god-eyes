import type { EnergyFeatureRow } from './types.js';

export function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return String(value);
}

export function rowToFeature(row: EnergyFeatureRow) {
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
