# Current Project State

Classification: CURRENT_STATE
Last updated: 2026-06-16 - Orchestrator Agent (post-Phase 6 documentation cleanup)

## Phase: Repository Alignment In Progress

Documentation, layer registries (API + frontend), CI/dependency files, environment
examples, and route documentation are being aligned with the current working code on
the main branch. No layer business logic is being redesigned in this phase.

## Authoritative Sources

- `docs/control/MVP_LAYER_REGISTRY.md` is the authoritative layer registry (IDs, order, status).
- The API registry (`apps/api/src/routes/layers.ts`) and the frontend fallback registry
  (`apps/web/src/lib/useLayerRegistry.ts`) are aligned to that registry.

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

## Workflow

Build → Review/Test → Push → Next. See `AGENTS.md` and `docs/control/GIT_WORKFLOW_POLICY.md`.

## Last Updated

<<<<<<< Updated upstream
2026-06-14 — Orchestrator Agent (repository alignment pass)
=======
2026-06-16 - Orchestrator Agent (post-Phase 6 documentation cleanup)

Change log for this file:

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
>>>>>>> Stashed changes
