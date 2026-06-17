# Recent Context

Classification: ROLLING_CONTEXT
Last updated: 2026-06-17

This file is the short rolling context for agents.

Agents read this file at session start instead of reading the full `docs/state/HANDOFF_LOG.md`.

`docs/state/HANDOFF_LOG.md` remains the full append-only project history and must still
receive the **complete** handoff entry after every completed task.

## Update rule

- Keep only the latest 3-5 work summaries in this file.
- Each entry must be short (5-8 lines).
- When adding a 6th entry, remove the oldest entry from this file only.
- Do **not** remove anything from `docs/state/HANDOFF_LOG.md`.
- Every completed work must update **both** `RECENT_CONTEXT.md` (short summary) and
  `HANDOFF_LOG.md` (full entry). One does not replace the other.

## Entry format

```
## YYYY-MM-DD - short task name

- Agent: [neutral role name]
- Branch: [branch name]
- What changed: [one line]
- Validation: [pass/fail summary]
- Known issues: [one line or None]
- Next: [one line - what the next agent/task should do]
```

---

## 2026-06-17 - API-IMP-001 API Import Cleanup and Pure Shim Removal

- Agent: API Implementation Agent
- Branch: api/api-imp-001-import-shim-cleanup
- What changed: Updated `apps/api/src/index.ts` to import pure folder route entrypoints directly (`./routes/weather/index.js`, `./routes/news/index.js`, `./routes/maritime/index.js`, `./routes/energy/infrastructure/index.js`); deleted 4 redundant pure internal re-export shim files (`weather.ts`, `news.ts`, `maritime.ts`, `energy/infrastructure.ts`); updated 4 test files that imported the deleted shim paths to import from folder indexes instead. Did not touch endpoint paths, response shapes, frontend callers, `objects.ts`, `space/satellites.ts`, fetchers, normalizers, or ingestion.
- Validation: branch clean (PASS); `git diff --name-status` shows 5M + 4D (PASS); `git diff --check` PASS; conflict-marker grep PASS; forbidden change check PASS; endpoint path diff check PASS (no `/api/` or `/ws/` string changes); `pnpm --filter api build` PASS; `pnpm --filter api test` PASS (526/526 tests); `pnpm --filter web test` PASS (64 tests).
- Known issues: None
- Next: Reviewer Agent reviews API-IMP-001; do not PR yet unless user explicitly decides; after approval, next implementation should be API-URL-001 (clean slug endpoint aliases) or API-IMP-002 (objects shim audit), per user direction.

## 2026-06-17 - API-URL-001 Weather and News Slug Aliases

- Agent: API Implementation Agent
- Branch: api/api-url-001-weather-news-slug-aliases
- What changed: Added clean public slug endpoint aliases for the Weather and News layers per API-POLICY-001 (11 new aliases: `/api/layers/weather/{latest,current,hourly,nearby,sources,fetch-runs}` and `/api/layers/news/{items,markers,sources,fetch-runs,stats}`); each handler body was extracted to a named const arrow function inside `weather/index.ts` and `news/index.ts` and registered under both the old `/api/layers/layer_07_weather/weather/...` (or `layer_08_news_osint/news/...`) path and the new clean slug path so old paths continue to work with the same response shape. Old paths were not removed. No response shape changed. `meta.layer_id` continues to use the internal layer ID per the policy. Frontend callers were not changed. Aviation / borders / earth-events / space / maritime / energy route files were not touched. Fetcher / normalizer / ingestion lanes were not touched.
- Validation: `apps/api/src/routes/weather/index.ts` now has 12 fastify.get registrations (6 old + 6 new) PASS; `apps/api/src/routes/news/index.ts` now has 10 fastify.get registrations (5 old + 5 new) PASS; no `/api/layers/weather/weather/...` or `/api/layers/news/news/...` duplicate paths PASS; `apps/api/tsc` exit 0 PASS; weather.test.ts 58/58 PASS (51 existing + 7 alias); layer_08_news_osint.test.ts 66/66 PASS (60 existing + 6 alias); full API test suite 539/539 PASS (previous 526 + 13 new alias tests); `git diff --check` clean PASS; forbidden change check PASS.
- Known issues: None
- Next: Reviewer Agent reviews API-URL-001; do not PR yet unless user explicitly decides; after API-URL-001 review, recommended next work is API-URL-002 (aviation / borders / earth-events / space / maritime / energy clean aliases) or WEB-API-001 (frontend migration to clean slugs), per user / decision-control layer direction.

## 2026-06-17 - API-POLICY-001 Public API Naming Policy

