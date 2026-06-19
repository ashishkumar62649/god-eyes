# Current Project State

Classification: CURRENT_STATE
Last updated: 2026-06-19 - Wave 3 State Sync Agent (Wave 3 Route Split Closeout)

## Phase: Wave 3 Complete

Wave 1 and Wave 2 are fully merged into `main`. Wave 3 API route split cleanup
is now complete. Three large single-file API routes (aviation aircraft, earth
events, borders boundaries) have been split into the standard folder route
structure, with the old top-level files preserved as 1-line compatibility
shims. All public API paths, route registration, and existing tests continue
to work unchanged. Repository state docs, layer registries (API + frontend),
CI/dependency files, environment examples, and route documentation remain
aligned with the current working code. No layer business logic is being
redesigned in this phase.

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

### Current mode

- **Wave 1 complete** — all 5 items are merged to `main`.
- **Wave 2 complete** — Batch A+B dead-code removal merged; DISC-1E energy
  placeholder decision recorded as KEEP (no code change required).
- **Wave 3 complete** — three API route splits (aviation aircraft, earth events,
  borders boundaries) merged to `main` with compatibility shims preserved
  and all public API paths intact.
- **Next wave** — Wave 4: frontend CesiumGlobe split planning / implementation.
  The current `apps/web/src/components/CesiumGlobe.tsx` is the largest remaining
  frontend file flagged in the Spec 008 cleanup lane and is the recommended
  next target per `docs/control/PROJECT_CONTROL.md` and
  `specs/008-structure-remediation-roadmap/`.

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
| `layer_02_borders_boundaries` | Borders & Boundaries | MVP/local-dev (Natural Earth); default ON; **not production-approved**. |
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
- **Layer 2 — Borders & Boundaries:** Natural Earth Admin-0 outlines (MVP/local-dev only).
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

2026-06-19 - Wave 3 State Sync Agent (Wave 3 Route Split Closeout)

Change log for this file:

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
