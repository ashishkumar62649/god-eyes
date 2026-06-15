// Route-local TypeScript types for the news route.

export interface ItemsQuerystring {
  source_id?: string;
  category?: string;
  subcategory?: string;
  severity?: string;
  country_code?: string;
  marker_ready?: string;
  has_coordinates?: string;
  geometry_type?: string;
  published_after?: string;
  published_before?: string;
  search?: string;
  limit?: string;
  offset?: string;
  order?: string;
}

export interface MarkersQuerystring {
  source_id?: string;
  category?: string;
  subcategory?: string;
  severity?: string;
  country_code?: string;
  published_after?: string;
  published_before?: string;
  limit?: string;
  bounds?: string;
}

export interface FetchRunsQuerystring {
  source_id?: string;
  status?: string;
  limit?: string;
  offset?: string;
}

export interface NewsItemRow {
  item_id: string;
  layer_id: string;
  source_id: string;
  source_family: string;
  source_object_id: string | null;
  source_url: string | null;
  title: string;
  summary: string | null;
  content_type: string;
  published_at: Date | string | null;
  source_updated_at: Date | string | null;
  fetched_at: Date | string;
  first_seen_at: Date | string;
  last_seen_at: Date | string;
  location_confidence: string;
  country_code: string | null;
  country_name: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  geometry_type: string | null;
  geo_source: string | null;
  has_coordinates: boolean;
  marker_ready: boolean;
  category: string;
  subcategory: string | null;
  severity: string;
  source_domain: string | null;
  source_language: string | null;
  source_country: string | null;
  confidence_score: number | null;
  attribution: string;
  is_active: boolean;
}

export interface NewsMarkerRow {
  item_id: string;
  title: string;
  source_id: string;
  source_url: string | null;
  latitude: number;
  longitude: number;
  country_code: string | null;
  country_name: string | null;
  category: string;
  subcategory: string | null;
  severity: string;
  published_at: Date | string | null;
  source_updated_at: Date | string | null;
  marker_ready: boolean;
  attribution: string;
}

export interface NewsSourceRow {
  source_id: string;
  layer_id: string;
  source_family: string;
  display_name: string;
  endpoint_url: string;
  auth_type: string;
  attribution: string;
  license: string | null;
  enabled: boolean;
  last_fetched_at: Date | string | null;
  last_error: string | null;
  update_frequency_minutes: number | null;
}

export interface NewsFetchRunRow {
  fetch_run_id: string;
  layer_id: string;
  source_id: string;
  source_family: string;
  run_type: string;
  status: string;
  started_at: Date | string;
  completed_at: Date | string | null;
  fetched_item_count: number;
  normalized_item_count: number;
  marker_ready_count: number;
  skipped_item_count: number;
  error_message: string | null;
  created_at: Date | string;
}
