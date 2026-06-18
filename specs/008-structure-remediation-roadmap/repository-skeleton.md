# Target Repository Skeleton — Structure Remediation Roadmap

> **Agent:** Orchestrator Agent
> **Lane:** Documentation / Planning
> **Branch:** `spec/structure-remediation-roadmap`
> **Date:** 2026-06-15
> **Status:** Approved target skeleton. Planning only — no files are moved or renamed in
> this branch.

This file is the **approved target skeleton** for the GOD EYES repository after all
`SR-001` through `SR-018` work packages are complete. Every future agent picking up an
`SR-NNN` task must read this file before starting work.

If implementation conflicts with this skeleton, **stop and report** to the Orchestrator
Agent before proceeding.

---

## Core Rules

Every `SR-NNN` work package must follow these rules without exception:

```
No broad cleanup branch.
One focused work package per branch.
No behavior change unless the work package explicitly says so.
Preserve compatibility during renames.
Use compatibility shims during folder moves until all importers are updated.
Tests must pass before the branch moves to review.
Reviewer checks structure rules every time.
User handles push, PR, merge, and branch deletion.
```

---

## Legend

```
[KEEP]      Already correct. Do not move or rename.
[SPLIT]     Oversized file/folder must be split per responsibility.
[RENAME]    Folder or file name changes to the canonical project name.
[SHIM]      Compatibility re-export kept at the old path until all importers migrate.
[NEW]       New file or folder to be created by the work package.
[ARCHIVE]   Historical/superseded; not active instructions.
[CHECK]     Verify all references and tests before changing.
[IGNORE]    Local tool or generated file; never commit.
```

---

## Naming Conventions

These conventions are **binding** for all SR-NNN work packages.

### General

- No vague names: `utils`, `helpers`, `misc`, `temp`, `final`, `new`, `common`,
  `stuff`, `data2`, `old`, `copy`, `backup`.
- Use domain-specific names that say what the module does.
- Use canonical layer IDs wherever the folder is layer-specific.
- Layer folder names always use `layer_NN_name` pattern (snake_case).
- Non-layer component grouping folders may use kebab-case when that already exists
  in the project (e.g. `detail-panel/`, `layer-panel/`).

### Canonical Layer IDs

```
layer_00_globe_core
layer_01_aviation
layer_02_borders_boundaries
layer_03_earth_events
layer_04_public_military_security        ← coming_soon, no implementation yet
layer_05_space_satellites
layer_06_maritime
layer_07_weather
layer_08_news_osint
layer_09_user_shapes                     ← coming_soon, no implementation yet
layer_10_energy_infrastructure
```

### Frontend naming

- React components: `PascalCase.tsx`
- Hooks: `useThing.ts`
- API clients: `<domain>Api.ts` or `api/index.ts`
- Mappers: `mappers/` subfolder
- Types: `types/` subfolder or `types.ts`
- Constants: `constants/` subfolder or `constants.ts`
- Tests: `__tests__/` inside the layer folder (keep consistent within one layer)

### API naming

- Route folders use canonical layer IDs when layer-specific.
- Every large route folder contains exactly these files:

  ```
  index.ts        ← HTTP route handlers only; no business logic, no SQL
  service.ts      ← business / domain logic; calls repository
  repository.ts   ← database access only; parameterized SQL queries
  mapper.ts       ← DB row → API response shape conversion
  validation.ts   ← query param / body validation helpers
  types.ts        ← route-local TypeScript types
  ```

- `index.ts` must not contain SQL queries.
- `service.ts` must not contain SQL queries.
- `repository.ts` must not contain HTTP logic.
- `mapper.ts` must not contain SQL or HTTP logic.

### Contracts naming

- Shared cross-layer types: `packages/contracts/src/common/`
- Per-layer schemas: `packages/contracts/src/layers/layer_NN_name.ts`
- `index.ts` remains a compatibility barrel re-export; existing imports must not break.

### Fetcher / normalizer naming

- Layer folders use canonical layer IDs.
- Multi-source layers use `sources/<source_name>/` subfolders.
- Each source subfolder contains:

  ```
  client.py       ← HTTP / WebSocket client
  fetcher.py      ← orchestrate fetch + cache writes
  normalizer.py   ← raw → normalized transformation
  storage.py      ← raw cache read/write helpers
  ```

