# WO-062 GOD EYES MVP Layer Architecture Plan

**Work Order:** WO-062-GOD-EYES-MVP-LAYER-ARCHITECTURE-PLAN  
**Author:** Kiro CLI (Claude Sonnet 4.6)  
**Date:** 2026-05-25  
**Branch:** main  
**Type:** Architecture plan only — no code changes, no file modifications

---

## 1. Executive Summary

GOD EYES has a clean, proven layer pattern established by layer_01_aviation. Every component — database migrations, fetch workers, normalizers, API routes, frontend panels, contracts, schemas, source catalog, and tests — lives under a `layer_XX_name` folder convention. This pattern is the foundation for all future layers.

The MVP strategy is:

1. **Preserve and complete aviation.** Backfill all 85k airports with public profile, image gallery, and layout data. This is the highest-value immediate action.
2. **Scaffold new layers as functional skeletons.** Each new layer gets its folder structure, a placeholder in the API layer registry, and a placeholder in the frontend LayerPanel. No data pipeline is required to scaffold a layer.
3. **Implement data pipelines in priority order.** Borders first (static, free, high visual impact), then earth events (earthquakes/volcanoes, free APIs), then maritime (AIS open data), then space/satellites (TLE data), then news/OSINT (RSS/public feeds), then infrastructure (OpenStreetMap extracts), then user shapes (local only, no external source).
4. **Never fetch live data on click.** All data must be pre-fetched, stored in the database, and served from the API. Live polling is a post-MVP concern.
5. **Military/security layer uses only declassified public data.** No sensitive sources, no scraping, no fake geometry.

The result is a platform where all layers are visible in the UI from day one, empty layers show a clear "coming soon" state, and data is added layer by layer without breaking anything.

---

## 2. Recommended Layer List

| Layer ID | Layer Name | Data Type | Static/Live | MVP Status | Later Expansion |
|---|---|---|---|---|---|
| `layer_00_globe_core` | Globe Core | UI only | N/A | ✅ Complete | Timeline controls, terrain toggle |
| `layer_01_aviation` | Aviation | Static + enriched | Static (backfill) | ✅ Complete — backfill needed | Live ADS-B tracking, flight routes |
| `layer_02_borders` | Borders & Admin | Static GeoJSON | Static | 🔨 Implement now | Disputed territories toggle |
| `layer_03_earth_events` | Earth Events | Near-real-time | Live (polled) | 🔨 Implement now | Tsunami alerts, volcanic ash |
| `layer_04_military_security` | Military & Security | Static public | Static | 🏗 Skeleton only | Declassified base locations |
| `layer_05_space_satellites` | Space & Satellites | Near-real-time | Live (polled) | 🔨 Implement now | Debris tracking, launch events |
| `layer_06_maritime` | Maritime | Near-real-time | Live (polled) | 🔨 Implement now | Port data, vessel details |
| `layer_07_infrastructure` | Infrastructure | Static OSM | Static | 🏗 Skeleton only | Power grids, pipelines |
| `layer_08_news_osint` | News & OSINT | Near-real-time | Live (polled) | 🏗 Skeleton only | Geolocated news events |
| `layer_09_user_shapes` | User Shapes | User-generated | Local | 🏗 Skeleton only | Sharing, export |

**Legend:**
- ✅ Complete — exists and works
- 🔨 Implement now — data pipeline + DB tables needed in MVP
- 🏗 Skeleton only — folder structure + UI placeholder, no data pipeline yet

---

## 3. Folder Structure Plan

The pattern established by layer_01_aviation must be replicated exactly for every new layer. No exceptions.

### Database

```
database/migrations/
  core/
    001_core_ingestion_tables.sql          ← exists, reuse
  layers/
    layer_01_aviation/                     ← exists, complete
    layer_02_borders/
      001_borders_reference_tables.sql     ← create
    layer_03_earth_events/
      001_earth_events_tables.sql          ← create
    layer_04_military_security/            ← folder only, no migrations yet
    layer_05_space_satellites/
      001_satellites_tables.sql            ← create
    layer_06_maritime/
      001_maritime_tables.sql              ← create
    layer_07_infrastructure/               ← folder only, no migrations yet
    layer_08_news_osint/                   ← folder only, no migrations yet
    layer_09_user_shapes/                  ← folder only, no migrations yet
```

### Fetch Orchestrator

```
services/fetch-orchestrator/src/layers/
  layer_01_aviation/                       ← exists, complete
  layer_02_borders/
    natural_earth_collector.py             ← create
    borders_normalizer_db.py               ← create
  layer_03_earth_events/
    usgs_earthquake_worker.py              ← create
    gdacs_events_worker.py                 ← create
  layer_04_military_security/              ← folder + __init__.py only
  layer_05_space_satellites/
    celestrak_tle_worker.py                ← create
  layer_06_maritime/
    aisstream_worker.py                    ← create
  layer_07_infrastructure/                 ← folder + __init__.py only
  layer_08_news_osint/                     ← folder + __init__.py only
  layer_09_user_shapes/                    ← folder + __init__.py only
```

