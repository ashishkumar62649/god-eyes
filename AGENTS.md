# AGENTS.md — GOD EYES Multi-Agent Control

Classification: ENTRY_POINT
Last updated: 2026-06-16

This is the agent entry point. It defines the neutral agent roles, the reading policy,
the cycle, and pointers to the single active control file. All detailed engineering
rules, layer registry, ownership matrix, source contract, Git workflow, naming rules,
size limits, and work-order template live in `docs/control/PROJECT_CONTROL.md`.
Archived documents never override the active control file.

---

## Hard Rules

0. Every agent must read `AGENTS.md` before starting any work. This file is the entry
   point for agent behavior, folder ownership, documentation structure, workflow rules,
   safety rules, and final report requirements.
1. Everything must belong to a registered layer (`layer_id`). All layer IDs, statuses,
   and order are owned by `docs/control/PROJECT_CONTROL.md` Part 2 §4. If any document
   or code disagrees with that registry, pause new layer work until the drift is fixed.
2. Safety, import boundaries, ownership, secrets, and forbidden actions are defined in
   `docs/control/PROJECT_CONTROL.md` Part 1 §3, Part 2 §8, and Part 2 §15. Agents must
   follow those sections; do not duplicate them here.
3. After completing work, every agent must update **both** `docs/state/HANDOFF_LOG.md`
   (full entry) and `docs/state/RECENT_CONTEXT.md` (short summary) in the same commit.
   `HANDOFF_LOG.md` is append-only. `RECENT_CONTEXT.md` holds only the last 5 entries —
   when adding a 6th, remove the oldest from `RECENT_CONTEXT.md` only.

---

## Agents (Neutral Roles)

No model, provider, or assistant product names are used anywhere in active control
documents. Use the neutral role names below. Tooling may be named only when the
workflow requires a specific local project tool, such as Graphify.

| Agent | Role | Owns |
|-------|------|------|
| Orchestrator Agent | Spec manager, work-order creator, integration reviewer, layer consistency checker, coordination | `specs/`, `docs/control/`, `docs/work-orders/`, `docs/state/CURRENT_PROJECT_STATE.md` |
| Frontend Agent | Globe Core frontend and all visual layer rendering | `apps/web/`, `packages/ui/`, `packages/layers/` |
| Fetcher Agent | Source fetchers and source catalog | `services/fetch-orchestrator/`, `packages/source-catalog/` |
| Normalizer Agent | Raw-to-normalized transformation (aviation only) | `services/normalizer/` |
| Database Agent | Schema, migrations, ingestion, data tests | `database/`, `packages/schemas/`, `tests/data/` |
| API Agent | API gateway, env validation, API contracts, backend integration | `apps/api/`, `packages/contracts/`, `packages/auth/`, `tests/api/` |

Full ownership matrix (with shared read access and "Others may" rules) lives in
`docs/control/PROJECT_CONTROL.md` Part 2 §8.

---

## Agent Reading Policy

### Always read (every agent, every session)

1. `AGENTS.md` — this file
2. `docs/control/PROJECT_CONTROL.md` — single active project control file
3. `docs/state/CURRENT_PROJECT_STATE.md` — current phase and implemented layers
4. `docs/state/RECENT_CONTEXT.md` — last 3–5 session summaries
5. The task-specific spec or work order for the current task

### Task-specific read (load only when relevant)

- Active spec files for the current feature (e.g. `specs/008-structure-remediation-roadmap/`)
- `docs/decisions/ADR-*.md` — when making an architectural decision in the relevant area
- When a codebase, documentation, or project-content question needs relationship context,
  and `graphify-out/graph.json` exists, use Graphify (`graphify query`, `graphify path`,
  or `graphify explain`) before broad manual searching. Skip it for tiny exact-file edits.

### Search-only (do not load full file into context)

- `docs/state/HANDOFF_LOG.md` — search for specific session or work order history only
- `docs/audits/**` — search when investigating a specific health finding
- `docs/README.md` — read when onboarding or when the doc structure itself is in question
- Historical specs (`specs/001–007/**`) — search only if an original layer spec is needed

### Never read unless explicitly instructed

- `docs/archive/**` — historical only; not active instructions; cannot override active
  control docs

---

## Agent-Specific Reminders

