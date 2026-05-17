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
│   │       ├── layer_02_satellite/
│   │       └── layer_03_maritime/
│   └── api/                          ← Claude Code
├── services/
│   ├── fetch-orchestrator/           ← Codex
│   │   └── src/layers/
│   │       ├── layer_01_aviation/
│   │       ├── layer_02_satellite/
│   │       └── layer_03_maritime/
│   └── normalizer/                   ← Codex
│       └── src/layers/
│           ├── layer_01_aviation/
│           ├── layer_02_satellite/
│           └── layer_03_maritime/
├── packages/
│   ├── source-catalog/               ← Codex
│   │   └── layers/
│   │       ├── layer_01_aviation/
│   │       ├── layer_02_satellite/
│   │       └── layer_03_maritime/
│   ├── schemas/                      ← Codex
│   ├── contracts/                    ← Claude Code
│   ├── auth/                         ← Claude Code
│   ├── ui/                           ← Gemini
│   └── layers/                       ← Gemini
├── database/
│   └── migrations/layers/            ← Codex
│       ├── layer_01_aviation/
│       ├── layer_02_satellite/
│       └── layer_03_maritime/
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

1. Raw data goes in `raw/{layer_id}/{source_id}/`. This directory is gitignored.
2. Database migrations go in `database/migrations/layers/{layer_id}/`.
3. API contracts go in `packages/contracts/`.
4. Frontend reads only from `packages/contracts/` for type definitions.
5. Secrets are never stored anywhere except `.env.example` (as placeholders).
6. No agent creates directories outside its ownership without Kiro approval.
7. Layer 0 has no raw storage, fetchers, normalizers, or DB migrations.

## Gitignore Requirements

```
raw/
.env
node_modules/
dist/
```
