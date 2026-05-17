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

import { fetchAviationCategoryBatch, clearAviationCache } from './lib/api';
import { getViewportFromCamera } from './lib/airportViewport';
import { isPositionVisible } from './lib/cesiumVisibility';
import { renderAviationObjectsAsync } from './lib/aviationLayerRenderer';
import { flyToSearchResult } from './lib/globeCamera';
import {
  AviationFilters,
  getZoomTierFromHeight,
  getBackendCategoriesToFetch,
  isSmartLODMode,
  getBboxRoundingForTier,
  ZOOM_TIER_LABELS,
  MODE_LABELS,
} from './lib/aviationCategories';
import {
  fetchInterleavedCategoryTiles,
  clearTileCache,
} from './lib/aviationTileLoader';
import {
  createGlobalDotCollection,
  destroyGlobalDotCollection,
  addDotsToCollection,
  isGlobalDot,
  getGlobalDotPosition,
} from './lib/aviationGlobalRenderer';
import type { AirportObject } from '@god-eyes/contracts';

const FETCH_DEBOUNCE_MS = 500;

interface AviationStats {
  loaded: number;
  visible: number;
  clustersActive: boolean;
  renderMode: string;
  fps: number;
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

function roundBbox(bbox: string, tier: number): string {
  const precision = getBboxRoundingForTier(tier);
  return bbox.split(',').map((s) => {
    const n = parseFloat(s);
    if (isNaN(n)) return s;
    const rounded = Math.round(n / precision) * precision;
    return rounded === 0 ? '0' : String(rounded);
  }).join(',');
}

function computeRequestKey(
  active: boolean,
  tier: number,
  bbox: string,
  categories: string[],
): string {
  const catKey = [...categories].sort().join(',');
  const roundedBbox = roundBbox(bbox, tier);
  return `${active}:${tier}:${catKey}:${roundedBbox}`;
}

function computeRenderKey(
  active: boolean,
  tier: number,
  filters: AviationFilters,
  itemCount: number,
  fetchGeneration: number,
): string {
  const f = filters
    ? `${filters.major}:${filters.regional}:${filters.local}:${filters.heliport}:${filters.seaplane}:${filters.balloonport}:${filters.unknown}:${filters.closed}`
    : 'null';
  return `${active}:${tier}:${f}:${itemCount}:${fetchGeneration}`;
}

const CesiumGlobe: React.FC<CesiumGlobeProps> = ({
  aviationLayerActive,
  onObjectSelect,
  onAviationStatsChange,
  cameraTarget,
  aviationFilters,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tokenMissing, setTokenMissing] = useState(false);
  const aviationDataSourceRef = useRef<CustomDataSource | null>(null);
  const globalDotCollectionRef = useRef<PointPrimitiveCollection | null>(null);
  const onObjectSelectRef = useRef(onObjectSelect);
  const onStatsChangeRef = useRef(onAviationStatsChange);
  const aviationLayerActiveRef = useRef(aviationLayerActive);
  const aviationFiltersRef = useRef(aviationFilters);
  const zoomTierRef = useRef(0);
  const smartModeRef = useRef(true);
  const cameraHeightRef = useRef(20000000);

  const renderTimeoutRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const itemsCacheRef = useRef<AirportObject[]>([]);
  const fpsRef = useRef<number>(0);

  const lastRequestKeyRef = useRef('');
  const lastRenderKeyRef = useRef('');
  const fetchGenerationRef = useRef(0);

  // Tile loader state
  const tileAbortRef = useRef<AbortController | null>(null);
  const tileActiveRef = useRef(false);

  // Sync prop refs after every render so async callbacks always see current props
  useEffect(() => {
    onObjectSelectRef.current = onObjectSelect;
    onStatsChangeRef.current = onAviationStatsChange;
    aviationLayerActiveRef.current = aviationLayerActive;
    aviationFiltersRef.current = aviationFilters;
  });

  function scheduleFetch(reason: string): void {
    if (import.meta.env.DEV) {
      console.debug(`[aviation] scheduleFetch: ${reason}`);
    }
    fetchIfNeeded();
  }

  function isUsingGlobalTiles(tier: number, filters: AviationFilters): boolean {
    if (tier !== 0) return false;
    if (isSmartLODMode(filters)) return false;
    return true;
  }

  function abortTileLoader(): void {
    if (tileAbortRef.current) {
      tileAbortRef.current.abort();
      tileAbortRef.current = null;
    }
    tileActiveRef.current = false;
  }

  function destroyGlobalDots(): void {
    if (globalDotCollectionRef.current && viewerRef.current) {
      destroyGlobalDotCollection(globalDotCollectionRef.current, viewerRef.current.scene);
      globalDotCollectionRef.current = null;
    }
  }

  function clearEntities(): void {
    if (aviationDataSourceRef.current) {
      aviationDataSourceRef.current.entities.removeAll();
    }
  }

  async function renderCurrent() {
    if (!aviationDataSourceRef.current) return;
    const active = aviationLayerActiveRef.current;
    if (!active) return;

    const filters = aviationFiltersRef.current;
    const tier = zoomTierRef.current;
    const isSmart = smartModeRef.current;

    if (isUsingGlobalTiles(tier, filters)) return;

    const items = itemsCacheRef.current;
    const gen = fetchGenerationRef.current;
    const rk = computeRenderKey(active, tier, filters, items.length, gen);
    if (rk === lastRenderKeyRef.current) return;
    lastRenderKeyRef.current = rk;

    const height = cameraHeightRef.current;
    try {
      const { visibleCount } = await renderAviationObjectsAsync(
        aviationDataSourceRef.current,
        items,
        'points',
        filters,
        height,
        undefined,
        abortControllerRef.current?.signal,
      );

      onStatsChangeRef.current?.({
        loaded: items.length,
        visible: visibleCount,
        clustersActive: true,
        renderMode: `${MODE_LABELS[isSmart ? 'smart' : 'explicit']}_${ZOOM_TIER_LABELS[tier] || '?'}`,
        fps: fpsRef.current,
      });
    } catch (err) {
      console.error('Render error:', err);
    }
  }

  async function startTileLoading(filters: AviationFilters): Promise<void> {
    if (!viewerRef.current) return;

    abortTileLoader();
    destroyGlobalDots();

    const viewer = viewerRef.current;
    const collection = createGlobalDotCollection(viewer.scene);
    globalDotCollectionRef.current = collection;
    tileActiveRef.current = true;

    const ac = new AbortController();
    tileAbortRef.current = ac;

    const backendCats = getBackendCategoriesToFetch(0, filters);
    let totalLoaded = 0;

    const tierLabel = ZOOM_TIER_LABELS[0] || '?';
    const modeLabel = MODE_LABELS['explicit'];

    onStatsChangeRef.current?.({
      loaded: 0,
      visible: 0,
      clustersActive: false,
      renderMode: `${modeLabel}_${tierLabel}`,
      fps: fpsRef.current,
    });

    await fetchInterleavedCategoryTiles(backendCats, ac.signal, (batch, progress) => {
      if (ac.signal.aborted) return;
      addDotsToCollection(collection, batch, filters);
      totalLoaded = progress.totalSoFar;
      onStatsChangeRef.current?.({
        loaded: totalLoaded,
        visible: totalLoaded,
        clustersActive: false,
        renderMode: `${modeLabel}_${tierLabel}`,
        fps: fpsRef.current,
      });
    });
  }

  async function fetchIfNeeded() {
    if (!aviationDataSourceRef.current || !viewerRef.current) return;

    const active = aviationLayerActiveRef.current;
    if (!active) return;

    const currentViewer = viewerRef.current;
    const camera = currentViewer.camera;
    const viewport = getViewportFromCamera(camera);
    const tier = zoomTierRef.current;
    const filters = aviationFiltersRef.current;

    smartModeRef.current = isSmartLODMode(filters);
    const backendCats = getBackendCategoriesToFetch(tier, filters);

    // Route: explicit global → tile-based dots
    if (isUsingGlobalTiles(tier, filters)) {
      clearEntities();
      itemsCacheRef.current = [];
      const tileKey = computeRequestKey(active, tier, viewport.bbox, backendCats);
      if (tileKey !== lastRequestKeyRef.current) {
        lastRequestKeyRef.current = tileKey;
        startTileLoading(filters);
      }
      return;
    }

    // All other cases → existing entity-based path
    abortTileLoader();
    destroyGlobalDots();

    const rk = computeRequestKey(active, tier, viewport.bbox, backendCats);
    if (rk === lastRequestKeyRef.current) {
      await renderCurrent();
      return;
    }
    lastRequestKeyRef.current = rk;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      const merged = await fetchAviationCategoryBatch(
        viewport.bbox,
        'points',
        backendCats,
        1000,
        signal,
        viewport.zoom,
        rk,
      );

      fetchGenerationRef.current++;
      itemsCacheRef.current = merged;
      await renderCurrent();
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Failed to fetch aviation data:', err);
    }
  }

