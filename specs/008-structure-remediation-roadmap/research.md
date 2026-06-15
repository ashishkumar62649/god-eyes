# Research — Structure Remediation Roadmap

> **Agent:** Documentation Agent
> **Lane:** Documentation / Planning
> **Date:** 2026-06-15
> **Sources inspected:** the GOD EYES repository on `spec/structure-remediation-roadmap`
> at 2026-06-15 (post 2026-06-14 documentation cleanup), the
> `ENGINEERING_STRUCTURE_COMPLIANCE_AUDIT.md` (2026-06-14), the
> `PROJECT_HEALTH_FINDINGS_EXPLAINED.md` (2026-06-14), and the
> `docs/control/*` rulebook.

This file summarises the current structural state of the repository. It
provides the evidence base for `plan.md` and `tasks.md`. No application
code, frontend code, API code, fetcher/normalizer code, database
migration, or test code is modified by this research.

---

## 1. API Route Structure

The API lives under `apps/api/src/routes/`. The folder is **resource-oriented**
rather than `layer_NN_name/`. This is acceptable per the rulebook (Section 8
is the recommended pattern, not mandatory for resources).

### 1.1 Resource-oriented folders already split

| Folder | Pattern | Files |
|---|---|---|
| `apps/api/src/routes/airport-intelligence/` | `index.ts` + `service.ts` + `repository.ts` + `types.ts` (full Section 8 pattern) | 4 files |
| `apps/api/src/routes/airport-layout-features/` | same pattern | 4 files |
| `apps/api/src/routes/public-profile/` | same pattern | 4 files |
| `apps/api/src/routes/objects/` | full pattern + per-responsibility: `index.ts` + `repository.ts` + `mapper.ts` + `validation.ts` + `types.ts` + `constants.ts` + `errors.ts` + `metadata.ts` + `points.ts` + `clusters.ts` + `density.ts` + `detail.ts` + `preload.ts` | 12 files |

These are the **reference pattern** for the live-layer route split.

### 1.2 Top-level file routes (single file, oversized)

| File | Lines | Threshold (rulebook §6) | Audit ID |
|---|---:|---|---|
| `apps/api/src/routes/weather.ts` | 1095 | 800+ (must split) | ESA-002 |
| `apps/api/src/routes/news.ts` | 1014 | 800+ (must split) | ESA-002 |
| `apps/api/src/routes/maritime.ts` | 797 | 501–800 (must split) | ESA-002 |
| `apps/api/src/routes/energy/infrastructure.ts` | 614 | 501–800 (must split) | ESA-002 |
| `apps/api/src/routes/space/satellites.ts` | 520 | 501–800 (must split) | ESA-002 |
| `apps/api/src/routes/layers.ts` | 455 | 301–500 (warning) | — |
| `apps/api/src/routes/aviation-aircraft.ts` | 386 | 301–500 (warning) | — |
| `apps/api/src/routes/live-aircraft.ts` | 236 | good | — |
| `apps/api/src/routes/borders-boundaries.ts` | 293 | good | — |
| `apps/api/src/routes/earth-events.ts` | 249 | good | — |
| `apps/api/src/routes/health.ts` | 21 | good | — |
| `apps/api/src/routes/objects.ts` | 6 (re-export shim) | good | — |

### 1.3 Helper helpers embedded in route files

`maritime.ts`, `news.ts`, `weather.ts`, and `energy/infrastructure.ts` each
define their own `parseLimit` / `parseOffset` / `parseBbox` / `parseNumeric`
/ `parseMmsi` / `parseHours` / `parseHistoryLimit` / `isValidIsoDatetime`
helpers. They also define their own `MAX_LIMIT` / `MAX_OFFSET` constants.
A single `apps/api/src/lib/query-limits.ts` is the centralization candidate
(ESA-016). Out of scope for any one route split; can be added during
`SR-002` or as its own `SR-NNN` if desired.

### 1.4 SQL in route handlers

