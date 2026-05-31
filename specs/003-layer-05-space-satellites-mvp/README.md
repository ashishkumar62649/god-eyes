# Specification Index: Layer 05 Space & Satellites MVP

**Feature ID**: 003-layer-05-space-satellites-mvp  
**Layer**: layer_05_space_satellites  
**Status**: ✅ Specification Complete (Not Implemented)  
**Created**: 2026-05-31  

---

## Quick Navigation

| Document | Owner | Purpose |
|----------|-------|---------|
| [SPEC_OVERVIEW.md](SPEC_OVERVIEW.md) | Kiro CLI | Executive summary, feature goals, user value, visual rules |
| [DATABASE_SCHEMA_SPEC.md](DATABASE_SCHEMA_SPEC.md) | Codex | Database schema, migrations, indexing strategy |
| [API_CONTRACT_SPEC.md](API_CONTRACT_SPEC.md) | DeepSeek | REST endpoints, WebSocket protocol, error handling |
| [FRONTEND_CESIUM_SPEC.md](FRONTEND_CESIUM_SPEC.md) | Sonnet 4.6 | Cesium rendering, filters, detail panel, WebSocket integration |
| [DATA_PIPELINE_SPEC.md](DATA_PIPELINE_SPEC.md) | MiniMax | Fetcher, normalizer, CelesTrak/Space-Track integration |
| [AGENT_INTEGRATION_SPEC.md](AGENT_INTEGRATION_SPEC.md) | Kiro CLI | Multi-agent workflow, work orders, branching strategy |

---

## Feature Summary

The **Space & Satellites MVP** enables users to visualize public orbital objects (satellites, debris, rocket bodies) around Earth with:

✅ Real-time position estimation from public orbital data  
✅ Category-based filtering (Starlink, communications, navigation, weather, Earth obs, science, crewed, debris, rocket body, inactive, unknown)  
✅ Visual distinction: satellites = dots, debris/rocket bodies = triangles  
✅ Color schemes by altitude or category  
✅ Important object highlighting  
✅ Comprehensive object metadata (name, NORAD ID, orbit class, altitude, speed, operator, etc.)  
✅ Data freshness/age tracking  
✅ WebSocket-driven real-time position updates  

---

## Primary User Value

Users can enable the Space & Satellites layer on the GOD EYES globe and see:
- Public satellites and orbital objects moving around Earth
- Clear visual differences between active satellites and debris
- Rich metadata for each object (click-to-expand detail panel)
- Estimated position movements every 5 seconds
- Filter-based search (by category, altitude, operator, importance)
- Data currency indicators (TLE age, source age)

---

## Data Sources

**Primary**: CelesTrak (public orbital elements, satellite catalog)  
**Secondary**: Space-Track (authenticated, optional, local env vars only)  
**No API keys exposed** in logs, code, or responses.

---

## Visual Design

### Markers
- **Satellites**: Colored dots (8-12px)
- **Debris/Rocket Bodies**: Colored triangles (6-10px)
- **Important Satellites**: Larger/glowing version of dot
- **No black or white** as primary marker colors

### Color Schemes
- **By Altitude**: VLEO (cyan) → LEO (blue) → MEO (green) → GEO (red) → HEO (orange) → Unknown (gray)
- **By Category**: Starlink (light blue), Comms (purple), Nav (yellow-green), Weather (light green), Obs (dark green), Science (orange), Crewed (yellow/bright), Debris (red), Rocket Body (dark red), Inactive (gray), Unknown (dim purple)

---

## Technical Architecture

### Multi-Agent Implementation

| Lane | Agent | Worktree | Responsibility |
|------|-------|----------|-----------------|
| Database | Codex | E:\god-eyes-db | Schema, migrations, storage |
| Fetcher | MiniMax | E:\god-eyes-fetching | CelesTrak/Space-Track fetching, TLE parsing, classification |
| API | DeepSeek | E:\god-eyes-api | REST endpoints, WebSocket, SGP4 position computation |
| Frontend | Sonnet 4.6 | E:\god-eyes-frontend | Cesium rendering, filters, detail panel, WebSocket client |
| Control | Kiro CLI | E:\god-eyes | Integration, review, merge coordination |

**All agents work in parallel** with synchronized handoff and integration review by Kiro.

---

## API Endpoints (Summary)