- Layer root may also contain: `worker.py`, `cli.py`, `types.py`

### Database / migrations naming

- Core migrations: `database/migrations/core/`
- Per-layer migrations: `database/migrations/layers/layer_NN_name/`
- File names: `NNN_short_description.sql` (three-digit, never renumber old files)
- Never renumber existing migration files.

### Tests naming

- Organized by lane and layer: `tests/data/layer_NN_name/`
- Large test files split by domain into subfolders:

  ```
  category_audit/
  coordinates/
  performance/
  schema/
  workers/
  fetcher/
  propagation/
  database/
  api_contract/
  ```

---

## Full Target Skeleton

### Root

```
god-eyes/
  AGENTS.md                                     # [KEEP] multi-agent entrypoint
  package.json                                  # [KEEP] workspace scripts
  pnpm-workspace.yaml                           # [KEEP] pnpm monorepo config
  docker-compose.yml                            # [KEEP] local infrastructure
  .env.example                                  # [KEEP] placeholder secrets only
  .gitignore                                    # [KEEP] user-managed; do not modify in SR tasks

  docs/                                         # [KEEP] documentation system
  specs/                                        # [KEEP] planning / work packages
  apps/                                         # [KEEP] deployable apps
  packages/                                     # [KEEP] shared packages
  services/                                     # [KEEP] data workers
  database/                                     # [KEEP] migrations / ingestion
  tests/                                        # [KEEP] test suites
  raw/                                          # [KEEP] local raw payloads — never commit payloads
  tmp/                                          # [KEEP] local generated / cache — never commit
```

### Local tool files (never commit)

```
.agents/                                        # [IGNORE] local agent CLI folder
.kiro/                                          # [IGNORE] local steering / skills
CLAUDE.md                                       # [IGNORE] local adapter note
GEMINI.md                                       # [IGNORE] local adapter note
run_graphify.py                                 # [IGNORE] local helper script
graphify-out/                                   # [IGNORE] generated graph output
```

These may exist locally but are not part of the committed project. The source of truth
is `AGENTS.md`, `docs/control/`, and `specs/`.

---

### `docs/`

```
docs/
  README.md                                     # [KEEP] documentation map

  control/
    PROJECT_CONTROL.md                          # [KEEP] single active control file
  state/
    CURRENT_PROJECT_STATE.md                    # [KEEP] live project state snapshot
    HANDOFF_LOG.md                              # [KEEP] append-only handoff timeline

  audits/
    ENGINEERING_STRUCTURE_COMPLIANCE_AUDIT.md   # [KEEP] active structure audit
    PROJECT_HEALTH_WORKFLOW_AUDIT.md            # [KEEP] active health audit
    PROJECT_HEALTH_FINDINGS_EXPLAINED.md        # [KEEP] active findings explanation

  decisions/
    ADR-001-documentation-system.md             # [KEEP]
    ADR-002-aviation-live-source.md             # [KEEP]

  archive/                                      # [ARCHIVE] completed / historical docs only
    README.md
    2026-06-14-documentation-cleanup/
    2026-06-14-spec-kit-alignment/
    2026-06-14-final-docs-structure/
    2026-06-16-docs-pruned/
```

---

### `specs/`

```
specs/
  README.md                                     # [KEEP] Spec Kit workspace guide

  008-structure-remediation-roadmap/
    README.md                                   # [KEEP] roadmap folder guide
    spec.md                                     # [KEEP] problem / safety / success criteria
    plan.md                                     # [KEEP] phase plan
    tasks.md                                    # [KEEP] SR-001..SR-018 work packages
    repository-skeleton.md                      # [KEEP] this file — approved target structure
```

---

### `apps/api/`

Current state: several large single-file routes.
Target state: every large route becomes a folder with per-responsibility files.