`query(...)` calls live directly in `weather.ts`, `news.ts`, `maritime.ts`,
`space/satellites.ts`, `energy/infrastructure.ts`, and `layers.ts`. The
`airport-intelligence/`, `airport-layout-features/`, `public-profile/`, and
`objects/` folders have already moved SQL to `repository.ts`. The five
large file routes need the same treatment (ESA-014).

### 1.5 Mappers embedded in route files

`rowToVesselObject`, `rowToVesselDetail`, `rowToNewsItem`, `rowToNewsMarker`,
`rowToFeature`, `rowToObservationItem`, `rowToAirportObject`,
`rowToAirportDetail` are inline in the corresponding route files. The
`objects/mapper.ts` shows the target pattern (ESA-015).

---

## 2. Frontend Layer Folder Structure

`apps/web/src/layers/` is organized by domain folder. Two patterns exist:

### 2.1 Canonical (already correct)

* `apps/web/src/layers/layer_07_weather/`
  * `WeatherLayer.tsx`, `weatherApi.ts`, `useWeather.ts`, `weatherTypes.ts`,
    `weatherDetail.ts`, `weatherMarker.ts`, `__tests__/weather.test.ts`
  * 7 source files, flat layout, all under the 500-line threshold.
* `apps/web/src/layers/layer_08_news_osint/`
  * `NewsLayer.tsx`, `newsApi.ts`, `useNews.ts`, `newsTypes.ts`,
    `newsDetail.ts`, `newsMarker.ts`, `__tests__/news.test.ts`
  * 6 source files, flat layout, all under the 500-line threshold.

### 2.2 Grandfathered (short, non-canonical names)

* `apps/web/src/layers/aviation/` → `layer_01_aviation`
  * Subfolders: `aircraft/` (2 files), `airports/` (~15 files).
  * `airports/` is the largest flat subfolder and is the future
    `features/` split candidate.
* `apps/web/src/layers/borders/` → `layer_02_borders_boundaries`
  * `useBordersBoundaries.ts` (40 lines) + `.gitkeep`.
* `apps/web/src/layers/earth-events/` → `layer_03_earth_events`
  * `useEarthEvents.ts` (39 lines) + `.gitkeep`.
* `apps/web/src/layers/space/` → `layer_05_space_satellites`
  * Subfolder: `satellites/` (5 files: types, colors, filters, hook,
    `__tests__/space-satellites.test.ts`).
* `apps/web/src/layers/maritime/` → `layer_06_maritime`
  * 4 source files: `MaritimeLayer.tsx` (114), `maritimeApi.ts` (50),
    `useMaritime.ts` (28), `vesselMarker.ts` (36),
    `__tests__/maritime.test.ts` (165).
* `apps/web/src/layers/energy/` → `layer_10_energy_infrastructure`
  * Subfolder: `infrastructure/` (4 files).

### 2.3 Empty placeholders

* `apps/web/src/layers/aviation/.gitkeep`,
  `apps/web/src/layers/aviation/aircraft/.gitkeep`,
  `apps/web/src/layers/aviation/airports/.gitkeep`,
  `apps/web/src/layers/borders/.gitkeep`,
  `apps/web/src/layers/earth-events/.gitkeep`.

### 2.4 Layer 00 (Globe Core)

Layer 00 is **not** represented as `apps/web/src/layers/layer_00_globe_core/`.
The shared frontend code lives under `apps/web/src/components/`,
`apps/web/src/globe/`, `apps/web/src/hooks/`, `apps/web/src/lib/`, and
`apps/web/src/styles/`. This is acceptable because Layer 00 is the
foundation layer with no separate "feature area." No change required.

### 2.5 Layers 04 and 09 (coming_soon)

`layer_04_public_military_security/` and `layer_09_user_shapes/` do not
have frontend folders. This is correct.

### 2.6 Component size findings

| File | Lines | Threshold | Audit ID |
|---|---:|---|---|
| `apps/web/src/components/LayerPanel.tsx` | 1079 | 800+ (must split) | ESA-003 |
| `apps/web/src/components/DetailPanel.tsx` | 953 | 800+ (must split) | ESA-003 |
| `apps/web/src/components/Shell.tsx` | 209 | good | — |
| `apps/web/src/components/StatusPanel.tsx` | 179 | good | — |
| `apps/web/src/components/SearchCommand.tsx` | 160 | good | — |
| `apps/web/src/components/Header.tsx` | 26 | good | — |

