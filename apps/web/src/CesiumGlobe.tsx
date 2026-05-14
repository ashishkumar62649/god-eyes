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
  CustomDataSource
} from 'cesium';
import "cesium/Build/Cesium/Widgets/widgets.css";
import { fetchAirports } from './lib/api';

interface CesiumGlobeProps {
  aviationLayerActive: boolean;
  onObjectSelect: (obj: unknown) => void;
  onAviationStatsChange?: (stats: { loaded: number; visible: number; clustersActive: boolean }) => void;
}

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
        cluster.label.show = true;
        cluster.label.text = clusteredEntities.length.toString();
        cluster.label.font = 'bold 12px JetBrains Mono, monospace';
        cluster.label.fillColor = Color.WHITE;
        cluster.label.outlineColor = Color.BLACK;
        cluster.label.outlineWidth = 3;
        cluster.label.style = LabelStyle.FILL_AND_OUTLINE;
        cluster.label.verticalOrigin = VerticalOrigin.CENTER;
        cluster.label.horizontalOrigin = HorizontalOrigin.CENTER;
        cluster.label.pixelOffset = new Cartesian2(0, 0);
        
        cluster.point.show = true;
        cluster.point.pixelSize = 24;
        cluster.point.color = Color.fromCssColorString('#00d2ff').withAlpha(0.6);
        cluster.point.outlineColor = Color.WHITE.withAlpha(0.4);
        cluster.point.outlineWidth = 2;
      });

      aviationDataSourceRef.current = dataSource;

      // Handle Clicks
      const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((click: { position: Cartesian2 }) => {
        const pickedObject = viewer!.scene.pick(click.position);
        
        if (pickedObject && pickedObject.id instanceof Entity) {
          const entity = pickedObject.id;
          if (entity.properties && entity.properties.rawData) {
            onObjectSelectRef.current(entity.properties.rawData.getValue());
          }
        } else if (pickedObject && pickedObject.primitive && pickedObject.primitive.clustering) {
          // It's a cluster. Zoom in slightly toward it.
          const camera = viewer!.camera;
          const cartesian = viewer!.scene.pickPosition(click.position) || 
                            viewer!.camera.pickEllipsoid(click.position);
          
          if (cartesian) {
            camera.flyTo({
              destination: Cartesian3.fromElements(
                cartesian.x,
                cartesian.y,
                cartesian.z + camera.positionCartographic.height * 0.5
              ),
              duration: 1.0
            });
          }
        } else {
          onObjectSelectRef.current(null);
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
    };
  }, []);

  // Handle Aviation Layer Data
  useEffect(() => {
    const viewer = viewerRef.current;
    const dataSource = aviationDataSourceRef.current;
    
    if (!viewer || !dataSource) return;

    // Capture in local variables to help TypeScript narrowing in the async closure
    const activeViewer = viewer;
    const activeDataSource = dataSource;

    async function updateAviationLayer() {
      // Clear existing
      activeDataSource.entities.removeAll();

      if (!aviationLayerActive) {
        if (activeViewer.dataSources.contains(activeDataSource)) {
          activeViewer.dataSources.remove(activeDataSource, false);
        }
        onStatsChangeRef.current?.({ loaded: 0, visible: 0, clustersActive: false });
        return;
      }

      if (!activeViewer.dataSources.contains(activeDataSource)) {
        activeViewer.dataSources.add(activeDataSource);
      }

      try {
        const airports = await fetchAirports(500);
        
        airports.forEach(airport => {
          if (!airport.position.latitude || !airport.position.longitude) return;

          activeDataSource.entities.add({
            id: `airport-${airport.id}`,
            position: Cartesian3.fromDegrees(
              airport.position.longitude, 
              airport.position.latitude, 
              airport.elevationFt ? airport.elevationFt * 0.3048 : 0
            ),
            point: {
              pixelSize: airport.category === 'large_airport' ? 8 : 6,
              color: Color.fromCssColorString('#00d2ff').withAlpha(0.8),
              outlineColor: Color.WHITE.withAlpha(0.4),
              outlineWidth: 1,
              scaleByDistance: new NearFarScalar(1.5e2, 1.5, 8.0e6, 0.5)
            },
            label: {
              text: airport.ident,
              font: '10px JetBrains Mono, monospace',
              style: LabelStyle.FILL_AND_OUTLINE,
              outlineWidth: 2,
              outlineColor: Color.BLACK,
              verticalOrigin: VerticalOrigin.BOTTOM,
              pixelOffset: new Cartesian2(0, -10),
              translucencyByDistance: new NearFarScalar(1.5e2, 1.0, 5.0e5, 0.0)
            },
            properties: {
              rawData: airport
            }
          });
        });

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
