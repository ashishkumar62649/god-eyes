# WO-067 Database Live, Static, and History Foundation Review

**Agent:** Codex
**LLM Model:** Codex
**Tool/CLI:** Codex CLI / database application
**Branch:** agent/database-mvp-layer-foundation
**Work Order:** WO-067-DATABASE-LIVE-STATIC-HISTORY-FOUNDATION-REVIEW
**Review time UTC:** 2026-05-25T01:17:20Z
**Task type:** Database review/report first. No migration created.

---

## Executive Summary

The current database foundation is enough for the MVP static aviation slice and does not need a migration today.

The repository already has:

- Core ingestion tables: `fetch_runs`, `raw_objects`.
- Static aviation reference tables: `aviation_airports`, `aviation_runways`, `aviation_navaids`, `aviation_airport_frequencies`, `aviation_countries`, `aviation_regions`.
- Airport intelligence/cache tables: public profiles, intelligence modules, source links, capacity, traffic, and derived intelligence.
- Image asset tables: `airport_image_assets`.
- Layout geometry tables and run tracking: `airport_layout_features`, `airport_layout_fetch_runs`.

The recommended MVP direction is:

1. Keep static geospatial/reference data in normal Postgres/PostGIS tables.
2. Add future live domains as explicit `*_latest` tables for current frontend state.
3. Add future time-series domains as append-only `*_history` tables only when a live source exists.
4. Keep `fetch_runs` and `raw_objects` as the raw ingestion spine; add domain-specific fetch-run tables only when a workflow needs queueing, locking, cache TTL, retries, or source-specific diagnostics.
5. Use a static API layer registry first. Defer database `layer_registry` tables until layers become user-configurable, remotely administered, or independently deployed.

No schema blocker was found that justifies a migration in this work order.

---

## Existing Database Review

| Area | Current State | Assessment |
|---|---|---|
| Core ingestion | `fetch_runs` and `raw_objects` include `layer_id`, `source_id`, run status, storage URI, checksum, validation status, metadata, and raw object uniqueness. | Good MVP raw ingestion spine. Add timestamp/status/source-object indexes later only when query plans require them. |
| Raw storage linkage | Static aviation tables reference `raw_objects(id)`. | Correct. Normalizers can prove provenance back to raw object metadata. |
| Static aviation | Aviation reference tables are layer-aware and source-aware, with source dedupe and PostGIS point indexes for airports/navaids. | Good MVP static foundation. |
| Search indexes | Airport trigram indexes exist for name, ident, IATA, and municipality. | Good for search and details lookup. |
| Coordinate quality | Review and override tables use `source_id + source_object_id`, active override dedupe, and status indexes. | Good audit pattern for future source corrections. |
| Public profile cache | Current cache, append-only versions, and dedicated fetch-run audit exist. | Good example of latest plus history plus run tracking for a cache workflow. |
| Airport intelligence | Module cache, source links, module fetch runs, capacity, traffic, and derived intelligence exist. | Useful pattern, but not a generic live-object model. Keep domain-specific. |
| Image assets | Source-backed image records include rank, hero flag, confidence, fetched/expiry timestamps, source object indexes, and JSONB diagnostics. | Good API-facing asset model. No geometry required. |
| Layout features | Geometry, centroid, bbox, feature/source/status filters, GiST indexes, JSONB diagnostics, dedupe indexes, and fetch runs exist. | Strongest current pattern for viewport rendering. |

---

## Do We Need Layer Registry Tables Now?

Recommendation: **No database layer registry table is needed for MVP.**

Reasoning:

- The layer list is small, stable, and already controlled in docs and contracts.
- Layer 0 and Layer 1 are the only MVP-active layers.
- Current database tables already carry `layer_id` where it matters for ingestion, provenance, static data, and source ownership.
- A DB registry would introduce write coordination and migration obligations before there is a runtime need for admin-managed layers.

Use a static API registry first. The API can expose a hardcoded or contract-backed registry such as:

| Field | Example |
|---|---|
| `layer_id` | `layer_01_aviation` |
| `name` | `Aviation` |
| `status` | `next` or `active` |
| `supports_static` | `true` |
| `supports_latest` | `false` initially |
| `supports_history` | `false` initially |
| `default_visible` | API/frontend decision |
| `endpoints` | aviation static/detail endpoints |

Create DB registry tables later only when one of these becomes true:

- Operators need to enable/disable layers without code deploys.
- Sources become configurable per environment.
- Layer metadata needs audit history.
- Layer permissions or tenant visibility move into the database.
- API contracts need to discover table-backed source capabilities dynamically.

Future DB tables, when justified:

- `layers`: canonical `layer_id`, name, status, display order, lifecycle metadata.
- `layer_sources`: `layer_id`, `source_id`, source type, cadence, license, reliability, enabled flag.
- `layer_capabilities`: static/latest/history/search/bbox/timeline capability flags per layer.

Do not create these today.

---

## Can MVP Use a Static API Registry First?

Recommendation: **Yes.**

The MVP should use a static API registry before a database registry. It keeps ownership clean:

- Kiro/control docs define layer IDs and lifecycle.
- Claude/API exposes a stable registry endpoint.
- Gemini/frontend consumes the API registry and contracts.
- Codex/database keeps `layer_id` and `source_id` in data tables without owning UI layer configuration.

This also avoids a circular dependency where the frontend needs a registry table before enough live layers exist to validate registry semantics.

---

## Static, Latest, and History Model

### Static Data

Static data should remain in normal domain tables:

- `aviation_airports`
- `aviation_runways`
- `aviation_navaids`
- Future: `borders`, `bases`, `ports`, `infrastructure_sites`

Required shape:

- `layer_id`
- `source_id`
- stable source object identifier, preferably named consistently as `source_object_id` in new tables
- domain-specific attributes
- `geom geometry(..., 4326)` where spatial
- `raw_object_id` when normalized from raw ingestion
- `created_at`, `updated_at`

### Latest/Live Snapshot

Live frontend layers should read from `*_latest` tables, not from raw objects or history tables.

Future examples:

- `earth_events_latest`
- `live_aircraft_latest`
- `satellite_positions_latest`
- `maritime_vessels_latest`

Common columns:

| Column | Purpose |
|---|---|
| `id UUID PRIMARY KEY` | Internal row identity |
| `layer_id TEXT NOT NULL` | Layer ownership |
| `source_id TEXT NOT NULL` | Source ownership |
| `source_object_id TEXT NOT NULL` | Dedupe and stable API identity |
| `object_type TEXT NOT NULL` | Aircraft, vessel, satellite, event, etc. |
| `status TEXT` | Active/stale/hidden/error/domain state |
| `observed_at TIMESTAMPTZ NOT NULL` | Source event time |
| `received_at TIMESTAMPTZ NOT NULL` | System receipt time |
| `updated_at TIMESTAMPTZ NOT NULL` | Row update time |
| `expires_at TIMESTAMPTZ` | Staleness pruning and frontend filtering |
| `geom geometry(Point, 4326)` or domain geometry | Viewport query geometry |
| `heading`, `speed`, `altitude`, etc. | Domain-specific current state |
| `payload JSONB` | Source-specific extra fields |
| `raw_object_id UUID` | Optional raw provenance |
| `fetch_run_id` | Optional ingestion/run provenance |

Rule: latest tables are mutable snapshots. Use upsert by `(source_id, source_object_id)` or by `(layer_id, source_id, source_object_id)` if a source ID can repeat across layers.

### History/Time Data

History tables should be append-only and introduced after the matching `*_latest` table exists.

Future examples:

- `earth_events_history`
- `aircraft_tracks_history`
- `satellite_positions_history`
- `maritime_vessels_history`

Common columns:

| Column | Purpose |
|---|---|
| `id UUID PRIMARY KEY` or generated identity | Event/sample identity |
| `layer_id`, `source_id`, `source_object_id` | Ownership and object lineage |
| `observed_at TIMESTAMPTZ NOT NULL` | Timeline key |
| `ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` | Database receipt key |
| `geom geometry(Point/Geometry, 4326)` | Spatiotemporal query |
| `track_id` or `event_id` | Domain grouping where needed |
| `sequence_number` | Optional source ordering |
| `payload JSONB` | Raw normalized detail |
| `raw_object_id` / `fetch_run_id` | Provenance |

Partitioning is not needed on day one. Plan for monthly range partitions by `observed_at` once a history table is expected to exceed a few million rows or receive sustained live updates.

---

## Future Live Tables Needed

Do not create these tables until their source contracts and API needs are approved. The expected order is:

1. `live_aircraft_latest`
2. `aircraft_tracks_history`
3. `earth_events_latest`
4. `earth_events_history`
5. `satellite_positions_latest`
6. `satellite_positions_history`
7. `maritime_vessels_latest`
8. `maritime_vessels_history`

Possible live aircraft MVP shape:

| Table | Role |
|---|---|
| `live_aircraft_latest` | One current row per aircraft/source object for map rendering and detail panel. |
| `aircraft_tracks_history` | Append-only track points for timeline/replay and historical analysis. |
| `aviation_live_fetch_runs` or generic `fetch_runs` only | Use generic `fetch_runs` if each pull creates raw objects; create a domain table only if queueing, locks, retries, or source diagnostics exceed the generic model. |

---

## Fetch Run Strategy

Keep two levels of fetch-run tracking:

1. Generic raw ingestion: `fetch_runs` plus `raw_objects`.
2. Domain workflow runs: dedicated tables only when the workflow is not just "fetch raw file and normalize."

Current examples justify this split:

- `fetch_runs` and `raw_objects` support raw source provenance.
- `airport_public_profile_fetch_runs` supports cache idempotency, requested URLs, HTTP diagnostics, retries, and produced versions.
- `airport_intelligence_fetch_runs` supports module queueing, locks, priority, retry state, and produced module linkage.
- `airport_layout_fetch_runs` supports layout-specific source runs and feature counts.

For future live layers, start with generic `fetch_runs` if raw payloads are persisted. Add a domain fetch-run table only when the live feed needs:

- active in-progress dedupe
- retry scheduling
- source rate-limit state
- partial success diagnostics
- produced latest/history row counts
- lock expiry
- queue priority

---

## Required Index Plan

### Static Geospatial Tables

Required:

- GiST on geometry: `USING GiST(geom)` or `USING GiST(geometry)`.
- Btree on `layer_id`.
- Btree on `source_id`.
- Btree on domain type/category/status fields.
- Unique or partial unique dedupe on `(source_id, source_object_id)`.
- Btree on `raw_object_id`.
- Timestamp indexes for `updated_at`, `fetched_at`, `expires_at`, or `stale_at` when those fields drive refresh jobs.

Current coverage:

- `aviation_airports` and `aviation_navaids` have GiST point indexes.
- `airport_layout_features` has GiST indexes on `geometry`, `centroid`, and `bbox`.
- Layout and image tables have source object and content hash dedupe indexes.

Future improvement when needed:

- Add partial GiST indexes for active renderable objects, for example `WHERE is_active = TRUE`.
- Add composite btree indexes for common filters, such as `(layer_id, category_normalized)` or `(airport_id, feature_type, rank)`.

### Latest Tables

Required for every `*_latest` table:

- Unique dedupe: `(layer_id, source_id, source_object_id)` or `(source_id, source_object_id)`.
- GiST geometry index.
- Btree: `(layer_id, object_type)`.
- Btree: `(status)`.
- Btree: `(observed_at DESC)`.
- Btree: `(updated_at DESC)`.
- Partial btree: `(expires_at) WHERE expires_at IS NOT NULL`.
- Optional partial GiST: geometry for active/non-expired rows only.
- Optional GIN on `payload` only if API filters JSON fields.

### History Tables

Required for every `*_history` table:

- Btree: `(source_id, source_object_id, observed_at DESC)`.
- Btree: `(observed_at DESC)`.
- GiST geometry index.
- Optional BRIN on `observed_at` for very large append-only tables.
- Optional partitioning by `observed_at` after volume is known.
- Optional dedupe unique index on `(source_id, source_object_id, observed_at, content_hash)` if the source can replay samples.

### Fetch Runs and Raw Objects

Current indexes are good for MVP. Future additions to consider:

- `fetch_runs(status, started_at DESC)` for queue/run dashboards.
- `fetch_runs(layer_id, status, started_at DESC)` for layer-scoped operational views.
- `raw_objects(fetched_at DESC)` for recent raw object lookup.
- `raw_objects(layer_id, source_id, fetched_at DESC)` for source audits.
- `raw_objects(checksum_sha256)` if dedupe by checksum becomes common.

Do not add these today without query evidence.

---

## Frontend Speed and 60FPS Query Support

The database should support API endpoints that are fast enough for map movement, but the frontend should not call the database directly.

Recommended query pattern:

```sql
SELECT id, layer_id, source_id, source_object_id, object_type, status, observed_at, geom
FROM live_aircraft_latest
WHERE layer_id = 'layer_01_aviation'
  AND geom && ST_MakeEnvelope(:west, :south, :east, :north, 4326)
  AND (:status IS NULL OR status = :status)
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY observed_at DESC
LIMIT :limit;
```

For static/layout features:

```sql
SELECT id, airport_id, feature_type, geometry_type, geometry
FROM airport_layout_features
WHERE airport_id = :airport_id
  AND is_active = TRUE
  AND geometry && ST_MakeEnvelope(:west, :south, :east, :north, 4326)
ORDER BY rank ASC
LIMIT :limit;
```

API rules for smooth rendering:

- Require bbox/viewport parameters for dense live layers.
- Require a sane `limit`; default low, maximum bounded.
- Return simplified payloads for map views and richer detail payloads by object ID.
- Prefer latest tables for current state.
- Avoid querying append-only history tables during camera movement.
- Use history only for timeline/replay endpoints with explicit time ranges.
- Consider tile/cell aggregation later for dense layers, but do not create tile tables today.

---

## Migration Order

Recommended future order:

1. Keep existing core ingestion migrations first: `fetch_runs`, `raw_objects`.
2. Keep static layer migrations next, one layer/domain at a time.
3. Add static geometry/detail tables before live tables for the same layer.
4. Add `*_latest` live snapshot table once a source contract and API endpoint exist.
5. Add fetch-run extensions only if the generic ingestion spine is insufficient.
6. Add `*_history` after latest ingestion is stable and time/replay requirements are approved.
7. Add partitions/retention policies after volume is measured.
8. Add DB layer registry last, only if runtime registry requirements appear.

For aviation specifically:

1. Existing static aviation reference tables.
2. Existing airport intelligence/cache/layout/image tables.
3. Future `live_aircraft_latest`.
4. Future `aircraft_tracks_history`.
5. Future live aviation fetch-run table only if needed.

---

## What Should Not Be Created Today

Do not create:

- `layers`, `layer_registry`, or `layer_sources` DB tables.
- Generic all-purpose `objects` table that mixes every layer into one row shape.
- History tables before live latest sources are approved.
- Satellite, maritime, weather, cyber, or AI-intelligence tables.
- Materialized viewport/tile tables before API query plans show a real bottleneck.
- New migrations for speculative indexes.
- New migrations to rename existing aviation source ID columns; document consistency for future tables instead.
- Frontend/API/fetcher changes in this work order.

---

## Final Recommendation

No migration is required now.

The MVP should proceed with:

- Current static aviation tables as the static foundation.
- Current raw ingestion tables as the provenance foundation.
- Static API layer registry for MVP layer discovery.
- Future explicit `*_latest` tables for live frontend state.
- Future explicit `*_history` tables for append-only time data.
- Query-driven index additions only after live source contracts and API endpoints exist.
