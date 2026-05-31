import { useEffect, useRef, useState } from 'react';
import type { EarthEvent } from '@god-eyes/contracts';
import { fetchEarthEventsLatest } from '../../lib/api';

export type EarthEventsPhase =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'ok'; events: EarthEvent[] }
  | { phase: 'empty' }
  | { phase: 'error'; message: string };

export function useEarthEvents(active: boolean): EarthEventsPhase {
  const [state, setState] = useState<EarthEventsPhase>({ phase: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!active) {
      abortRef.current?.abort();
      setState({ phase: 'idle' });
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setState({ phase: 'loading' });

    fetchEarthEventsLatest({ limit: 200, event_type: 'earthquake' }, ctrl.signal)
      .then((res) => {
        if (ctrl.signal.aborted) return;
        if (!res.events || res.events.length === 0) {
          setState({ phase: 'empty' });
        } else {
          setState({ phase: 'ok', events: res.events });
        }
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        setState({ phase: 'error', message: err.message || 'Failed to load earth events.' });
      });

    return () => ctrl.abort();
  }, [active]);

  return state;
}
