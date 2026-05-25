# Current Project State

## Phase: 0 — Layered Foundation

## Goal

Prepare the repository so GOD EYES can be built layer by layer, starting with Layer 0 Globe Core and Layer 1 Aviation.

## Status

**MVP Phase 1 Complete:** Layer 0 Globe Core + Layer 1 Aviation with Airport Intelligence, Gallery, and Layout Overlay

### Completed Work Orders
- ✅ WO-001 through WO-029F: Foundation, data pipeline, API, frontend infrastructure
- ✅ WO-030A: Aviation API Preload/Resident Cache Mode
- ✅ WO-031-FE: Aviation Simple Global Category Renderer
- ✅ HOTFIX-2: Frontend Fetch/Render/Status Fixes
- ✅ WO-060: Repository Health Audit (score: 74/100)
- ✅ WO-061: Repository Safe Cleanup (Phase 1)

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

- [ ] Layer 2 Borders & Boundaries
- [ ] Layer 3 Earth Events
- [ ] Layer 4 Public Military & Security
- [ ] Layer 5 Space & Satellites
- [ ] Layer 6 Maritime
- [ ] Layer 7 Infrastructure
- [ ] Layer 8 News & OSINT
- [ ] Layer 9 User Shapes
- [ ] Real-time data updates (beyond aviation cache)
- [ ] Live aircraft tracking (real-time position streaming)
- [ ] User authentication
- [ ] Data export/sharing
- [ ] Generic layer API endpoints

## Next Safe Steps

1. **MVP Layer Registry (WO-063):** Create authoritative 10-layer registry — **DONE**
2. **Density View (WO-032):** Implement global density heatmap for aviation
3. **Fabric Aggregation (WO-033):** Implement fabric-based clustering for performance
4. **Layer 2 Borders & Boundaries (WO-064+):** Add borders layer with static GeoJSON
5. **Layer 3 Earth Events (WO-065+):** Add USGS earthquake feed and event layer
6. **Layer 4 Public Military & Security (WO-066+):** Add public-only static military layer
7. **Repository Cleanup Phase 2 (WO-062+):** Address remaining audit items (score 74/100)

## Last Updated

2026-05-25 — Kiro CLI (WO-063-MVP-LAYER-REGISTRY-CONTROL)
