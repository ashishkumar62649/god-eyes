import React, { useState, useEffect, useCallback, useRef } from 'react';
import CesiumGlobe from './CesiumGlobe';
import Shell from './components/Shell';
import { AirportObject, AirportDetailResponse } from '@god-eyes/contracts';
import type { AircraftLatest, SpaceSatelliteItem, MaritimeVesselObject, MaritimeVesselDetail } from '@god-eyes/contracts';
import { SearchResult } from './lib/searchTypes';
import { fetchAirportDetail } from './lib/api';
import { AviationFilters, DEFAULT_AVIATION_FILTERS } from './layers/aviation/airports/aviationCategories';
import { useAirportLayoutFeatures } from './layers/aviation/airports/useAirportLayoutFeatures';
import { useEarthEvents } from './layers/earth-events/useEarthEvents';
import { useBordersBoundaries } from './layers/borders/useBordersBoundaries';
import { useLiveAircraftSocket, LiveAircraftStatus } from './layers/aviation/aircraft/useLiveAircraftSocket';
import { useSpaceSatellitesSocket } from './layers/space/satellites/useSpaceSatellitesSocket';
import type { SpaceSatellitesStatus } from './layers/space/satellites/satelliteTypes';
import { DEFAULT_SATELLITE_FILTERS } from './layers/space/satellites/satelliteFilters';
import type { SatelliteFilters } from './layers/space/satellites/satelliteFilters';
import { EnergyFilters, DEFAULT_ENERGY_FILTERS, EnergyFeature } from './layers/energy/infrastructure/energyInfrastructureTypes';
import { useEnergyInfrastructure } from './layers/energy/infrastructure/useEnergyInfrastructure';
import { useMaritime } from './layers/maritime/useMaritime';
import { fetchVesselDetail } from './layers/maritime/maritimeApi';
import { useWeather } from './layers/layer_07_weather/useWeather';
import type { WeatherRenderItem } from './layers/layer_07_weather/weatherTypes';

const CACHE_DURATION_MS = 5 * 60 * 1000;

interface DetailCache { data: AirportDetailResponse; timestamp: number; }
interface AviationStats {
  loaded: number; visible: number; clustersActive: boolean; renderMode: string; fps: number;
}

