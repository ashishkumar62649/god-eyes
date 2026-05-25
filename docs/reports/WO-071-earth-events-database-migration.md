# WO-071 Earth Events Database Migration Report

**LLM model:** Codex
**CLI / tool:** Codex CLI
**Working directory:** E:\god-eyes-mvp-database
**Branch:** agent/earth-events-database
**Work order:** WO-071-EARTH-EVENTS-DATABASE-MIGRATION
**Role:** Database/PostGIS engineer
**Task type:** Database migration only

---

## Summary

Created the Earth Events database foundation for `layer_03_earth_events` according to the merged WO-070 plan.

The migration creates:

- `earth_events_latest`: mutable latest snapshot table for current public natural events.
- `earth_events_history`: append/history table for source update history.

The migration is additive and idempotent. It creates required extensions, tables, constraints, and indexes without dropping, truncating, updating, or seeding data.

---

## Migration

**File:** `database/migrations/layers/layer_03_earth_events/001_earth_events_tables.sql`

Naming convention review:

- Existing layer migrations live under `database/migrations/layers/{layer_id}/`.
- Existing aviation migrations use zero-padded numeric prefixes.
- Since `layer_03_earth_events` is new, the first migration starts at `001_earth_events_tables.sql`.

---

## Tables

### `earth_events_latest`

Purpose: current/latest source-backed event state for API and viewport reads.

Includes:

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `layer_id TEXT NOT NULL DEFAULT 'layer_03_earth_events'`
- `source_id`, `source_object_id`
- `event_type`
- earthquake-oriented fields such as `magnitude`, `magnitude_type`, `depth_km`, `alert_level`, `significance`, and `tsunami`
- `geometry geometry(Point, 4326)`
- `source_url`
- `observed_at`, `updated_at`, `fetched_at`, `created_at`
- `properties_json JSONB`
- `UNIQUE(source_id, source_object_id)`

### `earth_events_history`

Purpose: append/history table for source state changes.

Includes:

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `layer_id`, `source_id`, `source_object_id`
- `event_type`
- `magnitude`, `depth_km`, `place`, `alert_level`
- `geometry geometry(Point, 4326)`
- `source_url`
- `observed_at`, `updated_at`, `fetched_at`, `created_at`
- `properties_json JSONB`

---

## Indexes

Created:

- `idx_earth_events_latest_geometry_gist` on `earth_events_latest USING GiST(geometry)`
- `idx_earth_events_latest_observed_at` on `earth_events_latest(observed_at)`
- `idx_earth_events_latest_event_type` on `earth_events_latest(event_type)`
- unique constraint `earth_events_latest_source_identity_key` on `earth_events_latest(source_id, source_object_id)`
- `idx_earth_events_history_source_object_updated` on `earth_events_history(source_id, source_object_id, updated_at)`
- `idx_earth_events_history_created_at` on `earth_events_history(created_at)`
- `idx_earth_events_history_geometry_gist` on `earth_events_history USING GiST(geometry)`

---

## Safety

The migration contains no:

- API code
- frontend code
- fetcher or normalizer code
- external API calls
- API keys or tokens
- fake seed/demo records
- destructive DDL or DML

The schema is limited to public natural event data.

---

## Validation

Completed validation:

- TDD RED: `python -m pytest tests/data/layer_03_earth_events/test_earth_events_migration.py -q` failed before the migration existed.
- TDD GREEN: `python -m pytest tests/data/layer_03_earth_events/test_earth_events_migration.py -q` passed with 6 tests after the migration was added.
- Local PostGIS apply: `Get-Content database\migrations\layers\layer_03_earth_events\001_earth_events_tables.sql -Raw | docker exec -i god-eyes-postgis psql -v ON_ERROR_STOP=1 -U god_eyes -d god_eyes_dev` completed successfully.
- Idempotency check: the same local PostGIS apply command completed a second time with "already exists" notices only.
- Catalog check confirmed both tables and all expected indexes exist in the local dev database.
- Contracts build: `pnpm --filter @god-eyes/contracts build` passed.

The existing `scripts/apply_migrations.ps1` runner is scoped to core ingestion and the first aviation migration, so this work order used the documented direct `psql` plain-SQL migration apply pattern for the new layer migration.
