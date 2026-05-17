import React, { useEffect, useRef, useState } from 'react';
import {
  Viewer,
  Ion,
  Cartesian2,
  Cartesian3,
  Entity,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  CustomDataSource,
  PointPrimitiveCollection,
} from 'cesium';
import "cesium/Build/Cesium/Widgets/widgets.css";

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
}

const CesiumGlobe: React.FC<CesiumGlobeProps> = ({
  aviationLayerActive,
  onObjectSelect,
  onAviationStatsChange,
  cameraTarget: _cameraTarget,
  aviationFilters,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const viewerReadyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenMissing, setTokenMissing] = useState(false);
  const aviationDataSourceRef = useRef<CustomDataSource | null>(null);
  const globalDotCollectionRef = useRef<PointPrimitiveCollection | null>(null);
  const onObjectSelectRef = useRef(onObjectSelect);
  const onStatsChangeRef = useRef(onAviationStatsChange);
  const aviationLayerActiveRef = useRef(aviationLayerActive);
  const aviationFiltersRef = useRef(aviationFilters);
  const cameraHeightRef = useRef(20000000);

  const fpsRef = useRef<number>(0);

  const abortControllerRef = useRef<AbortController | null>(null);

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
  });

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
      console.log('[AVIATION] applyFiltersToDots: total', allObjects.length, 'visible', visibleCount);
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
    console.log('[AVIATION] starting resident preload');
    if (preloadingRef.current || residentCacheActiveRef.current) {
      console.log('[AVIATION] preload skipped: preloading=', preloadingRef.current, 'residentCacheActive=', residentCacheActiveRef.current);
      return;
    }
    if (!viewerRef.current) {
      console.log('[AVIATION] preload skipped: viewer not ready');
      return;
    }

    preloadingRef.current = true;

    const viewer = viewerRef.current;
    let collection = globalDotCollectionRef.current;
    if (!collection) {
      collection = createGlobalDotCollection(viewer.scene);
      globalDotCollectionRef.current = collection;
      console.log('[AVIATION] created dot collection');
    }

    const ac = new AbortController();
    abortControllerRef.current = ac;

    emitStats('RESIDENT_GLOBAL', 'PRELOAD_STARTED');

    const categoryCounts: Record<string, number> = {};

    try {
      await fetchAllAviationCategories(ac.signal, (batch, progress) => {
        if (ac.signal.aborted) return;

        console.log('[AVIATION] fetched category', progress.category, 'count', progress.categoryCount, 'total', progress.totalLoaded);

        if (batch.length > 0) {
          addAllDotsToCollection(collection!, batch);
          dotsCreatedRef.current = true;
        }

        categoryCounts[progress.category] = progress.categoryCount;

        if (progress.allDone) {
          residentCacheActiveRef.current = true;
          preloadingRef.current = false;
          console.log('[AVIATION] preload complete total', progress.totalLoaded);
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
      console.error('[AVIATION] preload error:', err);
      preloadingRef.current = false;
      emitStats('RESIDENT_GLOBAL', 'ERROR: ' + (err instanceof Error ? err.message : String(err)));
      return;
    }

    if (ac.signal.aborted) return;

    residentCacheActiveRef.current = true;
    preloadingRef.current = false;

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
      console.log('[AVIATION] viewer ready, viewerRef.current set');

      const dataSource = new CustomDataSource('aviation');
      aviationDataSourceRef.current = dataSource;
      viewer.dataSources.add(dataSource);

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
              destination: Cartesian3.fromDegrees(pos.longitude, pos.latitude, 500000),
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
    console.log('[AVIATION] toggle useEffect fired, aviationLayerActive =', aviationLayerActive, 'viewerReady =', viewerReadyRef.current, 'viewerRef =', !!viewerRef.current);
    if (!aviationLayerActive) {
      console.log('[AVIATION] toggle disabled');
      // Layer OFF: hide dots but KEEP resident cache in memory
      if (globalDotCollectionRef.current) {
        globalDotCollectionRef.current.removeAll();
        dotsCreatedRef.current = false;
      }
      emitStats('RESIDENT_GLOBAL', residentCacheActiveRef.current ? 'CACHE_READY (HIDDEN)' : 'IDLE');
    } else if (viewerRef.current) {
      console.log('[AVIATION] toggle enabled, viewer exists');
      // Layer ON: start preload if not already cached, otherwise reuse cache
      if (residentCacheActiveRef.current && getAllObjects().length > 0) {
        console.log('[AVIATION] reusing cache, objects:', getAllObjects().length);
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
          console.log('[AVIATION] rendering dots count', allObjects.length);
        }
        emitStats('RESIDENT_GLOBAL', 'CACHE_READY');
        applyFiltersToDots();
      } else if (!preloadingRef.current) {
        console.log('[AVIATION] starting resident preload');
        startResidentPreload();
      } else {
        console.log('[AVIATION] preload already in progress');
      }
    } else {
      console.log('[AVIATION] toggle enabled but viewer not ready yet');
    }
  }, [aviationLayerActive]);

  // Filter change handling — only update visibility, NO data fetching
  useEffect(() => {
    if (!aviationLayerActive || !residentCacheActiveRef.current) return;
    applyFiltersToDots();
  }, [aviationFilters, aviationLayerActive]);

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
    </div>
  );
};

export default CesiumGlobe;
