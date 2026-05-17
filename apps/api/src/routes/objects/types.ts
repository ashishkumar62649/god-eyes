// Airport row from database
export interface AirportRow {
  id: string;
  layer_id: string;
  source_id: string;
  source_airport_id: string;
  ident: string;
  type_source: string;
  category_normalized: string;
  name: string;
  latitude_deg: number | null;
  longitude_deg: number | null;
  elevation_ft: number | null;
  iso_country: string | null;
  iso_region: string | null;
  municipality: string | null;
  iata_code: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

// Cluster row from database
export interface ClusterRow {
  cluster_id: string;
  center_lon: string;
  center_lat: string;
  airport_count: string;
  min_lon: string;
  min_lat: string;
  max_lon: string;
  max_lat: string;
  heliport_count: string | null;
  small_airfield_count: string | null;
  international_or_major_airport_count: string | null;
  regional_or_domestic_airport_count: string | null;
  water_landing_site_count: string | null;
  balloonport_count: string | null;
  closed_or_abandoned_count: string | null;
  unknown_count: string | null;
}

export function toContractDateTime(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}