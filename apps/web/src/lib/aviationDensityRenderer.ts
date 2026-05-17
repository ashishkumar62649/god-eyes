/**
 * @deprecated LOD visibility redesign (WO-029D-FE) replaced fabric/density dots with
 * category-based zoom-tier entity rendering. This file is preserved for reference only.
 * Active rendering happens in aviationLayerRenderer.ts, with LOD filtering in CesiumGlobe.tsx.
 * No active code imports from this module.
 */

import { PointPrimitiveCollection, Cartesian3, Color, NearFarScalar } from 'cesium';
import { AirportObject } from '@god-eyes/contracts';
import { AviationFilters, getAviationDisplayCategory, AVIATION_CATEGORIES } from './aviationCategories';

export interface DensityRenderResult {
  count: number;
  pointMap: Map<string, AirportObject>;
}

export interface FabricNode {
  id: string;
  centroidLon: number;
  centroidLat: number;
  weight: number;
  count: number;
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

const FABRIC_CELL_SIZE_DEG = 3;

export function computeFabricNodes(
  items: any[],
  filters?: AviationFilters | null,
  cellSizeDeg?: number
): FabricNode[] {
  const cellSize = cellSizeDeg || FABRIC_CELL_SIZE_DEG;
  const grid = new Map<string, {
    airports: AirportObject[];
    minLon: number; maxLon: number;
    minLat: number; maxLat: number;
  }>();

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

    const cellX = Math.floor(airport.position.longitude / cellSize);
    const cellY = Math.floor(airport.position.latitude / cellSize);
    const cellKey = `${cellX},${cellY}`;

    if (!grid.has(cellKey)) {
      grid.set(cellKey, {
        airports: [],
        minLon: Infinity, maxLon: -Infinity,
        minLat: Infinity, maxLat: -Infinity,
      });
    }
    const cell = grid.get(cellKey)!;
    cell.airports.push(airport);
    cell.minLon = Math.min(cell.minLon, airport.position.longitude);
    cell.maxLon = Math.max(cell.maxLon, airport.position.longitude);
    cell.minLat = Math.min(cell.minLat, airport.position.latitude);
    cell.maxLat = Math.max(cell.maxLat, airport.position.latitude);
  }

  const nodes: FabricNode[] = [];
  for (const [key, cell] of grid) {
    const count = cell.airports.length;
    if (count === 0) continue;

    let sumLon = 0, sumLat = 0;
    for (const ap of cell.airports) {
      if (ap.position.longitude == null || ap.position.latitude == null) continue;
      sumLon += ap.position.longitude;
      sumLat += ap.position.latitude;
    }

    nodes.push({
      id: `fabric-${key}`,
      centroidLon: sumLon / count,
      centroidLat: sumLat / count,
      weight: count,
      count,
      minLon: cell.minLon,
      maxLon: cell.maxLon,
      minLat: cell.minLat,
      maxLat: cell.maxLat,
    });
  }

  return nodes;
}

export function renderFabricNodes(
  collection: PointPrimitiveCollection,
  nodes: FabricNode[]
): void {
  collection.removeAll();
  for (const node of nodes) {
    const baseSize = 4 + Math.min(Math.sqrt(node.weight) * 0.6, 3);
    const alpha = Math.min(0.55 + node.weight * 0.015, 1.0);
    const color = Color.fromCssColorString('#00EFFF').withAlpha(alpha);

    const position = Cartesian3.fromDegrees(node.centroidLon, node.centroidLat, 5000);

    collection.add({
      position,
      color,
      pixelSize: baseSize,
      outlineColor: Color.fromCssColorString('rgba(0,238,255,0.35)'),
      outlineWidth: 0.5,
      translucencyByDistance: new NearFarScalar(6000000, 0.0, 10000000, 1.0),
      id: node.id,
    });
  }
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
    const position = Cartesian3.fromDegrees(airport.position.longitude, airport.position.latitude, 100);

    collection.add({
      position,
      color: Color.fromCssColorString(catInfo.markerColor),
      pixelSize: 4,
      outlineColor: Color.fromCssColorString('rgba(0,0,0,0.4)'),
      outlineWidth: 0.5,
      scaleByDistance: new NearFarScalar(1000000, 1.0, 10000000, 0.55),
      translucencyByDistance: new NearFarScalar(6000000, 1.0, 10000000, 0.0),
      id: pointId,
    });

    pointMap.set(pointId, airport);
    count++;
  }

  return { count, pointMap };
}
