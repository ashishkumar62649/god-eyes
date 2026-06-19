# Current Project State

Classification: CURRENT_STATE
Last updated: 2026-06-19 - Energy Decision Record Agent (Wave 2 DISC-1E)

## Phase: Wave 2 Complete

Wave 1 is fully merged into `main`. Wave 2 dead-code cleanup (Batch A+B DISC-1B/C/D/F
deletions, plus the DISC-1E product decision) is now complete. Repository state docs,
layer registries (API + frontend), CI/dependency files, environment examples, and route
documentation are aligned with the current working code. No layer business logic is
being redesigned in this phase.

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

### Current mode

- **Wave 1 complete** — all 5 items are merged to `main`.
- **Wave 2 complete** — Batch A+B dead-code removal merged; DISC-1E energy
  placeholder decision recorded as KEEP (no code change required).
- **Next wave** — continue the remaining Spec 008 cleanup lane / API route
  structure cleanup items per `docs/control/PROJECT_CONTROL.md` and
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

2026-06-19 - Energy Decision Record Agent (Wave 2 DISC-1E)

Change log for this file:

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
