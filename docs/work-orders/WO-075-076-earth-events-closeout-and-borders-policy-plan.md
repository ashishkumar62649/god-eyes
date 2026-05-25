# Work Order: WO-075-076-EARTH-EVENTS-CLOSEOUT-AND-BORDERS-POLICY-PLAN

**Assigned to:** Kiro CLI
**Layer:** layer_03_earth_events (closeout) + layer_02_borders_boundaries (policy)
**Created:** 2026-05-26
**Branch:** agent/borders-boundaries-policy-plan
**Status:** complete

---

## Objective

1. Close out the Earth Events MVP stage as complete.
2. Create the official policy and source plan for the Borders & Boundaries layer,
   with strict India boundary compliance rules.

---

## Part 1: Earth Events Closeout

### What Was Completed

The Earth Events layer (`layer_03_earth_events`) is now working end-to-end:

| Component | Status | Work Order |
|-----------|--------|------------|
| Database tables (earth_events_latest, earth_events_history) | DONE | WO-071 |
| USGS earthquake fetcher | DONE | WO-072 |
| API endpoint (`GET /api/earth-events/latest`) | DONE | WO-073 |
| API timestamp serialization fix | DONE | WO-073A |
| Frontend globe layer (Cesium markers, color by severity) | DONE | WO-074 |
| Globe depth/occlusion fix (markers behind globe) | DONE | WO-074A |

### Final Commit Reference

Latest commit on branch at closeout: `10be10c` (WO-074A globe occlusion fix)

### Known Non-Blocking Follow-Ups

The following items are deferred and must NOT be added to Earth Events before the next
stage unless a specific bug-fix work order is raised:

- Bounding box (bbox) query support for Earth Events API
- Marker clustering for dense earthquake regions
- Optional manual refresh controls in the frontend
- Timeline scrubber / historical event replay

**No new Earth Events feature work should be added before the next stage unless it is
a confirmed bug fix with its own work order.**

### Earth Events MVP Status

`layer_03_earth_events` is marked **active** in the MVP Layer Registry as of this work order.

---

## Part 2: Borders & Boundaries Policy Plan

### What This Work Order Creates

- `docs/control/BORDERS_BOUNDARIES_POLICY_SOURCE_PLAN.md` — authoritative policy document
- This work order file
- Completion report

### What This Work Order Does NOT Do

- Does not write any application code
- Does not create database schemas
- Does not ingest or download boundary data
- Does not add GeoJSON, shapefiles, or PDFs
- Does not start WO-077 or any implementation work order

### India Compliance Rule (Summary)

India boundary display must follow Survey of India / Government of India official depiction.
Full policy is in `docs/control/BORDERS_BOUNDARIES_POLICY_SOURCE_PLAN.md`.

### Next Steps

Implementation must follow the sequence defined in the policy plan:

| Work Order | Title |
|------------|-------|
| WO-077 | Borders & Boundaries database schema |
| WO-078 | Borders source ingestion and conversion |
| WO-079 | Borders API endpoint |
| WO-080 | Borders frontend globe layer |
| WO-081 | Borders verification and compliance review |

---

## Allowed Folders

- `docs/control/`
- `docs/work-orders/`
- `docs/reports/`
- `docs/state/`

## Forbidden Folders

- `apps/api/`
- `apps/web/`
- `services/`
- `database/`
- `infra/`
- `packages/`

---

## Acceptance Criteria

- [x] Earth Events MVP chain documented as complete
- [x] Earth Events marked active in MVP Layer Registry
- [x] Non-blocking follow-ups recorded
- [x] BORDERS_BOUNDARIES_POLICY_SOURCE_PLAN.md created with all required sections
- [x] India compliance policy documented
- [x] Survey of India source hierarchy documented
- [x] Rejected India source types documented
- [x] Non-India source policy documented
- [x] Data licensing checklist included
- [x] Implementation gate checklist included
- [x] Future WO sequence (WO-077 through WO-081) documented
- [x] Known risks documented
- [x] Stop conditions documented
- [x] No application code touched
- [x] No boundary data downloaded or committed
- [x] git diff --check clean