- Agent: API Policy Documentation Agent
- Branch: docs/api-policy-001-public-api-naming
- What changed: Recorded the public API endpoint naming policy in `specs/008-structure-remediation-roadmap/api-endpoint-path-policy.md` (slug map: `layer_07_weather` → `weather`, `layer_08_news_osint` → `news`, `layer_10_energy_infrastructure` → `energy`, etc.); updated `tasks.md` and `plan.md` to mark the "API endpoint path policy decision" entry as Decided instead of Blocked / Needs decision (implementation remains Pending, sequenced as API-IMP-001 → API-URL-001 → WEB-API-001 → API-URL-002 → API-SIZE-001 in the policy doc). Internal layer IDs remain in contracts, registry, internal code, tests, and the database.
- Validation: branch and working tree clean (PASS); HEAD = `5bcb089`; only the 5 allowed files in `git diff --name-status` (new policy doc + tasks.md + plan.md + RECENT_CONTEXT + HANDOFF_LOG); `git diff --check` PASS; conflict-marker grep PASS; forbidden change check PASS (no apps/, services/, database/, packages/, tests/, docs/archive/, docs/control/, CURRENT_PROJECT_STATE, .specify/, .github/, or lockfiles); `pnpm --filter api build` PASS; `pnpm --filter api test` PASS (526/526 tests).
- Known issues: None
- Next: Reviewer Agent reviews API-POLICY-001; do not PR yet unless user explicitly decides; after API-POLICY-001 review, the next implementation work order is API-IMP-001 (entrypoint import normalization + pure shim removal) or API-URL-001 (clean slug endpoint aliases), per user / decision-control layer direction.

## 2026-06-16 - SR-016 Frontend Closure Docs Alignment

- Agent: Documentation Alignment Agent
- Branch: docs/sr-016/frontend-closure-alignment
- What changed: Aligned stale Spec 008 workspace docs (README.md, tasks.md, plan.md, frontend-layer-canonicalization-plan.md, frontend-layer-canonicalization-plan-report.md) with the completed frontend reconstruction through SR-015; updated status banners, work package status table, Phase 4 snapshot, recommended-order list, and added a completion addendum to the pre-implementation plan and report; frontend reconstruction is closed from a code/structure perspective.
- Validation: final layers directory listing PASS (8 canonical folders, 0 old folders); L4/L9 absence checks PASS; all 8 canonical `index.ts` exist PASS; old import grep checks PASS (all 6 old paths returned 0 lines); stale wording re-search PASS; git diff --check PASS; conflict-marker grep PASS; forbidden change check PASS; docs-only scope verified; `pnpm --filter web build` PASS; `pnpm --filter web test` PASS (64 tests); `pnpm --filter api build` PASS; `pnpm --filter api test` PASS; user reported real backend and database runtime validation passed after SR-015.
- Known issues: None
- Next: Reviewer Agent reviews SR-016; do not PR yet unless user explicitly decides; after SR-016 review, the user / decision-control layer should decide the next area: API cleanup, integration/full validation package, or PR package planning.

## 2026-06-16 - SR-015 Final Layer Shape Cleanup

- Agent: Frontend Structure Agent
- Branch: frontend/sr-015/final-layer-shape-cleanup
- What changed: Removed the 6 temporary old-name shim folders (`aviation/`, `borders/`, `earth-events/`, `space/`, `maritime/`, `energy/`) after SR-009 reviewer verified they were index-only; added missing public `index.ts` files for the already-canonical `layer_07_weather/` and `layer_08_news_osint/` folders (6 exports each, including the `WeatherLayer` and `NewsLayer` default exports); L4/L9 future-inactive folders were intentionally not created; final `apps/web/src/layers/` shape is now the 8 canonical layer folders only.
- Validation: pre-delete old shim folder checks PASS (each old folder contained only `index.ts`); pre-delete old import grep checks PASS (all 6 old paths returned 0 lines); canonical folder file listing PASS (all 8 canonical folders contain real source files); final layers directory listing PASS (8 canonical folders, 0 old folders); L4/L9 absence checks PASS; all 8 canonical `index.ts` exist PASS; weather/news index content checks PASS (no tests exported); pnpm --filter web build PASS; pnpm --filter web test PASS (64 tests); conflict-marker grep PASS; git diff --check PASS; forbidden change check PASS.
- Known issues: None
- Next: Reviewer Agent reviews SR-015; do not PR yet unless user explicitly decides; after SR-015 review, run website/backend smoke test again, then perform docs closure alignment.
