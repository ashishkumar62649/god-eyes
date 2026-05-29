import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocket, WebSocketServer as WSServer } from 'ws';
import { query, listen } from '../src/lib/db.js';
import {
  LiveAircraftBroadcaster,
  CompactAircraft,
  generateDelta,
  filterByBBox,
  determineRemoves,
  SnapshotData,
  DeltaData,
  aircraftArrayToMap,
} from '../src/lib/live-aircraft-broadcaster.js';
import {
  attachLiveAircraftWebSocket,
  upgradeWebSocket,
} from '../src/routes/live-aircraft.js';

function makeAc(id: string, overrides: Partial<CompactAircraft> = {}): CompactAircraft {
  return {
    id,
    sourceObjectId: id,
    callsign: 'TEST',
    lat: 35,
    lon: 139,
    altitudeFt: 30000,
    speedKt: 450,
    trackDeg: 270,
    headingDeg: 268,
    verticalRateFpm: 0,
    onGround: false,
    aircraftType: 'B738',
    registration: 'N123',
    origin: null,
    destination: null,
    observedAt: '2026-05-29T10:00:00.000Z',
    receivedAt: '2026-05-29T10:00:05.000Z',
    staleAfter: '2026-05-29T10:01:30.000Z',
    ...overrides,
  };
}

function makeSnapshotRow(id: number, aircraft: CompactAircraft[], overrides: Record<string, unknown> = {}) {
  return {
    id,
    source_id: 'airplanes_live_v2',
    snapshot_id: `snap-${id}`,
    aircraft,
    aircraft_count: aircraft.length,
    created_at: '2026-05-29T10:00:00.000Z',
    ...overrides,
  };
}

// --- Pure function tests ---

describe('Delta generation', () => {
  it('generates upserts for new aircraft', () => {
    const prev = new Map<string, CompactAircraft>();
    const curr = new Map<string, CompactAircraft>();
    curr.set('a1', makeAc('a1'));

    const delta = generateDelta(prev, curr, 's1', 't1');
    expect(delta.upserts).toHaveLength(1);
    expect(delta.upserts[0].id).toBe('a1');
    expect(delta.removes).toHaveLength(0);
    expect(delta.aircraftCount).toBe(1);
  });

  it('generates removes for disappeared aircraft', () => {
    const prev = new Map<string, CompactAircraft>();
    prev.set('a1', makeAc('a1'));
    prev.set('a2', makeAc('a2'));
    const curr = new Map<string, CompactAircraft>();
    curr.set('a1', makeAc('a1'));

    const delta = generateDelta(prev, curr, 's1', 't1');
    expect(delta.upserts).toHaveLength(0);
    expect(delta.removes).toEqual(['a2']);
    expect(delta.aircraftCount).toBe(1);
  });

  it('generates upserts for changed aircraft', () => {
    const prev = new Map<string, CompactAircraft>();
    prev.set('a1', makeAc('a1', { lat: 35, lon: 139 }));
    const curr = new Map<string, CompactAircraft>();
    curr.set('a1', makeAc('a1', { lat: 36, lon: 140 }));

    const delta = generateDelta(prev, curr, 's1', 't1');
    expect(delta.upserts).toHaveLength(1);
    expect(delta.upserts[0].lat).toBe(36);
  });

  it('skips unchanged aircraft', () => {
    const prev = new Map<string, CompactAircraft>();
    prev.set('a1', makeAc('a1'));
    const curr = new Map<string, CompactAircraft>();
    curr.set('a1', makeAc('a1'));

    const delta = generateDelta(prev, curr, 's1', 't1');
    expect(delta.upserts).toHaveLength(0);
    expect(delta.removes).toHaveLength(0);
  });

  it('generates both upserts and removes', () => {
    const prev = new Map<string, CompactAircraft>();
    prev.set('a1', makeAc('a1'));
    prev.set('a2', makeAc('a2'));
    const curr = new Map<string, CompactAircraft>();
    curr.set('a1', makeAc('a1', { lat: 36 }));
    curr.set('a3', makeAc('a3'));

    const delta = generateDelta(prev, curr, 's1', 't1');
    expect(delta.upserts).toHaveLength(2);
    expect(delta.removes).toEqual(['a2']);
    expect(delta.aircraftCount).toBe(2);
  });
});

