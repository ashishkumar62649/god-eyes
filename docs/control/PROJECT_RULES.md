# PROJECT_RULES.md — GOD EYES Engineering Rulebook

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

This file consolidates rules from `ENGINEERING_STRUCTURE_RULES.md`,
`DATA_LOCATION_RULES.md`, `PIPELINE_HANDOFF_RULES.md`, and `LAYER_ID_CONVENTIONS.md`.
Those source files remain active until the user / decision-control layer retires them.

---

## 2. Agent Reading Model

See `AGENTS.md` §Agent Reading Policy for the full four-tier reading policy
(always / task-specific / search-only / never-read-by-default).

Always-read summary: `AGENTS.md` → this file → `docs/state/CURRENT_PROJECT_STATE.md`
→ `docs/state/RECENT_CONTEXT.md` → task-specific spec or work order.

`docs/state/HANDOFF_LOG.md` is search-only. Do not load it in full.

---

## 3. Non-Negotiable Safety Rules

These rules may not be overridden by any work order or agent decision:

1. Everything must belong to a registered layer (`layer_id`).
2. No agent modifies files outside its folder ownership (see `LAYER_AND_DATA_CONTRACT.md`).
3. The frontend must never connect directly to the database or call external provider
   APIs directly. All data flows through the GOD EYES API.
4. The API reads from the database. The API does not import from `apps/web/` or
   `services/`.
5. Fetchers store raw data before normalization. Never normalise from an ephemeral stream.
6. Real API keys and secrets must never be committed. Secrets appear only as placeholders
   in `.env.example`.
7. No agent creates directories outside its ownership without user / decision-control layer
   approval.
8. No broad refactor in the same branch as feature or documentation work.
9. Layer 0 (Globe Core) has no fetchers, normalizers, source catalog, or DB migrations.
   It is frontend-only.
10. `docs/control/MVP_LAYER_REGISTRY.md` is authoritative for layer IDs and order. Do not
    create folders for unregistered layers.

---

## 4. Naming Rules

### File and folder names

- Layer folders must use the exact `layer_id` from `MVP_LAYER_REGISTRY.md`.
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

Canonical `layer_id` names (from `MVP_LAYER_REGISTRY.md`):

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

## 10. Data Location and Raw Path Rules

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

## 11. Pipeline Handoff Rules

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

## 12. Import Boundaries

| From | May import | Must never import |
|------|-----------|-------------------|
| Frontend (`apps/web/`) | `packages/contracts/`, `packages/ui/`, `packages/layers/` | `apps/api/`, `services/`, `database/`, external provider APIs |
| API (`apps/api/`) | `packages/contracts/`, `packages/auth/`, database via `query()` | `apps/web/`, `services/`, database source files |
| Fetcher/normalizer (`services/`) | External provider APIs, raw storage, Python stdlib | `apps/web/`, `apps/api/` |
| Contracts (`packages/contracts/`) | Zod only | Any application code |

**No cross-layer imports.** A frontend component for `layer_07_weather` must not import
from `layer_01_aviation`. Shared types go in `packages/contracts/` or `packages/ui/`.

---

## 13. File, Function, and Component Size Limits

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

## 14. Refactor Rules

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

## 15. Validation Rules

Every completed task must run and record:

- `git diff --check` — no whitespace errors
- Relevant build command (`pnpm --filter <package> build`)
- Relevant test command (`python -m pytest tests/data -q`, `pnpm --filter <package> test`)
- All results (PASS / FAIL with counts) recorded in the commit body and handoff entry

Do not commit if builds or tests fail unless the failure is pre-existing, documented, and
not caused by the current change.

---

## 16. Reviewer Checklist

Every integration review must verify these items as PASS, FAIL, or NOT APPLICABLE:

| # | Check |
|---|-------|
| 1 | **File placement** — new files in correct folder per ownership rules |
| 2 | **Folder naming** — layer folders use canonical layer IDs; feature folders are descriptive |
| 3 | **File naming** — follows conventions in §4 |
| 4 | **File size** — within limits in §13; justification documented if over limit |
| 5 | **Function/component size** — within limits in §13 |
| 6 | **Single responsibility** — each file/module has one primary responsibility |
| 7 | **Import boundaries** — §12 respected; frontend not importing backend; API not importing frontend/services |
| 8 | **DB/migration structure** — (when relevant) §9 followed |
| 9 | **API transport/performance** — (when relevant) §7 followed; pagination enforced; inputs validated |
| 10 | **Unauthorised refactor** — agent did not move/rename/restructure outside work order scope |
| 11 | **HANDOFF_LOG append-only** — appended (not prepended, not rewritten); RECENT_CONTEXT also updated |
| 12 | **Security / secrets** — no real keys/credentials committed; `.env.example` uses placeholders only |
| 13 | **Build / test results** — all required tests and builds pass; commands and results listed |

---

## 17. What Not to Do

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

**Source files:** `ENGINEERING_STRUCTURE_RULES.md`, `DATA_LOCATION_RULES.md`,
`PIPELINE_HANDOFF_RULES.md`, `LAYER_ID_CONVENTIONS.md`

**Last updated:** 2026-06-16
