# Tasks — Structure Remediation Roadmap

> **Agent:** Orchestrator Agent
> **Lane:** Documentation / Planning
> **Date:** 2026-06-15
> **Source spec:** `spec.md` (this folder)
> **Source plan:** `plan.md` (this folder)
> **Source research:** `docs/archive/2026-06-16-docs-pruned/spec-008-evidence/research.md`

This file turns the 9-phase plan into **18 ordered work packages**
(`SR-001` through `SR-018`). Each task is small enough that one PR can
represent one completed work package.

For every task, the following metadata is recorded:

* **Task ID** — `SR-NNN` (Structure Remediation).
* **Title** — short imperative.
* **Goal** — one-sentence summary.
* **Phase** — the phase from `plan.md` this task belongs to.
* **Branch name** — the suggested branch name.
* **Lane / agent owner** — who picks it up.
* **Files / folders allowed** — explicit allow list.
* **Files / folders forbidden** — explicit deny list.
* **Required tests** — the build/test/lint commands that must pass.
* **Review requirement** — the reviewer gate items.
* **Notes** — additional context.

---

## SR-001 — Contract / Layer Status Response Shape Repair

* **Title:** Repair generic layer status response shape so it is not
  aviation-specific.
* **Goal:** Make `LayerStatusResponseSchema` return per-layer-shaped
  counts (or a typed union) instead of aviation-specific fields used
  for all 11 layers.
* **Phase:** Phase 0 — Contract / Status Schema Repair.
* **Branch name:** `api/sr-001/layer-status-response-shape`.
* **Lane / agent owner:** API Agent.
* **Files / folders allowed:**
  * `packages/contracts/src/index.ts` (and any new files in
    `packages/contracts/src/layer/registry.ts` if a layered split is
    introduced as part of this task).
  * `apps/api/src/routes/layers.ts`.
  * `tests/api/**` — to update or add tests.
* **Files / folders forbidden:**
  * Any other route file under `apps/api/src/routes/`.
  * `apps/web/`.
  * `services/`.
  * `database/`.
  * `docs/control/`, `docs/state/`, `docs/audits/`,
    `docs/work-orders/`, `docs/archive/`.
* **Required tests:**
  * `pnpm --filter @god-eyes/contracts build` passes.
  * `pnpm --filter api build` passes.
  * `pnpm --filter api test` passes (all status-endpoint tests).
  * `python -m pytest tests/data -q` passes (no DB change, but
    sanity check).
* **Review requirement:** Per-layer count is correct against the
  layer's database tables. The aviation count is unchanged for layer
  01. The non-aviation layers return per-layer-shaped counts (e.g.
  weather `observations` / `sources` / `fetch_runs`). No other
  endpoint shape changes. Handoff log appended. No secrets.
* **Notes:** This is the **only** behaviour-changing work package in
  the roadmap. Document the contract change in the handoff entry
  and reference the new schema in the integration review.

---

## SR-002 — API Weather Route Split

* **Title:** Split `apps/api/src/routes/weather.ts` into the
  per-responsibility folder pattern.
* **Goal:** Reduce `weather.ts` from 1095 lines to a thin
  orchestrator and move SQL, parsing helpers, and mappers to
  `repository.ts`, `validation.ts`, and `mapper.ts`.
* **Phase:** Phase 1 — API Route Split.
* **Branch name:** `api/sr-002/weather-route-split`.
* **Lane / agent owner:** API Agent.
* **Files / folders allowed:**
  * `apps/api/src/routes/weather.ts` (replaced with re-export shim or
    removed after the folder is created).
  * `apps/api/src/routes/weather/` (new folder with
    `index.ts` + `service.ts` + `repository.ts` + `mapper.ts` +
    `validation.ts` + `types.ts`).
  * `tests/api/**` (only if tests reference the route file path).
* **Files / folders forbidden:**
  * Other API route files (`news.ts`, `maritime.ts`, etc.).
  * `packages/contracts/` (out of scope for this task).
  * `apps/web/`, `services/`, `database/`, `docs/control/`,
    `docs/state/`, `docs/audits/`, `docs/work-orders/`,
    `docs/archive/`.
* **Required tests:**
  * `pnpm --filter @god-eyes/contracts build` passes.
  * `pnpm --filter api build` passes.
  * `pnpm --filter api test` passes.
  * `python -m pytest tests/data -q` passes.
