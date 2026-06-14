# GOD EYES Documentation Map

> **Agent:** Documentation Agent
> **Lane:** Documentation
> **Last updated:** 2026-06-14

This file explains which documents are **active rules**, which are **current state**,
which are **audits / evidence**, which are **specs** (planned feature/refactor work),
which are **decisions**, and which are **archive**. It is the entry point for both
humans and agents navigating the documentation tree.

If you read only one document under `docs/`, read this one. It tells you where to read
next.

---

## 1. Human First-Read

If you are a human contributor joining the project, read these in order:

1. `docs/README.md` — this file (the documentation map)
2. `docs/state/CURRENT_PROJECT_STATE.md` — current phase, implemented layers, next steps
3. `docs/control/ENGINEERING_STRUCTURE_RULES.md` — the master engineering rulebook
4. `docs/control/MVP_LAYER_REGISTRY.md` — authoritative layer IDs, order, status

---

## 2. Agent First-Read

If you are an agent (worker or orchestrator) starting a task, read these in order:

1. `AGENTS.md` — entry point: roles, layer registry, hard rules, workflow, git rules
2. `docs/control/ENGINEERING_STRUCTURE_RULES.md` — file/folder/DB/API structure rules
3. `docs/state/CURRENT_PROJECT_STATE.md` — what phase we are in, what is implemented
4. `docs/state/HANDOFF_LOG.md` — what was done last and what state the project is in
5. The task-specific spec or work order referenced by the work order
6. `docs/control/MVP_LAYER_REGISTRY.md` — layer IDs and statuses for the work scope

---

## 3. Reviewer First-Read

If you are reviewing a pull request or a branch:

1. `AGENTS.md` — roles, hard rules, workflow, git rules
2. `docs/control/ENGINEERING_STRUCTURE_RULES.md` — what the change should conform to
3. The changed files (the diff itself)
4. The related spec / plan / tasks document
5. `docs/state/HANDOFF_LOG.md` — what the agent reported

---

## 4. Directory Meaning

| Directory | Type | Purpose | Who reads it | Can agents edit it? | Notes |
|---|---|---|---|---|---|
| `docs/control/` | ACTIVE_RULE | Active permanent rules and control documents | All agents and humans | Only Orchestrator Agent (read-only for others) | Authoritative instructions. Do not modify without a change request. |
| `docs/state/` | CURRENT_STATE / APPEND_ONLY_LOG | Current project state and append-only timeline | All agents and humans | Orchestrator Agent owns state doc; **all agents may append** to `HANDOFF_LOG.md` | `CURRENT_PROJECT_STATE.md` is rewritten to reflect the current state. `HANDOFF_LOG.md` is append-only. |
| `docs/audits/` | AUDIT_REPORT | Research and audit evidence | All agents and humans | Only Research / Documentation Agent, and only as new audit reports | Audits are evidence, not active control rules, unless a control doc explicitly adopts something from them. |
| `docs/decisions/` | DECISION_RECORD | Architecture Decision Records (ADRs) | All agents and humans | Only Orchestrator Agent (and Documentation Agent) | New ADRs are added; existing ADRs are not rewritten. |
| `docs/archive/` | ARCHIVE | Old, superseded, duplicate, or historical documents | All agents and humans | Only Documentation Agent, and only through a dedicated cleanup task | Archived docs are historical and not active instructions. Nothing is archived automatically. |
| `docs/work-orders/` | WORK_ORDER | Work orders for small cross-cutting repairs and single-lane fixes | Workers and Orchestrator | Only Orchestrator Agent (read-only for workers) | The historical WO-001 through WO-079A work-order pattern. |
| `docs/devlog/` | DEV_LOG | Engineering/devlog notes | All agents and humans | Only authors of each entry | Historical and reference material. |
| `docs/api/` | API_REFERENCE | API reference material | All agents and humans | Read-only for most agents | Reference material. |
| `docs/postman/` | API_COLLECTION | Postman collection assets | All agents and humans | Read-only for most agents | API test/exploration collections. |
| `docs/reports/` | REPORT | Generated reports | All agents and humans | Only report authors | Generated or periodic reports. |
| `docs/data/` | DATA_REFERENCE | Data pipeline and contract reference | All agents and humans | Read-only for most agents | Reference material. |
| `specs/` | SPEC_WORKSPACE | Spec Kit feature/refactor work packages | Orchestrator, Planning Agent, worker agents, Reviewer | Orchestrator Agent creates spec dirs; worker agents edit their scope within the spec | Each spec dir is the source of truth for that feature. |
| `AGENTS.md` | ENTRY_POINT | Multi-agent roles, hard rules, workflow, git rules | All agents and humans | Only Orchestrator Agent | Entry point for all work. |
| `apps/`, `packages/`, `services/`, `database/`, `tests/` | CODE | Application code (out of scope of this document) | Owning agents | Owning agents per `LLM_OWNERSHIP_MATRIX.md` | Subject to `ENGINEERING_STRUCTURE_RULES.md`. |

---

## 5. Document Classification

Every document under `docs/` and `specs/` falls into exactly one classification. The
classification determines how it is read, edited, and superseded.

