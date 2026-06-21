# Current Project State

Classification: CURRENT_STATE
Last updated: 2026-06-20 - Wave 4 CesiumGlobe Working Agent (Wave 4 Implementation Complete)

## Phase: Wave 4 Implementation Complete (Final Review Pending)

Wave 1, Wave 2, Wave 3, and Wave 4 implementation are complete. Wave 4
implementation packages W4-B through W4-H all landed on the consolidated
branch `frontend/wave-4-cesium-globe-split` as sequential commits per the
W4-A → W4-H task brief's important branch rule. W4-I (this update)
consolidates the state docs. The Orchestrator Agent's final implementation
review is the next step before the user / decision-control layer may push
and open a single PR for the Wave 4 work package.

### Current main includes (Wave 1, all merged)

- **WO-3-1** — Centralize API type/date helper functions (`apps/api/src/lib/typeUtils.ts`)
- **DISC-1** — Dead/duplicate code investigation (audit only, no deletions yet)
- **CLEANUP-1** — Tiny environment/config/security hygiene cleanup (2 new `.env.example` files, removed duplicate `test:api` root script)
- **WO-3-2** — Centralize API request-validation helpers (`apps/api/src/lib/requestValidation.ts`)
- **WO-7-2** — Frontend layer test coverage (5 new test files, 153/153 web tests; the `aviationTileCache` tests were removed in the revision after DISC-1 confirmed the module as dead code)

### Wave 2 outcomes (all complete)

- **Wave 2 Batch A+B** — DISC-1B/C/D/F dead-code removals (merged to `main`):
  5 dead aviation files deleted (`aviationTileCache.ts`, `aviationTileLoader.ts`,
  `globeCamera.ts`, `airportViewport.ts`, `aviationLayerRenderer.ts`); 3 dead exports
  trimmed from `aircraftMarker.ts`. 153/153 web tests, 581/581 API tests, all 3
  builds PASS.
- **DISC-1E** — Energy placeholder product decision: **KEEP**
  `apps/web/src/layers/layer_10_energy_infrastructure/infrastructure/energyInfrastructureApi.ts`.
  It is intentionally retained as a tested static-layer placeholder / future
  typed-client seed. It has zero production runtime callers, but is covered by
  frontend tests (`energyInfrastructure.test.ts`, 11 tests) as the static-data-layer
  contract placeholder. **No source-code deletion is required.** The barrel
  re-export in `apps/web/src/layers/layer_10_energy_infrastructure/index.ts` and the
  test file stay as-is.

### Wave 3 outcomes (all complete)

Wave 3 was the API route split cleanup wave, run in parallel across three
discrete work packages. Each old single-file API route was split into the
standard folder route structure (`index.ts` / `service.ts` / `repository.ts` /
`mapper.ts` / `validation.ts` / `types.ts`), and the old top-level file was
preserved as a 1-line compatibility shim that re-exports from the new folder.

- **SR-005D — Aviation aircraft route split** (merged to `main`).
  Old file `apps/api/src/routes/aviation-aircraft.ts` (361 lines) replaced with
  a 1-line shim. Canonical implementation now lives in
  `apps/api/src/routes/aviation/aircraft/` (6 files). All four public paths
  preserved: `GET /api/aviation/aircraft/latest`,
  `GET /api/aviation/aircraft/:sourceObjectId`,
  `GET /api/layers/aviation/aircraft/latest`,
  `GET /api/layers/aviation/aircraft/:sourceObjectId`.
- **SR-005F — Earth events route split** (merged to `main`).
  Old file `apps/api/src/routes/earth-events.ts` replaced with a 1-line shim.
  Canonical implementation now lives in `apps/api/src/routes/earth-events/`
  (6 files). Public paths preserved: `GET /api/earth-events/latest` and
  `GET /api/layers/earth-events/latest`.
- **SR-005E — Borders boundaries route split** (merged to `main`).
  Old file `apps/api/src/routes/borders-boundaries.ts` replaced with a 1-line
  shim. Canonical implementation now lives in
  `apps/api/src/routes/borders-boundaries/` (6 files). Public paths preserved:
  `GET /api/borders-boundaries/countries` and
  `GET /api/layers/borders-boundaries/countries`.

#### Wave 3 compatibility shims (preserved on `main`)

