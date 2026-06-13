# AGENTS.md — GOD EYES Multi-LLM Control

## Agents

| Agent | Role | Owns |
|-------|------|------|
| Kiro CLI | Orchestrator, spec manager, work-order creator, integration reviewer, layer consistency checker | Specs, control docs, work orders, reviews |
| Gemini CLI | Frontend owner. Owns Layer 0 Globe Core frontend and all visual layer rendering. | `apps/web/`, `packages/ui/`, `packages/layers/` |
| Codex | Data pipeline and database owner. Owns source catalog, raw storage, fetchers, validators, normalizers, DB migrations, data tests. | `services/fetch-orchestrator/`, `services/normalizer/`, `packages/source-catalog/`, `packages/schemas/`, `database/`, `tests/data/` |
| Claude Code CLI | API Gateway, auth scaffold, env validation, API contracts, backend integration. | `apps/api/`, `packages/contracts/`, `packages/auth/`, `tests/api/` |

## Hard Rules

1. Everything must belong to a layer.
2. Every layer must have a unique `layer_id`.
3. Every source must declare which layer it belongs to.
4. Frontend folders must be organized by layer.
5. API routes must expose layer-aware endpoints.
6. Database tables must include `layer_id` where useful.
7. Raw storage paths must include `layer_id` and `source_id`.
8. Normalizers must read raw object metadata, not random files.
9. Frontend never connects directly to database.
10. API talks to database.
11. Fetchers store raw data before normalization.
12. Real API keys must never be committed.
13. Secrets must only appear as placeholders in `.env.example`.
14. Every LLM must update `docs/state/HANDOFF_LOG.md` after work with model and time metadata.
15. Every handoff entry must include: Work order, Agent, LLM model, Tool/CLI used, Branch, Start time UTC, End time UTC, Commit hash, Push status, Files changed, Commands run, Review status if applicable.

## Agent-Specific Rules

- **Gemini** must not invent fields. It must consume contracts from `packages/contracts/`.
- **Codex** must create database schema using layer-aware tables with `layer_id`/`source_id`/`source_object_id`.
- **Claude** must create API contracts that match Codex schemas and Gemini frontend needs.

## Layer Order

`docs/control/MVP_LAYER_REGISTRY.md` is the authoritative source of truth for layer IDs, layer order, and layer status. If any document or code disagrees with that registry, pause new layer work until the registry drift is fixed.

| Layer ID | Name |
|----------|------|
| `layer_00_globe_core` | Globe Core |
| `layer_01_aviation` | Aviation |
| `layer_02_borders_boundaries` | Borders & Boundaries |
| `layer_03_earth_events` | Earth Events |
| `layer_04_public_military_security` | Public Military & Security |
| `layer_05_space_satellites` | Space & Satellites |
| `layer_06_maritime` | Maritime |
| `layer_07_weather` | Weather / Live Weather |
| `layer_08_news_osint` | News & OSINT |
| `layer_09_user_shapes` | User Shapes / Custom Overlays |

## Not In Scope Yet

New layers beyond the current MVP implementation are not in scope until guardrails and layer numbering are consistent. Space must use `layer_05_space_satellites` unless the authoritative registry is intentionally changed in a future work order.

## Workflow

1. Kiro creates work orders in `docs/work-orders/`.
2. Agent picks up its work order.
3. Agent does the work within its allowed folders only.
4. Agent creates one local commit with proper message format.
5. Agent updates `docs/state/HANDOFF_LOG.md`.
6. Kiro reviews and creates `docs/state/INTEGRATION_REVIEW_[WO].md`.
7. If PASS: Kiro pushes branch to origin.
8. If FAIL/NEEDS REVIEW: Kiro documents issues; agent revises.

## Git Workflow

See `docs/control/GIT_WORKFLOW_POLICY.md` for complete Git rules.

**Key Rules:**
- Worker agents (Gemini, Codex, Claude) may create local commits only.
- Worker agents must NOT push to remote.
- Kiro CLI owns all pushes to remote after review.
- Kiro must never push directly to main unless explicitly approved.
- All commits must follow format: `<type>(<area>): <description>`
- All commits must include: Agent, Work Order, LLM model, Tool/CLI used, Branch, Start time UTC, End time UTC, Summary, Commands, Known Issues, Forbidden Folders fields.
- Every HANDOFF_LOG.md entry must include model and time metadata (UTC required).

## Key Documents

- `docs/control/GIT_WORKFLOW_POLICY.md` — Git commit and push rules
- `docs/control/MVP_LAYER_REGISTRY.md` — authoritative layer registry and order
- `docs/control/LAYER_ARCHITECTURE.md` — layer definitions and order
- `docs/control/LAYER_ID_CONVENTIONS.md` — naming and folder conventions
- `docs/control/LLM_OWNERSHIP_MATRIX.md` — who owns what
- `docs/control/PIPELINE_HANDOFF_RULES.md` — how data flows between agents
- `docs/control/DATA_LOCATION_RULES.md` — where files go
- `docs/control/SOURCE_TO_FRONTEND_CONTRACT.md` — full source contract
- `docs/state/CURRENT_PROJECT_STATE.md` — current phase and status
- `docs/state/HANDOFF_LOG.md` — log of all agent work
- `docs/work-orders/` — active work orders