```
apps/
  api/
    src/
      server.ts                                 # [KEEP] Fastify server entrypoint

      lib/
        query-limits.ts                         # [NEW] shared parseLimit / parseBbox helpers
                                                #       created during SR-002 or SR-003 if approved

      routes/
        health.ts                               # [KEEP] small — no split needed
        layers.ts                               # [KEEP/CHECK] 455 lines — in warning band; review at SR-001
        aviation-aircraft.ts                    # [KEEP/CHECK] 386 lines — in warning band
        live-aircraft.ts                        # [KEEP] 236 lines — good
        borders-boundaries.ts                   # [KEEP] 293 lines — good
        earth-events.ts                         # [KEEP] 249 lines — good
        objects.ts                              # [KEEP] 6 lines — re-export shim
        objects/                                # [KEEP] reference pattern; full split already done
          index.ts
          service.ts
          repository.ts
          mapper.ts
          validation.ts
          types.ts
          constants.ts
          errors.ts
          metadata.ts
          points.ts
          clusters.ts
          density.ts
          detail.ts
          preload.ts

        airport-intelligence/                   # [KEEP] full split already done
        airport-layout-features/                # [KEEP] full split already done
        public-profile/                         # [KEEP] full split already done

        weather/                                # [SPLIT] SR-002 — from weather.ts (1095 lines)
          index.ts
          service.ts
          repository.ts
          mapper.ts
          validation.ts
          types.ts

        news/                                   # [SPLIT] SR-003 — from news.ts (1014 lines)
          index.ts
          service.ts
          repository.ts
          mapper.ts
          validation.ts
          types.ts

        maritime/                               # [SPLIT] SR-004 or follow-up — from maritime.ts (797 lines)
          index.ts
          service.ts
          repository.ts
          mapper.ts
          validation.ts
          types.ts

        space/
          space-satellites-broadcaster.ts       # [KEEP] WebSocket broadcaster
          satellites/                           # [SPLIT] SR-004 or follow-up — from satellites.ts (582 lines)
            index.ts
            service.ts
            repository.ts
            mapper.ts
            validation.ts
            types.ts

        energy/
          infrastructure/                       # [SPLIT] SR-004 or follow-up — from infrastructure.ts (683 lines)
            index.ts
            service.ts
            repository.ts
            mapper.ts
            validation.ts
            types.ts
```

---

### `apps/web/`

Current state: 6 layer folders use short non-canonical names.
Target state: all layer folders use canonical `layer_NN_name/`.

```
apps/
  web/
    src/
      App.tsx                                   # [CHECK] update imports for each SR-009..SR-014
      CesiumGlobe.tsx                           # [CHECK] 33 imports; update in every rename WP
      main.tsx                                  # [KEEP]

      lib/
        api.ts                                  # [KEEP]
        useLayerRegistry.ts                     # [KEEP]

      hooks/                                    # [KEEP]
      globe/                                    # [KEEP]
      styles/                                   # [KEEP]

      components/
        DetailPanel.tsx                         # [SHIM] thin orchestrator after SR-005
        detail-panel/                           # [NEW] SR-005
          index.ts
          AviationDetail.tsx
          MaritimeDetail.tsx
          WeatherDetail.tsx
          NewsDetail.tsx
          EnergyDetail.tsx
          SpaceDetail.tsx
          SourcesSection.tsx
          types.ts

        LayerPanel.tsx                          # [SHIM] thin orchestrator after SR-006
        layer-panel/                            # [NEW] SR-006
          index.ts
          LayerToggleRow.tsx
          layer-panels/
            AviationLayerPanel.tsx
            BordersLayerPanel.tsx
            EarthEventsLayerPanel.tsx
            SpaceLayerPanel.tsx
            MaritimeLayerPanel.tsx
            WeatherLayerPanel.tsx
            NewsLayerPanel.tsx
            EnergyLayerPanel.tsx
          types.ts

        Shell.tsx                               # [KEEP]
        StatusPanel.tsx                         # [KEEP]
        SearchCommand.tsx                       # [KEEP]
        Header.tsx                              # [KEEP]

        intel/                                  # [KEEP] aviation intel sub-panels
        overlays/                               # [KEEP] small overlay components

      layers/
        layer_01_aviation/                      # [RENAME] from aviation/ — SR-009
          index.ts                              # [SHIM] compatibility re-export at old path
          aircraft/
          airports/

        layer_02_borders_boundaries/            # [RENAME] from borders/ — SR-010
          index.ts

        layer_03_earth_events/                  # [RENAME] from earth-events/ — SR-011
          index.ts

        layer_05_space_satellites/              # [RENAME] from space/ — SR-012
          index.ts
          satellites/

        layer_06_maritime/                      # [RENAME] from maritime/ — SR-013
          index.ts

        layer_07_weather/                       # [KEEP] already canonical
          WeatherLayer.tsx
          weatherApi.ts
          useWeather.ts
          weatherTypes.ts
          weatherDetail.ts
          weatherMarker.ts
          __tests__/

        layer_08_news_osint/                    # [KEEP] already canonical
          NewsLayer.tsx
          newsApi.ts
          useNews.ts
          newsTypes.ts
          newsDetail.ts
          newsMarker.ts
          __tests__/

        layer_10_energy_infrastructure/         # [RENAME] from energy/ — SR-014
          index.ts
          infrastructure/
```