The `apps/web/src/components/intel/` subfolder contains 12 presentational
panels (`AirportImageSlider.tsx`, `AirportLayoutOverlayToggle.tsx`,
`AirportMapPopup.tsx`, `AirportOverview.tsx`,
`AirportPublicProfilePanel.tsx`, `AviationDetailPlaceholders.tsx`,
`CoordinateSourceCard.tsx`, `DataQualityCard.tsx`, `FrequenciesSection.tsx`,
`IntelSection.tsx`, `NearbyNavaidsSection.tsx`, `RunwaysSection.tsx`).
The largest is `AirportImageSlider.tsx` (205) and
`AirportPublicProfilePanel.tsx` (293). All under the warning band.

The `apps/web/src/components/overlays/` subfolder contains 4 small
presentational components (`AircraftInfoOverlay.tsx`, `EarthquakeInfoOverlay.tsx`,
`SatelliteInfoOverlay.tsx`, `TokenWarningOverlay.tsx`). All under 80
lines.

### 2.7 Frontend API client consistency

All API calls go through `lib/api.ts` or per-layer `*Api.ts` /
`use*Api.ts` hook files. All layer clients use `VITE_API_BASE_URL` with
a fallback to `http://localhost:4000`. HEALTH-001 is **resolved** in
current `main`. No further action required (ESA-001).

### 2.8 Direct external API calls in frontend

None. The only external URL is the Cesium Ion token read from
`VITE_CESIUM_ION_ACCESS_TOKEN`. All data flows through the GOD EYES API
(ESA-013). **PASS**.

### 2.9 Cross-layer imports

`grep` for `from '../../services/'`, `from '../../apps/api/'`,
`from '../../database/'` in `apps/web/src/**/*.{ts,tsx}` returns **no
matches**. Cross-layer code communicates through
`packages/contracts/` only (ESA-027). **PASS**.

---

## 3. Frontend Large Components

The two largest components are the focus of `SR-005` and `SR-006`.

### 3.1 `DetailPanel.tsx` (953 lines)

Lives in `apps/web/src/components/DetailPanel.tsx`. Contains a top-level
`DetailPanel` component plus several sub-components (aviation intel cards,
vessel overview, sources section, hero image). The audit estimates
~4–5 inlined sub-components. A pure split into
`detail/AviationDetail.tsx`, `detail/MaritimeDetail.tsx`,
`detail/SourcesSection.tsx`, and a thin orchestrator
`DetailPanel.tsx` is the target pattern. The intel sub-panels under
`apps/web/src/components/intel/` already exist; some are referenced by
`DetailPanel.tsx` directly.

### 3.2 `LayerPanel.tsx` (1079 lines)

Lives in `apps/web/src/components/LayerPanel.tsx`. The layer-toggle panel
that renders the side panel for enabling/disabling layers and their
per-layer sub-options. Splitting it into per-layer sub-panels
(`layerPanels/WeatherLayerPanel.tsx`,
`layerPanels/NewsLayerPanel.tsx`, `layerPanels/MaritimeLayerPanel.tsx`,
etc.) plus a thin orchestrator `LayerPanel.tsx` is the target pattern.

---

## 4. Contracts Package

`packages/contracts/src/index.ts` is **1325 lines** of mostly Zod schemas
across all layers. No subfolders.

### 4.1 Content sample

* Layer (registry/status): `LayersListResponse`, `LayerRegistryResponse`,
  `LayerRegistrySingleResponse`, `LayerStatusResponse`,
  `LayerListMetadata`.
* Aviation: `AirportObject`, `RunwayDetail`, `NavaidDetail`,
  `FrequencyDetail`, `AirportClusterObject`, `AirportDensityResponse`,
  `AirportPreloadListResponse`, `LayerObjectsListResponse`.
* Maritime: `MaritimeObjectsListResponse`, `MaritimeVesselDetailResponse`,
  `MaritimeStatsResponse`, `MaritimePositionHistoryResponse`.
