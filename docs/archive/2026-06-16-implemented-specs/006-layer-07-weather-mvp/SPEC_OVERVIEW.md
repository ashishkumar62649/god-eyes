# Specification: 006-Layer-07-Weather-MVP

## Feature Identity
- **Spec ID**: 006-layer-07-weather-mvp
- **Layer ID**: layer_07_weather
- **Layer Name**: Weather / Live Weather
- **Phase**: MVP
- **Status**: PLANNING
- **Layer Registry Status**: coming_soon (to be registered)

---

## Executive Summary

The Weather / Live Weather layer enables users to visualize real weather conditions on the GOD EYES globe using point/grid-based forecast data from Open-Meteo. This layer fetches actual weather model output via the Open-Meteo HTTP API, normalizes weather variables into a standard observation schema, stores them in a PostGIS database, and renders them as temperature-colored weather markers on the Cesium globe.

This is the first weather data layer in GOD EYES. The MVP focuses on proving that real weather data is fetchable, inspectable, and renderable — not on comprehensive weather intelligence, radar overlays, or severe weather alerts.

---

## Layer Goal

Prove that real, live weather forecast data can be fetched from Open-Meteo, normalized, stored, queried via API, and rendered as interactive weather markers on the globe.

---

## User-Facing Outcome

Users can:
1. Enable the Weather layer on the GOD EYES globe
2. See real weather conditions as colored markers at grid points across the globe
3. See temperature-based color coding for quick visual assessment
4. Click a weather marker to view a detail card (temperature, wind, humidity, pressure, precipitation, cloud cover, weather condition)
5. Understand data currency (last updated timestamp)
6. See source attribution (Open-Meteo)

---

## In Scope (MVP)

- Open-Meteo HTTP API connection (no API key required for non-commercial use)
- Low-density global grid fetch strategy
- Raw JSON response storage before normalization
- Normalization of weather variables into standard schema
- WMO weather code to human-readable label mapping
- PostGIS database schema with latest-observation upsert and history
- REST API endpoints for weather queries (bbox, temperature, wind, condition)
- Frontend: weather markers with temperature coloring, click card, source attribution
- Stale data handling (forecasts older than threshold shown dimmed)
- Coordinate precision vs weather model resolution documentation

---

## Out of Scope (MVP)

- Radar tile overlays (RainViewer future extension)
- Cloud cover satellite imagery overlay
- Weather alerts / severe weather warnings
- Storm tracking / hurricane tracking
- Lightning strike data
- Hourly time-series visualization on globe
- High-density regional grids (future zoom-based refinement)
- Weather station aggregation / ground-truth data
- Historical weather data / archive
- Weather comparison / trend analysis
- Multiple weather model selection by user
- Weather-based routing or recommendations

---

## MVP Definition

The MVP is complete when:
1. A real Open-Meteo API call returns weather data for grid coordinates
2. Raw JSON responses are saved to disk before any processing
3. Weather variables are normalized into a standard observation schema
4. Weather codes are mapped to human-readable labels
5. Data is stored in PostGIS with latest-observation upsert
6. API returns weather data that the frontend can query
7. Frontend renders real weather markers with temperature-based coloring
8. Click on a weather marker shows a detail card with weather info
9. Data freshness / staleness is visible to the user
10. No fake or demo data is used anywhere

---

## Non-MVP Future Expansion

- Radar precipitation overlay (RainViewer integration)
- Cloud cover satellite imagery overlay
- Weather alerts and severe weather notifications
- Storm/hurricane tracking with path prediction
- Lightning strike overlay
- High-density regional grids (zoom-based refinement)
- 15-minute nowcast data
- Hourly forecast timeline scrubber
- Weather comparison between locations
- Weather-based route planning
- Marine weather overlay
- Air quality overlay (Open-Meteo Air Quality API)
- Snow depth / winter weather details
- Sunrise/sunset visualization
- UV index display

---

## Coordinate Precision vs Weather Model Resolution

**Critical distinction for all planning documents:**

### Requested Coordinate Precision
- Open-Meteo accepts precise WGS84 latitude/longitude coordinates
- Users can request weather for any lat/lon point (e.g., 40.7128, -74.0060)
- The API resolves to the nearest grid cell automatically

### Weather Model / Grid Spatial Resolution
- Returned weather values are derived from numerical weather model grids
- Grid resolution varies by model: 9 km (ECMWF), 25 km (GFS), 1 km (MET Nordic)
- The `latitude`/`longitude` in the response indicates the grid cell center, NOT the exact requested point
- Weather values represent the grid cell average, not street-level conditions
- Elevation-based downscaling improves accuracy for mountainous terrain

