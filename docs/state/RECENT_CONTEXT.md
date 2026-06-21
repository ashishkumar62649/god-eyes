# Recent Context

Classification: ROLLING_CONTEXT

Last updated: 2026-06-21 - Aviation Source Registry Initial Consolidation

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

## YYYY-MM-DD - short task name

- Agent: [neutral role name]
- Branch: [branch name]
- What changed: [one line]
- Validation: [pass/fail summary]
- Known issues: [one line or None]
- Next: [one line - what the next agent/task should do]

## 2026-06-21 - Aviation Source Registry Initial Consolidation

- Agent: Fetcher Agent
- Branch: `frontend/bugfix/cesium-globe-flash-picking` (current branch; docs-only change)
- What changed: Created 6 new source-catalog JSON files (`airplanes_live_v2.json`, `airplanes_live_global_web_json.json`, `wikipedia_rest_airport_profiles.json`, `wikidata_airport_profiles.json`, `wikimedia_commons_airport_images.json`, `opensky_trino.json`) and one README under `packages/source-catalog/layers/layer_01_aviation/`. Active sources registered with `status: active`; OpenSky Trino with `status: inactive_future_historical_backfill`; probe-only sources (OpenStreetMap / BTS / Eurostat / AviationWeather / official airport websites) documented in the README's "Probe / scaffold / not implemented" section. Existing `ourairports.json` left bit-for-bit unchanged. No code, no migration, no contract, no API, no frontend changes.
- Validation: All 7 aviation JSON files parse via `python -c "import json; json.load(...)"` and PowerShell `ConvertFrom-Json`. Cross-checked via `git grep` that the `ourairports` (52), `airplanes_live_v2` (11), `airplanes_live_global_web_json` (3), and `opensky_trino` (4) source IDs all exist in code; the three Wikimedia-side source IDs are deliberate upstream-provider identifiers documented in each file's `pipeline_source_id_note` and in the README. `git diff --check` clean. No `pnpm` build / test re-runs needed (docs-only operation).
- Known issues: Bundled-pipeline vs. upstream-provider source_id mismatch (deliberate; documented). Existing `ourairports.json` does not have the new fields (`status`, `access_type`, `requires_api_key`, `payment_required`, `attribution_required`, `what_it_provides`, `fields_collected`, `api_endpoints`, `frontend_usage`, `tests`, `known_limitations`) that the new files share; out of scope to modify. The current branch carries unrelated uncommitted work that the Fetcher Agent did not touch (verified via `git status --short`).
- Next: Orchestrator Agent reviews this branch and confirms the unrelated uncommitted changes are out of scope; the source-catalog handoff can be staged and committed separately, with the user / decision-control layer pushing the resulting commit per the standard Build → Review/Test → Push → Next flow.

## 2026-06-20 - Cesium Globe Flash and Picking Fixes

- Agent: Frontend Agent
- Branch: `frontend/bugfix/cesium-globe-flash-picking`
- What changed: Stabilized aircraft visual mode callback with `useCallback`; audited `useCesiumViewer` dependencies and converted `onEnergyFeatureSelect` to ref to prevent viewer recreation during layer toggles and entity selection; implemented robust satellite dot picking via `primitive?.id` check in `picking.ts`; added handler cleanup and created `pickingHandler.test.ts` unit tests.
- Validation: `pnpm --filter web build` PASS; `pnpm --filter web test` PASS (175/175). Checked viewer stability (no recreation) and selection clearing manually.
- Known issues: None
- Next: Orchestrator Agent integration review and PR merge to main.

## 2026-06-20 - Wave 4 CesiumGlobe Implementation Complete

