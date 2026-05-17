import type { AirportObject } from '@god-eyes/contracts';

const TILE_DEG = 30;
const MAX_ENTRIES = 200;
const TTL_MS = 600_000;
const STALE_TTL_MS = 120_000;

interface TileCacheEntry {
  data: AirportObject[];
  ts: number;
  lastAccess: number;
  generation: number;
}

const cache = new Map<string, TileCacheEntry>();
let generation = 0;
let hits = 0;
let misses = 0;

export interface TileCacheStats {
  entries: number;
  hits: number;
  misses: number;
  maxEntries: number;
  inFlight: number;
}

const inFlightTiles = new Set<string>();

export const TILE_DEGREES = TILE_DEG;

export function makeTileKey(
  category: string,
  tileId: string,
  mode: string,
  includeClosed: boolean,
): string {
  return `${category}:${tileId}:${mode}:${includeClosed ? 'c' : 'nc'}`;
}

export function getTile(key: string): TileCacheEntry | undefined {
  const entry = cache.get(key);
  if (!entry) {
    misses++;
    return undefined;
  }
  if (Date.now() - entry.ts > TTL_MS + STALE_TTL_MS) {
    cache.delete(key);
    misses++;
    return undefined;
  }
  hits++;
  entry.lastAccess = Date.now();
  cache.delete(key);
  cache.set(key, entry);
  return entry;
}

export function setTile(key: string, data: AirportObject[]): void {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, {
    data,
    ts: Date.now(),
    lastAccess: Date.now(),
    generation: generation++,
  });
}

export function hasTile(key: string): boolean {
  const entry = cache.get(key);
  if (!entry) return false;
  if (Date.now() - entry.ts > TTL_MS + STALE_TTL_MS) {
    cache.delete(key);
    return false;
  }
  return true;
}

export function isStale(key: string): boolean {
  const entry = cache.get(key);
  if (!entry) return true;
  return Date.now() - entry.ts > TTL_MS;
}

export function getTileData(key: string): AirportObject[] | undefined {
  const entry = getTile(key);
  return entry?.data;
}

export function clearTileCache(): void {
  cache.clear();
  hits = 0;
  misses = 0;
}

export function getTileCacheStats(): TileCacheStats {
  return {
    entries: cache.size,
    hits,
    misses,
    maxEntries: MAX_ENTRIES,
    inFlight: inFlightTiles.size,
  };
}

export function markTileInFlight(key: string): void {
  inFlightTiles.add(key);
}

export function markTileDone(key: string): void {
  inFlightTiles.delete(key);
}

export function isTileInFlight(key: string): boolean {
  return inFlightTiles.has(key);
}

export function clearInFlightTiles(): void {
  inFlightTiles.clear();
}

export function bboxToTileIds(
  bbox: string,
  tileDeg: number = TILE_DEG,
): string[] {
  const parts = bbox.split(',').map(Number);
  const [minLon, minLat, maxLon, maxLat] = parts;
  if (parts.some(isNaN)) return [];

  const tiles: string[] = [];
  const startLat = Math.floor(minLat / tileDeg) * tileDeg;
  const startLon = Math.floor(minLon / tileDeg) * tileDeg;

  for (let lat = startLat; lat < maxLat; lat += tileDeg) {
    for (let lon = startLon; lon < maxLon; lon += tileDeg) {
      const tileId = `${lon}_${lat}`;
      tiles.push(tileId);
    }
  }
  return tiles;
}

export function generateAllTileIds(tileDeg: number = TILE_DEG): string[] {
  const tiles: string[] = [];
  for (let lat = -90; lat < 90; lat += tileDeg) {
    for (let lon = -180; lon < 180; lon += tileDeg) {
      tiles.push(`${lon}_${lat}`);
    }
  }
  return tiles;
}

export function tileIdToBbox(tileId: string, tileDeg: number = TILE_DEG): string {
  const [lonStr, latStr] = tileId.split('_');
  const lon = parseFloat(lonStr);
  const lat = parseFloat(latStr);
  const maxLon = Math.min(lon + tileDeg, 180);
  const maxLat = Math.min(lat + tileDeg, 90);
  return `${lon},${lat},${maxLon},${maxLat}`;
}
