import { z } from 'zod';

// ==================== Weather — Layer 07 (WO-WEATHER-A) ====================

export const WeatherCoordinatesSchema = z.object({
  requested: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  resolved: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  elevation_m: z.number().nullable(),
});

export type WeatherCoordinates = z.infer<typeof WeatherCoordinatesSchema>;

export const WeatherSchema = z.object({
  temperature_c: z.number(),
  apparent_temperature_c: z.number().nullable(),
  wind_speed_kph: z.number().nullable(),
  wind_direction_deg: z.number().nullable(),
  wind_gust_kph: z.number().nullable(),
  humidity_percent: z.number().int().nullable(),
  pressure_hpa: z.number().nullable(),
  precipitation_mm: z.number().nullable(),
  precipitation_probability_percent: z.number().int().nullable(),
  cloud_cover_percent: z.number().int().nullable(),
  weather_code: z.number().int().nullable(),
  weather_label: z.string().nullable(),
});

export type Weather = z.infer<typeof WeatherSchema>;

export const ProviderMetadataSchema = z.object({
  surface_pressure_hpa: z.number().nullable().optional(),
  generation_time_ms: z.number().nullable().optional(),
}).nullable();

export type ProviderMetadata = z.infer<typeof ProviderMetadataSchema>;

export const WeatherObservationItemSchema = z.object({
  observation_id: z.string(),
  observation_type: z.string(),
  layer_id: z.string(),
  source_id: z.string(),
  location_id: z.string(),
  coordinates: WeatherCoordinatesSchema,
  weather: WeatherSchema,
  forecast_for: z.string(),
  fetched_at: z.string(),
  is_stale: z.boolean(),
  raw_evidence_uri: z.string().nullable(),
  provider_metadata: ProviderMetadataSchema,
  attribution: z.string(),
});

export type WeatherObservationItem = z.infer<typeof WeatherObservationItemSchema>;

export const WeatherMetadataSchema = z.object({
  layer_id: z.string(),
  count: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  source_id: z.string(),
  attribution: z.string(),
});

export type WeatherMetadata = z.infer<typeof WeatherMetadataSchema>;

export const WeatherListResponseSchema = z.object({
  data: z.array(WeatherObservationItemSchema),
  meta: WeatherMetadataSchema,
});

export type WeatherListResponse = z.infer<typeof WeatherListResponseSchema>;

export const WeatherNearbyItemSchema = WeatherObservationItemSchema.extend({
  distance_km: z.number(),
});

export type WeatherNearbyItem = z.infer<typeof WeatherNearbyItemSchema>;

export const WeatherNearbyMetadataSchema = WeatherMetadataSchema.extend({
  lat: z.number(),
  lon: z.number(),
  radius_km: z.number().nullable(),
});

export type WeatherNearbyMetadata = z.infer<typeof WeatherNearbyMetadataSchema>;

export const WeatherNearbyResponseSchema = z.object({
  data: z.array(WeatherNearbyItemSchema),
  meta: WeatherNearbyMetadataSchema,
});

export type WeatherNearbyResponse = z.infer<typeof WeatherNearbyResponseSchema>;

export const WeatherSourceItemSchema = z.object({
  source_id: z.string(),
  source_name: z.string(),
  source_url: z.string().nullable(),
  licence: z.string().nullable(),
  attribution: z.string().nullable(),
  is_active: z.boolean(),
});

export type WeatherSourceItem = z.infer<typeof WeatherSourceItemSchema>;

export const WeatherSourcesMetadataSchema = z.object({
  count: z.number().int().nonnegative(),
  layer_id: z.string(),
});

export type WeatherSourcesMetadata = z.infer<typeof WeatherSourcesMetadataSchema>;

export const WeatherSourcesResponseSchema = z.object({
  data: z.array(WeatherSourceItemSchema),
  meta: WeatherSourcesMetadataSchema,
});

export type WeatherSourcesResponse = z.infer<typeof WeatherSourcesResponseSchema>;

export const WeatherFetchRunItemSchema = z.object({
  fetch_run_id: z.string(),
  source_id: z.string(),
  layer_id: z.string(),
  grid_resolution: z.string(),
  total_cells: z.number().int().nonnegative(),
  successful_cells: z.number().int().nonnegative(),
  failed_cells: z.number().int().nonnegative(),
  fetch_started_at: z.string(),
  fetch_completed_at: z.string().nullable(),
  api_calls_made: z.number().int().nonnegative(),
  raw_storage_path: z.string().nullable(),
  status: z.string(),
  error_message: z.string().nullable(),
});

export type WeatherFetchRunItem = z.infer<typeof WeatherFetchRunItemSchema>;

export const WeatherFetchRunsMetadataSchema = z.object({
  count: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  layer_id: z.string(),
});

export type WeatherFetchRunsMetadata = z.infer<typeof WeatherFetchRunsMetadataSchema>;

export const WeatherFetchRunsResponseSchema = z.object({
  data: z.array(WeatherFetchRunItemSchema),
  meta: WeatherFetchRunsMetadataSchema,
});

export type WeatherFetchRunsResponse = z.infer<typeof WeatherFetchRunsResponseSchema>;