* **Review requirement:** No response shape change at any endpoint
  (compare responses for representative calls). All `query(...)`
  calls live in `repository.ts`. All `parse*` helpers live in
  `validation.ts`. All `rowTo*` mappers live in `mapper.ts`. No
  secrets. Handoff log appended.
* **Notes:** Use `apps/api/src/routes/objects/` as the reference
  pattern. The split is a **pure refactor** with no behaviour change.

---

## SR-003 — API News Route Split

* **Title:** Split `apps/api/src/routes/news.ts` into the
  per-responsibility folder pattern.
* **Goal:** Reduce `news.ts` from 1014 lines to a thin orchestrator
  and move SQL, parsing helpers, and mappers to `repository.ts`,
  `validation.ts`, and `mapper.ts`.
* **Phase:** Phase 1 — API Route Split.
* **Branch name:** `api/sr-003/news-route-split`.
* **Lane / agent owner:** API Agent.
* **Files / folders allowed:**
  * `apps/api/src/routes/news.ts` (replaced with re-export shim or
    removed after the folder is created).
  * `apps/api/src/routes/news/` (new folder with
    `index.ts` + `service.ts` + `repository.ts` + `mapper.ts` +
    `validation.ts` + `types.ts`).
  * `tests/api/**` (only if tests reference the route file path).
* **Files / folders forbidden:**
  * Other API route files (`weather.ts`, `maritime.ts`, etc.).
  * `packages/contracts/`.
  * `apps/web/`, `services/`, `database/`, `docs/control/`,
    `docs/state/`, `docs/audits/`, `docs/work-orders/`,
    `docs/archive/`.
* **Required tests:**
  * `pnpm --filter @god-eyes/contracts build` passes.
  * `pnpm --filter api build` passes.
  * `pnpm --filter api test` passes.
  * `python -m pytest tests/data -q` passes.
* **Review requirement:** No response shape change at any endpoint.
  All `query(...)` calls live in `repository.ts`. All `parse*`
  helpers live in `validation.ts`. All `rowTo*` mappers live in
  `mapper.ts`. No secrets. Handoff log appended.
* **Notes:** Use `apps/api/src/routes/objects/` as the reference
  pattern. Pure refactor with no behaviour change.

---

## SR-004 — API Remaining Route Split Review

* **Title:** Review-and-decide on the remaining three large API
  route files: `maritime.ts`, `energy/infrastructure.ts`,
  `space/satellites.ts`.
* **Goal:** Produce a short planning report that decides which
  remaining large route files should be split and in what order;
  propose follow-up `SR-NNN` task IDs.
* **Phase:** Phase 1 — API Route Split (review-only).
* **Branch name:** `api/sr-004/api-remaining-route-split-review`.
* **Lane / agent owner:** API Agent (planning only).
* **Files / folders allowed:**
  * The branch's **handoff entry** in `docs/state/HANDOFF_LOG.md`.
  * A planning report file added at
    `docs/state/SR-004-api-remaining-route-review.md` (archived after
    the task is complete).
* **Files / folders forbidden:**
  * The route files themselves. **No code change.**
  * `apps/web/`, `services/`, `database/`, `packages/`,
    `docs/control/`, `docs/audits/`, `docs/archive/`.
* **Required tests:** No code change, so no build/test is required.
  The agent should still run `git status --short --branch` and
  `git diff --check` to confirm no source change.
* **Review requirement:** The report includes a per-file
  recommendation (split now / defer / merge into another task). For
  each "split now" file, the report includes a proposed branch name,
  expected file count, and a complexity estimate. The handoff entry
  is appended; the report file is created in the allowed path.
* **Notes:** This is a **planning** work package, not a refactor. No
  source code is modified.

---

## SR-005 — Frontend DetailPanel Split

* **Title:** Split `apps/web/src/components/DetailPanel.tsx` (953
  lines) into a thin orchestrator plus per-feature sub-components.
* **Goal:** Reduce the top-level `DetailPanel.tsx` to a thin
  orchestrator (under 250 lines) and extract sub-components into
  per-feature files. Preserve UI output.
* **Phase:** Phase 2 — Frontend Large Component Split.
* **Branch name:** `frontend/sr-005/detail-panel-split`.
* **Lane / agent owner:** Frontend Agent.
* **Files / folders allowed:**
  * `apps/web/src/components/DetailPanel.tsx`.
  * New `apps/web/src/components/detail/` subfolder (with
    `AviationDetail.tsx`, `MaritimeDetail.tsx`, `SourcesSection.tsx`,
    etc., as decided by the agent).
  * `apps/web/src/components/intel/*` (only if a sub-component
    moves from `DetailPanel.tsx` into an existing intel file).
  * `tests/` (only the test files that exercise the panel).
