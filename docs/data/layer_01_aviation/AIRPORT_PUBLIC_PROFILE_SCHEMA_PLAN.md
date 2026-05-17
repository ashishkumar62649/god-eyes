# Airport Public Profile Schema Plan

This document proposes a future database schema for cached airport public
profiles in `layer_01_aviation`. It is a planning document only. It does not
create migrations, alter existing tables, or change the current normalized
OurAirports pipeline.

## Purpose

Airport public profiles are enrichment/cache records for human-readable airport
detail content that may come from public webpages, source links, manual review,
or future AI-assisted summarization. They should sit beside the existing
normalized aviation reference tables without mutating source-derived rows in
`aviation_airports`.

For v1, the canonical public-profile source policy is intentionally narrow:

- English Wikipedia is the only long-form text source.
- Wikidata is the structured-facts source.
- Full Wikipedia pages must not be stored in the database.
- Source attribution and version history must be retained for future AI and
  audit workflows.
- Cache TTL is 30 days.
- Stale-while-revalidate is the serving model.
- Old versions are append-only history and must not be deleted by normal
  refreshes.
- The API endpoint planned for consumers is
  `GET /api/airports/:airportId/public-profile`.

The schema should support:

- stable source identity with `layer_id`, `source_id`, and
  `source_airport_id`.
- one current cached profile per airport/source identity.
- append-only version history for profile payload changes.
- fetch-run audit records for refresh attempts, failures, staleness, and
  source provenance.
- future AI analysis fields without requiring an immediate AI pipeline.
- API-safe reads of the latest cached public profile.
- in-progress fetch deduplication so scheduled refreshes do not stampede for
  the same airport.

## Existing Identity Model

The current aviation detail docs use `source_id + source_airport_id` as the
stable airport identity. `ident`, `iata_code`, and airport name are useful for
display and search, but they are not the source-of-truth key.

Recommended profile identity:

```sql
layer_id = 'layer_01_aviation'
source_id = 'ourairports'
source_airport_id = aviation_airports.source_airport_id
```

Where possible, profile rows should also reference `aviation_airports(id)` so
joins can remain fast and clear.

For v1 source attribution, `source_id` identifies the airport identity source
(`ourairports`), while profile content provenance is stored separately as
`wikipedia_*`, `wikidata_*`, `source_urls`, and `source_attribution` fields.
This keeps the profile cache attached to the canonical airport row without
pretending Wikipedia or Wikidata owns the airport identity.

## Proposed Tables

1. `airport_public_profiles`
2. `airport_public_profile_versions`
3. `airport_public_profile_fetch_runs`

## MVP Schema vs Future AI Fields

The full plan below keeps future AI and review fields visible, but the first
migration should be smaller. WO-032G v1 should create only the columns and
indexes needed for English Wikipedia + Wikidata caching, stale-while-revalidate,
append-only versions, and fetch-run auditability.

### A. Required MVP Columns For First Migration

`airport_public_profiles`:

- `id`
- `layer_id`
- `source_id`
- `source_airport_id`
- `airport_id`
- `airport_ident`
- `iata_code`
- `airport_name`
- `iso_country`
- `profile_status`
- `visibility_status`
- `current_version_id`
- `latest_fetch_run_id`
- `latest_successful_fetch_run_id`
- `profile_payload`
- `profile_summary`
- `wikipedia_page_title`
- `wikipedia_page_id`
- `wikipedia_revision_id`
- `wikipedia_url`
- `wikidata_qid`
- `wikidata_revision_id`
- `wikidata_url`
- `source_urls`
- `source_attribution`
- `cache_key`
- `cache_state`
- `cache_ttl_seconds`
- `stale_while_revalidate_seconds`
- `fetched_at`
- `last_successful_fetch_at`
- `last_changed_at`
- `stale_at`
- `expires_at`
- `next_refresh_at`
- `refresh_error_count`
- `last_error_code`
- `last_error_message`
- `content_hash`
- `source_content_hash`
- `metadata`
- `created_at`
- `updated_at`

`airport_public_profile_versions`:

- `id`
- `profile_id`
- `fetch_run_id`
- `layer_id`
- `source_id`
- `source_airport_id`
- `version_number`
- `previous_version_id`
- `is_current`
- `version_status`
- `profile_payload`
- `profile_summary`
- `wikipedia_page_title`
- `wikipedia_page_id`
- `wikipedia_revision_id`
- `wikipedia_url`
- `wikidata_qid`
- `wikidata_revision_id`
- `wikidata_url`
- `source_urls`
- `source_attribution`
- `source_metadata`
- `content_hash`
- `source_content_hash`
- `change_summary`
- `change_reason`
- `valid_from`
- `valid_to`
- `fetched_at`
- `normalized_at`
- `published_at`
- `created_by`
- `metadata`
- `created_at`

`airport_public_profile_fetch_runs`:

- `id`
- `profile_id`
- `produced_version_id`
- `layer_id`
- `source_id`
- `source_airport_id`
- `airport_ident`
- `run_type`
- `run_status`
- `cache_result`
- `idempotency_key`
- `in_progress_key`
- `lock_expires_at`
- `started_at`
- `completed_at`
- `duration_ms`
- `requested_urls`
- `successful_urls`
- `failed_urls`
- `http_statuses`
- `fetcher_name`
- `fetcher_version`
- `parser_name`
- `parser_version`
- `wikipedia_page_title`
- `wikipedia_revision_id`
- `wikidata_qid`
- `wikidata_revision_id`
- `records_examined`
- `bytes_fetched`
- `source_content_hash`
- `normalized_content_hash`
- `content_changed`
- `stale_before_run`
- `stale_after_run`
- `next_refresh_at`
- `retry_after_at`
- `error_code`
- `error_message`
- `metadata`
- `created_at`

### B. Optional Future AI Columns That Should Not Block V1

These columns are useful later, but should not be required in the first
migration or first API implementation:

- `ai_analysis_status`
- `ai_summary`
- `ai_key_facts`
- `ai_risk_flags`
- `ai_analysis_payload`
- `ai_confidence_score`
- `ai_model`
- `ai_prompt_version`
- `ai_input_hash`
- `ai_output_hash`
- `ai_generated_at`
- `ai_review_status`
- `ai_reviewed_by`
- `ai_reviewed_at`
- `ai_error_code`
- `ai_error_message`
- `review_status`
- `reviewed_by`
- `reviewed_at`
- large JSONB GIN indexes for AI or historical payload search

V1 should still store source attribution and compact source metadata so a future
AI pipeline can analyze what was fetched and which Wikipedia/Wikidata revisions
were used.

### C. Indexes Needed For V1

- `airport_public_profiles`: unique
  `(layer_id, source_id, source_airport_id)`.
- `airport_public_profiles`: unique `cache_key`.
- `airport_public_profiles`: `(airport_id)` where `airport_id IS NOT NULL`.
- `airport_public_profiles`: `(stale_at)` where `stale_at IS NOT NULL`.
- `airport_public_profiles`: `(next_refresh_at)` where
  `next_refresh_at IS NOT NULL`.
- `airport_public_profile_versions`: unique `(profile_id, version_number)`.
- `airport_public_profile_versions`: unique `(profile_id, content_hash)`.
- `airport_public_profile_versions`: unique current-version partial index on
  `(profile_id)` where `is_current = true`.
- `airport_public_profile_versions`: `(profile_id)`.
- `airport_public_profile_versions`: `(fetch_run_id)` where
  `fetch_run_id IS NOT NULL`.
- `airport_public_profile_fetch_runs`: unique `idempotency_key`.
- `airport_public_profile_fetch_runs`: unique in-progress partial index on
  `(in_progress_key)` where `run_status IN ('queued', 'running')`.
- `airport_public_profile_fetch_runs`: `(layer_id, source_id,
  source_airport_id)`.
- `airport_public_profile_fetch_runs`: `(run_status, started_at DESC)`.
- `airport_public_profile_fetch_runs`: `(retry_after_at)` where
  `retry_after_at IS NOT NULL`.

### D. Indexes That Can Wait

- `idx_airport_public_profiles_iata_code`
- `idx_airport_public_profiles_airport_ident`
- `idx_airport_public_profiles_ai_analysis_status`
- `idx_airport_public_profiles_payload_gin`
- `idx_airport_public_profile_versions_review_status`
- `idx_airport_public_profile_versions_ai_analysis_status`
- `idx_airport_public_profile_versions_payload_gin`
- `idx_airport_public_profile_fetch_runs_cache_result`
- `idx_airport_public_profile_fetch_runs_ai_status`
- broad JSONB GIN indexes until real API query patterns require them.

## Table: airport_public_profiles

### Why This Table Exists

