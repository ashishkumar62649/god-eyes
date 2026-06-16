# Plan — Structure Remediation Roadmap

> **Agent:** Orchestrator Agent
> **Lane:** Documentation / Planning
> **Date:** 2026-06-15
> **Source rulebook:** `docs/control/PROJECT_CONTROL.md`
> **Source audit:** `docs/audits/ENGINEERING_STRUCTURE_COMPLIANCE_AUDIT.md`
> **Source spec:** `spec.md` (this folder)
> **Source research:** `docs/archive/2026-06-16-docs-pruned/spec-008-evidence/research.md`

This plan defines the recommended remediation order. Each phase is a
**scoped group of work packages** (`SR-NNN` tasks in `tasks.md`). Each
work package becomes its own branch, its own commit, its own reviewer
gate.

The order is **dependency-aware**: contract repair must land before the
contracts split; the contracts split must land before the per-layer
route splits that depend on it; the route splits can happen in any
order after that, but starting with the largest file is recommended.

---

## Status as of 2026-06-16 (post-SR-010 / post-SR-019)

The detailed phase descriptions below are preserved unchanged as the
audit trail. Do not delete them. The status below is the active
snapshot. For per-work-package status, see the **"Status as of
2026-06-16"** section at the top of `tasks.md`.

### Completed work (snapshot)

* **Phase 0 — Contract / Status Schema Repair** — completed
  (SR-001). `LayerStatusResponseSchema` is no longer aviation-specific.
* **Phase 1 — API Route Split** — completed in full. SR-002, SR-003,
  and SR-004 done. The three remaining route splits
  (`maritime`, `energy/infrastructure`, `space/satellites` REST
  surface) were completed as the post-SR-004 follow-up packages
  **SR-005A**, **SR-005B**, **SR-005C**. The space-satellites
  WebSocket handler remains inside `apps/api/src/routes/space/satellites.ts`
  and was intentionally **not** split in this phase.
* **Phase 2 — Frontend Large Component Split** — completed.
  SR-005 (`DetailPanel`) and SR-006 (`LayerPanel`) done.
* **Phase 3 — Contracts Split** — completed (SR-007). Per-layer
  contracts module is in place with compatibility re-exports.
* **Phase 4 (planning) — Frontend Layer Folder Canonicalization Plan**
  — completed (SR-008). The plan document lives in this spec folder
  as `frontend-layer-canonicalization-plan.md`.
* **Phase 4 (first per-layer move) — Frontend Borders Folder
  Canonicalization** — completed (SR-010, commit `5275e61` on
  branch `frontend/sr-010/borders-canonical-folder`). Branch is
  clean and in sync with its remote but **not yet PR'd or merged**.

### Remaining work (snapshot)

* **Phase 4 (remaining per-layer moves) — Frontend Layer Folder
  Canonicalization** — partly complete. SR-010 (borders) done;
  SR-011 (earth-events), SR-013 (maritime), SR-012 (space), SR-014
  (energy), SR-009 (aviation) **pending**. See the "Remaining
  recommended order" section in `tasks.md` for the safe default
  order.
* **Auxiliary cleanup items** — redundant `.gitkeep` cleanup, API
  route file-shape normalization, `TODO` / deprecated marker
  cleanup, `CesiumGlobe` split planning, and the missing
  `PROJECT_CONTROL.md` Part 2 §8 package ownership row decision.

### Needs decision (snapshot)

* **API endpoint path policy** — final decision on whether legacy
  non-canonical endpoint paths are kept as compatibility aliases
  after all canonicalization work is complete. **Blocked** until
  a user / Orchestrator decision is made.
* **Missing package ownership row in `PROJECT_CONTROL.md` Part 2
  §8** — at least one row whose owner is undecided. **Blocked**
  until a user / Orchestrator decision is made.

### Planned later (snapshot)

* **Phase 5 — Fetcher / Normalizer Canonical Source Structure**
  (SR-015). Multi-source layers still use prefixed flat file names;
  the `sources/<name>/` subfolder pattern is recommended but not on
  the current critical path.
* **Phase 6 — Database / Migration Documentation Cleanup**
  (SR-016). The aviation `002` gap is grandfathered and
  explicitly not in scope; the README update is documentation-only
  and not on the current critical path.
* **Phase 7 — Large Test File Split** (SR-017). The 700-line
  Python limit is documented but not blocking any active work.
* **Phase 8 — Future Scaling Architecture Spec** (SR-018). The
  architecture decisions are user-level decisions that are not
  yet made.

