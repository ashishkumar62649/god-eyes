import { useEffect, useRef, useState } from 'react';
import type { AircraftLatest } from '@god-eyes/contracts';
import { fetchLiveAircraft } from './api';

const POLL_INTERVAL_MS = 5000;
export const RENDER_CAP = 20000;

export type LiveAircraftPhase =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'ok'; aircraft: AircraftLatest[]; total: number; updatedAt: number }
  | { phase: 'empty'; updatedAt: number }
  | { phase: 'error'; message: string };

/**
 * Polls the GOD EYES live aircraft API every 5s while `active` is true.
 * - Requests limit=20000; renders at most RENDER_CAP aircraft.
 * - Skips a tick if the previous request is still in flight (no overlap).
 * - Aborts and stops polling when `active` is false or on unmount.
 * BBox is global by default (-180,-90,180,90); kept here so it can be
 * upgraded to a camera-derived viewport later without touching callers.
 */
export function useLiveAircraft(active: boolean, bbox?: string): LiveAircraftPhase {
  const [state, setState] = useState<LiveAircraftPhase>({ phase: 'idle' });
  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!active) {
      abortRef.current?.abort();
      inFlightRef.current = false;
      setState({ phase: 'idle' });
      return;
    }

    let cancelled = false;
    setState((prev) => (prev.phase === 'ok' || prev.phase === 'empty' ? prev : { phase: 'loading' }));

    const poll = () => {
      // In-flight guard: never overlap requests.
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      fetchLiveAircraft({ bbox, limit: RENDER_CAP }, ctrl.signal)
        .then((res) => {
          if (cancelled || ctrl.signal.aborted) return;
          const all = res.aircraft ?? [];
          if (all.length === 0) {
            setState({ phase: 'empty', updatedAt: Date.now() });
          } else {
            setState({
              phase: 'ok',
              aircraft: all.slice(0, RENDER_CAP),
              total: all.length,
              updatedAt: Date.now(),
            });
          }
        })
        .catch((err: Error) => {
          if (cancelled || err.name === 'AbortError') return;
          setState({ phase: 'error', message: err.message || 'Failed to load live aircraft.' });
        })
        .finally(() => {
          inFlightRef.current = false;
        });
    };

    poll();
    const intervalId = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      abortRef.current?.abort();
      inFlightRef.current = false;
    };
  }, [active, bbox]);

  return state;
}