  useEffect(() => {
    if (cameraTarget && viewerRef.current) {
      flyToSearchResult(viewerRef.current, cameraTarget.position, cameraTarget.type);
    }
  }, [cameraTarget]);

  useEffect(() => {
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
    let tierPostRender: (() => void) | undefined;
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

      // Tier change detection
      let lastTier = 0;
      tierPostRender = viewer.scene.postRender.addEventListener(() => {
        const height = viewer!.camera.positionCartographic.height;
        cameraHeightRef.current = height;
        const newTier = getZoomTierFromHeight(height, lastTier);
        if (newTier !== lastTier) {
          lastTier = newTier;
          zoomTierRef.current = newTier;
        }
      });

      // Camera changed — debounced
      changedHandler = () => {
        if (renderTimeoutRef.current !== null) {
          window.clearTimeout(renderTimeoutRef.current);
        }
        renderTimeoutRef.current = window.setTimeout(() => {
          scheduleFetch('camera-move-end');
        }, FETCH_DEBOUNCE_MS) as unknown as number;
      };

      // Camera moveEnd
      moveEndHandler = () => {
        if (renderTimeoutRef.current !== null) {
          window.clearTimeout(renderTimeoutRef.current);
          renderTimeoutRef.current = null;
        }
        scheduleFetch('camera-move-end');
      };

      viewer.camera.percentageChanged = 0.05;
      viewer.camera.changed.addEventListener(changedHandler);
      viewer.camera.moveEnd.addEventListener(moveEndHandler);

      scheduleFetch('initial-viewer-ready');

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

        if (entity.properties && entity.properties.isCluster?.getValue()) {
          const camera = viewer!.camera;
          const pos = entity.position?.getValue(viewer!.clock.currentTime);
          if (pos) {
            const mag = Cartesian3.magnitude(pos);
            const targetHeight = camera.positionCartographic.height * 0.4;
            camera.flyTo({
              destination: Cartesian3.multiplyByScalar(
                Cartesian3.normalize(pos, new Cartesian3()),
                mag + targetHeight,
                new Cartesian3(),
              ),
              duration: 1.0,
              complete: () => scheduleFetch('camera-move-end'),
            });
          }
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
      if (typeof tierPostRender !== 'undefined') tierPostRender();
      if (typeof changedHandler !== 'undefined' && viewer) {
        viewer.camera.changed.removeEventListener(changedHandler);
      }
      if (typeof moveEndHandler !== 'undefined' && viewer) {
        viewer.camera.moveEnd.removeEventListener(moveEndHandler);
      }
      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy();
        viewerRef.current = null;
      }
      if (renderTimeoutRef.current !== null) {
        window.clearTimeout(renderTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortTileLoader();
      destroyGlobalDots();
    };
  }, []);

  useEffect(() => {
    if (!aviationLayerActive) {
      clearAviationCache();
      clearTileCache();
      abortTileLoader();
      destroyGlobalDots();
      clearEntities();
      zoomTierRef.current = 0;
      cameraHeightRef.current = 20000000;
      itemsCacheRef.current = [];
      lastRequestKeyRef.current = '';
      lastRenderKeyRef.current = '';
      fetchGenerationRef.current = 0;
      onStatsChangeRef.current?.({
        loaded: 0, visible: 0, clustersActive: false,
        renderMode: 'SMART_LOD_GLOBAL', fps: fpsRef.current,
      });
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    } else if (viewerRef.current) {
      scheduleFetch('layer-on');
    }
  }, [aviationLayerActive]);

  useEffect(() => {
    if (!aviationLayerActive || !aviationDataSourceRef.current) return;

    smartModeRef.current = isSmartLODMode(aviationFilters);
    lastRequestKeyRef.current = '';
    lastRenderKeyRef.current = '';

    if (viewerRef.current) {
      const height = viewerRef.current.camera.positionCartographic.height;
      zoomTierRef.current = getZoomTierFromHeight(height, zoomTierRef.current);
      scheduleFetch('filter-change');
    }
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
