import { useEffect, useRef, useState } from 'react';
import { getAirportIntelligence } from '../../../lib/api';
import type { AirportIntelligenceResponse } from './airportIntelligenceTypes';

export type IntelPhase =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'ok'; data: AirportIntelligenceResponse }
  | { phase: 'no_data' }
  | { phase: 'not_found' }
  | { phase: 'unavailable'; message: string }
  | { phase: 'error'; message: string };

export function useAirportIntelligence(airportId: string | null): IntelPhase {
  const [state, setState] = useState<IntelPhase>({ phase: 'idle' });
  // Track which airportId the current in-flight request is for, to discard stale responses.
  const requestIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!airportId) {
      setState({ phase: 'idle' });
      requestIdRef.current = null;
      abortRef.current?.abort();
      return;
    }

    // Abort any previous in-flight request.
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    requestIdRef.current = airportId;

    setState({ phase: 'loading' });

    getAirportIntelligence(airportId, ctrl.signal)
      .then((res) => {
        // Discard if a newer selection has already started.
        if (requestIdRef.current !== airportId) return;
        if (ctrl.signal.aborted) return;

        if (res.status === 'no_data') {
          setState({ phase: 'no_data' });
        } else if (res.status === 'error') {
          setState({ phase: 'error', message: 'Airport intelligence error.' });
        } else {
          setState({ phase: 'ok', data: res });
        }
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        if (requestIdRef.current !== airportId) return;
        const msg = err.message ?? '';
        if (msg.includes('404')) {
          setState({ phase: 'not_found' });
        } else if (msg.includes('503') || msg.includes('network') || msg.includes('fetch')) {
          setState({ phase: 'unavailable', message: 'Airport intelligence unavailable.' });
        } else {
          setState({ phase: 'error', message: msg || 'Unknown error.' });
        }
      });

    return () => ctrl.abort();
  }, [airportId]);

  return state;
}
