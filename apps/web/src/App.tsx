import React, { useState, useEffect, useCallback, useRef } from 'react';
import CesiumGlobe from './CesiumGlobe';
import Shell from './components/Shell';
import { AirportObject, AirportDetailResponse } from '@god-eyes/contracts';
import { SearchResult } from './lib/searchTypes';
import { fetchAirportDetail } from './lib/api';
import { AviationFilters, DEFAULT_AVIATION_FILTERS } from './lib/aviationCategories';

const CACHE_DURATION_MS = 5 * 60 * 1000;

interface DetailCache {
  data: AirportDetailResponse;
  timestamp: number;
}

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
}

const App: React.FC = () => {
  const [isBooting, setIsBooting] = useState(true);
  const [aviationLayerActive, setAviationLayerActive] = useState(false);
  const [selectedObject, setSelectedObject] = useState<AirportObject | null>(null);
  const [airportDetail, setAirportDetail] = useState<AirportDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [aviationStats, setAviationStats] = useState<AviationStats>({
    loaded: 0, visible: 0, clustersActive: false, renderMode: 'SMART_LOD_STRATEGIC', fps: 0,
  });
  const [cameraTarget, setCameraTarget] = useState<{
    position: { latitude: number; longitude: number };
    type: string;
    timestamp: number;
  } | null>(null);
  const [aviationFilters, setAviationFilters] = useState<AviationFilters>(DEFAULT_AVIATION_FILTERS);

  const abortControllerRef = useRef<AbortController | null>(null);
  const detailCacheRef = useRef<Map<string, DetailCache>>(new Map());

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsBooting(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!selectedObject) {
      setAirportDetail(null);
      setDetailError(null);
      return;
    }

    const airportId = selectedObject.id;
    const now = Date.now();

    const cached = detailCacheRef.current.get(airportId);
    if (cached && now - cached.timestamp < CACHE_DURATION_MS) {
      setAirportDetail(cached.data);
      setDetailLoading(false);
      setDetailError(null);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setDetailLoading(true);
    setDetailError(null);
    setAirportDetail(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

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

    return () => controller.abort();
  }, [selectedObject?.id]);

  const handleObjectSelect = useCallback((obj: unknown) => {
    setSelectedObject(obj as AirportObject);
  }, []);

  const handleAviationStatsChange = useCallback((stats: AviationStats) => {
    setAviationStats(stats);
  }, []);

  const handleSearchResultSelect = useCallback((result: SearchResult) => {
    if (result.type === 'Airport' && result.rawData) {
      setAviationLayerActive(true);
      setSelectedObject(result.rawData);
    } else {
      setSelectedObject(null);
    }
    setCameraTarget({
      position: result.position,
      type: result.type,
      timestamp: Date.now(),
    });
  }, []);

  const handleFiltersChange = useCallback((filters: AviationFilters) => {
    setAviationFilters(filters);
  }, []);

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
      />

      <div style={{
        opacity: isBooting ? 0 : 1,
        transition: 'opacity 1s ease-in',
        pointerEvents: isBooting ? 'none' : 'auto',
      }}>
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
        />
      </div>
    </div>
  );
};

export default App;
