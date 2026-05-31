import type { AirportObject } from '@god-eyes/contracts';
import { fetchAviationPreload } from '../../../lib/api';
import { storeObjects, getAllObjects } from './aviationObjectStore';
import {
  API_CATEGORY_LARGE,
  API_CATEGORY_REGIONAL,
  API_CATEGORY_SMALL,
  API_CATEGORY_HELIPORT,
  API_CATEGORY_WATER,
  API_CATEGORY_BALLOONPORT,
  API_CATEGORY_CLOSED,
  API_CATEGORY_UNKNOWN,
} from './aviationCategories';

const PRELOAD_CONCURRENCY = 4;

export interface PreloadProgress {
  category: string;
  displayLabel: string;
  categoryCount: number;
  totalLoaded: number;
  done: boolean;
  allDone: boolean;
}

export const PRELOAD_CATEGORIES: { apiCat: string; label: string }[] = [
  { apiCat: API_CATEGORY_LARGE, label: 'International' },
  { apiCat: API_CATEGORY_REGIONAL, label: 'Regional' },
  { apiCat: API_CATEGORY_SMALL, label: 'Local' },
  { apiCat: API_CATEGORY_HELIPORT, label: 'Heliports' },
  { apiCat: API_CATEGORY_WATER, label: 'Seaplane' },
  { apiCat: API_CATEGORY_BALLOONPORT, label: 'Balloonports' },
  { apiCat: API_CATEGORY_CLOSED, label: 'Closed' },
  { apiCat: API_CATEGORY_UNKNOWN, label: 'Unknown' },
];

export type PreloadBatchCallback = (
  batch: AirportObject[],
  progress: PreloadProgress,
) => void;

/**
 * Normalize raw API preload response items into AirportObject shape.
 * API returns flat latitude/longitude and status field.
 * Contract expects position object and typeSource field.
 */
function normalizeAirport(raw: any): AirportObject | null {
  if (!raw || typeof raw !== 'object') return null;

  const lat = raw.latitude;
  const lon = raw.longitude;
  if (lat == null || lon == null) return null;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  if (isNaN(lat) || isNaN(lon)) return null;

  return {
    id: raw.id || crypto.randomUUID(),
    layerId: 'layer_01_aviation',
    objectType: 'airport',
    sourceId: raw.sourceId || 'ourairports',
    sourceObjectId: raw.sourceObjectId || raw.id || '',
    name: raw.name || '',
    ident: raw.ident || '',
    iataCode: raw.iataCode || null,
    category: raw.category || 'unknown',
    typeSource: raw.typeSource || raw.status || '',
    country: raw.country || null,
    region: raw.region || null,
    municipality: raw.municipality || null,
    position: {
      latitude: lat,
      longitude: lon,
    },
    elevationFt: raw.elevationFt != null ? Number(raw.elevationFt) : null,
  };
}

export async function fetchAllAviationCategories(
  abortSignal: AbortSignal,
  onBatch: PreloadBatchCallback,
): Promise<number> {
  console.log('[AVIATION] fetchAllAviationCategories called, categories:', PRELOAD_CATEGORIES.map(c => c.apiCat));
  let totalLoaded = 0;
  const categoryCounts: Record<string, number> = {};

  const queue = [...PRELOAD_CATEGORIES];
  const workers: Promise<void>[] = [];

  for (let i = 0; i < PRELOAD_CONCURRENCY; i++) {
    workers.push((async () => {
      while (queue.length > 0 && !abortSignal.aborted) {
        const { apiCat, label } = queue.shift()!;
        if (!apiCat) continue;

        try {
          const response = await fetchAviationPreload(apiCat, abortSignal);
          if (abortSignal.aborted) return;

          const rawItems = response.items || [];

          const airports: AirportObject[] = [];
          for (const raw of rawItems) {
            const normalized = normalizeAirport(raw);
            if (normalized) {
              airports.push(normalized);
            }
          }

          storeObjects(airports);
          const catCount = airports.length;
          categoryCounts[apiCat] = catCount;
          totalLoaded += catCount;

          onBatch(airports, {
            category: apiCat,
            displayLabel: label,
            categoryCount: catCount,
            totalLoaded,
            done: true,
            allDone: false,
          });
        } catch (err: any) {
          if (err.name === 'AbortError') return;
          console.error('Preload failed for category', apiCat, ':', err);
          categoryCounts[apiCat] = 0;
          onBatch([], {
            category: apiCat,
            displayLabel: label,
            categoryCount: 0,
            totalLoaded,
            done: true,
            allDone: false,
          });
        }
      }
    })());
  }

  await Promise.all(workers);

  if (!abortSignal.aborted) {
    onBatch([], {
      category: 'all',
      displayLabel: 'Complete',
      categoryCount: 0,
      totalLoaded,
      done: true,
      allDone: true,
    });
  }

  return totalLoaded;
}

export function getCategoryCounts(): Record<string, number> {
  const allObjects = getAllObjects();
  const counts: Record<string, number> = {};
  for (const obj of allObjects) {
    const cat = obj.category || 'unknown';
    counts[cat] = (counts[cat] || 0) + 1;
  }
  return counts;
}
