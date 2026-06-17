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

## 2026-06-16 - SR-014 Energy Canonicalization

- Agent: Frontend Structure Agent
- Branch: frontend/sr-014/energy-canonical-folder
- What changed: Renamed the frontend energy layer folder to `layer_10_energy_infrastructure` via `git mv`; preserved the `infrastructure/` subfolder with all 4 nested files (`EnergyInfrastructureLayer.tsx`, `energyInfrastructureApi.ts`, `energyInfrastructureTypes.ts`, `useEnergyInfrastructure.ts`); added canonical `index.ts` re-exporting all 4 public modules (named exports via `export *` and the `EnergyInfrastructureLayer` default export via `export { default as ... }`); recreated the `energy/` shim folder with `index.ts` re-exporting from the canonical path; updated the 10 active frontend import sites across 7 files (`App.tsx` × 2, `CesiumGlobe.tsx` × 2, `Shell.tsx` × 2, `EnergyDetail.tsx`, `detailTypes.ts`, `EnergyControls.tsx`, `layerPanelTypes.ts`). Runtime strings preserved as intentional: `layerId: 'layer_10_energy_infrastructure'` registry value (already canonical), `category: 'infrastructure'`, `new CustomDataSource('energy-infrastructure')` Cesium data source name, `entity.id.startsWith('energy-')` runtime prefix check, `/api/energy/infrastructure` API path, error messages (`Failed to fetch energy infrastructure`), and internal React state/prop names like `energyInfrastructureLayerActive`/`energyInfrastructureFilters`/`energyInfrastructureData`/`energyInfrastructureFeatures` (JS identifiers, not file paths).
- Validation: old `layers/energy` import grep PASS (no output); canonical import grep PASS; runtime string review complete; pnpm --filter web build PASS; pnpm --filter web test PASS; conflict-marker grep PASS; git diff --check PASS
- Known issues: None
- Next: Reviewer Agent reviews SR-014; do not PR yet unless user explicitly decides; recommended next task after SR-014 review is SR-009 aviation canonicalization (highest-risk per-layer move, do last).

## 2026-06-16 - SR-012 Space Canonicalization

- Agent: Frontend Structure Agent
- Branch: frontend/sr-012/space-canonical-folder
- What changed: Renamed the frontend space layer folder to `layer_05_space_satellites` via `git mv`; preserved the `satellites/` subfolder with all 4 nested files; added canonical `index.ts` re-exporting all 4 public modules; recreated the `space/` shim folder with `index.ts` re-exporting from the canonical path; updated the 16 active frontend import sites across 7 files. Runtime strings preserved as intentional: `layer_05_space_satellites` layerId registry values (already canonical), `/ws/space/satellites/live` WebSocket URL, `new CustomDataSource('space-satellites')` Cesium data source name, message types (`space.satellites.subscribe`, `space.satellites.snapshot`, `space.satellites.error`), source filter values (`celestrak`, `space-track`), CSS `justify-content: space-between`, font name `'JetBrains Mono'`, and internal React state/prop names like `spaceSatellitesLayerActive` (JS identifiers, not file paths).
- Validation: old `layers/space` import grep PASS; canonical import grep PASS; runtime string review complete; pnpm --filter web build PASS; pnpm --filter web test PASS (64 tests); conflict-marker grep PASS; git diff --check PASS
- Known issues: None
- Next: Reviewer Agent reviews SR-012; do not PR yet unless user explicitly decides; recommended next task after SR-012 review is SR-014 energy canonicalization.

## 2026-06-16 - SR-013 Maritime Canonicalization

- Agent: Frontend Structure Agent
- Branch: frontend/sr-013/maritime-canonical-folder
- What changed: Renamed the frontend maritime layer folder to `layer_06_maritime` via `git mv`; added canonical `index.ts`; recreated the `maritime/` shim folder with `index.ts` re-exporting from the canonical path; updated the 3 active frontend import sites (`App.tsx` × 2, `CesiumGlobe.tsx` × 1). Runtime strings preserved as intentional: `layer_06_maritime` layerId registry values (already canonical), `/api/layers/layer_06_maritime/...` API paths (owned by API Agent), and internal React state/prop names like `maritimeLayerActive` (JS identifiers, not file paths).
- Validation: old `layers/maritime` import grep PASS; canonical import grep PASS; runtime string review complete; pnpm --filter web build PASS; pnpm --filter web test PASS (64 tests including the relocated maritime test at `src/layers/layer_06_maritime/__tests__/maritime.test.ts`); conflict-marker grep PASS; git diff --check PASS
- Known issues: None
- Next: Reviewer Agent reviews SR-013; do not PR yet unless user explicitly decides; recommended next task after SR-013 review is SR-012 space canonicalization.

## 2026-06-16 - SR-011 Earth-Events Canonicalization

- Agent: Frontend Structure Agent
- Branch: frontend/sr-011/earth-events-canonical-folder
- What changed: Renamed the frontend earth-events layer folder to `layer_03_earth_events` via `git mv`; added canonical `index.ts`; recreated the `earth-events/` shim folder with `index.ts` re-exporting from the canonical path; updated the 5 active frontend import sites. Runtime strings (`CesiumGlobe.tsx` `new CustomDataSource('earth-events')` data source identifier; `lib/api.ts` `/api/earth-events/latest` API path) preserved as intentional.
- Validation: old `layers/earth-events` import grep PASS; canonical import grep PASS; runtime string review complete; pnpm --filter web build PASS; pnpm --filter web test PASS; conflict-marker grep PASS; git diff --check PASS
- Known issues: None
- Next: Reviewer Agent reviews SR-011; do not PR yet unless user explicitly decides; recommended next task after SR-011 review is SR-013 maritime canonicalization.

## 2026-06-16 - SR-021 Retry: Remove Redundant .gitkeep Files

- Agent: Structure Cleanup Agent
- Branch: chore/sr-021-retry-remove-redundant-gitkeep
- What changed: Removed exactly 7 redundant .gitkeep placeholder files from non-empty frontend folders: `apps/web/src/layers/.gitkeep`, `aviation/.gitkeep`, `aviation/aircraft/.gitkeep`, `aviation/airports/.gitkeep`, `earth-events/.gitkeep`, `layer_02_borders_boundaries/.gitkeep`, `globe/.gitkeep`. This retry was run after SR-010S created the canonical borders folder, so the previous blocker (canonical folder missing) is resolved.
- Validation: target gitkeep files no longer tracked; affected folders still contain tracked content; borders shim preserved; canonical export preserved; conflict-marker grep PASS; forbidden-area check PASS; source-code-change check PASS; git diff --check PASS
- Known issues: None
- Next: User / decision-control layer reviews local SR-021 commit and decides whether to push/open PR; recommended next task after SR-021 review is SR-011 earth-events canonicalization (lowest-risk per-layer move).
