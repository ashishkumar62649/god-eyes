import { useEffect, useRef } from 'react';
import { Viewer, BillboardCollection, Cartesian3, Color } from 'cesium';
import type { MaritimeVesselObject } from '@god-eyes/contracts';
import {
  getVesselMarkerImage,
  getVesselHeading,
  isVesselStale,
  VESSEL_BILLBOARD_SCALE,
} from './vesselMarker';

interface MaritimeLayerProps {
  viewer: Viewer | null;
  vessels: MaritimeVesselObject[];
  active: boolean;
}

export default function MaritimeLayer({
  viewer,
  vessels,
  active,
}: MaritimeLayerProps): null {
  const collectionRef = useRef<BillboardCollection | null>(null);
  const billboardMapRef = useRef<Map<number, any>>(new Map());

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    // Create BillboardCollection and add to scene primitives
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

    if (!active || !vessels || vessels.length === 0) {
      // Clear billboards if layer is disabled or list is empty
      collection.removeAll();
      billboardMapRef.current.clear();
      viewer?.scene.requestRender();
      return;
    }

    const currentMmsis = new Set<number>();
    const billboardMap = billboardMapRef.current;

    for (const vessel of vessels) {
      // Validate latitude and longitude
      if (
        vessel.latitude === null ||
        vessel.latitude === undefined ||
        vessel.longitude === null ||
        vessel.longitude === undefined ||
        isNaN(vessel.latitude) ||
        isNaN(vessel.longitude)
      ) {
        continue;
      }

      currentMmsis.add(vessel.mmsi);

      const pos = Cartesian3.fromDegrees(vessel.longitude, vessel.latitude, 0);
      const img = getVesselMarkerImage(vessel);
      const heading = getVesselHeading(vessel);
      // Compass heading is clockwise, Cesium billboard rotation is counter-clockwise
      const rotation = heading !== null ? -(heading * Math.PI) / 180 : 0;

      // Dim stale vessels by adjusting color alpha
      const stale = isVesselStale(vessel);
      const color = stale ? new Color(1, 1, 1, 0.45) : Color.WHITE;

      const existing = billboardMap.get(vessel.mmsi);
      if (existing) {
        existing.position = pos;
        existing.image = img;
        existing.rotation = rotation;
        existing.color = color;
        // Attach raw vessel data for the click picking handler
        if (existing.id && typeof existing.id === 'object') {
          existing.id._vesselData = vessel;
        }
      } else {
        // Create new picking ID object
        const idObj = { _vesselData: vessel };
        const b = collection.add({
          position: pos,
          image: img,
          rotation,
          color,
          scale: VESSEL_BILLBOARD_SCALE,
          id: idObj,
        });
        billboardMap.set(vessel.mmsi, b);
      }
    }

    // Remove old billboards not present in the current vessels list
    for (const [mmsi, b] of billboardMap.entries()) {
      if (!currentMmsis.has(mmsi)) {
        collection.remove(b);
        billboardMap.delete(mmsi);
      }
    }

    viewer?.scene.requestRender();
  }, [active, vessels, viewer]);

  return null;
}
