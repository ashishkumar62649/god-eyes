import { useEffect } from 'react';
import {
  Entity,
  Cartesian3,
  Color,
  PolylineGraphics,
  PointGraphics,
  ConstantProperty,
  ConstantPositionProperty,
  CustomDataSource,
} from 'cesium';
import type { EnergyFeature } from './energyInfrastructureTypes';
import { ENERGY_FUEL_TYPES } from './energyInfrastructureTypes';

interface EnergyInfrastructureLayerProps {
  dataSource: CustomDataSource | null;
  features: EnergyFeature[];
  active: boolean;
}

function getFuelColor(fuelType: string): Color {
  const entry = ENERGY_FUEL_TYPES[fuelType];
  if (entry) return Color.fromCssColorString(entry.color);
  return Color.GRAY;
}

function getLineColor(featureType: string): Color {
  switch (featureType) {
    case 'transmission_line': return Color.fromCssColorString('#87cefa');
    case 'oil_pipeline': return Color.fromCssColorString('#ff0000');
    case 'gas_pipeline': return Color.fromCssColorString('#ffa500');
    default: return Color.GRAY;
  }
}

export default function EnergyInfrastructureLayer({
  dataSource,
  features,
  active,
}: EnergyInfrastructureLayerProps): null {
  useEffect(() => {
    if (!dataSource) return;

    dataSource.entities.removeAll();

    if (!active || !features || features.length === 0) return;

    for (const feature of features) {
      const entity = new Entity({
        id: `energy-${feature.id}`,
        name: feature.name,
        properties: {
          rawData: feature,
        },
      });

      const isPoint = feature.geometryType === 'Point' || feature.geometry?.type === 'Point';
      const isLine = feature.geometryType === 'LineString' || feature.geometry?.type === 'LineString';

      if (isPoint) {
        let color = Color.GRAY;
        let pixelSize = 8;

        if (feature.featureType === 'power_plant' && feature.fuelType) {
          color = getFuelColor(feature.fuelType);
        } else if (feature.featureType === 'substation') {
          color = Color.fromCssColorString('#800080');
          pixelSize = 10;
        }

        entity.position = new ConstantPositionProperty(
          Cartesian3.fromDegrees(feature.centroidLon, feature.centroidLat),
        );

        entity.point = new PointGraphics({
          color: new ConstantProperty(color),
          pixelSize: new ConstantProperty(pixelSize),
          outlineColor: new ConstantProperty(Color.WHITE),
          outlineWidth: new ConstantProperty(1),
        });
      } else if (isLine) {
        const color = getLineColor(feature.featureType);
        const coords = feature.geometry?.coordinates as [number, number][] | undefined;
        if (coords && coords.length > 1) {
          const positions = coords.map(([lon, lat]) => Cartesian3.fromDegrees(lon, lat));
          entity.polyline = new PolylineGraphics({
            positions,
            width: 2,
            material: color.withAlpha(0.7),
          });
        }
      }

      dataSource.entities.add(entity);
    }
  }, [dataSource, features, active]);

  return null;
}
