# LAYER_AND_DATA_CONTRACT.md — GOD EYES Layer Registry and Data Contract

> **Authoritative source for layer IDs, agent ownership, and source-to-frontend contracts.**
> Any code, config, or doc that references a layer must use the `layer_id` from this file.
> Engineering structure rules (file sizes, folder layout, naming, refactor policy) live in
> `docs/control/PROJECT_RULES.md`, not here.

Neutral role names only. Use "user / decision-control layer" for coordination decisions.

---

## 1. Purpose and Authority

This file is the consolidated layer and data contract for GOD EYES. It defines:

- The canonical layer registry (IDs, names, statuses, types, safety notes)
- Agent and folder ownership
- Source-to-frontend contract requirements
- Rules for adding or changing layers and sources

This file consolidates content from `MVP_LAYER_REGISTRY.md`, `LAYER_ARCHITECTURE.md`,
`LLM_OWNERSHIP_MATRIX.md`, and `SOURCE_TO_FRONTEND_CONTRACT.md`. Those source files
remain active until the user / decision-control layer retires them.

---

## 2. Relationship to PROJECT_RULES.md

| This file owns | PROJECT_RULES.md owns |
|----------------|-----------------------|
| Layer registry (IDs, statuses, types, safety) | File/folder naming conventions |
| Agent/folder ownership matrix | File size limits |
| Source-to-frontend contract fields | Frontend, API, fetcher/normalizer structure rules |
| Source family catalogue | Database/migration rules |
| Rules for adding/changing layers and sources | Import boundaries, refactor policy |

When there is a conflict between this file and PROJECT_RULES.md on a layer/source/ownership
topic, this file wins. When there is a conflict on a structure/naming/size topic, PROJECT_RULES.md wins.

---

## 3. Layer Registry Authority

`docs/control/MVP_LAYER_REGISTRY.md` is the current authoritative source until this file
is confirmed complete and mandatory reading lists are updated. Once reading lists point
here, this file is authoritative.

**This file supersedes** the older layer lists in `LAYER_ARCHITECTURE.md` and
`LAYER_ID_CONVENTIONS.md`. Those files are preserved for historical reference until retired.

**Registry drift rule:** If any document, code, or config disagrees with the layer IDs,
names, or statuses in this registry, pause new layer work until the drift is corrected.

---

## 4. Canonical Layer Table

| # | Layer ID | Display Name | Status | Type | Default UI |
|---|----------|-------------|--------|------|-----------|
| 0 | `layer_00_globe_core` | Globe Core | **active** | static | Always ON |
| 1 | `layer_01_aviation` | Aviation | **active** | live | ON |
| 2 | `layer_02_borders_boundaries` | Borders & Boundaries | **active** *(MVP/local-dev only)* | static | ON |
| 3 | `layer_03_earth_events` | Earth Events | **active** | live | ON |
| 4 | `layer_04_public_military_security` | Public Military & Security | **coming_soon** | static (MVP) | — |
| 5 | `layer_05_space_satellites` | Space & Satellites | **active** *(default OFF)* | live | OFF |
| 6 | `layer_06_maritime` | Maritime | **active** *(default OFF)* | live | OFF |
| 7 | `layer_07_weather` | Weather / Live Weather | **active** *(default OFF)* | live | OFF |
| 8 | `layer_08_news_osint` | News & OSINT | **active** *(default OFF)* | live | OFF |
| 9 | `layer_09_user_shapes` | User Shapes | **coming_soon** | static | — |
| 10 | `layer_10_energy_infrastructure` | Energy Infrastructure | **active** | static | ON |

`layer_07_weather` is the canonical Layer 07. There is no `layer_07_infrastructure`.
Space uses `layer_05_space_satellites`. Energy uses `layer_10_energy_infrastructure`.

---

## 5. Layer Status Definitions

