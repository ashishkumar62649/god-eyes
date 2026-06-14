# WO-029B: Aviation Density View Frontend Architecture Plan

**Status:** Feasibility / Architecture Plan (Not Implemented)
**Agent:** OpenCode Web 1 (OpenCode CLI)
**Branch:** agent/opencode-web-1
**Date:** 2026-05-17

---

## 1. Current Architecture Summary

### 1.1 Fetch Flow

The frontend renders aviation markers through this pipeline:

```
Camera move → getViewportFromCamera() → fetchAviationLayerObjects(mode, bbox, zoom, limit=1000, signal)
    │
    ├─ mode='clusters' at camera height >= 1,500,000m
    │     → API returns AirportClusterObject[] (grid-aggregated count+position+categoryBreakdown)
    │     → renderAviationObjects() creates numbered cluster bubble Entities
    │
    └─ mode='points' at camera height < 1,500,000m
          → API returns AirportObject[] (up to 1000 items, standard schema)
          → renderAviationObjects() creates individual billboard Entity per airport
```

### 1.2 Rendering Approach

All rendering uses **Cesium Entity** (`CustomDataSource.entities.add()`):

- **Points**: Each airport creates an Entity with a `billboard` (canvas sprite 6-8px) + `label` (10px ident text)
- **Clusters**: Each cluster creates an Entity with a dynamic canvas bubble (24-36px) + `label` (count number)
- **Data**: Cached in `itemsCacheRef` for filter-triggered re-renders
- **Click**: `ScreenSpaceEventHandler` picks Entity, reads `properties.rawData` or `properties.isCluster`

### 1.3 Current Limits

| Constraint | Value | Source |
|---|---|---|
| Points mode max items | 1000 (with bbox), 500 (without) | `MAX_VIEWPORT_LIMIT` / `MAX_LIST_LIMIT` in backend |
| Clusters→Points threshold | camera height < 1,500,000m | `CesiumGlobe.tsx:132` |
| Fields returned | Full `AirportObject` schema | No `fields=marker` param sent |
| Filtering | Client-side via `AviationFilters` | No category filter sent to backend |

---

## 2. Recommended Rendering Approach: PointPrimitiveCollection

### 2.1 Comparison of Cesium Rendering Methods

| Method | Max Safe Count | Clickable | Per-Instance Color | Labels | GPU Instanced | Verdict |
|---|---|---|---|---|---|---|
| **Entity** (current) | ~3,000-5,000 | Yes (native) | Yes (per entity) | Yes | No | ❌ Too heavy for density |
| **PointPrimitiveCollection** | **100,000+** | **Yes (scene.pick)** | **Yes (per point)** | **No** | **Yes (GPU)** | **✅ BEST for density dots** |
| BillboardCollection | ~20,000-50,000 | Yes (scene.pick) | Via different images | No | Shared image only | ⚠️ OK, heavy per instance |
| Custom canvas overlay | Unlimited | No (manual) | Manual draw | Via canvas draw | N/A | ❌ No 3D depth/picking |
| Primitive API (geometry) | 100,000+ | Complex | Yes | Complex | Yes | ❌ Overkill for dots |

### 2.2 Why PointPrimitiveCollection for v1

**PointPrimitiveCollection** is the clear winner:

1. **GPU-instanced** — 85,000 points at `pixelSize=3` to `pixelSize=5` render at 60fps
2. **Per-point color** — each dot gets the category color (cyan for airport, green for heliport, amber for seaplane, gray for closed)
3. **`scaleByDistance`** — dots automatically shrink as camera zooms out, grow as it zooms in (built-in)
4. **`translucencyByDistance`** — smoothly fade out dots at high altitude, fade in at closer zoom
5. **`distanceDisplayCondition`** — hide dots beyond a threshold (supplementary to scaleByDistance)
6. **`scene.pick`** — click detection works natively on PointPrimitives
7. **No labels needed** at density zoom — labels appear when zoomed to Entity mode
8. **No per-frame React state** — the collection is created once and `.add()` batch-loaded

### 2.3 Architecture: Two-Collection Design

