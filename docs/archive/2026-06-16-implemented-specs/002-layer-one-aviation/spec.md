# Spec 002 — Layer 1: Aviation

## Layer ID

`layer_01_aviation`

## Summary

First data layer. Proves the full pipeline: source → raw storage → normalizer → database → API → frontend rendering on the globe.

## Owners

- **Codex**: source catalog, fetchers, normalizers, DB migrations, data tests
- **Claude Code**: API endpoints, contracts
- **Gemini**: frontend layer rendering, aircraft detail panel

## Components

### Data Pipeline (Codex)

1. **Source Catalog Entry** — `packages/source-catalog/layers/layer_01_aviation/`
2. **Fetcher** — `services/fetch-orchestrator/src/layers/layer_01_aviation/`
3. **Normalizer** — `services/normalizer/src/layers/layer_01_aviation/`
4. **Database Tables** — `database/migrations/layers/layer_01_aviation/`
5. **Data Tests** — `tests/data/layer_01_aviation/`

### API (Claude Code)

6. **Endpoints**:
   - `GET /api/layers/layer_01_aviation/objects` — list aircraft
   - `GET /api/layers/layer_01_aviation/objects/:objectId` — aircraft detail
   - `GET /api/layers/layer_01_aviation/sources` — list aviation sources
7. **Contracts** — `packages/contracts/layers/layer_01_aviation/`

### Frontend (Gemini)

8. **Layer Folder** — `apps/web/src/layers/layer_01_aviation/`
9. **Aircraft Position Markers** — render aircraft on globe
10. **Airports Layer** — render airport markers
11. **Flight Routes** — render route lines (if data available)
12. **Aircraft Detail Panel** — show details on selection

## Raw Storage

```
raw/layer_01_aviation/{source_id}/{yyyy}/{mm}/{dd}/{fetch_run_id}/payload.json
```

## Database Schema (draft — Codex to finalize)

```sql
CREATE TABLE layer_objects (
  id UUID PRIMARY KEY,
  layer_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_object_id TEXT NOT NULL,
  object_type TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  alt DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  metadata JSONB,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(layer_id, source_id, source_object_id)
);
```

## Candidate Sources (to be confirmed in work orders)

| Source | Type | API |
|--------|------|-----|
| ADS-B Exchange | Aircraft positions | REST |
| OpenSky Network | Aircraft positions | REST |
| OurAirports | Airport data | CSV/static |

## Dependencies

- Layer 0 Globe Core must be rendering before aviation objects can appear on it.
- Layer registry must accept aviation layer registration.

## Acceptance Criteria

1. At least one aviation source is fetched and stored in raw path.
2. Normalizer transforms raw data into `layer_objects` table rows.
3. API returns aircraft objects for `layer_01_aviation`.
4. Frontend renders aircraft markers on the globe.
5. Clicking an aircraft shows the detail panel.
6. All data includes `layer_id = 'layer_01_aviation'`.

## Out of Scope

- Real-time WebSocket streaming (future enhancement)
- Historical playback
- Satellite, maritime, or other layers

## Status

Spec complete. Awaiting work orders.