const App: React.FC = () => {
  const [isBooting, setIsBooting] = useState(true);
  const [aviationLayerActive, setAviationLayerActive] = useState(false);
  const [earthEventsLayerActive, setEarthEventsLayerActive] = useState(false);
  const [bordersLayerActive, setBordersLayerActive] = useState(false);
  const [liveAircraftLayerActive, setLiveAircraftLayerActive] = useState(false);
  const [spaceSatellitesLayerActive, setSpaceSatellitesLayerActive] = useState(false);
  const [spaceSatellites, setSpaceSatellites] = useState<SpaceSatelliteItem[]>([]);
  const [spaceSatelliteFilters, setSpaceSatelliteFilters] = useState<SatelliteFilters>(DEFAULT_SATELLITE_FILTERS);
  const [selectedObject, setSelectedObject] = useState<AirportObject | MaritimeVesselObject | null>(null);
  const [airportDetail, setAirportDetail] = useState<AirportDetailResponse | null>(null);
  const [vesselDetail, setVesselDetail] = useState<MaritimeVesselDetail | null>(null);
  const [maritimeLayerActive, setMaritimeLayerActive] = useState(false);
  const [maritimeFilters, setMaritimeFilters] = useState({ search: '', vesselType: null as string | null });
  const [maritimeBbox, setMaritimeBbox] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [aviationStats, setAviationStats] = useState<AviationStats>({
    loaded: 0, visible: 0, clustersActive: false, renderMode: 'SMART_LOD_STRATEGIC', fps: 0,
  });
  const [cameraTarget, setCameraTarget] = useState<{
    position: { latitude: number; longitude: number }; type: string; timestamp: number;
  } | null>(null);
  const [aviationFilters, setAviationFilters] = useState<AviationFilters>(DEFAULT_AVIATION_FILTERS);
  const [renderedCount, setRenderedCount] = useState(0);
  const [energyInfrastructureLayerActive, setEnergyInfrastructureLayerActive] = useState(false);
  const [energyInfrastructureFilters, setEnergyInfrastructureFilters] = useState<EnergyFilters>(DEFAULT_ENERGY_FILTERS);
  const [selectedEnergyFeature, setSelectedEnergyFeature] = useState<EnergyFeature | null>(null);
  const [weatherLayerActive, setWeatherLayerActive] = useState(false);
  const [selectedWeather, setSelectedWeather] = useState<WeatherRenderItem | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const detailCacheRef = useRef<Map<string, DetailCache>>(new Map());

  // Refs for CesiumGlobe ↔ WebSocket hook bridge (no React re-render per message).
  const onSnapshotCbRef = useRef<((aircraft: AircraftLatest[]) => void) | undefined>(undefined);
  const onDeltaCbRef = useRef<((upsert: AircraftLatest[], removes: string[]) => void) | undefined>(undefined);
  const onGetBboxCbRef = useRef<(() => [number, number, number, number] | null) | undefined>(undefined);
  // sendBboxRef is populated by the socket hook; used to forward camera bbox to WS.
  const sendBboxRef = useRef<((bbox: [number, number, number, number]) => void) | null>(null);
  const bboxDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const layoutPhase = useAirportLayoutFeatures(selectedObject && 'layerId' in selectedObject && selectedObject.layerId === 'layer_06_maritime' ? null : (selectedObject?.id ?? null));
  const earthEventsPhase = useEarthEvents(earthEventsLayerActive);
  const bordersPhase = useBordersBoundaries(bordersLayerActive);
  const energyInfrastructureData = useEnergyInfrastructure(energyInfrastructureLayerActive, energyInfrastructureFilters);
  const maritimeData = useMaritime(maritimeLayerActive, maritimeBbox, maritimeFilters);
  const weatherData = useWeather(weatherLayerActive);

  // Stable wrappers that delegate to refs CesiumGlobe sets.
  const handleSnapshot = useCallback((aircraft: AircraftLatest[]) => {
    onSnapshotCbRef.current?.(aircraft);
  }, []);
  const handleDelta = useCallback((upsert: AircraftLatest[], removes: string[]) => {
    onDeltaCbRef.current?.(upsert, removes);
  }, []);
  const handleAircraftRendered = useCallback((count: number) => setRenderedCount(count), []);

  // Camera bbox: CesiumGlobe populates onGetBboxCbRef; we debounce-forward to WS.
  const handleGetBboxForWs = useCallback((): [number, number, number, number] | null => {
    const bbox = onGetBboxCbRef.current?.() ?? null;
    if (bbox && sendBboxRef.current) {
      if (bboxDebounceRef.current) clearTimeout(bboxDebounceRef.current);
      bboxDebounceRef.current = setTimeout(() => { sendBboxRef.current?.(bbox); }, 500);
    }
    return bbox;
  }, []);

  const liveAircraftStatus = useLiveAircraftSocket(
    liveAircraftLayerActive,
    handleSnapshot,
    handleDelta,
    sendBboxRef,
  );

  const liveAircraftPhase: LiveAircraftStatus = { ...liveAircraftStatus, renderedCount };

  const handleSatelliteSnapshot = useCallback((satellites: SpaceSatelliteItem[]) => {
    setSpaceSatellites(satellites);
  }, []);

  const spaceSatellitesStatus: SpaceSatellitesStatus = useSpaceSatellitesSocket(
    spaceSatellitesLayerActive,
    handleSatelliteSnapshot,
  );

  useEffect(() => {
    const timer = setTimeout(() => setIsBooting(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!selectedObject) {
      setAirportDetail(null);
      setVesselDetail(null);
      setDetailError(null);
      return;
    }

    abortControllerRef.current?.abort();
    setDetailLoading(true);
    setDetailError(null);
    setAirportDetail(null);
    setVesselDetail(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    if ('layerId' in selectedObject && selectedObject.layerId === 'layer_06_maritime') {
      const vessel = selectedObject as MaritimeVesselObject;
      fetchVesselDetail(vessel.mmsi, controller.signal)
        .then((data) => {
          setVesselDetail(data.vessel);
          setDetailLoading(false);
        })
        .catch((err: Error) => {
          if (err.name === 'AbortError') return;
          setDetailError(err.message || 'Failed to load vessel details');
          setDetailLoading(false);
        });
    } else {
      const airportId = selectedObject.id;
      const cached = detailCacheRef.current.get(airportId);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
        setAirportDetail(cached.data);
        setDetailLoading(false);
        setDetailError(null);
        return;
      }
      fetchAirportDetail(airportId, controller.signal)
        .then((data) => {
          detailCacheRef.current.set(airportId, { data, timestamp: Date.now() });
          setAirportDetail(data);
          setDetailLoading(false);
        })
        .catch((err: Error) => {
          if (err.name === 'AbortError') return;
          setDetailError(err.message || 'Failed to load details');
          setDetailLoading(false);
        });
    }

    return () => controller.abort();
  }, [selectedObject]);

  const handleObjectSelect = useCallback((obj: unknown) => setSelectedObject(obj as AirportObject | MaritimeVesselObject), []);
  const handleAviationStatsChange = useCallback((stats: AviationStats) => setAviationStats(stats), []);
  const handleSearchResultSelect = useCallback((result: SearchResult) => {
    if (result.type === 'Airport' && result.rawData) { setAviationLayerActive(true); setSelectedObject(result.rawData); }
    else setSelectedObject(null);
    setCameraTarget({ position: result.position, type: result.type, timestamp: Date.now() });
  }, []);
  const handleFiltersChange = useCallback((filters: AviationFilters) => setAviationFilters(filters), []);
  const handleEnergyFeatureClose = useCallback(() => setSelectedEnergyFeature(null), []);
  const handleWeatherSelect = useCallback((item: WeatherRenderItem | null) => setSelectedWeather(item), []);
  const handleWeatherClose = useCallback(() => setSelectedWeather(null), []);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#000' }}>
      {isBooting && (
        <div className="boot-screen">
          <div className="boot-logo"></div>
          <div className="boot-text">System Initializing...</div>
        </div>
      )}

      <CesiumGlobe
        aviationLayerActive={aviationLayerActive}
        onObjectSelect={handleObjectSelect}
        onAviationStatsChange={handleAviationStatsChange}
        cameraTarget={cameraTarget}
        aviationFilters={aviationFilters}
        selectedAirport={'layerId' in (selectedObject || {}) ? null : selectedObject as AirportObject}
        layoutFeatures={layoutPhase.phase === 'ok' ? layoutPhase.data : null}
        earthEvents={earthEventsPhase.phase === 'ok' ? earthEventsPhase.events : undefined}
        bordersData={bordersPhase.phase === 'ok' ? bordersPhase.data : null}
        onAircraftSnapshot={handleSnapshot}
        onAircraftDelta={handleDelta}
        onAircraftRendered={handleAircraftRendered}
        onGetBbox={handleGetBboxForWs}
        onGetBboxRef={onGetBboxCbRef}
        onSnapshotCbRef={onSnapshotCbRef}
        onDeltaCbRef={onDeltaCbRef}
        liveAircraftLayerActive={liveAircraftLayerActive}
        spaceSatellites={spaceSatellites}
        spaceSatellitesLayerActive={spaceSatellitesLayerActive}
        spaceSatelliteFilters={spaceSatelliteFilters}
        energyInfrastructureFeatures={energyInfrastructureData.features}
        energyInfrastructureLayerActive={energyInfrastructureLayerActive}
        onEnergyFeatureSelect={setSelectedEnergyFeature}
        maritimeLayerActive={maritimeLayerActive}
        maritimeVessels={maritimeData.vessels}
        onMaritimeBboxChange={setMaritimeBbox}
        weatherLayerActive={weatherLayerActive}
        weatherItems={weatherData.items}
        onWeatherSelect={handleWeatherSelect}
      />

      <div style={{ opacity: isBooting ? 0 : 1, transition: 'opacity 1s ease-in', pointerEvents: isBooting ? 'none' : 'auto' }}>
        <Shell
          aviationLayerActive={aviationLayerActive}
          setAviationLayerActive={setAviationLayerActive}
          selectedObject={'layerId' in (selectedObject || {}) ? null : selectedObject as AirportObject}
          airportDetail={airportDetail}
          detailLoading={detailLoading}
          detailError={detailError}
          aviationStats={aviationStats}
          onSearchResultSelect={handleSearchResultSelect}
          aviationFilters={aviationFilters}
          onFiltersChange={handleFiltersChange}
          layoutPhase={layoutPhase}
          earthEventsLayerActive={earthEventsLayerActive}
          setEarthEventsLayerActive={setEarthEventsLayerActive}
          earthEventsPhase={earthEventsPhase}
          bordersLayerActive={bordersLayerActive}
          setBordersLayerActive={setBordersLayerActive}
          bordersPhase={bordersPhase}
          liveAircraftLayerActive={liveAircraftLayerActive}
          setLiveAircraftLayerActive={setLiveAircraftLayerActive}
          liveAircraftPhase={liveAircraftPhase}
          spaceSatellitesLayerActive={spaceSatellitesLayerActive}
          setSpaceSatellitesLayerActive={setSpaceSatellitesLayerActive}
          spaceSatellitesStatus={spaceSatellitesStatus}
          spaceSatelliteFilters={spaceSatelliteFilters}
          onSpaceFiltersChange={setSpaceSatelliteFilters}
          energyInfrastructureLayerActive={energyInfrastructureLayerActive}
          setEnergyInfrastructureLayerActive={setEnergyInfrastructureLayerActive}
          energyInfrastructureFilters={energyInfrastructureFilters}
          onEnergyFiltersChange={setEnergyInfrastructureFilters}
          selectedEnergyFeature={selectedEnergyFeature}
          onEnergyFeatureClose={handleEnergyFeatureClose}
          maritimeLayerActive={maritimeLayerActive}
          setMaritimeLayerActive={setMaritimeLayerActive}
          maritimeStats={maritimeData.stats}
          maritimeFilters={maritimeFilters}
          onMaritimeFiltersChange={setMaritimeFilters}
          onMaritimeRefresh={maritimeData.refresh}
          vesselDetail={vesselDetail}
          weatherLayerActive={weatherLayerActive}
          setWeatherLayerActive={setWeatherLayerActive}
          weatherLoading={weatherData.loading}
          weatherError={weatherData.error}
          weatherEmpty={weatherData.empty}
          weatherCount={weatherData.count}
          weatherAttribution={weatherData.attribution}
          onWeatherRefresh={weatherData.refresh}
          selectedWeather={selectedWeather}
          onWeatherClose={handleWeatherClose}
        />
      </div>
    </div>
  );
};

export default App;