- The Frontend Agent must not invent fields. It must consume contracts from `packages/contracts/`.
- The Database Agent must create layer-aware tables with `layer_id` / `source_id` / `source_object_id`.
- The API Agent must create API contracts that match the database schemas and frontend needs.
- Worker agents create local commits only. They must not push to remote.

---

## Layer Order and Scope

`docs/control/PROJECT_CONTROL.md` Part 2 §4 is the single source of truth for layer
IDs, names, statuses, and order. Key facts agents must remember:

- `layer_07_weather` is the canonical Layer 07. There is no `layer_07_infrastructure`.
- Space uses `layer_05_space_satellites`. Energy uses `layer_10_energy_infrastructure`.
- `layer_04_public_military_security` and `layer_09_user_shapes` are `coming_soon` —
  not yet implemented. New layers beyond the current registry are not in scope.

---

## Workflow

Build → Review/Test → Push → Next. Full Git rules, branch naming, commit message
format, pre-push verification, and PR/merge policy are in
`docs/control/PROJECT_CONTROL.md` Part 3.

### Where future work goes

| Scope | Location |
|-------|----------|
| New layer or large multi-agent feature | `specs/<NNN>-<feature-or-layer-name>/` |
| Small cross-cutting repair or single-lane fix | `docs/work-orders/WO-NNN-...md` (create the folder only when an active work order exists) |
| Research or audit evidence | `docs/audits/` |
| Review or integration record (active) | `docs/state/INTEGRATION_REVIEW_[WO].md` (archived under `docs/archive/` after completion) |
| Architecture decision | `docs/decisions/ADR-NNN-...md` |
| Active project state | `docs/state/CURRENT_PROJECT_STATE.md` |
| Historical / superseded docs | `docs/archive/<date-topic>/` |

### Cycle

1. The Orchestrator Agent creates a spec directory under `specs/` for new layers or
   large features, OR a work order under `docs/work-orders/` for small fixes.
2. The responsible worker agent picks up its work order.
3. The agent does the work within its allowed folders only.
4. The agent runs the required build/test checks.
5. The agent creates one local commit with the proper message format
   (see `docs/control/PROJECT_CONTROL.md` Part 3).
6. The agent updates `docs/state/HANDOFF_LOG.md` (full entry) and
   `docs/state/RECENT_CONTEXT.md` (short summary).
7. The Orchestrator Agent reviews and creates `docs/state/INTEGRATION_REVIEW_[WO].md`.
8. If PASS: the user pushes the branch to origin and opens a single PR for the
   completed work package. Agents do not push, open PRs, merge, or delete branches.
9. If FAIL / NEEDS REVIEW: the Orchestrator Agent documents issues; the agent revises
   on the same branch.

---

## Git Workflow (summary)

See `docs/control/PROJECT_CONTROL.md` Part 3 for the complete policy. Key rules:

- Worker agents may create local commits only. They must not push to remote.
- The Orchestrator Agent owns all pushes to remote after review, and must never push
  directly to `main` unless the user explicitly approves.
- Branch name: `<role>/<work-order>/<short-name>` (e.g. `frontend/wo-001/layer-00-globe-core`).
- Commit message must include: Agent (neutral role), Work Order, Branch, Summary,
  Commands, Known Issues, Forbidden Folders touched, Secrets added.
- One PR per completed work package, opened by the user, not by an agent.

---

## Key Documents

- `docs/README.md` — documentation map (start here; lists active rules, current state,
  audits, decisions, archive, and specs)
- `docs/control/PROJECT_CONTROL.md` — single active project control file: engineering
  rules, layer registry, ownership, source/data contract, Git workflow, work-order
  template, naming rules, file/function size limits, validation, refactor boundaries
- `docs/state/CURRENT_PROJECT_STATE.md` — current phase and status
- `docs/state/RECENT_CONTEXT.md` — short rolling summary of the last 3–5 work sessions
- `docs/state/HANDOFF_LOG.md` — full append-only log of all agent work (search-only)
- `specs/README.md` — Spec Kit workspace guide
- `docs/decisions/ADR-*.md` — Architecture Decision Records
- `docs/archive/` — historical/superseded documents (not active instructions)
- `docs/work-orders/` — active work orders for small cross-cutting repairs (create
  the folder only when an active work order exists)
- `docs/audits/` — research and audit evidence
