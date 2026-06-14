# Pipeline Handoff Rules

Neutral role names only: Orchestrator Agent, Frontend Agent, API Agent, Fetcher Agent,
Normalizer Agent, Database Agent.

## Data Flow (per data layer)

```
[External Source]
    → Fetcher Agent (fetcher) → raw/{layer_id}/{source_id}/...
    → Normalizer Agent (normalizer) → Database Agent (layer-aware tables)
    → API Agent (API) ← database
    → Frontend Agent (frontend) ← API
```

Layer 0 (Globe Core) has no data pipeline. It is frontend-only.

## Handoff Points

### 1. Raw Data → Normalized Data

- The Fetcher Agent writes raw data to
  `raw/{layer_id}/{source_id}/{yyyy}/{mm}/{dd}/{fetch_run_id}/payload.{ext}`.
- The Normalizer Agent reads from raw storage metadata, never arbitrary paths.
- Normalized output is written to the database via layer-aware tables.

> Some live layers also support local proof/seed output under `tmp/` for verification.
> `tmp/` and `raw/` are local/generated output and must never be committed.

### 2. Database → API

- The Database Agent defines table schemas in `database/migrations/layers/{layer_id}/`.
- The API Agent reads migration files to understand the schema.
- The API Agent builds layer-aware API endpoints.
- Contract: table names, column types, and the `layer_id` field are the interface.

### 3. API → Frontend

- The API Agent defines response shapes in `packages/contracts/`.
- The Frontend Agent reads contracts to build layer UI in `apps/web/src/layers/{layer_id}/`.
- Contract: endpoint URL + response JSON shape is the interface.

## Handoff Protocol

1. The producing agent completes work and updates `HANDOFF_LOG.md`.
2. The producing agent states what is now available (table, endpoint, contract file) and
   which `layer_id` it belongs to.
3. The consuming agent reads the log and the referenced contract.
4. The consuming agent does its work and updates `HANDOFF_LOG.md`.

## Forbidden

- The Frontend Agent must never import from `services/`, `database/`, or `apps/api/` source code.
- The API Agent must never import from `apps/web/` or `services/`.
- The Fetcher and Normalizer Agents must never import from `apps/web/` or `apps/api/`.
- No agent may create files for a layer that has not been approved.
