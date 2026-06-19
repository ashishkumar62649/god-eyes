// Business logic orchestration for the aviation aircraft route.
import { checkDatabaseStatus } from '../../../lib/db.js';
import { listLatestAircraft, getAircraftBySourceObjectId } from './repository.js';
import { rowToLatest, rowToDetail } from './mapper.js';
import type { BBox } from './types.js';

export { checkDatabaseStatus };

export async function getLatestAircraft(params: {
  bbox: BBox | null;
  limit: number;
  includeStale: boolean;
}) {
  const rows = await listLatestAircraft(params);
  return rows.map(rowToLatest);
}

export async function getAircraftDetail(sourceObjectId: string) {
  const row = await getAircraftBySourceObjectId(sourceObjectId);
  return row ? rowToDetail(row) : null;
}