# WO-077: Borders & Boundaries Database Schema

**Assigned to:** Codex
**LLM Model:** Codex
**Tool/CLI:** Codex CLI
**Branch:** agent/borders-boundaries-schema
**Layer:** layer_02_borders_boundaries
**Created:** 2026-05-26
**Status:** complete
**Task type:** Database schema only. No data ingestion.

---

## Objective

Create a schema-only database foundation for `layer_02_borders_boundaries` under the WO-076A gate review restrictions.

---

## Policy Inputs

- `docs/control/BORDERS_BOUNDARIES_POLICY_SOURCE_PLAN.md`
- `docs/control/BORDERS_BOUNDARIES_IMPLEMENTATION_GATE_REVIEW.md`
- `docs/control/MVP_LAYER_REGISTRY.md`
- `docs/state/CURRENT_PROJECT_STATE.md`

---

## Outputs

- `database/migrations/layers/layer_02_borders_boundaries/001_borders_boundaries_schema.sql`
- `tests/data/layer_02_borders_boundaries/test_borders_boundaries_schema_migration.py`
- `docs/reports/WO-077-borders-boundaries-database-schema.md`
- `docs/work-orders/WO-077-borders-boundaries-database-schema.md`
- `docs/state/HANDOFF_LOG.md`
- `docs/state/CURRENT_PROJECT_STATE.md`

---

## Scope

Allowed:

- Empty database tables
- PostGIS geometry column definitions
- Constraints and indexes
- Static migration tests
- Documentation and handoff state

Forbidden and not included:

- Source ingestion
- Source approval claims
- Boundary records
- India geometry
- Non-India geometry
- GeoJSON, shapefile, KML, PDF, or CSV boundary data
- API, frontend, scheduler, fetcher, or normalizer code

---

## Acceptance Criteria

1. Creates `border_boundary_sources`, `border_boundaries`, and `border_boundary_compliance_reviews`.
2. Includes India compliance gates and review metadata without approving any source.
3. Uses `geometry(Geometry, 4326)` for future boundary geometry.
4. Includes required CHECK constraints for boundary type, dispute status, India compliance status, review scope, and review status.
5. Includes required GiST and btree indexes.
6. Contains no data rows or boundary source assumptions.
7. Static tests pass.

---

## Gate Status

WO-077 does not clear G1-G6 from the Borders & Boundaries policy. India and non-India source ingestion remain blocked until the required human/Kiro reviews are complete.
