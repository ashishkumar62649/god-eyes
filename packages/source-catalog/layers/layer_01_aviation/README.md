# Source Catalog: Layer 01 — Aviation

## Overview

This directory is the source-of-truth registry for every aviation data source
used by GOD EYES. Each file is a JSON record for a single source, owned by
the Fetcher Agent (per `docs/control/PROJECT_CONTROL.md` Part 2 §8), and is
the first place a future agent must look to understand which upstream
providers feed `layer_01_aviation`, where they are stored, and how they
flow through the system.

Active sources are registered individually (one JSON file per upstream
provider). Future / inactive sources are registered with an explicit
non-`active` status. Probe / scaffold sources that have no production code
are documented in the **Probe / scaffold / not implemented** section
below rather than being given JSON files, because the source-catalog
format has no `"status": "probe_only"` / `"not_implemented"` enum.

**Important wording:** the project uses **"current implementation"** or
**"current aviation build"** to refer to the in-tree aviation pipeline.
That wording is consistent with `docs/control/PROJECT_CONTROL.md` and is
the only phrasing used in this file. Older docs that use other
short-forms for the same concept are out of scope for this work order.

---

## Layer Identity

| Attribute | Value |
|-----------|-------|
| Layer ID | `layer_01_aviation` |
| Layer Name | Aviation |
| Registry status | `active` (live layer) |
| Type | `live` |
| Default UI | ON (when data present) |
| Folder convention | `apps/web/src/layers/layer_01_aviation/`, `services/fetch-orchestrator/src/layers/layer_01_aviation/`, `services/normalizer/src/layers/layer_01_aviation/`, `packages/source-catalog/layers/layer_01_aviation/`, `database/migrations/layers/layer_01_aviation/`, `database/ingestion/layers/layer_01_aviation/` |

---

## Active implemented sources

These sources have real code, real migrations, real API surface, and (where
applicable) real frontend consumers. They are registered in the
source-catalog with `"status": "active"`.

| `source_id` | Source name | Pipeline role | Target tables (primary) | Source-catalog file |
|-------------|-------------|---------------|-------------------------|---------------------|
| `ourairports` | OurAirports open aviation reference data | Static reference CSV snapshots → `aviation_airports` + runways / navaids / frequencies / countries / regions | `aviation_airports`, `aviation_runways`, `aviation_navaids`, `aviation_airport_frequencies`, `aviation_countries`, `aviation_regions` | [ourairports.json](./ourairports.json) |
| `airplanes_live_v2` | Airplanes.live REST API v2 | Live ADS-B + MLAT tracking via `/mil`, `/ladd`, `/pia`, `/point`; single-source WebSocket | `aviation_aircraft_sources`, `aviation_aircraft_latest`, `aviation_aircraft_observations`, `aviation_aircraft_raw_batches`, `aviation_aircraft_snapshots` | [airplanes_live_v2.json](./airplanes_live_v2.json) |
| `airplanes_live_global_web_json` | Airplanes.live globe web JSON snapshot | Experimental global snapshot via `https://globe.airplanes.live/data/aircraft.json.gz` (DB rows are still written under source_id=`airplanes_live_v2`; provenance via `fetch_params.sourceMode`) | Same tables as `airplanes_live_v2` | [airplanes_live_global_web_json.json](./airplanes_live_global_web_json.json) |
| `wikipedia_rest_airport_profiles` | English Wikipedia REST API — page summary | Airport public profile: summary, short description, thumbnail, wikipedia_url, wikibase_item (QID) | `airport_public_profiles`, `airport_public_profile_versions`, `airport_public_profile_fetch_runs`, `airport_source_links` (source_type='wikipedia') | [wikipedia_rest_airport_profiles.json](./wikipedia_rest_airport_profiles.json) |
| `wikidata_airport_profiles` | Wikidata Entity Data API — structured facts | Airport public profile: opened date, operator, owner, official website, main image, ICAO, IATA, coordinate location | Same as `wikipedia_rest_airport_profiles` + `airport_source_links` (source_type='wikidata') | [wikidata_airport_profiles.json](./wikidata_airport_profiles.json) |
| `wikimedia_commons_airport_images` | Wikimedia Commons + Wikipedia image API + Wikidata P18 + Commons category | Airport image gallery: per-airport image candidates, ranked, deduplicated, one hero | `airport_image_assets`, `airport_image_fetch_runs` (if present — see known_limitations) | [wikimedia_commons_airport_images.json](./wikimedia_commons_airport_images.json) |

