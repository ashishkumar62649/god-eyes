# Spec 008 - Structure Remediation Roadmap

Classification: SPEC_WORKSPACE
Status: Active roadmap with completed documentation phases
Owner: Orchestrator Agent
Last updated: 2026-06-16

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

Spec 008 itself **remains active** for any remaining non-documentation SR tasks
(grandfathered folder renames, API route standardisation, etc.). The pre-
consolidation research files inside this folder are now historical evidence only
and must not be read as active rules — the active authorities are listed below.

## Purpose

This spec is the structure-remediation roadmap for GOD EYES. It plans how the project
repairs grandfathered file, folder, API, frontend, contract, and documentation structure
debt without broad unscoped refactors.

The spec remains active for unfinished structure work, but several documentation
compression phases have already been implemented:

- `docs/control/PROJECT_CONTROL.md` is now the single active project control file.
- Implemented layer specs 001-007 are archived.
- `docs/archive/_DO_NOT_READ.md` fences historical material.
- `.specify/memory/constitution.md`, `docs/README.md`, and `specs/README.md` now describe
  the Spec Kit-aligned documentation system.

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