```
Layer Active
  ├─ Height >= ~300,000m (previously "clusters" zone)
  │     └─ POINT_PRIMITIVE_COLLECTION (density dots)
  │            ├─ One PointPrimitive per visible airport
  │            ├─ Color = f(getAviationDisplayCategory(airport))
  │            ├─ pixelSize = 4 (adjustable via scaleByDistance)
  │            └─ No labels
  │
  └─ Height < ~300,000m (previously "points" zone)
        └─ CUSTOM_DATA_SOURCE / ENTITY (category icons + labels)
               ├─ Same as current Entity markers (CategoryIcons per airport)
               ├─ Billboard + label per airport
               └─ Ident click behavior preserved
```

**Key distinction**: This REPLACES the old `clusters` ↔ `points` switch with `density` ↔ `points` switch. Clusters are no longer the default high-altitude view. Clusters remain as a configurable fallback.

---

## 3. Zoom-Level Behavior

### 3.1 Proposed Zoom Thresholds

| Zoom Range | Camera Height (approx) | Render Mode | Visual |
|---|---|---|---|
| 20M–10M (zoom 0–1) | ≥5,000,000m | Density (PointPrimitive) | 3px colored dots, translucent |
| 10M–1.5M (zoom 1–4) | 300,000–5,000,000m | Density (PointPrimitive) | 4–5px colored dots, solid |
| 300,000–100,000m | — | **Transition zone** | Density fades out, Entity icons fade in (v2: smooth) |
| 100,000–1,000m (zoom 6–14) | <300,000m | Entity (current point markers) | Category icons + ident labels |
| <1,000m (zoom 14+) | <1000m | Entity | Ident labels more prominent |

### 3.2 Transition Between Density and Entities

**v1 (hard switch)**:
- At `height < 300,000m`: clear PointPrimitiveCollection, render Entity markers
- At `height >= 300,000m`: clear Entity markers, render PointPrimitiveCollection
- Acceptable brief flicker on transition

**v2 (smooth fade)**:
- During transition zone (200,000–400,000m): render BOTH collections
- PointPrimitives use `translucencyByDistance` to fade out
- Entity markers use `scaleByDistance` to fade in (or start small and scale up)
- Requires overlap rendering for ~100ms during camera zoom

For v1, hard switch is safe and performant.

### 3.3 Cluster Fallback

Keep the cluster mode alive as a configurable option:
- A toggle in LayerPanel: "DENSITY VIEW" vs "CLUSTER VIEW" (technical/debug)
- Default: "DENSITY VIEW"
- When "CLUSTER VIEW" selected: use old clusters→points logic exactly as today
- This satisfies "do not remove cluster fallback"

---

## 4. Click Behavior

### 4.1 Density Mode Click (PointPrimitive)

When a density dot is clicked:

1. `scene.pick` returns the `PointPrimitive` object
2. The PointPrimitive does not carry full airport data (unlike Entity)
3. Maintain a lookup: `Map<string, AirportObject>` keyed by a unique `pointId` stored as PointPrimitive property
4. Each PointPrimitive stores `{ pointId: string }` via `point.properties` in Cesium API
5. On click: read `pointId` → lookup Map → resolve to `AirportObject`
6. Call `onObjectSelect(airportObject)` → Object Intel opens normally

**Alternative (simpler, no PointPrimitive properties needed)**:
- On click, get the pick result's position (Cartesian3)
- Find the nearest matching airport in `itemsCacheRef.current` by computing Cartesian3 distance
- Click nearby airport → Object Intel opens

**Recommendation for v1**: Use the `pointId` Map approach. Each PointPrimitive gets a unique `id` string derived from the airport UUID. A `Map<string, AirportObject>` provides O(1) lookup.

### 4.2 Entity Mode Click

Identical to current behavior — no changes needed. Entity.properties.rawData → onObjectSelect.

### 4.3 Search → Select

Already works — search results bypass rendering layer entirely. A search-selected airport opens Object Intel regardless of whether it's currently rendered on the map.

---

## 5. Filter Behavior

### 5.1 Density Mode Filtering