### Normalizer

```
services/normalizer/src/layers/
  layer_01_aviation/                       ← exists, complete
  layer_02_borders/
    natural_earth_normalizer.py            ← create
  layer_03_earth_events/
    usgs_earthquake_normalizer.py          ← create
    gdacs_events_normalizer.py             ← create
  layer_04_military_security/              ← folder + __init__.py only
  layer_05_space_satellites/
    tle_normalizer.py                      ← create
  layer_06_maritime/
    ais_normalizer.py                      ← create
  layer_07_infrastructure/                 ← folder + __init__.py only
  layer_08_news_osint/                     ← folder + __init__.py only
  layer_09_user_shapes/                    ← folder + __init__.py only
```

### API

```
apps/api/src/routes/
  layers.ts                                ← exists, extend layer registry
  objects/                                 ← exists, generic, reuse as-is
  public-profile/                          ← exists, aviation-specific
  airport-intelligence/                    ← exists, aviation-specific
  airport-layout-features/                 ← exists, aviation-specific
  borders/
    index.ts                               ← create (country/region polygons)
  earth-events/
    index.ts                               ← create (earthquakes, alerts)
  satellites/
    index.ts                               ← create (TLE objects, passes)
  maritime/
    index.ts                               ← create (vessels, ports)
```

### Frontend

```
apps/web/src/
  components/
    LayerPanel.tsx                         ← extend with all 10 layers
    intel/                                 ← exists, aviation-specific
    layers/
      layer_02_borders/
        BordersLayerRenderer.tsx           ← create
      layer_03_earth_events/
        EarthEventsLayerRenderer.tsx       ← create
        EarthEventDetailPanel.tsx          ← create
      layer_04_military_security/
        MilitaryLayerPlaceholder.tsx       ← create (skeleton)
      layer_05_space_satellites/
        SatellitesLayerRenderer.tsx        ← create
        SatelliteDetailPanel.tsx           ← create
      layer_06_maritime/
        MaritimeLayerRenderer.tsx          ← create
        VesselDetailPanel.tsx              ← create
      layer_07_infrastructure/
        InfrastructureLayerPlaceholder.tsx ← create (skeleton)
      layer_08_news_osint/
        NewsLayerPlaceholder.tsx           ← create (skeleton)
      layer_09_user_shapes/
        UserShapesLayerPlaceholder.tsx     ← create (skeleton)
  lib/
    aviationTileLoader.ts                  ← exists, reuse
    aviationLayerRenderer.ts               ← exists, reuse
    layers/
      layer_02_borders/
        bordersLoader.ts                   ← create
      layer_03_earth_events/
        earthEventsLoader.ts               ← create
      layer_05_space_satellites/
        satellitesLoader.ts                ← create
      layer_06_maritime/
        maritimeLoader.ts                  ← create
```

### Tests

```
tests/data/
  layer_01_aviation/                       ← exists, complete
  layer_02_borders/
    test_natural_earth_collector.py        ← create
    test_borders_migration.py              ← create
  layer_03_earth_events/
    test_usgs_earthquake_worker.py         ← create
    test_earth_events_migration.py         ← create
  layer_05_space_satellites/
    test_celestrak_tle_worker.py           ← create
    test_satellites_migration.py           ← create
  layer_06_maritime/
    test_aisstream_worker.py               ← create
    test_maritime_migration.py             ← create
```

### Docs

```
docs/
  control/
    LAYER_ARCHITECTURE.md                  ← update layer registry to new 10-layer list
  data/
    layer_01_aviation/                     ← exists
    layer_02_borders/
      BORDERS_DATA_REFERENCE.md           ← create
    layer_03_earth_events/
      EARTH_EVENTS_DATA_REFERENCE.md      ← create
    layer_05_space_satellites/
      SATELLITES_DATA_REFERENCE.md        ← create
    layer_06_maritime/
      MARITIME_DATA_REFERENCE.md          ← create
  work-orders/
    WO-063 through WO-07X                  ← create per section 10
```

### Packages

```
packages/
  contracts/src/index.ts                   ← extend with new layer schemas
  schemas/layers/
    layer_01_aviation/                     ← exists
    layer_02_borders/
      natural_earth.py                     ← create
    layer_03_earth_events/
      usgs_earthquake.py                   ← create
    layer_05_space_satellites/
      tle_object.py                        ← create
    layer_06_maritime/
      ais_vessel.py                        ← create
  source-catalog/layers/
    layer_01_aviation/                     ← exists
    layer_02_borders/
      natural_earth.json                   ← create
    layer_03_earth_events/
      usgs_earthquake.json                 ← create
      gdacs.json                           ← create
    layer_05_space_satellites/
      celestrak.json                       ← create
    layer_06_maritime/
      aisstream.json                       ← create
```

