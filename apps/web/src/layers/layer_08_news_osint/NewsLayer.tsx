import { useEffect, useRef } from 'react';
import { Viewer, BillboardCollection, Cartesian3 } from 'cesium';
import type { NewsRenderMarker } from './newsTypes';
import { getNewsMarkerImage, NEWS_BILLBOARD_SCALE } from './newsMarker';

interface NewsLayerProps {
  viewer: Viewer | null;
  markers: NewsRenderMarker[];
  active: boolean;
}

/**
 * Renders Layer 08 news/OSINT markers as severity-coloured diamond billboards.
 *
 * Only processes items already filtered to marker_ready=true + Point geometry
 * (that filtering happens in the API + render model mapping). LineString and
 * Polygon records are never passed here.
 *
 * Billboard id carries `_newsData` for click handling in CesiumGlobe.
 */
export default function NewsLayer({ viewer, markers, active }: NewsLayerProps): null {
  const collectionRef = useRef<BillboardCollection | null>(null);
  const billboardMapRef = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    const collection = new BillboardCollection();
    viewer.scene.primitives.add(collection);
    collectionRef.current = collection;
    return () => {
      if (!viewer.isDestroyed()) viewer.scene.primitives.remove(collection);
      collectionRef.current = null;
      billboardMapRef.current.clear();
    };
  }, [viewer]);

  useEffect(() => {
    const collection = collectionRef.current;
    if (!collection) return;

    if (!active || !markers || markers.length === 0) {
      collection.removeAll();
      billboardMapRef.current.clear();
      viewer?.scene.requestRender();
      return;
    }

    const bmap = billboardMapRef.current;
    const currentIds = new Set<string>();

    for (const marker of markers) {
      if (
        typeof marker.latitude !== 'number' ||
        typeof marker.longitude !== 'number' ||
        !Number.isFinite(marker.latitude) ||
        !Number.isFinite(marker.longitude)
      ) {
        continue;
      }

      currentIds.add(marker.itemId);
      const pos = Cartesian3.fromDegrees(marker.longitude, marker.latitude, 0);
      const img = getNewsMarkerImage(marker);

      const existing = bmap.get(marker.itemId);
      if (existing) {
        existing.position = pos;
        existing.image = img;
        if (existing.id && typeof existing.id === 'object') {
          existing.id._newsData = marker;
        }
      } else {
        const idObj = { _newsData: marker };
        const b = collection.add({
          position: pos,
          image: img,
          scale: NEWS_BILLBOARD_SCALE,
          id: idObj,
        });
        bmap.set(marker.itemId, b);
      }
    }

    for (const [id, b] of bmap.entries()) {
      if (!currentIds.has(id)) {
        collection.remove(b);
        bmap.delete(id);
      }
    }

    viewer?.scene.requestRender();
  }, [active, markers, viewer]);

  return null;
}
