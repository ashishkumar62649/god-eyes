# Current Project State

## Phase: Layer 05 Space & Satellites MVP Planning

## Goal

Define the authoritative lane contract for Layer 05 Space & Satellites so database, fetching, API, frontend, and review agents can work in parallel without drifting.

## Status

**WO-082A Lane Contract Complete:** GOD EYES frontend cleanup (WO-081) is complete. Main branch is clean. Multi-lane workflow is active again. Layer 05 Space & Satellites MVP lane contract defined in `docs/control/layer_05_space_satellites_mvp_contract.md`. Five parallel lanes ready to start:
- Database (Codex, WO-082B)
- Fetching (MiniMax, WO-082C)
- API (DeepSeek, WO-082D)
- Frontend (Sonnet 4.6, WO-082E)
- Review (Claude Haiku 4.5, WO-082F)

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
- ✅ WO-081A: Repository guardrails and layer registry cleanup
- ✅ WO-081B: Frontend overlay extraction and layer folder skeleton
- ✅ WO-081C: FPS counter hook extraction
- ✅ WO-081D: Cesium token setup helper extraction
- ✅ WO-081E: Globe viewer helper cleanup bundle
- ✅ WO-081F: Frontend layer organization + aircraft visual hotfix
- ✅ WO-081G: Legacy aircraft frontend cleanup
- ✅ WO-082A: Layer 05 Space & Satellites MVP lane contract

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

1. **WO-082B Database Lane:** Codex creates schema, migrations, tests
2. **WO-082C Fetching Lane:** MiniMax implements fetcher, normalizer, tests
3. **WO-082D API Lane:** DeepSeek implements endpoints, WebSocket, tests
4. **WO-082E Frontend Lane:** Sonnet 4.6 implements UI, WebSocket client, tests
5. **WO-082F Review Lane:** Claude Haiku 4.5 reviews all lanes, verifies integration
6. **Boss review:** Final integration and merge to main

## Last Updated

2026-05-31 — Kiro CLI (WO-082A-SPACE-LAYER-CONTRACT)
