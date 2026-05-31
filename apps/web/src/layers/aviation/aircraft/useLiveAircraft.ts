import { useEffect, useRef, useState } from 'react';
import type { AircraftLatest } from '@god-eyes/contracts';
import { fetchLiveAircraft } from '../../../lib/api';

const POLL_INTERVAL_MS = 5000;
export const RENDER_CAP = 20000;

/** Scalars exposed to React for status display only — no aircraft array in state. */
export interface LiveAircraftStatus {
  phase: 'idle' | 'loading' | 'updating' | 'ok' | 'empty' | 'error';
  renderedCount: number;
  totalReceived: number;
  lastSuccessAt: number; // ms epoch, 0 if never
  errorMessage: string;
}

export type SnapshotCallback = (aircraft: AircraftLatest[]) => void;

const INITIAL_STATUS: LiveAircraftStatus = {
  phase: 'idle',
  renderedCount: 0,
  totalReceived: 0,
  lastSuccessAt: 0,
  errorMessage: '',
};

/**
 * Polls the GOD EYES live aircraft API every 5s while `active` is true.
 *
 * Snapshots are delivered via `onSnapshot` callback ref — NOT via React state —
 * so no React re-render occurs on each poll. React state is updated only for
 * the cheap status scalars used by the UI.
 *
 * Stable snapshot model:
 * - On loading/error, previous visible aircraft are kept (no count reset to 0).
 * - Only a real empty successful response clears aircraft.
 * - `renderedCount` is set by the renderer after it finishes applying the snapshot.
 *
 * Camera bbox:
 * - `getBbox` is called on each poll tick to get the current camera viewport.
 * - Falls back to global bbox if null/undefined.
 */
export function useLiveAircraft(
  active: boolean,
  onSnapshot: SnapshotCallback,
  getBbox?: () => string | null,
): LiveAircraftStatus {
  const [status, setStatus] = useState<LiveAircraftStatus>(INITIAL_STATUS);
  const onSnapshotRef = useRef(onSnapshot);
  const getBboxRef = useRef(getBbox);
  const inFlightRef = useRef(false);

  // Keep refs current without re-running the effect.
  useEffect(() => { onSnapshotRef.current = onSnapshot; });
  useEffect(() => { getBboxRef.current = getBbox; });

  useEffect(() => {
    if (!active) {
      inFlightRef.current = false;
      setStatus(INITIAL_STATUS);
      return;
    }

    let cancelled = false;

    // Show loading only on first activation (no previous good data).
    setStatus((prev) =>
      prev.lastSuccessAt === 0 ? { ...prev, phase: 'loading' } : { ...prev, phase: 'updating' },
    );

    const poll = () => {
      if (inFlightRef.current) return; // skip tick if previous request still running
      inFlightRef.current = true;

      const bbox = getBboxRef.current?.() ?? '-180,-90,180,90';

      fetchLiveAircraft({ bbox, limit: RENDER_CAP })
        .then((res) => {
          if (cancelled) return;
          const all = res.aircraft ?? [];
          const capped = all.slice(0, RENDER_CAP);
          if (all.length === 0) {
            // Genuine empty response — clear aircraft.
            onSnapshotRef.current([]);
            setStatus({
              phase: 'empty',
              renderedCount: 0,
              totalReceived: 0,
              lastSuccessAt: Date.now(),
              errorMessage: '',
            });
          } else {
            onSnapshotRef.current(capped);
            setStatus((prev) => ({
              phase: 'ok',
              renderedCount: prev.renderedCount, // renderer updates this separately
              totalReceived: all.length,
              lastSuccessAt: Date.now(),
              errorMessage: '',
            }));
          }
        })
        .catch((err: Error) => {
          if (cancelled || err.name === 'AbortError') return;
          // Keep previous aircraft visible; only update status.
          setStatus((prev) => ({
            ...prev,
            phase: 'error',
            errorMessage: err.message || 'API unavailable',
          }));
        })
        .finally(() => {
          inFlightRef.current = false;
        });
    };

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
      inFlightRef.current = false;
    };
  }, [active]);

  return status;
}
