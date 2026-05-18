# Airport Intelligence Schema Plan

WO-035-CODEX-DATABASE-RESEARCH designs a modular database architecture for
airport intelligence caching in `layer_01_aviation`. This is a research/design
document only. It does not create migrations, alter tables, or change app code.

## Purpose

The existing public profile cache covers summary/profile enrichment from
Wikipedia/Wikidata. The next airport intelligence layer should support slower
changing modules such as capacity, traffic/growth, layout, source confidence,
and derived capability tags while keeping each module independently cacheable.

Design goals:

- Use database cache first.
- Fetch on click when a module is missing or stale.
- Refresh by per-module TTL.
- Support bulk backfill for many or all airports later.
- Avoid one giant JSON blob.
- Keep typed columns for queryable aviation intelligence.
- Store source attribution, license, and confidence.
- Track partial module readiness independently.
- Preserve `aviation_airports` as source-derived reference data.

## Existing Tables To Keep

Keep the current public-profile tables for profile-summary use:

- `airport_public_profiles`
- `airport_public_profile_versions`
- `airport_public_profile_fetch_runs`

These should remain responsible for:

- current public profile summary and payload.
- Wikipedia/Wikidata profile attribution.
- public profile version history.
- public profile fetch attempts.
- the later `GET /api/airports/:airportId/public-profile` endpoint.

Do not move profile summaries, Wikipedia extracts, or public-profile version
history into the broader intelligence tables. The broader system should link to
the same airport identity model and can reuse source/link metadata patterns.

## Recommended New Tables

Recommended first architecture:

1. `airport_intelligence_modules`
2. `airport_source_links`
3. `airport_capacity_profiles`
4. `airport_traffic_metrics`
5. `airport_layout_profiles`
6. `airport_derived_intelligence`
7. `airport_intelligence_fetch_runs`
8. `airport_backfill_runs`
9. `airport_backfill_run_items`

The core pattern is:

```text
aviation_airports
  1 -> many airport_intelligence_modules
  1 -> many airport_source_links
  1 -> 0..1 airport_capacity_profiles
  1 -> many airport_traffic_metrics
  1 -> 0..1 airport_layout_profiles
  1 -> 0..1 airport_derived_intelligence
  1 -> many airport_intelligence_fetch_runs

airport_backfill_runs
  1 -> many airport_backfill_run_items
```

Each intelligence module gets its own status, TTL, source coverage, and error
state. Module-specific tables store typed, queryable current data.

## Shared Identity Model

