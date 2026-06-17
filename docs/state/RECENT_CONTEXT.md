# Recent Context

Classification: ROLLING_CONTEXT
Last updated: 2026-06-16

This file is the short rolling context for agents.

Agents read this file at session start instead of reading the full `docs/state/HANDOFF_LOG.md`.

`docs/state/HANDOFF_LOG.md` remains the full append-only project history and must still
receive the **complete** handoff entry after every completed task.

## Update rule

- Keep only the latest 3-5 work summaries in this file.
- Each entry must be short (5-8 lines).
- When adding a 6th entry, remove the oldest entry from this file only.
- Do **not** remove anything from `docs/state/HANDOFF_LOG.md`.
- Every completed work must update **both** `RECENT_CONTEXT.md` (short summary) and
  `HANDOFF_LOG.md` (full entry). One does not replace the other.

## Entry format

```
## YYYY-MM-DD - short task name

- Agent: [neutral role name]
- Branch: [branch name]
- What changed: [one line]
- Validation: [pass/fail summary]
- Known issues: [one line or None]
- Next: [one line - what the next agent/task should do]
```

---

## 2026-06-17 - API-POLICY-001 Public API Naming Policy

- Agent: API Policy Documentation Agent
- Branch: docs/api-policy-001-public-api-naming
- What changed: Recorded the public API endpoint naming policy in `specs/008-structure-remediation-roadmap/api-endpoint-path-policy.md` (slug map: `layer_07_weather` → `weather`, `layer_08_news_osint` → `news`, `layer_10_energy_infrastructure` → `energy`, etc.); updated `tasks.md` and `plan.md` to mark the "API endpoint path policy decision" entry as Decided instead of Blocked / Needs decision (implementation remains Pending, sequenced as API-IMP-001 → API-URL-001 → WEB-API-001 → API-URL-002 → API-SIZE-001 in the policy doc). Internal layer IDs remain in contracts, registry, internal code, tests, and the database.
- Validation: branch and working tree clean (PASS); HEAD = `5bcb089`; only the 5 allowed files in `git diff --name-status` (new policy doc + tasks.md + plan.md + RECENT_CONTEXT + HANDOFF_LOG); `git diff --check` PASS; conflict-marker grep PASS; forbidden change check PASS (no apps/, services/, database/, packages/, tests/, docs/archive/, docs/control/, CURRENT_PROJECT_STATE, .specify/, .github/, or lockfiles); `pnpm --filter api build` PASS; `pnpm --filter api test` PASS (526/526 tests).
- Known issues: None
- Next: Reviewer Agent reviews API-POLICY-001; do not PR yet unless user explicitly decides; after API-POLICY-001 review, the next implementation work order is API-IMP-001 (entrypoint import normalization + pure shim removal) or API-URL-001 (clean slug endpoint aliases), per user / decision-control layer direction.

## 2026-06-16 - SR-016 Frontend Closure Docs Alignment

- Agent: Documentation Alignment Agent
- Branch: docs/sr-016/frontend-closure-alignment
- What changed: Aligned stale Spec 008 workspace docs (README.md, tasks.md, plan.md, frontend-layer-canonicalization-plan.md, frontend-layer-canonicalization-plan-report.md) with the completed frontend reconstruction through SR-015; updated status banners, work package status table, Phase 4 snapshot, recommended-order list, and added a completion addendum to the pre-implementation plan and report; frontend reconstruction is closed from a code/structure perspective.
- Validation: final layers directory listing PASS (8 canonical folders, 0 old folders); L4/L9 absence checks PASS; all 8 canonical `index.ts` exist PASS; old import grep checks PASS (all 6 old paths returned 0 lines); stale wording re-search PASS; git diff --check PASS; conflict-marker grep PASS; forbidden change check PASS; docs-only scope verified; `pnpm --filter web build` PASS; `pnpm --filter web test` PASS (64 tests); `pnpm --filter api build` PASS; `pnpm --filter api test` PASS; user reported real backend and database runtime validation passed after SR-015.
- Known issues: None
- Next: Reviewer Agent reviews SR-016; do not PR yet unless user explicitly decides; after SR-016 review, the user / decision-control layer should decide the next area: API cleanup, integration/full validation package, or PR package planning.

## 2026-06-16 - SR-015 Final Layer Shape Cleanup

- Agent: Frontend Structure Agent
- Branch: frontend/sr-015/final-layer-shape-cleanup
- What changed: Removed the 6 temporary old-name shim folders (`aviation/`, `borders/`, `earth-events/`, `space/`, `maritime/`, `energy/`) after SR-009 reviewer verified they were index-only; added missing public `index.ts` files for the already-canonical `layer_07_weather/` and `layer_08_news_osint/` folders (6 exports each, including the `WeatherLayer` and `NewsLayer` default exports); L4/L9 future-inactive folders were intentionally not created; final `apps/web/src/layers/` shape is now the 8 canonical layer folders only.
- Validation: pre-delete old shim folder checks PASS (each old folder contained only `index.ts`); pre-delete old import grep checks PASS (all 6 old paths returned 0 lines); canonical folder file listing PASS (all 8 canonical folders contain real source files); final layers directory listing PASS (8 canonical folders, 0 old folders); L4/L9 absence checks PASS; all 8 canonical `index.ts` exist PASS; weather/news index content checks PASS (no tests exported); pnpm --filter web build PASS; pnpm --filter web test PASS (64 tests); conflict-marker grep PASS; git diff --check PASS; forbidden change check PASS.
- Known issues: None
- Next: Reviewer Agent reviews SR-015; do not PR yet unless user explicitly decides; after SR-015 review, run website/backend smoke test again, then perform docs closure alignment.