---

## 4. Database Plan

### Create Now

These tables are needed for the layers being implemented in MVP.

**layer_02_borders:**
- `borders_countries` — country polygons (ISO code, name, geometry MULTIPOLYGON)
- `borders_regions` — admin-1 region polygons (ISO region code, name, geometry)
- `borders_disputed` — disputed territory polygons (name, claimants, geometry)

**layer_03_earth_events:**
- `earth_events` — unified event table (event_type, magnitude, depth, location, geometry POINT, source_id, occurred_at, fetched_at, raw_object_id)
- `earth_event_types` — lookup: earthquake, volcano, tsunami, wildfire, flood

**layer_05_space_satellites:**
- `satellites` — TLE objects (norad_id, name, tle_line1, tle_line2, object_type, country_code, launch_date, decay_date, fetched_at)
- `satellite_passes` — computed passes (satellite_id, location_lat, location_lon, aos_time, los_time) — later

**layer_06_maritime:**
- `maritime_vessels` — AIS vessel snapshot (mmsi, name, vessel_type, flag, lat, lon, speed, heading, status, fetched_at, geometry POINT)
- `maritime_ports` — static port data (name, country, lat, lon, geometry POINT, un_locode)

### Later (post-MVP)

- `military_bases` — layer_04, static public data only
- `infrastructure_nodes` — layer_07, OSM extracts
- `news_events` — layer_08, geolocated articles
- `user_shapes` — layer_09, user-drawn polygons/lines/points

### Reuse Existing

- `fetch_runs` — core, already layer_id/source_id aware, no changes needed
- `raw_objects` — core, already layer_id/source_id aware, no changes needed
- All `aviation_*` tables — complete, no changes needed
- `airport_public_profile_cache` — complete, backfill needed
- `airport_intelligence_foundation` — complete, backfill needed
- `airport_image_assets` — complete, backfill needed
- `airport_layout_features` — complete, backfill needed

---

## 5. Fetching Plan

### layer_01_aviation — Backfill (Now)

| Worker | Status | Notes |
|---|---|---|
| `ourairports_collector.py` | ✅ Done | 85k airports in DB |
| `airport_public_profile_worker.py` | 🔨 Backfill needed | Run for all airports missing profile |
| `wikimedia_wikidata_fetcher.py` | 🔨 Backfill needed | Run for all airports missing wiki data |
| `airport_intelligence_ingest_worker.py` | 🔨 Backfill needed | Run for all airports missing intelligence |
| `airport_image_gallery_worker.py` | 🔨 Backfill needed | Run for all airports missing images |
| `airport_layout_features_worker.py` | 🔨 Backfill needed | Run for all airports missing layout |

### layer_02_borders (Now)

| Worker | Status | Source | Notes |
|---|---|---|---|
| `natural_earth_collector.py` | 🔨 Create | Natural Earth (free, CC) | Download country + admin-1 GeoJSON |

Natural Earth provides free, public domain vector data at 1:10m, 1:50m, and 1:110m scales. No API key required. Download once, store in DB.

### layer_03_earth_events (Now)

| Worker | Status | Source | Notes |
|---|---|---|---|
| `usgs_earthquake_worker.py` | 🔨 Create | USGS Earthquake Hazards API | Free, no key, GeoJSON feed |
| `gdacs_events_worker.py` | 🔨 Create | GDACS (UN) | Free RSS/GeoJSON, covers floods/cyclones/volcanoes |

Both sources provide public GeoJSON feeds. Poll every 15 minutes in production. For MVP, run on a schedule (cron) and store results.

### layer_04_military_security (Placeholder)

No fetching workers yet. Folder structure only. When implemented, use only:
- OpenStreetMap military=* features (public)
- Wikipedia lists of military bases (public)
- No commercial intelligence sources
- No classified data

### layer_05_space_satellites (Now)

| Worker | Status | Source | Notes |
|---|---|---|---|
| `celestrak_tle_worker.py` | 🔨 Create | CelesTrak (free) | TLE data for active satellites, debris, stations |

CelesTrak provides free TLE data updated daily. No API key required. Download full catalog, store in DB, recompute positions on demand or pre-compute for common locations.

### layer_06_maritime (Now)

| Worker | Status | Source | Notes |
|---|---|---|---|
| `aisstream_worker.py` | 🔨 Create | AISStream.io (free tier) | WebSocket AIS feed, free tier available |
| `maritime_ports_collector.py` | 🔨 Create | OpenStreetMap / UN LOCODE | Static port data, free |

