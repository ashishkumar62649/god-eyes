# WO-029C-FE: Aviation Density View Frontend Implementation v1

**Status:** Implemented
**Agent:** OpenCode Web 1 (OpenCode CLI)
**Branch:** agent/opencode-web-1
**Date:** 2026-05-17

---

## Overview

Implementation of aviation density view v1 using Cesium `PointPrimitiveCollection`. Replaces numbered cluster bubbles as the default global aviation view with crisp, colored density dots.

## Changes

### Files Created

- **`apps/web/src/lib/aviationDensityRenderer.ts`** (new)
  - PointPrimitiveCollection rendering for density dots
  - Per-point category color using `AVIATION_CATEGORIES`
  - Filter-aware: respects `AviationFilters` for all categories
  - Returns `pointMap` (Map<string, AirportObject>) for click resolution
  - Uses `scaleByDistance` and `translucencyByDistance` for smooth fade
  - No labels, no glow, no blur, no importance scaling
  - Closed dots rendered in dim gray when enabled

### Files Modified

- **`apps/web/src/CesiumGlobe.tsx`**
  - Added `PointPrimitiveCollection` ref alongside existing `CustomDataSource`
  - Added `renderModeCacheRef` and `densityPointMapRef` for mode tracking and click lookup
  - Added `aviationRenderMode` prop (`'density'` | `'clusters'`)
  - Modified `fetchAndRenderData` with density vs entity mode switching
  - Added hysteresis (50km dead zone) around 300km threshold to prevent flicker
  - Mode logic: default density mode fetches `mode='points'` always; cluster fallback uses old logic
  - Click handler: detects `PointPrimitive` picks via `pickedObject.id` string prefix, resolves via Map, applies behind-globe check
  - Cleanup: properly removes `PointPrimitiveCollection` on unmount and layer deactivation
  - Filter effect: handles density mode re-renders from cache

- **`apps/web/src/App.tsx`**
  - Added `aviationRenderMode` state (default: `'density'`)
  - Added `handleRenderModeChange` callback
  - Updated `aviationStats` type to include `renderMode` field
  - Passes `aviationRenderMode` to `CesiumGlobe` and `Shell`

- **`apps/web/src/components/Shell.tsx`**
  - Added `aviationRenderMode` and `onRenderModeChange` props
  - Passes through to `LayerPanel`

- **`apps/web/src/components/LayerPanel.tsx`**
  - Added `aviationRenderMode` and `onRenderModeChange` props
  - Added "RENDER MODE" toggle section below legend
  - DENSITY VIEW (default) and CLUSTER VIEW toggle buttons
  - Mode display updated to show "DENSITY DOTS"

- **`apps/web/src/components/StatusPanel.tsx`**
  - Updated `renderMode` display to show "DENSITY" when in density mode

## Architecture

```
Layer Active (default density mode)
  ├─ Height >= 250,000m (with hysteresis)
  │     └─ PointPrimitiveCollection (density dots)
  │            ├─ One PointPrimitive per visible airport
  │            ├─ Color per `getAviationDisplayCategory()`
  │            ├─ pixelSize = 4, scaleByDistance
  │            └─ No labels
  │
  └─ Height < 350,000m (with hysteresis)
        └─ CustomDataSource / Entity (category icons + labels)
               ├─ Same as current point markers
               ├─ Billboard + label per airport
               └─ Click opens Object Intel
```

Cluster fallback: When toggled to CLUSTER VIEW, uses old `clusters` ↔ `points` logic with 1,500,000m threshold.

## Zoom Thresholds

| Mode | Threshold | Hysteresis |
|------|-----------|------------|
| Density → Entity | 300,000m | ±50,000m |
| Entity → Density | 300,000m | ±50,000m |
| Cluster (fallback) | 1,500,000m | None (existing) |

## Click Behavior

- **Density dot click**: `scene.pick` → `pickedObject.id` (string `density-{uuid}`) → `densityPointMapRef` lookup → behind-globe check → `onObjectSelect`
- **Entity marker click**: Unchanged (existing `Entity.properties.rawData` path)
- **Cluster click**: Unchanged (existing cluster zoom behavior)

## Filter Behavior

- Density mode: Filters applied during `renderDensityDots()` construction
- Entity mode: Unchanged (existing `renderAviationObjects()` filter path)
- Filter change triggers re-render from `itemsCacheRef` for both modes

## Known Limitations

1. **1000-item API limit**: Density view of large areas sparse until backend `MAX_VIEWPORT_LIMIT` is raised
2. **Hard switch**: No smooth cross-fade between density and entity modes (v2 feature)
3. **No labels**: Density dots intentionally unlabeled per product direction
4. **Click precision**: Small (4px) dots at global zoom may be hard to click precisely
5. **No `fields=marker`**: Uses default payload (not marker profile) to avoid type issues with existing contracts
6. **Cluster fallback**: Remains as optional toggle, not removed; documented as fallback-only

## QA Checklist

1. Aviation ON → density dots at global zoom, NOT numbered clusters
2. Zoom IN past 300km → category icon Entity markers appear
3. Zoom OUT → density dots reappear
4. Click density dot → Object Intel opens with correct airport
5. Click Entity marker → Object Intel opens
6. Filters work in density and marker modes
7. Closed/Historical hidden by default
8. Toggle Closed ON → dim gray dots appear
9. Search OMDB/KORD/JRA → works in both modes
10. Cluster fallback toggle → switches to old cluster view
11. No duplicate markers after zoom/filter/layer toggles
12. No red console errors
13. No runaway network requests
14. Browser does not freeze during normal zoom/pan

## Build Result

- Contracts build: PASS
- Web build: PASS (57 modules, 182.75 kB)
