# Project Alignment Report

## 1. Audit Metadata

- **Agent name:** Project Alignment Audit Agent
- **Repository path:** `E:\god-eyes`
- **Branch inspected:** `main`
- **Commit hash inspected:** `2fe2367f80e4fd120e3de264491e9027747e7ac9`
- **Date/time of audit:** 2026-06-13T23:48:40+05:30
- **Worktree clean before report creation:** Yes. `git status --short --branch` returned only `## main...origin/main` (no modified/untracked tracked files). The only intended change is this report file.
- **Only `docs/audits/PROJECT_ALIGNMENT_REPORT.md` created:** Yes (the `docs/audits/` directory did not previously exist and was created to hold this file).

### Commands run

```
git switch main
git status --short --branch
git rev-parse HEAD
git rev-parse --abbrev-ref HEAD
git remote -v
git worktree list
git ls-files .env .env.example apps/web/.env
git check-ignore .env tmp _dummy_cache raw .pytest_cache
git ls-files            (filtered to top-level files)
```

Plus read-only file reads, glob, and regex content searches across `apps/`, `packages/`, `services/`, `database/`, `docs/`, `tests/`, and root config files.

### Command outputs (verbatim, relevant parts)

```
## main...origin/main
HEAD: 2fe2367f80e4fd120e3de264491e9027747e7ac9
abbrev-ref: main
remote: origin  https://github.com/ashishkumar62649/god-eyes.git (fetch)
remote: origin  https://github.com/ashishkumar62649/god-eyes.git (push)
worktree: E:/god-eyes 2fe2367 [main]   (single worktree)
git ls-files .env .env.example apps/web/.env -> .env.example  (only .env.example is tracked)
git check-ignore -> .env, tmp, raw, .pytest_cache are ignored
```

### Files/folders inspected

