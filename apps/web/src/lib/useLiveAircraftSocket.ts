/**
 * useLiveAircraftSocket — WO-080B
 * Replaces the old REST polling useLiveAircraft hook.
 * Connects to GOD EYES WebSocket endpoint and delivers snapshots/deltas
 * via callback refs (no React re-render per message).
 */
import { useEffect, useRef, useState } from 'react';
import type { AircraftLatest } from '@god-eyes/contracts';

export const RENDER_CAP = 20000;

export interface LiveAircraftStatus {
  phase: 'idle' | 'connecting' | 'live' | 'reconnecting' | 'error' | 'empty';
  renderedCount: number;
  totalReceived: number;
  lastSuccessAt: number;
  errorMessage: string;
}

export type SnapshotCallback = (aircraft: AircraftLatest[]) => void;
export type DeltaCallback = (upsert: AircraftLatest[], removes: string[]) => void;

const INITIAL_STATUS: LiveAircraftStatus = {
  phase: 'idle', renderedCount: 0, totalReceived: 0, lastSuccessAt: 0, errorMessage: '',
};

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000];

function getWsUrl(): string {
  const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:4000';
  return apiBase.replace(/^http/, 'ws') + '/ws/aviation/aircraft/live';
}

export function useLiveAircraftSocket(
  active: boolean,
  onSnapshot: SnapshotCallback,
  onDelta: DeltaCallback,
  /** Ref that will be populated with a sendBboxUpdate function. */
  sendBboxRef: React.MutableRefObject<((bbox: [number, number, number, number]) => void) | null>,
): LiveAircraftStatus {
  const [status, setStatus] = useState<LiveAircraftStatus>(INITIAL_STATUS);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const onSnapshotRef = useRef(onSnapshot);
  const onDeltaRef = useRef(onDelta);
  const activeRef = useRef(active);

  useEffect(() => { onSnapshotRef.current = onSnapshot; });
  useEffect(() => { onDeltaRef.current = onDelta; });
  useEffect(() => { activeRef.current = active; });

  useEffect(() => {
    if (!active) {
      cleanup();
      setStatus(INITIAL_STATUS);
      sendBboxRef.current = null;
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

      // Expose bbox sender immediately (works once open).
      sendBboxRef.current = (bbox: [number, number, number, number]) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'bbox', bbox }));
        }
      };

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        ws.send(JSON.stringify({
          type: 'subscribe',
          layer: 'layer_01_aviation.live_aircraft',
          bbox: [-180, -90, 180, 90],
          mode: 'global',
        }));
        setStatus((prev) => ({ ...prev, phase: 'connecting', errorMessage: '' }));
      };

      ws.onmessage = (evt) => {
        let msg: any;
        try { msg = JSON.parse(evt.data as string); } catch { return; }

        switch (msg.type) {
          case 'aircraft.ready':
            setStatus((prev) => ({ ...prev, phase: 'live' }));
            break;

          case 'aircraft.snapshot': {
            const all: AircraftLatest[] = msg.aircraft ?? [];
            onSnapshotRef.current(all.slice(0, RENDER_CAP));
            setStatus((prev) => ({
              ...prev,
              phase: 'live',
              totalReceived: all.length,
              lastSuccessAt: Date.now(),
              errorMessage: '',
            }));
            break;
          }

          case 'aircraft.delta': {
            onDeltaRef.current(msg.upsert ?? [], msg.removes ?? []);
            setStatus((prev) => ({ ...prev, phase: 'live', lastSuccessAt: Date.now(), errorMessage: '' }));
            break;
          }

          case 'aircraft.error':
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
        sendBboxRef.current = null;
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
