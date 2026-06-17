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

## 2026-06-17 - API-URL-002 Remaining Layer Slug Aliases

- Agent: API Implementation Agent
- Branch: api/api-url-002-remaining-slug-aliases
- What changed: Added clean public slug endpoint aliases for the remaining 6 endpoint groups (aviation, borders-boundaries, earth-events, space, maritime, energy) per API-POLICY-001. 12 new aliases in total. Each handler was extracted into a named const arrow function inside the corresponding route file, then registered under both the legacy path and the new clean slug path so old paths continue to work. `meta.layerId` continues to use the internal layer ID per the policy. The WebSocket broadcaster in `apps/api/src/routes/space/satellites.ts` was intentionally NOT touched. Aviation / borders / earth-events / maritime / energy support files (service / validation / mapper / types / repository) were not modified. Added 21 new alias tests across the 6 groups (aviation +3, borders +2, earth-events +2, space +4, maritime +5, energy +5). No frontend callers changed. No fetcher / normalizer / ingestion changes.
- Validation: API build exit 0; full API test suite 560/560 PASS (was 539; +21 alias); apps/web diff 0 lines; services diff 0 lines; database diff 0 lines; packages diff 0 lines; specs diff 0 lines; forbidden change check PASS; conflict marker grep PASS; git diff --check PASS; bad duplicate path grep (e.g. /api/layers/aviation/aviation/...) — only test-file references for negative assertions; no route registration produces them.
- Known issues: None
- Next: Reviewer Agent reviews API-URL-002; do not PR yet unless user explicitly decides; after API-URL-002 review, recommended next work is WEB-API-002 (frontend migration of the same 6 groups to clean slugs), per user / decision-control layer direction.

## 2026-06-17 - WEB-API-001 Weather and News Clean URL Migration

- Agent: Web/API Migration Agent
- Branch: web/web-api-001-weather-news-clean-url-callers
- What changed: Migrated Weather and News frontend API request paths to the clean public slugs added in API-URL-001. `apps/web/src/layers/layer_07_weather/weatherApi.ts` now constructs `WEATHER_CURRENT_PATH` from a new module-local `WEATHER_PUBLIC_SLUG = 'weather'` (was constructed from `WEATHER_LAYER_ID = 'layer_07_weather'`); `apps/web/src/layers/layer_08_news_osint/newsApi.ts` constructs `BASE` from `NEWS_PUBLIC_SLUG = 'news'` (was constructed from `NEWS_LAYER_ID = 'layer_08_news_osint'`). Internal layer IDs (`WEATHER_LAYER_ID`, `NEWS_LAYER_ID`) are preserved unchanged for folder identity, UI registration, registry keys, and data-shape fields. The two affected frontend tests (`weather.test.ts` line 112-113 and `news.test.ts` line 101) had their exact-URL assertions updated to the new clean paths. Backend code, backend tests, services, database, packages, and any other endpoint groups (aviation / borders / earth-events / space / maritime / energy) were not touched. Old backend compatibility paths remain registered and available.
- Validation: `apps/web/tsc --noEmit` exit 0 PASS; frontend test suite 64/64 PASS (3 files); no old frontend request paths in `apps/web/src` (`git grep /api/layers/layer_07_weather/weather` and `/api/layers/layer_08_news_osint/news` both return 0 lines) PASS; clean slug constants `WEATHER_PUBLIC_SLUG` and `NEWS_PUBLIC_SLUG` present and used in both `weatherApi.ts` and `newsApi.ts` PASS; backend diff 0 lines PASS; no unrelated endpoint group URL changes (aviation / borders / earth-events / space / maritime / energy / airports / ws) PASS; `git diff --check` clean PASS; forbidden change check PASS.
- Known issues: None
- Next: Reviewer Agent reviews WEB-API-001; do not PR yet unless user explicitly decides; after WEB-API-001 review, recommended next work is API-URL-002 (clean slug endpoint aliases for aviation / borders / earth-events / space / maritime / energy) per user / decision-control layer direction.

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
- Next: Reviewer Agent reviews SR-016; do not PR yet unless user explicitly decides; after SR-016 review, the user / decision-control layer should decide the next area: API cleanup, integration/full validation package, or PR package planning.
