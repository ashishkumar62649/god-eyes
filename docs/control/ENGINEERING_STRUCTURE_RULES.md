# ENGINEERING_STRUCTURE_RULES.md — GOD EYES

> **Every agent must read this document before creating, moving, naming, splitting,
> or refactoring any code, database, API, or data-pipeline file.**

Neutral role names only throughout this document.

---

## 1. Purpose

This document is the active engineering rulebook for GOD EYES future work. It defines how
files, folders, database objects, API surfaces, live-data systems, and refactors must be
structured from this point forward.

**New work must follow these rules.**

Existing code is grandfathered temporarily until audited and refactored by planned work
orders. Existing messy or inconsistent files must not be ignored forever. They must be
repaired step by step, only after research, planning, and review, through dedicated
refactor branches. No agent may silently refactor existing code while doing feature work
or documentation work.

---

## 2. Required First Read

Every agent must read the following documents before starting any task:

1. `AGENTS.md` — entry point: roles, layer registry, hard rules, workflow cycle, git rules
2. `docs/control/ENGINEERING_STRUCTURE_RULES.md` — this document
3. `docs/state/CURRENT_PROJECT_STATE.md` — active phase, implemented layers, next steps
4. `docs/state/HANDOFF_LOG.md` — what was done last and what state the project is in
5. `docs/README.md` — the documentation map; defines the classification of every
   document under `docs/` and `specs/`
6. Task-specific documents referenced in the work order or spec

Do not start implementation before reading all six.

---

## 3. Global Naming Rules

### File and folder names

- Layer folders in all services must use the exact layer ID from
  `docs/control/MVP_LAYER_REGISTRY.md` for all future work.
  Example: `layer_01_aviation`, `layer_07_weather`, `layer_10_energy_infrastructure`.
- Avoid vague file names: `utils`, `helpers`, `misc`, `temp`, `final`, `new`, `common`,
  `stuff`, `data`, `stuff2`. These names are not allowed unless the file name is explicitly
  justified in the work order or commit message.
- File names must reflect their domain and responsibility.
  Bad: `utils.ts`, `helpers.py`, `misc.ts`
  Good: `aviation_normalizer.py`, `weatherMarker.ts`, `maritimeRepository.ts`

### TypeScript / React

- React component files and class names: `PascalCase` (e.g., `WeatherLayer.tsx`,
  `MaritimeDetailPanel.tsx`)
- React hook files and names: `useThingName` (e.g., `useWeather.ts`, `useMaritime.ts`)
- TypeScript non-component files: descriptive domain names in `camelCase` or `kebab-case`
  matching project convention (e.g., `weatherApi.ts`, `weather-types.ts`)
- Constants: `UPPER_SNAKE_CASE` for module-level constants
  (e.g., `MAX_LIMIT`, `DEFAULT_POLLING_INTERVAL_MS`)
- Type and interface names: `PascalCase` (e.g., `WeatherObservationItem`,
  `MaritimeVesselObject`)

### Python

- Module files: `snake_case` (e.g., `weather_normalizer.py`, `maritime_fetcher.py`)
- Function and method names: `snake_case`
- Class names: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`

---

## 4. Layer Folder Structure

All future layer folders must use the exact layer ID as the folder name. The canonical IDs
from `docs/control/MVP_LAYER_REGISTRY.md` are:

```
layer_00_globe_core
layer_01_aviation
layer_02_borders_boundaries
layer_03_earth_events
layer_04_public_military_security
layer_05_space_satellites
layer_06_maritime
layer_07_weather
layer_08_news_osint
layer_09_user_shapes
layer_10_energy_infrastructure
```

**Existing folders with older or shortened names** (e.g., `aviation/`, `borders/`,
`earth-events/`, `space/`, `maritime/`, `energy/`) must not be renamed in this task or
any feature task. They must be audited and renamed only through dedicated refactor branches
approved by the Orchestrator Agent.

When a new layer folder is created for a layer that does not yet have a folder, it must
use the canonical layer ID name.

---

## 5. Big-Layer Feature Structure

Large layers (any layer with more than one distinct feature/domain area, or any layer
expected to grow significantly) must be organized by feature subdirectory rather than
dumping all files in one flat folder. This applies to all layers, not only aviation.

### Recommended pattern

```
layer_XX_name/
    index.ts               ← re-exports layer's public surface; other app code imports from here
    LayerName.tsx          ← main layer orchestration component; must not contain all feature logic
    features/
        feature-one/       ← one subdirectory per distinct feature or sub-domain
        feature-two/
    shared/                ← components, utils, types shared across features within this layer