`airport_public_profiles` stores the current cache state for one airport public
profile. API routes should read from this table for the latest profile metadata
and join to the current version payload when needed.

This table is intentionally current-state oriented. It answers:

- does this airport have a cached public profile?
- is the cached profile fresh, stale, expired, missing, or failed?
- which version is current?
- when should this airport be refreshed next?
- what AI analysis, if any, is currently safe to expose or review?

### Proposed Columns

| Column | Type | Null | Notes |
|---|---|---:|---|
| `id` | `UUID` | no | Primary key, default `gen_random_uuid()`. |
| `layer_id` | `TEXT` | no | Must be `layer_01_aviation` for MVP rows. |
| `source_id` | `TEXT` | no | Source namespace, initially `ourairports`. |
| `source_airport_id` | `TEXT` | no | Stable source airport id from `aviation_airports`. |
| `airport_id` | `UUID` | yes | Optional FK to `aviation_airports(id)`. Nullable to allow staged backfill. |
| `airport_ident` | `TEXT` | yes | Denormalized display/review helper from `aviation_airports.ident`. |
| `iata_code` | `TEXT` | yes | Denormalized display/search helper. |
| `airport_name` | `TEXT` | yes | Denormalized review helper; source table remains authoritative. |
| `iso_country` | `TEXT` | yes | Denormalized review/filter helper. |
| `profile_status` | `TEXT` | no | Suggested values: `missing`, `cached`, `stale`, `expired`, `blocked`, `failed`, `review_required`. |
| `visibility_status` | `TEXT` | no | Suggested values: `internal`, `review`, `public`. Default `internal`. |
| `current_version_id` | `UUID` | yes | Points to current row in `airport_public_profile_versions`; FK can be added after both tables exist. |
| `latest_fetch_run_id` | `UUID` | yes | Latest attempted fetch run for this profile. |
| `latest_successful_fetch_run_id` | `UUID` | yes | Latest successful fetch run for this profile. |
| `profile_payload` | `JSONB` | no | Small current read cache; full audited payload also lives in versions. Default `{}`. |
| `profile_summary` | `TEXT` | yes | Human-readable current summary for API display. |
| `wikipedia_page_title` | `TEXT` | yes | English Wikipedia page title used for v1 profile text. |
| `wikipedia_page_id` | `TEXT` | yes | Stable Wikipedia page id when available. |
| `wikipedia_revision_id` | `TEXT` | yes | Wikipedia revision used for the current payload. |
| `wikipedia_url` | `TEXT` | yes | English Wikipedia canonical URL. |
| `wikidata_qid` | `TEXT` | yes | Wikidata entity id used for structured facts. |
| `wikidata_revision_id` | `TEXT` | yes | Wikidata revision used for the current payload. |
| `wikidata_url` | `TEXT` | yes | Wikidata entity URL. |
| `source_urls` | `JSONB` | no | Public URLs consulted or eligible for fetch. Default `[]`. |
| `source_attribution` | `JSONB` | no | License/terms/citation metadata. Default `{}`. |
| `cache_key` | `TEXT` | no | Deterministic key, for example `layer_01_aviation:ourairports:5235`. |
| `cache_state` | `TEXT` | no | Suggested values: `empty`, `fresh`, `stale`, `expired`, `refreshing`, `error`. |
| `cache_ttl_seconds` | `INTEGER` | no | V1 default `2592000` seconds, or 30 days. Used to compute `stale_at`. |
| `stale_while_revalidate_seconds` | `INTEGER` | no | Grace window where stale cached content may be served while refresh runs. |
| `fetched_at` | `TIMESTAMPTZ` | yes | Last fetch attempt timestamp, successful or failed. |
| `last_successful_fetch_at` | `TIMESTAMPTZ` | yes | Last successful public profile fetch. |
| `last_changed_at` | `TIMESTAMPTZ` | yes | Last time profile content hash changed. |
| `stale_at` | `TIMESTAMPTZ` | yes | `last_successful_fetch_at + 30 days`; triggers refresh but may still be served. |
| `expires_at` | `TIMESTAMPTZ` | yes | Hard stop after stale-while-revalidate grace; API should not serve as usable profile past this time. |
| `next_refresh_at` | `TIMESTAMPTZ` | yes | Scheduler hint for future fetch orchestration. |
| `refresh_priority` | `INTEGER` | no | Lower number means higher priority. Default `100`. |
| `refresh_error_count` | `INTEGER` | no | Consecutive failed refresh attempts. Default `0`. |
| `last_error_code` | `TEXT` | yes | Latest fetch/parse/cache error code. |
| `last_error_message` | `TEXT` | yes | Sanitized latest error message; no secrets. |
| `content_hash` | `TEXT` | yes | Hash of normalized current profile payload. |
| `source_content_hash` | `TEXT` | yes | Hash of raw public-source content used for current profile. |
| `ai_analysis_status` | `TEXT` | no | Suggested values: `not_run`, `queued`, `complete`, `failed`, `review_required`. |
| `ai_summary` | `TEXT` | yes | Future AI-generated summary, gated by status/visibility. |
| `ai_key_facts` | `JSONB` | no | Future structured extracted facts. Default `[]`. |
| `ai_risk_flags` | `JSONB` | no | Future safety/data-quality/review flags. Default `[]`. |
| `ai_confidence_score` | `NUMERIC(5,4)` | yes | Future aggregate confidence, expected range `0.0000` to `1.0000`. |
| `ai_model` | `TEXT` | yes | Model used for the current AI analysis. |
| `ai_prompt_version` | `TEXT` | yes | Prompt/extractor version used for reproducibility. |
| `ai_generated_at` | `TIMESTAMPTZ` | yes | Timestamp for current AI analysis. |
| `ai_review_status` | `TEXT` | no | Suggested values: `not_required`, `pending`, `approved`, `rejected`. |
| `ai_reviewed_by` | `TEXT` | yes | Reviewer identifier for future review workflows. |
| `ai_reviewed_at` | `TIMESTAMPTZ` | yes | Review timestamp. |
| `metadata` | `JSONB` | no | Operational metadata. Default `{}`. |
| `created_at` | `TIMESTAMPTZ` | no | Default `NOW()`. |
| `updated_at` | `TIMESTAMPTZ` | no | Updated whenever current cache state changes. |

