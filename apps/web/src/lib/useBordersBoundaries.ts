import { useEffect, useRef, useState } from 'react';
import type { BordersBoundariesFeatureCollection } from '@god-eyes/contracts';
import { fetchBordersBoundariesCountries } from './api';

export type BordersPhase =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'ok'; data: BordersBoundariesFeatureCollection }
  | { phase: 'error'; message: string };

export function useBordersBoundaries(active: boolean): BordersPhase {
  const [state, setState] = useState<BordersPhase>({ phase: 'idle' });
  const cacheRef = useRef<BordersBoundariesFeatureCollection | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!active) {
      abortRef.current?.abort();
      setState({ phase: 'idle' });
      return;
    }
    if (cacheRef.current) {
      setState({ phase: 'ok', data: cacheRef.current });
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState({ phase: 'loading' });
    fetchBordersBoundariesCountries({ limit: 250, simplify: 0.08 }, ctrl.signal)
      .then((res) => {
        if (ctrl.signal.aborted) return;
        cacheRef.current = res;
        setState({ phase: 'ok', data: res });
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        setState({ phase: 'error', message: err.message || 'Failed to load borders.' });
      });
    return () => ctrl.abort();
  }, [active]);

  return state;
}
