# Work Order: WO-078A-BORDERS-SOURCE-LICENSE-CLEARANCE-KIT

**Assigned to:** Kiro CLI
**Layer:** layer_02_borders_boundaries
**Created:** 2026-05-26
**Branch:** agent/borders-source-license-clearance
**Status:** complete

---

## Objective

Create the human-action source/license clearance kit for Borders & Boundaries, so the
project can safely determine whether any boundary source may be used in future ingestion.

---

## Context

- WO-077 database schema is complete (commit 08bd985).
- India data ingestion is BLOCKED (G1–G3, G6 not cleared).
- Non-India data ingestion is BLOCKED (G4, G5, G6 not cleared).
- No boundary source is approved.
- This work order creates documentation only — no code, no data.

---

## Outputs

| File | Description |
|------|-------------|
| `docs/control/BORDERS_BOUNDARIES_SOURCE_LICENSE_CLEARANCE_KIT.md` | Master clearance kit |
| `docs/control/BORDERS_BOUNDARIES_SURVEY_OF_INDIA_REQUEST_TEMPLATE.md` | Email template for human |
| `docs/control/BORDERS_BOUNDARIES_SOURCE_REVIEW_TRACKER.md` | Per-source review status table |
| `docs/work-orders/WO-078A-borders-source-license-clearance-kit.md` | This file |
| `docs/reports/WO-078A-borders-source-license-clearance-kit.md` | Completion report |

## Files Updated

- `docs/state/CURRENT_PROJECT_STATE.md`
- `docs/state/HANDOFF_LOG.md`

---

## Constraints

- No application code
- No database migrations
- No boundary data downloaded or committed
- No GeoJSON, shapefiles, KML, CSV, PDFs
- No source approval claimed
- No legal conclusions beyond documenting required human review

## Acceptance Criteria

- [x] Clearance kit created with all 15 required sections
- [x] Survey of India request template created with all required questions
- [x] Source review tracker created for all sources (SOI, Natural Earth, UN, GADM, rejected)
- [x] India ingestion remains blocked
- [x] Non-India ingestion remains blocked
- [x] No source approval claimed
- [x] No code touched
- [x] No data files added
- [x] git diff --check clean
