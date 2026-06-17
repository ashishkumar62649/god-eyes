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
  Billboard,
} from 'cesium';
import "cesium/Build/Cesium/Widgets/widgets.css";
import AirportMapPopup from './components/intel/AirportMapPopup';
import { AircraftInfoOverlay } from './components/overlays/AircraftInfoOverlay';
import { EarthquakeInfoOverlay } from './components/overlays/EarthquakeInfoOverlay';
import { TokenWarningOverlay } from './components/overlays/TokenWarningOverlay';
import { SatelliteInfoOverlay } from './components/overlays/SatelliteInfoOverlay';
import type { AirportObject, EarthEvent, BordersBoundariesFeatureCollection, AircraftLatest, SpaceSatelliteItem, MaritimeVesselObject } from '@god-eyes/contracts';
import type { AirportLayoutFeaturesResponse } from './layers/layer_01_aviation/airports/airportLayoutTypes';
import type { EnergyFeature } from './layers/layer_10_energy_infrastructure/infrastructure/energyInfrastructureTypes';
import EnergyInfrastructureLayer from './layers/layer_10_energy_infrastructure/infrastructure/EnergyInfrastructureLayer';
import MaritimeLayer from './layers/layer_06_maritime/MaritimeLayer';
import WeatherLayer from './layers/layer_07_weather/WeatherLayer';
import type { WeatherRenderItem } from './layers/layer_07_weather/weatherTypes';
import NewsLayer from './layers/layer_08_news_osint/NewsLayer';
import type { NewsRenderMarker } from './layers/layer_08_news_osint/newsTypes';
import { getSatelliteColor, getSatellitePixelSize } from './layers/layer_05_space_satellites/satellites/satelliteColors';
import type { SatelliteFrontendItem } from './layers/layer_05_space_satellites/satellites/satelliteTypes';
import { getFilteredSatellites, DEFAULT_SATELLITE_FILTERS } from './layers/layer_05_space_satellites/satellites/satelliteFilters';
import type { SatelliteFilters } from './layers/layer_05_space_satellites/satellites/satelliteFilters';

