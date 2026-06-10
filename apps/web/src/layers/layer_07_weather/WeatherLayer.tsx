import { useEffect, useRef } from 'react';
import { Viewer, BillboardCollection, Cartesian3 } from 'cesium';
import type { WeatherRenderItem } from './weatherTypes';
import { getWeatherMarkerImage, WEATHER_BILLBOARD_SCALE } from './weatherMarker';

interface WeatherLayerProps {
  viewer: Viewer | null;
  items: WeatherRenderItem[];
  active: boolean;
}

/**
 * Renders weather observations as temperature-coloured billboards.
 *
 * - Markers only render while `active` is true; cleared otherwise.
 * - Placed at resolved (grid) coordinates.
 * - Each billboard carries `_weatherData` on its picking id for click handling.
 * - Defensive against malformed items (skips invalid coordinates).
 */
export default function WeatherLayer({
  viewer,
  items,
  active,
}: WeatherLayerProps): null {
  const collectionRef = useRef<BillboardCollection | null>(null);
  const billboardMapRef = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    const collection = new BillboardCollection();
    viewer.scene.primitives.add(collection);
    collectionRef.current = collection;

    return () => {
      if (!viewer.isDestroyed()) {
        viewer.scene.primitives.remove(collection);
      }
      collectionRef.current = null;
      billboardMapRef.current.clear();
    };
  }, [viewer]);

  useEffect(() => {
    const collection = collectionRef.current;
    if (!collection) return;

    if (!active || !items || items.length === 0) {
      collection.removeAll();
      billboardMapRef.current.clear();
      viewer?.scene.requestRender();
      return;
    }

    const billboardMap = billboardMapRef.current;
    const currentIds = new Set<string>();

    for (const item of items) {
      if (
        !item ||
        typeof item.latitude !== 'number' ||
        typeof item.longitude !== 'number' ||
        !Number.isFinite(item.latitude) ||
        !Number.isFinite(item.longitude)
      ) {
        continue;
      }

      currentIds.add(item.observationId);

      const pos = Cartesian3.fromDegrees(item.longitude, item.latitude, 0);
      const img = getWeatherMarkerImage(item);

      const existing = billboardMap.get(item.observationId);
      if (existing) {
        existing.position = pos;
        existing.image = img;
        if (existing.id && typeof existing.id === 'object') {
          existing.id._weatherData = item;
        }
      } else {
        const idObj = { _weatherData: item };
        const b = collection.add({
          position: pos,
          image: img,
          scale: WEATHER_BILLBOARD_SCALE,
          id: idObj,
        });
        billboardMap.set(item.observationId, b);
      }
    }

    // Remove billboards no longer present.
    for (const [id, b] of billboardMap.entries()) {
      if (!currentIds.has(id)) {
        collection.remove(b);
        billboardMap.delete(id);
      }
    }

    viewer?.scene.requestRender();
  }, [active, items, viewer]);

  return null;
}
