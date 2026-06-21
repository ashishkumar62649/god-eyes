# Documentation Reorganization Report - 2026-06-16

## Classification

| Field | Value |
|-------|-------|
| Type | Documentation reorganization and consolidation report |
| Agent | Orchestrator Agent |
| Branch | `docs/fix/recent-context-and-reading-policy` |
| Scope | Active Markdown/documentation files, Spec Kit alignment, duplicate authority cleanup, terminology cleanup |
| Status | **SUPERSEDED** — see post-consolidation status below |

> **Superseded status (2026-06-16).**
> This report described the move from many control files (`PROJECT_RULES.md`,
> `LAYER_AND_DATA_CONTRACT.md`, `GIT_WORKFLOW_POLICY.md`, `WORK_ORDER_TEMPLATE.md`,
> The single consolidated active project control file `docs/control/PROJECT_CONTROL.md` (4 parts) replaced the previously active filenames listed in the structure-consolidation amendment history of `.specify/memory/constitution.md` (e.g. the legacy `LAYER_REGISTRY` / `LAYER_AND_DATA_CONTRACT` / `WORK_ORDER_TEMPLATE` pointers that are now retired).
> `LAYER_ARCHITECTURE.md`, `SOURCE_TO_FRONTEND_CONTRACT.md`,
> `ENGINEERING_STRUCTURE_RULES.md`, `DATA_LOCATION_RULES.md`,
> `PIPELINE_HANDOFF_RULES.md`) to a smaller consolidated set.
>
> A subsequent pass on the same day merged **all** engineering rules, layer
> registry, ownership matrix, source contract, Git workflow, and work-order
> template into a single file: `docs/control/PROJECT_CONTROL.md` (4 parts).
> All earlier active control filenames listed in this report are retired.
> The only active project control file is `docs/control/PROJECT_CONTROL.md`.
>
> This report remains as historical evidence of the Phase 2-5 consolidation.
> The current active state is described in
> `docs/state/CURRENT_PROJECT_STATE.md` and
> `docs/state/RECENT_CONTEXT.md`.

## Executive Summary

The documentation system is now arranged around a smaller active authority set:

1. `.specify/memory/constitution.md` - project principles and governance.
2. `AGENTS.md` - entry point, roles, reading policy, and handoff rules.
3. `docs/control/PROJECT_RULES.md` - engineering structure rulebook.
4. `docs/control/LAYER_AND_DATA_CONTRACT.md` - layer registry, ownership, and source/data contract.
5. `docs/control/GIT_WORKFLOW_POLICY.md` - branch, commit, push, and review rules.
6. `docs/state/CURRENT_PROJECT_STATE.md` and `docs/state/RECENT_CONTEXT.md` - current state and short rolling context.
7. `specs/README.md` and active `specs/<number>-<feature>/` folders - feature specs, plans, and tasks.

The older overlapping control documents remain as retired pointer stubs or historical evidence. They are not deleted because they preserve traceability, but agents are no longer asked to read them as active rules.

## Spec Kit Alignment

The project now follows the Spec Kit sequence in the documentation map:

| Step | Repository location | Purpose |
|------|---------------------|---------|
| Constitution | `.specify/memory/constitution.md` | Defines durable principles and governance checks. |
| Specify | `specs/<number>-<feature>/spec.md` or `SPEC_OVERVIEW.md` | Defines what and why before implementation detail. |
| Plan | `specs/<number>-<feature>/plan.md` or lane planning files | Maps the spec to implementation strategy, constraints, and risks. |
| Tasks | `specs/<number>-<feature>/tasks.md` or `WORK_ORDERS.md` | Breaks the plan into executable work. |
| Implement | Work branch plus handoff entries | Executes the task, validates it, and records results. |

This matches the user-selected Spec Kit model: specifications are the durable artifact; implementation work follows specs, plans, and tasks rather than scattered notes.

## Duplicate Information Found and Consolidated

| Duplicate theme | Old spread | Current active home | Result |
|-----------------|------------|---------------------|--------|
| Engineering rules | Multiple historical control docs repeated folder rules, size limits, import boundaries, raw data rules, and normalizer rules | `docs/control/PROJECT_RULES.md` | One active rulebook; older docs are pointer stubs/evidence. |
| Layer IDs and statuses | Layer registry, layer architecture, layer ID conventions, agent ownership, source-to-frontend contract | `docs/control/LAYER_AND_DATA_CONTRACT.md` | One authoritative layer/data contract. |
| Agent role names | Documentation Agent, Reviewer Agent, Contract Agent, and other non-table role names in active docs | AGENTS neutral roles only | Active docs now use Orchestrator Agent, Frontend Agent, Fetcher Agent, Normalizer Agent, Database Agent, API Agent. |
| Reading order | Older docs pointed agents at long history files or obsolete rulebooks | `AGENTS.md`, `docs/README.md`, `specs/README.md`, `RECENT_CONTEXT.md` | Agents get a short first-read path and search history only when needed. |
| Work order metadata | Old template asked for model/tool metadata and stale control references | `docs/control/WORK_ORDER_TEMPLATE.md` | Template now requires neutral roles, handoff updates, forbidden folders, commands, known issues, and secrets status. |
| Source identity | Layer 06 maritime source docs named AISStream but did not state the canonical layer/source identity together | `packages/source-catalog/layers/layer_06_maritime/README.md` and `source_decisions.md` | Source docs now declare `layer_06_maritime`, Maritime, `aisstream`, and status. |

## Files Changed in This Reorganization