- `apps/api/src/routes/aviation-aircraft.ts` — 1-line shim:
  `export { aviationAircraftRoutes } from './aviation/aircraft/index.js';`
- `apps/api/src/routes/earth-events.ts` — 1-line shim:
  `export { earthEventsRoutes } from './earth-events/index.js';`
- `apps/api/src/routes/borders-boundaries.ts` — 1-line shim:
  `export { bordersBoundariesRoutes } from './borders-boundaries/index.js';`

#### Wave 3 canonical implementations (new folders on `main`)

- `apps/api/src/routes/aviation/aircraft/` — index, service, repository, mapper, validation, types
- `apps/api/src/routes/earth-events/` — index, service, repository, mapper, validation, types
- `apps/api/src/routes/borders-boundaries/` — index, service, repository, mapper, validation, types

All three splits passed `pnpm --filter @god-eyes/contracts build`,
`pnpm --filter api build`, and `pnpm --filter api test` (581/581 PASS).
Each route's existing test file passes unchanged because the shims preserve
the import paths used by `apps/api/src/index.ts` and by the existing test
files. No `request: any` / `reply: any` types were introduced. No shared
lib, web, services, packages, or spec files were touched.

### Wave 4 outcomes (all complete)

Wave 4 split the legacy `apps/web/src/CesiumGlobe.tsx` (1436 lines, 57 144 bytes)
into a 10-file module folder behind a 1-line compatibility shim. All eight
implementation packages (W4-B through W4-H) landed on a single consolidated
branch `frontend/wave-4-cesium-globe-split` as sequential commits, per the
task brief's important branch rule. W4-I consolidated the state docs.

#### Wave 4 commit stack (most recent first)

```
a01f878 refactor(web): extract cesium globe viewer lifecycle                   (W4-H)
dd93421 refactor(web): extract cesium globe live aircraft renderer            (W4-G)
ab4172f refactor(web): extract cesium globe picking handler                    (W4-F)
b674842 refactor(web): extract cesium globe resident aviation cache             (W4-E)
617c5e9 refactor(web): extract cesium globe camera bbox reporter              (W4-D)
1836be1 refactor(web): introduce cesium globe module shell                     (W4-C)
d895dfc test(web): add cesium globe picking contract                          (W4-B)
f631de0 docs(state): trim recent context trailing blank line                  (state hygiene)
6819803 docs(state): repair recent context formatting                        (state hygiene)
a66611b docs(spec): plan wave 4 cesium globe split                            (W4-A)
6006454 docs(state): close wave 3 route split cleanup                         (base on main)
```

#### Wave 4 module shape

`apps/web/src/CesiumGlobe/` (10 files + `__tests__/`):

```
index.tsx                       # orchestrator (the CesiumGlobe React.FC)
pickingFields.ts                # W4-B; 8-field picking contract constants + factory helpers
picking.ts                      # W4-F; createPickClickHandler factory
useCameraBboxReporter.ts        # W4-D; maritime camera.moveEnd + bbox validation
useResidentAviationCache.ts     # W4-E; layer ON/OFF + preload + filter change
useLiveAircraftRenderer.ts      # W4-G; snapshot apply + delta + DR loop
useCesiumViewer.ts              # W4-H; viewer init + scene + primitives + picking + cleanup
types.ts                        # W4-C; AviationStats, CesiumGlobeProps, AircraftRecord
constants.ts                    # W4-C; AIRCRAFT_ICON_VIEW_HEIGHT_METERS
helpers.ts                      # W4-C; airportFlyHeight
__tests__/pickingContract.test.ts  # W4-B; 17 picking-contract assertions
```

`apps/web/src/CesiumGlobe.tsx` (1-line shim, unchanged since W4-C):
`export { default } from './CesiumGlobe/index';`

`apps/web/src/App.tsx` (consumer, unchanged since W3): `import CesiumGlobe from './CesiumGlobe';`

#### Wave 4 path correction (locked in W4-A)

| | Path | Status |
|---|---|---|
| Original target | `apps/web/src/CesiumGlobe.tsx` | **the real file** |
| Stale (incorrect) | `apps/web/src/components/CesiumGlobe.tsx` | **does not exist** |
| Final public shim | `apps/web/src/CesiumGlobe.tsx` | unchanged import path; 1-line re-export |