> The recommended **execution order** below still describes the
> original safe default for a single-worker execution. It is
> **not** a "next" queue — most of the original queue is already
> done. Use the "Remaining work" snapshot above (or the
> "Remaining recommended order" section in `tasks.md`) for the
> current next-work queue.

---

## Phase 0 — Contract / Status Schema Repair

### Purpose

Repair the `LayerStatusResponseSchema.objectCounts` field so it is not
aviation-specific when used generically. This is the only
behaviour-changing item in the roadmap; every other phase is a pure
refactor with no behaviour change.

### Files / folders likely affected

* `packages/contracts/src/index.ts` — generalize or split the
  `LayerStatusResponseSchema`.
* `apps/api/src/routes/layers.ts` — call the new schema(s) and return
  the right shape per layer.
* Tests that exercise `GET /api/layers/:layerId/status` (if any).

### Owner / lane

* **API Agent** for the schema change and the API
  implementation.
* **Orchestrator Agent** verifies per-layer counts are correct for the layer's
  tables.

### Branch naming suggestion

`api/sr-001/layer-status-response-shape`

### Acceptance criteria

* `LayerStatusResponse` is generalized to a per-layer-aware shape (a
  union or a generic `Record<string, number>` with documented
  semantics) — **not** an aviation-specific payload reused for all
  layers.
* `GET /api/layers/layer_01_aviation/status` returns the same aviation
  counts as before.
* `GET /api/layers/layer_07_weather/status` returns
  weather-specific counts (e.g. `observations`, `sources`,
  `fetch_runs`) — not all zeros.
* All other layer status endpoints return per-layer-shaped counts.
* API tests pass.

### Reviewer checks

* Per-layer count is correct against the layer's database tables.
* No other endpoint changed shape.
* The schema change is documented in a contracts ADR or in the
  handoff entry.
* Handoff log entry references the new schema and the old
  (aviation-specific) contract is marked as deprecated.

### Risks

* Any external consumer that depended on the zero values for
  non-aviation layers may now receive non-zero values. This is the
  intended behaviour change. Document it explicitly in the review
  and the handoff entry.
* Test fixtures that hardcoded the zero values must be updated.

### Rollback strategy

Revert the branch. The previous `LayerStatusResponseSchema` is the
last committed version. The status response shape change is isolated
to `apps/api/src/routes/layers.ts` and `packages/contracts/`.

### Tasks

* `SR-001` Contract / layer status response shape repair

---

## Phase 1 — API Route Split

### Purpose

Split the five large single-file API route files
(`weather.ts`, `news.ts`, `maritime.ts`,
`energy/infrastructure.ts`, `space/satellites.ts`) into the
per-responsibility folder pattern shown in
`airport-intelligence/`, `airport-layout-features/`, `public-profile/`,
and `objects/`. Each split is a separate `SR-NNN` work package with no
behaviour change.

### Target folder pattern

```
apps/api/src/routes/layer_XX_name/
    index.ts             ← HTTP route handlers only; no business logic
    service.ts           ← business logic; orchestrates repository calls
    repository.ts        ← database access; parameterized SQL queries
    mapper.ts            ← converts DB row shape to API response shape
    validation.ts        ← request/response validation
    types.ts             ← route-local TypeScript types
```

The pattern is the same for `weather/`, `news/`, `maritime/`,
`energy/infrastructure/` (already in a folder — keep the
`infrastructure.ts` filename and add the new subfolder siblings, or
restructure to `energy/layer_10_energy_infrastructure/` if the agent
decides the resource split is the same as the layer split), and
`space/satellites/`.

### Files / folders likely affected (per work package)

* `apps/api/src/routes/weather.ts` → `apps/api/src/routes/weather/`
  (with `index.ts` + `service.ts` + `repository.ts` + `mapper.ts` +
  `validation.ts` + `types.ts`).
* `apps/api/src/routes/news.ts` → `apps/api/src/routes/news/`
  (same pattern).
* `apps/api/src/routes/maritime.ts` → `apps/api/src/routes/maritime/`
  (same pattern).
* `apps/api/src/routes/energy/infrastructure.ts` → keep folder, add
  sibling `service.ts` / `repository.ts` / `mapper.ts` / `validation.ts`
  / `types.ts`. (Or restructure to the same shape as weather.)
* `apps/api/src/routes/space/satellites.ts` → keep folder, add sibling
  files.

### Owner / lane

* **API Agent** for the route splits.
* **Reviewer** verifies each split is pure (no behaviour change) and
  that the pattern matches `objects/` and `airport-intelligence/`.

### Branch naming suggestion (per work package)

* `api/sr-002/weather-route-split`
* `api/sr-003/news-route-split`
* `api/sr-004/api-remaining-route-split-review`