### Bundled `airport_public_enrichment` pipeline source_id

Wikipedia, Wikidata, and (indirectly) Wikimedia Commons are persisted under
the bundled pipeline source_id `airport_public_enrichment` (defined in
`packages/schemas/layers/layer_01_aviation/airport_public_profile.py` as
`SOURCE_ID`). The DB also records the per-row `source_type` enum
(`wikipedia` / `wikidata` / `ourairports` / …) in `airport_source_links` so
provenance is preserved. The source-catalog entries above are keyed on the
upstream provider, not on the pipeline-level source_id; this is by design
so a future agent can see who actually publishes the data.

### Bundled airport intelligence and layout features sources

`airport_intelligence_*` (modules, source links, derived intelligence) and
`airport_layout_features` are *consumers* of the registered sources above,
not new upstream sources. The layout-features worker writes
`source_type='ourairports'` (runway data from `aviation_runways`); the
intelligence worker writes `source_type` values from the same
`airport_source_links` enum. They are deliberately not listed as their
own source-catalog entries.

---

## Future / inactive sources

These sources are registered in the source-catalog with an explicit
non-`active` status because the catalog format has a stable `"status"`
field, but they are **not currently fetching or persisting data**.

| `source_id` | Source name | Status | DB row | Source-catalog file |
|-------------|-------------|--------|--------|---------------------|
| `opensky_trino` | OpenSky Network Trino (historical) | `inactive_future_historical_backfill` | `aviation_aircraft_sources` row exists with `is_live=FALSE, is_historical=TRUE, is_active=FALSE, refresh_interval_s=86400` (see migration 012) — informational only, no fetcher | [opensky_trino.json](./opensky_trino.json) |

Per `docs/decisions/ADR-002-aviation-live-source.md`:

- OpenSky REST is too rate-limited for the 5-second live refresh cadence.
- OpenSky Trino access requires an application at
  `https://opensky-network.org/` and is restricted to university-affiliated
  researchers, governmental organisations, aviation authorities, or
  separately licensed private/commercial entities.
- Do not block the current build on OpenSky access. Implement when access
  is granted, through a dedicated work order.

---

## Probe / scaffold / not implemented sources

These providers are referenced in **probe** scripts and as `source_type`
enum values, but they have no live fetcher and no production data path. They
are documented here for inventory purposes; they must **not** be treated as
active sources.

| Provider | Where it appears today | What would be needed to activate | Action required to register |
|----------|-----------------------|----------------------------------|-----------------------------|
| **OpenStreetMap / Overpass** | Listed as a probed source in `airport_intelligence_source_probe.py` and `airport_source_endpoint_probe.py`; `airport_layout_features.source_type` enum includes `'openstreetmap'` (migration 011) | Real Overpass queries for OSM airport layout features; persistence path; normalizer | New work order, fetcher module, normalizer, possibly a contract in `packages/contracts/` |
| **BTS TranStats** | Probed only in `airport_intelligence_source_probe.py` and `airport_source_endpoint_probe.py`; the airport intelligence worker explicitly lists it as `Sources NOT used yet` | BTS data-access application; form-based query builder; schema for capacity / traffic metrics | New work order, fetcher module, normalizer, migration (capacity / traffic tables already exist) |
| **Eurostat** | Probed only in `airport_intelligence_source_probe.py` and `airport_source_endpoint_probe.py`; the airport intelligence worker explicitly lists it as `Sources NOT used yet` | Eurostat API integration (`avia_paoc` dataset); query format complexity; schema for capacity / traffic metrics | New work order, fetcher module, normalizer, migration (capacity / traffic tables already exist) |
| **AviationWeather / NOAA** | Probed only in `airport_source_endpoint_probe.py` (METAR / TAF / stationinfo) | Real AviationWeather fetcher; data model; no production consumer in the current build | New work order, fetcher module, normalizer, possibly a contract |
| **Official airport websites** | Listed in `airport_image_gallery_worker.py` as `Sources NOT used yet`; probed in `airport_source_endpoint_probe.py` | Per-airport scrape templates; JS-heavy sites would need a headless browser; legal/ToS review for each operator | New work order per operator; high-risk; legal review required |