#### Wave 4 hidden picking contract (locked in W4-B)

`apps/web/src/CesiumGlobe/__tests__/pickingContract.test.ts` pins 17 assertions
across 8 field names:

| Field | Producer (writes) | Consumer (reads in CesiumGlobe click handler) |
|---|---|---|
| `_aircraftData` | CesiumGlobe billboard `id` (lines 957, 1106, 949, 1098) | CesiumGlobe click (lines 573, 574) |
| `_vesselData` | `MaritimeLayer.tsx` lines 90, 94 | CesiumGlobe click (lines 579, 580) |
| `_weatherData` | `WeatherLayer.tsx` lines 79, 82 | CesiumGlobe click (lines 585, 586) |
| `_newsData` | `NewsLayer.tsx` lines 70, 73 | CesiumGlobe click (lines 591, 592) |
| `_satelliteData` | CesiumGlobe `point.id` (line 1285) | (reserved; future picking) |
| `earthquakeData` | CesiumGlobe `entity.properties` (line 860) | CesiumGlobe click (lines 613, 614) |
| `satelliteData` | CesiumGlobe `entity.properties` (line 1300) | CesiumGlobe click (lines 619, 620) |
| `rawData` | `EnergyInfrastructureLayer.tsx` line 53 | CesiumGlobe click (lines 627, 634, 635) |

Production code reads every field through `PICKING_FIELDS.*` constants from
`pickingFields.ts`. Zero magic-string picking literals in production.

#### Wave 4 validation (final)

- `pnpm --filter @god-eyes/contracts build` → PASS
- `pnpm --filter web build` → PASS (120 modules, 306.84 kB JS / 87.24 kB gzip)
- `pnpm --filter web test` → PASS (170/170 across 9 test files)
- `pnpm --filter web test -- pickingContract.test.ts` → PASS (17/17)
- `git diff --check` → clean
- `git grep` conflict markers → 0 hits
- No production layer files (`apps/web/src/layers/**`, `apps/web/src/globe/**`,
  `apps/web/src/components/**`) modified at any point during Wave 4.

#### Wave 4 known caveats (carried forward unchanged)

- **Pre-existing V8/Vitest post-green cleanup crash** (exit 134). The
  picking-contract test passes 17/17 in 6 ms before the crash. Documented
  in prior `HANDOFF_LOG` entries; not a Wave 4 regression.
- **Contracts package build-order quirk.** `pnpm --filter web build` initially
  fails with `TS2307: Cannot find module '@god-eyes/contracts'` until
  `pnpm --filter @god-eyes/contracts build` runs first. Pre-existing
  workspace build-order quirk.
- **PowerShell `node.exe :` cosmetic noise** on Windows (informational,
  not an error). The actual `tsc && vite build` and `vitest run` exit
  codes are 0.

### Current mode

- **Wave 1 complete** — all 5 items are merged to `main`.
- **Wave 2 complete** — Batch A+B dead-code removal merged; DISC-1E energy
  placeholder decision recorded as KEEP (no code change required).
- **Wave 3 complete** — three API route splits (aviation aircraft, earth events,
  borders boundaries) merged to `main` with compatibility shims preserved
  and all public API paths intact.
- **Wave 4 complete — CesiumGlobe split.** All eight implementation
  packages (W4-B through W4-H) landed on the consolidated branch
  `frontend/wave-4-cesium-globe-split` as sequential commits per the
  task brief's important branch rule. The original 1436-line
  `apps/web/src/CesiumGlobe.tsx` is now a 1-line compatibility shim
  pointing at `apps/web/src/CesiumGlobe/index.tsx`. See the
  **Wave 4 outcomes (all complete)** section above for the full
  commit stack, module structure, picking contract, and validation
  snapshot. The next step is the Orchestrator Agent's final
  implementation review (`docs/state/INTEGRATION_REVIEW_W4.md`);
  on PASS, the user / decision-control layer may push and open one PR.

## Authoritative Sources

- `docs/control/PROJECT_CONTROL.md` is the authoritative layer registry
  (IDs, order, status, ownership, and source contract expectations).
- The API registry (`apps/api/src/routes/layers.ts`) and the frontend fallback registry
  (`apps/web/src/lib/useLayerRegistry.ts`) must remain aligned to that registry.

## Implemented Layers (status: active)

