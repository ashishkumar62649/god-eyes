# Specification Index: Layer 07 Weather / Live Weather MVP

**Feature ID**: 006-layer-07-weather-mvp
**Layer**: layer_07_weather
**Status**: PLANNING (specification in progress)
**Created**: 2026-06-10

---

## Quick Navigation

| Document | Owner | Purpose |
|----------|-------|---------|
| [SPEC_OVERVIEW.md](SPEC_OVERVIEW.md) | Planning Worker | Executive summary, feature goals, user value, acceptance criteria |
| [SOURCE_EVALUATION_MATRIX.md](SOURCE_EVALUATION_MATRIX.md) | Planning Worker | Source candidates, Open-Meteo evaluation, backup sources |
| [FETCHING_DESIGN.md](FETCHING_DESIGN.md) | Planning Worker | Open-Meteo fetch strategy, grid design, raw storage |
| [NORMALIZATION_DESIGN.md](NORMALIZATION_DESIGN.md) | Planning Worker | Raw response mapping, weather code labeling, unit normalization |
| [DATABASE_PLANNING.md](DATABASE_PLANNING.md) | Planning Worker | PostGIS schema, tables, indexes, upsert strategy |
| [API_PLANNING.md](API_PLANNING.md) | Planning Worker | REST endpoints, query patterns, response schemas |
| [FRONTEND_PLANNING.md](FRONTEND_PLANNING.md) | Planning Worker | Cesium rendering, temperature colors, wind display, click card |
| [WORK_ORDERS.md](WORK_ORDERS.md) | Planning Worker | Work order sequence, lane assignments, acceptance criteria |
| [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) | Planning Worker | Decisions needed, unresolved questions |

---

## Feature Summary

The **Weather / Live Weather MVP** enables users to visualize real weather conditions on the GOD EYES globe using point/grid-based weather data from Open-Meteo:

- Real weather forecast data from Open-Meteo API
- Temperature-colored weather markers on Cesium globe
- Click-to-detail card (temperature, wind, humidity, precipitation, cloud cover)
- Weather condition labels from WMO weather codes
- Data freshness display
- Source attribution (Open-Meteo)
- Low-density global grid for MVP

---

## Primary User Value

Users can enable the Weather layer on the GOD EYES globe and see:
- Real weather conditions at grid points across the globe
- Temperature-based color coding for quick visual assessment
- Wind direction and speed indicators
- Rich metadata on click (temperature, humidity, wind, pressure, precipitation, cloud cover)
- Data freshness indicators
- Source attribution

---

## Data Source

**Primary**: Open-Meteo (free, no API key, global coverage, CC-BY 4.0)
**Backup**: MET Norway (regional, future)
**Radar Overlay**: RainViewer (future extension)
**No fake data** — if source unavailable, empty state is shown

---

## Visual Design

### Markers
- **Weather Cells**: Colored circles (8-12px) at grid points
- **Temperature Color**: Blue (cold) → Green (mild) → Yellow → Orange → Red (hot)
- **Stale**: Dimmed/grayed when forecast data is older than threshold

### Color Scheme (by temperature)
- < 0°C: Deep Blue
- 0-10°C: Light Blue
- 10-20°C: Green
- 20-30°C: Yellow/Orange
- > 30°C: Red

---

## Technical Architecture

### Multi-Agent Implementation

| Lane | Role | Responsibility |
|------|------|----------------|
| Planning | Planning Worker | Spec kit, source evaluation, work orders |
| Fetching | Fetching Worker | Open-Meteo fetcher, normalizer, raw storage |
| Database | Database Worker | PostGIS schema, migrations |
| API | API Worker | REST endpoints, contracts |
| Frontend | Frontend Worker | Cesium rendering, markers, click card |
| Review | Reviewer | Integration review, merge |

---

## Work Order Sequence

1. **WO-WEATHER-P** — Weather Spec/Planning ← CURRENT
2. **WO-WEATHER-R** — Weather Source Research
3. **WO-WEATHER-S** — Open-Meteo Fetch Proof
4. **WO-WEATHER-F** — Fetcher Implementation
5. **WO-WEATHER-N** — Normalization Implementation
6. **WO-WEATHER-D** — Database Schema
7. **WO-WEATHER-A** — API Implementation
8. **WO-WEATHER-U** — Frontend Integration
9. **WO-WEATHER-V** — Full Layer Validation

---

## MVP Scope

### Included
- Open-Meteo HTTP API connection (no API key required)
- Grid-based weather data fetching (low-density global grid)
- Raw response storage before normalization
- Normalization of weather variables (temperature, wind, humidity, etc.)
- Weather code to label mapping (WMO codes)
- PostGIS database schema with latest observation upsert
- REST API with bbox/condition filters
- Cesium weather markers with temperature coloring
- Click card with weather details
- Stale data handling
- Source attribution

### Excluded
- Radar tile overlays (RainViewer future)
- Cloud satellite imagery
- Weather alerts/warnings
- Storm tracking
- Severe weather notifications
- Hourly time-series visualization
- High-density regional grids
- Weather station aggregation

---

## Key Rules

1. **Source-first**: No full fetcher/database/API/frontend implementation starts before fetch proof succeeds
2. **Raw-data-first**: Raw responses saved before normalization
3. **No fake data**: Empty state if source unavailable
4. **No secret leakage**: No API keys needed for Open-Meteo free tier
5. **Layer-aware**: All tables use `layer_id`, `source_id`, `location_id`
6. **Grid-aware**: Weather data is model/grid-based, not street-level exact

---

## File Structure

```
specs/006-layer-07-weather-mvp/
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
| FRONTEND_PLANNING.md | Complete | Planning Worker | Yes |
| WORK_ORDERS.md | Complete | Planning Worker | Yes |
| OPEN_QUESTIONS.md | Complete | Planning Worker | Yes |

**Overall Status**: PLANNING — specification complete, ready for source research and fetch proof.

---

## Next Steps

1. **WO-WEATHER-P** complete → review and approve spec kit
2. **WO-WEATHER-R** → source research (verify Open-Meteo docs)
3. **WO-WEATHER-S** → fetch proof (prove real data is deliverable)
4. If fetch proof passes → proceed to implementation WOs
5. If fetch proof fails → evaluate backup sources

---

**Created by**: Planning Worker
**Date**: 2026-06-10
**Feature**: 006-layer-07-weather-mvp
**Status**: PLANNING
