# WO-071: Earth Events Database Migration

**Assigned to:** Codex
**LLM Model:** Codex
**Tool/CLI:** Codex CLI
**Branch:** agent/earth-events-database
**Layer:** layer_03_earth_events
**Created:** 2026-05-25
**Status:** complete
**Task type:** Database migration only

---

## Objective

Create the database foundation for the Earth Events layer based on the merged WO-070 implementation plan.

---

## Inputs

- `docs/control/EARTH_EVENTS_LAYER_PLAN.md`
- Existing migration naming and SQL style under `database/migrations/`
- Existing static migration tests under `tests/data/layer_01_aviation/`

---

## Outputs

- `database/migrations/layers/layer_03_earth_events/001_earth_events_tables.sql`
- `tests/data/layer_03_earth_events/test_earth_events_migration.py`
- `docs/reports/WO-071-earth-events-database-migration.md`
- `docs/work-orders/WO-071-earth-events-database-migration.md`
- `docs/state/HANDOFF_LOG.md`

---

## Acceptance Criteria

1. `earth_events_latest` table exists with required source identity, event, time, JSONB, and PostGIS point columns.
2. `earth_events_history` table exists with required append/history fields.
3. Migration is safe and idempotent: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, no drops, no truncation, no seed rows.
4. Required indexes exist for latest spatial queries, latest time/type filters, and history source/time lookup.
5. Public-safety constraints are respected: public natural event schema only, no sensitive/security data, no fake records, no keys or tokens.
6. No API, frontend, fetcher, or normalizer code is touched.

---

## Notes

The Earth Events migration starts a new layer-specific migration sequence at `001_earth_events_tables.sql` because `layer_03_earth_events` did not previously have a migration directory. The schema uses UUID primary keys to match the existing database migration style in this repository.
