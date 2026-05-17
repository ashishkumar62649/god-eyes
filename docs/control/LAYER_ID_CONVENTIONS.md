# Layer ID Conventions

## Naming Pattern

```
layer_{NN}_{short_name}
```

- `NN` = two-digit zero-padded number
- `short_name` = lowercase snake_case domain name

## Registered Layer IDs

| ID | Name |
|----|------|
| `layer_00_globe_core` | Globe Core |
| `layer_01_aviation` | Aviation |
| `layer_02_satellite` | Satellite |
| `layer_03_maritime` | Maritime |
| `layer_04_weather_disasters` | Weather/Disasters |
| `layer_05_cyber_infrastructure` | Cyber/Infrastructure |
| `layer_06_ai_intelligence` | AI Intelligence |

## Folder Conventions

### Frontend (Gemini)

```
apps/web/src/layers/{layer_id}/
```

Examples:
- `apps/web/src/layers/layer_00_globe_core/`
- `apps/web/src/layers/layer_01_aviation/`
- `apps/web/src/layers/layer_02_satellite/`
- `apps/web/src/layers/layer_03_maritime/`

### Fetch Orchestrator (Codex)

```
services/fetch-orchestrator/src/layers/{layer_id}/
```

Examples:
- `services/fetch-orchestrator/src/layers/layer_01_aviation/`
- `services/fetch-orchestrator/src/layers/layer_02_satellite/`

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