Same filter logic applies. When building the PointPrimitiveCollection:

```
for each airport in itemsCacheRef.current:
    displayCat = getAviationDisplayCategory(airport)
    if (filters say skip this category) continue
    add PointPrimitive with color = AVIATION_CATEGORIES[displayCat].markerColor
```

### 5.2 Closed/Historical Hidden by Default

- `filters.closed === false` → closed category airports are excluded from the PointPrimitiveCollection
- `filters.closed === true` → closed airports render as dim gray dots (`#666666`) with slight translucency
- Already aligned with existing filter architecture — no new filter logic needed

### 5.3 Filter Interaction with Mode Switch

- When switching from density to entity mode (zoom in), filters are re-applied by the existing re-render effect
- When filters change while in density mode, PointPrimitiveCollection is rebuilt from cache
- Same `itemsCacheRef` + `useEffect([aviationFilters, aviationLayerActive])` pattern as current implementation

---

## 6. Implementation Plan (v1)

### Step 1: Add `aviationDensityRenderer.ts`

**New file**: `apps/web/src/lib/aviationDensityRenderer.ts`

```typescript
import { PointPrimitiveCollection, PointPrimitive, Cartesian3, Color } from 'cesium';
import { AirportObject, AirportClusterObject } from '@god-eyes/contracts';
import { AviationFilters, getAviationDisplayCategory, AVIATION_CATEGORIES } from './aviationCategories';

interface DensityRenderResult {
  count: number;
  pointMap: Map<string, AirportObject>;
}

export function renderDensityDots(
  collection: PointPrimitiveCollection,
  items: (AirportObject | AirportClusterObject)[],
  filters?: AviationFilters | null
): DensityRenderResult {
  collection.removeAll();
  const pointMap = new Map<string, AirportObject>();
  let count = 0;

  for (const item of items) {
    if (item.objectType !== 'airport') continue; // Skip clusters in density mode
    const airport = item as AirportObject;
    if (airport.position.latitude === null || airport.position.longitude === null) continue;

    const displayCat = getAviationDisplayCategory(airport);
    if (filters) {
      if (displayCat === 'closed' && !filters.closed) continue;
      if (displayCat === 'heliport' && !filters.heliports) continue;
      if (displayCat === 'seaplane_base' && !filters.seaplaneBases) continue;
      if (displayCat === 'airport' && !filters.airports) continue;
    }

    const catInfo = AVIATION_CATEGORIES[displayCat];
    const pointId = `density-${airport.id}`;

    collection.add({
      position: Cartesian3.fromDegrees(airport.position.longitude, airport.position.latitude, 100),
      color: Color.fromCssColorString(catInfo.markerColor),
      pixelSize: 4,
      outlineColor: Color.fromCssColorString('rgba(0,0,0,0.3)'),
      outlineWidth: 0.5,
      scaleByDistance: new NearFarScalar(1000000, 1.0, 10000000, 0.3),
      translucencyByDistance: new NearFarScalar(5000000, 1.0, 15000000, 0.1),
      id: pointId,
    });

    pointMap.set(pointId, airport);
    count++;
  }

  return { count, pointMap };
}
```

### Step 2: Modify `CesiumGlobe.tsx`

- Add `PointPrimitiveCollection` ref (alongside existing `CustomDataSource`)
- Add `densityPointMapRef` for click lookup
- Add mode state: `'density' | 'entity' | 'clusters'` (replacing current `'points' | 'clusters'`)
- Modify `fetchAndRenderData` to:
  - Fetch with `fields=marker` when in density mode (lighter payload)
  - Call `renderDensityDots()` for density mode
  - Call `renderAviationObjects()` for entity/cluster modes
- Modify click handler to detect PointPrimitive picks and resolve via `densityPointMapRef`
- Adjust zoom threshold for density vs entity mode

### Step 3: Modify `LayerPanel.tsx`

- Add "DENSITY VIEW" / "CLUSTER VIEW" toggle (hidden in a technical expandable section)
- Default to DENSITY VIEW
- Update mode display text

### Step 4: Modify `api.ts`

