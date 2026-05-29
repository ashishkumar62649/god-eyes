import { query, listen, UnlistenFn } from './db.js';

const NOTIFY_CHANNEL = 'aviation_live_aircraft_snapshot';
const SOURCE_ID = 'airplanes_live_v2';
const RESYNC_INTERVAL_MS = 60000;
const FULL_RESYNC_NOTIFY_COUNT = 12;

export interface CompactAircraft {
  id: string;
  sourceObjectId: string;
  callsign: string | null;
  lat: number | null;
  lon: number | null;
  altitudeFt: number | null;
  speedKt: number | null;
  trackDeg: number | null;
  headingDeg: number | null;
  verticalRateFpm: number | null;
  onGround: boolean | null;
  aircraftType: string | null;
  registration: string | null;
  origin: string | null;
  destination: string | null;
  observedAt: string;
  receivedAt: string;
  staleAfter: string | null;
}

export interface SnapshotData {
  snapshotId: string;
  snapshotTime: string;
  aircraft: CompactAircraft[];
  aircraftCount: number;
}

export interface DeltaData {
  snapshotId: string;
  snapshotTime: string;
  upserts: CompactAircraft[];
  removes: string[];
  aircraftCount: number;
}

export interface ClientView {
  lastVisibleIds: Set<string>;
}

interface SnapshotRow {
  id: number;
  source_id: string;
  snapshot_id: string;
  aircraft: CompactAircraft[];
  aircraft_count: number;
  created_at: string;
}

const FETCH_SNAPSHOT_SQL = `
  SELECT id, source_id, snapshot_id, aircraft, aircraft_count, created_at
  FROM aviation_aircraft_live_snapshots
  WHERE source_id = $1
  ORDER BY id DESC
  LIMIT 1
`;

function isChanged(a: CompactAircraft, b: CompactAircraft): boolean {
  return (
    a.lat !== b.lat ||
    a.lon !== b.lon ||
    a.altitudeFt !== b.altitudeFt ||
    a.speedKt !== b.speedKt ||
    a.trackDeg !== b.trackDeg ||
    a.headingDeg !== b.headingDeg ||
    a.verticalRateFpm !== b.verticalRateFpm ||
    a.onGround !== b.onGround ||
    a.callsign !== b.callsign ||
    a.staleAfter !== b.staleAfter
  );
}

export function generateDelta(
  prevMap: Map<string, CompactAircraft>,
  currMap: Map<string, CompactAircraft>,
  snapshotId: string,
  snapshotTime: string,
): DeltaData {
  const upserts: CompactAircraft[] = [];
  const removes: string[] = [];

  for (const [id, ac] of currMap) {
    const prev = prevMap.get(id);
    if (!prev || isChanged(ac, prev)) {
      upserts.push(ac);
    }
  }

  for (const [id] of prevMap) {
    if (!currMap.has(id)) {
      removes.push(id);
    }
  }

  return { snapshotId, snapshotTime, upserts, removes, aircraftCount: currMap.size };
}

export function filterByBBox(
  aircraft: CompactAircraft[],
  bbox: [number, number, number, number],
): CompactAircraft[] {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return aircraft.filter((ac) => {
    if (ac.lat === null || ac.lon === null) return false;
    return ac.lon >= minLon && ac.lon <= maxLon && ac.lat >= minLat && ac.lat <= maxLat;
  });
}

export function determineRemoves(
  prevVisible: Set<string>,
  currVisible: Set<string>,
): string[] {
  const removes: string[] = [];
  for (const id of prevVisible) {
    if (!currVisible.has(id)) removes.push(id);
  }
  return removes;
}

export class LiveAircraftBroadcaster {
  private running = false;
  private unlistenFn: UnlistenFn | null = null;
  private resyncTimer: ReturnType<typeof setInterval> | null = null;
  private notifyCount = 0;

  private currentSnapshot: SnapshotData | null = null;
  private previousMap: Map<string, CompactAircraft> = new Map();
  private currentMap: Map<string, CompactAircraft> = new Map();