### Why no JSON files for these

The source-catalog format used in this layer (see `ourairports.json`) does
not have a `"status": "probe_only"` or `"status": "not_implemented"` enum.
Per the work-order brief, these probe-only sources are therefore documented
in this human-readable inventory rather than in JSON, so future agents are
not misled into thinking the source is already active.

---

## Source lifecycle (canonical)

Every active aviation source moves through these stages in order. Source
contracts in `docs/control/PROJECT_CONTROL.md` Part 2 §9 must be filled
in by the user / decision-control layer before any code is written.

```
1. Source catalog          packages/source-catalog/layers/layer_01_aviation/<source>.json
   ↓
2. Collector / fetcher     services/fetch-orchestrator/src/layers/layer_01_aviation/
                           (single-source layers: flat file; multi-source layers
                            per spec 008: sources/<source_name>/{client,fetcher,normalizer,storage,worker,cli,types}.py)
   ↓
3. Raw storage             raw/layer_01_aviation/{source_id}/{yyyy}/{mm}/{dd}/{fetch_run_id}/payload.{ext}
                           (gitignored; per PROJECT_CONTROL.md §13 path pattern;
                            not all live streams use a raw blob — see individual source files)
   ↓
4. Normalizer              services/normalizer/src/layers/layer_01_aviation/ (canonical
                           aviation normalizer location per HEALTH-004; do not move)
   ↓
5. Database                database/migrations/layers/layer_01_aviation/ + database/ingestion/layers/layer_01_aviation/
                           (table names: <layer_domain>_<entity>_<role>, per PROJECT_CONTROL.md §9)
   ↓
6. API surface             apps/api/src/routes/aviation/, apps/api/src/routes/aviation/aircraft/,
                           apps/api/src/routes/public-profile/, apps/api/src/routes/airport-intelligence/,
                           apps/api/src/routes/airport-layout-features/, apps/api/src/routes/live-aircraft.ts
                           (all read from the DB; never from the upstream provider directly)
   ↓
7. Frontend                apps/web/src/layers/layer_01_aviation/{aircraft,airports}/
                           (consumes contracts from packages/contracts/; never imports
                            from services/ or database/; never calls external provider APIs)
```

### Layer-aware provenance

Every normalized record carries provenance. This is non-negotiable for
live aviation data:

- `layer_id` is always `layer_01_aviation`.
- `source_id` identifies the upstream provider (or the bundled pipeline
  source_id, see above).
- `source_object_id` / `entity_id` identifies the object within that
  provider.
- `fetched_at` / `observed_at` record when the upstream data was captured.

The Database Agent's per-table contracts must enforce these columns
(see the existing migrations: 001 / 005 / 006 / 010 / 011 / 012 / 013).

---

## Rules for adding a new aviation source

1. The user / decision-control layer fills out the full source contract
   table in `docs/control/PROJECT_CONTROL.md` Part 2 §9 for the new
   source. **No agent starts work on a source without a completed
   contract entry.**
2. Create a source-catalog JSON file in
   `packages/source-catalog/layers/layer_01_aviation/<source_id>.json`
   matching the format of `ourairports.json` (or the live-stream shape
   used by `airplanes_live_v2.json`).
3. Use `"status": "active"` only when collector, normalizer, database,
   API, and (where applicable) frontend are all live in the tree. If any
   of those is missing, use `"status": "inactive_future_historical_backfill"`
   for known-future sources, or list the source under
   **Probe / scaffold / not implemented sources** in this README.
4. Add the Fetcher / Normalizer / Database / API work order(s) in
   `docs/work-orders/`.
5. After the API is live, add the Frontend work order.
6. Update `docs/state/HANDOFF_LOG.md` and `docs/state/RECENT_CONTEXT.md`
   in the same commit.
7. Do not commit secrets. `.env.example` is the only place placeholders
   may appear.

### Pipeline ordering

A new source **must not** be wired into the frontend or API before the
collector, normalizer, and DB are in place. The frontend must not import
from `services/` or `database/`; the API must not import from
`apps/web/` or `services/`. Both must consume the source via the
source-catalog + contracts + DB chain.

