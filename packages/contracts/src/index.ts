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