* **Files / folders forbidden:**
  * `apps/api/`, `services/`, `database/`, `packages/`,
    `docs/control/`, `docs/state/`, `docs/audits/`,
    `docs/work-orders/`, `docs/archive/`.
  * `apps/web/src/layers/**` (out of scope; layer folders are
    Phase 4).
* **Required tests:**
  * `pnpm --filter web build` passes.
  * `pnpm --filter web test` passes.
  * `python -m pytest tests/data -q` passes.
* **Review requirement:** Top-level `DetailPanel.tsx` is under 250
  lines. Sub-component files are under 400 lines. UI output is
  identical (smoke test). No import boundary violation. No secrets.
  Handoff log appended.
* **Notes:** Preserve the public export of `DetailPanel` from
  `apps/web/src/components/`. Other app code imports
  `DetailPanel` by name.

---

## SR-006 — Frontend LayerPanel Split

* **Title:** Split `apps/web/src/components/LayerPanel.tsx` (1079
  lines) into a thin orchestrator plus per-layer sub-panels.
* **Goal:** Reduce the top-level `LayerPanel.tsx` to a thin
  orchestrator (under 250 lines) and extract per-layer sub-panels
  into focused files. Preserve UI output.
* **Phase:** Phase 2 — Frontend Large Component Split.
* **Branch name:** `frontend/sr-006/layer-panel-split`.
* **Lane / agent owner:** Frontend Agent.
* **Files / folders allowed:**
  * `apps/web/src/components/LayerPanel.tsx`.
  * New `apps/web/src/components/layerPanels/` subfolder (with
    `WeatherLayerPanel.tsx`, `NewsLayerPanel.tsx`,
    `MaritimeLayerPanel.tsx`, `EnergyLayerPanel.tsx`, etc., as
    decided by the agent).
  * `tests/` (only the test files that exercise the panel).
* **Files / folders forbidden:**
  * `apps/api/`, `services/`, `database/`, `packages/`,
    `docs/control/`, `docs/state/`, `docs/audits/`,
    `docs/work-orders/`, `docs/archive/`.
  * `apps/web/src/layers/**` (out of scope; layer folders are
    Phase 4).
* **Required tests:**
  * `pnpm --filter web build` passes.
  * `pnpm --filter web test` passes.
  * `python -m pytest tests/data -q` passes.
* **Review requirement:** Top-level `LayerPanel.tsx` is under 250
  lines. Sub-panel files are under 400 lines. UI output is
  identical (smoke test). No import boundary violation. No secrets.
  Handoff log appended.
* **Notes:** Preserve the public export of `LayerPanel` from
  `apps/web/src/components/`.

---

## SR-007 — Contracts Package Split

* **Title:** Split `packages/contracts/src/index.ts` (1325 lines)
  into per-layer (or per-domain) modules, with a compatibility
  re-export from `index.ts`.
* **Goal:** Reduce the contracts barrel to a thin re-export file
  and split the Zod schemas into per-layer files. Pure file split,
  no type or schema change.
* **Phase:** Phase 3 — Contracts Split.
* **Branch name:** `api/sr-007/contracts-package-split`.
* **Lane / agent owner:** API Agent.
* **Files / folders allowed:**
  * `packages/contracts/src/index.ts` (replaced with re-exports).
  * New `packages/contracts/src/layer/*.ts` files.
  * `packages/contracts/package.json` (only if a new file requires
    updating the `files` list).
* **Files / folders forbidden:**
  * `apps/api/`, `apps/web/`, `services/`, `database/`, `tests/`,
    `docs/control/`, `docs/state/`, `docs/audits/`,
    `docs/work-orders/`, `docs/archive/`.
* **Required tests:**
  * `pnpm --filter @god-eyes/contracts build` passes.
  * `pnpm --filter api build` passes.
  * `pnpm --filter web build` passes.
  * `pnpm --filter api test` passes.
  * `pnpm --filter web test` passes.
  * `python -m pytest tests/data -q` passes.
* **Review requirement:** All existing imports in `apps/api/` and
  `apps/web/` continue to work without change. No public type or
  schema is removed or renamed. Handoff log appended. No secrets.
