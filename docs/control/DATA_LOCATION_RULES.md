# Data Location Rules

## Directory Structure

```
god-eyes/
├── AGENTS.md
├── .env.example
├── specs/
│   ├── 001-layer-zero-globe-core/
│   └── 002-layer-one-aviation/
├── docs/
│   ├── control/
│   ├── state/
│   └── work-orders/
├── apps/
│   ├── web/                          ← Gemini
│   │   └── src/layers/
│   │       ├── layer_00_globe_core/
│   │       ├── layer_01_aviation/
│   │       ├── layer_02_borders_boundaries/
│   │       ├── layer_03_earth_events/
│   │       ├── layer_04_public_military_security/
│   │       ├── layer_05_space_satellites/
│   │       └── layer_06_maritime/
│   └── api/                          ← Claude Code
├── services/
│   ├── fetch-orchestrator/           ← Codex
│   │   └── src/layers/
│   │       ├── layer_01_aviation/
│   │       ├── layer_02_borders_boundaries/
│   │       ├── layer_03_earth_events/
│   │       ├── layer_04_public_military_security/
│   │       ├── layer_05_space_satellites/
│   │       └── layer_06_maritime/
│   └── normalizer/                   ← Codex
│       └── src/layers/
│           ├── layer_01_aviation/
│           ├── layer_02_borders_boundaries/
│           ├── layer_03_earth_events/
│           ├── layer_04_public_military_security/
│           ├── layer_05_space_satellites/
│           └── layer_06_maritime/
├── packages/
│   ├── source-catalog/               ← Codex
│   │   └── layers/
│   │       ├── layer_01_aviation/
│   │       ├── layer_02_borders_boundaries/
│   │       ├── layer_03_earth_events/
│   │       ├── layer_04_public_military_security/
│   │       ├── layer_05_space_satellites/
│   │       └── layer_06_maritime/
│   ├── schemas/                      ← Codex
│   ├── contracts/                    ← Claude Code
│   ├── auth/                         ← Claude Code
│   ├── ui/                           ← Gemini
│   └── layers/                       ← Gemini
├── database/
│   └── migrations/layers/            ← Codex
│       ├── layer_01_aviation/
│       ├── layer_02_borders_boundaries/
│       ├── layer_03_earth_events/
│       ├── layer_04_public_military_security/
│       ├── layer_05_space_satellites/
│       └── layer_06_maritime/
├── raw/                              ← Codex (gitignored)
│   └── {layer_id}/{source_id}/{yyyy}/{mm}/{dd}/{fetch_run_id}/payload.{ext}
└── tests/
    ├── data/                         ← Codex
    └── api/                          ← Claude Code
```

## Raw Storage Path Pattern

```
raw/{layer_id}/{source_id}/{yyyy}/{mm}/{dd}/{fetch_run_id}/payload.{ext}
```

Example:
```
raw/layer_01_aviation/adsb_exchange/2026/05/14/fetch_run_abc/payload.json
```

## Rules

0. `docs/control/MVP_LAYER_REGISTRY.md` is authoritative for layer IDs and layer order. Space must use `layer_05_space_satellites` unless that registry is intentionally changed.
1. Raw data goes in `raw/{layer_id}/{source_id}/`. This directory is gitignored.
2. Database migrations go in `database/migrations/layers/{layer_id}/`.
3. API contracts go in `packages/contracts/`.
4. Frontend reads only from `packages/contracts/` for type definitions.
5. Secrets are never stored anywhere except `.env.example` (as placeholders).
6. No agent creates directories outside its ownership without Kiro approval.
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
.env
node_modules/
dist/
```