`SR-004` is a **review-only** work package: the agent examines
`maritime.ts`, `energy/infrastructure.ts`, `space/satellites.ts` and
decides whether to split each one (if the priority is high) or to
defer (if the priority is low). It produces a short report and a
follow-up `SR-NNN` task per remaining route. This is a planning
package, not a refactor.

### Acceptance criteria (per work package)

* The new `index.ts` re-exports the public route registration.
* All `query(...)` calls live in `repository.ts`, not in `index.ts`.
* All `parseLimit` / `parseOffset` / `parseBbox` / `parseNumeric` etc.
  helpers live in `validation.ts`.
* All `rowTo*` mappers live in `mapper.ts`.
* The `service.ts` orchestrates `repository` + `validation` +
  `mapper`. `index.ts` calls `service` and returns the response.
* API tests pass (`pnpm --filter api test`).
* API build passes (`pnpm --filter api build`).
* No response shape change at any endpoint (compare the response body
  for each endpoint against the previous release).

### Reviewer checks (per work package)

* Diff is limited to the route's own folder and any required
  compatibility re-exports in `apps/api/src/routes/objects.ts` or
  similar.
* No `query(...)` call in `index.ts` or `service.ts`.
* No `parse*` helper in `index.ts` or `service.ts`.
* No `rowTo*` mapper in `index.ts` or `repository.ts`.
* API tests pass.
* No `.env`, no real keys, no secrets in the diff.
* Handoff log appended.

### Risks

* **Behaviour change risk** — the most common failure mode is a subtle
  response shape change (JSON field order, optional vs required,
  string vs number coercion). The reviewer must compare
  representative responses before approving.
* **Test fixture breakage** — `tests/api/` may have fixtures that
  depend on the route file's exact structure. The branch must run
  `pnpm --filter api test` and address any failures.
* **Circular import risk** — moving a function between files may
  introduce a circular import. The reviewer must run
  `pnpm --filter api build` and address any new errors.

### Rollback strategy

Revert the branch. The previous single-file route is the last
committed version. The split is a pure refactor with no schema
changes.

### Tasks

* `SR-002` API weather route split
* `SR-003` API news route split
* `SR-004` API remaining route split review

---

## Phase 2 — Frontend Large Component Split

### Purpose

Split `DetailPanel.tsx` (953 lines) and `LayerPanel.tsx` (1079 lines)
into per-feature sub-components. Preserve UI output. Add or keep
tests. No behaviour change.

### Target folder pattern

```
apps/web/src/components/
    DetailPanel.tsx              ← thin orchestrator only
    detail/
        AviationDetail.tsx
        MaritimeDetail.tsx
        SourcesSection.tsx
        ...
    LayerPanel.tsx               ← thin orchestrator only
    layerPanels/
        WeatherLayerPanel.tsx
        NewsLayerPanel.tsx
        MaritimeLayerPanel.tsx
        ...
```

The exact subfolder split is decided by the worker agent in
`SR-005` / `SR-006`. The rule is **thin orchestrator + focused
sub-components**.

### Files / folders likely affected

* `apps/web/src/components/DetailPanel.tsx`
* `apps/web/src/components/LayerPanel.tsx`
* (potentially) new subfolders `apps/web/src/components/detail/` and
  `apps/web/src/components/layerPanels/`.
* (potentially) `apps/web/src/components/intel/*` if sub-components
  move between panels.

### Owner / lane

* **Frontend Agent** for the component splits.
* **Reviewer** verifies visual parity by running the dev server
  (`pnpm --filter web build`) and the test suite.

### Branch naming suggestion (per work package)

* `frontend/sr-005/detail-panel-split`
* `frontend/sr-006/layer-panel-split`

### Acceptance criteria (per work package)

* Top-level `DetailPanel.tsx` and `LayerPanel.tsx` are reduced to a
  thin orchestrator (under 250 lines each).
* Sub-components are under 400 lines each (the rulebook §6 component
  limit).
* UI output is identical: same DOM, same CSS classes, same behaviour.
* `pnpm --filter web test` passes.
* `pnpm --filter web build` passes.
* No import boundary violation: no frontend file imports from
  `apps/api/`, `services/`, or `database/`.

### Reviewer checks (per work package)

* Sub-component names follow the project convention
  (`<Feature><Subcomponent>.tsx` in PascalCase).
* No sub-component file exceeds 400 lines.
* No sub-component file imports from a forbidden location.
* Tests pass; visual smoke test on the running dev server passes
  (the reviewer runs `pnpm --filter web build` and the test suite).
* Handoff log appended.

### Risks

