# Earth Events Layer Implementation Plan

> **Layer ID:** `layer_03_earth_events`
> **Status:** Planning complete. Ready for implementation work orders.
> **Created:** 2026-05-25
> **Author:** Kiro CLI (WO-070)

---

## 1. Executive Summary

This document defines the full implementation plan for the Earth Events layer (`layer_03_earth_events`). Earth Events is the first live data layer after Aviation and will prove the project's ability to ingest, store, serve, and render real-time geophysical data from authoritative public sources.

The plan covers database schema, fetcher design, API endpoints, frontend rendering, safety constraints, and a step-by-step work order breakdown. No code is created by this plan — it exists solely to guide future implementation work orders.

---

## 2. Layer Identity

| Field | Value |
|-------|-------|
| Layer ID | `layer_03_earth_events` |
| Display Name | Earth Events |
| MVP Status | `coming_soon` (transitions to `active` after WO-075) |
| Type | `live` |
| Public Safety Classification | **Low risk** — all data is publicly reported natural phenomena from government agencies |
| Registry Reference | `docs/control/MVP_LAYER_REGISTRY.md` row 3 |

---

## 3. Recommended First Event Type: Earthquakes

### Why earthquakes first

| Factor | Earthquakes | Fires (FIRMS) | Storms/Weather |
|--------|-------------|---------------|----------------|
| API stability | USGS GeoJSON — stable for 10+ years | NASA FIRMS — stable but larger payloads | NOAA — multiple endpoints, complex formats |
| Geometry type | Point (lon, lat, depth) | Point (hotspot pixel) | Polygon/line (track cones) |
| Payload size | ~200–500 events/day globally | ~50,000+ hotspots/day | Variable, complex nested structures |
| Rendering complexity | Simple circle markers | Dense clusters requiring aggregation | Complex polygon/cone rendering |
| Update frequency | Every 5 minutes | Every 3 hours (NRT) | Irregular, event-driven |
| Idempotency | Easy — each event has stable `event_id` | Harder — pixel-level duplicates | Hard — advisories update in place |
| Demo value | High — universally understood | High but dense | High but complex |

**Decision:** Earthquakes are the safest first implementation because they have simple point geometry, small payload sizes, stable unique IDs, and a well-documented API with no rate limits. This minimizes risk while proving the full live pipeline.

---

## 4. Data Source Rules

1. **Public-only sources.** All data must come from government or institutional public domain feeds. No commercial APIs, no paid tiers, no API keys required for MVP.
2. **No scraping.** Only use documented, stable API endpoints or published data feeds.
3. **No sensitive/security data.** Earth Events contains only natural phenomena. No military, intelligence, or surveillance data.
4. **Store source metadata.** Every fetched record must retain `source_id`, `source_url`, `fetched_at`, and raw response hash for provenance.
5. **No frontend direct external calls.** The frontend must never call USGS or any external API directly. All data flows through our API.
6. **Attribution required.** API responses and frontend UI must credit the source (e.g., "Data: USGS Earthquake Hazards Program").

### Approved Sources (MVP)

| Source | Source ID | URL | Format | License |
|--------|-----------|-----|--------|---------|
| USGS Earthquake Hazards Program | `usgs_earthquakes` | `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson` | GeoJSON | Public Domain (US Gov) |

### Approved Sources (Post-MVP)

| Source | Source ID | URL | Format | License |
|--------|-----------|-----|--------|---------|
| NASA FIRMS | `nasa_firms` | `https://firms.modaps.eosdis.nasa.gov/api/...` | CSV/JSON | Public Domain (US Gov) |
| Smithsonian GVP | `smithsonian_gvp` | `https://volcano.si.edu/...` | KML/JSON | Public Domain |

---

## 5. Database Plan

### 5.1 Latest Snapshot Table: `earth_events_latest`

Holds the current state of all active events. Upserted on each fetch cycle.

