# Engineering Structure Compliance Audit

> **Agent:** Research Agent
> **Lane:** Research
> **Working directory:** `E:\god-eyes`
> **Branch:** `research/engineering-structure-compliance-audit`
> **Base branch:** `main`
> **Date:** 2026-06-14
> **Source rulebook:** `docs/control/ENGINEERING_STRUCTURE_RULES.md` (last updated 2026-06-14)
> **Allowed scope:** `docs/audits/ENGINEERING_STRUCTURE_COMPLIANCE_AUDIT.md` (this file), `docs/state/HANDOFF_LOG.md` (append)
> **Forbidden scope:** `apps/`, `packages/`, `services/`, `database/`, `tests/`, `specs/`, `docs/control/`, `docs/work-orders/`, `.env`, `.env.example`, `raw/`, `tmp/`, generated cache files. **No code, configuration, or migration was modified in this audit.**

---

## 1. Executive Summary

This audit reviews the current state of the GOD EYES repository against the active engineering rulebook
(`docs/control/ENGINEERING_STRUCTURE_RULES.md`). The audit inspected folder layout, layer naming, big-layer
feature structure, file and function size, frontend organization, API route contracts, fetcher/normalizer
layout, database/migration structure, transport/live-data readiness, raw storage, object storage, and import
boundaries.

**What was audited.** All eleven MVP layer folders (00 through 10), the API routes folder, the
fetch-orchestrator and normalizer services, the database migrations and ingestion trees, and the
`tests/data` tree. The audit also reviewed a sample of API source files, frontend layer folders,
`packages/contracts/`, and the shared `apps/web/src/lib` and `apps/web/src/components` trees.

**Why.** The engineering rulebook states: "Existing messy or inconsistent files must not be ignored
forever. They must be repaired step by step, only after research, planning, and review, through dedicated
refactor branches." This audit is the research and planning step before any refactor branch is created.

**Overall project health against the engineering rules.** The project is **structurally healthy and safe
to continue**, with several known grandfathered exceptions and a small number of refactor opportunities.
The most important findings are:

* The rulebook is well-aligned with the code that was written **after** the alignment pass on
  `main` (2026-06-14). Newer layers (07 weather, 08 news/osint) follow the canonical layer folder
  names and the recommended per-layer substructure pattern.
* Older layer folders use short non-canonical names (e.g., `aviation/`, `borders/`, `earth-events/`,
  `space/`, `maritime/`, `energy/`) on the frontend. This is **grandfathered** by the rulebook
  itself (Section 4 and Section 18) and must be repaired only through dedicated refactor branches.
* Two API route files (`weather.ts` 988 lines, `news.ts` 919 lines) and the cross-cutting
  `apps/web/src/components/DetailPanel.tsx` (877 lines) and
  `apps/web/src/components/LayerPanel.tsx` (1030 lines) exceed the rulebook's "must split" threshold
  for new work. They are grandfathered as pre-existing implementation. They are the largest
  near-term refactor candidates when the team takes on the next API hardening cycle.
* `packages/contracts/src/index.ts` is 1074 lines, which is large for a single TypeScript module.
  It is mostly Zod schemas; a split into per-domain subfiles is a clean, low-risk refactor.
* Database migrations follow the recommended naming pattern, separate `latest` from history for live
  layers, include `layer_id`/`source_id`/`source_object_id` provenance, and use `geom` + `latitude`
  + `longitude` consistently. One migration-numbering gap remains in `layer_01_aviation` (no
  `002_*.sql`). This was already known in the prior `PROJECT_HEALTH_WORKFLOW_AUDIT.md`
  (HEALTH-010, Low) and is grandfathered.
* No import boundary violations were found in the inspected slices. Frontend code does not import
  from `services/` or `apps/api/`; API code does not import from `apps/web/` or `services/`;
  services do not import from `apps/web/` or `apps/api/`. Cross-layer code goes through
  `packages/contracts/`.
* All live layers correctly separate `*_latest` from history tables. JSONB usage is limited to
  provider metadata and raw source payloads (compliant with Section 10). No found JSONB-as-dumping-ground
  risks in the inspected migrations.
* Fetcher/normalizer layout follows the documented colocation pattern (Fetcher Agent owns the
  normalizer module colocated under the same layer folder) for layers 02, 03, 05, 06, 07, 08, 10.
  Aviation normalizer remains in its canonical separate location under `services/normalizer/`.
  This matches the explicit Normalizer Location Rule in `LLM_OWNERSHIP_MATRIX.md`,
  `PIPELINE_HANDOFF_RULES.md`, and `DATA_LOCATION_RULES.md`.

**Highest-risk categories.** No critical or high-severity issues. The most significant medium-severity
items are documented in the finding table. None blocks the next planning cycle; all are repair candidates
that should be planned in a dedicated refactor branch.

**No fixes were made.** This is a research-only audit. No application code, frontend code, API code,
fetcher/normalizer code, database migration, or test code was modified. The only files written or
modified by this audit are `docs/audits/ENGINEERING_STRUCTURE_COMPLIANCE_AUDIT.md` (this report) and
a single appended entry in `docs/state/HANDOFF_LOG.md`.

---

## 2. Audit Baseline

The following rule documents were used as the audit baseline:

* `AGENTS.md` — entry point: roles, layer registry, hard rules, workflow cycle, git rules
* `docs/control/ENGINEERING_STRUCTURE_RULES.md` — **the master engineering rulebook** (the
  authoritative source for this audit)
* `docs/control/MVP_LAYER_REGISTRY.md` — authoritative layer registry, IDs, statuses
* `docs/control/LLM_OWNERSHIP_MATRIX.md` — agent ownership matrix; includes the Normalizer
  Location Rule
* `docs/control/PIPELINE_HANDOFF_RULES.md` — pipeline handoff and data flow rules
* `docs/control/DATA_LOCATION_RULES.md` — directory structure and generated folder rules
* `docs/control/SOURCE_TO_FRONTEND_CONTRACT.md` — required fields per source
* `docs/state/CURRENT_PROJECT_STATE.md` — current project state
* `docs/audits/PROJECT_HEALTH_WORKFLOW_AUDIT.md` — prior audit reference (HEALTH-001..012)
* `docs/audits/PROJECT_HEALTH_FINDINGS_EXPLAINED.md` — detailed evidence for prior findings

---

## 3. Scope Inspected

The audit inspected the following folders and files by category:

**Folders inspected (full recursion):**

* `apps/web/src/layers/` — frontend per-layer folders
* `apps/web/src/components/` — shared frontend components (aviation intel + chrome)
* `apps/web/src/lib/` — shared frontend lib (API helpers, layer registry, search helpers)
* `apps/api/src/routes/` — API routes (including `objects/`, `airport-intelligence/`,
  `airport-layout-features/`, `public-profile/`, `space/`, `energy/`)
* `apps/api/src/lib/` — DB pool, config, live-aircraft broadcaster
* `packages/contracts/src/` — Zod contracts (and `node_modules`/`dist` for size context)
* `services/fetch-orchestrator/src/layers/` — fetcher workers and colocated normalizers for
  layers 01, 02, 03, 05, 06, 07, 08, 10
* `services/normalizer/src/layers/` — aviation normalizer (canonical location)
* `database/migrations/core/` and `database/migrations/layers/<layer_id>/` — schema migrations
* `database/ingestion/layers/` — DB ingestion helpers (only layer_07_weather and
  layer_08_news_osint)
* `tests/data/layer_*/` — data test suites per layer

**Files inspected (line counts and content samples):**

* TypeScript / React files in `apps/web/src/`, `apps/api/src/`, `packages/contracts/src/`
* Python files in `services/fetch-orchestrator/`, `services/normalizer/`, `database/ingestion/`,
  `tests/data/` (excluding `__pycache__`)
* SQL files in `database/migrations/` (and `database/ingestion` if present)
* Markdown files in `docs/control/` and `docs/audits/`

**Pattern searches performed:**

* `fetch(`, `axios(`, `XMLHttpRequest` in frontend files
* `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `DROP` in API route files
* `from '../services/`, `from '../apps/api/`, `from '../database/` in frontend files
* `utils`, `helpers`, `misc`, `temp`, `final`, `new`, `common` (vague-name pattern) in frontend
* `lat`, `lon`, `ST_SetSRID`, `geom` in SQL migrations
* `MAX_`, `validate*`, `safeParse`, `schema.parse` in API route files
* `VITE_API_BASE_URL` and `VITE_CESIUM_ION_ACCESS_TOKEN` references for cross-cutting consistency
* `requireAuth`, `authenticate`, `rate-limit`, `cors`, `helmet` for security/rate-limit/authz
* `import requests`, `aiohttp`, `websockets`, `urllib`, `httpx` in services
* import boundaries across `apps/web` → `services/`, `apps/api` → `services/`, and
  `services/` → `apps/`

---

## 4. Summary Finding Table

