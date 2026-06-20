/**
 * useResidentAviationCache.ts — Wave 4 CesiumGlobe split (W4-E)
 *
 * Resident aviation cache + preload + filter-change hook.
 *
 * Owns three Cesium `useEffect` blocks and three internal helpers that
 * together implement the resident-cache behavior for Layer 01 aviation:
 *
 *   1. **Aviation layer ON/OFF handling** — toggles `dotsCreatedRef`,
 *      `preloadingRef`, and the resident cache in memory; emits stats
 *      to `onStatsChangeRef`; reuses the cache if present or starts a
 *      new preload otherwise.
 *   2. **Retry preload when viewer becomes ready** — if the aviation
 *      layer is active but the viewer wasn't ready when ON was toggled,
 *      kick off the preload once `viewerReady === true`.
 *   3. **Filter change visibility-only update** — re-applies the
 *      current filter set without re-fetching any data.
 *
 * Internal helpers (kept inside the hook closure):
 *
 *   - `emitStats(renderMode, preloadStatus?, categoryCounts?)` — emits
 *     the `AviationStats` shape consumed by `App.tsx`.
 *   - `applyFiltersToDots()` — re-runs `filterVisibleGlobalDots` and
 *     emits stats with the visible count.
 *   - `startResidentPreload()` — kicks off the `fetchAllAviationCategories`
 *     preload through a guarded 4-step state machine, with an
 *     `AbortController` so the viewer-init cleanup can abort it.
 *
 * Helpers NOT moved (kept in `index.tsx` because they are also needed
 * by the live aircraft renderer in W4-G):
 *
 *   - `shouldShowAircraftIcons()` — reads `cameraHeightRef`, used by
 *     the live aircraft snapshot/delta handlers to decide icon vs dot.
 *   - `getAircraftVisualImage(color, iconName)` — used by both
 *     `updateAircraftVisualMode` AND the live aircraft renderer.
 *   - `updateAircraftVisualMode()` — iterates `aircraftMapRef` to
 *     swap image mode on camera move; coupled to W4-G's aircraft map.
 *
 * The orchestrator (`apps/web/src/CesiumGlobe/index.tsx`) calls this
 * hook in place of three inline `useEffect` blocks and three helper
 * closures. Behavior is bit-for-bit identical.
 */

import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type { PointPrimitiveCollection, Viewer } from 'cesium';

import type { AviationFilters } from '../layers/layer_01_aviation/airports/aviationCategories';
import {
  addAllDotsToCollection,
  createGlobalDotCollection,
  filterVisibleGlobalDots,
} from '../layers/layer_01_aviation/airports/aviationGlobalRenderer';
import { getAllObjects } from '../layers/layer_01_aviation/airports/aviationObjectStore';
import { fetchAllAviationCategories } from '../layers/layer_01_aviation/airports/aviationPreloader';

import type { AviationStats } from './types';

export interface UseResidentAviationCacheParams {
  /** Live Cesium Viewer ref (null before init / after destroy). */
  viewerRef: MutableRefObject<Viewer | null>;
  /** True once the viewer-init `useEffect` has finished and the Viewer is live. */
  viewerReady: boolean;
  /** Current value of the `aviationLayerActive` prop. */
  aviationLayerActive: boolean;
  /** Current value of the `aviationFilters` prop. */
  aviationFilters: AviationFilters;
  /** Scene primitive holding the resident cache dots. */
  globalDotCollectionRef: MutableRefObject<PointPrimitiveCollection | null>;
  /** Ref mirror of `aviationLayerActive` (used by the retry-preload effect). */
  aviationLayerActiveRef: MutableRefObject<boolean>;
  /** Ref mirror of `aviationFilters` (used inside async helpers). */
  aviationFiltersRef: MutableRefObject<AviationFilters>;
  /** True once the cache has been fully preloaded at least once. */
  residentCacheActiveRef: MutableRefObject<boolean>;
  /** True while a preload fetch is in flight. */
  preloadingRef: MutableRefObject<boolean>;
  /** True once dots have been added to `globalDotCollectionRef` for the current cache. */
  dotsCreatedRef: MutableRefObject<boolean>;
  /** AbortController for the in-flight preload fetch (set/cleared inside the preload state machine). */
  abortControllerRef: MutableRefObject<AbortController | null>;
  /** Ref mirror of the `onAviationStatsChange` prop callback. */
  onStatsChangeRef: MutableRefObject<
    ((stats: AviationStats) => void) | undefined
  >;
  /** Ref mirror of the current FPS reading. */
  fpsRef: MutableRefObject<number>;
}

/**
 * Resident aviation cache hook.
 *
 * Owns the layer-toggle, retry-preload, and filter-change effects
 * plus the `emitStats` / `applyFiltersToDots` / `startResidentPreload`
 * helpers. Behavior is bit-for-bit identical to the inline code in
 * `apps/web/src/CesiumGlobe/index.tsx` (formerly at lines 227-368 +
 * 579-625 of the pre-W4 orchestrator).
 */
