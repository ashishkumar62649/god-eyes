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
| `services/fetch-orchestrator/` | Fetcher Agent | — |
| `packages/source-catalog/` | Fetcher Agent | — |
| `services/normalizer/` | Normalizer Agent | — |
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

## Shared Read Access

All agents may read:
- `AGENTS.md`
- `docs/control/*`
- `docs/state/*`
- `specs/*`
- `packages/contracts/*` (Frontend and data agents read; API Agent writes)
- `.env.example`