| Status | Meaning | UI Behaviour |
|--------|---------|-------------|
| `active` | Fully implemented with real data | Toggle enabled; renders on globe |
| `active (MVP/local-dev)` | Implemented for local dev only; not production-approved | Toggle enabled; renders but carries production warning |
| `active (default OFF)` | Implemented; UI toggle defaults to off | Toggle visible and enabled; off by default |
| `coming_soon` | In registry but not implemented | Toggle visible but disabled; shows "Coming Soon" badge. **Never shows fake/demo data.** |
| `no_data` | Exists in frontend; no sources configured | Toggle visible; shows "No data sources" indicator |

---

## 6. Layer Order, Rendering, and Product Rules

1. Layer 0 (Globe Core) renders first (z=0). It must never crash. 60 FPS always.
2. All other layers render on top of Layer 0 and must be independently toggleable.
3. No layer may depend on a higher-numbered layer.
4. All data layers (1+) depend on Layer 0.
5. **No fake/demo data.** Live layers with no populated database show an empty state.
6. **60 FPS safe** at all times across all toggled-on layers.
7. **layer_04_public_military_security** — public-only, static-only for MVP. No live
   tracking, no real-time updates, no movement animation. UI disclaimer required:
   "Publicly available information only."
8. **layer_02_borders_boundaries** — MVP/local-dev only. Not Survey of India compliant.
   All disputed territories require individual review. Not production-approved.
9. Live layers (type: `live`) render real data only when their worker has populated the
   database. Otherwise they show an empty state.

### Generic layer API pattern (recommended for new layers)

```
GET /api/layers                           — list all layers with status
GET /api/layers/:layerId/objects          — objects for a layer
GET /api/layers/:layerId/objects/:objectId — single object
GET /api/layers/:layerId/status           — per-layer status
```

---

## 7. Layer ID Naming Pattern

```
layer_{NN}_{short_name}
```

- `NN` = two-digit zero-padded number
- `short_name` = lowercase snake_case domain name

Do not create folders, tables, API routes, or contracts for unregistered layers.
Folder-per-lane conventions are in `docs/control/PROJECT_RULES.md` §5.

---

## 8. Agent and Folder Ownership Matrix

| Path / Resource | Owner | Others may |
|----------------|-------|-----------|
| `AGENTS.md` | User / decision-control layer | Read only |
| `specs/` | User / decision-control layer | Read only |
| `docs/control/` | User / decision-control layer | Read only |
| `docs/work-orders/` | User / decision-control layer | Read only |
| `docs/state/CURRENT_PROJECT_STATE.md` | User / decision-control layer | Read only |
| `docs/state/HANDOFF_LOG.md` | All agents | Append only |
| `docs/state/RECENT_CONTEXT.md` | All agents | Append only |
| `apps/web/` | Frontend Agent | — |
| `packages/ui/` | Frontend Agent | — |
| `packages/layers/` | Frontend Agent | — |
| `services/fetch-orchestrator/` | Fetcher Agent | Colocated normalizer modules per Normalizer Location Rule (see `PROJECT_RULES.md` §8) |
| `packages/source-catalog/` | Fetcher Agent | — |
| `services/normalizer/` | Normalizer Agent (aviation only) | See Normalizer Location Rule |
| `database/` | Database Agent | — |
| `packages/schemas/` | Database Agent | — |
| `tests/data/` | Database Agent | — |
| `apps/api/` | API Agent | — |
| `packages/contracts/` | API Agent (writes); Frontend Agent and data agents read | — |
| `packages/auth/` | API Agent | — |
| `tests/api/` | API Agent | — |
| `.env.example` | API Agent | Read only |

### Ownership rules

- An agent must not modify files outside its ownership.
- If an agent needs a change in another agent's area, it logs a request in `HANDOFF_LOG.md`.
- The user / decision-control layer resolves cross-agent conflicts.
- Worker agents (Frontend, API, Fetcher, Normalizer, Database) create local commits only.
  They must not push to remote.
