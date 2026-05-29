import { query } from './db.js';

const POLL_INTERVAL_MS = 5000;
const BACKOFF_MS = 30000;
const FULL_RESYNC_INTERVAL = 12;

interface AircraftRow {
  id: string;
  lat: number | null;
  lon: number | null;
  altitudeFt: number | null;
  speedKt: number | null;
  trackDeg: number | null;
  headingDeg: number | null;
  verticalRateFpm: number | null;
  onGround: boolean | null;
  callsign: string | null;
  aircraftType: string | null;
  registration: string | null;
  observedAt: Date | string;
  receivedAt: Date | string;
  staleAfter: Date | string | null;
}

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

function toIsoString(val: Date | string): string {
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function rowToCompact(row: AircraftRow): CompactAircraft {
  return {
    id: row.id,
    sourceObjectId: row.id,
    callsign: row.callsign,
    lat: row.lat,
    lon: row.lon,
    altitudeFt: row.altitudeFt,
    speedKt: row.speedKt,
    trackDeg: row.trackDeg,
    headingDeg: row.headingDeg,
    verticalRateFpm: row.verticalRateFpm,
    onGround: row.onGround,
    aircraftType: row.aircraftType,
    registration: row.registration,
    origin: null,
    destination: null,
    observedAt: toIsoString(row.observedAt),
    receivedAt: toIsoString(row.receivedAt),
    staleAfter: row.staleAfter ? toIsoString(row.staleAfter) : null,
  };
}

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

const FETCH_SQL = `
  SELECT
    source_object_id AS id,
    lat,
    lon,
    altitude_baro_ft AS "altitudeFt",
    ground_speed_kt AS "speedKt",
    COALESCE(heading_mag_deg, heading_true_deg) AS "headingDeg",
    track_deg AS "trackDeg",
    vertical_rate_fpm AS "verticalRateFpm",
    on_ground AS "onGround",
    callsign,
    aircraft_type AS "aircraftType",
    registration,
    observed_at AS "observedAt",
    received_at AS "receivedAt",
    stale_after AS "staleAfter"
  FROM aviation_aircraft_latest
  WHERE source_id = $1
    AND stale_after > NOW()
`;

async function fetchLatestAircraft(): Promise<CompactAircraft[]> {
  const rows = await query<AircraftRow>(FETCH_SQL, ['airplanes_live_v2']);
  return rows.map(rowToCompact);
}

export { fetchLatestAircraft as __testableFetch };

export class LiveAircraftBroadcaster {
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private pollCount = 0;

  private currentMap: Map<string, CompactAircraft> = new Map();
  private previousMap: Map<string, CompactAircraft> = new Map();
  private latestSnapshot: SnapshotData | null = null;
  private snapshotSeq = 0;

  private _lastError: string | null = null;
  private _lastSuccessAt: number | null = null;

  onReady: ((serverTime: string) => void) | null = null;
  onSnapshot: ((snapshot: SnapshotData) => void) | null = null;
  onDelta: ((delta: DeltaData) => void) | null = null;
  onError: ((err: { code: string; message: string }) => void) | null = null;

  getLatestSnapshot(): SnapshotData | null {
    return this.latestSnapshot;
  }

  getCurrentMap(): Map<string, CompactAircraft> {
    return this.currentMap;
  }

  getStatus() {
    return {
      lastSuccessAt: this._lastSuccessAt,
      lastError: this._lastError,
      aircraftCount: this.currentMap.size,
      snapshotId: this.latestSnapshot?.snapshotId ?? null,
      pollCount: this.pollCount,
    };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.scheduleNext(0);
  }

  stop(): void {
    this.running = false;
    if (this.pollTimer !== null) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private scheduleNext(delayMs: number): void {
    if (!this.running) return;
    this.pollTimer = setTimeout(() => this.doPoll(), delayMs);
  }

  private async doPoll(): Promise<void> {
    if (!this.running) return;

    try {
      const aircraft = await fetchLatestAircraft();
      const now = new Date();
      const snapshotTime = now.toISOString();
      this.pollCount++;

      this.snapshotSeq++;
      const snapshotId = `${Date.now()}-${this.snapshotSeq}`;

      this.previousMap = this.currentMap;
      const newMap = new Map<string, CompactAircraft>();
      for (const ac of aircraft) {
        newMap.set(ac.id, ac);
      }
      this.currentMap = newMap;

      this._lastSuccessAt = Date.now();
      this._lastError = null;

      const snapshot: SnapshotData = {
        snapshotId,
        snapshotTime,
        aircraft: Array.from(newMap.values()),
        aircraftCount: newMap.size,
      };

      this.latestSnapshot = snapshot;

      if (this.pollCount === 1) {
        this.onReady?.(snapshotTime);
        this.onSnapshot?.(snapshot);
      } else {
        const delta = generateDelta(this.previousMap, this.currentMap, snapshotId, snapshotTime);
        if (this.pollCount % FULL_RESYNC_INTERVAL === 0) {
          this.onSnapshot?.(snapshot);
        } else {
          this.onDelta?.(delta);
        }
      }

      this.scheduleNext(POLL_INTERVAL_MS);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this._lastError = message;

      if (this.running) {
        this.onError?.({ code: 'SOURCE_UNAVAILABLE', message });
      }

      this.scheduleNext(BACKOFF_MS);
    }
  }
}
