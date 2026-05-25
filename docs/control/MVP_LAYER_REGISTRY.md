# GOD EYES — MVP Layer Registry

> **Authoritative source of truth for all MVP layers.**
> Any code that references a layer must use the `layer_id` from this registry.
> This file supersedes the older layer lists in `LAYER_ARCHITECTURE.md` and `LAYER_ID_CONVENTIONS.md`.

---

## Registry

| # | Layer ID | Display Name | MVP Status | Type | Source Rule | Database Rule | API Rule | Frontend Rendering Rule | Safety Notes |
|---|----------|-------------|------------|------|------------|--------------|---------|------------------------|-------------|
| 0 | `layer_00_globe_core` | Globe Core | **active** | static | No external sources. Frontend-only foundation layer. | No database tables. | No layer-specific API. | Cesium 3D globe + camera + base map. Must always render first (z=0). Must maintain 60 FPS even with all other layers toggled on. | N/A. Foundation layer — must never crash. |
| 1 | `layer_01_aviation` | Aviation | **active** | live | Sources defined in source catalog. Fetchers in `services/fetch-orchestrator/src/layers/layer_01_aviation/`. Normalizers in `services/normalizer/src/layers/layer_01_aviation/`. Raw storage at `raw/layer_01_aviation/{source_id}/...`. | Live layers need latest snapshot table + history/time tables. Layer-aware tables with `layer_id`, `source_id`, `source_object_id`. | `GET /api/layers/layer_01_aviation/objects`. Must support resident cache mode (preload all). | Map markers (aircraft, airports, routes). Intel panel. Category filters. 60 FPS safe at 85k+ objects. | Real-time tracking data must have 1–5 min cache. No PII. |
| 2 | `layer_02_borders_boundaries` | Borders & Boundaries | **coming_soon** *(next focus)* | static | No real-time fetchers for MVP. Static GeoJSON source in source catalog. Raw storage optional (can be seeded directly to DB). | Single snapshot table. No history table needed for MVP. | `GET /api/layers/layer_02_borders_boundaries/objects`. Returns GeoJSON feature collection. | Polygon/line overlay on globe. Wireframe or filled with opacity. Must be toggleable independently. | **India boundary compliance required.** See `docs/control/BORDERS_BOUNDARIES_POLICY_SOURCE_PLAN.md`. Use Survey of India official depiction. Natural Earth and OSM rejected for India. All disputed territories require individual review. |
| 3 | `layer_03_earth_events` | Earth Events | **active** | live | USGS earthquake API, volcanic activity feeds, weather alerts. Fetchers and normalizers follow standard layer pattern. | Latest snapshot + history/time tables. Tables: `earth_events_latest`, `earth_events_history`. | Actual: `GET /api/earth-events/latest`. Future generic: `GET /api/layers/layer_03_earth_events/objects`. | Animated markers (pulsing, color-coded by severity). Timeline scrubber support. | Earthquake/tsunami alerts are time-critical. Cache must be short (< 5 min). Must not cause alert fatigue. |
| 4 | `layer_04_public_military_security` | Public Military & Security | **coming_soon** | static (MVP only) | **Public-only sources for MVP.** No classified, no sensitive-source feeds. Static datasets only (e.g. public defense installations, open-source military bases, published security reports). | Single snapshot table. No live tracking table. No history required for MVP. | `GET /api/layers/layer_04_public_military_security/objects`. Read-only. No write endpoint. | Static markers for known public installations. No live tracking, no movement animation. Pulsing or blinking markers prohibited. Must not imply real-time surveillance. | **HIGH SAFETY:** Public-only. Static-only. No real-time tracking. No sensitive coordinate data. No drone/UAV paths. All data must be from open, published, verifiable sources. Any new source requires explicit Kiro approval. Must include disclaimer in UI: "Publicly available information only." |
| 5 | `layer_05_space_satellites` | Space & Satellites | **coming_soon** | live | Public TLE feeds (Space-Track, CelesTrak). Satellite catalog sources. Fetchers in `services/fetch-orchestrator/src/layers/layer_05_space_satellites/`. | Latest snapshot (current orbits) + history/time tables (track changes). | `GET /api/layers/layer_05_space_satellites/objects`. Support TLE/orbital params in response. | 3D orbital path rendering on globe. Satellite markers with orbital tracks. Must be performant with thousands of objects. | Debris tracking may be sensitive. Use public TLE data only. No classified satellite references. |
| 6 | `layer_06_maritime` | Maritime | **coming_soon** | live | AIS data providers (MarineTraffic, AISHub, etc.). Vessel position feeds. Port databases. Fetchers + normalizers follow standard pattern. | Latest snapshot + history/time tables. | `GET /api/layers/layer_06_maritime/objects`. Support MMSI/IMO queries. | Vessel markers (heading-aware icons). Port markers. Route lines. 60 FPS with filtering. | AIS data has privacy implications for private vessels. Consider filtering/protecting certain vessel types. No pirate/privacy-sensitive zone data without explicit spec. |
| 7 | `layer_07_infrastructure` | Infrastructure | **coming_soon** | static | Public infrastructure datasets (power grids, fiber optic cables, water systems, transportation networks). Static GeoJSON or seeded DB. | Single snapshot table. No history for MVP. | `GET /api/layers/layer_07_infrastructure/objects`. May support category/type filtering. | Network line overlays, node markers. Opacity/zoom toggle for dense areas. | Infrastructure data is sensitive in aggregate. Use public/open datasets only. No critical infrastructure detail that aids targeting. Verify data classification before adding any source. |
| 8 | `layer_08_news_osint` | News & OSINT | **coming_soon** | live | RSS/API news feeds, OSINT aggregators. Geotagged news sources. Fetchers fetch on schedule. | Latest snapshot + history/time tables for trend analysis. | `GET /api/layers/layer_08_news_osint/objects`. Support text search and date range. | News markers with headlines. Expandable cards on click. Timeline view. Cluster markers for dense areas. | OSINT sources must be vetted. No fake news/propaganda sources. Respect copyright and fair use. Must include source attribution for every item. |
| 9 | `layer_09_user_shapes` | User Shapes | **coming_soon** | static | User-created polygons/lines/markers stored in database. No external fetchers. API writes from frontend. | User shapes table with `layer_id`, `user_id`, `geometry`, `properties`, timestamps. | `GET /api/layers/layer_09_user_shapes/objects` + `POST /api/layers/layer_09_user_shapes/objects` (authenticated). | User-drawn shapes on globe. Edit, delete, visibility toggle. Persist across sessions. | Must authenticate all writes. Validate geometry to prevent malformed data. Rate-limit per user. Data privacy — users own their shapes. |