- Agent: Wave 4 CesiumGlobe Working Agent
- Branch: `frontend/wave-4-cesium-globe-split`
- What changed: All eight implementation packages (W4-B through W4-H) landed on the consolidated branch as sequential commits per the task brief's important branch rule: W4-B picking-contract test (commit `d895dfc`); W4-C module shell + shim + helpers (`1836be1`); W4-D camera bbox reporter (`617c5e9`); W4-E resident aviation cache (`b674842`); W4-F picking handler (`ab4172f`); W4-G live aircraft renderer (`dd93421`); W4-H viewer lifecycle (`a01f878`). Final module shape: 10 files in `apps/web/src/CesiumGlobe/` plus `__tests__/pickingContract.test.ts`. The original 1436-line `apps/web/src/CesiumGlobe.tsx` is now a 1-line compatibility shim. W4-I consolidated the state docs.
- Validation: `git diff --check` clean (PASS); no merge conflict markers (PASS); `pnpm --filter @god-eyes/contracts build` PASS; `pnpm --filter web build` PASS (120 modules, 306.84 kB JS / 87.24 kB gzip); `pnpm --filter web test` PASS (170/170 across 9 test files); `pnpm --filter web test -- pickingContract.test.ts` PASS (17/17). Forbidden folders confirmed untouched via `git diff --name-only` (zero hits for `apps/api/`, `services/`, `database/`, `packages/`, `apps/web/src/layers/**`, `apps/web/src/globe/**`, `apps/web/src/components/**`, `docs/archive/`, `specs/009-future-scaling-architecture/**`, lockfiles, env files). No production layer files modified at any point during Wave 4.
- Known issues: Post-green V8 `FatalError: v8::ToLocalChecked Empty MaybeLocal` after all 170 tests pass (exit 134, known Node/Vitest cleanup-phase issue documented in prior `HANDOFF_LOG` entries; picking-contract test passes 17/17 in 6 ms before the crash). Contracts package build-order quirk: `pnpm --filter web build` requires `pnpm --filter @god-eyes/contracts build` first (pre-existing workspace quirk). PowerShell `node.exe :` cosmetic noise on Windows (informational, not an error).
- Next: Orchestrator Agent final implementation review: create `docs/state/INTEGRATION_REVIEW_W4.md` consolidating review of all 7 implementation packages (W4-B through W4-H on the same branch). On PASS, the user / decision-control layer may push and open one PR for the Wave 4 work package.

## 2026-06-20 - Wave 4 CesiumGlobe Planning Started

- Agent: Wave 4 CesiumGlobe Planning Agent
- Branch: `frontend/wave-4-cesium-globe-split`
- What changed: Created `specs/010-wave-4-cesium-globe-split/{README.md,tasks.md}`. Recorded the verified research facts from the prior `research/wave-4-cesium-globe-file-map` branch (review passed), the target-folder decision (`apps/web/src/CesiumGlobe/`), the 1-line compatibility-shim decision (mirroring Wave 3), the picking-contract test requirement (W4-B, before any picking-logic extraction, pinning the 8 field names: `_aircraftData`, `_vesselData`, `_weatherData`, `_newsData`, `_satelliteData`, `earthquakeData`, `satelliteData`, `rawData`), and the sequenced W4-A through W4-I implementation plan (all sequential, no parallel agents). Corrected the stale target path in `CURRENT_PROJECT_STATE.md` "Current mode" subsection: real path is `apps/web/src/CesiumGlobe.tsx` (1436 lines); the `apps/web/src/components/CesiumGlobe.tsx` reference in some historical/archived docs is **stale and incorrect**.
- Validation: docs-only validation — `git diff --check` clean (PASS); no merge conflict markers (PASS); `git diff --name-only` confirms only the 5 allowed files changed (PASS); no `pnpm` build/test re-runs needed (docs-only); pre-edit clean working tree confirmed (PASS); branch `frontend/wave-4-cesium-globe-split` based on `6006454 docs(state): close wave 3 route split cleanup` confirmed via `git log -8 --oneline` (PASS).
- Known issues: None. Wave 4 research review already established that the 1436-line file has 0 direct tests, 1 runtime consumer (`apps/web/src/App.tsx`), and the hidden picking contract is the highest-risk hidden coupling. W4-B (picking-contract test) must land before W4-F (picking handler extraction). No `apps/api/`, `services/`, `database/`, `packages/`, `docs/control/`, `docs/audits/`, `docs/archive/`, lockfile, or env file was touched.
- Next: Orchestrator Agent reviews this branch and creates `docs/state/INTEGRATION_REVIEW_W4-A.md`. On PASS, the user / decision-control layer may push and open a single PR for the W4-A planning work package. Then W4-B (picking-contract test) is the first implementation package.

