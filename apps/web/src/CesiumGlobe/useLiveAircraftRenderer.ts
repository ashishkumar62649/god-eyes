/**
 * useLiveAircraftRenderer.ts — Wave 4 CesiumGlobe split (W4-G)
 *
 * Live aircraft Layer 01 WebSocket-driven renderer hook.
 *
 * Owns the full WebSocket → Cesium BillboardCollection pipeline:
 *
 *   1. **Snapshot apply loop** — `onAircraftSnapshot` callback
 *      receives the latest WS snapshot, queued in
 *      `pendingSnapshotRef`. A `startApply` chunked rAF loop (500
 *      aircraft per frame) iterates the snapshot, upserts into
 *      `aircraftMapRef` (`Map<sourceObjectId, AircraftRecord>`),
 *      and creates/updates the corresponding billboard in
 *      `aircraftCollectionRef`. Apply-guard (`applyingRef`)
 *      guarantees only one apply loop runs at a time. After apply,
 *      stale aircraft (no longer in snapshot) are removed.
 *   2. **Delta apply handler** — `onAircraftDelta` callback
 *      receives incremental upserts and explicit removes; applied
 *      directly without a snapshot re-apply. Updates the same
 *      `aircraftMapRef` + billboards. Calls `onAircraftRendered`
 *      with the new map size.
 *   3. **Layer OFF cleanup** — when `liveAircraftLayerActive`
 *      flips to false, hide all billboards, clear the map,
 *      cancel any in-flight apply rAF, drop the pending snapshot,
 *      and clear the selected aircraft overlay.
 *   4. **Dead-reckoning rAF loop** — when the layer is ON and
 *      the viewer is ready, runs at ~20 FPS (`FRAME_INTERVAL =
 *      50ms`) advancing each billboard along its track
 *      (`speedKt * KNOTS_TO_MPS * elapsedSecs` clamped at
 *      `DR_MAX_SECS = 10s`) and vertical rate
 *      (`verticalRateFpm * FPM_TO_MPS * elapsedSecs`). Display-only:
 *      never writes the predicted position back to
 *      `AircraftRecord.currPos`.
 *
 * Also owns the icon-vs-dot visual-mode helpers (`shouldShowAircraftIcons`,
 * `getAircraftVisualImage`, `updateAircraftVisualMode`) that were
 * kept in the orchestrator during W4-E because they bridged live
 * aircraft rendering concerns. The orchestrator's camera listener
 * (in the W4-H viewer-init effect) now calls the returned
 * `updateAircraftVisualMode` from this hook instead of an inline
 * helper.
 *
 * Picking contract
 * ----------------
 * Aircraft billboards carry `_aircraftData` on their `id` object
 * (the W4-B contract). Reading and writing the contract field uses
 * `PICKING_FIELDS.aircraftData` from `./pickingFields.ts` so the
 * picking-contract test in `__tests__/pickingContract.test.ts`
 * pins it.
 *
 * Refs owned by the orchestrator, used by this hook:
 *   - `viewerRef`, `aircraftCollectionRef`, `aircraftMapRef`,
 *     `pendingSnapshotRef`, `applyingRef`, `applyRafRef`,
 *     `drRafRef`, `cameraHeightRef` — passed in as params.
 *
 * rAF cleanup ownership
 * ---------------------
 * This hook owns `applyRafRef` and `drRafRef`. The hook's own
 * effect cleanups cancel them. The orchestrator's viewer-init
 * effect cleanup no longer touches these refs (the orchestrator
 * only owns viewer + data source + primitive + ScreenSpaceEventHandler
 * teardown — that is W4-H territory).
 */

import { useEffect, useCallback } from 'react';
import type { MutableRefObject } from 'react';
import { Cartesian3, Color } from 'cesium';
import type { Viewer, BillboardCollection } from 'cesium';
import type { AircraftLatest } from '@god-eyes/contracts';