```
earth_events_latest
├── id                  SERIAL PRIMARY KEY
├── layer_id            VARCHAR(50) NOT NULL DEFAULT 'layer_03_earth_events'
├── source_id           VARCHAR(50) NOT NULL
├── source_object_id    VARCHAR(100) NOT NULL        -- e.g., USGS event ID "us7000abcd"
├── event_type          VARCHAR(50) NOT NULL         -- 'earthquake', 'volcano', 'fire'
├── magnitude           DECIMAL(4,2)
├── magnitude_type      VARCHAR(20)                  -- 'ml', 'mb', 'mw', etc.
├── depth_km            DECIMAL(7,2)
├── place               VARCHAR(500)
├── alert_level         VARCHAR(20)                  -- 'green', 'yellow', 'orange', 'red'
├── significance        INTEGER
├── tsunami             BOOLEAN DEFAULT FALSE
├── geometry            GEOMETRY(Point, 4326) NOT NULL
├── source_url          VARCHAR(500)
├── observed_at         TIMESTAMPTZ NOT NULL         -- when the event occurred
├── updated_at          TIMESTAMPTZ NOT NULL         -- when the source last updated this event
├── fetched_at          TIMESTAMPTZ NOT NULL         -- when we fetched it
├── properties_json     JSONB                        -- overflow fields from source
├── UNIQUE(source_id, source_object_id)
```

### 5.2 History Table: `earth_events_history`

Append-only log of all state changes. Written whenever an upsert detects a change in `updated_at`.

```
earth_events_history
├── id                  SERIAL PRIMARY KEY
├── layer_id            VARCHAR(50) NOT NULL
├── source_id           VARCHAR(50) NOT NULL
├── source_object_id    VARCHAR(100) NOT NULL
├── event_type          VARCHAR(50) NOT NULL
├── magnitude           DECIMAL(4,2)
├── depth_km            DECIMAL(7,2)
├── place               VARCHAR(500)
├── alert_level         VARCHAR(20)
├── geometry            GEOMETRY(Point, 4326) NOT NULL
├── source_url          VARCHAR(500)
├── observed_at         TIMESTAMPTZ NOT NULL
├── updated_at          TIMESTAMPTZ NOT NULL
├── fetched_at          TIMESTAMPTZ NOT NULL
├── properties_json     JSONB
├── created_at          TIMESTAMPTZ DEFAULT NOW()
```

### 5.3 Indexes

| Table | Index | Type | Purpose |
|-------|-------|------|---------|
| `earth_events_latest` | `geometry` | GiST | Spatial bbox queries |
| `earth_events_latest` | `observed_at` | B-tree | Time range queries |
| `earth_events_latest` | `event_type` | B-tree | Type filtering |
| `earth_events_latest` | `(source_id, source_object_id)` | UNIQUE | Upsert target |
| `earth_events_history` | `(source_id, source_object_id, updated_at)` | B-tree | Change lookup |
| `earth_events_history` | `created_at` | B-tree | Retention/cleanup |

### 5.4 PostGIS Requirements

- Extension: `postgis` (already available in project Docker setup)
- SRID: 4326 (WGS84) — matches USGS GeoJSON output
- Point format: `ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)`
- Bbox query: `ST_Intersects(geometry, ST_MakeEnvelope(minLon, minLat, maxLon, maxLat, 4326))`

---

## 6. Fetching Plan

### 6.1 Scheduled Fetcher

| Setting | Value |
|---------|-------|
| Schedule | Every 5 minutes |
| Source | USGS `all_day.geojson` (past 24h, all magnitudes) |
| Owner | Codex (services/fetch-orchestrator) |
| Path | `services/fetch-orchestrator/src/layers/layer_03_earth_events/` |

### 6.2 Fetch Lifecycle

1. **Fetch** — HTTP GET to USGS endpoint. Store raw GeoJSON response.
2. **Validate** — Confirm response is valid GeoJSON FeatureCollection with expected fields.
3. **Normalize** — Extract fields into internal schema. Map USGS fields to `earth_events_latest` columns.
4. **Upsert** — Insert or update `earth_events_latest` using `(source_id, source_object_id)` as conflict key.
5. **History** — If `updated_at` changed, append row to `earth_events_history`.
6. **Log** — Record fetch run in `fetch_runs` table with status, count, errors.

### 6.3 Dry-Run Mode

The fetcher must support a `--dry-run` flag that:
- Fetches and validates data
- Logs what would be written (record count, sample IDs)
- Does NOT write to database
- Does NOT update `fetch_runs` status to "completed"

Dry-run mode must be used for initial testing before enabling persist mode.

### 6.4 Idempotent Upsert