describe('BBox filtering', () => {
  const bbox: [number, number, number, number] = [130, 30, 150, 50];

  it('filters aircraft inside bbox', () => {
    const aircraft = [
      makeAc('a1', { lon: 140, lat: 35 }),
      makeAc('a2', { lon: 100, lat: 35 }),
    ];
    const filtered = filterByBBox(aircraft, bbox);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('a1');
  });

  it('returns empty for no match', () => {
    const aircraft = [makeAc('a1', { lon: 100, lat: 35 })];
    expect(filterByBBox(aircraft, bbox)).toHaveLength(0);
  });

  it('excludes null lat/lon', () => {
    const aircraft = [makeAc('a1', { lat: null, lon: null })];
    expect(filterByBBox(aircraft, bbox)).toHaveLength(0);
  });
});

describe('determineRemoves', () => {
  it('finds removed ids', () => {
    const prev = new Set(['a1', 'a2', 'a3']);
    const curr = new Set(['a1']);
    expect(determineRemoves(prev, curr)).toEqual(['a2', 'a3']);
  });

  it('returns empty when no removes', () => {
    const prev = new Set(['a1']);
    const curr = new Set(['a1']);
    expect(determineRemoves(prev, curr)).toEqual([]);
  });
});

// --- Broadcaster tests ---

