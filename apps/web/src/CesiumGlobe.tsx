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
  LabelStyle,
  NearFarScalar
} from 'cesium';
import "cesium/Build/Cesium/Widgets/widgets.css";
import { fetchAirports } from './lib/api';

interface CesiumGlobeProps {
  aviationLayerActive: boolean;
  onObjectSelect: (obj: unknown) => void;
}

const CesiumGlobe: React.FC<CesiumGlobeProps> = ({ 
  aviationLayerActive, 
  onObjectSelect 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tokenMissing, setTokenMissing] = useState(false);
  const airportEntitiesRef = useRef<Entity[]>([]);

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
      viewerRef.current = viewer;

      // Handle Clicks
      const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((click: { position: Cartesian2 }) => {
        const pickedObject = viewer!.scene.pick(click.position);
        if (pickedObject && pickedObject.id instanceof Entity) {
          const entity = pickedObject.id;
          if (entity.properties && entity.properties.rawData) {
            onObjectSelect(entity.properties.rawData.getValue());
          }
        } else {
          onObjectSelect(null);
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
  }, [onObjectSelect]);

  // Handle Aviation Layer
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    async function updateAviationLayer() {
      // Clean up existing
      airportEntitiesRef.current.forEach(entity => viewer!.entities.remove(entity));
      airportEntitiesRef.current = [];

      if (!aviationLayerActive) return;

      try {
        const airports = await fetchAirports(500);
        
        const entities = airports.map(airport => {
          if (!airport.position.latitude || !airport.position.longitude) return null;

          return viewer!.entities.add({
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
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
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
              translucencyByDistance: new NearFarScalar(1.5e2, 1.0, 5.0e5, 0.0),
              disableDepthTestDistance: Number.POSITIVE_INFINITY
            },
            properties: {
              rawData: airport
            }
          });
        }).filter(e => e !== null) as Entity[];

        airportEntitiesRef.current = entities;
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