import {
  getAircraftAltitudeColor,
  getAircraftMarkerImage,
  getAircraftMarkerImageAsync,
  getAircraftDotMarkerImage,
  resolveAircraftIconName,
  getAircraftHeadingDeg,
  headingToBillboardRotation,
  AIRCRAFT_BILLBOARD_SCALE,
} from '../layers/layer_01_aviation/aircraft/aircraftMarker';
import {
  RENDER_CAP,
  type SnapshotCallback,
} from '../layers/layer_01_aviation/aircraft/useLiveAircraftSocket';

import { AIRCRAFT_ICON_VIEW_HEIGHT_METERS } from './constants';
import { PICKING_FIELDS } from './pickingFields';
import type { AircraftRecord, CesiumGlobeProps } from './types';

type BboxGetter = () => [number, number, number, number] | null;
type OnAircraftRendered = NonNullable<CesiumGlobeProps['onAircraftRendered']>;

export interface UseLiveAircraftRendererParams {
  /** Live Cesium Viewer ref (null before init / after destroy). */
  viewerRef: MutableRefObject<Viewer | null>;
  /** True once the viewer-init `useEffect` has finished and the Viewer is live. */
  viewerReady: boolean;
  /** True while the live aircraft layer toggle is ON. */
  liveAircraftLayerActive?: boolean;
  /** Ref to the `BillboardCollection` created by the viewer-init effect. */
  aircraftCollectionRef: MutableRefObject<BillboardCollection | null>;
  /** Map of sourceObjectId → AircraftRecord (one record per rendered aircraft). */
  aircraftMapRef: MutableRefObject<Map<string, AircraftRecord>>;
  /** Latest snapshot waiting to be applied by the chunked rAF loop. */
  pendingSnapshotRef: MutableRefObject<AircraftLatest[] | null>;
  /** Apply-guard: true while a snapshot apply loop is in flight. */
  applyingRef: MutableRefObject<boolean>;
  /** rAF handle for the snapshot apply chunked loop. */
  applyRafRef: MutableRefObject<number>;
  /** rAF handle for the dead-reckoning animation loop. */
  drRafRef: MutableRefObject<number>;
  /** Latest known camera height (used by `shouldShowAircraftIcons`). */
  cameraHeightRef: MutableRefObject<number>;
  /** Ref mirror of the `onAircraftSnapshot` prop callback. */
  onAircraftSnapshotRef: MutableRefObject<
    ((ac: AircraftLatest[]) => void) | undefined
  >;
  /** Ref mirror of the `onAircraftDelta` prop callback. */
  onAircraftDeltaRef: MutableRefObject<
    ((upsert: AircraftLatest[], removes: string[]) => void) | undefined
  >;
  /** Ref mirror of the `onAircraftRendered` prop callback. */
  onAircraftRenderedRef: MutableRefObject<OnAircraftRendered | undefined>;
  /**
   * Ref mirror of the camera-bbox getter. Owned by the orchestrator
   * (declared and prop-synced there). The snapshot-apply effect
   * below overwrites `onGetBboxRef2.current` with a viewer-aware
   * camera-rectangle getter. The orchestrator's prop-sync restores
   * the prop value on every render, matching the original behavior
   * bit-for-bit.
   */
  onGetBboxRef2: MutableRefObject<BboxGetter | undefined>;
  /** Optional: the external `onSnapshotCbRef` populated so App.tsx can forward WS snapshots here. */
  onSnapshotCbRef?: MutableRefObject<((ac: AircraftLatest[]) => void) | undefined>;
  /** Optional: the external `onDeltaCbRef` populated so App.tsx can forward WS deltas here. */
  onDeltaCbRef?: MutableRefObject<
    ((upsert: AircraftLatest[], removes: string[]) => void) | undefined
  >;
  /** React state setter for the selected live aircraft overlay (cleared on layer OFF). */
  setSelectedAircraft: (aircraft: AircraftLatest | null) => void;
}

