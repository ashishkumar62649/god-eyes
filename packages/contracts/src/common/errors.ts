import { z } from 'zod';

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