import {
  fetchAllAviationCategories,
} from './layers/layer_01_aviation/airports/aviationPreloader';
import { isPositionVisible } from './globe/cesiumVisibility';
import {
  getAircraftAltitudeColor,
  getAircraftMarkerImage,
  getAircraftMarkerImageAsync,
  getAircraftDotMarkerImage,
  resolveAircraftIconName,
  getAircraftHeadingDeg,
  headingToBillboardRotation,
  AIRCRAFT_BILLBOARD_SCALE,
} from './layers/layer_01_aviation/aircraft/aircraftMarker';
import { RENDER_CAP } from './layers/layer_01_aviation/aircraft/useLiveAircraftSocket';
import type { SnapshotCallback } from './layers/layer_01_aviation/aircraft/useLiveAircraftSocket';
import {
  AviationFilters,
} from './layers/layer_01_aviation/airports/aviationCategories';
import {
  createGlobalDotCollection,
  addAllDotsToCollection,
  isGlobalDot,
  getGlobalDotPosition,
  filterVisibleGlobalDots,
} from './layers/layer_01_aviation/airports/aviationGlobalRenderer';
import {
  getAllObjects,
} from './layers/layer_01_aviation/airports/aviationObjectStore';
import { useFpsCounter } from './globe/useFpsCounter';
import { setupCesiumToken } from './globe/setupCesiumToken';
import { configureViewerScene } from './globe/configureViewerScene';
import { createViewerOptions } from './globe/viewerOptions';

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
  bordersData?: BordersBoundariesFeatureCollection | null;
  /** Callback ref: called by useLiveAircraftSocket with each new snapshot (no React re-render). */
  onAircraftSnapshot?: SnapshotCallback;
  onAircraftDelta?: (upsert: AircraftLatest[], removes: string[]) => void;
  /** Ref CesiumGlobe populates with the actual snapshot renderer function. */
  onSnapshotCbRef?: React.MutableRefObject<SnapshotCallback | undefined>;
  /** Ref CesiumGlobe populates with the actual delta renderer function. */
  onDeltaCbRef?: React.MutableRefObject<((upsert: AircraftLatest[], removes: string[]) => void) | undefined>;
  /** Called by the renderer to report rendered count back to the hook/status. */
  onAircraftRendered?: (count: number) => void;
  liveAircraftLayerActive?: boolean;
  /** Returns current camera bbox as [minLon,minLat,maxLon,maxLat], or null for global fallback. */
  onGetBbox?: () => [number, number, number, number] | null;
  /** Ref that CesiumGlobe populates with its bbox getter (for WS bbox updates). */
  onGetBboxRef?: React.MutableRefObject<(() => [number, number, number, number] | null) | undefined>;
  /** Layer 05: Space & Satellites */
  spaceSatellites?: SpaceSatelliteItem[];
  spaceSatellitesLayerActive?: boolean;
  spaceSatelliteFilters?: SatelliteFilters;
  /** Layer 10: Energy Infrastructure */
  energyInfrastructureFeatures?: EnergyFeature[];
  energyInfrastructureLayerActive?: boolean;
  onEnergyFeatureSelect?: (feature: EnergyFeature | null) => void;
  maritimeLayerActive?: boolean;
  maritimeVessels?: MaritimeVesselObject[];
  onMaritimeBboxChange?: (bbox: string | null) => void;
  /** Layer 07: Weather */
  weatherLayerActive?: boolean;
  weatherItems?: WeatherRenderItem[];
  onWeatherSelect?: (item: WeatherRenderItem | null) => void;
  /** Layer 08: News & OSINT */
  newsLayerActive?: boolean;
  newsMarkers?: NewsRenderMarker[];
  onNewsSelect?: (item: NewsRenderMarker | null) => void;
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
  const AIRCRAFT_ICON_VIEW_HEIGHT_METERS = 2_500_000;
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
  interface AircraftRecord {
    billboard: Billboard;
    currLat: number;
    currLon: number;
    currAltM: number;
    currPos: Cartesian3;
    currTime: number;
    staleAfter: number;
    // Dead reckoning fields (display-only, never written back as real data).
    speedKt: number;       // 0 = unknown/ground
    trackDeg: number;      // NaN = unknown
    verticalRateFpm: number; // 0 = unknown
    onGround: boolean;
  }
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

  function shouldShowAircraftIcons(): boolean {
    return cameraHeightRef.current <= AIRCRAFT_ICON_VIEW_HEIGHT_METERS;
  }

  function getAircraftVisualImage(color: string, iconName: string): string {
    if (!shouldShowAircraftIcons()) {
      return getAircraftDotMarkerImage(color);
    }
    return getAircraftMarkerImage(iconName, color);
  }

  function updateAircraftVisualMode(): void {
    if (!aircraftMapRef.current.size) return;
    for (const record of aircraftMapRef.current.values()) {
      const ac = (record.billboard.id as any)?._aircraftData as AircraftLatest | undefined;
      if (!ac) continue;
      const color = getAircraftAltitudeColor(ac);
      const iconName = resolveAircraftIconName(ac);
      const image = getAircraftVisualImage(color, iconName);
      record.billboard.image = image;
      if (shouldShowAircraftIcons()) {
        getAircraftMarkerImageAsync(iconName, color).then((img) => {
          const currentAircraft = (record.billboard.id as any)?._aircraftData as AircraftLatest | undefined;
          if (currentAircraft?.sourceObjectId === ac.sourceObjectId && shouldShowAircraftIcons() && img !== image) {
            record.billboard.image = img;
          }
        });
      }
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
          // Check if it's a live aircraft billboard pick.
          if (pickedObject.id && typeof pickedObject.id === 'object' && (pickedObject.id as any)._aircraftData) {
            const ac = (pickedObject.id as any)._aircraftData as AircraftLatest;
            const pos = Cartesian3.fromDegrees(ac.lon!, ac.lat!, 0);
            if (isPositionVisible(viewer!, pos)) {
              setSelectedAircraft(ac);
            }
          } else if (pickedObject.id && typeof pickedObject.id === 'object' && (pickedObject.id as any)._vesselData) {
            const vessel = (pickedObject.id as any)._vesselData as MaritimeVesselObject;
            const pos = Cartesian3.fromDegrees(vessel.longitude, vessel.latitude, 0);
            if (isPositionVisible(viewer!, pos)) {
              onObjectSelectRef.current(vessel);
            }
          } else if (pickedObject.id && typeof pickedObject.id === 'object' && (pickedObject.id as any)._weatherData) {
            const weatherItem = (pickedObject.id as any)._weatherData as WeatherRenderItem;
            const pos = Cartesian3.fromDegrees(weatherItem.longitude, weatherItem.latitude, 0);
            if (isPositionVisible(viewer!, pos)) {
              onWeatherSelectRef.current?.(weatherItem);
            }
          } else if (pickedObject.id && typeof pickedObject.id === 'object' && (pickedObject.id as any)._newsData) {
            const newsItem = (pickedObject.id as any)._newsData as NewsRenderMarker;
            if (typeof newsItem.latitude === 'number' && typeof newsItem.longitude === 'number') {
              const pos = Cartesian3.fromDegrees(newsItem.longitude, newsItem.latitude, 0);
              if (isPositionVisible(viewer!, pos)) {
                onNewsSelectRef.current?.(newsItem);
              }
            }
          } else {
            onObjectSelectRef.current(null);
          }
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

        // Satellite triangle entity click (WO-082E)
        if (entity.properties && entity.properties.satelliteData) {
          const sat = entity.properties.satelliteData.getValue() as SatelliteFrontendItem;
          setSelectedSatellite(sat);
          return;
        }
        
        // Energy infrastructure feature click
        if (entity.id && typeof entity.id === 'string' && entity.id.startsWith('energy-')) {
          const energyFeature = entity.properties?.rawData?.getValue() as EnergyFeature;
          if (energyFeature) {
            onEnergyFeatureSelect?.(energyFeature);
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
      if (applyRafRef.current) cancelAnimationFrame(applyRafRef.current);
      if (drRafRef.current) cancelAnimationFrame(drRafRef.current);
      aircraftMapRef.current.clear();
      aircraftCollectionRef.current = null;
      if (bordersDataSourceRef.current && viewerRef.current) {
        viewerRef.current.scene.primitives.remove(bordersDataSourceRef.current);
      }
      bordersDataSourceRef.current = null;
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

  // Live aircraft renderer (WO-079H).
  // Architecture:
  //   - Snapshots arrive via onAircraftSnapshot callback (no React re-render per poll).
  //   - Applied in chunked rAF batches (CHUNK_SIZE per frame) to keep globe responsive.
  //   - BillboardCollection (single primitive) instead of Entity per aircraft.
  //   - Interpolation: CallbackProperty lerps between prev/curr observed positions.
  //   - Apply-guard: only one apply loop runs at a time; new snapshot queues as pending.
  //   - Camera bbox: onGetBbox() called by the hook on each poll tick.
  useEffect(() => {
    if (!viewerReady) return;

    const CHUNK_SIZE = 500;

    // Wire the snapshot callback so the hook can deliver data without React re-render.
    const snapshotHandler: SnapshotCallback = (aircraft: AircraftLatest[]) => {
      pendingSnapshotRef.current = aircraft;
      if (!applyingRef.current) startApply();
    };
    onAircraftSnapshotRef.current = snapshotHandler;
    // Also populate the external ref so App.tsx can forward WS snapshots here.
    if (onSnapshotCbRef) onSnapshotCbRef.current = snapshotHandler;

    function startApply() {
      const snapshot = pendingSnapshotRef.current;
      if (!snapshot) return;
      pendingSnapshotRef.current = null;
      applyingRef.current = true;

      const coll = aircraftCollectionRef.current;
      if (!coll) { applyingRef.current = false; return; }

      const map = aircraftMapRef.current;

      // Build the set of valid aircraft to apply.
      const valid: AircraftLatest[] = [];
      for (const ac of snapshot) {
        if (ac.lat === null || ac.lon === null) continue;
        // Do NOT filter by staleAfter — WS stream is source of truth for liveness.
        valid.push(ac);
        if (valid.length >= RENDER_CAP) break;
      }

      const seen = new Set<string>();
      let i = 0;

      function applyChunk() {
        const end = Math.min(i + CHUNK_SIZE, valid.length);
        for (; i < end; i++) {
          const ac = valid[i];
          const key = ac.sourceObjectId;
          seen.add(key);

          const heading = getAircraftHeadingDeg(ac);
          const color = getAircraftAltitudeColor(ac);
          // Support both WS wire field (altitudeFt) and contract field (altitudeBaroFt).
          const altitudeFt = typeof (ac as any).altitudeFt === 'number' ? (ac as any).altitudeFt
            : typeof ac.altitudeBaroFt === 'number' ? ac.altitudeBaroFt : 0;
          const altMeters = Math.max(0, altitudeFt * 0.3048);
          const newPos = Cartesian3.fromDegrees(ac.lon!, ac.lat!, altMeters);
          const rotation = heading !== null ? headingToBillboardRotation(heading) : 0;
          const iconName = resolveAircraftIconName(ac);
          const image: string = getAircraftVisualImage(color, iconName);
          const obsTime = new Date(ac.observedAt).getTime();
          const staleMs = ac.staleAfter ? new Date(ac.staleAfter).getTime() : 0;
          // Support both WS wire field (speedKt) and contract field (groundSpeedKt).
          const speedKt = typeof (ac as any).speedKt === 'number' ? (ac as any).speedKt
            : typeof ac.groundSpeedKt === 'number' ? ac.groundSpeedKt : 0;

          const existing = map.get(key);
          if (existing) {
            existing.currPos = newPos;
            existing.currLat = ac.lat!;
            existing.currLon = ac.lon!;
            existing.currAltM = altMeters;
            existing.currTime = obsTime;
            existing.staleAfter = staleMs;
            existing.speedKt = speedKt;
            existing.trackDeg = ac.trackDeg ?? (ac as any).headingDeg ?? ac.headingTrueDeg ?? NaN;
            existing.verticalRateFpm = ac.verticalRateFpm ?? 0;
            existing.onGround = ac.onGround ?? false;
            existing.billboard.position = newPos;
            existing.billboard.image = image;
            existing.billboard.color = Color.WHITE;
            existing.billboard.rotation = rotation;
            (existing.billboard.id as any)._aircraftData = ac;
            // Async update: swap to real SVG once loaded.
            if (shouldShowAircraftIcons()) {
              getAircraftMarkerImageAsync(iconName, color).then((img) => {
                if (existing.billboard && shouldShowAircraftIcons() && img !== image) existing.billboard.image = img;
              });
            }
          } else {
            const idObj: { _aircraftData: AircraftLatest } = { _aircraftData: ac };
            const billboard = coll!.add({
              image,
              color: Color.WHITE,
              scale: AIRCRAFT_BILLBOARD_SCALE,
              rotation,
              alignedAxis: Cartesian3.ZERO,
              position: newPos,
              id: idObj,
            });
            map.set(key, {
              billboard,
              currLat: ac.lat!,
              currLon: ac.lon!,
              currAltM: altMeters,
              currPos: newPos,
              currTime: obsTime,
              staleAfter: staleMs,
              speedKt,
              trackDeg: ac.trackDeg ?? (ac as any).headingDeg ?? ac.headingTrueDeg ?? NaN,
              verticalRateFpm: ac.verticalRateFpm ?? 0,
              onGround: ac.onGround ?? false,
            });
            // Async update: swap to real SVG once loaded.
            if (shouldShowAircraftIcons()) {
              getAircraftMarkerImageAsync(iconName, color).then((img) => {
                if (billboard && shouldShowAircraftIcons() && img !== image) billboard.image = img;
              });
            }
          }
        }

        if (i < valid.length) {
          // More chunks to process.
          applyRafRef.current = requestAnimationFrame(applyChunk);
          return;
        }

        // All valid aircraft applied. Remove gone/stale markers.
        for (const [key, rec] of map) {
          if (!seen.has(key)) {
            coll!.remove(rec.billboard);
            map.delete(key);
          }
        }

        applyingRef.current = false;
        onAircraftRenderedRef.current?.(map.size);
        viewerRef.current?.scene.requestRender();
        // Debug: log once per snapshot apply (not per frame).
        if (import.meta.env.DEV) {
          const first = valid[0];
          console.log('[AIRCRAFT] snapshot applied', map.size, 'billboards; collection.length=', coll!.length,
            first ? `first: lon=${first.lon} lat=${first.lat} alt=${first.altitudeBaroFt}ft` : '');
        }
        if (pendingSnapshotRef.current) startApply();
      }

      applyRafRef.current = requestAnimationFrame(applyChunk);
    }

    // Wire the bbox callback so the hook can get the current camera viewport.
    onGetBboxRef2.current = () => {
      const viewer = viewerRef.current;
      if (!viewer) return null;
      try {
        const rect = viewer.camera.computeViewRectangle();
        if (!rect) return null;
        const toDeg = (r: number) => r * (180 / Math.PI);
        const bbox: [number, number, number, number] = [
          toDeg(rect.west), toDeg(rect.south), toDeg(rect.east), toDeg(rect.north),
        ];
        // Validate before returning.
        if (bbox.some((v) => !isFinite(v))) return null;
        return bbox;
      } catch {
        return null;
      }
    };

    return () => {
      if (applyRafRef.current) cancelAnimationFrame(applyRafRef.current);
      applyingRef.current = false;
    };
  }, [viewerReady]);

  // Clear all live aircraft markers when the layer is turned OFF (WO-079H).
  useEffect(() => {
    if (liveAircraftLayerActive) return;
    if (applyRafRef.current) { cancelAnimationFrame(applyRafRef.current); applyRafRef.current = 0; }
    applyingRef.current = false;
    pendingSnapshotRef.current = null;
    const coll = aircraftCollectionRef.current;
    const map = aircraftMapRef.current;
    if (coll) {
      for (const rec of map.values()) {
        rec.billboard.show = false;
      }
    }
    map.clear();
    setSelectedAircraft(null);
  }, [liveAircraftLayerActive]);

  // Wire delta handler: upsert/remove individual aircraft without full snapshot apply.
  useEffect(() => {
    if (!viewerReady) return;
    const deltaHandler = (upsert: AircraftLatest[], removes: string[]) => {
      const coll = aircraftCollectionRef.current;
      const map = aircraftMapRef.current;
      if (!coll) return;

      let updatedCount = 0;

      // Upsert changed/new aircraft.
      for (const ac of upsert) {
        if (ac.lat === null || ac.lon === null) continue;
        const key = ac.sourceObjectId;
        const heading = getAircraftHeadingDeg(ac);
        const color = getAircraftAltitudeColor(ac);
        const altitudeFt = typeof (ac as any).altitudeFt === 'number' ? (ac as any).altitudeFt
          : typeof ac.altitudeBaroFt === 'number' ? ac.altitudeBaroFt : 0;
        const altMeters = Math.max(0, altitudeFt * 0.3048);
        const newPos = Cartesian3.fromDegrees(ac.lon, ac.lat, altMeters);
        const obsTime = new Date(ac.observedAt).getTime();
        const staleMs = ac.staleAfter ? new Date(ac.staleAfter).getTime() : 0;
        const iconName = resolveAircraftIconName(ac);
        const image = getAircraftVisualImage(color, iconName);
        const rotation = heading !== null ? headingToBillboardRotation(heading) : 0;
        const speedKt = typeof (ac as any).speedKt === 'number' ? (ac as any).speedKt
          : typeof ac.groundSpeedKt === 'number' ? ac.groundSpeedKt : 0;

        const existing = map.get(key);
        if (existing) {
          const oldLon = existing.currLon;
          const oldLat = existing.currLat;
          existing.currPos = newPos;
          existing.currLat = ac.lat;
          existing.currLon = ac.lon;
          existing.currAltM = altMeters;
          existing.currTime = obsTime;
          existing.staleAfter = staleMs;
          existing.speedKt = speedKt;
          existing.trackDeg = ac.trackDeg ?? (ac as any).headingDeg ?? ac.headingTrueDeg ?? NaN;
          existing.verticalRateFpm = ac.verticalRateFpm ?? 0;
          existing.onGround = ac.onGround ?? false;
          existing.billboard.position = newPos;
          existing.billboard.image = image;
          existing.billboard.color = Color.WHITE;
          existing.billboard.rotation = rotation;
          (existing.billboard.id as any)._aircraftData = ac;
          updatedCount++;
          if (import.meta.env.DEV && updatedCount === 1) {
            console.log(`[AIRCRAFT DELTA] moved ${key}: lon ${oldLon} → ${ac.lon}, lat ${oldLat} → ${ac.lat}`);
          }
          if (shouldShowAircraftIcons()) {
            getAircraftMarkerImageAsync(iconName, color).then((img) => {
              if (existing.billboard && shouldShowAircraftIcons() && img !== image) existing.billboard.image = img;
            });
          }
        } else {
          const idObj: { _aircraftData: AircraftLatest } = { _aircraftData: ac };
          const billboard = coll.add({
            image, color: Color.WHITE, scale: AIRCRAFT_BILLBOARD_SCALE, rotation, alignedAxis: Cartesian3.ZERO,
            position: newPos, id: idObj,
          });
          map.set(key, {
            billboard,
            currLat: ac.lat,
            currLon: ac.lon,
            currAltM: altMeters,
            currPos: newPos,
            currTime: obsTime,
            staleAfter: staleMs,
            speedKt,
            trackDeg: ac.trackDeg ?? (ac as any).headingDeg ?? ac.headingTrueDeg ?? NaN,
            verticalRateFpm: ac.verticalRateFpm ?? 0,
            onGround: ac.onGround ?? false,
          });
          if (shouldShowAircraftIcons()) {
            getAircraftMarkerImageAsync(iconName, color).then((img) => {
              if (billboard && shouldShowAircraftIcons() && img !== image) billboard.image = img;
            });
          }
          updatedCount++;
        }
      }

      // Remove aircraft explicitly listed.
      for (const key of removes) {
        const rec = map.get(key);
        if (rec) { coll.remove(rec.billboard); map.delete(key); }
      }

      if (import.meta.env.DEV) {
        console.log(`[AIRCRAFT DELTA] upserts=${upsert.length} removes=${removes.length} billboardsUpdated=${updatedCount} total=${map.size}`);
      }

      if (updatedCount > 0 || removes.length > 0) {
        viewerRef.current?.scene.requestRender();
      }
      onAircraftRenderedRef.current?.(map.size);
    };
    onAircraftDeltaRef.current = deltaHandler;
    if (onDeltaCbRef) onDeltaCbRef.current = deltaHandler;
  }, [viewerReady]);

  // Dead reckoning animation loop (WO-080B).
  // Runs at ~20 FPS when live aircraft layer is active.
  // Moves each aircraft billboard along its track using speed/heading and elapsed time.
  // Display-only: never writes predicted position back into AircraftRecord real data.
  useEffect(() => {
    if (!liveAircraftLayerActive || !viewerReady) {
      if (drRafRef.current) { cancelAnimationFrame(drRafRef.current); drRafRef.current = 0; }
      return;
    }

    const DR_MAX_SECS = 10;
    const KNOTS_TO_MPS = 0.514444;
    const FPM_TO_MPS = 0.00508;
    let lastFrameMs = 0;
    const FRAME_INTERVAL = 50; // ~20 FPS

    function drFrame(ts: number) {
      drRafRef.current = requestAnimationFrame(drFrame);
      if (ts - lastFrameMs < FRAME_INTERVAL) return;
      lastFrameMs = ts;

      const coll = aircraftCollectionRef.current;
      const map = aircraftMapRef.current;
      if (!coll || map.size === 0) return;

      const nowMs = Date.now();
      let moved = 0;

      for (const [, rec] of map) {
        if (rec.onGround) continue;
        if (!isFinite(rec.trackDeg) || rec.speedKt <= 0) continue;

        const elapsedSecs = Math.min(DR_MAX_SECS, (nowMs - rec.currTime) / 1000);
        if (elapsedSecs <= 0) continue;

        // Compute dead-reckoned position from currPos along trackDeg.
        const distM = rec.speedKt * KNOTS_TO_MPS * elapsedSecs;
        const trackRad = (rec.trackDeg * Math.PI) / 180;
        const cart = rec.currPos;
        const lon = Math.atan2(cart.y, cart.x);
        const lat = Math.atan2(cart.z, Math.sqrt(cart.x * cart.x + cart.y * cart.y));
        const R = 6371000;
        const dLat = (distM * Math.cos(trackRad)) / R;
        const dLon = (distM * Math.sin(trackRad)) / (R * Math.cos(lat));
        const newLat = lat + dLat;
        const newLon = lon + dLon;
        const altM = rec.currAltM;
        const drAlt = Math.max(0, altM + rec.verticalRateFpm * FPM_TO_MPS * elapsedSecs);

        const drPos = Cartesian3.fromRadians(newLon, newLat, drAlt);
        if (rec.billboard.show !== false) {
          rec.billboard.position = drPos;
          moved++;
        }
      }

      if (moved > 0) {
        viewerRef.current?.scene.requestRender();
      }
    }

    drRafRef.current = requestAnimationFrame(drFrame);
    return () => { if (drRafRef.current) { cancelAnimationFrame(drRafRef.current); drRafRef.current = 0; } };
  }, [liveAircraftLayerActive, viewerReady]);


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
  useEffect(() => {
    if (!viewerReady || !maritimeLayerActive || !onMaritimeBboxChange) {
      if (onMaritimeBboxChange) {
        onMaritimeBboxChange(null);
      }
      return;
    }

    const viewer = viewerRef.current;
    if (!viewer) return;

    const reportBbox = () => {
      try {
        const rect = viewer.camera.computeViewRectangle();
        if (!rect) {
          onMaritimeBboxChange(null);
          return;
        }
        const toDeg = (r: number) => r * (180 / Math.PI);
        const minLon = toDeg(rect.west);
        const minLat = toDeg(rect.south);
        const maxLon = toDeg(rect.east);
        const maxLat = toDeg(rect.north);

        // Sanity check coordinates are finite and correct
        if ([minLon, minLat, maxLon, maxLat].every(isFinite)) {
          if (
            minLon >= -180 && minLon <= 180 &&
            maxLon >= -180 && maxLon <= 180 &&
            minLat >= -90 && minLat <= 90 &&
            maxLat >= -90 && maxLat <= 90 &&
            minLat < maxLat &&
            minLon < maxLon // Omit dateline crossings
          ) {
            const bboxStr = `${minLon.toFixed(6)},${minLat.toFixed(6)},${maxLon.toFixed(6)},${maxLat.toFixed(6)}`;
            onMaritimeBboxChange(bboxStr);
            return;
          }
        }
        onMaritimeBboxChange(null); // Fallback to global query
      } catch (e) {
        console.warn('Failed to compute bbox for Maritime:', e);
        onMaritimeBboxChange(null);
      }
    };

    // Report initial bbox when layer becomes active
    reportBbox();

    viewer.camera.moveEnd.addEventListener(reportBbox);
    return () => {
      if (viewer && !viewer.isDestroyed()) {
        viewer.camera.moveEnd.removeEventListener(reportBbox);
      }
    };
  }, [viewerReady, maritimeLayerActive, onMaritimeBboxChange]);

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
