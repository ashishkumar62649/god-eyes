import { z } from 'zod';

// ==================== Borders & Boundaries (WO-078D) ====================

export const BordersBoundariesPropertiesSchema = z.object({
  id: z.string().uuid(),
  layerId: z.string(),
  sourceId: z.string(),
  sourceObjectId: z.string().nullable(),
  boundaryType: z.string(),
  boundaryLevel: z.string().nullable(),
  adminLevel: z.number().int().nullable(),
  countryIso2: z.string().nullable(),
  countryIso3: z.string().nullable(),
  name: z.string(),
  displayName: z.string().nullable(),
  disputed: z.boolean(),
  indiaSensitive: z.boolean(),
  indiaComplianceStatus: z.string(),
});

export type BordersBoundariesProperties = z.infer<typeof BordersBoundariesPropertiesSchema>;

export const BordersBoundariesFeatureSchema = z.object({
  type: z.literal('Feature'),
  id: z.string().uuid(),
  geometry: z.record(z.unknown()),
  properties: BordersBoundariesPropertiesSchema,
});

export type BordersBoundariesFeature = z.infer<typeof BordersBoundariesFeatureSchema>;

export const BordersBoundariesMetaSchema = z.object({
  count: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
  sourceId: z.string(),
  sourceName: z.string().nullable(),
  mvpLocalDevOnly: z.literal(true),
  productionApproved: z.literal(false),
  indiaCompliant: z.literal(false),
  caveat: z.string(),
});

export type BordersBoundariesMeta = z.infer<typeof BordersBoundariesMetaSchema>;

export const BordersBoundariesFeatureCollectionSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(BordersBoundariesFeatureSchema),
  meta: BordersBoundariesMetaSchema,
});

export type BordersBoundariesFeatureCollection = z.infer<typeof BordersBoundariesFeatureCollectionSchema>;
