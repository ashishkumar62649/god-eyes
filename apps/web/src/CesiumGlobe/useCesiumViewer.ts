/**
 * useCesiumViewer.ts — Wave 4 CesiumGlobe split (W4-H)
 *
 * Cesium viewer lifecycle hook. Owns:
 *
 *   1. **Token bootstrap** — `setupCesiumToken()` at mount; sets
 *      the `tokenMissing` state when the Cesium Ion access token
 *      is absent.
 *   2. **Viewer construction** — `new Viewer(...)` with the
 *      `createViewerOptions()` UI flags; `configureViewerScene(...)`
 *      to enable depth-test-against-terrain, clamp zoom distance,
 *      etc.
 *   3. **Data source allocation** — five `CustomDataSource`s
 *      (`aviation`, `airport-layout`, `earth-events`,
 *      `energy-infrastructure`, `space-satellites`) added to
 *      `viewer.dataSources`.
 *   4. **Primitive allocation** — two scene primitives:
 *      `BillboardCollection` (Layer 01 live aircraft) and
 *      `PointPrimitiveCollection` (Layer 05 satellite dots).
 *   5. **Camera listeners** — `camera.changed` and
 *      `camera.moveEnd`. Each handler updates `cameraHeightRef`
 *      (so the W4-G aircraft visual-mode switch can read it),
 *      calls `filterVisibleGlobalDots(...)` for cache occlusion,
 *      and invokes the W4-G `updateAircraftVisualMode()`.
 *   6. **Picking registration** — `new ScreenSpaceEventHandler(...)`
 *      over the canvas, registered with the W4-F
 *      `createPickClickHandler(...)` factory.
 *   7. **FPS counter** — `startFpsCounter(viewer)` from
 *      `globe/useFpsCounter` (declared in the orchestrator so
 *      `fpsRef` is shared with the W4-E cache hook for `emitStats`).
 *   8. **Cleanup ordering** — `stopFpsCounter`, remove camera
 *      listeners, remove borders primitive, destroy viewer,
 *      null all primitive/data-source refs, clear the aircraft
 *      map. Cleanup never touches `applyRafRef` / `drRafRef`
 *      (those are owned by W4-G's renderer hook).
 *
 * Picking contract
 * ----------------
 * Picking registration goes through the W4-F
 * `createPickClickHandler(...)` factory. The W4-B
 * picking-contract test remains green.
 *
 * rAF cleanup ownership
 * ---------------------
 * The viewer hook does NOT cancel `applyRafRef` or `drRafRef`
 * (those are owned by the W4-G `useLiveAircraftRenderer` hook).
 * This avoids the double-cancel scenario the W4-G brief warned
 * about. W4-G's effect cleanups run on React unmount; the viewer
 * hook's cleanup also runs on unmount; together they ensure
 * clean teardown with exactly one owner of each rAF.
 *
 * Cross-hook contract
 * -------------------
 * - W4-D `useCameraBboxReporter` reads `viewerRef.current` and
 *   `viewerReady` — both still owned by the orchestrator, both
 *   populated correctly by this hook's `try`-block body.
 * - W4-E `useResidentAviationCache` reads `globalDotCollectionRef`,
 *   `aviationFiltersRef`, `aviationLayerActive`, `viewerRef`,
 *   `viewerReady`, etc. — all still owned by the orchestrator,
 *   all populated correctly.
 * - W4-G `useLiveAircraftRenderer` reads `aircraftCollectionRef`,
 *   `aircraftMapRef`, `viewerRef`, `viewerReady`,
 *   `liveAircraftLayerActive`, etc. — all still owned by the
 *   orchestrator.
 */

import { useEffect } from 'react';
import type {
  Dispatch,
  MutableRefObject,
  RefObject,
  SetStateAction,
} from 'react';
import {
  BillboardCollection,
  CustomDataSource,
  PointPrimitiveCollection,
  PolylineCollection,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Viewer,
} from 'cesium';

import { setupCesiumToken } from '../globe/setupCesiumToken';
import { configureViewerScene } from '../globe/configureViewerScene';
import { createViewerOptions } from '../globe/viewerOptions';