Each rename must include:

```
1. Move the folder contents to the new canonical name.
2. Add a compatibility shim at the old path pointing to the new folder.
3. Update all import paths in App.tsx, CesiumGlobe.tsx, LayerPanel.tsx, DetailPanel.tsx.
4. Update tests that reference the old path.
5. Check tsconfig.json and vite.config.ts for path aliases.
6. Run pnpm --filter web build and pnpm --filter web test before review.
```

---

### `packages/contracts/`

Current state: `index.ts` is 1326 lines with all schemas in one barrel.
Target state: schemas split by layer; `index.ts` remains as compatibility re-export.

```
packages/
  contracts/
    src/
      index.ts                                  # [SHIM] SR-007 — compatibility barrel re-export
                                                #        all existing imports keep working

      common/
        errors.ts                               # [SPLIT] SR-007 — ErrorCodes and shared error types
        pagination.ts                           # [SPLIT] SR-007 — pagination / query metadata types
        layer-status.ts                         # [SPLIT] SR-001 then SR-007 — generic LayerStatusResponse
        bbox.ts                                 # [SPLIT] SR-007 — bbox query schemas if applicable

      layers/
        layer_01_aviation.ts                    # [SPLIT] SR-007 — Airport*, Runway*, Navaid*, Aircraft* schemas
        layer_02_borders_boundaries.ts          # [SPLIT] SR-007 — Borders* schemas
        layer_03_earth_events.ts                # [SPLIT] SR-007 — EarthEvents* schemas
        layer_05_space_satellites.ts            # [SPLIT] SR-007 — Space*, Satellite* schemas
        layer_06_maritime.ts                    # [SPLIT] SR-007 — Maritime*, Vessel* schemas
        layer_07_weather.ts                     # [SPLIT] SR-007 — Weather* schemas
        layer_08_news_osint.ts                  # [SPLIT] SR-007 — News*, Marker* schemas
        layer_10_energy_infrastructure.ts       # [SPLIT] SR-007 — Energy*, Feature* schemas
```

SR-001 must land before SR-007. SR-001 repairs the generic `LayerStatusResponse` shape.
SR-007 then splits the barrel. Both are pure refactors — no schema value changes.

---

### `packages/layers/` and `packages/schemas/`

> **Note (WO-001, 2026-06-17):** `packages/layers/` is **planned / future, not currently present**.
> Only `packages/schemas/` exists today. The skeleton below documents the target shape
> for when `packages/layers/` is created by a future work order.

```
packages/
  layers/                                  # [PLANNED / FUTURE — not currently present]
    src/
      registry.ts                               # [KEEP]
      layer-ids.ts                              # [KEEP]

  schemas/                                  # [CURRENT] — owned by Database Agent
    layers/
      layer_01_aviation/                        # [KEEP] Python schemas for aviation
```

---

### `packages/source-catalog/`

```
packages/
  source-catalog/
    layers/
      layer_01_aviation/                        # [KEEP]
      layer_02_borders_boundaries/              # [KEEP]
      layer_03_earth_events/                    # [KEEP]
      layer_05_space_satellites/                # [KEEP]
      layer_06_maritime/                        # [KEEP]
      layer_07_weather/                         # [KEEP]
      layer_08_news_osint/                      # [KEEP]
      layer_10_energy_infrastructure/           # [KEEP]
```

