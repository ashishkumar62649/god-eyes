export interface EnergyInfrastructureQuerystring {
  limit?: string; offset?: string; bbox?: string; country?: string; sourceId?: string;
  featureType?: string; category?: string; status?: string; fuelType?: string;
  minCapacityMw?: string; maxCapacityMw?: string; minVoltageKv?: string; maxVoltageKv?: string;
  pipelineProduct?: string; terminalType?: string;
}

export interface FeatureIdParams { featureId: string; }

export interface BBox { minLon: number; minLat: number; maxLon: number; maxLat: number; }

export interface EnergyFeatureRow {
  id: string; layerId: string; sourceId: string; sourceObjectId: string;
  featureType: string; category: string; name: string | null; operator: string | null;
  owner: string | null; country: string | null; status: string | null; fuelType: string | null;
  capacityMw: string | null; voltageKv: string | null; pipelineProduct: string | null;
  pipelineLengthKm: string | null; terminalType: string | null;
  geometry: Record<string, unknown>; centroidLat: string; centroidLon: string;
  sourceConfidence: string | null; sourceUpdatedAt: string | Date | null;
  firstSeenAt: string | Date; lastSeenAt: string | Date;
}

export interface EnergyFeatureDetailRow extends EnergyFeatureRow {
  bbox: Record<string, unknown> | null;
  rawSourceJson: Record<string, unknown> | null;
}

export interface CategoryRow {
  featureType: string; category: string; count: number;
  totalCapacityMw: string | null; totalPipelineLengthKm: string | null;
}

export interface SourceCountRow {
  sourceId: string; featureCount: number; lastUpdated: string | null;
}
