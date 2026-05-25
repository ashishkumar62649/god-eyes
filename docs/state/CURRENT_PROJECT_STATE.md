# Current Project State

## Phase: 0 — Layered Foundation

## Goal

Prepare the repository so GOD EYES can be built layer by layer, starting with Layer 0 Globe Core and Layer 1 Aviation.

## Status

**MVP Phase 2 In Progress:** Layer 3 Earth Events complete. Layer 2 Borders & Boundaries policy planned.

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

- [ ] Layer 2 Borders & Boundaries (policy planned — implementation pending WO-077+)
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

1. **[HUMAN ACTION REQUIRED] Survey of India contact:** Human must contact Survey of India
   to request licensing for digital vector boundary data. Clears G2, G3.
2. **[HUMAN ACTION REQUIRED] Non-India source license review:** Human must review Natural
   Earth India-conflict status, UN Cartographic license, and GADM license. Clears G4.
3. **[HUMAN ACTION REQUIRED] Survey of India guidelines review:** Human must read
   https://onlinemaps.surveyofindia.gov.in/GeospatialGuidelines.aspx. Clears G1.
4. **WO-077 Borders database schema (schema-only):** May be drafted now under strict
   schema-only scope. No data, no India geometry, no source ingestion.
   See `docs/control/BORDERS_BOUNDARIES_IMPLEMENTATION_GATE_REVIEW.md` Section 9.
5. **Borders source ingestion (WO-078):** Blocked until G1–G6 cleared.

## Last Updated

2026-05-26 — Kiro CLI (WO-076A-BORDERS-BOUNDARIES-GATE-AND-SOURCE-REVIEW)