- Root: `package.json`, `pnpm-workspace.yaml`, `pytest.ini`, `requirements-data.txt`, `.env.example`, `.env` (read for var-name comparison), `.gitignore` (via check-ignore), `AGENTS.md` (provided), `.github/workflows/ci.yml`.
- `docs/control/` (registry, architecture, conventions, ownership, pipeline, data-location, source-contract), `docs/state/CURRENT_PROJECT_STATE.md`, directory listings of `docs/` subfolders.
- `apps/api/src/` (index, routes/*, lib/*), `apps/api/tests/` (listing).
- `apps/web/src/` (App, CesiumGlobe, components, lib/useLayerRegistry.ts, lib/api.ts, layer folders, layer clients, layer `__tests__`), `apps/web/package.json`, `apps/web/vite.config.ts`, `apps/web/.env`, `apps/web/.env.example`.
- `database/migrations/` (all SQL), `database/ingestion/` listing.
- `services/fetch-orchestrator/src/layers/*` (listing + weather/news entrypoints + weather README), `services/normalizer/src/layers/*` (listing).
- `packages/contracts/src/index.ts` (schema enums), `packages/contracts/package.json`, `packages/schemas/`, `packages/source-catalog/` listings.
- `tests/`, `tests/data/*` listings, `pytest.ini`.

### Files/folders intentionally ignored

- `E:\god-eyes.zip`, `E:\god-eyes-branch-backups`, deleted/old worktrees, remote branches (existence of `origin/main` only confirmed).
- Generated/ignored runtime artifacts: `tmp/`, `_dummy_cache/`, `raw/`, `.pytest_cache/`, every `__pycache__/` and `*.pyc`, `node_modules/`, `dist/`.
- Real-secret values inside the gitignored `.env` (referenced by key name only, never reproduced).

---

## 2. Executive Factual Summary

- **Total mismatch findings:** 27 (ALIGN-001 … ALIGN-027).
- **By severity:**
  - Critical: 3 (ALIGN-001, ALIGN-002, ALIGN-005)
  - High: 4 (ALIGN-003, ALIGN-004, ALIGN-026, ALIGN-027)
  - Medium: 12 (ALIGN-006, 007, 008, 009, 010, 011, 014, 015, 018, 021, 023, 024)
  - Low: 8 (ALIGN-012, 013, 016, 017, 019, 020, 022, 025)
- **By category (counts):**
  - Layer numbering / naming conflicts: 4 (001, 002, 007, 024)
  - Layer status label conflicts: 5 (004, 006, 017, 020, 023)
  - API route / contract / endpoint behavior: 4 (003, 018, 026, 027)
  - Documentation staleness / state-vs-code: 3 (005, 021, 022)
  - Environment / config: 3 (009, 012, 013)
  - CI / test / dependency alignment: 2 (010, 011)
  - Source / ownership: 2 (014, 015)
  - Frontend client config: 1 (008)
  - Packaging / scripts: 1 (016)
  - Documentation completeness: 2 (019, 025)
- **Layers with most mismatches:** Layer 07 (Weather vs Infrastructure identity conflict touches the most sources), then Layer 10 (Energy) and Layer 08 (News & OSINT).
- **Areas with highest ambiguity:** the layer registry surface (three diverging registries: authoritative markdown, API in-code registry, frontend local registry) and the `CURRENT_PROJECT_STATE.md` phase/status narrative versus the actually-implemented code.

---

## 3. Current Project Truth Map

(Describes what appears true on `main` at `2fe2367` only.)

- **Active root path:** `E:\god-eyes` (single git worktree).
- **Active package/workspace layout:** pnpm workspace; `pnpm-workspace.yaml` globs `apps/*` and `packages/*` only (Python dirs under `packages/`, `services/`, `database/` carry no `package.json`). Root `package.json` name `god-eyes`, private.
- **API app location:** `apps/api/` (Fastify, TypeScript, ESM). Entry `apps/api/src/index.ts`.
- **Web app location:** `apps/web/` (React + Cesium + Vite). Entry `apps/web/src/main.tsx`; shell `App.tsx`, `CesiumGlobe.tsx`.
- **Database migration location:** `database/migrations/core/` + `database/migrations/layers/<layer_id>/`. Ingestion code `database/ingestion/layers/<layer_id>/`.
- **Fetch/orchestrator location:** `services/fetch-orchestrator/src/layers/<layer_id>/`; normalizers `services/normalizer/src/layers/<layer_id>/`.
- **Test locations:** Python data tests `tests/data/<layer_id>/` (pytest, `testpaths = tests/data`); API tests `apps/api/tests/*.test.ts` (vitest); web tests `apps/web/src/layers/<layer>/__tests__/*.test.ts` (vitest).
- **Layer list found in code/docs:** `layer_00_globe_core`, `layer_01_aviation`, `layer_02_borders_boundaries`, `layer_03_earth_events`, `layer_04_public_military_security`, `layer_05_space_satellites`, `layer_06_maritime`, `layer_07_weather` (and conflicting `layer_07_infrastructure` in API code), `layer_08_news_osint`, `layer_09_user_shapes`, `layer_10_energy_infrastructure`.
- **Worker entrypoints found (run via `python -m layers.<layer_id>....` from `services/fetch-orchestrator/src`):**
  - `layer_01_aviation`: `aviation_live_aircraft_worker.py`, `ourairports_collector.py`, `airport_*_worker.py`.
  - `layer_02_borders_boundaries`: `natural_earth_admin0_ingest.py`.
  - `layer_03_earth_events`: `usgs_earthquakes_worker.py`.
  - `layer_05_space_satellites`: `space_satellites_worker.py`.
  - `layer_06_maritime`: `maritime_cli.py`, `maritime_*`.
  - `layer_07_weather`: `__main__.py` (delegates to `weather_local_seed`), `weather_cli.py`.
  - `layer_08_news_osint`: `__main__.py` (`--source gdacs|gdelt --proof [--normalize] [--ingest-db]`).
  - `layer_10_energy_infrastructure`: `energy_infrastructure_worker.py`.
- **API route groups found (literal paths):** `/api/health`; `/api/layers`, `/api/layers/registry`, `/api/layers/:layerId`, `/api/layers/:layerId/status`; `/api/layers/:layerId/objects`(+`/:objectId`,`/:objectId/detail`); `/api/aviation/aircraft/latest`,`/api/aviation/aircraft/:sourceObjectId`; `/api/airports/:airportId/{intelligence,layout-features,public-profile}`; `/api/earth-events/latest`; `/api/borders-boundaries/countries`; `/api/space/satellites`(+`/categories`,`/:satelliteId`); `/api/energy/infrastructure`(+`/:featureId`,`/categories`,`/sources`); `/api/layers/layer_06_maritime/objects`(+`/:objectId`,`/stats`,`/vessels/:mmsi/positions`); `/api/layers/layer_07_weather/weather/{latest,current,hourly,nearby,sources,fetch-runs}`; `/api/layers/layer_08_news_osint/news/{items,markers,sources,fetch-runs,stats}`; WebSockets `/ws/aviation/aircraft/live`, `/ws/space/satellites/live`.
- **Database table groups found:** core (`fetch_runs`, `raw_objects`); aviation (`aviation_airports/runways/navaids/airport_frequencies/countries/regions`, coordinate-quality tables, `airport_*` intelligence/profile/layout/image tables, `aviation_aircraft_sources/latest/observations/raw_batches`, `aviation_aircraft_live_snapshots`); borders (`border_boundary_sources`, `border_boundaries`, `border_boundary_compliance_reviews`); earth events (`earth_events_latest`, `earth_events_history`); space (`space_satellites`, `space_satellite_positions_latest` + scale-index migration 002); maritime (`maritime_sources/fetch_runs/vessels/positions_latest/position_history`); weather (`weather_sources/fetch_runs/locations/observations_latest/observation_history`); news (`news_sources/fetch_runs/items_latest/item_history/raw_message_refs`); energy (`energy_infrastructure`).
- **Frontend layer registry entries found:** `LOCAL_LAYER_REGISTRY` in `apps/web/src/lib/useLayerRegistry.ts` lists 11 entries (`layer_00`…`layer_10`, including `layer_07_weather` and `layer_10_energy_infrastructure`).

---

## 4. Documentation Inventory

| Path | Main topic | Layers referenced | State | Evidence |
|------|-----------|-------------------|-------|----------|
| `AGENTS.md` | Roles, hard rules, layer order, workflow | 00–09 | Partially stale | Layer Order table lists only `layer_00`…`layer_09`; omits `layer_10_energy_infrastructure` which exists in registry + code. |
| `docs/control/MVP_LAYER_REGISTRY.md` | Authoritative 11-row registry (0–10) | 00–10 | Partially stale (status) | Row 7 = `layer_07_weather` "Weather". Marks 05–10 `coming_soon`; "Last updated 2026-05-31". Conflicts implemented code for 06/07/08/10. |
| `docs/control/LAYER_ARCHITECTURE.md` | Layer definitions/order | 00–10 | Conflicting (internal) | Table row 7 = `layer_07_weather`; but prose heading "Layer 7: Infrastructure (Coming Soon)" describes power grids/fiber/water. |
| `docs/control/LAYER_ID_CONVENTIONS.md` | Naming + folder conventions | 00–10 | Conflicting (status) | Summary table marks `layer_02` and `layer_03` `coming_soon`, contradicting MVP registry `active`. |
| `docs/control/LLM_OWNERSHIP_MATRIX.md` | Ownership map | n/a | Not deeply re-verified | Listed in AGENTS key docs. |
| `docs/control/PIPELINE_HANDOFF_RULES.md` | Data flow rules | n/a | Not deeply re-verified | Listed in AGENTS key docs. |
| `docs/control/DATA_LOCATION_RULES.md` | File placement | n/a | Not deeply re-verified | Listed in AGENTS key docs. |
| `docs/control/SOURCE_TO_FRONTEND_CONTRACT.md` | Source contract | n/a | Not deeply re-verified | Listed in AGENTS key docs. |
| `docs/state/CURRENT_PROJECT_STATE.md` | Current phase/status | 00–09 | **Stale (Critical)** | Phase "Layer 05 Space & Satellites MVP Planning"; "Last Updated 2026-05-31"; "What Does Not Exist Yet" lists Maritime/Infrastructure(=07)/News/Space and "Generic layer API endpoints" though all are implemented. |
| `docs/state/HANDOFF_LOG.md` | Append-only handoff log (~532 KB) | all | Operational (not re-validated line-by-line) | Single very large file. |
| `docs/state/INTEGRATION_REVIEW_*.md` (≈50 files) | Per-WO reviews | various | Historical | Cover WO-001…WO-079B, hotfixes; none for weather/news layers. |
| `specs/006-layer-07-weather-mvp/*` | Weather spec set | 07 | Current vs code | Spec dir uses `layer-07-weather`; matches code `layer_07_weather`. |
| `specs/007-layer-08-news-osint-mvp/*` | News spec set | 08 | Current vs code | Includes FINAL_REPORT, PROOF_REPORT; matches code. |
| `specs/005-layer-06-maritime-mvp/*` | Maritime spec set | 06 | Current vs code | Matches code. |
| `specs/004-layer-10-energy-infrastructure-mvp/*` | Energy spec set | 10 | Current vs code | `spec.md`, `plan.md`, `tasks.md`. |
| `specs/003-layer-05-space-satellites-mvp/*` | Space spec set | 05 | Current vs code | Matches code. |
| `specs/001-…/spec.md`, `specs/002-…/spec.md` | Globe / Aviation | 00,01 | Current | Referenced by state doc. |
| `database/migrations/README.md` | Migration ordering | all data layers | Not re-validated | Present. |
| `services/fetch-orchestrator/src/layers/layer_07_weather/README.md` | Weather fetcher usage | 07 | Current vs code | CLI commands match `weather_cli.py`. |
| `packages/source-catalog/layers/layer_07_weather/*` | Weather source docs | 07 | Current | Open-Meteo source decision docs. |
| `packages/source-catalog/layers/layer_06_maritime/*` | Maritime source docs | 06 | Current | AISStream source docs. |
| `docs/work-orders/*`, `docs/reports/*`, `docs/api/*`, `docs/devlog/*`, `docs/postman/*` | WO/reports/api docs | various | Historical | Newest WO is WO-083A (energy contract). No WO docs in `docs/work-orders/` for weather/news (those live under `specs/`). |
| Root `README` | — | — | **Absent** | No `README*` tracked at repo root (`git ls-files` top level). |

---

## 5. Code Structure Inventory

| Path | Purpose (inferred) | Layers referenced | Mismatch with docs | Evidence |
|------|--------------------|-------------------|--------------------|----------|
| `apps/api/src/index.ts` | Fastify bootstrap + route registration + WS upgrade | all registered layers | CORS comment inaccurate | Registers 14 route groups (lines 31–44); CORS comment "localhost:5174 (Vite default)" (line ~25) — 5174 is project-forced, not Vite default. |
| `apps/api/src/routes/layers.ts` | In-code `LAYER_REGISTRY` + `/api/layers*` endpoints | 00–09 | **Conflicts MVP registry** | `layer_07_infrastructure` entry (≈line 131); no `layer_10` entry; `/api/layers` returns only 2 layers (lines ~180–214); `/api/layers/:layerId/status` only handles `layer_00`/`layer_01` (lines ~254+). |
| `apps/api/src/routes/weather.ts` | Weather sub-resource endpoints | 07 | Route shape vs registry "generic /objects" | `LAYER_ID='layer_07_weather'` (line 15); paths `/api/layers/.../weather/*`. |
| `apps/api/src/routes/news.ts` | News sub-resource endpoints | 08 | Route shape vs registry | `LAYER_ID='layer_08_news_osint'` (line 17); paths `/api/layers/.../news/*`. |
| `apps/api/src/routes/maritime.ts` | Maritime generic `/objects` endpoints | 06 | Aligned with generic pattern | `LAYER_ID='layer_06_maritime'` (line 15). |
| `apps/api/src/routes/energy/infrastructure.ts` | Energy endpoints | 10 | API registry omits layer_10 | `LAYER_ID='layer_10_energy_infrastructure'` (line 13); paths `/api/energy/infrastructure*`. |
| `apps/api/src/routes/space/satellites.ts` | Space endpoints + WS | 05 | Status vs registry | Queries `layer_id='layer_05_space_satellites'` (lines 205+); paths `/api/space/satellites*`. |
| `apps/api/src/routes/earth-events.ts` | Earth events endpoint | 03 | — | `/api/earth-events/latest` (line 113). |
| `apps/api/src/routes/borders-boundaries.ts` | Borders endpoint | 02 | — | `/api/borders-boundaries/countries` (line 98). |
| `apps/api/src/routes/objects/*` | Generic object endpoints | 01 (LAYER_ID in density.ts) | — | `/api/layers/:layerId/objects` (index.ts:105). |
| `apps/web/src/lib/useLayerRegistry.ts` | Frontend registry + merge | 00–10 | **Conflicts API registry; merge bug** | `LOCAL_LAYER_REGISTRY` 11 entries; merge appends API-only layers (creates duplicate Layer 7). |
| `apps/web/src/lib/api.ts` | Aviation/earth/borders/registry clients | 01,02,03 | — | Uses `VITE_API_BASE_URL` base. |
| `apps/web/src/layers/*` | Per-layer UI + clients | 01,02,03,06,07,08,10,05 | Energy client uses relative path | `energy/infrastructure/useEnergyInfrastructure.ts:53` relative `/api/...`. |
| `apps/web/src/globe/setupCesiumToken.ts` | Cesium token loader | n/a | Env var name vs root env files | Reads `VITE_CESIUM_ION_ACCESS_TOKEN` (line 4). |
| `database/migrations/layers/*` | Per-layer schema | 01,02,03,05,06,07,08,10 | No 04/09 (expected) | See §10 table list. |
| `database/ingestion/layers/*` | DB ingestion for weather/news | 07,08 | Only 07/08 present | `weather_ingestion.py`, `gdacs_db_ingestion.py`, `gdelt_db_ingestion.py`. |
| `services/fetch-orchestrator/src/layers/*` | Fetchers/normalizers/workers | 01,02,03,05,06,07,08,10 | No 04/09 (expected) | See §3 worker list. |
| `packages/contracts/src/index.ts` | Zod schemas + types | all | Status enum is `active|coming_soon|no_data` | `LayerRegistryEntrySchema` (line 397); status enum (line 401). |


---

## 6. Layer-by-Layer Alignment

### Layer 0 — `layer_00_globe_core` (Globe Core)

#### What documentation says
- `MVP_LAYER_REGISTRY.md` row 0: active, static, no sources, no DB, no layer-specific API.
- `LAYER_ARCHITECTURE.md` / `LAYER_ID_CONVENTIONS.md`: active, frontend-only.

#### What code says
- `apps/api/src/routes/layers.ts` registry entry `layer_00_globe_core` status `active`.
- Frontend `useLayerRegistry.ts` `layer_00_globe_core` active/implemented; globe in `apps/web/src/CesiumGlobe.tsx`, helpers in `apps/web/src/globe/`.

#### What database schema says
- No tables (correct).

#### What API says
- `/api/layers/:layerId/status` returns a hardcoded `ok` block for `layer_00_globe_core` (`layers.ts` ≈line 256).

#### What frontend says
- Renders Cesium globe; token via `VITE_CESIUM_ION_ACCESS_TOKEN`.

#### What tests say
- No dedicated data tests (frontend-only). API smoke test present (`apps/api/tests/smoke.test.ts`).

#### Mismatches found
- None specific to this layer beyond the env-var naming issue tracked in ALIGN-009.

---

### Layer 1 — `layer_01_aviation` (Aviation)

#### What documentation says
- `MVP_LAYER_REGISTRY.md` row 1: active, live; API `GET /api/layers/layer_01_aviation/objects`.

#### What code says
- API `objects/*` routes; `density.ts:38` `LAYER_ID='layer_01_aviation'`; aircraft routes `/api/aviation/aircraft/*`; WS `/ws/aviation/aircraft/live`.
- Workers under `services/fetch-orchestrator/src/layers/layer_01_aviation/`; normalizers under `services/normalizer/src/layers/layer_01_aviation/`.

#### What database schema says
- Migrations `001`,`003`–`013` (note: no `002` file present in `layers/layer_01_aviation/`): `aviation_airports/runways/navaids/airport_frequencies/countries/regions`, coordinate-quality, `airport_*` intelligence/profile/layout/image, `aviation_aircraft_*`, `aviation_aircraft_live_snapshots`.

#### What API says
- `/api/layers/layer_01_aviation/objects`, `/api/aviation/aircraft/latest`, `/api/aviation/aircraft/:sourceObjectId`, `/api/airports/:airportId/{intelligence,layout-features,public-profile}`.

#### What frontend says
- `apps/web/src/layers/aviation/*`; `api.ts` calls `/api/layers/layer_01_aviation/objects`. Registry: active/implemented.

#### What tests say
- Extensive `tests/data/layer_01_aviation/*`; `apps/api/tests/aviation-aircraft.test.ts`, `objects.test.ts`, `preload.test.ts`, etc.

#### Mismatches found
- Aviation migration numbering gap (`002` absent between `001` and `003`). See ALIGN-019 (Low).

---

### Layer 2 — `layer_02_borders_boundaries` (Borders & Boundaries)

#### What documentation says
- `MVP_LAYER_REGISTRY.md` row 2: **active** (MVP/local-dev); actual API `GET /api/borders-boundaries/countries`.
- `LAYER_ID_CONVENTIONS.md` summary table: **coming_soon**.

#### What code says
- `apps/api/src/routes/borders-boundaries.ts:98` `/api/borders-boundaries/countries`.
- Ingest `services/fetch-orchestrator/src/layers/layer_02_borders_boundaries/natural_earth_admin0_ingest.py`.

#### What database schema says
- `001_borders_boundaries_schema.sql`: `border_boundary_sources`, `border_boundaries`, `border_boundary_compliance_reviews`.

#### What API registry says
- `layers.ts` registry entry: status **coming_soon**, apiStatus `coming_soon`.

#### What frontend says
- `useLayerRegistry.ts` local entry: status **active**, isImplemented true; `apps/web/src/layers/borders/useBordersBoundaries.ts` calls the countries endpoint.

#### What tests say
- `tests/data/layer_02_borders_boundaries/test_natural_earth_admin0_ingest.py`, `test_borders_boundaries_schema_migration.py`; `apps/api/tests/borders-boundaries.test.ts`.

#### Mismatches found
- ALIGN-004 (status divergence), ALIGN-006 (conventions doc says coming_soon).

---

### Layer 3 — `layer_03_earth_events` (Earth Events)

#### What documentation says
- `MVP_LAYER_REGISTRY.md` row 3: **active**, live; actual API `GET /api/earth-events/latest`.
- `LAYER_ID_CONVENTIONS.md`: **coming_soon**.

#### What code says
- `apps/api/src/routes/earth-events.ts:113` `/api/earth-events/latest`.
- `services/fetch-orchestrator/src/layers/layer_03_earth_events/usgs_earthquakes_worker.py`, `earth_events_db.py`.

#### What database schema says
- `001_earth_events_tables.sql`: `earth_events_latest`, `earth_events_history`.

#### What API registry says
- `layers.ts` registry entry: status **coming_soon**.

#### What frontend says
- `useLayerRegistry.ts` local entry: **active**; `apps/web/src/layers/earth-events/useEarthEvents.ts` fetches latest (event_type=earthquake). Source rule string in local registry says "USGS, NASA EONET, GDACS"; code worker is USGS earthquakes only.

#### What tests say
- `tests/data/layer_03_earth_events/test_usgs_earthquakes_worker.py`, `test_earth_events_migration.py`; `apps/api/tests/earth-events.test.ts`.

#### Mismatches found
- ALIGN-004 (status divergence), ALIGN-006 (conventions doc), ALIGN-015 (disaster-source overlap with layer_08 GDACS).

---

### Layer 4 — `layer_04_public_military_security` (Public Military & Security)

#### What documentation says
- `MVP_LAYER_REGISTRY.md` row 4: coming_soon, static, public-only; API `GET /api/layers/layer_04_public_military_security/objects`.

#### What code says
- No fetcher/normalizer/migration folder; not in `apps/api` routes.

#### What database schema says
- No tables (consistent with coming_soon).

#### What API says
- No route; `/api/layers/:layerId/status` returns 404 for it.

#### What frontend says
- `useLayerRegistry.ts`: coming_soon, isEnabled false, isImplemented false.

#### What tests say
- None.

#### Mismatches found
- None (consistently unimplemented). The only API behavior note is shared via ALIGN-027 (status endpoint 404s for all non-aviation layers).


---

### Layer 5 — `layer_05_space_satellites` (Space & Satellites)

#### What documentation says
- `MVP_LAYER_REGISTRY.md` row 5: **coming_soon**, live; API `GET /api/layers/layer_05_space_satellites/objects`.
- `CURRENT_PROJECT_STATE.md`: Phase is "Layer 05 … MVP Planning"; lists Layer 5 under "What Does Not Exist Yet".

#### What code says
- `apps/api/src/routes/space/satellites.ts` + `space-satellites-broadcaster.ts`; `LAYER_ID` referenced inline as `layer_05_space_satellites` (lines 205+). WS `/ws/space/satellites/live`.
- Worker `services/fetch-orchestrator/src/layers/layer_05_space_satellites/space_satellites_worker.py` and clients (Space-Track, CelesTrak), `orbit_propagation.py`, `classification.py`.

#### What database schema says
- `001_space_satellites_tables.sql`: `space_satellites`, `space_satellite_positions_latest`; `002_space_satellites_scale_indexes.sql`.

#### What API says
- `/api/space/satellites`, `/api/space/satellites/categories`, `/api/space/satellites/:satelliteId` (non-generic; not the registry's `/api/layers/:layerId/objects`).

#### What frontend says
- `apps/web/src/layers/space/satellites/*`; `useLayerRegistry.ts`: **coming_soon**, isEnabled false, isImplemented false.

#### What tests say
- `tests/data/layer_05_space_satellites/test_space_satellites_*.py`; `apps/api/tests/space-satellites.test.ts`.

#### Mismatches found
- ALIGN-005 (state doc says Space does not exist though fully coded + tested), ALIGN-018 (route shape ≠ registry generic `/objects`), ALIGN-020 (registry status coming_soon vs implemented code).

---

### Layer 6 — `layer_06_maritime` (Maritime)

#### What documentation says
- `MVP_LAYER_REGISTRY.md` row 6: **coming_soon**, live; API `GET /api/layers/layer_06_maritime/objects`.

#### What code says
- `apps/api/src/routes/maritime.ts:15` `LAYER_ID='layer_06_maritime'`; routes `/api/layers/layer_06_maritime/{objects,objects/:objectId,stats,vessels/:mmsi/positions}`.
- Worker `services/fetch-orchestrator/src/layers/layer_06_maritime/maritime_cli.py` + `maritime_*`.

#### What database schema says
- `001_maritime_tables.sql`: `maritime_sources/fetch_runs/vessels/positions_latest/position_history`.

#### What frontend says
- `apps/web/src/layers/maritime/*`; `useLayerRegistry.ts`: status **active**, name "Maritime / Live Ships", `isImplemented: true`, `isEnabled: false`.

#### What tests say
- `tests/data/layer_06_maritime/*`; `apps/api/tests/maritime.test.ts`; `apps/web/src/layers/maritime/__tests__/maritime.test.ts`.

#### Mismatches found
- ALIGN-004 / ALIGN-020 (registry coming_soon vs frontend active/implemented vs API registry entry coming_soon), ALIGN-005 (state doc lists Maritime as not existing), ALIGN-010 (web test not run in CI).

---

### Layer 7 — `layer_07_weather` vs `layer_07_infrastructure` (Weather / Infrastructure)

#### What documentation says
- `MVP_LAYER_REGISTRY.md` row 7: `layer_07_weather` "Weather / Live Weather", coming_soon, live, Open-Meteo source; API `GET /api/layers/layer_07_weather/objects`.
- `LAYER_ARCHITECTURE.md` table row 7 = `layer_07_weather`, but its prose section heading is "Layer 7: Infrastructure (Coming Soon)".
- `CURRENT_PROJECT_STATE.md` "What Does Not Exist Yet" lists "Layer 7 Infrastructure".

#### What code says
- API: `apps/api/src/routes/weather.ts:15` `LAYER_ID='layer_07_weather'`. Frontend: `weatherTypes.ts:3` `WEATHER_LAYER_ID='layer_07_weather'`.
- **Conflict:** `apps/api/src/routes/layers.ts` registry entry 7 is `layer_07_infrastructure` "Infrastructure" (no `layer_07_weather` entry in that registry).

#### What database schema says
- `database/migrations/layers/layer_07_weather/001_weather_tables.sql`: `weather_sources/fetch_runs/locations/observations_latest/observation_history`. No "infrastructure" tables under layer_07.

#### What API says
- `/api/layers/layer_07_weather/weather/{latest,current,hourly,nearby,sources,fetch-runs}` (registered and working), but `/api/layers/registry` advertises `layer_07_infrastructure`, and `/api/layers/layer_07_weather` (single-layer lookup) returns 404 because the in-code registry has no `layer_07_weather` entry.

#### What frontend says
- `useLayerRegistry.ts` local entry 7 = `layer_07_weather`, status active, isImplemented true, isEnabled false; client `weatherApi.ts` calls `/api/layers/layer_07_weather/weather/current`.

#### What tests say
- `tests/data/layer_07_weather/*` (migration, fetcher, normalizer, ingestion, local seed); `apps/api/tests/weather.test.ts`; `apps/web/src/layers/layer_07_weather/__tests__/weather.test.ts`.

#### Mismatches found
- ALIGN-001 (Critical: dual identity), ALIGN-003 (merge produces duplicate Layer 7), ALIGN-007 (architecture doc internal conflict), ALIGN-005 (state doc), ALIGN-018 (sub-resource route vs generic).

---

### Layer 8 — `layer_08_news_osint` (News & OSINT)

#### What documentation says
- `MVP_LAYER_REGISTRY.md` row 8: coming_soon, live; sources "RSS/API news feeds, OSINT aggregators"; API `GET /api/layers/layer_08_news_osint/objects` with text search + date range.

#### What code says
- `apps/api/src/routes/news.ts:17` `LAYER_ID='layer_08_news_osint'`; routes `/api/layers/.../news/{items,markers,sources,fetch-runs,stats}`.
- Workers `services/fetch-orchestrator/src/layers/layer_08_news_osint/`: GDACS (`gdacs_*`) and GDELT (`gdelt_event_export_*`). CLI `__main__.py` `--source gdacs|gdelt`.
- Ingestion `database/ingestion/layers/layer_08_news_osint/{gdacs_db_ingestion.py,gdelt_db_ingestion.py}`.

#### What database schema says
- `001_news_tables.sql`: `news_sources/fetch_runs/items_latest/item_history/raw_message_refs`.

#### What frontend says
- `apps/web/src/layers/layer_08_news_osint/*`; `newsTypes.ts:9` `NEWS_LAYER_ID='layer_08_news_osint'`. Local registry: status active, isImplemented true, isEnabled false; description "Geolocated disaster/news events from GDACS".

#### What tests say
- `tests/data/layer_08_news_osint/*` (GDACS + GDELT fetcher/normalizer/ingestion/schema); `apps/api/tests/layer_08_news_osint.test.ts`; `apps/web/src/layers/layer_08_news_osint/__tests__/news.test.ts`.

#### Mismatches found
- ALIGN-014 (registry source list "RSS/OSINT aggregators" vs actual GDACS+GDELT), ALIGN-015 (GDACS disaster overlap with layer_03), ALIGN-018 (route shape vs generic), ALIGN-005 (state doc lists News as not existing), ALIGN-004/020 (status divergence).

---

### Layer 9 — `layer_09_user_shapes` (User Shapes)

#### What documentation says
- `MVP_LAYER_REGISTRY.md` row 9: coming_soon, static; API `GET`/`POST /api/layers/layer_09_user_shapes/objects` (authenticated).

#### What code says
- No routes, no migration, no worker.

#### What database schema says
- No tables.

#### What frontend says
- `useLayerRegistry.ts` local entry: status **no_data** (registry/API say coming_soon), isEnabled false, isImplemented false.

#### What tests say
- None.

#### Mismatches found
- ALIGN-017 (status label `no_data` in frontend vs `coming_soon` in registry/API; Low).

---

### Layer 10 — `layer_10_energy_infrastructure` (Energy Infrastructure)

#### What documentation says
- `MVP_LAYER_REGISTRY.md` row 10: coming_soon, static; API `GET /api/energy/infrastructure`.
- `AGENTS.md` Layer Order table omits this layer entirely.

#### What code says
- `apps/api/src/routes/energy/infrastructure.ts:13` `LAYER_ID='layer_10_energy_infrastructure'`; routes `/api/energy/infrastructure`(+`/:featureId`,`/categories`,`/sources`).
- Worker `services/fetch-orchestrator/src/layers/layer_10_energy_infrastructure/energy_infrastructure_worker.py` + clients (WRI, OSM, GEM).

#### What database schema says
- `001_energy_infrastructure_tables.sql`: `energy_infrastructure`.

#### What API registry says
- **`layers.ts` in-code registry has NO `layer_10` entry** (array stops at `layer_09`).

#### What frontend says
- `useLayerRegistry.ts` local entry 10: status **active**, isImplemented true, isEnabled true; client `energyInfrastructureApi.ts` / `useEnergyInfrastructure.ts:53` calls relative `/api/energy/infrastructure`.

#### What tests say
- `tests/data/layer_10_energy_infrastructure/*`; `apps/api/tests/energy-infrastructure.test.ts`.

#### Mismatches found
- ALIGN-002 (Critical: API registry omits layer_10 while routes/tables/frontend implement it), ALIGN-008 (energy frontend uses relative path), ALIGN-024 (AGENTS.md layer table omits it), ALIGN-005 (state doc), ALIGN-020 (registry coming_soon vs implemented).


---

## 7. Cross-Cutting Mismatches

Each finding below uses the global ALIGN-### ID and the required fields.

### ALIGN-001 — Layer 07 dual identity: Weather vs Infrastructure
- **Severity:** Critical · **Category:** Layer naming/numbering conflict
- **Conflicting files:** `apps/api/src/routes/layers.ts` (registry entry `layer_07_infrastructure`, ≈line 131) vs `docs/control/MVP_LAYER_REGISTRY.md` (row 7 `layer_07_weather`) vs `apps/api/src/routes/weather.ts:15` (`LAYER_ID='layer_07_weather'`) vs `apps/web/src/lib/useLayerRegistry.ts` (local entry `layer_07_weather`) vs `database/migrations/layers/layer_07_weather/001_weather_tables.sql`.
- **Source A says:** API in-code registry: layer 7 = `layer_07_infrastructure` "Infrastructure" (power grids/fiber/water), coming_soon.
- **Source B says:** Registry, contracts usage, DB, working API routes, frontend: layer 7 = `layer_07_weather` "Weather", implemented.
- **Why mismatch:** Same layer slot has two different IDs and domains across sources.
- **Confuses future agents:** Yes · **Causes implementation/test errors:** Yes (single-layer lookup `/api/layers/layer_07_weather` 404s; registry advertises a non-existent infrastructure layer).
- **Proven by:** code + docs + migrations · **Confidence:** High.

### ALIGN-002 — API in-code registry omits `layer_10_energy_infrastructure`
- **Severity:** Critical · **Category:** Layer numbering conflict
- **Conflicting files:** `apps/api/src/routes/layers.ts` (`LAYER_REGISTRY` array ends at `layer_09_user_shapes`) vs `apps/api/src/routes/energy/infrastructure.ts:13` vs `apps/web/src/lib/useLayerRegistry.ts` (entry 10) vs `docs/control/MVP_LAYER_REGISTRY.md` (row 10).
- **Source A says:** `/api/layers/registry` returns 10 entries (00–09), no energy layer.
- **Source B says:** Energy layer is implemented (route, table `energy_infrastructure`, worker, frontend) as `layer_10_energy_infrastructure`.
- **Why mismatch:** Implemented layer is absent from the registry the API serves.
- **Confuses future agents:** Yes · **Causes errors:** Yes (`/api/layers/layer_10_energy_infrastructure` 404; registry consumers never see energy).
- **Proven by:** code + migrations + docs · **Confidence:** High.

### ALIGN-003 — Frontend registry merge yields duplicate Layer 7
- **Severity:** High · **Category:** API/registry consumption
- **Conflicting files:** `apps/web/src/lib/useLayerRegistry.ts` (merge: keep local by `layerId`, then "append any API-only layers not present in local") + `apps/api/src/routes/layers.ts`.
- **Source A says:** Local registry has `layer_07_weather`.
- **Source B says:** API registry has `layer_07_infrastructure` (a different `layerId`).
- **Why mismatch:** When the API is online, `layer_07_infrastructure` is not matched to any local entry, so it is appended in addition to `layer_07_weather` — the UI receives two distinct "layer 7" rows.
- **Confuses future agents:** Yes · **Causes errors:** Yes (UI renders both a Weather and an Infrastructure layer).
- **Proven by:** static code inspection · **Confidence:** High.

### ALIGN-004 — Layer status divergence across the three registries (runtime override)
- **Severity:** High · **Category:** Layer status label conflict
- **Conflicting files:** `docs/control/MVP_LAYER_REGISTRY.md`, `apps/api/src/routes/layers.ts`, `apps/web/src/lib/useLayerRegistry.ts`.
- **Source A says:** MVP registry: `layer_02` active, `layer_03` active; API in-code registry: both `coming_soon`.
- **Source B says:** Frontend local: `layer_02`/`layer_03` active and implemented.
- **Why mismatch:** The frontend merge replaces local entries with API entries by `layerId`; since `layer_02`/`layer_03` exist in the API registry as `coming_soon`, online users see borders and earth-events as `coming_soon` although both are implemented and have working endpoints.
- **Confuses future agents:** Yes · **Causes errors:** Yes (toggles disabled / coming-soon badges on implemented layers).
- **Proven by:** code + docs · **Confidence:** High.

### ALIGN-005 — `CURRENT_PROJECT_STATE.md` is stale vs implemented code
- **Severity:** Critical · **Category:** Documentation staleness (state vs code)
- **Conflicting files:** `docs/state/CURRENT_PROJECT_STATE.md` vs `apps/api/src/routes/{maritime,weather,news,energy,space/satellites}.ts`, the corresponding migrations, workers, and tests.
- **Source A says:** Phase "Layer 05 Space & Satellites MVP Planning"; "Last Updated 2026-05-31"; "What Does Not Exist Yet" lists Layer 5 Space, Layer 6 Maritime, Layer 7 Infrastructure, Layer 8 News & OSINT, and "Generic layer API endpoints"; "Next Safe Steps" lists not-yet-started lanes.
- **Source B says:** Space, maritime, weather, news, energy layers are implemented end-to-end (routes + tables + workers + tests); generic `/api/layers/:layerId/objects` is implemented in `apps/api/src/routes/objects/index.ts`.
- **Why mismatch:** The single authoritative state document describes a much earlier project phase than the code on `main`.
- **Confuses future agents:** Yes · **Causes errors:** Yes (agents may re-implement existing layers or assume the generic API is absent).
- **Proven by:** code + migrations + tests + docs · **Confidence:** High.

### ALIGN-006 — `LAYER_ID_CONVENTIONS.md` marks layers 02/03 coming_soon
- **Severity:** Medium · **Category:** Layer status conflict
- **Files:** `docs/control/LAYER_ID_CONVENTIONS.md` (summary table) vs `docs/control/MVP_LAYER_REGISTRY.md`.
- **A:** Conventions table: `layer_02`, `layer_03` = coming_soon. **B:** MVP registry: both active.
- **Why mismatch:** Two control docs disagree on status even though the registry declares itself authoritative and lists this file as a deprecated summary.
- **Confuses agents:** Yes · **Causes errors:** No · **Proven by:** docs · **Confidence:** High.

### ALIGN-007 — `LAYER_ARCHITECTURE.md` internal Weather/Infrastructure conflict
- **Severity:** Medium · **Category:** Layer naming conflict
- **Files:** `docs/control/LAYER_ARCHITECTURE.md` (table row 7 `layer_07_weather` vs prose heading "Layer 7: Infrastructure (Coming Soon)").
- **A:** Table: layer 7 = Weather. **B:** Prose section: layer 7 = Infrastructure.
- **Why mismatch:** Same document contradicts itself; matches the API-code Infrastructure naming (ALIGN-001).
- **Confuses agents:** Yes · **Causes errors:** No · **Proven by:** docs · **Confidence:** High.

### ALIGN-008 — Energy frontend client uses a relative API path (no base URL)
- **Severity:** Medium · **Category:** Frontend client config
- **Files:** `apps/web/src/layers/energy/infrastructure/useEnergyInfrastructure.ts:53` (`/api/energy/infrastructure...`) vs other clients (`api.ts`, `weatherApi.ts:5`, `newsApi.ts:11`, `maritimeApi.ts:7`) which prefix `import.meta.env.VITE_API_BASE_URL`.
- **A:** Energy: relative path (relies on the Vite dev proxy in `vite.config.ts`). **B:** All other clients: explicit base URL.
- **Why mismatch:** Inconsistent base-URL handling; energy requests do not honor `VITE_API_BASE_URL`.
- **Confuses agents:** Yes · **Causes errors:** Yes if served without the dev proxy / with a non-default API origin · **Proven by:** code · **Confidence:** High.

### ALIGN-009 — Cesium token env var name mismatch (root vs frontend)
- **Severity:** Medium · **Category:** Environment variable mismatch
- **Files:** `apps/web/src/globe/setupCesiumToken.ts:4` and `apps/web/src/vite-env.d.ts:4` use `VITE_CESIUM_ION_ACCESS_TOKEN`; `apps/web/.env.example` matches. Root `.env.example` and root `.env` define `VITE_CESIUM_ION_TOKEN`.
- **A:** Frontend code + `apps/web/.env.example`: `VITE_CESIUM_ION_ACCESS_TOKEN`. **B:** Root env files: `VITE_CESIUM_ION_TOKEN`.
- **Why mismatch:** Root env var name is not the one the code reads (Vite loads from `apps/web/`, so the root name is unused for the token).
- **Confuses agents:** Yes · **Causes errors:** No (root file is not Vite's env source) · **Proven by:** code + config · **Confidence:** High.

### ALIGN-010 — Frontend (web) vitest suite is not run in CI
- **Severity:** Medium · **Category:** CI vs test alignment
- **Files:** `.github/workflows/ci.yml` (runs `pnpm run api:test`, builds web; no web test step) vs `apps/web/package.json` (`"test": "vitest run"`) and `apps/web/src/layers/{layer_07_weather,layer_08_news_osint,maritime}/__tests__/*.test.ts`.
- **A:** CI executes only Python data tests + API vitest + builds. **B:** Web has a test script and three layer test suites.
- **Why mismatch:** Frontend unit tests never execute in CI.
- **Confuses agents:** Yes · **Causes errors:** Yes (web regressions pass CI) · **Proven by:** config + package scripts · **Confidence:** High.

### ALIGN-011 — Python dependency mismatch (CI vs `requirements-data.txt`)
- **Severity:** Medium · **Category:** CI vs local dependency
- **Files:** `.github/workflows/ci.yml` (`pip install pytest psycopg "psycopg2-binary>=2.9,<3" websockets`) vs `requirements-data.txt` (`boto3==1.40.70`, `psycopg[binary]==3.2.13`, `pytest==9.0.3`).
- **A:** CI installs unpinned `pytest`, `psycopg`, `psycopg2-binary`, `websockets`; no `boto3`. **B:** Requirements file pins `boto3`, `psycopg[binary]`, `pytest`.
- **Why mismatch:** CI environment differs from the declared data-test dependency set (no boto3; different psycopg variants/versions; no `websockets` in the requirements file).
- **Confuses agents:** Yes · **Causes errors:** Possibly (tests importing `boto3` would fail in CI; version skew) · **Proven by:** config · **Confidence:** Medium.

### ALIGN-012 — CORS comment misstates the Vite default port
- **Severity:** Low · **Category:** Incorrect port reference / comment
- **Files:** `apps/api/src/index.ts` (comment "Frontend runs on localhost:5174 (Vite default)"; origins allow 5173 and 5174) vs `apps/web/vite.config.ts` (`port: 5174, strictPort: true`).
- **A:** Comment calls 5174 the "Vite default". **B:** Vite's default is 5173; 5174 is project-forced.
- **Why mismatch:** Inaccurate comment.
- **Confuses agents:** Yes (minor) · **Causes errors:** No · **Proven by:** code · **Confidence:** High.

### ALIGN-013 — `apps/web/.env` contains a malformed bare-token line
- **Severity:** Low · **Category:** Environment file formatting
- **Files:** `apps/web/.env` (line 1 `VITE_CESIUM_ION_ACCESS_TOKEN=<token>`; line 2 is a bare token value with no `KEY=`).
- **Why mismatch:** Line 2 has no key; it is not a valid env assignment. (File is untracked/gitignored.)
- **Confuses agents:** Yes (minor) · **Causes errors:** No · **Proven by:** file content · **Confidence:** High.

### ALIGN-014 — Layer 08 documented sources vs actual sources
- **Severity:** Medium · **Category:** Source ID/source-rule conflict
- **Files:** `docs/control/MVP_LAYER_REGISTRY.md` row 8 ("RSS/API news feeds, OSINT aggregators") vs `services/fetch-orchestrator/src/layers/layer_08_news_osint/` (GDACS + GDELT) and frontend description "Geolocated disaster/news events from GDACS".
- **A:** Registry: generic RSS/OSINT aggregators. **B:** Code: GDACS (disaster alerts) + GDELT event export.
- **Why mismatch:** The implemented sources are specific disaster/event feeds, not the documented RSS/OSINT aggregator class.
- **Confuses agents:** Yes · **Causes errors:** No · **Proven by:** code + docs · **Confidence:** High.

### ALIGN-015 — Disaster-data overlap between layer_08 (GDACS) and layer_03 (Earth Events)
- **Severity:** Medium · **Category:** Ambiguous ownership
- **Files:** `services/fetch-orchestrator/src/layers/layer_08_news_osint/gdacs_*` vs `services/fetch-orchestrator/src/layers/layer_03_earth_events/usgs_earthquakes_worker.py`; frontend local registry layer_03 source string also lists "GDACS".
- **A:** GDACS disaster alerts ingested under News & OSINT (layer_08). **B:** Earth Events (layer_03) is the natural-disaster layer and its frontend source string also names GDACS.
- **Why mismatch:** Disaster events have ambiguous layer ownership (both layers can claim GDACS-style disaster markers).
- **Confuses agents:** Yes · **Causes errors:** No · **Proven by:** code + docs · **Confidence:** Medium.

### ALIGN-016 — Duplicate npm scripts in root `package.json`
- **Severity:** Low · **Category:** Naming/packaging convention
- **Files:** root `package.json` (`"api:test": "pnpm --filter api test"` and `"test:api": "pnpm --filter api test"`).
- **Why mismatch:** Two differently-named scripts do the same thing; CI uses `api:test`.
- **Confuses agents:** Yes (minor) · **Causes errors:** No · **Proven by:** package script · **Confidence:** High.

### ALIGN-017 — Layer 09 status label inconsistency (`no_data` vs `coming_soon`)
- **Severity:** Low · **Category:** Inconsistent status label
- **Files:** `apps/web/src/lib/useLayerRegistry.ts` (layer_09 status `no_data`) vs `docs/control/MVP_LAYER_REGISTRY.md` / `apps/api/src/routes/layers.ts` (coming_soon).
- **Why mismatch:** Same unimplemented layer carries two different status labels.
- **Confuses agents:** Yes (minor) · **Causes errors:** No · **Proven by:** code + docs · **Confidence:** High.

### ALIGN-018 — Weather/News/Space/Energy route shapes vs registry "generic /objects" recommendation
- **Severity:** Medium · **Category:** API route naming conflict
- **Files:** `docs/control/MVP_LAYER_REGISTRY.md` ("Generic layer API is the recommended pattern", and rows 7/8 list `GET /api/layers/:layerId/objects`) vs `apps/api/src/routes/weather.ts` (`/weather/*`), `news.ts` (`/news/*`), `space/satellites.ts` (`/api/space/satellites*`), `energy/infrastructure.ts` (`/api/energy/infrastructure*`).
- **A:** Registry recommends/declares generic `/api/layers/:layerId/objects`. **B:** Implemented routes use sub-resource and non-`/layers` shapes (maritime is the only implemented layer that uses the generic `/objects` form).
- **Why mismatch:** Inconsistent route conventions across implemented layers; documented endpoints for several layers do not exist.
- **Confuses agents:** Yes · **Causes errors:** Yes (clients coded to the documented generic path would 404) · **Proven by:** code + docs · **Confidence:** High.

### ALIGN-019 — Aviation migration numbering gap (no `002`)
- **Severity:** Low · **Category:** Naming/sequence
- **Files:** `database/migrations/layers/layer_01_aviation/` has `001`, then `003`–`013`; no `002_*.sql`.
- **Why mismatch:** Migration sequence skips `002` (no file present in the tree).
- **Confuses agents:** Yes (minor) · **Causes errors:** No (numbering is informational) · **Proven by:** file listing · **Confidence:** Medium (a `002` may have been intentionally removed/renumbered; not provable from tree alone).

### ALIGN-020 — MVP registry "coming_soon" vs implemented layers (05/06/07/08/10)
- **Severity:** Low · **Category:** Status staleness
- **Files:** `docs/control/MVP_LAYER_REGISTRY.md` (rows 5,6,7,8,10 `coming_soon`; "Last updated 2026-05-31") vs implemented routes/tables/workers/tests for those layers.
- **Why mismatch:** The self-declared authoritative registry still marks fully-implemented layers as not yet implemented.
- **Confuses agents:** Yes · **Causes errors:** No · **Proven by:** code + docs · **Confidence:** High.

### ALIGN-021 — Work-order/lane plan vs actual state (specs imply done; state says planned)
- **Severity:** Medium · **Category:** Work order vs actual state
- **Files:** `docs/state/CURRENT_PROJECT_STATE.md` "Next Safe Steps" (lists upcoming lanes for layer 05 with specific external tool/model names per lane) vs `specs/003-layer-05-space-satellites-mvp/*` and implemented space code/tests.
- **A:** State doc: lanes are upcoming/not started. **B:** Specs + code: the layer is implemented.
- **Why mismatch:** Planning narrative describes work that the codebase shows as complete.
- **Confuses agents:** Yes · **Causes errors:** No · **Proven by:** docs + code · **Confidence:** High.

### ALIGN-022 — Integration reviews and handoff log have no entries for weather/news layers
- **Severity:** Low · **Category:** Handoff vs current main
- **Files:** `docs/state/INTEGRATION_REVIEW_*` set (newest WO-079B) vs implemented `layer_07_weather` / `layer_08_news_osint` code dated later.
- **Why mismatch:** No integration-review document exists for the most recently implemented layers, although the workflow in `AGENTS.md` requires reviews per work order.
- **Confuses agents:** Yes (minor) · **Causes errors:** No · **Proven by:** file listing · **Confidence:** Medium.

### ALIGN-023 — `tests/data` is the only Python test path, but workers live elsewhere
- **Severity:** Medium · **Category:** Test expectation vs config
- **Files:** `pytest.ini` (`testpaths = tests/data`; `pythonpath = services/fetch-orchestrator/src` and `.`).
- **Why mismatch:** Worker/normalizer/ingestion modules are imported by tests via `pythonpath`; the config is consistent for `tests/data`, but any test outside `tests/data` (none currently) would be excluded. Recorded as a structural note: Python tests require the `pythonpath` entries that are only present in root `pytest.ini` (CI invokes `python -m pytest tests/data` from repo root, which picks up `pytest.ini`).
- **Confuses agents:** Yes · **Causes errors:** Yes if tests are run from another working directory without the root `pytest.ini` · **Proven by:** config · **Confidence:** Medium.

### ALIGN-024 — `AGENTS.md` Layer Order table omits `layer_10_energy_infrastructure`
- **Severity:** Medium · **Category:** Layer numbering completeness
- **Files:** `AGENTS.md` "Layer Order" table (rows `layer_00`…`layer_09`) vs `docs/control/MVP_LAYER_REGISTRY.md` (row 10) and energy code.
- **Why mismatch:** The roles/rules document does not list the energy layer that the registry and code define.
- **Confuses agents:** Yes · **Causes errors:** No · **Proven by:** docs · **Confidence:** High.

### ALIGN-025 — No root `README`
- **Severity:** Low · **Category:** Documentation completeness
- **Files:** repo root (`git ls-files` top level: no `README*`).
- **Why mismatch:** No top-level entry document; onboarding relies on `AGENTS.md` + control docs.
- **Confuses agents:** Yes (minor) · **Causes errors:** No · **Proven by:** `git ls-files` · **Confidence:** High.

### ALIGN-026 — `/api/layers` list vs `/api/layers/registry` disagree on layer count
- **Severity:** High · **Category:** API endpoint behavior conflict
- **Files:** `apps/api/src/routes/layers.ts` (`/api/layers` returns a hardcoded 2-element list: `layer_00_globe_core`, `layer_01_aviation`, lines ~180–214; `/api/layers/registry` returns the 10-element `LAYER_REGISTRY`).
- **A:** `/api/layers` → 2 layers. **B:** `/api/layers/registry` → 10 layers.
- **Why mismatch:** Two list endpoints on the same router report different layer sets.
- **Confuses agents:** Yes · **Causes errors:** Yes (consumers of `/api/layers` see only aviation/globe) · **Proven by:** code · **Confidence:** High.

### ALIGN-027 — `/api/layers/:layerId/status` only implements globe_core + aviation
- **Severity:** High · **Category:** API endpoint coverage
- **Files:** `apps/api/src/routes/layers.ts` (status handler returns data only for `layer_00_globe_core` and `layer_01_aviation`; all other IDs hit the 404 `INVALID_LAYER` branch, lines ~254+).
- **A:** Status endpoint advertised generically (`/api/layers/:layerId/status`). **B:** It 404s for every implemented non-aviation layer (borders, earth events, space, maritime, weather, news, energy).
- **Why mismatch:** Per-layer status is unavailable for most implemented layers.
- **Confuses agents:** Yes · **Causes errors:** Yes (status checks for those layers fail) · **Proven by:** code · **Confidence:** High.

---

## 8. File Path and Location Problems

| Path referenced | Where referenced | Problem |
|-----------------|------------------|---------|
| `layer_07_infrastructure` (implied folders/tables) | `apps/api/src/routes/layers.ts`, `LAYER_ARCHITECTURE.md` prose, `CURRENT_PROJECT_STATE.md` | No such folder/table exists; layer 7 on disk is `layer_07_weather` (code, `database/migrations/layers/layer_07_weather/`, `services/.../layer_07_weather/`, `apps/web/src/layers/layer_07_weather/`). |
| "Generic layer API endpoints" listed as not existing | `CURRENT_PROJECT_STATE.md` | Exists at `apps/api/src/routes/objects/index.ts` (`/api/layers/:layerId/objects`). |
| `GET /api/layers/layer_07_weather/objects`, `GET /api/layers/layer_08_news_osint/objects` | `MVP_LAYER_REGISTRY.md` rows 7/8 | Not implemented as `/objects`; actual paths are `/weather/*` and `/news/*`. |
| Layer 10 absent from `AGENTS.md` layer table | `AGENTS.md` | Layer exists in registry + code. |
| Root `README` | onboarding expectation | Not present at repo root. |
| `database/migrations/layers/layer_01_aviation/002_*.sql` | implied by sequence | No `002` file in the tree (gap between 001 and 003). |

No documentation was found pointing at old worktree folders, `E:\god-eyes-branch-backups`, or deleted branches within the inspected control/state docs.

---

## 9. Route and API Contract Problems

| Documented route | Actual route | File defining actual route | Contract/schema | Test coverage | Mismatch |
|------------------|--------------|----------------------------|-----------------|---------------|----------|
| `GET /api/health` | `GET /api/health` | `routes/health.ts:6` | `HealthResponseSchema` | `smoke.test.ts` | None |
| `GET /api/layers` (list with status) | `GET /api/layers` (returns only globe_core + aviation) | `routes/layers.ts:172` | `LayersListResponseSchema` | — | ALIGN-026 |
| `GET /api/layers/:layerId/status` | implemented only for `layer_00`/`layer_01` | `routes/layers.ts:254` | `LayerStatusResponseSchema` | — | ALIGN-027 |
| `GET /api/layers/registry` | returns 10 entries incl. `layer_07_infrastructure`, no `layer_10` | `routes/layers.ts:215` | `LayerRegistryResponseSchema` | — | ALIGN-001/002 |
| `GET /api/layers/:layerId` | 404 for `layer_07_weather`, `layer_10_energy_infrastructure` | `routes/layers.ts:229` | `LayerRegistrySingleResponseSchema` | — | ALIGN-001/002 |
| `GET /api/layers/:layerId/objects` | `routes/objects/index.ts:105` | objects schemas | `objects.test.ts`, `preload.test.ts` | None |
| `GET /api/layers/layer_06_maritime/objects` (+`/:objectId`,`/stats`,`/vessels/:mmsi/positions`) | as documented | `routes/maritime.ts:487/590/650/708` | maritime schemas | `maritime.test.ts` (api + web) | None |
| `GET /api/layers/layer_07_weather/objects` | actual: `/weather/{latest,current,hourly,nearby,sources,fetch-runs}` | `routes/weather.ts:435+` | weather schemas | `weather.test.ts` (api + web) | ALIGN-018 |
| `GET /api/layers/layer_08_news_osint/objects` | actual: `/news/{items,markers,sources,fetch-runs,stats}` | `routes/news.ts:415+` | news schemas | `layer_08_news_osint.test.ts`, web `news.test.ts` | ALIGN-018 |
| `GET /api/layers/layer_05_space_satellites/objects` | actual: `/api/space/satellites`(+`/categories`,`/:satelliteId`) | `routes/space/satellites.ts:261/352/418` | space schemas | `space-satellites.test.ts` | ALIGN-018 |
| `GET /api/layers/layer_10_energy_infrastructure/objects` (implied) | actual: `/api/energy/infrastructure`(+`/:featureId`,`/categories`,`/sources`) | `routes/energy/infrastructure.ts:215+` | energy schemas | `energy-infrastructure.test.ts` | ALIGN-002/018 |
| `GET /api/earth-events/latest` | as documented | `routes/earth-events.ts:113` | earth-events schemas | `earth-events.test.ts` | None |
| `GET /api/borders-boundaries/countries` | as documented | `routes/borders-boundaries.ts:98` | borders schemas | `borders-boundaries.test.ts` | None |
| `GET /api/aviation/aircraft/latest`, `/:sourceObjectId` | as defined | `routes/aviation-aircraft.ts:274/340` | aviation schemas | `aviation-aircraft.test.ts` | None |
| `/ws/aviation/aircraft/live`, `/ws/space/satellites/live` | as defined | `index.ts:69/71` | n/a | `live-aircraft.test.ts` | None |
| `GET /api/airports/:airportId/{intelligence,layout-features,public-profile}` | as defined | resp. `airport-intelligence/index.ts:11`, `airport-layout-features/index.ts:17`, `public-profile/index.ts:37` | resp. schemas/types | resp. tests | None |

---

## 10. Database Contract Problems

| Table group | Migration file | Ingestion file | API query file | Test file | Docs | Mismatches / ownership |
|-------------|----------------|----------------|----------------|-----------|------|------------------------|
| core | `core/001_core_ingestion_tables.sql` (`fetch_runs`, `raw_objects`) | (shared) | (shared) | per-layer migration tests | registry "fetch_runs" pattern | None |
| aviation | `layers/layer_01_aviation/001,003–013` | aviation DB modules in fetch-orchestrator | `routes/objects/*`, `aviation-aircraft.ts`, airport routes | `tests/data/layer_01_aviation/*` | registry row 1 | `002` gap (ALIGN-019) |
| borders | `layers/layer_02_borders_boundaries/001_borders_boundaries_schema.sql` | `natural_earth_admin0_ingest.py` | `borders-boundaries.ts` | `tests/data/layer_02_borders_boundaries/*` | registry row 2 | Status divergence (ALIGN-004/006) |
| earth events | `layers/layer_03_earth_events/001_earth_events_tables.sql` | `earth_events_db.py` | `earth-events.ts` | `tests/data/layer_03_earth_events/*` | registry row 3 | Status divergence; GDACS overlap (ALIGN-015) |
| space | `layers/layer_05_space_satellites/001,002` | `space_satellites_db.py` | `space/satellites.ts` | `tests/data/layer_05_space_satellites/*` | registry row 5 | Registry coming_soon vs implemented (ALIGN-020) |
| maritime | `layers/layer_06_maritime/001_maritime_tables.sql` | `maritime_db_writer.py`, `maritime_ingestion.py` | `maritime.ts` | `tests/data/layer_06_maritime/*` | registry row 6 | Status divergence (ALIGN-004/020) |
| weather | `layers/layer_07_weather/001_weather_tables.sql` | `database/ingestion/.../weather_ingestion.py` | `weather.ts` | `tests/data/layer_07_weather/*` | registry row 7 (`layer_07_weather`) | Layer-7 identity conflict in API registry (ALIGN-001) |
| news | `layers/layer_08_news_osint/001_news_tables.sql` | `database/ingestion/.../{gdacs,gdelt}_db_ingestion.py` | `news.ts` | `tests/data/layer_08_news_osint/*` | registry row 8 | Source mismatch (ALIGN-014); overlap (ALIGN-015) |
| energy | `layers/layer_10_energy_infrastructure/001_energy_infrastructure_tables.sql` | `energy_infrastructure_db.py` | `energy/infrastructure.ts` | `tests/data/layer_10_energy_infrastructure/*` | registry row 10 | Absent from API in-code registry (ALIGN-002) |
| military (04) | none | none | none | none | registry row 4 | None (unimplemented) |
| user shapes (09) | none | none | none | none | registry row 9 | Status label (ALIGN-017) |

No SQL `VIEW`/`MATERIALIZED VIEW` or trigger objects surfaced in the `CREATE` scan of `database/migrations` (only `CREATE TABLE` statements were found); table ownership maps cleanly to one layer each.


---

## 11. Worker and Live Data Problems

| Layer | Module path (run base = `services/fetch-orchestrator/src`) | How docs say to run | How code exposes it | Env vars | DB writes | Raw writes | API/FE dependency | Mismatches/Evidence |
|-------|-----------------------------------------------------------|---------------------|---------------------|----------|-----------|------------|-------------------|---------------------|
| 01 Aviation | `layers/layer_01_aviation/*_worker.py`, `ourairports_collector.py` | registry "standard pattern" | direct module scripts | `DATABASE_URL` | Yes | Yes (`raw/layer_01_aviation/...`) | Yes (objects/aircraft APIs) | None notable |
| 02 Borders | `layers/layer_02_borders_boundaries/natural_earth_admin0_ingest.py` | WO/spec docs | module script | `DATABASE_URL` | Yes | optional | Yes (borders API) | Status docs (ALIGN-004/006) |
| 03 Earth Events | `layers/layer_03_earth_events/usgs_earthquakes_worker.py` | registry/spec | module script | `DATABASE_URL` | Yes | Yes | Yes (earth-events API) | GDACS overlap (ALIGN-015) |
| 05 Space | `layers/layer_05_space_satellites/space_satellites_worker.py` | spec 003 | module script | `DATABASE_URL`, `SPACETRACK_EMAIL`, `SPACETRACK_PASSWORD` (per root `.env`) | Yes | Yes | Yes (space API + WS) | State doc says not existing (ALIGN-005) |
| 06 Maritime | `layers/layer_06_maritime/maritime_cli.py` | spec 005 | argparse CLI | `DATABASE_URL`, `AISSTREAM_API_KEY` | Yes | Yes | Yes (maritime API) | Status divergence (ALIGN-004/020) |
| 07 Weather | `python -m layers.layer_07_weather.weather_cli {proof,dry-run,fetch,inspect-cache}`; `python -m layers.layer_07_weather` (→ `weather_local_seed`) | `services/.../layer_07_weather/README.md` (matches) | argparse CLI + `__main__` | none for fetch ("No API key, no .env"); `DATABASE_URL` for ingestion (`database/ingestion/.../weather_ingestion.py`) | fetch: No; ingestion: Yes | Yes (`raw/layer_07_weather/open-meteo/...`) | Yes (weather API) | Layer-7 identity conflict (ALIGN-001) |
| 08 News/OSINT | `python -m layers.layer_08_news_osint --source gdacs|gdelt --proof [--normalize] [--ingest-db]` | docstring in `__main__.py` | argparse CLI | `DATABASE_URL` (required for `--ingest-db`) | with `--ingest-db`: Yes | Yes (saved under `tmp/`, "not committed") | Yes (news API) | Source mismatch (ALIGN-014); overlap (ALIGN-015) |
| 10 Energy | `layers/layer_10_energy_infrastructure/energy_infrastructure_worker.py` | spec 004 / contract doc | module script | `DATABASE_URL`; source keys (WRI/OSM/GEM) | Yes | Yes | Yes (energy API) | Absent from API registry (ALIGN-002) |

Notes: weather raw output path documented as `raw/layer_07_weather/open-meteo/{yyyy}/{mm}/{dd}/{fetch_run_id}/` (matches `weather_cli.py inspect-cache` glob `raw/layer_07_weather/open-meteo/*/*/*/run_*`). News CLI writes proof output under `tmp/` (gitignored). No live worker was executed during this audit.

---

## 12. Test and CI Alignment Problems

- **CI workflow (`.github/workflows/ci.yml`) steps:** install JS deps (frozen lockfile) → Python 3.11 → `pip install pytest psycopg "psycopg2-binary>=2.9,<3" websockets` → `python -m pytest tests/data -q` → build `@god-eyes/contracts` → build `api` → build `web` → `pnpm run api:test` → `git diff --check` (whitespace).
- **Local/docs test commands:** `pytest.ini` sets `pythonpath = services/fetch-orchestrator/src` + `.`, `testpaths = tests/data`. `requirements-data.txt` = `boto3==1.40.70`, `psycopg[binary]==3.2.13`, `pytest==9.0.3`.
- **Package scripts:** root `api:test`/`test:api` → `pnpm --filter api test`; `apps/api` `test` = `vitest run`; `apps/web` `test` = `vitest run`; `packages/contracts` `test` = `vitest run`.

Reported alignment problems:
- **Commands that differ:** CI installs `psycopg2-binary` + unpinned `pytest`/`psycopg` + `websockets`; `requirements-data.txt` pins `boto3` + `psycopg[binary]` + `pytest`. Different sets/versions (ALIGN-011).
- **Missing dependency assumptions:** `boto3` is in `requirements-data.txt` but not installed in CI; `websockets` is installed in CI but not in `requirements-data.txt`.
- **Tests requiring PYTHONPATH:** data tests rely on `pytest.ini` `pythonpath`; CI runs `python -m pytest tests/data` from repo root (picks up `pytest.ini`), so it works in CI but would break if run from another directory (ALIGN-023).
- **Tests validating routes no longer documented:** web/API tests assert `/api/layers/.../weather/current`, `/news/items`, `/layer_06_maritime/objects` — these work, but the registry documents `/objects` generic forms for weather/news that do not exist (ALIGN-018).
- **Docs mentioning tests that do not exist:** none identified.
- **Web tests not executed by CI:** `apps/web` vitest suites (weather/news/maritime `__tests__`) are never invoked by the workflow (ALIGN-010).
- **Skip markers:** no `skip`-marked incomplete/stale tests were surfaced in the inspected suites (not exhaustively enumerated).

---

## 13. Frontend Alignment Problems

- **Layer registry:** `LOCAL_LAYER_REGISTRY` (11 entries) vs API in-code registry (10 entries, different layer-7 ID, no layer-10). Merge keeps local then appends API-only entries → duplicate Layer 7 when online (ALIGN-003); API entries override local status for layers 02/03/06 → implemented layers display as `coming_soon` (ALIGN-004).
- **User-visible names:** Frontend names diverge from registry/API: layer_06 "Maritime / Live Ships" (registry "Maritime"); API layer 7 "Infrastructure" vs frontend "Weather / Live Weather".
- **Source filters / source strings:** frontend layer_03 source string "USGS, NASA EONET, GDACS" while the implemented worker is USGS-only; frontend layer_08 "GDACS" while code adds GDELT (ALIGN-014).
- **API client paths:** aviation/borders/earth/weather/news/maritime/space clients match backend routes; energy client uses a relative path without `VITE_API_BASE_URL` (ALIGN-008).
- **Detail panel / marker rendering / empty states:** layer_07_weather and layer_08_news_osint provide marker/detail modules (`weatherMarker.ts`, `weatherDetail.ts`, `newsMarker.ts`, `newsDetail.ts`); these are gated by `isEnabled: false` in the local registry, so although implemented they are toggle-disabled by default.
- **Frontend tests vs backend outputs:** web tests assert the same sub-resource paths the backend serves (consistent with backend, divergent from registry generic docs).
- **Database concepts shown in UI:** weather/news/maritime/energy/space all surface DB-backed objects via their respective endpoints; no UI references a table the schema lacks.

---

## 14. Status and Handoff Alignment Problems

- **Completed items still marked active/planned:** `CURRENT_PROJECT_STATE.md` marks Space/Maritime/Weather(Infrastructure)/News and the generic layer API as not-existing/in-planning, though implemented (ALIGN-005, ALIGN-021).
- **Implemented layers still `coming_soon`:** `MVP_LAYER_REGISTRY.md` rows 05/06/07/08/10 (ALIGN-020); `LAYER_ID_CONVENTIONS.md` rows 02/03 (ALIGN-006).
- **Old worktree/branch references:** none found in the inspected control/state docs.
- **Missing merged/review status for Layer 07/08:** no `INTEGRATION_REVIEW_*` documents exist for weather or news layers, while `AGENTS.md` workflow requires a review per work order (ALIGN-022).
- **Contradictory next-step instructions:** `CURRENT_PROJECT_STATE.md` "Next Safe Steps" directs starting layer-05 lanes that the code shows complete (ALIGN-021).
- **Role/agent naming:** the state doc and registry attribute work to specific external tool/model identities per lane; these are recorded here only as "named external roles" to honor the report's neutral-language rule.

---

## 15. Duplicate or Conflicting Documents

| Files involved | Topic | Conflict summary | Evidence | Closer to code truth | Confidence |
|----------------|-------|------------------|----------|----------------------|------------|
| `MVP_LAYER_REGISTRY.md`, `LAYER_ARCHITECTURE.md`, `LAYER_ID_CONVENTIONS.md` | Layer list/status | Three layer tables with diverging statuses and a Weather/Infrastructure naming split | registry rows vs architecture prose vs conventions table | `MVP_LAYER_REGISTRY.md` (self-declared authoritative; matches code for layer IDs) | High |
| `MVP_LAYER_REGISTRY.md` vs `apps/api/src/routes/layers.ts` | Registry surface | Markdown registry uses `layer_07_weather` + includes layer_10; API code uses `layer_07_infrastructure` + omits layer_10 | §6 Layer 7 / Layer 10 | Markdown registry matches DB/route/frontend code; API code registry is the outlier | High |
| `MVP_LAYER_REGISTRY.md`/API registry vs `apps/web/src/lib/useLayerRegistry.ts` | Registry + status | Frontend marks 06/07/08/10 active+implemented; registry/API say coming_soon | §6 layers 6–10 | Frontend `isImplemented` matches presence of code/tables; registry status is stale | High |
| `CURRENT_PROJECT_STATE.md` vs `specs/003..007` + code | Project phase | State doc = layer-05 planning; specs + code = layers 05–10 built | §6, §14 | Specs + code | High |
| `AGENTS.md` Layer Order vs `MVP_LAYER_REGISTRY.md` | Layer enumeration | AGENTS omits layer_10 | §6 Layer 10 | Registry + code | High |
| frontend layer_03 source string vs `usgs_earthquakes_worker.py` | Earth-events sources | Frontend lists EONET/GDACS; code is USGS-only | §6 Layer 3 | Code | Medium |

---

## 16. Ambiguous Ownership Areas

- **Layer appears in frontend but not the API registry:** `layer_07_weather` and `layer_10_energy_infrastructure` are in the frontend local registry and have working routes, but neither appears in the API in-code `LAYER_REGISTRY` (which instead lists `layer_07_infrastructure`).
- **A layer's status endpoint is unowned:** `/api/layers/:layerId/status` only covers globe_core/aviation; borders/earth/space/maritime/weather/news/energy have no status owner there (ALIGN-027).
- **Disaster data ownership:** GDACS disaster events are ingested under `layer_08_news_osint`, while natural-disaster ownership otherwise belongs to `layer_03_earth_events`; the frontend earth-events source string also names GDACS (ALIGN-015).
- **Route exists but documentation points elsewhere:** weather/news/space/energy routes exist under non-generic paths while the registry documents generic `/objects` endpoints; consumers following docs would target unowned paths (ALIGN-018).
- **Docs describe a planned feature though code is implemented:** `CURRENT_PROJECT_STATE.md` "What Does Not Exist Yet" lists features that are implemented (generic layer API, maritime, weather/"infrastructure", news, space) (ALIGN-005).
- **Tests exist but state doc omits the feature:** weather/news/maritime/energy/space have data + API tests, yet the state doc does not acknowledge them.

---

## 17. Open Questions Only

- Which layer ID is canonical for layer slot 7: `layer_07_weather` or `layer_07_infrastructure`?
- Is `layer_07_infrastructure` (power grids/fiber/water) still a planned layer, or has it been fully superseded by `layer_07_weather`?
- Should the API in-code `LAYER_REGISTRY` include `layer_10_energy_infrastructure`, and should it derive from the same source as `MVP_LAYER_REGISTRY.md`?
- Which is canonical for layers 02/03/05/06/07/08/10 status: `coming_soon` (registry/API/conventions) or `active`/`implemented` (frontend + presence of code)?
- Which route shape is canonical for weather/news/space/energy: the generic `/api/layers/:layerId/objects` documented in the registry, or the sub-resource/non-`/layers` paths in code?
- Is `/api/layers` intended to return only globe_core + aviation, or the full registry?
- Is `/api/layers/:layerId/status` intended to support all implemented layers, or only aviation?
- Is `CURRENT_PROJECT_STATE.md` still the active state document, or has its role moved to the per-layer specs?
- Are the layer_07 weather and layer_08 news workers intended for local proof/seed only, or for scheduled production fetching?
- Should GDACS disaster events belong to `layer_03_earth_events`, `layer_08_news_osint`, or both?
- Which Cesium token env var is canonical: `VITE_CESIUM_ION_ACCESS_TOKEN` (code) or `VITE_CESIUM_ION_TOKEN` (root env files)?
- Should the CI workflow run the `apps/web` vitest suite and align its Python dependencies with `requirements-data.txt`?
- Is the absent aviation migration `002` an intentional renumbering, or a missing file?
- Should a root `README` exist, or is `AGENTS.md` the intended entry document?


---

## 18. Evidence Index

| Finding ID | Severity | Category | Files | Layer | Confidence |
|------------|----------|----------|-------|-------|------------|
| ALIGN-001 | Critical | Layer naming/numbering | `routes/layers.ts`, `MVP_LAYER_REGISTRY.md`, `routes/weather.ts`, `useLayerRegistry.ts`, `layer_07_weather/001_weather_tables.sql` | 07 | High |
| ALIGN-002 | Critical | Layer numbering | `routes/layers.ts`, `routes/energy/infrastructure.ts`, `useLayerRegistry.ts`, `MVP_LAYER_REGISTRY.md` | 10 | High |
| ALIGN-003 | High | Registry consumption | `useLayerRegistry.ts`, `routes/layers.ts` | 07 | High |
| ALIGN-004 | High | Status label conflict | `MVP_LAYER_REGISTRY.md`, `routes/layers.ts`, `useLayerRegistry.ts` | 02,03,06 | High |
| ALIGN-005 | Critical | Doc staleness (state vs code) | `CURRENT_PROJECT_STATE.md`, route/migration/worker/test files | 05,06,07,08,10 | High |
| ALIGN-006 | Medium | Status conflict | `LAYER_ID_CONVENTIONS.md`, `MVP_LAYER_REGISTRY.md` | 02,03 | High |
| ALIGN-007 | Medium | Layer naming | `LAYER_ARCHITECTURE.md` | 07 | High |
| ALIGN-008 | Medium | Frontend client config | `useEnergyInfrastructure.ts`, other web clients | 10 | High |
| ALIGN-009 | Medium | Env var mismatch | `setupCesiumToken.ts`, `vite-env.d.ts`, `apps/web/.env.example`, root `.env`/`.env.example` | n/a | High |
| ALIGN-010 | Medium | CI vs test | `ci.yml`, `apps/web/package.json`, web `__tests__` | 06,07,08 | High |
| ALIGN-011 | Medium | CI vs dependency | `ci.yml`, `requirements-data.txt` | n/a | Medium |
| ALIGN-012 | Low | Port reference | `index.ts`, `vite.config.ts` | n/a | High |
| ALIGN-013 | Low | Env file format | `apps/web/.env` | n/a | High |
| ALIGN-014 | Medium | Source rule conflict | `MVP_LAYER_REGISTRY.md`, `layer_08_news_osint/*`, `useLayerRegistry.ts` | 08 | High |
| ALIGN-015 | Medium | Ambiguous ownership | `gdacs_*`, `usgs_earthquakes_worker.py`, `useLayerRegistry.ts` | 03,08 | Medium |
| ALIGN-016 | Low | Packaging scripts | root `package.json` | n/a | High |
| ALIGN-017 | Low | Status label | `useLayerRegistry.ts`, `MVP_LAYER_REGISTRY.md`, `routes/layers.ts` | 09 | High |
| ALIGN-018 | Medium | API route naming | `MVP_LAYER_REGISTRY.md`, `weather.ts`, `news.ts`, `space/satellites.ts`, `energy/infrastructure.ts` | 05,07,08,10 | High |
| ALIGN-019 | Low | Migration sequence | `layers/layer_01_aviation/` | 01 | Medium |
| ALIGN-020 | Low | Status staleness | `MVP_LAYER_REGISTRY.md`, route/migration/worker/test files | 05,06,07,08,10 | High |
| ALIGN-021 | Medium | Work order vs state | `CURRENT_PROJECT_STATE.md`, `specs/003..007` | 05 | High |
| ALIGN-022 | Low | Handoff vs main | `INTEGRATION_REVIEW_*`, weather/news code | 07,08 | Medium |
| ALIGN-023 | Medium | Test config | `pytest.ini`, `ci.yml` | n/a | Medium |
| ALIGN-024 | Medium | Layer enumeration | `AGENTS.md`, `MVP_LAYER_REGISTRY.md` | 10 | High |
| ALIGN-025 | Low | Doc completeness | repo root | n/a | High |
| ALIGN-026 | High | API endpoint behavior | `routes/layers.ts` | all | High |
| ALIGN-027 | High | API endpoint coverage | `routes/layers.ts` | 02,03,05,06,07,08,10 | High |

---

## 19. Final Audit Integrity Check

- **Files other than `docs/audits/PROJECT_ALIGNMENT_REPORT.md` created or modified:** None. (`docs/audits/` directory was created solely to hold the report file.)
- **`git status` output after report creation:** see verbatim block below.
- **Report includes recommendations:** NO.
- **Branch created:** NO.
- **Commit made:** NO.
- **Push made:** NO.
- **Final verdict:** PASS WITH NOTES — the audit completed read-only on `main` at `2fe2367`, producing one report file. The "NOTES" reflect that some confidence levels are Medium where a single source could not fully disambiguate intent (ALIGN-011, 015, 019, 022, 023), and that the report records findings only without remediation.

### Verbatim `git status --short --branch` after report creation

```
## main...origin/main
?? docs/audits/
```



---

## Alignment Fix Follow-up

A repository alignment pass was performed on branch
`alignment/project-docs-code-registry-fix`. Registry/status/route/config/doc findings were
addressed and documented in `docs/audits/PROJECT_ALIGNMENT_FIX_REPORT.md`. Canonical
decisions: `layer_07_weather` is Layer 07; `layer_10_energy_infrastructure` is included in
all active registries; active control docs use neutral role names only. No layer business
logic was changed.
