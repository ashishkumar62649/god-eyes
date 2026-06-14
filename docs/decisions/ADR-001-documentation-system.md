# ADR-001 — Documentation System

> **Title:** Documentation system and Spec Kit workspace alignment
> **Status:** Accepted
> **Date:** 2026-06-14
> **Author:** Documentation Agent
> **Supersedes:** — (none)
> **Superseded by:** — (none)

---

## Context

The GOD EYES repository has accumulated documentation across `docs/control/`,
`docs/state/`, `docs/audits/`, `docs/work-orders/`, `docs/devlog/`, `docs/api/`,
`docs/postman/`, `docs/reports/`, `docs/data/`, and the historical `specs/<NNN>-<feature>/`
folders. The classification of these documents and the rules for adding or moving them
were not documented in one place. Agents and new contributors had to infer the structure
from examples and from the most recent handoffs.

Two structural issues had grown over time:

1. There was no single document that defined the purpose of each `docs/` subfolder,
   the classification of each kind of document, and the read/edit rules for each.
2. The Spec Kit spec folders under `specs/` were created and used in practice, but
   there was no `specs/README.md` documenting the folder pattern, the role of
   `spec.md` / `research.md` / `plan.md` / `tasks.md` / `contracts/` / `quickstart.md`,
   or the rules for implementation and reviewer agents.

The Orchestrator Agent requested a documentation-only task to align the existing
documentation system with the project's Spec Kit workflow, without moving or renaming
existing documents.

## Decision

The project adopts the following documentation structure and rules:

### Document categories

- The project uses `docs/control/` for **active rules**. These are authoritative
  instructions that all agents must follow. Examples:
  - `docs/control/ENGINEERING_STRUCTURE_RULES.md`
  - `docs/control/MVP_LAYER_REGISTRY.md`
  - `docs/control/LLM_OWNERSHIP_MATRIX.md`
  - `docs/control/PIPELINE_HANDOFF_RULES.md`
  - `docs/control/DATA_LOCATION_RULES.md`
  - `docs/control/SOURCE_TO_FRONTEND_CONTRACT.md`

- The project uses `docs/state/` for **current state and timeline**. Two
  classifications:
  - `docs/state/CURRENT_PROJECT_STATE.md` — `CURRENT_STATE`, a snapshot that may be
    rewritten in place to reflect the current phase.
  - `docs/state/HANDOFF_LOG.md` — `APPEND_ONLY_LOG`, an append-only agent handoff
    timeline. Append at the bottom. Do not prepend. Do not rewrite older entries.

- The project uses `docs/audits/` for **evidence reports**. These are `AUDIT_REPORT`
  documents: research and audit findings, severity, recommendations. Audits are
  evidence, not active control rules, unless a control document explicitly adopts
  something from them.

- The project uses `specs/` for **feature/refactor specs and plans**. The
  classification is `SPEC_WORKSPACE`. Each spec folder is the source of truth for
  that feature or refactor. See `specs/README.md` for the folder pattern.

- The project uses `docs/decisions/` for **architecture decisions**, captured as
  `DECISION_RECORD` documents (ADRs). Use ADRs for important project-wide decisions
  such as documentation hierarchy, API architecture, database strategy, deployment
  strategy, or large refactor strategy.

- The project uses `docs/archive/` for **superseded documents**, captured as
  `ARCHIVE` documents. Nothing is archived automatically. Archive moves require a
  dedicated documentation cleanup branch and task.

### Spec Kit usage rule

- Medium or large feature work and refactor work should use a dedicated folder
  under `specs/`. The recommended pattern is
  `specs/<NNN>-<feature-or-layer-name>/` containing, as needed:
  - `spec.md` — what and why
  - `research.md` — evidence and options
  - `plan.md` — selected technical approach
  - `tasks.md` — ordered implementation tasks
  - `contracts/` — API/data contracts if relevant
  - `quickstart.md` — validation/run instructions if relevant

- Implementation agents must follow `tasks.md` and must not invent scope.
- Reviewer agents must review against `spec.md`, `plan.md`, and `tasks.md`.

### Reader guidance

- `docs/README.md` is the documentation map and the entry point for all readers
  (humans, agents, reviewers).
- `specs/README.md` is the Spec Kit workspace guide.

### Edit rules

- Active rules (`ACTIVE_RULE`) are modified only by the Orchestrator Agent, through
  the change process documented in the rule itself.
- Current state (`CURRENT_STATE`) is rewritten only by the Orchestrator Agent.
- The handoff log (`APPEND_ONLY_LOG`) is appended to by any agent.
- Audit reports (`AUDIT_REPORT`) are added by the Research / Documentation Agent;
  existing reports are not rewritten.
- ADRs (`DECISION_RECORD`) are added; existing ADRs are not rewritten; superseding
  decisions are a new ADR.
- Spec workspace content (`SPEC`, `PLAN`, `TASK_LIST`, `REVIEW_REPORT`) is updated by
  the worker agents and Orchestrator Agent within the spec's lifecycle.
- Archive (`ARCHIVE`) is added only by the Documentation Agent, and only through a
  dedicated cleanup task.

### What this ADR does not change

- No existing docs are moved, renamed, or archived in this task. This ADR defines the
  structure and rules going forward. A future dedicated documentation cleanup task may
  move old or duplicate docs into `docs/archive/` if appropriate.
- No application code, frontend code, API code, database migration, fetcher/normalizer
  code, or test code is modified by this ADR.
- No new technologies, products, or services are introduced.

## Consequences

Positive consequences:

- A single `docs/README.md` map tells humans, agents, and reviewers exactly where to
  start and how each document is classified.
- The Spec Kit workspace has an explicit `specs/README.md` guide, so the
  `spec.md` / `plan.md` / `tasks.md` pattern is now documented and consistent.
- Audit reports are no longer accidentally treated as active instructions.
- Archive has a clear "do not touch during feature work" rule.

Negative consequences and trade-offs:

- There is now one more document to read at project start (`docs/README.md`).
  This is offset by the fact that the document shortens agent first-read by
  consolidating the documentation map in one place.
- The classification system adds a small amount of ceremony for new documents.
  This is offset by clearer ownership and a lower risk of misplaced or
  accidentally-repurposed files.

## What this does not do

- This ADR does not move or rename any existing document.
- This ADR does not archive any existing document.
- This ADR does not modify any control document. The `AGENTS.md` and
  `ENGINEERING_STRUCTURE_RULES.md` documents receive a short pointer to the new map,
  not a rewrite.
- This ADR does not introduce a new Spec Kit product, tool, or service. It documents
  the folder pattern that the project already uses (`specs/001-*` through
  `specs/007-*` exist in the current tree).

## Future work

- A dedicated documentation cleanup task may move historical or duplicate
  documents to `docs/archive/`. That task must be planned in its own work order
  and reviewed by the Orchestrator Agent.
- Additional ADRs may be added in `docs/decisions/` for other project-wide
  decisions (API architecture, database strategy, deployment strategy, large
  refactor strategy).
- The `docs/README.md` map may be extended with a section listing each existing
  document and its classification, if the project grows enough that the directory
  meaning table alone is insufficient.
