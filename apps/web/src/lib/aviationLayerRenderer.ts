import {
  CustomDataSource,
  Cartesian3,
  Color,
} from 'cesium';
import { AirportObject, AirportClusterObject } from '@god-eyes/contracts';
import {
  getAirportSprite,
} from './airportMarkerSprites';
import {
  getAviationDisplayCategory,
  AviationFilters,
  isSmartLODMode,
  getZoomTierFromHeight,
} from './aviationCategories';

const AIRPORT_VISUAL_HEIGHT_METERS = 100;

function displayCatToFilterKey(cat: string): keyof AviationFilters | null {
  switch (cat) {
    case 'major': return 'major';
    case 'regional': return 'regional';
    case 'local': return 'local';
    case 'heliport': return 'heliport';
    case 'seaplane': return 'seaplane';
    case 'balloonport': return 'balloonport';
    case 'unknown': return 'unknown';
    case 'closed': return 'closed';
    default: return null;
  }
}

export function renderAviationObjects(
  dataSource: CustomDataSource,
  items: (AirportObject | AirportClusterObject)[],
  mode: 'points' | 'clusters',
  filters: AviationFilters | null,
  cameraHeight?: number,
): { visibleCount: number; clustersActive: boolean } {
  dataSource.entities.suspendEvents();
  dataSource.entities.removeAll();

  let visibleCount = 0;
  const clustersActive = mode === 'clusters';
  const smartMode = filters ? isSmartLODMode(filters) : false;
  const tier = filters && cameraHeight ? getZoomTierFromHeight(cameraHeight, -1) : 3;

  for (const item of items) {
    if (item.objectType === 'airport') {
      const airport = item as AirportObject;
      if (airport.position.latitude === null || airport.position.longitude === null) continue;

      const displayCat = getAviationDisplayCategory(airport);

      let show = false;
      if (smartMode) {
        if (displayCat === 'closed') {
          show = filters ? filters.closed && tier >= 3 : false;
        } else if (tier === 0) {
          show = displayCat === 'major';
        } else if (tier === 1) {
          show = displayCat === 'major' || displayCat === 'regional';
        } else {
          show = true;
        }
      } else if (filters) {
        const key = displayCatToFilterKey(displayCat);
        show = key ? filters[key] : false;
      } else {
        show = true;
      }

      if (!show) continue;

      const icon = getAirportSprite(displayCat);

      dataSource.entities.add({
        id: `airport-${airport.id}`,
        position: Cartesian3.fromDegrees(
          airport.position.longitude,
          airport.position.latitude,
          AIRPORT_VISUAL_HEIGHT_METERS,
        ),
        billboard: {
          image: icon,
          disableDepthTestDistance: Infinity,
          color: displayCat === 'closed' ? Color.fromCssColorString('rgba(107,114,128,0.55)') : undefined,
        },
        properties: {
          rawData: airport,
          isCluster: false,
          displayCategory: displayCat,
        },
      });
      visibleCount++;
    }
  }

  dataSource.entities.resumeEvents();
  return { visibleCount, clustersActive };
}
