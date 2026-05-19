# Work Order: WO-043

**Assigned to:** MiniMax
**Layer:** layer_01_aviation
**Created:** 2026-05-20
**Status:** complete

## Objective

Create an MVP airport intelligence ingest worker that fills the new airport intelligence database tables with real source-backed data.

## Layer Context

- Layer ID: layer_01_aviation
- Relevant spec: specs/002-layer-one-aviation/spec.md

## Inputs

- Existing airport_public_profile_db.py patterns
- Existing wikimedia_wikidata_fetcher.py for Wikipedia/Wikidata fetching
- Existing airport_public_profile_worker.py for worker patterns
- Database schema from database/migrations/layer_01_aviation/006-009

## Outputs

1. `services/fetch-orchestrator/src/layers/layer_01_aviation/airport_intelligence_ingest_db.py` - Database operations
2. `services/normalizer/src/layers/layer_01_aviation/airport_intelligence_normalizer.py` - Normalization logic
3. `services/fetch-orchestrator/src/layers/layer_01_aviation/airport_intelligence_ingest_worker.py` - Main worker
4. `tests/data/layer_01_aviation/test_airport_intelligence_ingest_worker.py` - Tests
5. `docs/work-orders/WO-043-airport-intelligence-ingest-mvp.md` - This document

## Acceptance Criteria

1. Worker resolves airport from aviation_airports by airport_id
2. Worker loads existing public profile if available
3. Worker fetches Wikipedia summary/profile
4. Worker fetches Wikidata only if QID is available and throttle is respected
5. Worker continues safely if Wikipedia or Wikidata fails
6. Source links stored for OurAirports, Wikipedia, Wikidata if fetched
7. airport_intelligence_modules rows stored for overview, capability, sources, advanced_details
8. airport_derived_intelligence stored with safe derived fields
9. airport_capacity_profiles only stored if source-backed capacity exists
10. airport_traffic_metrics only stored if source-backed traffic exists with year and source
11. Opened date extracted from Wikidata P571 as structured fields
12. Map Popup payload prepared in overview module
13. Infrastructure summary from runway data only (no OSM geometry)
14. Dry-run default with --persist required for DB writes
15. All tests pass

## Constraints

- Must follow rules in AGENTS.md
- Must not modify files outside ownership
- Must use layer-aware folder structure from LAYER_ID_CONVENTIONS.md
- Must update HANDOFF_LOG.md when done with model and time metadata
- Do not touch apps/web/, apps/api/, database/migrations/, packages/, infra/

## Data Quality Rules

- Never guess passenger capacity
- Never guess passenger traffic
- Never store traffic without year and source
- Never mark capacity_status = ok without source backing
- Never mark traffic_status = ok without source backing
- If opened date is missing, store null
- If Wikidata is unavailable, continue with Wikipedia/local DB
- If Wikipedia is unavailable, continue with local DB only
- If source confidence is low, mark low_confidence instead of ok

## Sources Used

1. Local aviation_airports / runway / frequency / navaid data
2. Existing airport_public_profiles cache
3. Wikipedia REST
4. Wikidata with throttle/background behavior

## Sources Not Used Yet

- OSM layout persistence
- BTS traffic ingest
- Eurostat traffic ingest
- Official website deep scraping
- Annual report PDF parsing
- AviationWeather live weather persistence

## Implementation Details

### Module Keys Written

- overview: map_popup payload, Wikipedia/Wikidata metadata
- capability: runway data, capability tags
- infrastructure: runway count, longest runway, surfaces
- sources: list of sources used/skipped
- advanced_details: opened date extraction, QID references

### Derived Intelligence

- capability_tags from runway data and service info
- runway_capability from runway length
- runway_count and longest_runway_ft

### Capacity Profiles

- Not written in MVP unless source-backed capacity exists
- capacity_status = no_data when no source

### Traffic Metrics

- Not written in MVP unless source-backed traffic with year exists
- traffic_status = no_data when no source

## Commands

### Dry run:
```bash
python services/fetch-orchestrator/src/layers/layer_01_aviation/airport_intelligence_ingest_worker.py --airport-id 5209e070-54e7-45af-a2ef-afa20905085c --dry-run --show-raw
```

### Persist:
```bash
python services/fetch-orchestrator/src/layers/layer_01_aviation/airport_intelligence_ingest_worker.py --airport-id 5209e070-54e7-45af-a2ef-afa20905085c --database-url "postgresql://god_eyes:god_eyes_dev_password@localhost:5432/god_eyes_dev" --persist --show-raw
```

## Dependencies

- WO-036: airport_intelligence_foundation table exists
- WO-037: airport_capacity_profiles table exists
- WO-038: airport_traffic_metrics table exists
- WO-039: airport_derived_intelligence table exists
- WO-040: Source probe completed, sources confirmed working

## Handoff Notes

Worker implemented following existing public profile worker patterns. All data quality rules enforced. Tests cover all key requirements.