```sql
INSERT INTO earth_events_latest (source_id, source_object_id, ...)
VALUES ($1, $2, ...)
ON CONFLICT (source_id, source_object_id)
DO UPDATE SET
  magnitude = EXCLUDED.magnitude,
  updated_at = EXCLUDED.updated_at,
  fetched_at = EXCLUDED.fetched_at,
  ...
WHERE earth_events_latest.updated_at < EXCLUDED.updated_at;
```

Only update if the source has a newer `updated_at`. This prevents stale data from overwriting fresh data during concurrent fetches.

### 6.5 Source Failure Handling

| Failure | Response |
|---------|----------|
| HTTP timeout (>10s) | Retry once after 30s. Log warning. |
| HTTP 4xx | Log error. Do not retry. Alert if persists 3 cycles. |
| HTTP 5xx | Retry once after 60s. Log warning. |
| Invalid JSON | Log error. Skip cycle. Do not corrupt DB. |
| Empty response | Log warning. Keep existing data. Do not truncate table. |
| Partial response (fewer features than expected) | Accept if valid. Log count delta. |

**Critical rule:** Never truncate or delete existing data on fetch failure. The latest table always retains the last known good state.

---

## 7. API Plan

### 7.1 Endpoint

```
GET /api/earth-events/latest
```

### 7.2 Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `bbox` | string | none | `minLon,minLat,maxLon,maxLat` — bounding box filter |
| `limit` | integer | 200 | Max events returned (cap: 1000) |
| `event_type` | string | none | Filter by type: `earthquake`, `volcano`, `fire` |
| `min_magnitude` | number | none | Minimum magnitude filter |
| `since` | ISO 8601 | none | Only events observed after this time |

### 7.3 Response Format

```json
{
  "layer_id": "layer_03_earth_events",
  "source": "usgs_earthquakes",
  "count": 47,
  "limit": 200,
  "bbox_applied": true,
  "events": [
    {
      "id": "us7000abcd",
      "event_type": "earthquake",
      "magnitude": 4.5,
      "magnitude_type": "mw",
      "depth_km": 10.2,
      "place": "15 km NE of Ridgecrest, California",
      "alert_level": "green",
      "tsunami": false,
      "coordinates": [-117.65, 35.77],
      "observed_at": "2026-05-25T06:30:00Z",
      "updated_at": "2026-05-25T06:35:00Z",
      "source_url": "https://earthquake.usgs.gov/earthquakes/eventpage/us7000abcd"
    }
  ],
  "attribution": "USGS Earthquake Hazards Program"
}
```

### 7.4 Rules

1. **No huge payloads.** Hard cap at 1000 events per response. Default 200.
2. **Bbox strongly recommended.** If no bbox provided, return global events sorted by `observed_at` DESC with default limit.
3. **Honest empty state.** If no events match filters, return `{"events": [], "count": 0}` — never fake data.
4. **Cache header.** `Cache-Control: public, max-age=60` — clients can cache for 60s.
5. **No PII.** Response contains only public geophysical data.

---

## 8. Frontend Plan

### 8.1 Map Markers

- Render circle markers at event coordinates
- Size proportional to magnitude (min 4px, max 24px)
- Color by alert level: green → yellow → orange → red
- Only render markers within the current visible bounding box
- Fetch data using current viewport bbox

### 8.2 Severity Styling

| Alert Level | Color | Opacity | Border |
|-------------|-------|---------|--------|
| green | `#4CAF50` | 0.8 | none |
| yellow | `#FFC107` | 0.85 | none |
| orange | `#FF9800` | 0.9 | 1px white |
| red | `#F44336` | 0.95 | 2px white |
| null/unknown | `#9E9E9E` | 0.7 | none |

### 8.3 Rules

1. **No render-loop fetches.** Fetch on viewport change (debounced 500ms), not on every frame.
2. **Bbox required on fetch.** Always pass current viewport bbox to API.
3. **Clustering/LOD deferred.** Earthquakes are sparse enough globally (~200–500/day) that clustering is not needed for MVP. Add later if density increases with fires/volcanoes.
4. **Panel empty state.** When layer is toggled on but no events exist in viewport, show: "No earth events in this area" — never show placeholder or fake markers.
5. **Detail on click.** Clicking a marker opens a detail panel showing magnitude, location, depth, time, and link to USGS page.

### 8.4 Layer Toggle Integration

- Earth Events appears in the layer panel as a toggleable layer
- When toggled off: remove all markers, stop fetching
- When toggled on: fetch for current viewport, render markers
- Layer status badge shows event count in viewport

