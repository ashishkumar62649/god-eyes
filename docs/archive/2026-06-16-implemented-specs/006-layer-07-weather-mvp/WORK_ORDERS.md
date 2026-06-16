# Work Orders: Layer 07 Weather MVP

## Overview

This document defines the implementation work orders for the GOD EYES Weather layer. Work orders are executed in sequence by specialized agents.

---

## Work Order Sequence

```
WO-WEATHER-P (Planning) ← CURRENT
    ↓
WO-WEATHER-R (Source Research)
    ↓
WO-WEATHER-S (Fetch Proof)
    ↓
WO-WEATHER-F (Fetcher Implementation)
    ↓
WO-WEATHER-N (Normalization Implementation)
    ↓
WO-WEATHER-D (Database Schema)
    ↓
WO-WEATHER-A (API Implementation)
    ↓
WO-WEATHER-U (Frontend Integration)
    ↓
WO-WEATHER-V (Full Layer Validation)
```

---

## WO-WEATHER-P: Weather Spec/Planning

| Attribute | Value |
|-----------|-------|
| **Status** | COMPLETE (this spec kit) |
| **Role** | Planning Worker |
| **Lane** | Planning |
| **Scope** | Create complete spec kit for Layer 07 Weather MVP |
| **Allowed Files** | `specs/006-layer-07-weather-mvp/` only |
| **Disallowed Files** | All code files, database migrations, API routes, frontend components |
| **Validation** | All 10 planning documents created and complete |
| **Output** | Spec kit in `specs/006-layer-07-weather-mvp/` |

---

## WO-WEATHER-R: Weather Source Research

| Attribute | Value |
|-----------|-------|
| **Role** | Fetching Worker |
| **Lane** | Fetching |
| **Scope** | Verify Open-Meteo API documentation, confirm fields, test API response format |
| **Allowed Files** | `packages/source-catalog/layers/layer_07_weather/` |
| **Disallowed Files** | All code files, database migrations, API routes, frontend components |
| **Dependencies** | WO-WEATHER-P complete |
| **Validation** | Source research documents created, API response shape confirmed |
| **Output** | Source catalog entry, research summary, field mapping, sample responses |

### Detailed Scope

**May:**
- Fetch Open-Meteo API documentation pages
- Create source catalog entry for Open-Meteo
- Document all available weather variables
- Document API response format
- Document rate limits and attribution requirements
- Create sample request/response documentation
- Compare with planning docs (identify discrepancies)

**Must Not:**
- Write fetcher code
- Write normalizer code
- Create database tables
- Create API routes
- Create frontend components
- Call API with production coordinates (research only)
- Store raw API responses

### Expected Findings

- Confirm all MVP weather variables are available
- Confirm batch request support (multiple coordinates)
- Confirm no API key required for free tier
- Confirm CC-BY 4.0 attribution requirement
- Document any field name differences from planning docs
- Document any missing fields or unexpected fields

---

## WO-WEATHER-S: Open-Meteo Fetch Proof

| Attribute | Value |
|-----------|-------|
| **Role** | Fetching Worker |
| **Lane** | Fetching |
| **Scope** | Create minimal proof script that fetches real weather data from Open-Meteo |
| **Allowed Files** | `services/fetch-orchestrator/src/layers/layer_07_weather/` |
| **Disallowed Files** | Database, API, frontend, .env, secrets |
| **Dependencies** | WO-WEATHER-R complete |
| **Validation** | Real weather data received and saved to raw storage |
| **Output** | Proof script, raw data files, proof report |

### Detailed Scope

**May:**
- Create minimal proof script (proof.py)
- Connect to Open-Meteo API (no API key needed)
- Fetch weather data for 5-10 test coordinates
- Save raw JSON responses to `raw/layer_07_weather/open-meteo/...`
- Save metadata.json, preview.json, proof_report.md
- Validate response structure matches expectations

