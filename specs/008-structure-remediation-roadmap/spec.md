# Spec 008 — Structure Remediation Roadmap

> **Agent:** Orchestrator Agent
> **Lane:** Documentation / Planning
> **Branch:** `spec/structure-remediation-roadmap`
> **Date:** 2026-06-15
> **Source rulebook:** `docs/control/PROJECT_CONTROL.md`
> **Source audit:** `docs/audits/ENGINEERING_STRUCTURE_COMPLIANCE_AUDIT.md`

---

## 1. Problem Statement

The GOD EYES project is **structurally healthy and safe to continue** (per
the 2026-06-14 compliance audit), but a small set of **grandfathered**
structural inconsistencies remain. After the 2026-06-14 documentation cleanup
the **docs** tree is aligned with the rulebook; the remaining debt lives in
**code, fetcher, normalizer, and database** files.

The most material items are:

* **Oversized API route files** (Section 8 of the rulebook): `weather.ts`
  (1095 lines), `news.ts` (1014 lines), `maritime.ts` (797 lines),
  `energy/infrastructure.ts` (614 lines), `space/satellites.ts` (520 lines)
  all embed SQL, parsing helpers, mappers, and route handlers in one file.
* **Oversized frontend shared components** (Section 6 component limit):
  `DetailPanel.tsx` (953 lines) and `LayerPanel.tsx` (1079 lines).
* **Oversized contracts module**: `packages/contracts/src/index.ts` is 1325
  lines; mostly Zod schemas across all layers.
* **Generic-status response shape** (HEALTH-002): `LayerStatusResponseSchema`
  declares aviation-specific `objectCounts` (`airports`, `runways`, `navaids`,
  `airportFrequencies`, `countries`, `regions`) and is reused for **all
  11 layers**, returning zeros for non-aviation layers.
* **Non-canonical frontend layer folder names** (Section 4 of the rulebook):
  `aviation/`, `borders/`, `earth-events/`, `space/`, `maritime/`, `energy/`
  are grandfathered. Two layers (`layer_07_weather`, `layer_08_news_osint`)
  already follow the canonical style.
* **Migration `002` numbering gap** in `database/migrations/layers/layer_01_aviation/`
  (HEALTH-010): the gap is grandfathered; the rulebook says document, do not
  renumber.
* **Oversized Python workers and test files** (Section 6 Python size limit):
  the largest are listed in archived research evidence and `plan.md`.
* **Fetcher / normalizer source split** (Section 9 recommended pattern): the
  `sources/<name>/` subfolder is "optional" for single-source layers; the
  multi-source layers (aviation, space, news, energy) use prefixed flat file
  names instead.

This spec defines how each of these is fixed **safely**, **one focused work
package at a time**, behind **reviewer gates**.

---

## 2. Current Structure Pain Points

| # | Pain Point | Where it hurts | Audit ID |
|---|---|---|---|
| 1 | API route file size exceeds 800-line "not allowed for new work" threshold | Code review, regression risk, agent ownership boundaries | ESA-002, ESA-014, ESA-015 |
| 2 | Frontend shared component size exceeds 400-line component limit | Renderer reliability, test surface, ownership boundaries | ESA-003 |
| 3 | Contracts barrel file is 1325 lines | API/frontend onboarding, Zod schema ownership | ESA-004 |
| 4 | `LayerStatusResponseSchema.objectCounts` is aviation-specific | `GET /api/layers/:layerId/status` returns misleading zero values for non-aviation layers | HEALTH-002 |
| 5 | Frontend layer folders use short non-canonical names | Discoverability, import paths drift from registry | ESA-005 |
| 6 | Recommended `features/` / `sources/<name>/` subfolder split not used | File growth in flat folders | ESA-006, ESA-009 |
| 7 | Multiple Python workers and test files exceed 700-line Python limit | Slow reviews, mixed responsibilities | ESA-008, ESA-009 |
| 8 | Migration `002` numbering gap in aviation | Documentation only; the gap is documented as known | ESA-010, HEALTH-010 |
| 9 | Pagination/limit/bbox constants are defined per route file | Code duplication; centralization candidate | ESA-016 |
| 10 | No application-layer caching, rate-limit, or auth patterns | Required for layer 09 and any non-localhost deployment | ESA-017 |

---

## 3. Target Structure Principles

The remediation must converge on the rules already documented in
`docs/control/PROJECT_CONTROL.md`. The principles below are
**derived from the rulebook**, not new rules:

* **Layer folders use canonical `layer_NN_name/` naming** in every lane
  (frontend, fetcher, normalizer, source-catalog, database, tests). The
  registry is authoritative; short names are grandfathered and may not
  appear in new code.