---

## 9. Safety and Performance

### 9.1 60 FPS Rule

- Earth Events markers must not degrade globe performance below 60 FPS
- With 1000 markers visible, frame time must stay under 16ms
- If marker count exceeds 1000 in viewport, apply server-side limit (already capped at 1000)

### 9.2 Bbox Required or Strongly Recommended

- API accepts requests without bbox but applies default limit of 200
- Frontend always sends bbox with requests
- This prevents accidental full-table scans and oversized responses

### 9.3 Response Limits

| Limit | Value |
|-------|-------|
| Default response limit | 200 events |
| Maximum response limit | 1000 events |
| Maximum response size | ~500 KB |
| Cache TTL | 60 seconds |
| Fetch interval (server) | 5 minutes |

### 9.4 No Fake Event Markers

- If the layer has no data (fetcher not yet running, source down), show empty state
- Never generate synthetic/demo earthquake markers
- Never show historical events as if they are current

---

## 10. Step-by-Step Work Order Breakdown

### WO-071: Database Migration — Earth Events Tables

**Owner:** Codex
**Scope:** Create `earth_events_latest` and `earth_events_history` tables with indexes.

**Tasks:**
1. Create migration file in `database/migrations/layers/layer_03_earth_events/`
2. Create `earth_events_latest` table per schema in section 5.1
3. Create `earth_events_history` table per schema in section 5.2
4. Create all indexes per section 5.3
5. Verify PostGIS extension is available
6. Run migration in local Docker environment
7. Write rollback migration

**Acceptance Criteria:**
- [ ] Tables created with correct columns and types
- [ ] GiST index on geometry column works for bbox queries
- [ ] Unique constraint on `(source_id, source_object_id)` enforced
- [ ] Migration is idempotent (can run twice without error)
- [ ] Rollback drops tables cleanly

---

### WO-072: Fetcher and Backfill — USGS Earthquakes

**Owner:** Codex
**Scope:** Create scheduled fetcher for USGS earthquake data with dry-run mode.

**Tasks:**
1. Create source catalog entry: `packages/source-catalog/layers/layer_03_earth_events/usgs_earthquakes.json`
2. Create fetcher: `services/fetch-orchestrator/src/layers/layer_03_earth_events/usgs_earthquakes_collector.py`
3. Create validator: `packages/schemas/layers/layer_03_earth_events/usgs_earthquakes.py`
4. Create normalizer: `services/normalizer/src/layers/layer_03_earth_events/usgs_earthquakes_normalizer.py`
5. Implement dry-run mode (fetch + validate + log, no DB write)
6. Implement persist mode (upsert to latest, append to history)
7. Implement source failure handling per section 6.5
8. Write unit tests for normalizer
9. Write integration test for full fetch cycle

**Acceptance Criteria:**
- [ ] Dry-run mode fetches and validates without writing to DB
- [ ] Persist mode upserts correctly (no duplicates)
- [ ] History table receives rows only when `updated_at` changes
- [ ] Fetch failure does not corrupt or truncate existing data
- [ ] `fetch_runs` table records each run with status and count
- [ ] Unit tests pass for normalizer field mapping

---

### WO-073: API Endpoint — Earth Events Latest

**Owner:** Claude Code CLI
**Scope:** Create `GET /api/earth-events/latest` endpoint with query support.

**Tasks:**
1. Create route handler in `apps/api/src/routes/`
2. Implement bbox query parameter parsing and PostGIS query
3. Implement limit parameter with cap at 1000
4. Implement event_type filter
5. Implement min_magnitude filter
6. Implement since (time) filter
7. Return proper empty state when no events match
8. Add Cache-Control header
9. Add attribution field to response
10. Write API tests (unit + integration)

**Acceptance Criteria:**
- [ ] `GET /api/earth-events/latest` returns valid JSON per section 7.3
- [ ] Bbox filter correctly uses PostGIS `ST_Intersects`
- [ ] Limit defaults to 200, caps at 1000
- [ ] Empty state returns `{"events": [], "count": 0}`
- [ ] Response never exceeds 1000 events
- [ ] API tests pass for all filter combinations
- [ ] No direct external API calls from this endpoint

---

### WO-074: Frontend Map Layer — Earth Events Markers

**Owner:** Gemini CLI
**Scope:** Render earthquake markers on globe with severity styling.