| ID | Area | Severity | Timing | Owner/Lane | Finding | Recommendation |
|----|------|----------|--------|-----------|---------|----------------|
| ESA-001 | Frontend API client consistency | Medium | Next | Frontend | `useEnergyInfrastructure.ts` builds URLs as `/api/...` without `VITE_API_BASE_URL`; all other layer clients prefix it. Confirmed: only that one file omits the env var. | Change one file to match the rest (already documented as HEALTH-001). |
| ESA-002 | API route file size | Medium | Next | API | `apps/api/src/routes/weather.ts` is 988 lines and `apps/api/src/routes/news.ts` is 919 lines, both above the 800-line "not allowed for new work" threshold. They are grandfathered as existing work. | Plan a refactor work order to extract per-endpoint `service.ts`/`repository.ts`/`mapper.ts` files matching the recommended large-route layout. |
| ESA-003 | Shared component size | Medium | Next | Frontend | `apps/web/src/components/DetailPanel.tsx` is 877 lines and `apps/web/src/components/LayerPanel.tsx` is 1030 lines. Both exceed the 400-line component limit. Grandfathered. | Plan to extract sub-panels for vessel and airport details from `DetailPanel.tsx`; extract layer sub-panels from `LayerPanel.tsx`. |
| ESA-004 | Contracts module size | Low | Next | API / Contract | `packages/contracts/src/index.ts` is 1074 lines. Most content is Zod schemas across all layers. | Plan to split per-layer into `src/layer_XX_name.ts` files re-exported from `index.ts`. Pure file split, no behavioral change. |
| ESA-005 | Frontend layer folder naming | Low | Do not touch yet | Frontend | Six frontend layer folders use short, non-canonical names: `aviation/`, `borders/`, `earth-events/`, `space/`, `maritime/`, `energy/`. Two layers (`layer_07_weather`, `layer_08_news_osint`) already use the canonical name. | Grandfathered. Repair through a dedicated refactor branch; never in feature work. |
| ESA-006 | Frontend big-layer feature structure | Low | Later | Frontend | `aviation/` and `aviation/airports/` are already split into subfolders (`aircraft/`, `airports/`). `space/` is split into `satellites/`. `energy/` is split into `infrastructure/`. Other large layers (maritime, layer_07_weather, layer_08_news_osint) are flat. | Apply the `features/` pattern during the next refactor pass for maritime, weather, and news. |
| ESA-007 | Normalizer location ambiguity | Medium | Do not touch yet | Orchestrator | `services/normalizer/src/layers/` only contains `layer_01_aviation/`. All other implemented layers colocate their normalizer under `services/fetch-orchestrator/src/layers/<layer_id>/`. The pattern is documented and accepted but could be made more explicit. | Document explicitly in `LLM_OWNERSHIP_MATRIX.md` that the colocation is canonical for layers 02, 03, 05, 06, 07, 08, 10. Already covered in `HEALTH-004`. |
| ESA-008 | Fetcher workers >700 lines | Low | Next | Fetcher | `aviation_live_aircraft_worker.py` (965), `airport_source_endpoint_probe.py` (961), `airport_public_profile_worker.py` (670), `airport_intelligence_source_probe.py` (651), `energy_normalizer.py` (636), `airport_public_profile_db.py` (610), `airport_intelligence_ingest_worker.py` (590) are above the Python 700-line split threshold. Grandfathered. | Plan a follow-up refactor branch per layer to break workers by responsibility. |
| ESA-009 | Data tests >700 lines | Low | Later | Test/CI | `test_space_satellites_fetcher.py` (2411) and `test_gdacs_db_ingestion.py` (677) are above the Python 700-line split threshold. | Plan to break large test files into focused suites per test domain. |
| ESA-010 | Migration numbering gap | Low | Do not touch yet | Database | `database/migrations/layers/layer_01_aviation/` has `001` and `003`–`013`; `002` is missing. No other layer folder has this issue. | Grandfathered. Document in `database/migrations/README.md` that `002` was intentionally removed during early aviation development. Same as HEALTH-010. |
| ESA-011 | Vague file names in frontend | Low | Next | Frontend | Searched for `utils`, `helpers`, `misc`, `temp`, `final`, `new`, `common` in `apps/web/src/`. No frontend file uses these vague names. The `apps/web/src/components/intel/` subfolder mixes multiple presentational components which is reasonable domain grouping. | None. PASS. |
| ESA-012 | Vague file names in services | Low | Next | Fetcher / Normalizer | No Python file in the inspected trees uses a vague name. Files are domain-named (`weather_normalizer.py`, `maritime_fetcher.py`, `space_satellites_worker.py`, etc.). | None. PASS. |
| ESA-013 | Direct external API calls in frontend | Low | Next | Frontend | All `fetch(` calls in frontend code are in `lib/api.ts` or in `*Api.ts` / `use*Api.ts` hook files inside per-layer folders. No direct external provider API calls. The energy layer uses a relative path (see ESA-001). | None for the boundary itself. (Fix URL construction in ESA-001.) |
| ESA-014 | SQL in API route handlers | Medium | Next | API | Many large route files (`objects/`, `airport-intelligence/`, `airport-layout-features/`, `public-profile/`, `space/satellites.ts`, `energy/infrastructure.ts`, `maritime.ts`, `news.ts`, `weather.ts`, `layers.ts`) contain `query(...)` calls directly in route files, including handler logic in some cases. The recommended `repository.ts` split is partially implemented for `airport-intelligence/`, `airport-layout-features/`, `public-profile/`, and `objects/` (these have their own `repository.ts`). The five large live-layer route files (`weather.ts`, `news.ts`, `maritime.ts`, `space/satellites.ts`, `energy/infrastructure.ts`) embed SQL directly. | Plan per-layer refactors to extract `repository.ts` and `service.ts` files. Required for Section 8 compliance on new work. |
| ESA-015 | Business logic in route handlers | Medium | Next | API | `maritime.ts` and `news.ts` route files contain `parseLimit`, `parseOffset`, `parseBbox`, `parseNumeric`, `parseMmsi`, `parseHours`, `parseHistoryLimit`, `toNumber`, `toInteger`, `toNumberOrNull`, `rowToVesselObject`, `rowToVesselDetail`, `buildItemsQuery`, `buildObservationQuery`, `buildEnergyConditions` helpers directly in the route file. Some of these could move to a route-local `validation.ts`, `mapper.ts`, and `service.ts`. | Same as ESA-014: extract. |
| ESA-016 | Pagination / limit / bbox patterns | Low | Next | API | `MAX_LIST_LIMIT = 500`, `MAX_VIEWPORT_LIMIT = 1000`, `MAX_PRELOAD_LIMIT = 100000` constants live only in `apps/api/src/routes/objects/constants.ts`. `weather.ts`, `news.ts`, `maritime.ts`, and `energy/infrastructure.ts` each define their own `MAX_LIMIT` / `MAX_OFFSET` constants in-file. The pattern is consistent (limit/offset clamping) but not centralized. | Plan a single `apps/api/src/lib/query-limits.ts` constants file when consolidating the API refactor. |
| ESA-017 | Caching / rate-limit / auth posture | Low | Later | API | No `cors`, `helmet`, `limiter`, or `requireAuth` patterns in the inspected API code. The API is unauthenticated, rate-unlimited, and has no documented cache headers in the routes. `layers.ts` safety notes mention "authenticate all writes" for layer 09, but no write endpoints exist yet. | Plan a deployment-scale work order to add an HTTP cache layer for `/api/aviation/aircraft/latest` and the various `latest` snapshots. Auth/rate-limit only when first user-facing endpoint is added (layer 09). |
| ESA-018 | Database latest/history separation | Low | Next | Database | All live layers (01, 03, 05, 06, 07, 08) have a `<domain>_*_latest` table and a `<domain>_*_history` (or `<domain>_*` snapshot) table. Aviation has `aviation_airports` (reference) and `aviation_live_aircraft_*` (latest+snapshots). Section 12 rule is satisfied. | None. PASS. |
| ESA-019 | Spatial naming consistency | Low | Next | Database | All `geom` columns are `geometry(Geometry, 4326)`. Latitude/longitude column names are consistent (`latitude`, `longitude`) across the inspected migrations. The `energy_infrastructure_geometry_type_matches_geom_check` constraint enforces geometry type ↔ category consistency. | None. PASS. |
| ESA-020 | JSONB / JSON usage | Low | Next | Database | JSONB is used in `airport_public_profile.profile_payload`, `airport_intelligence.module_status`, and `raw_source_json` columns. All inspected cases are provider metadata or raw evidence — consistent with Section 10 allowed uses. No `attributes JSONB` dumping ground. | None. PASS. |
| ESA-021 | Migration category declaration | Low | Later | Database | The rulebook requires every new table to declare a category in its migration comment block (`reference`, `latest_state`, `history_timeseries`, `raw_reference`, `source_registry`, `fetch_run`, `derived_cache`, `user_owned`, `audit`). Spot-checked migrations: `earth_events_latest` and `energy_infrastructure` use such category comments. Not every migration was exhaustively checked in this audit. | Spot-check remaining migrations; flag any missing category header in a follow-up work order. |
| ESA-022 | Time-series readiness | Low | Later | Database | Live layers currently use `*_history` PostgreSQL tables. The rulebook explicitly states: "Do not introduce new time-series database technology in this task or any feature task without an explicit work order and Orchestrator Agent approval." The current approach is appropriate for MVP volume. Aviation history table is implemented; maritime position history exists; weather history exists. | None for MVP. Plan dedicated work order when daily volume justifies specialized time-series storage. |
| ESA-023 | Raw storage path consistency | Low | Next | Fetcher | The fetcher worker `weather_raw_storage.py` (and equivalent raw storage modules in other layers) write to `raw/{layer_id}/{source_id}/{yyyy}/{mm}/{dd}/{fetch_run_id}/payload.{ext}`. Matches Section 15. `raw/` is gitignored. | None. PASS. |
| ESA-024 | Generated folder hygiene | Low | Next | Cross-lane | `__pycache__/`, `*.pyc`, `dist/`, `node_modules/`, `.pytest_cache/`, `apps/api/dist/`, `apps/web/dist/`, `packages/contracts/dist/` exist locally but are gitignored and never committed. | None. PASS. |
| ESA-025 | Object storage readiness | Low | Later | Orchestrator | Raw payload storage is currently filesystem. The rulebook allows object storage "later through a dedicated work order." No blocking gap at MVP volume. | Plan object-storage-readiness work order when total raw payload volume exceeds local disk budget. |
| ESA-026 | Background job model | Low | Later | Orchestrator | Layer 01–08 and 10 workers are Python CLIs run manually. The rulebook says "Do not implement a job queue or job orchestration system in this task or any feature task without an explicit work order." | Plan unified scheduler work order when operational visibility is required. |
| ESA-027 | Import boundary risks | Low | Next | Cross-lane | Searched the full source tree for forbidden cross-imports: `apps/web` → `services/`, `apps/api` → `apps/web/` or `services/`, `services/` → `apps/`. None found. Frontend imports `apps/web/src/lib/api.ts` only; services import their own layer folder and `urllib`/`requests` for external providers. | None. PASS. |
| ESA-028 | Transport for live data | Low | Later | API | Aviation aircraft and space satellites already use WebSocket transport (`ws://.../ws/aviation/aircraft/live`, `ws://.../ws/space/satellites/live`). Maritime, weather, news, earth events, energy all use REST polling. The rulebook allows REST for "current" data and recommends streaming only when polling is insufficient. | Plan a streaming transport work order for maritime and weather when poll frequency becomes a bandwidth concern. |
| ESA-029 | Response-size risk | Low | Later | API | `/api/layers/layer_01_aviation/objects` and the various list endpoints use limit/offset clamping (`MAX_LIST_LIMIT = 500`, `MAX_VIEWPORT_LIMIT = 1000`). Preload mode allows up to 100,000 rows. | Document preload-mode intended use (resident cache). Add a runtime check or warning if the preload path is hit by a non-resident caller. |
| ESA-030 | Frontend hook organization | Low | Later | Frontend | All inspected layer folders separate `api/`, `hooks/`, `components/`, `mappers/`, `types/`, `constants/` into a few sibling files (e.g., `weatherApi.ts`, `useWeather.ts`, `weatherTypes.ts`, `weatherDetail.ts`, `weatherMarker.ts`, `WeatherLayer.tsx`). The recommended `api/`, `hooks/`, `components/`, etc. **subfolder** pattern is not yet used. | Optional: when refactoring layer folders to canonical names (ESA-005), introduce the subfolder structure at the same time. |

