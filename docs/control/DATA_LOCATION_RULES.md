# Data Location Rules

Neutral role names only: Orchestrator Agent, Frontend Agent, API Agent, Fetcher Agent,
Normalizer Agent, Database Agent.

## Directory Structure

```
god-eyes/
├── AGENTS.md
├── .env.example
├── specs/
├── docs/
│   ├── control/
│   ├── state/
│   ├── audits/
│   └── work-orders/
├── apps/
│   ├── web/                          ← Frontend Agent
│   │   └── src/layers/               (per-layer UI folders)
│   │       ├── layer_07_weather/
│   │       ├── layer_08_news_osint/
│   │       ├── aviation/ borders/ earth-events/ space/ maritime/ energy/
│   │       └── ...
│   └── api/                          ← API Agent
├── services/
│   ├── fetch-orchestrator/           ← Fetcher Agent
│   │   └── src/layers/
│   │       ├── layer_01_aviation/
│   │       ├── layer_02_borders_boundaries/
│   │       ├── layer_03_earth_events/
│   │       ├── layer_05_space_satellites/
│   │       ├── layer_06_maritime/
│   │       ├── layer_07_weather/
│   │       ├── layer_08_news_osint/
│   │       └── layer_10_energy_infrastructure/
│   └── normalizer/                   ← Normalizer Agent
│       └── src/layers/
│           └── layer_01_aviation/
├── packages/
│   ├── source-catalog/               ← Fetcher Agent
│   │   └── layers/
│   │       ├── layer_01_aviation/
│   │       ├── layer_06_maritime/
│   │       └── layer_07_weather/
│   ├── schemas/                      ← Database Agent
│   ├── contracts/                    ← API Agent
│   ├── auth/                         ← API Agent
│   ├── ui/                           ← Frontend Agent
│   └── layers/                       ← Frontend Agent
├── database/
│   ├── migrations/
│   │   ├── core/
│   │   └── layers/                   ← Database Agent
│   │       ├── layer_01_aviation/
│   │       ├── layer_02_borders_boundaries/
│   │       ├── layer_03_earth_events/
│   │       ├── layer_05_space_satellites/
│   │       ├── layer_06_maritime/
│   │       ├── layer_07_weather/
│   │       ├── layer_08_news_osint/
│   │       └── layer_10_energy_infrastructure/
│   └── ingestion/                    ← Database Agent
│       └── layers/
│           ├── layer_07_weather/
│           └── layer_08_news_osint/
├── raw/                              ← Fetcher Agent (gitignored)
│   └── {layer_id}/{source_id}/{yyyy}/{mm}/{dd}/{fetch_run_id}/payload.{ext}
├── tmp/                              ← local/generated proof output (gitignored)
└── tests/
    ├── data/                         ← Database Agent
    └── api/                          ← API Agent
```

> Note: some frontend layer folders use short names (`aviation/`, `borders/`,
> `earth-events/`, `space/`, `maritime/`, `energy/`) while newer layers use the full
> `layer_NN_*` folder name. Both map to the canonical `layer_id` in the registry.

## Raw Storage Path Pattern

```
raw/{layer_id}/{source_id}/{yyyy}/{mm}/{dd}/{fetch_run_id}/payload.{ext}
```

Example:
```
raw/layer_07_weather/open-meteo/2026/06/10/run_20260610T120000Z/batch_001.json
```

Raw fetch output is written under `raw/` and is gitignored. Some workers also write local
proof/seed output under `tmp/` for verification. `raw/` and `tmp/` are local/generated
output and must never be committed.

## Rules

0. `docs/control/MVP_LAYER_REGISTRY.md` is authoritative for layer IDs and layer order.
   Space must use `layer_05_space_satellites`; energy uses `layer_10_energy_infrastructure`.
1. Raw data goes in `raw/{layer_id}/{source_id}/`. This directory is gitignored.
2. Database migrations go in `database/migrations/layers/{layer_id}/`; ingestion code in
   `database/ingestion/layers/{layer_id}/`.
3. API contracts go in `packages/contracts/`.
4. Frontend reads only from `packages/contracts/` for type definitions.
5. Secrets are never stored anywhere except `.env.example` (as placeholders).
6. No agent creates directories outside its ownership without Orchestrator Agent approval.
7. Layer 0 has no raw storage, fetchers, normalizers, or DB migrations.

## Generated Folders

Do not edit generated or dependency folders directly:
- `apps/api/dist/`
- `apps/web/dist/`
- `packages/contracts/dist/`
- `node_modules/`
- `__pycache__/`
- `.pytest_cache/`

## Gitignore Requirements

```
raw/
tmp/
.env
node_modules/
dist/
.pytest_cache/
```
