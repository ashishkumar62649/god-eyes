// Route-local TypeScript types for the weather route.

export interface WeatherQuerystring {
  bbox?: string;
  observation_type?: string;
  source_id?: string;
  forecast_from?: string;
  forecast_to?: string;
  limit?: string;
  offset?: string;
}

export interface NearbyQuerystring {
  lat: string;
  lon: string;
  radius_km?: string;
  observation_type?: string;
  source_id?: string;
  limit?: string;
}

export interface FetchRunsQuerystring {
  source_id?: string;
  status?: string;
  limit?: string;
  offset?: string;
}

export interface BBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export interface WeatherObservationRow {
  observation_id: string;
  layer_id: string;
  source_id: string;
  location_id: string;
  observation_type: string;
  requested_latitude: number;
  requested_longitude: number;
  resolved_latitude: number;
  resolved_longitude: number;
  elevation_m: number | null;
  temperature_c: number;
  apparent_temperature_c: number | null;
  wind_speed_kph: number | null;
  wind_direction_deg: number | null;
  wind_gust_kph: number | null;
  humidity_percent: number | null;
  pressure_hpa: number | null;
  precipitation_mm: number | null;
  precipitation_probability_percent: number | null;
  cloud_cover_percent: number | null;
  weather_code: number | null;
  weather_label: string | null;
  forecast_for: Date | string;
  fetched_at: Date | string;
  is_stale: boolean;
  raw_evidence_uri: string | null;
  surfacePressureHpa: string | null;
  generationTimeMs: string | null;
  attribution: string;
}

export interface WeatherNearbyRow extends WeatherObservationRow {
  distance_km: number;
}

export interface WeatherSourceRow {
  source_id: string;
  source_name: string;
  source_url: string | null;
  licence: string | null;
  attribution: string | null;
  is_active: boolean;
}

export interface WeatherFetchRunRow {
  fetch_run_id: string;
  source_id: string;
  layer_id: string;
  grid_resolution: string;
  total_cells: number;
  successful_cells: number;
  failed_cells: number;
  fetch_started_at: Date | string;
  fetch_completed_at: Date | string | null;
  api_calls_made: number;
  raw_storage_path: string | null;
  status: string;
  error_message: string | null;
}