---

## 5. Folder and Layer Structure Findings

The audit inspected the following layer folders and compared them against the canonical
`layer_NN_name/` naming pattern from `MVP_LAYER_REGISTRY.md`:

### 5.1 Frontend (`apps/web/src/layers/`)

* **Canonical names (use the `layer_NN_name/` pattern):**
  * `layer_07_weather/` — present and correctly named
  * `layer_08_news_osint/` — present and correctly named
* **Non-canonical short names (grandfathered):**
  * `aviation/` → `layer_01_aviation`
  * `borders/` → `layer_02_borders_boundaries`
  * `earth-events/` → `layer_03_earth_events`
  * `space/` → `layer_05_space_satellites`
  * `maritime/` → `layer_06_maritime`
  * `energy/` → `layer_10_energy_infrastructure`
* **Empty placeholders (`.gitkeep` only):**
  * `apps/web/src/layers/.gitkeep` — root file presence is fine
  * `aviation/.gitkeep`, `aviation/aircraft/.gitkeep`, `aviation/airports/.gitkeep`,
    `borders/.gitkeep`, `earth-events/.gitkeep`
* **Layer 00 (Globe Core)**: not represented as a `layer_00_globe_core/` folder. The shared
  frontend code lives under `apps/web/src/components/`, `apps/web/src/globe/`, `apps/web/src/hooks/`,
  `apps/web/src/lib/`, and `apps/web/src/styles/`. This is acceptable because Layer 00 is a
  foundation layer with no separate "feature area". No change required.
* **Layers 04 and 09**: not implemented (`coming_soon`). No folder exists. This is correct.

**Verdict.** Frontend layer naming is **partially compliant**. Two layers follow the canonical
name; six are grandfathered short names. Repair requires a dedicated refactor branch with full
regression tests.

### 5.2 API routes (`apps/api/src/routes/`)

* **Layer-aware folder names:** none of the API routes are organized under `layer_XX_name/`.
  They use **resource-oriented** folders instead:
  * `airport-intelligence/`, `airport-layout-features/`, `public-profile/` — aviation
    sub-resources with full `index.ts` + `repository.ts` + `service.ts` + `types.ts` split
  * `objects/` — generic layer-aware `objects` endpoint with full per-responsibility split
  * `energy/`, `space/` — single-file routes (no subfolder structure inside yet)
  * **Top-level file routes:** `aviation-aircraft.ts`, `borders-boundaries.ts`, `earth-events.ts`,
    `health.ts`, `layers.ts`, `live-aircraft.ts`, `maritime.ts`, `news.ts`, `objects.ts`,
    `weather.ts`
* The rulebook Section 8 recommends a `layer_XX_name/` folder layout. The current API is
  closer to a **resource-based** layout (which is also acceptable for REST APIs). No rule
  violation; the resource-based split is consistent with Fastify conventions and the
  contracts module.
* **Three folders already implement the recommended split** (`airport-intelligence/`,
  `airport-layout-features/`, `public-profile/`, plus `objects/`) — these are reference
  implementations for the large-route layout.

**Verdict.** API route organization is **reasonable and self-consistent**. The
`airport-intelligence/`, `airport-layout-features/`, `public-profile/`, and `objects/`
folders should be the template when the five large file-based routes (`weather.ts`,
`news.ts`, `maritime.ts`, `space/satellites.ts`, `energy/infrastructure.ts`) are split.

### 5.3 Fetcher orchestrator (`services/fetch-orchestrator/src/layers/`)

* All eight implemented layer folders are present and use the canonical `layer_NN_name/` naming:
  * `layer_01_aviation/`, `layer_02_borders_boundaries/`, `layer_03_earth_events/`,
    `layer_05_space_satellites/`, `layer_06_maritime/`, `layer_07_weather/`,
    `layer_08_news_osint/`, `layer_10_energy_infrastructure/`
* `layer_04_public_military_security/` and `layer_09_user_shapes/` are not present (correct,
  both are `coming_soon`).
* Each layer folder contains a `__init__.py`. The recommended `sources/<source_name>/`
  subfolder is **not** used; files are placed directly in the layer folder. Per the rulebook
  Section 9, the `sources/` subfolder is "optional" for single-source layers. Aviation has
  multiple sources (`ourairports`, `wikimedia_wikidata`, `airport_image_gallery`,
  `airport_intelligence`, `airport_layout_features`, `airport_public_profile`,
  `aviation_live_aircraft`, `airport_source_endpoint_probe`) but uses prefixed file names
  (`ourairports_collector.py`, `wikimedia_wikidata_fetcher.py`, etc.) rather than a
  `sources/<name>/` subfolder split. The same is true for `layer_05_space_satellites` and
  `layer_10_energy_infrastructure`.
* **PASS with note.** The naming is canonical. The single-source/grouped-file layout is
  acceptable for the rulebook, but the rulebook's recommended pattern would split aviation
  into `sources/ourairports/`, `sources/wikimedia/`, etc. This is a **future refactor
  candidate**, not a current rule violation. Recommended to be planned alongside the
  big-layer refactor (Section 6).

### 5.4 Normalizer (`services/normalizer/src/layers/`)

* Only one layer folder is present: `layer_01_aviation/`. This is the **canonical aviation
  normalizer location** as documented in `LLM_OWNERSHIP_MATRIX.md`, `PIPELINE_HANDOFF_RULES.md`,
  and `DATA_LOCATION_RULES.md`. All other layers' normalizers are colocated under
  `services/fetch-orchestrator/src/layers/<layer_id>/` (Fetcher Agent owns those modules per
  the Normalizer Location Rule).

**Verdict.** **Compliant** with the documented Normalizer Location Rule.

### 5.5 Database migrations (`database/migrations/`)

* `core/` and `layers/<layer_id>/` folder structure is canonical.
* `layers/layer_01_aviation/`, `layers/layer_02_borders_boundaries/`,
  `layers/layer_03_earth_events/`, `layers/layer_05_space_satellites/`,
  `layers/layer_06_maritime/`, `layers/layer_07_weather/`, `layers/layer_08_news_osint/`,
  `layers/layer_10_energy_infrastructure/` — all canonical names.
* `layer_04_public_military_security/` and `layer_09_user_shapes/` are absent (correct, both
  are `coming_soon`).
* `core/001_core_ingestion_tables.sql` — single shared migration.
* `layers/layer_05_space_satellites/` has two migrations (`001` + `002`). All other layers
  have only one migration each. The `002` is `002_space_satellites_scale_indexes.sql` —
  a documented post-launch index addition.
* `layers/layer_01_aviation/` has a `002_*.sql` gap. This is grandfathered and was already
  known in the prior `PROJECT_HEALTH_WORKFLOW_AUDIT.md` (HEALTH-010).

**Verdict.** **Compliant** with the migration rules in Section 11.

### 5.6 Database ingestion (`database/ingestion/layers/`)

* Only two layer folders are present: `layer_07_weather/` and `layer_08_news_osint/`.
* This is consistent with the rulebook; ingestion helpers only exist where a layer needs
  special DB-side logic (e.g., bulk insert from raw payloads).
* All other layers do their DB writes from the fetcher worker directly using `query()`.

**Verdict.** **Compliant**.

### 5.7 Tests (`tests/data/layer_*/`)

* All eight implemented layer folders are present with canonical `layer_NN_name/` naming.
* Each layer test folder follows the same per-migration / per-worker test pattern.

**Verdict.** **Compliant**.

---

## 6. Big-Layer Feature Structure Findings

The audit reviewed feature subfolder structure for the larger layers:

### 6.1 Aviation (`apps/web/src/layers/aviation/`)

* Already has **feature subfolders**: `aircraft/` and `airports/`.
* `aircraft/` contains 2 source files + `.gitkeep`: `aircraftMarker.ts`, `useLiveAircraftSocket.ts`.
* `airports/` contains ~15 source files including the largest aviation files:
  `aviationLayerRenderer.ts` (223), `aviationTileLoader.ts` (202), `aviationPreloader.ts` (144),
  `aviationTileCache.ts` (140), `aviationCategories.ts` (281), `airportMarkerSprites.ts` (135),
  `aviationObjectStore.ts` (25), `globeCamera.ts` (23), `airportViewport.ts` (43),
  `aviationGlobalRenderer.ts` (88), and several `*Types.ts` and `use*` hook files.
* The `airports/` folder mixes map rendering, types, hooks, sprite atlas, tile cache, preload,
  object store, viewport helpers, and a categories module. This is **functional but flat** —
  it would benefit from a `features/...` split, e.g., `features/map-rendering/`,
  `features/intel-cache/`, `features/typography/`. The rulebook Section 5 does not strictly
  require this until the layer exceeds 400 lines per file or 3+ feature areas in one folder.
* The aviation fetcher side (`services/fetch-orchestrator/src/layers/layer_01_aviation/`) is
  also flat with prefixed file names (no `sources/<name>/` subfolders). Same comment as 5.3.