* Weather, news, energy: domain-specific shapes.
* Shared error codes: `ErrorCodes`.

### 4.2 The `objectCounts` problem (HEALTH-002)

`LayerStatusResponseSchema` declares aviation-specific `objectCounts`
fields: `airports`, `runways`, `navaids`, `airportFrequencies`,
`countries`, `regions`. The same schema is used for **all 11 layers** in
`apps/api/src/routes/layers.ts`. For non-aviation layers the API
returns all zeros, which is misleading and contract-incorrect for
generic status consumers.

### 4.3 Split candidate

A per-layer (or per-domain) split into:

* `packages/contracts/src/layer/registry.ts` — LayersListResponse,
  LayerStatusResponse, LayerRegistryResponse.
* `packages/contracts/src/layer/aviation.ts` — AirportObject et al.
* `packages/contracts/src/layer/maritime.ts` — Maritime* schemas.
* `packages/contracts/src/layer/weather.ts` — Weather* schemas.
* `packages/contracts/src/layer/news.ts` — News* schemas.
* `packages/contracts/src/layer/energy.ts` — Energy* schemas.
* `packages/contracts/src/layer/space.ts` — Space* schemas.
* `packages/contracts/src/layer/borders.ts` — Borders* schemas.
* `packages/contracts/src/layer/earth-events.ts` — EarthEvents*
  schemas.
* `packages/contracts/src/layer/shared.ts` — ErrorCodes and other
  shared codes.
* `packages/contracts/src/index.ts` — re-exports from the above for
  compatibility.

The split is **pure**: it does not change any existing type. Existing
imports from `@god-eyes/contracts` keep working.

### 4.4 Imports in API / Frontend

`apps/api/src/routes/**/*.ts` and `apps/web/src/**/*.{ts,tsx}` import
through `@god-eyes/contracts` (the package name). A per-file split with
re-exports from `index.ts` does not break any importer.

---

## 5. Fetcher / Normalizer Structure

### 5.1 Fetcher (`services/fetch-orchestrator/src/layers/`)

All eight implemented layer folders are present and use canonical naming:

* `layer_01_aviation/` — 14 source files (8 sources, prefixed file
  names).
* `layer_02_borders_boundaries/` — 1 source file.
* `layer_03_earth_events/` — 2 source files.
* `layer_05_space_satellites/` — 9 source files.
* `layer_06_maritime/` — 9 source files.
* `layer_07_weather/` — 11 source files (+ `README.md` + `proof_report.md`).
* `layer_08_news_osint/` — 11 source files.
* `layer_10_energy_infrastructure/` — 8 source files.

The recommended `sources/<name>/` subfolder pattern is **not** used.
Multi-source layers (aviation, space, news, energy) use prefixed flat
file names instead. The rulebook Section 9 says the `sources/` subfolder
is **optional** for single-source layers; for multi-source layers it is
**recommended**. This is **not a current rule violation**, but it is a
future refactor candidate (ESA-009 / SR-015).

### 5.2 Normalizer (`services/normalizer/src/layers/`)

Only one folder exists: `layer_01_aviation/`. This is the **canonical
aviation normalizer location**, owned by the Normalizer Agent. All other
layers' normalizers are colocated under
`services/fetch-orchestrator/src/layers/<layer_id>/` (Fetcher Agent
owns those modules). This matches the Normalizer Location Rule
(HEALTH-004). **Do not move existing normalizers** in any documentation
or refactor task; an explicit Orchestrator-issued work order is required
to relocate one.

### 5.3 Python worker size findings (> 700 lines)

