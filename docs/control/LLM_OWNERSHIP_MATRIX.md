# Agent Ownership Matrix

Neutral role names only: Orchestrator Agent, Frontend Agent, API Agent, Fetcher Agent,
Normalizer Agent, Database Agent, Review Agent, Integration Agent, Contract Agent.

## File Ownership

| Path Pattern | Owner | Others May |
|---|---|---|
| `AGENTS.md` | Orchestrator Agent | Read only |
| `specs/` | Orchestrator Agent | Read only |
| `docs/control/` | Orchestrator Agent | Read only |
| `docs/work-orders/` | Orchestrator Agent | Read only |
| `docs/state/CURRENT_PROJECT_STATE.md` | Orchestrator Agent | Read only |
| `docs/state/HANDOFF_LOG.md` | All | Append only |
| `apps/web/` | Frontend Agent | — |
| `packages/ui/` | Frontend Agent | — |
| `packages/layers/` | Frontend Agent | — |
| `services/fetch-orchestrator/` | Fetcher Agent | Colocated normalizer modules under `src/layers/<layer_id>/` (see Normalizer Location Rule below) |
| `packages/source-catalog/` | Fetcher Agent | — |
| `services/normalizer/` | Normalizer Agent | Owns the canonical aviation normalizer folder only; non-aviation layers follow the Colocated Normalizer Pattern below |
| `database/` | Database Agent | — |
| `packages/schemas/` | Database Agent | — |
| `tests/data/` | Database Agent | — |
| `apps/api/` | API Agent | — |
| `packages/contracts/` | API Agent | — |
| `packages/auth/` | API Agent | — |
| `tests/api/` | API Agent | — |
| `.env.example` | API Agent | Read only |

## Git Rules

- Worker agents (Frontend, API, Fetcher, Normalizer, Database) may create local commits only.
- Worker agents must NOT push to remote.
- The Orchestrator Agent owns all pushes to remote after review.
- The Orchestrator Agent must never push directly to main unless explicitly approved.
- All commits must follow format: `<type>(<area>): <description>`.
- All commits must include: Agent (role), Work Order, Summary, Commands, Known Issues,
  Forbidden Folders, Secrets added.
- See `docs/control/GIT_WORKFLOW_POLICY.md` for the full Git workflow.
- Do not record model, provider, assistant, or tool product names anywhere.

## Rules

- An agent must not modify files outside its ownership.
- If an agent needs a change in another agent's area, it logs a request in `HANDOFF_LOG.md`.
- The Orchestrator Agent resolves cross-agent conflicts.

## Normalizer Location Rule (HEALTH-004)

The `services/normalizer/` folder is the historical/canonical location for
normalizer code. For Layer 01 Aviation, normalizer modules live under
`services/normalizer/src/layers/layer_01_aviation/` and are owned by the
Normalizer Agent. This aviation arrangement is preserved as-is.

For all non-aviation implemented layers, the existing implementation colocates
the normalizer with the fetcher under
`services/fetch-orchestrator/src/layers/<layer_id>/`. In that colocated
pattern, the **Fetcher Agent** owns the normalizer module for the layer, and
the **Normalizer Agent** has no ownership entry for that layer.

The colocated pattern is acceptable for live-layer MVP work when fetch,
normalize, and proof/seed logic are tightly coupled in a single Python module
family. The current non-aviation layers (02, 03, 05, 06, 07, 08, 10) follow
this pattern.

Future large or reusable normalizers may still be split into
`services/normalizer/src/layers/<layer_id>/` by explicit work order issued
by the Orchestrator Agent; in that case ownership reverts to the Normalizer
Agent for that layer.

**Agent directive:** follow the source/contract/work-order instructions for the
specific layer. Do not invent a new normalizer location. Do not move existing
normalizers in a documentation-only or refactor task. If the existing layer
colocates, follow the colocated pattern; if a future work order specifies a
separated normalizer, follow that explicit work order.

## Shared Read Access

All agents may read:
- `AGENTS.md`
- `docs/control/*`
- `docs/state/*`
- `specs/*`
- `packages/contracts/*` (Frontend and data agents read; API Agent writes)
- `.env.example`