| Classification | Meaning | Read by | Edit rule | Example files |
|---|---|---|---|---|
| **ACTIVE_RULE** | Authoritative, current rules. Agents must follow these. | All agents and humans | Only Orchestrator Agent may modify. Changes follow the rule's own change process. | `docs/control/ENGINEERING_STRUCTURE_RULES.md`, `docs/control/MVP_LAYER_REGISTRY.md`, `docs/control/LLM_OWNERSHIP_MATRIX.md`, `docs/control/PIPELINE_HANDOFF_RULES.md`, `docs/control/DATA_LOCATION_RULES.md`, `docs/control/SOURCE_TO_FRONTEND_CONTRACT.md` |
| **CURRENT_STATE** | A snapshot of the current project state. May be rewritten in place. | All agents and humans | Only Orchestrator Agent may rewrite. | `docs/state/CURRENT_PROJECT_STATE.md` |
| **APPEND_ONLY_LOG** | A timeline that must only be appended to, never rewritten. | All agents and humans | All agents may append. Do not prepend, do not rewrite older entries. | `docs/state/HANDOFF_LOG.md` |
| **AUDIT_REPORT** | Research and audit evidence. Findings, severity, recommendations. | All agents and humans | Only Research / Documentation Agent may add a new audit report. Existing audits are not rewritten; corrections go in a new audit or a handoff log note. | `docs/audits/PROJECT_HEALTH_WORKFLOW_AUDIT.md`, `docs/audits/PROJECT_HEALTH_FINDINGS_EXPLAINED.md`, `docs/audits/ENGINEERING_STRUCTURE_COMPLIANCE_AUDIT.md` |
| **DECISION_RECORD** | Architecture Decision Record. Captures context, decision, consequences. | All agents and humans | New ADRs may be added. Existing ADRs are not rewritten; superseding decisions are a new ADR. | `docs/decisions/ADR-001-documentation-system.md` |
| **SPEC_WORKSPACE** | A folder containing a single Spec Kit feature/refactor work package. | Orchestrator, Planning Agent, worker agents, Reviewer | Orchestrator Agent creates the spec folder. Worker agents edit their lane's content within the spec's `plan.md` / `tasks.md` / `contracts/`. | `specs/001-layer-zero-globe-core/`, `specs/002-layer-one-aviation/`, `specs/003-layer-05-space-satellites-mvp/`, `specs/004-layer-10-energy-infrastructure-mvp/`, `specs/005-layer-06-maritime-mvp/`, `specs/006-layer-07-weather-mvp/`, `specs/007-layer-08-news-osint-mvp/` |
| **SPEC** | A `spec.md` file inside a Spec Kit spec folder. Describes the what and why of the work. | All agents | Worker agents and Orchestrator Agent may update during the spec lifecycle. | `specs/<NNN>-<feature>/spec.md` |
| **PLAN** | A `plan.md` file inside a Spec Kit spec folder. Describes the selected technical approach. | All agents | Worker agents and Orchestrator Agent may update. | `specs/<NNN>-<feature>/plan.md` |
| **TASK_LIST** | A `tasks.md` file inside a Spec Kit spec folder. Ordered implementation tasks. | All agents | Worker agents and Orchestrator Agent may update. Implementation agents must follow `tasks.md` and must not invent scope. | `specs/<NNN>-<feature>/tasks.md` |
| **REVIEW_REPORT** | An integration review record per work order or per spec. | All agents | Orchestrator / Reviewer Agent writes the review. | `docs/state/INTEGRATION_REVIEW_*.md`, `specs/<NNN>-<feature>/review.md` |
| **ARCHIVE** | A historical or superseded document. Not active instructions. | Optional, for context only | Only Documentation Agent may add, and only through a dedicated cleanup task. | `docs/archive/**` |

---

## 6. Rules

The following rules apply to the entire documentation system:

- **Active rules live in `docs/control/`.** Authoritative instructions belong here.
- **Current state lives in `docs/state/`.** `CURRENT_PROJECT_STATE.md` is a snapshot
  that may be rewritten; `HANDOFF_LOG.md` is append-only.
- **Audits live in `docs/audits/`.** They are evidence, not active instructions.
- **Feature/refactor specs live in `specs/`.** Each medium or large feature or refactor
  gets a dedicated spec folder under `specs/`. Implementation agents must follow
  `tasks.md` and must not invent scope.
- **Architecture decisions live in `docs/decisions/`** as ADRs. Use ADRs for important
  project-wide decisions such as documentation hierarchy, API architecture, database
  strategy, deployment strategy, or large refactor strategy.
- **Old/superseded docs go to `docs/archive/`** by dedicated cleanup only. Nothing is
  archived automatically.
- **Do not treat audit reports as active instructions** unless a control document
  explicitly adopts something from them.
- **Do not move or archive docs during feature work.** Archiving is a dedicated
  documentation cleanup task on its own branch.
- **Do not create random docs outside the defined folders.** Every new document must
  belong to a documented directory and classification.
- **PR and merge rules live in `docs/control/GIT_WORKFLOW_POLICY.md`.** Agents do not
  push, open PRs, merge, or delete branches; the user handles all of those after the
  Reviewer Agent decision is PASS. Do not create a PR for every small local
  correction.

---

## 7. Related Documents

- `AGENTS.md` — multi-agent control and entry point
- `docs/control/ENGINEERING_STRUCTURE_RULES.md` — master engineering rulebook
- `docs/state/CURRENT_PROJECT_STATE.md` — current phase and status
- `docs/state/HANDOFF_LOG.md` — append-only agent handoff timeline
- `docs/decisions/ADR-001-documentation-system.md` — this documentation system as an ADR
- `docs/archive/README.md` — archive rules
- `specs/README.md` — Spec Kit workspace guide