AIS data is broadcast publicly by vessels. AISStream.io provides a free WebSocket API. For MVP, snapshot vessel positions every 5 minutes and store. Live streaming is post-MVP.

### layer_07_infrastructure (Placeholder)

No fetching workers yet. When implemented: OpenStreetMap Overpass API extracts for power lines, pipelines, data centers.

### layer_08_news_osint (Placeholder)

No fetching workers yet. When implemented: GDELT Project (free, public), ReliefWeb API (UN, free), public RSS feeds with geolocation.

### layer_09_user_shapes (Placeholder)

No external fetching. User-drawn shapes stored locally in browser or in DB per user session. No external source.

---

## 6. API Plan

### Recommendation: Both Generic + Layer-Specific

The existing architecture already makes the right call. Keep it.

**Generic layer-aware endpoints (reuse existing `routes/objects/`):**

These work for any layer that stores point objects in the standard `layer_id`/`source_id` pattern. No changes needed for new layers — they just work once data is in the DB.

```
GET /api/objects/points?layerId=layer_02_borders&...
GET /api/objects/clusters?layerId=layer_03_earth_events&...
GET /api/objects/density?layerId=layer_06_maritime&...
GET /api/objects/detail/:id?layerId=layer_05_space_satellites
GET /api/objects/preload?layerId=layer_01_aviation
```

**Layer-specific endpoints (create new routes per layer):**

For data that doesn't fit the generic point model (polygons, TLE orbits, vessel tracks, etc.), create layer-specific routes following the existing pattern.

```
# Borders
GET /api/borders/countries              → GeoJSON FeatureCollection of country polygons
GET /api/borders/countries/:isoCode     → single country polygon + metadata
GET /api/borders/regions?country=US     → admin-1 regions for a country

# Earth Events
GET /api/earth-events?type=earthquake&minMagnitude=4.0&since=24h
GET /api/earth-events/:id               → single event detail

# Satellites
GET /api/satellites?type=active&country=US
GET /api/satellites/:noradId            → TLE + computed position
GET /api/satellites/:noradId/passes?lat=&lon=&hours=24

# Maritime
GET /api/maritime/vessels?bbox=&type=cargo
GET /api/maritime/vessels/:mmsi         → vessel detail + track
GET /api/maritime/ports?country=SG

# Layer registry (extend existing)
GET /api/layers                         → extend to include all 10 layers
GET /api/layers/:layerId/status         → extend to handle all layer IDs
```

**Rule:** Layer-specific routes live in `apps/api/src/routes/<layer-name>/`. Generic object routes are never modified for layer-specific logic.

---

## 7. Frontend Plan

### LayerPanel

The `LayerPanel.tsx` component is currently hardcoded for L0 and L1. It must be refactored to support all 10 layers dynamically.

**Approach:**
- Define a `LAYER_REGISTRY` constant (or fetch from `/api/layers`) that lists all layers with their ID, name, status, and whether they have data.
- Each layer renders as a `layer-item` in the panel.
- Layers with `status: 'available'` and data show as active/toggleable.
- Layers with `status: 'not_configured'` (skeleton layers) show as `COMING SOON` — visible but not clickable.
- Layers with `status: 'unavailable'` (API offline) show as `OFFLINE`.

**Empty layer behavior:**
- Skeleton layers (L4, L7, L8, L9) render in the panel with a dimmed style and `COMING SOON` badge.
- They do not attempt to load data.
- They do not show filters or legends.
- Clicking them does nothing (cursor: default, no toggle).
- This gives the UI a complete, professional look from day one without requiring all data pipelines to be built.

**Layer-specific renderers:**
- Each layer that has data gets its own renderer component under `apps/web/src/components/layers/layer_XX_name/`.
- The `CesiumGlobe.tsx` component imports and mounts renderers conditionally based on which layers are active.
- Aviation renderer already exists (`aviationLayerRenderer.ts`). New layers follow the same pattern.

**Detail panels:**
- Each layer with clickable objects gets its own detail panel component.
- Aviation detail panel already exists (`components/intel/`). New layers get their own folder.

---

## 8. All-Airports Aviation Backfill Plan

### Problem

85,377 airports are in the database. Most are missing:
- Public profile cache (Wikipedia summary, Wikidata facts)
- Image gallery (Wikimedia Commons images)
- Intelligence foundation (ICAO, IATA, elevation, timezone, region enrichment)
- Layout features (OSM runway polygons)

### Strategy

Run each worker in batch mode against all airports that are missing the relevant data. Use the existing worker infrastructure — no new code patterns needed.

### Backfill Order