---

### `services/fetch-orchestrator/`

Current state: multi-source layers use prefixed flat file names.
Target state: multi-source layers use `sources/<source_name>/` subfolders.

```
services/
  fetch-orchestrator/
    src/
      layers/
        layer_01_aviation/                      # [KEEP] canonical; SR-015 adds sources/ grouping
          sources/                              # [SPLIT] SR-015
            airplanes_live/
              client.py
              fetcher.py
              normalizer.py     ← NOTE: aviation normalizer lives in services/normalizer/ — see below
              storage.py
            ourairports/
              client.py
              fetcher.py
              storage.py
          worker.py
          cli.py
          types.py

        layer_02_borders_boundaries/            # [KEEP] single source — flat layout acceptable
          natural_earth_admin0_ingest.py        # [KEEP]

        layer_03_earth_events/                  # [KEEP]
          sources/
            usgs/
              client.py
              fetcher.py
              normalizer.py
              storage.py

        layer_05_space_satellites/              # [SPLIT] SR-015
          sources/
            celestrak/
              client.py
              fetcher.py
              normalizer.py
              storage.py
            space_track/
              client.py
              fetcher.py
              normalizer.py
              storage.py
          worker.py
          cli.py
          types.py

        layer_06_maritime/                      # [KEEP] single source — flat layout acceptable
          aisstream_client.py                   # [KEEP]
          maritime_normalizer.py                # [KEEP] colocated normalizer — do not move
          maritime_raw_storage.py               # [KEEP]
          maritime_fetcher.py                   # [KEEP]
          maritime_ingestion.py                 # [KEEP]
          maritime_db_writer.py                 # [KEEP]

        layer_07_weather/                       # [KEEP] single source — flat layout acceptable
          open_meteo_client.py                  # [KEEP]
          weather_raw_storage.py                # [KEEP]
          weather_local_seed.py                 # [KEEP]

        layer_08_news_osint/                    # [SPLIT] SR-015
          sources/
            gdacs/
              client.py
              fetcher.py
              normalizer.py
              storage.py
            gdelt_event_export/
              client.py
              fetcher.py
              normalizer.py
              storage.py
          worker.py
          cli.py
          types.py

        layer_10_energy_infrastructure/         # [SPLIT] SR-015
          sources/
            wri/
              client.py
              fetcher.py
              normalizer.py
              storage.py
            osm/
              client.py
              fetcher.py
              normalizer.py
              storage.py
            gem/
              client.py
              fetcher.py
              normalizer.py
              storage.py
          worker.py
          cli.py
          types.py
```

---

### `services/normalizer/`

```
services/
  normalizer/
    src/
      layers/
        layer_01_aviation/                      # [KEEP] canonical aviation normalizer — do not move
          normalizer.py
          types.py
```

The aviation normalizer stays here permanently. Non-aviation normalizers are colocated
in `services/fetch-orchestrator/src/layers/<layer_id>/` and must not be moved without an
explicit Orchestrator Agent work order.

---

### `database/`

```
database/
  migrations/
    README.md                                   # [UPDATE] SR-016 — add numbering convention + aviation 002 gap doc

    core/
      001_core_ingestion_tables.sql             # [KEEP]

    layers/
      layer_01_aviation/
        001_aviation_reference_tables.sql       # [KEEP]
        003_aviation_search_indexes.sql         # [KEEP] 002 gap is grandfathered — do not renumber
        004_...                                 # [KEEP] remaining migrations in sequence
        ...

      layer_02_borders_boundaries/
        001_borders_boundaries_schema.sql       # [KEEP]

      layer_03_earth_events/
        001_earth_events_tables.sql             # [KEEP]

      layer_05_space_satellites/
        001_space_satellites_tables.sql         # [KEEP]
        002_space_satellites_scale_indexes.sql  # [KEEP]

      layer_06_maritime/
        001_maritime_tables.sql                 # [KEEP]

      layer_07_weather/
        001_weather_tables.sql                  # [KEEP]

      layer_08_news_osint/
        001_news_tables.sql                     # [KEEP]

      layer_10_energy_infrastructure/
        001_energy_infrastructure_tables.sql    # [KEEP]

  ingestion/
    layers/
      layer_07_weather/                         # [KEEP]
      layer_08_news_osint/                      # [KEEP]

  seeds/                                        # [KEEP]
  views/                                        # [KEEP]
```