export function useResidentAviationCache(
  params: UseResidentAviationCacheParams,
): void {
  const {
    viewerRef,
    viewerReady,
    aviationLayerActive,
    aviationFilters,
    globalDotCollectionRef,
    aviationLayerActiveRef,
    aviationFiltersRef,
    residentCacheActiveRef,
    preloadingRef,
    dotsCreatedRef,
    abortControllerRef,
    onStatsChangeRef,
    fpsRef,
  } = params;

  function emitStats(
    renderMode: string,
    preloadStatus?: string,
    categoryCounts?: Record<string, number>,
  ): void {
    const allObjects = getAllObjects();
    const visibleCount = globalDotCollectionRef.current?.length ?? 0;
    onStatsChangeRef.current?.({
      loaded: allObjects.length,
      visible: visibleCount,
      clustersActive: false,
      renderMode,
      fps: fpsRef.current,
      preloadStatus,
      categoryCounts,
    });
  }

  function applyFiltersToDots(): void {
    if (globalDotCollectionRef.current && viewerRef.current) {
      const filters = aviationFiltersRef.current;
      filterVisibleGlobalDots(globalDotCollectionRef.current, viewerRef.current.scene, filters);
      const allObjects = getAllObjects();
      let visibleCount = 0;
      const length = globalDotCollectionRef.current.length;
      for (let i = 0; i < length; i++) {
        const p = globalDotCollectionRef.current.get(i);
        if (p && p.show) visibleCount++;
      }
      onStatsChangeRef.current?.({
        loaded: allObjects.length,
        visible: visibleCount,
        clustersActive: false,
        renderMode: 'RESIDENT_GLOBAL',
        fps: fpsRef.current,
        preloadStatus: residentCacheActiveRef.current ? 'CACHE_READY' : undefined,
      });
    }
  }

  async function startResidentPreload(): Promise<void> {
    // 1. If cache already active, return immediately
    if (residentCacheActiveRef.current) {
      return;
    }

    // 2. If viewer not ready, return WITHOUT setting preloadingRef
    // The viewerReady retry effect will handle this case
    if (!viewerRef.current) {
      return;
    }

    // 3. If already preloading, return
    if (preloadingRef.current) {
      return;
    }

    // 4. Only set flag AFTER we've passed all checks and are ready to start
    preloadingRef.current = true;

    const viewer = viewerRef.current;
    let collection = globalDotCollectionRef.current;
    if (!collection) {
      collection = createGlobalDotCollection(viewer.scene);
      globalDotCollectionRef.current = collection;
    }

    const ac = new AbortController();
    abortControllerRef.current = ac;

    emitStats('RESIDENT_GLOBAL', 'PRELOAD_STARTED');

    const categoryCounts: Record<string, number> = {};

    try {
      await fetchAllAviationCategories(ac.signal, (batch, progress) => {
        if (ac.signal.aborted) return;

        if (batch.length > 0) {
          addAllDotsToCollection(collection!, batch);
          dotsCreatedRef.current = true;
        }

        categoryCounts[progress.category] = progress.categoryCount;

        if (progress.allDone) {
          residentCacheActiveRef.current = true;
          emitStats('RESIDENT_GLOBAL', 'CACHE_READY', categoryCounts);
          applyFiltersToDots();
        } else {
          emitStats(
            'RESIDENT_GLOBAL',
            `LOADING:${progress.displayLabel}(${progress.categoryCount})`,
            categoryCounts,
          );
        }
      });
    } catch (err) {
      console.error('Preload error:', err);
      emitStats('RESIDENT_GLOBAL', 'ERROR: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      // Always clear preloadingRef so retry can happen if needed
      preloadingRef.current = false;
    }

    if (ac.signal.aborted) return;

    residentCacheActiveRef.current = true;
    emitStats('RESIDENT_GLOBAL', 'CACHE_READY', categoryCounts);
    applyFiltersToDots();
  }

  // Layer ON/OFF handling
  useEffect(() => {
    if (!aviationLayerActive) {
      // Layer OFF: hide dots but KEEP resident cache in memory
      if (globalDotCollectionRef.current) {
        globalDotCollectionRef.current.removeAll();
        dotsCreatedRef.current = false;
      }
      // Reset preload state so toggle can restart
      preloadingRef.current = false;
      emitStats('RESIDENT_GLOBAL', residentCacheActiveRef.current ? 'CACHE_READY (HIDDEN)' : 'IDLE');
    } else if (viewerRef.current) {
      // Layer ON: start preload if not already cached, otherwise reuse cache
      if (residentCacheActiveRef.current && getAllObjects().length > 0) {
        // Reuse existing cache — recreate dots from cached objects
        if (!dotsCreatedRef.current) {
          let collection = globalDotCollectionRef.current;
          if (!collection) {
            collection = createGlobalDotCollection(viewerRef.current.scene);
            globalDotCollectionRef.current = collection;
          }
          const allObjects = getAllObjects();
          addAllDotsToCollection(collection, allObjects);
          dotsCreatedRef.current = true;
        }
        emitStats('RESIDENT_GLOBAL', 'CACHE_READY');
        applyFiltersToDots();
      } else if (!preloadingRef.current) {
        startResidentPreload();
      }
    }
  }, [aviationLayerActive]);

  // Retry preload when viewer becomes ready while aviation layer is active
  useEffect(() => {
    if (!viewerReady) return;
    if (!aviationLayerActiveRef.current) return;
    if (residentCacheActiveRef.current) return;
    if (preloadingRef.current) return;
    startResidentPreload();
  }, [viewerReady]);

  // Filter change handling — only update visibility, NO data fetching
  useEffect(() => {
    if (!aviationLayerActive || !residentCacheActiveRef.current) return;
    applyFiltersToDots();
  }, [aviationFilters, aviationLayerActive]);
}