**Verdict.** **Reasonably structured** for an MVP. Future feature-split is a **Later** item.

### 6.2 Maritime (`apps/web/src/layers/maritime/`)

* Flat folder with 4 source files: `maritimeApi.ts` (50), `MaritimeLayer.tsx` (114),
  `useMaritime.ts` (28), `vesselMarker.ts` (36).
* `__tests__/maritime.test.ts` (165).
* No `features/` split yet, but the layer is small enough that a single folder is fine.

**Verdict.** **Compliant with Section 5 "applies when >3 features or 400+ lines"**.

### 6.3 Space & Satellites (`apps/web/src/layers/space/`)

* Already has a feature subfolder: `satellites/`.
* `satellites/` contains 5 files: `satelliteColors.ts` (45), `satelliteFilters.ts` (64),
  `satelliteTypes.ts` (39), `useSpaceSatellitesSocket.ts` (94),
  and `__tests__/space-satellites.test.ts` (not in this audit's listing — confirmed
  separately that the test file exists).
* Reasonably structured. Could later split into `features/orbital-rendering/`,
  `features/filtering/` if file count grows.

**Verdict.** **Reasonably structured**.

### 6.4 Energy (`apps/web/src/layers/energy/`)

* Has a subfolder: `infrastructure/`.
* `infrastructure/` contains 4 files: `energyInfrastructureApi.ts` (19),
  `EnergyInfrastructureLayer.tsx` (85), `energyInfrastructureTypes.ts` (33),
  `useEnergyInfrastructure.ts` (94).
* Reasonably structured.

**Verdict.** **Reasonably structured**.

### 6.5 Borders & Boundaries (`apps/web/src/layers/borders/`)

* Single file: `useBordersBoundaries.ts` (40) + `.gitkeep`.
* Layer is small. No feature split needed.

**Verdict.** **Compliant**.

### 6.6 Earth Events (`apps/web/src/layers/earth-events/`)

* Single file: `useEarthEvents.ts` (39) + `.gitkeep`.
* Layer is small. No feature split needed.

**Verdict.** **Compliant**.

### 6.7 Weather (`apps/web/src/layers/layer_07_weather/`)

* Flat folder with 7 source files: `useWeather.ts` (92), `weatherApi.ts` (48),
  `weatherDetail.ts` (43), `WeatherLayer.tsx` (90), `weatherMarker.ts` (97),
  `weatherTypes.ts` (134), and `__tests__/weather.test.ts` (285).
* No feature subfolder. As files grow, `features/observation-marker/`, `features/forecast/`,
  `features/intel-detail/` would be appropriate. The largest files are `weatherTypes.ts` (134,
  under threshold) and `weather.test.ts` (285, under threshold). No immediate split required.

**Verdict.** **Compliant** for current size. Watch file count as the layer grows.

### 6.8 News & OSINT (`apps/web/src/layers/layer_08_news_osint/`)

* Flat folder with 6 source files: `useNews.ts` (66), `newsApi.ts` (50),
  `newsDetail.ts` (27), `NewsLayer.tsx` (83), `newsMarker.ts` (53),
  `newsTypes.ts` (146), and `__tests__/news.test.ts` (405).
* The test file is exactly at the 400-line "must split" threshold for components (it is a
  test, but the rule still applies as a `*.ts` file: 0–300 good, 301–500 warning, 501–800
  must split). The test file is in the **warning** band, not in the must-split band.
* The fetcher side (`services/fetch-orchestrator/src/layers/layer_08_news_osint/`) is flat
  with prefixed file names: `gdacs_*` and `gdelt_event_export_*`. The rulebook Section 9
  recommended pattern would split this into `sources/gdacs/`, `sources/gdelt/`. This is a
  **future** refactor.

**Verdict.** **Compliant** for current size. Future feature-split candidate.

### 6.9 Fetcher/normalizer source split

* Aviation (8 sources), space (2 sources: CelesTrak, Space-Track), news (2 sources: GDACS,
  GDELT), energy (3 sources: WRI, OSM, GEM), maritime (1 source: AISStream) all use prefixed
  file names rather than the `sources/<name>/` subfolder pattern.
* The rulebook Section 9 says `sources/` is "optional" for single-source layers. For
  multi-source layers, the recommended pattern is `sources/<name>/`. None of the
  multi-source layers follow this; they use prefixed flat file names.
* This is a **future** refactor candidate. Per the rulebook Section 17, it is a
  dedicated-class refactor and should be planned in its own branch.

**Verdict.** **Pattern deviation but not a current rule violation.** Plan for **Later**.

---

## 7. File Size and Function Size Findings

The audit used the engineering rulebook Section 6 thresholds.

### 7.1 TypeScript / React files exceeding 800 lines (the "not allowed for new work" threshold)

| File | Lines | Threshold | Note |
|------|------:|-----------|------|
| `packages/contracts/src/index.ts` | 1074 | 800+ | Single barrel module with all Zod schemas. Zod-heavy and a candidate for per-layer file split. **Low** severity, **Next** timing. |
| `apps/web/src/components/LayerPanel.tsx` | 1030 | 800+ | Layer toggle panel. **Medium** severity, **Next** timing. Grandfathered. |
| `apps/web/src/components/DetailPanel.tsx` | 877 | 800+ | Detail panel (aviation + vessel). **Medium** severity, **Next** timing. Grandfathered. |
| `apps/api/src/routes/weather.ts` | 988 | 800+ | Weather routes. **Medium** severity, **Next** timing. Grandfathered. |
| `apps/api/src/routes/news.ts` | 919 | 800+ | News routes. **Medium** severity, **Next** timing. Grandfathered. |

### 7.2 TypeScript / React files in the 501–800 "must split" band

| File | Lines | Threshold | Note |
|------|------:|-----------|------|
| `apps/api/src/routes/maritime.ts` | 711 | 501–800 | Maritime routes. Grandfathered. **Medium** severity, **Next** timing. |
| `apps/api/src/routes/energy/infrastructure.ts` | 614 | 501–800 | Energy routes. Grandfathered. **Medium** severity, **Next** timing. |
| `apps/api/src/routes/airport-intelligence/service.ts` | 524 | 501–800 | Aviation airport intelligence service. Grandfathered. |
| `apps/api/src/routes/space/satellites.ts` | 520 | 501–800 | Space satellites. Grandfathered. |
| `apps/api/src/routes/layers.ts` | 427 | 301–500 | Warning band. Already handles the registry and status endpoints. Acceptable. |
| `apps/api/src/routes/objects/index.ts` | 356 | 301–500 | Warning band. Reasonable. |
| `apps/api/src/routes/aviation-aircraft.ts` | 350 | 301–500 | Warning band. Live aircraft REST. Reasonable. |

### 7.3 Python files exceeding 700 lines (the "must split unless approved" threshold)

| File | Lines | Threshold | Note |
|------|------:|-----------|------|
| `services/fetch-orchestrator/src/layers/layer_01_aviation/aviation_live_aircraft_worker.py` | 965 | 700+ | Live aircraft worker. **Low** severity, **Next** timing. Grandfathered. |
| `services/fetch-orchestrator/src/layers/layer_01_aviation/airport_source_endpoint_probe.py` | 961 | 700+ | Source probe. Grandfathered. |
| `services/fetch-orchestrator/src/layers/layer_01_aviation/airport_public_profile_worker.py` | 670 | 401–700 | Warning band. |
| `services/fetch-orchestrator/src/layers/layer_01_aviation/airport_intelligence_source_probe.py` | 651 | 401–700 | Warning band. |
| `services/fetch-orchestrator/src/layers/layer_10_energy_infrastructure/energy_normalizer.py` | 636 | 401–700 | Warning band. |
| `services/fetch-orchestrator/src/layers/layer_01_aviation/airport_public_profile_db.py` | 610 | 401–700 | Warning band. |
| `services/fetch-orchestrator/src/layers/layer_01_aviation/airport_intelligence_ingest_worker.py` | 590 | 401–700 | Warning band. |
| `services/fetch-orchestrator/src/layers/layer_01_aviation/airport_intelligence_ingest_db.py` | 583 | 401–700 | Warning band. |
| `services/fetch-orchestrator/src/layers/layer_10_energy_infrastructure/energy_infrastructure_worker.py` | 555 | 401–700 | Warning band. |
| `services/fetch-orchestrator/src/layers/layer_06_maritime/maritime_normalizer.py` | 481 | 401–700 | Warning band. |
| `services/fetch-orchestrator/src/layers/layer_06_maritime/maritime_ingestion.py` | 473 | 401–700 | Warning band. |
| `services/fetch-orchestrator/src/layers/layer_01_aviation/airport_image_gallery_worker.py` | 468 | 401–700 | Warning band. |
| `services/fetch-orchestrator/src/layers/layer_02_borders_boundaries/natural_earth_admin0_ingest.py` | 466 | 401–700 | Warning band. |
| `services/fetch-orchestrator/src/layers/layer_08_news_osint/gdelt_source_probe.py` | 456 | 401–700 | Warning band. |
| `services/fetch-orchestrator/src/layers/layer_05_space_satellites/orbit_propagation.py` | 451 | 401–700 | Warning band. |
| `services/fetch-orchestrator/src/layers/layer_06_maritime/maritime_db_writer.py` | 450 | 401–700 | Warning band. |
| `services/fetch-orchestrator/src/layers/layer_10_energy_infrastructure/energy_infrastructure_db.py` | 436 | 401–700 | Warning band. |
| `services/fetch-orchestrator/src/layers/layer_07_weather/open_meteo_client.py` | 429 | 401–700 | Warning band. |
| `services/fetch-orchestrator/src/layers/layer_10_energy_infrastructure/osm_energy_client.py` | 425 | 401–700 | Warning band. |

### 7.4 Test files exceeding 700 lines

