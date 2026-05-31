# Current Project State

## Phase: MVP Guardrails / Cleanup

## Goal

Keep the repository safe for incremental layer work by enforcing the authoritative layer registry, broadening validation, and cleaning guardrails before any new layer starts.

## Status

**WO-081A Guardrails In Progress:** GOD EYES now uses the one-folder workflow at `E:\god-eyes`. The CI scope guard fix has been merged. Aviation MVP live aircraft rendering works through the API/WebSocket path when the live aircraft worker is publishing snapshots. Airport public profile enrichment works when its worker is running. Borders & Boundaries and Earth Events are implemented enough for the MVP/local-dev surface documented in the control docs. The next work is cleanup/refactor guardrails before any new layer work.

### Completed Work Orders
- ✅ WO-001 through WO-029F: Foundation, data pipeline, API, frontend infrastructure
- ✅ WO-030A: Aviation API Preload/Resident Cache Mode
- ✅ WO-031-FE: Aviation Simple Global Category Renderer
- ✅ HOTFIX-2: Frontend Fetch/Render/Status Fixes
- ✅ WO-060: Repository Health Audit (score: 74/100)
- ✅ WO-061: Repository Safe Cleanup (Phase 1)
- ✅ WO-063: MVP Layer Registry (10-layer authoritative registry)
- ✅ WO-071: Earth Events database migration
- ✅ WO-072: Earth Events USGS fetcher
- ✅ WO-073 / WO-073A: Earth Events API + timestamp fix
- ✅ WO-074 / WO-074A: Earth Events frontend globe layer + occlusion fix
- ✅ WO-075-076: Earth Events closeout + Borders & Boundaries policy plan
- ✅ WO-076A: Borders & Boundaries implementation gate review
- ✅ WO-077: Borders & Boundaries database schema foundation (schema-only, no data)
- ✅ WO-078A: Borders source license clearance kit created
- ✅ WO-078A1: Borders MVP boundary mode decision recorded
- ✅ WO-078B: Natural Earth Admin-0 Countries 1:50m selected for MVP/local/dev
- ✅ WO-078C through WO-078E10: Natural Earth ingestion, Borders frontend, MVP closeout
- ✅ WO-079A: Aviation live-data source, database, and API architecture planned
- ✅ WO-079B through WO-080C7: Aviation live aircraft schema, worker, WebSocket/API integration, Cesium render fixes, aircraft icons, and altitude color scale
- ✅ CI scope guard fix merged

### Current Capabilities
- ✅ Layer 0 Globe Core: Cesium globe with camera controls
- ✅ Layer 1 Aviation: 85,377 airports globally plus MVP live aircraft rendering
  - 8 category support (international, regional, local, heliport, seaplane, balloonport, closed, unknown)
  - Resident global cache mode (no tile/bbox/zoom loading)
  - Category filtering with instant updates
  - Object Intel detail view
  - StatusPanel with preload progress, loaded/visible counts
  - No FPS loss at 85k+ airports
  - Live aircraft render through WebSocket when the live aircraft worker is running and publishing snapshots
  - Airport intelligence panel (ICAO, IATA, elevation, timezone, region)
  - Airport public profile enrichment works when the worker is running
  - Airport image gallery
  - Airport layout runway overlay (OSM-sourced)
  - Closed runways hidden by default via `is_active = false`
- ✅ Layer 2 Borders & Boundaries: Natural Earth MVP/local/dev frontend complete (pushed e6639e9)
  - Red polyline outlines on globe
  - Toggle in LayerPanel
  - MVP caveat displayed
  - Not production-approved; not Survey of India compliant
- ✅ Layer 3 Earth Events: USGS earthquake feed end-to-end
  - Database tables: earth_events_latest + earth_events_history
  - USGS fetcher (magnitude, location, time, coordinates)
  - API endpoint: `GET /api/earth-events/latest`
  - Frontend Cesium markers, color-coded by severity
  - Globe depth/occlusion correct (markers behind globe hidden)

## What Exists

- [x] AGENTS.md (layer-based)
- [x] docs/control/ (all control documents)
- [x] docs/state/ (all state documents including integration reviews)
- [x] docs/work-orders/ (all completed work orders)
- [x] specs/001-layer-zero-globe-core/spec.md
- [x] specs/002-layer-one-aviation/spec.md
- [x] apps/api/ (Fastify API with preload, intelligence, layout endpoints)
- [x] apps/web/ (React + Cesium frontend with resident renderer)
- [x] packages/contracts/ (TypeScript type contracts)
- [x] database/ (PostgreSQL schema with 85k+ airports)
- [x] services/fetch-orchestrator/ (OurAirports data fetcher)
- [x] services/normalizer/ (Aviation data normalizer)
- [x] tests/data/ (Data pipeline tests)

## What Does Not Exist Yet

- [ ] Layer 4 Public Military & Security
- [ ] Layer 5 Space & Satellites
- [ ] Layer 6 Maritime
- [ ] Layer 7 Infrastructure
- [ ] Layer 8 News & OSINT
- [ ] Layer 9 User Shapes / Drawings / Custom Overlays
- [ ] User authentication
- [ ] Data export/sharing
- [ ] Generic layer API endpoints
- [ ] Earth Events: bbox support, clustering, refresh controls, timeline replay (deferred)

## Next Safe Steps

1. **WO-081A Repository Guardrails:** Align layer numbering, current-state docs, and CI data-test scope.
2. **No new layer until registry consistency is confirmed:** Space must be `layer_05_space_satellites` unless `docs/control/MVP_LAYER_REGISTRY.md` is intentionally changed later.
3. **Refactor cleanup after guardrails:** Split large frontend/fetcher/API files in small behavior-preserving PRs with full validation.

## Last Updated

2026-05-31 — Codex (WO-081A-REPO-GUARDRAILS-LAYER-REGISTRY)
