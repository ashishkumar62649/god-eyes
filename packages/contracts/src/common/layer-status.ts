import { z } from 'zod';

// ==================== Health ====================

export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  service: z.string(),
  timestamp: z.string().datetime(),
  database: z.object({
    status: z.enum(['connected', 'offline']),
    latencyMs: z.number().nullable(),
    message: z.string().nullable(),
  }),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// ==================== Layers ====================

export const LayerInfoSchema = z.object({
  layerId: z.string(),
  name: z.string(),
  status: z.enum(['available', 'unavailable', 'not_configured']),
  description: z.string(),
  objectTypes: z.array(z.string()),
});

export const LayerListMetadataSchema = z.object({
  mode: z.string(),
  returnedCount: z.number(),
  generatedAt: z.string().datetime(),
});

export type LayerListMetadata = z.infer<typeof LayerListMetadataSchema>;

export const LayersListResponseSchema = z.object({
  layers: z.array(LayerInfoSchema),
  metadata: LayerListMetadataSchema.optional(),
});

export type LayerInfo = z.infer<typeof LayerInfoSchema>;
export type LayersListResponse = z.infer<typeof LayersListResponseSchema>;

// ==================== Layer Status ====================

// SR-001: objectCounts is now a generic per-layer record.
// Each layer returns its own meaningful count keys; aviation keeps its
// historical keys (airports, runways, navaids, airportFrequencies,
// countries, regions). Non-aviation layers return their own domain keys.
// Globe Core and unimplemented layers return an empty object {}.
// Consumers must not hard-code aviation-specific keys for non-aviation layers.
export const LayerStatusResponseSchema = z.object({
  layerId: z.string(),
  status: z.enum(['ok', 'degraded', 'not_configured']),
  sourceId: z.string().nullable(),
  objectCounts: z.record(z.string(), z.number().int().nonnegative()),
  database: z.object({
    status: z.enum(['connected', 'offline']),
  }),
});

export type LayerStatusResponse = z.infer<typeof LayerStatusResponseSchema>;

// ==================== Layer Registry (WO-064) ====================

export const LayerRegistryStatuses = {
  ACTIVE: 'active',
  COMING_SOON: 'coming_soon',
  NO_DATA: 'no_data',
} as const;

export type LayerRegistryStatus = typeof LayerRegistryStatuses[keyof typeof LayerRegistryStatuses];

export const LayerDataStatuses = {
  STATIC: 'static',
  LIVE: 'live',
} as const;

export type LayerDataStatus = typeof LayerDataStatuses[keyof typeof LayerDataStatuses];

export const LayerRegistryEntrySchema = z.object({
  layerId: z.string(),
  name: z.string(),
  category: z.string(),
  status: z.enum(['active', 'coming_soon', 'no_data']),
  dataStatus: z.enum(['static', 'live']),
  description: z.string(),
  sourceRule: z.string(),
  apiStatus: z.string(),
  frontendStatus: z.string(),
  safetyNotes: z.string(),
  isEnabled: z.boolean(),
  isImplemented: z.boolean(),
});

export type LayerRegistryEntry = z.infer<typeof LayerRegistryEntrySchema>;

export const LayerRegistryMetadataSchema = z.object({
  total: z.number().int().nonnegative(),
  generatedAt: z.string().datetime(),
});

export type LayerRegistryMetadata = z.infer<typeof LayerRegistryMetadataSchema>;

export const LayerRegistryResponseSchema = z.object({
  layers: z.array(LayerRegistryEntrySchema),
  metadata: LayerRegistryMetadataSchema,
});

export type LayerRegistryResponse = z.infer<typeof LayerRegistryResponseSchema>;

export const LayerRegistrySingleResponseSchema = z.object({
  layer: LayerRegistryEntrySchema,
});

export type LayerRegistrySingleResponse = z.infer<typeof LayerRegistrySingleResponseSchema>;
