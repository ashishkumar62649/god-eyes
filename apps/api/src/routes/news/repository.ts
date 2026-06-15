// Database access for the news route. All SQL queries live here.
import { query } from '../../lib/db.js';
import type { NewsItemRow, NewsMarkerRow, NewsSourceRow, NewsFetchRunRow } from './types.js';

const LAYER_ID = 'layer_08_news_osint';

const NEWS_ITEM_SELECT_COLUMNS = `
  i.item_id, i.layer_id, i.source_id, i.source_family, i.source_object_id,
  i.source_url, i.title, i.summary, i.content_type, i.published_at,
  i.source_updated_at, i.fetched_at, i.first_seen_at, i.last_seen_at,
  i.location_confidence, i.country_code, i.country_name, i.region, i.city,
  i.latitude, i.longitude, i.geometry_type, i.geo_source, i.has_coordinates,
  i.marker_ready, i.category, i.subcategory, i.severity, i.source_domain,
  i.source_language, i.source_country, i.confidence_score, i.attribution, i.is_active
`;

export async function queryItems(params: {
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
}): Promise<{ rows: NewsItemRow[]; total: number }> {
  const { sourceId, category, subcategory, severity, countryCode, markerReady, hasCoordinates, geometryType, publishedAfter, publishedBefore, search, limit, offset, order } = params;
  const conditions: string[] = [`i.layer_id = $1`];
  const sqlParams: unknown[] = [LAYER_ID];
  let p = 2;

  if (sourceId !== null) { conditions.push(`i.source_id = $${p}`); sqlParams.push(sourceId); p++; }
  if (category !== null) { conditions.push(`i.category = $${p}`); sqlParams.push(category); p++; }
  if (subcategory !== null) { conditions.push(`i.subcategory = $${p}`); sqlParams.push(subcategory); p++; }
  if (severity !== null) { conditions.push(`i.severity = $${p}`); sqlParams.push(severity); p++; }
  if (countryCode !== null) { conditions.push(`i.country_code = $${p}`); sqlParams.push(countryCode); p++; }
  if (markerReady !== null) { conditions.push(`i.marker_ready = $${p}`); sqlParams.push(markerReady); p++; }
  if (hasCoordinates !== null) { conditions.push(`i.has_coordinates = $${p}`); sqlParams.push(hasCoordinates); p++; }
  if (geometryType !== null) { conditions.push(`i.geometry_type = $${p}`); sqlParams.push(geometryType); p++; }
  if (publishedAfter !== null) { conditions.push(`i.published_at >= $${p}`); sqlParams.push(publishedAfter); p++; }
  if (publishedBefore !== null) { conditions.push(`i.published_at <= $${p}`); sqlParams.push(publishedBefore); p++; }
  if (search !== null) { conditions.push(`(i.title ILIKE $${p} OR i.summary ILIKE $${p})`); sqlParams.push(`%${search}%`); p++; }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const orderDir = order === 'asc' ? 'ASC' : 'DESC';

  const [rows, countResult] = await Promise.all([
    query<NewsItemRow>(
      `SELECT ${NEWS_ITEM_SELECT_COLUMNS} FROM news_items_latest i ${whereClause}
       ORDER BY i.published_at ${orderDir} NULLS LAST, i.fetched_at ${orderDir} NULLS LAST
       LIMIT $${p} OFFSET $${p + 1}`,
      [...sqlParams, limit, offset],
    ),
    query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM news_items_latest i ${whereClause}`,
      sqlParams,
    ),
  ]);

  return { rows, total: countResult.length > 0 ? Number(countResult[0].total) : 0 };
}

export async function queryMarkers(params: {
  sourceId: string | null;
  category: string | null;
  subcategory: string | null;
  severity: string | null;
  countryCode: string | null;
  publishedAfter: string | null;
  publishedBefore: string | null;
  limit: number;
}): Promise<NewsMarkerRow[]> {
  const { sourceId, category, subcategory, severity, countryCode, publishedAfter, publishedBefore, limit } = params;
  const conditions: string[] = [`i.layer_id = $1`, `i.marker_ready = TRUE`, `i.geom IS NOT NULL`];
  const sqlParams: unknown[] = [LAYER_ID];
  let p = 2;

  if (sourceId !== null) { conditions.push(`i.source_id = $${p}`); sqlParams.push(sourceId); p++; }
  if (category !== null) { conditions.push(`i.category = $${p}`); sqlParams.push(category); p++; }
  if (subcategory !== null) { conditions.push(`i.subcategory = $${p}`); sqlParams.push(subcategory); p++; }
  if (severity !== null) { conditions.push(`i.severity = $${p}`); sqlParams.push(severity); p++; }
  if (countryCode !== null) { conditions.push(`i.country_code = $${p}`); sqlParams.push(countryCode); p++; }
  if (publishedAfter !== null) { conditions.push(`i.published_at >= $${p}`); sqlParams.push(publishedAfter); p++; }
  if (publishedBefore !== null) { conditions.push(`i.published_at <= $${p}`); sqlParams.push(publishedBefore); p++; }

  return query<NewsMarkerRow>(
    `SELECT i.item_id, i.title, i.source_id, i.source_url, i.latitude, i.longitude,
            i.country_code, i.country_name, i.category, i.subcategory, i.severity,
            i.published_at, i.source_updated_at, i.marker_ready, i.attribution
     FROM news_items_latest i
     WHERE ${conditions.join(' AND ')}
     ORDER BY i.published_at DESC NULLS LAST, i.fetched_at DESC NULLS LAST
     LIMIT $${p}`,
    [...sqlParams, limit],
  );
}

export async function querySources(): Promise<NewsSourceRow[]> {
  return query<NewsSourceRow>(
    `SELECT source_id, layer_id, source_family, display_name, endpoint_url, auth_type,
            attribution, license, enabled, last_fetched_at, last_error, update_frequency_minutes
     FROM news_sources
     WHERE layer_id = $1
     ORDER BY display_name`,
    [LAYER_ID],
  );
}

export async function queryFetchRuns(params: {
  sourceId: string | null;
  status: string | null;
  limit: number;
  offset: number;
}): Promise<NewsFetchRunRow[]> {
  const { sourceId, status, limit, offset } = params;
  const conditions: string[] = [`f.layer_id = $1`];
  const sqlParams: unknown[] = [LAYER_ID];
  let p = 2;

  if (sourceId !== null) { conditions.push(`f.source_id = $${p}`); sqlParams.push(sourceId); p++; }
  if (status !== null) { conditions.push(`f.status = $${p}`); sqlParams.push(status); p++; }

  return query<NewsFetchRunRow>(
    `SELECT f.fetch_run_id, f.layer_id, f.source_id, f.source_family, f.run_type, f.status,
            f.started_at, f.completed_at, f.fetched_item_count, f.normalized_item_count,
            f.marker_ready_count, f.skipped_item_count, f.error_message, f.created_at
     FROM news_fetch_runs f
     WHERE ${conditions.join(' AND ')}
     ORDER BY f.started_at DESC
     LIMIT $${p} OFFSET $${p + 1}`,
    [...sqlParams, limit, offset],
  );
}

export async function queryStats() {
  const LAYER = LAYER_ID;
  const [totalRows, markerRows, geomRows, sourceRows, categoryRows, subcategoryRows, severityRows, geometryTypeRows, latestRunRows, fakeCoordRows] = await Promise.all([
    query<{ count: number }>(`SELECT COUNT(*) AS count FROM news_items_latest WHERE layer_id = $1`, [LAYER]),
    query<{ count: number }>(`SELECT COUNT(*) AS count FROM news_items_latest WHERE layer_id = $1 AND marker_ready = TRUE`, [LAYER]),
    query<{ count: number }>(`SELECT COUNT(*) AS count FROM news_items_latest WHERE layer_id = $1 AND geom IS NOT NULL`, [LAYER]),
    query<{ source_id: string; count: number }>(`SELECT source_id, COUNT(*) AS count FROM news_items_latest WHERE layer_id = $1 GROUP BY source_id ORDER BY source_id`, [LAYER]),
    query<{ category: string; count: number }>(`SELECT category, COUNT(*) AS count FROM news_items_latest WHERE layer_id = $1 GROUP BY category ORDER BY category`, [LAYER]),
    query<{ subcategory: string; count: number }>(`SELECT subcategory, COUNT(*) AS count FROM news_items_latest WHERE layer_id = $1 AND subcategory IS NOT NULL GROUP BY subcategory ORDER BY subcategory`, [LAYER]),
    query<{ severity: string; count: number }>(`SELECT severity, COUNT(*) AS count FROM news_items_latest WHERE layer_id = $1 GROUP BY severity ORDER BY severity`, [LAYER]),
    query<{ geometry_type: string; count: number }>(`SELECT COALESCE(geometry_type, 'none') AS geometry_type, COUNT(*) AS count FROM news_items_latest WHERE layer_id = $1 GROUP BY geometry_type ORDER BY geometry_type`, [LAYER]),
    query<{ fetch_run_id: string }>(`SELECT fetch_run_id FROM news_fetch_runs WHERE layer_id = $1 ORDER BY started_at DESC LIMIT 1`, [LAYER]),
    query<{ count: number }>(`SELECT COUNT(*) AS count FROM news_items_latest WHERE layer_id = $1 AND geometry_type IN ('LineString', 'Polygon') AND (latitude IS NOT NULL OR longitude IS NOT NULL OR geom IS NOT NULL OR marker_ready = TRUE)`, [LAYER]),
  ]);

  return { totalRows, markerRows, geomRows, sourceRows, categoryRows, subcategoryRows, severityRows, geometryTypeRows, latestRunRows, fakeCoordRows };
}
