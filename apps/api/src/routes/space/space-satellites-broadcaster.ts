import { query } from '../../lib/db.js';
import { SpaceSatelliteItem } from '@god-eyes/contracts';

export const DEFAULT_REFRESH_INTERVAL_MS = 30000;

export interface SpaceSatelliteFilter {
  category?: string[];
  objectType?: string[];
  orbitClass?: string[];
  importantOnly?: boolean;
  minAltitude?: number;
  maxAltitude?: number;
  limit?: number;
}

export interface SpaceSatellitesSnapshot {
  type: 'space.satellites.snapshot';
  layerId: 'layer_05_space_satellites';
  estimated: true;
  generatedAt: string;
  count: number;
  satellites: SpaceSatelliteItem[];
}

interface PositionRow {
  satelliteId: string;
  noradId: number | null;
  name: string;
  objectType: 'satellite' | 'debris' | 'rocket_body' | 'inactive_payload' | 'unknown';
  category: string;
  orbitClass: string;
  country: string | null;
  launchDate: string | null;
  latitude: number;
  longitude: number;
  altitudeKm: number | null;
  velocityKms: number | null;
  headingDeg: number | null;
  visualShape: 'dot' | 'triangle';
  visualColor: string;
  important: boolean;
  estimatedAt: string;
  sourceId: string;
  sourceObjectId: string;
  sourceAgeSeconds: number | null;
}

const FETCH_SNAPSHOT_SQL = `
  SELECT
    s.id::text AS "satelliteId",
    s.norad_cat_id AS "noradId",
    s.name,
    p.object_type AS "objectType",
    p.category,
    p.orbit_class AS "orbitClass",
    s.country,
    s.launch_date::text AS "launchDate",
    p.latitude,
    p.longitude,
    p.altitude_km AS "altitudeKm",
    p.velocity_kms AS "velocityKms",
    p.heading_deg AS "headingDeg",
    p.visual_shape AS "visualShape",
    p.visual_color AS "visualColor",
    p.is_important AS "important",
    p.estimated_at::text AS "estimatedAt",
    p.source_id AS "sourceId",
    p.source_object_id AS "sourceObjectId",
    p.source_age_seconds AS "sourceAgeSeconds"
  FROM space_satellites s
  JOIN space_satellite_positions_latest p ON s.id = p.satellite_id
  WHERE s.layer_id = 'layer_05_space_satellites'
    AND p.layer_id = 'layer_05_space_satellites'
  ORDER BY p.estimated_at DESC
  LIMIT $1
`;

export function buildSnapshot(rows: PositionRow[]): SpaceSatellitesSnapshot {
  return {
    type: 'space.satellites.snapshot',
    layerId: 'layer_05_space_satellites',
    estimated: true,
    generatedAt: new Date().toISOString(),
    count: rows.length,
    satellites: rows.map((r) => ({
      satelliteId: r.satelliteId,
      noradId: r.noradId,
      name: r.name,
      objectType: r.objectType,
      category: r.category,
      orbitClass: r.orbitClass,
      country: r.country,
      launchDate: r.launchDate,
      position: {
        latitude: r.latitude,
        longitude: r.longitude,
        altitudeKm: r.altitudeKm,
      },
      velocity: {
        speedKms: r.velocityKms,
      },
      headingDeg: r.headingDeg,
      visualShape: r.visualShape,
      visualColor: r.visualColor,
      important: r.important,
      estimatedAt: r.estimatedAt,
      sourceId: r.sourceId,
      sourceObjectId: r.sourceObjectId,
      sourceAgeSeconds: r.sourceAgeSeconds,
    })),
  };
}