* **Notes:** This is a **pure refactor** with no behaviour change.
  The barrel file remains the canonical import path.

---

## SR-008 — Frontend Layer Folder Canonicalization Plan

* **Title:** Produce the canonical-folder plan that the per-layer
  `SR-009..SR-014` work packages will follow.
* **Goal:** A short planning document that specifies the
  compatibility shim strategy, the test surface, and the per-layer
  order. No folder is renamed in this task.
* **Phase:** Phase 4 — Frontend Layer Folder Canonicalization (plan).
* **Branch name:** `frontend/sr-008/layer-folder-canonicalization-plan`.
* **Lane / agent owner:** Frontend Agent (planning only).
* **Files / folders allowed:**
  * A planning report file at
    `docs/state/SR-008-frontend-layer-folder-canonicalization.md`
    (archived after the task is complete).
  * The handoff entry in `docs/state/HANDOFF_LOG.md`.
* **Files / folders forbidden:**
  * `apps/web/src/layers/**` (no rename yet).
  * `apps/api/`, `services/`, `database/`, `packages/`, `tests/`,
    `docs/control/`, `docs/audits/`, `docs/archive/`.
* **Required tests:** No code change. The agent runs
  `git status --short --branch` and `git diff --check` to confirm
  no source change.
* **Review requirement:** The plan lists, for each of the six
  grandfathered folders, the canonical target name, the
  compatibility shim approach, the test surface, and the per-layer
  ordering recommendation. The plan references the rulebook §4 and
  the compliance audit ESA-005. Handoff log appended.
* **Notes:** This is a **planning** work package, not a refactor.

---

## SR-009 — Frontend Aviation Folder Canonicalization

* **Title:** Move `apps/web/src/layers/aviation/` to
  `apps/web/src/layers/layer_01_aviation/`.
* **Goal:** Rename the frontend aviation folder to the canonical
  layer ID. Add a compatibility re-export at the old path. Update
  all importers.
* **Phase:** Phase 4 — Frontend Layer Folder Canonicalization.
* **Branch name:** `frontend/sr-009/aviation-canonical-folder`.
* **Lane / agent owner:** Frontend Agent.
* **Files / folders allowed:**
  * `apps/web/src/layers/aviation/` (renamed to
    `apps/web/src/layers/layer_01_aviation/`).
  * `apps/web/src/layers/aviation.ts` (new compatibility re-export
    shim) or `apps/web/src/layers/aviation/index.ts` (new
    compatibility shim).
  * All importers in `apps/web/src/**/*.{ts,tsx}` that import from
    the old path.
  * `tsconfig.json` and `vite.config.ts` if they reference the old
    path.
  * `tests/` (only the test files that reference the old path).
* **Files / folders forbidden:**
  * `apps/api/`, `services/`, `database/`, `packages/`, `tests/`
    (other than the test files that reference the old path),
    `docs/control/`, `docs/state/`, `docs/audits/`,
    `docs/work-orders/`, `docs/archive/`.
* **Required tests:**
  * `pnpm --filter web build` passes.
  * `pnpm --filter web test` passes.
  * `python -m pytest tests/data -q` passes.
* **Review requirement:** New folder name matches
  `layer_01_aviation` in the registry. Compatibility shim is in
  place. `git grep` for the old path returns only the shim. All
  importers are updated. No secrets. Handoff log appended.
* **Notes:** This is the first per-layer move. It is the most
  complex because `aviation/` is the largest layer folder with the
  most sub-`features/` candidates.

---

## SR-010 — Frontend Borders Folder Canonicalization

* **Title:** Move `apps/web/src/layers/borders/` to
  `apps/web/src/layers/layer_02_borders_boundaries/`.
* **Goal:** Rename the frontend borders folder to the canonical
  layer ID. Add a compatibility re-export at the old path. Update
  all importers.
* **Phase:** Phase 4 — Frontend Layer Folder Canonicalization.
* **Branch name:** `frontend/sr-010/borders-canonical-folder`.
* **Lane / agent owner:** Frontend Agent.
* **Files / folders allowed:**
  * `apps/web/src/layers/borders/` (renamed to
    `apps/web/src/layers/layer_02_borders_boundaries/`).
  * Compatibility re-export at the old path.
  * All importers in `apps/web/src/**/*.{ts,tsx}`.
  * `tsconfig.json` and `vite.config.ts` if they reference the old
    path.
  * `tests/` (only the test files that reference the old path).
