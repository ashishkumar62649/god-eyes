# WO-029D-FE: Global Aviation Fabric Frontend v1

**Status:** Implemented
**Agent:** OpenCode Web 1 (OpenCode CLI)
**Branch:** agent/opencode-web-1
**Date:** 2026-05-17

---

## Overview

Implementation of Global Aviation Fabric v1. Replaces density dots at full-globe zoom with client-side computed fabric nodes using spatial grid aggregation. Fabric nodes represent merged nearby airports as tactical cyan dots weighted by airport count. Crossfades with density dots via translucencyByDistance.

## Product Changes

### What Changed from WO-029C-FE

| Aspect | WO-029C (previous) | WO-029D (new) |
|--------|-------------------|---------------|
| Full-globe view | 1000 sparse density dots | ~200-300 fabric nodes (aggregated) |
| Click behavior | Object Intel on density dot | Fabric nodes: fly-to-area; Density dots: Object Intel |
| Render modes | density / entity / cluster | fabric / density / entity |
| Crossfade | Hard switch | Natural crossfade fabric↔density via translucencyByDistance |
| FPS display | None | Live FPS in StatusPanel + postRender tracking |
| Cluster toggle | Yes (removed) | No (default only, no cluster fallback) |
| Collections | 1 PointPrimitive + 1 Entity | 2 PointPrimitives (fabric + density) + 1 Entity |

## Architecture

### 3-Mode Render System

```
Camera Height     Mode        Collection        Visual
──────────────    ──────      ────────────       ───────────────
>= 8,000,000m     fabric      fabricCollection   Tactical cyan nodes (aggregated)
300,000-8M        density     densityCollection  Category-colored density dots
< 300,000m        entity      aviationDataSource Entity billboards + labels
```

### Fabric↔Density Crossfade

- Both PointPrimitiveCollections coexist in the 6M-10M height range
- Fabric nodes use `translucencyByDistance: NearFarScalar(6M, 0.0, 10M, 1.0)` — fade in as you zoom out
- Density dots use `translucencyByDistance: NearFarScalar(6M, 1.0, 10M, 0.0)` — fade out as you zoom out
- Below 6M: only density dots visible
- Above 10M: only fabric nodes visible
- Natural distance-based crossfade, no timer logic needed

### Fabric Node Computation

- Uses 3°×3° spatial grid (client-side, no backend changes)
- Groups filtered airports into cells
- Each cell produces one node at weighted centroid
- Node pixelSize: 3 + sqrt(weight) × 0.8 (capped at 8px)
- Node alpha: 0.3 + weight × 0.02 (capped at 1.0)
- Color: cyan (#00d2ff) with variable alpha
- No text labels, no numbering, no glow/blur

### Click Behavior

| Click Target | Action |
|---|---|
| Fabric node | Fly to area at ~500km height (close enough for density dots to appear) |
| Density dot | Open Object Intel (behind-globe check preserved) |
| Entity marker | Open Object Intel (existing behavior preserved) |

## FPS Display

- `postRender` event increments frame counter per frame
- 1-second interval computes FPS = frames / elapsed seconds
- FPS value exposed through `onAviationStatsChange` callback
- Displayed in StatusPanel with color coding:
  - ≥50 FPS: green
  - 30-49 FPS: amber
  - <30 FPS: red

## Files Changed

- **`apps/web/src/lib/aviationDensityRenderer.ts`** — Added `FabricNode` interface, `computeFabricNodes()`, `renderFabricNodes()`, updated `renderDensityDots` with crossfade translucency
- **`apps/web/src/CesiumGlobe.tsx`** — Major rewrite: 3-mode system, dual PointPrimitiveCollections, fabric click handling, FPS tracking, crossfade support, removed cluster mode
- **`apps/web/src/App.tsx`** — Removed `aviationRenderMode` state (automatic now), updated stats interface with `fps`
- **`apps/web/src/components/Shell.tsx`** — Removed render mode props, updated stats interface
- **`apps/web/src/components/LayerPanel.tsx`** — Removed RENDER MODE toggle section, updated stats interface, added mode label mapping
- **`apps/web/src/components/StatusPanel.tsx`** — Added FPS display with color coding, updated render mode labels

## Visual Tuning (2026-05-17)

After initial implementation, the fabric nodes and density dots were too faint at full-globe zoom. Applied visual tuning:

### Fabric Node Changes

| Parameter | Before | After |
|---|---|---|
| Color | `#00d2ff` (medium cyan) | `#00EFFF` (bright cyan) |
| Alpha floor (min weight) | 0.32 | 0.55 |
| Alpha ramp | 0.02 per unit weight | 0.015 per unit weight |
| Base pixelSize | 3 + sqrt(w)×0.8 (max +5) | 4 + sqrt(w)×0.6 (max +3) |
| Outline color | `rgba(0,210,255,0.2)` | `rgba(0,238,255,0.35)` |

**Effect**: Minimum alpha increased 0.32→0.55. Brightest cyan `#00EFFF` replaces medium `#00d2ff`. Nodes start at 4px minimum. Outline 75% brighter.

### Density Dot Changes

| Parameter | Before | After |
|---|---|---|
| scaleByDistance min fraction | 0.30 (1.2px at far) | 0.55 (2.2px at far) |
| Outline opacity | `rgba(0,0,0,0.3)` | `rgba(0,0,0,0.4)` |

**Effect**: At far zoom, dots stay visible at 2.2px instead of shrinking to 1.2px (nearly invisible).

## Known Limitations

1. **1000-item API limit**: Fabric nodes at full globe only cover ~300 aggregated cells. Real fabric requires 5000+ items (backend change).
2. **No density↔entity crossfade**: Hard switch between PointPrimitives and Entities. Can flicker briefly at 300km threshold.
3. **No `fields=marker`**: Uses default payload for type safety (larger API response).
4. **No labeled mode separately**: Labels appear whenever Entity mode is active (<300km). At 100-300km, labels are very small.
5. **FPS display is approximate**: Uses 1-second sampling interval. Brief drops between samples not captured.

## Build Result

- Contracts build: PASS
- Web build: PASS (57 modules, 184.71 kB)
