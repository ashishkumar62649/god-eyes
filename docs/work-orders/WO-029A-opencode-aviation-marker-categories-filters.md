# WO-029A: Aviation Marker Categories + Filters Foundation

**Status:** Complete
**Agent:** OpenCode Web 1 (OpenCode CLI)
**Branch:** agent/opencode-web-1
**Date:** 2026-05-17

## Objective

Add frontend-only aviation marker category model, filter controls, category-aware markers, and hidden-by-default closed airports — without backend changes, density renderer, or cluster removal.

## Files Created

- `apps/web/src/lib/aviationCategories.ts` — category type model, mapper, filter state interface

## Files Modified

- `apps/web/src/lib/airportMarkerSprites.ts` — added `CategoryIcons` with distinct shapes/colors per category
- `apps/web/src/lib/aviationLayerRenderer.ts` — accepts `AviationFilters`, filters items, assigns category icons
- `apps/web/src/CesiumGlobe.tsx` — accepts `aviationFilters` prop, caches last response items, re-renders on filter change without re-fetch
- `apps/web/src/App.tsx` — added `aviationFilters` state + `handleFiltersChange`, passes to Shell and CesiumGlobe
- `apps/web/src/components/Shell.tsx` — passes `aviationFilters` + `onFiltersChange` to LayerPanel
- `apps/web/src/components/LayerPanel.tsx` — added MARKER FILTERS toggles (4 categories) + MARKER LEGEND display
- `apps/web/src/components/intel/AirportOverview.tsx` — uses `getCategoryLabel()` instead of raw category string
- `apps/web/src/styles/shell.css` — added `.filter-section`, `.filter-toggle`, `.legend-section`, `.legend-marker-*` styles

## Category Mapping

| Display Category | Source `category` values | Marker Shape | Marker Color |
|---|---|---|---|
| Airport / Airfield | `large_airport`, `medium_airport`, `small_airport` | Circle | Cyan (#00d2ff) |
| Heliport | `heliport` | Rounded Square | Green (#00e676) |
| Seaplane Base | `seaplane_base` | Diamond | Amber (#ffab00) |
| Closed / Historical | `closed`, `typeSource` containing `abandoned` | Dim Circle + X | Gray (#666666) |
| Other / Unknown | Unrecognized values | Outline Circle | Gray (#999999) |

## Design Decisions

- All operational categories use same 8px size — no visual discrimination by airport size.
- Closed airports hidden by default (filter toggle default OFF).
- Unknown/Other always visible.
- Cluster rendering unchanged (no category filtering on clusters).
- Search results not filtered — closed airports still appear in search and open Object Intel.
- Marker click, Object Intel detail loading, behind-globe hiding all preserved.
- Category-aware re-rendering uses cached items (avoids extra API calls on filter toggle).
- No backend changes, no database changes, no contracts changes.

## Build Result

- `pnpm --filter @god-eyes/contracts build` — PASS
- `pnpm --filter web build` — PASS (56 modules, 179.12 kB)
