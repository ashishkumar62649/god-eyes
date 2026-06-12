import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchNewsMarkers, fetchNewsItems, fetchNewsStats } from './newsApi';
import {
  mapMarkersToRenderItems,
  NEWS_ATTRIBUTION,
  DEFAULT_NEWS_FILTERS,
  type NewsRenderMarker,
  type NewsFilterState,
} from './newsTypes';
import type { NewsItem, NewsStatsResponse } from './newsTypes';

export interface UseNewsResult {
  /** Globe-ready marker items (Point + marker_ready=true). */
  markers: NewsRenderMarker[];
  markerCount: number;
  /** All list items (includes LineString/Polygon for sidebar). */
  items: NewsItem[];
  itemCount: number;
  total: number;
  stats: NewsStatsResponse | null;
  filters: NewsFilterState;
  setFilters: (f: NewsFilterState) => void;
  loading: boolean;
  error: string | null;
  empty: boolean;
  attribution: string;
  refresh: () => void;
}

const ITEMS_LIMIT = 100;

/**
 * Hook for Layer 08 data. Loads once when the layer becomes active, then
 * polls every 5 minutes. Calls only the GOD EYES API.
 */
export function useNews(active: boolean): UseNewsResult {
  const [markers, setMarkers] = useState<NewsRenderMarker[]>([]);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<NewsStatsResponse | null>(null);
  const [filters, setFilters] = useState<NewsFilterState>(DEFAULT_NEWS_FILTERS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);
  const [attribution, setAttribution] = useState<string>(NEWS_ATTRIBUTION);
  const [refreshKey, setRefreshKey] = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!active) {
      setMarkers([]);
      setItems([]);
      setTotal(0);
      setStats(null);
      setLoading(false);
      setError(null);
      setEmpty(false);
      abortRef.current?.abort();
      return;
    }

    const load = async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setLoading(true);
      setError(null);

      try {
        const [markersRes, itemsRes, statsRes] = await Promise.all([
          fetchNewsMarkers({ limit: 500 }, ctrl.signal),
          fetchNewsItems({
            limit: ITEMS_LIMIT,
            severity: filters.severity,
            subcategory: filters.subcategory,
            country: filters.country,
            markerReadyOnly: filters.markerReadyOnly,
          }, ctrl.signal),
          fetchNewsStats(ctrl.signal),
        ]);

        if (ctrl.signal.aborted) return;

        const mapped = mapMarkersToRenderItems(markersRes?.data);
        setMarkers(mapped);
        setItems(itemsRes?.data ?? []);
        setTotal(itemsRes?.meta?.total ?? itemsRes?.data?.length ?? 0);
        setStats(statsRes);
        setEmpty(mapped.length === 0 && (itemsRes?.data?.length ?? 0) === 0);

        // Use attribution from first marker or stat fallback.
        const firstAttr = markersRes?.data?.[0]?.attribution;
        if (typeof firstAttr === 'string' && firstAttr.length > 0) {
          setAttribution(firstAttr);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const msg = err instanceof Error ? err.message : 'Failed to fetch news data';
        console.error('[Layer 08] fetch error:', msg);
        setError(msg);
        setMarkers([]);
        setItems([]);
        setEmpty(false);
      } finally {
        if (!abortRef.current?.signal.aborted) setLoading(false);
      }
    };

    load();
    const intervalId = setInterval(load, 5 * 60 * 1000);
    return () => {
      clearInterval(intervalId);
      abortRef.current?.abort();
    };
  }, [active, refreshKey, filters.severity, filters.subcategory, filters.country, filters.markerReadyOnly]);

  return {
    markers,
    markerCount: markers.length,
    items,
    itemCount: items.length,
    total,
    stats,
    filters,
    setFilters,
    loading,
    error,
    empty,
    attribution,
    refresh,
  };
}