### Unique Constraints

- `UNIQUE(layer_id, source_id, source_airport_id)`
- `UNIQUE(cache_key)`
- Optional after backfill: `UNIQUE(airport_id)` where `airport_id IS NOT NULL`

### Indexes

- `idx_airport_public_profiles_layer_source_object` on
  `(layer_id, source_id, source_airport_id)`
- `idx_airport_public_profiles_airport_id` on `(airport_id)` where
  `airport_id IS NOT NULL`
- `idx_airport_public_profiles_airport_ident` on `(layer_id, airport_ident)`
  where `airport_ident IS NOT NULL`
- `idx_airport_public_profiles_iata_code` on `(layer_id, iata_code)` where
  `iata_code IS NOT NULL`
- `idx_airport_public_profiles_cache_state` on `(cache_state)`
- `idx_airport_public_profiles_profile_status` on `(profile_status)`
- `idx_airport_public_profiles_stale_at` on `(stale_at)` where
  `stale_at IS NOT NULL`
- `idx_airport_public_profiles_next_refresh_at` on
  `(next_refresh_at, refresh_priority)` where `next_refresh_at IS NOT NULL`
- `idx_airport_public_profiles_ai_analysis_status` on `(ai_analysis_status)`
- Optional GIN index: `idx_airport_public_profiles_payload_gin` on
  `profile_payload` using `GIN` if API filtering needs JSONB predicates.

For v1, the required read path is by API `airportId`, which should resolve to
`airport_public_profiles.airport_id` or to `layer_id + source_id +
source_airport_id` after joining from `aviation_airports`. IATA, ident, AI, and
JSONB payload indexes can wait until an API query actually needs them.

## Table: airport_public_profile_versions

### Why This Table Exists

`airport_public_profile_versions` stores append-only history for public profile
payloads. It prevents the current cache row from being the only copy of a prior
profile, supports content diffs, and gives future reviewers a way to audit
source changes and AI analysis changes over time.

Normal refreshes must never delete old versions. A new version is inserted only
when the normalized profile payload changes; unchanged refreshes should update
the current cache timestamps and write a fetch-run audit row.

This table answers:

- what did the cached public profile look like at a prior point in time?
- which fetch run produced a version?
- did the profile content change, or was it only refetched?
- what source URLs and hashes created this version?
- which AI output was generated from that exact version?

### Proposed Columns