export interface UseLiveAircraftRendererResult {
  /**
   * Visual-mode refresh function called by the orchestrator's
   * camera listener (in the viewer-init effect, W4-H territory)
   * whenever the camera changes height. Iterates the aircraft map
   * and swaps each billboard's image between the per-type icon
   * (when `cameraHeightRef.current <= AIRCRAFT_ICON_VIEW_HEIGHT_METERS`)
   * and the altitude-coloured dot (when the camera is further out).
   * Also kicks off the async SVG-swap for any billboards that have
   * not yet loaded their final image.
   *
   * Exposed from the hook so the camera listener — which is
   * owned by the viewer-init effect — can call it without
   * duplicating the helper or coupling the effect to renderer state.
   */
  updateAircraftVisualMode: () => void;
}

/**
 * Live aircraft Layer 01 WebSocket-driven renderer hook.
 *
 * Owns the four renderer effects (snapshot apply, clear-on-off,
 * delta handler, dead-reckoning loop), the prop-sync mirror for
 * `onGetBboxRef2`, and the three visual-mode helpers
 * (`shouldShowAircraftIcons`, `getAircraftVisualImage`,
 * `updateAircraftVisualMode`). Behavior is bit-for-bit identical
 * to the inline code in `apps/web/src/CesiumGlobe/index.tsx`
 * (formerly at lines 215-242 + 542-888 of the pre-W4-G
 * orchestrator).
 */