* **Large API routes follow the per-layer split**: `index.ts` /
  `service.ts` / `repository.ts` / `mapper.ts` / `validation.ts` /
  `types.ts`. The aviation sub-resource folders
  (`airport-intelligence/`, `airport-layout-features/`, `public-profile/`,
  `objects/`) are the reference pattern.
* **Large frontend components are split** into per-feature sub-components,
  preserving the existing UI output. No visual change.
* **Contracts module is split per layer** (or per domain), with a
  compatibility re-export from `index.ts` so that no API or frontend import
  path breaks.
* **Generic layer status is a typed union or per-layer schema**, not an
  aviation-shaped payload reused for all layers.
* **One work package per branch.** No broad cleanup branch. Each branch has
  one named `SR-NNN` task, one lane, one reviewer.
* **No behaviour change unless the work package explicitly says so.** All
  splits are pure refactors with regression tests.
* **Tests must pass before review.** Branch cannot move to review with red
  tests.
* **Reviewer must verify structure rules every time** (file placement,
  folder naming, file naming, file size, function size, single
  responsibility, import boundary, no unauthorized refactor).

### Approved target skeleton

The full target folder tree, naming conventions, split/rename mapping,
connection flow diagrams, and work-package mapping are defined in:

```
specs/008-structure-remediation-roadmap/repository-skeleton.md
```

**The naming conventions in `repository-skeleton.md` are binding for all
`SR-NNN` work packages.** If an implementation decision conflicts with
`repository-skeleton.md`, the worker agent must stop and report to the
Orchestrator Agent before proceeding.

---

## 4. Non-Goals

This spec explicitly does **not** include:

* **Implementation of any remediation work in this branch.** No code, no
  folders renamed, no files moved, no migrations renumbered, no tests
  modified.
* **Behaviour changes.** No endpoint URL changes, no response shape changes
  (except the explicit `LayerStatusResponse` generalization covered by
  `SR-001`), no UI visual changes, no fetcher/normalizer logic changes.
* **Architectural decisions** on auth, deployment topology, time-series
  storage, object storage, or scheduler. These are open questions from the
  compliance audit and are deferred to dedicated work orders (the
  "Future scaling" Phase 8 in `plan.md`).
* **New layers.** `layer_04_public_military_security` and
  `layer_09_user_shapes` remain `coming_soon`.
* **Renumbering of existing migrations.** Section 11 of the rulebook makes
  old migrations immutable. The `002` aviation gap is documented, not
  repaired by renumbering.
* **Movement of existing normalizers.** The Normalizer Location Rule
  (HEALTH-004) is preserved as-is. Colocated non-aviation normalizers
  remain colocated.
* **Forced rename of all grandfathered frontend folders in one branch.**
  One layer at a time, with full regression tests, behind one review.

---

## 5. Safety Rules (apply to every `SR-NNN` work package)

These rules are mandatory for every remediation branch. They are
**reviewer-gate items** and are checked on every work-package PR.

1. **No broad cleanup branch.** There is no branch titled
   `refactor/everything` or `chore/cleanup-all`. Each work package is one
   branch, one `SR-NNN` task, one lane, one reviewer.
2. **One focused work package per branch.** A branch may contain several
   local commits, but covers exactly one `SR-NNN` task. A work package may
   not bundle unrelated refactors.
3. **No behaviour change unless the work package explicitly says so.** All
   refactor work packages must state "no behaviour change" in the spec/plan
   section. Behaviour-changing packages are separate specs (e.g. `SR-001`
   on the status response shape, which is explicitly an API contract
   change).
4. **Preserve compatibility during renames.** Every folder or file rename
   must keep a compatibility re-export or alias until all importers are
   updated. A rename is not "done" while a `TODO` import path remains.
5. **Tests must pass before review.** A branch cannot move to reviewer
   review with any failing test, build error, or scope-guard test error
   that is caused by the change.
6. **Reviewer must verify structure rules every time.** The reviewer runs
   the engineering structure rules checklist
   (`docs/control/PROJECT_CONTROL.md` Section 19) on every
   work-package branch. File placement, folder naming, file naming, file
   size, function size, single responsibility, import boundary, database
   structure, API transport, no unauthorized refactor, append-only
   handoff log, no secrets, tests pass.
7. **No new folders unless explicitly permitted.** Each work package's
   `tasks.md` row states the allowed folders. A worker agent may not
   create folders outside the listed allowed set.
8. **Handoff log is append-only.** The worker agent appends one entry to
   `docs/state/HANDOFF_LOG.md` per work package. Older entries are not
   rewritten. This is enforced by the `APPEND_ONLY_LOG` classification.