| Column | Type | Null | Notes |
|---|---|---:|---|
| `id` | `UUID` | no | Primary key, default `gen_random_uuid()`. |
| `profile_id` | `UUID` | no | FK to `airport_public_profiles(id)` with `ON DELETE CASCADE`. |
| `fetch_run_id` | `UUID` | yes | Fetch run that produced this version. |
| `layer_id` | `TEXT` | no | Denormalized for layer-aware querying. |
| `source_id` | `TEXT` | no | Denormalized source id. |
| `source_airport_id` | `TEXT` | no | Denormalized source airport id. |
| `version_number` | `INTEGER` | no | Monotonic per `profile_id`, starting at `1`. |
| `previous_version_id` | `UUID` | yes | Previous version for diff/audit chain. |
| `is_current` | `BOOLEAN` | no | True for the active version. Enforce one current row per profile. |
| `version_status` | `TEXT` | no | Suggested values: `draft`, `current`, `superseded`, `rejected`, `archived`. |
| `profile_payload` | `JSONB` | no | Full normalized public profile for this version. |
| `profile_summary` | `TEXT` | yes | Summary captured for this version. |
| `wikipedia_page_title` | `TEXT` | yes | English Wikipedia page title used for this version. |
| `wikipedia_page_id` | `TEXT` | yes | Stable Wikipedia page id when available. |
| `wikipedia_revision_id` | `TEXT` | yes | Wikipedia revision used for this version. |
| `wikipedia_url` | `TEXT` | yes | English Wikipedia canonical URL. |
| `wikidata_qid` | `TEXT` | yes | Wikidata entity id used for structured facts. |
| `wikidata_revision_id` | `TEXT` | yes | Wikidata revision used for this version. |
| `wikidata_url` | `TEXT` | yes | Wikidata entity URL. |
| `source_urls` | `JSONB` | no | URLs used to produce this version. Default `[]`. |
| `source_attribution` | `JSONB` | no | Terms/license/citation snapshot. Default `{}`. |
| `source_metadata` | `JSONB` | no | Sanitized source metadata and compact extracted public fields. Default `{}`. |
| `content_hash` | `TEXT` | no | Hash of `profile_payload`. |
| `source_content_hash` | `TEXT` | yes | Hash of source content inputs. |
| `diff_from_previous` | `JSONB` | no | Structured diff from prior version. Default `{}`. |
| `change_summary` | `TEXT` | yes | Human-readable description of content changes. |
| `change_reason` | `TEXT` | yes | Suggested values: `initial_fetch`, `source_changed`, `manual_review`, `ai_reanalysis`, `cache_refresh`. |
| `valid_from` | `TIMESTAMPTZ` | no | When this version became current or eligible. |
| `valid_to` | `TIMESTAMPTZ` | yes | Set when superseded. |
| `fetched_at` | `TIMESTAMPTZ` | yes | Source fetch timestamp. |
| `normalized_at` | `TIMESTAMPTZ` | yes | Payload normalization timestamp. |
| `published_at` | `TIMESTAMPTZ` | yes | Time this version became public/review-visible. |
| `created_by` | `TEXT` | no | `fetcher`, `normalizer`, `reviewer`, or future automation id. |
| `review_status` | `TEXT` | no | Suggested values: `not_required`, `pending`, `approved`, `rejected`. |
| `reviewed_by` | `TEXT` | yes | Reviewer identifier. |
| `reviewed_at` | `TIMESTAMPTZ` | yes | Review timestamp. |
| `ai_analysis_status` | `TEXT` | no | Same lifecycle as current profile row. |
| `ai_summary` | `TEXT` | yes | Version-specific AI summary. |
| `ai_key_facts` | `JSONB` | no | Version-specific extracted facts. Default `[]`. |
| `ai_risk_flags` | `JSONB` | no | Version-specific review flags. Default `[]`. |
| `ai_analysis_payload` | `JSONB` | no | Full future AI analysis output. Default `{}`. |
| `ai_confidence_score` | `NUMERIC(5,4)` | yes | Version-specific AI confidence. |
| `ai_model` | `TEXT` | yes | Model used for this version's analysis. |
| `ai_prompt_version` | `TEXT` | yes | Prompt/extractor version. |
| `ai_generated_at` | `TIMESTAMPTZ` | yes | AI generation timestamp. |
| `metadata` | `JSONB` | no | Operational metadata. Default `{}`. |
| `created_at` | `TIMESTAMPTZ` | no | Default `NOW()`. |

### Unique Constraints

