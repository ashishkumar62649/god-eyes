// Business logic orchestration for the news route.
import { checkDatabaseStatus } from '../../lib/db.js';
import { queryItems, queryMarkers, querySources, queryFetchRuns, queryStats } from './repository.js';
import { rowToNewsItem, rowToNewsMarker, toIsoString, toIsoStringOrNull } from './mapper.js';

export { checkDatabaseStatus };

export async function getItems(params: {
  sourceId: string | null;
  category: string | null;
  subcategory: string | null;
  severity: string | null;
  countryCode: string | null;
  markerReady: boolean | null;
  hasCoordinates: boolean | null;
  geometryType: string | null;
  publishedAfter: string | null;
  publishedBefore: string | null;
  search: string | null;
  limit: number;
  offset: number;
  order: string;
}) {
  const { rows, total } = await queryItems(params);
  return { data: rows.map(rowToNewsItem), total };
}

export async function getMarkers(params: {
  sourceId: string | null;
  category: string | null;
  subcategory: string | null;
  severity: string | null;
  countryCode: string | null;
  publishedAfter: string | null;
  publishedBefore: string | null;
  limit: number;
}) {
  const rows = await queryMarkers(params);
  return rows.map(rowToNewsMarker);
}

export async function getSources() {
  const rows = await querySources();
  return rows.map((row) => ({
    source_id: row.source_id,
    layer_id: row.layer_id,
    source_family: row.source_family,
    display_name: row.display_name,
    endpoint_url: row.endpoint_url,
    auth_type: row.auth_type,
    attribution: row.attribution,
    license: row.license,
    enabled: row.enabled,
    last_fetched_at: toIsoStringOrNull(row.last_fetched_at),
    last_error: row.last_error,
    update_frequency_minutes: row.update_frequency_minutes,
  }));
}

export async function getFetchRuns(params: {
  sourceId: string | null;
  status: string | null;
  limit: number;
  offset: number;
}) {
  const rows = await queryFetchRuns(params);
  return rows.map((row) => ({
    fetch_run_id: row.fetch_run_id,
    layer_id: row.layer_id,
    source_id: row.source_id,
    source_family: row.source_family,
    run_type: row.run_type,
    status: row.status,
    started_at: toIsoString(row.started_at),
    completed_at: toIsoStringOrNull(row.completed_at),
    fetched_item_count: row.fetched_item_count,
    normalized_item_count: row.normalized_item_count,
    marker_ready_count: row.marker_ready_count,
    skipped_item_count: row.skipped_item_count,
    error_message: row.error_message,
    created_at: toIsoString(row.created_at),
  }));
}

export async function getStats(layerId: string) {
  const { totalRows, markerRows, geomRows, sourceRows, categoryRows, subcategoryRows, severityRows, geometryTypeRows, latestRunRows, fakeCoordRows } = await queryStats();
  return {
    layer_id: layerId,
    total_items: totalRows.length > 0 ? Number(totalRows[0].count) : 0,
    marker_ready_items: markerRows.length > 0 ? Number(markerRows[0].count) : 0,
    items_with_geom: geomRows.length > 0 ? Number(geomRows[0].count) : 0,
    by_source: sourceRows.map(r => ({ source_id: r.source_id, count: Number(r.count) })),
    by_category: categoryRows.map(r => ({ category: r.category, count: Number(r.count) })),
    by_subcategory: subcategoryRows.map(r => ({ subcategory: r.subcategory, count: Number(r.count) })),
    by_severity: severityRows.map(r => ({ severity: r.severity, count: Number(r.count) })),
    by_geometry_type: geometryTypeRows.map(r => ({ geometry_type: r.geometry_type, count: Number(r.count) })),
    latest_fetch_run: latestRunRows.length > 0 ? latestRunRows[0].fetch_run_id : null,
    fake_coordinate_risk_count: fakeCoordRows.length > 0 ? Number(fakeCoordRows[0].count) : 0,
  };
}
