/**
 * useCameraBboxReporter.ts — Wave 4 CesiumGlobe split (W4-D)
 *
 * Maritime Layer 06 polling bbox hook.
 *
 * Reports the current camera viewport as a bbox string
 * `"minLon,minLat,maxLon,maxLat"` (6 decimal places) to
 * `onMaritimeBboxChange`, used by the maritime polling layer to
 * scope requests to the visible viewport.
 *
 * The hook:
 *   - registers a `camera.moveEnd` listener that recomputes the bbox
 *     and reports it via the callback;
 *   - reports the initial bbox once when the layer becomes active
 *     (so the polling layer has a value before any camera move);
 *   - validates the bbox against the
 *     [-180,180] × [-90,90] envelope and rejects dateline crossings
 *     (`minLon < maxLon`) by falling back to `null` (global query);
 *   - cleans up the listener on unmount or when the layer goes OFF;
 *   - calls `onMaritimeBboxChange(null)` when the maritime layer is
 *     OFF or the viewer is not ready, so the polling layer falls
 *     back to its global mode.
 *
 * This is the **narrowest** of the Wave 4 extractions. It owns one
 * `useEffect`, one Cesium event listener registration, and one cleanup.
 * It does NOT touch viewer lifecycle, picking, aviation cache, live
 * aircraft, satellites, borders, earthquakes, layout features, or
 * render shell.
 *
 * The orchestrator (`apps/web/src/CesiumGlobe/index.tsx`) calls this
 * hook in place of the inline `useEffect` that previously owned this
 * responsibility (originally at lines 1309-1364 of the pre-split
 * `CesiumGlobe.tsx`).
 */

import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type { Viewer } from 'cesium';

export interface UseCameraBboxReporterParams {
  /** Mutable ref holding the live Cesium Viewer (or null before init / after destroy). */
  viewerRef: MutableRefObject<Viewer | null>;
  /** True once the viewer-init `useEffect` has finished and the Viewer is live. */
  viewerReady: boolean;
  /**
   * True while the maritime layer toggle is ON. Optional to match the
   * optional `maritimeLayerActive` prop on `CesiumGlobeProps`;
   * `undefined` is treated identically to `false` by the guard below.
   */
  maritimeLayerActive?: boolean;
  /** Callback that receives the current viewport bbox string (or null for global fallback). */
  onMaritimeBboxChange?: (bbox: string | null) => void;
}

/**
 * Maritime Layer 06 polling bbox reporter hook.
 *
 * Owns the `camera.moveEnd` listener lifecycle and the bbox validation
 * chain. Behavior is bit-for-bit identical to the inline `useEffect`
 * it replaces in `apps/web/src/CesiumGlobe/index.tsx`.
 */
export function useCameraBboxReporter(params: UseCameraBboxReporterParams): void {
  const { viewerRef, viewerReady, maritimeLayerActive, onMaritimeBboxChange } = params;

  useEffect(() => {
    if (!viewerReady || !maritimeLayerActive || !onMaritimeBboxChange) {
      if (onMaritimeBboxChange) {
        onMaritimeBboxChange(null);
      }
      return;
    }

    const viewer = viewerRef.current;
    if (!viewer) return;

    const reportBbox = () => {
      try {
        const rect = viewer.camera.computeViewRectangle();
        if (!rect) {
          onMaritimeBboxChange(null);
          return;
        }
        const toDeg = (r: number) => r * (180 / Math.PI);
        const minLon = toDeg(rect.west);
        const minLat = toDeg(rect.south);
        const maxLon = toDeg(rect.east);
        const maxLat = toDeg(rect.north);

        // Sanity check coordinates are finite and correct
        if ([minLon, minLat, maxLon, maxLat].every(isFinite)) {
          if (
            minLon >= -180 && minLon <= 180 &&
            maxLon >= -180 && maxLon <= 180 &&
            minLat >= -90 && minLat <= 90 &&
            maxLat >= -90 && maxLat <= 90 &&
            minLat < maxLat &&
            minLon < maxLon // Omit dateline crossings
          ) {
            const bboxStr = `${minLon.toFixed(6)},${minLat.toFixed(6)},${maxLon.toFixed(6)},${maxLat.toFixed(6)}`;
            onMaritimeBboxChange(bboxStr);
            return;
          }
        }
        onMaritimeBboxChange(null); // Fallback to global query
      } catch (e) {
        console.warn('Failed to compute bbox for Maritime:', e);
        onMaritimeBboxChange(null);
      }
    };

    // Report initial bbox when layer becomes active
    reportBbox();

    viewer.camera.moveEnd.addEventListener(reportBbox);
    return () => {
      if (viewer && !viewer.isDestroyed()) {
        viewer.camera.moveEnd.removeEventListener(reportBbox);
      }
    };
  }, [viewerReady, maritimeLayerActive, onMaritimeBboxChange]);
}
