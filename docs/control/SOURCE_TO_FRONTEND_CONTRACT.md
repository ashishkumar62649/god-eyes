# Source-to-Frontend Contract

Every data source in GOD EYES must define all fields below before any agent builds it.

## Required Fields Per Source

| Field | Description | Example |
|---|---|---|
| `layer_id` | Which layer this source belongs to | `layer_01_aviation` |
| `source_id` | Unique identifier within the layer | `adsb_exchange` |
| `raw_storage_uri_pattern` | Where raw data lands | `raw/layer_01_aviation/adsb_exchange/{yyyy}/{mm}/{dd}/{fetch_run_id}/payload.json` |
| `collector` | Fetcher module path | `services/fetch-orchestrator/src/layers/layer_01_aviation/adsb_exchange.ts` |
| `validator` | Validation logic path | `services/fetch-orchestrator/src/layers/layer_01_aviation/adsb_exchange.validator.ts` |
| `normalizer` | Normalizer module path | `services/normalizer/src/layers/layer_01_aviation/adsb_exchange.ts` |
| `target_tables` | DB tables written to | `layer_objects`, `layer_object_details` |
| `api_endpoint` | API route | `GET /api/layers/layer_01_aviation/objects` |
| `frontend_layer_id` | Map layer identifier | `layer_01_aviation` |
| `tests` | Test file paths | `tests/data/layer_01_aviation/adsb_exchange.test.ts` |

## MVP Sources (Layer 1: Aviation)

Sources will be defined in the Layer 1 Aviation spec and work orders. No sources are contracted yet.

Candidate sources (to be confirmed):
- ADS-B Exchange (aircraft positions)
- OpenSky Network (aircraft positions)
- OurAirports (airport data)

## Adding a New Source

1. Kiro fills out the contract table for the new source in this file.
2. Kiro creates work orders for Codex (fetcher + normalizer + DB) and Claude Code (endpoint + contract).
3. After API is live, Kiro creates work order for Gemini (layer rendering).
4. No agent starts work on a source without a completed contract entry here.

## Layer 0 Exception

Layer 0 (Globe Core) has no external data sources. It is a frontend-only layer providing the 3D globe foundation.
