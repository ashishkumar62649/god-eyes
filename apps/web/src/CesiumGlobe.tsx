import React, { useEffect, useRef, useState } from 'react';
import { 
  Viewer, 
  Ion, 
  Cartesian2,
  Cartesian3, 
  Color, 
  Entity, 
  ScreenSpaceEventHandler, 
  ScreenSpaceEventType,
  VerticalOrigin,
  HorizontalOrigin,
  LabelStyle,
  CustomDataSource
} from 'cesium';
import "cesium/Build/Cesium/Widgets/widgets.css";
import { fetchAirports } from './lib/api';

interface CesiumGlobeProps {
  aviationLayerActive: boolean;
  onObjectSelect: (obj: unknown) => void;
  onAviationStatsChange?: (stats: { loaded: number; visible: number; clustersActive: boolean }) => void;
}

// Helper to create a padded circle sprite
const createMarkerCanvas = (size: number, color: string, glow: boolean = false) => {
  const canvas = document.createElement('canvas');
  const padding = glow ? 12 : 8; // Prevent clipping, generously padded
  const totalSize = size + padding * 2;
  canvas.width = totalSize;
  canvas.height = totalSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const center = totalSize / 2;
  const radius = size / 2;

  if (glow) {
    const gradient = ctx.createRadialGradient(center, center, radius * 0.5, center, center, center);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(center, center, center, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  return canvas;
};

// Simple canvas caching to avoid recreating identical clusters
const canvasCache = new Map<number, HTMLCanvasElement>();
const getClusterCanvas = (size: number) => {
  const finalSize = Math.floor(size);
  if (!canvasCache.has(finalSize)) {
    canvasCache.set(finalSize, createMarkerCanvas(finalSize, '#00d2ff', true));
  }
  return canvasCache.get(finalSize)!;
};

const CesiumGlobe: React.FC<CesiumGlobeProps> = ({ 
  aviationLayerActive, 
  onObjectSelect,
  onAviationStatsChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tokenMissing, setTokenMissing] = useState(false);
  const aviationDataSourceRef = useRef<CustomDataSource | null>(null);
  const onObjectSelectRef = useRef(onObjectSelect);
  const onStatsChangeRef = useRef(onAviationStatsChange);
  const aviationLayerActiveRef = useRef(aviationLayerActive);
  const rawAirportsRef = useRef<any[]>([]);
  const renderTimeoutRef = useRef<number | null>(null);

  // Update refs when props change
  useEffect(() => {
    onObjectSelectRef.current = onObjectSelect;
  }, [onObjectSelect]);

  useEffect(() => {
    onStatsChangeRef.current = onAviationStatsChange;
  }, [onAviationStatsChange]);

  useEffect(() => {
    aviationLayerActiveRef.current = aviationLayerActive;
  }, [aviationLayerActive]);

  // Initialize Viewer
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
      
      // Tame mouse-wheel zoom
      const cameraController = viewer.scene.screenSpaceCameraController;
      cameraController.inertiaZoom = 0.1; // Almost no sliding after scroll
      cameraController.maximumMovementRatio = 0.02; // Very small jump distance per scroll for controlled zooming
      
      viewerRef.current = viewer;

      // Fast visibility update for active entities to prevent see-through during rotation
      viewer.scene.preRender.addEventListener(() => {
        if (!aviationLayerActiveRef.current || !aviationDataSourceRef.current || !viewerRef.current) return;
        const currentViewer = viewerRef.current;
        const currentCamera = currentViewer.camera;
        const currentCameraPos = currentCamera.positionWC;
        const currentCameraDir = Cartesian3.normalize(currentCameraPos, new Cartesian3());
        
        const entities = aviationDataSourceRef.current.entities.values;
        for (let i = 0; i < entities.length; i++) {
          const entity = entities[i];
          const position = entity.position?.getValue(currentViewer.clock.currentTime);
          if (position) {
            const pointDir = Cartesian3.normalize(position, new Cartesian3());
            const dotProd = Cartesian3.dot(currentCameraDir, pointDir);
            const isVisible = dotProd > -0.05; // Hide when going behind horizon
            if (entity.show !== isVisible) {
              entity.show = isVisible;
            }
          }
        }
      });

      // Initialize Data Source for Aviation (No Cesium clustering)
      const dataSource = new CustomDataSource('aviation');
      aviationDataSourceRef.current = dataSource;
      viewer.dataSources.add(dataSource);

      // Icons
      const largeIcon = createMarkerCanvas(12, '#00d2ff');
      const smallIcon = createMarkerCanvas(8, '#00d2ff');

      // Manual clustering/visibility logic
      const updateClustering = () => {
        if (!aviationLayerActiveRef.current || !aviationDataSourceRef.current || !viewerRef.current || rawAirportsRef.current.length === 0) return;
        
        const currentViewer = viewerRef.current;
        const currentDataSource = aviationDataSourceRef.current;
        const airports = rawAirportsRef.current;
        
        const camera = currentViewer.camera;
        const cameraPos = camera.positionWC;
        const cameraDir = Cartesian3.normalize(cameraPos, new Cartesian3());
        const cameraHeight = camera.positionCartographic.height;

        // Grid size in degrees based on altitude. 
        // 2,000,000m -> ~1 degree. 
        const gridSize = Math.max(0.5, cameraHeight / 2000000);
        const isZoomedIn = cameraHeight < 1500000;

        const clusters = new Map<string, any[]>();

        for (const airport of airports) {
          if (!airport.position.latitude || !airport.position.longitude) continue;

          // Manual front-side visibility (horizon margin -0.1)
          const pos = Cartesian3.fromDegrees(airport.position.longitude, airport.position.latitude, 0);
          const pointDir = Cartesian3.normalize(pos, new Cartesian3());
          if (Cartesian3.dot(cameraDir, pointDir) < -0.1) continue; 

          if (isZoomedIn) {
            clusters.set(`single-${airport.id}`, [airport]);
          } else {
            const gridX = Math.floor(airport.position.longitude / gridSize);
            const gridY = Math.floor(airport.position.latitude / gridSize);
            const key = `${gridX},${gridY}`;
            if (!clusters.has(key)) clusters.set(key, []);
            clusters.get(key)!.push(airport);
          }
        }

        currentDataSource.entities.suspendEvents();
        currentDataSource.entities.removeAll();

        let visibleCount = 0;
        let clustersActive = false;

        clusters.forEach((clusterAirports, key) => {
          if (clusterAirports.length === 1) {
            const airport = clusterAirports[0];
            currentDataSource.entities.add({
              id: `airport-${airport.id}`,
              position: Cartesian3.fromDegrees(airport.position.longitude, airport.position.latitude, 0),
              billboard: {
                image: airport.category === 'large_airport' ? largeIcon : smallIcon,
                verticalOrigin: VerticalOrigin.CENTER,
                horizontalOrigin: HorizontalOrigin.CENTER,
                disableDepthTestDistance: Number.POSITIVE_INFINITY, 
              },
              label: {
                text: airport.ident,
                font: '10px JetBrains Mono, monospace',
                style: LabelStyle.FILL_AND_OUTLINE,
                outlineWidth: 2,
                outlineColor: Color.BLACK,
                verticalOrigin: VerticalOrigin.BOTTOM,
                pixelOffset: new Cartesian2(0, -10),
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
              },
              properties: {
                rawData: airport,
                isCluster: false
              }
            });
            visibleCount++;
          } else {
            clustersActive = true;
            const count = clusterAirports.length;
            visibleCount += count;
            
            let sumLon = 0;
            let sumLat = 0;
            for (const a of clusterAirports) {
              sumLon += a.position.longitude;
              sumLat += a.position.latitude;
            }
            const centerLon = sumLon / count;
            const centerLat = sumLat / count;

            const baseSize = 24;
            const growthFactor = Math.min(count * 0.8, 16);
            const finalSize = baseSize + growthFactor;
            const clusterIcon = getClusterCanvas(finalSize);

            currentDataSource.entities.add({
              id: `cluster-${key}`,
              position: Cartesian3.fromDegrees(centerLon, centerLat, 0),
              billboard: {
                image: clusterIcon as any,
                verticalOrigin: VerticalOrigin.CENTER,
                horizontalOrigin: HorizontalOrigin.CENTER,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
              },
              label: {
                text: count.toString(),
                font: count > 10 ? 'bold 14px JetBrains Mono, monospace' : 'bold 12px JetBrains Mono, monospace',
                fillColor: Color.WHITE,
                outlineColor: Color.BLACK,
                outlineWidth: 4,
                style: LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: VerticalOrigin.CENTER,
                horizontalOrigin: HorizontalOrigin.CENTER,
                pixelOffset: new Cartesian2(0, 0),
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
              },
              properties: {
                isCluster: true,
                airports: clusterAirports
              }
            });
          }
        });

        currentDataSource.entities.resumeEvents();

        onStatsChangeRef.current?.({ 
          loaded: airports.length, 
          visible: visibleCount, 
          clustersActive: clustersActive 
        });
      };

      // Debounce camera updates to prevent stutter
      viewer.camera.percentageChanged = 0.05; 
      viewer.camera.changed.addEventListener(() => {
        if (renderTimeoutRef.current !== null) {
          window.clearTimeout(renderTimeoutRef.current);
        }
        renderTimeoutRef.current = window.setTimeout(() => {
          updateClustering();
        }, 150); // 150ms debounce
      });

      // Handle Clicks
      const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((click: { position: Cartesian2 }) => {
        const pickedObject = viewer!.scene.pick(click.position);
        if (!pickedObject || !pickedObject.id || !(pickedObject.id instanceof Entity)) {
          onObjectSelectRef.current(null);
          return;
        }
        
        const entity = pickedObject.id;
        
        // Handle Cluster Click
        if (entity.properties && entity.properties.isCluster?.getValue()) {
           const camera = viewer!.camera;
           const pos = entity.position?.getValue(viewer!.clock.currentTime);
           if (pos) {
             const mag = Cartesian3.magnitude(pos);
             const targetHeight = camera.positionCartographic.height * 0.4; // zoom in by 60%
             
             camera.flyTo({
               destination: Cartesian3.multiplyByScalar(
                 Cartesian3.normalize(pos, new Cartesian3()), 
                 mag + targetHeight, 
                 new Cartesian3()
               ),
               duration: 1.0
             });
           }
           return;
        } 
        
        // Handle Individual Entity Click
        if (entity.properties && entity.properties.rawData) {
           onObjectSelectRef.current(entity.properties.rawData.getValue());
        }
      }, ScreenSpaceEventType.LEFT_CLICK);

    } catch (err) {
      console.error('Cesium failed to initialize:', err);
      setError(err instanceof Error ? err.message : String(err));
    }

    return () => {
      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy();
        viewerRef.current = null;
      }
      if (renderTimeoutRef.current !== null) {
        window.clearTimeout(renderTimeoutRef.current);
      }
    };
  }, []);

  // Handle Aviation Layer Data Fetching
  useEffect(() => {
    async function updateAviationLayer() {
      if (!aviationLayerActive) {
        if (aviationDataSourceRef.current) {
          aviationDataSourceRef.current.entities.removeAll();
        }
        onStatsChangeRef.current?.({ loaded: 0, visible: 0, clustersActive: false });
        return;
      }

      if (rawAirportsRef.current.length > 0) {
        // Data already loaded, just re-trigger render
        if (viewerRef.current) {
          // Force a camera change event to re-render clusters
          viewerRef.current.camera.changed.raiseEvent();
        }
        return;
      }

      try {
        const airports = await fetchAirports(500);
        rawAirportsRef.current = airports;
        
        // Force initial render
        if (viewerRef.current) {
          viewerRef.current.camera.changed.raiseEvent();
        }
      } catch (err) {
        console.error('Failed to fetch aviation layer:', err);
      }
    }

    updateAviationLayer();
  }, [aviationLayerActive]);


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
        fontFamily: 'sans-serif'
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
          letterSpacing: '1px'
        }}>
          SYSTEM WARNING: CESIUM_ION_TOKEN_ABSENT
        </div>
      )}
    </div>
  );
};

export default CesiumGlobe;