* **Files / folders forbidden:**
  * `apps/api/`, `services/`, `database/`, `packages/`,
    `docs/control/`, `docs/state/`, `docs/audits/`,
    `docs/work-orders/`, `docs/archive/`.
* **Required tests:**
  * `pnpm --filter web build` passes.
  * `pnpm --filter web test` passes.
  * `python -m pytest tests/data -q` passes.
* **Review requirement:** New folder name matches
  `layer_02_borders_boundaries`. Compatibility shim is in place.
  `git grep` for the old path returns only the shim. All importers
  are updated. No secrets. Handoff log appended.
* **Notes:** This is the smallest per-layer move
  (`useBordersBoundaries.ts` is 40 lines plus `.gitkeep`).

---

## SR-011 — Frontend Earth-Events Folder Canonicalization

* **Title:** Move `apps/web/src/layers/earth-events/` to
  `apps/web/src/layers/layer_03_earth_events/`.
* **Goal:** Rename the frontend earth-events folder to the canonical
  layer ID. Add a compatibility re-export at the old path. Update
  all importers.
* **Phase:** Phase 4 — Frontend Layer Folder Canonicalization.
* **Branch name:** `frontend/sr-011/earth-events-canonical-folder`.
* **Lane / agent owner:** Frontend Agent.
* **Files / folders allowed:**
  * `apps/web/src/layers/earth-events/` (renamed to
    `apps/web/src/layers/layer_03_earth_events/`).
  * Compatibility re-export at the old path.
  * All importers in `apps/web/src/**/*.{ts,tsx}`.
  * `tsconfig.json` and `vite.config.ts` if they reference the old
    path.
  * `tests/` (only the test files that reference the old path).
* **Files / folders forbidden:**
  * `apps/api/`, `services/`, `database/`, `packages/`,
    `docs/control/`, `docs/state/`, `docs/audits/`,
    `docs/work-orders/`, `docs/archive/`.
* **Required tests:**
  * `pnpm --filter web build` passes.
  * `pnpm --filter web test` passes.
  * `python -m pytest tests/data -q` passes.
* **Review requirement:** New folder name matches
  `layer_03_earth_events`. Compatibility shim is in place.
  `git grep` for the old path returns only the shim. All importers
  are updated. No secrets. Handoff log appended.
* **Notes:** Another small move
  (`useEarthEvents.ts` is 39 lines plus `.gitkeep`).

---

## SR-012 — Frontend Space Folder Canonicalization

* **Title:** Move `apps/web/src/layers/space/` to
  `apps/web/src/layers/layer_05_space_satellites/`.
* **Goal:** Rename the frontend space folder to the canonical layer
  ID. Add a compatibility re-export at the old path. Update all
  importers.
* **Phase:** Phase 4 — Frontend Layer Folder Canonicalization.
* **Branch name:** `frontend/sr-012/space-canonical-folder`.
* **Lane / agent owner:** Frontend Agent.
* **Files / folders allowed:**
  * `apps/web/src/layers/space/` (renamed to
    `apps/web/src/layers/layer_05_space_satellites/`).
  * Compatibility re-export at the old path.
  * All importers in `apps/web/src/**/*.{ts,tsx}`.
  * `tsconfig.json` and `vite.config.ts` if they reference the old
    path.
  * `tests/` (only the test files that reference the old path).
* **Files / folders forbidden:**
  * `apps/api/`, `services/`, `database/`, `packages/`,
    `docs/control/`, `docs/state/`, `docs/audits/`,
    `docs/work-orders/`, `docs/archive/`.
* **Required tests:**
  * `pnpm --filter web build` passes.
  * `pnpm --filter web test` passes.
  * `python -m pytest tests/data -q` passes.
* **Review requirement:** New folder name matches
  `layer_05_space_satellites`. Compatibility shim is in place.
  `git grep` for the old path returns only the shim. All importers
  are updated. No secrets. Handoff log appended.
* **Notes:** The space folder has a `satellites/` subfolder; the
  subfolder is preserved in the rename.

---

## SR-013 — Frontend Maritime Folder Canonicalization

* **Title:** Move `apps/web/src/layers/maritime/` to
  `apps/web/src/layers/layer_06_maritime/`.
* **Goal:** Rename the frontend maritime folder to the canonical
  layer ID. Add a compatibility re-export at the old path. Update
  all importers.
