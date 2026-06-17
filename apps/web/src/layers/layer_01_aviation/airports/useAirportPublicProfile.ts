import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAirportPublicProfile } from '../../../lib/api';
import type {
  AirportPublicProfileResponse,
  PublicProfileData,
  PublicProfileAttribution,
} from './airportPublicProfileTypes';

export type ProfilePhase =
  | { phase: 'loading' }
  | { phase: 'fetching' }
  | { phase: 'ok'; data: PublicProfileData; attribution: PublicProfileAttribution | null; fetchedAt: string }
  | { phase: 'stale'; data: PublicProfileData; attribution: PublicProfileAttribution | null; fetchedAt: string }
  | { phase: 'no_profile_found' }
  | { phase: 'low_confidence'; data: PublicProfileData; attribution: PublicProfileAttribution | null }
  | { phase: 'error'; message: string };

export function useAirportPublicProfile(airportId: string | null) {
  const [state, setState] = useState<ProfilePhase>({ phase: 'loading' });
  const [fetchKey, setFetchKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  // Track whether the current fetchKey increment is a poll tick (true) or a fresh load (false).
  const isPollRef = useRef(false);

  const retry = useCallback(() => {
    isPollRef.current = false; // retry = fresh load, show loading spinner
    setFetchKey(k => k + 1);
  }, []);

  // Airport change: reset state and mark as fresh load.
  useEffect(() => {
    isPollRef.current = false;
    setFetchKey(0);
  }, [airportId]);

  // Auto-poll every 3 s while the backend is still building the profile.
  // Uses a stable interval — does NOT depend on state object reference.
  useEffect(() => {
    if (state.phase !== 'fetching') return;
    const id = setInterval(() => {
      isPollRef.current = true; // poll tick — keep showing "fetching", don't flash loading
      setFetchKey(k => k + 1);
    }, 3000);
    return () => clearInterval(id);
  }, [state.phase]);

  // Fetch effect — runs on airport change or fetchKey increment.
  useEffect(() => {
    if (!airportId) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // Only show the loading spinner on a fresh airport load, not on poll ticks.
    if (!isPollRef.current) {
      setState({ phase: 'loading' });
    }

    fetchAirportPublicProfile(airportId, ctrl.signal)
      .then((res: AirportPublicProfileResponse) => {
        if (ctrl.signal.aborted) return;
        const { status, profile, fetchedAt, attribution } = res;
        switch (status) {
          case 'ok':
            setState({ phase: 'ok', data: profile!, attribution, fetchedAt: fetchedAt! });
            break;
          case 'stale':
            setState({ phase: 'stale', data: profile!, attribution, fetchedAt: fetchedAt! });
            break;
          case 'fetching':
            setState({ phase: 'fetching' });
            break;
          case 'no_profile_found':
            setState({ phase: 'no_profile_found' });
            break;
          case 'low_confidence_match':
            setState({ phase: 'low_confidence', data: profile!, attribution });
            break;
          default:
            setState({ phase: 'error', message: 'Unexpected response from server.' });
        }
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        setState({ phase: 'error', message: err.message });
      });

    return () => ctrl.abort();
  }, [airportId, fetchKey]);

  return { state, retry };
}