- The user / decision-control layer owns all pushes to remote after review.

### Shared read access

All agents may read: `AGENTS.md`, `docs/control/*`, `docs/state/*`, `specs/*`,
`packages/contracts/*`, `.env.example`.

**Git workflow detail:** see `docs/control/GIT_WORKFLOW_POLICY.md`.
**Normalizer Location Rule (canonical):** see `docs/control/PROJECT_RULES.md` §8.

---

## 9. Source-to-Frontend Contract

Every data source must define all fields below before any agent builds it.
The user / decision-control layer fills out this table; worker agents do not invent values.

| Field | Description | Example |
|-------|-------------|---------|
| `layer_id` | Layer this source belongs to | `layer_01_aviation` |
| `source_id` | Unique identifier within the layer | `ourairports` |
| `raw_storage_uri_pattern` | Where raw data lands (see raw path rule in `PROJECT_RULES.md` §13) | `raw/layer_01_aviation/ourairports/{yyyy}/{mm}/{dd}/{fetch_run_id}/payload.json` |
| `collector` | Fetcher module path | `services/fetch-orchestrator/src/layers/layer_01_aviation/ourairports_collector.py` |
| `normalizer` | Normalizer module path | `services/normalizer/src/layers/layer_01_aviation/ourairports_normalizer.py` |
| `target_tables` | DB tables written to | `aviation_airports`, `aviation_runways` |
| `api_endpoint` | API route | `GET /api/layers/layer_01_aviation/objects` |
| `frontend_layer_id` | Map layer identifier | `layer_01_aviation` |
| `tests` | Test file paths | `tests/data/layer_01_aviation/...` |

Where contract details are not yet recorded, mark them `needs contract detail` — do not invent values.

**Layer 0 exception:** Layer 0 (Globe Core) has no external data sources. It is frontend-only.

---

## 10. Implemented Source Families

| Layer | Source family | Code location | API surface |
|-------|--------------|---------------|-------------|
| `layer_01_aviation` | OurAirports / aviation reference | `services/fetch-orchestrator/src/layers/layer_01_aviation/`, `services/normalizer/src/layers/layer_01_aviation/` | `GET /api/layers/layer_01_aviation/objects` |
| `layer_01_aviation` | Aviation live aircraft | `services/fetch-orchestrator/src/layers/layer_01_aviation/aviation_live_aircraft_worker.py` | `GET /api/aviation/aircraft/latest`, `ws://.../ws/aviation/aircraft/live` |
| `layer_02_borders_boundaries` | Natural Earth Admin-0 (MVP/local-dev) | `services/fetch-orchestrator/src/layers/layer_02_borders_boundaries/` | `GET /api/borders-boundaries/countries` |
| `layer_03_earth_events` | USGS earthquakes | `services/fetch-orchestrator/src/layers/layer_03_earth_events/usgs_earthquakes_worker.py` | `GET /api/earth-events/latest` |
| `layer_05_space_satellites` | CelesTrak / Space-Track TLE feeds | `services/fetch-orchestrator/src/layers/layer_05_space_satellites/` | `GET /api/space/satellites`, `ws://.../ws/space/satellites/live` |
| `layer_06_maritime` | AIS maritime source family | `services/fetch-orchestrator/src/layers/layer_06_maritime/` | `GET /api/layers/layer_06_maritime/objects` (+ `/stats`, `/vessels/:mmsi/positions`) |
| `layer_07_weather` | Open-Meteo weather | `services/fetch-orchestrator/src/layers/layer_07_weather/`, `database/ingestion/layers/layer_07_weather/` | `GET /api/layers/layer_07_weather/weather/{latest,current,hourly,nearby,sources,fetch-runs}` |
| `layer_08_news_osint` | GDACS + GDELT event/news | `services/fetch-orchestrator/src/layers/layer_08_news_osint/`, `database/ingestion/layers/layer_08_news_osint/` | `GET /api/layers/layer_08_news_osint/news/{items,markers,sources,fetch-runs,stats}` |
| `layer_10_energy_infrastructure` | WRI / OSM / Global Energy Monitor | `services/fetch-orchestrator/src/layers/layer_10_energy_infrastructure/` | `GET /api/energy/infrastructure` (+ `/categories`, `/sources`, `/:featureId`) |