export function applyFilters(
  snapshot: SpaceSatellitesSnapshot,
  filters: SpaceSatelliteFilter,
): SpaceSatellitesSnapshot {
  let filtered = snapshot.satellites;

  if (filters.category && filters.category.length > 0) {
    const catSet = new Set(filters.category.map((c) => c.toLowerCase()));
    filtered = filtered.filter((s) => catSet.has(s.category.toLowerCase()));
  }

  if (filters.objectType && filters.objectType.length > 0) {
    const typeSet = new Set(filters.objectType.map((t) => t.toLowerCase()));
    filtered = filtered.filter((s) => typeSet.has(s.objectType.toLowerCase()));
  }

  if (filters.orbitClass && filters.orbitClass.length > 0) {
    const classSet = new Set(filters.orbitClass.map((c) => c.toLowerCase()));
    filtered = filtered.filter((s) => classSet.has(s.orbitClass.toLowerCase()));
  }

  if (filters.importantOnly) {
    filtered = filtered.filter((s) => s.important);
  }

  if (filters.minAltitude !== undefined && filters.minAltitude !== null) {
    filtered = filtered.filter((s) => s.position.altitudeKm !== null && s.position.altitudeKm >= filters.minAltitude!);
  }

  if (filters.maxAltitude !== undefined && filters.maxAltitude !== null) {
    filtered = filtered.filter((s) => s.position.altitudeKm !== null && s.position.altitudeKm <= filters.maxAltitude!);
  }

  if (filters.limit !== undefined && filters.limit !== null && filters.limit > 0) {
    filtered = filtered.slice(0, filters.limit);
  }

  return {
    type: 'space.satellites.snapshot',
    layerId: 'layer_05_space_satellites',
    estimated: true,
    generatedAt: new Date().toISOString(),
    count: filtered.length,
    satellites: filtered,
  };
}

export function buildEmptySnapshot(): SpaceSatellitesSnapshot {
  return {
    type: 'space.satellites.snapshot',
    layerId: 'layer_05_space_satellites',
    estimated: true,
    generatedAt: new Date().toISOString(),
    count: 0,
    satellites: [],
  };
}

export async function loadSatellitesSnapshot(limit = 5000): Promise<SpaceSatellitesSnapshot> {
  const rows = await query<PositionRow>(FETCH_SNAPSHOT_SQL, [limit]);
  if (rows.length === 0) {
    return buildEmptySnapshot();
  }
  return buildSnapshot(rows);
}

export class SpaceSatellitesBroadcaster {
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private currentSnapshot: SpaceSatellitesSnapshot | null = null;
  private _lastError: string | null = null;
  private _lastSuccessAt: number | null = null;
  private limit: number;

  onReady: ((snapshot: SpaceSatellitesSnapshot) => void) | null = null;
  onSnapshot: ((snapshot: SpaceSatellitesSnapshot) => void) | null = null;
  onError: ((err: { code: string; message: string }) => void) | null = null;

  constructor(limit = 5000) {
    this.limit = limit;
  }

  getLatestSnapshot(): SpaceSatellitesSnapshot | null {
    return this.currentSnapshot;
  }

  getStatus() {
    return {
      lastSuccessAt: this._lastSuccessAt,
      lastError: this._lastError,
      satelliteCount: this.currentSnapshot?.count ?? 0,
    };
  }

  async start(): Promise<void> {
    try {
      this.currentSnapshot = await loadSatellitesSnapshot(this.limit);
      this._lastSuccessAt = Date.now();
      this._lastError = null;
      this.onReady?.(this.currentSnapshot);
      this.onSnapshot?.(this.currentSnapshot);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this._lastError = message;
      this.currentSnapshot = buildEmptySnapshot();
      this.onError?.({ code: 'SOURCE_UNAVAILABLE', message });
    }

    this.startRefreshTimer();
  }

  stop(): void {
    if (this.refreshTimer !== null) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private startRefreshTimer(): void {
    this.refreshTimer = setInterval(async () => {
      try {
        this.currentSnapshot = await loadSatellitesSnapshot(this.limit);
        this._lastSuccessAt = Date.now();
        this._lastError = null;
        this.onSnapshot?.(this.currentSnapshot);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this._lastError = message;
        this.onError?.({ code: 'SOURCE_UNAVAILABLE', message });
      }
    }, DEFAULT_REFRESH_INTERVAL_MS);
  }
}
