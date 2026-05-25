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

export const LayerStatusResponseSchema = z.object({
  layerId: z.string(),
  status: z.enum(['ok', 'degraded', 'not_configured']),
  sourceId: z.string().nullable(),
  objectCounts: z.object({
    airports: z.number(),
    runways: z.number(),
    navaids: z.number(),
    airportFrequencies: z.number(),
    countries: z.number(),
    regions: z.number(),
  }),
  database: z.object({
    status: z.enum(['connected', 'offline']),
  }),
});

export type LayerStatusResponse = z.infer<typeof LayerStatusResponseSchema>;

// ==================== Pagination ====================

export const PaginationSchema = z.object({
  limit: z.number(),
  offset: z.number(),
  returned: z.number(),
  total: z.number().optional(),
});

export type Pagination = z.infer<typeof PaginationSchema>;

// ==================== List Metadata ====================

export const ObjectListMetadataSchema = z.object({
  mode: z.enum(['standard', 'search']),
  filtersApplied: z.record(z.unknown()).optional(),
  bboxApplied: z.boolean().optional(),
  generatedAt: z.string().datetime(),
  fields: z.enum(['standard', 'marker']).optional(),
  coordinates: z.enum(['source', 'effective']).optional(),
});

export type ObjectListMetadata = z.infer<typeof ObjectListMetadataSchema>;

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

// ==================== Error Response ====================

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

// ==================== Invalid Object Type Response ====================

export const NotImplementedResponseSchema = z.object({
  error: z.object({
    code: z.literal('NOT_IMPLEMENTED'),
    message: z.string(),
    supportedTypes: z.array(z.string()),
  }),
});

export type NotImplementedResponse = z.infer<typeof NotImplementedResponseSchema>;

// ==================== Payload Profile ====================

export const PayloadProfiles = {
  STANDARD: 'standard',
  MARKER: 'marker',
} as const;

export type PayloadProfile = typeof PayloadProfiles[keyof typeof PayloadProfiles];

// ==================== Coordinate Mode ====================

export const CoordinateModes = {
  SOURCE: 'source',
  EFFECTIVE: 'effective',
} as const;

export type CoordinateMode = typeof CoordinateModes[keyof typeof CoordinateModes];

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

// ==================== Error Codes ====================

export const ErrorCodes = {
  DATABASE_OFFLINE: 'DATABASE_OFFLINE',
  INVALID_LAYER: 'INVALID_LAYER',
  INVALID_OBJECT_TYPE: 'INVALID_OBJECT_TYPE',
  OBJECT_NOT_FOUND: 'OBJECT_NOT_FOUND',
  INVALID_QUERY: 'INVALID_QUERY',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INVALID_BBOX: 'INVALID_BBOX',
  INVALID_LIMIT: 'INVALID_LIMIT',
  INVALID_CATEGORY: 'INVALID_CATEGORY',
  INVALID_MODE: 'INVALID_MODE',
  MISSING_BBOX: 'MISSING_BBOX',
  INVALID_FIELDS: 'INVALID_FIELDS',
  INVALID_COORDINATES: 'INVALID_COORDINATES',
  INVALID_NAVAID_PARAMS: 'INVALID_NAVAID_PARAMS',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];