---

### `tests/`

Current state: some test files exceed 700 lines.
Target state: large test files split into domain-focused suites.

```
tests/
  api/                                          # [KEEP] API tests — API Agent owns
  web/                                          # [KEEP] frontend tests — Frontend Agent owns

  data/                                         # [KEEP] Database Agent owns
    conftest.py                                 # [KEEP]

    layer_01_aviation/
      category_audit/                           # [SPLIT] SR-017
      coordinates/                              # [SPLIT] SR-017
      performance/                              # [SPLIT] SR-017
      schema/                                   # [SPLIT] SR-017
      workers/                                  # [SPLIT] SR-017
      fixtures/                                 # [KEEP] committed fixture JSON files

    layer_02_borders_boundaries/                # [KEEP]
    layer_03_earth_events/                      # [KEEP]

    layer_05_space_satellites/
      fetcher/                                  # [SPLIT] SR-017 — from test_space_satellites_fetcher.py (2411 lines)
      propagation/                              # [SPLIT] SR-017
      database/                                 # [SPLIT] SR-017
      api_contract/                             # [SPLIT] SR-017

    layer_06_maritime/                          # [SPLIT] SR-017
    layer_07_weather/                           # [SPLIT] SR-017
    layer_08_news_osint/                        # [SPLIT] SR-017
    layer_10_energy_infrastructure/             # [KEEP/SPLIT] SR-017 as needed
```

---

### `raw/` and `tmp/`

```
raw/
  .gitkeep                                      # [KEEP]
  layer_*/                                      # [IGNORE] never commit provider payloads

tmp/
  .gitkeep                                      # [KEEP]
  cache/                                        # [IGNORE]
  generated/                                    # [IGNORE]
```

---

## Split Mapping

### API splits

| Current file | Target folder | Work package |
|---|---|---|
| `apps/api/src/routes/weather.ts` (1095 lines) | `routes/weather/` | SR-002 |
| `apps/api/src/routes/news.ts` (1014 lines) | `routes/news/` | SR-003 |
| `apps/api/src/routes/maritime.ts` (797 lines) | `routes/maritime/` | SR-004 or follow-up |
| `apps/api/src/routes/space/satellites.ts` (582 lines) | `routes/space/satellites/` | SR-004 or follow-up |
| `apps/api/src/routes/energy/infrastructure.ts` (683 lines) | `routes/energy/infrastructure/` | SR-004 or follow-up |

### Frontend renames

| Current folder | Target folder | Work package |
|---|---|---|
| `apps/web/src/layers/aviation/` | `layers/layer_01_aviation/` | SR-009 |
| `apps/web/src/layers/borders/` | `layers/layer_02_borders_boundaries/` | SR-010 |
| `apps/web/src/layers/earth-events/` | `layers/layer_03_earth_events/` | SR-011 |
| `apps/web/src/layers/space/` | `layers/layer_05_space_satellites/` | SR-012 |
| `apps/web/src/layers/maritime/` | `layers/layer_06_maritime/` | SR-013 |
| `apps/web/src/layers/energy/` | `layers/layer_10_energy_infrastructure/` | SR-014 |
| `apps/web/src/layers/layer_07_weather/` | keep — already canonical | — |
| `apps/web/src/layers/layer_08_news_osint/` | keep — already canonical | — |

### Frontend component splits

| Current file | Target folder | Work package |
|---|---|---|
| `apps/web/src/components/DetailPanel.tsx` (953 lines) | `components/detail-panel/` | SR-005 |
| `apps/web/src/components/LayerPanel.tsx` (1079 lines) | `components/layer-panel/` | SR-006 |

### Contracts split

