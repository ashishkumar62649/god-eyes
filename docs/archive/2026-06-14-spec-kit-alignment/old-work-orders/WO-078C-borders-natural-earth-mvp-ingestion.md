# WO-078C: Borders Natural Earth MVP Ingestion

LLM model: Codex
CLI / tool: Codex CLI
Working directory: E:\god-eyes-mvp-database
Branch: agent/borders-natural-earth-ingestion
Work order: WO-078C-BORDERS-NATURAL-EARTH-MVP-INGESTION
Role: Database/data ingestion engineer
Task type: Natural Earth MVP ingestion implementation only. No API. No frontend.

---

## Objective

Implement MVP/local/dev ingestion for Natural Earth Admin-0 Countries 1:50m into the existing `layer_02_borders_boundaries` schema.

---

## Policy Inputs

- `docs/control/BORDERS_BOUNDARIES_NATURAL_EARTH_MVP_SOURCE_SELECTION.md`
- `docs/control/BORDERS_BOUNDARIES_SOURCE_REVIEW_TRACKER.md`
- `docs/control/BORDERS_BOUNDARIES_MVP_BOUNDARY_MODE_DECISION.md`
- `docs/reports/WO-077-borders-boundaries-database-schema.md`
- `database/migrations/layers/layer_02_borders_boundaries/001_borders_boundaries_schema.sql`

---

## Outputs

- `services/fetch-orchestrator/src/layers/layer_02_borders_boundaries/natural_earth_admin0_ingest.py`
- `services/fetch-orchestrator/src/layers/layer_02_borders_boundaries/__init__.py`
- `tests/data/layer_02_borders_boundaries/test_natural_earth_admin0_ingest.py`
- `docs/reports/WO-078C-borders-natural-earth-mvp-ingestion.md`
- `docs/work-orders/WO-078C-borders-natural-earth-mvp-ingestion.md`
- `docs/state/HANDOFF_LOG.md`

---

## Scope Completed

- Added a dry-run-default ingestion worker.
- Added explicit `--persist` write mode.
- Downloads Natural Earth Admin-0 Countries 1:50m from official Natural Earth-hosted AWS storage at runtime.
- Supports `--input-zip` for local/dev replay without committing the raw dataset.
- Parses Natural Earth DBF and polygon shapefile records without adding new dependencies.
- Normalizes Admin-0 country rows into `border_boundaries`.
- Upserts one `border_boundary_sources` row for `natural_earth_admin0_50m`.
- Uses parameterized SQL and idempotent `ON CONFLICT` upserts.
- Marks Natural Earth as MVP/local/dev only, not production-approved, and not India-compliant.
- Marks India-sensitive rows as `requires_soi_review`.

---

## Explicit Non-Scope

- No API work.
- No frontend work.
- No new database migration.
- No production source approval.
- No India compliance approval.
- No source data committed.
- No Google, Bing, OSM, GADM, or UN ingestion.
- No fake records.

---

## Validation Summary

- Dry-run parsed 242 features and normalized 242 boundaries.
- Persist run upserted 1 source row and 242 boundary rows.
- Second persist run kept the source row count at 1 and boundary row count at 242.
- Local PostGIS check found 0 rows with `india_compliance_status = 'soi_approved'`.
- Natural Earth source approval flags remained false.

Final validation commands are recorded in `docs/reports/WO-078C-borders-natural-earth-mvp-ingestion.md` and `docs/state/HANDOFF_LOG.md`.
