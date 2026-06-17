# Spec 008 - Structure Remediation Roadmap

Classification: SPEC_WORKSPACE
Status: **Phase 4 (Frontend Layer Folder Canonicalization) completed** — docs closure alignment by SR-016
Owner: Orchestrator Agent
Last updated: 2026-06-16 (SR-016 docs closure)

## Status Banner (2026-06-16, post-SR-016)

> **Spec 008 Phase 4 — Frontend Layer Folder Canonicalization is complete.**
> The documentation consolidation phases (Phase 0 contract repair, Phase 1
> API route splits including the SR-005A / SR-005B / SR-005C follow-up
> splits, Phase 2 frontend large component splits, Phase 3 contracts
> split, and Phase 4 frontend layer folder canonicalization including
> SR-010, SR-010S, SR-011, SR-013, SR-012, SR-014, SR-009, and the
> final shape cleanup) are all done.
>
> Final `apps/web/src/layers/` shape contains exactly 8 active canonical
> layer folders:
>
> * `layer_01_aviation`
> * `layer_02_borders_boundaries`
> * `layer_03_earth_events`
> * `layer_05_space_satellites`
> * `layer_06_maritime`
> * `layer_07_weather`
> * `layer_08_news_osint`
> * `layer_10_energy_infrastructure`
>
> Old duplicate short-name shim folders (`aviation/`, `borders/`,
> `earth-events/`, `space/`, `maritime/`, `energy/`) were removed in
> the final shape cleanup. Future inactive layer folders
> (`layer_04_public_military_security/`, `layer_09_user_shapes/`) were
> intentionally not created because those future inactive layers should
> only be created when implementation starts. Every active canonical
> layer folder has a public `index.ts`. `layer_07_weather/index.ts`
> and `layer_08_news_osint/index.ts` were standardized in the final
> shape cleanup.
>
> Validation passed: `pnpm --filter web build`, `pnpm --filter web
> test`, `pnpm --filter api build`, `pnpm --filter api test`, and
> `python -m pytest tests/data -q` on a clean tree. The user reported
> real backend and database runtime validation passed after the
> frontend closure cleanup. No push, PR, merge, or branch deletion
> has been performed.
>
> For per-task evidence, see the **"Status as of 2026-06-16
> (post-SR-016)"** section near the top of `tasks.md` and the
> **"Status as of 2026-06-16 (post-SR-016)"** section near the top
> of `plan.md`. For the canonical-folder plan completion addendum,
> see `frontend-layer-canonicalization-plan.md`.

## Status After Phase 6 (2026-06-16)

The documentation consolidation work that motivated Spec 008 is **complete**:

- `docs/control/PROJECT_CONTROL.md` is the single active project control file
  (engineering rules, layer registry, ownership, source/data contract, Git
  workflow, and work-order template in 4 parts).
- Retired pointer stubs were removed from `docs/control/`; only
  `PROJECT_CONTROL.md` remains there.
- `AGENTS.md` is now a pure entry-point pointer and no longer duplicates the
  layer table, ownership matrix, or hard-rules body.
- The audit reports in `docs/audits/` (`DOCUMENTATION_REORGANIZATION_REPORT_2026-06-16.md`
  and `DOCUMENTATION_STRUCTURE_TERMINOLOGY_AUDIT_2026-06-16.md`) carry
  "Superseded" / "Post-Phase 6" addenda and remain as historical evidence.
- `docs/archive/_DO_NOT_READ.md` lists `docs/control/PROJECT_CONTROL.md` as the
  only active control file and explicitly retires the earlier control filenames.
- Implemented layer specs 001-007 are archived under
  `docs/archive/2026-06-16-implemented-specs/`.

Spec 008 itself **remains active** for the unresolved non-Phase-4
items: API route file-shape normalization, API endpoint path policy
decision, `TODO` / deprecated marker cleanup, `CesiumGlobe` split
planning, and the missing `PROJECT_CONTROL.md` Part 2 §8 package
ownership row decision. Phase 4 (frontend layer folder
canonicalization) is closed from a code and structure perspective.
The pre-consolidation research files inside this folder are now
historical evidence only and must not be read as active rules — the
active authorities are listed below.

## Purpose

This spec is the structure-remediation roadmap for GOD EYES. It plans how the project
repairs grandfathered file, folder, API, frontend, contract, and documentation structure
debt without broad unscoped refactors.

The spec remains active for the unresolved non-Phase-4 items listed above.
Phase 4 (frontend layer folder canonicalization) was completed end to end:
the documentation compression phases, the API route splits, the frontend
component splits, the contracts split, and the per-layer frontend folder
renames plus the final shape cleanup have all landed as local commits
on the correction stack (see `docs/state/HANDOFF_LOG.md`).

- `docs/control/PROJECT_CONTROL.md` is now the single active project control file.
- Implemented layer specs 001-007 are archived.
- `docs/archive/_DO_NOT_READ.md` fences historical material.
- `.specify/memory/constitution.md`, `docs/README.md`, and `specs/README.md` now describe
  the Spec Kit-aligned documentation system.
- Phase 4 frontend layer folder canonicalization is complete; see the
  status banner above and the per-task evidence in `docs/state/HANDOFF_LOG.md`.

## Spec Kit Position

This folder follows the Spec Kit lifecycle:

- `spec.md` - problem, scope, non-goals, safety rules, and success criteria
- `plan.md` - remediation phases and technical approach
- `tasks.md` - ordered SR-001 through SR-018 work packages
- `repository-skeleton.md` - target repository skeleton and lane mapping

No `contracts/`, `data-model.md`, or `quickstart.md` is required for this spec because it
does not introduce runtime behavior or new API/data shapes.

Supporting evidence was archived to keep this active spec compact:

- `docs/archive/2026-06-16-docs-pruned/spec-008-evidence/`

## Current Active Authorities

Use these documents when implementing or reviewing any remaining SR task:

1. `AGENTS.md`
2. `.specify/memory/constitution.md`
3. `docs/control/PROJECT_CONTROL.md`
4. `docs/state/CURRENT_PROJECT_STATE.md`
5. `docs/state/RECENT_CONTEXT.md`

The older control document names in historical research files are retired and preserved
only in Git history or archive evidence. They are not active rules.

## How To Use This Spec

1. Read `spec.md` for safety rules and success criteria.
2. Read `plan.md` for the relevant remediation phase.
3. Read `tasks.md` for the exact SR task and allowed paths.
4. Read `repository-skeleton.md` before changing file or folder structure.
5. Search the archived evidence folder only when the active files do not answer a
   specific question.
6. Run the required checks from `PROJECT_CONTROL.md`.
7. Update `HANDOFF_LOG.md` and `RECENT_CONTEXT.md` after completed work.

If `repository-skeleton.md` or older planning files conflict with the active control docs,
the active control docs win. Log the drift before proceeding.

## Out Of Scope

- New layer implementation
- Layer 04 or Layer 09 feature work while they remain `coming_soon`
- Auth, deployment, or time-series architecture decisions
- Broad code movement outside a listed SR task
- Treating archived or pre-consolidation evidence as active instructions
