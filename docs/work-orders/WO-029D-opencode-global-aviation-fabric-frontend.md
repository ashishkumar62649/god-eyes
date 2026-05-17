# WO-029D-FE: Global Aviation Fabric Frontend v1 → LOD Visibility Redesign

**Status:** Implemented (LOD redesign replaces fabric/density)
**Agent:** OpenCode Web 1 (OpenCode CLI)
**Branch:** agent/opencode-web-1
**Date:** 2026-05-17

---

## Overview

Category-based LOD (Level of Detail) aviation visibility system. Replaces the density/fabric/fabric-crossfade approach with a single entity-based rendering mode where airport types are revealed by zoom level. No PointPrimitiveCollections, no fabric nodes, no density dots.

## LOD Zoom Tiers

| Tier | Label | Height Range | Visible Airport Types |
|------|-------|-------------|----------------------|
| 0 | FAR | >5M m (>6M exiting below) | large_airport only |
| 1 | REGIONAL | 1.5M–5M (1.2M–5M hysteresis) | + medium_airport |
| 2 | STATE | 300K–1.5M (250K–1.5M hysteresis) | + small_airport, heliport, seaplane_base, unknown |
| 3 | LOCAL | <300K | all respecting filters |

Hysteresis thresholds prevent flicker at tier boundaries:
- Tier 0→1: below 4M m; Tier 1→0: above 5M m
- Tier 1→2: below 1.2M m; Tier 2→1: above 1.5M m
- Tier 2→3: below 250K m; Tier 3→2: above 300K m

## Marker Colors (Updated 2026-05-17)

| Category | Color | Shape | Opacity |
|----------|-------|-------|---------|
| Airport / Airfield | `#00c8ff` (electric cyan) | Circle | Full |
| Heliport | `#ffb000` (strong amber) | Rounded square | Full |
| Seaplane Base | `#00f5d4` (strong aqua) | Diamond | Full |
| Closed / Historical | `#6b7280` (muted gray) | Circle with X | Full (only if filter ON) |
| Other / Unknown | `#7debff` (bright white-cyan) | Outline circle | Full |

## Architecture Changes from WO-029C-FE / WO-029D-FE

| Aspect | Before (fabric/density) | After (LOD) |
|--------|------------------------|-------------|
| Collections | 2 PointPrimitives + 1 Entity | 1 Entity (CustomDataSource only) |
| Modes | fabric / density / entity with crossfade | Single entity mode, no mode toggle |
| Full-globe view | Fabric nodes (aggregated) | Entity markers filtered by LOD tier |
| Click behavior | Fabric → fly-to; Density → Object Intel | Entity → Object Intel (unified) |
| Crossfade | translucencyByDistance on PointPrimitives | None needed (single mode) |
| Mode toggle | LayerPanel had render mode selector | Removed (replaced by LOD tier indicator) |
| `aviationDensityRenderer.ts` | Active import | Deprecated (preserved for reference) |
| Scaling approach | Logarithmic weight-based alpha/size | Tier-based visibility, equal marker size per tier |

## Why This Approach

The fabric/density approach, while performant, produced visuals that were too faint at full-globe zoom (tiny colored dots indistinguishable). The LOD approach shows real airport markers at every zoom level, revealing progressively more detailed facility types as the user zooms in. This provides clearer, more tactical-feeling aviation intelligence without relying on aggregation abstractions.

## Render Flow

1. API fetches up to 1000 items (`mode=points`) on camera move
2. Items cached in `itemsCacheRef`
3. Camera postRender callback tracks height → determines LOD tier with hysteresis
4. `filterByZoomTier(items, tier)` removes airports too detailed for current zoom
5. `renderAviationObjects()` renders remaining items with category-based filters
6. Marker click → Object Intel (existing behavior)
7. Filter toggle → immediate re-render with cached items + current tier

## FPS Display

- `postRender` event increments frame counter per frame
- 1-second interval computes FPS
- Displayed in StatusPanel with color coding (same as before)

## Files Changed (LOD Redesign)

| File | Change |
|------|--------|
| `apps/web/src/CesiumGlobe.tsx` | Complete rewrite: removed fabric/density PointPrimitives, added LOD tier tracking via postRender, single entity mode |
| `apps/web/src/lib/aviationCategories.ts` | Added `filterByZoomTier()`, `getAirportZoomTier()`, `ZOOM_TIER_LABELS`; updated marker colors |
| `apps/web/src/lib/airportMarkerSprites.ts` | Updated `CategoryIcons` colors to match new palette |
| `apps/web/src/lib/aviationDensityRenderer.ts` | Added deprecation comment (preserved for reference) |
| `apps/web/src/App.tsx` | Updated initial renderMode default |
| `apps/web/src/components/LayerPanel.tsx` | Updated render mode display for LOD labels |
| `apps/web/src/components/StatusPanel.tsx` | Updated render mode display for LOD labels |

## Known Limitations

