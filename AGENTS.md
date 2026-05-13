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
14. Every LLM must update `docs/state/HANDOFF_LOG.md` after work.

## Agent-Specific Rules

- **Gemini** must not invent fields. It must consume contracts from `packages/contracts/`.
- **Codex** must create database schema using layer-aware tables with `layer_id`/`source_id`/`source_object_id`.
- **Claude** must create API contracts that match Codex schemas and Gemini frontend needs.

## Layer Order (MVP starts with 0 and 1)

| Layer ID | Name | Status |
|----------|------|--------|
| `layer_00_globe_core` | Globe Core | Next |
| `layer_01_aviation` | Aviation | Next |
| `layer_02_satellite` | Satellite | Future |
| `layer_03_maritime` | Maritime | Future |
| `layer_04_weather_disasters` | Weather/Disasters | Future |
| `layer_05_cyber_infrastructure` | Cyber/Infrastructure | Future |
| `layer_06_ai_intelligence` | AI Intelligence | Future |

## Not In Scope Yet

Satellite, maritime, weather, cyber, AI intelligence layers.

## Workflow

1. Kiro creates work orders in `docs/work-orders/`.
2. Agent picks up its work order.
3. Agent does the work within its allowed folders only.
4. Agent updates `docs/state/HANDOFF_LOG.md`.
5. Kiro reviews and updates `docs/state/CURRENT_PROJECT_STATE.md`.

## Key Documents

- `docs/control/LAYER_ARCHITECTURE.md` — layer definitions and order
- `docs/control/LAYER_ID_CONVENTIONS.md` — naming and folder conventions
- `docs/control/LLM_OWNERSHIP_MATRIX.md` — who owns what
- `docs/control/PIPELINE_HANDOFF_RULES.md` — how data flows between agents
- `docs/control/DATA_LOCATION_RULES.md` — where files go
- `docs/control/SOURCE_TO_FRONTEND_CONTRACT.md` — full source contract
- `docs/state/CURRENT_PROJECT_STATE.md` — current phase and status
- `docs/state/HANDOFF_LOG.md` — log of all agent work
- `docs/work-orders/` — active work orders