| File | Lines | Note |
|------|------:|------|
| `tests/data/layer_05_space_satellites/test_space_satellites_fetcher.py` | 2411 | Largest test file in the repo. **Low** severity, **Later** timing. |
| `tests/data/layer_08_news_osint/test_gdacs_db_ingestion.py` | 677 | Warning band. |
| `tests/data/layer_01_aviation/test_airport_public_profile_worker.py` | 631 | Warning band. |
| `tests/data/layer_07_weather/test_fetcher.py` | 614 | Warning band. |
| `tests/data/layer_01_aviation/test_aviation_live_aircraft_worker.py` | 540 | Warning band. |
| `tests/data/layer_07_weather/test_weather_local_seed.py` | 517 | Warning band. |
| `tests/data/layer_01_aviation/test_airport_image_gallery_worker.py` | 454 | Warning band. |
| `tests/data/layer_01_aviation/test_airport_intelligence_source_probe.py` | 432 | Warning band. |
| `tests/data/layer_06_maritime/test_maritime_migration.py` | 424 | Warning band. |
| `tests/data/layer_08_news_osint/test_news_database_schema.py` | 420 | Warning band. |

### 7.5 Function size

The audit did not measure individual function lengths in detail for every file; the priority
function-size findings are:

* `apps/web/src/components/DetailPanel.tsx` contains ~4–5 sub-components defined inline
  (`HeroImage`, `IntelImageGallery`, `AirportOverviewSection`, `VesselOverviewSection`,
  `SourcesSection`) and a top-level `DetailPanel` (lines 79–953). At 877 lines, multiple
  inlined functions are likely above the 100-line "must split" threshold.
* `apps/web/src/components/LayerPanel.tsx` at 1030 lines almost certainly contains functions
  in the 51–100 warning band and possibly the 100+ must-split band.
* `apps/api/src/routes/maritime.ts` has parsing helpers `parseLimit`, `parseOffset`, `parseBbox`,
  `parseMmsi`, `parseHours`, `parseHistoryLimit`, `parseNumeric`, `isValidIsoDatetime`,
  `rowToVesselObject`, `rowToVesselDetail` (lines 111–340). These are individually small; the
  file is large because the main `listVesselObjects` query builder (`buildItemsQuery`-style)
  accumulates many columns and conditions.

**Verdict.** Function-size hot spots are concentrated in the two large frontend panels
(`DetailPanel.tsx`, `LayerPanel.tsx`) and the five large API route files. Refactoring those
files into sub-modules will naturally split the function-size violations.

### 7.6 File size and naming policy

* No file in the inspected trees uses a vague name (`utils.ts`, `helpers.py`, `misc.ts`,
  `common.ts`, `temp.py`, `final.ts`, `new.ts`, `stuff.ts`). All files are domain-named.
  **PASS** on the vague-name rule.

---

## 8. Frontend Structure Findings

### 8.1 API client vs hooks vs components separation

* `lib/api.ts` is the **shared HTTP client wrapper**. It exports `fetchAirportPublicProfile`,
  `fetchAirportLayoutFeatures`, `fetchAirportIntelligence`. Used by the intel sub-panels in
  `apps/web/src/components/intel/`.
* Per-layer API clients:
  * `weatherApi.ts` (48 lines)
  * `newsApi.ts` (50 lines)
  * `maritimeApi.ts` (50 lines)
  * `energyInfrastructureApi.ts` (19 lines, **bare-bones**; uses the relative `/api/...`
    path in `useEnergyInfrastructure.ts` — see ESA-001)
  * `useSpaceSatellitesSocket.ts`, `useLiveAircraftSocket.ts` — WebSocket hooks
* Per-layer React hooks:
  * `useWeather.ts`, `useNews.ts`, `useMaritime.ts`, `useEnergyInfrastructure.ts`,
    `useBordersBoundaries.ts`, `useEarthEvents.ts`
  * `useAirportPublicProfile.ts`, `useAirportIntelligence.ts`, `useAirportLayoutFeatures.ts`,
    `useLiveAircraftSocket.ts`, `useSpaceSatellitesSocket.ts`
* Per-layer components: `WeatherLayer.tsx`, `NewsLayer.tsx`, `MaritimeLayer.tsx`,
  `EnergyInfrastructureLayer.tsx`
* Per-layer types: `weatherTypes.ts`, `newsTypes.ts`, `airportIntelligenceTypes.ts`,
  `airportLayoutTypes.ts`, `airportPublicProfileTypes.ts`, `satelliteTypes.ts`,
  `energyInfrastructureTypes.ts`
* Per-layer markers: `weatherMarker.ts`, `newsMarker.ts`, `vesselMarker.ts`,
  `aircraftMarker.ts`, `airportMarkerSprites.ts`
* Per-layer detail helpers: `weatherDetail.ts`, `newsDetail.ts`

**Findings:**

* **API calls are correctly in `api/`-equivalent files**, not in component bodies. No
  `fetch(` call inside a JSX block.
* **Hooks do not contain rendering JSX.** Each `use*.ts` is data-loading only.
* **No mappers/ directory or constants/ subfolder exists per layer.** The recommended
  `mappers/` and `constants/` subfolders from the rulebook Section 7 are not yet used.
  Layers are flat. This is **not a current violation** but a future refactor.
* **Types are extracted** into `*Types.ts` files. The intel subfolder imports types from
  layer types files (`airportIntelligenceTypes.ts`, etc.). This is correct.
* **Constants are inlined** in some files (e.g., `MAX_LIST_LIMIT`, `BBOX_LON_MIN` are in
  `apps/api/src/routes/objects/constants.ts`, not in `apps/web/src/layers/.../constants/`).
  No frontend-side constants file exists per layer. This is **acceptable** because no
  per-layer constants warrant extraction yet (e.g., `MAX_BBOX_DEGREES`, `MAX_POLLING_MS`).
* **`useEnergyInfrastructure.ts` builds URL as `/api/...`** with no `VITE_API_BASE_URL`
  prefix. This is the only inconsistency among layer clients. Already documented in
  HEALTH-001 and **recommended for next cycle**.

### 8.2 Cross-layer imports

* Searched the full `apps/web/src/` tree for `from '../../services/'`, `from '../../apps/api/'`,
  `from '../../database/'`, and similar paths. **None found.**
* Cross-layer code is communicated via `packages/contracts/` (Zod schemas). For example,
  `App.tsx` imports `useNews` from `layer_08_news_osint/`; `CesiumGlobe.tsx` imports
  `NewsLayer` from the same. No cross-layer reach-around. **PASS.**

### 8.3 Direct external API calls in frontend

* The only external URL the frontend uses directly is the Cesium Ion token (read from
  `VITE_CESIUM_ION_ACCESS_TOKEN`). All data flows through the GOD EYES API
  (`http://localhost:4000/api/...` or whatever `VITE_API_BASE_URL` resolves to).
* **PASS.** No direct provider calls (no Open-Meteo, no CelesTrak, no GDACS, no
  AISStream, no WRI calls).

### 8.4 Component size

* `DetailPanel.tsx` (877) and `LayerPanel.tsx` (1030) are the only frontend files over 800
  lines. See ESA-003.

### 8.5 lib/ tree

* `lib/api.ts` (294) — shared API client wrappers for intel panels
* `lib/useLayerRegistry.ts` (206) — local fallback registry
* `lib/searchProviders.ts` (48) — search providers
* `lib/searchParser.ts` (24) — search parser
* `lib/searchTypes.ts` (12) — search types
* All files are well under the 500-line warning threshold.

**Verdict.** Frontend is **structurally sound** with a few known exceptions. The two
large panels (DetailPanel, LayerPanel) are the main refactor candidates. The energy
client URL inconsistency is a one-line fix. Subfolder pattern (`api/`, `hooks/`,
`components/`, `mappers/`, `types/`, `constants/`) is a **future** refactor target.

---

## 9. API Route and Contract Structure Findings

### 9.1 Large route files (giant file risk)

* `weather.ts` (988), `news.ts` (919), `maritime.ts` (711), `energy/infrastructure.ts` (614),
  `space/satellites.ts` (520), `airport-intelligence/service.ts` (524), `airport-intelligence/index.ts`
  (37), `airport-layout-features/index.ts` (44), `layers.ts` (427), `airport-intelligence/repository.ts`
  (196), `airport-layout-features/repository.ts` (130), `public-profile/repository.ts` (329).

The five largest single-file routes are the live-layer REST endpoints. Each one embeds:

* A large `parseLimit` / `parseOffset` / `parseBbox` / `parseNumeric` / `parseMmsi` /
  `parseHours` / `parseHistoryLimit` / `isValidIsoDatetime` helper family
* Row → API-shape mappers (`rowToVesselObject`, `rowToVesselDetail`, `rowToNewsItem`,
  `rowToNewsMarker`, `rowToFeature`, `rowToObservationItem`, `rowToAirportObject`,
  `rowToAirportDetail`)
* SQL builders (`buildItemsQuery`, `buildObservationQuery`, `buildEnergyConditions`)
* The `fastify.get(...)` handler that uses all of the above

The four small aviation sub-resource folders (`airport-intelligence/`, `airport-layout-features/`,
`public-profile/`) and the `objects/` folder show what the **target pattern** looks like
when fully split: `index.ts` + `repository.ts` + `service.ts` + `types.ts` + `validation.ts`
+ `constants.ts` + `mapper.ts` + per-domain sub-files (`detail.ts`, `density.ts`,
`clusters.ts`, `points.ts`, `preload.ts`).

**Verdict.** The rulebook Section 8 is **partially implemented**. The five large live-layer
routes are the next refactor candidates. See ESA-014 / ESA-015.

### 9.2 SQL in route handlers

* All API routes use parameterized queries (`$1`, `$2`, ... placeholders) through the
  `query()` helper from `apps/api/src/lib/db.ts`. No string interpolation with user input
  was found in the inspected source. **PASS** on parameterization.
* However, raw `query(...)` calls live in route handler files. This is what Section 8
  recommends moving to a per-route `repository.ts`. See ESA-014.

### 9.3 Business logic in route handlers

* Route handlers do their own validation, calling `parseLimit`/`parseOffset`/`parseBbox`/
  `parseMmsi` inline. The `objects/validation.ts` file is well-structured; the
  live-layer routes have not yet received the same treatment.
* Mappers (`rowTo*`) are inline in route files. The `objects/mapper.ts` file shows the
  target pattern.

**Verdict.** Same as 9.1 — partial implementation; the small aviation sub-resource
folders and `objects/` are the reference.