import type { AircraftLatest, EarthEvent } from '@god-eyes/contracts';
import type { EnergyFeature } from '../layers/layer_10_energy_infrastructure/infrastructure/energyInfrastructureTypes';
import type { NewsRenderMarker } from '../layers/layer_08_news_osint/newsTypes';
import type { SatelliteFrontendItem } from '../layers/layer_05_space_satellites/satellites/satelliteTypes';
import type { WeatherRenderItem } from '../layers/layer_07_weather/weatherTypes';
import type { AviationFilters } from '../layers/layer_01_aviation/airports/aviationCategories';

import { filterVisibleGlobalDots } from '../layers/layer_01_aviation/airports/aviationGlobalRenderer';

import { createPickClickHandler } from './picking';
import type { AircraftRecord } from './types';

export interface UseCesiumViewerParams {
  /** DOM container ref the Viewer mounts into. */
  containerRef: RefObject<HTMLDivElement | null>;

  /** Live Cesium Viewer ref (null before init / after destroy). */
  viewerRef: MutableRefObject<Viewer | null>;
  /** Mirror of `viewerReady` for callers that read refs rather than state. */
  viewerReadyRef: MutableRefObject<boolean>;
  /** React state setter for `viewerReady`. */
  setViewerReady: Dispatch<SetStateAction<boolean>>;
  /** React state setter for the Cesium-init error message. */
  setError: Dispatch<SetStateAction<string | null>>;
  /** React state setter for the missing-token indicator. */
  setTokenMissing: Dispatch<SetStateAction<boolean>>;

  /** Latest known camera height (updated by the camera listeners). */
  cameraHeightRef: MutableRefObject<number>;
  /** Ref mirror of `aviationFilters` (used by the camera listener's occlusion update). */
  aviationFiltersRef: MutableRefObject<AviationFilters>;

  /** Aviation Layer 01 / 09 / 10 / 05 data source refs. */
  aviationDataSourceRef: MutableRefObject<CustomDataSource | null>;
  layoutDataSourceRef: MutableRefObject<CustomDataSource | null>;
  earthEventsDataSourceRef: MutableRefObject<CustomDataSource | null>;
  energyInfrastructureDataSourceRef: MutableRefObject<CustomDataSource | null>;
  satelliteEntityDataSourceRef: MutableRefObject<CustomDataSource | null>;

  /** Aviation live-aircraft billboard + satellite dot primitive refs. */
  aircraftCollectionRef: MutableRefObject<BillboardCollection | null>;
  satelliteDotCollectionRef: MutableRefObject<PointPrimitiveCollection | null>;

  /** W4-E cache dot collection (used by the camera listener's occlusion update). */
  globalDotCollectionRef: MutableRefObject<PointPrimitiveCollection | null>;

  /**
   * Borders Layer 02 primitive ref. The viewer-init effect's
   * cleanup removes this from `viewer.scene.primitives` if present.
   */
  bordersDataSourceRef: MutableRefObject<PolylineCollection | null>;

  /**
   * Aircraft Map (`Map<sourceObjectId, AircraftRecord>`). Cleared
   * in cleanup so JS-side refs to the now-destroyed Cesium
   * `Billboard` instances can be GC'd.
   */
  aircraftMapRef: MutableRefObject<Map<string, AircraftRecord>>;

  /**
   * FPS counter start function (from `globe/useFpsCounter`).
   * Declared in the orchestrator so the `fpsRef` it owns is shared
   * with the W4-E `useResidentAviationCache` hook for `emitStats`.
   */
  startFpsCounter: (viewer: Viewer) => () => void;

  /** W4-G visual-mode refresh function (icon vs dot on camera height change). */
  updateAircraftVisualMode: () => void;