1. **1000-item API limit**: At far zoom, large_airport count may not fill available viewport. Backend `MAX_VIEWPORT_LIMIT` not raised.
2. **Single entity mode**: No density↔entity crossfade needed. Entity markers have labels at all zoom levels (small labels at far zoom by Cesium).
3. **No `fields=marker`**: Uses default payload for type safety.
4. **FPS display is approximate**: 1-second sampling interval.
5. **Hysteresis not fully smoothed**: Tier transitions cause marker pop-in (items are re-filtered on tier change, not faded).
6. **Closed airports require explicit filter**: At tier 3, closed airports still respect user filter (default OFF).
7. **No unknown facility types at far zoom**: Unknown is tier 2 (state) minimum.

## LOD Logic Correction (2026-05-18)

### Problems Fixed

1. **Countries missing at global zoom**: Previously fetched 1000 mixed airports then filtered client-side. Now fetches only `international_or_major_airport` at global zoom (server-side `category` filter), ensuring the 1000 API limit is used efficiently.

2. **Categories appearing too late**: LOD thresholds raised from (5M/1.5M/300K) to (10M/3M/800K). Hysteresis adjusted accordingly (8M/2.5M/600K for down-transitions).

3. **Explicit filter mode**: When user turns OFF one or more categories, smart LOD is disabled. Selected categories are fetched globally and displayed at all zoom levels. Example: only Heliports ON → heliports visible from full globe.

4. **Smart LOD mode (all categories ON)**: proper category-based tier visibility:
   - Tier 0 (STRATEGIC, >10M): `international_or_major_airport` only
   - Tier 1 (NATIONAL, 3-10M): + `regional_or_domestic_airport`
   - Tier 2 (STATE, 800K-3M): + `small_airfield`, `heliport`, `water_landing_site`, `balloonport`, `unknown`
   - Tier 3 (LOCAL, <800K): all including `closed_or_abandoned` (if filter ON)

5. **Colors still too light**: All active marker colors strengthened. International major uses #00E5FF with 10px sprite. Regional uses #00B2FF with 8px. Small uses #7DEBFF with 6px. Heliport uses #FFB000. Seaplane uses #00FFD1. Unknown uses #B8F7FF. Closed remains #6B7280 with dim opacity.

### API Changes

- `validateCategory()` now accepts comma-separated category values (e.g., `international_or_major_airport,regional_or_domestic_airport`)
- `buildPointsSql()` uses `category_normalized = ANY($param)` for multi-category arrays, single `=` for single category (backward compatible)
- No contract changes. All 89 API tests pass.

### Frontend Changes

| File | Change |
|------|--------|
| `apps/api/src/routes/objects/validation.ts` | Multi-category support (comma-separated) |
| `apps/api/src/routes/objects/points.ts` | `ANY()` SQL for multi-category |
| `apps/web/src/lib/aviationCategories.ts` | Added `getFetchCategories()`, `isSmartLODMode()`, `displayFilterToApiCategories()`, `getZoomTierFromHeight()`, `LOD_TIER_THRESHOLDS`, `MODE_LABELS`; updated colors |
| `apps/web/src/lib/api.ts` | Added `categories` param to `fetchAviationLayerObjects()` |
| `apps/web/src/CesiumGlobe.tsx` | Rewrite: smart/explicit mode, server-side category fetch, new thresholds, `renderItems()` without client-side LOD filtering |
| `apps/web/src/lib/airportMarkerSprites.ts` | Added `AirportSizeIcons` with size-specific sprites (10px/8px/6px), `getAirportSprite()` |
| `apps/web/src/lib/aviationLayerRenderer.ts` | Uses `getAirportSprite()` for size-specific icons, category sprite fallback for others |
| `Apps/web/src/components/LayerPanel.tsx` | Updated mode label parser for SMART/EXPLICIT format |
| `Apps/web/src/components/StatusPanel.tsx` | Updated mode label parser for SMART/EXPLICIT format |

### Behavior Rules

**Mode A — Smart LOD** (all operational categories ON):
- Server fetches only categories visible at current tier
- No client-side LOD filtering; API results are authoritative

**Mode B — Explicit Filter** (one or more categories OFF):
- Server fetches all selected categories globally
- All fetched items displayed at all zoom levels
- Closed/Historical only included if toggle ON (in either mode)

### Manual Browser Verification Checklist

1. Full globe shows international/major airports across world (India, China, etc.)
2. Markers clearly visible (strong #00E5FF for major, #00B2FF regional, #7DEBFF local)
3. No numbered cluster bubbles
4. Zoom to country adds regional/domestic airports (~3-10M height)
5. Zoom to state adds local/heliport/seaplane (~800K-3M height)
6. Only Local ON → local airports visible globally
7. Only Heliports ON → heliports visible globally
8. Only Seaplane ON → water facilities visible globally
9. Two categories ON → both visible globally
10. All categories ON → smart LOD applies
11. Category toggles work
12. Closed/historical hidden by default
13. Closed toggle ON/OFF works
14. FPS display visible
15. Browser remains responsive
16. No red console errors
17. No runaway requests
18. No duplicate markers after toggles/zoom

## Build Result

- Contracts build: PASS
- API build: PASS
- API tests: PASS (89 tests)
- Web build: PASS (56 modules, 181.66 kB)