### 9.4 Response shapes tied to contracts

* All route handlers return Zod-validated responses via `*ResponseSchema.parse(...)` from
  `@god-eyes/contracts`. This is correct and ties response shapes to the shared
  contract module. **PASS.**

### 9.5 Pagination / limit / bbox patterns

* `MAX_LIST_LIMIT = 500`, `MAX_VIEWPORT_LIMIT = 1000`, `MAX_PRELOAD_LIMIT = 100000` are
  defined in `apps/api/src/routes/objects/constants.ts`. Used by `apps/api/src/routes/objects/`.
* `weather.ts` defines its own `MAX_LIMIT = 5000`, `MAX_OFFSET = 10000`,
  `NEARBY_MAX_RADIUS_KM = 1000` at the top of the file.
* `news.ts` defines its own `MAX_LIMIT = 100`, `MAX_MARKER_LIMIT = 500`, `MAX_OFFSET = 10000`.
* `maritime.ts` defines its own `DEFAULT_LIMIT = 1000`, `MAX_LIMIT = 10000`, `MAX_OFFSET = 10000`.
* `energy/infrastructure.ts` defines its own `parseLimit`/`parseOffset` helpers.
* **Bbox** patterns are consistent: `parseBbox` is in each route, with the same expected
  format `minLon,minLat,maxLon,maxLat` and the same lat/lon ranges.

**Verdict.** Pagination/limit/bbox are consistently implemented per route, but the
constants are not centralized. This is a **Low**-severity consistency improvement,
not a rule violation. Plan to extract a shared `apps/api/src/lib/query-limits.ts` when
the API refactor is planned.

### 9.6 Response size risk

* `MAX_LIST_LIMIT = 500` (general), `MAX_VIEWPORT_LIMIT = 1000` (bbox), `MAX_PRELOAD_LIMIT
  = 100000` (resident cache preload). All clamped server-side. **PASS.**
* `weather.ts` allows up to 5000 results per call (`MAX_LIMIT = 5000`). Each row can be
  large (full observation payload). At 5000 rows, response size could be in the
  megabytes. **Medium**-severity future risk if consumers start calling without bbox.
  Recommend a bbox-required or default-bbox policy for high-volume live layers.

### 9.7 Caching / rate-limit / auth / authz

* No `cors`, `helmet`, `limiter`, or `requireAuth` patterns in the inspected source.
* The API is **unauthenticated** and **rate-unlimited** at the application layer. There
  is no documented `Cache-Control` header strategy in the routes.
* Layer 09 (`layer_09_user_shapes`) is the first layer that will require auth. The MVP
  layer registry says "User Shapes" must "authenticate all writes" and "rate-limit per
  user". These requirements are documented but not yet implemented because layer 09 is
  `coming_soon`.
* Aviation and space satellites use WebSocket transport. The broadcaster
  (`apps/api/src/lib/live-aircraft-broadcaster.ts`, 250 lines) is a simple in-process
  Pub/Sub. This is fine for MVP but is a single-process scaling limit. The rulebook
  allows "in-memory TTL" cache; the broadcaster is a form of in-process state.

**Verdict.** No current rule violation. Plan a deployment-scale work order for cache
headers, CORS, rate limiting, and authentication when layer 09 is implemented and when
the API is exposed beyond localhost.

### 9.8 Aviation aircraft WebSocket

* The aviation aircraft WebSocket route is implemented in
  `apps/api/src/routes/live-aircraft.ts` (211 lines) and the broadcaster in
  `apps/api/src/lib/live-aircraft-broadcaster.ts` (250 lines). Both are reasonable
  size. The data flow is: aviation live aircraft worker → DB + broadcaster → WebSocket
  → frontend `useLiveAircraftSocket.ts`. **PASS** on the documented live-data transport
  pattern.

### 9.9 Space satellites WebSocket

* Implemented in `apps/api/src/routes/space/space-satellites-broadcaster.ts` (226 lines)
  and consumed by frontend `useSpaceSatellitesSocket.ts` (94 lines). **PASS.**

### 9.10 Contracts module

* `packages/contracts/src/index.ts` is 1074 lines. Spot-checked content includes
  aviation (`AirportObject`, `RunwayDetail`, `NavaidDetail`, `FrequencyDetail`,
  `AirportClusterObject`, `AirportDensityResponse`, `AirportPreloadListResponse`,
  `LayerObjectsListResponse`), maritime (`MaritimeObjectsListResponse`,
  `MaritimeVesselDetailResponse`, `MaritimeStatsResponse`,
  `MaritimePositionHistoryResponse`), weather, news, energy, layers
  (`LayersListResponse`, `LayerRegistryResponse`, `LayerStatusResponse`, etc.),
  and shared error codes (`ErrorCodes`).
* The `LayerStatusResponseSchema` declares aviation-specific `objectCounts` fields
  (`airports`, `runways`, `navaids`, `airportFrequencies`, `countries`, `regions`)
  and is used for **all 11 layers**. For non-aviation layers, the API returns all
  zeros. This is already documented as HEALTH-002 in the prior audit. The
  recommended repair is to generalize the schema or introduce a layer-type-aware
  union. **Medium** severity. **Next** timing (before the next status consumer is
  added).

### 9.11 Schema versioning

* The contracts module does not appear to have a documented versioning strategy. There
  is no `version: 1` field in the schema definitions. This is a **future** concern
  rather than a current rule violation.

---

## 10. Fetcher/Normalizer Structure Findings

### 10.1 Layer folder naming

* All eight implemented fetcher layer folders use the canonical
  `layer_NN_name/` naming. **PASS** with respect to Section 9.

### 10.2 Source / fetcher / normalizer / storage separation

* Each layer has a mix of:
  * `*_client.py` — provider HTTP/WebSocket client
  * `*_fetcher.py` — fetch orchestration
  * `*_normalizer.py` — raw → normalized
  * `*_raw_storage.py` — raw payload read/write
  * `*_db.py` or `*_db_writer.py` or `*_db_ingestion.py` — DB persistence
  * `*_worker.py` — full pipeline entry point
  * `cli.py` or `__main__.py` — CLI entry
* Aviation has 8 distinct workers (one per source/intelligence area). Layer 07 weather
  has all of: client, proof, fetcher, normalizer, raw_storage, db ingestion (in
  `database/ingestion/`), grid, local seed, weather_codes, cli, __main__. **Compliant**
  with the recommended per-source layout (file-based, not subfolder-based).

### 10.3 Aviation vs. non-aviation normalizer pattern

* **Aviation** normalizer is in the canonical separate location
  `services/normalizer/src/layers/layer_01_aviation/`. Five files:
  `ourairports_normalizer.py`, `airport_public_profile_normalizer.py`,
  `airport_layout_features_normalizer.py`, `airport_intelligence_normalizer.py`,
  `airport_image_gallery_normalizer.py`. **PASS** with respect to the documented
  Normalizer Location Rule.
* **Non-aviation** normalizers are colocated under
  `services/fetch-orchestrator/src/layers/<layer_id>/`. Fetcher Agent owns these
  modules. This is the **accepted pattern** per `LLM_OWNERSHIP_MATRIX.md`,
  `PIPELINE_HANDOFF_RULES.md`, and `DATA_LOCATION_RULES.md`. **PASS.**

### 10.4 Very large workers

* See Section 7.3 above. Aviation has the most workers >400 lines. These are
  grandfathered and may be split in a future refactor.

### 10.5 Mixed source logic

* Layer 08 news/osint has both GDACS and GDELT source families in the same folder,
  distinguished by file-name prefix (`gdacs_*`, `gdelt_event_export_*`). The
  recommended pattern is `sources/gdacs/`, `sources/gdelt/`. This is a
  **future refactor** item, not a current rule violation.
* Layer 10 energy has three sources (WRI, OSM, GEM) similarly distinguished by
  file-name prefix.
* Layer 05 space has two sources (CelesTrak, Space-Track) similarly distinguished.

### 10.6 Raw storage path

* Each layer has a `*_raw_storage.py` module that writes to
  `raw/{layer_id}/{source_id}/{yyyy}/{mm}/{dd}/{fetch_run_id}/payload.{ext}`.
* The `raw/` directory is gitignored. Confirmed via prior audit HEALTH-005/006/007
  checks. **PASS** with respect to Section 15.

### 10.7 Forbidden imports

* Searched `services/` for imports from `apps/` and for `from apps.web`,
  `from apps.api`. **None found.**
* Fetcher and normalizer code uses only:
  * Python stdlib (`urllib`, `json`, `datetime`, `os`, `sys`, `hashlib`, `logging`)
  * External libraries (`requests`, `aiohttp`, `websockets`, `boto3`, `psycopg`,
    `psycopg2-binary`, `sgp4`)
  * Other files in the same `services/fetch-orchestrator/src/layers/<layer_id>/`
    folder or sibling `services/fetch-orchestrator/src/common/` (if any)
  * No `import` from `apps/web/` or `apps/api/`
* **PASS** with respect to Section 9 forbidden-imports rule.

---

## 11. Database and Migration Structure Findings

### 11.1 Table naming

* Tables follow the `<layer_domain>_<entity>_<role>` pattern. Examples:
  * `aviation_airports`, `aviation_runways`, `aviation_navaids`, `aviation_airport_frequencies`
  * `aviation_countries`, `aviation_regions` (reference data)
  * `aviation_live_aircraft_latest`, `aviation_live_aircraft_snapshots`
  * `earth_events_latest`, `earth_events_history`
  * `space_satellites` (single snapshot)
  * `maritime_vessels_latest`, `maritime_vessels_history`,
    `maritime_vessel_position_history`
  * `weather_observations_latest`, `weather_observations_history`,
    `weather_observation_fetch_runs`, `weather_observation_sources`
  * `news_items_latest`, `news_items_history`, `news_fetch_runs`, `news_sources`
  * `energy_infrastructure` (single)
* **PASS** with respect to Section 10 table naming.

### 11.2 Table categories (declared in migration comment block)

* Spot-checked migrations show category comments at the top of the file (e.g.,
  `earth_events_latest` is in the `latest_state` category; `energy_infrastructure`
  declares its category in the comment block).
