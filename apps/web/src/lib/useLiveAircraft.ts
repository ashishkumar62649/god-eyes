import { useEffect, useRef, useState } from 'react';
import type { AircraftLatest } from '@god-eyes/contracts';
import { fetchLiveAircraft } from './api';

const POLL_INTERVAL_MS = 5000;
const MAX_AIRCRAFT = 5000;

export type LiveAircraftPhase =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'ok'; aircraft: AircraftLatest[]; updatedAt: number }
  | { phase: 'empty'; updatedAt: number }
  | { phase: 'error'; message: string };

/**
 * Polls the GOD EYES live aircraft API every 5s while `active` is true.
 * Stops polling and clears state when `active` is false.
 * BBox is global by default (-180,-90,180,90); kept here so it can be
 * upgraded to a camera-derived viewport later without touching callers.
 */
export function useLiveAircraft(active: boolean, bbox?: string): LiveAircraftPhase {
  const [state, setState] = useState<LiveAircraftPhase>({ phase: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!active) {
      abortRef.current?.abort();
      setState({ phase: 'idle' });
      return;
    }

    let cancelled = false;
    setState((prev) => (prev.phase === 'ok' || prev.phase === 'empty' ? prev : { phase: 'loading' }));

    const poll = () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      fetchLiveAircraft({ bbox, limit: MAX_AIRCRAFT }, ctrl.signal)
        .then((res) => {
          if (cancelled || ctrl.signal.aborted) return;
          const aircraft = (res.aircraft ?? []).slice(0, MAX_AIRCRAFT);
          if (aircraft.length === 0) {
            setState({ phase: 'empty', updatedAt: Date.now() });
          } else {
            setState({ phase: 'ok', aircraft, updatedAt: Date.now() });
          }
        })
        .catch((err: Error) => {
          if (cancelled || err.name === 'AbortError') return;
          setState({ phase: 'error', message: err.message || 'Failed to load live aircraft.' });
        });
    };

    poll();
    const intervalId = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      abortRef.current?.abort();
    };
  }, [active, bbox]);

  return state;
}
