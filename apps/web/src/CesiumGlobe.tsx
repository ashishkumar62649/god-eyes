import React, { useEffect, useRef, useState } from 'react';
import {
  Viewer,
  Ion,
  Cartesian2,
  Cartesian3,
  Color,
  Entity,
  PolylineGraphics,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  CustomDataSource,
  PointPrimitiveCollection,
  SceneTransforms,
  ConstantProperty,
  PointGraphics,
  ConstantPositionProperty,
  PolylineCollection,
  Material,
  BillboardCollection,
  CallbackProperty,
  JulianDate,
} from 'cesium';
import "cesium/Build/Cesium/Widgets/widgets.css";
import AirportMapPopup from './components/intel/AirportMapPopup';
import type { AirportObject, EarthEvent, BordersBoundariesFeatureCollection, AircraftLatest } from '@god-eyes/contracts';
import type { AirportLayoutFeaturesResponse } from './lib/airportLayoutTypes';

import {
  fetchAllAviationCategories,
} from './lib/aviationPreloader';
import { isPositionVisible } from './lib/cesiumVisibility';
import {
  getAircraftArrowSprite,
  getAircraftDotSprite,
  getAircraftColor,
  getAircraftHeadingDeg,
  headingToBillboardRotation,
  AIRCRAFT_BILLBOARD_SCALE,
} from './lib/aircraftMarker';
import { RENDER_CAP } from './lib/useLiveAircraftSocket';
import type { SnapshotCallback } from './lib/useLiveAircraftSocket';
import {
  AviationFilters,
} from './lib/aviationCategories';
import {
  createGlobalDotCollection,
  addAllDotsToCollection,
  isGlobalDot,
  getGlobalDotPosition,
  filterVisibleGlobalDots,
} from './lib/aviationGlobalRenderer';
import {
  getAllObjects,
} from './lib/aviationObjectStore';

interface AviationStats {
  loaded: number;
  visible: number;
  clustersActive: boolean;
  renderMode: string;
  fps: number;
  cacheEntries?: number;
  cacheHits?: number;
  cacheMisses?: number;
  inflight?: number;
  preloadStatus?: string;
  categoryCounts?: Record<string, number>;
}

interface CesiumGlobeProps {
  aviationLayerActive: boolean;
  onObjectSelect: (obj: unknown) => void;
  onAviationStatsChange?: (stats: AviationStats) => void;
  cameraTarget?: {
    position: { latitude: number; longitude: number };
    type: string;
    timestamp: number;
  } | null;
  aviationFilters: AviationFilters;
  selectedAirport?: AirportObject | null;
  layoutFeatures?: AirportLayoutFeaturesResponse | null;
  earthEvents?: EarthEvent[];
  bordersData?: BordersBoundariesFeatureCollection | null;
  /** Callback ref: called by useLiveAircraft with each new snapshot (no React re-render). */
  onAircraftSnapshot?: SnapshotCallback;
  onAircraftDelta?: (upsert: AircraftLatest[], removes: string[]) => void;
  /** Ref CesiumGlobe populates with the actual snapshot renderer function. */
  onSnapshotCbRef?: React.MutableRefObject<SnapshotCallback | undefined>;
  /** Ref CesiumGlobe populates with the actual delta renderer function. */
  onDeltaCbRef?: React.MutableRefObject<((upsert: AircraftLatest[], removes: string[]) => void) | undefined>;
  /** Called by the renderer to report rendered count back to the hook/status. */
  onAircraftRendered?: (count: number) => void;
  liveAircraftLayerActive?: boolean;
  /** Returns current camera bbox as [minLon,minLat,maxLon,maxLat], or null for global fallback. */
  onGetBbox?: () => [number, number, number, number] | null;
  /** Ref that CesiumGlobe populates with its bbox getter (for WS bbox updates). */
  onGetBboxRef?: React.MutableRefObject<(() => [number, number, number, number] | null) | undefined>;
}

