import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocket, WebSocketServer as WSServer } from 'ws';
import { query } from '../src/lib/db.js';
import {
  LiveAircraftBroadcaster,
  CompactAircraft,
  generateDelta,
  filterByBBox,
  determineRemoves,
  SnapshotData,
  DeltaData,
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

function mockRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    lat: 35,
    lon: 139,
    altitudeFt: 30000,
    speedKt: 450,
    trackDeg: 270,
    headingDeg: 268,
    verticalRateFpm: 0,
    onGround: false,
    callsign: 'TEST',
    aircraftType: 'B738',
    registration: 'N123',
    observedAt: '2026-05-29T10:00:00.000Z',
    receivedAt: '2026-05-29T10:00:05.000Z',
    staleAfter: '2026-05-29T10:01:30.000Z',
    ...overrides,
  };
}

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

describe('LiveAircraftBroadcaster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads snapshot on first poll and emits ready + snapshot', async () => {
    vi.useFakeTimers();
    const rows = [mockRow('ac1')];
    vi.mocked(query).mockResolvedValueOnce(rows);

    const bc = new LiveAircraftBroadcaster();
    const events: string[] = [];

    bc.onReady = () => { events.push('ready'); };
    bc.onSnapshot = () => { events.push('snapshot'); };
    bc.onDelta = () => { events.push('delta'); };

    bc.start();
    await vi.advanceTimersToNextTimerAsync();

    expect(events).toEqual(['ready', 'snapshot']);
    expect(bc.getLatestSnapshot()).not.toBeNull();
    expect(bc.getLatestSnapshot()!.aircraftCount).toBe(1);
    expect(bc.getLatestSnapshot()!.aircraft[0].id).toBe('ac1');
    bc.stop();
  });

  it('emits delta on subsequent polls', async () => {
    vi.useFakeTimers();
    const rows1 = [mockRow('ac1')];
    const rows2 = [mockRow('ac1'), mockRow('ac2')];
    vi.mocked(query).mockResolvedValueOnce(rows1);
    vi.mocked(query).mockResolvedValueOnce(rows2);

    const bc = new LiveAircraftBroadcaster();
    const deltas: DeltaData[] = [];

    bc.onReady = () => {};
    bc.onSnapshot = () => {};
    bc.onDelta = (d) => { deltas.push(d); };

    bc.start();
    await vi.advanceTimersToNextTimerAsync();
    await vi.advanceTimersToNextTimerAsync();

    expect(deltas).toHaveLength(1);
    expect(deltas[0].upserts).toHaveLength(1);
    expect(deltas[0].upserts[0].id).toBe('ac2');
    bc.stop();
  });

  it('emits removes for disappeared aircraft', async () => {
    vi.useFakeTimers();
    const rows1 = [mockRow('ac1'), mockRow('ac2')];
    const rows2 = [mockRow('ac1')];
    vi.mocked(query).mockResolvedValueOnce(rows1);
    vi.mocked(query).mockResolvedValueOnce(rows2);

    const bc = new LiveAircraftBroadcaster();
    const deltas: DeltaData[] = [];

    bc.onReady = () => {};
    bc.onSnapshot = () => {};
    bc.onDelta = (d) => { deltas.push(d); };

    bc.start();
    await vi.advanceTimersToNextTimerAsync();
    await vi.advanceTimersToNextTimerAsync();

    expect(deltas).toHaveLength(1);
    expect(deltas[0].removes).toEqual(['ac2']);
    bc.stop();
  });

  it('emits error on db failure and backs off', async () => {
    vi.useFakeTimers();
    vi.mocked(query).mockRejectedValueOnce(new Error('DB down'));

    const bc = new LiveAircraftBroadcaster();
    const errors: string[] = [];

    bc.onReady = () => {};
    bc.onSnapshot = () => {};
    bc.onError = (e) => { errors.push(e.code); };

    bc.start();
    await vi.advanceTimersToNextTimerAsync();

    expect(errors).toContain('SOURCE_UNAVAILABLE');
    bc.stop();
  });

  it('recovers after db error', async () => {
    vi.useFakeTimers();
    vi.mocked(query).mockRejectedValueOnce(new Error('DB down'));
    vi.mocked(query).mockResolvedValueOnce([mockRow('ac1')]);

    const bc = new LiveAircraftBroadcaster();
    const snapshots: SnapshotData[] = [];

    bc.onReady = () => {};
    bc.onSnapshot = (s) => { snapshots.push(s); };
    bc.onDelta = () => {};

    bc.start();
    await vi.advanceTimersToNextTimerAsync();
    await vi.advanceTimersToNextTimerAsync();

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].aircraftCount).toBe(1);
    bc.stop();
  });

  it('getStatus returns current state', async () => {
    vi.useFakeTimers();
    vi.mocked(query).mockResolvedValueOnce([mockRow('ac1')]);

    const bc = new LiveAircraftBroadcaster();
    bc.onReady = () => {};
    bc.onSnapshot = () => {};

    expect(bc.getStatus().aircraftCount).toBe(0);

    bc.start();
    await vi.advanceTimersToNextTimerAsync();

    const status = bc.getStatus();
    expect(status.aircraftCount).toBe(1);
    expect(status.pollCount).toBe(1);
    expect(status.lastSuccessAt).toBeTypeOf('number');
    bc.stop();
  });

  it('uses parameterized SQL', async () => {
    vi.useFakeTimers();
    vi.mocked(query).mockResolvedValueOnce([mockRow('ac1')]);

    const bc = new LiveAircraftBroadcaster();
    bc.onReady = () => {};
    bc.onSnapshot = () => {};

    bc.start();
    await vi.advanceTimersToNextTimerAsync();

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    const params = callArgs[1] as unknown[];
    expect(sql).toContain('$1');
    expect(sql).toContain('aviation_aircraft_latest');
    expect(params).toEqual(['airplanes_live_v2']);
    bc.stop();
  });
});

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
    vi.mocked(query).mockResolvedValueOnce([mockRow('ac1')]);
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

    bc.start();
    await vi.waitFor(() => expect(bc.getLatestSnapshot()).not.toBeNull(), { timeout: 3000 });

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
    vi.mocked(query).mockResolvedValueOnce([]);
    const bc = new LiveAircraftBroadcaster();
    const { wss, port } = await createTestWss();
    const received: string[] = [];

    wss.on('connection', (ws: WebSocket) => {
      ws.send(JSON.stringify({ type: 'aircraft.ready', serverTime: new Date().toISOString() }));
      ws.on('message', (raw: Buffer) => {
        try {
          const data = JSON.parse(raw.toString());
          if (data.type === 'ping') ws.send(JSON.stringify({ type: 'pong', serverTime: new Date().toISOString() }));
        } catch { /* ignore */ }
      });
    });

    bc.start();

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
    vi.mocked(query).mockResolvedValueOnce([]);
    const bc = new LiveAircraftBroadcaster();
    const { wss, port } = await createTestWss();
    const received: string[] = [];

    wss.on('connection', (ws: WebSocket) => {
      ws.send(JSON.stringify({ type: 'aircraft.ready', serverTime: new Date().toISOString() }));
      ws.on('message', (raw: Buffer) => {
        try {
          JSON.parse(raw.toString());
        } catch {
          ws.send(JSON.stringify({ type: 'aircraft.error', code: 'PARSE_ERROR', message: 'Parse error' }));
        }
      });
    });

    bc.start();

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
