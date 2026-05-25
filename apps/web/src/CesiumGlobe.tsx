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
} from 'cesium';
import "cesium/Build/Cesium/Widgets/widgets.css";
import AirportMapPopup from './components/intel/AirportMapPopup';
import type { AirportObject, EarthEvent } from '@god-eyes/contracts';
import type { AirportLayoutFeaturesResponse } from './lib/airportLayoutTypes';

import {
  fetchAllAviationCategories,
} from './lib/aviationPreloader';
import { isPositionVisible } from './lib/cesiumVisibility';
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
          onObjectSelectRef.current(null);
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
    </div>
  );
};

export default CesiumGlobe;