9. **No secrets, no real API keys.** The `.env.example` and code may use
   placeholders only. Real keys are never committed.
10. **Branch name follows `PROJECT_CONTROL.md`.** Format
    `<role>/<work-order-or-sr-id>/<short-name>`, e.g.
    `api/sr-002/weather-route-split`.
11. **Worker agents do not push.** The Orchestrator Agent (or user) owns
    push. This is enforced by the Git workflow policy.
12. **Rollback strategy is documented per work package.** Each phase in
    `plan.md` lists a rollback strategy. A branch that cannot be safely
    reverted must state why and how to reverse it.

---

## 6. Success Criteria

The roadmap is **complete** when **all** of the following are true. These
are reviewer-gate items, not goals for this branch.

* The five oversized API route files have been split into the
  recommended per-layer folder layout, with the same external behaviour.
* The two oversized frontend shared components
  (`DetailPanel.tsx`, `LayerPanel.tsx`) have been split into
  per-feature sub-components, with the same UI output.
* `packages/contracts/src/index.ts` is split into per-layer (or
  per-domain) modules, re-exported from `index.ts` for compatibility.
* `LayerStatusResponseSchema` is no longer aviation-specific; the
  generic layer status returns per-layer-shaped counts (or a typed union).
* The six grandfathered short-name frontend layer folders have been
  renamed to canonical `layer_NN_name/` (one layer per work package).
* The Python worker files exceeding the 700-line threshold have been
  split or have documented justification.
* The migration `002` aviation gap is documented in
  `database/migrations/README.md`. Existing migrations are unchanged.
* The data tests exceeding the 700-line threshold have been split or
  have documented justification.
* The future-scaling architecture spec (`SR-018`) has been written and
  covers scheduler, raw retention, cache, rate limit, response size,
  streaming/export, audit logging, auth/authz readiness, time-series
  strategy, and object storage strategy.
* Every work package has an `INTEGRATION_REVIEW_*.md` (active or
  archived) with PASS decision.
* `docs/state/CURRENT_PROJECT_STATE.md` is updated to reflect each
  completed phase.

---

## 7. Definitions — Active vs Historical References

* **Active reference**: a file or folder that the project currently uses
  in build, test, runtime, or in active feature work. Active references
  are renamed only through a dedicated refactor branch (this roadmap).
* **Historical reference**: a file or folder that is documented in
  `docs/`, `docs/archive/`, `docs/audits/`, or in commit history but is
  no longer used in build, test, or runtime. Historical references
  remain in their archived location; they are not renamed retroactively
  unless a future audit identifies a documentation correction.

For this roadmap:

* The **grandfathered frontend layer folders** (`aviation/`,
  `borders/`, `earth-events/`, `space/`, `maritime/`, `energy/`) are
  **active** until renamed by a dedicated work package. They are not
  historical.
* The **aviation normalizer** at
  `services/normalizer/src/layers/layer_01_aviation/` is the
  **canonical** (active) location; do not move.
* The **colocated non-aviation normalizers** under
  `services/fetch-orchestrator/src/layers/<layer_id>/` are
  **canonical** for the layers that have them. Do not move in a
  documentation or refactor task. Move only by an explicit
  Orchestrator-issued work order.
* The **migrations** in
  `database/migrations/layers/layer_01_aviation/` are **historical
  and immutable**. The `002` gap is grandfathered and remains.

---

## 8. Required Agent Workflow for Each Remediation Branch

The workflow below is **mandatory for every `SR-NNN` work package**. It is a
subset of the `AGENTS.md` Build → Review/Test → Push → Next cycle, with
remediation-specific checks.

1. **Read all required first-read documents** (AGENTS.md, the engineering
   rulebook, current state, the relevant `SR-NNN` section of this spec).
2. **Confirm the work package is in scope.** If it is not, raise it in
   `docs/state/HANDOFF_LOG.md` and stop.
3. **Create a branch** following the Git workflow policy branch name
   format. Worker agents may create local commits only.
4. **Do the work** within the **allowed folders** listed in `tasks.md`
   for the row. Do not touch **forbidden folders**.
5. **Run the required checks** (build, test, lint) for the lane. All
   required tests must pass before review.
6. **Append one handoff entry** to `docs/state/HANDOFF_LOG.md`. Do not
   prepend, do not rewrite older entries.
7. **Create one local commit** with the full commit body in the format
   from the Git workflow policy.
8. **Move to reviewer** (Orchestrator Agent). Do not push, do not open
   a PR, do not merge, do not delete the branch.
