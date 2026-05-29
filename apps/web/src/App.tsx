import React, { useState, useEffect, useCallback, useRef } from 'react';
import CesiumGlobe from './CesiumGlobe';
import Shell from './components/Shell';
import { AirportObject, AirportDetailResponse } from '@god-eyes/contracts';
import type { AircraftLatest } from '@god-eyes/contracts';
import { SearchResult } from './lib/searchTypes';
import { fetchAirportDetail } from './lib/api';
import { AviationFilters, DEFAULT_AVIATION_FILTERS } from './lib/aviationCategories';
import { useAirportLayoutFeatures } from './lib/useAirportLayoutFeatures';
import { useEarthEvents } from './lib/useEarthEvents';
import { useBordersBoundaries } from './lib/useBordersBoundaries';
import { useLiveAircraftSocket, LiveAircraftStatus } from './lib/useLiveAircraftSocket';

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
  const [selectedObject, setSelectedObject] = useState<AirportObject | null>(null);
  const [airportDetail, setAirportDetail] = useState<AirportDetailResponse | null>(null);
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

  const abortControllerRef = useRef<AbortController | null>(null);
  const detailCacheRef = useRef<Map<string, DetailCache>>(new Map());

  // Refs for CesiumGlobe ↔ WebSocket hook bridge (no React re-render per message).
  const onSnapshotCbRef = useRef<((aircraft: AircraftLatest[]) => void) | undefined>(undefined);
  const onDeltaCbRef = useRef<((upsert: AircraftLatest[], removes: string[]) => void) | undefined>(undefined);
  const onGetBboxCbRef = useRef<(() => string | null) | undefined>(undefined);
  // sendBboxRef is populated by the socket hook; used to forward camera bbox to WS.
  const sendBboxRef = useRef<((bbox: string) => void) | null>(null);
  const bboxDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const layoutPhase = useAirportLayoutFeatures(selectedObject?.id ?? null);
  const earthEventsPhase = useEarthEvents(earthEventsLayerActive);
  const bordersPhase = useBordersBoundaries(bordersLayerActive);

  // Stable wrappers that delegate to refs CesiumGlobe sets.
  const handleSnapshot = useCallback((aircraft: AircraftLatest[]) => {
    onSnapshotCbRef.current?.(aircraft);
  }, []);
  const handleDelta = useCallback((upsert: AircraftLatest[], removes: string[]) => {
    onDeltaCbRef.current?.(upsert, removes);
  }, []);
  const handleAircraftRendered = useCallback((count: number) => setRenderedCount(count), []);

  // Camera bbox: CesiumGlobe populates onGetBboxCbRef; we debounce-forward to WS.
  const handleGetBboxForWs = useCallback((): string | null => {
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

  useEffect(() => {
    const timer = setTimeout(() => setIsBooting(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!selectedObject) { setAirportDetail(null); setDetailError(null); return; }
    const airportId = selectedObject.id;
    const cached = detailCacheRef.current.get(airportId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
      setAirportDetail(cached.data); setDetailLoading(false); setDetailError(null); return;
    }
    abortControllerRef.current?.abort();
    setDetailLoading(true); setDetailError(null); setAirportDetail(null);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    fetchAirportDetail(airportId, controller.signal)
      .then((data) => { detailCacheRef.current.set(airportId, { data, timestamp: Date.now() }); setAirportDetail(data); setDetailLoading(false); })
      .catch((err: Error) => { if (err.name === 'AbortError') return; setDetailError(err.message || 'Failed to load details'); setDetailLoading(false); });
    return () => controller.abort();
  }, [selectedObject?.id]);

  const handleObjectSelect = useCallback((obj: unknown) => setSelectedObject(obj as AirportObject), []);
  const handleAviationStatsChange = useCallback((stats: AviationStats) => setAviationStats(stats), []);
  const handleSearchResultSelect = useCallback((result: SearchResult) => {
    if (result.type === 'Airport' && result.rawData) { setAviationLayerActive(true); setSelectedObject(result.rawData); }
    else setSelectedObject(null);
    setCameraTarget({ position: result.position, type: result.type, timestamp: Date.now() });
  }, []);
  const handleFiltersChange = useCallback((filters: AviationFilters) => setAviationFilters(filters), []);

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
        selectedAirport={selectedObject}
        layoutFeatures={layoutPhase.phase === 'ok' ? layoutPhase.data : null}
        earthEvents={earthEventsPhase.phase === 'ok' ? earthEventsPhase.events : undefined}
        bordersData={bordersPhase.phase === 'ok' ? bordersPhase.data : null}
        onAircraftSnapshot={handleSnapshot}
        onAircraftDelta={handleDelta}
        onAircraftRendered={handleAircraftRendered}
        onGetBbox={handleGetBboxForWs}
        onGetBboxRef={onGetBboxCbRef}
        liveAircraftLayerActive={liveAircraftLayerActive}
      />

      <div style={{ opacity: isBooting ? 0 : 1, transition: 'opacity 1s ease-in', pointerEvents: isBooting ? 'none' : 'auto' }}>
        <Shell
          aviationLayerActive={aviationLayerActive}
          setAviationLayerActive={setAviationLayerActive}
          selectedObject={selectedObject}
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
        />
      </div>
    </div>
  );
};

export default App;
