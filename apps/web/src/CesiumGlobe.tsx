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
  NearFarScalar,
  CustomDataSource,
  HeightReference
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
  const padding = 4; // Prevent clipping
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

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();

  return canvas;
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

  // Update refs when props change
  useEffect(() => {
    onObjectSelectRef.current = onObjectSelect;
  }, [onObjectSelect]);

  useEffect(() => {
    onStatsChangeRef.current = onAviationStatsChange;
  }, [onAviationStatsChange]);

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
      viewerRef.current = viewer;

      // Initialize Data Source for Aviation
      const dataSource = new CustomDataSource('aviation');
      dataSource.clustering.enabled = true;
      dataSource.clustering.pixelRange = 45;
      dataSource.clustering.minimumClusterSize = 2;
      
      // Premium Cluster Styling
      dataSource.clustering.clusterEvent.addEventListener((clusteredEntities, cluster) => {
        const count = clusteredEntities.length;
        
        // Cluster Label - High readability
        cluster.label.show = true;
        cluster.label.text = count.toString();
        cluster.label.font = count > 10 ? 'bold 14px JetBrains Mono, monospace' : 'bold 12px JetBrains Mono, monospace';
        cluster.label.fillColor = Color.WHITE;
        cluster.label.outlineColor = Color.BLACK;
        cluster.label.outlineWidth = 4;
        cluster.label.style = LabelStyle.FILL_AND_OUTLINE;
        cluster.label.verticalOrigin = VerticalOrigin.CENTER;
        cluster.label.horizontalOrigin = HorizontalOrigin.CENTER;
        cluster.label.pixelOffset = new Cartesian2(0, 0);
        cluster.label.disableDepthTestDistance = 100000; // Small bypass to prevent terrain flicker
        
        // Use Billboard for Cluster circle to avoid clipping
        const baseSize = 24;
        const growthFactor = Math.min(count * 0.8, 16);
        const finalSize = baseSize + growthFactor;
        
        cluster.billboard.show = true;
        cluster.billboard.image = createMarkerCanvas(finalSize, '#00d2ff', true) as any;
        cluster.billboard.verticalOrigin = VerticalOrigin.CENTER;
        cluster.billboard.horizontalOrigin = HorizontalOrigin.CENTER;
        cluster.billboard.width = finalSize + 8; // Including padding
        cluster.billboard.height = finalSize + 8;
        cluster.billboard.disableDepthTestDistance = 100000;

        // Ensure Point and other graphics are off for clusters
        cluster.point.show = false;
      });

      aviationDataSourceRef.current = dataSource;

      // Handle Clicks
      const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((click: { position: Cartesian2 }) => {
        const pickedObject = viewer!.scene.pick(click.position);
        
        // 1. Handle Individual Entity Click
        if (pickedObject && pickedObject.id instanceof Entity) {
          const entity = pickedObject.id;
          if (entity.properties && entity.properties.rawData) {
            onObjectSelectRef.current(entity.properties.rawData.getValue());
          }
          return;
        } 
        
        // 2. Handle Cluster Click
        if (pickedObject && pickedObject.primitive && (pickedObject.primitive as any).clustering) {
          const camera = viewer!.camera;
          const cartesian = camera.pickEllipsoid(click.position);
          
          if (cartesian) {
            const mag = Cartesian3.magnitude(cartesian);
            const cameraHeight = camera.positionCartographic.height;
            const targetHeight = cameraHeight * 0.4;
            
            camera.flyTo({
              destination: Cartesian3.multiplyByScalar(
                Cartesian3.normalize(cartesian, new Cartesian3()), 
                mag + targetHeight, 
                new Cartesian3()
              ),
              duration: 1.0
            });
          }
          return;
        }

        onObjectSelectRef.current(null);
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
    };
  }, []);

  // Handle Aviation Layer Data
  useEffect(() => {
    const viewer = viewerRef.current;
    const dataSource = aviationDataSourceRef.current;
    
    if (!viewer || !dataSource) return;

    const activeViewer = viewer;
    const activeDataSource = dataSource;

    async function updateAviationLayer() {
      if (!aviationLayerActive) {
        activeDataSource.entities.removeAll();
        if (activeViewer.dataSources.contains(activeDataSource)) {
          activeViewer.dataSources.remove(activeDataSource, false);
        }
        onStatsChangeRef.current?.({ loaded: 0, visible: 0, clustersActive: false });
        return;
      }

      if (activeDataSource.entities.values.length > 0 && activeViewer.dataSources.contains(activeDataSource)) {
        return;
      }

      if (!activeViewer.dataSources.contains(activeDataSource)) {
        activeViewer.dataSources.add(activeDataSource);
      }

      try {
        const airports = await fetchAirports(500);
        
        activeDataSource.entities.suspendEvents();
        activeDataSource.entities.removeAll();
        
        // Cache canvases
        const largeIcon = createMarkerCanvas(12, '#00d2ff');
        const smallIcon = createMarkerCanvas(8, '#00d2ff');

        airports.forEach(airport => {
          if (!airport.position.latitude || !airport.position.longitude) return;

          activeDataSource.entities.add({
            id: `airport-${airport.id}`,
            position: Cartesian3.fromDegrees(
              airport.position.longitude, 
              airport.position.latitude
            ),
            billboard: {
              image: airport.category === 'large_airport' ? largeIcon : smallIcon,
              verticalOrigin: VerticalOrigin.CENTER,
              horizontalOrigin: HorizontalOrigin.CENTER,
              scaleByDistance: new NearFarScalar(1.5e2, 1.2, 8.0e6, 0.4),
              disableDepthTestDistance: 10000, // Very conservative to prevent terrain flicker but hide behind Earth
              heightReference: HeightReference.CLAMP_TO_GROUND
            },
            label: {
              text: airport.ident,
              font: '10px JetBrains Mono, monospace',
              style: LabelStyle.FILL_AND_OUTLINE,
              outlineWidth: 2,
              outlineColor: Color.BLACK,
              verticalOrigin: VerticalOrigin.BOTTOM,
              pixelOffset: new Cartesian2(0, -10),
              translucencyByDistance: new NearFarScalar(1.5e2, 1.0, 5.0e5, 0.0),
              disableDepthTestDistance: 10000,
              heightReference: HeightReference.CLAMP_TO_GROUND
            },
            properties: {
              rawData: airport
            }
          });
        });
        
        activeDataSource.entities.resumeEvents();

        onStatsChangeRef.current?.({ 
          loaded: airports.length, 
          visible: airports.length, 
          clustersActive: true 
        });
      } catch (err) {
        console.error('Failed to render aviation layer:', err);
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
