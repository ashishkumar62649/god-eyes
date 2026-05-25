## Work Order: WO-070-EARTH-EVENTS-LAYER-IMPLEMENTATION-PLAN

**Assigned to:** Kiro CLI
**Layer:** layer_03_earth_events
**Created:** 2026-05-25
**Status:** complete

**Objective**
Create a production-aware implementation plan for the Earth Events layer covering database, fetching, API, and frontend. Planning only — no code, no migrations, no API changes.

**Outputs**
- `docs/control/EARTH_EVENTS_LAYER_PLAN.md` — full implementation plan with 13 sections
- `docs/reports/WO-070-earth-events-layer-implementation-plan.md` — completion report
- `docs/state/HANDOFF_LOG.md` — append-only entry

**Acceptance Criteria**
1. Plan covers all 13 required sections (executive summary through what-not-to-build-yet).
2. Earthquakes identified as first event type with clear rationale.
3. Database plan uses latest+history pattern with PostGIS geometry.
4. Fetcher plan includes dry-run mode and idempotent upsert.
5. API plan defines GET /api/earth-events/latest with bbox, limit, type, magnitude filters.
6. Frontend plan enforces 60 FPS, no render-loop fetches, bbox-only fetching.
7. Work order breakdown defines WO-071 through WO-075 with acceptance criteria.
8. No application code created or modified.
9. No database migrations created.
10. No external API calls made.

**Constraints**
- Planning only. No code.
- Must follow AGENTS.md rules.
- Only documentation files modified.

**Dependencies**
- WO-063 (MVP Layer Registry) — provides layer identity
- WO-067 (Database Foundation Review) — provides latest+history pattern
- WO-069 (Live Source Research) — provides source recommendation

**Next Work Orders**
- WO-071: Database migration (Codex)
- WO-072: Fetcher/backfill (Codex)
- WO-073: API endpoint (Claude Code CLI)
- WO-074: Frontend map layer (Gemini CLI)
- WO-075: Final integration/review (Kiro CLI)