All proposed tables should include:

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `layer_id TEXT NOT NULL DEFAULT 'layer_01_aviation'`
- `source_id TEXT NOT NULL`
- `source_airport_id TEXT NOT NULL`
- `airport_id UUID` referencing `aviation_airports(id)` when safe.
- `airport_ident TEXT`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ` for current-state tables.

Recommended source identity:

```sql
layer_id = 'layer_01_aviation'
source_id = aviation_airports.source_id
source_airport_id = aviation_airports.source_airport_id
```

For enrichment sources such as Wikipedia, Wikidata, OSM, airport authority
pages, or civil aviation stats, store the content provenance in
`airport_source_links` and module source fields. Do not replace the airport
identity source with the enrichment source.

## Table: airport_intelligence_modules

### Why This Table Exists

`airport_intelligence_modules` is the per-airport module status registry. It
lets the API answer "what is ready?" without joining every module table.

One row per airport and module:

- `capacity`
- `traffic`
- `layout`
- `derived_intelligence`
- future modules such as `operations`, `ownership`, `weather_context`, or
  `route_network`

### Proposed Columns

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | Primary key. |
| `layer_id` | `TEXT` | `layer_01_aviation`. |
| `source_id` | `TEXT` | Airport identity source. |
| `source_airport_id` | `TEXT` | Airport identity object id. |
| `airport_id` | `UUID` | FK to `aviation_airports(id)` when safe. |
| `airport_ident` | `TEXT` | Denormalized helper. |
| `module_key` | `TEXT` | `capacity`, `traffic`, `layout`, `derived_intelligence`, etc. |
| `module_status` | `TEXT` | `ok`, `fetching`, `stale`, `no_data`, `low_confidence`, `error`. |
| `cache_ttl_seconds` | `INTEGER` | Per-module TTL. |
| `fetched_at` | `TIMESTAMPTZ` | Last fetch attempt. |
| `last_successful_fetch_at` | `TIMESTAMPTZ` | Last successful module fetch. |
| `last_changed_at` | `TIMESTAMPTZ` | Last content hash change. |
| `stale_at` | `TIMESTAMPTZ` | Refresh should be queued after this time. |
| `expires_at` | `TIMESTAMPTZ` | Hard freshness boundary. |
| `next_refresh_at` | `TIMESTAMPTZ` | Scheduler hint. |
| `latest_fetch_run_id` | `UUID` | Latest module fetch run pointer. |
| `latest_successful_fetch_run_id` | `UUID` | Latest successful fetch run pointer. |
| `content_hash` | `TEXT` | Hash of the current module payload. |
| `source_confidence_score` | `NUMERIC(5,4)` | Aggregate source confidence from 0 to 1. |
| `confidence_status` | `TEXT` | `unknown`, `low`, `medium`, `high`, `verified`. |
| `error_code` | `TEXT` | Latest module error code. |
| `error_message` | `TEXT` | Sanitized error message. |
| `metadata` | `JSONB` | Small operational metadata only. |
| `created_at` | `TIMESTAMPTZ` | Creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | Last update timestamp. |

### Constraints And Indexes

- Unique: `(layer_id, source_id, source_airport_id, module_key)`.
- Index: `(airport_id, module_key)` where `airport_id IS NOT NULL`.
- Index: `(module_key, module_status)`.
- Index: `(module_key, stale_at)` where `stale_at IS NOT NULL`.
- Index: `(module_key, next_refresh_at)` where `next_refresh_at IS NOT NULL`.
- Index: `(confidence_status)`.

## Module Status Design

Use one shared status vocabulary:

| Status | Meaning |
|---|---|
| `ok` | Module has usable cached data and is within freshness policy. |
| `fetching` | A fetch run is queued or running. |
| `stale` | Cached data exists, but `stale_at` has passed. It can still be served with stale-while-revalidate behavior. |
| `no_data` | Sources were checked and no trustworthy data was found. |
| `low_confidence` | Data exists but source confidence is below the display threshold. |
| `error` | Latest fetch failed and there is no usable current module state, or the failure blocks refresh. |

API behavior should prefer cached data when status is `ok`, `stale`, or
`low_confidence` with explicit confidence metadata. For `fetching`, the API can
return partial data if current cached rows exist, otherwise return a fetching
state. For `no_data`, do not re-fetch on every click until TTL expires.

## TTL Strategy

TTL should be per module because most airport intelligence is slow-changing, but
different domains change at different rates.

Recommended initial TTLs:

| Module | Suggested TTL | Reason |
|---|---:|---|
| `capacity` | 90 days | Runways, terminal count, gates, and design capacity change slowly. |
| `traffic` | 30 days for monthly metrics, 180 days for annual historical rows | Monthly or annual statistics may be published on delayed cycles. |
| `layout` | 180 days | OSM geometry/layout changes slowly and can be expensive to parse. |
| `derived_intelligence` | 30 days | Derived tags should refresh when source modules change. |
| `source_links` | 180 days | Source URLs and licenses change slowly but should be rechecked. |

Implementation rule:

- `stale_at = last_successful_fetch_at + cache_ttl_seconds`.
- `next_refresh_at` can be earlier than `stale_at` for bulk refresh planning.
- `expires_at` should be optional for slow-changing modules. If used, set it to
  `stale_at + stale_while_revalidate_seconds`.
- Store TTL on `airport_intelligence_modules`, not just in code, so backfill and
  API logic can make consistent decisions.

## Table: airport_source_links

### Why This Table Exists

`airport_source_links` stores source URLs, licenses, retrieval metadata, and
source confidence by airport and module. It prevents attribution from being
duplicated across capacity, traffic, layout, and derived tables.

### Proposed Columns

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | Primary key. |
| `layer_id` | `TEXT` | Layer id. |
| `source_id` | `TEXT` | Airport identity source. |
| `source_airport_id` | `TEXT` | Airport identity object id. |
| `airport_id` | `UUID` | FK to `aviation_airports(id)` when safe. |
| `module_key` | `TEXT` | Module this source supports, or `shared`. |
| `source_name` | `TEXT` | `wikipedia`, `wikidata`, `osm`, `airport_authority`, `caa_stats`, etc. |
| `source_type` | `TEXT` | `reference`, `official`, `open_data`, `map`, `statistics`, `derived`. |
| `source_url` | `TEXT` | Canonical URL. |
| `source_record_id` | `TEXT` | External id such as Wikidata QID or OSM way/relation id. |
| `license_name` | `TEXT` | License label. |
| `license_url` | `TEXT` | License URL. |
| `attribution_text` | `TEXT` | Required display or audit attribution. |
| `retrieved_at` | `TIMESTAMPTZ` | Last retrieval timestamp. |
| `source_revision` | `TEXT` | Revision id, version id, or publication period. |
| `valid_from` | `TIMESTAMPTZ` | Source record validity start if known. |
| `valid_to` | `TIMESTAMPTZ` | Source record validity end if known. |
| `confidence_score` | `NUMERIC(5,4)` | Source-specific confidence. |
| `confidence_reason` | `TEXT` | Short explanation. |
| `is_primary_for_module` | `BOOLEAN` | Preferred source for module. |
| `metadata` | `JSONB` | Source-specific details that are not queried often. |
| `created_at` | `TIMESTAMPTZ` | Creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | Last update timestamp. |

### Indexes

- Unique optional: `(airport_id, module_key, source_name, source_url)` where
  `airport_id IS NOT NULL`.
- Index: `(layer_id, source_id, source_airport_id, module_key)`.
- Index: `(source_name, source_record_id)` where `source_record_id IS NOT NULL`.
- Index: `(module_key, confidence_score)`.

## Table: airport_capacity_profiles

### Why This Table Exists

`airport_capacity_profiles` stores current capacity-related facts in typed
columns. Capacity is not a single number; it includes runway, terminal, gate,
passenger, cargo, and operating capability dimensions.

### Typed Columns

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | Primary key. |
| `airport_id` | `UUID` | FK to `aviation_airports(id)`. |
| `layer_id`, `source_id`, `source_airport_id` | `TEXT` | Identity fields. |
| `airport_ident` | `TEXT` | Denormalized helper. |
| `terminal_count` | `INTEGER` | Known terminal count. |
| `gate_count` | `INTEGER` | Known gate/stand count if published. |
| `runway_count` | `INTEGER` | Derived from `aviation_runways` or trusted source. |
| `longest_runway_ft` | `INTEGER` | Useful query/filter field. |
| `max_runway_width_ft` | `INTEGER` | Useful capability field. |
| `has_lighted_runway` | `BOOLEAN` | Derived from runway data. |
| `has_paved_runway` | `BOOLEAN` | Derived from runway surfaces. |
| `passenger_capacity_annual` | `BIGINT` | Published/design passenger capacity. |
| `cargo_capacity_tonnes_annual` | `NUMERIC` | Published/design cargo capacity. |
| `aircraft_stand_count` | `INTEGER` | Apron/stand count when source exists. |
| `jet_bridge_count` | `INTEGER` | Optional facility count. |
| `capacity_source_year` | `INTEGER` | Source publication year. |
| `capacity_confidence_score` | `NUMERIC(5,4)` | Aggregate confidence. |
| `source_link_id` | `UUID` | Primary source pointer. |
| `module_status` | `TEXT` | Mirror/current status for direct reads. |
| `metadata` | `JSONB` | Non-query details, e.g. source notes. |
| `created_at`, `updated_at` | `TIMESTAMPTZ` | Timestamps. |

### What Stays JSONB

Use JSONB for details like terminal names, source footnotes, or source-specific
capacity categories. Do not store runway count, longest runway, annual capacity,
or confidence only in JSONB because they are likely API/query/filter fields.

### Indexes

- Unique: `(layer_id, source_id, source_airport_id)`.
- Index: `(airport_id)` where `airport_id IS NOT NULL`.
- Index: `(passenger_capacity_annual DESC)` where not null.
- Index: `(cargo_capacity_tonnes_annual DESC)` where not null.
- Index: `(longest_runway_ft DESC)` where not null.
- Index: `(capacity_confidence_score)`.
- Optional composite: `(has_paved_runway, has_lighted_runway)`.

## Table: airport_traffic_metrics

### Why This Table Exists

`airport_traffic_metrics` stores annual and monthly traffic observations as
time-series rows instead of overwriting a single current profile. This supports
growth charts, comparisons, and source-aware revisions.

### Proposed Columns

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | Primary key. |
| `airport_id` | `UUID` | FK to `aviation_airports(id)`. |
| `layer_id`, `source_id`, `source_airport_id` | `TEXT` | Identity fields. |
| `metric_type` | `TEXT` | `passengers`, `aircraft_movements`, `cargo_tonnes`, `international_passengers`, etc. |
| `period_granularity` | `TEXT` | `annual`, `monthly`, `quarterly`. |
| `period_start` | `DATE` | First day of period. |
| `period_end` | `DATE` | Last day of period. |
| `metric_value` | `NUMERIC` | Value. |
| `unit` | `TEXT` | `passengers`, `movements`, `tonnes`. |
| `rank_national` | `INTEGER` | Optional rank in source context. |
| `rank_global` | `INTEGER` | Optional rank in source context. |
| `growth_abs` | `NUMERIC` | Optional derived change from prior comparable period. |
| `growth_pct` | `NUMERIC(8,4)` | Optional derived percentage. |
| `is_estimated` | `BOOLEAN` | Estimate flag. |
| `is_preliminary` | `BOOLEAN` | Preliminary source flag. |
| `source_link_id` | `UUID` | Source pointer. |
| `source_confidence_score` | `NUMERIC(5,4)` | Confidence for this metric row. |
| `metadata` | `JSONB` | Publication table id, notes, footnotes. |
| `created_at`, `updated_at` | `TIMESTAMPTZ` | Timestamps. |

### Constraints And Indexes

- Unique: `(airport_id, metric_type, period_granularity, period_start,
  source_link_id)` where `airport_id IS NOT NULL`.
- Index: `(airport_id, metric_type, period_start DESC)`.
- Index: `(metric_type, period_granularity, period_start DESC)`.
- Index: `(metric_type, metric_value DESC)` for rankings.
- Index: `(source_confidence_score)`.

Use rows, not columns, for metric values. Traffic metrics evolve and may have
multiple periods and sources.

## Table: airport_layout_profiles

### Why This Table Exists

`airport_layout_profiles` stores current layout metadata from OSM or another
open map source without trying to replace normalized runway tables or frontend
map rendering data.

### Proposed Columns

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | Primary key. |
| `airport_id` | `UUID` | FK to `aviation_airports(id)`. |
| `layer_id`, `source_id`, `source_airport_id` | `TEXT` | Identity fields. |
| `layout_source` | `TEXT` | `osm`, `ourairports`, future open source. |
| `osm_relation_id` | `TEXT` | OSM relation id when present. |
| `osm_way_ids` | `JSONB` | List of relevant way ids. |
| `osm_version` | `TEXT` | OSM object version/replication sequence. |
| `layout_bbox` | `JSONB` | Bounding box if PostGIS geometry is not added yet. |
| `airport_boundary_geom` | `geometry` | Future optional PostGIS polygon/multipolygon. |
| `runway_geom_count` | `INTEGER` | Count of runway geometries found. |
| `taxiway_geom_count` | `INTEGER` | Count of taxiway geometries found. |
| `apron_geom_count` | `INTEGER` | Count of apron geometries found. |
| `terminal_geom_count` | `INTEGER` | Count of terminal geometries found. |
| `has_terminal_geometry` | `BOOLEAN` | Derived layout flag. |
| `has_airport_boundary` | `BOOLEAN` | Derived layout flag. |
| `layout_confidence_score` | `NUMERIC(5,4)` | Confidence in matched layout. |
| `source_link_id` | `UUID` | Primary OSM/source pointer. |
| `metadata` | `JSONB` | Tags, unresolved ids, match diagnostics. |
| `created_at`, `updated_at` | `TIMESTAMPTZ` | Timestamps. |

### OSM Storage Recommendation

For the first layout migration, store metadata and counts, not full OSM raw
payloads. If geometry is required later, add PostGIS columns or a separate
`airport_layout_geometries` table with typed geometry rows. Keep raw OSM
responses out of the database unless there is an approved raw storage policy.

### Indexes

- Unique: `(layer_id, source_id, source_airport_id, layout_source)`.
- Index: `(airport_id)` where not null.
- Index: `(osm_relation_id)` where not null.
- Optional GiST index on `airport_boundary_geom` if geometry is added.
- Index: `(layout_confidence_score)`.

## Table: airport_derived_intelligence

### Why This Table Exists

`airport_derived_intelligence` stores computed capability tags and confidence
derived from source modules. It should be reproducible from inputs and not
treated as source data.

### Proposed Columns

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | Primary key. |
| `airport_id` | `UUID` | FK to `aviation_airports(id)`. |
| `layer_id`, `source_id`, `source_airport_id` | `TEXT` | Identity fields. |
| `capability_tags` | `TEXT[]` | Queryable tags such as `long_haul_capable`, `cargo_capable`, `major_hub_candidate`. |
| `operational_scale` | `TEXT` | `local`, `regional`, `national`, `international`, `global_hub`. |
| `runway_capability_class` | `TEXT` | Derived class from runway length/surface/lighted flags. |
| `traffic_scale_class` | `TEXT` | Derived from traffic metrics. |
| `cargo_capability_class` | `TEXT` | Derived cargo class. |
| `layout_complexity_class` | `TEXT` | Derived from layout counts/geometries. |
| `confidence_score` | `NUMERIC(5,4)` | Aggregate confidence. |
| `low_confidence_reasons` | `TEXT[]` | Queryable reasons. |
| `derived_from_module_hashes` | `JSONB` | Input module hashes for reproducibility. |
| `ruleset_version` | `TEXT` | Capability ruleset version. |
| `computed_at` | `TIMESTAMPTZ` | Computation timestamp. |
| `metadata` | `JSONB` | Explainability notes and non-query diagnostics. |
| `created_at`, `updated_at` | `TIMESTAMPTZ` | Timestamps. |

### Derived Tag Principles

- Store derived tags in typed/text-array fields for filtering.
- Store explainability and input hashes in JSONB.
- Recompute when capacity, traffic, or layout hashes change.
- Never overwrite source measurements because a derived tag changed.

### Indexes

- Unique: `(layer_id, source_id, source_airport_id)`.
- GIN index on `capability_tags`.
- Index: `(operational_scale)`.
- Index: `(runway_capability_class)`.
- Index: `(traffic_scale_class)`.
- Index: `(confidence_score)`.

## Table: airport_intelligence_fetch_runs

### Why This Table Exists

`airport_intelligence_fetch_runs` generalizes public-profile fetch runs for
multiple modules. A single fetch run may target one module or a small module
set, but module status should be updated independently.

### Proposed Columns

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | Primary key. |
| `layer_id`, `source_id`, `source_airport_id` | `TEXT` | Identity fields. |
| `airport_id` | `UUID` | FK when safe. |
| `airport_ident` | `TEXT` | Denormalized helper. |
| `module_key` | `TEXT` | Primary module. Use `all` only for backfill orchestration. |
| `requested_modules` | `TEXT[]` | Module set requested. |
| `run_type` | `TEXT` | `click_fetch`, `scheduled_refresh`, `backfill`, `manual_retry`. |
| `run_status` | `TEXT` | `queued`, `running`, `completed`, `failed`, `skipped`, `partial`. |
| `idempotency_key` | `TEXT` | Duplicate prevention. |
| `in_progress_key` | `TEXT` | Partial unique active-job key. |
| `backfill_run_id` | `UUID` | Pointer to bulk run when applicable. |
| `backfill_item_id` | `UUID` | Pointer to item when applicable. |
| `started_at`, `completed_at` | `TIMESTAMPTZ` | Runtime timestamps. |
| `duration_ms` | `INTEGER` | Runtime. |
| `requested_urls` | `JSONB` | URLs requested. |
| `successful_source_link_ids` | `UUID[]` | Sources that succeeded. |
| `failed_urls` | `JSONB` | Sanitized failures. |
| `http_statuses` | `JSONB` | Response status metadata. |
| `records_examined` | `INTEGER` | Count of source records/pages. |
| `records_changed` | `INTEGER` | Count of changed module records. |
| `content_changed` | `BOOLEAN` | Any module content changed. |
| `error_code`, `error_message` | `TEXT` | Sanitized error fields. |
| `metadata` | `JSONB` | Worker/version/module diagnostics. |
| `created_at` | `TIMESTAMPTZ` | Creation timestamp. |

### Multiple Module Fetch Runs

Use `requested_modules` to track multi-module jobs, but update
`airport_intelligence_modules` per module. A run can be `partial` if capacity
succeeds and traffic fails.

### Duplicate Job Strategy

- `idempotency_key`: deterministic key for module, airport, run type, and
  freshness window.
- `in_progress_key`: deterministic active key, e.g.
  `layer_01_aviation:ourairports:5235:capacity`.
- Partial unique index on `in_progress_key` where `run_status IN ('queued',
  'running')`.
- Workers claim with `UPDATE ... WHERE run_status = 'queued' RETURNING ...`
  or `FOR UPDATE SKIP LOCKED`, depending on the final runner style.
- Stale running jobs use `lock_expires_at` and can be marked failed/retried.

### Indexes

- Unique: `idempotency_key`.
- Partial unique: `in_progress_key` for active statuses.
- Index: `(module_key, run_status, started_at DESC)`.
- Index: `(layer_id, source_id, source_airport_id, module_key)`.
- Index: `(backfill_run_id, run_status)`.
- Index: `(retry_after_at)` if retry scheduling is added.

## Tables: airport_backfill_runs And airport_backfill_run_items

### Why These Tables Exist

Bulk backfills need durable progress tracking. The system should resume after a
worker restart without guessing which airports were processed.

### airport_backfill_runs Columns

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | Primary key. |
| `layer_id` | `TEXT` | `layer_01_aviation`. |
| `run_name` | `TEXT` | Human-readable name. |
| `requested_modules` | `TEXT[]` | Modules included. |
| `selection_filter` | `JSONB` | Filter snapshot, e.g. country/category/limit. |
| `run_status` | `TEXT` | `queued`, `running`, `completed`, `failed`, `paused`, `cancelled`. |
| `total_items` | `INTEGER` | Planned item count. |
| `queued_items` | `INTEGER` | Queued count. |
| `completed_items` | `INTEGER` | Completed count. |
| `failed_items` | `INTEGER` | Failed count. |
| `skipped_items` | `INTEGER` | Skipped/no_data count. |
| `started_at`, `completed_at` | `TIMESTAMPTZ` | Runtime timestamps. |
| `created_by` | `TEXT` | Agent/tool/user. |
| `resume_token` | `TEXT` | Optional cursor for source selection. |
| `error_code`, `error_message` | `TEXT` | Sanitized failure. |
| `metadata` | `JSONB` | Worker config, rate limits, source policy. |
| `created_at`, `updated_at` | `TIMESTAMPTZ` | Timestamps. |

### airport_backfill_run_items Columns

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | Primary key. |
| `backfill_run_id` | `UUID` | FK to `airport_backfill_runs`. |
| `airport_id` | `UUID` | FK to `aviation_airports(id)`. |
| `layer_id`, `source_id`, `source_airport_id` | `TEXT` | Identity fields. |
| `airport_ident` | `TEXT` | Denormalized helper. |
| `module_key` | `TEXT` | Module for this item. |
| `item_status` | `TEXT` | `queued`, `running`, `completed`, `failed`, `skipped`, `no_data`. |
| `fetch_run_id` | `UUID` | Latest module fetch run for this item. |
| `attempt_count` | `INTEGER` | Retry count. |
| `last_attempt_at` | `TIMESTAMPTZ` | Last worker attempt. |
| `next_attempt_at` | `TIMESTAMPTZ` | Retry/backoff. |
| `error_code`, `error_message` | `TEXT` | Sanitized item failure. |
| `created_at`, `updated_at` | `TIMESTAMPTZ` | Timestamps. |

### Backfill/Resume Strategy

1. Create `airport_backfill_runs` with selected modules and filter snapshot.
2. Materialize item rows in `airport_backfill_run_items`.
3. Workers claim queued items with `FOR UPDATE SKIP LOCKED` or atomic
   `UPDATE ... RETURNING`.
4. Each item creates or reuses one `airport_intelligence_fetch_runs` row.
5. On success, update module table, module status, fetch run, and item status.
6. On failure, increment `attempt_count`, set `next_attempt_at`, and keep the
   item resumable.
7. Pausing a run stops new item claims but does not roll back completed items.
8. Resuming a run processes items where status is `queued` or retry-eligible.

### Backfill Indexes

- `airport_backfill_runs`: `(run_status, created_at DESC)`.
- `airport_backfill_run_items`: `(backfill_run_id, item_status)`.
- `airport_backfill_run_items`: `(item_status, next_attempt_at)`.
- `airport_backfill_run_items`: `(airport_id, module_key)`.
- Unique item guard: `(backfill_run_id, airport_id, module_key)`.

## Typed Columns Vs JSONB

Use typed columns for data that the API, filters, maps, or analytics will query:

- airport identity and module key.
- module status and TTL timestamps.
- source confidence and confidence status.
- capacity counts and major capacity values.
- traffic metric period, type, value, and unit.
- OSM ids, geometry counts, and layout flags.
- derived capability tags/classes.
- run statuses, idempotency keys, and retry timestamps.

Use JSONB for:

- source-specific raw-ish metadata after sanitization.
- footnotes and attribution details that vary by source.
- low-frequency diagnostics.
- derived input hashes.
- parser/worker metadata.
- selection filters for backfill runs.

Avoid JSONB for:

- traffic values.
- capacity values.
- statuses.
- source confidence.
- timestamps.
- ids used in joins.
- fields needed for map filtering or sorting.

## Progressive Enrichment Modules

Recommended implementation order:

1. `source_links`: common attribution and confidence foundation.
2. `intelligence_modules`: module status registry.
3. `capacity`: mostly derived from existing runways plus public sources.
4. `traffic`: annual metrics first, monthly later.
5. `derived_intelligence`: capability tags from capacity + traffic.
6. `layout`: OSM metadata and geometry only after source matching rules are
   settled.
7. `backfill`: after one or two modules work reliably on click-fetch.

This order keeps the first migrations small and avoids coupling OSM geometry or
bulk orchestration to the first capacity/traffic work.

## Source Confidence Model

Use a numeric score plus explicit reason:

- `1.0000`: direct official airport/statistics source with clear license.
- `0.9000`: Wikidata/OSM with strong identity match and revision metadata.
- `0.7500`: public source with good match but no official status.
- `0.5000`: plausible source with partial identity match.
- `<0.5000`: low confidence, do not expose as authoritative.

Confidence should be stored per source link and rolled up to module-level
`source_confidence_score`. Derived intelligence should have its own confidence
based on the input module confidence scores.

## What Should Stay In Current Public Profile Tables

Keep these in `airport_public_profiles` and related version/fetch tables:

- profile summary text.
- public-profile payload for `GET /api/airports/:airportId/public-profile`.
- Wikipedia/Wikidata profile attribution.
- public profile stale/refresh status.
- public profile fetch attempts.
- profile version history.

Do not add capacity, traffic time-series, OSM layout metadata, or capability
tags to `airport_public_profiles` except as read-only summary snippets generated
by future API composition.

## Migration Packaging Recommendation

Do not create one migration with all nine tables unless the next work order
needs the whole system. Prefer staged migrations:

1. Module/source foundation:
   `airport_intelligence_modules`, `airport_source_links`,
   `airport_intelligence_fetch_runs`.
2. Capacity module:
   `airport_capacity_profiles`.
3. Traffic module:
   `airport_traffic_metrics`.
4. Derived intelligence:
   `airport_derived_intelligence`.
5. Layout module:
   `airport_layout_profiles` and optional geometry follow-up.
6. Backfill orchestration:
   `airport_backfill_runs`, `airport_backfill_run_items`.

Each migration should have tests that verify additive behavior, no mutation of
`aviation_airports`, required indexes, status checks, and no future modules
accidentally mixed into a smaller work order.

## WO-036 Stage 1 Implementation Notes

WO-036 implements only the module-cache foundation from the canonical WO-035
design. The migration file is:

`database/migrations/layers/layer_01_aviation/006_airport_intelligence_foundation.sql`

Stage 1 creates:

- `airport_intelligence_modules`: per-airport, per-module cache status and
  lightweight module payload table.
- `airport_source_links`: source URL/entity/license/attribution/confidence
  table shared by airport intelligence modules.
- `airport_intelligence_fetch_runs`: module-level fetch job and audit table.

Stage 1 does not change:

- `aviation_airports`
- `airport_public_profiles`
- `airport_public_profile_versions`
- `airport_public_profile_fetch_runs`

### Stage 1 Statuses

`airport_intelligence_modules.module_key` is constrained to:

- `overview`
- `capability`
- `capacity`
- `traffic`
- `infrastructure`
- `sources`
- `advanced_details`

`airport_intelligence_modules.module_status` is constrained to:

- `ok`
- `fetching`
- `stale`
- `no_data`
- `low_confidence`
- `error`

`airport_intelligence_modules.cache_state` is constrained to:

- `fresh`
- `stale`
- `expired`
- `refresh_queued`
- `refresh_running`
- `failed`

`airport_intelligence_fetch_runs.run_type` is constrained to:

- `lazy_fetch`
- `refresh`
- `backfill`
- `manual`
- `retry`

`airport_intelligence_fetch_runs.run_status` is constrained to:

- `queued`
- `running`
- `completed`
- `failed`
- `cancelled`
- `skipped`

`airport_intelligence_fetch_runs.result_status` is constrained to:

- `ok`
- `stale`
- `no_data`
- `low_confidence`
- `error`
- `unchanged`

### Source License And Attribution Fields

`airport_source_links` stores source identity and attribution explicitly:

- `source_type`
- `source_name`
- `source_url`
- `source_entity_id`
- `source_license`
- `source_license_url`
- `attribution_text`
- `retrieved_at`
- `last_checked_at`
- `confidence_label`
- `confidence_score`
- `is_primary`
- `metadata`

This keeps license and source provenance separate from module payloads while
still allowing each source link to be scoped to a module when needed.

### TTL And Freshness Fields

`airport_intelligence_modules` stores module freshness state through:

- `cache_ttl_seconds`
- `fetched_at`
- `stale_at`
- `expires_at`
- `next_refresh_at`
- `refresh_error_count`
- `cache_state`

`airport_intelligence_fetch_runs` stores job timing and retry scheduling through:

- `started_at`
- `completed_at`
- `lock_expires_at`
- `next_retry_at`
- `retry_count`
- `max_retries`
- `duration_ms`

The migration adds checks that `stale_at` and `expires_at` must be after
`fetched_at` when both timestamps exist.

### Fetch Run Dedupe Strategy

`airport_intelligence_fetch_runs.in_progress_key` is a generated stored key:

```sql
airport_id::TEXT || ':' || module_key || ':' || run_type
```

The migration adds a partial unique index on that key where
`run_status IN ('queued', 'running')`. This prevents duplicate active jobs for
the same airport/module/run type while preserving completed, failed, skipped,
or cancelled history.

`airport_source_links` also has practical dedupe indexes:

- entity dedupe by `airport_id`, nullable `module_key`, `source_type`, and
  `source_entity_id` when an entity id exists.
- URL dedupe by `airport_id`, nullable `module_key`, `source_type`, and
  `source_url` when no entity id exists.

### Intentionally Not Included Until Later Stages

capacity, traffic, layout, derived intelligence, and backfill tables are intentionally not included in WO-036.

Later work orders should add:

- `airport_capacity_profiles`
- `airport_traffic_metrics`
- `airport_layout_profiles`
- `airport_derived_intelligence`
- `airport_backfill_runs`
- `airport_backfill_run_items`

No workers, API endpoints, frontend behavior, contracts, or package code are
implemented by WO-036.

## Open Questions

- Should `airport_intelligence_fetch_runs` replace future module-specific fetch
  run tables, or should some high-volume modules keep dedicated run tables?
- Should OSM geometry live directly in `airport_layout_profiles` or in a
  separate `airport_layout_geometries` table?
- What confidence threshold should hide module data from public API responses?
- Should backfill item selection snapshot store only filters or also the exact
  airport id list?
- Should capacity profiles store runway-derived values only, or wait for
  official airport capacity sources before becoming `ok`?
- Which traffic source is canonical for countries without central open
  statistics?
- Should monthly traffic metrics be in the first traffic migration, or should
  annual metrics land first?

## Review Readiness

- Migrations created: no.
- App code changed: no.
- Existing public-profile tables preserved.
- Recommended review owner: Kiro/database architecture review before staged
  migration work orders.