  // ───── picking-handler parameters (W4-F) ─────────────────────────
  /** `onObjectSelect` prop ref (callable callback). */
  onObjectSelectRef: MutableRefObject<(obj: unknown) => void>;
  /** React state setter for the selected live aircraft overlay. */
  setSelectedAircraft: (ac: AircraftLatest | null) => void;
  /** React state setter for the selected earthquake overlay. */
  setSelectedEarthquake: (e: EarthEvent | null) => void;
  /** React state setter for the selected satellite overlay. */
  setSelectedSatellite: (s: SatelliteFrontendItem | null) => void;
  /** `onWeatherSelect` prop ref (may be undefined). */
  onWeatherSelectRef: MutableRefObject<
    ((item: WeatherRenderItem | null) => void) | undefined
  >;
  /** `onNewsSelect` prop ref (may be undefined). */
  onNewsSelectRef: MutableRefObject<
    ((item: NewsRenderMarker | null) => void) | undefined
  >;
  /** `onEnergyFeatureSelect` prop callback (may be undefined). */
  onEnergyFeatureSelect?: (feature: EnergyFeature | null) => void;
}

/**
 * Cesium viewer lifecycle hook.
 *
 * Owns viewer creation, scene configuration, data source /
 * primitive allocation, FPS counter lifecycle, camera listeners,
 * picking registration, and cleanup ordering. Does not own
 * `applyRafRef` / `drRafRef` (those are W4-G's responsibility).
 *
 * Behavior is bit-for-bit identical to the inline viewer-init
 * `useEffect` it replaces in `apps/web/src/CesiumGlobe/index.tsx`
 * (formerly at lines 209-337 of the pre-W4-H orchestrator).
 */