1. **Airport public profile** (`airport_public_profile_worker.py`) — Wikipedia + Wikidata. Highest value, most airports have Wikipedia pages.
2. **Airport intelligence** (`airport_intelligence_ingest_worker.py`) — Structured intelligence from Wikidata. Depends on public profile being present.
3. **Airport image gallery** (`airport_image_gallery_worker.py`) — Wikimedia Commons images. Rate-limited, run last.
4. **Airport layout features** (`airport_layout_features_worker.py`) — OSM runway polygons. Only meaningful for airports with ICAO codes.

### Batch Parameters

| Worker | Batch Size | Rate Limit | Estimated Total Time |
|---|---|---|---|
| Public profile | 50 airports/batch | 1 req/sec (Wikipedia API) | ~24h for 85k airports |
| Intelligence | 50 airports/batch | 1 req/sec (Wikidata API) | ~24h for airports with ICAO |
| Image gallery | 20 airports/batch | 0.5 req/sec (Wikimedia) | ~48h for airports with images |
| Layout features | 100 airports/batch | 2 req/sec (OSM Overpass) | ~12h for ICAO airports |

### Dry-Run / Persist Mode

All workers must support:
- `--dry-run` flag: fetch and validate data, do not write to DB, log what would be written
- `--persist` flag: write to DB (default off for safety)
- `--limit N` flag: process only N airports (for testing)
- `--resume` flag: skip airports that already have data (check by airport_id in target table)
- `--icao-only` flag: only process airports with a non-null ICAO code (for layout/intelligence)

### Prioritization

Not all 85k airports need full enrichment. Prioritize:
1. Airports with IATA codes (~10k) — these are commercial airports users care about most
2. Airports with ICAO codes (~45k) — these have structured data available
3. Remaining airports — heliports, seaplane bases, etc. — lower priority

### Monitoring

- Each backfill run creates a `fetch_runs` record with `layer_id=layer_01_aviation`
- Progress is visible via `GET /api/layers/layer_01_aviation/status`
- Failed airports are logged in `fetch_runs.error_message` and can be retried

---

## 9. Safety and Source Rules

### Public-Only Data