### Forecast Timestamp
- `forecast_for`: The time period the weather data is valid for (ISO 8601)
- Hourly data: each timestamp represents conditions at that hour
- Daily data: represents the 24-hour aggregation period

### Fetch Timestamp
- `fetched_at`: When the GOD EYES system fetched the data from Open-Meteo
- This is NOT the weather model initialization time
- This is NOT the weather observation time
- This is the API call timestamp

### System Must Not:
- Describe data as "street-level exact weather"
- Imply precision beyond the model grid resolution
- Present grid-cell-center coordinates as the exact requested location without disclaimer
- Confuse fetch time with forecast valid time

---

## Source-First Rule

**No full fetcher/database/API/frontend implementation starts before fetch proof succeeds.**

WO-WEATHER-S may create the smallest possible proof script needed to call the Open-Meteo API, receive real weather data, and save raw proof files. Phase 1 (WO-WEATHER-R / WO-WEATHER-S) must succeed before any implementation work begins:
- Prove Open-Meteo API connection works
- Prove real weather data is received
- Inspect raw response structure
- Confirm data fields match expected schema
- Document any discrepancies

---

## Raw-Data-First Rule

**Raw API responses are always saved before normalization.**

The fetcher must write raw Open-Meteo JSON responses to disk before the normalizer reads them. This ensures:
- Auditability: raw evidence is preserved
- Replay: normalization can be re-run from raw data
- Debugging: raw data is available when normalization fails

---

## No Fake Real-Time Rule

**The system must never fabricate weather data or simulate conditions.**

- All displayed weather data must originate from real Open-Meteo API responses
- If the API is unavailable, markers become stale (not replaced with fake data)
- If no data is available, the layer shows an empty state — never placeholder markers
- Interpolation between grid points is explicitly not in scope for MVP

---

## Acceptance Criteria

### Data Pipeline
- [ ] Open-Meteo API returns real weather data for grid coordinates
- [ ] Raw JSON responses are saved to `raw/layer_07_weather/open-meteo/...`
- [ ] Weather variables are normalized to standard observation schema
- [ ] Weather codes are mapped to human-readable labels
- [ ] PostGIS tables are created with correct schema
- [ ] Latest observation upsert works correctly
- [ ] Observation history is recorded

### API
- [ ] GET /api/layers/layer_07_weather/objects returns weather data
- [ ] bbox filter works
- [ ] temperature_min/max filter works
- [ ] weather_condition filter works
- [ ] Response includes coordinates, temperature, wind, humidity, precipitation, cloud cover

### Frontend
- [ ] Weather layer toggle appears in LayerPanel
- [ ] Weather markers render on globe at grid points
- [ ] Markers show temperature-based color coding
- [ ] Click on marker opens detail card
- [ ] Detail card shows: temperature, apparent temperature, wind speed/direction, humidity, pressure, precipitation, cloud cover, weather condition, forecast time, source
- [ ] Stale markers are visually distinct
- [ ] Source attribution displayed
- [ ] No console errors
- [ ] 60 FPS maintained

### Rules
- [ ] No API keys committed or printed
- [ ] No fake data used
- [ ] Raw responses saved before normalization
- [ ] All work within allowed folders only
- [ ] Coordinate precision vs model resolution documented in UI

---

## Layer Status

**PLANNING** — Spec kit in progress. No implementation started.

| Phase | Status |
|-------|--------|
| Planning | In Progress |
| Source Research | Pending |
| Fetch Proof | Pending |
| Implementation | Pending |
| API | Pending |
| Frontend | Pending |
| Validation | Pending |

---

## References & Resources

- **Open-Meteo**: https://open-meteo.com/
- **Open-Meteo API Docs**: https://open-meteo.com/en/docs
- **Open-Meteo Terms**: https://open-meteo.com/en/terms
- **Open-Meteo Licence**: https://open-meteo.com/en/licence
- **WMO Weather Codes**: https://open-meteo.com/en/docs (weather_code section)
- **MVP_LAYER_REGISTRY.md**: Authoritative layer definitions
- **LAYER_ID_CONVENTIONS.md**: Naming and folder conventions
- **SOURCE_TO_FRONTEND_CONTRACT.md**: Source contract requirements
- **PIPELINE_HANDOFF_RULES.md**: Data flow between agents
- **DATA_LOCATION_RULES.md**: Where files go
- **GOD EYES AGENTS.md**: Multi-agent workflow rules

---

**Specification Status**: Planning (not implemented)
