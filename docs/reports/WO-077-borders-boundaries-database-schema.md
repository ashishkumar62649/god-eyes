# WO-077 Borders & Boundaries Database Schema Report

LLM model: Codex
CLI / tool: Codex CLI
Working directory: E:\god-eyes-mvp-database
Branch: agent/borders-boundaries-schema
Work order: WO-077-BORDERS-BOUNDARIES-DATABASE-SCHEMA
Role: Database/PostGIS schema engineer
Task type: Database schema only. No data ingestion.

---

## Summary

Created the schema-only database foundation for `layer_02_borders_boundaries` under the WO-076A gate review restrictions.

The migration creates empty tables only:

- `border_boundary_sources`
- `border_boundaries`
- `border_boundary_compliance_reviews`

No source rows, boundary rows, India geometry, non-India geometry, source approvals, or ingestion logic were added.

---

## Migration

**File:** `database/migrations/layers/layer_02_borders_boundaries/001_borders_boundaries_schema.sql`

The migration follows the existing layer migration pattern:

- New layer-specific directory under `database/migrations/layers/`
- Zero-padded first migration number
- Plain SQL
- `CREATE TABLE IF NOT EXISTS`
- `CREATE INDEX IF NOT EXISTS`
- `pgcrypto` and `postgis` extensions
- UUID primary keys
- PostGIS SRID 4326 geometry

---

## Tables

### `border_boundary_sources`

Stores future source metadata and approval state. All approval flags default to false:

- `approved_for_india`
- `approved_for_non_india`
- `india_conflict_checked`

No source rows are created by the migration.

### `border_boundaries`

Stores future boundary geometry after source and compliance gates are cleared.

Includes:

- `layer_id` defaulted and constrained to `layer_02_borders_boundaries`
- source identity fields
- boundary type and level fields
- country/admin fields
- dispute and India compliance fields
- `geometry geometry(Geometry, 4326)`
- JSONB properties object
- validity dates

No boundary rows are created by the migration.

### `border_boundary_compliance_reviews`

Stores future review records for source licensing, India compliance, disputed territory handling, data quality, and related review scopes.

This table is audit infrastructure only. It does not approve sources or boundaries by itself.

---

## Compliance Controls

Included:

- `india_sensitive`
- `india_compliance_status`
- `approved_for_india`
- `india_conflict_checked`
- source approval metadata
- compliance review table
- controlled `boundary_type`
- controlled `dispute_status`
- controlled `india_compliance_status`
- controlled `review_scope`
- controlled `review_status`
- JSON object check on `properties`
- SRID and non-empty geometry checks

WO-077 does not clear blocked policy gates G1-G6. Data ingestion remains blocked.

---

## Indexes

Included:

- GiST on `border_boundaries.geometry`
- btree indexes on source, type, country, dispute, and India compliance filters
- source metadata index on `border_boundary_sources.source_id`
- compliance review indexes on `source_id`, `boundary_id`, and `review_status`
- partial unique dedupe on `(source_id, source_object_id)` when `source_object_id` is present

---

## Data Safety

The migration contains no:

- source rows
- boundary rows
- fake records
- India geometry
- non-India geometry
- source ingestion
- source approval claims
- external data references
- API code
- frontend code
- fetcher code

---

## Test Strategy

Added static migration tests under `tests/data/layer_02_borders_boundaries/`.

The repo's existing layer migration tests are static SQL tests. There is no isolated pytest database fixture convention for applying layer migrations in tests, so no new custom DB test runner was added.

Completed validation:

- TDD RED: `python -m pytest tests/data/layer_02_borders_boundaries -q` failed before the migration existed.
- TDD GREEN: `python -m pytest tests/data/layer_02_borders_boundaries -q` passed with 9 tests after the migration was added.
- Fast adjacent tests: `python -m pytest tests/data/layer_03_earth_events -q` passed with 16 tests.
- Local PostGIS apply: direct `psql` apply of `001_borders_boundaries_schema.sql` completed successfully.
- Local PostGIS idempotency: direct `psql` apply completed a second time with existing-relation notices only.
- Local catalog check confirmed all three tables and expected indexes exist.
- Local row-count check confirmed all three new tables contain 0 rows.