- `UNIQUE(profile_id, version_number)`
- `UNIQUE(profile_id, content_hash)`
- Partial unique index: one current version per profile:
  `UNIQUE(profile_id) WHERE is_current = true`

### Indexes

- `idx_airport_public_profile_versions_profile_id` on `(profile_id)`
- `idx_airport_public_profile_versions_fetch_run_id` on `(fetch_run_id)` where
  `fetch_run_id IS NOT NULL`
- `idx_airport_public_profile_versions_source_identity` on
  `(layer_id, source_id, source_airport_id)`
- `idx_airport_public_profile_versions_current` on `(profile_id)` where
  `is_current = true`
- `idx_airport_public_profile_versions_created_at` on `(created_at DESC)`
- `idx_airport_public_profile_versions_valid_range` on
  `(profile_id, valid_from DESC, valid_to)`
- `idx_airport_public_profile_versions_content_hash` on `(content_hash)`
- `idx_airport_public_profile_versions_review_status` on `(review_status)`
- `idx_airport_public_profile_versions_ai_analysis_status` on
  `(ai_analysis_status)`
- Optional GIN index: `idx_airport_public_profile_versions_payload_gin` on
  `profile_payload` using `GIN` if historical JSONB queries become necessary.

## Table: airport_public_profile_fetch_runs

### Why This Table Exists

`airport_public_profile_fetch_runs` records each attempt to refresh, parse,
normalize, or AI-analyze a public profile. It is fetch-attempt oriented rather
than current-state oriented.

This table answers:

- when did the system attempt to refresh a profile?
- which source URLs were requested?
- did fetching, parsing, normalization, or AI analysis fail?
- did the run create a new version or only confirm unchanged content?
- how long did the run take and what should the scheduler do next?

### Proposed Columns

| Column | Type | Null | Notes |
|---|---|---:|---|
| `id` | `UUID` | no | Primary key, default `gen_random_uuid()`. |
| `profile_id` | `UUID` | yes | FK to `airport_public_profiles(id)`. Nullable for discovery runs before profile row creation. |
| `produced_version_id` | `UUID` | yes | Version created by this run, when content changed. |
| `layer_id` | `TEXT` | no | Layer id, expected `layer_01_aviation`. |
| `source_id` | `TEXT` | no | Source id, initially `ourairports`. |
| `source_airport_id` | `TEXT` | no | Stable airport source id. |
| `airport_ident` | `TEXT` | yes | Denormalized review helper. |
| `run_type` | `TEXT` | no | Suggested values: `initial_fetch`, `scheduled_refresh`, `manual_refresh`, `retry`, `ai_reanalysis`. |
| `run_status` | `TEXT` | no | Suggested values: `queued`, `running`, `completed`, `failed`, `skipped`, `blocked`. |
| `cache_result` | `TEXT` | yes | Suggested values: `created`, `updated`, `unchanged`, `stale_marked`, `expired_marked`, `failed`. |
| `idempotency_key` | `TEXT` | no | Stable scheduler key for deduping repeated enqueue attempts. |
| `in_progress_key` | `TEXT` | no | Deterministic key, for example `layer_01_aviation:ourairports:5235:public_profile`. |
| `lock_expires_at` | `TIMESTAMPTZ` | yes | Allows recovery from abandoned queued/running fetches. |
| `started_at` | `TIMESTAMPTZ` | no | Default `NOW()`. |
| `completed_at` | `TIMESTAMPTZ` | yes | Completion timestamp. |
| `duration_ms` | `INTEGER` | yes | Runtime measurement. |
| `requested_urls` | `JSONB` | no | URLs requested. Default `[]`. |
| `successful_urls` | `JSONB` | no | URLs that returned usable public content. Default `[]`. |
| `failed_urls` | `JSONB` | no | Sanitized failed URL/error metadata. Default `[]`. |
| `http_statuses` | `JSONB` | no | Per-URL HTTP result metadata. Default `{}`. |
| `fetcher_name` | `TEXT` | yes | Future fetcher implementation name. |
| `fetcher_version` | `TEXT` | yes | Future fetcher version. |
| `parser_name` | `TEXT` | yes | Future parser/normalizer implementation name. |
| `parser_version` | `TEXT` | yes | Future parser/normalizer version. |
| `wikipedia_page_title` | `TEXT` | yes | English Wikipedia page title requested or resolved. |
| `wikipedia_revision_id` | `TEXT` | yes | Wikipedia revision seen by this run. |
| `wikidata_qid` | `TEXT` | yes | Wikidata entity requested or resolved. |
| `wikidata_revision_id` | `TEXT` | yes | Wikidata revision seen by this run. |
| `records_examined` | `INTEGER` | no | Count of source records or pages examined. Default `0`. |
| `bytes_fetched` | `BIGINT` | no | Total fetched byte count. Default `0`. |
| `source_content_hash` | `TEXT` | yes | Hash of raw public content inputs. |
| `normalized_content_hash` | `TEXT` | yes | Hash of normalized profile payload. |
| `content_changed` | `BOOLEAN` | yes | True when a new version should be created. |
| `stale_before_run` | `BOOLEAN` | no | Whether profile was stale when run began. Default `false`. |
| `stale_after_run` | `BOOLEAN` | no | Whether profile remained stale after run. Default `false`. |
| `next_refresh_at` | `TIMESTAMPTZ` | yes | Scheduler recommendation from this run. |
| `retry_after_at` | `TIMESTAMPTZ` | yes | Backoff hint after failures. |
| `error_code` | `TEXT` | yes | Stable machine-readable error code. |
| `error_message` | `TEXT` | yes | Sanitized error text; no secrets or large HTML dumps. |
| `ai_analysis_requested` | `BOOLEAN` | no | Whether future AI analysis was requested. Default `false`. |
| `ai_analysis_status` | `TEXT` | no | Suggested values: `not_run`, `queued`, `complete`, `failed`, `review_required`. |
| `ai_model` | `TEXT` | yes | Model used when AI analysis ran. |
| `ai_prompt_version` | `TEXT` | yes | Prompt/extractor version. |
| `ai_input_hash` | `TEXT` | yes | Hash of AI input payload. |
| `ai_output_hash` | `TEXT` | yes | Hash of AI output payload. |
| `ai_confidence_score` | `NUMERIC(5,4)` | yes | Aggregate confidence from this run. |
| `ai_error_code` | `TEXT` | yes | Stable AI error code if analysis failed. |
| `ai_error_message` | `TEXT` | yes | Sanitized AI error message. |
| `metadata` | `JSONB` | no | Operational metadata. Default `{}`. |
| `created_at` | `TIMESTAMPTZ` | no | Default `NOW()`. |

