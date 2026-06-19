// Business logic orchestration for the borders-boundaries route.
import { checkDatabaseStatus } from '../../lib/db.js';
import { querySourceName, queryBorderBoundaries } from './repository.js';
import { rowsToFeatureCollection } from './mapper.js';
import type { BBox } from './types.js';

export { checkDatabaseStatus };

export async function getCountries(params: {
  sourceId: string;
  bbox: BBox | null;
  simplify: number;
  limit: number;
}) {
  const { sourceId, bbox, simplify, limit } = params;

  let sourceName: string | null = null;
  try {
    const sourceRows = await querySourceName(sourceId);
    if (sourceRows.length > 0) {
      sourceName = sourceRows[0].sourceName;
    }
  } catch {
    // Source lookup failure is non-fatal; sourceName stays null
  }

  const rows = await queryBorderBoundaries({ sourceId, bbox, simplify, limit });

  return rowsToFeatureCollection(rows, { limit, sourceId, sourceName });
}
