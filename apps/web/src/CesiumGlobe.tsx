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
import { renderDensityDots } from './lib/aviationDensityRenderer';
import { flyToSearchResult } from './lib/globeCamera';
import { AviationFilters } from './lib/aviationCategories';
import { AirportObject, AirportClusterObject } from '@god-eyes/contracts';

const DENSITY_HEIGHT_THRESHOLD = 300000;
const DENSITY_HYSTERESIS = 50000;

interface AviationStats {
  loaded: number;
  visible: number;
  clustersActive: boolean;
  renderMode: 'density' | 'points' | 'clusters';
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
  aviationRenderMode: 'density' | 'clusters';
}

const CesiumGlobe: React.FC<CesiumGlobeProps> = ({
  aviationLayerActive,
  onObjectSelect,
  onAviationStatsChange,
  cameraTarget,
  aviationFilters,
  aviationRenderMode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tokenMissing, setTokenMissing] = useState(false);
  const aviationDataSourceRef = useRef<CustomDataSource | null>(null);
  const pointPrimitiveCollectionRef = useRef<PointPrimitiveCollection | null>(null);
  const onObjectSelectRef = useRef(onObjectSelect);
  const onStatsChangeRef = useRef(onAviationStatsChange);
  const aviationLayerActiveRef = useRef(aviationLayerActive);
  const aviationFiltersRef = useRef(aviationFilters);
  const aviationRenderModeRef = useRef(aviationRenderMode);

  const renderTimeoutRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const itemsCacheRef = useRef<(AirportObject | AirportClusterObject)[]>([]);
  const modeCacheRef = useRef<'points' | 'clusters'>('points');
  const renderModeCacheRef = useRef<'density' | 'entity' | 'clusters'>('density');
  const densityPointMapRef = useRef<Map<string, AirportObject>>(new Map());
  const lastDensityCountRef = useRef<number>(0);

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
    aviationRenderModeRef.current = aviationRenderMode;
  }, [aviationRenderMode]);

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

      const pointCollection = new PointPrimitiveCollection();
      pointPrimitiveCollectionRef.current = pointCollection;
      viewer.scene.primitives.add(pointCollection);

      const fetchAndRenderData = async () => {
        if (!aviationLayerActiveRef.current || !aviationDataSourceRef.current || !viewerRef.current) return;

        const currentViewer = viewerRef.current;
        const currentDataSource = aviationDataSourceRef.current;
        const camera = currentViewer.camera;

        const viewport = getViewportFromCamera(camera);
        const cameraHeight = camera.positionCartographic.height;
        const renderMode = aviationRenderModeRef.current;
        const currentRenderMode = renderModeCacheRef.current;

        let fetchMode: 'points' | 'clusters' = 'points';
        let activeRenderMode: 'density' | 'entity' | 'clusters' = 'entity';

        if (renderMode === 'clusters') {
          fetchMode = cameraHeight >= 1500000 ? 'clusters' : 'points';
          activeRenderMode = fetchMode === 'clusters' ? 'clusters' : 'entity';
        } else {
          fetchMode = 'points';
          const isCurrentlyDensity = currentRenderMode === 'density';
          if (isCurrentlyDensity) {
            activeRenderMode = cameraHeight >= DENSITY_HEIGHT_THRESHOLD - DENSITY_HYSTERESIS ? 'density' : 'entity';
          } else {
            activeRenderMode = cameraHeight >= DENSITY_HEIGHT_THRESHOLD + DENSITY_HYSTERESIS ? 'density' : 'entity';
          }
        }

        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        try {
          const response = await fetchAviationLayerObjects(
            fetchMode,
            viewport.bbox,
            viewport.zoom,
            1000,
            abortControllerRef.current.signal
          );

          itemsCacheRef.current = response.items;
          modeCacheRef.current = fetchMode;
          renderModeCacheRef.current = activeRenderMode;

          if (activeRenderMode === 'density') {
            currentDataSource.entities.removeAll();
            const result = renderDensityDots(
              pointCollection,
              response.items,
              aviationFiltersRef.current
            );
            densityPointMapRef.current = result.pointMap;
            lastDensityCountRef.current = result.count;

            onStatsChangeRef.current?.({
              loaded: response.items.length,
              visible: result.count,
              clustersActive: false,
              renderMode: 'density',
            });
          } else {
            pointCollection.removeAll();
            densityPointMapRef.current.clear();
            const entityModeArg = activeRenderMode === 'clusters' ? 'clusters' : 'points';
            const { visibleCount, clustersActive } = renderAviationObjects(
              currentDataSource,
              response.items,
              entityModeArg,
              aviationFiltersRef.current
            );

            onStatsChangeRef.current?.({
              loaded: response.items.length,
              visible: visibleCount,
              clustersActive,
              renderMode: activeRenderMode === 'entity' ? 'points' : 'clusters',
            });
          }
        } catch (err: any) {
          if (err.name === 'AbortError') {
            return;
          }
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
              complete: () => {
                fetchAndRenderData();
              },
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
      if (pointPrimitiveCollectionRef.current && !pointPrimitiveCollectionRef.current.isDestroyed()) {
        pointPrimitiveCollectionRef.current.removeAll();
        if (viewer && !viewer.isDestroyed()) {
          viewer.scene.primitives.remove(pointPrimitiveCollectionRef.current);
        }
        pointPrimitiveCollectionRef.current = null;
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
      if (aviationDataSourceRef.current) {
        aviationDataSourceRef.current.entities.removeAll();
      }
      if (pointPrimitiveCollectionRef.current) {
        pointPrimitiveCollectionRef.current.removeAll();
      }
      densityPointMapRef.current.clear();
      lastDensityCountRef.current = 0;
      renderModeCacheRef.current = 'density';
      onStatsChangeRef.current?.({ loaded: 0, visible: 0, clustersActive: false, renderMode: 'density' });

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

    const currentRenderMode = renderModeCacheRef.current;

    if (currentRenderMode === 'density') {
      if (!pointPrimitiveCollectionRef.current) return;
      const result = renderDensityDots(
        pointPrimitiveCollectionRef.current,
        itemsCacheRef.current,
        aviationFilters
      );
      densityPointMapRef.current = result.pointMap;
      lastDensityCountRef.current = result.count;
      onStatsChangeRef.current?.({
        loaded: itemsCacheRef.current.length,
        visible: result.count,
        clustersActive: false,
        renderMode: 'density',
      });
    } else {
      if (!aviationDataSourceRef.current) return;
      const { visibleCount, clustersActive } = renderAviationObjects(
        aviationDataSourceRef.current,
        itemsCacheRef.current,
        modeCacheRef.current,
        aviationFilters
      );
      onStatsChangeRef.current?.({
        loaded: itemsCacheRef.current.length,
        visible: visibleCount,
        clustersActive,
        renderMode: currentRenderMode === 'clusters' ? 'clusters' : 'points',
      });
    }
  }, [aviationFilters, aviationLayerActive, aviationRenderMode]);

  if (error) {
    return (
      <div style={{
        color: 'white',
        background: '#222',
        padding: '20px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'sans-serif',
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
          position: 'absolute',
          top: '74px',
          left: '20px',
          background: 'rgba(255, 165, 0, 0.2)',
          border: '1px solid rgba(255, 165, 0, 0.4)',
          color: '#ff8c00',
          padding: '6px 12px',
          borderRadius: '4px',
          fontSize: '0.7rem',
          zIndex: 1000,
          pointerEvents: 'none',
          fontFamily: 'JetBrains Mono, monospace',
          letterSpacing: '1px',
        }}>
          SYSTEM WARNING: CESIUM_ION_TOKEN_ABSENT
        </div>
      )}
    </div>
  );
};

export default CesiumGlobe;