| Current | Target | Work package |
|---|---|---|
| `packages/contracts/src/index.ts` (1326 lines) | `common/` + `layers/` + compatibility barrel | SR-007 (after SR-001) |

### Fetcher source split

| Layers affected | Target pattern | Work package |
|---|---|---|
| `layer_01_aviation`, `layer_05_space_satellites`, `layer_08_news_osint`, `layer_10_energy_infrastructure` | `sources/<source_name>/` subfolders | SR-015 |

### Database

| Target | Work package |
|---|---|
| `database/migrations/README.md` — document aviation `002` gap and numbering convention | SR-016 |

### Tests

| Files affected | Target | Work package |
|---|---|---|
| `test_space_satellites_fetcher.py` (2411 lines) and 9 other large test files | Domain subfolders per layer | SR-017 |

### Future scaling

| Scope | Work package |
|---|---|
| Scheduler, raw storage, caching, rate limits, response size, streaming, auth, time-series, object storage | SR-018 — planning spec only |

---

## How the Structure Connects

Every layer follows this top-to-bottom pipeline:

```
Source provider (external API / feed)
    ↓
services/fetch-orchestrator/src/layers/layer_NN_name/sources/<source>/fetcher.py
    ↓
services/fetch-orchestrator/src/layers/layer_NN_name/sources/<source>/normalizer.py
  (or services/normalizer/src/layers/layer_01_aviation/ for aviation)
    ↓
database/migrations/layers/layer_NN_name/  →  PostgreSQL tables
    ↓
apps/api/src/routes/<layer_or_resource>/repository.ts  (SQL queries)
    ↓
apps/api/src/routes/<layer_or_resource>/mapper.ts  (row → response shape)
    ↓
apps/api/src/routes/<layer_or_resource>/service.ts  (business logic)
    ↓
packages/contracts/src/layers/layer_NN_name.ts  (Zod schema / TypeScript type)
    ↓
apps/web/src/layers/layer_NN_name/api/  (HTTP fetch to API)
    ↓
apps/web/src/layers/layer_NN_name/hooks/  (data hook)
    ↓
apps/web/src/layers/layer_NN_name/LayerNN*.tsx  (layer component)
    ↓
apps/web/src/CesiumGlobe.tsx  (renders marker primitives on globe)
    ↓
apps/web/src/components/LayerPanel.tsx  (layer toggle UI)
    ↓
apps/web/src/components/DetailPanel.tsx  (detail card on click)
```

### Concrete example — Layer 07 Weather

```
services/fetch-orchestrator/src/layers/layer_07_weather/
  sources/open_meteo/
    client.py       ← HTTP to Open-Meteo
    fetcher.py      ← orchestrates fetch + raw storage
    normalizer.py   ← raw → normalized observation shape
    storage.py      ← write/read raw cache
      ↓
database/migrations/layers/layer_07_weather/
  001_weather_tables.sql
      ↓
apps/api/src/routes/weather/   (after SR-002)
  repository.ts   ← SQL: SELECT weather_observations_latest
  mapper.ts       ← rowToObservationItem()
  service.ts      ← orchestrates repo + validation
  index.ts        ← GET /api/layers/layer_07_weather/weather/latest
      ↓
packages/contracts/src/layers/layer_07_weather.ts   (after SR-007)
  WeatherObservationItem, WeatherLatestResponse, ...
      ↓
apps/web/src/layers/layer_07_weather/
  weatherApi.ts   ← fetchWeatherLatest()
  useWeather.ts   ← hook returning { data, loading, error }
  WeatherLayer.tsx ← renders temperature markers on globe
      ↓
apps/web/src/CesiumGlobe.tsx
  <WeatherLayer />
      ↓
apps/web/src/components/LayerPanel.tsx
  <WeatherLayerPanel />   (after SR-006)
      ↓
apps/web/src/components/DetailPanel.tsx
  <WeatherDetail />       (after SR-005)
```

### Concrete example — Layer 08 News & OSINT

