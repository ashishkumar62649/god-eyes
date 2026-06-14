# Source-to-Frontend Contract

Every data source in GOD EYES should define the fields below before an agent builds it.
Neutral role names only: Orchestrator Agent, API Agent, Fetcher Agent, Normalizer Agent,
Database Agent, Frontend Agent.

## Required Fields Per Source

| Field | Description | Example |
|---|---|---|
| `layer_id` | Which layer this source belongs to | `layer_01_aviation` |
| `source_id` | Unique identifier within the layer | `ourairports` |
| `raw_storage_uri_pattern` | Where raw data lands | `raw/layer_01_aviation/ourairports/{yyyy}/{mm}/{dd}/{fetch_run_id}/payload.json` |
| `collector` | Fetcher module path | `services/fetch-orchestrator/src/layers/layer_01_aviation/ourairports_collector.py` |
| `normalizer` | Normalizer module path | `services/normalizer/src/layers/layer_01_aviation/ourairports_normalizer.py` |
| `target_tables` | DB tables written to | `aviation_airports`, `aviation_runways` |
| `api_endpoint` | API route | `GET /api/layers/layer_01_aviation/objects` |
| `frontend_layer_id` | Map layer identifier | `layer_01_aviation` |
| `tests` | Test file paths | `tests/data/layer_01_aviation/...` |

## Implemented Source Families (factual)

The following source families are present in the current code. Exact per-source contract
detail (every field above) is not fully captured here for all of them; entries marked
"needs contract detail" should be completed by the owning agents without inventing values.

| Layer | Source family | Code location | API surface |
|-------|---------------|---------------|-------------|
| `layer_01_aviation` | OurAirports / aviation reference data | `services/fetch-orchestrator/src/layers/layer_01_aviation/ourairports_collector.py`, `services/normalizer/src/layers/layer_01_aviation/` | `GET /api/layers/layer_01_aviation/objects` |
| `layer_01_aviation` | Aviation live aircraft source family | `services/fetch-orchestrator/src/layers/layer_01_aviation/aviation_live_aircraft_worker.py` | `GET /api/aviation/aircraft/latest`, `ws://.../ws/aviation/aircraft/live` |
| `layer_02_borders_boundaries` | Natural Earth Admin-0 (local/dev borders) | `services/fetch-orchestrator/src/layers/layer_02_borders_boundaries/natural_earth_admin0_ingest.py` | `GET /api/borders-boundaries/countries` |
| `layer_03_earth_events` | USGS earthquakes | `services/fetch-orchestrator/src/layers/layer_03_earth_events/usgs_earthquakes_worker.py` | `GET /api/earth-events/latest` |
| `layer_05_space_satellites` | CelesTrak / Space-Track satellite source family | `services/fetch-orchestrator/src/layers/layer_05_space_satellites/` | `GET /api/space/satellites` (+ `/categories`, `/:satelliteId`), `ws://.../ws/space/satellites/live` |
| `layer_06_maritime` | AIS maritime source family | `services/fetch-orchestrator/src/layers/layer_06_maritime/` | `GET /api/layers/layer_06_maritime/objects` (+ `/stats`, `/:objectId`, `/vessels/:mmsi/positions`) |
| `layer_07_weather` | Open-Meteo weather | `services/fetch-orchestrator/src/layers/layer_07_weather/`, `database/ingestion/layers/layer_07_weather/` | `GET /api/layers/layer_07_weather/weather/{latest,current,hourly,nearby,sources,fetch-runs}` |
| `layer_08_news_osint` | GDACS and GDELT event/news source families | `services/fetch-orchestrator/src/layers/layer_08_news_osint/`, `database/ingestion/layers/layer_08_news_osint/` | `GET /api/layers/layer_08_news_osint/news/{items,markers,sources,fetch-runs,stats}` |
| `layer_10_energy_infrastructure` | WRI / OpenStreetMap / Global Energy Monitor energy source families | `services/fetch-orchestrator/src/layers/layer_10_energy_infrastructure/` | `GET /api/energy/infrastructure` (+ `/categories`, `/sources`, `/:featureId`) |

> Where exact source contract details (raw URI pattern, per-source validator, target
> tables, test paths) are not yet recorded above, mark them "needs contract detail" rather
> than inventing values.

## Adding a New Source

1. The Orchestrator Agent fills out the contract table for the new source in this file.
2. The Orchestrator Agent creates work orders for the Fetcher/Normalizer/Database Agents
   (fetcher + normalizer + DB) and the API Agent (endpoint + contract).
3. After the API is live, the Orchestrator Agent creates a work order for the Frontend Agent.
4. No agent starts work on a source without a completed contract entry here.

## Layer 0 Exception

Layer 0 (Globe Core) has no external data sources. It is a frontend-only layer providing the
3D globe foundation.
