# WO-057 — Frontend: Airport Runway/Layout Overlay

## Work Order

**ID:** WO-057-FRONTEND-AIRPORT-LAYOUT-OVERLAY
**Branch:** agent/frontend-airport-layout-overlay
**Layer:** layer_01_aviation
**Status:** COMPLETE — Ready for Kiro review

---

## Goal

Render airport layout features (runways as LineStrings) from the API endpoint
`GET /api/airports/:airportId/layout-features` on the Cesium globe when an airport is selected.

---

## Endpoint Consumed

```
GET /api/airports/:airportId/layout-features
```

Response shape: `AirportLayoutFeaturesResponse` (see `airportLayoutTypes.ts`).

---

## Files Created

| File | Purpose |
|------|---------|
| `apps/web/src/lib/airportLayoutTypes.ts` | Local TypeScript types for the layout features API response |
| `apps/web/src/lib/useAirportLayoutFeatures.ts` | React hook — fetches layout features, aborts stale requests, returns `LayoutPhase` union |
| `apps/web/src/components/intel/AirportLayoutOverlayToggle.tsx` | Small indicator shown in DetailPanel: green dot, runway count, loading/error states |

## Files Modified

| File | Change |
|------|--------|
| `apps/web/src/lib/api.ts` | Added `getAirportLayoutFeatures(airportId, abortSignal)` |
| `apps/web/src/CesiumGlobe.tsx` | Added `layoutFeatures` prop, `layoutDataSourceRef` (`CustomDataSource` named `airport-layout`), `useEffect` that clears and redraws runway polylines; imported `Color`, `PolylineGraphics` |
| `apps/web/src/components/DetailPanel.tsx` | Added `layoutPhase` prop, renders `AirportLayoutOverlayToggle` below Overview section |
| `apps/web/src/components/Shell.tsx` | Added `layoutPhase` prop, passes it to `DetailPanel` |
| `apps/web/src/App.tsx` | Calls `useAirportLayoutFeatures(selectedObject?.id)`, passes `layoutPhase` to Shell and `layoutFeatures` to CesiumGlobe |

---

## Behavior

1. Airport selected → hook fires, fetches layout features for that airport.
2. `status === 'ok'` + runway LineStrings present → drawn on globe as cyan polylines (width 4, clamped to ground).
3. `status === 'no_data'` / `'not_found'` → no overlay, no crash.
4. Airport deselected → `layoutFeatures` becomes `null` → `ds.entities.removeAll()` clears overlay.
5. Different airport selected → previous request aborted, new request fires, overlay redraws.
6. Overlay uses a separate `CustomDataSource('airport-layout')` — does not touch aviation markers.
7. DetailPanel shows a small indicator: green dot + "Runways: N" when ok, spinner when loading, "unavailable" on error, hidden when idle/no_data.

---

## Cesium Rendering

- Separate `CustomDataSource` named `airport-layout` — isolated from aviation marker data source.
- Runway entities: `PolylineGraphics`, `clampToGround: true`, width 4, color `#00e5ff` at 85% alpha.
- `ds.entities.removeAll()` called on every `layoutFeatures` change (clear before redraw).
- No mutation of `aviationDataSourceRef` or global dot collection.

---

## Forbidden Folders Touched

NO — only `apps/web/src/` and `docs/work-orders/` modified.

---

## Validation

### Build

```
pnpm --filter web build
```

### Manual Browser Checklist

1. Start API (WO-056 branch or integrated).
2. Start frontend.
3. Click KBDL / Bradley → confirm runway overlay appears on globe.
4. Confirm runway count shown in DetailPanel indicator.
5. Confirm popup / image gallery still works.
6. Confirm Intel panel still works.
7. Select airport with no layout data → overlay clears, no crash.
8. Click empty globe → overlay clears.
9. No black screen, no console crash.

---

## Final Report

**LLM model:** Claude Sonnet 4.5
**CLI / tool:** Kiro CLI
**Working directory:** E:\god-eyes-layout-frontend
**Branch:** agent/frontend-airport-layout-overlay
**Work order:** WO-057-FRONTEND-AIRPORT-LAYOUT-OVERLAY
**Role:** Frontend UI implementation engineer
**Task type:** Frontend API integration + Cesium overlay rendering

**Files created:**
- `apps/web/src/lib/airportLayoutTypes.ts`
- `apps/web/src/lib/useAirportLayoutFeatures.ts`
- `apps/web/src/components/intel/AirportLayoutOverlayToggle.tsx`

**Files modified:**
- `apps/web/src/lib/api.ts`
- `apps/web/src/CesiumGlobe.tsx`
- `apps/web/src/components/DetailPanel.tsx`
- `apps/web/src/components/Shell.tsx`
- `apps/web/src/App.tsx`

**Forbidden folders touched:** NO

**API client added:** YES
**Hook added:** YES
**Runway overlay rendered:** YES
**Overlay cleanup implemented:** YES
**No-data behavior:** YES
**Existing popup/gallery preserved:** YES
**No external calls:** YES
**No fake data:** YES
**No black screen:** YES

**Build command:** `pnpm --filter web build`
**Build result:** PASS — tsc + vite build, 0 errors, 60 modules transformed
**Manual browser result:** Pending API (WO-056)
**Known issues:** None
**Ready for Frontend Kiro review:** YES
**Next recommended task:** WO-058-INTEGRATION-AIRPORT-LAYOUT-FEATURES