- Add `fields` parameter to `fetchAviationLayerObjects()` — pass `'marker'` when in density mode
- Or add a separate `fetchAviationDensityObjects()` function

### Step 5: Verify

- Build, run, and manually verify per QA checklist below

---

## 7. Performance Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| 85k PointPrimitives freeze on old GPU | Low | PointPrimitiveCollection is GPU-instanced; test on integrated GPU; reduce pixelSize if needed |
| API returns 1000 items, not enough for density view of large area | **High** | Current `MAX_VIEWPORT_LIMIT=1000` limits density quality at global/national zoom. Add `limit=5000` support or use `fields=marker` + larger limit in backend constants. |
| Frequent rebuild of PointPrimitiveCollection on camera move | Medium | Same debounce architecture as current; `collection.removeAll()` + batch `.add()` is fast for PointPrimitives |
| Transition between density and entity modes causes flicker | Medium | v1 hard switch may flash; v2 can cross-fade using translucencyByDistance |
| Click picking misses on small (4px) dots | Low | `scene.pick` works at pixel precision; may need threshold-based nearest-dot fallback |
| Memory from maintaining both PointPrimitives + Entity cache | Low | Only one collection active at a time; `itemsCacheRef` is shared |

---

## 8. Minimal API Support Needed

These are NOT part of v1 implementation scope but are noted as ideal backend improvements.

### Essential (blocking for global density view):
1. **Increase `MAX_VIEWPORT_LIMIT`** from 1000 to **5000** in `apps/api/src/routes/objects/constants.ts`
   - Without this, a zoomed-out view of the USA (~20k airports in bbox) only shows 1000 dots
   - Result looks sparse and defeats the density purpose

### Nice-to-have (reduces payload):
2. **Add `fields=density` profile** returning only: `id, ident, category_normalized, position` (omit name, country, region, municipality, sourceId, sourceObjectId, etc.)
   - Current `fields=marker` is close but still includes name, municipality, country, iataCode, elevationFt
   - A `/layer_01_aviation/density` endpoint could serve even lighter data

3. **Server-side category filter** — currently filters are client-side; with 5000 items, client filtering is fine

---

## 9. QA Checklist Draft (Manual Browser Verification)

1. Toggle Aviation layer ON → globe shows category-colored density dots, NOT numbered clusters
2. Zoom IN past threshold → density dots replaced by category icon Entity markers
3. Zoom OUT → Entity markers replaced by density dots
4. Click density dot → Object Intel panel opens with correct airport
5. Click Entity marker → Object Intel panel opens (same behavior)
6. Filter toggles: turn off Heliports → heliport dots/icons disappear; re-enable → reappear
7. Closed/Historical OFF → no closed dots visible; ON → dim gray dots appear
8. Search airport → flies to location, Object Intel opens
9. Search closed airport → Object Intel opens even if closed filter is OFF
10. Cluster fallback toggle → switches back to numbered cluster bubbles at high zoom
11. Toggle filters repeatedly at both zoom levels → no duplicate markers, no console errors
12. Rapid zoom in/out → no runaway requests, no stale state
13. Behind-globe markers remain hidden
14. Console has zero red errors

---

## 10. Known Limitations

1. **v1 hard switch** between density and entity modes — no smooth cross-fade
2. **1000-item API limit** — density view of large areas will be sparse until backend limit is raised
3. **PointPrimitives have no labels** — no airport ident text at density zoom (intentional, product rule)
4. **Click precision on small dots** — small (4px) dots at global zoom may be hard to click precisely
5. **No category icon transition** — dots → icons jump at threshold; v2 can smoothly morph
6. **Clusters remain as optional fallback only** — not the default experience
7. **No changes to backend, database, or contracts** — all density logic is frontend-only

---

## 11. Files That Would Change in WO-029B

