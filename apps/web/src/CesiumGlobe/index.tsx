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
  getAircraftAltitudeColor,
  getAircraftMarkerImage,
  getAircraftMarkerImageAsync,
  getAircraftDotMarkerImage,
  resolveAircraftIconName,
  getAircraftHeadingDeg,
  headingToBillboardRotation,
  AIRCRAFT_BILLBOARD_SCALE,
} from '../layers/layer_01_aviation/aircraft/aircraftMarker';
import { RENDER_CAP } from '../layers/layer_01_aviation/aircraft/useLiveAircraftSocket';
import type { SnapshotCallback } from '../layers/layer_01_aviation/aircraft/useLiveAircraftSocket';
import {
  filterVisibleGlobalDots,
} from '../layers/layer_01_aviation/airports/aviationGlobalRenderer';
import { useFpsCounter } from '../globe/useFpsCounter';
import { setupCesiumToken } from '../globe/setupCesiumToken';
import { configureViewerScene } from '../globe/configureViewerScene';
import { createViewerOptions } from '../globe/viewerOptions';

import { AIRCRAFT_ICON_VIEW_HEIGHT_METERS } from './constants';
import { airportFlyHeight } from './helpers';
import { createPickClickHandler } from './picking';
import { useCameraBboxReporter } from './useCameraBboxReporter';
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
