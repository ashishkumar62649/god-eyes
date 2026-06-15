import { z } from 'zod';

// ==================== Earth Events (WO-073) ====================

export const EarthEventGeometrySchema = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([z.number(), z.number()]),
});

export type EarthEventGeometry = z.infer<typeof EarthEventGeometrySchema>;

export const EarthEventSchema = z.object({
  id: z.string().uuid(),
  layerId: z.string(),
  sourceId: z.string(),
  sourceObjectId: z.string(),
  eventType: z.string(),
  magnitude: z.number().nullable(),
  magnitudeType: z.string().nullable(),
  depthKm: z.number().nullable(),
  place: z.string().nullable(),
  alertLevel: z.string().nullable(),
  significance: z.number().nullable(),
  tsunami: z.boolean(),
  geometry: EarthEventGeometrySchema,
  sourceUrl: z.string().nullable(),
  observedAt: z.string(),
  updatedAt: z.string(),
  fetchedAt: z.string(),
});

export type EarthEvent = z.infer<typeof EarthEventSchema>;

export const EarthEventsLatestMetadataSchema = z.object({
  count: z.number().int().nonnegative(),
  generatedAt: z.string().datetime(),
});

export type EarthEventsLatestMetadata = z.infer<typeof EarthEventsLatestMetadataSchema>;

export const EarthEventsLatestResponseSchema = z.object({
  events: z.array(EarthEventSchema),
  metadata: EarthEventsLatestMetadataSchema,
});

export type EarthEventsLatestResponse = z.infer<typeof EarthEventsLatestResponseSchema>;