* **Phase:** Phase 4 — Frontend Layer Folder Canonicalization.
* **Branch name:** `frontend/sr-013/maritime-canonical-folder`.
* **Lane / agent owner:** Frontend Agent.
* **Files / folders allowed:**
  * `apps/web/src/layers/maritime/` (renamed to
    `apps/web/src/layers/layer_06_maritime/`).
  * Compatibility re-export at the old path.
  * All importers in `apps/web/src/**/*.{ts,tsx}`.
  * `tsconfig.json` and `vite.config.ts` if they reference the old
    path.
  * `tests/` (only the test files that reference the old path).
* **Files / folders forbidden:**
  * `apps/api/`, `services/`, `database/`, `packages/`,
    `docs/control/`, `docs/state/`, `docs/audits/`,
    `docs/work-orders/`, `docs/archive/`.
* **Required tests:**
  * `pnpm --filter web build` passes.
  * `pnpm --filter web test` passes.
  * `python -m pytest tests/data -q` passes.
* **Review requirement:** New folder name matches
  `layer_06_maritime`. Compatibility shim is in place. `git grep`
  for the old path returns only the shim. All importers are
  updated. No secrets. Handoff log appended.
* **Notes:** The maritime folder has 4 source files and a tests
  subfolder.

---

## SR-014 — Frontend Energy Folder Canonicalization

* **Title:** Move `apps/web/src/layers/energy/` to
  `apps/web/src/layers/layer_10_energy_infrastructure/`.
* **Goal:** Rename the frontend energy folder to the canonical layer
  ID. Add a compatibility re-export at the old path. Update all
  importers.
* **Phase:** Phase 4 — Frontend Layer Folder Canonicalization.
* **Branch name:** `frontend/sr-014/energy-canonical-folder`.
* **Lane / agent owner:** Frontend Agent.
* **Files / folders allowed:**
  * `apps/web/src/layers/energy/` (renamed to
    `apps/web/src/layers/layer_10_energy_infrastructure/`).
  * Compatibility re-export at the old path.
  * All importers in `apps/web/src/**/*.{ts,tsx}`.
  * `tsconfig.json` and `vite.config.ts` if they reference the old
    path.
  * `tests/` (only the test files that reference the old path).
* **Files / folders forbidden:**
  * `apps/api/`, `services/`, `database/`, `packages/`,
    `docs/control/`, `docs/state/`, `docs/audits/`,
    `docs/work-orders/`, `docs/archive/`.
* **Required tests:**
  * `pnpm --filter web build` passes.
  * `pnpm --filter web test` passes.
  * `python -m pytest tests/data -q` passes.
* **Review requirement:** New folder name matches
  `layer_10_energy_infrastructure`. Compatibility shim is in place.
  `git grep` for the old path returns only the shim. All importers
  are updated. No secrets. Handoff log appended.
* **Notes:** The energy folder has an `infrastructure/` subfolder;
  the subfolder is preserved in the rename.

---

## SR-015 — Fetcher / Normalizer Canonical Source Structure

* **Title:** Organize multi-source fetcher layers under
  `sources/<source_name>/` subfolders.
* **Goal:** Apply the rulebook §9 recommended `sources/` subfolder
  pattern to the multi-source layers (aviation, space, news, energy).
  Single-source layers may remain flat.
* **Phase:** Phase 5 — Fetcher / Normalizer Structure Cleanup.
* **Branch name:** `fetcher/sr-015/canonical-source-structure`.
* **Lane / agent owner:** Fetcher Agent.
* **Files / folders allowed:**
  * `services/fetch-orchestrator/src/layers/layer_01_aviation/` (with
    new `sources/<source_name>/` subfolders).
  * `services/fetch-orchestrator/src/layers/layer_05_space_satellites/`
    (with new `sources/celestrak/` and `sources/space_track/`).
  * `services/fetch-orchestrator/src/layers/layer_08_news_osint/` (with
    new `sources/gdacs/` and `sources/gdelt/`).
  * `services/fetch-orchestrator/src/layers/layer_10_energy_infrastructure/`
    (with new `sources/wri/`, `sources/osm/`, `sources/gem/`).
  * `tests/data/**` (only the test files that reference the
    fetcher file paths).
