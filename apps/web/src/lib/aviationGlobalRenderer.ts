import {
  PointPrimitiveCollection,
  Cartesian3,
  Color,
  Scene,
} from 'cesium';
import type { AirportObject } from '@god-eyes/contracts';
import {
  getAviationDisplayCategory,
  AviationFilters,
} from './aviationCategories';
import { getCategoryDotColor } from './airportMarkerSprites';

const DOT_HEIGHT_METERS = 100;
const DOT_SIZE = 5;
const CLOSED_DOT_SIZE = 4;
const DOT_ALPHA_ACTIVE = 0.92;
const DOT_ALPHA_CLOSED = 0.45;

export function createGlobalDotCollection(scene: Scene): PointPrimitiveCollection {
  const collection = new PointPrimitiveCollection();
  scene.primitives.add(collection);
  return collection;
}

export function destroyGlobalDotCollection(collection: PointPrimitiveCollection, scene: Scene): void {
  collection.removeAll();
  scene.primitives.remove(collection);
}

export function clearGlobalDots(collection: PointPrimitiveCollection): void {
  collection.removeAll();
}

export function addDotsToCollection(
  collection: PointPrimitiveCollection,
  items: AirportObject[],
  filters: AviationFilters | null,
): void {
  for (const item of items) {
    if (item.position.latitude === null || item.position.longitude === null) continue;

    const displayCat = getAviationDisplayCategory(item);
    const catColor = getCategoryDotColor(displayCat);

    if (displayCat === 'closed') {
      if (!filters?.closed) continue;
      collection.add({
        position: Cartesian3.fromDegrees(item.position.longitude, item.position.latitude, DOT_HEIGHT_METERS),
        color: Color.fromCssColorString(catColor).withAlpha(DOT_ALPHA_CLOSED),
        pixelSize: CLOSED_DOT_SIZE,
        disableDepthTestDistance: Infinity,
        id: { type: 'global_dot', airportId: item.id, lon: item.position.longitude, lat: item.position.latitude, displayCat },
      });
    } else {
      if (filters && !filters[displayCat]) continue;
      collection.add({
        position: Cartesian3.fromDegrees(item.position.longitude, item.position.latitude, DOT_HEIGHT_METERS),
        color: Color.fromCssColorString(catColor).withAlpha(DOT_ALPHA_ACTIVE),
        pixelSize: DOT_SIZE,
        disableDepthTestDistance: Infinity,
        id: { type: 'global_dot', airportId: item.id, lon: item.position.longitude, lat: item.position.latitude, displayCat },
      });
    }
  }
}

export function isGlobalDot(picked: any): boolean {
  return picked?.id?.type === 'global_dot';
}

export function getGlobalDotPosition(picked: any): { longitude: number; latitude: number } | null {
  if (!picked?.id) return null;
  return { longitude: picked.id.lon, latitude: picked.id.lat };
}
