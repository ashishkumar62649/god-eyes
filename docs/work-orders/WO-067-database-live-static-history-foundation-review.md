# WO-067: Database Live, Static, and History Foundation Review

**Assigned to:** Codex
**LLM Model:** Codex
**Tool/CLI:** Codex CLI / database application
**Branch:** agent/database-mvp-layer-foundation
**Layer:** cross-layer database foundation, with current review focused on `layer_01_aviation`
**Created:** 2026-05-25
**Status:** complete
**Task type:** Review/report first. No migration created.

---

## Objective

Review the current database foundation and recommend the MVP model for static data, latest/live snapshots, history/time data, fetch-run tracking, and performance indexes.

---

## Scope Reviewed

- Core ingestion tables: `fetch_runs`, `raw_objects`
- Aviation reference/static tables
- Airport coordinate quality and overrides
- Airport public profile cache and version history
- Airport intelligence modules and fetch runs
- Airport capacity, traffic, and derived intelligence tables
- Airport image assets
- Airport layout features
- Airport layout fetch runs

---

## Outputs

Created:

- `docs/reports/WO-067-database-live-static-history-foundation.md`
- `docs/work-orders/WO-067-database-live-static-history-foundation-review.md`

Modified:

- None outside the two new docs.

Migration:

- None. The review did not find an immediate schema blocker requiring migration.

---

## Acceptance Criteria

| Requirement | Result |
|---|---|
| Answer whether layer registry tables are needed now | PASS |
| Answer whether MVP can use static API registry first | PASS |
| Identify future live-layer database tables | PASS |
| Identify required indexes | PASS |
| Define migration order | PASS |
| Identify what should not be created today | PASS |
| Include static/latest/history model | PASS |
| Include bbox/viewport and frontend speed guidance | PASS |
| Avoid migrations unless required | PASS |
| Avoid forbidden folders | PASS |

---

## Summary Recommendation

No database layer registry tables are needed now. MVP should use a static API registry first, while database tables continue to include `layer_id` and `source_id` for provenance and filtering.

The existing static aviation foundation is sufficient for MVP. Future live domains should use explicit `*_latest` tables for current frontend state and explicit append-only `*_history` tables only after matching live sources are approved.

---

## Migration Recommendation

No migration should be created for WO-067.

Future migrations should be ordered as:

1. Core ingestion spine.
2. Static layer/domain tables.
3. Static geometry/detail tables.
4. Live `*_latest` table for an approved source.
5. Domain fetch-run table only if generic `fetch_runs` is insufficient.
6. Matching `*_history` table after latest ingestion is stable.
7. Partitioning/retention after volume is measured.
8. Database layer registry only after runtime registry requirements exist.

---

## Validation Commands

Run before reviewer handoff:

```powershell
git status --short
git diff --check
```

Expected:

- Only the two WO-067 docs should appear as new files.
- `git diff --check` should be clean.

---

## Forbidden Folders

Not touched:

- `apps/web/`
- `apps/api/`
- `services/`
- `packages/`
- `database/migrations/`
- `tests/data/`

---

## Reviewer Notes

This work order intentionally stops at architecture review. It does not add live tables, history tables, DB registry tables, or speculative indexes. The next database work should wait for an approved live source contract and API shape.
