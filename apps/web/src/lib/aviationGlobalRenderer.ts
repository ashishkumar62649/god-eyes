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
        id: { type: 'global_dot', airportId: item.id, lon: item.position.longitude, lat: item.position.latitude, displayCat },
        show: true,
      });
    } else {
      if (filters && !filters[displayCat]) continue;
      collection.add({
        position: Cartesian3.fromDegrees(item.position.longitude, item.position.latitude, DOT_HEIGHT_METERS),
        color: Color.fromCssColorString(catColor).withAlpha(DOT_ALPHA_ACTIVE),
        pixelSize: DOT_SIZE,
        id: { type: 'global_dot', airportId: item.id, lon: item.position.longitude, lat: item.position.latitude, displayCat },
        show: true,
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

/**
 * Add all items to the collection regardless of current filter state.
 * Each dot stores its displayCat in the id object for later filter application.
 */
export function addAllDotsToCollection(
  collection: PointPrimitiveCollection,
  items: AirportObject[],
): number {
  let count = 0;
  for (const item of items) {
    if (item.position.latitude === null || item.position.longitude === null) continue;
    const displayCat = getAviationDisplayCategory(item);
    const catColor = getCategoryDotColor(displayCat);
    const alpha = displayCat === 'closed' ? DOT_ALPHA_CLOSED : DOT_ALPHA_ACTIVE;
    const size = displayCat === 'closed' ? CLOSED_DOT_SIZE : DOT_SIZE;
    collection.add({
      position: Cartesian3.fromDegrees(item.position.longitude, item.position.latitude, DOT_HEIGHT_METERS),
      color: Color.fromCssColorString(catColor).withAlpha(alpha),
      pixelSize: size,
      id: { type: 'global_dot', airportId: item.id, lon: item.position.longitude, lat: item.position.latitude, displayCat },
      show: true,
    });
    count++;
  }
  return count;
}

/**
 * Update the `show` property on every PointPrimitive in the collection
 * based on category filter AND behind-globe occlusion in a single pass.
 * This prevents conflicts between filter-based hiding and camera-based hiding.
 */
export function filterVisibleGlobalDots(
  collection: PointPrimitiveCollection,
  scene: Scene,
  filters?: AviationFilters | null,
): void {
  const cameraPos = scene.camera.positionWC;
  const cameraDist = Cartesian3.magnitude(cameraPos);
  if (cameraDist < 100) return;
  const cameraDir = Cartesian3.normalize(cameraPos, new Cartesian3());
  const R = scene.globe.ellipsoid.maximumRadius;
  const horizonDot = R / cameraDist;
  const threshold = horizonDot - 0.05;

  const length = collection.length;
  for (let i = 0; i < length; i++) {
    const p = collection.get(i);
    if (!p || !p.id) continue;

    // Category filter check
    const displayCat: string = p.id.displayCat;
    let filterPass = true;
    if (filters) {
      if (displayCat === 'closed') {
        filterPass = filters.closed;
      } else if (displayCat in filters) {
        filterPass = filters[displayCat as keyof AviationFilters];
      }
    }
    if (!filterPass) {
      p.show = false;
      continue;
    }

    // Occlusion check (only for dots that pass filter)
    const pos = p.position;
    const pointDir = Cartesian3.normalize(pos, new Cartesian3());
    const dotProd = Cartesian3.dot(cameraDir, pointDir);
    p.show = dotProd > threshold;
  }
}