```

The main layer file (`LayerName.tsx` or the equivalent orchestrator module) must
coordinate features. It must not contain all feature logic inline. Feature logic lives in
its own subdirectory.

Other app code should import from the layer's `index.ts` rather than reaching into
internal feature subdirectories.

### When this rule applies

- When a layer has more than three distinct UI features, data sub-types, or rendering modes.
- When a single file would exceed 400 lines due to feature accumulation.
- Always for new layers being designed from scratch.

---

## 6. File Size and Function Size Limits

These limits apply to all new and modified files. Existing files are grandfathered until
audited. When a file is modified as part of feature work, the agent must note if the file
is approaching a limit and flag it in the commit body.

### TypeScript / React file size

| Lines | Status |
|-------|--------|
| 0–300 | Good — no action needed |
| 301–500 | Warning — allowed with a brief justification in the commit message |
| 501–800 | Must split — break by responsibility unless explicitly approved by work order |
| 800+ | Not allowed for new work |

### Python file size

| Lines | Status |
|-------|--------|
| 0–400 | Good |
| 401–700 | Warning — allowed with justification |
| 700+ | Must split unless explicitly approved by work order |

### Function and method size

| Lines | Status |
|-------|--------|
| 0–50 | Good |
| 51–100 | Warning — consider extracting helpers |
| 100+ | Must split unless the function is a provably atomic unit and justified in commit |

### React component size

| Lines | Status |
|-------|--------|
| 0–250 | Good |
| 251–400 | Warning — consider extracting sub-components |
| 400+ | Must split |

### Exceptions to size limits

The following categories of files may exceed the limits above, but only with documented
justification in the work order, commit body, or inline comment:

- Auto-generated files (schema dumps, generated type files, migration output)
- Historical static reference files that change rarely
- Large schema registry files or constant-heavy mapping files (e.g., WMO weather code
  maps, ICAO type-designator maps)
- Controlled static configs where splitting would reduce readability

---

## 7. Frontend Structure Rules

### Recommended layer folder layout

```
apps/web/src/layers/layer_XX_name/
    index.ts               ← public exports for this layer
    LayerName.tsx          ← main Cesium/globe component for this layer
    api/                   ← API client functions (fetch calls to GOD EYES API only)
    hooks/                 ← React hooks for state, data loading, polling
    components/            ← presentational UI sub-components
    mappers/               ← data transformation: API response → render model
    types/                 ← layer-specific TypeScript types and interfaces
    constants/             ← layer-specific constants
    tests/                 ← layer unit tests
```

### Rules

- API calls live in `api/` files. No `fetch()` inside a React component or hook body.
- React state and data loading logic lives in `hooks/`. Hooks do not contain rendering JSX.
- UI rendering lives in `components/`. Components do not call the API directly.
- Data shape transformations live in `mappers/`. Mappers do not import React.
- Types live in `types/`. Never inline a complex object type in a hook or component.
- Constants live in `constants/`. No magic numbers or magic strings in hooks or components.
- Other app code should import from the layer's `index.ts` where practical.
- Do not mix large UI rendering, API calls, mappers, and types in one file.
- The frontend must not call external data provider APIs directly. All data flows through
  the GOD EYES API.

---

## 8. API Route Structure Rules

### Recommended large route folder layout

```
apps/api/src/routes/layer_XX_name/
    index.ts               ← HTTP route handlers only; no business logic
    service.ts             ← business logic; orchestrates repository calls
    repository.ts          ← database access; parameterized SQL queries
    mapper.ts              ← converts DB row shape to API response shape
    validation.ts          ← request/response validation (Zod schemas, query parsing)
    types.ts               ← route-local TypeScript types
