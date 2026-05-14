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

export const LayersListResponseSchema = z.object({
  layers: z.array(LayerInfoSchema),
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

// ==================== Objects List ====================

export const LayerObjectsListResponseSchema = z.object({
  items: z.array(AirportObjectSchema),
  pagination: PaginationSchema,
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

// ==================== Error Codes ====================

export const ErrorCodes = {
  DATABASE_OFFLINE: 'DATABASE_OFFLINE',
  INVALID_LAYER: 'INVALID_LAYER',
  INVALID_OBJECT_TYPE: 'INVALID_OBJECT_TYPE',
  OBJECT_NOT_FOUND: 'OBJECT_NOT_FOUND',
  INVALID_QUERY: 'INVALID_QUERY',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];