import React, { useEffect, useRef, useState } from 'react';
import {
  Viewer,
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
} from 'cesium';
import "cesium/Build/Cesium/Widgets/widgets.css";
import AirportMapPopup from '../components/intel/AirportMapPopup';
import { AircraftInfoOverlay } from '../components/overlays/AircraftInfoOverlay';
import { EarthquakeInfoOverlay } from '../components/overlays/EarthquakeInfoOverlay';
import { TokenWarningOverlay } from '../components/overlays/TokenWarningOverlay';
import { SatelliteInfoOverlay } from '../components/overlays/SatelliteInfoOverlay';
import type { AircraftLatest, EarthEvent } from '@god-eyes/contracts';
import type { SatelliteFrontendItem } from '../layers/layer_05_space_satellites/satellites/satelliteTypes';
import EnergyInfrastructureLayer from '../layers/layer_10_energy_infrastructure/infrastructure/EnergyInfrastructureLayer';
import MaritimeLayer from '../layers/layer_06_maritime/MaritimeLayer';
import WeatherLayer from '../layers/layer_07_weather/WeatherLayer';
import NewsLayer from '../layers/layer_08_news_osint/NewsLayer';
import { getSatelliteColor, getSatellitePixelSize } from '../layers/layer_05_space_satellites/satellites/satelliteColors';
import { getFilteredSatellites, DEFAULT_SATELLITE_FILTERS } from '../layers/layer_05_space_satellites/satellites/satelliteFilters';

import {
  filterVisibleGlobalDots,
} from '../layers/layer_01_aviation/airports/aviationGlobalRenderer';
import { useFpsCounter } from '../globe/useFpsCounter';
import { setupCesiumToken } from '../globe/setupCesiumToken';
import { configureViewerScene } from '../globe/configureViewerScene';
import { createViewerOptions } from '../globe/viewerOptions';