```

### Rules

- `index.ts` / route handler: handles HTTP concerns only (parse params, call service,
  send response, handle errors). No SQL. No business logic.
- `service.ts`: owns business logic. Calls `repository.ts`. Does not write SQL directly.
- `repository.ts`: owns all database access. All SQL must be parameterized
  (use `$1`, `$2`, ... placeholders — never string interpolation with user input).
- `mapper.ts`: transforms database row shapes to API response shapes. No SQL, no HTTP.
- `validation.ts`: input validation and query parameter parsing. Returns typed values.
- `types.ts`: route-local type definitions not exposed outside this route.
- The API must not invent its own database shape. The Database Agent defines tables through
  migrations; the API Agent reads migrations to understand the schema.
- Response shapes must be defined in `packages/contracts/` using Zod schemas.
- The API must not import from `apps/web/` or `services/`.

---

## 9. Fetcher/Normalizer Structure Rules

### Recommended source-based layout under fetch-orchestrator

```
services/fetch-orchestrator/src/layers/layer_XX_name/
    __init__.py
    sources/                           ← one subfolder per source when multiple sources exist
        source_name/
            client.py                  ← provider API client (HTTP, WebSocket)
            fetcher.py                 ← fetch orchestration: call client, write raw output
            normalizer.py              ← raw → normalized schema
            storage.py                 ← raw storage read/write
            worker.py                  ← full pipeline entry point
            cli.py                     ← CLI entry for dry-run, fetch, normalize, persist modes
            types.py                   ← layer/source-local types
