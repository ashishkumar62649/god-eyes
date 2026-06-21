# GOD EYES Project Control

Classification: ACTIVE_CONTROL
Last updated: 2026-06-17 (WO-001 ownership matrix alignment)

This is the single active control document for GOD EYES. It merges the engineering
rules, layer registry, ownership matrix, source/data contract, Git workflow, and work
order template into one file so agents do not need to load several overlapping control
documents.

Active agents read `AGENTS.md` first. When they need project rules, they read this file.
Archived documents, retired filenames, and old reports never override this file.

---

# Part 1 - Engineering Rules

> **Every agent must read this document before creating, moving, naming, splitting,
> or refactoring any code, database, API, or data-pipeline file.**

Neutral role names only. Use "user / decision-control layer" for coordination decisions.

---

## 1. Purpose and Authority

This is the consolidated active engineering rulebook for GOD EYES. It defines how files,
folders, database objects, API surfaces, live-data systems, and refactors must be
structured from this point forward.

**New work must follow these rules.**

Existing code is grandfathered temporarily until audited and refactored through dedicated
refactor branches. No agent may silently refactor existing code while doing feature,
bug-fix, or documentation work.

This section consolidates the retired engineering, data-location, pipeline handoff, and
layer-ID convention documents. Historical content remains in Git history. This file is
the active rule source for engineering, folder, API, database, and pipeline structure.

---

## 2. Agent Reading Model

See `AGENTS.md` §Agent Reading Policy for the full four-tier reading policy
(always / task-specific / search-only / never-read-by-default).

Always-read summary: `AGENTS.md` → `.specify/memory/constitution.md` →
`docs/control/PROJECT_CONTROL.md` → `docs/state/CURRENT_PROJECT_STATE.md` →
`docs/state/RECENT_CONTEXT.md` → task-specific spec or work order.

`docs/state/HANDOFF_LOG.md` is search-only. Do not load it in full.

---

## 3. Non-Negotiable Safety Rules

These rules may not be overridden by any work order or agent decision:

1. Everything must belong to a registered layer (`layer_id`).
2. No agent modifies files outside its folder ownership (see `docs/control/PROJECT_CONTROL.md` §8).
3. The frontend must never connect directly to the database or call external provider
   APIs directly. All data flows through the GOD EYES API.
4. The API reads from the database. The API does not import from `apps/web/` or
   `services/`.
5. Fetchers store raw data before normalization. Never normalize from an ephemeral stream.
6. Real API keys and secrets must never be committed. Secrets appear only as placeholders
   in `.env.example`.
7. No agent creates directories outside its ownership without user / decision-control layer
   approval.
8. No broad refactor in the same branch as feature or documentation work.
9. Layer 0 (Globe Core) has no fetchers, normalizers, source catalog, or DB migrations.
   It is frontend-only.
10. `docs/control/PROJECT_CONTROL.md` is authoritative for layer IDs and order.
    Do not create folders for unregistered layers.

---

## 4. Naming Rules

### File and folder names

- Layer folders must use the exact `layer_id` from `docs/control/PROJECT_CONTROL.md`.
  Example: `layer_01_aviation`, `layer_07_weather`, `layer_10_energy_infrastructure`.
- Do not use vague names: `utils`, `helpers`, `misc`, `temp`, `final`, `new`, `common`.
  These are only allowed when explicitly justified in the work order or commit message.
- File names must reflect domain and responsibility.
  Bad: `utils.ts`, `helpers.py` · Good: `aviation_normalizer.py`, `weatherMarker.ts`

### TypeScript / React

- React component files and class names: `PascalCase` (e.g. `WeatherLayer.tsx`)
- React hook files and names: `useThingName` (e.g. `useWeather.ts`)
- TypeScript non-component files: `camelCase` or `kebab-case` matching project convention
- Constants: `UPPER_SNAKE_CASE`
- Types and interfaces: `PascalCase`

### Python

- Module files: `snake_case` (e.g. `weather_normalizer.py`)
- Functions and methods: `snake_case`
- Classes: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`

---

## 5. Layer Folder Conventions

Canonical `layer_id` names (from `docs/control/PROJECT_CONTROL.md`):

```
layer_00_globe_core          layer_05_space_satellites
layer_01_aviation            layer_06_maritime
layer_02_borders_boundaries  layer_07_weather
layer_03_earth_events        layer_08_news_osint
layer_04_public_military_security  layer_09_user_shapes
layer_10_energy_infrastructure
```

Per-service folder pattern:

| Service | Pattern |
|---------|---------|
| Frontend | `apps/web/src/layers/{layer_id}/` |
| Fetch orchestrator | `services/fetch-orchestrator/src/layers/{layer_id}/` |
| Normalizer (aviation only) | `services/normalizer/src/layers/layer_01_aviation/` |
| Source catalog | `packages/source-catalog/layers/{layer_id}/` |
| DB migrations | `database/migrations/layers/{layer_id}/` |
| DB ingestion | `database/ingestion/layers/{layer_id}/` |

> **Layer ID authority:** `docs/control/PROJECT_CONTROL.md` is the authoritative
> source for layer IDs and statuses. Always check it for canonical IDs.

**Existing folders with legacy short names** (`aviation/`, `borders/`, `earth-events/`,
`space/`, `maritime/`, `energy/`) must not be renamed in feature work. Rename only through
a dedicated refactor branch per `specs/008-structure-remediation-roadmap/`.

API route pattern: `GET /api/layers/:layerId/...` — see §7.

---

## 6. Frontend Structure Rules

### Layer folder layout

```
apps/web/src/layers/layer_XX_name/
    index.ts        ← public exports; other app code imports from here
    LayerName.tsx   ← main orchestration component; no inline feature logic
    api/            ← API client functions (GOD EYES API calls only)
    hooks/          ← React hooks: state, data loading, polling
    components/     ← presentational sub-components
    mappers/        ← API response → render model transformations
    types/          ← layer-specific TypeScript types
    constants/      ← layer-specific constants
    tests/          ← layer unit tests
```

### Large layer feature structure

When a layer has more than three distinct features or a single file would exceed 400
lines, use feature subdirectories:

```
layer_XX_name/
    features/
        feature-one/
        feature-two/
    shared/         ← components/utils/types shared within this layer