---

## Warning: do not add sources to the frontend or API directly

> **A new source must be registered in
> `packages/source-catalog/layers/layer_01_aviation/` first.** Adding
> provider URLs, payloads, or fetch calls directly to
> `apps/web/src/layers/layer_01_aviation/` or
> `apps/api/src/routes/aviation*` without a source-catalog entry, a
> contract, and a DB table is a contract violation and will be rejected
> at integration review.

---

## Exact file locations for the aviation layer

### Source catalog

```
packages/source-catalog/layers/layer_01_aviation/
    README.md                                     ← this file
    ourairports.json                              ← active (existing)
    airplanes_live_v2.json                        ← active
    airplanes_live_global_web_json.json           ← active (distinct upstream source/mode)
    wikipedia_rest_airport_profiles.json          ← active
    wikidata_airport_profiles.json                ← active
    wikimedia_commons_airport_images.json         ← active
    opensky_trino.json                            ← inactive_future_historical_backfill
```

### Schemas (Database Agent)

```
packages/schemas/layers/layer_01_aviation/
    ourairports.py                                ← CSV parsing + reference validation
    airport_public_profile.py                     ← Wikipedia / Wikidata parsers + property map
```

### Collectors / fetchers (Fetcher Agent)

```
services/fetch-orchestrator/src/layers/layer_01_aviation/
    ourairports_collector.py                      ← static reference CSV collector
    aviation_live_aircraft_worker.py              ← live REST + global-web-json worker
    airport_public_profile_worker.py              ← Wikipedia + Wikidata enrichment
    airport_intelligence_ingest_worker.py         ← intelligence modules (uses Wikipedia + Wikidata)
    airport_image_gallery_worker.py               ← Wikimedia Commons / Wikipedia / Wikidata image gallery
    airport_layout_features_worker.py             ← runway → layout features
    airport_intelligence_source_probe.py          ← probe only — no production writes
    airport_source_endpoint_probe.py              ← probe only — no production writes
    wikimedia_wikidata_fetcher.py                 ← shared Wikipedia + Wikidata HTTP client
    aviation_live_aircraft_db.py                  ← live aircraft DB helpers
    airport_public_profile_db.py                  ← public profile DB helpers
    airport_intelligence_ingest_db.py             ← intelligence ingest DB helpers
    airport_image_gallery_db.py                   ← image gallery DB helpers
    airport_layout_features_db.py                 ← layout features DB helpers
```

### Normalizers (Normalizer Agent — aviation only)

```
services/normalizer/src/layers/layer_01_aviation/
    ourairports_normalizer.py                     ← OurAirports CSV → normalized rows
    airport_public_profile_normalizer.py          ← Wikipedia + Wikidata → AirportPublicProfilePayload
    airport_intelligence_normalizer.py            ← intelligence modules + map popup payload
    airport_image_gallery_normalizer.py           ← image candidate normalization + hero selection
    airport_layout_features_normalizer.py         ← runway → layout features
```

### Database migrations (Database Agent)

```
database/migrations/layers/layer_01_aviation/
    001_aviation_reference_tables.sql             ← aviation_airports + runways + navaids + frequencies + countries + regions
    003_aviation_search_indexes.sql               ← search indexes (002 gap is grandfathered)
    004_aviation_coordinate_quality_overrides.sql ← coordinate quality override markers
    005_airport_public_profile_cache.sql           ← airport_public_profiles + versions + fetch_runs
    006_airport_intelligence_foundation.sql        ← airport_intelligence_* + airport_source_links
    007_airport_capacity_profiles.sql             ← airport_capacity_profiles
    008_airport_traffic_metrics.sql               ← airport_traffic_metrics
    009_airport_derived_intelligence.sql          ← airport_derived_intelligence
    010_airport_image_assets.sql                  ← airport_image_assets + image_fetch_runs
    011_airport_layout_features.sql               ← airport_layout_features + layout_fetch_runs
    012_aviation_live_aircraft_tables.sql         ← aviation_aircraft_sources (incl. opensky_trino row), latest, observations, raw_batches
    013_aviation_live_aircraft_snapshots.sql      ← aviation_aircraft_snapshots
```