  private _lastError: string | null = null;
  private _lastSuccessAt: number | null = null;

  onReady: ((serverTime: string) => void) | null = null;
  onSnapshot: ((snapshot: SnapshotData) => void) | null = null;
  onDelta: ((delta: DeltaData) => void) | null = null;
  onError: ((err: { code: string; message: string }) => void) | null = null;

  getLatestSnapshot(): SnapshotData | null {
    return this.currentSnapshot;
  }

  getCurrentMap(): Map<string, CompactAircraft> {
    return this.currentMap;
  }

  getStatus() {
    return {
      lastSuccessAt: this._lastSuccessAt,
      lastError: this._lastError,
      aircraftCount: this.currentMap.size,
      snapshotId: this.currentSnapshot?.snapshotId ?? null,
      notifyCount: this.notifyCount,
    };
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      await this.loadSnapshot();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this._lastError = message;
      this.onError?.({ code: 'SOURCE_UNAVAILABLE', message });
    }

    this.startListening();
    this.startResyncTimer();
  }

  async stop(): Promise<void> {
    this.running = false;

    if (this.unlistenFn) {
      await this.unlistenFn();
      this.unlistenFn = null;
    }

    if (this.resyncTimer !== null) {
      clearInterval(this.resyncTimer);
      this.resyncTimer = null;
    }
  }

  private async loadSnapshot(): Promise<void> {
    const rows = await query<SnapshotRow>(FETCH_SNAPSHOT_SQL, [SOURCE_ID]);

    if (rows.length === 0) {
      this.currentSnapshot = null;
      this.previousMap = this.currentMap;
      this.currentMap = new Map();
      this._lastError = 'No snapshot available';
      this.onError?.({ code: 'NO_SNAPSHOT', message: 'No live aircraft snapshot available yet' });
      return;
    }

    const row = rows[0];
    const aircraft: CompactAircraft[] = (row.aircraft || []).map((ac) => ({
      ...ac,
      sourceObjectId: ac.id,
      observedAt: ac.observedAt || row.created_at,
      receivedAt: ac.receivedAt || row.created_at,
    }));

    const snapshotId = String(row.snapshot_id || row.id);
    const snapshotTime = row.created_at;
    const snapshot: SnapshotData = {
      snapshotId,
      snapshotTime,
      aircraft,
      aircraftCount: row.aircraft_count,
    };

    this._lastSuccessAt = Date.now();
    this._lastError = null;

    const hadPreviousSnapshot = this.currentSnapshot !== null;
    this.currentSnapshot = snapshot;

    this.previousMap = this.currentMap;
    const newMap = new Map<string, CompactAircraft>();
    for (const ac of aircraft) {
      newMap.set(ac.id, ac);
    }
    this.currentMap = newMap;

    if (!hadPreviousSnapshot) {
      this.onReady?.(snapshotTime);
      this.onSnapshot?.(snapshot);
    } else {
      const delta = generateDelta(this.previousMap, this.currentMap, snapshotId, snapshotTime);
      this.onDelta?.(delta);
    }
  }

  private startListening(): void {
    listen(NOTIFY_CHANNEL, () => {
      if (!this.running) return;
      this.notifyCount++;

      this.loadSnapshot().catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        this._lastError = message;
        this.onError?.({ code: 'SOURCE_UNAVAILABLE', message });
      });
    }).then((fn) => {
      this.unlistenFn = fn;
    }).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      this._lastError = message;
      this.onError?.({ code: 'LISTEN_FAILED', message });
    });
  }

  private startResyncTimer(): void {
    this.resyncTimer = setInterval(() => {
      if (!this.running) return;

      if (this.currentSnapshot) {
        this.onSnapshot?.(this.currentSnapshot);
      }
    }, RESYNC_INTERVAL_MS);
  }
}

export function aircraftArrayToMap(aircraft: CompactAircraft[]): Map<string, CompactAircraft> {
  const map = new Map<string, CompactAircraft>();
  for (const ac of aircraft) {
    map.set(ac.id, ac);
  }
  return map;
}
