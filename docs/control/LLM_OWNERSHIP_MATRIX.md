# LLM Ownership Matrix

## File Ownership

| Path Pattern | Owner | Others May |
|---|---|---|
| `AGENTS.md` | Kiro | Read only |
| `specs/` | Kiro | Read only |
| `docs/control/` | Kiro | Read only |
| `docs/work-orders/` | Kiro | Read only |
| `docs/state/CURRENT_PROJECT_STATE.md` | Kiro | Read only |
| `docs/state/HANDOFF_LOG.md` | All | Append only |
| `apps/web/` | Gemini | — |
| `packages/ui/` | Gemini | — |
| `packages/layers/` | Gemini | — |
| `services/fetch-orchestrator/` | Codex | — |
| `services/normalizer/` | Codex | — |
| `packages/source-catalog/` | Codex | — |
| `packages/schemas/` | Codex | — |
| `database/` | Codex | — |
| `tests/data/` | Codex | — |
| `apps/api/` | Claude Code | — |
| `packages/contracts/` | Claude Code | — |
| `packages/auth/` | Claude Code | — |
| `tests/api/` | Claude Code | — |
| `.env.example` | Claude Code | Read only |

## Rules

- An agent must not modify files outside its ownership.
- If an agent needs a change in another agent's area, it logs a request in `HANDOFF_LOG.md`.
- Kiro resolves cross-agent conflicts.

## Shared Read Access

All agents may read:
- `AGENTS.md`
- `docs/control/*`
- `docs/state/*`
- `specs/*`
- `packages/contracts/*` (Gemini and Codex read; Claude Code writes)
- `.env.example`