* **Visual regression risk** — the most common failure mode is a
  subtle CSS or DOM change. The reviewer must compare the rendered
  output of the two panels against the previous release (or run a
  manual smoke test).
* **Prop-drilling risk** — moving a sub-component to a new file may
  require new prop types. The worker agent must keep types in
  per-feature `*Types.ts` files (not inline) per the rulebook §7.
* **Re-export surface** — components imported by other files
  (e.g., `App.tsx`, `CesiumGlobe.tsx`) must keep their public
  export. The split must not change the import path for external
  consumers.

### Rollback strategy

Revert the branch. The previous single-file component is the last
committed version.

### Tasks

* `SR-005` Frontend DetailPanel split
* `SR-006` Frontend LayerPanel split

---

## Phase 3 — Contracts Split

### Purpose

Split `packages/contracts/src/index.ts` (1325 lines) into per-layer (or
per-domain) modules, with a compatibility re-export from `index.ts`.
No type or schema change. Pure file split.

### Target folder pattern

```
packages/contracts/src/
    layer/
        registry.ts
        aviation.ts
        maritime.ts
        weather.ts
        news.ts
        energy.ts
        space.ts
        borders.ts
        earth-events.ts
        shared.ts
    index.ts                ← re-exports from layer/* for compatibility
```

### Files / folders likely affected

* `packages/contracts/src/index.ts` — replaced with re-exports.
* `packages/contracts/src/layer/*.ts` — new per-layer files.
* `packages/contracts/src/index.ts` may also gain a `version: 1` field
  on each schema if the team decides to add versioning.

### Owner / lane

* **API Agent** for the contracts split.
* **Reviewer** verifies every existing import path still resolves.

### Branch naming suggestion

`api/sr-007/contracts-package-split`

### Acceptance criteria

* `packages/contracts/src/index.ts` is reduced to a thin re-export
  file (under 100 lines).
* All Zod schemas live in `packages/contracts/src/layer/<layer>.ts`
  files.
* All existing imports in `apps/api/`, `apps/web/`, and any other
  importer continue to work without change.
* `pnpm --filter @god-eyes/contracts build` passes.
* `pnpm --filter api build` passes.
* `pnpm --filter web build` passes.
* `pnpm --filter api test` passes.
* `pnpm --filter web test` passes.

### Reviewer checks

* No public type or schema is removed or renamed.
* `git grep` for any schema symbol used in `apps/api/` and `apps/web/`
  resolves to exactly one source file in `packages/contracts/`.
* Handoff log appended.

### Risks

* **Import path breakage** — a missed re-export will break the API
  build. The reviewer must run `pnpm --filter api build` and
  `pnpm --filter web build` and address any errors.
* **Circular re-export** — if two layer files import from each other
  and both re-export from `index.ts`, a circular reference may form.
  The worker agent must keep layer files independent of each other
  and use `layer/shared.ts` for shared codes.

### Rollback strategy

Revert the branch. The previous single-file contracts module is the
last committed version.

### Tasks

* `SR-007` Contracts package split

---

## Phase 4 — Frontend Layer Folder Canonicalization

### Purpose

Move the six grandfathered short-name frontend layer folders to
canonical `layer_NN_name/` names, one layer per work package. Each move
is a separate `SR-NNN` work package with full regression tests.

### Target names

* `apps/web/src/layers/aviation/` → `apps/web/src/layers/layer_01_aviation/`
* `apps/web/src/layers/borders/` → `apps/web/src/layers/layer_02_borders_boundaries/`
* `apps/web/src/layers/earth-events/` → `apps/web/src/layers/layer_03_earth_events/`
* `apps/web/src/layers/space/` → `apps/web/src/layers/layer_05_space_satellites/`
* `apps/web/src/layers/maritime/` → `apps/web/src/layers/layer_06_maritime/`
* `apps/web/src/layers/energy/` → `apps/web/src/layers/layer_10_energy_infrastructure/`

`layer_07_weather` and `layer_08_news_osint` are already canonical;
no change.

### Files / folders likely affected

* The frontend layer folder itself.
* All importers across `apps/web/` (especially `App.tsx`,
  `CesiumGlobe.tsx`, `LayerPanel.tsx`, `Header.tsx`).
* The new folder gets a `LayerName.tsx` and an `index.ts` re-export
  for compatibility, and any sub-`features/` subfolders as decided by
  the worker agent (recommended for aviation and energy, which already
  have subfolders).

### Owner / lane

* **Frontend Agent** for each move.
* **Reviewer** runs a full build + test + manual smoke test on the
  running dev server.

### Branch naming suggestion (per work package)

