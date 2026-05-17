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

import { fetchAviationLayerObjects } from './lib/api';
import { getViewportFromCamera } from './lib/airportViewport';
import { isPositionVisible } from './lib/cesiumVisibility';
import { renderAviationObjects } from './lib/aviationLayerRenderer';
import {
  renderDensityDots,
  renderFabricNodes,
  computeFabricNodes,
  FabricNode,
} from './lib/aviationDensityRenderer';
import { flyToSearchResult } from './lib/globeCamera';
import { AviationFilters } from './lib/aviationCategories';
import { AirportObject, AirportClusterObject } from '@god-eyes/contracts';

const MODE_FABRIC_LOWER = 6000000;
const MODE_FABRIC_UPPER = 10000000;
const MODE_DENSITY_LOWER = 250000;
const MODE_DENSITY_UPPER = 350000;
const RENDER_FABRIC_MIN = 6000000;
const FABRIC_FLY_HEIGHT = 500000;

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
  const fabricCollectionRef = useRef<PointPrimitiveCollection | null>(null);
  const densityCollectionRef = useRef<PointPrimitiveCollection | null>(null);
  const onObjectSelectRef = useRef(onObjectSelect);
  const onStatsChangeRef = useRef(onAviationStatsChange);
  const aviationLayerActiveRef = useRef(aviationLayerActive);
  const aviationFiltersRef = useRef(aviationFilters);

  const renderTimeoutRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const itemsCacheRef = useRef<(AirportObject | AirportClusterObject)[]>([]);
  const modeCacheRef = useRef<'points' | 'clusters'>('points');
  const renderModeCacheRef = useRef<'fabric' | 'density' | 'entity'>('fabric');
  const densityPointMapRef = useRef<Map<string, AirportObject>>(new Map());
  const fabricClickMapRef = useRef<Map<string, FabricNode>>(new Map());
  const fpsRef = useRef<number>(0);
  const lastModeRef = useRef<'fabric' | 'density' | 'entity'>('fabric');

  useEffect(() => {
    onObjectSelectRef.current = onObjectSelect;
  }, [onObjectSelect]);

  useEffect(() => {
    onStatsChangeRef.current = onAviationStatsChange;
  }, [onAviationStatsChange]);

  useEffect(() => {
    aviationLayerActiveRef.current = aviationLayerActive;
  }, [aviationLayerActive]);

  useEffect(() => {
    aviationFiltersRef.current = aviationFilters;
  }, [aviationFilters]);

  useEffect(() => {
    if (cameraTarget && viewerRef.current) {
      flyToSearchResult(viewerRef.current, cameraTarget.position, cameraTarget.type);
    }
  }, [cameraTarget]);

  function determineRenderMode(height: number): 'fabric' | 'density' | 'entity' {
    const current = renderModeCacheRef.current;
    if (current === 'fabric') {
      if (height < MODE_FABRIC_LOWER) return 'density';
      return 'fabric';
    }
    if (current === 'density') {
      if (height >= MODE_FABRIC_UPPER) return 'fabric';
      if (height < MODE_DENSITY_LOWER) return 'entity';
      return 'density';
    }
    if (current === 'entity') {
      if (height >= MODE_DENSITY_UPPER) return 'density';
      return 'entity';
    }
    return 'fabric';
  }

  function clearAllPointPrimitives() {
    if (fabricCollectionRef.current) {
      fabricCollectionRef.current.removeAll();
    }
    if (densityCollectionRef.current) {
      densityCollectionRef.current.removeAll();
    }
  }

  function clearEntities() {
    if (aviationDataSourceRef.current) {
      aviationDataSourceRef.current.entities.removeAll();
    }
  }

  function renderFabricMode(items: any[], filters: AviationFilters | null) {
    clearEntities();
    densityCollectionRef.current?.removeAll();
    densityPointMapRef.current.clear();

    const nodes = computeFabricNodes(items, filters);
    const fabricCol = fabricCollectionRef.current;
    if (fabricCol) {
      renderFabricNodes(fabricCol, nodes);
    }

    const clickMap = new Map<string, FabricNode>();
    for (const n of nodes) clickMap.set(n.id, n);
    fabricClickMapRef.current = clickMap;

    const visCount = nodes.reduce((s, n) => s + n.count, 0);
    renderModeCacheRef.current = 'fabric';
    onStatsChangeRef.current?.({
      loaded: items.length,
      visible: visCount,
      clustersActive: false,
      renderMode: 'fabric',
      fps: fpsRef.current,
    });
  }

  function renderDensityMode(items: any[], filters: AviationFilters | null) {
    clearEntities();
    fabricClickMapRef.current.clear();

    const densityCol = densityCollectionRef.current;
    if (densityCol) {
      const result = renderDensityDots(densityCol, items, filters);
      densityPointMapRef.current = result.pointMap;
    }

    // Render fabric nodes for crossfade if camera is high enough
    const viewer = viewerRef.current;
    if (viewer) {
      const height = viewer.camera.positionCartographic.height;
      if (height >= RENDER_FABRIC_MIN) {
        const nodes = computeFabricNodes(items, filters);
        const fabricCol = fabricCollectionRef.current;
        if (fabricCol) {
          renderFabricNodes(fabricCol, nodes);
        }
        const clickMap = new Map<string, FabricNode>();
        for (const n of nodes) clickMap.set(n.id, n);
        fabricClickMapRef.current = clickMap;
      } else {
        fabricCollectionRef.current?.removeAll();
      }
    }

    renderModeCacheRef.current = 'density';
    onStatsChangeRef.current?.({
      loaded: items.length,
      visible: densityPointMapRef.current.size,
      clustersActive: false,
      renderMode: 'density',
      fps: fpsRef.current,
    });
  }

  function renderEntityMode(items: any[], filters: AviationFilters | null) {
    clearAllPointPrimitives();
    densityPointMapRef.current.clear();
    fabricClickMapRef.current.clear();

    const { visibleCount } = renderAviationObjects(
      aviationDataSourceRef.current!,
      items,
      'points',
      filters
    );

    renderModeCacheRef.current = 'entity';
    onStatsChangeRef.current?.({
      loaded: items.length,
      visible: visibleCount,
      clustersActive: false,
      renderMode: 'entity',
      fps: fpsRef.current,
    });
  }

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

      const fabricCol = new PointPrimitiveCollection();
      fabricCollectionRef.current = fabricCol;
      viewer.scene.primitives.add(fabricCol);

      const densityCol = new PointPrimitiveCollection();
      densityCollectionRef.current = densityCol;
      viewer.scene.primitives.add(densityCol);

      // FPS tracking via postRender
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

      const fetchAndRenderData = async () => {
        if (!aviationLayerActiveRef.current || !aviationDataSourceRef.current || !viewerRef.current) return;

        const currentViewer = viewerRef.current;
        const camera = currentViewer.camera;

        const viewport = getViewportFromCamera(camera);
        const cameraHeight = camera.positionCartographic.height;
        const activeRenderMode = determineRenderMode(cameraHeight);

        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        try {
          const response = await fetchAviationLayerObjects(
            'points',
            viewport.bbox,
            viewport.zoom,
            1000,
            abortControllerRef.current.signal
          );

          itemsCacheRef.current = response.items;
          modeCacheRef.current = 'points';
          lastModeRef.current = activeRenderMode;

          if (activeRenderMode === 'entity') {
            renderEntityMode(response.items, aviationFiltersRef.current);
          } else if (activeRenderMode === 'density') {
            renderDensityMode(response.items, aviationFiltersRef.current);
          } else {
            renderFabricMode(response.items, aviationFiltersRef.current);
          }
        } catch (err: any) {
          if (err.name === 'AbortError') return;
          console.error('Failed to fetch/render aviation data:', err);
        }
      };

      viewer.camera.percentageChanged = 0.01;

      const triggerRefresh = () => {
        if (renderTimeoutRef.current !== null) {
          window.clearTimeout(renderTimeoutRef.current);
        }
        renderTimeoutRef.current = window.setTimeout(() => {
          fetchAndRenderData();
        }, 200) as unknown as number;
      };

      viewer.camera.changed.addEventListener(triggerRefresh);
      viewer.camera.moveEnd.addEventListener(fetchAndRenderData);

      const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((click: { position: Cartesian2 }) => {
        const pickedObject = viewer!.scene.pick(click.position);
        if (!pickedObject || !pickedObject.id) {
          onObjectSelectRef.current(null);
          return;
        }

        // Fabric node click → fly to area
        if (typeof pickedObject.id === 'string' && pickedObject.id.startsWith('fabric-')) {
          const node = fabricClickMapRef.current.get(pickedObject.id);
          if (node) {
            const centerLon = (node.minLon + node.maxLon) / 2;
            const centerLat = (node.minLat + node.maxLat) / 2;
            const pos = Cartesian3.fromDegrees(centerLon, centerLat, 0);
            const mag = Cartesian3.magnitude(pos);
            const flyHeight = FABRIC_FLY_HEIGHT;
            viewer!.camera.flyTo({
              destination: Cartesian3.multiplyByScalar(
                Cartesian3.normalize(pos, new Cartesian3()),
                mag + flyHeight,
                new Cartesian3()
              ),
              duration: 1.0,
            });
          }
          return;
        }

        // Density dot click → Object Intel
        if (typeof pickedObject.id === 'string' && pickedObject.id.startsWith('density-')) {
          const airport = densityPointMapRef.current.get(pickedObject.id);
          if (airport && airport.position.longitude != null && airport.position.latitude != null) {
            const pos = Cartesian3.fromDegrees(
              airport.position.longitude,
              airport.position.latitude,
              100
            );
            if (!isPositionVisible(viewer!, pos)) {
              onObjectSelectRef.current(null);
              return;
            }
            onObjectSelectRef.current(airport);
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
          // Cluster zoom (existing fallback behavior, kept for safety)
          const camera = viewer!.camera;
          const pos = entity.position?.getValue(viewer!.clock.currentTime);
          if (pos) {
            const mag = Cartesian3.magnitude(pos);
            const targetHeight = camera.positionCartographic.height * 0.4;
            camera.flyTo({
              destination: Cartesian3.multiplyByScalar(
                Cartesian3.normalize(pos, new Cartesian3()),
                mag + targetHeight,
                new Cartesian3()
              ),
              duration: 1.0,
              complete: () => fetchAndRenderData(),
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
      if (fabricCollectionRef.current && !fabricCollectionRef.current.isDestroyed()) {
        fabricCollectionRef.current.removeAll();
        if (viewer && !viewer.isDestroyed()) {
          viewer.scene.primitives.remove(fabricCollectionRef.current);
        }
        fabricCollectionRef.current = null;
      }
      if (densityCollectionRef.current && !densityCollectionRef.current.isDestroyed()) {
        densityCollectionRef.current.removeAll();
        if (viewer && !viewer.isDestroyed()) {
          viewer.scene.primitives.remove(densityCollectionRef.current);
        }
        densityCollectionRef.current = null;
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
    };
  }, []);

  useEffect(() => {
    if (!aviationLayerActive) {
      clearAllPointPrimitives();
      clearEntities();
      densityPointMapRef.current.clear();
      fabricClickMapRef.current.clear();
      renderModeCacheRef.current = 'fabric';
      onStatsChangeRef.current?.({
        loaded: 0, visible: 0, clustersActive: false,
        renderMode: 'fabric', fps: fpsRef.current,
      });
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    } else {
      if (viewerRef.current) {
        viewerRef.current.camera.changed.raiseEvent();
      }
    }
  }, [aviationLayerActive]);

  useEffect(() => {
    if (!aviationLayerActive) return;
    const currentMode = renderModeCacheRef.current;
    if (currentMode === 'fabric') {
      renderFabricMode(itemsCacheRef.current, aviationFilters);
    } else if (currentMode === 'density') {
      renderDensityMode(itemsCacheRef.current, aviationFilters);
    } else {
      renderEntityMode(itemsCacheRef.current, aviationFilters);
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
