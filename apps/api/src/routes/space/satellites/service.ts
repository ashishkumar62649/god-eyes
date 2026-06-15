import { checkDatabaseStatus } from '../../../lib/db.js';
import { listSatellites, getSatelliteById, getCategories } from './repository.js';
import { rowToItem, rowToDetail } from './mapper.js';

export { checkDatabaseStatus };

export async function getSatelliteList(params: {
  category?: string[]; objectType?: string[]; orbitClass?: string[]; sourceId?: string[];
  importantOnly?: boolean; minAltitude?: number; maxAltitude?: number; limit: number;
}) {
  const rows = await listSatellites(params);
  return rows.map(rowToItem);
}

export async function getSatelliteDetail(satelliteId: string) {
  const row = await getSatelliteById(satelliteId);
  return row ? rowToDetail(row) : null;
}

export async function getSatelliteCategories() {
  const { categories, objectTypes, orbitClasses, totals } = await getCategories();
  return {
    categories: categories.map((c) => ({ category: c.category, count: c.count })),
    objectTypes: objectTypes.map((o) => ({ objectType: o.objectType, count: o.count })),
    orbitClasses: orbitClasses.map((o) => ({ orbitClass: o.orbitClass, count: o.count })),
    totalCount: totals.length > 0 ? totals[0].total_count : 0,
    importantCount: totals.length > 0 ? totals[0].important_count : 0,
  };
}