export function useCesiumViewer(params: UseCesiumViewerParams): void {
  const {
    containerRef,
    viewerRef,
    viewerReadyRef,
    setViewerReady,
    setError,
    setTokenMissing,
    cameraHeightRef,
    aviationFiltersRef,
    aviationDataSourceRef,
    layoutDataSourceRef,
    earthEventsDataSourceRef,
    energyInfrastructureDataSourceRef,
    satelliteEntityDataSourceRef,
    aircraftCollectionRef,
    satelliteDotCollectionRef,
    globalDotCollectionRef,
    bordersDataSourceRef,
    aircraftMapRef,
    startFpsCounter,
    updateAircraftVisualMode,
    onObjectSelectRef,
    setSelectedAircraft,
    setSelectedEarthquake,
    setSelectedSatellite,
    onWeatherSelectRef,
    onNewsSelectRef,
    onEnergyFeatureSelect,
  } = params;

  useEffect(() => {
    if (!setupCesiumToken()) {
      setTokenMissing(true);
    }

    if (!containerRef.current) return;

    let viewer: Viewer | undefined;
    let stopFpsCounterFn: (() => void) | undefined;
    let moveEndHandler: (() => void) | undefined;
    let changedHandler: (() => void) | undefined;

    try {
      viewer = new Viewer(containerRef.current, createViewerOptions());
      configureViewerScene(viewer);

      viewerRef.current = viewer;
      viewerReadyRef.current = true;
      setViewerReady(true);

      const dataSource = new CustomDataSource('aviation');
      aviationDataSourceRef.current = dataSource;
      viewer.dataSources.add(dataSource);

      const layoutDataSource = new CustomDataSource('airport-layout');
      layoutDataSourceRef.current = layoutDataSource;
      viewer.dataSources.add(layoutDataSource);

      const earthEventsDataSource = new CustomDataSource('earth-events');
      earthEventsDataSourceRef.current = earthEventsDataSource;
      viewer.dataSources.add(earthEventsDataSource);

      const aircraftCollection = new BillboardCollection({ scene: viewer.scene });
      viewer.scene.primitives.add(aircraftCollection);
      aircraftCollectionRef.current = aircraftCollection;

      // Layer 05: satellite dot collection + entity data source for triangles
      const satDotCollection = new PointPrimitiveCollection();
      viewer.scene.primitives.add(satDotCollection);
      satelliteDotCollectionRef.current = satDotCollection;

      const satEntityDs = new CustomDataSource('space-satellites');
      satelliteEntityDataSourceRef.current = satEntityDs;
      viewer.dataSources.add(satEntityDs);

      // Layer 10: energy infrastructure data source
      const energyInfrastructureDataSource = new CustomDataSource(
        'energy-infrastructure',
      );
      energyInfrastructureDataSourceRef.current = energyInfrastructureDataSource;
      viewer.dataSources.add(energyInfrastructureDataSource);

      stopFpsCounterFn = startFpsCounter(viewer);

      // Camera changed — debounced occlusion update only, NO data fetching
      changedHandler = () => {
        if (viewerRef.current) {
          const height = viewerRef.current.camera.positionCartographic.height;
          cameraHeightRef.current = height;
          if (globalDotCollectionRef.current) {
            filterVisibleGlobalDots(
              globalDotCollectionRef.current,
              viewerRef.current.scene,
              aviationFiltersRef.current,
            );
          }
          updateAircraftVisualMode();
        }
      };

      // Camera moveEnd — NO data fetching, just update occlusion
      moveEndHandler = () => {
        if (viewerRef.current) {
          const height = viewerRef.current.camera.positionCartographic.height;
          cameraHeightRef.current = height;
          if (globalDotCollectionRef.current) {
            filterVisibleGlobalDots(
              globalDotCollectionRef.current,
              viewerRef.current.scene,
              aviationFiltersRef.current,
            );
          }
          updateAircraftVisualMode();
        }
      };

      viewer.camera.percentageChanged = 0.05;
      viewer.camera.changed.addEventListener(changedHandler);
      viewer.camera.moveEnd.addEventListener(moveEndHandler);

      // Click handler — branch logic lives in apps/web/src/CesiumGlobe/picking.ts
      // (W4-F). The ScreenSpaceEventHandler lifetime is bound to the
      // viewer (implicit cleanup via viewer.destroy() in the effect
      // cleanup below).
      const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction(
        createPickClickHandler({
          viewer,
          onObjectSelectRef,
          setSelectedAircraft,
          setSelectedEarthquake,
          setSelectedSatellite,
          onWeatherSelectRef,
          onNewsSelectRef,
          onEnergyFeatureSelect,
        }),
        ScreenSpaceEventType.LEFT_CLICK,
      );
    } catch (err) {
      console.error('Cesium failed to initialize:', err);
      setError(err instanceof Error ? err.message : String(err));
    }

    return () => {
      if (typeof stopFpsCounterFn !== 'undefined') stopFpsCounterFn();
      if (typeof changedHandler !== 'undefined' && viewer) {
        viewer.camera.changed.removeEventListener(changedHandler);
      }
      if (typeof moveEndHandler !== 'undefined' && viewer) {
        viewer.camera.moveEnd.removeEventListener(moveEndHandler);
      }
      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy();
        viewerRef.current = null;
        viewerReadyRef.current = false;
      }
      // applyRafRef and drRafRef cleanup now lives in
      // useLiveAircraftRenderer's own effect cleanups (W4-G).
      aircraftMapRef.current.clear();
      aircraftCollectionRef.current = null;
      if (bordersDataSourceRef.current && viewerRef.current) {
        viewerRef.current.scene.primitives.remove(bordersDataSourceRef.current);
      }
      bordersDataSourceRef.current = null;
    };
  }, [
    containerRef,
    viewerRef,
    viewerReadyRef,
    setViewerReady,
    setError,
    setTokenMissing,
    cameraHeightRef,
    aviationFiltersRef,
    aviationDataSourceRef,
    layoutDataSourceRef,
    earthEventsDataSourceRef,
    energyInfrastructureDataSourceRef,
    satelliteEntityDataSourceRef,
    aircraftCollectionRef,
    satelliteDotCollectionRef,
    globalDotCollectionRef,
    bordersDataSourceRef,
    aircraftMapRef,
    startFpsCounter,
    updateAircraftVisualMode,
    onObjectSelectRef,
    setSelectedAircraft,
    setSelectedEarthquake,
    setSelectedSatellite,
    onWeatherSelectRef,
    onNewsSelectRef,
    onEnergyFeatureSelect,
  ]);
}