| File | Lines |
|---|---:|
| `services/fetch-orchestrator/src/layers/layer_01_aviation/aviation_live_aircraft_worker.py` | 965 |
| `services/fetch-orchestrator/src/layers/layer_01_aviation/airport_source_endpoint_probe.py` | 961 |
| `services/fetch-orchestrator/src/layers/layer_01_aviation/airport_public_profile_worker.py` | 670 |
| `services/fetch-orchestrator/src/layers/layer_01_aviation/airport_intelligence_source_probe.py` | 651 |
| `services/fetch-orchestrator/src/layers/layer_10_energy_infrastructure/energy_normalizer.py` | 636 |
| `services/fetch-orchestrator/src/layers/layer_01_aviation/airport_public_profile_db.py` | 610 |
| `services/fetch-orchestrator/src/layers/layer_01_aviation/airport_intelligence_ingest_worker.py` | 590 |
| `services/fetch-orchestrator/src/layers/layer_01_aviation/airport_intelligence_ingest_db.py` | 583 |
| `services/fetch-orchestrator/src/layers/layer_10_energy_infrastructure/energy_infrastructure_worker.py` | 555 |
| `services/fetch-orchestrator/src/layers/layer_06_maritime/maritime_normalizer.py` | 481 |
| `services/fetch-orchestrator/src/layers/layer_06_maritime/maritime_ingestion.py` | 473 |
| `services/fetch-orchestrator/src/layers/layer_01_aviation/airport_image_gallery_worker.py` | 468 |
| `services/fetch-orchestrator/src/layers/layer_02_borders_boundaries/natural_earth_admin0_ingest.py` | 466 |
| `services/fetch-orchestrator/src/layers/layer_08_news_osint/gdelt_source_probe.py` | 456 |
| `services/fetch-orchestrator/src/layers/layer_05_space_satellites/orbit_propagation.py` | 451 |
| `services/fetch-orchestrator/src/layers/layer_06_maritime/maritime_db_writer.py` | 450 |
| `services/fetch-orchestrator/src/layers/layer_10_energy_infrastructure/energy_infrastructure_db.py` | 436 |
| `services/fetch-orchestrator/src/layers/layer_07_weather/open_meteo_client.py` | 429 |
| `services/fetch-orchestrator/src/layers/layer_10_energy_infrastructure/osm_energy_client.py` | 425 |

Aviation has the most workers above the threshold. Splitting aviation
workers is one of the larger future tasks (ESA-008). The rulebook §6
limit is "700+ must split unless explicitly approved" — the audit
treats these as **grandfathered** and splits them via a future refactor
branch.

### 5.4 Forbidden imports

`grep` for `from apps.`, `import apps.` in `services/**/*.{ts,py}`
returns **no matches**. Fetcher and normalizer code does not import
from `apps/web/` or `apps/api/`. (ESA-027, ESA-016, **PASS**.)

---

## 6. Database / Migration Organization

### 6.1 Folder structure

`database/migrations/core/001_core_ingestion_tables.sql` — single shared
migration.

`database/migrations/layers/<layer_id>/` — per-layer migration folders
for all 8 implemented layers, using canonical `layer_NN_name/` names.

### 6.2 Migration count per layer

| Layer | Count | File names |
|---|---|---|
| `layer_01_aviation` | 13 (gap at `002`) | `001`, `003`–`013` |
| `layer_02_borders_boundaries` | 1 | `001_borders_boundaries_schema.sql` |
| `layer_03_earth_events` | 1 | `001_earth_events_tables.sql` |
| `layer_05_space_satellites` | 2 | `001_space_satellites_tables.sql`, `002_space_satellites_scale_indexes.sql` |
| `layer_06_maritime` | 1 | `001_maritime_tables.sql` |
| `layer_07_weather` | 1 | `001_weather_tables.sql` |
| `layer_08_news_osint` | 1 | `001_news_tables.sql` |
| `layer_10_energy_infrastructure` | 1 | `001_energy_infrastructure_tables.sql` |

### 6.3 Numbering gap (HEALTH-010 / ESA-010)

`layers/layer_01_aviation/` jumps from `001_aviation_reference_tables.sql`
to `003_aviation_search_indexes.sql`. **`002` is missing**. The gap is
grandfathered, has no functional impact, and is documented in the prior
project health audits. **Do not renumber.** Document the gap in
`database/migrations/README.md`.

### 6.4 Ingestion helpers

`database/ingestion/layers/layer_07_weather/` and
`database/ingestion/layers/layer_08_news_osint/` are the only ingestion
helpers. Other layers do their DB writes from the fetcher worker
directly. Compliant with the rulebook.

