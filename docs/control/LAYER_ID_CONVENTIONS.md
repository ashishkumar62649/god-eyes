# Layer ID Conventions

## Naming Pattern

```
layer_{NN}_{short_name}
```

- `NN` = two-digit zero-padded number
- `short_name` = lowercase snake_case domain name

## Registered Layer IDs

> **Note:** The authoritative layer registry is now `MVP_LAYER_REGISTRY.md`. This table is a summary.

| # | ID | Name | MVP Status |
|---|----|------|------------|
| 0 | `layer_00_globe_core` | Globe Core | active |
| 1 | `layer_01_aviation` | Aviation | active |
| 2 | `layer_02_borders_boundaries` | Borders & Boundaries | coming_soon |
| 3 | `layer_03_earth_events` | Earth Events | coming_soon |
| 4 | `layer_04_public_military_security` | Public Military & Security | coming_soon |
| 5 | `layer_05_space_satellites` | Space & Satellites | coming_soon |
| 6 | `layer_06_maritime` | Maritime | coming_soon |
| 7 | `layer_07_weather` | Weather / Live Weather | coming_soon |
| 8 | `layer_08_news_osint` | News & OSINT | coming_soon |
| 9 | `layer_09_user_shapes` | User Shapes | coming_soon |
| 10 | `layer_10_energy_infrastructure` | Energy Infrastructure | coming_soon |

## Folder Conventions

### Frontend (Gemini)

```
apps/web/src/layers/{layer_id}/
```

Examples:
- `apps/web/src/layers/layer_00_globe_core/`
- `apps/web/src/layers/layer_01_aviation/`
- `apps/web/src/layers/layer_02_borders_boundaries/`
- `apps/web/src/layers/layer_03_earth_events/`
- `apps/web/src/layers/layer_04_public_military_security/`
- `apps/web/src/layers/layer_05_space_satellites/`
- `apps/web/src/layers/layer_06_maritime/`
- `apps/web/src/layers/layer_07_weather/`
- `apps/web/src/layers/layer_08_news_osint/`
- `apps/web/src/layers/layer_09_user_shapes/`

### Fetch Orchestrator (Codex)

```
services/fetch-orchestrator/src/layers/{layer_id}/
```

Examples:
- `services/fetch-orchestrator/src/layers/layer_01_aviation/`
- `services/fetch-orchestrator/src/layers/layer_03_earth_events/`
- `services/fetch-orchestrator/src/layers/layer_05_space_satellites/`
- `services/fetch-orchestrator/src/layers/layer_06_maritime/`
- `services/fetch-orchestrator/src/layers/layer_08_news_osint/`

### Normalizer (Codex)

```
services/normalizer/src/layers/{layer_id}/
```

### Source Catalog (Codex)

```
packages/source-catalog/layers/{layer_id}/
```

### Database Migrations (Codex)

```
database/migrations/layers/{layer_id}/
```

### Raw Storage Path Pattern

```
raw/{layer_id}/{source_id}/{yyyy}/{mm}/{dd}/{fetch_run_id}/payload.{ext}
```

Example:
```
raw/layer_01_aviation/adsb_exchange/2026/05/14/fetch_run_abc/payload.json
```

## API Route Pattern

```
GET /api/layers
GET /api/layers/:layerId/status
GET /api/layers/:layerId/objects
GET /api/layers/:layerId/objects/:objectId
GET /api/layers/:layerId/sources
GET /api/health
```

## Rules

- Never create a folder for a layer without a registered `layer_id`.
- Layer 0 has no fetchers/normalizers/source-catalog (it is frontend-only).
- All data layers (1+) must have entries in source catalog, fetchers, normalizers, DB, and API.