const CesiumGlobe: React.FC<CesiumGlobeProps> = ({
  aviationLayerActive,
  onObjectSelect,
  onAviationStatsChange,
  cameraTarget,
  aviationFilters,
  selectedAirport,
  layoutFeatures,
  earthEvents,
  bordersData,
  onAircraftSnapshot,
  onAircraftDelta,
  onSnapshotCbRef,
  onDeltaCbRef,
  onAircraftRendered,
  liveAircraftLayerActive,
  onGetBbox,
  onGetBboxRef,
}) => {

  /**
   * Returns the target fly-to height for an airport overview.
   * - Stays at current height if already closer than the target (no zoom-out).
   * - Target: 12 000 m — frames a typical airport/runway area without going to city level.
   */
  function airportFlyHeight(currentHeight?: number): number {
    const TARGET = 12_000; // metres — whole airport visible, not city/state level
    if (currentHeight !== undefined && currentHeight < TARGET) {
      return currentHeight; // already close — don't zoom out
    }
    return TARGET;
  }
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const viewerReadyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenMissing, setTokenMissing] = useState(false);
  const [viewerReady, setViewerReady] = useState(false);
  const aviationDataSourceRef = useRef<CustomDataSource | null>(null);
  const layoutDataSourceRef = useRef<CustomDataSource | null>(null);
  const earthEventsDataSourceRef = useRef<CustomDataSource | null>(null);
  const aircraftCollectionRef = useRef<BillboardCollection | null>(null);
  // Per-aircraft record: billboard index + positions for interpolation + DR fields.
  interface AircraftRecord {
    idx: number;
    prevPos: Cartesian3;
    currPos: Cartesian3;
    prevTime: number;
    currTime: number;
    staleAfter: number;
    // Dead reckoning fields (display-only, never written back as real data).
    speedKt: number;       // 0 = unknown/ground
    trackDeg: number;      // NaN = unknown
    verticalRateFpm: number; // 0 = unknown
    onGround: boolean;
  }
  const aircraftMapRef = useRef<Map<string, AircraftRecord>>(new Map());
  // Pending snapshot waiting to be applied in chunks.
  const pendingSnapshotRef = useRef<AircraftLatest[] | null>(null);
  // Apply-guard: true while a chunked rAF apply loop is running.
  const applyingRef = useRef(false);
  // rAF handle for the apply loop.
  const applyRafRef = useRef<number>(0);
  // Refs for new props (stable across renders).
  const onAircraftSnapshotRef = useRef(onAircraftSnapshot);
  const onAircraftDeltaRef = useRef(onAircraftDelta);
  const onAircraftRenderedRef = useRef(onAircraftRendered);
  const onGetBboxRef2 = useRef(onGetBbox);
  // Dead reckoning animation rAF handle.
  const drRafRef = useRef<number>(0);
  const bordersDataSourceRef = useRef<PolylineCollection | null>(null);
  const globalDotCollectionRef = useRef<PointPrimitiveCollection | null>(null);
  const onObjectSelectRef = useRef(onObjectSelect);
  const onStatsChangeRef = useRef(onAviationStatsChange);
  const aviationLayerActiveRef = useRef(aviationLayerActive);
  const aviationFiltersRef = useRef(aviationFilters);
  const cameraHeightRef = useRef(20000000);

  const fpsRef = useRef<number>(0);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Popup screen-space position tracking
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);
  const selectedAirportRef = useRef(selectedAirport);

  // Selected earthquake for minimal info overlay
  const [selectedEarthquake, setSelectedEarthquake] = useState<EarthEvent | null>(null);

  // Selected live aircraft for minimal info overlay (WO-079E)
  const [selectedAircraft, setSelectedAircraft] = useState<AircraftLatest | null>(null);

  // Resident cache mode
  const residentCacheActiveRef = useRef(false);
  const preloadingRef = useRef(false);
  const dotsCreatedRef = useRef(false);

  // Sync prop refs after every render so async callbacks always see current props
  useEffect(() => {
    onObjectSelectRef.current = onObjectSelect;
    onStatsChangeRef.current = onAviationStatsChange;
    aviationLayerActiveRef.current = aviationLayerActive;
    aviationFiltersRef.current = aviationFilters;
    selectedAirportRef.current = selectedAirport ?? null;
    onAircraftSnapshotRef.current = onAircraftSnapshot;
    onAircraftDeltaRef.current = onAircraftDelta;
    onAircraftRenderedRef.current = onAircraftRendered;
    onGetBboxRef2.current = onGetBbox;
    // Populate the external bbox ref so App.tsx can forward bbox to WS.
    if (onGetBboxRef) onGetBboxRef.current = onGetBbox;
  });

  // Track selected airport screen-space position on every post-render frame
  useEffect(() => {
    if (!selectedAirport || !viewerRef.current) {
      setPopupPos(null);
      return;
    }
    const lat = selectedAirport.position?.latitude;
    const lon = selectedAirport.position?.longitude;
    if (lat == null || lon == null) {
      setPopupPos(null);
      return;
    }

    const viewer = viewerRef.current;
    const worldPos = Cartesian3.fromDegrees(lon, lat, 0);

    function updatePos() {
      if (!viewerRef.current) return;
      const screenPos = SceneTransforms.worldToWindowCoordinates(
        viewerRef.current.scene,
        worldPos,
        new Cartesian2(),
      );
      if (screenPos) {
        setPopupPos({ x: Math.round(screenPos.x), y: Math.round(screenPos.y) });
      } else {
        setPopupPos(null);
      }
    }

    // Initial position
    updatePos();

    // Update on every post-render (camera move, zoom, etc.)
    const removeListener = viewer.scene.postRender.addEventListener(updatePos);
    return () => removeListener();
  }, [selectedAirport?.id, viewerReady]);

  function emitStats(
    renderMode: string,
    preloadStatus?: string,
    categoryCounts?: Record<string, number>,
  ): void {
    const allObjects = getAllObjects();
    const visibleCount = globalDotCollectionRef.current?.length ?? 0;
    console.log('[AVIATION] emitStats:', renderMode, preloadStatus, 'loaded:', allObjects.length, 'visible:', visibleCount);
    onStatsChangeRef.current?.({
      loaded: allObjects.length,
      visible: visibleCount,
      clustersActive: false,
      renderMode,
      fps: fpsRef.current,
      preloadStatus,
      categoryCounts,
    });
  }

  function applyFiltersToDots(): void {
    if (globalDotCollectionRef.current && viewerRef.current) {
      const filters = aviationFiltersRef.current;
      filterVisibleGlobalDots(globalDotCollectionRef.current, viewerRef.current.scene, filters);
      const allObjects = getAllObjects();
      let visibleCount = 0;
      const length = globalDotCollectionRef.current.length;
      for (let i = 0; i < length; i++) {
        const p = globalDotCollectionRef.current.get(i);
        if (p && p.show) visibleCount++;
      }
      onStatsChangeRef.current?.({
        loaded: allObjects.length,
        visible: visibleCount,
        clustersActive: false,
        renderMode: 'RESIDENT_GLOBAL',
        fps: fpsRef.current,
        preloadStatus: residentCacheActiveRef.current ? 'CACHE_READY' : undefined,
      });
    }
  }

  async function startResidentPreload(): Promise<void> {
    // 1. If cache already active, return immediately
    if (residentCacheActiveRef.current) {
      return;
    }

    // 2. If viewer not ready, return WITHOUT setting preloadingRef
    // The viewerReady retry effect will handle this case
    if (!viewerRef.current) {
      return;
    }

    // 3. If already preloading, return
    if (preloadingRef.current) {
      return;
    }

    // 4. Only set flag AFTER we've passed all checks and are ready to start
    preloadingRef.current = true;

    const viewer = viewerRef.current;
    let collection = globalDotCollectionRef.current;
    if (!collection) {
      collection = createGlobalDotCollection(viewer.scene);
      globalDotCollectionRef.current = collection;
    }

    const ac = new AbortController();
    abortControllerRef.current = ac;

    emitStats('RESIDENT_GLOBAL', 'PRELOAD_STARTED');

    const categoryCounts: Record<string, number> = {};

    try {
      await fetchAllAviationCategories(ac.signal, (batch, progress) => {
        if (ac.signal.aborted) return;

        if (batch.length > 0) {
          addAllDotsToCollection(collection!, batch);
          dotsCreatedRef.current = true;
        }

        categoryCounts[progress.category] = progress.categoryCount;

        if (progress.allDone) {
          residentCacheActiveRef.current = true;
          emitStats('RESIDENT_GLOBAL', 'CACHE_READY', categoryCounts);
          applyFiltersToDots();
        } else {
          emitStats(
            'RESIDENT_GLOBAL',
            `LOADING:${progress.displayLabel}(${progress.categoryCount})`,
            categoryCounts,
          );
        }
      });
    } catch (err) {
      console.error('Preload error:', err);
      emitStats('RESIDENT_GLOBAL', 'ERROR: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      // Always clear preloadingRef so retry can happen if needed
      preloadingRef.current = false;
    }

    if (ac.signal.aborted) return;

    residentCacheActiveRef.current = true;
    emitStats('RESIDENT_GLOBAL', 'CACHE_READY', categoryCounts);
    applyFiltersToDots();
  }

  // Viewer initialization
  useEffect(() => {
    console.log('[AVIATION] viewer init useEffect');
    const token = import.meta.env.VITE_CESIUM_ION_ACCESS_TOKEN;

    if (!token || token === 'replace_with_your_cesium_ion_token') {
      console.warn('Cesium Ion access token is missing. Some features may not work.');
      setTokenMissing(true);
    } else {
      Ion.defaultAccessToken = token;
    }

    if (!containerRef.current) return;

    let viewer: Viewer | undefined;
    let fpsInterval: ReturnType<typeof setInterval> | undefined;
    let fpsPostRender: (() => void) | undefined;
    let moveEndHandler: (() => void) | undefined;
    let changedHandler: (() => void) | undefined;

    try {
      viewer = new Viewer(containerRef.current, {
        terrainProvider: undefined,
        animation: false,
        timeline: false,
        fullscreenButton: false,
        baseLayerPicker: true,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        sceneModePicker: false,
        selectionIndicator: false,
        navigationHelpButton: false,
      });

      viewer.scene.debugShowFramesPerSecond = false;
      viewer.scene.globe.depthTestAgainstTerrain = true;

      const cameraController = viewer.scene.screenSpaceCameraController;
      cameraController.inertiaZoom = 0;
      cameraController.maximumMovementRatio = 0.1;
      cameraController.minimumZoomDistance = 100;
      cameraController.maximumZoomDistance = 50000000;

      viewerRef.current = viewer;
      viewerReadyRef.current = true;
      setViewerReady(true);
      console.log('[AVIATION] viewer ready, viewerRef.current set');

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

      // FPS tracking
      let fpsFrameCount = 0;
      let fpsLastUpdate = performance.now();
      fpsPostRender = viewer.scene.postRender.addEventListener(() => {
        fpsFrameCount++;
      });
      fpsInterval = setInterval(() => {
        const now = performance.now();
        const delta = now - fpsLastUpdate;
        if (delta > 0) {
          fpsRef.current = Math.round(fpsFrameCount / (delta / 1000));
        }
        fpsFrameCount = 0;
        fpsLastUpdate = now;
      }, 1000);

      // Camera changed — debounced occlusion update only, NO data fetching
      changedHandler = () => {
        if (globalDotCollectionRef.current && viewerRef.current) {
          const height = viewerRef.current.camera.positionCartographic.height;
          cameraHeightRef.current = height;
          filterVisibleGlobalDots(globalDotCollectionRef.current, viewerRef.current.scene, aviationFiltersRef.current);
        }
      };

      // Camera moveEnd — NO data fetching, just update occlusion
      moveEndHandler = () => {
        if (globalDotCollectionRef.current && viewerRef.current) {
          const height = viewerRef.current.camera.positionCartographic.height;
          cameraHeightRef.current = height;
          filterVisibleGlobalDots(globalDotCollectionRef.current, viewerRef.current.scene, aviationFiltersRef.current);
        }
      };

      viewer.camera.percentageChanged = 0.05;
      viewer.camera.changed.addEventListener(changedHandler);
      viewer.camera.moveEnd.addEventListener(moveEndHandler);

      // Click handler
      const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((click: { position: Cartesian2 }) => {
        const pickedObject = viewer!.scene.pick(click.position);
        if (!pickedObject || !pickedObject.id) {
          onObjectSelectRef.current(null);
          return;
        }

        // Global dot click → fly to coordinate
        if (isGlobalDot(pickedObject)) {
          const pos = getGlobalDotPosition(pickedObject);
          if (pos) {
            // Look up the airport from resident cache
            const airportId = pickedObject.id.airportId;
            const allObjects = getAllObjects();
            const airport = allObjects.find(a => a.id === airportId);
            if (airport) {
              onObjectSelectRef.current(airport);
            }
            viewer!.camera.flyTo({
              destination: Cartesian3.fromDegrees(pos.longitude, pos.latitude,
                airportFlyHeight(viewer!.camera.positionCartographic.height)),
              duration: 1.0,
            });
          }
          return;
        }

        if (!(pickedObject.id instanceof Entity)) {
          // Check if it's a live aircraft billboard pick.
          if (pickedObject.id && typeof pickedObject.id === 'object' && (pickedObject.id as any)._aircraftData) {
            const ac = (pickedObject.id as any)._aircraftData as AircraftLatest;
            const pos = Cartesian3.fromDegrees(ac.lon!, ac.lat!, 0);
            if (isPositionVisible(viewer!, pos)) {
              setSelectedAircraft(ac);
            }
          } else {
            onObjectSelectRef.current(null);
          }
          return;
        }

        const entity = pickedObject.id;
        const position = entity.position?.getValue(viewer!.clock.currentTime);
        if (position && !isPositionVisible(viewer!, position)) {
          onObjectSelectRef.current(null);
          return;
        }

        // Earthquake entity click
        if (entity.properties && entity.properties.earthquakeData) {
          setSelectedEarthquake(entity.properties.earthquakeData.getValue() as EarthEvent);
          return;
        }

        if (entity.properties && entity.properties.rawData) {
          onObjectSelectRef.current(entity.properties.rawData.getValue());
        }
      }, ScreenSpaceEventType.LEFT_CLICK);
    } catch (err) {
      console.error('Cesium failed to initialize:', err);
      setError(err instanceof Error ? err.message : String(err));
    }

    return () => {
      if (typeof fpsInterval !== 'undefined') clearInterval(fpsInterval);
      if (typeof fpsPostRender !== 'undefined') fpsPostRender();
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
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (applyRafRef.current) cancelAnimationFrame(applyRafRef.current);
      if (drRafRef.current) cancelAnimationFrame(drRafRef.current);
      aircraftMapRef.current.clear();
      aircraftCollectionRef.current = null;
      if (bordersDataSourceRef.current && viewerRef.current) {
        viewerRef.current.scene.primitives.remove(bordersDataSourceRef.current);
      }
      bordersDataSourceRef.current = null;
    };
  }, []);

  // Layer ON/OFF handling
  useEffect(() => {
    if (!aviationLayerActive) {
      // Layer OFF: hide dots but KEEP resident cache in memory
      if (globalDotCollectionRef.current) {
        globalDotCollectionRef.current.removeAll();
        dotsCreatedRef.current = false;
      }
      // Reset preload state so toggle can restart
      preloadingRef.current = false;
      emitStats('RESIDENT_GLOBAL', residentCacheActiveRef.current ? 'CACHE_READY (HIDDEN)' : 'IDLE');
    } else if (viewerRef.current) {
      // Layer ON: start preload if not already cached, otherwise reuse cache
      if (residentCacheActiveRef.current && getAllObjects().length > 0) {
        // Reuse existing cache — recreate dots from cached objects
        if (!dotsCreatedRef.current) {
          let collection = globalDotCollectionRef.current;
          if (!collection) {
            collection = createGlobalDotCollection(viewerRef.current.scene);
            globalDotCollectionRef.current = collection;
          }
          const allObjects = getAllObjects();
          addAllDotsToCollection(collection, allObjects);
          dotsCreatedRef.current = true;
        }
        emitStats('RESIDENT_GLOBAL', 'CACHE_READY');
        applyFiltersToDots();
      } else if (!preloadingRef.current) {
        startResidentPreload();
      }
    }
  }, [aviationLayerActive]);

  // Retry preload when viewer becomes ready while aviation layer is active
  useEffect(() => {
    if (!viewerReady) return;
    if (!aviationLayerActiveRef.current) return;
    if (residentCacheActiveRef.current) return;
    if (preloadingRef.current) return;
    startResidentPreload();
  }, [viewerReady]);

  // Filter change handling — only update visibility, NO data fetching
  useEffect(() => {
    if (!aviationLayerActive || !residentCacheActiveRef.current) return;
    applyFiltersToDots();
  }, [aviationFilters, aviationLayerActive]);

  // Camera fly-to when a search result is selected
  useEffect(() => {
    if (!cameraTarget) return;
    const { latitude, longitude } = cameraTarget.position;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      console.warn('[SEARCH FLYTO] missing coordinates, skipping fly-to', cameraTarget);
      return;
    }
    const doFly = () => {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed()) {
        console.warn('[SEARCH FLYTO] viewer not ready, queuing retry');
        // Retry once viewer is ready — the viewerReady state change will re-run this effect
        // because cameraTarget is still set. No extra state needed.
        return;
      }
      console.log('[SEARCH FLYTO] flying to', latitude, longitude);
      const currentHeight = viewer.camera.positionCartographic?.height;
      const targetHeight = airportFlyHeight(currentHeight);
      console.log('[SEARCH FLYTO] current height', Math.round(currentHeight ?? 0), 'final height', targetHeight);
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(longitude, latitude, targetHeight),
        duration: 1.5,
      });
    };
    if (viewerReadyRef.current) {
      doFly();
    } else {
      // Viewer not yet initialised — wait for it
      const id = setInterval(() => {
        if (viewerReadyRef.current) {
          clearInterval(id);
          doFly();
        }
      }, 100);
      return () => clearInterval(id);
    }
  }, [cameraTarget]);

  // Render airport layout features (runways) on the globe
  useEffect(() => {
    const ds = layoutDataSourceRef.current;
    if (!ds) return;

    // Clear previous overlay
    ds.entities.removeAll();

    if (!layoutFeatures || layoutFeatures.status !== 'ok') return;

    const runways = layoutFeatures.features.filter(
      (f) => f.featureType === 'runway' && f.geometryType === 'line' && f.geometry.type === 'LineString',
    );

    for (const feature of runways) {
      const coords = feature.geometry.coordinates as number[][];
      if (!Array.isArray(coords) || coords.length < 2) continue;

      const positions: Cartesian3[] = [];
      for (const [lon, lat] of coords) {
        if (typeof lon === 'number' && typeof lat === 'number') {
          positions.push(Cartesian3.fromDegrees(lon, lat, 0));
        }
      }
      if (positions.length < 2) continue;

      ds.entities.add(new Entity({
        id: `layout-runway-${feature.id}`,
        polyline: new PolylineGraphics({
          positions,
          width: 4,
          material: Color.fromCssColorString('#00e5ff').withAlpha(0.85),
          clampToGround: true,
        }),
      }));
    }
  }, [layoutFeatures]);

  // Render country border outlines (Borders & Boundaries layer)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    if (bordersDataSourceRef.current) {
      viewer.scene.primitives.remove(bordersDataSourceRef.current);
      bordersDataSourceRef.current = null;
    }
    if (!bordersData || bordersData.features.length === 0) return;

    const collection = new PolylineCollection();
    const borderColor = Color.fromCssColorString('#e05050').withAlpha(0.85);

    for (const feature of bordersData.features) {
      const geom = feature.geometry as { type: string; coordinates: unknown };
      if (!geom) continue;
      const rings: number[][][] =
        geom.type === 'Polygon' ? (geom.coordinates as number[][][]) :
        geom.type === 'MultiPolygon' ? (geom.coordinates as number[][][][]).flat() : [];
      for (const ring of rings) {
        if (ring.length < 2) continue;
        collection.add({
          positions: ring.map(([lon, lat]) => Cartesian3.fromDegrees(lon, lat, 0)),
          width: 1.5,
          material: Material.fromType('Color', { color: borderColor }),
        });
      }
    }

    viewer.scene.primitives.add(collection);
    bordersDataSourceRef.current = collection;
  }, [bordersData]);

  // Render earthquake events on the globe
  useEffect(() => {
    const ds = earthEventsDataSourceRef.current;
    if (!ds) return;

    ds.entities.removeAll();

    if (!earthEvents || earthEvents.length === 0) return;

    for (const event of earthEvents) {
      const [lon, lat] = event.geometry.coordinates;
      if (typeof lon !== 'number' || typeof lat !== 'number') continue;

      // Color by magnitude: green < 3, yellow 3-5, orange 5-6, red >= 6
      const mag = event.magnitude ?? 0;
      let color: Color;
      if (mag >= 6) color = Color.fromCssColorString('#ff3d00').withAlpha(0.9);
      else if (mag >= 5) color = Color.fromCssColorString('#ff9100').withAlpha(0.85);
      else if (mag >= 3) color = Color.fromCssColorString('#ffd600').withAlpha(0.8);
      else color = Color.fromCssColorString('#69f0ae').withAlpha(0.75);

      const pixelSize = Math.max(5, Math.min(18, 4 + mag * 2));

      const entity = new Entity({
        id: `earthquake-${event.id}`,
        position: new ConstantPositionProperty(Cartesian3.fromDegrees(lon, lat, 0)),
        point: new PointGraphics({
          pixelSize: new ConstantProperty(pixelSize),
          color: new ConstantProperty(color),
          outlineColor: new ConstantProperty(Color.BLACK.withAlpha(0.5)),
          outlineWidth: new ConstantProperty(1),
        }),
      });
      // Store event data for click handler
      (entity as any).properties = { earthquakeData: new ConstantProperty(event) };
      ds.entities.add(entity);
    }
  }, [earthEvents]);

  // Live aircraft renderer (WO-079H).
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
      if (!coll) { applyingRef.current = false; return; }

      const map = aircraftMapRef.current;
      const now = Date.now();
      const arrowImage: string = getAircraftArrowSprite().toDataURL();
      const dotImage: string = getAircraftDotSprite().toDataURL();

      // Build the set of valid aircraft to apply.
      const valid: AircraftLatest[] = [];
      for (const ac of snapshot) {
        if (ac.lat === null || ac.lon === null) continue;
        if (ac.staleAfter && new Date(ac.staleAfter).getTime() < now) continue;
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
          const color = getAircraftColor(ac);
          const altMeters = typeof ac.altitudeBaroFt === 'number' ? ac.altitudeBaroFt * 0.3048 : 0;
          const newPos = Cartesian3.fromDegrees(ac.lon!, ac.lat!, Math.max(0, altMeters));
          const rotation = heading !== null ? headingToBillboardRotation(heading) : 0;
          const image: string = heading !== null ? arrowImage : dotImage;
          const obsTime = new Date(ac.observedAt).getTime();
          const staleMs = ac.staleAfter ? new Date(ac.staleAfter).getTime() : 0;

          const existing = map.get(key);
          if (existing) {
            existing.prevPos = existing.currPos;
            existing.prevTime = existing.currTime;
            existing.currPos = newPos;
            existing.currTime = obsTime;
            existing.staleAfter = staleMs;
            existing.speedKt = ac.groundSpeedKt ?? 0;
            existing.trackDeg = ac.trackDeg ?? ac.headingTrueDeg ?? NaN;
            existing.verticalRateFpm = ac.verticalRateFpm ?? 0;
            existing.onGround = ac.onGround ?? false;
            // Update non-position properties directly.
            const bb = coll!.get(existing.idx);
            if (bb) {
              bb.image = image;
              bb.color = color;
              bb.rotation = rotation;
              (bb.id as any)._aircraftData = ac;
            }
          } else {
            // New aircraft: add billboard with interpolating position.
            const rec: AircraftRecord = {
              idx: -1,
              prevPos: newPos,
              currPos: newPos,
              prevTime: obsTime,
              currTime: obsTime,
              staleAfter: staleMs,
              speedKt: ac.groundSpeedKt ?? 0,
              trackDeg: ac.trackDeg ?? ac.headingTrueDeg ?? NaN,
              verticalRateFpm: ac.verticalRateFpm ?? 0,
              onGround: ac.onGround ?? false,
            };
            const idObj: { _aircraftData: AircraftLatest } = { _aircraftData: ac };
            // CallbackProperty for smooth interpolation between real observed positions.
            const posCallback = new CallbackProperty((_time?: JulianDate) => {
              const r = map.get(key);
              if (!r) return newPos;
              const nowMs = Date.now();
              if (r.staleAfter && nowMs > r.staleAfter) return r.currPos;
              const span = r.currTime - r.prevTime;
              if (span <= 0) return r.currPos;
              const t = Math.min(1, (nowMs - r.prevTime) / span);
              return Cartesian3.lerp(r.prevPos, r.currPos, t, new Cartesian3());
            }, false);
            coll!.add({
              image,
              color,
              scale: AIRCRAFT_BILLBOARD_SCALE,
              rotation,
              alignedAxis: Cartesian3.ZERO,
              position: posCallback as unknown as Cartesian3,
              id: idObj,
            });
            rec.idx = coll!.length - 1;
            map.set(key, rec);
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
            const bb = coll!.get(rec.idx);
            if (bb) bb.show = false;
            map.delete(key);
          }
        }

        applyingRef.current = false;
        onAircraftRenderedRef.current?.(map.size);

        // If a new snapshot arrived while we were applying, start it now.
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
          toDeg(rect.west), toDeg(rect.south), toDeg(rect.east), toDeg(rect.north),
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
    if (applyRafRef.current) { cancelAnimationFrame(applyRafRef.current); applyRafRef.current = 0; }
    applyingRef.current = false;
    pendingSnapshotRef.current = null;
    const coll = aircraftCollectionRef.current;
    const map = aircraftMapRef.current;
    if (coll) {
      for (const rec of map.values()) {
        const bb = coll.get(rec.idx);
        if (bb) bb.show = false;
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

      const now = Date.now();
      const arrowImage = getAircraftArrowSprite().toDataURL();
      const dotImage = getAircraftDotSprite().toDataURL();

      // Upsert changed/new aircraft.
      for (const ac of upsert) {
        if (ac.lat === null || ac.lon === null) continue;
        if (ac.staleAfter && new Date(ac.staleAfter).getTime() < now) continue;
        const key = ac.sourceObjectId;
        const heading = getAircraftHeadingDeg(ac);
        const color = getAircraftColor(ac);
        const altM = typeof ac.altitudeBaroFt === 'number' ? ac.altitudeBaroFt * 0.3048 : 0;
        const newPos = Cartesian3.fromDegrees(ac.lon, ac.lat, Math.max(0, altM));
        const obsTime = new Date(ac.observedAt).getTime();
        const staleMs = ac.staleAfter ? new Date(ac.staleAfter).getTime() : 0;
        const image = heading !== null ? arrowImage : dotImage;
        const rotation = heading !== null ? headingToBillboardRotation(heading) : 0;

        const existing = map.get(key);
        if (existing) {
          existing.prevPos = existing.currPos;
          existing.prevTime = existing.currTime;
          existing.currPos = newPos;
          existing.currTime = obsTime;
          existing.staleAfter = staleMs;
          existing.speedKt = ac.groundSpeedKt ?? 0;
          existing.trackDeg = ac.trackDeg ?? ac.headingTrueDeg ?? NaN;
          existing.verticalRateFpm = ac.verticalRateFpm ?? 0;
          existing.onGround = ac.onGround ?? false;
          const bb = coll.get(existing.idx);
          if (bb) { bb.image = image; bb.color = color; bb.rotation = rotation; (bb.id as any)._aircraftData = ac; }
        } else {
          const rec: AircraftRecord = {
            idx: -1, prevPos: newPos, currPos: newPos, prevTime: obsTime, currTime: obsTime,
            staleAfter: staleMs, speedKt: ac.groundSpeedKt ?? 0,
            trackDeg: ac.trackDeg ?? ac.headingTrueDeg ?? NaN,
            verticalRateFpm: ac.verticalRateFpm ?? 0, onGround: ac.onGround ?? false,
          };
          const idObj: { _aircraftData: AircraftLatest } = { _aircraftData: ac };
          const posCallback = new CallbackProperty((_t?: JulianDate) => {
            const r = map.get(key);
            if (!r) return newPos;
            const nowMs = Date.now();
            if (r.staleAfter && nowMs > r.staleAfter) return r.currPos;
            const span = r.currTime - r.prevTime;
            if (span <= 0) return r.currPos;
            return Cartesian3.lerp(r.prevPos, r.currPos, Math.min(1, (nowMs - r.prevTime) / span), new Cartesian3());
          }, false);
          coll.add({ image, color, scale: AIRCRAFT_BILLBOARD_SCALE, rotation, alignedAxis: Cartesian3.ZERO, position: posCallback as unknown as Cartesian3, id: idObj });
          rec.idx = coll.length - 1;
          map.set(key, rec);
        }
      }

      // Remove aircraft explicitly listed.
      for (const key of removes) {
        const rec = map.get(key);
        if (rec) { const bb = coll.get(rec.idx); if (bb) bb.show = false; map.delete(key); }
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
      if (drRafRef.current) { cancelAnimationFrame(drRafRef.current); drRafRef.current = 0; }
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

      for (const [, rec] of map) {
        if (rec.onGround) continue;
        if (!isFinite(rec.trackDeg) || rec.speedKt <= 0) continue;
        if (rec.staleAfter && nowMs > rec.staleAfter) continue;

        const elapsedSecs = Math.min(DR_MAX_SECS, (nowMs - rec.currTime) / 1000);
        if (elapsedSecs <= 0) continue;

        // Compute dead-reckoned position from currPos along trackDeg.
        const distM = rec.speedKt * KNOTS_TO_MPS * elapsedSecs;
        const trackRad = (rec.trackDeg * Math.PI) / 180;
        // Approximate: move in Cartesian space along bearing.
        const cart = rec.currPos;
        const lon = Math.atan2(cart.y, cart.x);
        const lat = Math.atan2(cart.z, Math.sqrt(cart.x * cart.x + cart.y * cart.y));
        const R = 6371000;
        const dLat = (distM * Math.cos(trackRad)) / R;
        const dLon = (distM * Math.sin(trackRad)) / (R * Math.cos(lat));
        const newLat = lat + dLat;
        const newLon = lon + dLon;
        const altM = (rec.currPos as any)._z ?? Cartesian3.magnitude(rec.currPos) - 6371000;
        const drAlt = Math.max(0, altM + rec.verticalRateFpm * FPM_TO_MPS * elapsedSecs);

        const drPos = Cartesian3.fromRadians(newLon, newLat, drAlt);
        const bb = coll.get(rec.idx);
        if (bb && bb.show !== false) {
          // Update billboard position directly (bypasses CallbackProperty for DR).
          (bb as any).position = drPos;
        }
      }
    }

    drRafRef.current = requestAnimationFrame(drFrame);
    return () => { if (drRafRef.current) { cancelAnimationFrame(drRafRef.current); drRafRef.current = 0; } };
  }, [liveAircraftLayerActive, viewerReady]);


  if (error) {
    return (
      <div style={{
        color: 'white', background: '#222', padding: '20px',
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif',
      }}>
        <h1>Cesium Initialization Error</h1>
        <p>{error}</p>
        <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'black' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {tokenMissing && (
        <div style={{
          position: 'absolute', top: '74px', left: '20px',
          background: 'rgba(255, 165, 0, 0.2)',
          border: '1px solid rgba(255, 165, 0, 0.4)', color: '#ff8c00',
          padding: '6px 12px', borderRadius: '4px', fontSize: '0.7rem',
          zIndex: 1000, pointerEvents: 'none',
          fontFamily: 'JetBrains Mono, monospace', letterSpacing: '1px',
        }}>
          SYSTEM WARNING: CESIUM_ION_TOKEN_ABSENT
        </div>
      )}
      {selectedAirport && popupPos && (
        <AirportMapPopup
          airport={selectedAirport}
          screenX={popupPos.x}
          screenY={popupPos.y}
          onClose={() => onObjectSelectRef.current(null)}
        />
      )}
      {selectedEarthquake && (
        <div style={{
          position: 'absolute', bottom: '80px', right: '20px',
          background: 'rgba(10, 14, 20, 0.92)',
          border: '1px solid rgba(255, 61, 0, 0.4)',
          color: '#e0e0e0', padding: '10px 14px', borderRadius: '4px',
          fontSize: '0.68rem', fontFamily: 'JetBrains Mono, monospace',
          letterSpacing: '0.5px', zIndex: 1000, maxWidth: '260px',
          lineHeight: '1.6',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ color: '#ff3d00', fontWeight: 700, letterSpacing: '1px' }}>
              EARTHQUAKE M{selectedEarthquake.magnitude?.toFixed(1) ?? '?'}
            </span>
            <button
              onClick={() => setSelectedEarthquake(null)}
              style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}
            >✕</button>
          </div>
          {selectedEarthquake.place && <div>{selectedEarthquake.place}</div>}
          {selectedEarthquake.depthKm != null && <div>DEPTH: {selectedEarthquake.depthKm} km</div>}
          <div>TIME: {new Date(selectedEarthquake.observedAt).toUTCString()}</div>
          {selectedEarthquake.sourceUrl && (
            <div style={{ marginTop: '4px' }}>
              <a href={selectedEarthquake.sourceUrl} target="_blank" rel="noopener noreferrer"
                style={{ color: '#64b5f6', textDecoration: 'none' }}>
                SOURCE ↗
              </a>
            </div>
          )}
        </div>
      )}
      {selectedAircraft && (
        <div style={{
          position: 'absolute', bottom: '80px', right: '20px',
          background: 'rgba(10, 14, 20, 0.92)',
          border: '1px solid rgba(0, 229, 255, 0.4)',
          color: '#e0e0e0', padding: '10px 14px', borderRadius: '4px',
          fontSize: '0.68rem', fontFamily: 'JetBrains Mono, monospace',
          letterSpacing: '0.5px', zIndex: 1000, maxWidth: '280px',
          lineHeight: '1.6',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ color: '#00e5ff', fontWeight: 700, letterSpacing: '1px' }}>
              {selectedAircraft.callsign?.trim() || selectedAircraft.registration || selectedAircraft.sourceObjectId}
              {selectedAircraft.isMilitary ? ' • MIL' : ''}
              {selectedAircraft.emergency && selectedAircraft.emergency !== 'none' ? ' • EMERGENCY' : ''}
            </span>
            <button
              onClick={() => setSelectedAircraft(null)}
              style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}
            >✕</button>
          </div>
          {selectedAircraft.registration && <div>REG: {selectedAircraft.registration}</div>}
          {selectedAircraft.aircraftType && <div>TYPE: {selectedAircraft.aircraftType}</div>}
          {selectedAircraft.altitudeBaroFt != null && <div>ALT: {selectedAircraft.altitudeBaroFt.toLocaleString()} ft</div>}
          {selectedAircraft.groundSpeedKt != null && <div>SPEED: {Math.round(selectedAircraft.groundSpeedKt)} kt</div>}
          {(selectedAircraft.trackDeg ?? selectedAircraft.headingTrueDeg ?? selectedAircraft.headingMagDeg) != null && (
            <div>HEADING: {Math.round((selectedAircraft.trackDeg ?? selectedAircraft.headingTrueDeg ?? selectedAircraft.headingMagDeg)!)}°</div>
          )}
          <div style={{ opacity: 0.7 }}>ID: {selectedAircraft.sourceObjectId}</div>
          <div style={{ opacity: 0.7 }}>OBSERVED: {new Date(selectedAircraft.observedAt).toUTCString()}</div>
          <div style={{ marginTop: '6px', fontSize: '0.55rem', color: '#ffab00', opacity: 0.7, lineHeight: 1.4 }}>
            Live aircraft data: Airplanes.live (non-commercial/no-SLA). Not complete global coverage.
          </div>
        </div>
      )}
    </div>
  );
};

export default CesiumGlobe;