```

### Rules

- `api/` files only. No `fetch()` in component or hook body.
- Hooks own state and data loading. Hooks contain no JSX.
- Components render. Components do not call the API.
- Mappers transform data. Mappers do not import React.
- No magic numbers or strings in hooks or components — use `constants/`.
- The frontend must not call external provider APIs directly.

---

## 7. API Route Structure Rules

### Route folder layout

```
apps/api/src/routes/layer_XX_name/
    index.ts        ← HTTP handlers only; no business logic
    service.ts      ← business logic; calls repository
    repository.ts   ← database access; parameterized SQL only
    mapper.ts       ← DB row → API response shape
    validation.ts   ← request/response validation (Zod)
    types.ts        ← route-local types
```

### Rules

- Route handler: HTTP concerns only (parse, call service, respond, handle errors).
- `repository.ts`: all SQL must be parameterized — use `$1`, `$2` placeholders, never
  string interpolation with user input.
- Response shapes defined in `packages/contracts/` as Zod schemas.
- API does not import from `apps/web/` or `services/`.
- New routes must address: response size limits, input validation, auth (where applicable).
- REST for normal request/response; WebSocket for high-frequency live objects (established
  pattern: aviation, satellites). Do not introduce a new transport without a work order.

---

## 8. Fetcher / Normalizer Structure Rules

### Source-based layout

```
services/fetch-orchestrator/src/layers/layer_XX_name/
    sources/
        source_name/
            client.py     ← provider API/HTTP client
            fetcher.py    ← fetch orchestration; writes raw output
            normalizer.py ← raw → normalized schema
            storage.py    ← raw storage read/write
            worker.py     ← full pipeline entry point
            cli.py        ← CLI entry (dry-run, fetch, normalize, persist modes)
            types.py      ← layer/source-local types
```

Single-source layers may omit `sources/` and put files directly under `layer_XX_name/`.

### Normalizer Location Rule (HEALTH-004) — canonical copy

- **`services/normalizer/src/layers/layer_01_aviation/`** — the historical canonical
  aviation normalizer. Owned by the Normalizer Agent. Do not move it.
- **`services/fetch-orchestrator/src/layers/<layer_id>/`** — the colocated pattern for
  all currently implemented non-aviation layers (02, 03, 05, 06, 07, 08, 10). Owned by
  the Fetcher Agent. Acceptable when fetch, normalize, and proof/seed logic are tightly
  coupled.
- Future non-aviation separated normalizers may only be placed under
  `services/normalizer/src/layers/<layer_id>/` when an explicit work order from the user
  / decision-control layer directs it. Ownership then reverts to the Normalizer Agent.
- Do not move existing normalizers in any documentation, feature, or general refactor task.
- Do not invent a new normalizer location.

### Forbidden imports

Fetcher and normalizer code must never import from `apps/web/` or `apps/api/`.
Data flows one-way: external source → fetcher → raw storage → normalizer → database.

---

## 9. Database and Migration Rules

### Table naming

Pattern: `<layer_domain>_<entity>_<role>`. Examples: `weather_observations_latest`,
`maritime_positions_latest`, `aviation_airports`.
Never: `data`, `records`, `items`, `temp_table`.

### Table categories (declare in migration comment)

| Category | Description |
|----------|-------------|
| `reference` | Slowly-changing reference data (airports, satellite catalog) |
| `latest_state` | Current snapshot of live objects (aircraft, vessels, satellites) |
| `history_timeseries` | Time-ordered records for trend or replay |
| `raw_reference` | Pointer to raw fetched objects (URIs, checksums) |
| `source_registry` | Source definitions and attribution |
| `fetch_run` | Audit log of fetch runs |
| `derived_cache` | Computed/aggregated values |
| `user_owned` | User-created content |
| `audit` | System-level audit log |

### Column rules

- Live layers must separate latest state from history in separate tables.
- Frequently queried fields (filters, bounding-box lookups) must be real columns, not
  buried in JSON/JSONB.
- JSON/JSONB is acceptable for: provider metadata, raw API response metadata, diagnostic
  payloads, and flexible attributes not queried directly.
- Spatial tables: prefer `latitude`, `longitude`, `geom` (PostGIS). Consistent naming
  within one table.
- Every normalized record should include provenance: `source_id`, `source_object_id` or
  `entity_id`, `fetched_at` or `observed_at`.

### Migration rules

- Migrations go under `database/migrations/layers/<layer_id>/NNN_description.sql`.
  Core (non-layer) migrations: `database/migrations/core/NNN_description.sql`.
- Do not edit merged or applied migrations. They are immutable.
- No destructive migration (DROP TABLE, TRUNCATE, DROP COLUMN) without user / decision-
  control layer approval and a documented rollback plan.
- Include indexes and CHECK constraints in the same migration where practical.

---

## 10. Time-Series / Live-Data Rules

These rules apply to all live layers (type: `live` in the layer registry).

### Table design

- Latest state and full observation history must be in **separate tables**. Never store
  both current and historical state in one table.
- High-volume history tables must include a UTC time column:
  `observed_at`, `recorded_at`, or `fetched_at` (TIMESTAMPTZ).
- Time-series records should include `source_id` and `source_object_id` or `entity_id`
  to support provenance tracing.

### Future high-volume candidates

These live layers are candidates for specialized time-series storage as volumes grow.
Do not implement it now; plan through a dedicated work order when volume justifies it:
Aviation (aircraft positions), Maritime (vessel history), Weather (observations),
Space & Satellites (position history), and similar high-frequency feeds.

### Rule

Do not introduce new time-series database technology without an explicit work order and
user / decision-control layer approval.

---

## 11. API Transport Rules

### REST (current default)

REST is the default for all normal request/response patterns: layer registry, object
listing, object detail, source/fetch-run metadata, search.

### Live / streaming

WebSocket is allowed for high-frequency live object streams (aviation, satellites —
established project precedent). Do not introduce a new transport technology without a
work order.

### Large result sets

Large result sets must use one or more of these strategies — never return an unbounded
raw dump:

- **Pagination:** `limit` and `offset` with a documented max limit
- **Bounding box:** spatial filter to reduce scope to visible viewport
- **Time window:** `from` and `to` for time-series data
- **Async job:** initiate, poll for result, download when ready
- **Compression / export:** return a download reference for bulk data

### API quality requirements

New API routes must address at design time:

- Response size limits (document and enforce max limit)
- Caching strategy (HTTP cache headers, in-memory TTL, or CDN where applicable)
- Rate limits (where applicable)
- Authentication and authorization (`packages/auth/` owns auth when created; **planned / future, not currently present**)
- Input validation (all query params and request bodies validated)
- Audit logging (where applicable for write or sensitive endpoints)

### Technology neutrality

This section names categories, not specific vendors. Technology selection is a planning
decision in the relevant work order.

---

## 12. Background Worker / Job Rules

### When a background job model is needed

Model a script as a background job when it outgrows simple CLI execution:

- Script takes longer than a few minutes, or
- May fail partway and needs resume/retry logic, or
- Multiple instances might run concurrently, or
- Operations staff need visibility into run status and errors

### Job state requirements

A job system, when introduced, must preserve:

- Job status (pending, running, completed, failed, partial)
- Retry count
- Source / trigger identity
- Start time, end time, duration
- Error details (message, traceback — no secrets in error records)

### Rule

Do not implement a job queue or job orchestration system without an explicit work order
and user / decision-control layer approval.

---

## 13. Data Location and Raw Path Rules

### Repository tree (current)

```
god-eyes/
├── AGENTS.md / .env.example / specs/ / docs/
├── apps/
│   ├── web/src/layers/              ← Frontend Agent
│   └── api/                         ← API Agent
├── services/
│   ├── fetch-orchestrator/src/layers/  ← Fetcher Agent
│   └── normalizer/src/layers/layer_01_aviation/  ← Normalizer Agent
├── packages/
│   ├── source-catalog/layers/       ← Fetcher Agent
│   ├── schemas/                     ← Database Agent
│   ├── contracts/                   ← API Agent
│   ├── auth/                        ← API Agent
│   ├── ui/ / layers/                ← Frontend Agent
├── database/
│   ├── migrations/layers/           ← Database Agent
│   └── ingestion/layers/            ← Database Agent
├── raw/  ← Fetcher Agent (gitignored)
├── tmp/  ← local proof output (gitignored)
└── tests/ data/ api/
```

### Raw storage path pattern (canonical)

```
raw/{layer_id}/{source_id}/{yyyy}/{mm}/{dd}/{fetch_run_id}/payload.{ext}
```

Example: `raw/layer_07_weather/open-meteo/2026/06/10/run_20260610T120000Z/batch_001.json`

All fetchers writing raw output must follow this pattern.

### Data location rules

- Raw data → `raw/{layer_id}/{source_id}/` (gitignored, never committed).
- DB migrations → `database/migrations/layers/{layer_id}/`.
- API contracts → `packages/contracts/`.
- Frontend reads types from `packages/contracts/` only. Never from `services/` or `database/`.
- Secrets only in `.env.example` as placeholders. Never in code or committed files.

### Generated and gitignored folders

Never commit or edit these directly:
`raw/`, `tmp/`, `.env`, `node_modules/`, `dist/`, `__pycache__/`, `.pytest_cache/`

Required `.gitignore` entries: `raw/`, `tmp/`, `.env`, `node_modules/`, `dist/`,
`.pytest_cache/`

---

## 14. Pipeline Handoff Rules

### Data flow

```
[External Source]
  → Fetcher Agent → raw/{layer_id}/{source_id}/...
  → Normalizer Agent → Database Agent (layer-aware tables)
  → API Agent ← database
  → Frontend Agent ← API
