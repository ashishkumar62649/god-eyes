import { z } from 'zod';

// ==================== Energy Infrastructure — Layer 10 (WO-083D) ====================

export const EnergyInfrastructureGeometrySchema = z.record(z.unknown());

export type EnergyInfrastructureGeometry = z.infer<typeof EnergyInfrastructureGeometrySchema>;

export const EnergyInfrastructureFeatureSchema = z.object({
  id: z.string(),
  layerId: z.string(),
  sourceId: z.string(),
  sourceObjectId: z.string(),
  featureType: z.string(),
  category: z.string(),
  name: z.string().nullable(),
  operator: z.string().nullable(),
  owner: z.string().nullable(),
  country: z.string().nullable(),
  status: z.string().nullable(),
  fuelType: z.string().nullable(),
  capacityMw: z.number().nullable(),
  voltageKv: z.number().nullable(),
  pipelineProduct: z.string().nullable(),
  pipelineLengthKm: z.number().nullable(),
  terminalType: z.string().nullable(),
  geometry: EnergyInfrastructureGeometrySchema,
  centroidLat: z.number(),
  centroidLon: z.number(),
  sourceConfidence: z.number().nullable(),
  sourceUpdatedAt: z.string().nullable(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
});

export type EnergyInfrastructureFeature = z.infer<typeof EnergyInfrastructureFeatureSchema>;

export const EnergyInfrastructureActiveFiltersSchema = z.object({
  bbox: z.string().nullable(),
  country: z.string().nullable(),
  sourceId: z.string().nullable(),
  featureType: z.string().nullable(),
  category: z.string().nullable(),
  status: z.string().nullable(),
  fuelType: z.string().nullable(),
  minCapacityMw: z.string().nullable(),
  maxCapacityMw: z.string().nullable(),
  minVoltageKv: z.string().nullable(),
  maxVoltageKv: z.string().nullable(),
  pipelineProduct: z.string().nullable(),
  terminalType: z.string().nullable(),
});

export type EnergyInfrastructureActiveFilters = z.infer<typeof EnergyInfrastructureActiveFiltersSchema>;

export const EnergySourceSummarySchema = z.object({
  featureCount: z.number(),
  lastUpdated: z.string().nullable(),
});

export const EnergyInfrastructureListMetadataSchema = z.object({
  layerId: z.string(),
  count: z.number(),
  returnedCount: z.number(),
  requestedLimit: z.number().optional(),
  appliedLimit: z.number(),
  maxLimit: z.number(),
  activeFilters: z.record(z.unknown()).optional(),
  generatedAt: z.string(),
  estimated: z.boolean(),
  staticData: z.boolean(),
  sourceSummary: z.record(EnergySourceSummarySchema).optional(),
});

export type EnergyInfrastructureListMetadata = z.infer<typeof EnergyInfrastructureListMetadataSchema>;

export const EnergyInfrastructureListResponseSchema = z.object({
  features: z.array(EnergyInfrastructureFeatureSchema),
  metadata: EnergyInfrastructureListMetadataSchema,
});

export type EnergyInfrastructureListResponse = z.infer<typeof EnergyInfrastructureListResponseSchema>;

export const EnergyInfrastructureDetailFeatureSchema = EnergyInfrastructureFeatureSchema.extend({
  bbox: EnergyInfrastructureGeometrySchema.nullable(),
  rawSourceJson: z.record(z.unknown()).nullable(),
});

export type EnergyInfrastructureDetailFeature = z.infer<typeof EnergyInfrastructureDetailFeatureSchema>;

export const EnergyInfrastructureDetailResponseSchema = z.object({
  feature: EnergyInfrastructureDetailFeatureSchema,
});

export type EnergyInfrastructureDetailResponse = z.infer<typeof EnergyInfrastructureDetailResponseSchema>;

export const EnergyCategoryCountSchema = z.object({
  name: z.string(),
  featureType: z.string(),
  count: z.number(),
  totalCapacityMw: z.number().optional(),
  totalPipelineLengthKm: z.number().optional(),
});

export type EnergyCategoryCount = z.infer<typeof EnergyCategoryCountSchema>;

export const EnergyCategoriesMetadataSchema = z.object({
  layerId: z.string(),
  generatedAt: z.string(),
});

export const EnergyCategoriesResponseSchema = z.object({
  categories: z.array(EnergyCategoryCountSchema),
  metadata: EnergyCategoriesMetadataSchema,
});

export type EnergyCategoriesResponse = z.infer<typeof EnergyCategoriesResponseSchema>;

export const EnergySourceInfoSchema = z.object({
  sourceId: z.string(),
  name: z.string(),
  homepage: z.string(),
  featureTypes: z.array(z.string()),
  featureCount: z.number(),
  lastUpdated: z.string().nullable(),
  license: z.string(),
  attributionRequired: z.boolean(),
});

export type EnergySourceInfo = z.infer<typeof EnergySourceInfoSchema>;

export const EnergySourcesMetadataSchema = z.object({
  layerId: z.string(),
  generatedAt: z.string(),
});

export const EnergySourcesResponseSchema = z.object({
  sources: z.array(EnergySourceInfoSchema),
  metadata: EnergySourcesMetadataSchema,
});

export type EnergySourcesResponse = z.infer<typeof EnergySourcesResponseSchema>;
