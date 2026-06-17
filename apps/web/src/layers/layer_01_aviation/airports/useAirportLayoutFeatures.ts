import { useEffect, useRef, useState } from 'react';
import { getAirportLayoutFeatures } from '../../../lib/api';
import type { AirportLayoutFeaturesResponse } from './airportLayoutTypes';

export type LayoutPhase =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'ok'; data: AirportLayoutFeaturesResponse }
  | { phase: 'no_data' }
  | { phase: 'error'; message: string };

export function useAirportLayoutFeatures(airportId: string | null): LayoutPhase {
  const [state, setState] = useState<LayoutPhase>({ phase: 'idle' });
  const requestIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!airportId) {
      setState({ phase: 'idle' });
      requestIdRef.current = null;
      abortRef.current?.abort();
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    requestIdRef.current = airportId;

    setState({ phase: 'loading' });

    getAirportLayoutFeatures(airportId, ctrl.signal)
      .then((res) => {
        if (requestIdRef.current !== airportId || ctrl.signal.aborted) return;
        if (res.status === 'no_data' || res.status === 'not_found') {
          setState({ phase: 'no_data' });
        } else if (res.status === 'error') {
          setState({ phase: 'error', message: 'Layout features error.' });
        } else {
          setState({ phase: 'ok', data: res });
        }
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        if (requestIdRef.current !== airportId) return;
        setState({ phase: 'error', message: err.message || 'Unknown error.' });
      });

    return () => ctrl.abort();
  }, [airportId]);

  return state;
}