**Must Not:**
- Write full fetcher (that's WO-WEATHER-F)
- Write normalizer (that's WO-WEATHER-N)
- Create database tables
- Create API routes
- Create frontend components
- Fetch for all 2,664 grid cells (proof only)
- Store API keys (none needed)
- Commit raw data to git

### Proof Output

```
raw/layer_07_weather/open-meteo/{yyyy}/{mm}/{dd}/{fetch_run_id}/
    metadata.json          # Fetch run metadata
    proof_response.json    # Raw API response for proof coordinates
    preview.json           # First 5 coordinates with all fields
    observed_fields.json   # All fields found in response
    proof_report.md        # Human-readable proof report
```

### Proof Report Contents

- API endpoint used
- Request parameters
- Response HTTP status
- Response structure validation
- Field presence check
- Coordinate resolution check
- Weather code validation
- Any discrepancies from planning docs

---

## WO-WEATHER-F: Fetcher Implementation

| Attribute | Value |
|-----------|-------|
| **Role** | Fetching Worker |
| **Lane** | Fetching |
| **Scope** | Implement full Open-Meteo fetcher with grid generation, batching, raw storage |
| **Allowed Files** | `services/fetch-orchestrator/src/layers/layer_07_weather/` |
| **Disallowed Files** | Database, API, frontend, .env, secrets |
| **Dependencies** | WO-WEATHER-S complete and reviewed |
| **Validation** | Full grid fetch works, raw storage correct, rate limiting works |
| **Output** | Fetcher module with proof/fetch/inspect-cache modes |

### Detailed Scope

**May:**
- Create open_meteo_client.py (HTTP client with retries)
- Create weather_raw_storage.py (run directories, JSONL storage)
- Create weather_fetcher.py (grid generation, batching, orchestration)
- Create weather_cli.py (CLI with proof/fetch/inspect-cache commands)
- Create __init__.py (package exports)
- Implement 5° global grid generation
- Implement batch coordinate grouping (50 per batch)
- Implement rate-limit protection (concurrent limits, backoff)
- Implement retry logic (3 attempts, exponential backoff)
- Implement raw response storage
- Write unit tests

**Must Not:**
- Write normalizer (that's WO-WEATHER-N)
- Create database tables
- Create API routes
- Create frontend components
- Commit raw data to git

### Test Coverage

- Grid generation (5° produces correct coordinates)
- Batch grouping (50 per batch, correct count)
- Rate limiting (respects limits)
- Retry logic (handles failures)
- Raw storage (files created correctly)
- CLI commands (proof/fetch/inspect-cache)

---

## WO-WEATHER-N: Normalization Implementation

| Attribute | Value |
|-----------|-------|
| **Role** | Fetching Worker |
| **Lane** | Fetching |
| **Scope** | Implement normalization of raw Open-Meteo responses into standard weather observation schema |
| **Allowed Files** | `services/fetch-orchestrator/src/layers/layer_07_weather/` |
| **Disallowed Files** | Database, API, frontend, .env, secrets |
| **Dependencies** | WO-WEATHER-F complete and reviewed |
| **Validation** | Raw responses normalized correctly, weather codes mapped, units correct |
| **Output** | Normalizer module with normalize and normalize-from-cache commands |

### Detailed Scope

**May:**
- Create weather_normalizer.py
- Implement current weather normalization
- Implement hourly forecast normalization
- Implement weather code to label mapping (WMO codes)
- Implement coordinate precision handling (requested vs resolved)
- Implement timestamp handling (forecast_for vs fetched_at)
- Implement raw evidence URI strategy
- Implement provider_metadata extraction
- Write unit tests

**Must Not:**
- Create database tables
- Create API routes
- Create frontend components
- Commit normalized data to git

### Normalization Rules

- All MVP fields mapped correctly
- Weather codes mapped to human-readable labels
- Missing fields stored as NULL
- Required fields validated (temperature_c, forecast_for)
- Units preserved from Open-Meteo (no conversion)
- Timestamps properly handled

---

## WO-WEATHER-D: Database Schema

| Attribute | Value |
|-----------|-------|
| **Role** | Database Worker |
| **Lane** | Database |
| **Scope** | Create PostGIS database schema for Weather layer |
| **Allowed Files** | `database/migrations/layers/layer_07_weather/` |
| **Disallowed Files** | Fetcher code, API routes, frontend components |
| **Dependencies** | WO-WEATHER-N complete (needs normalized schema to design tables) |
| **Validation** | Tables created, indexes created, upsert works |
| **Output** | SQL migration file(s) |

### Detailed Scope

**May:**
- Create migration file for weather_sources table
- Create migration file for weather_fetch_runs table
- Create migration file for weather_locations table
- Create migration file for weather_observations_latest table
- Create migration file for weather_observation_history table
- Create migration file for weather_raw_message_refs table
- Create indexes (spatial, temporal, composite)
- Insert default Open-Meteo source record
- Write migration tests

**Must Not:**
- Write fetcher code
- Write API routes
- Write frontend components
- Commit test data

### Table Summary

| Table | Purpose |
|-------|---------|
| weather_sources | Registered weather data sources |
| weather_fetch_runs | Fetch execution tracking |
| weather_locations | Unique grid cell locations |
| weather_observations_latest | Latest observation per location (upserted) |
| weather_observation_history | Historical observations (append-only) |
| weather_raw_message_refs | References to raw response files |

---

## WO-WEATHER-A: API Implementation

| Attribute | Value |
|-----------|-------|
| **Role** | API Worker |
| **Lane** | API |
| **Scope** | Implement REST API endpoints for Weather layer |
| **Allowed Files** | `apps/api/src/routes/weather.ts`, `packages/contracts/src/index.ts` (add weather schemas) |
| **Disallowed Files** | Fetcher code, database migrations, frontend components |
| **Dependencies** | WO-WEATHER-D complete (needs database schema) |
| **Validation** | All endpoints work, filters work, error handling correct |
| **Output** | Route module, contracts, tests |

### Detailed Scope

**May:**
- Create weather.ts route module
- Implement GET /api/layers/layer_07_weather/objects (with bbox, temperature, weather_code filters)
- Implement GET /api/layers/layer_07_weather/objects/:objectId
- Implement GET /api/layers/layer_07_weather/stats
- Add Zod schemas to contracts package
- Register routes in index.ts
- Write comprehensive tests

**Must Not:**
- Write fetcher code
- Write database migrations
- Write frontend components
- Call external APIs

### Endpoint Summary

| Endpoint | Purpose |
|----------|---------|
| GET /objects | List weather observations with bbox/filter support |
| GET /objects/:objectId | Single observation detail |
| GET /stats | Layer statistics (counts, temperature range, conditions) |

---

## WO-WEATHER-U: Frontend Integration

| Attribute | Value |
|-----------|-------|
| **Role** | Frontend Worker |
| **Lane** | Frontend |
| **Scope** | Implement Cesium globe rendering for Weather layer |
| **Allowed Files** | `apps/web/src/layers/layer_07_weather/`, `apps/web/src/App.tsx`, `apps/web/src/CesiumGlobe.tsx`, `apps/web/src/components/LayerPanel.tsx`, `apps/web/src/components/DetailPanel.tsx` |
| **Disallowed Files** | Fetcher code, database migrations, API routes |
| **Dependencies** | WO-WEATHER-A complete (needs API endpoints) |
| **Validation** | Markers render, click card works, stats display, 60 FPS maintained |
| **Output** | Frontend components, hooks, tests |

### Detailed Scope

**May:**
- Create weatherApi.ts (API client)
- Create useWeather.ts (React hook for polling)
- Create weatherMarker.ts (temperature color, canvas generation)
- Create WeatherLayer.tsx (Cesium BillboardCollection)
- Integrate into App.tsx, CesiumGlobe.tsx, LayerPanel.tsx, DetailPanel.tsx
- Implement temperature color mapping
- Implement click detail card
- Implement stale data visual behavior
- Implement layer panel stats
- Write unit tests

**Must Not:**
- Write fetcher code
- Write database migrations
- Write API routes
- Connect directly to database

### Rendering Summary

| Component | Purpose |
|-----------|---------|
| WeatherMarker | Temperature-colored circle (canvas) |
| WeatherLayer | BillboardCollection on Cesium globe |
| DetailCard | Weather detail card on click |
| LayerPanel | Stats, toggle, filters |

---

## WO-WEATHER-V: Full Layer Validation

| Attribute | Value |
|-----------|-------|
| **Role** | Reviewer |
| **Lane** | Review |
| **Scope** | Full integration review of Weather layer |
| **Allowed Files** | All weather layer files |
| **Disallowed Files** | None (review only) |
| **Dependencies** | WO-WEATHER-U complete |
| **Validation** | Full pipeline works end-to-end |
| **Output** | Integration review report |

### Validation Checklist

**Data Pipeline:**
- [ ] Open-Meteo API fetches real data
- [ ] Raw responses saved correctly
- [ ] Normalization produces correct output
- [ ] Database tables populated
- [ ] API returns correct data

**API:**
- [ ] All 3 endpoints respond correctly
- [ ] Filters work (bbox, temperature, weather_code)
- [ ] Error handling correct
- [ ] No secrets exposed

**Frontend:**
- [ ] Weather markers render on globe
- [ ] Temperature color coding correct
- [ ] Click detail card shows all fields
- [ ] Stale data visual behavior correct
- [ ] 60 FPS maintained
- [ ] No console errors

**Rules:**
- [ ] No API keys committed
- [ ] No fake data used
- [ ] Raw data saved before normalization
- [ ] All work within allowed folders

---

## Dependency Graph

```
WO-WEATHER-P
    ↓
WO-WEATHER-R
    ↓
WO-WEATHER-S
    ↓
WO-WEATHER-F
    ↓
WO-WEATHER-N
    ↓
WO-WEATHER-D
    ↓
WO-WEATHER-A
    ↓
WO-WEATHER-U
    ↓
WO-WEATHER-V
```

---

## Estimated Effort

| Work Order | Estimated Effort |
|------------|-----------------|
| WO-WEATHER-P | Complete (this spec kit) |
| WO-WEATHER-R | 1-2 hours |
| WO-WEATHER-S | 1-2 hours |
| WO-WEATHER-F | 3-4 hours |
| WO-WEATHER-N | 2-3 hours |
| WO-WEATHER-D | 2-3 hours |
| WO-WEATHER-A | 3-4 hours |
| WO-WEATHER-U | 4-6 hours |
| WO-WEATHER-V | 2-3 hours |
| **Total** | **~18-27 hours** |

---

## Notes

1. All worker agents may create local commits only (per Git workflow policy)
2. Worker agents must NOT push to remote
3. Kiro CLI owns all pushes to remote after review
4. Each work order must update `docs/state/HANDOFF_LOG.md`
5. Raw data must never be committed to git
6. API keys must never be printed or stored
7. No live data fetching until WO-WEATHER-S
8. No fake data at any stage
