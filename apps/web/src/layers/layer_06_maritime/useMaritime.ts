import { useState, useEffect, useRef, useCallback } from 'react';
import type { MaritimeVesselObject, MaritimeStatsResponse } from '@god-eyes/contracts';
import { fetchMaritimeObjects, fetchMaritimeStats } from './maritimeApi';

interface MaritimeFilters {
  search: string;
  vesselType: string | null;
}

interface UseMaritimeResult {
  vessels: MaritimeVesselObject[];
  stats: MaritimeStatsResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

function validateBbox(bboxStr: string | null): string | null {
  if (!bboxStr) return null;
  const parts = bboxStr.split(',').map(Number);
  if (parts.length !== 4) return null;
  const [minLon, minLat, maxLon, maxLat] = parts;

  // Verify all parts are finite numbers
  if (parts.some((p) => !isFinite(p))) return null;

  // Check latitude ranges
  if (minLat < -90 || minLat > 90 || maxLat < -90 || maxLat > 90) return null;

  // Check longitude ranges
  if (minLon < -180 || minLon > 180 || maxLon < -180 || maxLon > 180) return null;

  // Check min/max sanity
  if (minLat >= maxLat) return null;

  // Check dateline crossing (minLon >= maxLon is not supported by API bbox parser)
  if (minLon >= maxLon) return null;

  return bboxStr;
}

export function useMaritime(
  active: boolean,
  bbox: string | null,
  filters: MaritimeFilters
): UseMaritimeResult {
  const [vessels, setVessels] = useState<MaritimeVesselObject[]>([]);
  const [stats, setStats] = useState<MaritimeStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setFetchKey] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!active) {
      setVessels([]);
      setStats(null);
      setLoading(false);
      setError(null);
      abortControllerRef.current?.abort();
      return;
    }

    const fetchData = async () => {
      // Recreate AbortController for this fetch cycle
      abortControllerRef.current?.abort();
      const ctrl = new AbortController();
      abortControllerRef.current = ctrl;

      setLoading(true);
      setError(null);

      const validBbox = validateBbox(bbox);

      try {
        const objectsPromise = fetchMaritimeObjects(
          {
            bbox: validBbox,
            vessel_type: filters.vesselType,
            search: filters.search || null,
            limit: validBbox ? 2000 : 1000, // global query fallback is capped at 1000
          },
          ctrl.signal
        );

        const statsPromise = fetchMaritimeStats(ctrl.signal);

        const [objectsData, statsData] = await Promise.all([objectsPromise, statsPromise]);

        if (ctrl.signal.aborted) return;

        setVessels(objectsData.objects || []);
        setStats(statsData);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return; // Suppress abort error
        }
        console.error('Failed to fetch maritime data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch maritime data');
        setVessels([]);
        setStats(null);
      } finally {
        if (!ctrl.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    // Start 30-second REST polling interval
    const intervalId = setInterval(fetchData, 30000);

    return () => {
      clearInterval(intervalId);
      abortControllerRef.current?.abort();
    };
  }, [active, bbox, filters.search, filters.vesselType, refreshKey]);

  return {
    vessels,
    stats,
    loading,
    error,
    refresh,
  };
}