## 2026-06-16 - SR-009 Aviation Canonicalization

- Agent: Frontend Structure Agent
- Branch: frontend/sr-009/aviation-canonical-folder
- What changed: Renamed the frontend aviation layer folder to `layer_01_aviation` via `git mv`; preserved the `aircraft/` subfolder (2 files) and `airports/` subfolder (16 files) with all 18 nested files atomic-moved with no content change; added canonical `index.ts` re-exporting all 12 externally-imported public modules via `export *` (no default exports in the folder); recreated the `aviation/` shim folder with `index.ts` re-exporting from the canonical path; updated the 35 active frontend import sites across 16 files (`App.tsx` × 3, `CesiumGlobe.tsx` × 8, `Shell.tsx` × 3, `StatusPanel.tsx`, `AviationDetail.tsx` × 3, `DetailPanelRoot.tsx` × 2, `SourcesSection.tsx`, `detailTypes.ts`, `AirportImageSlider.tsx`, `AirportLayoutOverlayToggle.tsx`, `AirportMapPopup.tsx` × 2, `AirportOverview.tsx`, `AirportPublicProfilePanel.tsx`, `AviationControls.tsx` × 2, `layerPanelTypes.ts` × 2, `lib/api.ts` × 3). Runtime strings preserved as intentional: `layerId: 'layer_01_aviation'` registry value (already canonical), WebSocket URL `/ws/aviation/aircraft/live`, layer registration `'layer_01_aviation.live_aircraft'`, message types (`aircraft.ready/snapshot/delta/error`), API paths `/api/aviation/aircraft/...`, `/api/airports/...`, `/api/layers/layer_01_aviation/...`, `new CustomDataSource('airport-layout')` Cesium data source name, entity id format `airport-${airport.id}`, error messages, UI disclaimer text, source comments, CSS class `legend-marker-airport`, `/aircraft-icons/...` static asset paths, and internal React state/prop names like `aviationLayerActive`/`aviationStats`/`aviationFilters`/`airportCollection`/`airportMap` (JS identifiers, not file paths).
- Validation: old `layers/aviation` import grep PASS (no output); canonical import grep PASS; runtime string review complete; pnpm --filter web build PASS; pnpm --filter web test PASS; conflict-marker grep PASS; git diff --check PASS
- Known issues: None
- Next: Reviewer Agent reviews SR-009; do not PR yet unless user explicitly decides; recommended next task after SR-009 review is to decide integration/full validation step before API or PR.

## 2026-06-16 - SR-014 Energy Canonicalization

- Agent: Frontend Structure Agent
- Branch: frontend/sr-014/energy-canonical-folder
- What changed: Renamed the frontend energy layer folder to `layer_10_energy_infrastructure` via `git mv`; preserved the `infrastructure/` subfolder with all 4 nested files (`EnergyInfrastructureLayer.tsx`, `energyInfrastructureApi.ts`, `energyInfrastructureTypes.ts`, `useEnergyInfrastructure.ts`); added canonical `index.ts` re-exporting all 4 public modules (named exports via `export *` and the `EnergyInfrastructureLayer` default export via `export { default as ... }`); recreated the `energy/` shim folder with `index.ts` re-exporting from the canonical path; updated the 10 active frontend import sites across 7 files (`App.tsx` × 2, `CesiumGlobe.tsx` × 2, `Shell.tsx` × 2, `EnergyDetail.tsx`, `detailTypes.ts`, `EnergyControls.tsx`, `layerPanelTypes.ts`). Runtime strings preserved as intentional: `layerId: 'layer_10_energy_infrastructure'` registry value (already canonical), `category: 'infrastructure'`, `new CustomDataSource('energy-infrastructure')` Cesium data source name, `entity.id.startsWith('energy-')` runtime prefix check, `/api/energy/infrastructure` API path, error messages (`Failed to fetch energy infrastructure`), and internal React state/prop names like `energyInfrastructureLayerActive`/`energyInfrastructureFilters`/`energyInfrastructureData`/`energyInfrastructureFeatures` (JS identifiers, not file paths).
- Validation: old `layers/energy` import grep PASS (no output); canonical import grep PASS; runtime string review complete; pnpm --filter web build PASS; pnpm --filter web test PASS; conflict-marker grep PASS; git diff --check PASS
- Known issues: None
- Next: Reviewer Agent reviews SR-014; do not PR yet unless user explicitly decides; recommended next task after SR-014 review is SR-009 aviation canonicalization (highest-risk per-layer move, do last).
