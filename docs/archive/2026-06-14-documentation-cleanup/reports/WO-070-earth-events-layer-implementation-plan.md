# WO-070 Earth Events Layer Implementation Plan — Report

## Header

- **LLM model:** Claude Sonnet 4.6
- **CLI / tool:** Kiro CLI
- **Working directory:** E:\god-eyes-earth-events-plan
- **Branch:** agent/earth-events-plan
- **Work order:** WO-070-EARTH-EVENTS-LAYER-IMPLEMENTATION-PLAN
- **Role:** Architecture/control planner
- **Task type:** Planning only

---

## Summary

Created a complete implementation plan for the Earth Events layer (`layer_03_earth_events`). The plan defines how earthquakes from USGS will be the first live event type, covering the full pipeline from data fetching through database storage, API serving, and frontend rendering.

The plan is structured as 5 sequential work orders (WO-071 through WO-075) that can be assigned to the appropriate agents (Codex for data/DB, Claude Code CLI for API, Gemini CLI for frontend, Kiro CLI for integration review).

---

## Files Created

| File | Purpose |
|------|---------|
| `docs/control/EARTH_EVENTS_LAYER_PLAN.md` | Full 13-section implementation plan |
| `docs/work-orders/WO-070-earth-events-layer-implementation-plan.md` | Work order definition |
| `docs/reports/WO-070-earth-events-layer-implementation-plan.md` | This report |

## Files Modified

| File | Change |
|------|--------|
| `docs/state/HANDOFF_LOG.md` | Append-only entry for WO-070 |

## Files Deleted

None.

---

## Checklist

| Item | Status |
|------|--------|
| Planning only | YES |
| Code touched | NO |
| Database touched | NO |
| Frontend touched | NO |
| API touched | NO |
| Services touched | NO |
| External APIs called | NO |
| Fake data added | NO |

---

## Plan Highlights

1. **First event type:** Earthquakes (USGS) — simplest geometry, stable IDs, small payloads, no rate limits
2. **Database:** `earth_events_latest` (upsert target) + `earth_events_history` (append-only changes) with PostGIS Point geometry and GiST spatial index
3. **Fetcher:** 5-minute schedule, dry-run mode first, idempotent upsert with `WHERE updated_at < EXCLUDED.updated_at`
4. **API:** `GET /api/earth-events/latest` with bbox, limit (cap 1000), event_type, min_magnitude, since filters
5. **Frontend:** Circle markers sized by magnitude, colored by alert level, fetched on debounced viewport change only
6. **Safety:** 60 FPS enforced, bbox required on frontend fetches, no fake markers ever, honest empty states

---

## Next Work Orders

| WO | Owner | Scope |
|----|-------|-------|
| WO-071 | Codex | Database migration — create tables and indexes |
| WO-072 | Codex | Fetcher — USGS earthquake collector with dry-run |
| WO-073 | Claude Code CLI | API endpoint — GET /api/earth-events/latest |
| WO-074 | Gemini CLI | Frontend — earthquake markers on globe |
| WO-075 | Kiro CLI | Integration review — end-to-end validation |

---

## Validation

- `git diff --check`: PASS
- `git status --short`: Only expected files shown
- Commit hash: (set after commit)
- Ready for reviewer: YES
- Ready to integrate: YES