**Tasks:**
1. Create layer component in `packages/layers/layer_03_earth_events/`
2. Fetch from `/api/earth-events/latest` with viewport bbox
3. Render circle markers with magnitude-based sizing
4. Apply alert-level color coding per section 8.2
5. Debounce viewport-change fetches (500ms)
6. Implement detail panel on marker click
7. Implement empty state when no events in viewport
8. Integrate with layer toggle system
9. Write frontend tests

**Acceptance Criteria:**
- [ ] Markers render at correct coordinates
- [ ] Marker size scales with magnitude
- [ ] Colors match alert level specification
- [ ] No fetch on every frame — only on debounced viewport change
- [ ] Detail panel shows magnitude, location, depth, time, source link
- [ ] Empty state displays correctly when no events
- [ ] Layer toggle removes/adds markers correctly
- [ ] 60 FPS maintained with 500+ markers visible

---

### WO-075: Final Integration and Review

**Owner:** Kiro CLI
**Scope:** End-to-end validation of the complete Earth Events pipeline.

**Tasks:**
1. Verify fetcher runs successfully in Docker environment
2. Verify data appears in `earth_events_latest` table
3. Verify API returns correct data for bbox queries
4. Verify frontend renders markers from API data
5. Verify layer toggle works correctly
6. Verify empty state when fetcher is stopped
7. Performance test: confirm 60 FPS with full earthquake dataset
8. Update `CURRENT_PROJECT_STATE.md` to mark layer as `active`
9. Update `MVP_LAYER_REGISTRY.md` status
10. Create integration review document

**Acceptance Criteria:**
- [ ] Full pipeline works: USGS → fetcher → DB → API → frontend
- [ ] No fake data at any stage
- [ ] 60 FPS maintained
- [ ] Layer panel shows correct status
- [ ] Empty state works when data is unavailable
- [ ] All previous WO acceptance criteria still pass

---

## 11. Acceptance Criteria Summary

| Work Order | Key Metric | Pass Condition |
|------------|-----------|----------------|
| WO-071 | Tables exist | Migration runs without error, indexes work |
| WO-072 | Data flows | Fetcher populates latest table with real USGS data |
| WO-073 | API serves | Endpoint returns filtered events within 200ms |
| WO-074 | Markers render | Globe shows earthquake markers at 60 FPS |
| WO-075 | End-to-end | Full pipeline works with no fake data |

---

## 12. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| USGS API goes down | Low | Medium | Fetcher retries gracefully; latest table retains last good data; frontend shows stale indicator |
| USGS changes response format | Very Low | High | Validator catches schema mismatch; fetcher logs error and skips cycle; no data corruption |
| Too many events overwhelm frontend | Low | Medium | API hard cap at 1000; bbox filtering reduces load; clustering added later if needed |
| PostGIS spatial queries slow | Low | Medium | GiST index on geometry; bbox queries are well-optimized in PostGIS |
| Earthquake data causes user alarm | Low | Low | Clear attribution to USGS; no alert sounds or push notifications; informational display only |
| Fetcher runs overlap | Low | Low | Idempotent upsert prevents duplicates; `WHERE updated_at < EXCLUDED.updated_at` prevents stale overwrites |

---

## 13. What Not to Build Yet

| Feature | Reason | When |
|---------|--------|------|
| Fire hotspots (NASA FIRMS) | Dense data requiring clustering; add after earthquakes prove pipeline | Post-MVP |
| Volcanic activity (Smithsonian GVP) | Lower update frequency; less demo value than earthquakes | Post-MVP |
| Weather alerts (NOAA) | Complex polygon geometry; multiple endpoints; format complexity | Future |
| Timeline scrubber | Requires history table queries and frontend time controls | Post-MVP |
| Push notifications | Not in scope; informational display only | Future |
| Earthquake prediction/forecasting | Not scientifically reliable; liability risk | Never |
| Alert sounds or haptics | Could cause alarm; not appropriate for informational tool | Never |
| Real-time WebSocket streaming | Polling every 60s from API is sufficient for MVP | Future |
| Clustering/LOD for markers | Earthquakes are sparse enough; add only if fires/volcanoes added | Post-MVP |
| Custom event severity thresholds | User preferences not in scope for MVP | Future |

---

## Document History

| Date | Author | Change |
|------|--------|--------|
| 2026-05-25 | Kiro CLI (WO-070) | Initial creation |
