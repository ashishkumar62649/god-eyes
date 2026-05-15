import { 
  CustomDataSource, 
  Cartesian3, 
  Cartesian2, 
  VerticalOrigin, 
  HorizontalOrigin, 
  LabelStyle, 
  Color 
} from 'cesium';
import { AirportObject, AirportClusterObject } from '@god-eyes/contracts';
import { Icons, getClusterCanvas } from './airportMarkerSprites';

export function renderAviationObjects(
  dataSource: CustomDataSource,
  items: (AirportObject | AirportClusterObject)[],
  mode: 'points' | 'clusters'
): { visibleCount: number, clustersActive: boolean } {
  dataSource.entities.suspendEvents();
  
  // Remove existing entities
  dataSource.entities.removeAll();

  let visibleCount = 0;
  const clustersActive = mode === 'clusters';

  for (const item of items) {
    if (item.objectType === 'airport') {
      const airport = item as AirportObject;
      if (airport.position.latitude === null || airport.position.longitude === null) continue;
      
      dataSource.entities.add({
        id: `airport-${airport.id}`,
        position: Cartesian3.fromDegrees(airport.position.longitude, airport.position.latitude, 0),
        billboard: {
          image: airport.category === 'large_airport' ? Icons.largeAirport : Icons.smallAirport,
          verticalOrigin: VerticalOrigin.CENTER,
          horizontalOrigin: HorizontalOrigin.CENTER,
          disableDepthTestDistance: Number.POSITIVE_INFINITY, 
        },
        label: {
          text: airport.ident,
          font: '10px JetBrains Mono, monospace',
          style: LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          outlineColor: Color.BLACK,
          verticalOrigin: VerticalOrigin.BOTTOM,
          pixelOffset: new Cartesian2(0, -10),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        properties: {
          rawData: airport,
          isCluster: false
        }
      });
      visibleCount++;
    } else if (item.objectType === 'airport_cluster') {
      const cluster = item as AirportClusterObject;
      const count = cluster.count;
      visibleCount += count;
      
      const baseSize = 24;
      const growthFactor = Math.min(count * 0.8, 16);
      const finalSize = baseSize + growthFactor;
      const clusterIcon = getClusterCanvas(finalSize);

      dataSource.entities.add({
        id: `cluster-${cluster.id}`,
        position: Cartesian3.fromDegrees(cluster.position.longitude, cluster.position.latitude, 0),
        billboard: {
          image: clusterIcon as any,
          verticalOrigin: VerticalOrigin.CENTER,
          horizontalOrigin: HorizontalOrigin.CENTER,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: count.toString(),
          font: count > 10 ? 'bold 14px JetBrains Mono, monospace' : 'bold 12px JetBrains Mono, monospace',
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 4,
          style: LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: VerticalOrigin.CENTER,
          horizontalOrigin: HorizontalOrigin.CENTER,
          pixelOffset: new Cartesian2(0, 0),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        properties: {
          isCluster: true,
          clusterData: cluster
        }
      });
    }
  }

  dataSource.entities.resumeEvents();

  return { visibleCount, clustersActive };
}
