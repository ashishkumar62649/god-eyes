// useSpaceSatellitesSocket.ts — WO-082E
// WebSocket hook for Layer 05 Space & Satellites live stream.
// Mirrors useLiveAircraftSocket pattern.

import { useEffect, useRef, useState } from 'react';
import type { SpaceSatelliteItem } from '@god-eyes/contracts';
import type { SpaceSatellitesStatus } from './satelliteTypes';
import { INITIAL_SPACE_STATUS } from './satelliteTypes';

export type SatelliteSnapshotCallback = (satellites: SpaceSatelliteItem[]) => void;

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000];

function getWsUrl(): string {
  const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:4000';
  return apiBase.replace(/^http/, 'ws') + '/ws/space/satellites/live';
}

export function useSpaceSatellitesSocket(
  active: boolean,
  onSnapshot: SatelliteSnapshotCallback,
): SpaceSatellitesStatus {
  const [status, setStatus] = useState<SpaceSatellitesStatus>(INITIAL_SPACE_STATUS);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const onSnapshotRef = useRef(onSnapshot);
  const activeRef = useRef(active);

  useEffect(() => { onSnapshotRef.current = onSnapshot; });
  useEffect(() => { activeRef.current = active; });

  useEffect(() => {
    if (!active) {
      cleanup();
      setStatus(INITIAL_SPACE_STATUS);
      return;
    }

    connect();
    return cleanup;

    function connect() {
      if (wsRef.current) return;

      setStatus((prev) => ({
        ...prev,
        phase: reconnectAttemptRef.current > 0 ? 'reconnecting' : 'connecting',
      }));

      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        ws.send(JSON.stringify({ type: 'space.satellites.subscribe' }));
      };

      ws.onmessage = (evt) => {
        let msg: any;
        try { msg = JSON.parse(evt.data as string); } catch { return; }

        switch (msg.type) {
          case 'space.satellites.snapshot': {
            const satellites: SpaceSatelliteItem[] = msg.satellites ?? [];
            onSnapshotRef.current(satellites);
            setStatus((prev) => ({
              ...prev,
              phase: 'live',
              count: satellites.length,
              lastSuccessAt: Date.now(),
              errorMessage: '',
            }));
            break;
          }
          case 'space.satellites.error':
            setStatus((prev) => ({ ...prev, phase: 'error', errorMessage: msg.message ?? 'Server error' }));
            break;
          case 'pong':
            break;
        }
      };

      ws.onerror = () => {
        setStatus((prev) => ({ ...prev, phase: 'error', errorMessage: 'WebSocket error' }));
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (!activeRef.current) return;
        const delay = RECONNECT_DELAYS[Math.min(reconnectAttemptRef.current, RECONNECT_DELAYS.length - 1)];
        reconnectAttemptRef.current++;
        setStatus((prev) => ({ ...prev, phase: 'reconnecting' }));
        reconnectTimerRef.current = setTimeout(() => {
          if (activeRef.current) connect();
        }, delay);
      };
    }

    function cleanup() {
      if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      reconnectAttemptRef.current = 0;
    }
  }, [active]);

  return status;
}