```

For layers with only one source, the `sources/` subdirectory is optional; files may live
directly under `layer_XX_name/`.

### Normalizer Location Rule

This rule is already documented in `docs/control/LLM_OWNERSHIP_MATRIX.md`,
`docs/control/PIPELINE_HANDOFF_RULES.md`, and `docs/control/DATA_LOCATION_RULES.md`.
It is restated here for completeness.

- `services/normalizer/src/layers/layer_01_aviation/` is the historical and canonical
  aviation normalizer location. This is owned by the Normalizer Agent. Do not move it.
- All currently implemented non-aviation layers (02, 03, 05, 06, 07, 08, 10) colocate
  their normalizer modules under
  `services/fetch-orchestrator/src/layers/<layer_id>/`. In this pattern, the Fetcher
  Agent owns the normalizer module.
- Future separated normalizers for a non-aviation layer may be created under
  `services/normalizer/src/layers/<layer_id>/` only when an explicit work order from the
  Orchestrator Agent directs this. In that case, ownership reverts to the Normalizer Agent.
- Do not move existing colocated normalizers without a dedicated refactor task.
- Do not invent a new normalizer location without explicit work order direction.

### Fetcher/normalizer forbidden imports

Fetcher and normalizer code must never import from `apps/web/` or `apps/api/`. Data flows
one-way: external source → fetcher → raw storage → normalizer → database.

---

## 10. Database Table Rules

These rules apply to new tables created for future layers and features.

### Table naming

- Table names must clearly include the domain, layer, and entity.
  Good: `weather_observations_latest`, `maritime_positions_latest`, `aviation_airports`
  Bad: `data`, `records`, `items`, `temp_table`
- Follow the pattern `<layer_domain>_<entity>_<role>` where role is one of the categories
  below.

### Table categories

Every new table must have a declared category in its migration comment block. Categories:

| Category | Description |
|----------|-------------|
| `reference` | Slowly-changing reference data (airports, satellite catalog) |
| `latest_state` | Current/latest snapshot of live objects (aircraft, vessels, satellites) |
| `history_timeseries` | Time-ordered records for trend analysis or replay |
| `raw_reference` | Pointer to raw fetched objects (evidence URIs, checksums) |
| `source_registry` | Source definitions and attribution |
| `fetch_run` | Audit log of fetch runs (source, time, counts, status) |
| `derived_cache` | Computed/aggregated values derived from base tables |
| `user_owned` | User-created content (shapes, annotations) |
| `audit` | System-level audit log |

### Column rules

- New live layers must separate latest state from history. Do not combine both in one table.
- Fields used for frequent queries, filters, or bounding-box lookups must be real columns,
  not values buried inside a JSON/JSONB column.
- JSON/JSONB columns are acceptable for: provider metadata, raw API response metadata,
  diagnostic payloads, and flexible attributes that are not queried directly.
- JSON/JSONB must not be used as a dumping ground for structured data that will be queried.
- Spatial tables must use consistent coordinate naming:
  - New location tables must prefer `latitude`, `longitude`, and `geom` (PostGIS geometry).
  - Do not mix coordinate column naming across a single table.
- Every normalized record must include provenance fields where practical:
  `source_id`, `source_object_id` or `entity_id`, `fetched_at` or `observed_at`.
- Database design must not couple directly to API or frontend shapes. Physical table
  structures must remain changeable without breaking the API contract.

---

## 11. Migration Rules

### File location

New migrations go under:
```
database/migrations/layers/<layer_id>/NNN_short_description.sql
```

Core migrations (not layer-specific) go under:
```
database/migrations/core/NNN_short_description.sql
```

### Rules

- Do not edit old, merged, or applied migrations. They are immutable.
- Add new numbered migrations for new schema changes.
- No temporary migration files. Every migration file must be production-ready.
- No destructive migration (DROP TABLE, DROP COLUMN, TRUNCATE) without explicit Orchestrator
  Agent approval and a documented rollback plan.
- Include indexes relevant to the table within the same migration file where practical.
- Include CHECK constraints for status, category, and enum-type columns where practical.
- Document migration gaps in a `database/migrations/README.md` note rather than
  renumbering existing migrations.
- The Database Agent owns migrations unless a work order explicitly delegates ownership.

---

## 12. Time-Series / Live-Data Rules

These rules apply to all live layers (type: `live` in the layer registry).

### Table design

- Latest state and full observation history must be in separate tables for live layers.
  Never store both current and historical state in one table.
- High-volume history tables must include a time column:
  `observed_at`, `recorded_at`, or `fetched_at` (UTC timestamp with timezone).
- Time-series records should include `source_id` and either `source_object_id` or
  `entity_id` where applicable, to support provenance tracing.

### Future high-volume history candidates

The following live layers are candidates for high-volume time-series storage as data
volumes grow. Do not implement specialized time-series storage in this task; plan it
through a dedicated work order when volume justifies it.

- Aviation: aircraft position observations
- Maritime: vessel position history
- Weather: observation history
- Space & Satellites: satellite position history
- Similar high-frequency position/sensor feeds

### Rule

Do not introduce new time-series database technology in this task or any feature task
without an explicit work order and Orchestrator Agent approval.

---

## 13. API Transport Rules

These rules apply to API design for current and future layers.

### REST (current default)

REST is used for all normal request/response patterns:

- Layer registry listing and status
- Object listing (with pagination, filters, bounding boxes)
- Object detail retrieval
- Source and fetch-run metadata
- Search

### Live / streaming (future)

Future live updates for high-frequency layers may introduce one-way streaming or two-way
realtime transport when polling or REST is insufficient. Current implemented patterns
(WebSocket for live aircraft, WebSocket for live satellites) establish the project
precedent. Do not introduce a new transport technology without a work order.

### Large result sets

Large result sets must use one or more of these strategies rather than returning an
unbounded raw dump:

- Pagination: `limit` and `offset` parameters with a documented max limit
- Bounding box: spatial filter to reduce scope to visible viewport
- Time window: `from` and `to` time parameters for time-series data
- Async job pattern: initiate a job, poll for result, download when ready
- Compression or export endpoint: for bulk data, return a download reference rather than
  an inline response

### API quality requirements

New API routes must address the following at design time:

- Response size limits (document and enforce max limit)
- Caching strategy (where applicable: HTTP cache headers, in-memory TTL, CDN)
- Rate limits (where applicable)
- Authentication and authorization (where applicable; `packages/auth/` is the owner)
- User input validation (all query params and request bodies must be validated)
- Audit logging (where applicable for write endpoints)

### Technology neutrality

This section intentionally names categories (REST, streaming, realtime transport, cache,
job queue, object storage, time-series store) rather than specific vendor products or
libraries. Technology selection is a planning decision made in the relevant work order.

---

## 14. Background Worker / Job Rules

### When a background job model is needed

Scripts that run on a schedule, retry on failure, or process large data batches should be
modeled as background jobs when they outgrow simple CLI scripts. Indicators:

- The script takes longer than a few minutes
- The script may fail partway and needs resume/retry logic
- Multiple instances of the script might run concurrently
- Operations staff need visibility into run status and errors

### Job state requirements

A job system, when introduced, must preserve:

- Job status (pending, running, completed, failed, partial)
- Retry count
- Source / trigger identity
- Start time, end time, duration
- Error details (message, traceback — no secrets)

### Rule

Do not implement a job queue or job orchestration system in this task or any feature task
without an explicit work order and Orchestrator Agent approval.

---

## 15. Raw Data / Object Storage Rules

### Raw payload storage

Large raw source payloads must not be stored directly in normal relational tables unless:

- The payload is small (under a few kilobytes per row), and
- Inline storage is explicitly justified in the work order

For large payloads, store only references:

```
raw_evidence_uri      TEXT    -- path or URI to raw payload
storage_key           TEXT    -- storage system key
checksum              TEXT    -- hash of raw payload for integrity
fetched_at            TIMESTAMPTZ
source_id             TEXT
```

### Raw and generated folder rules

- `raw/` and `tmp/` are local/generated output directories. Never commit them.
- `raw/` must be gitignored at all times.
- Object storage (for large raw evidence or export artifacts) may be introduced later
  through a dedicated work order. Do not assume any specific object storage vendor.

### Current raw storage path pattern

```
raw/{layer_id}/{source_id}/{yyyy}/{mm}/{dd}/{fetch_run_id}/payload.{ext}
```

All fetchers that write raw output must follow this pattern.

---

## 16. Import Boundaries

These boundaries are hard constraints. No exception is allowed without Orchestrator Agent
approval and a documented justification in the relevant work order.

| From | May import | Must never import |
|------|-----------|-------------------|
| Frontend (`apps/web/`) | `packages/contracts/` (read), `packages/ui/`, `packages/layers/` | `apps/api/`, `services/`, `database/`, direct external provider APIs |
| API (`apps/api/`) | `packages/contracts/`, `packages/auth/`, database (via `query()`) | `apps/web/`, `services/`, `database/` source files |
| Fetcher/normalizer (`services/`) | External provider APIs, raw storage, Python stdlib | `apps/web/`, `apps/api/` |
| Database (`database/`) | SQL only; no application code imports | — |
| Contracts (`packages/contracts/`) | Zod (schema library only) | Any application code |

**No cross-layer imports.** A frontend component for `layer_07_weather` must not import
directly from `layer_01_aviation`. Shared types go in `packages/contracts/` or
`packages/ui/`. Shared layer-agnostic utilities go in an approved shared package.

---

## 17. Refactor Rules

Refactoring is a dedicated class of work. It is not feature work and must not be combined
with feature work, bug fixes, or documentation tasks.

### What counts as a refactor

- Moving or renaming a file, folder, or module
- Changing the internal structure of a file without changing behavior
- Extracting a function, class, or component into a new file
- Removing dead code
- Changing import paths across multiple files

### Rules

- Refactor work requires a dedicated branch with an explicit scope stated in the work order
  or branch name.
- Refactor work requires tests confirming behavior is preserved before and after.
- Refactor work requires Orchestrator Agent review before merge.
- Refactor one area, layer, or lane at a time. Do not combine a frontend refactor with a
  database refactor in the same branch.
- If an agent cannot determine where a file belongs, it must stop and report the ambiguity
  in `HANDOFF_LOG.md`. Do not guess.
- Agents must not create new folders unless the work order, spec, or these rules explicitly
  permit it.
- Bug fix work is not folder cleanup. Documentation work is not code movement.

---

## 18. Exceptions

The following categories of existing files may violate one or more rules in this document.
They are grandfathered until audited and repaired through a dedicated work order.

| Category | Exception granted |
|----------|-------------------|
| Existing legacy files and folders with non-canonical names | Violate Section 4 naming rules until renamed by a refactor work order |
| Generated files (schema dumps, auto-generated types) | May exceed line limits (Section 6) |
| Historical documents and completed work order records | Are not rewritten (append-only or immutable) |
| Large schema / registry mapping files (WMO codes, ICAO designators) | May exceed line limits with documented justification |
| Early layer folders using short names (`aviation/`, `space/`, etc.) | Violate Section 4 until refactored by dedicated branch |

Any agent that encounters a file violating these rules must:

1. Note it in the commit body or handoff log entry.
2. Not silently refactor it as part of unrelated work.
3. Raise a separate refactor task if the violation is blocking progress.

---

## 19. Reviewer Checklist

Every Orchestrator Agent integration review must verify the following items. Each item
must be explicitly stated as PASS, FAIL, or NOT APPLICABLE with a brief reason.

| # | Check | Notes |
|---|-------|-------|
| 1 | **File placement** | Are new files in the correct folder per ownership matrix and these rules? |
| 2 | **Folder naming** | Do new folders use canonical layer IDs (for layer folders) and descriptive names (for feature folders)? |
| 3 | **File naming** | Do new files follow naming conventions (PascalCase components, snake_case Python, no vague names)? |
| 4 | **File size** | Are new/modified files within the limits in Section 6? If over limit, is justification documented? |
| 5 | **Function/component size** | Are new/modified functions and components within the limits in Section 6? |
| 6 | **Single responsibility** | Does each file/module have one primary responsibility? |
| 7 | **Import boundary** | Does the changed code respect the import boundaries in Section 16? Verify: frontend does not import from backend; API does not import from frontend/services; fetcher/normalizer does not import from frontend/API. |
| 8 | **Database/migration structure** | (When relevant) Do new tables follow Section 10? Do new migrations follow Section 11? |
| 9 | **API transport/performance** | (When relevant) Do new API routes follow Section 13? Is pagination enforced? Are inputs validated? |
| 10 | **Unauthorized refactor** | Did the agent move, rename, or restructure files outside the explicit scope of the work order? |
| 11 | **Handoff log append-only** | Was `HANDOFF_LOG.md` appended to (not prepended, not rewritten)? |
| 12 | **Security / secrets** | Are no real secrets, API keys, or credentials committed? Does `.env.example` use placeholders only? |
| 13 | **Test / build result** | Do all required tests pass? Do all required builds pass? Are commands and results listed in the handoff entry? |

---

## Change Process

To add, modify, or supersede a rule in this document:

1. Create a work order for the Orchestrator Agent.
2. State the rule to be changed, the reason, and the proposed replacement.
3. Update this file.
4. Update any other affected control documents.
5. Append a handoff entry.

## Documentation, Specs, and Audit Reports

The documentation system for the project is defined in `docs/README.md`, which sets
the classification of every document under `docs/` and `specs/` (ACTIVE_RULE,
CURRENT_STATE, APPEND_ONLY_LOG, AUDIT_REPORT, DECISION_RECORD, SPEC_WORKSPACE,
SPEC, PLAN, TASK_LIST, REVIEW_REPORT, ARCHIVE).

- **Audit reports are evidence, not active rules.** Documents in `docs/audits/` are
  research and audit reports. They are not authoritative instructions unless a control
  document in `docs/control/` explicitly adopts something from them. When citing an
  audit, the controlling rule lives in `docs/control/`, not in the audit itself.
- **Medium or large features and refactors should use `specs/`.** Each such piece of
  work gets a dedicated folder under `specs/<NNN>-<feature-or-layer-name>/` containing
  `spec.md` (what and why), `plan.md` (selected technical approach), and
  `tasks.md` (ordered implementation tasks) at minimum. `research.md`,
  `contracts/`, and `quickstart.md` are added as needed. See `specs/README.md` for
  the full pattern. Implementation agents must follow `tasks.md` and must not invent
  scope. Reviewer agents must review against `spec.md`, `plan.md`, and `tasks.md`.
- **Architecture decisions are captured as ADRs in `docs/decisions/`.** Use ADRs
  for important project-wide decisions such as documentation hierarchy, API
  architecture, database strategy, deployment strategy, or large refactor strategy.
- **Old or superseded documents go to `docs/archive/`** by dedicated cleanup only.
  Nothing is archived automatically, and no document should be moved to `docs/archive/`
  as part of feature or refactor work.
- **PR / Merge Policy lives in `docs/control/GIT_WORKFLOW_POLICY.md`.** Refactor and
  feature branches may contain multiple local commits before one final PR. Agents
  never push, open PRs, merge, or delete branches; the user handles all of those
  after the Reviewer Agent decision is PASS.

**Last updated:** 2026-06-14
**Author:** Documentation Agent
**Maintained by:** Orchestrator Agent