| File | Change |
|------|--------|
| `.specify/memory/constitution.md` | Rewritten as the active Spec Kit constitution with compact principles, governance, and amendment rules. |
| `docs/README.md` | Rewritten as the documentation map, reading sequence, directory ownership guide, archive policy, and new-doc placement guide. |
| `specs/README.md` | Rewritten as the Spec Kit workspace guide with sequence, folder pattern, file roles, and active/archive rules. |
| `docs/control/PROJECT_RULES.md` | Updated to identify retired source files as pointer stubs and to reference the active constitution and layer/data contract. |
| `docs/control/LAYER_AND_DATA_CONTRACT.md` | Cleaned source-lineage wording and normalized terminology. |
| `docs/control/GIT_WORKFLOW_POLICY.md` | Updated review and ownership language to use neutral active roles. |
| `docs/control/WORK_ORDER_TEMPLATE.md` | Updated stale rule references and removed non-neutral metadata fields. |
| `docs/state/CURRENT_PROJECT_STATE.md` | Updated active authority references to `LAYER_AND_DATA_CONTRACT.md`. |
| `docs/state/RECENT_CONTEXT.md` | Normalized recent active entries to neutral role names. |
| `specs/008-structure-remediation-roadmap/README.md` | Rewritten to make Spec 008 an active roadmap and to mark old docs as retired evidence, not active rules. |
| `specs/008-structure-remediation-roadmap/spec.md` | Updated agent name, source rulebook, reviewer terminology, and related-doc authority list. |
| `specs/008-structure-remediation-roadmap/plan.md` | Updated agent name, source rulebook, owner lane, reviewer language, and registry authority. |
| `specs/008-structure-remediation-roadmap/tasks.md` | Updated agent/owner names to active neutral roles. |
| `specs/008-structure-remediation-roadmap/repository-skeleton.md` | Updated local-tool wording and active `docs/control/` skeleton to show consolidated rulebooks plus retired stubs. |
| `packages/source-catalog/layers/layer_06_maritime/README.md` | Added canonical layer/source identity table. |
| `packages/source-catalog/layers/layer_06_maritime/source_decisions.md` | Added canonical layer/source identity table. |

## Location Decisions

No active documentation directories were moved in this pass. That was intentional.

| Area | Decision | Reason |
|------|----------|--------|
| `docs/control/` | Keep active consolidated rulebooks and retired pointer stubs together | Agents can see the old filenames but are redirected to the active authority. This avoids broken links while preventing duplicate rule loading. |
| `specs/008-structure-remediation-roadmap/` | Keep as active spec workspace | It is the current structure remediation roadmap and already follows the Spec Kit folder model. |
| `docs/archive/` | Leave historical docs behind the archive fence | Archive is already correctly fenced by `docs/archive/_DO_NOT_READ.md`; moving more files now would add churn without improving active reading. |
| Root `CLAUDE.md` | Leave in place as a local adapter note, not active authority | It may support local tooling behavior. The active documentation map does not route agents through it. |
| Reports | Store this report in `docs/audits/` | The repository already uses `docs/audits/` for documentation evidence and review reports; no new `docs/reports/` bucket was needed. |

## Current Agent Reading Path

An agent should now read in this order:

1. `AGENTS.md`
2. `.specify/memory/constitution.md`
3. `docs/control/PROJECT_RULES.md`
4. `docs/control/LAYER_AND_DATA_CONTRACT.md`
5. `docs/state/CURRENT_PROJECT_STATE.md`
6. `docs/state/RECENT_CONTEXT.md`
7. Task-specific spec, work order, or ADR

Then the agent should search only as needed:

| Need | Search/read |
|------|-------------|
| Full session history | Search `docs/state/HANDOFF_LOG.md`; do not load the whole file. |
| Historical implementation context | Search `docs/archive/**`; do not treat archived docs as active rules. |
| Current structure remediation | Read `specs/008-structure-remediation-roadmap/README.md`, then the relevant `spec.md`, `plan.md`, and `tasks.md` section. |
| Layer/source truth | Read `docs/control/LAYER_AND_DATA_CONTRACT.md`; layer source docs must declare their layer/source identity. |
| New large feature | Create or update a Spec Kit folder under `specs/<number>-<feature>/`. |
| Small repair | Create or update a work order under `docs/work-orders/`. |

## Terminology Corrections

| Old/unclear term | Current term |
|------------------|--------------|
| Documentation Agent | Orchestrator Agent |
| Reviewer Agent | Orchestrator Agent |
| Contract Agent | API Agent |
| Legacy layer-registry filename (retired) cited as active authority | `docs/control/PROJECT_CONTROL.md` Part 2 §4 |
| `ENGINEERING_STRUCTURE_RULES.md` as active authority | `PROJECT_RULES.md` |
| "normalise" / "normalised" in active rule text | "normalize" / "normalized" |

## Remaining Known Issues

| Issue | Status |
|-------|--------|
| `docs/state/HANDOFF_LOG.md` still contains historical non-neutral role/tool names | Accepted. It is append-only history and should not be rewritten. New entries must use neutral roles only. |
| Some research files inside Spec 008 contain pre-consolidation wording | Accepted as evidence. The active `README.md`, `spec.md`, `plan.md`, and `tasks.md` now point to consolidated authority. |
| Root local adapter note remains outside the active docs map | Accepted. It is not part of the mandatory reading chain. |
| Some archived docs contain obsolete names and rules | Accepted. Archive is historical and explicitly cannot override active docs. |

## Validation

Validation performed for this report:

| Check | Result |
|-------|--------|
| Active authority references reviewed | PASS |
| Spec 008 active files updated to consolidated rulebook names | PASS |
| Neutral role terminology pass over active docs | PASS, with historical/source-lineage/report-mapping exceptions only |
| Layer 06 source identity gap fixed | PASS |
| `git diff --check` | PASS |

Full repository tests were not required for this documentation-only pass.
