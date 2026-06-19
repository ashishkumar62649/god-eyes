// Converts database row shapes to API response shapes for the news route.
import type { NewsItemRow, NewsMarkerRow } from './types.js';

// WO-3-1: use shared type/date conversion helpers from apps/api/src/lib/typeUtils.ts.
// Local helper definitions were removed. Re-export so existing imports from
// './mapper.js' (e.g. news/service.ts) keep working unchanged.
import {
  toIsoString,
  toIsoStringOrNull,
  toNumber,
  toNumberOrNull,
} from '../../lib/typeUtils.js';
export {
  toIsoString,
  toIsoStringOrNull,
  toNumber,
  toNumberOrNull,
};

export function rowToNewsItem(row: NewsItemRow) {
  return {
    item_id: row.item_id,
    layer_id: row.layer_id,
    source_id: row.source_id,
    source_family: row.source_family,
    source_object_id: row.source_object_id,
    source_url: row.source_url,
    title: row.title,
    summary: row.summary,
    content_type: row.content_type,
    published_at: toIsoStringOrNull(row.published_at),
    source_updated_at: toIsoStringOrNull(row.source_updated_at),
    fetched_at: toIsoString(row.fetched_at),
    first_seen_at: toIsoString(row.first_seen_at),
    last_seen_at: toIsoString(row.last_seen_at),
    location: {
      confidence: row.location_confidence,
      country_code: row.country_code,
      country_name: row.country_name,
      region: row.region,
      city: row.city,
      latitude: toNumberOrNull(row.latitude),
      longitude: toNumberOrNull(row.longitude),
      geometry_type: row.geometry_type,
      geo_source: row.geo_source,
      has_coordinates: row.has_coordinates,
      marker_ready: row.marker_ready,
    },
    category: row.category,
    subcategory: row.subcategory,
    severity: row.severity,
    source_domain: row.source_domain,
    source_language: row.source_language,
    source_country: row.source_country,
    confidence_score: toNumberOrNull(row.confidence_score),
    attribution: row.attribution,
    is_active: row.is_active,
  };
}

export function rowToNewsMarker(row: NewsMarkerRow) {
  return {
    item_id: row.item_id,
    title: row.title,
    source_id: row.source_id,
    source_url: row.source_url,
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    country_code: row.country_code,
    country_name: row.country_name,
    category: row.category,
    subcategory: row.subcategory,
    severity: row.severity,
    published_at: toIsoStringOrNull(row.published_at),
    source_updated_at: toIsoStringOrNull(row.source_updated_at),
    marker_ready: row.marker_ready,
    attribution: row.attribution,
  };
}