| File | Action | Reason |
|---|---|---|
| `apps/web/src/lib/aviationDensityRenderer.ts` | **Create** | PointPrimitiveCollection rendering |
| `apps/web/src/CesiumGlobe.tsx` | Modify | Add density mode, PointPrimitive ref, click handling |
| `apps/web/src/lib/api.ts` | Modify | Add `fields` param support |
| `apps/web/src/lib/aviayionCategories.ts` | No change | Filters already compatible |
| `apps/web/src/lib/airportMarkerSprites.ts` | No change | Category icons already designed |
| `apps/web/src/lib/aviationLayerRenderer.ts` | No change | Entity rendering stays for low zoom |
| `apps/web/src/components/LayerPanel.tsx` | Modify | Add density/cluster toggle, update mode display |
| `apps/web/src/App.tsx` | Modify | Add density mode state (if needed) |
| `apps/web/src/styles/shell.css` | Modify | Density toggle styles |
| `docs/work-orders/WO-029B.md` | Modify | Update after implementation |

---

## 12. Answers to the 14 Questions

### Q1: How are aviation points/clusters currently fetched?
Camera position → `getViewportFromCamera()` → `fetchAviationLayerObjects(mode, bbox, zoom, limit=1000)`. Mode is `clusters` if height >= 1,500,000m, else `points`. API returns `LayerObjectsListResponse` with `AirportObject[]` or `AirportClusterObject[]`.

### Q2: How are markers rendered?
All rendering uses `CustomDataSource.entities.add()`. Points get billboard (CategoryIcons canvas) + label (ident). Clusters get dynamic canvas bubble + count label. Both stored as Entities with `properties` for click handling.

### Q3: Current mode threshold?
`cameraHeight < 1,500,000m` → points. `>= 1,500,000m` → clusters. Roughly zoom 3-4.

### Q4: Why 85k airports is risky with Entities?
Each Entity creates multiple Cesium primitives with full lifecycle. Billboard + label per entity at 85k count causes massive frame drops. Label rendering alone at 10px monospace for 85k would destroy frame rate. Current 1000-item limit avoids this.

### Q5: Safest Cesium approach for density dots?
**PointPrimitiveCollection** — GPU-instanced, supports 100k+ at 60fps, per-point color, `scaleByDistance`, `translucencyByDistance`, native click picking via `scene.pick`.

### Q6: Best for WO-029B v1?
**PointPrimitiveCollection**. Two-collection architecture: density dots at high zoom, Entity markers at low zoom. Hard switch between them in v1. Use airport `id` → Map lookup for click resolution.

### Q7: Frontend-only using existing API?
**Partially yes**. The existing `fetchAviationLayerObjects('points', bbox, ...)` returns AirportObject[] with position + category that can drive density dots. Limitation: `limit=1000` undersamples large bboxes.

### Q8: Minimal API support needed?
Raise `MAX_VIEWPORT_LIMIT` from 1000 to 5000. Optionally add `fields=density` profile for smaller payloads.

### Q9: Clickability at each zoom?
Density zoom: `scene.pick` → `pointId` → `Map<string, AirportObject>` lookup → `onObjectSelect`. Entity zoom: identical to current behavior. Behind-globe check applies to both.

### Q10: Density dots → category icons transition?
v1: Hard switch at height threshold (~300,000m). v2: Cross-fade using translucencyByDistance on PointPrimitives and scaleByDistance on Entity billboards.

### Q11: Filters interaction with density mode?
Identical filter logic applied during PointPrimitiveCollection construction. Same `AviationFilters` interface, same `getAviationDisplayCategory()` mapper. Rebuild on filter change from items cache.

### Q12: Closed/historical hidden by default?
Same as current — `filters.closed === false` → closed category excluded from PointPrimitiveCollection. `filters.closed === true` → closed dots rendered in dim gray (#666666) with slight translucency.

### Q13: Risks?
API 1000-item limit undersamples dense regions. PointPrimitiveCollection rebuild on camera move may cause brief flicker. Click precision on 4px dots at global zoom. Hard switch between modes may flash.

### Q14: Smallest safe implementation plan?
Step 1: Create `aviationDensityRenderer.ts` with PointPrimitive rendering. Step 2: Modify `CesiumGlobe.tsx` to add density mode. Step 3: Add density/cluster toggle to `LayerPanel.tsx`. Step 4: Update `api.ts` to use `fields=marker` for density mode. That's the v1 minimum.
