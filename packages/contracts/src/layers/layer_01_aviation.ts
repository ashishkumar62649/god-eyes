import { z } from 'zod';
import { PaginationSchema, ObjectListMetadataSchema } from '../common/pagination.js';

// ==================== Airport Object ====================

export const AirportPositionSchema = z.object({
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
});

export const AirportObjectSchema = z.object({
  id: z.string().uuid(),
  layerId: z.string(),
  objectType: z.literal('airport'),
  sourceId: z.string(),
  sourceObjectId: z.string(),
  name: z.string(),
  ident: z.string(),
  iataCode: z.string().nullable(),
  category: z.string(),
  typeSource: z.string(),
  country: z.string().nullable(),
  region: z.string().nullable(),
  municipality: z.string().nullable(),
  position: AirportPositionSchema,
  elevationFt: z.number().nullable(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type AirportPosition = z.infer<typeof AirportPositionSchema>;
export type AirportObject = z.infer<typeof AirportObjectSchema>;

// ==================== Airport Marker Object (lightweight) ====================

export const AirportMarkerObjectSchema = z.object({
  id: z.string().uuid(),
  layerId: z.string(),
  objectType: z.literal('airport'),
  name: z.string(),
  ident: z.string(),
  iataCode: z.string().nullable(),
  category: z.string(),
  municipality: z.string().nullable(),
  country: z.string().nullable(),
  position: AirportPositionSchema,
  elevationFt: z.number().nullable().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type AirportMarkerObject = z.infer<typeof AirportMarkerObjectSchema>;

// ==================== Marker Objects List Response ====================

export const AirportMarkerObjectsListResponseSchema = z.object({
  items: z.array(AirportMarkerObjectSchema),
  pagination: PaginationSchema,
  mode: z.enum(['points', 'clusters']).optional(),
  metadata: ObjectListMetadataSchema.optional(),
});

export type AirportMarkerObjectsListResponse = z.infer<typeof AirportMarkerObjectsListResponseSchema>;

// ==================== Airport Cluster Object ====================

export const AirportClusterPositionSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

export const AirportClusterBBoxSchema = z.object({
  minLongitude: z.number(),
  minLatitude: z.number(),
  maxLongitude: z.number(),
  maxLatitude: z.number(),
});

export const AirportClusterObjectSchema = z.object({
  id: z.string(),
  layerId: z.literal('layer_01_aviation'),
  objectType: z.literal('airport_cluster'),
  count: z.number().int().positive(),
  position: AirportClusterPositionSchema,
  bbox: AirportClusterBBoxSchema,
  categoryBreakdown: z.record(z.string(), z.number().int().nonnegative()),
});

export type AirportClusterPosition = z.infer<typeof AirportClusterPositionSchema>;
export type AirportClusterBBox = z.infer<typeof AirportClusterBBoxSchema>;
export type AirportClusterObject = z.infer<typeof AirportClusterObjectSchema>;

// ==================== Objects List (Points or Clusters) ====================

export const LayerObjectsListResponseSchema = z.object({
  items: z.union([
    z.array(AirportObjectSchema),
    z.array(AirportClusterObjectSchema),
  ]),
  pagination: PaginationSchema,
  mode: z.enum(['points', 'clusters']).optional(),
  metadata: ObjectListMetadataSchema.optional(),
});

export type LayerObjectsListResponse = z.infer<typeof LayerObjectsListResponseSchema>;

// ==================== Object Detail ====================

export const LayerObjectDetailResponseSchema = AirportObjectSchema;

export type LayerObjectDetailResponse = z.infer<typeof LayerObjectDetailResponseSchema>;

// ==================== Airport Detail ====================

export const RunwayDetailSchema = z.object({
  id: z.string().uuid(),
  ident: z.string(),
  lengthFt: z.number().nullable(),
  widthFt: z.number().nullable(),
  surface: z.string().nullable(),
  lighted: z.boolean().nullable(),
  closed: z.boolean().nullable(),
  leIdent: z.string().nullable(),
  leLatitude: z.number().nullable(),
  leLongitude: z.number().nullable(),
  leElevationFt: z.number().nullable(),
  leHeadingDeg: z.number().nullable(),
  heIdent: z.string().nullable(),
  heLatitude: z.number().nullable(),
  heLongitude: z.number().nullable(),
  heElevationFt: z.number().nullable(),
  heHeadingDeg: z.number().nullable(),
});

export type RunwayDetail = z.infer<typeof RunwayDetailSchema>;

export const FrequencyDetailSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  description: z.string().nullable(),
  frequencyMhz: z.number().nullable(),
});

export type FrequencyDetail = z.infer<typeof FrequencyDetailSchema>;

export const NavaidDetailSchema = z.object({
  id: z.string().uuid(),
  ident: z.string(),
  name: z.string(),
  type: z.string(),
  frequencyKhz: z.number().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  elevationFt: z.number().nullable(),
  distanceKm: z.number().nullable(),
});

export type NavaidDetail = z.infer<typeof NavaidDetailSchema>;

export const AirportDetailMetadataSchema = z.object({
  generatedAt: z.string().datetime(),
  layerId: z.string(),
  objectId: z.string(),
  coordinates: z.enum(['source', 'effective']).optional(),
  runwayCount: z.number(),
  frequencyCount: z.number(),
  nearbyNavaidCount: z.number(),
  navaidRadiusKm: z.number().optional(),
});

export type AirportDetailMetadata = z.infer<typeof AirportDetailMetadataSchema>;

export const AirportDetailResponseSchema = z.object({
  airport: AirportObjectSchema,
  runways: z.array(RunwayDetailSchema),
  frequencies: z.array(FrequencyDetailSchema),
  nearbyNavaids: z.array(NavaidDetailSchema),
  metadata: AirportDetailMetadataSchema,
});

export type AirportDetailResponse = z.infer<typeof AirportDetailResponseSchema>;

// ==================== Aviation Density / Fabric Mode (WO-029D) ====================

export const AirportDensityCellSchema = z.object({
  id: z.string(),
  layerId: z.string(),
  objectType: z.literal('airport_density'),
  count: z.number().min(1),
  position: AirportPositionSchema,
  bbox: AirportClusterBBoxSchema.optional(),
  categoryCounts: z.record(z.string(), z.number()).optional(),
});

export type AirportDensityCell = z.infer<typeof AirportDensityCellSchema>;

export const AirportDensityResponseSchema = z.object({
  items: z.array(AirportDensityCellSchema),
  pagination: PaginationSchema,
  mode: z.literal('density'),
  metadata: ObjectListMetadataSchema.optional(),
});

export type AirportDensityResponse = z.infer<typeof AirportDensityResponseSchema>;

// ==================== Aviation Preload / Resident Cache Mode (WO-030A) ====================

export const AirportPreloadObjectSchema = z.object({
  id: z.string().uuid(),
  ident: z.string(),
  name: z.string(),
  category: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  country: z.string().nullable(),
  region: z.string().nullable(),
  municipality: z.string().nullable(),
  iataCode: z.string().nullable(),
  icaoCode: z.string().nullable(),
  gpsCode: z.string().nullable(),
  elevationFt: z.number().nullable(),
  status: z.string().nullable(),
});

export type AirportPreloadObject = z.infer<typeof AirportPreloadObjectSchema>;

export const PreloadCategorySummarySchema = z.object({
  category: z.string(),
  count: z.number(),
});

export type PreloadCategorySummary = z.infer<typeof PreloadCategorySummarySchema>;

export const AirportPreloadMetadataSchema = z.object({
  mode: z.literal('preload'),
  category: z.string(),
  returnedCount: z.number(),
  totalCount: z.number(),
  generatedAt: z.string().datetime(),
  dataVersion: z.string().optional(),
  updatedAt: z.string().datetime().optional(),
  summary: z.array(PreloadCategorySummarySchema).optional(),
});

export type AirportPreloadMetadata = z.infer<typeof AirportPreloadMetadataSchema>;

export const AirportPreloadListResponseSchema = z.object({
  items: z.array(AirportPreloadObjectSchema),
  metadata: AirportPreloadMetadataSchema,
});

export type AirportPreloadListResponse = z.infer<typeof AirportPreloadListResponseSchema>;

// ==================== Aviation Live Aircraft (WO-079D) ====================

export const AircraftLatestSchema = z.object({
  sourceId: z.string(),
  sourceObjectId: z.string(),
  callsign: z.string().nullable(),
  registration: z.string().nullable(),
  aircraftType: z.string().nullable(),
  dbFlags: z.number().int().nullable(),
  isMilitary: z.boolean(),
  isInteresting: z.boolean(),
  isPia: z.boolean(),
  isLadd: z.boolean(),
  sourceMessageType: z.string().nullable(),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
  altitudeBaroFt: z.number().nullable(),
  altitudeGeomFt: z.number().nullable(),
  onGround: z.boolean().nullable(),
  groundSpeedKt: z.number().nullable(),
  trackDeg: z.number().nullable(),
  headingMagDeg: z.number().nullable(),
  headingTrueDeg: z.number().nullable(),
  verticalRateFpm: z.number().nullable(),
  geomRateFpm: z.number().nullable(),
  squawk: z.string().nullable(),
  emergency: z.string().nullable(),
  seenSeconds: z.number().nullable(),
  seenPosSeconds: z.number().nullable(),
  observedAt: z.string(),
  receivedAt: z.string(),
  staleAfter: z.string().nullable(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
});

export type AircraftLatest = z.infer<typeof AircraftLatestSchema>;

export const AircraftLatestDetailSchema = AircraftLatestSchema.extend({
  rawJson: z.record(z.unknown()).nullable().optional(),
});

export type AircraftLatestDetail = z.infer<typeof AircraftLatestDetailSchema>;

export const AircraftLatestMetadataSchema = z.object({
  count: z.number().int().nonnegative(),
  generatedAt: z.string().datetime(),
});

export type AircraftLatestMetadata = z.infer<typeof AircraftLatestMetadataSchema>;

export const AircraftLatestListResponseSchema = z.object({
  aircraft: z.array(AircraftLatestSchema),
  metadata: AircraftLatestMetadataSchema,
});

export type AircraftLatestListResponse = z.infer<typeof AircraftLatestListResponseSchema>;

export const AircraftDetailResponseSchema = z.object({
  aircraft: AircraftLatestDetailSchema,
});

export type AircraftDetailResponse = z.infer<typeof AircraftDetailResponseSchema>;