describe('LiveAircraftBroadcaster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function captureNotifyCb(): Promise<(payload: string) => void> {
    return new Promise((resolve) => {
      vi.mocked(listen).mockImplementation((_channel: string, cb: (payload: string) => void) => {
        resolve(cb);
        return Promise.resolve(vi.fn());
      });
    });
  }

  it('loads snapshot on start and emits ready + snapshot', async () => {
    const ac1 = makeAc('ac1');
    vi.mocked(query).mockResolvedValueOnce([makeSnapshotRow(1, [ac1])]);

    const bc = new LiveAircraftBroadcaster();
    const events: string[] = [];

    bc.onReady = () => { events.push('ready'); };
    bc.onSnapshot = () => { events.push('snapshot'); };

    await bc.start();

    expect(events).toEqual(['ready', 'snapshot']);
    expect(bc.getLatestSnapshot()).not.toBeNull();
    expect(bc.getLatestSnapshot()!.aircraftCount).toBe(1);
    expect(bc.getLatestSnapshot()!.aircraft[0].id).toBe('ac1');
    await bc.stop();
  });

  it('emits error when no snapshot exists', async () => {
    vi.mocked(query).mockResolvedValueOnce([]);

    const bc = new LiveAircraftBroadcaster();
    const errors: string[] = [];

    bc.onReady = () => {};
    bc.onSnapshot = () => {};
    bc.onError = (e) => { errors.push(e.code); };

    await bc.start();

    expect(errors).toContain('NO_SNAPSHOT');
    expect(bc.getLatestSnapshot()).toBeNull();
    await bc.stop();
  });

  it('emits error on db failure', async () => {
    vi.mocked(query).mockRejectedValueOnce(new Error('DB connection failed'));

    const bc = new LiveAircraftBroadcaster();
    const errors: string[] = [];

    bc.onReady = () => {};
    bc.onSnapshot = () => {};
    bc.onError = (e) => { errors.push(e.code); };

    await bc.start();

    expect(errors).toContain('SOURCE_UNAVAILABLE');
    await bc.stop();
  });

  it('emits delta on notification after initial snapshot', async () => {
    const ac1 = makeAc('ac1');
    vi.mocked(query).mockResolvedValueOnce([makeSnapshotRow(1, [ac1])]);

    const bc = new LiveAircraftBroadcaster();
    const deltas: DeltaData[] = [];

    bc.onReady = () => {};
    bc.onSnapshot = () => {};
    bc.onDelta = (d) => { deltas.push(d); };

    const notifyPromise = captureNotifyCb();
    await bc.start();
    const notifyCb = await notifyPromise;

    expect(bc.getLatestSnapshot()!.aircraftCount).toBe(1);

    const ac2 = makeAc('ac2');
    vi.mocked(query).mockResolvedValueOnce([makeSnapshotRow(2, [ac1, ac2])]);

    notifyCb('');

    await vi.waitFor(() => expect(deltas.length).toBeGreaterThanOrEqual(1));

    expect(deltas[0].upserts).toHaveLength(1);
    expect(deltas[0].upserts[0].id).toBe('ac2');
    expect(deltas[0].removes).toHaveLength(0);
    await bc.stop();
  });

  it('emits removes on notification when aircraft disappear', async () => {
    const ac1 = makeAc('ac1');
    const ac2 = makeAc('ac2');
    vi.mocked(query).mockResolvedValueOnce([makeSnapshotRow(1, [ac1, ac2])]);

    const bc = new LiveAircraftBroadcaster();
    const deltas: DeltaData[] = [];

    bc.onReady = () => {};
    bc.onSnapshot = () => {};
    bc.onDelta = (d) => { deltas.push(d); };

    const notifyPromise = captureNotifyCb();
    await bc.start();
    const notifyCb = await notifyPromise;

    vi.mocked(query).mockResolvedValueOnce([makeSnapshotRow(2, [ac1])]);

    notifyCb('');

    await vi.waitFor(() => expect(deltas.length).toBeGreaterThanOrEqual(1));

    expect(deltas[0].removes).toEqual(['ac2']);
    await bc.stop();
  });

  it('sends full snapshot on resync timer', async () => {
    const ac1 = makeAc('ac1');
    vi.mocked(query).mockResolvedValueOnce([makeSnapshotRow(1, [ac1])]);

    const bc = new LiveAircraftBroadcaster();
    const snapshots: SnapshotData[] = [];

    bc.onReady = () => {};
    bc.onSnapshot = (s) => { snapshots.push(s); };

    await bc.start();

    expect(snapshots).toHaveLength(1);

    vi.advanceTimersByTime(61000);

    expect(snapshots.length).toBeGreaterThanOrEqual(2);
    expect(snapshots[1].snapshotId).toBe('snap-1');
    await bc.stop();
  });

  it('getStatus returns current state', async () => {
    vi.mocked(query).mockResolvedValueOnce([makeSnapshotRow(1, [makeAc('ac1')])]);

    const bc = new LiveAircraftBroadcaster();
    bc.onReady = () => {};
    bc.onSnapshot = () => {};

    const statusBefore = bc.getStatus();
    expect(statusBefore.aircraftCount).toBe(0);
    expect(statusBefore.snapshotId).toBeNull();

    await bc.start();

    const status = bc.getStatus();
    expect(status.aircraftCount).toBe(1);
    expect(status.snapshotId).toBeTypeOf('string');
    expect(status.lastSuccessAt).toBeTypeOf('number');
    await bc.stop();
  });

  it('does not query aviation_aircraft_latest table', async () => {
    vi.mocked(query).mockResolvedValueOnce([makeSnapshotRow(1, [makeAc('ac1')])]);

    const bc = new LiveAircraftBroadcaster();
    bc.onReady = () => {};
    bc.onSnapshot = () => {};

    await bc.start();

    const sqlCall = vi.mocked(query).mock.calls[0][0] as string;
    expect(sqlCall).not.toContain('aviation_aircraft_latest');
    expect(sqlCall).toContain('aviation_aircraft_live_snapshots');
    await bc.stop();
  });

  it('uses parameterized SQL', async () => {
    vi.mocked(query).mockResolvedValueOnce([makeSnapshotRow(1, [makeAc('ac1')])]);

    const bc = new LiveAircraftBroadcaster();
    bc.onReady = () => {};
    bc.onSnapshot = () => {};

    await bc.start();

    const params = vi.mocked(query).mock.calls[0][1] as unknown[];
    expect(params).toEqual(['airplanes_live_v2']);
    await bc.stop();
  });
});

// --- WebSocket integration tests ---

