import { z } from 'zod';

// ==================== Maritime — Layer 06 (WO-MAR-A) ====================

export const MaritimeVesselObjectSchema = z.object({
  id: z.string(),
  layerId: z.literal('layer_06_maritime'),
  sourceId: z.string(),
  mmsi: z.number(),
  dedupeKey: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  speedOverGround: z.number().nullable(),
  courseOverGround: z.number().nullable(),
  trueHeading: z.number().nullable(),
  navigationStatus: z.number().nullable(),
  navigationStatusText: z.string().nullable(),
  positionAccuracy: z.boolean().nullable(),
  receivedAt: z.string(),
  dataAgeSeconds: z.number().nullable(),
  vesselName: z.string().nullable(),
  vesselType: z.string().nullable(),
  vesselTypeCode: z.number().nullable(),
  callsign: z.string().nullable(),
  imo: z.number().nullable(),
  destination: z.string().nullable(),
  lengthMeters: z.number().nullable(),
  widthMeters: z.number().nullable(),
});

export type MaritimeVesselObject = z.infer<typeof MaritimeVesselObjectSchema>;

export const MaritimeObjectsListMetadataSchema = z.object({
  count: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  generatedAt: z.string(),
});

export type MaritimeObjectsListMetadata = z.infer<typeof MaritimeObjectsListMetadataSchema>;

export const MaritimeObjectsListResponseSchema = z.object({
  objects: z.array(MaritimeVesselObjectSchema),
  metadata: MaritimeObjectsListMetadataSchema,
});

export type MaritimeObjectsListResponse = z.infer<typeof MaritimeObjectsListResponseSchema>;

export const MaritimeVesselDetailSchema = MaritimeVesselObjectSchema.extend({
  rawEvidenceUri: z.string().nullable(),
  draughtMeters: z.number().nullable(),
  etaMonth: z.number().nullable(),
  etaDay: z.number().nullable(),
  etaHour: z.number().nullable(),
  etaMinute: z.number().nullable(),
  etaDisplay: z.string().nullable(),
  lastPositionAt: z.string().nullable(),
  lastReceivedAt: z.string().nullable(),
});

export type MaritimeVesselDetail = z.infer<typeof MaritimeVesselDetailSchema>;

export const MaritimeVesselDetailResponseSchema = z.object({
  vessel: MaritimeVesselDetailSchema,
});

export type MaritimeVesselDetailResponse = z.infer<typeof MaritimeVesselDetailResponseSchema>;

export const MaritimeStatsResponseSchema = z.object({
  layerId: z.literal('layer_06_maritime'),
  totalVessels: z.number().int().nonnegative(),
  activeVessels: z.number().int().nonnegative(),
  staleVessels: z.number().int().nonnegative(),
  byVesselType: z.record(z.string(), z.number().int().nonnegative()),
  lastUpdated: z.string().nullable(),
  dataFreshnessSeconds: z.number().nullable(),
  sourceId: z.string(),
  generatedAt: z.string(),
});

export type MaritimeStatsResponse = z.infer<typeof MaritimeStatsResponseSchema>;

export const MaritimePositionHistoryItemSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  speedOverGround: z.number().nullable(),
  courseOverGround: z.number().nullable(),
  trueHeading: z.number().nullable(),
  receivedAt: z.string(),
});

export type MaritimePositionHistoryItem = z.infer<typeof MaritimePositionHistoryItemSchema>;

export const MaritimePositionHistoryResponseSchema = z.object({
  mmsi: z.number(),
  vesselName: z.string().nullable(),
  positions: z.array(MaritimePositionHistoryItemSchema),
  count: z.number().int().nonnegative(),
  layerId: z.literal('layer_06_maritime'),
});

export type MaritimePositionHistoryResponse = z.infer<typeof MaritimePositionHistoryResponseSchema>;
