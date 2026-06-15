// Business logic orchestration for the weather route.
import { checkDatabaseStatus } from '../../lib/db.js';
import { queryObservations, queryNearby, querySources, queryFetchRuns } from './repository.js';
import { rowToObservationItem, rowToNearbyItem, toIsoString } from './mapper.js';
import type { BBox, WeatherObservationRow, WeatherNearbyRow, WeatherSourceRow, WeatherFetchRunRow } from './types.js';

export { checkDatabaseStatus };

export async function getObservations(params: {
  bbox: BBox | null;
  observationType: string | null;
  sourceId: string | null;
  forecastFrom: string | null;
  forecastTo: string | null;
  limit: number;
  offset: number;
}) {
  const rows: WeatherObservationRow[] = await queryObservations(params);
  return rows.map(rowToObservationItem);
}

export async function getNearby(params: {
  lat: number;
  lon: number;
  radiusKm: number;
  observationType: string | null;
  sourceId: string | null;
  limit: number;
}) {
  const rows: WeatherNearbyRow[] = await queryNearby(params);
  return rows.map(rowToNearbyItem);
}

export async function getSources() {
  const rows: WeatherSourceRow[] = await querySources();
  return rows.map((row) => ({
    source_id: row.source_id,
    source_name: row.source_name,
    source_url: row.source_url,
    licence: row.licence,
    attribution: row.attribution,
    is_active: row.is_active,
  }));
}

export async function getFetchRuns(params: {
  sourceId: string | null;
  status: string | null;
  limit: number;
  offset: number;
}) {
  const rows: WeatherFetchRunRow[] = await queryFetchRuns(params);
  return rows.map((row) => ({
    fetch_run_id: row.fetch_run_id,
    source_id: row.source_id,
    layer_id: 'layer_07_weather',
    grid_resolution: row.grid_resolution,
    total_cells: row.total_cells,
    successful_cells: row.successful_cells,
    failed_cells: row.failed_cells,
    fetch_started_at: toIsoString(row.fetch_started_at),
    fetch_completed_at: row.fetch_completed_at ? toIsoString(row.fetch_completed_at) : null,
    api_calls_made: row.api_calls_made,
    raw_storage_path: row.raw_storage_path,
    status: row.status,
    error_message: row.error_message,
  }));
}