### Unique Constraints

- `UNIQUE(idempotency_key)`
- Partial unique index for in-progress deduplication:
  `UNIQUE(in_progress_key) WHERE run_status IN ('queued', 'running')`

Retries are still allowed after a run reaches `completed`, `failed`, `skipped`,
or `blocked`. The partial in-progress constraint only prevents duplicate active
work for the same airport public profile.

### Indexes

- `idx_airport_public_profile_fetch_runs_profile_id` on `(profile_id)` where
  `profile_id IS NOT NULL`
- `idx_airport_public_profile_fetch_runs_source_identity` on
  `(layer_id, source_id, source_airport_id)`
- `idx_airport_public_profile_fetch_runs_status_started` on
  `(run_status, started_at DESC)`
- `idx_airport_public_profile_fetch_runs_in_progress` on `(in_progress_key)`
  where `run_status IN ('queued', 'running')`
- `idx_airport_public_profile_fetch_runs_type_started` on
  `(run_type, started_at DESC)`
- `idx_airport_public_profile_fetch_runs_completed_at` on
  `(completed_at DESC)` where `completed_at IS NOT NULL`
- `idx_airport_public_profile_fetch_runs_cache_result` on `(cache_result)`
- `idx_airport_public_profile_fetch_runs_next_refresh_at` on
  `(next_refresh_at)` where `next_refresh_at IS NOT NULL`
- `idx_airport_public_profile_fetch_runs_retry_after_at` on
  `(retry_after_at)` where `retry_after_at IS NOT NULL`
- `idx_airport_public_profile_fetch_runs_error_code` on `(error_code)` where
  `error_code IS NOT NULL`
- `idx_airport_public_profile_fetch_runs_ai_status` on
  `(ai_analysis_status)`

## Suggested Relationship Model

```text
aviation_airports
  1 -> 0..1 airport_public_profiles
          1 -> many airport_public_profile_versions
          1 -> many airport_public_profile_fetch_runs
```

Recommended foreign keys for a later migration:

- `airport_public_profiles.airport_id`
  references `aviation_airports(id)`.
- `airport_public_profile_versions.profile_id`
  references `airport_public_profiles(id)` on delete cascade.