* `frontend/sr-009/aviation-canonical-folder`
* `frontend/sr-010/borders-canonical-folder`
* `frontend/sr-011/earth-events-canonical-folder`
* `frontend/sr-012/space-canonical-folder`
* `frontend/sr-013/maritime-canonical-folder`
* `frontend/sr-014/energy-canonical-folder`

`SR-008` is a **planning-only** work package: the agent produces the
canonical-folder plan that the per-layer `SR-009`..`SR-014` work
packages follow. It is a single short document specifying the
compatibility shim strategy, the test surface, and the per-layer
order. It does not rename any folder.

### Acceptance criteria (per work package)

* The folder is renamed to the canonical `layer_NN_name/`.
* A compatibility re-export is in place at the old path (a re-export
  shim file) so any code that still imports from the old path
  continues to work.
* All importers (`App.tsx`, `CesiumGlobe.tsx`, etc.) are updated to
  use the new canonical path.
* `pnpm --filter web build` passes.
* `pnpm --filter web test` passes.
* `git grep` for the old path returns only the compatibility shim
  file.

### Reviewer checks (per work package)

* The compatibility shim is in place and works.
* The new folder name matches the layer ID in
  `docs/control/PROJECT_CONTROL.md`.
* All importers are updated; the only remaining reference to the old
  path is the shim.
* Sub-`features/` subfolders (if introduced) follow the
  Section 5 pattern.
* Tests pass; smoke test on the dev server passes.
* Handoff log appended.

### Risks

* **Import path breakage** — every importer across `apps/web/` must
  be updated. The risk is highest in `LayerPanel.tsx` and
  `DetailPanel.tsx` which import from many layer folders. The
  compatibility shim mitigates this risk; the worker agent must
  confirm the shim covers all importers.
* **TypeScript path mapping** — `tsconfig.json` may have an alias
  pointing at the old path. The worker agent must check before
  merging.
* **Build / Vite alias** — `vite.config.ts` may also have an alias.
  Same check.
* **CI / test path references** — `tests/` may reference the old
  path. The branch must run `pnpm --filter web test` and address any
  failures.

### Rollback strategy

Revert the branch. The old folder is restored on revert. The
compatibility shim is removed.

### Tasks

* `SR-008` Frontend layer folder canonicalization plan
* `SR-009` Frontend aviation folder canonicalization
* `SR-010` Frontend borders folder canonicalization
* `SR-011` Frontend earth-events folder canonicalization
* `SR-012` Frontend space folder canonicalization
* `SR-013` Frontend maritime folder canonicalization
* `SR-014` Frontend energy folder canonicalization

---

## Phase 5 — Fetcher / Normalizer Structure Cleanup

### Purpose

Organize the multi-source layers' fetchers under
`sources/<source_name>/` subfolders, matching the rulebook §9
recommended pattern. **Do not move existing normalizers** in this
phase. Aviation separated normalizer remains in its canonical
location; the colocated non-aviation normalizers remain colocated
unless a future explicit work order says otherwise.

### Target folder pattern

```
services/fetch-orchestrator/src/layers/layer_XX_name/
    __init__.py
    sources/
        source_one/
            client.py
            fetcher.py
            normalizer.py
            storage.py
            worker.py
            cli.py
            types.py
        source_two/
            ...
```

For layers with only one source, the `sources/` subfolder is
**optional** (per the rulebook §9). The split is for multi-source
layers: aviation, space (CelesTrak, Space-Track), news (GDACS, GDELT),
energy (WRI, OSM, GEM).

### Files / folders likely affected

* `services/fetch-orchestrator/src/layers/layer_01_aviation/` —
  reorganize 8 sources into `sources/<name>/` subfolders.
* `services/fetch-orchestrator/src/layers/layer_05_space_satellites/`
  — reorganize CelesTrak and Space-Track.
* `services/fetch-orchestrator/src/layers/layer_08_news_osint/` —
  reorganize GDACS and GDELT.
* `services/fetch-orchestrator/src/layers/layer_10_energy_infrastructure/`
  — reorganize WRI, OSM, GEM.

Maritime has only one source (AISStream) and may remain flat.

### Owner / lane

* **Fetcher Agent** for each layer's reorganization.
* **Reviewer** verifies import paths, no behaviour change, and
  aviation normalizer remains in its canonical location.

### Branch naming suggestion

`fetcher/sr-015/canonical-source-structure`

### Acceptance criteria

* Multi-source layers are organized under `sources/<source_name>/`
  subfolders.
* Single-source layers may remain flat (acceptable per the rulebook).
* Aviation normalizer is **unchanged** in
  `services/normalizer/src/layers/layer_01_aviation/`.