| Layer ID | Name | Notes |
|----------|------|-------|
| `layer_00_globe_core` | Globe Core | Frontend-only foundation; always on. |
| `layer_01_aviation` | Aviation | Airports + live aircraft; default ON. |
| `layer_02_borders_boundaries` | Borders & Boundaries | local-dev (Natural Earth); default ON; **not production-approved**. |
| `layer_03_earth_events` | Earth Events | USGS earthquakes; default ON. |
| `layer_05_space_satellites` | Space & Satellites | Implemented; UI toggle default OFF. |
| `layer_06_maritime` | Maritime | Implemented; UI toggle default OFF. |
| `layer_07_weather` | Weather / Live Weather | Open-Meteo; implemented; UI toggle default OFF. |
| `layer_08_news_osint` | News & OSINT | GDACS + GDELT; implemented; UI toggle default OFF. |
| `layer_10_energy_infrastructure` | Energy Infrastructure | WRI/OSM/GEM; implemented; default ON. |

## Coming Soon Layers (status: coming_soon)

| Layer ID | Name |
|----------|------|
| `layer_04_public_military_security` | Public Military & Security |
| `layer_09_user_shapes` | User Shapes |

## Current Capabilities by Layer

- **Layer 0 — Globe Core:** Cesium 3D globe with camera controls and layer toggle system.
- **Layer 1 — Aviation:** ~85k airports with resident global cache, category filters, intel
  detail panel, public profile/intelligence/image/layout enrichment, and live aircraft
  rendering over WebSocket when the aviation worker is running.
- **Layer 2 — Borders & Boundaries:** Natural Earth Admin-0 outlines (local-dev only).
  Not Survey of India compliant; not production-approved.
- **Layer 3 — Earth Events:** USGS earthquake markers, color-coded by severity.
- **Layer 5 — Space & Satellites:** Satellite catalog/orbit endpoints + WebSocket; renders
  when the satellite worker has populated data. UI toggle default OFF.
- **Layer 6 — Maritime:** Vessel object/stats endpoints; renders when the maritime worker
  has populated data. UI toggle default OFF.
- **Layer 7 — Weather:** Open-Meteo observation/forecast endpoints and weather markers/detail
  card. UI toggle default OFF.
- **Layer 8 — News & OSINT:** GDACS/GDELT event endpoints, globe markers + list. UI toggle
  default OFF.
- **Layer 10 — Energy Infrastructure:** Power plants/substations/lines/pipelines endpoints
  and markers. Default ON.

## Live Workers

Fetcher/normalizer/ingestion workers exist for the live layers under
`services/fetch-orchestrator/src/layers/<layer_id>/` and
`database/ingestion/layers/<layer_id>/`. They are currently run manually (proof/seed/CLI
modes). A unified runner/scheduler cleanup is deferred to a later work order. Live layers
display an empty state until their worker has populated the database. No fake/demo data is
ever displayed.

## API Surface (implemented)

- `GET /api/health`
- `GET /api/layers`, `GET /api/layers/registry`, `GET /api/layers/:layerId`, `GET /api/layers/:layerId/status`
- `GET /api/layers/layer_01_aviation/objects` (+ `/:objectId`, `/:objectId/detail`)
- `GET /api/aviation/aircraft/latest`, `GET /api/aviation/aircraft/:sourceObjectId`
- `GET /api/airports/:airportId/{intelligence,layout-features,public-profile}`
- `GET /api/borders-boundaries/countries`
- `GET /api/earth-events/latest`
- `GET /api/space/satellites` (+ `/categories`, `/:satelliteId`)
- `GET /api/energy/infrastructure` (+ `/categories`, `/sources`, `/:featureId`)
- `GET /api/layers/layer_06_maritime/objects` (+ `/:objectId`, `/stats`, `/vessels/:mmsi/positions`)
- `GET /api/layers/layer_07_weather/weather/{latest,current,hourly,nearby,sources,fetch-runs}`
- `GET /api/layers/layer_08_news_osint/news/{items,markers,sources,fetch-runs,stats}`
- WebSockets: `/ws/aviation/aircraft/live`, `/ws/space/satellites/live`

## What Does Not Exist Yet

