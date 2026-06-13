import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchCurrentWeather } from './weatherApi';
import {
  mapObservationsToRenderItems,
  WEATHER_ATTRIBUTION,
  type WeatherRenderItem,
} from './weatherTypes';

export interface UseWeatherResult {
  items: WeatherRenderItem[];
  count: number;
  loading: boolean;
  error: string | null;
  /** True once a fetch has completed and produced zero renderable items. */
  empty: boolean;
  attribution: string;
  refresh: () => void;
}

// Conservative polling: refresh every 10 minutes while active.
const POLL_INTERVAL_MS = 10 * 60 * 1000;
const DEFAULT_LIMIT = 2000;

/**
 * REST hook for current weather observations.
 *
 * Loads once when the layer becomes active, then polls conservatively.
 * Clears all state when inactive. Calls only the GOD EYES API.
 */
export function useWeather(active: boolean): UseWeatherResult {
  const [items, setItems] = useState<WeatherRenderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);
  const [attribution, setAttribution] = useState<string>(WEATHER_ATTRIBUTION);
  const [refreshKey, setRefreshKey] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!active) {
      setItems([]);
      setLoading(false);
      setError(null);
      setEmpty(false);
      abortControllerRef.current?.abort();
      return;
    }

    const fetchData = async () => {
      abortControllerRef.current?.abort();
      const ctrl = new AbortController();
      abortControllerRef.current = ctrl;

      setLoading(true);
      setError(null);

      try {
        const response = await fetchCurrentWeather({ limit: DEFAULT_LIMIT }, ctrl.signal);
        if (ctrl.signal.aborted) return;

        const mapped = mapObservationsToRenderItems(response?.data);
        setItems(mapped);
        setEmpty(mapped.length === 0);
        if (response?.meta?.attribution) {
          setAttribution(response.meta.attribution);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        console.error('Failed to fetch weather data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch weather data');
        setItems([]);
        setEmpty(false);
      } finally {
        if (!ctrl.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    const intervalId = setInterval(fetchData, POLL_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
      abortControllerRef.current?.abort();
    };
  }, [active, refreshKey]);

  return {
    items,
    count: items.length,
    loading,
    error,
    empty,
    attribution,
    refresh,
  };
}
