import { query } from '../../lib/db.js';

export interface AirportBaseRow {
  id: string;
  name: string;
  iata_code: string | null;
  gps_code: string | null;
  municipality: string | null;
  iso_country: string | null;
  wikipedia_link: string | null;
  elevation_ft: number | null;
}

export interface PublicProfileRow {
  id: string;
  airport_id: string | null;
  profile_payload: Record<string, unknown>;
  profile_summary: string | null;
  source_attribution: Record<string, unknown>;
  source_urls: Record<string, unknown>[];
}

export interface IntelligenceModuleRow {
  id: string;
  airport_id: string;
  module_key: string;
  module_status: string;
  cache_state: string;
  confidence_label: string | null;
  confidence_score: number | null;
  data_payload: Record<string, unknown> | null;
  summary_payload: Record<string, unknown> | null;
  source_summary: Record<string, unknown> | null;
  fetched_at: Date | string | null;
  stale_at: Date | string | null;
  expires_at: Date | string | null;
}

export interface SourceLinkRow {
  id: string;
  airport_id: string;
  module_key: string | null;
  source_type: string;
  source_name: string;
  source_url: string | null;
  source_entity_id: string | null;
  attribution_text: string | null;
  is_primary: boolean;
  confidence_label: string | null;
  confidence_score: number | null;
}

export interface DerivedIntelligenceRow {
  id: string;
  airport_id: string;
  intelligence_status: string;
  airport_class: string | null;
  runway_capability: string | null;
  operating_role: string | null;
  capability_tags: string[];
  confidence_score: number | null;
  longest_runway_ft: number | null;
  runway_count: number | null;
  intelligence_summary: string | null;
  capability_summary: string | null;
}

export interface CapacityProfileRow {
  id: string;
  airport_id: string;
  annual_passenger_capacity: number | null;
  terminal_capacity: number | null;
  runway_movement_capacity_per_hour: number | null;
  terminal_count: number | null;
  gate_count: number | null;
  stand_count: number | null;
  aircraft_stand_count: number | null;
  check_in_counter_count: number | null;
  baggage_belt_count: number | null;
  capacity_year: number | null;
  capacity_basis: string | null;
  confidence_label: string | null;
  confidence_score: number | null;
  capacity_status: string;
  notes: string | null;
}

export interface TrafficMetricRow {
  id: string;
  airport_id: string;
  metric_type: string;
  period_year: number;
  metric_value: number;
  metric_unit: string;
  confidence_label: string | null;
  confidence_score: number | null;
}

export async function getAirportBase(airportId: string): Promise<AirportBaseRow | null> {
  const rows = await query<AirportBaseRow>(
    `SELECT id, name, iata_code, gps_code, municipality, iso_country, wikipedia_link, elevation_ft
     FROM aviation_airports
     WHERE id = $1`,
    [airportId]
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function getPublicProfile(airportId: string): Promise<PublicProfileRow | null> {
  const rows = await query<PublicProfileRow>(
    `SELECT id, airport_id, profile_payload, profile_summary, source_attribution, source_urls
     FROM airport_public_profiles
     WHERE airport_id = $1
     LIMIT 1`,
    [airportId]
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function getIntelligenceModules(airportId: string): Promise<IntelligenceModuleRow[]> {
  return query<IntelligenceModuleRow>(
    `SELECT id, airport_id, module_key, module_status, cache_state,
            confidence_label, confidence_score, data_payload, summary_payload,
            source_summary, fetched_at, stale_at, expires_at
     FROM airport_intelligence_modules
     WHERE airport_id = $1`,
    [airportId]
  );
}

export async function getSourceLinks(airportId: string): Promise<SourceLinkRow[]> {
  return query<SourceLinkRow>(
    `SELECT id, airport_id, module_key, source_type, source_name, source_url,
            source_entity_id, attribution_text, is_primary, confidence_label, confidence_score
     FROM airport_source_links
     WHERE airport_id = $1
     ORDER BY is_primary DESC, source_name ASC`,
    [airportId]
  );
}

export async function getDerivedIntelligence(airportId: string): Promise<DerivedIntelligenceRow | null> {
  const rows = await query<DerivedIntelligenceRow>(
    `SELECT id, airport_id, intelligence_status, airport_class, runway_capability,
            operating_role, capability_tags, confidence_score, longest_runway_ft,
            runway_count, intelligence_summary, capability_summary
     FROM airport_derived_intelligence
     WHERE airport_id = $1`,
    [airportId]
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function getCapacityProfile(airportId: string): Promise<CapacityProfileRow | null> {
  const rows = await query<CapacityProfileRow>(
    `SELECT id, airport_id, annual_passenger_capacity, terminal_capacity,
            runway_movement_capacity_per_hour, terminal_count, gate_count, stand_count,
            aircraft_stand_count, check_in_counter_count, baggage_belt_count,
            capacity_year, capacity_basis, confidence_label, confidence_score,
            capacity_status, notes
     FROM airport_capacity_profiles
     WHERE airport_id = $1`,
    [airportId]
  );
  return rows.length > 0 ? rows[0] : null;
}

export interface AirportImageAssetRow {
  id: string;
  airport_id: string;
  source_type: string;
  source_name: string | null;
  source_url: string | null;
  image_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  description: string | null;
  attribution_text: string | null;
  license_name: string | null;
  license_url: string | null;
  width_px: number | null;
  height_px: number | null;
  image_kind: string;
  is_hero: boolean;
  rank: number;
  created_at: Date | string;
}

export async function getAirportImages(airportId: string, limit: number = 12): Promise<AirportImageAssetRow[]> {
  return query<AirportImageAssetRow>(
    `SELECT id, airport_id, source_type, source_name, source_url,
            image_url, thumbnail_url, caption, description,
            attribution_text, license_name, license_url,
            width_px, height_px, image_kind, is_hero, rank, created_at
     FROM airport_image_assets
     WHERE airport_id = $1
     ORDER BY is_hero DESC, rank ASC, created_at ASC
     LIMIT $2`,
    [airportId, limit]
  );
}

export async function getTrafficMetrics(airportId: string): Promise<TrafficMetricRow[]> {
  return query<TrafficMetricRow>(
    `SELECT id, airport_id, metric_type, period_year, metric_value, metric_unit,
            confidence_label, confidence_score
     FROM airport_traffic_metrics
     WHERE airport_id = $1
     ORDER BY period_year DESC, metric_type ASC`,
    [airportId]
  );
}
