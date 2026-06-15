// Compatibility re-export shim — SR-005C.
// REST route implementation moved to ./satellites/ folder.
// WebSocket broadcaster code remains here (out of scope for this split).
export { spaceSatellitesRoutes } from './satellites/index.js';

import { FastifyInstance } from 'fastify';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'node:http';
import {
  SpaceSatellitesBroadcaster,
  SpaceSatelliteFilter,
  applyFilters,
  buildEmptySnapshot,
} from './space-satellites-broadcaster.js';

interface SubscribeMsg { type: 'space.satellites.subscribe'; filters?: SpaceSatelliteFilter; }
interface PingMsg { type: 'ping'; }
type ClientMessage = SubscribeMsg | PingMsg;

function sendJson(ws: WebSocket, data: unknown): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

export function attachSpaceSatellitesWebSocket(
  fastify: FastifyInstance,
  broadcaster?: SpaceSatellitesBroadcaster,
): { broadcaster: SpaceSatellitesBroadcaster; wss: WebSocketServer } {
  const bc = broadcaster ?? new SpaceSatellitesBroadcaster();
  const wss = new WebSocketServer({ noServer: true });
  const clientFilters = new Map<WebSocket, SpaceSatelliteFilter>();

  wss.on('connection', (ws: WebSocket) => {
    const filters: SpaceSatelliteFilter = {};
    clientFilters.set(ws, filters);
    const snap = bc.getLatestSnapshot();
    if (snap) {
      const filtered = Object.keys(filters).length > 0 ? applyFilters(snap, filters) : snap;
      sendJson(ws, filtered);
    } else {
      sendJson(ws, buildEmptySnapshot());
    }

    ws.on('message', (raw: Buffer) => {
      try {
        const data = JSON.parse(raw.toString('utf-8'));
        if (typeof data?.type !== 'string') {
          sendJson(ws, { type: 'space.satellites.error', code: 'INVALID_MESSAGE', message: 'Invalid message format' });
          return;
        }
        switch (data.type) {
          case 'space.satellites.subscribe': {
            const newFilters: SpaceSatelliteFilter = {};
            if (data.filters) {
              if (Array.isArray(data.filters.category)) newFilters.category = data.filters.category;
              if (Array.isArray(data.filters.objectType)) newFilters.objectType = data.filters.objectType;
              if (Array.isArray(data.filters.orbitClass)) newFilters.orbitClass = data.filters.orbitClass;
              if (Array.isArray(data.filters.sourceId)) newFilters.sourceId = data.filters.sourceId;
              if (typeof data.filters.importantOnly === 'boolean') newFilters.importantOnly = data.filters.importantOnly;
              if (typeof data.filters.minAltitude === 'number') newFilters.minAltitude = data.filters.minAltitude;
              if (typeof data.filters.maxAltitude === 'number') newFilters.maxAltitude = data.filters.maxAltitude;
              if (typeof data.filters.limit === 'number') newFilters.limit = data.filters.limit;
            }
            clientFilters.set(ws, newFilters);
            const snap = bc.getLatestSnapshot();
            if (snap) { sendJson(ws, applyFilters(snap, newFilters)); } else { sendJson(ws, buildEmptySnapshot()); }
            break;
          }
          case 'ping':
            sendJson(ws, { type: 'pong', serverTime: new Date().toISOString() });
            break;
          default:
            sendJson(ws, { type: 'space.satellites.error', code: 'UNKNOWN_TYPE', message: `Unknown message type: ${data.type}` });
        }
      } catch {
        sendJson(ws, { type: 'space.satellites.error', code: 'PARSE_ERROR', message: 'Failed to parse message JSON' });
      }
    });

    ws.on('close', () => clientFilters.delete(ws));
    ws.on('error', () => clientFilters.delete(ws));
  });

  bc.onReady = (snapshot) => {
    for (const ws of wss.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        const filters = clientFilters.get(ws);
        if (filters && Object.keys(filters).length > 0) { sendJson(ws, applyFilters(snapshot, filters)); } else { sendJson(ws, snapshot); }
      }
    }
  };

  bc.onSnapshot = (snapshot) => {
    for (const ws of wss.clients) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const filters = clientFilters.get(ws);
      if (filters && Object.keys(filters).length > 0) { sendJson(ws, applyFilters(snapshot, filters)); } else { sendJson(ws, snapshot); }
    }
  };

  bc.onError = (err) => {
    for (const ws of wss.clients) {
      if (ws.readyState === WebSocket.OPEN) sendJson(ws, { type: 'space.satellites.error', code: err.code, message: err.message });
    }
  };

  bc.start();
  return { broadcaster: bc, wss };
}

export function upgradeSpaceSatellitesWebSocket(fastify: FastifyInstance, wss: WebSocketServer): void {
  const server = fastify.server;
  if (!server) return;
  server.on('upgrade', (req: IncomingMessage, socket, head) => {
    if (req.url === '/ws/space/satellites/live') {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    }
  });
}