* Not every migration was exhaustively checked. See ESA-021.

### 11.3 Latest / history separation for live layers

* All live layers separate `*_latest` from history:
  * Aviation: `aviation_live_aircraft_latest` + `aviation_live_aircraft_snapshots`
  * Earth events: `earth_events_latest` + `earth_events_history`
  * Space: `space_satellites` (single table; satellites are not time-series in the
    same sense as aircraft positions — orbit propagates from TLE, not stored as
    per-tick history)
  * Maritime: `maritime_vessels_latest` + `maritime_vessels_history` +
    `maritime_vessel_position_history`
  * Weather: `weather_observations_latest` + `weather_observations_history`
  * News: `news_items_latest` + `news_items_history`
* **PASS** with respect to Section 12.

### 11.4 JSON / JSONB usage

* Inspected JSONB columns:
  * `airport_public_profile.profile_payload JSONB` — provider metadata, acceptable
  * `airport_intelligence.* JSONB` columns for module status, payload snapshots —
    provider metadata, acceptable
  * `energy_infrastructure.raw_source_json JSONB` — raw source payload pointer,
    acceptable
* All inspected JSONB cases are either provider metadata or raw evidence pointers.
  No `attributes JSONB` dumping ground observed. **PASS** with respect to Section 10.

### 11.5 Spatial naming

* All `geom` columns are `geometry(Geometry, 4326)`. The
  `energy_infrastructure_geometry_type_matches_geom_check` constraint enforces
  geometry-type ↔ category consistency.
* Latitude/longitude column names are consistent (`latitude`, `longitude`).
* **PASS** with respect to Section 10 spatial naming.

### 11.6 Migration numbering gaps

* `layers/layer_01_aviation/` jumps from `001_aviation_reference_tables.sql` to
  `003_aviation_search_indexes.sql`. `002` is missing. This is grandfathered and
  documented in HEALTH-010. The gap has no functional impact (migrations are
  applied once, and the existing files are idempotent with `CREATE TABLE IF NOT
  EXISTS` / `CREATE INDEX IF NOT EXISTS`).
* No other migration folder has a numbering gap.
* See ESA-010.

### 11.7 Index and constraint patterns

* Migrations include `CREATE INDEX IF NOT EXISTS` for the most-queried columns
  (e.g., `idx_earth_events_latest_geometry_gist` for spatial queries,
  `idx_*_layer_id_source_id` for provenance queries).
* `CHECK` constraints are used for status, category, and enum-type columns (e.g.,
  `geometry_type IN ('point', 'line', 'polygon')`, `ST_SRID(geom) = 4326`,
  `magnitude > 0`, `depth_km`).
* **PASS** with respect to Section 11.

### 11.8 Time-series candidates

* Aviation live aircraft, maritime vessel positions, weather observations, and
  news items are all candidates for high-volume time-series storage as the project
  scales. The rulebook explicitly says: "Do not introduce new time-series database
  technology in this task or any feature task without an explicit work order and
  Orchestrator Agent approval."
* Current approach (PostgreSQL `*_history` tables) is appropriate for MVP volume.

### 11.9 Database shapes that may be too coupled to API/frontend assumptions

* The aviation `objects/` route family is hard-coded to `aviation_airports` (with
  references to `aviation_runways`, `aviation_navaids`, `aviation_airport_frequencies`).
  This is a current coupling that limits reuse for non-aviation layers, but the
  `objects/` family is the only one that has this coupling; the layer-aware
  endpoints (`/api/layers/<layer_id>/objects`) are the recommended future pattern.
* Energy and weather have their own table names that match the route handler
  assumptions. There is no general "layer objects" abstraction in the database
  itself, which is the right choice for MVP. The Database Agent has not been
  forced to over-generalize.
* **PASS** with respect to Section 10 ("Database design must not couple directly
  to API or frontend shapes").

### 11.10 Classification of database findings

* **Documentation / planning issue:**
  * Migration 002 numbering gap in `layer_01_aviation` (HEALTH-010, already known)
  * Category comment block in every migration (need a spot-check pass)
* **Safe future migration:**
  * Index additions on high-frequency columns as data volume grows
  * Consider adding `*_fetch_runs` tables for layers that don't have one yet
    (aviation live aircraft may benefit)
* **Requires contract discussion:**
  * New `objectCount`-style status payloads for non-aviation layers (HEALTH-002)
  * Layer-aware vs resource-aware table structure (already the case in code, no
    change needed)
* **Requires deployment / scaling decision:**
  * Time-series storage (PostgreSQL → specialized TSDB) when daily volume justifies
  * Object storage for raw payloads (currently filesystem)
* **Do not touch until later:**
  * Migration `002_aviation_*` gap (do not renumber; document the gap in
    `database/migrations/README.md`)

---

## 12. API Transport, Performance, and Live-Data Readiness

### 12.1 REST coverage

* All current API endpoints are REST. The 5 live-layer list endpoints
  (`/api/layers/<layer_id>/objects`, `/api/layers/layer_07_weather/weather/...`,
  `/api/layers/layer_08_news_osint/news/...`, `/api/aviation/aircraft/latest`,
  `/api/space/satellites`) all use `limit` / `offset` / `bbox` parameters with
  server-side clamping. **PASS** with respect to Section 13.

### 12.2 WebSocket coverage

* Aviation aircraft and space satellites use WebSocket transport. Both are
  implemented and stable. The WebSocket pattern is a documented project precedent
  for future high-frequency live layers.

### 12.3 Large result sets

* `/api/layers/layer_01_aviation/objects` supports `mode=preload` with a
  `MAX_PRELOAD_LIMIT = 100000` cap. This is intended for resident cache mode.
* The maritime, weather, and news endpoints have smaller caps (`MAX_LIMIT = 10000`,
  `5000`, `100` respectively). This is **defensive** but may become a bottleneck
  for power users.
* The news `markers` endpoint allows up to `MAX_MARKER_LIMIT = 500`. For a dense
  news event area, 500 markers per call is reasonable.

**Future considerations:**

* Compression (`gzip`/`brotli`) — currently not set explicitly. Fastify may handle
  this by default, but a deliberate `Content-Encoding` strategy should be planned
  for large-response endpoints.
* Cache headers — no `Cache-Control` is set in the inspected source. For
  `latest`-snapshot endpoints, a short `max-age` (e.g., 60 seconds) is appropriate.
  For `history` endpoints, no cache or long cache is appropriate.
* Async job pattern for bulk export — not yet needed at MVP volume.

### 12.4 User / account input-output

* The project has no user accounts. All API endpoints are read-only. The first
  write endpoint will be Layer 09 (`layer_09_user_shapes` POST), which is
  `coming_soon`. The MVP layer registry already documents the auth and rate-limit
  requirements for that layer.

### 12.5 Security / rate limit / auth / authz posture

* No `cors`, `helmet`, `limiter`, or `requireAuth` patterns in the inspected source.
* The API is unauthenticated and rate-unlimited. This is acceptable for an
  MVP/local-dev deployment but should be planned before any public exposure.
* The rulebook Section 13 "API quality requirements" lists these as design-time
  requirements for new routes. Existing routes predate the rulebook and are
  grandfathered. **Recommend a future work order** to add the missing pieces
  *before* layer 09 ships and *before* any non-localhost deployment.

### 12.6 Future readiness

* For high-frequency live layers (aviation, space, maritime, weather), the
  project has precedents for both REST polling and WebSocket streaming. New
  layers should pick the appropriate transport based on the data frequency
  (e.g., a per-second storm tracker needs WebSocket; a daily news feed does not).

---

## 13. Raw Data, Object Storage, and Job Readiness

### 13.1 Raw payload handling

* `raw/` directory is gitignored. All fetcher workers write raw payloads to
  `raw/{layer_id}/{source_id}/{yyyy}/{mm}/{dd}/{fetch_run_id}/payload.{ext}`.
  **PASS** with respect to Section 15.

### 13.2 `tmp/` directory

* `tmp/` is gitignored. Some local proof/seed output is written there for
  verification. **PASS.**

### 13.3 Object storage readiness

* The current implementation stores raw payloads on the local filesystem. The
  rulebook Section 15 says: "Object storage (for large raw evidence or export
  artifacts) may be introduced later through a dedicated work order. Do not
  assume any specific object storage vendor."
* No object storage is required at MVP volume. Plan a future work order when
  the total raw payload size exceeds local disk budget or when a multi-instance
  deployment requires shared storage.

### 13.4 Generated data risks

* `__pycache__/`, `*.pyc`, `.pytest_cache/`, `apps/api/dist/`, `apps/web/dist/`,
  `packages/contracts/dist/`, `node_modules/` are all present locally but are
  gitignored. **PASS** — no generated data is at risk of being committed.

### 13.5 Job / retry / status visibility

