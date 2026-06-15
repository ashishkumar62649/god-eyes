import { checkDatabaseStatus } from '../../lib/db.js';
import { listVesselObjects, getVesselByMmsi, getStats, getPositionHistory } from './repository.js';
import { rowToVesselObject, rowToVesselDetail, rowToPosition, toInteger, toIsoString } from './mapper.js';
import type { BBox } from './types.js';

export { checkDatabaseStatus };

export async function getVesselList(params: {
  bbox: BBox | null; vesselType: string | null; minSpeed: number | null;
  maxSpeed: number | null; updatedSince: string | null; mmsi: number | null;
  search: string | null; limit: number; offset: number;
}) {
  const rows = await listVesselObjects(params);
  return rows.map(rowToVesselObject);
}

export async function getVesselDetail(mmsi: number) {
  const row = await getVesselByMmsi(mmsi);
  return row ? rowToVesselDetail(row) : null;
}

export async function getMaritimeStats() {
  const { stats, byVesselType } = await getStats();
  const byVesselTypeRecord: Record<string, number> = {};
  for (const row of byVesselType) {
    byVesselTypeRecord[row.vesselType || 'unknown'] = toInteger(row.count);
  }
  let dataFreshnessSeconds: number | null = null;
  if (stats.lastUpdated) {
    const ms = new Date(toIsoString(stats.lastUpdated)).getTime();
    if (!isNaN(ms)) dataFreshnessSeconds = Math.floor((Date.now() - ms) / 1000);
  }
  return {
    totalVessels: toInteger(stats.totalVessels),
    activeVessels: toInteger(stats.activeVessels),
    staleVessels: toInteger(stats.staleVessels),
    byVesselType: byVesselTypeRecord,
    lastUpdated: stats.lastUpdated ? toIsoString(stats.lastUpdated) : null,
    dataFreshnessSeconds,
  };
}

export async function getVesselPositionHistory(params: { mmsi: number; hours: number; limit: number }) {
  const { positions, vesselName } = await getPositionHistory(params);
  return { positions: positions.map(rowToPosition), vesselName };
}
