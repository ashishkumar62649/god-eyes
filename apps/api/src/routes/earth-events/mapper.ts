import { toIsoString } from '../../lib/typeUtils.js';
import type { EarthEventRow } from './types.js';

export { toIsoString };

export function rowToEvent(row: EarthEventRow) {
  return {
    id: row.id,
    layerId: row.layerId,
    sourceId: row.sourceId,
    sourceObjectId: row.sourceObjectId,
    eventType: row.eventType,
    magnitude: row.magnitude !== null ? Number(row.magnitude) : null,
    magnitudeType: row.magnitudeType,
    depthKm: row.depthKm !== null ? Number(row.depthKm) : null,
    place: row.place,
    alertLevel: row.alertLevel,
    significance: row.significance !== null ? Number(row.significance) : null,
    tsunami: row.tsunami,
    geometry: row.geometry,
    sourceUrl: row.sourceUrl,
    observedAt: toIsoString(row.observedAt),
    updatedAt: toIsoString(row.updatedAt),
    fetchedAt: toIsoString(row.fetchedAt),
  };
}