* **Files / folders forbidden:**
  * `services/normalizer/src/layers/layer_01_aviation/` — **do not
    move or modify** the aviation normalizer. This is the canonical
    location.
  * `apps/api/`, `apps/web/`, `database/`, `packages/`, `docs/control/`,
    `docs/state/`, `docs/audits/`, `docs/work-orders/`,
    `docs/archive/`.
  * Other layers in
    `services/fetch-orchestrator/src/layers/layer_06_maritime/`,
    `layer_07_weather/`, `layer_03_earth_events/`,
    `layer_02_borders_boundaries/` (out of scope for this task;
    they have only one source each and may remain flat).
* **Required tests:**
  * `python -m pytest tests/data -q` passes (same or better pass
    rate; the 8 pre-existing scope-guard failures on dirty tree
    are not in scope).
* **Review requirement:** Multi-source layers have
  `sources/<name>/` subfolders. Aviation normalizer is unchanged
  in `services/normalizer/src/layers/layer_01_aviation/`. Colocated
  non-aviation normalizers remain colocated. No fetcher or
  normalizer imports from `apps/web/` or `apps/api/`. No secrets.
  Handoff log appended.
* **Notes:** This is a **pure refactor** with no behaviour change.

---

## SR-016 — Database Migration Documentation Cleanup

* **Title:** Add a one-line note to `database/migrations/README.md`
  about the aviation `002` numbering gap and document the
  migration-numbering convention.
* **Goal:** Document the grandfathered `002` gap and the
  no-renumber rule in the migrations README. Do not renumber old
  migrations. Do not redesign the database.
* **Phase:** Phase 6 — Database / Migration Documentation Cleanup.
* **Branch name:** `database/sr-016/migration-documentation-cleanup`.
* **Lane / agent owner:** Database Agent.
* **Files / folders allowed:**
  * `database/migrations/README.md` (append a section, do not
    rewrite older content).
  * `docs/state/HANDOFF_LOG.md` (append a handoff entry).
* **Files / folders forbidden:**
  * Any `.sql` file under `database/migrations/`. **Do not modify or
    renumber any migration.**
  * `apps/api/`, `apps/web/`, `services/`, `packages/`, `tests/`
    (other than `tests/data/**` for the pass-rate sanity check),
    `docs/control/`, `docs/audits/`, `docs/work-orders/`,
    `docs/archive/`.
* **Required tests:**
  * `python -m pytest tests/data -q` passes (no DB change, but
    sanity check).
  * `git diff` shows only `database/migrations/README.md` (and the
    handoff log).
* **Review requirement:** The README mentions the aviation `002`
  gap explicitly and the no-renumber rule. No migration file is
  in the diff. No secrets. Handoff log appended.
* **Notes:** The aviation `002` gap is documented in
  `docs/audits/PROJECT_HEALTH_FINDINGS_EXPLAINED.md` (HEALTH-010).
  The README update references it by ID.

---

## SR-017 — Large Tests Split

* **Title:** Split the data test files exceeding the 700-line Python
  limit into focused suites per test domain.
* **Goal:** Reduce the largest data test files to under 700 lines
  each. No test is removed. No test assertion is weakened.
* **Phase:** Phase 7 — Large Test File Split.
* **Branch name:** `database/sr-017/large-tests-split`.
* **Lane / agent owner:** Database Agent / Test lane.
* **Files / folders allowed:**
  * `tests/data/layer_01_aviation/test_airport_image_gallery_worker.py`
    (split).
  * `tests/data/layer_01_aviation/test_airport_intelligence_source_probe.py`
    (split).
  * `tests/data/layer_01_aviation/test_airport_public_profile_worker.py`
    (split).
  * `tests/data/layer_01_aviation/test_aviation_live_aircraft_worker.py`
    (split).
  * `tests/data/layer_05_space_satellites/test_space_satellites_fetcher.py`
    (split — the largest at 2411 lines).
  * `tests/data/layer_06_maritime/test_maritime_migration.py` (split).
  * `tests/data/layer_07_weather/test_fetcher.py` (split).
  * `tests/data/layer_07_weather/test_weather_local_seed.py` (split).
  * `tests/data/layer_08_news_osint/test_gdacs_db_ingestion.py` (split).
  * `tests/data/layer_08_news_osint/test_news_database_schema.py`
    (split).
  * `tests/data/conftest.py` (only if a fixture path is updated).