- `airport_public_profile_versions.fetch_run_id`
  references `airport_public_profile_fetch_runs(id)`.
- `airport_public_profile_fetch_runs.profile_id`
  references `airport_public_profiles(id)` on delete set null or cascade,
  depending on desired audit retention.

Because `current_version_id`, `latest_fetch_run_id`, and
`produced_version_id` create circular references, a future migration should
either add those FKs after table creation or keep them as indexed UUID pointers
with application-level integrity.

## Cache And Staleness Rules

Recommended initial cache behavior:

- `cache_state = 'fresh'` when `last_successful_fetch_at` exists and `NOW()` is
  before `stale_at`.
- `stale_at = last_successful_fetch_at + 30 days` for v1.
- `cache_state = 'stale'` when `NOW()` is after `stale_at` but before
  `expires_at`; the API may still return the stale profile while a refresh is
  queued or running.
- `expires_at = stale_at + stale_while_revalidate_seconds`; after this hard
  stop the API should not serve the cached profile as usable content.
- `cache_state = 'expired'` when `NOW()` is after `expires_at`.
- `cache_state = 'error'` when the latest run failed and no usable current
  version exists.
- `profile_status = 'review_required'` when AI or parser flags indicate that a
  public response should not expose the profile without human review.

For v1, use one canonical TTL across airport categories:

- `cache_ttl_seconds = 2592000` seconds, or 30 days.
- `stale_while_revalidate_seconds` may be set by migration default or service
  configuration; it should be long enough to avoid hiding a useful profile
  during transient Wikipedia/Wikidata failures.
- failed fetch retry uses exponential backoff through `retry_after_at`.

The planned endpoint, `GET /api/airports/:airportId/public-profile`, should use
stale-while-revalidate semantics: return fresh content before `stale_at`, return
stale-but-usable content between `stale_at` and `expires_at` while scheduling a
deduped refresh, and avoid serving expired content after `expires_at`.

## AI Future Analysis Fields

AI fields are included as nullable or default-empty columns so the first schema
can support later analysis without a disruptive migration. They should not imply
that AI output is authoritative.

These fields are future design only. They should not block v1 because English
Wikipedia, Wikidata, source attribution, version history, and fetch-run audit
fields are enough for the first public-profile endpoint.

Recommended guardrails:

- AI summaries should remain internal until `ai_review_status = 'approved'` or
  the API contract explicitly allows unreviewed AI output.
- Store model and prompt version on every generated result.
- Store hashes of AI inputs and outputs in fetch runs for reproducibility.
- Keep AI confidence separate from source confidence.
- Use `ai_risk_flags` for issues like conflicting public sources, stale
  websites, missing attribution, low-confidence extraction, or likely name
  mismatch.
- Do not store secrets, private browsing content, or full proprietary webpages
  in AI payload fields.

## Migration Notes For Later

When migrations are approved, create the tables in this order:

1. `airport_public_profiles` without FK to `current_version_id` or latest runs.
2. `airport_public_profile_fetch_runs` with FK to `airport_public_profiles`.
3. `airport_public_profile_versions` with FK to profiles and fetch runs.
4. Optional `ALTER TABLE` statements for `current_version_id`,
   `latest_fetch_run_id`, `latest_successful_fetch_run_id`, and
   `produced_version_id` if the team wants database-enforced circular pointers.

Do not write back into `aviation_airports`. The profile cache should be an
enrichment layer that can be rebuilt, expired, or discarded independently from
normalized source data.

## Open Questions

- Should public profile fetches also create rows in the existing core
  `fetch_runs` table, or is the dedicated profile fetch-run audit table enough
  for v1?
- What exact `stale_while_revalidate_seconds` grace window should v1 use after
  the 30-day TTL?
- Should compact sanitized Wikipedia extract metadata be mirrored in raw object
  storage, or should v1 rely only on revision ids and attribution?
- What review threshold is required before AI summaries become API-visible?
- Should `airport_id` be required immediately, or nullable for backfill and
  source-discovery workflows?
- Should profile payload JSONB eventually be split into typed relational
  subtables after API usage stabilizes?

## Review Readiness

- Proposed tables: `airport_public_profiles`,
  `airport_public_profile_versions`,
  `airport_public_profile_fetch_runs`.
- Migrations created: no.
- Database migration folders modified: no.
- Intended reviewer: Kiro/database integration review before any migration
  implementation.
