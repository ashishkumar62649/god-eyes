import { FastifyInstance } from 'fastify';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'node:http';
import {
  LiveAircraftBroadcaster,
  CompactAircraft,
  filterByBBox,
  determineRemoves,
  ClientView,
  SnapshotData,
  DeltaData,
} from '../lib/live-aircraft-broadcaster.js';

interface SubscribeMsg {
  type: 'subscribe';
  layer?: string;
  bbox?: [number, number, number, number];
  mode?: string;
}

interface BBoxMsg {
  type: 'bbox';
  bbox: [number, number, number, number];
}

interface PingMsg {
  type: 'ping';
}

type ClientMessage = SubscribeMsg | BBoxMsg | PingMsg;

const GLOBAL_BBOX: [number, number, number, number] = [-180, -90, 180, 90];

function sendJson(ws: WebSocket, data: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function isBBoxValid(v: unknown): v is [number, number, number, number] {
  if (!Array.isArray(v) || v.length !== 4) return false;
  return v.every((n) => typeof n === 'number' && !isNaN(n));
}

function validateBBox(b: [number, number, number, number]): boolean {
  const [minLon, minLat, maxLon, maxLat] = b;
  return (
    minLon >= -180 && maxLon <= 180 &&
    minLat >= -90 && maxLat <= 90 &&
    minLon < maxLon && minLat < maxLat
  );
}

function sendSnapshot(
  ws: WebSocket,
  snapshot: SnapshotData,
  bbox: [number, number, number, number],
  view: ClientView,
): void {
  const filtered = bbox === GLOBAL_BBOX
    ? snapshot.aircraft
    : filterByBBox(snapshot.aircraft, bbox);
  view.lastVisibleIds = new Set(filtered.map((a) => a.id));

  sendJson(ws, {
    type: 'aircraft.snapshot',
    source: snapshot.sourceName,
    sourceId: snapshot.sourceId,
    snapshotId: snapshot.snapshotId,
    snapshotTime: snapshot.snapshotTime,
    aircraftCount: filtered.length,
    aircraft: filtered,
  });
}

function buildDeltaForClient(
  delta: DeltaData,
  bbox: [number, number, number, number],
  view: ClientView,
  currentMap: Map<string, CompactAircraft>,
): { upserts: CompactAircraft[]; removes: string[]; aircraftCount: number } {
  let upserts: CompactAircraft[];
  let removes: string[];
  let currVisible: Set<string>;

  if (bbox === GLOBAL_BBOX) {
    upserts = delta.upserts;
    currVisible = new Set(currentMap.keys());
    removes = determineRemoves(view.lastVisibleIds, currVisible);
    view.lastVisibleIds = currVisible;
  } else {
    upserts = filterByBBox(delta.upserts, bbox);
    currVisible = new Set(
      Array.from(currentMap.keys()).filter((id) => {
        const ac = currentMap.get(id);
        return ac && ac.lat !== null && ac.lon !== null &&
          ac.lon >= bbox[0] && ac.lon <= bbox[2] &&
          ac.lat >= bbox[1] && ac.lat <= bbox[3];
      }),
    );
    removes = [
      ...delta.removes,
      ...determineRemoves(view.lastVisibleIds, currVisible),
    ];
    view.lastVisibleIds = currVisible;
  }

  return { upserts, removes: [...new Set(removes)], aircraftCount: currentMap.size };
}

export function attachLiveAircraftWebSocket(
  fastify: FastifyInstance,
  broadcaster?: LiveAircraftBroadcaster,
): { broadcaster: LiveAircraftBroadcaster; wss: WebSocketServer } {
  const bc = broadcaster ?? new LiveAircraftBroadcaster();
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Map<WebSocket, { bbox: [number, number, number, number]; view: ClientView }>();

  wss.on('connection', (ws: WebSocket) => {
    const state = {
      bbox: GLOBAL_BBOX as [number, number, number, number],
      view: { lastVisibleIds: new Set<string>() },
    };
    clients.set(ws, state);

    sendJson(ws, { type: 'aircraft.ready', serverTime: new Date().toISOString() });

    const snap = bc.getLatestSnapshot();
    if (snap) sendSnapshot(ws, snap, state.bbox, state.view);

    ws.on('message', (raw: Buffer) => {
      try {
        const data = JSON.parse(raw.toString('utf-8'));
        if (typeof data?.type !== 'string') {
          sendJson(ws, { type: 'aircraft.error', code: 'INVALID_MESSAGE', message: 'Invalid message format' });
          return;
        }
        switch (data.type) {
          case 'subscribe': {
            if (isBBoxValid(data.bbox) && validateBBox(data.bbox)) {
              state.bbox = data.bbox;
            } else {
              state.bbox = GLOBAL_BBOX;
            }
            state.view.lastVisibleIds = new Set();
            const snap = bc.getLatestSnapshot();
            if (snap) sendSnapshot(ws, snap, state.bbox, state.view);
            break;
          }
          case 'bbox': {
            if (!isBBoxValid(data.bbox) || !validateBBox(data.bbox)) {
              sendJson(ws, { type: 'aircraft.error', code: 'INVALID_BBOX', message: 'Invalid bbox format' });
              return;
            }
            state.bbox = data.bbox;
            state.view.lastVisibleIds = new Set();
            const snap = bc.getLatestSnapshot();
            if (snap) sendSnapshot(ws, snap, state.bbox, state.view);
            break;
          }
          case 'ping':
            sendJson(ws, { type: 'pong', serverTime: new Date().toISOString() });
            break;
          default:
            sendJson(ws, { type: 'aircraft.error', code: 'UNKNOWN_TYPE', message: `Unknown message type: ${data.type}` });
        }
      } catch {
        sendJson(ws, { type: 'aircraft.error', code: 'PARSE_ERROR', message: 'Failed to parse message JSON' });
      }
    });

    ws.on('close', () => clients.delete(ws));
    ws.on('error', () => clients.delete(ws));
  });

  bc.onReady = (serverTime: string) => {
    for (const ws of wss.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        sendJson(ws, { type: 'aircraft.ready', serverTime });
      }
    }
  };

  bc.onSnapshot = (snapshot) => {
    for (const ws of wss.clients) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const state = clients.get(ws);
      if (!state) continue;
      sendSnapshot(ws, snapshot, state.bbox, state.view);
    }
  };

  bc.onDelta = (delta) => {
    for (const ws of wss.clients) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const state = clients.get(ws);
      if (!state) continue;
      const result = buildDeltaForClient(delta, state.bbox, state.view, bc.getCurrentMap());
      sendJson(ws, {
        type: 'aircraft.delta',
        source: delta.sourceName,
        sourceId: delta.sourceId,
        snapshotId: delta.snapshotId,
        snapshotTime: delta.snapshotTime,
        upserts: result.upserts,
        removes: result.removes,
        aircraftCount: result.aircraftCount,
      });
    }
  };

  bc.onError = (err) => {
    for (const ws of wss.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        sendJson(ws, { type: 'aircraft.error', code: err.code, message: err.message });
      }
    }
  };

  bc.start();
  return { broadcaster: bc, wss };
}

export function upgradeWebSocket(fastify: FastifyInstance, wss: WebSocketServer): void {
  const server = fastify.server;
  if (!server) return;
  server.on('upgrade', (req: IncomingMessage, socket, head) => {
    if (req.url === '/ws/aviation/aircraft/live') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } else {
      socket.destroy();
    }
  });
}