```
services/fetch-orchestrator/src/layers/layer_08_news_osint/
  sources/gdacs/
    client.py
    fetcher.py
    normalizer.py
    storage.py
  sources/gdelt_event_export/
    client.py
    fetcher.py
    normalizer.py
    storage.py
      ↓
database/migrations/layers/layer_08_news_osint/
  001_news_tables.sql
      ↓
apps/api/src/routes/news/   (after SR-003)
  repository.ts
  mapper.ts
  service.ts
  index.ts   ← GET /api/layers/layer_08_news_osint/news/items
      ↓
packages/contracts/src/layers/layer_08_news_osint.ts   (after SR-007)
  NewsItemRow, NewsMarkerRow, ...
      ↓
apps/web/src/layers/layer_08_news_osint/
  newsApi.ts
  useNews.ts
  NewsLayer.tsx
      ↓
apps/web/src/CesiumGlobe.tsx
  <NewsLayer />
      ↓
apps/web/src/components/LayerPanel.tsx → NewsLayerPanel   (after SR-006)
apps/web/src/components/DetailPanel.tsx → NewsDetail      (after SR-005)
```

---

## Work Package Mapping

| ID | Phase | What changes |
|---|---|---|
| SR-001 | 0 | `packages/contracts/src/index.ts` — repair `LayerStatusResponseSchema` to be generic, not aviation-specific |
| SR-002 | 1 | `apps/api/src/routes/weather.ts` → `routes/weather/` — split into `index.ts`, `service.ts`, `repository.ts`, `mapper.ts`, `validation.ts`, `types.ts` |
| SR-003 | 1 | `apps/api/src/routes/news.ts` → `routes/news/` — same split pattern |
| SR-004 | 1 | Review `maritime.ts`, `space/satellites.ts`, `energy/infrastructure.ts` — decide and schedule follow-up splits |
| SR-005 | 2 | `apps/web/src/components/DetailPanel.tsx` → thin orchestrator + `components/detail-panel/` sub-components |
| SR-006 | 2 | `apps/web/src/components/LayerPanel.tsx` → thin orchestrator + `components/layer-panel/layer-panels/` sub-panels |
| SR-007 | 3 | `packages/contracts/src/index.ts` → `common/` + `layers/layer_NN_name.ts` files + compatibility barrel |
| SR-008 | 4 | Produce canonicalization plan doc — no folder renamed yet |
| SR-009 | 4 | `layers/aviation/` → `layers/layer_01_aviation/` — add shim at old path |
| SR-010 | 4 | `layers/borders/` → `layers/layer_02_borders_boundaries/` — add shim |
| SR-011 | 4 | `layers/earth-events/` → `layers/layer_03_earth_events/` — add shim |
| SR-012 | 4 | `layers/space/` → `layers/layer_05_space_satellites/` — add shim |
| SR-013 | 4 | `layers/maritime/` → `layers/layer_06_maritime/` — add shim |
| SR-014 | 4 | `layers/energy/` → `layers/layer_10_energy_infrastructure/` — add shim |
| SR-015 | 5 | Multi-source fetcher layers → `sources/<source_name>/` subfolders inside each layer |
| SR-016 | 6 | `database/migrations/README.md` — document aviation `002` gap and migration numbering convention |
| SR-017 | 7 | Large `tests/data/` files → domain-focused test subfolders; no tests removed or weakened |
| SR-018 | 8 | Create `specs/009-future-scaling-architecture/` planning spec — scheduler, caching, rate limits, auth, time-series, object storage |

---

## Final Target Principle

When all work packages are complete, a new agent joining the project should immediately
understand the layout:

```
docs/control/       = rules (global constitutions; read before doing any work)
docs/state/         = now  (current phase; append-only handoff log)
docs/archive/       = history (completed work; not active instructions)
specs/              = plans (active and future work packages)
apps/api/           = API application (Fastify; layer-aware routes)
apps/web/           = frontend application (React + CesiumJS; layer folders)
packages/contracts/ = shared API contracts (Zod schemas; split by layer)
services/           = data workers (fetchers + colocated normalizers; layer folders)
database/           = persistence (PostgreSQL migrations; layer folders)
tests/              = validation (data tests by lane and layer)
```

No folder mixes active instructions with historical evidence.
No layer uses a short name when a canonical layer ID exists.
No large route, component, or contract file hides multiple responsibilities in one file.
