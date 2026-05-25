# Current Project State

## Phase: 0 — Layered Foundation

## Goal

Prepare the repository so GOD EYES can be built layer by layer, starting with Layer 0 Globe Core and Layer 1 Aviation.

## Status

**MVP Phase 2 In Progress:** Layer 3 Earth Events complete. Layer 2 Borders & Boundaries schema foundation added; source ingestion remains blocked.

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

### Current Capabilities
- ✅ Layer 0 Globe Core: Cesium globe with camera controls
- ✅ Layer 1 Aviation: 85,377 airports globally
  - 8 category support (international, regional, local, heliport, seaplane, balloonport, closed, unknown)
  - Resident global cache mode (no tile/bbox/zoom loading)
  - Category filtering with instant updates
  - Object Intel detail view
  - StatusPanel with preload progress, loaded/visible counts
  - No FPS loss at 85k+ airports
  - Airport intelligence panel (ICAO, IATA, elevation, timezone, region)
  - Airport image gallery
  - Airport layout runway overlay (OSM-sourced)
  - Closed runways hidden by default via `is_active = false`
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

- [ ] Layer 2 Borders & Boundaries (schema foundation added; source ingestion blocked)
- [ ] Layer 4 Public Military & Security
- [ ] Layer 5 Space & Satellites
- [ ] Layer 6 Maritime
- [ ] Layer 7 Infrastructure
- [ ] Layer 8 News & OSINT
- [ ] Layer 9 User Shapes
- [ ] Real-time data updates (beyond aviation cache and Earth Events)
- [ ] Live aircraft tracking (real-time position streaming)
- [ ] User authentication
- [ ] Data export/sharing
- [ ] Generic layer API endpoints
- [ ] Earth Events: bbox support, clustering, refresh controls, timeline replay (deferred)

## Next Safe Steps

1. **WO-078C Natural Earth MVP Ingestion:** Download Natural Earth 1:50m Admin-0
   Countries, insert into `border_boundary_sources` and `border_boundaries`, mark as
   `mvp_local_dev` only. No API or frontend in WO-078C.
2. **[PRODUCTION STAGE — DEFERRED] Survey of India contact:** Required before any
   India boundary data is served in a deployed/production environment.
3. **Borders API/frontend:** Not started. Requires separate work orders after ingestion.

## Last Updated

2026-05-26 — Kiro CLI (WO-078B-BORDERS-NATURAL-EARTH-MVP-SOURCE-SELECTION)