* Colocated non-aviation normalizers remain colocated.
* `python -m pytest tests/data -q` passes (with at least the same
  pass rate as the previous release; the 8 pre-existing scope-guard
  failures on dirty tree are not in scope).
* No worker or normalizer imports from `apps/web/` or `apps/api/`.

### Reviewer checks

* `sources/<name>/` subfolders exist for the multi-source layers.
* Each subfolder has at least the required files (`client.py`,
  `fetcher.py`, `normalizer.py`, `worker.py`).
* Aviation normalizer is at
  `services/normalizer/src/layers/layer_01_aviation/` (unchanged).
* `python -m pytest tests/data -q` passes.
* `git grep` for the old flat paths returns only compatibility
  re-exports (or none, if the worker agent updates all importers
  atomically).
* Handoff log appended.

### Risks

* **Import path breakage** — Python workers import from sibling
  modules. The branch must update all import paths.
* **Aviation normalizer location risk** — the worker agent must
  not move the aviation normalizer. The reviewer verifies
  `services/normalizer/src/layers/layer_01_aviation/` is unchanged.
* **Test fixture / conftest risk** — `tests/data/conftest.py` may
  reference layer folder paths. The branch must run
  `python -m pytest tests/data -q` and address any failures.
* **Worker CLI entry point** — `__main__.py` in some layers
  (`layer_07_weather`, `layer_08_news_osint`) may need updates. The
  worker agent must preserve the CLI behaviour.

### Rollback strategy

Revert the branch. The previous flat layout is the last committed
version.

### Tasks

* `SR-015` Fetcher / normalizer canonical source structure

---

## Phase 6 — Database / Migration Documentation Cleanup

### Purpose

Add a one-line note to `database/migrations/README.md` about the
aviation `002` numbering gap (HEALTH-010 / ESA-010), and document the
migration-numbering convention. **Do not renumber old migrations.**
**Do not redesign the database in this phase.**

### Files / folders likely affected

* `database/migrations/README.md` — append a section on
  migration-numbering convention and the aviation `002` gap.

### Owner / lane

* **Database Agent** for the README update.
* **Reviewer** verifies no migration file is renamed and no
  migration content is changed.

### Branch naming suggestion

`database/sr-016/migration-documentation-cleanup`

### Acceptance criteria

* `database/migrations/README.md` documents the aviation `002`
  numbering gap and explains that it is grandfathered.
* `database/migrations/README.md` documents the
  migration-numbering convention (consecutive numbers, no
  renumbering of old migrations, new migrations appended at the
  end with the next number).
* No migration file is renamed, no migration content is changed.
* `python -m pytest tests/data -q` passes.

### Reviewer checks

* The README mentions the aviation `002` gap explicitly.
* The README mentions the no-renumber rule.
* No migration file is in the diff.
* `python -m pytest tests/data -q` passes.
* Handoff log appended.

### Risks

* **Accidental migration renumber** — the worker agent must not
  touch any `.sql` file in this work package. The reviewer verifies
  this in the diff.

### Rollback strategy

Revert the branch. The previous README is restored on revert.

### Tasks

* `SR-016` Database migration documentation cleanup

---

## Phase 7 — Large Test File Split

### Purpose

Split the data test files exceeding the 700-line Python limit. No
behaviour change. Tests must continue to pass.

### Files / folders likely affected

* `tests/data/layer_05_space_satellites/test_space_satellites_fetcher.py`
  (2411 lines — the largest; split into focused suites per test
  domain).
* `tests/data/layer_08_news_osint/test_gdacs_db_ingestion.py` (677
  lines).
* `tests/data/layer_01_aviation/test_airport_public_profile_worker.py`
  (631 lines).
* `tests/data/layer_07_weather/test_fetcher.py` (614 lines).
* `tests/data/layer_01_aviation/test_aviation_live_aircraft_worker.py`
  (540 lines).
* `tests/data/layer_07_weather/test_weather_local_seed.py` (517
  lines).
* `tests/data/layer_01_aviation/test_airport_image_gallery_worker.py`
  (454 lines).
* `tests/data/layer_01_aviation/test_airport_intelligence_source_probe.py`
  (432 lines).
* `tests/data/layer_06_maritime/test_maritime_migration.py` (424
  lines).
* `tests/data/layer_08_news_osint/test_news_database_schema.py` (420
  lines).

The exact split per file is decided by the worker agent in `SR-017`.
The rule is **focused suites per test domain**.

### Owner / lane

* **Database Agent / Test lane** for the test file splits.
* **Reviewer** verifies each split is pure (no test removed, no test
  weakened) and the test pass rate is the same or better.

### Branch naming suggestion

`database/sr-017/large-tests-split`