- All data sources must be publicly accessible without authentication or with a free-tier API key.
- No commercial intelligence databases (Jane's, Janes360, Maxar, Planet, etc.).
- No scraped data from sites that prohibit scraping in their ToS.
- No data that requires a government security clearance to access.

### Military / Security Layer

- Only use: OpenStreetMap `military=*` tags (public), Wikipedia lists of military installations (public), official government press releases (public).
- Never use: satellite imagery analysis to identify military assets, commercial OSINT databases, leaked documents, or any source that could expose sensitive operational information.
- All military base locations shown must be publicly acknowledged by the host government.
- Add a visible disclaimer in the UI: "Data sourced from public records only."

### Rate Limits

Every fetching worker must:
- Respect the source's published rate limits.
- Implement exponential backoff on 429/503 responses.
- Never make more than 1 request per second to any single API endpoint unless the API explicitly allows higher rates.
- Log all rate limit events to `fetch_runs.metadata`.

### No Scraping on Click

- The frontend never triggers a fetch to an external API.
- All data displayed in detail panels comes from the GOD EYES database via the GOD EYES API.
- The only exception is map tile providers (Cesium Ion, Bing Maps) which are standard map infrastructure.

### No Fake Geometry

- Never generate or interpolate coordinates that were not provided by the source.
- If a source provides a bounding box but not a centroid, compute the centroid mathematically — do not guess.
- If a source provides no geometry, the object is not displayed on the globe. It may appear in a list view only.
- Coordinate quality overrides (already implemented in `aviation_coordinate_quality_overrides`) are the correct pattern for fixing bad source data — document the override reason.

### Source Catalog

Every data source must have a JSON entry in `packages/source-catalog/layers/layer_XX_name/`. This entry must include: source_id, name, url, license, rate_limit, update_frequency, and data_type.

---

## 10. Implementation Work Orders

Work orders are listed in recommended execution order. Each is scoped to one agent and one area.

| WO | Owner | CLI | Folder | Scope | Validation |
|---|---|---|---|---|---|
| **WO-063** | Kiro CLI | Kiro CLI | `docs/control/` | Update `LAYER_ARCHITECTURE.md` and `AGENTS.md` to reflect new 10-layer registry | Docs updated, no broken references |
| **WO-064** | Codex | Codex CLI | `database/migrations/layers/layer_02_borders/` | Create migration 001 for borders tables (countries, regions, disputed) | Migration runs clean, tables exist |
| **WO-065** | Codex | Codex CLI | `services/fetch-orchestrator/src/layers/layer_02_borders/`, `services/normalizer/src/layers/layer_02_borders/`, `packages/source-catalog/layers/layer_02_borders/`, `packages/schemas/layers/layer_02_borders/` | Natural Earth collector + normalizer for country and admin-1 polygons | Data in DB, 250 countries present |
| **WO-066** | Claude Code CLI | Kiro CLI | `apps/api/src/routes/borders/`, `packages/contracts/src/index.ts` | Borders API routes + TypeScript contracts | `GET /api/borders/countries` returns GeoJSON |
| **WO-067** | Gemini CLI | Gemini CLI | `apps/web/src/components/layers/layer_02_borders/`, `apps/web/src/lib/layers/layer_02_borders/` | Borders layer renderer on globe (country outlines) | Country borders visible on globe |
| **WO-068** | Codex | Codex CLI | `database/migrations/layers/layer_03_earth_events/`, `services/fetch-orchestrator/src/layers/layer_03_earth_events/`, `services/normalizer/src/layers/layer_03_earth_events/` | Earth events tables + USGS earthquake worker + GDACS worker | Earthquakes in DB, last 30 days |
| **WO-069** | Claude Code CLI | Kiro CLI | `apps/api/src/routes/earth-events/`, `packages/contracts/src/index.ts` | Earth events API routes + contracts | `GET /api/earth-events` returns events |
| **WO-070** | Gemini CLI | Gemini CLI | `apps/web/src/components/layers/layer_03_earth_events/` | Earth events layer renderer + detail panel | Earthquake markers on globe |
| **WO-071** | Codex | Codex CLI | `database/migrations/layers/layer_05_space_satellites/`, `services/fetch-orchestrator/src/layers/layer_05_space_satellites/`, `services/normalizer/src/layers/layer_05_space_satellites/` | Satellites tables + CelesTrak TLE worker | TLE data in DB, ISS present |
| **WO-072** | Claude Code CLI | Kiro CLI | `apps/api/src/routes/satellites/`, `packages/contracts/src/index.ts` | Satellites API routes + contracts | `GET /api/satellites` returns objects |
| **WO-073** | Gemini CLI | Gemini CLI | `apps/web/src/components/layers/layer_05_space_satellites/` | Satellites layer renderer + detail panel | Satellite markers on globe |
| **WO-074** | Codex | Codex CLI | `database/migrations/layers/layer_06_maritime/`, `services/fetch-orchestrator/src/layers/layer_06_maritime/`, `services/normalizer/src/layers/layer_06_maritime/` | Maritime tables + AIS vessel worker + ports collector | Vessel snapshots in DB |
| **WO-075** | Claude Code CLI | Kiro CLI | `apps/api/src/routes/maritime/`, `packages/contracts/src/index.ts` | Maritime API routes + contracts | `GET /api/maritime/vessels` returns vessels |
| **WO-076** | Gemini CLI | Gemini CLI | `apps/web/src/components/layers/layer_06_maritime/` | Maritime layer renderer + vessel detail panel | Vessel markers on globe |
| **WO-077** | Gemini CLI | Gemini CLI | `apps/web/src/components/LayerPanel.tsx` | Refactor LayerPanel to support all 10 layers dynamically, skeleton layers show COMING SOON | All 10 layers visible in panel |
| **WO-078** | Claude Code CLI | Kiro CLI | `apps/api/src/routes/layers.ts` | Extend layer registry to all 10 layers | `GET /api/layers` returns all 10 |
| **WO-079** | Codex | Codex CLI | `services/fetch-orchestrator/src/layers/layer_01_aviation/` | Aviation backfill runner: public profile for all IATA airports | 10k IATA airports have profile |
| **WO-080** | Codex | Codex CLI | `services/fetch-orchestrator/src/layers/layer_01_aviation/` | Aviation backfill runner: intelligence + image gallery for IATA airports | 10k IATA airports have intelligence + images |
| **WO-081** | Codex | Codex CLI | `services/fetch-orchestrator/src/layers/layer_04_military_security/`, `services/fetch-orchestrator/src/layers/layer_07_infrastructure/`, `services/fetch-orchestrator/src/layers/layer_08_news_osint/`, `services/fetch-orchestrator/src/layers/layer_09_user_shapes/` | Create skeleton `__init__.py` files for placeholder layers | Folders exist, no workers yet |
| **WO-082** | Gemini CLI | Gemini CLI | `apps/web/src/components/layers/layer_04_military_security/`, `layer_07_infrastructure/`, `layer_08_news_osint/`, `layer_09_user_shapes/` | Create placeholder components for skeleton layers | Skeleton layers render in panel |

---

## 11. Risks

### Risk 1: Aviation backfill rate limits

**Risk:** Wikipedia and Wikimedia APIs will throttle aggressive backfill. 85k airports × multiple API calls = millions of requests.  
**Mitigation:** Prioritize IATA airports only (~10k). Use `--resume` mode so runs can be interrupted and restarted. Implement exponential backoff. Run during off-peak hours. Expect the full backfill to take days, not hours.

### Risk 2: LayerPanel refactor breaks aviation

**Risk:** Refactoring `LayerPanel.tsx` to support 10 layers could break the existing aviation filter/stats UI.  
**Mitigation:** WO-077 must be done after all data layers have their API routes (WO-078). Write the refactor as an additive change — keep all existing aviation props, add new layer props. Test aviation layer still works before merging.

### Risk 3: Borders GeoJSON polygon size

**Risk:** Country polygons at 1:10m scale are large. Loading all 250 countries as GeoJSON in one request will be slow.  
**Mitigation:** Use Natural Earth 1:110m scale for the globe overview. Only load 1:10m detail for the currently-viewed country. The API must support `?resolution=low|high` parameter.

### Risk 4: AIS data freshness

**Risk:** AIS vessel positions go stale quickly. A 5-minute-old position shown as "current" is misleading.  
**Mitigation:** Always display `fetched_at` timestamp on vessel detail panels. Add a visual indicator (color fade or badge) when data is older than 15 minutes. Never claim positions are real-time unless a live WebSocket feed is active.

### Risk 5: Military layer misuse

**Risk:** Even public military data can be politically sensitive or used to infer sensitive information.  
**Mitigation:** Implement the military layer last (post-MVP). Add a legal review step before any military data is displayed. Always show source attribution and "public records only" disclaimer. Do not show individual personnel, unit deployments, or operational schedules.

### Risk 6: Layer registry hardcoding

**Risk:** `layers.ts` and `LayerPanel.tsx` are currently hardcoded. Adding 8 more layers by copy-paste will create maintenance debt.  
**Mitigation:** WO-077 and WO-078 must introduce a data-driven layer registry. The registry is the single source of truth. Both the API and frontend read from it.

### Risk 7: Satellite TLE position accuracy

**Risk:** TLE data is only accurate for a few days. Displaying stale TLE positions as "current" is wrong.  
**Mitigation:** Refresh TLE data daily from CelesTrak. Compute positions server-side using a propagator (sgp4 library). Display the computed time alongside the position. Mark positions as "predicted" not "live."

---

## 12. Final Recommendation

### What should we do first?

**WO-063 immediately:** Update `LAYER_ARCHITECTURE.md` and `AGENTS.md` to reflect the new 10-layer registry. This is a documentation-only change that takes 30 minutes and unblocks all subsequent work orders by giving every agent a clear, agreed-upon layer list.

**WO-064 + WO-065 next (Codex):** Borders layer database + data pipeline. Borders are static, free, require no API key, and have massive visual impact. A globe with country outlines looks like a real intelligence platform. This is the highest-value next data layer.

**WO-079 in parallel (Codex):** Start the aviation backfill for IATA airports. This runs as a background job and doesn't block frontend work. The longer it runs, the more data is available.

### Which CLI/model should do it?

- **WO-063:** Kiro CLI — documentation update, orchestrator role
- **WO-064, WO-065, WO-068, WO-071, WO-074, WO-079, WO-080, WO-081:** Codex — data pipeline and database owner
- **WO-066, WO-069, WO-072, WO-075, WO-078:** Claude Code CLI — API and contracts owner
- **WO-067, WO-070, WO-073, WO-076, WO-077, WO-082:** Gemini CLI — frontend owner

### Should we create a worktree yet?

Not yet. WO-063 is a documentation update on main. Once WO-063 is merged and the layer registry is agreed upon, create a worktree per agent for parallel development:
- `worktree/codex-borders` for WO-064/065
- `worktree/claude-borders-api` for WO-066
- `worktree/gemini-borders-fe` for WO-067

### What is the exact next work order?

**WO-063:** Update `docs/control/LAYER_ARCHITECTURE.md` and `AGENTS.md` to reflect the 10-layer MVP registry defined in this report. Owner: Kiro CLI. No code changes. Estimated time: 30 minutes.

---

## Final Checklist

| Item | Status |
|---|---|
| Repository inspected | YES |
| Layer list proposed | YES |
| Folder plan included | YES |
| Database plan included | YES |
| Fetching plan included | YES |
| API plan included | YES |
| Frontend plan included | YES |
| All-airports backfill plan included | YES |
| Safety rules included | YES |
| Implementation sequence included | YES |
| Code changes made | **NO** |
| Ready for implementation | YES |


---

## 13. Revision — Product Owner Decisions (2026-05-25T06:02 UTC+5:30)

The following decisions from the project owner supersede conflicting guidance in sections 1–12.

### Decision 1: All layers visible in frontend today

All 10 layers must appear in `LayerPanel.tsx` immediately. Unimplemented layers show as **"No data yet"** or **"Coming soon"** — never hidden, never fake. This is the highest-priority frontend task.

**Impact on WO-077:** Move LayerPanel refactor to WO-063 (first work order). It is now a prerequisite, not a later step.

### Decision 2: Generic layer API only for MVP

Use only:
```
GET /api/layers
GET /api/layers/:layerId/objects
```

No layer-specific routes (`/api/borders/`, `/api/earth-events/`, etc.) in MVP. The generic `objects` endpoint must accept a `layerId` query param and return whatever objects exist for that layer. Specialized routes are post-MVP.

**Impact on API plan:** Sections 6 and WO-066/069/072/075 are revised. Claude Code CLI implements one generic `/api/layers/:layerId/objects` endpoint instead of per-layer routes.

**Revised endpoint contract:**
```
GET /api/layers                              → list all 10 layers with status
GET /api/layers/:layerId/objects             → paginated objects for a layer
  ?bbox=minLon,minLat,maxLon,maxLat          → spatial filter (optional)
  ?limit=100&offset=0                        → pagination
  ?type=<object_type>                        → filter by object type (optional)
```

Response shape (same for all layers):
```json
{
  "layerId": "layer_02_borders",
  "objects": [
    {
      "id": "uuid",
      "type": "country",
      "label": "France",
      "geometry": { "type": "Point"|"Polygon"|"...", "coordinates": [...] },
      "properties": { ... }
    }
  ],
  "pagination": { "limit": 100, "offset": 0, "returned": 42, "total": 250 }
}
```

### Decision 3: Military/security layer — scaffold only, public static data only

MVP status: **scaffold/coming soon**. No data pipeline, no migrations, no workers. The layer appears in the UI as "Coming soon." When implemented post-MVP, only public static data is allowed (OSM military=*, Wikipedia lists of acknowledged bases). No live tracking, no operational details, no private sources.

**No change to folder structure plan** — `layer_04_military_security/` folder stubs are still created.

### Decision 4: Aviation backfill — local database only

Do **not** run external enrichment (Wikipedia, Wikimedia, Wikidata, OSM Overpass) for all airports today.

The backfill for demo readiness uses only data already in the local database:
- `aviation_airports` — already populated (85k airports)
- `aviation_runways` — already populated
- `airport_layout_features` — already populated (OSM runway polygons for airports that have them)

This means the aviation layer is already demo-ready as-is. No backfill work order is needed for today's demo.

**WO-079 and WO-080 are deferred** to a future sprint after the demo.

### Decision 5: Today's demo goal — senior manager MVP demo readiness

The definition of done for today:

| Requirement | How |
|---|---|
| All 10 layers visible in layer panel | LayerPanel refactor (WO-063) |
| Layer folders separated cleanly | Folder stubs created (WO-064) |
| Database/API/frontend structure clean | Generic objects API (WO-065) |
| Aviation layer functional | Already done — no changes needed |
| Incomplete layers are honest placeholders | "No data yet" state in UI |
| No fake data | Skeleton layers return empty objects array from API |

### Decision 6: No AI in MVP

`layer_09_user_shapes` remains as planned (user-drawn shapes, no AI). No AI inference, no AI-generated reports, no pattern detection. Remove any AI-related references from layer descriptions in the UI.

---

### Revised Work Order Sequence for Today

The original WO-063 through WO-082 sequence is replaced by this focused demo-readiness sequence:

| WO | Owner | CLI | Scope | Done when |
|---|---|---|---|---|
| **WO-063** | Kiro CLI | Kiro CLI | Update `LAYER_ARCHITECTURE.md` + `AGENTS.md` to 10-layer registry | Docs reflect new layer list |
| **WO-064** | Codex | Codex CLI | Create folder stubs for all new layers in `database/migrations/layers/`, `services/fetch-orchestrator/src/layers/`, `services/normalizer/src/layers/`, `packages/schemas/layers/`, `packages/source-catalog/layers/`, `tests/data/` | All layer folders exist with `__init__.py` / `README.md` stubs |
| **WO-065** | Claude Code CLI | Kiro CLI | Extend `apps/api/src/routes/layers.ts` to register all 10 layers. Add `GET /api/layers/:layerId/objects` generic endpoint. Extend `packages/contracts/src/index.ts` with `LayerObjectsResponse` schema. | `GET /api/layers` returns 10 layers; `GET /api/layers/layer_01_aviation/objects` returns airports |
| **WO-066** | Gemini CLI | Gemini CLI | Refactor `LayerPanel.tsx` to show all 10 layers. Active layers show data. Unimplemented layers show "No data yet." No fake data. | All 10 layers visible in panel; aviation still works |

**Total: 4 work orders. Estimated: 1 day.**

After demo, resume the full implementation sequence (borders data pipeline, earth events, satellites, maritime) as originally planned in sections 4–10.
