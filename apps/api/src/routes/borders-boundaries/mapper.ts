// Converts database rows to GeoJSON FeatureCollection for the borders-boundaries route.
import type { BorderBoundaryRow } from './types.js';

const LAYER_ID = 'layer_02_borders_boundaries';
const CAVEAT = 'Natural Earth Admin-0 Countries 1:50m is MVP/local/dev only; not production-approved; not Survey of India / Government of India compliant.';

export function rowsToFeatureCollection(rows: BorderBoundaryRow[], params: {
  limit: number;
  sourceId: string;
  sourceName: string | null;
}) {
  const { limit, sourceId, sourceName } = params;

  const features = rows.map((row) => ({
    type: 'Feature' as const,
    id: row.id,
    geometry: row.geometry,
    properties: {
      id: row.id,
      layerId: row.layerId,
      sourceId: row.sourceId,
      sourceObjectId: row.sourceObjectId,
      boundaryType: row.boundaryType,
      boundaryLevel: row.boundaryLevel,
      adminLevel: row.adminLevel,
      countryIso2: row.countryIso2,
      countryIso3: row.countryIso3,
      name: row.name,
      displayName: row.displayName,
      disputed: row.disputed,
      indiaSensitive: row.indiaSensitive,
      indiaComplianceStatus: row.indiaComplianceStatus,
    },
  }));

  return {
    type: 'FeatureCollection' as const,
    features,
    meta: {
      count: features.length,
      limit,
      sourceId,
      sourceName,
      mvpLocalDevOnly: true,
      productionApproved: false,
      indiaCompliant: false,
      caveat: CAVEAT,
    },
  };
}