- Layer 4 Public Military & Security (planned, coming_soon)
- Layer 9 User Shapes / Custom Overlays (planned, coming_soon)
- User authentication
- Data export/sharing
- Unified live-worker runner/scheduler (workers exist but are run manually)

## Currently-Present Package Folders

The actually-present package folders in the repository are:

| Folder | Owner | Status |
|--------|-------|--------|
| `packages/contracts/` | API Agent (writes); Frontend Agent and data agents read | active |
| `packages/schemas/` | Database Agent | active |
| `packages/source-catalog/` | Fetcher Agent | active |

`packages/ui/`, `packages/layers/`, and `packages/auth/` are referenced historically
in `AGENTS.md`, `.specify/memory/constitution.md`, and `docs/control/PROJECT_CONTROL.md`
as planned/future locations. They are **not currently present** in the repository.
Agents must not search for, edit, or import from these paths until a future work order
explicitly creates them. (WO-001, 2026-06-17.)

## Specs

- `specs/008-structure-remediation-roadmap/` — active remediation roadmap
  (Phases 0–4 done; Phases 5–8 Planned Later; see `tasks.md`).
- `specs/009-future-scaling-architecture/` — placeholder only (created by WO-001).
  No implementation authorized. Spec 008 remains the active roadmap.

## Workflow

Build → Review/Test → Push → Next. See `AGENTS.md` and `docs/control/PROJECT_CONTROL.md`.

## Last Updated

2026-06-20 - Wave 4 CesiumGlobe Working Agent (Wave 4 Implementation Complete)

Change log for this file:

- 2026-06-20 (Wave 4 Implementation Complete) - Wave 4 CesiumGlobe split
  moved from **planning** to **implementation complete**. All eight
  implementation packages (W4-B through W4-H) landed on the consolidated
  branch `frontend/wave-4-cesium-globe-split` as sequential commits per
  the task brief's important branch rule. The original 1436-line
  `apps/web/src/CesiumGlobe.tsx` is now a 1-line compatibility shim
  pointing at `apps/web/src/CesiumGlobe/index.tsx`. Final module
  structure: 10 files in `apps/web/src/CesiumGlobe/` plus the picking-
  contract test in `apps/web/src/CesiumGlobe/__tests__/`. Picking contract
  pinned by 17 assertions; production code reads every picking field
  through `PICKING_FIELDS.*` (zero magic-string literals). Validation:
  `pnpm --filter web build` PASS (120 modules, 306.84 kB JS / 87.24 kB
  gzip); `pnpm --filter web test` PASS (170/170 across 9 test files);
  `pnpm --filter web test -- pickingContract.test.ts` PASS (17/17);
  `git diff --check` clean; `git grep` conflict markers 0 hits. No
  production layer files modified. `apps/web/src/CesiumGlobe.tsx` shim
  and `apps/web/src/App.tsx` import unchanged. Pre-existing V8/Vitest
  post-green cleanup crash and contracts build-order quirk carried
  forward as documented caveats (not Wave 4 regressions). Added the
  full Wave 4 outcomes section (commit stack, module shape, path
  correction, picking contract table, validation snapshot, caveats)
  above the Current mode subsection. Updated the Current mode bullet
  from "Wave 4 planning in progress" to "Wave 4 complete" and pointed
  to the Wave 4 outcomes section. Prepended W4-I closeout entry to
  `HANDOFF_LOG.md` and a Wave 4 implementation complete top entry to
  `RECENT_CONTEXT.md` (rolling window stays at 5 entries). No
  production source, test, package, lockfile, env, or non-doc file
  touched by this closeout.
- 2026-06-20 (Wave 4 Planning Started) - Wave 4 CesiumGlobe split moved
  from "Planned later" to **planning**. Created
  `specs/010-wave-4-cesium-globe-split/{README.md,tasks.md}` recording the
  verified research facts, the target-folder decision
  (`apps/web/src/CesiumGlobe/`), the 1-line compatibility-shim decision,
  the picking-contract test requirement (W4-B, before any picking-logic
  extraction), and the sequenced implementation plan (W4-A through W4-I,
  all sequential, no parallel agents). Corrected the **stale target
  path** in this file's "Current mode" subsection: the real target is
  `apps/web/src/CesiumGlobe.tsx` (1436 lines, 57 144 bytes); the path
  `apps/web/src/components/CesiumGlobe.tsx` referenced in some
  historical and archived docs is **stale and incorrect**. The single
  runtime importer (`apps/web/src/App.tsx`, default import) keeps the
  same import path through the shim. Prepended the W4-A planning
  entry to `HANDOFF_LOG.md` and a 5-bullet top entry to
  `RECENT_CONTEXT.md`. No production code, test, package, spec, or
  non-doc file was changed. Forbidden folders confirmed untouched via
  `git diff --name-only` (zero hits for `apps/`, `services/`,
  `database/`, `packages/`, `tests/`, lockfiles, env files).
