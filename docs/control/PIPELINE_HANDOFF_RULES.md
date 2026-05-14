# Pipeline Handoff Rules

## Data Flow (per data layer)

```
[External Source]
    → Codex (fetcher) → raw/{layer_id}/{source_id}/...
    → Codex (normalizer) → database (layer-aware tables)
    → Claude Code (API) ← database
    → Gemini (frontend) ← API
```

Layer 0 (Globe Core) has no data pipeline. It is frontend-only.

## Handoff Points

### 1. Raw Data → Normalized Data (Codex internal)

- Fetcher writes raw data to `raw/{layer_id}/{source_id}/{yyyy}/{mm}/{dd}/{fetch_run_id}/payload.{ext}`
- Normalizer reads from raw storage metadata, never arbitrary paths
- Normalizer writes to database via layer-aware migrations

### 2. Database → API (Codex → Claude Code)

- Codex defines table schemas in `database/migrations/layers/{layer_id}/`
- Claude Code reads migration files to understand schema
- Claude Code builds layer-aware API endpoints
- Contract: table names, column types, and `layer_id` field are the interface

### 3. API → Frontend (Claude Code → Gemini)

- Claude Code defines response shapes in `packages/contracts/`
- Gemini reads contracts to build layer UI in `apps/web/src/layers/{layer_id}/`
- Contract: endpoint URL + response JSON shape is the interface

## Handoff Protocol

1. Producing agent completes work and updates `HANDOFF_LOG.md`.
2. Producing agent states what is now available (table, endpoint, contract file) and which `layer_id` it belongs to.
3. Consuming agent reads the log and the referenced contract.
4. Consuming agent does its work and updates `HANDOFF_LOG.md`.

## Forbidden

- Gemini must never import from `services/`, `database/`, or `apps/api/` source code.
- Claude Code must never import from `apps/web/` or `services/`.
- Codex must never import from `apps/web/` or `apps/api/`.
- No agent may create files for a layer that has not been approved (status: Next).
