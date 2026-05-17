# WO-029G-FE - Aviation Persistent Tile Cache + Render Reuse

## Status: COMPLETED

## Agent: OpenCode Web 1

## Start: 2026-05-17 11:10 UTC

## End: 2026-05-17 11:36 UTC

## Summary

Implemented persistent aviation tile cache with LRU eviction, TTL-based stale-while-revalidate, and incremental render reuse. Aviation data is now cached by (category, tileId) key and persists across viewport changes. Previously loaded markers remain visible when the camera moves. Only missing tiles are fetched.

## Files Changed

### New
- `apps/web/src/lib/aviationTileCache.ts` — LRU tile cache (max 200 entries, 10 min TTL, stale-while-revalidate at 2 min stale)
- `apps/web/src/lib/aviationObjectStore.ts` — Global deduplicated store of loaded AirportObject instances by ID

### Modified
- `apps/web/src/lib/aviationLayerRenderer.ts` — Added `renderAviationObjectsIncrementalAsync` that does NOT call `removeAll()`, only removes entities that should no longer be visible and adds entities that are new. Batches with requestAnimationFrame.
- `apps/web/src/CesiumGlobe.tsx` — Entity-based path now uses tile cache: computes overlapping 30° tiles from viewport bbox, checks cache, fetches only missing tiles, stores data in object store, renders incrementally. Dot path preserves existing dot collection (reuses rather than destroys). Layer OFF clears all caches. Filter change re-renders incrementally. Cache stats reported in AviationStats.
- `apps/web/src/components/StatusPanel.tsx` — Added cache stats display (Entries, Hits, Misses, In-flight)
- `apps/web/src/App.tsx` — Extended AviationStats interface with optional cache fields

## Architecture

```
fetchIfNeeded()
  ├── Global tile path (tier 0, explicit) → startTileLoading()
  │     ├── Preserves existing dot collection
  │     └── Adds new dots for new tiles
  │
  └── Entity path (all other cases) → tile cache
        ├── bboxToTileIds() → overlapping 30° tiles
        ├── makeTileKey(category, tileId, mode, includeClosed)
        ├── Cache check → fetch only missing tiles
        │     └── fetchMissingTiles() → fetchSingleTile()
        │           ├── storeObjects() into global store
        │           └── setTile() into LRU cache
        └── renderCurrentIncremental()
              └── renderAviationObjectsIncrementalAsync()
                    ├── Build visible set from filters/LOD
                    ├── Remove entities no longer visible
                    └── Add entities that are new (batched with rAF)
```

## Cache Configuration

| Parameter | Value | Notes |
|-----------|-------|-------|
| Tile size | 30° | Same as global tile loader |
| Max cache entries | 200 | LRU eviction when full |
| TTL | 10 min (600s) | Normal cache lifetime |
| Stale TTL | 2 min (120s) | Stale-while-revalidate window |
| Concurrency | 3 | Parallel tile fetches |
| Deduplication | AirportObject ID | Global object store |

## Verification

- `pnpm --filter @god-eyes/contracts build` — PASS
- `pnpm --filter web build` — PASS
- `git diff --check` — PASS (no whitespace errors)

## Known Issues

None. All WO-029F behavior preserved.