### 6.5 Migration README

`database/migrations/README.md` is 41 lines and covers local infra and
running the migrations. It does not currently mention the `002` gap or
the document-numbering convention. The SR-016 task adds a one-line note
about the gap and a section on the migration-numbering convention.

### 6.6 Table naming and column conventions

* All tables follow `<layer_domain>_<entity>_<role>`.
* `latitude` / `longitude` / `geom geometry(Geometry, 4326)` are
  consistent (ESA-019, **PASS**).
* `*_latest` separated from history tables for live layers
  (ESA-018, **PASS**).
* JSONB usage is limited to provider metadata / raw evidence (ESA-020,
  **PASS**).

---

## 7. Tests / Data Organization

### 7.1 Folder structure

`tests/data/layer_01_aviation/`, `tests/data/layer_02_borders_boundaries/`,
`tests/data/layer_03_earth_events/`, `tests/data/layer_05_space_satellites/`,
`tests/data/layer_06_maritime/`, `tests/data/layer_07_weather/`,
`tests/data/layer_08_news_osint/`, `tests/data/layer_10_energy_infrastructure/`
— all canonical.

### 7.2 Test file size findings (> 700 lines)

| File | Lines |
|---|---:|
| `tests/data/layer_05_space_satellites/test_space_satellites_fetcher.py` | 2411 |
| `tests/data/layer_08_news_osint/test_gdacs_db_ingestion.py` | 677 |
| `tests/data/layer_01_aviation/test_airport_public_profile_worker.py` | 631 |
| `tests/data/layer_07_weather/test_fetcher.py` | 614 |
| `tests/data/layer_01_aviation/test_aviation_live_aircraft_worker.py` | 540 |
| `tests/data/layer_07_weather/test_weather_local_seed.py` | 517 |
| `tests/data/layer_01_aviation/test_airport_image_gallery_worker.py` | 454 |
| `tests/data/layer_01_aviation/test_airport_intelligence_source_probe.py` | 432 |
| `tests/data/layer_06_maritime/test_maritime_migration.py` | 424 |
| `tests/data/layer_08_news_osint/test_news_database_schema.py` | 420 |

The largest is `test_space_satellites_fetcher.py` (2411 lines) — split
into focused suites per test domain (SR-017).

### 7.3 Test pass rate baseline

At the start of this branch the data test suite was last run with
**1159 passed, 15 skipped, 0 failed** (per the 2026-06-14 compliance
audit). The current `main` may have a slightly different baseline; the
worker agent for any `SR-NNN` task should re-run
`python -m pytest tests/data -q` and record the result in the
work-package handoff entry.

### 7.4 Test data and fixtures

`tests/data/layer_01_aviation/fixtures/` contains
`wikidata_entity_dubai.json`, `wikipedia_summary_dubai.json`,
`wikipedia_summary_kbdl.json`, `wikipedia_summary_kjfk.json`,
`wikipedia_summary_lhr.json`. `tests/data/layer_03_earth_events/fixtures/`
contains `usgs_earthquake_feature.json`. Other layers have no fixture
files. Per the rulebook these are **local test data** and must remain
gitignored unless explicitly committed (the existing files are
intentionally committed).

---

## 8. Current Active Specs

`specs/` contains 7 spec folders plus `README.md`:

* `001-layer-zero-globe-core/` — Globe Core layer spec.
* `002-layer-one-aviation/` — Layer 1 aviation spec.
* `003-layer-05-space-satellites-mvp/` — Layer 5 space spec.
* `004-layer-10-energy-infrastructure-mvp/` — Layer 10 energy spec.
* `005-layer-06-maritime-mvp/` — Layer 6 maritime spec.
* `006-layer-07-weather-mvp/` — Layer 7 weather spec.
* `007-layer-08-news-osint-mvp/` — Layer 8 news/osint spec.

