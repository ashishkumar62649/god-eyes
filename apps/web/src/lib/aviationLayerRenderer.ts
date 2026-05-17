import {
  CustomDataSource,
  Cartesian3,
  Cartesian2,
  VerticalOrigin,
  HorizontalOrigin,
  LabelStyle,
  Color,
} from 'cesium';
import { AirportObject, AirportClusterObject } from '@god-eyes/contracts';
import {
  CategoryIcons,
  getAirportSprite,
  getClusterCanvas,
} from './airportMarkerSprites';
import {
  getAviationDisplayCategory,
  AviationFilters,
} from './aviationCategories';

const AIRPORT_VISUAL_HEIGHT_METERS = 100;
const CLUSTER_VISUAL_HEIGHT_METERS = 5000;

export function renderAviationObjects(
  dataSource: CustomDataSource,
  items: (AirportObject | AirportClusterObject)[],
  mode: 'points' | 'clusters',
  filters?: AviationFilters | null
): { visibleCount: number; clustersActive: boolean } {
  dataSource.entities.suspendEvents();

  dataSource.entities.removeAll();

  let visibleCount = 0;
  const clustersActive = mode === 'clusters';

  for (const item of items) {
    if (item.objectType === 'airport') {
      const airport = item as AirportObject;
      if (airport.position.latitude === null || airport.position.longitude === null) continue;

      const displayCat = getAviationDisplayCategory(airport);

      if (filters) {
        if (displayCat === 'closed' && !filters.closed) continue;
        if (displayCat === 'heliport' && !filters.heliports) continue;
        if (displayCat === 'seaplane_base' && !filters.seaplaneBases) continue;
        if (displayCat === 'airport' && !filters.airports) continue;
      }

      // Use size-specific sprite for airports, category sprite for others
      const icon = displayCat === 'airport'
        ? getAirportSprite(airport.category)
        : CategoryIcons[displayCat];

      dataSource.entities.add({
        id: `airport-${airport.id}`,
        position: Cartesian3.fromDegrees(
          airport.position.longitude,
          airport.position.latitude,
          AIRPORT_VISUAL_HEIGHT_METERS
        ),
        billboard: {
          image: icon,
          verticalOrigin: VerticalOrigin.CENTER,
          horizontalOrigin: HorizontalOrigin.CENTER,
        },
        label: {
          text: airport.ident,
          font: '10px JetBrains Mono, monospace',
          style: LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          outlineColor: Color.BLACK,
          verticalOrigin: VerticalOrigin.BOTTOM,
          pixelOffset: new Cartesian2(0, -10),
        },
        properties: {
          rawData: airport,
          isCluster: false,
          displayCategory: displayCat,
        },
      });
      visibleCount++;
    } else if (item.objectType === 'airport_cluster') {
      const cluster = item as AirportClusterObject;
      const count = cluster.count;
      visibleCount += count;

      const baseSize = 24;
      const growthFactor = Math.min(count * 0.4, 12);
      const finalSize = baseSize + growthFactor;
      const clusterIcon = getClusterCanvas(finalSize);

      dataSource.entities.add({
        id: `cluster-${cluster.id}`,
        position: Cartesian3.fromDegrees(
          cluster.position.longitude,
          cluster.position.latitude,
          CLUSTER_VISUAL_HEIGHT_METERS
        ),
        billboard: {
          image: clusterIcon as any,
          verticalOrigin: VerticalOrigin.CENTER,
          horizontalOrigin: HorizontalOrigin.CENTER,
        },
        label: {
          text: count.toString(),
          font: '600 12px Inter, sans-serif',
          fillColor: Color.fromCssColorString('#00d2ff'),
          style: LabelStyle.FILL,
          verticalOrigin: VerticalOrigin.CENTER,
          horizontalOrigin: HorizontalOrigin.CENTER,
          pixelOffset: new Cartesian2(0, 0),
        },
        properties: {
          isCluster: true,
          clusterData: cluster,
        },
      });
    }
  }

  dataSource.entities.resumeEvents();

  return { visibleCount, clustersActive };
}