import { airportFlyHeight } from './helpers';
import { createPickClickHandler } from './picking';
import { useCameraBboxReporter } from './useCameraBboxReporter';
import { useLiveAircraftRenderer } from './useLiveAircraftRenderer';
import { useResidentAviationCache } from './useResidentAviationCache';
import type { AircraftRecord, CesiumGlobeProps } from './types';

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
  spaceSatellites,
  spaceSatellitesLayerActive,
  spaceSatelliteFilters,
  energyInfrastructureFeatures,
  energyInfrastructureLayerActive,
  onEnergyFeatureSelect,
  maritimeLayerActive,
  maritimeVessels,
  onMaritimeBboxChange,
  weatherLayerActive,
  weatherItems,
  onWeatherSelect,
  newsLayerActive,
  newsMarkers,
  onNewsSelect,
}) => {

  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const viewerReadyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenMissing, setTokenMissing] = useState(false);
  const [viewerReady, setViewerReady] = useState(false);
  const aviationDataSourceRef = useRef<CustomDataSource | null>(null);
  const layoutDataSourceRef = useRef<CustomDataSource | null>(null);
  const earthEventsDataSourceRef = useRef<CustomDataSource | null>(null);
  const energyInfrastructureDataSourceRef = useRef<CustomDataSource | null>(null);
  const aircraftCollectionRef = useRef<BillboardCollection | null>(null);
  // Per-aircraft record: direct billboard reference + positions for interpolation + DR fields.
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

  const { fpsRef, startFpsCounter } = useFpsCounter();

  const abortControllerRef = useRef<AbortController | null>(null);

  // Popup screen-space position tracking
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);
  const selectedAirportRef = useRef(selectedAirport);

  // Selected earthquake for minimal info overlay
  const [selectedEarthquake, setSelectedEarthquake] = useState<EarthEvent | null>(null);

  // Selected live aircraft for minimal info overlay (WO-079E)
  const [selectedAircraft, setSelectedAircraft] = useState<AircraftLatest | null>(null);

  // Selected satellite for info overlay (WO-082E)
  const [selectedSatellite, setSelectedSatellite] = useState<SatelliteFrontendItem | null>(null);
  const satelliteDotCollectionRef = useRef<PointPrimitiveCollection | null>(null);
  const satelliteEntityDataSourceRef = useRef<CustomDataSource | null>(null);
  const onEnergyFeatureSelectRef = useRef(onEnergyFeatureSelect);
  const onWeatherSelectRef = useRef(onWeatherSelect);
  const onNewsSelectRef = useRef(onNewsSelect);

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
    onEnergyFeatureSelectRef.current = onEnergyFeatureSelect;
    onWeatherSelectRef.current = onWeatherSelect;
    onNewsSelectRef.current = onNewsSelect;
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

  // Live aircraft renderer hooks are mounted below (W4-G).
  // The hook returns updateAircraftVisualMode, which the
  // viewer-init camera listener calls whenever cameraHeightRef
  // changes (the visual-mode switch is driven by camera height).

  // Viewer initialization
  useEffect(() => {
    if (!setupCesiumToken()) {
      setTokenMissing(true);
    }

    if (!containerRef.current) return;

    let viewer: Viewer | undefined;
    let stopFpsCounter: (() => void) | undefined;
    let moveEndHandler: (() => void) | undefined;
    let changedHandler: (() => void) | undefined;

    try {
      viewer = new Viewer(containerRef.current, createViewerOptions());
      configureViewerScene(viewer);

      viewerRef.current = viewer;
      viewerReadyRef.current = true;
      setViewerReady(true);

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

      // Layer 05: satellite dot collection + entity data source for triangles
      const satDotCollection = new PointPrimitiveCollection();
      viewer.scene.primitives.add(satDotCollection);
      satelliteDotCollectionRef.current = satDotCollection;

      const satEntityDs = new CustomDataSource('space-satellites');
      satelliteEntityDataSourceRef.current = satEntityDs;
      viewer.dataSources.add(satEntityDs);

      // Layer 10: energy infrastructure data source
      const energyInfrastructureDataSource = new CustomDataSource('energy-infrastructure');
      energyInfrastructureDataSourceRef.current = energyInfrastructureDataSource;
      viewer.dataSources.add(energyInfrastructureDataSource);

      stopFpsCounter = startFpsCounter(viewer);

      // Camera changed — debounced occlusion update only, NO data fetching
      changedHandler = () => {
        if (viewerRef.current) {
          const height = viewerRef.current.camera.positionCartographic.height;
          cameraHeightRef.current = height;
          if (globalDotCollectionRef.current) {
            filterVisibleGlobalDots(globalDotCollectionRef.current, viewerRef.current.scene, aviationFiltersRef.current);
          }
          updateAircraftVisualMode();
        }
      };

      // Camera moveEnd — NO data fetching, just update occlusion
      moveEndHandler = () => {
        if (viewerRef.current) {
          const height = viewerRef.current.camera.positionCartographic.height;
          cameraHeightRef.current = height;
          if (globalDotCollectionRef.current) {
            filterVisibleGlobalDots(globalDotCollectionRef.current, viewerRef.current.scene, aviationFiltersRef.current);
          }
          updateAircraftVisualMode();
        }
      };

      viewer.camera.percentageChanged = 0.05;
      viewer.camera.changed.addEventListener(changedHandler);
      viewer.camera.moveEnd.addEventListener(moveEndHandler);

      // Click handler — branch logic lives in apps/web/src/CesiumGlobe/picking.ts
      // (W4-F). The ScreenSpaceEventHandler lifetime is bound to the
      // viewer (implicit cleanup via viewer.destroy() in the effect
      // cleanup below).
      const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction(
        createPickClickHandler({
          viewer,
          onObjectSelectRef,
          setSelectedAircraft,
          setSelectedEarthquake,
          setSelectedSatellite,
          onWeatherSelectRef,
          onNewsSelectRef,
          onEnergyFeatureSelect,
        }),
        ScreenSpaceEventType.LEFT_CLICK,
      );
    } catch (err) {
      console.error('Cesium failed to initialize:', err);
      setError(err instanceof Error ? err.message : String(err));
    }

    return () => {
      if (typeof stopFpsCounter !== 'undefined') stopFpsCounter();
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
       // applyRafRef and drRafRef cleanup now lives in
       // useLiveAircraftRenderer's own effect cleanups (W4-G).
       aircraftMapRef.current.clear();
       aircraftCollectionRef.current = null;
      if (bordersDataSourceRef.current && viewerRef.current) {
        viewerRef.current.scene.primitives.remove(bordersDataSourceRef.current);
      }
      bordersDataSourceRef.current = null;
    };
  }, []);

  // Resident aviation cache: layer ON/OFF, retry preload on viewerReady,
  // and filter-change visibility update. Owned by useResidentAviationCache.
  useResidentAviationCache({
    viewerRef,
    viewerReady,
    aviationLayerActive,
    aviationFilters,
    globalDotCollectionRef,
    aviationLayerActiveRef,
    aviationFiltersRef,
    residentCacheActiveRef,
    preloadingRef,
    dotsCreatedRef,
    abortControllerRef,
    onStatsChangeRef,
    fpsRef,
  });

  // Live aircraft renderer (W4-G): snapshot apply loop, delta handler,
  // dead-reckoning animation, layer-OFF cleanup. The returned
  // `updateAircraftVisualMode` is invoked from the viewer-init camera
  // listener (above) to swap each aircraft billboard between icon and
  // dot modes when the camera height crosses the icon-view threshold.
  const { updateAircraftVisualMode } = useLiveAircraftRenderer({
    viewerRef,
    viewerReady,
    liveAircraftLayerActive,
    aircraftCollectionRef,
    aircraftMapRef,
    pendingSnapshotRef,
    applyingRef,
    applyRafRef,
    drRafRef,
    cameraHeightRef,
    onAircraftSnapshotRef,
    onAircraftDeltaRef,
    onAircraftRenderedRef,
    onGetBboxRef2,
    onSnapshotCbRef,
    onDeltaCbRef,
    setSelectedAircraft,
  });

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
      const currentHeight = viewer.camera.positionCartographic?.height;
      const targetHeight = airportFlyHeight(currentHeight);
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

  // Live aircraft renderer (WO-079H) lives in apps/web/src/CesiumGlobe/
  // useLiveAircraftRenderer.ts (W4-G). The hook is mounted near the
  // top of the component body, right after useResidentAviationCache.

  // Layer 05: Render satellites and debris on the globe (WO-082E).
  // Dots (satellites) → PointPrimitiveCollection for performance.
  // Triangles (debris/rocket_body) → Entity with PointGraphics (larger, distinct).
  // Clear all markers when layer is OFF.
  useEffect(() => {
    const dotColl = satelliteDotCollectionRef.current;
    const ds = satelliteEntityDataSourceRef.current;
    if (!dotColl || !ds) return;

    // Clear previous markers.
    dotColl.removeAll();
    ds.entities.removeAll();

    if (!spaceSatellitesLayerActive || !spaceSatellites || spaceSatellites.length === 0) {
      if (!spaceSatellitesLayerActive) setSelectedSatellite(null);
      return;
    }

    const filters = spaceSatelliteFilters ?? DEFAULT_SATELLITE_FILTERS;
    const renderSet = getFilteredSatellites(spaceSatellites, filters);

    for (const sat of renderSet) {
      const altM = (sat.position.altitudeKm ?? 0) * 1000;
      const color = getSatelliteColor({
        ...sat,
        latitude: sat.position.latitude,
        longitude: sat.position.longitude,
        altitudeKm: sat.position.altitudeKm,
        velocityKms: sat.velocity.speedKms,
      });
      const pixelSize = getSatellitePixelSize({
        ...sat,
        latitude: sat.position.latitude,
        longitude: sat.position.longitude,
        altitudeKm: sat.position.altitudeKm,
        velocityKms: sat.velocity.speedKms,
      });
      const cesiumColor = Color.fromCssColorString(color);
      const satItem = {
        satelliteId: sat.satelliteId,
        noradId: sat.noradId,
        name: sat.name,
        objectType: sat.objectType,
        category: sat.category,
        orbitClass: sat.orbitClass,
        country: sat.country,
        launchDate: sat.launchDate,
        latitude: sat.position.latitude,
        longitude: sat.position.longitude,
        altitudeKm: sat.position.altitudeKm,
        velocityKms: sat.velocity.speedKms,
        headingDeg: sat.headingDeg,
        visualShape: sat.visualShape,
        visualColor: sat.visualColor,
        important: sat.important,
        estimatedAt: sat.estimatedAt,
        sourceId: sat.sourceId,
        sourceObjectId: sat.sourceObjectId,
        sourceAgeSeconds: sat.sourceAgeSeconds,
      };

      if (sat.visualShape === 'dot') {
        // Satellite: PointPrimitive for performance.
        const point = dotColl.add({
          position: Cartesian3.fromDegrees(sat.position.longitude, sat.position.latitude, altM),
          color: cesiumColor,
          pixelSize,
          outlineColor: sat.important ? Color.fromCssColorString('#ffffff').withAlpha(0.6) : Color.BLACK.withAlpha(0.3),
          outlineWidth: sat.important ? 2 : 1,
          scaleByDistance: undefined,
        });
        (point as any).id = { _satelliteData: satItem };
      } else {
        // Debris / rocket body: Entity with PointGraphics.
        const entity = new Entity({
          id: `satellite-${sat.satelliteId}`,
          position: new ConstantPositionProperty(
            Cartesian3.fromDegrees(sat.position.longitude, sat.position.latitude, altM),
          ),
          point: new PointGraphics({
            pixelSize: new ConstantProperty(pixelSize),
            color: new ConstantProperty(cesiumColor),
            outlineColor: new ConstantProperty(Color.BLACK.withAlpha(0.4)),
            outlineWidth: new ConstantProperty(1),
          }),
        });
        (entity as any).properties = { satelliteData: new ConstantProperty(satItem) };
        ds.entities.add(entity);
      }
    }

    viewerRef.current?.scene.requestRender();
  }, [spaceSatellites, spaceSatellitesLayerActive, spaceSatelliteFilters]);

  // Camera view bounds tracking for Layer 06 Maritime polling
  useCameraBboxReporter({
    viewerRef,
    viewerReady,
    maritimeLayerActive,
    onMaritimeBboxChange,
  });

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
      {tokenMissing && <TokenWarningOverlay />}
      {selectedAirport && popupPos && (
        <AirportMapPopup
          airport={selectedAirport}
          screenX={popupPos.x}
          screenY={popupPos.y}
          onClose={() => onObjectSelectRef.current(null)}
        />
      )}
      {selectedEarthquake && (
        <EarthquakeInfoOverlay
          earthquake={selectedEarthquake}
          onClose={() => setSelectedEarthquake(null)}
        />
      )}
      {selectedAircraft && (
        <AircraftInfoOverlay
          aircraft={selectedAircraft}
          onClose={() => setSelectedAircraft(null)}
        />
      )}
      {selectedSatellite && (
        <SatelliteInfoOverlay
          satellite={selectedSatellite}
          onClose={() => setSelectedSatellite(null)}
        />
      )}
      <EnergyInfrastructureLayer
        dataSource={energyInfrastructureDataSourceRef.current}
        features={energyInfrastructureFeatures ?? []}
        active={energyInfrastructureLayerActive ?? false}
      />
      <MaritimeLayer
        viewer={viewerRef.current}
        vessels={maritimeVessels ?? []}
        active={maritimeLayerActive ?? false}
      />
      <WeatherLayer
        viewer={viewerRef.current}
        items={weatherItems ?? []}
        active={weatherLayerActive ?? false}
      />
      <NewsLayer
        viewer={viewerRef.current}
        markers={newsMarkers ?? []}
        active={newsLayerActive ?? false}
      />
    </div>
  );
};

export default CesiumGlobe;