## 2026-06-19 - Wave 3 State Sync / API Route Split Closeout

- Agent: Wave 3 State Sync Agent
- Branch: `docs/wave-3-state-sync`
- What changed: Recorded Wave 3 complete after aviation, earth-events, and borders route splits merged to `main` (SR-005D aviation aircraft split into `apps/api/src/routes/aviation/aircraft/` with shim at `apps/api/src/routes/aviation-aircraft.ts`; SR-005F earth events split into `apps/api/src/routes/earth-events/` with shim at `apps/api/src/routes/earth-events.ts`; SR-005E borders boundaries split into `apps/api/src/routes/borders-boundaries/` with shim at `apps/api/src/routes/borders-boundaries.ts`). Updated `CURRENT_PROJECT_STATE.md` with a new "Wave 3 outcomes (all complete)" subsection listing all three splits, the three preserved compatibility shims, the three canonical folders, and pointing the next wave at Wave 4 frontend CesiumGlobe split planning. Trimmed `RECENT_CONTEXT.md` rolling window to a clean 5 entries by removing the 3 individual SR-005D/F/E entries (now subsumed by this closeout entry; full per-PR detail remains in `HANDOFF_LOG.md`).
- Validation: docs-only validation — `git diff --check` clean (PASS); no merge conflict markers anywhere in the active tree (PASS); `git diff --name-only` confirms only the 3 `docs/state/` files changed (PASS); no `pnpm` build/test re-runs needed (docs-only sync); per-route validations already passed at PR time and are recorded in HANDOFF_LOG entries (581/581 API tests, contracts build, api build all PASS for each of SR-005D, SR-005F, SR-005E).
- Known issues: None. Wave 3 ran in parallel and the three individual agents each wrote their own RECENT_CONTEXT/HANDOFF_LOG entries at PR time; this closeout consolidates those into a single Wave 3 outcome section in `CURRENT_PROJECT_STATE.md` and trims the rolling context window so future agents see one clean Wave 3 entry rather than three near-duplicate per-PR entries.
- Next: Start Wave 4 — frontend CesiumGlobe split planning. `apps/web/src/components/CesiumGlobe.tsx` is the largest remaining frontend file flagged in the Spec 008 cleanup lane and is the recommended next target per `docs/control/PROJECT_CONTROL.md` and `specs/008-structure-remediation-roadmap/`.

## 2026-06-19 - Wave 2 DISC-1E Energy Placeholder Decision

- Agent: Energy Decision Record Agent
- Branch: `docs/wave-2-energy-decision-record`
- What changed: Recorded the DISC-1E product decision: **KEEP** `apps/web/src/layers/layer_10_energy_infrastructure/infrastructure/energyInfrastructureApi.ts`. The file is intentionally retained as a tested static-layer placeholder / future typed-client seed (zero production runtime callers, but covered by frontend tests as the static-data-layer contract placeholder). **No code changes required** — the barrel re-export in `apps/web/src/layers/layer_10_energy_infrastructure/index.ts` and the test file stay as-is. Wave 2 dead-code cleanup is now complete (Batch A+B deletions merged to `main` + DISC-1E decision recorded).
- Validation: pre-edit clean (PASS); `git diff --check` clean (PASS); no merge conflict markers (PASS); 3 `docs/state/` files updated only; `git diff --name-only` confirms zero hits for `apps/`, `services/`, `database/`, `packages/`, `tests/`, `specs/`, lockfile, or `.env*`. No `pnpm` build/test runs needed (docs-only state sync).
- Known issues: None. `energyInfrastructureApi.ts` is a documented tested placeholder, not dead-by-accident; the test file relies on its existence, so the decision to keep it is the correct outcome of DISC-1E.
- Next: Wave 2 closes. Next wave moves to the remaining Spec 008 cleanup lane / API route structure cleanup items per `docs/control/PROJECT_CONTROL.md` and `specs/008-structure-remediation-roadmap/`.
