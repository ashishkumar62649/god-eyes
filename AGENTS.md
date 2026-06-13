# AGENTS.md — GOD EYES Multi-Agent Control

## Agents (Neutral Roles)

| Agent | Role | Owns |
|-------|------|------|
| Orchestrator Agent | Spec manager, work-order creator, integration reviewer, layer consistency checker, coordination | Specs, control docs, work orders, reviews, state docs |
| Frontend Agent | Frontend owner. Owns Globe Core frontend and all visual layer rendering. | `apps/web/`, `packages/ui/`, `packages/layers/` |
| Fetcher Agent | Source fetchers and source catalog. | `services/fetch-orchestrator/`, `packages/source-catalog/` |
| Normalizer Agent | Raw-to-normalized transformation. | `services/normalizer/` |
| Database Agent | Schema, migrations, ingestion, data tests. | `database/`, `packages/schemas/`, `tests/data/` |
| API Agent | API gateway, env validation, API contracts, backend integration. | `apps/api/`, `packages/contracts/`, `packages/auth/`, `tests/api/` |

No model, provider, assistant, or tool product names are used anywhere in active control
documents. Use the neutral role names above only.

## Hard Rules

1. Everything must belong to a layer.
2. Every layer must have a unique `layer_id`.
3. Every source must declare which layer it belongs to.
4. Frontend folders must be organized by layer.
5. API routes must expose layer-aware endpoints.
6. Database tables must include `layer_id` where useful.
7. Raw storage paths must include `layer_id` and `source_id`.
8. Normalizers must read raw object metadata, not random files.
9. Frontend never connects directly to the database.
10. The API talks to the database.
11. Fetchers store raw data before normalization.
12. Real API keys must never be committed.
13. Secrets must only appear as placeholders in `.env.example`.
14. Every agent must update `docs/state/HANDOFF_LOG.md` after work.
15. Every handoff entry must include: Work order, Agent (neutral role), Branch, Summary,
    Files changed, Commands run, Results, Known issues, Review status if applicable.
    Do not record model/provider/tool product names. UTC timestamps are optional.

## Agent-Specific Rules

- The Frontend Agent must not invent fields. It must consume contracts from `packages/contracts/`.
- The Database Agent must create layer-aware tables with `layer_id`/`source_id`/`source_object_id`.
- The API Agent must create API contracts that match the database schemas and frontend needs.

## Layer Order

`docs/control/MVP_LAYER_REGISTRY.md` is the authoritative source of truth for layer IDs,
layer order, and layer status. If any document or code disagrees with that registry, pause
new layer work until the registry drift is fixed.

| Layer ID | Name | Status |
|----------|------|--------|
| `layer_00_globe_core` | Globe Core | active |
| `layer_01_aviation` | Aviation | active |
| `layer_02_borders_boundaries` | Borders & Boundaries | active (MVP/local-dev) |
| `layer_03_earth_events` | Earth Events | active |
| `layer_04_public_military_security` | Public Military & Security | coming_soon |
| `layer_05_space_satellites` | Space & Satellites | active (default OFF) |
| `layer_06_maritime` | Maritime | active (default OFF) |
| `layer_07_weather` | Weather / Live Weather | active (default OFF) |
| `layer_08_news_osint` | News & OSINT | active (default OFF) |
| `layer_09_user_shapes` | User Shapes / Custom Overlays | coming_soon |
| `layer_10_energy_infrastructure` | Energy Infrastructure | active |

`layer_07_weather` is the canonical Layer 07. There is no `layer_07_infrastructure`.

## Not In Scope Yet

`layer_04_public_military_security` and `layer_09_user_shapes` are not yet implemented.
New layers beyond the current registry are not in scope until guardrails and layer
numbering are consistent. Space uses `layer_05_space_satellites`.

## Workflow

Build → Review/Test → Push → Next.

1. The Orchestrator Agent creates work orders in `docs/work-orders/`.
2. The responsible worker agent picks up its work order.
3. The agent does the work within its allowed folders only.
4. The agent runs the required build/test checks.
5. The agent creates one local commit with the proper message format.
6. The agent updates `docs/state/HANDOFF_LOG.md`.
7. The Orchestrator Agent reviews and creates `docs/state/INTEGRATION_REVIEW_[WO].md`.
8. If PASS: the Orchestrator Agent pushes the branch to origin.
9. If FAIL/NEEDS REVIEW: the Orchestrator Agent documents issues; the agent revises.

## Git Workflow

See `docs/control/GIT_WORKFLOW_POLICY.md` for complete Git rules.

**Key Rules:**
- Worker agents may create local commits only.
- Worker agents must NOT push to remote.
- The Orchestrator Agent owns all pushes to remote after review.
- The Orchestrator Agent must never push directly to main unless explicitly approved.
- All commits must follow format: `<type>(<area>): <description>`.
- All commits must include: Agent (neutral role), Work Order, Branch, Summary, Commands,
  Known Issues, Forbidden Folders, Secrets added.

## Key Documents

- `docs/control/GIT_WORKFLOW_POLICY.md` — Git commit and push rules
- `docs/control/MVP_LAYER_REGISTRY.md` — authoritative layer registry and order
- `docs/control/LAYER_ARCHITECTURE.md` — layer definitions and order
- `docs/control/LAYER_ID_CONVENTIONS.md` — naming and folder conventions
- `docs/control/LLM_OWNERSHIP_MATRIX.md` — agent ownership matrix
- `docs/control/PIPELINE_HANDOFF_RULES.md` — how data flows between agents
- `docs/control/DATA_LOCATION_RULES.md` — where files go
- `docs/control/SOURCE_TO_FRONTEND_CONTRACT.md` — full source contract
- `docs/state/CURRENT_PROJECT_STATE.md` — current phase and status
- `docs/state/HANDOFF_LOG.md` — log of all agent work
- `docs/work-orders/` — active work orders
