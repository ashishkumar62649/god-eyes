import { z } from 'zod';

// ==================== Space & Satellites — Layer 05 (WO-082D) ====================

export const SpaceSatellitePositionSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  altitudeKm: z.number().nullable(),
});

export type SpaceSatellitePosition = z.infer<typeof SpaceSatellitePositionSchema>;

export const SpaceSatelliteVelocitySchema = z.object({
  speedKms: z.number().nullable(),
});

export type SpaceSatelliteVelocity = z.infer<typeof SpaceSatelliteVelocitySchema>;

export const SpaceSatelliteItemSchema = z.object({
  satelliteId: z.string().uuid(),
  noradId: z.number().nullable(),
  name: z.string(),
  objectType: z.enum(['satellite', 'debris', 'rocket_body', 'inactive_payload', 'unknown']),
  category: z.string(),
  orbitClass: z.string(),
  country: z.string().nullable(),
  launchDate: z.string().nullable(),
  position: SpaceSatellitePositionSchema,
  velocity: SpaceSatelliteVelocitySchema,
  headingDeg: z.number().nullable(),
  visualShape: z.enum(['dot', 'triangle']),
  visualColor: z.string(),
  important: z.boolean(),
  estimatedAt: z.string(),
  sourceId: z.string(),
  sourceObjectId: z.string(),
  sourceAgeSeconds: z.number().nullable(),
});

export type SpaceSatelliteItem = z.infer<typeof SpaceSatelliteItemSchema>;

export const SpaceSatellitesListMetadataSchema = z.object({
  count: z.number().int().nonnegative(),
  totalAvailable: z.number().int().nonnegative().optional(),
  requestedLimit: z.number().int().positive().optional(),
  appliedLimit: z.number().int().positive().optional(),
  maxLimit: z.number().int().positive().optional(),
  activeFilters: z.record(z.unknown()).optional(),
  generatedAt: z.string().datetime(),
  estimated: z.literal(true),
  layerId: z.literal('layer_05_space_satellites'),
});

export type SpaceSatellitesListMetadata = z.infer<typeof SpaceSatellitesListMetadataSchema>;

export const SpaceSatellitesListResponseSchema = z.object({
  satellites: z.array(SpaceSatelliteItemSchema),
  metadata: SpaceSatellitesListMetadataSchema,
});

export type SpaceSatellitesListResponse = z.infer<typeof SpaceSatellitesListResponseSchema>;

// Detail response

export const SpaceSatelliteDetailSchema = SpaceSatelliteItemSchema.extend({
  operator: z.string().nullable().optional(),
});

export type SpaceSatelliteDetail = z.infer<typeof SpaceSatelliteDetailSchema>;

export const SpaceSatelliteDetailResponseSchema = z.object({
  satellite: SpaceSatelliteDetailSchema,
});

export type SpaceSatelliteDetailResponse = z.infer<typeof SpaceSatelliteDetailResponseSchema>;

// Categories / filters metadata

export const SpaceCategoryCountSchema = z.object({
  category: z.string(),
  count: z.number().int().nonnegative(),
});

export const SpaceObjectTypeCountSchema = z.object({
  objectType: z.string(),
  count: z.number().int().nonnegative(),
});

export const SpaceOrbitClassCountSchema = z.object({
  orbitClass: z.string(),
  count: z.number().int().nonnegative(),
});

export const SpaceCategoriesMetadataSchema = z.object({
  generatedAt: z.string().datetime(),
  layerId: z.literal('layer_05_space_satellites'),
  estimated: z.literal(true),
});

export const SpaceCategoriesResponseSchema = z.object({
  categories: z.array(SpaceCategoryCountSchema),
  objectTypes: z.array(SpaceObjectTypeCountSchema),
  orbitClasses: z.array(SpaceOrbitClassCountSchema),
  totalCount: z.number().int().nonnegative(),
  importantCount: z.number().int().nonnegative(),
  metadata: SpaceCategoriesMetadataSchema,
});

export type SpaceCategoriesResponse = z.infer<typeof SpaceCategoriesResponseSchema>;