### API contracts (API Agent)

```
packages/contracts/src/layers/layer_01_aviation.ts ← Zod schemas for:
    AirportObject, AirportMarkerObject, AirportClusterObject,
    AirportDensityCell, AirportPreloadObject, AirportDetailResponse,
    AircraftLatest, AircraftLatestListResponse, AircraftDetailResponse
```

### API routes (API Agent)

```
apps/api/src/routes/
    aviation-aircraft.ts                          ← 1-line compatibility shim (SR-005D)
    aviation/aircraft/                            ← canonical: index / service / repository / mapper / validation / types
    live-aircraft.ts                              ← WebSocket transport (single-source on airplanes_live_v2)
    public-profile/                               ← GET /api/airports/:airportId/public-profile
    airport-intelligence/                         ← GET /api/airports/:airportId/intelligence
    airport-layout-features/                      ← GET /api/airports/:airportId/layout-features
    objects.ts                                    ← /api/layers/layer_01_aviation/objects (and /:objectId, /:objectId/detail)
    layers.ts                                     ← layer registry (includes layer_01_aviation status)
```

### Frontend (Frontend Agent)

```
apps/web/src/layers/layer_01_aviation/
    index.ts                                      ← public barrel
    aircraft/
        aircraftMarker.ts                         ← aircraft billboard + click/select handling
        useLiveAircraftSocket.ts                  ← WebSocket consumer (snapshot + delta + DR loop)
    airports/
        aviationCategories.ts                     ← category model
        aviationObjectStore.ts                    ← resident global cache (object lookup)
        aviationGlobalRenderer.ts                 ← global dot collection + filter / occlusion
        aviationPreloader.ts                      ← preload hook (resident cache hydration)
        useAirportPublicProfile.ts                ← public profile hook
        useAirportIntelligence.ts                 ← intelligence hook (includes gallery)
        useAirportLayoutFeatures.ts               ← layout features hook
        airportMarkerSprites.ts                   ← dot color helpers
        airportIntelligenceTypes.ts               ← types
        airportLayoutTypes.ts                     ← types
        airportPublicProfileTypes.ts              ← types
apps/web/src/CesiumGlobe/                         ← W4 module folder; uses layer_01_aviation hooks
apps/web/src/CesiumGlobe.tsx                      ← 1-line compatibility shim
```

### Tests (cross-agent)

```
tests/data/layer_01_aviation/
    test_ourairports_foundation.py
    test_aviation_* (coordinate, search, query, density, category audit, etc.)
    test_airport_public_profile_{worker,normalizer,cache_migration}.py
    test_airport_intelligence_{ingest_worker,foundation_migration,source_probe}.py
    test_airport_image_{gallery_worker,assets_migration}.py
    test_airport_layout_features_{worker,migration}.py
    test_airport_capacity_profiles_migration.py
    test_airport_traffic_metrics_migration.py
    test_airport_derived_intelligence_migration.py
    test_aviation_live_aircraft_{migration,worker}.py
    fixtures/
        wikipedia_summary_dubai.json
        wikipedia_summary_kjfk.json
        wikipedia_summary_kbdl.json
        wikipedia_summary_lhr.json
        wikidata_entity_dubai.json
```

---

## Reference documents

- `docs/control/PROJECT_CONTROL.md` — single active project control file
  (engineering rules, layer registry, ownership, source/data contract).
- `docs/decisions/ADR-002-aviation-live-source.md` — Airplanes.live
  selection rationale + OpenSky future-only decision.
- `specs/008-structure-remediation-roadmap/repository-skeleton.md` —
  planned `sources/<source_name>/` split (SR-015) for the fetch-orchestrator.
- `docs/state/CURRENT_PROJECT_STATE.md` — current phase, implemented layers.

---

## Last updated

2026-06-21 — Aviation source registry initial consolidation. Added
`airplanes_live_v2.json`, `airplanes_live_global_web_json.json`,
`wikipedia_rest_airport_profiles.json`, `wikidata_airport_profiles.json`,
`wikimedia_commons_airport_images.json`, and `opensky_trino.json` (with
status `inactive_future_historical_backfill`). Added this README with
active / future / probe tables, lifecycle explanation, and exact file
locations. `ourairports.json` left as-is.
