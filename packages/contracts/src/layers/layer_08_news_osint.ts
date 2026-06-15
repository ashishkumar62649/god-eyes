import { z } from 'zod';

// ==================== News & OSINT — Layer 08 (WO-NEWS-A1) ====================

export const NewsItemLocationSchema = z.object({
  confidence: z.string(),
  country_code: z.string().nullable(),
  country_name: z.string().nullable(),
  region: z.string().nullable(),
  city: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  geometry_type: z.string().nullable(),
  geo_source: z.string().nullable(),
  has_coordinates: z.boolean(),
  marker_ready: z.boolean(),
});

export type NewsItemLocation = z.infer<typeof NewsItemLocationSchema>;

export const NewsItemSchema = z.object({
  item_id: z.string(),
  layer_id: z.string(),
  source_id: z.string(),
  source_family: z.string(),
  source_object_id: z.string().nullable(),
  source_url: z.string().nullable(),
  title: z.string(),
  summary: z.string().nullable(),
  content_type: z.string(),
  published_at: z.string().nullable(),
  source_updated_at: z.string().nullable(),
  fetched_at: z.string(),
  first_seen_at: z.string(),
  last_seen_at: z.string(),
  location: NewsItemLocationSchema,
  category: z.string(),
  subcategory: z.string().nullable(),
  severity: z.string(),
  source_domain: z.string().nullable(),
  source_language: z.string().nullable(),
  source_country: z.string().nullable(),
  confidence_score: z.number().nullable(),
  attribution: z.string(),
  is_active: z.boolean(),
});

export type NewsItem = z.infer<typeof NewsItemSchema>;

export const NewsItemsListMetadataSchema = z.object({
  layer_id: z.string(),
  count: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  total: z.number().int().nonnegative().optional(),
});

export type NewsItemsListMetadata = z.infer<typeof NewsItemsListMetadataSchema>;

export const NewsItemsListResponseSchema = z.object({
  data: z.array(NewsItemSchema),
  meta: NewsItemsListMetadataSchema,
});

export type NewsItemsListResponse = z.infer<typeof NewsItemsListResponseSchema>;

export const NewsMarkerItemSchema = z.object({
  item_id: z.string(),
  title: z.string(),
  source_id: z.string(),
  source_url: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  country_code: z.string().nullable(),
  country_name: z.string().nullable(),
  category: z.string(),
  subcategory: z.string().nullable(),
  severity: z.string(),
  published_at: z.string().nullable(),
  source_updated_at: z.string().nullable(),
  marker_ready: z.boolean(),
  attribution: z.string(),
});

export type NewsMarkerItem = z.infer<typeof NewsMarkerItemSchema>;

export const NewsMarkersListMetadataSchema = z.object({
  layer_id: z.string(),
  count: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
});

export type NewsMarkersListMetadata = z.infer<typeof NewsMarkersListMetadataSchema>;

export const NewsMarkersListResponseSchema = z.object({
  data: z.array(NewsMarkerItemSchema),
  meta: NewsMarkersListMetadataSchema,
});

export type NewsMarkersListResponse = z.infer<typeof NewsMarkersListResponseSchema>;

export const NewsSourceItemSchema = z.object({
  source_id: z.string(),
  layer_id: z.string(),
  source_family: z.string(),
  display_name: z.string(),
  endpoint_url: z.string(),
  auth_type: z.string(),
  attribution: z.string(),
  license: z.string().nullable(),
  enabled: z.boolean(),
  last_fetched_at: z.string().nullable(),
  last_error: z.string().nullable(),
  update_frequency_minutes: z.number().int().nullable(),
});

export type NewsSourceItem = z.infer<typeof NewsSourceItemSchema>;

export const NewsSourcesMetadataSchema = z.object({
  count: z.number().int().nonnegative(),
  layer_id: z.string(),
});

export type NewsSourcesMetadata = z.infer<typeof NewsSourcesMetadataSchema>;

export const NewsSourcesResponseSchema = z.object({
  data: z.array(NewsSourceItemSchema),
  meta: NewsSourcesMetadataSchema,
});

export type NewsSourcesResponse = z.infer<typeof NewsSourcesResponseSchema>;

export const NewsFetchRunItemSchema = z.object({
  fetch_run_id: z.string(),
  layer_id: z.string(),
  source_id: z.string(),
  source_family: z.string(),
  run_type: z.string(),
  status: z.string(),
  started_at: z.string(),
  completed_at: z.string().nullable(),
  fetched_item_count: z.number().int().nonnegative(),
  normalized_item_count: z.number().int().nonnegative(),
  marker_ready_count: z.number().int().nonnegative(),
  skipped_item_count: z.number().int().nonnegative(),
  error_message: z.string().nullable(),
  created_at: z.string(),
});

export type NewsFetchRunItem = z.infer<typeof NewsFetchRunItemSchema>;

export const NewsFetchRunsMetadataSchema = z.object({
  count: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  layer_id: z.string(),
});

export type NewsFetchRunsMetadata = z.infer<typeof NewsFetchRunsMetadataSchema>;

export const NewsFetchRunsResponseSchema = z.object({
  data: z.array(NewsFetchRunItemSchema),
  meta: NewsFetchRunsMetadataSchema,
});

export type NewsFetchRunsResponse = z.infer<typeof NewsFetchRunsResponseSchema>;

export const NewsBySourceSchema = z.object({
  source_id: z.string(),
  count: z.number().int().nonnegative(),
});

export const NewsByCategorySchema = z.object({
  category: z.string(),
  count: z.number().int().nonnegative(),
});

export const NewsBySubcategorySchema = z.object({
  subcategory: z.string(),
  count: z.number().int().nonnegative(),
});

export const NewsBySeveritySchema = z.object({
  severity: z.string(),
  count: z.number().int().nonnegative(),
});

export const NewsByGeometryTypeSchema = z.object({
  geometry_type: z.string(),
  count: z.number().int().nonnegative(),
});

export const NewsStatsResponseSchema = z.object({
  layer_id: z.string(),
  total_items: z.number().int().nonnegative(),
  marker_ready_items: z.number().int().nonnegative(),
  items_with_geom: z.number().int().nonnegative(),
  by_source: z.array(NewsBySourceSchema),
  by_category: z.array(NewsByCategorySchema),
  by_subcategory: z.array(NewsBySubcategorySchema),
  by_severity: z.array(NewsBySeveritySchema),
  by_geometry_type: z.array(NewsByGeometryTypeSchema),
  latest_fetch_run: z.string().nullable(),
  fake_coordinate_risk_count: z.number().int().nonnegative(),
});

export type NewsStatsResponse = z.infer<typeof NewsStatsResponseSchema>;
