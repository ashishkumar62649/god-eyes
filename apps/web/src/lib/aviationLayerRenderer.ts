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
  AviationDisplayCategory,
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

const ENTITY_RENDER_BATCH_SIZE = 120;

function addEntity(
  dataSource: CustomDataSource,
  airport: AirportObject,
  displayCat: AviationDisplayCategory,
): void {
  const icon = getAirportSprite(displayCat);
  dataSource.entities.add({
    id: `airport-${airport.id}`,
    position: Cartesian3.fromDegrees(
      airport.position.longitude!,
      airport.position.latitude!,
      AIRPORT_VISUAL_HEIGHT_METERS,
    ),
    billboard: {
      image: icon,
      color: displayCat === 'closed' ? Color.fromCssColorString('rgba(107,114,128,0.55)') : undefined,
    },
    properties: {
      rawData: airport,
      isCluster: false,
      displayCategory: displayCat,
    },
  });
}

function shouldShowAirport(
  airport: AirportObject,
  smartMode: boolean,
  tier: number,
  filters: AviationFilters | null,
): AviationDisplayCategory | false {
  if (airport.position.latitude === null || airport.position.longitude === null) return false;
  const displayCat = getAviationDisplayCategory(airport);

  if (smartMode) {
    if (displayCat === 'closed') {
      return filters?.closed && tier >= 3 ? displayCat : false;
    }
    if (tier === 0) return displayCat === 'major' ? displayCat : false;
    if (tier === 1) return (displayCat === 'major' || displayCat === 'regional') ? displayCat : false;
    return displayCat;
  }

  if (filters) {
    const key = displayCatToFilterKey(displayCat);
    return key && filters[key] ? displayCat : false;
  }

  return displayCat;
}

/** Synchronous render (small datasets, no freeze risk). */
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
  const tier = filters && cameraHeight != null ? getZoomTierFromHeight(cameraHeight, -1) : 3;

  for (const item of items) {
    if (item.objectType !== 'airport') continue;
    const airport = item as AirportObject;
    if (airport.position.latitude === null || airport.position.longitude === null) continue;
    const cat = shouldShowAirport(airport, smartMode, tier, filters);
    if (!cat) continue;
    addEntity(dataSource, airport, cat);
    visibleCount++;
  }

  dataSource.entities.resumeEvents();
  return { visibleCount, clustersActive };
}

/** Async batched render (large datasets). Yields to event loop every BATCH_SIZE items. */
export async function renderAviationObjectsAsync(
  dataSource: CustomDataSource,
  items: (AirportObject | AirportClusterObject)[],
  mode: 'points' | 'clusters',
  filters: AviationFilters | null,
  cameraHeight?: number,
  onBatch?: (visibleSoFar: number, totalProcessed: number) => void,
  abortSignal?: AbortSignal,
): Promise<{ visibleCount: number; clustersActive: boolean }> {
  dataSource.entities.suspendEvents();
  dataSource.entities.removeAll();

  let visibleCount = 0;
  const clustersActive = mode === 'clusters';
  const smartMode = filters ? isSmartLODMode(filters) : false;
  const tier = filters && cameraHeight != null ? getZoomTierFromHeight(cameraHeight, -1) : 3;
  const total = items.length;

  for (let i = 0; i < total; i++) {
    if (abortSignal?.aborted) {
      dataSource.entities.resumeEvents();
      return { visibleCount, clustersActive };
    }

    const item = items[i];
    if (item.objectType !== 'airport') continue;
    const airport = item as AirportObject;
    if (airport.position.latitude === null || airport.position.longitude === null) continue;
    const cat = shouldShowAirport(airport, smartMode, tier, filters);
    if (!cat) continue;
    addEntity(dataSource, airport, cat);
    visibleCount++;

    if ((i + 1) % ENTITY_RENDER_BATCH_SIZE === 0 && i + 1 < total) {
      dataSource.entities.resumeEvents();
      onBatch?.(visibleCount, i + 1);
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      dataSource.entities.suspendEvents();
    }
  }

  dataSource.entities.resumeEvents();
  return { visibleCount, clustersActive };
}