```

Layer 0 has no data pipeline. It is frontend-only.

### Handoff protocol

1. The producing agent completes work and appends to `HANDOFF_LOG.md`.
2. The producing agent states what is now available: table name, endpoint, or contract
   file, and which `layer_id` it belongs to.
3. The consuming agent reads the handoff entry and the referenced contract.
4. The consuming agent does its work and appends to `HANDOFF_LOG.md`.

### Forbidden cross-boundary imports

- Frontend must not import from `services/`, `database/`, or `apps/api/` source code.
- API must not import from `apps/web/` or `services/`.
- Fetcher/normalizer must not import from `apps/web/` or `apps/api/`.
- No agent creates files for a layer that has not been approved and registered.

---

## 15. Import Boundaries

| From | May import | Must never import |
|------|-----------|-------------------|
| Frontend (`apps/web/`) | `packages/contracts/`. **Planned / future, not currently present:** `packages/ui/`, `packages/layers/`. | `apps/api/`, `services/`, `database/`, external provider APIs |
| API (`apps/api/`) | `packages/contracts/`, database via `query()`. **Planned / future, not currently present:** `packages/auth/`. | `apps/web/`, `services/`, database source files |
| Fetcher/normalizer (`services/`) | External provider APIs, raw storage, Python stdlib | `apps/web/`, `apps/api/` |
| Contracts (`packages/contracts/`) | Zod only | Any application code |

**No cross-layer imports.** A frontend component for `layer_07_weather` must not import
from `layer_01_aviation`. Shared types go in `packages/contracts/` today. When the
planned `packages/ui/` is created, it may host shared React components per the
Frontend Agent's ownership row in Part 2 §8; until then, `packages/contracts/` is
the only approved shared-types location for cross-layer code.

---

## 16. File, Function, and Component Size Limits

These apply to new and modified files. Existing files are grandfathered until audited.
When modifying a file approaching a limit, note it in the commit body.

### TypeScript / React

| Lines | Status |
|-------|--------|
| 0–300 | Good |
| 301–500 | Warning — allowed with brief justification in commit |
| 501–800 | Must split by responsibility (unless approved by work order) |
| 800+ | Not allowed for new work |

### Python

| Lines | Status |
|-------|--------|
| 0–400 | Good |
| 401–700 | Warning — allowed with justification |
| 700+ | Must split unless approved by work order |

### Functions / methods

| Lines | Status |
|-------|--------|
| 0–50 | Good |
| 51–100 | Warning — consider extracting helpers |
| 100+ | Must split unless provably atomic and justified in commit |

### React components

| Lines | Status |
|-------|--------|
| 0–250 | Good |
| 251–400 | Warning — consider extracting sub-components |
| 400+ | Must split |

### Exceptions

Auto-generated files, large schema registry files (WMO codes, ICAO designators), and
static reference maps may exceed limits with documented justification in the work order
or commit body.

---

## 17. Refactor Rules

Refactoring is a dedicated class of work. It must not be combined with feature work,
bug fixes, or documentation tasks.

**What counts as a refactor:** moving or renaming a file/folder/module; changing
internal structure without changing behaviour; extracting a function/class/component;
removing dead code; changing import paths across multiple files.

**Rules:**
- Refactor work requires a dedicated branch with an explicit scope in the work order.
- Refactor work requires tests confirming behaviour is preserved before and after.
- Refactor one area, layer, or lane at a time.
- If an agent cannot determine where a file belongs, it must stop and report the
  ambiguity in `HANDOFF_LOG.md`. Do not guess.
- Agents must not create new folders unless the work order, spec, or these rules
  explicitly permit it.
- Bug fix work is not folder cleanup. Documentation work is not code movement.

---

## 18. Validation Rules

Every completed task must run and record:

- `git diff --check` — no whitespace errors
- Relevant build command (`pnpm --filter <package> build`)
- Relevant test command (`python -m pytest tests/data -q`, `pnpm --filter <package> test`)
- All results (PASS / FAIL with counts) recorded in the commit body and handoff entry

Do not commit if builds or tests fail unless the failure is pre-existing, documented, and
not caused by the current change.

---

## 19. Reviewer Checklist

Every integration review must verify these items as PASS, FAIL, or NOT APPLICABLE:

| # | Check |
|---|-------|
| 1 | **File placement** — new files in correct folder per ownership rules |
| 2 | **Folder naming** — layer folders use canonical layer IDs; feature folders are descriptive |
| 3 | **File naming** — follows conventions in §4 |
| 4 | **File size** — within limits in §16; justification documented if over limit |
| 5 | **Function/component size** — within limits in §16 |
| 6 | **Single responsibility** — each file/module has one primary responsibility |
| 7 | **Import boundaries** — §15 respected; frontend not importing backend; API not importing frontend/services |
| 8 | **DB/migration structure** — (when relevant) §9 followed |
| 9 | **API transport/performance** — (when relevant) §7 followed; pagination enforced; inputs validated |
| 10 | **Unauthorised refactor** — agent did not move/rename/restructure outside work order scope |
| 11 | **HANDOFF_LOG append-only** — appended (not prepended, not rewritten); RECENT_CONTEXT also updated |
| 12 | **Security / secrets** — no real keys/credentials committed; `.env.example` uses placeholders only |
| 13 | **Build / test results** — all required tests and builds pass; commands and results listed |

---

## 20. Exceptions / Grandfathering

The following categories of existing files may violate one or more rules in this
document. They are grandfathered until audited and repaired through a dedicated work
order.

| Category | Exception granted |
|----------|-------------------|
| Legacy files/folders with non-canonical names | Violate §5 naming until renamed by a refactor work order |
| Generated files (schema dumps, auto-generated types) | May exceed line limits (§16) |
| Historical documents and completed work order records | Append-only or immutable; not rewritten |
| Large schema/registry/static mapping files (WMO codes, ICAO designators) | May exceed line limits with documented justification |
| Early frontend layer folders with short names (`aviation/`, `space/`, etc.) | Violate §5 until refactored by dedicated branch (see `specs/008-structure-remediation-roadmap/`) |

### Agent protocol when encountering a violation

1. Note it in the commit body or handoff entry. Do not silently fix it as part of
   unrelated work.
2. Do not refactor it unless the current work order or spec explicitly includes that
   refactor in its scope.
3. Raise a separate refactor task if the violation is blocking progress.

---

## 21. What Not to Do

- Do not edit existing migrations. They are immutable.
- Do not write SQL with string interpolation of user input. Use parameterized queries.
- Do not store real secrets or API keys anywhere in the repository.
- Do not call external provider APIs from frontend code.
- Do not create a new normalizer location without an explicit work order.
- Do not move or rename layer folders in feature or documentation work.
- Do not introduce new database technology, job queue, or transport layer without a work
  order and user / decision-control layer approval.
- Do not combine refactor work with feature or bug-fix work in the same branch.
- Do not create folders or files for unregistered layers.
- Do not exceed file size limits without documenting the justification.
- Do not silently fix structural issues while doing unrelated work. File a separate task.

---

## Change Process

To add, modify, or supersede a rule:

1. Create a work order for the user / decision-control layer.
2. State the rule to be changed, the reason, and the proposed replacement.
3. Update this file.
4. Update any other affected control documents.
5. Append entries to `HANDOFF_LOG.md` and `RECENT_CONTEXT.md`.

**Source lineage:** retired engineering, data-location, pipeline handoff, and layer-ID
convention documents.

**Last updated:** 2026-06-17 (WO-001 ownership matrix alignment — planned/future markers added for `packages/ui/`, `packages/layers/`, `packages/auth/`)

---

# Part 2 - Layer Registry, Ownership, and Data Contract

> **Authoritative source for layer IDs, agent ownership, and source-to-frontend contracts.**
> Any code, config, or doc that references a layer must use the `layer_id` from this file.
> Engineering structure rules, file sizes, folder layout, naming, and refactor policy live
> in Part 1 of this same file.

Neutral role names only. Use "user / decision-control layer" for coordination decisions.

---

## 1. Purpose and Authority

This section is the consolidated layer and data contract for GOD EYES. It defines:

- The canonical layer registry (IDs, names, statuses, types, safety notes)
- Agent and folder ownership
- Source-to-frontend contract requirements
- Rules for adding or changing layers and sources

This section consolidates the retired layer registry, layer architecture, ownership, and
source-to-frontend contract documents. Those source filenames are retired; this section is
the active layer/data contract source.

---

## 2. Relationship to Engineering Rules

| Layer/data sections own | Engineering rule sections own |
|----------------|-----------------------|
| Layer registry (IDs, statuses, types, safety) | File/folder naming conventions |
| Agent/folder ownership matrix | File size limits |
| Source-to-frontend contract fields | Frontend, API, fetcher/normalizer structure rules |
| Source family catalogue | Database/migration rules |
| Rules for adding/changing layers and sources | Import boundaries, refactor policy |

When there is a conflict between layer/source/ownership sections and engineering rule sections on a layer/source/ownership
topic, the layer/data sections win. When there is a conflict on a structure/naming/size topic, the engineering rule sections win.

---

## 3. Layer Registry Authority

This file is the authoritative source for layer IDs, layer statuses, and layer order.

**This file supersedes** the older layer lists, ownership matrix, source contract, and
layer ID convention documents. Historical content remains in Git history.

**Registry drift rule:** If any document, code, or config disagrees with the layer IDs,
names, or statuses in this registry, pause new layer work until the drift is corrected.

---

## 4. Canonical Layer Table

| # | Layer ID | Display Name | Status | Type | Default UI |
|---|----------|-------------|--------|------|-----------|
| 0 | `layer_00_globe_core` | Globe Core | **active** | static | Always ON |
| 1 | `layer_01_aviation` | Aviation | **active** | live | ON |
| 2 | `layer_02_borders_boundaries` | Borders & Boundaries | **active** *(local-dev only)* | static | ON |
| 3 | `layer_03_earth_events` | Earth Events | **active** | live | ON |
| 4 | `layer_04_public_military_security` | Public Military & Security | **coming_soon** | static (initial implementation) | — |
| 5 | `layer_05_space_satellites` | Space & Satellites | **active** *(default OFF)* | live | OFF |
| 6 | `layer_06_maritime` | Maritime | **active** *(default OFF)* | live | OFF |
| 7 | `layer_07_weather` | Weather / Live Weather | **active** *(default OFF)* | live | OFF |
| 8 | `layer_08_news_osint` | News & OSINT | **active** *(default OFF)* | live | OFF |
| 9 | `layer_09_user_shapes` | User Shapes | **coming_soon** | static | — |
| 10 | `layer_10_energy_infrastructure` | Energy Infrastructure | **active** | static | ON |

`layer_07_weather` is the canonical Layer 07. There is no `layer_07_infrastructure`.
Space uses `layer_05_space_satellites`. Energy uses `layer_10_energy_infrastructure`.

---

## 5. Layer Status Definitions

| Status | Meaning | UI Behaviour |
|--------|---------|-------------|
| `active` | Fully implemented with real data | Toggle enabled; renders on globe |
| `active (local-dev)` | Implemented for local dev only; not production-approved | Toggle enabled; renders but carries production warning |
| `active (default OFF)` | Implemented; UI toggle defaults to off | Toggle visible and enabled; off by default |
| `coming_soon` | In registry but not implemented | Toggle visible but disabled; shows "Coming Soon" badge. **Never shows fake/demo data.** |
| `no_data` | Exists in frontend; no sources configured | Toggle visible; shows "No data sources" indicator |

---

## 6. Layer Order, Rendering, and Product Rules

1. Layer 0 (Globe Core) renders first (z=0). It must never crash. 60 FPS always.
2. All other layers render on top of Layer 0 and must be independently toggleable.
3. No layer may depend on a higher-numbered layer.
4. All data layers (1+) depend on Layer 0.
5. **No fake/demo data.** Live layers with no populated database show an empty state.
6. **60 FPS safe** at all times across all toggled-on layers.
7. **layer_04_public_military_security** — public-only, static-only for the initial implementation. No live
   tracking, no real-time updates, no movement animation. UI disclaimer required:
   "Publicly available information only."
8. **layer_02_borders_boundaries** — local-dev only. Not Survey of India compliant.
   All disputed territories require individual review. Not production-approved.
9. Live layers (type: `live`) render real data only when their worker has populated the
   database. Otherwise they show an empty state.

### Generic layer API pattern (recommended for new layers)

```
GET /api/layers                           — list all layers with status
GET /api/layers/:layerId/objects          — objects for a layer
GET /api/layers/:layerId/objects/:objectId — single object
GET /api/layers/:layerId/status           — per-layer status
```

---

## 7. Layer ID Naming Pattern

```
layer_{NN}_{short_name}
```

- `NN` = two-digit zero-padded number
- `short_name` = lowercase snake_case domain name

Do not create folders, tables, API routes, or contracts for unregistered layers.
Folder-per-lane conventions are in `docs/control/PROJECT_CONTROL.md` §5.

---

## 8. Agent and Folder Ownership Matrix

| Path / Resource | Owner | Others may |
|----------------|-------|-----------|
| `AGENTS.md` | User / decision-control layer | Read only |
| `specs/` | User / decision-control layer | Read only |
| `docs/control/` | User / decision-control layer | Read only |
| `docs/work-orders/` | User / decision-control layer | Read only |
| `docs/state/CURRENT_PROJECT_STATE.md` | User / decision-control layer | Read only |
| `docs/state/HANDOFF_LOG.md` | All agents | Append only |
| `docs/state/RECENT_CONTEXT.md` | All agents | Append only |
| `apps/web/` | Frontend Agent | — |
| `packages/ui/` | **Planned / future (not currently present)** — Frontend Agent | — |
| `packages/layers/` | **Planned / future (not currently present)** — Frontend Agent | — |
| `services/fetch-orchestrator/` | Fetcher Agent | Colocated normalizer modules per Normalizer Location Rule (see `PROJECT_CONTROL.md` §8) |
| `packages/source-catalog/` | Fetcher Agent | — |
| `services/normalizer/` | Normalizer Agent (aviation only) | See Normalizer Location Rule |
| `database/` | Database Agent | — |
| `packages/schemas/` | Database Agent | — |
| `tests/data/` | Database Agent | — |
| `apps/api/` | API Agent | — |
| `packages/contracts/` | API Agent (writes); Frontend Agent and data agents read | — |
| `packages/auth/` | **Planned / future (not currently present)** — API Agent | — |
| `tests/api/` | API Agent | — |
| `.env.example` | API Agent | Read only |

> **Note (WO-001, 2026-06-17):** `packages/ui/`, `packages/layers/`, and `packages/auth/`
> are listed for historical and forward-planning reasons. They are **not currently present**
> in the repository. Agents must not search for, edit, or import from these paths until a
> future work order explicitly creates them. Today, the actually-present package folders
> under agent ownership are: `packages/contracts/` (API Agent), `packages/schemas/` (Database Agent),
> `packages/source-catalog/` (Fetcher Agent).

### Ownership rules

- An agent must not modify files outside its ownership.
- If an agent needs a change in another agent's area, it logs a request in `HANDOFF_LOG.md`.
- The user / decision-control layer resolves cross-agent conflicts.
- Worker agents (Frontend, API, Fetcher, Normalizer, Database) create local commits only.
  They must not push to remote.
- The user / decision-control layer owns all pushes to remote after review.

### Shared read access

All agents may read: `AGENTS.md`, `docs/control/*`, `docs/state/*`, `specs/*`,
`packages/contracts/*`, `.env.example`.

**Git workflow detail:** see `docs/control/PROJECT_CONTROL.md`.
**Normalizer Location Rule (canonical):** see `docs/control/PROJECT_CONTROL.md` §8.

---

## 9. Source-to-Frontend Contract

Every data source must define all fields below before any agent builds it.
The user / decision-control layer fills out this table; worker agents do not invent values.

| Field | Description | Example |
|-------|-------------|---------|
| `layer_id` | Layer this source belongs to | `layer_01_aviation` |
| `source_id` | Unique identifier within the layer | `ourairports` |
| `raw_storage_uri_pattern` | Where raw data lands (see raw path rule in `PROJECT_CONTROL.md` §13) | `raw/layer_01_aviation/ourairports/{yyyy}/{mm}/{dd}/{fetch_run_id}/payload.json` |
| `collector` | Fetcher module path | `services/fetch-orchestrator/src/layers/layer_01_aviation/ourairports_collector.py` |
| `normalizer` | Normalizer module path | `services/normalizer/src/layers/layer_01_aviation/ourairports_normalizer.py` |
| `target_tables` | DB tables written to | `aviation_airports`, `aviation_runways` |
| `api_endpoint` | API route | `GET /api/layers/layer_01_aviation/objects` |
| `frontend_layer_id` | Map layer identifier | `layer_01_aviation` |
| `tests` | Test file paths | `tests/data/layer_01_aviation/...` |

Where contract details are not yet recorded, mark them `needs contract detail` — do not invent values.

**Layer 0 exception:** Layer 0 (Globe Core) has no external data sources. It is frontend-only.

---

## 10. Implemented Source Families

| Layer | Source family | Code location | API surface |
|-------|--------------|---------------|-------------|
| `layer_01_aviation` | OurAirports / aviation reference | `services/fetch-orchestrator/src/layers/layer_01_aviation/`, `services/normalizer/src/layers/layer_01_aviation/` | `GET /api/layers/layer_01_aviation/objects` |
| `layer_01_aviation` | Aviation live aircraft | `services/fetch-orchestrator/src/layers/layer_01_aviation/aviation_live_aircraft_worker.py` | `GET /api/aviation/aircraft/latest`, `ws://.../ws/aviation/aircraft/live` |
| `layer_02_borders_boundaries` | Natural Earth Admin-0 (local-dev) | `services/fetch-orchestrator/src/layers/layer_02_borders_boundaries/` | `GET /api/borders-boundaries/countries` |
| `layer_03_earth_events` | USGS earthquakes | `services/fetch-orchestrator/src/layers/layer_03_earth_events/usgs_earthquakes_worker.py` | `GET /api/earth-events/latest` |
| `layer_05_space_satellites` | CelesTrak / Space-Track TLE feeds | `services/fetch-orchestrator/src/layers/layer_05_space_satellites/` | `GET /api/space/satellites`, `ws://.../ws/space/satellites/live` |
| `layer_06_maritime` | AIS maritime source family | `services/fetch-orchestrator/src/layers/layer_06_maritime/` | `GET /api/layers/layer_06_maritime/objects` (+ `/stats`, `/vessels/:mmsi/positions`) |
| `layer_07_weather` | Open-Meteo weather | `services/fetch-orchestrator/src/layers/layer_07_weather/`, `database/ingestion/layers/layer_07_weather/` | `GET /api/layers/layer_07_weather/weather/{latest,current,hourly,nearby,sources,fetch-runs}` |
| `layer_08_news_osint` | GDACS + GDELT event/news | `services/fetch-orchestrator/src/layers/layer_08_news_osint/`, `database/ingestion/layers/layer_08_news_osint/` | `GET /api/layers/layer_08_news_osint/news/{items,markers,sources,fetch-runs,stats}` |
| `layer_10_energy_infrastructure` | WRI / OSM / Global Energy Monitor | `services/fetch-orchestrator/src/layers/layer_10_energy_infrastructure/` | `GET /api/energy/infrastructure` (+ `/categories`, `/sources`, `/:featureId`) |

---

## 11. API / Frontend Contract Expectations

- The Frontend Agent must not invent fields. It must consume contracts from `packages/contracts/`.
- The API Agent defines response shapes in `packages/contracts/` as Zod schemas.
- The Frontend Agent reads contracts to build layer UI in `apps/web/src/layers/{layer_id}/`.
- The Database Agent defines table schemas through migrations; the API Agent reads migrations
  to understand the schema. Physical table structures remain changeable without breaking
  the API contract.
- `packages/contracts/` is the interface boundary between API and frontend.
- No agent may skip the contracts package and read database types directly in frontend code.

---

## 12. Data Ownership and Boundary Rules

- The API reads from the database. The frontend reads from the API. Never bypass this chain.
- Raw data is owned by the Fetcher Agent. Normalized data flows into the database (Database Agent).
- Secrets and API keys are never stored in code or committed files.
  They appear only as placeholders in `.env.example` (owned by the API Agent).
- `docs/archive/**` and historical documents do not override this registry or these contracts.
  Active control docs always win over archived or historical documents.
- Audit reports in `docs/audits/` are evidence, not active instructions. They do not override
  this file.

---

## 13. Adding or Changing a Layer

1. Create a work order for the user / decision-control layer.
2. Update the canonical layer table in this file (§4).
3. Update `docs/state/CURRENT_PROJECT_STATE.md`.
4. Create handoff entries for affected agents.
5. Do not create code or migrations for a new layer until the registry entry exists and
   the work order is approved.

---

## 14. Adding or Changing a Source

1. The user / decision-control layer fills out the full source contract table in §9 for
   the new source.
2. Creates work orders for Fetcher/Normalizer/Database Agents (collector + normalizer + DB).
3. Creates a work order for the API Agent (endpoint + contract in `packages/contracts/`).
4. After the API is live, creates a work order for the Frontend Agent.
5. **No agent starts work on a source without a completed contract entry in §9.**
6. Source contract details marked `needs contract detail` must be completed by the owning
   agent — do not invent values.

---

## 15. What Not to Do

- Do not create a layer folder, table, or route for an unregistered layer.
- Do not invent source contract fields. Fill in `needs contract detail` until they are known.
- Do not let the frontend import layer data types directly from `services/` or `database/`.
- Do not skip `packages/contracts/` when building frontend layer UI.
- Do not treat archived or historical documents as active registry entries.
- Do not modify this control file without a work order from the user / decision-control layer.
- Do not build layer_04 or layer_09 features until they move from `coming_soon` to `active`.
- Do not use layer_02_borders_boundaries in production without completing the boundary
  compliance review.
- Do not add new sources to layer_04_public_military_security without explicit user /
  decision-control layer approval; all sources must be public, open, and verifiable.

---

## Change Process

To add, modify, or supersede a rule or registry entry:

1. Create a work order for the user / decision-control layer.
2. State what changes, why, and the proposed new content.
3. Update this file.
4. Update `docs/state/CURRENT_PROJECT_STATE.md`.
5. Append entries to `docs/state/HANDOFF_LOG.md` and `docs/state/RECENT_CONTEXT.md`.

**Source lineage:** retired layer registry, architecture, ownership, and source contract
documents in `docs/control/`.

**Last updated:** 2026-06-17 (WO-001 ownership matrix alignment — planned/future markers added for `packages/ui/`, `packages/layers/`, `packages/auth/`)

---

# Part 3 - Git Workflow Policy

## Overview

GOD EYES uses a controlled Git workflow where worker agents create local commits, and the
Orchestrator Agent reviews and pushes to remote after verification. The cycle is:
**Build → Review/Test → Push → Next.**

Neutral role names used throughout this document are the roles defined in `AGENTS.md`:
Orchestrator Agent, Frontend Agent, Fetcher Agent, Normalizer Agent, Database Agent,
and API Agent. "Worker agents" is a category for the non-orchestrator roles.

## Worker Agents

### Allowed Actions

- Inspect repository (read-only)
- Edit only allowed folders per this file's ownership matrix
- Run required build/test checks
- Update `docs/state/HANDOFF_LOG.md`
- Create one local commit after completing assigned work

### Forbidden Actions

- Push to remote
- Push to main
- Modify protected branches
- Commit secrets, API keys, or tokens
- Commit `node_modules/`, `.env`, `.venv/`, `__pycache__/`
- Touch forbidden folders
- Mix unrelated work into one commit

### Commit Message Format

```
<type>(<area>): <short description>

Agent: <neutral role name>
Work order: <WO-NNN or "alignment">
Branch: <branch name>
Summary: <what was done>
Commands run: <build, test, etc.>
Known issues: <any blockers or "none">
Forbidden folders touched: yes/no
Secrets added: yes/no
```

Do not record model, provider, assistant, or tool product names in commit messages.
Use neutral role names only.

**Example:**

```
feat(web): add minimal Cesium globe foundation

Agent: Frontend Agent
Work order: WO-001
Branch: frontend/wo-001/layer-00-globe-core
Summary: Vite + React + CesiumJS app with token error handling
Commands run: pnpm install, pnpm --filter web build
Known issues: none
Forbidden folders touched: no
Secrets added: no
```

## Orchestrator Agent — Review & Push Gatekeeper

### Responsibilities

- Review all agent work
- Run integration checks
- Verify security/privacy
- Create `docs/state/INTEGRATION_REVIEW_[WO].md` during active work.
  Completed reviews are archived under `docs/archive/`.
- Push approved branches to remote
- Update `HANDOFF_LOG.md` with push record

### Pre-Push Verification Checklist

#### 1. Git Status

```bash
git status
```

Verify:
- [ ] No unexpected files
- [ ] No `node_modules/`
- [ ] No `.env` files
- [ ] No `.venv/` or `__pycache__/`
- [ ] No secrets in staged changes
- [ ] Only expected files from work order

#### 2. Folder Boundaries

- [ ] Frontend Agent only edited: `apps/web/`. **Planned / future, not currently present:** `packages/ui/`, `packages/layers/`.
- [ ] Fetcher Agent only edited: `services/fetch-orchestrator/`, `packages/source-catalog/`
- [ ] Normalizer Agent only edited: `services/normalizer/`
- [ ] Database Agent only edited: `database/`, `packages/schemas/`, `tests/data/`
- [ ] API Agent only edited: `apps/api/`, `packages/contracts/`, `tests/api/`. **Planned / future, not currently present:** `packages/auth/`.
- [ ] Orchestrator Agent only edited: `docs/`, `specs/` (unless explicitly asked)

#### 3. Required Checks

**Frontend:**
```bash
pnpm --filter web build
pnpm --filter web test
```

**API + Contracts:**
```bash
pnpm --filter @god-eyes/contracts build
pnpm --filter api build
pnpm --filter api test
```

**Data/Database:**
```bash
python -m pytest tests/data -q
```

#### 4. Security/Privacy Check

- [ ] No real API keys committed
- [ ] No Cesium token committed
- [ ] No `.env` committed
- [ ] No secrets in docs or logs
- [ ] No credentials in commit messages
- [ ] No private raw data committed

#### 5. Review Document

Create: `docs/state/INTEGRATION_REVIEW_[WORK_ORDER].md` (completed reviews are archived)

Include:
- PASS / FAIL / NEEDS REVIEW status
- Commands run and results
- Files reviewed
- Folder boundary verification
- Security/privacy verification
- Known issues
- Final decision

### Push Rules

**If Review = PASS:**

1. Verify branch name: `git branch`
2. Push to origin: `git push origin <branch-name>`
3. Include branch name in review document
4. Append a push record to `HANDOFF_LOG.md` (branch, commit hash, review file, checks, risks).

**If Review = FAIL or NEEDS REVIEW:**

1. Do NOT push
2. Write clear issues in the review document
3. Provide fix instructions
4. Return to the worker agent for revision

**Protected Rule:**

- Never push directly to `main` unless the project owner explicitly approves.
- Always push to a feature/agent branch first.
- Require review before any main merge.

## Branch Naming Convention

```
<role>/<work-order>/<short-name>
```

Examples:
- `frontend/wo-001/layer-00-globe-core`
- `fetcher/wo-002/aviation-airports`
- `api/wo-003/fastify-api-scaffold`
- `orchestrator/review/wo-001-integration`

## Workflow Diagram

```
Worker Agent creates local commit
    ↓
Worker Agent updates HANDOFF_LOG.md
    ↓
Orchestrator Agent reviews work
    ↓
Orchestrator Agent creates INTEGRATION_REVIEW_[WO].md (archived after completion)
    ↓
Review = PASS?
    ├─ YES → Orchestrator Agent pushes branch to origin
    │         Orchestrator Agent updates HANDOFF_LOG.md with push record
    │         Complete
    │
    └─ NO → Orchestrator Agent documents issues
            Returns to worker agent for fixes
            Worker agent revises and commits again
            Loop back to review
```

## Security Checklist

Before every push, the Orchestrator Agent must verify:

- [ ] No `.env` files committed
- [ ] No real API keys in code
- [ ] No Cesium token in code
- [ ] No credentials in commit messages
- [ ] No secrets in docs
- [ ] No `node_modules/` committed
- [ ] No `.venv/` or `__pycache__/` committed
- [ ] No private raw data committed
- [ ] All changes are from the assigned work order
- [ ] No unrelated changes mixed in

## PR / Merge Policy

This project does **not** create a PR for every small local correction. A single PR
represents one **completed work package** after the Orchestrator Agent review decision is PASS.
The user is the only role that pushes branches, opens PRs, merges PRs, and deletes
branches.

### Rules

1. Do not create a PR for every small local correction.
2. A branch may contain multiple local commits during one work package.
3. Required fixes after review should usually stay on the same branch and be
   re-checked by the Orchestrator Agent.
4. Create one PR only when the full work package is complete and the Orchestrator Agent
   decision is PASS.
5. A PR is required before anything reaches `main`.
6. A PR is required for completed features, refactors, audits, control-doc changes,
   database migrations, API contracts, and cross-lane work.
7. A PR is not required for small local corrections before the work package is
   complete.
8. Agents never push, open PRs, merge, or delete branches.
9. The user handles push, PR creation, merge, and branch deletion.

### Work package branch workflow

A work package branch typically looks like:

- local commit 1
- review
- required fix commit if needed
- reviewer re-check
- final PASS
- user pushes branch
- user opens one PR for the whole completed work package
- user merges after approval
- user deletes branch if desired

The "small local correction" rule is intentional: pushing and opening a PR is a
human-facing event. The user decides when a work package is ready to be exposed as a
PR. Agents must not bypass this rule by opening a PR "for convenience" or by pushing
a branch on their own.

### What this means for each role

- **Worker agents** (Frontend, API, Fetcher, Normalizer, Database) create local commits
  on the work-package branch; update `HANDOFF_LOG.md`; do not push; do not open PRs;
  do not merge; do not delete branches.
- **Orchestrator Agent** reviews the branch; if PASS, hands off to the user; if FAIL
  or NEEDS REVIEW, requests fixes on the same branch. The Orchestrator Agent also
  coordinates workflow and resolves cross-agent conflicts. It does not push to `main`
  directly and does not bypass the user's PR/merge authority.
- **User** — the only role that pushes branches, opens PRs, merges PRs, and deletes
  branches after a reviewer PASS.

### PR scope

A single PR must cover one work package, not several unrelated changes. If a branch
has grown to cover more than one work package, split it into multiple branches and
multiple PRs, one per work package. The user will open a separate PR for each.

### What "completed work package" means

A work package is "complete" when:

- All worker-agent tasks are done.
- The Orchestrator Agent review decision is PASS (or PASS WITH REQUIRED FIXES that are already
  resolved on the same branch).
- All required build, test, and lint checks pass.
- `HANDOFF_LOG.md` has a complete entry for the work package.
- A `docs/state/INTEGRATION_REVIEW_*.md` (or equivalent review record, or archived review) exists with
  a PASS decision.

Only then may the user push, open a PR, and merge.

---

## Rollback Procedure

If a pushed commit introduces critical issues:

1. Identify the issue.
2. Create a revert commit: `git revert <commit-hash>`
3. Push the revert: `git push origin <branch>`
4. Document in `HANDOFF_LOG.md`.
5. Notify the responsible worker agent to fix and re-submit.

## Questions or Clarifications

If any agent is unclear about the Git workflow:

1. Write a question in `HANDOFF_LOG.md`.
2. Do NOT guess or proceed without clarity.
3. Wait for the Orchestrator Agent to respond.
4. The Orchestrator Agent updates this policy if needed.

---

# Part 4 - Work Order Template

Copy this file to create a new work order: `docs/work-orders/WO-{NNN}-{agent}-{short-name}.md`

---

## Work Order: WO-{NNN}

**Assigned to:** [Agent name]
**Layer:** [layer_id or "cross-layer"]
**Created:** [Date]
**Status:** draft | active | complete | blocked

## Objective

[One sentence: what must be built.]

## Layer Context

- Layer ID: [e.g., layer_01_aviation]
- Relevant spec: [e.g., specs/002-layer-one-aviation/spec.md]

## Inputs

- [What this agent can read/use to do the work]

## Outputs

- [Files to create or modify]
- [Tests to pass]

## Acceptance Criteria

1. [Specific, testable condition]
2. [Specific, testable condition]

## Constraints

- Must follow rules in AGENTS.md
- Must not modify files outside ownership
- Must use canonical layer IDs from `docs/control/PROJECT_CONTROL.md`
- Must use file/folder rules from `docs/control/PROJECT_CONTROL.md`
- Must update `docs/state/HANDOFF_LOG.md` and `docs/state/RECENT_CONTEXT.md` when done
- Must include in commit: Agent, Work Order, Branch, Summary, Commands, Known Issues, Forbidden Folders, Secrets Added

## Dependencies

- [What must exist before this work can start]