* Workers are Python CLIs run manually (per `CURRENT_PROJECT_STATE.md`: "A
  unified runner/scheduler cleanup is deferred to a later work order"). There is
  no centralized job state, retry tracking, or status dashboard.
* The rulebook Section 14 says: "Do not implement a job queue or job
  orchestration system in this task or any feature task without an explicit
  work order and Orchestrator Agent approval." The current state is compliant
  with this rule.
* The `fetch_run` tables in layer 07 weather and layer 08 news provide per-fetch
  audit trails. Other layers either use the broadcaster (aviation, space) or
  rely on `received_at` timestamps (maritime, energy). **PASS** for audit
  logging, with the noted gap that not all layers have a `fetch_run` table.

---

## 14. Import Boundary Findings

The audit searched the full source tree for the following forbidden cross-imports:

| Check | Method | Result |
|-------|--------|--------|
| Frontend (`apps/web/`) importing from `services/`, `database/`, or `apps/api/` | Searched `apps/web/src/**/*.{ts,tsx}` for `from '../../services/'`, `from '../../apps/api/'`, `from '../../database/'` and similar | **NONE FOUND** |
| API (`apps/api/`) importing from `apps/web/` or `services/` | Searched `apps/api/src/**/*.{ts,tsx}` for `from '../../apps/web/'`, `from '../../services/'` | **NONE FOUND** |
| Fetcher/normalizer (`services/`) importing from `apps/web/` or `apps/api/` | Searched `services/**/*.{ts,py}` for `from apps.`, `import apps.` | **NONE FOUND** |
| Cross-layer frontend imports (e.g., `layer_07_weather` reaching into `layer_01_aviation`) | Spot-checked `App.tsx` and `CesiumGlobe.tsx`; both import from the relevant layer's `index`/default export only. | **PASS** for inspected samples |
| Shared code in approved packages only | All shared TypeScript types live in `packages/contracts/`. Shared components live in `apps/web/src/components/`. | **PASS** |

**Verdict.** **No import boundary violations found.** The architecture's import
boundaries are intact. This is a strong point of the current code and is worth
preserving during the refactor of legacy frontend folder names (ESA-005).

---

## 15. Recommended Repair Order

The audit recommends the following repair order. **No code changes are made by this
audit.** This order is for the next planning cycle.

1. **Contract / planning issues first**
   * **ESA-001**: One-line energy client URL fix (already known as HEALTH-001).
     Owner: Frontend Agent. Effort: Trivial. Timing: Next.
   * **ESA-002 / ESA-014 / ESA-015**: API route split work order. Decide on a
     per-layer `index.ts` + `service.ts` + `repository.ts` + `mapper.ts` +
     `validation.ts` + `types.ts` split. Use the existing `airport-intelligence/`,
     `airport-layout-features/`, `public-profile/`, and `objects/` folders as the
     template. Owners: API Agent, Contract Agent. Effort: High. Timing: Next.
   * **ESA-004**: Contracts module split (per-layer files re-exported from
     `index.ts`). Owner: API Agent / Contract Agent. Effort: Low. Timing: Next.
   * **ESA-007**: Document the colocation rule explicitly in
     `LLM_OWNERSHIP_MATRIX.md` if not already explicit (already partially
     documented). Owner: Orchestrator Agent. Effort: Trivial. Timing: Do not
     touch yet (docs decision).

2. **Database naming / migration plan**
   * **ESA-010**: Add a one-line note to `database/migrations/README.md` about
     the aviation `002` numbering gap. Owner: Database Agent. Effort: Trivial.
     Timing: Do not touch yet (already in HEALTH-010).
   * **ESA-021**: Spot-check category comment blocks in every migration; flag
     any missing. Owner: Database Agent. Effort: Low. Timing: Later.

3. **Largest unsafe files**
   * **ESA-003**: Split `DetailPanel.tsx` (877) and `LayerPanel.tsx` (1030)
     into per-feature sub-components. Owner: Frontend Agent. Effort: Medium.
     Timing: Next.
   * **ESA-008**: Split aviation Python workers >700 lines. Owner: Fetcher
     Agent. Effort: Medium. Timing: Next.
   * **ESA-009**: Split large data test files. Owner: Test/CI. Effort: Low.
     Timing: Later.

4. **API route split**
   * **ESA-002 / ESA-014 / ESA-015 / ESA-016**: Use the airport sub-resource
     folders as the template. Extract per-layer `repository.ts` from
     `weather.ts`, `news.ts`, `maritime.ts`, `space/satellites.ts`,
     `energy/infrastructure.ts`. Centralize `MAX_LIST_LIMIT`,
     `MAX_VIEWPORT_LIMIT`, `MAX_PRELOAD_LIMIT` into a shared
     `apps/api/src/lib/query-limits.ts`. Owner: API Agent. Effort: High.
     Timing: Next.

5. **Frontend layer folder normalization**
   * **ESA-005**: Rename `aviation/`, `borders/`, `earth-events/`, `space/`,
     `maritime/`, `energy/` to `layer_NN_name/` on the frontend. This must be a
     dedicated refactor branch with full regression tests. Owner: Frontend
     Agent. Effort: High. Timing: Later (or coordinated with the next big
     frontend refactor).
   * **ESA-006**: Apply the `features/` pattern during the same refactor.
   * **ESA-030**: Optional subfolder pattern (`api/`, `hooks/`, `components/`,
     `mappers/`, `types/`, `constants/`) at the same time.

6. **Fetcher / normalizer source split**
   * Per-layer `sources/<name>/` subfolder split for aviation (8 sources),
     space (2), news (2), energy (3), maritime (1). Owner: Fetcher Agent.
     Effort: Medium. Timing: Later.

7. **Deployment-scale features**
   * **ESA-017**: Caching, rate-limit, auth posture. Owner: API Agent.
     Effort: High. Timing: Later (before public deployment or layer 09
     implementation).
   * **ESA-022**: Time-series storage. Owner: Database Agent. Effort: High.
     Timing: Later (when daily volume justifies).
   * **ESA-025**: Object storage. Owner: Orchestrator. Effort: High. Timing:
     Later.
   * **ESA-026**: Unified scheduler / job model. Owner: Orchestrator. Effort:
     High. Timing: Later.
   * **ESA-028**: Streaming transport for high-frequency non-aviation/space
     layers. Owner: API Agent. Effort: High. Timing: Later.

---

## 16. Do-Not-Touch-Yet List

The following items must not be modified in this audit or in any feature work:

1. **Existing migration files (Section 11).** Migrations are immutable. The
   `002` numbering gap in `layer_01_aviation/` is grandfathered.
2. **Existing normalizer code.** Colocated non-aviation normalizers under
   `services/fetch-orchestrator/src/layers/<layer_id>/` are accepted and must
   not be moved in documentation or refactor work without an explicit
   Orchestrator-issued work order.
3. **Frontend short-name layer folders** (`aviation/`, `borders/`, `earth-events/`,
   `space/`, `maritime/`, `energy/`). These are grandfathered by the rulebook
   itself. Renaming requires a dedicated refactor branch.
4. **Grandfathered oversized files** in Sections 7.1, 7.3, 7.4 above. Refactoring
   these is a dedicated class of work, not feature work.
5. **The rulebook** (`docs/control/ENGINEERING_STRUCTURE_RULES.md`) and other
   `docs/control/` documents. These are owned by the Orchestrator Agent and
   can only be modified through the change process documented in
   `ENGINEERING_STRUCTURE_RULES.md` Section "Change Process".
6. **`.env`, `.env.example`** and any other secret-containing files. Verified not
   tracked; should remain untracked.
7. **`raw/`, `tmp/`, `__pycache__/`, `*.pyc`, `dist/`, `node_modules/`,
   `.pytest_cache/`**. Generated / local-only directories. Should remain
   gitignored.
8. **Existing `INTEGRATION_REVIEW_*.md` files in `docs/state/`.** These are
   immutable per-work-order review records. New reviews for layer 07 weather
   and layer 08 news (per HEALTH-003) should be new files, not edits to existing
   reviews.

---

## 17. Open Questions for Planning

These questions should be answered by the Orchestrator Agent (or escalated to a
user-level decision) before the recommended repairs are planned.

1. **Layer 09 user shapes auth strategy.** Which auth approach (session-based,
   token-based, etc.) will be used for layer 09? This blocks any auth-related
   design in the API. (User-level decision.)
2. **Deployment target.** Is the next deployment a single-instance local
   deployment, a Docker Compose setup, a cloud VM, or a multi-instance
   Kubernetes-style deployment? This affects caching, rate-limit, and object
   storage readiness. (User-level decision.)
3. **Cesium Ion token policy.** Is the in-tree `VITE_CESIUM_ION_ACCESS_TOKEN`
   placeholder acceptable as a public Cesium asset token, or does the project
   need a per-user token model? (User-level decision.)
4. **High-volume layer transport.** At what point (daily position count, daily
   weather observation count) should the project move from PostgreSQL
   `*_history` tables to specialized time-series storage? (Planning decision
   based on real usage data.)
5. **Time-series history retention.** How long should `*_history` tables
   retain data? Currently undefined. Affects indexing and partitioning
   decisions. (Database Agent + Orchestrator.)
6. **Layer 02 production gate.** Layer 02 (`layer_02_borders_boundaries`) is
   marked "active (MVP/local-dev)" with a documented India-boundary production
   gate. Is the production gate still the path forward, or is the layer being
   deprecated? Affects whether `002_borders_boundaries_schema.sql` is the
   final schema or a placeholder. (User-level decision per the policy source
   plan.)
7. **Whether to retroactively create `INTEGRATION_REVIEW_*.md` for layer 07
   weather and layer 08 news** (per HEALTH-003). This is a documentation-only
   fix. Orchestrator Agent decision.

---

## 18. Conclusion

The project is **structurally safe to continue** and the engineering rulebook is
**largely aligned with the current code**. The most recent alignment pass on
`main` (commit `4296a62`, 2026-06-14) brought the registries and config into
agreement, and the rulebook itself was added in `5e6187b` on the same day.

No **Critical** or **High** issues were found. The audit identified:

* 4 **Medium** issues: the energy client URL inconsistency (already known as
  HEALTH-001), the five oversized API route files, the two oversized shared
  frontend components, the API route split (per Section 8), and the contracts
  module size.
* A handful of **Low** issues: vague file names (none found), direct external
  API calls in frontend (none found), JSONB usage (compliant), spatial naming
  (compliant), migration numbering gap (grandfathered, known as HEALTH-010),
  and import boundaries (intact, **PASS**).
* A few items that should be **documented** but not changed: the colocation
  normalizer pattern, the frontend short-name folder pattern, the
  aviation `002` migration gap.

The recommended repair order is **contract → database plan → large unsafe
files → API route split → frontend folder normalization → fetcher source split
→ deployment-scale features**. None of these blocks the next planning cycle,
and each is appropriate to plan in its own work order / branch per Section 17
of the rulebook.

The audit **did not modify any application code, frontend code, API code,
fetcher/normalizer code, database migration, or test code**. The only files
written or modified by this audit are:

* `docs/audits/ENGINEERING_STRUCTURE_COMPLIANCE_AUDIT.md` (this report)
* `docs/state/HANDOFF_LOG.md` (one appended entry)

The audit branch is `research/engineering-structure-compliance-audit`. The
report is committed locally. The branch is **NOT pushed**; pushing is owned
by the Orchestrator Agent after integration review.

---

**Last updated:** 2026-06-14
**Author:** Research Agent
**Maintained by:** Orchestrator Agent after review