Each existing spec uses a different file inventory (e.g., `006-` has
`API_PLANNING.md`, `DATABASE_PLANNING.md`, `FETCHING_DESIGN.md`,
`FRONTEND_PLANNING.md`, `NORMALIZATION_DESIGN.md`, `OPEN_QUESTIONS.md`,
`README.md`, `SOURCE_EVALUATION_MATRIX.md`, `SPEC_OVERVIEW.md`,
`WORK_ORDERS.md`). This spec follows the simpler Spec Kit pattern
(`spec.md`, `plan.md`, `tasks.md`, `research.md`, `README.md`) because
this is a **planning** spec, not a feature spec.

The next sequential spec number after `007` is `008`. The
`specs/008-structure-remediation-roadmap/` folder is appended at the
end of the spec list.

---

## 9. Risks From Moving / Renaming

The following risks apply to **every** rename or move work package
(`SR-009` through `SR-014`, `SR-015`, etc.). Each `SR-NNN` row in
`tasks.md` calls out the specific risks for that work package.

* **Import path breakage**: importers across `apps/web/`, `apps/api/`,
  `services/`, `database/`, and `tests/` use the current paths. A
  rename that lands without a compatibility re-export will break the
  build. **Mitigation:** every rename must keep a re-export / alias
  shim until all importers are migrated.
* **TypeScript path mapping / Vite alias**: `apps/web` and `apps/api`
  use TS path mapping. The rename must update `tsconfig.json` if any
  alias points at the old path. Check `tsconfig.json` in both apps
  before any rename.
* **Test fixture path references**: `tests/data/layer_*/` may
  reference layer folder names in path constants. The rename must
  update those references.
* **Source-catalog references**: `packages/source-catalog/layers/<layer_id>/`
  uses canonical IDs. Confirm no source-catalog file references the
  frontend's short-name folder.
* **Handoff log citations**: prior `INTEGRATION_REVIEW_*.md` files in
  `docs/archive/2026-06-14-final-docs-structure/state-integration-reviews/`
  cite old paths. Those citations are historical and **must not be
  rewritten**; the new layer's documentation uses the new path.
* **CI / build script references**: `package.json`, `pyproject.toml`,
  any `Makefile` or `*.sh` script that references `apps/web/src/layers/<old>`
  must be updated. Search for `<old>` path before merging.
* **Editor / IDE auto-import**: stale IDE caches may insert the old
  path. The worker agent must run a final `pnpm --filter web build` to
  surface any remaining imports.

---

## 10. Reference / Test Breakage Risks

* **Test file imports** — many tests use relative imports. A rename
  must update those imports in the same branch.
* **Snapshot tests** — none found in `tests/data/`. If snapshots
  exist, they must be regenerated and reviewed.
* **Contract tests** — the `*ResponseSchema.parse(...)` calls in route
  handlers are contract tests. A route split that changes the order
  of fields in a response body is a behaviour change; the rule is
  **no behaviour change**, so JSON field order must be preserved.
* **Playwright / E2E** — none in the current repo. No E2E breakage
  risk.
* **Coverage baseline** — `python -m pytest tests/data -q` is the data
  test command. The branch must end with the same or better pass rate.
* **Pytest scope-guard tests** — 8 scope-guard tests fail on a dirty
  tree (pre-existing). A branch that introduces *additional* failures
  is FAIL; a branch that surfaces only the pre-existing 8 is PASS.
* **Lint / format** — no eslint/prettier config in current `main`;
  PEP 8 is followed in Python files. A rename that changes
  indentation (e.g., moving a function between files) may introduce
  whitespace noise; the worker agent must run `git diff --check`
  before committing.

---

## 11. What This Research Does Not Cover

* **Runtime performance.** The remediation is structural; no runtime
  measurements are taken in this branch.
* **Bundle size impact.** The contracts split may change the bundle's
  tree-shaking behaviour; the worker agent for `SR-007` runs a
  `pnpm --filter web build` and reports any size change.
* **Cross-spec impact.** This spec does not propose to modify any
  existing `specs/001-..007-*` content. The `008` folder is added at
  the end of the spec list.
* **Auth / deployment / time-series decisions.** These are deferred to
  Phase 8 (`SR-018`) and to user-level decisions per the compliance
  audit.

---

**Last updated:** 2026-06-15
**Author:** Documentation Agent
**Maintained by:** Orchestrator Agent
