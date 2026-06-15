import { z } from 'zod';

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