---

## MVP Status Definitions

| Status | Meaning | UI Behavior |
|--------|---------|-------------|
| `active` | Layer is fully implemented with real data. | Layer toggle is enabled. Data renders on globe. |
| `coming_soon` | Layer is in the layer registry but not yet implemented. | Layer toggle is visible but disabled. Shows "Coming Soon" or "No data yet" badge/tooltip. Never shows fake/demo data. |
| `no_data` | Layer exists in frontend but no data sources configured. | Layer toggle is visible but shows "No data sources" indicator. |

---

## Important Product Rules

1. **Aviation** (`layer_01_aviation`) is the only fully active data layer for MVP.
2. All other data layers must be visible in the UI as **Coming Soon** or **No data yet**.
3. **No fake demo data** — if a layer has no real data, display empty state, not placeholder markers.
4. **Public Military/Security** (`layer_04_public_military_security`) must be **public-only** and **static-only** for MVP. No live tracking, no real-time updates, no animation.
5. **Live layers** (layers marked `live` above) ultimately need **latest snapshot tables** and **history/time tables** when fully implemented.
6. **Frontend must stay 60 FPS safe** at all times, across all layers. Each layer's rendering must be independently toggleable and should not degrade performance when visible but idle.
7. **Generic layer API** is the recommended pattern:
   - `GET /api/layers` — list all layers with status
   - `GET /api/layers/:layerId/objects` — get objects for a specific layer
   - `GET /api/layers/:layerId/objects/:objectId` — get a single object
   - Future: `GET /api/layers/:layerId/status` — per-layer status

---

## Deprecation Notice

This registry replaces the older layer lists in:
- `LAYER_ARCHITECTURE.md` (lines 9–17, old 7-layer list)
- `LAYER_ID_CONVENTIONS.md` (lines 13–22, old 7-layer list)

The old layers `layer_02_satellite`, `layer_03_maritime`, `layer_04_weather_disasters`, `layer_05_cyber_infrastructure`, and `layer_06_ai_intelligence` have been superseded by the new 10-layer registry above.

---

## Change Process

To add, remove, or modify a layer:
1. Create a work order for Kiro CLI.
2. Update this file.
3. Update `LAYER_ARCHITECTURE.md` and `LAYER_ID_CONVENTIONS.md` to match.
4. Update `CURRENT_PROJECT_STATE.md`.
5. Create handoff entries for affected agents.

---

**Last updated:** 2026-05-26
**Author:** Kiro CLI (WO-075-076-EARTH-EVENTS-CLOSEOUT-AND-BORDERS-POLICY-PLAN)
**LLM:** Claude Sonnet 4.5
