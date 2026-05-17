import { PointPrimitiveCollection, Cartesian3, Color, NearFarScalar } from 'cesium';
import { AirportObject } from '@god-eyes/contracts';
import { AviationFilters, getAviationDisplayCategory, AVIATION_CATEGORIES } from './aviationCategories';

export interface DensityRenderResult {
  count: number;
  pointMap: Map<string, AirportObject>;
}

export function renderDensityDots(
  collection: PointPrimitiveCollection,
  items: any[],
  filters?: AviationFilters | null
): DensityRenderResult {
  collection.removeAll();
  const pointMap = new Map<string, AirportObject>();
  let count = 0;

  for (const item of items) {
    if (item.objectType !== 'airport') continue;

    const airport = item as AirportObject;
    if (airport.position.latitude === null || airport.position.longitude === null) continue;

    const displayCat = getAviationDisplayCategory(airport);

    if (filters) {
      if (displayCat === 'closed' && !filters.closed) continue;
      if (displayCat === 'heliport' && !filters.heliports) continue;
      if (displayCat === 'seaplane_base' && !filters.seaplaneBases) continue;
      if (displayCat === 'airport' && !filters.airports) continue;
    }

    const catInfo = AVIATION_CATEGORIES[displayCat];
    const pointId = `density-${airport.id}`;

    const position = Cartesian3.fromDegrees(
      airport.position.longitude,
      airport.position.latitude,
      100
    );

    collection.add({
      position,
      color: Color.fromCssColorString(catInfo.markerColor),
      pixelSize: 4,
      outlineColor: Color.fromCssColorString('rgba(0,0,0,0.3)'),
      outlineWidth: 0.5,
      scaleByDistance: new NearFarScalar(1000000, 1.0, 10000000, 0.3),
      translucencyByDistance: new NearFarScalar(5000000, 1.0, 15000000, 0.1),
      id: pointId,
    });

    pointMap.set(pointId, airport);
    count++;
  }

  return { count, pointMap };
}