All endpoints at `/api/layer-05/`:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/satellites` | GET | List objects with filters (category, altitude, type, operator) |
| `/satellites/:id` | GET | Detailed metadata + estimated current position |
| `/position/:id` | GET | Lightweight current position only |
| `/positions` | GET | Bulk position fetch (multiple objects) |
| `/categories` | GET | Category list with counts |
| `/orbit-classes` | GET | Orbit class distribution |
| **WebSocket**: `/ws/layer-05/positions` | WS | Real-time position streaming (subscribe/unsubscribe) |

Response times:
- List: < 500 ms (5000+ objects)
- Detail: < 100 ms
- Position: < 50 ms
- WebSocket update: < 100 ms latency

---

## Database Schema (Summary)

**Main Table**: `layer_05_space_satellites.orbital_objects`

Key fields:
- Identification: `name`, `norad_catalog_id`, `international_designator`
- Type: `object_type` (PAYLOAD, DEBRIS, ROCKET BODY, UNKNOWN)
- Orbital: `tle_line_1`, `tle_line_2`, `tle_epoch`, `semi_major_axis_km`, `apogee_km`, `perigee_km`, `inclination_degrees`, `eccentricity`
- Classification: `category` (STARLINK, COMMUNICATIONS, NAVIGATION, WEATHER, EARTH_OBSERVATION, SCIENCE, CREWED, DEBRIS, ROCKET_BODY, INACTIVE, UNKNOWN)
- Current State: `estimated_altitude_km`, `estimated_speed_km_s`, `orbit_class`, `last_position_update`
- Metadata: `operator`, `mission`, `importance_flag`, `source_id`, `source_last_refreshed`

**Positions are computed on-demand** from TLE using SGP4, not stored.

---

## Frontend Components

**Layer Structure**:
- SpaceSatellitesLayer (main)
  - LayerToggle
  - SatelliteRenderer (Cesium entities)
  - FilterPanel (category, type, altitude, operator, importance)
  - ColorModeToggle (altitude vs category)
  - VisualizationControls (labels, debris, importance-only)
  - DetailsPanel (click to view metadata)
  - WebSocketManager (position streaming)

**Interactions**:
- Toggle layer on/off
- Apply filters → API query → rerender
- Click satellite → detail panel
- Hover → highlight + tooltip
- WebSocket updates position every 5 seconds

---

## Data Pipeline

1. **Fetch** (MiniMax)
   - Every 6 hours from CelesTrak (public)
   - Every 24 hours from Space-Track (optional, authenticated)
   - Store raw data locally

2. **Normalize** (MiniMax)
   - Parse TLE (Two-Line Element)
   - Extract orbital elements
   - Compute orbit class (VLEO/LEO/MEO/GEO/HEO)
   - Classify into category (rules-based)
   - Flag important objects
   - Validate data

3. **Store** (Codex)
   - Upsert to database
   - Handle duplicates (source_id + source_object_id unique key)
   - Update timestamps

4. **Query** (DeepSeek)
   - API returns metadata from database
   - Compute current position on-demand (SGP4)
   - Stream updates via WebSocket

---

## Movement Truth Rule

**Positions are estimated from public orbital elements, NOT live sensor tracking.**

- Uses Two-Line Element (TLE) sets and SGP4/SDP4 propagation
- UI labels position as "estimated current position"
- Data age/freshness always displayed
- **No claims** of real-time satellite-to-satellite communication or confirmed live ground links
- Starlink neighbor links (if included) labeled as "estimated"

---

## MVP Scope

### Included
✅ Public satellite/debris rendering  
✅ Category-based filtering  
✅ Position estimation from TLE  
✅ Metadata display  
✅ WebSocket real-time updates  
✅ Database support  
✅ API endpoints  
✅ Frontend Cesium integration  
✅ Manual browser verification tests  

### Excluded
❌ Confirmed live satellite-to-satellite communication  
❌ Confirmed live ground-station communication  
❌ Classified/non-public military data  
❌ Real-time ADS-B sensor tracking  
❌ Historical playback UI  
❌ Collision prediction analytics  
❌ Advanced ephemeris calculations  

---

## Acceptance Criteria

### Database (WO-085A)
- ✅ Schema supports all required fields
- ✅ Indexes for filtering (category, type, orbit_class)
- ✅ Migrations idempotent
- ✅ UPSERT logic handles duplicates

### Fetcher (WO-085B)
- ✅ Fetches from CelesTrak successfully
- ✅ Parses TLE correctly
- ✅ Classifies objects into categories
- ✅ Computes orbit class
- ✅ Handles errors gracefully
- ✅ No API keys exposed
- ✅ Upserts to database

### API (WO-085C)
- ✅ All endpoints implemented per contract
- ✅ Responses match schema
- ✅ Filtering works (all combinations)
- ✅ WebSocket streams positions every 5s
- ✅ Position computation uses SGP4
- ✅ Error responses proper HTTP status
- ✅ No API keys exposed

### Frontend (WO-085D)
- ✅ Layer renders satellites (dots) and debris (triangles)
- ✅ Colors by altitude or category
- ✅ Filters apply and update entities
- ✅ Detail panel shows all fields
- ✅ WebSocket updates smooth
- ✅ No console errors
- ✅ Works at various zoom levels

### Integration (WO-085E)
- ✅ Full-stack tests pass
- ✅ Manual verification complete
- ✅ Performance targets met
- ✅ All specs match implementation

---

## Implementation Timeline

**Estimated Duration**: 3-4 days (3 agents working in parallel)

**Phase 1 (Day 1)**: Schema design, fetcher setup, API scaffolding, frontend structure  
**Phase 2 (Day 2)**: Fetcher pipeline complete, API endpoints tested, frontend rendering working  
**Phase 3 (Day 3)**: Integration testing, bug fixes, documentation  
**Phase 4 (Day 4)**: Final verification, merge to main

---

## Success Metrics

1. **Functionality**: All endpoints return correct data, WebSocket streams positions, frontend renders correctly
2. **Performance**: API < 500ms for list, WebSocket < 100ms latency, Cesium renders 1000+ objects smoothly
3. **Data Quality**: Objects classified correctly, orbit classes accurate, positions within reasonable error bounds
4. **Reliability**: Graceful error handling, no crashes, retries on transient failures
5. **Security**: No API keys exposed, credentials in env vars only, no private data leaked
6. **Documentation**: All specs match implementation, agents document decisions in commits

---

## References & Resources

- **CelesTrak**: https://celestrak.org/
- **Space-Track**: https://www.space-track.org/
- **SGP4 Propagation**: Skyfield library or equivalents
- **Cesium.js**: https://cesium.com/
- **NORAD TLE Format**: https://www.celestrak.org/NORAD/documentation/
- **GOD EYES AGENTS.md**: Multi-agent workflow rules
- **MVP_LAYER_REGISTRY.md**: Authoritative layer definitions

---

## File Structure

```
specs/003-layer-05-space-satellites-mvp/
├── README.md (this file)
├── SPEC_OVERVIEW.md (executive summary)
├── DATABASE_SCHEMA_SPEC.md (Codex lane)
├── API_CONTRACT_SPEC.md (DeepSeek lane)
├── FRONTEND_CESIUM_SPEC.md (Sonnet 4.6 lane)
├── DATA_PIPELINE_SPEC.md (MiniMax lane)
└── AGENT_INTEGRATION_SPEC.md (Kiro lane)
```

---

## Specification Status

| Document | Status | Owner | Ready |
|----------|--------|-------|-------|
| SPEC_OVERVIEW.md | ✅ Complete | Kiro CLI | ✅ Yes |
| DATABASE_SCHEMA_SPEC.md | ✅ Complete | Codex | ✅ Yes |
| API_CONTRACT_SPEC.md | ✅ Complete | DeepSeek | ✅ Yes |
| FRONTEND_CESIUM_SPEC.md | ✅ Complete | Sonnet 4.6 | ✅ Yes |
| DATA_PIPELINE_SPEC.md | ✅ Complete | MiniMax | ✅ Yes |
| AGENT_INTEGRATION_SPEC.md | ✅ Complete | Kiro CLI | ✅ Yes |

**Overall Status**: ✅ **SPECIFICATION COMPLETE**

All specifications are finalized and ready for parallel agent implementation.

---

## Next Steps (After Specification)

1. **Kiro CLI** creates work orders (WO-085A through WO-085E)
2. **Each agent** clones worktree and checks out feature branch
3. **Agents work in parallel** per their lane specifications
4. **Each agent** creates one commit and updates HANDOFF_LOG.md
5. **Claude Haiku 4.5** validates against specifications
6. **Kiro CLI** performs integration review and merge

---

**Specification Finalized**: 2026-05-31  
**Ready for Implementation**: ✅ Yes  
**Multi-Agent Workflow**: ✅ Ready  
**Work Order Decomposition**: ✅ Complete  

---

## Quick Links

- View database schema: [DATABASE_SCHEMA_SPEC.md](DATABASE_SCHEMA_SPEC.md)
- View API contract: [API_CONTRACT_SPEC.md](API_CONTRACT_SPEC.md)
- View frontend requirements: [FRONTEND_CESIUM_SPEC.md](FRONTEND_CESIUM_SPEC.md)
- View data pipeline: [DATA_PIPELINE_SPEC.md](DATA_PIPELINE_SPEC.md)
- View agent workflow: [AGENT_INTEGRATION_SPEC.md](AGENT_INTEGRATION_SPEC.md)
- View executive summary: [SPEC_OVERVIEW.md](SPEC_OVERVIEW.md)

**Created by**: GitHub Copilot (Claude Haiku 4.5)  
**Date**: 2026-05-31  
**Feature**: 003-layer-05-space-satellites-mvp  
**Status**: ✅ Specification Complete