---

## 11. API / Frontend Contract Expectations

- The Frontend Agent must not invent fields. It must consume contracts from `packages/contracts/`.
- The API Agent defines response shapes in `packages/contracts/` as Zod schemas.
- The Frontend Agent reads contracts to build layer UI in `apps/web/src/layers/{layer_id}/`.
- The Database Agent defines table schemas through migrations; the API Agent reads migrations
  to understand the schema. Physical table structures remain changeable without breaking
  the API contract.
- `packages/contracts/` is the interface boundary between API and frontend.
- No agent may skip the contracts package and read database types directly in frontend code.

---

## 12. Data Ownership and Boundary Rules

- The API reads from the database. The frontend reads from the API. Never bypass this chain.
- Raw data is owned by the Fetcher Agent. Normalised data flows into the database (Database Agent).
- Secrets and API keys are never stored in code or committed files.
  They appear only as placeholders in `.env.example` (owned by the API Agent).
- `docs/archive/**` and historical documents do not override this registry or these contracts.
  Active control docs always win over archived or historical documents.
- Audit reports in `docs/audits/` are evidence, not active instructions. They do not override
  this file or `PROJECT_RULES.md`.

---

## 13. Adding or Changing a Layer

1. Create a work order for the user / decision-control layer.
2. Update the canonical layer table in this file (§4).
3. Update `docs/state/CURRENT_PROJECT_STATE.md`.
4. Update `docs/control/MVP_LAYER_REGISTRY.md` to stay in sync (until it is retired).
5. Create handoff entries for affected agents.
6. Do not create code or migrations for a new layer until the registry entry exists and
   the work order is approved.

---

## 14. Adding or Changing a Source

1. The user / decision-control layer fills out the full source contract table in §9 for
   the new source.
2. Creates work orders for Fetcher/Normalizer/Database Agents (collector + normalizer + DB).
3. Creates a work order for the API Agent (endpoint + contract in `packages/contracts/`).
4. After the API is live, creates a work order for the Frontend Agent.
5. **No agent starts work on a source without a completed contract entry in §9.**
6. Source contract details marked `needs contract detail` must be completed by the owning
   agent — do not invent values.

---

## 15. What Not to Do

- Do not create a layer folder, table, or route for an unregistered layer.
- Do not invent source contract fields. Fill in `needs contract detail` until they are known.
- Do not let the frontend import layer data types directly from `services/` or `database/`.
- Do not skip `packages/contracts/` when building frontend layer UI.
- Do not treat archived or historical documents as active registry entries.
- Do not modify this file without a work order from the user / decision-control layer.
- Do not build layer_04 or layer_09 features until they move from `coming_soon` to `active`.
- Do not use layer_02_borders_boundaries in production without completing the boundary
  compliance review.
- Do not add new sources to layer_04_public_military_security without explicit user /
  decision-control layer approval; all sources must be public, open, and verifiable.

---

## Change Process

To add, modify, or supersede a rule or registry entry:

1. Create a work order for the user / decision-control layer.
2. State what changes, why, and the proposed new content.
3. Update this file.
4. Update `docs/state/CURRENT_PROJECT_STATE.md`.
5. Append entries to `docs/state/HANDOFF_LOG.md` and `docs/state/RECENT_CONTEXT.md`.

**Source files:** `MVP_LAYER_REGISTRY.md`, `LAYER_ARCHITECTURE.md`,
`LLM_OWNERSHIP_MATRIX.md`, `SOURCE_TO_FRONTEND_CONTRACT.md`

**Last updated:** 2026-06-16