9. The **Orchestrator Agent** runs the engineering structure rules checklist
   (Section 19 of the rulebook), the work-package-specific reviewer
   checks from `plan.md`, the safety rules from `spec.md`, and the
   `spec.md` → `plan.md` → `tasks.md` alignment.
10. The **Orchestrator Agent** writes
    `docs/state/INTEGRATION_REVIEW_[WO].md` (active during the work,
    archived after completion) with PASS / FAIL / NEEDS REVIEW.
11. On **PASS**, the Orchestrator Agent (or the user) pushes the branch
    to remote. On **FAIL**, the worker agent revises on the same branch
    and re-enters step 4.
12. The user opens one PR per completed work package, per the Git
    workflow policy.

---

## 9. How Each Future Work Package Should Be Reviewed

For every `SR-NNN` branch, the Orchestrator Agent must verify, with an
explicit PASS / FAIL / NOT APPLICABLE for each:

| # | Check | Notes |
|---|-------|-------|
| 1 | **Scope matches the work package.** Only files in the "Files / folders allowed" list from `tasks.md` are touched. No folder outside the list. | This is the **no broad cleanup branch** check. |
| 2 | **No behaviour change** (or the work package's allowed behaviour change is implemented and contract-documented). | Compare API responses and UI output against the previous release. |
| 3 | **Compatibility preserved.** Every renamed file/folder has a compatibility re-export or alias until all importers are migrated. | `git grep` for the old import path; ensure only the re-export contains it. |
| 4 | **Tests pass.** `pnpm --filter web test`, `pnpm --filter api test`, `python -m pytest tests/data -q` (per lane) all green. | A branch with red tests is FAIL. |
| 5 | **Engineering structure rules** (Section 19 of the rulebook). File placement, folder naming, file naming, file size, function size, single responsibility, import boundary. | Run the checklist. |
| 6 | **Handoff log appended** (not prepended, not rewritten). | The new entry is the last entry. |
| 7 | **No secrets, no real API keys.** | `git diff` for `.env`, tokens, credentials. |
| 8 | **Branch name follows policy.** | Format `<role>/<sr-id>/<short-name>`. |
| 9 | **Commit message follows policy.** | Includes Agent, Work Order, Branch, Summary, Commands, Known Issues, Forbidden Folders, Secrets. |
| 10 | **Work package-specific reviewer checks** from `plan.md` (the per-phase "Reviewer checks" list). | Each work package in `plan.md` lists its own checks. |
| 11 | **Rollback strategy exists.** | A work-package branch must be safely revertible, or the reviewer must record the explicit non-trivial rollback in the review. |
| 12 | **No piggyback scope.** | The branch does not contain refactors, dependency bumps, formatter runs, or other changes that are not the `SR-NNN` task. |

A PASS on all 12 items is required for the branch to be considered
**Reviewer PASS**. A FAIL on any item is a `NEEDS REVIEW` and the worker
agent revises.

---

## 10. Relationship to Other Documents

* **`.specify/memory/constitution.md`** - Spec Kit principles and governance for this repository.
* **`AGENTS.md`** - entry point, role boundaries, reading policy, and handoff requirements.
* **`docs/control/PROJECT_CONTROL.md`** - master engineering rulebook.
* **`docs/control/PROJECT_CONTROL.md`** - authoritative layer registry, ownership matrix, and source/data contract.
* **`docs/control/PROJECT_CONTROL.md`** - git rules.
* **`docs/audits/ENGINEERING_STRUCTURE_COMPLIANCE_AUDIT.md`** - the source audit with 30 findings (ESA-001..ESA-030).
* **`docs/audits/PROJECT_HEALTH_FINDINGS_EXPLAINED.md`** - additional evidence for HEALTH-002, HEALTH-010.
* **`docs/state/CURRENT_PROJECT_STATE.md`** - current state assumed by this roadmap.
* **`specs/README.md`** - Spec Kit workspace conventions.
* Pre-consolidation control documents retained as pointer stubs or historical evidence are not active authority for new work.

---
## 11. Lifecycle of This Spec

This spec is a **planning** spec. It does not enter "implementation"
state on this branch. Each `SR-NNN` row in `tasks.md` becomes its own
**work order** (or small spec) on its own branch when the responsible
agent picks it up. The roadmap itself is **complete** when every
`SR-NNN` row has a corresponding completed work-package branch with a
PASS integration review.

After all work packages are complete, this spec is **archived** under
`docs/archive/<date>-structure-remediation-roadmap/INDEX.md` and the
implementation status moves into `docs/state/CURRENT_PROJECT_STATE.md`
as "structure remediation complete."

---

**Last updated:** 2026-06-15
**Author:** Orchestrator Agent
**Maintained by:** Orchestrator Agent