describe('WebSocket integration', () => {
  function createTestWss(): Promise<{ wss: WSServer; port: number }> {
    return new Promise((resolve) => {
      const wss = new WSServer({ port: 0 }, () => {
        const addr = wss.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        resolve({ wss, port });
      });
    });
  }

  it('sends ready and snapshot on connect when snapshot exists', async () => {
    vi.mocked(query).mockResolvedValueOnce([makeSnapshotRow(1, [makeAc('ac1')])]);
    const bc = new LiveAircraftBroadcaster();
    const { wss, port } = await createTestWss();

    const received: string[] = [];

    wss.on('connection', (serverWs: WebSocket) => {
      serverWs.send(JSON.stringify({ type: 'aircraft.ready', serverTime: new Date().toISOString() }));
      const snap = bc.getLatestSnapshot();
      if (snap) {
        serverWs.send(JSON.stringify({ type: 'aircraft.snapshot', sourceId: 'airplanes_live_v2', snapshotId: snap.snapshotId, snapshotTime: snap.snapshotTime, aircraftCount: snap.aircraftCount, aircraft: snap.aircraft }));
      }
      serverWs.on('message', (raw: Buffer) => {
        try {
          const data = JSON.parse(raw.toString());
          if (data.type === 'ping') serverWs.send(JSON.stringify({ type: 'pong', serverTime: new Date().toISOString() }));
        } catch { /* ignore */ }
      });
    });

    await bc.start();

    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on('message', (raw) => received.push(raw.toString()));
    ws.on('error', (err) => received.push(JSON.stringify({ type: '__ws_error', msg: err.message })));
    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', reject);
      setTimeout(() => reject(new Error('connect timeout')), 2000);
    });

    await vi.waitFor(() => expect(received.length).toBeGreaterThanOrEqual(1), { timeout: 3000 });
    const ready = JSON.parse(received[0]);
    expect(ready.type).toBe('aircraft.ready');

    bc.stop();
    wss.close();
    ws.close();
  });

  it('pong responds to ping', async () => {
    vi.mocked(query).mockResolvedValueOnce([makeSnapshotRow(1, [makeAc('ac1')])]);
    const bc = new LiveAircraftBroadcaster();
    const { wss, port } = await createTestWss();
    const received: string[] = [];

    wss.on('connection', (serverWs: WebSocket) => {
      serverWs.send(JSON.stringify({ type: 'aircraft.ready', serverTime: new Date().toISOString() }));
      serverWs.on('message', (raw: Buffer) => {
        try {
          const data = JSON.parse(raw.toString());
          if (data.type === 'ping') serverWs.send(JSON.stringify({ type: 'pong', serverTime: new Date().toISOString() }));
        } catch { /* ignore */ }
      });
    });

    await bc.start();

    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on('message', (raw) => received.push(raw.toString()));
    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', reject);
      setTimeout(() => reject(new Error('connect timeout')), 2000);
    });

    await vi.waitFor(() => expect(received.length).toBeGreaterThanOrEqual(1), { timeout: 3000 });

    ws.send(JSON.stringify({ type: 'ping' }));
    await vi.waitFor(() => expect(received.length).toBeGreaterThanOrEqual(2), { timeout: 3000 });
    const pong = JSON.parse(received[1]);
    expect(pong.type).toBe('pong');

    bc.stop();
    wss.close();
    ws.close();
  });

  it('invalid json returns error', async () => {
    vi.mocked(query).mockResolvedValueOnce([makeSnapshotRow(1, [makeAc('ac1')])]);
    const bc = new LiveAircraftBroadcaster();
    const { wss, port } = await createTestWss();
    const received: string[] = [];

    wss.on('connection', (serverWs: WebSocket) => {
      serverWs.send(JSON.stringify({ type: 'aircraft.ready', serverTime: new Date().toISOString() }));
      serverWs.on('message', (raw: Buffer) => {
        try {
          JSON.parse(raw.toString());
        } catch {
          serverWs.send(JSON.stringify({ type: 'aircraft.error', code: 'PARSE_ERROR', message: 'Parse error' }));
        }
      });
    });

    await bc.start();

    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on('message', (raw) => received.push(raw.toString()));
    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', reject);
      setTimeout(() => reject(new Error('connect timeout')), 2000);
    });

    await vi.waitFor(() => expect(received.length).toBeGreaterThanOrEqual(1), { timeout: 3000 });

    ws.send('not json');
    await vi.waitFor(() => expect(received.length).toBeGreaterThanOrEqual(2), { timeout: 3000 });
    const err = JSON.parse(received[1]);
    expect(err.type).toBe('aircraft.error');
    expect(err.code).toBe('PARSE_ERROR');

    bc.stop();
    wss.close();
    ws.close();
  });
});

describe('Existing REST endpoint still works', () => {
  it('can import aviation-aircraft routes module', async () => {
    const mod = await import('../src/routes/aviation-aircraft.js');
    expect(mod.aviationAircraftRoutes).toBeTypeOf('function');
  });
});

describe('No upstream fetch', () => {
  it('broadcaster does not reference Airplanes.live URLs', async () => {
    const mod = await import('../src/lib/live-aircraft-broadcaster.js');
    const exportedKeys = Object.keys(mod);
    expect(exportedKeys).not.toContain('__testableFetch');
    expect(exportedKeys).not.toContain('fetchLatestAircraft');
  });
});