export function useLiveAircraftRenderer(
  params: UseLiveAircraftRendererParams,
): UseLiveAircraftRendererResult {
  const {
    viewerRef,
    viewerReady,
    liveAircraftLayerActive,
    aircraftCollectionRef,
    aircraftMapRef,
    pendingSnapshotRef,
    applyingRef,
    applyRafRef,
    drRafRef,
    cameraHeightRef,
    onAircraftSnapshotRef,
    onAircraftDeltaRef,
    onAircraftRenderedRef,
    onGetBboxRef2,
    onSnapshotCbRef,
    onDeltaCbRef,
    setSelectedAircraft,
  } = params;

  const shouldShowAircraftIcons = useCallback((): boolean => {
    return cameraHeightRef.current <= AIRCRAFT_ICON_VIEW_HEIGHT_METERS;
  }, [cameraHeightRef]);

  const getAircraftVisualImage = useCallback((color: string, iconName: string): string => {
    if (!shouldShowAircraftIcons()) {
      return getAircraftDotMarkerImage(color);
    }
    return getAircraftMarkerImage(iconName, color);
  }, [shouldShowAircraftIcons]);

  const updateAircraftVisualMode = useCallback((): void => {
    if (!aircraftMapRef.current.size) return;
    for (const record of aircraftMapRef.current.values()) {
      const ac = (record.billboard.id as { [k: string]: unknown })[
        PICKING_FIELDS.aircraftData
      ] as AircraftLatest | undefined;
      if (!ac) continue;
      const color = getAircraftAltitudeColor(ac);
      const iconName = resolveAircraftIconName(ac);
      const image = getAircraftVisualImage(color, iconName);
      record.billboard.image = image;
      if (shouldShowAircraftIcons()) {
        getAircraftMarkerImageAsync(iconName, color).then((img) => {
          const currentAircraft = (record.billboard.id as { [k: string]: unknown })[
            PICKING_FIELDS.aircraftData
          ] as AircraftLatest | undefined;
          if (
            currentAircraft?.sourceObjectId === ac.sourceObjectId &&
            shouldShowAircraftIcons() &&
            img !== image
          ) {
            record.billboard.image = img;
          }
        });
      }
    }
  }, [aircraftMapRef, getAircraftVisualImage, shouldShowAircraftIcons]);

  // (No internal onGetBboxRef2 declaration — the ref is owned by the
  // orchestrator and passed in. The orchestrator's prop-sync writes
  // `onGetBboxRef2.current = onGetBbox` on every render. The
  // snapshot-apply effect below overwrites it with a viewer-aware
  // camera-rectangle getter.)

  // Snapshot apply effect (WO-079H).
  // Architecture:
  //   - Snapshots arrive via onAircraftSnapshot callback (no React re-render per poll).
  //   - Applied in chunked rAF batches (CHUNK_SIZE per frame) to keep globe responsive.
  //   - BillboardCollection (single primitive) instead of Entity per aircraft.
  //   - Interpolation: CallbackProperty lerps between prev/curr observed positions.
  //   - Apply-guard: only one apply loop runs at a time; new snapshot queues as pending.
  //   - Camera bbox: onGetBbox() called by the hook on each poll tick.
  useEffect(() => {
    if (!viewerReady) return;

    const CHUNK_SIZE = 500;

    // Wire the snapshot callback so the hook can deliver data without React re-render.
    const snapshotHandler: SnapshotCallback = (aircraft: AircraftLatest[]) => {
      pendingSnapshotRef.current = aircraft;
      if (!applyingRef.current) startApply();
    };
    onAircraftSnapshotRef.current = snapshotHandler;
    // Also populate the external ref so App.tsx can forward WS snapshots here.
    if (onSnapshotCbRef) onSnapshotCbRef.current = snapshotHandler;

    function startApply() {
      const snapshot = pendingSnapshotRef.current;
      if (!snapshot) return;
      pendingSnapshotRef.current = null;
      applyingRef.current = true;

      const coll = aircraftCollectionRef.current;
      if (!coll) {
        applyingRef.current = false;
        return;
      }

      const map = aircraftMapRef.current;

      // Build the set of valid aircraft to apply.
      const valid: AircraftLatest[] = [];
      for (const ac of snapshot) {
        if (ac.lat === null || ac.lon === null) continue;
        // Do NOT filter by staleAfter — WS stream is source of truth for liveness.
        valid.push(ac);
        if (valid.length >= RENDER_CAP) break;
      }

      const seen = new Set<string>();
      let i = 0;

      function applyChunk() {
        const end = Math.min(i + CHUNK_SIZE, valid.length);
        for (; i < end; i++) {
          const ac = valid[i];
          const key = ac.sourceObjectId;
          seen.add(key);

          const heading = getAircraftHeadingDeg(ac);
          const color = getAircraftAltitudeColor(ac);
          // Support both WS wire field (altitudeFt) and contract field (altitudeBaroFt).
          const altitudeFt =
            typeof (ac as any).altitudeFt === 'number'
              ? (ac as any).altitudeFt
              : typeof ac.altitudeBaroFt === 'number'
                ? ac.altitudeBaroFt
                : 0;
          const altMeters = Math.max(0, altitudeFt * 0.3048);
          const newPos = Cartesian3.fromDegrees(ac.lon!, ac.lat!, altMeters);
          const rotation = heading !== null ? headingToBillboardRotation(heading) : 0;
          const iconName = resolveAircraftIconName(ac);
          const image: string = getAircraftVisualImage(color, iconName);
          const obsTime = new Date(ac.observedAt).getTime();
          const staleMs = ac.staleAfter ? new Date(ac.staleAfter).getTime() : 0;
          // Support both WS wire field (speedKt) and contract field (groundSpeedKt).
          const speedKt =
            typeof (ac as any).speedKt === 'number'
              ? (ac as any).speedKt
              : typeof ac.groundSpeedKt === 'number'
                ? ac.groundSpeedKt
                : 0;

          const existing = map.get(key);
          if (existing) {
            existing.currPos = newPos;
            existing.currLat = ac.lat!;
            existing.currLon = ac.lon!;
            existing.currAltM = altMeters;
            existing.currTime = obsTime;
            existing.staleAfter = staleMs;
            existing.speedKt = speedKt;
            existing.trackDeg =
              ac.trackDeg ?? (ac as { headingDeg?: number }).headingDeg ?? ac.headingTrueDeg ?? NaN;
            existing.verticalRateFpm = ac.verticalRateFpm ?? 0;
            existing.onGround = ac.onGround ?? false;
            existing.billboard.position = newPos;
            existing.billboard.image = image;
            existing.billboard.color = Color.WHITE;
            existing.billboard.rotation = rotation;
            (existing.billboard.id as { [k: string]: unknown })[
              PICKING_FIELDS.aircraftData
            ] = ac;
            // Async update: swap to real SVG once loaded.
            if (shouldShowAircraftIcons()) {
              getAircraftMarkerImageAsync(iconName, color).then((img) => {
                if (
                  existing.billboard &&
                  shouldShowAircraftIcons() &&
                  img !== image
                ) {
                  existing.billboard.image = img;
                }
              });
            }
          } else {
            const idObj: { [k: string]: AircraftLatest } = {
              [PICKING_FIELDS.aircraftData]: ac,
            };
            const billboard = coll!.add({
              image,
              color: Color.WHITE,
              scale: AIRCRAFT_BILLBOARD_SCALE,
              rotation,
              alignedAxis: Cartesian3.ZERO,
              position: newPos,
              id: idObj,
            });
            map.set(key, {
              billboard,
              currLat: ac.lat!,
              currLon: ac.lon!,
              currAltM: altMeters,
              currPos: newPos,
              currTime: obsTime,
              staleAfter: staleMs,
              speedKt,
              trackDeg:
                ac.trackDeg ??
                (ac as { headingDeg?: number }).headingDeg ??
                ac.headingTrueDeg ??
                NaN,
              verticalRateFpm: ac.verticalRateFpm ?? 0,
              onGround: ac.onGround ?? false,
            });
            // Async update: swap to real SVG once loaded.
            if (shouldShowAircraftIcons()) {
              getAircraftMarkerImageAsync(iconName, color).then((img) => {
                if (billboard && shouldShowAircraftIcons() && img !== image) {
                  billboard.image = img;
                }
              });
            }
          }
        }

        if (i < valid.length) {
          // More chunks to process.
          applyRafRef.current = requestAnimationFrame(applyChunk);
          return;
        }

        // All valid aircraft applied. Remove gone/stale markers.
        for (const [key, rec] of map) {
          if (!seen.has(key)) {
            coll!.remove(rec.billboard);
            map.delete(key);
          }
        }

        applyingRef.current = false;
        onAircraftRenderedRef.current?.(map.size);
        viewerRef.current?.scene.requestRender();
        if (pendingSnapshotRef.current) startApply();
      }

      applyRafRef.current = requestAnimationFrame(applyChunk);
    }

    // Wire the bbox callback so the hook can get the current camera viewport.
    onGetBboxRef2.current = () => {
      const viewer = viewerRef.current;
      if (!viewer) return null;
      try {
        const rect = viewer.camera.computeViewRectangle();
        if (!rect) return null;
        const toDeg = (r: number) => r * (180 / Math.PI);
        const bbox: [number, number, number, number] = [
          toDeg(rect.west),
          toDeg(rect.south),
          toDeg(rect.east),
          toDeg(rect.north),
        ];
        // Validate before returning.
        if (bbox.some((v) => !isFinite(v))) return null;
        return bbox;
      } catch {
        return null;
      }
    };

    return () => {
      if (applyRafRef.current) cancelAnimationFrame(applyRafRef.current);
      applyingRef.current = false;
    };
  }, [viewerReady]);

  // Clear all live aircraft markers when the layer is turned OFF (WO-079H).
  useEffect(() => {
    if (liveAircraftLayerActive) return;
    if (applyRafRef.current) {
      cancelAnimationFrame(applyRafRef.current);
      applyRafRef.current = 0;
    }
    applyingRef.current = false;
    pendingSnapshotRef.current = null;
    const coll = aircraftCollectionRef.current;
    const map = aircraftMapRef.current;
    if (coll) {
      for (const rec of map.values()) {
        rec.billboard.show = false;
      }
    }
    map.clear();
    setSelectedAircraft(null);
  }, [liveAircraftLayerActive]);

  // Wire delta handler: upsert/remove individual aircraft without full snapshot apply.
  useEffect(() => {
    if (!viewerReady) return;
    const deltaHandler = (upsert: AircraftLatest[], removes: string[]) => {
      const coll = aircraftCollectionRef.current;
      const map = aircraftMapRef.current;
      if (!coll) return;

      let updatedCount = 0;

      // Upsert changed/new aircraft.
      for (const ac of upsert) {
        if (ac.lat === null || ac.lon === null) continue;
        const key = ac.sourceObjectId;
        const heading = getAircraftHeadingDeg(ac);
        const color = getAircraftAltitudeColor(ac);
          const altitudeFt =
            typeof (ac as any).altitudeFt === 'number'
              ? (ac as any).altitudeFt
              : typeof ac.altitudeBaroFt === 'number'
                ? ac.altitudeBaroFt
                : 0;
        const altMeters = Math.max(0, altitudeFt * 0.3048);
        const newPos = Cartesian3.fromDegrees(ac.lon, ac.lat, altMeters);
        const obsTime = new Date(ac.observedAt).getTime();
        const staleMs = ac.staleAfter ? new Date(ac.staleAfter).getTime() : 0;
        const iconName = resolveAircraftIconName(ac);
        const image = getAircraftVisualImage(color, iconName);
        const rotation = heading !== null ? headingToBillboardRotation(heading) : 0;
          const speedKt =
            typeof (ac as any).speedKt === 'number'
              ? (ac as any).speedKt
              : typeof ac.groundSpeedKt === 'number'
                ? ac.groundSpeedKt
                : 0;

        const existing = map.get(key);
        if (existing) {
          existing.currPos = newPos;
          existing.currLat = ac.lat;
          existing.currLon = ac.lon;
          existing.currAltM = altMeters;
          existing.currTime = obsTime;
          existing.staleAfter = staleMs;
          existing.speedKt = speedKt;
          existing.trackDeg =
            ac.trackDeg ?? (ac as { headingDeg?: number }).headingDeg ?? ac.headingTrueDeg ?? NaN;
          existing.verticalRateFpm = ac.verticalRateFpm ?? 0;
          existing.onGround = ac.onGround ?? false;
          existing.billboard.position = newPos;
          existing.billboard.image = image;
          existing.billboard.color = Color.WHITE;
          existing.billboard.rotation = rotation;
          (existing.billboard.id as { [k: string]: unknown })[
            PICKING_FIELDS.aircraftData
          ] = ac;
          updatedCount++;
          if (shouldShowAircraftIcons()) {
            getAircraftMarkerImageAsync(iconName, color).then((img) => {
              if (
                existing.billboard &&
                shouldShowAircraftIcons() &&
                img !== image
              ) {
                existing.billboard.image = img;
              }
            });
          }
        } else {
          const idObj: { [k: string]: AircraftLatest } = {
            [PICKING_FIELDS.aircraftData]: ac,
          };
          const billboard = coll!.add({
            image,
            color: Color.WHITE,
            scale: AIRCRAFT_BILLBOARD_SCALE,
            rotation,
            alignedAxis: Cartesian3.ZERO,
            position: newPos,
            id: idObj,
          });
          map.set(key, {
            billboard,
            currLat: ac.lat,
            currLon: ac.lon,
            currAltM: altMeters,
            currPos: newPos,
            currTime: obsTime,
            staleAfter: staleMs,
            speedKt,
            trackDeg:
              ac.trackDeg ??
              (ac as { headingDeg?: number }).headingDeg ??
              ac.headingTrueDeg ??
              NaN,
            verticalRateFpm: ac.verticalRateFpm ?? 0,
            onGround: ac.onGround ?? false,
          });
          if (shouldShowAircraftIcons()) {
            getAircraftMarkerImageAsync(iconName, color).then((img) => {
              if (billboard && shouldShowAircraftIcons() && img !== image) {
                billboard.image = img;
              }
            });
          }
          updatedCount++;
        }
      }

      // Remove aircraft explicitly listed.
      for (const key of removes) {
        const rec = map.get(key);
        if (rec) {
          coll!.remove(rec.billboard);
          map.delete(key);
        }
      }

      if (updatedCount > 0 || removes.length > 0) {
        viewerRef.current?.scene.requestRender();
      }
      onAircraftRenderedRef.current?.(map.size);
    };
    onAircraftDeltaRef.current = deltaHandler;
    if (onDeltaCbRef) onDeltaCbRef.current = deltaHandler;
  }, [viewerReady]);

  // Dead reckoning animation loop (WO-080B).
  // Runs at ~20 FPS when live aircraft layer is active.
  // Moves each aircraft billboard along its track using speed/heading and elapsed time.
  // Display-only: never writes predicted position back into AircraftRecord real data.
  useEffect(() => {
    if (!liveAircraftLayerActive || !viewerReady) {
      if (drRafRef.current) {
        cancelAnimationFrame(drRafRef.current);
        drRafRef.current = 0;
      }
      return;
    }

    const DR_MAX_SECS = 10;
    const KNOTS_TO_MPS = 0.514444;
    const FPM_TO_MPS = 0.00508;
    let lastFrameMs = 0;
    const FRAME_INTERVAL = 50; // ~20 FPS

    function drFrame(ts: number) {
      drRafRef.current = requestAnimationFrame(drFrame);
      if (ts - lastFrameMs < FRAME_INTERVAL) return;
      lastFrameMs = ts;

      const coll = aircraftCollectionRef.current;
      const map = aircraftMapRef.current;
      if (!coll || map.size === 0) return;

      const nowMs = Date.now();
      let moved = 0;

      for (const [, rec] of map) {
        if (rec.onGround) continue;
        if (!isFinite(rec.trackDeg) || rec.speedKt <= 0) continue;

        const elapsedSecs = Math.min(DR_MAX_SECS, (nowMs - rec.currTime) / 1000);
        if (elapsedSecs <= 0) continue;

        // Compute dead-reckoned position from currPos along trackDeg.
        const distM = rec.speedKt * KNOTS_TO_MPS * elapsedSecs;
        const trackRad = (rec.trackDeg * Math.PI) / 180;
        const cart = rec.currPos;
        const lon = Math.atan2(cart.y, cart.x);
        const lat = Math.atan2(cart.z, Math.sqrt(cart.x * cart.x + cart.y * cart.y));
        const R = 6371000;
        const dLat = (distM * Math.cos(trackRad)) / R;
        const dLon = (distM * Math.sin(trackRad)) / (R * Math.cos(lat));
        const newLat = lat + dLat;
        const newLon = lon + dLon;
        const altM = rec.currAltM;
        const drAlt = Math.max(0, altM + rec.verticalRateFpm * FPM_TO_MPS * elapsedSecs);

        const drPos = Cartesian3.fromRadians(newLon, newLat, drAlt);
        if (rec.billboard.show !== false) {
          rec.billboard.position = drPos;
          moved++;
        }
      }

      if (moved > 0) {
        viewerRef.current?.scene.requestRender();
      }
    }

    drRafRef.current = requestAnimationFrame(drFrame);
    return () => {
      if (drRafRef.current) {
        cancelAnimationFrame(drRafRef.current);
        drRafRef.current = 0;
      }
    };
  }, [liveAircraftLayerActive, viewerReady]);

  return { updateAircraftVisualMode };
}
