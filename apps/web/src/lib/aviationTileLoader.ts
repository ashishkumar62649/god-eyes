import type { AirportObject } from '@god-eyes/contracts';
import { fetchAviationLayerObjects } from './api';

const TILE_DEG = 30;
const MAX_CONCURRENCY = 3;
const CACHE_TTL_MS = 120_000;
const MAX_CACHE = 200;
const INTERLEAVE_CONCURRENCY = 3;

interface TileCacheEntry {
  data: AirportObject[];
  ts: number;
}
const tileCache = new Map<string, TileCacheEntry>();

function pruneTileCache(): void {
  if (tileCache.size <= MAX_CACHE) return;
  const oldest = tileCache.keys().next().value;
  if (oldest) tileCache.delete(oldest);
}

export function clearTileCache(): void {
  tileCache.clear();
}

export interface TileInfo {
  bbox: string;
  key: string;
}

export function generateGlobalTiles(): TileInfo[] {
  const tiles: TileInfo[] = [];
  for (let lat = -90; lat < 90; lat += TILE_DEG) {
    for (let lon = -180; lon < 180; lon += TILE_DEG) {
      const minLon = lon;
      const maxLon = Math.min(lon + TILE_DEG, 180);
      const minLat = lat;
      const maxLat = Math.min(lat + TILE_DEG, 90);
      const bbox = `${minLon},${minLat},${maxLon},${maxLat}`;
      tiles.push({ bbox, key: `${minLon}_${minLat}_${maxLon}_${maxLat}` });
    }
  }
  return tiles;
}

export interface TileProgress {
  tileKey: string;
  category: string;
  count: number;
  totalSoFar: number;
  done: boolean;
}

export type TileUpdateCallback = (items: AirportObject[], progress: TileProgress) => void;

// Fetch all tiles for a single backend category. Calls onTileData for every completed tile.
export async function fetchCategoryTiles(
  category: string,
  _bbox: string,
  abortSignal: AbortSignal,
  onTileData: TileUpdateCallback,
): Promise<void> {

  const tiles = generateGlobalTiles();
  let totalSoFar = 0;
  const seen = new Set<string>();

  const queue = [...tiles];
  let active = 0;

  return new Promise<void>((resolve, _reject) => {
    function next(): void {
      while (active < MAX_CONCURRENCY && queue.length > 0 && !abortSignal.aborted) {
        const tile = queue.shift()!;
        active++;
        fetchTile(tile).finally(() => {
          active--;
          if (queue.length === 0 && active === 0) {
            resolve();
          } else if (!abortSignal.aborted) {
            next();
          }
        });
      }
    }

    async function fetchTile(tile: TileInfo): Promise<void> {
      if (abortSignal.aborted) return;

      // Check tile cache
      const cacheKey = `${category}:${tile.key}`;
      const cached = tileCache.get(cacheKey);
      if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        const batch = cached.data.filter((a) => {
          if (seen.has(a.id)) return false;
          seen.add(a.id);
          return true;
        });
        if (batch.length > 0) {
          totalSoFar += batch.length;
          onTileData(batch, { tileKey: tile.key, category, count: batch.length, totalSoFar, done: false });
        }
        return;
      }

      try {
        const response = await fetchAviationLayerObjects(
          'points', tile.bbox, undefined, 1000, abortSignal, undefined, category, 'marker',
        );

        const airports = response.items.filter(
          (item): item is AirportObject => item.objectType === 'airport',
        );

        // Cache tile result
        pruneTileCache();
        tileCache.set(cacheKey, { data: airports, ts: Date.now() });

        if (abortSignal.aborted) return;

        // Dedupe against previous tiles
        const batch = airports.filter((a) => {
          if (seen.has(a.id)) return false;
          seen.add(a.id);
          return true;
        });

        if (batch.length > 0) {
          totalSoFar += batch.length;
          onTileData(batch, { tileKey: tile.key, category, count: batch.length, totalSoFar, done: false });
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn(`Tile fetch failed for ${tile.key}:`, err);
      }
    }

    next();
  });
}

interface InterleaveWorkItem {
  category: string;
  tile: TileInfo;
}

/**
 * Fetch all tiles across multiple categories with a shared concurrency limit,
 * interleaving categories so the user sees dots from all selected categories early.
 */
export async function fetchInterleavedCategoryTiles(
  categories: string[],
  abortSignal: AbortSignal,
  onTileData: TileUpdateCallback,
): Promise<void> {
  if (categories.length === 0) return;

  const tiles = generateGlobalTiles();
  const queue: InterleaveWorkItem[] = [];
  for (const cat of categories) {
    for (const tile of tiles) {
      queue.push({ category: cat, tile });
    }
  }

  let totalSoFar = 0;
  const seen = new Set<string>();
  let active = 0;

  return new Promise<void>((resolve, _reject) => {
    function next(): void {
      while (active < INTERLEAVE_CONCURRENCY && queue.length > 0 && !abortSignal.aborted) {
        const work = queue.shift()!;
        active++;
        fetchTile(work).finally(() => {
          active--;
          if (queue.length === 0 && active === 0) {
            resolve();
          } else if (!abortSignal.aborted) {
            next();
          }
        });
      }
    }

    async function fetchTile(work: InterleaveWorkItem): Promise<void> {
      if (abortSignal.aborted) return;
      const { category, tile } = work;

      const cacheKey = `${category}:${tile.key}`;
      const cached = tileCache.get(cacheKey);
      if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        const batch = cached.data.filter((a) => {
          if (seen.has(a.id)) return false;
          seen.add(a.id);
          return true;
        });
        if (batch.length > 0) {
          totalSoFar += batch.length;
          onTileData(batch, { tileKey: tile.key, category, count: batch.length, totalSoFar, done: false });
        }
        return;
      }

      try {
        const response = await fetchAviationLayerObjects(
          'points', tile.bbox, undefined, 1000, abortSignal, undefined, category, 'marker',
        );

        const airports = response.items.filter(
          (item): item is AirportObject => item.objectType === 'airport',
        );

        pruneTileCache();
        tileCache.set(cacheKey, { data: airports, ts: Date.now() });

        if (abortSignal.aborted) return;

        const batch = airports.filter((a) => {
          if (seen.has(a.id)) return false;
          seen.add(a.id);
          return true;
        });

        if (batch.length > 0) {
          totalSoFar += batch.length;
          onTileData(batch, { tileKey: tile.key, category, count: batch.length, totalSoFar, done: false });
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn(`Tile fetch failed for ${category} ${tile.key}:`, err);
      }
    }

    next();
  });
}
