# Specification Index: Layer 06 Maritime / Live Ships MVP

**Feature ID**: 005-layer-06-maritime-mvp
**Layer**: layer_06_maritime
**Status**: PLANNING (specification in progress)
**Created**: 2026-06-09

---

## Quick Navigation

| Document | Owner | Purpose |
|----------|-------|---------|
| [SPEC_OVERVIEW.md](SPEC_OVERVIEW.md) | Planning Worker | Executive summary, feature goals, user value, acceptance criteria |
| [SOURCE_EVALUATION_MATRIX.md](SOURCE_EVALUATION_MATRIX.md) | Planning Worker | Source candidates, AISStream evaluation, backup sources |
| [FETCHING_DESIGN.md](FETCHING_DESIGN.md) | Planning Worker | AISStream WebSocket connection, raw storage, run modes |
| [NORMALIZATION_DESIGN.md](NORMALIZATION_DESIGN.md) | Planning Worker | AIS message parsing, vessel/position schema, MMSI join |
| [DATABASE_PLANNING.md](DATABASE_PLANNING.md) | Planning Worker | PostGIS schema, tables, indexes, upsert strategy |
| [API_PLANNING.md](API_PLANNING.md) | Planning Worker | REST endpoints, query patterns, response schemas |
| [FRONTEND_PLANNING.md](FRONTEND_PLANNING.md) | Planning Worker | Cesium markers, heading, click card, refresh strategy |
| [WORK_ORDERS.md](WORK_ORDERS.md) | Planning Worker | Work order sequence, lane assignments, acceptance criteria |
| [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) | Planning Worker | Decisions needed, unresolved questions |

---

## Feature Summary

The **Maritime / Live Ships MVP** enables users to visualize real vessel positions on the GOD EYES globe using live AIS data:

- Real AIS vessel positions from AISStream WebSocket
- Ship markers with heading/course direction on Cesium globe
- Click-to-detail card (vessel name, MMSI, type, speed, course, destination)
- Data freshness display
- Vessel type filtering
- All vessel types supported
- Source attribution (AISStream)

---

## Primary User Value

Users can enable the Maritime layer on the GOD EYES globe and see:
- Real ships moving on the ocean
- Heading direction for each vessel
- Rich metadata on click (MMSI, name, type, speed, course, destination)
- Data freshness indicators
- Filter by vessel type

---

## Data Source

**Primary**: AISStream (WebSocket, free API key, global coverage)
**Backup**: BarentsWatch (regional), AISHub (crowdsourced)
**No fake data** — if source unavailable, empty state is shown

---

## Visual Design

### Markers
- **Vessels**: Colored dots (8-12px) with heading arrow
- **Heading**: Small triangle pointing in vessel heading direction
- **Stale**: Dimmed/grayed when position > 5 minutes old

### Color Scheme (by vessel type)
- Cargo: Blue
- Tanker: Orange
- Passenger: Purple
- Fishing: Green
- Tug: Yellow
- Military: Red
- Pleasure/Sailing: Light Blue
- High Speed Craft: Cyan
- Other/Unknown: Gray

---

## Technical Architecture

### Multi-Agent Implementation

| Lane | Role | Responsibility |
|------|------|----------------|
| Planning | Planning Worker | Spec kit, source evaluation, work orders |
| Fetching | Fetching Worker | AISStream fetcher, normalizer, raw storage |
| Database | Database Worker | PostGIS schema, migrations |
| API | API Worker | REST endpoints, contracts |
| Frontend | Frontend Worker | Cesium rendering, markers, click card |
| Review | Reviewer | Integration review, merge |

---

## Work Order Sequence

1. **WO-MAR-P** — Maritime Spec/Planning ← CURRENT
2. **WO-MAR-R** — Maritime Source Research
3. **WO-MAR-S** — AISStream Real Fetch Proof
4. **WO-MAR-F** — Fetcher Implementation
5. **WO-MAR-N** — Normalization Implementation
6. **WO-MAR-D** — Database Schema
7. **WO-MAR-A** — API Implementation
8. **WO-MAR-U** — Frontend Integration
9. **WO-MAR-V** — Full Layer Validation

---

## MVP Scope

### Included
- AISStream WebSocket connection
- Raw AIS message capture
- PositionReport + ShipStaticData normalization
- PostGIS latest-position upsert
- REST API with bbox/type/MMSI filters
- Cesium ship markers with heading
- Click card with vessel details
- Stale marker handling
- Source attribution

### Excluded
- Historical playback
- Path/trail rendering
- Port database
- Real-time WebSocket/SSE push
- Multi-source fusion
- Vessel risk scoring

---

## Key Rules

1. **Source-first**: No full fetcher/database/API/frontend implementation starts before fetch proof succeeds
2. **Raw-data-first**: Raw messages saved before normalization
3. **No fake data**: Empty state if source unavailable
4. **No secret leakage**: API key in env only, never stored
5. **Layer-aware**: All tables use `layer_id`, `source_id`, `mmsi`

---

## File Structure

```
specs/005-layer-06-maritime-mvp/
    README.md                    (this file)
    SPEC_OVERVIEW.md             (executive summary)
    SOURCE_EVALUATION_MATRIX.md  (source candidates)
    FETCHING_DESIGN.md           (fetcher architecture)
    NORMALIZATION_DESIGN.md      (field mapping)
    DATABASE_PLANNING.md         (schema design)
    API_PLANNING.md              (endpoint design)
    FRONTEND_PLANNING.md         (Cesium rendering)
    WORK_ORDERS.md               (task sequence)
    OPEN_QUESTIONS.md            (decisions needed)
```

---

## Specification Status

| Document | Status | Owner | Ready |
|----------|--------|-------|-------|
| SPEC_OVERVIEW.md | Complete | Planning Worker | Yes |
| SOURCE_EVALUATION_MATRIX.md | Complete | Planning Worker | Yes |
| FETCHING_DESIGN.md | Complete | Planning Worker | Yes |
| NORMALIZATION_DESIGN.md | Complete | Planning Worker | Yes |
| DATABASE_PLANNING.md | Complete | Planning Worker | Yes |
| API_PLANNING.md | Complete | Planning Worker | Yes |
    FRONTEND_PLANNING.md | Complete | Planning Worker | Yes |
| WORK_ORDERS.md | Complete | Planning Worker | Yes |
| OPEN_QUESTIONS.md | Complete | Planning Worker | Yes |

**Overall Status**: PLANNING — specification complete, ready for source research and fetch proof.

---

## Next Steps

1. **WO-MAR-P** complete → review and approve spec kit
2. **WO-MAR-R** → source research (verify AISStream docs)
3. **WO-MAR-S** → fetch proof (prove real data is deliverable)
4. If fetch proof passes → proceed to implementation WOs
5. If fetch proof fails → evaluate backup sources

---

**Created by**: Planning Worker
**Date**: 2026-06-09
**Feature**: 005-layer-06-maritime-mvp
**Status**: PLANNING
