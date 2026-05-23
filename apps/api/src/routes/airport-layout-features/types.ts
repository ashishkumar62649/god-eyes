import { z } from 'zod';

export const LayoutFeatureGeometrySchema = z.object({
    type: z.enum(['LineString', 'Point', 'Polygon']),
    coordinates: z.union([
        z.array(z.array(z.number())),
        z.array(z.number()),
        z.array(z.array(z.array(z.number()))),
    ]),
});

export type LayoutFeatureGeometry = z.infer<typeof LayoutFeatureGeometrySchema>;

export const AirportLayoutFeatureSchema = z.object({
    id: z.string().uuid(),
    featureType: z.string(),
    featureSubtype: z.string().nullable(),
    featureName: z.string().nullable(),
    sourceType: z.string(),
    geometryType: z.enum(['line', 'point', 'polygon']),
    geometry: LayoutFeatureGeometrySchema,
    centroid: z.array(z.number()).nullable(),
    bbox: z.array(z.number()).nullable(),
    confidenceLabel: z.string().nullable(),
    confidenceScore: z.number().nullable(),
    rank: z.number().nullable(),
    isPrimary: z.boolean(),
    isActive: z.boolean().optional(),
    fetchedAt: z.string().datetime().nullable(),
});

export type AirportLayoutFeature = z.infer<typeof AirportLayoutFeatureSchema>;

export const AirportLayoutSummarySchema = z.object({
    totalFeatures: z.number(),
    byType: z.record(z.string(), z.number()),
    sourceTypes: z.array(z.string()),
    hasRunways: z.boolean(),
    hasTaxiways: z.boolean(),
    hasAprons: z.boolean(),
    hasTerminals: z.boolean(),
});

export type AirportLayoutSummary = z.infer<typeof AirportLayoutSummarySchema>;

export const AirportLayoutFeaturesResponseSchema = z.object({
    status: z.enum(['ok', 'no_data', 'not_found', 'error']),
    airportId: z.string(),
    generatedAt: z.string().datetime().nullable(),
    features: z.array(AirportLayoutFeatureSchema),
    summary: AirportLayoutSummarySchema.nullable(),
});

export type AirportLayoutFeaturesResponse = z.infer<typeof AirportLayoutFeaturesResponseSchema>;

export interface LayoutFeatureParams {
    airportId: string;
}

export interface LayoutFeatureQuery {
    includeInactive?: string;
    featureType?: string;
}