- 2026-06-19 (Wave 3 Route Split Closeout) - Recorded Wave 3 complete after the
  three API route splits (SR-005D aviation aircraft, SR-005F earth events,
  SR-005E borders boundaries) merged to `main`. Added a new "Wave 3 outcomes
  (all complete)" subsection recording all three splits, the three preserved
  compatibility shims (`apps/api/src/routes/aviation-aircraft.ts`,
  `apps/api/src/routes/earth-events.ts`,
  `apps/api/src/routes/borders-boundaries.ts`), and the three canonical
  implementation folders (`apps/api/src/routes/aviation/aircraft/`,
  `apps/api/src/routes/earth-events/`,
  `apps/api/src/routes/borders-boundaries/`). Updated the "Phase" header to
  "Wave 3 Complete" and the "Current mode" subsection to mark Wave 1 + Wave 2
  + Wave 3 all complete, with the next wave pointing at Wave 4 — frontend
  CesiumGlobe split planning / implementation. No layer business logic was
  changed. No code was changed.
- 2026-06-19 (Wave 2 DISC-1E energy placeholder decision) - Recorded DISC-1E decision
  **KEEP** for
  `apps/web/src/layers/layer_10_energy_infrastructure/infrastructure/energyInfrastructureApi.ts`.
  The file is intentionally retained as a tested static-layer placeholder / future
  typed-client seed (covered by `energyInfrastructure.test.ts`, 11 tests). No
  source-code deletion is required. Wave 2 Batch A+B dead-code removal was already
  merged to `main` prior to this update. The "Wave 2 Next Recommended Work" section
  was removed because Wave 2 is now complete; the file's "Current mode" subsection
  was updated to record "Wave 2 complete" and point the next wave at the remaining
  Spec 008 cleanup lane / API route structure cleanup items. The "Phase" header was
  updated to "Wave 2 Complete". No layer business logic was changed. No code was
  changed.
- 2026-06-19 (post-Parallel Wave 1 state sync) - Recorded that Wave 1 is fully merged
  into `main` (WO-3-1, DISC-1, CLEANUP-1, WO-3-2, WO-7-2). Updated phase to "Wave 1
  Complete — Wave 2 Ready to Start". Added a "Wave 2 Next Recommended Work" section
  pointing at the DISC-1 follow-up deletions, the `energyInfrastructureApi.ts`
  placeholder product decision, and the remaining API route structure cleanup
  lane. No layer business logic was changed. No code was changed.
- 2026-06-17 (WO-001 ownership docs alignment) - Marked `packages/ui/`,
  `packages/layers/`, and `packages/auth/` as planned/future in `AGENTS.md`,
  `.specify/memory/constitution.md`, and `docs/control/PROJECT_CONTROL.md`.
  Created `specs/009-future-scaling-architecture/README.md` as a placeholder.
  Added a "Currently-Present Package Folders" section and a "Specs" section
  to this file. No layer business logic was changed. No code was changed.
- 2026-06-16 (single control file consolidation) - `docs/control/PROJECT_CONTROL.md`
  is now the only active project control file. Retired pointer stubs were
  removed from `docs/control/`. This state file's Authoritative Sources section
  was updated to point at `PROJECT_CONTROL.md`.
- 2026-06-16 (post-Phase 6 documentation cleanup) - `AGENTS.md` was de-duplicated
  to a pure entry-point pointer (no duplicated layer table, ownership matrix, or
  hard-rules body). `docs/archive/_DO_NOT_READ.md` now lists the correct active
  control file. The two 2026-06-16 audit reports in `docs/audits/` carry
  "Superseded" / "Post-Phase 6" addenda. Spec 008 README carries a Phase 6
  status banner. State docs carry Classification lines. No layer business
  logic was changed.
