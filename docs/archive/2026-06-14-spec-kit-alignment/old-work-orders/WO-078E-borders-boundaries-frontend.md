# WO-078E â€” Borders & Boundaries Frontend Globe Layer

**Work Order ID:** WO-078E-BORDERS-BOUNDARIES-FRONTEND
**Branch:** agent/borders-boundaries-frontend
**Created:** 2026-05-26T00:57:33Z
**Agent:** Kiro CLI (Claude Sonnet 4.5)
**Status:** COMPLETE

## Goal

Add the Borders & Boundaries frontend layer that displays country boundary outlines on the Cesium globe using the existing API endpoint `GET /api/borders-boundaries/countries`.

## Scope

**Allowed:** `apps/web/src/**`, `docs/work-orders/**`, `docs/reports/**`, `docs/state/HANDOFF_LOG.md`
**Forbidden:** `apps/api/**`, `database/**`, `services/**`

## Deliverables

| File | Action |
|------|--------|
| `apps/web/src/lib/api.ts` | Added `fetchBordersBoundariesCountries()` |
| `apps/web/src/lib/useBordersBoundaries.ts` | Created hook with in-memory cache |
| `apps/web/src/CesiumGlobe.tsx` | Added `bordersData` prop + `GeoJsonDataSource` rendering |
| `apps/web/src/App.tsx` | Added `bordersLayerActive` state + `useBordersBoundaries` hook |
| `apps/web/src/components/Shell.tsx` | Added borders props |
| `apps/web/src/components/LayerPanel.tsx` | Added L2 toggle + MVP caveat |
| `apps/web/src/components/StatusPanel.tsx` | Added borders/earth events status |
| `apps/web/src/lib/useLayerRegistry.ts` | Marked layer_02 as active |

## API Endpoint Used

```
GET /api/borders-boundaries/countries?limit=250&simplify=0.05
```

## MVP Caveat

The frontend displays:
> "Natural Earth MVP/local/dev only. Not production-approved. Not Survey of India compliant."

This caveat appears in the LayerPanel when the Borders layer is active.

## Important Safety Notes

- Natural Earth Admin-0 Countries 1:50m is MVP/local/dev only
- Not production-approved
- Not Survey of India / Government of India compliant
- Disputed territories are not specially handled in this MVP frontend pass