### Acceptance criteria

* No test file exceeds 700 lines.
* No test is removed.
* No test assertion is weakened.
* The total number of tests is the same or greater (splitting
  increases count).
* `python -m pytest tests/data -q` passes with the same or better
  pass rate (the 8 pre-existing scope-guard failures on dirty tree
  are not in scope).

### Reviewer checks

* No test file is over 700 lines in the new branch.
* `git diff` shows only test files; no source file is touched.
* `python -m pytest tests/data -q` passes.
* The pre-existing 8 scope-guard failures on dirty tree are still
  present and still pre-existing; the branch does not introduce
  *additional* failures.
* Handoff log appended.

### Risks

* **Test weakening risk** — the most common failure mode is the
  worker agent reducing assertion strength to make a test pass. The
  reviewer must compare the assertion list before and after the
  split.
* **Fixture path risk** — splitting a test file may move a fixture
  reference. The worker agent must keep `conftest.py` paths stable.
- **Pytest discovery risk** — splitting may rename a test node. The
  reviewer must confirm the test count is the same or greater.

### Rollback strategy

Revert the branch. The previous single-file test is the last
committed version.

### Tasks

* `SR-017` Large tests split

---

## Phase 8 — Future Scaling Planning

### Purpose

Write a single planning spec
(`specs/009-future-scaling-architecture/`) that covers the
deployment-scale concerns catalogued in the compliance audit (ESA-017,
ESA-022, ESA-025, ESA-026, ESA-028). This is **planning only** — no
implementation in this phase. The spec describes the architecture
choices the user must make before any of these features are built.

### Topic coverage

* **Scheduler / jobs** — the unified runner/scheduler for
  fetcher/normalizer/ingestion workers (ESA-026).
* **Raw storage retention** — how long `raw/` payloads are kept, who
  cleans them up, and how.
* **Caching** — HTTP cache headers for `latest` snapshot endpoints;
  in-memory TTL for broadcaster state.
* **Rate limits** — application-layer rate limits per consumer.
* **Response-size limits** — large result set strategies
  (compression, async job, export endpoint).
* **Streaming / export** — when to introduce WebSocket or SSE for
  high-frequency layers beyond aviation/space.
* **Audit logging** — `fetch_run` tables, broadcaster event logs, and
  application-level audit trails.
* **Auth / authz readiness** — authentication and authorization
  pattern for the first write endpoint (layer 09 user shapes).
* **Time-series strategy** — when to move from PostgreSQL
  `*_history` tables to specialized time-series storage.
* **Object storage strategy** — when to introduce object storage for
  raw payloads and export artifacts.

### Files / folders likely affected

* `specs/009-future-scaling-architecture/` — new spec folder.
* `docs/state/HANDOFF_LOG.md` — appended handoff entry.

### Owner / lane

* **Orchestrator Agent** (planning only).
* **Reviewer** verifies the spec is comprehensive and does not
  propose implementation.

### Branch naming suggestion

`spec/sr-018/future-scaling-architecture`

### Acceptance criteria

* The spec folder is created at
  `specs/009-future-scaling-architecture/`.
* The spec covers all 10 topic areas above.
* The spec is planning only — no source code, no migrations, no
  tests, no configuration.
* `docs/state/HANDOFF_LOG.md` is appended to.
* The spec lists the open questions and the user-level decisions
  required to advance each topic.

### Reviewer checks

* The spec is a planning spec, not a refactor or feature spec.
* All 10 topic areas are covered.
* The spec references the compliance audit findings
  (ESA-017, ESA-022, ESA-025, ESA-026, ESA-028) by ID.
* The spec defers all implementation to future work orders.
* Handoff log appended.

### Risks

* **Scope creep** — the spec may grow to include implementation
  details. The worker agent must keep it planning only.
* **Decision-making bottleneck** — the spec lists user-level
  decisions that are not in the agent's scope. The agent must
  surface them clearly without trying to answer them.

### Rollback strategy

Revert the branch. The spec folder is removed on revert.

### Tasks

* `SR-018` Future scaling architecture spec

---

## Cross-Phase Reviewer Gate Items

These apply to every phase above:

1. **No broad cleanup branch** — one work package per branch.
2. **One focused work package per branch** — no piggyback scope.
3. **No behaviour change** unless the work package explicitly says so.
4. **Preserve compatibility** during renames with re-exports / shims.
5. **Tests must pass** before review.
6. **Reviewer must verify structure rules** (rulebook §19) every time.
7. **Handoff log is append-only.**
8. **No secrets, no real API keys.**
9. **Branch name follows the Git workflow policy.**
10. **Commit message follows the Git workflow policy** (Agent, Work
    Order, Branch, Summary, Commands, Known Issues, Forbidden Folders,
    Secrets).
