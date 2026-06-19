import { checkDatabaseStatus } from '../../lib/db.js';
import { queryLatest } from './repository.js';
import { rowToEvent } from './mapper.js';
import type { EarthEventRow } from './types.js';
import type { BBox } from './validation.js';

export { checkDatabaseStatus };

export async function getLatest(params: {
  eventType: string | null;
  bbox: BBox | null;
  since: string | null;
  limit: number;
}) {
  const rows: EarthEventRow[] = await queryLatest(params);
  return rows.map(rowToEvent);
}