* **Files / folders forbidden:**
  * `apps/api/`, `apps/web/`, `services/`, `database/migrations/`,
    `packages/`, `docs/control/`, `docs/state/`, `docs/audits/`,
    `docs/work-orders/`, `docs/archive/`.
  * Any source file outside the test tree. **No source code
    changes.**
* **Required tests:**
  * `python -m pytest tests/data -q` passes with the same or better
    pass rate (the 8 pre-existing scope-guard failures on dirty
    tree are not in scope).
* **Review requirement:** No test file exceeds 700 lines. No test
  is removed. No test assertion is weakened. The total number of
  tests is the same or greater. The 8 pre-existing scope-guard
  failures on dirty tree are still present and still
  pre-existing. Handoff log appended.
* **Notes:** This is a **pure refactor** of test files. The
  pre-existing 8 scope-guard failures on dirty tree (per the
  compliance audit) are not in scope.

---

## SR-018 — Future Scaling Architecture Spec

* **Title:** Create the future-scaling planning spec at
  `specs/009-future-scaling-architecture/`.
* **Goal:** A planning spec that covers scheduler/jobs, raw storage
  retention, caching, rate limits, response-size limits, streaming
  / export, audit logging, auth/authz readiness, time-series
  strategy, and object storage strategy.
* **Phase:** Phase 8 — Future Scaling Planning.
* **Branch name:** `spec/sr-018/future-scaling-architecture`.
* **Lane / agent owner:** Orchestrator Agent (planning only).
* **Files / folders allowed:**
  * New `specs/009-future-scaling-architecture/` spec folder
    (following the Spec Kit workspace pattern from
    `specs/README.md`).
  * `docs/state/HANDOFF_LOG.md` (append a handoff entry).
* **Files / folders forbidden:**
  * `apps/api/`, `apps/web/`, `services/`, `database/`, `packages/`,
    `tests/`, `docs/control/`, `docs/audits/`, `docs/work-orders/`,
    `docs/archive/`.
* **Required tests:** No code change. The agent runs
  `git status --short --branch` and `git diff --check` to confirm
  no source change.
* **Review requirement:** The spec covers all 10 topic areas. The
  spec references the compliance audit findings by ID
  (ESA-017, ESA-022, ESA-025, ESA-026, ESA-028). The spec is
  planning only — no implementation. The spec lists the open
  questions and the user-level decisions required to advance
  each topic. Handoff log appended.
* **Notes:** This is a **planning** work package, not a refactor
  or feature. The spec is the deliverable; no code is written.

---

## Cross-Task Summary

**Every worker agent picking up an SR-NNN task must read
`specs/008-structure-remediation-roadmap/repository-skeleton.md` before
starting work.** The skeleton defines the approved target folder tree, naming
conventions, split mapping, and connection flow. If implementation conflicts
with the skeleton, stop and report to the Orchestrator Agent.

**Every reviewer agent checking an SR-NNN branch must verify changes against
`repository-skeleton.md`.** Confirm that folder names, file names, split
patterns, and shim placement match the approved target.

| ID | Phase | Lane | Title |
|---|---|---|---|
| SR-001 | 0 | API / Contract | Contract / layer status response shape repair |
| SR-002 | 1 | API | API weather route split |
| SR-003 | 1 | API | API news route split |
| SR-004 | 1 | API | API remaining route split review |
| SR-005 | 2 | Frontend | Frontend DetailPanel split |
| SR-006 | 2 | Frontend | Frontend LayerPanel split |
| SR-007 | 3 | API / Contract | Contracts package split |
| SR-008 | 4 | Frontend | Frontend layer folder canonicalization plan |
| SR-009 | 4 | Frontend | Frontend aviation folder canonicalization |
| SR-010 | 4 | Frontend | Frontend borders folder canonicalization |
| SR-011 | 4 | Frontend | Frontend earth-events folder canonicalization |
| SR-012 | 4 | Frontend | Frontend space folder canonicalization |
| SR-013 | 4 | Frontend | Frontend maritime folder canonicalization |
| SR-014 | 4 | Frontend | Frontend energy folder canonicalization |
| SR-015 | 5 | Fetcher | Fetcher / normalizer canonical source structure |
| SR-016 | 6 | Database | Database migration documentation cleanup |
| SR-017 | 7 | Database / Test | Large tests split |
| SR-018 | 8 | Orchestrator (planning) | Future scaling architecture spec |

---

**Last updated:** 2026-06-15
**Author:** Orchestrator Agent
**Maintained by:** Orchestrator Agent