11. **Rollback strategy exists.**
12. **No piggyback scope** (no formatter runs, no dependency bumps,
    no unrelated refactors).
13. **Every phase must follow `repository-skeleton.md`.** Before
    starting any work package, the agent must read
    `specs/008-structure-remediation-roadmap/repository-skeleton.md`
    and confirm the planned changes match the approved target skeleton.
14. **Every rename or split must preserve compatibility** per the shim
    strategy defined in `repository-skeleton.md`.

---

## Recommended Order Summary

| Phase | Work Packages | Owner / Lane | Depends on | Status (2026-06-16) |
|---|---|---|---|---|
| Phase 0 | SR-001 | API / Contract | — | **Done** |
| Phase 1 | SR-002, SR-003, SR-004, SR-005A, SR-005B, SR-005C | API | SR-001 | **Done** (WebSocket handler in `space/satellites.ts` kept in place) |
| Phase 2 | SR-005, SR-006 | Frontend | — (independent) | **Done** |
| Phase 3 | SR-007 | API / Contract | SR-001 | **Done** |
| Phase 4 | SR-008 (plan), SR-009..SR-014 (per-layer) | Frontend | — (independent) | **Partly done** (SR-008 + SR-010 done; SR-009, SR-011, SR-012, SR-013, SR-014 pending) |
| Phase 5 | SR-015 | Fetcher | — (independent) | **Planned later** |
| Phase 6 | SR-016 | Database | — (independent) | **Planned later** |
| Phase 7 | SR-017 | Database / Test | — (independent) | **Planned later** |
| Phase 8 | SR-018 | Orchestrator (planning) | — (independent) | **Planned later** |

The recommended **execution order** for any remaining work is:

1. **Earth-events canonicalization** (SR-011, Phase 4) — lowest-risk
   per-layer move (5 imports, single hook file).
2. **Maritime canonicalization** (SR-013, Phase 4) — low risk
   (3 imports, self-contained).
3. **Space canonicalization** (SR-012, Phase 4) — medium risk
   (16 imports, has `satellites/` subfolder).
4. **Energy canonicalization** (SR-014, Phase 4) — medium risk
   (10 imports, has `infrastructure/` subfolder).
5. **Aviation canonicalization** (SR-009, Phase 4) — highest-risk
   per-layer move (35 imports, two subfolders).
6. **Redundant `.gitkeep` cleanup** — sweep removed after each
   rename.
7. **API route file-shape normalization** — final review pass for
   consistency across the five split routes.
8. **`TODO` / deprecated marker cleanup** — sweep in renamed
   folders and their new `index.ts` re-export shims.
9. **`CesiumGlobe` split planning** — `CesiumGlobe.tsx` is large;
   plan a split before any further renderer-layer canonicalization.
10. **Missing package ownership row decision** — final decision
    on the undecided `PROJECT_CONTROL.md` Part 2 §8 ownership row.
11. **API endpoint path policy** — final decision on whether
    legacy non-canonical endpoint paths are kept as compatibility
    aliases after all canonicalization work is complete.

This list is the **current next-work queue**. The historical
execution order (1–11 below) is preserved as the original
single-worker safe default and is **not** the current next-work
queue.

> The original 11-step safe-default execution order (now historical
> only) was:
>
> 1. **SR-001** (Phase 0) — unblocks the contract change for status.
> 2. **SR-007** (Phase 3) — splits the contracts module; unblocks
>    per-layer work that touches contracts.
> 3. **SR-002** and **SR-003** (Phase 1) — the two largest API
>    route splits. Sequenced because they are the largest files.
> 4. **SR-004** (Phase 1 review) — review-and-decide on the
>    remaining three large API route files.
> 5. **SR-005** and **SR-006** (Phase 2) — the two large frontend
>    components.
> 6. **SR-008** (Phase 4 plan) — produces the canonical-folder
>    plan.
> 7. **SR-009..SR-014** (Phase 4 per-layer) — one layer at a time.
> 8. **SR-015** (Phase 5) — fetcher / normalizer source split.
> 9. **SR-016** (Phase 6) — database README.
> 10. **SR-017** (Phase 7) — large test files.
> 11. **SR-018** (Phase 8) — future scaling spec.

Phases 5, 6, 7, 8 are largely independent and may run in parallel if
multiple worker agents are available. The order above is the
**safe default** for a single-worker execution.

---

**Last updated:** 2026-06-16 (status refresh per SR-020)
**Author:** Orchestrator Agent
**Maintained by:** Orchestrator Agent
