# Recent Context

Classification: ROLLING_CONTEXT
Last updated: 2026-06-18

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

## 2026-06-18 - WO-005 API Route Handler Typing Normalization

- Agent: API Agent
- Branch: api/wo-005-route-handler-typing
- What changed: Replaced broad `request: any` / `reply: any` route handler parameters with Fastify-compatible types in 7 safe route files (`apps/api/src/routes/borders-boundaries.ts`, `earth-events.ts`, `energy/infrastructure/index.ts`, `maritime/index.ts`, `news/index.ts`, `weather/index.ts`, `aviation-aircraft.ts`). Added `FastifyReply, FastifyRequest` imports to each file. Used route-specific generics (`FastifyRequest<{ Querystring: T }>` and `FastifyRequest<{ Params: T }>`) where the corresponding `Querystring`/`Params` interface was already defined and the route registration already used the same generic. Used plain `FastifyRequest` for handlers without a specific typed query/params (sources/stats/categories). **No runtime behavior changed. No route paths, methods, registration order, response payloads, status codes, compatibility aliases, clean slug URLs, legacy layer-ID URLs, service calls, database calls, or error handling behavior changed.** Forbidden route files (`objects/index.ts`, `space/satellites/index.ts`, `layers.ts`) not touched.
- Validation: pre-edit clean (PASS); post-edit diff scoped to 7 production route files (PASS); no `apps/web/`, `services/`, `database/`, `packages/`, `docs/archive/`, `docs/audits/`, `.env*`, or lockfile changes (PASS); `git diff --check` clean (PASS); targeted post-change search: 0 `request: any` or `reply: any` remaining in the 7 target files (PASS); `pnpm --filter api build` PASS; `pnpm --filter api test` PASS — **581/581** (no test changes; same count as pre-WO-005); `pnpm --filter web build` PASS; `pnpm --filter web test` PASS (64/64); `pnpm --filter @god-eyes/contracts build` PASS.
- Known issues: `python -m pytest tests/data -q` reports 11 pre-existing scope-guard test failures (`test_*_work_order_changes_stay_in_allowed_paths` and `*_adds_no_raw_environment_api_or_frontend_files` variants) for non-layer data work orders; these are correctly rejecting my `apps/api/src/routes/` changes as out-of-scope for any single layer's data work, same pattern as WO-003 and WO-004. The 11 failures are not regressions in my changes. Actual code/build/test validation all PASS (api 581/581, web 64/64). A CRLF/LF git autocrlf warning appears on Windows when checking diffs of files written with LF (informational; git is configured to convert on commit and there are no whitespace errors).
- Next: Reviewer Agent reviews WO-005. If PASS, user / decision-control layer may push, open a single PR, and merge per `PROJECT_CONTROL.md` Part 3. If FAIL, revise on the same branch. Recommended next WO after WO-005 lands: continue the Phase 4 cleanup lane per Spec 008 remaining-work queue (TODO/deprecated marker sweep is now partly done via WO-003 + WO-004 + WO-005; remaining items include API route file-shape normalization final pass for the explicitly deferred forbidden files `objects/index.ts`, `space/satellites/index.ts`, and `layers.ts`, plus the missing package-ownership-row decision in `PROJECT_CONTROL.md` Part 2 §8).

## 2026-06-18 - WO-004 API Environment Config Validation Hardening

- Agent: API Agent
- Branch: api/wo-004-env-validation
- What changed: Hardened `apps/api/src/lib/config.ts` with Zod-based validation. The exported `config` shape (`port`, `databaseUrl`, `nodeEnv`) is preserved unchanged. Added validation for `API_PORT` (must be a positive integer string parseable to 1–65535), `DATABASE_URL` (must be a valid URL), and `NODE_ENV` (must be one of `development`, `test`, `production`). Empty-string values fall back to documented defaults; unset values also fall back to defaults. Invalid or malformed values throw a clear, actionable `Error` at config load time listing every offending variable name with its specific message and a `[REDACTED — contains credentials]` placeholder for `DATABASE_URL` so credentials never leak into error messages. No new required env vars, no secrets required, no `.env` file reads, no dependency additions (Zod 3.23.8 was already in `apps/api/package.json`), no lockfile change, no route/response shape change, no frontend change. Added `apps/api/tests/config.test.ts` with 21 focused tests covering valid defaults, valid override, empty-string fallback, invalid port (non-numeric, decimal, out of range, negative), invalid URL (spaces, garbage), invalid NODE_ENV (not in allowed list), credential redaction in error messages, and multi-variable aggregation in a single error.
- Validation: pre-edit clean (PASS); post-edit diff scoped to `apps/api/src/lib/config.ts` (modified) + `apps/api/tests/config.test.ts` (added) + 2 state docs (PASS); no `apps/web/`, `services/`, `database/`, `packages/`, `docs/archive/`, `docs/audits/`, `.env*`, or lockfile changes (PASS); `git diff --check` clean (PASS); `git diff --name-only` filter for forbidden areas empty (PASS); `pnpm --filter api build` PASS; `pnpm --filter api test` PASS — **581/581** (was 560 + 21 new config tests); `pnpm --filter web build` PASS; `pnpm --filter web test` PASS (64/64); `pnpm --filter @god-eyes/contracts build` PASS.
- Known issues: `python -m pytest tests/data -q` reports 11 pre-existing scope-guard test failures (`test_*_work_order_changes_stay_in_allowed_paths` and `*_adds_no_raw_environment_api_or_frontend_files` variants) for non-layer data work orders; these are correctly rejecting my `apps/api/` changes as out-of-scope for any single layer's data work, same pattern as WO-003. The 11 failures are not regressions in my changes. Actual code/build/test validation all PASS (api 581/581, web 64/64). A CRLF/LF git autocrlf warning appears on Windows when checking diffs of files written with LF (this is informational; git is configured to convert on commit and there are no whitespace errors).
- Next: Reviewer Agent reviews WO-004. If PASS, user / decision-control layer may push, open a single PR, and merge per `PROJECT_CONTROL.md` Part 3. If FAIL, revise on the same branch. Recommended next WO after WO-004 lands: continue the Phase 4 cleanup lane per Spec 008 remaining-work queue (TODO/deprecated marker sweep is now partly done; remaining items include API route file-shape normalization final pass and the missing package-ownership-row decision).

## 2026-06-18 - WO-003 TODO and Debug-Log Cleanup (Frontend/API)

- Agent: Frontend/API Cleanup Agent
- Branch: cleanup/wo-003-todo-debug-logs
- What changed: Removed 8 production `console.log` debug statements from `apps/web/src/CesiumGlobe.tsx` (lines 325, 464, 484, 738, 741 were unguarded; lines 1015, 1115, 1157 were inside `import.meta.env.DEV` blocks; the now-dead dev-gate if-blocks and the `oldLon`/`oldLat` locals that were only used by the removed log were cleaned up). Removed 1 production `console.log` from `apps/web/src/layers/layer_01_aviation/airports/aviationPreloader.ts`. Replaced the active `// TODO: Actual fetcher integration would go here` marker in `apps/api/src/routes/public-profile/service.ts` with an accurate non-TODO comment that documents the current `createFetchRun` + `buildFetchingResponse` behavior and notes that an in-process fetcher hook would be a future work-order concern. **No runtime behavior changed; no fetcher integration implemented; no CesiumGlobe refactor.**
- Validation: pre-edit clean (PASS); post-edit diff scoped to 3 production files (`apps/web/src/CesiumGlobe.tsx`, `apps/web/src/layers/layer_01_aviation/airports/aviationPreloader.ts`, `apps/api/src/routes/public-profile/service.ts`) + 2 state docs (RECENT_CONTEXT.md, HANDOFF_LOG.md) — 5 files total (PASS); no `services/`, `database/`, `packages/`, `docs/archive/`, `docs/audits/`, lockfile, `.env*`, or test changes (PASS); `git diff --check` clean (PASS); re-run targeted cleanup searches confirm 0 `console.log`/`debugger` in the two target frontend files and 0 `TODO`/`FIXME`/`HACK` in public-profile/service.ts (PASS); `pnpm --filter web build` PASS (304.14 kB / 86.65 kB gzip, slightly smaller than pre-WO-003 due to removed logs); `pnpm --filter web test` PASS (64/64); `pnpm --filter api build` PASS; `pnpm --filter api test` PASS (560/560); `pnpm --filter @god-eyes/contracts build` PASS.
- Known issues: `python -m pytest tests/data -q` reports 11 failures (1188 passed, 7 skipped, 11 failed). All 11 failures are pre-existing `test_*_work_order_changes_stay_in_allowed_paths` scope-guard tests that correctly reject non-layer-data apps/ work. WO-002 added an Orchestrator-docs exemption (not applicable here — my changes are apps/, not docs/); an analogous Frontend/API-agent apps/ exemption does not exist in the scope-guard helpers. This is a known test-design limitation for cross-agent apps/ work orders, not a regression in my changes. The reviewer should be informed so the PR can be reviewed on the actual code/build/test validation (all PASS).
- Next: Reviewer Agent reviews WO-003. If PASS, user / decision-control layer may push, open a single PR, and merge per `PROJECT_CONTROL.md` Part 3. If FAIL, revise on the same branch. Recommended next WO after WO-003 lands: continue the Phase 4 cleanup lane per Spec 008 remaining-work queue (TODO/deprecated marker sweep is now partly done; remaining items include API route file-shape normalization final pass and the missing package-ownership-row decision).

## 2026-06-18 - WO-002 Allow Orchestrator Docs/Spec Scope in Data Work-Order Guards

- Agent: Database Agent
- Branch: data/wo-002-orchestrator-scope-guards
- What changed: Added a centralized `tests/data/scope_guard.py` helper with
  `is_orchestrator_docs_scope_path()` and
  `all_changed_paths_are_orchestrator_docs_scope()`, and taught all 8 per-layer
  `test_*_work_order_changes_stay_in_allowed_paths` guards to grant an
  allowance when the dirty tree is 100% approved Orchestrator docs/spec paths
  (AGENTS.md, .specify/memory/constitution.md, docs/control/, docs/state/,
  docs/work-orders/, specs/, docs/decisions/). The allowance only fires when
  every dirty path qualifies, so mixed trees (orchestrator docs + any
  non-approved path) and forbidden paths still fail. docs/archive/ and
  docs/audits/ stay forbidden via an explicit deny list. Added 32 unit tests
  in `tests/data/test_scope_guard.py`. Made `scope_guard` importable from all
  layer tests by adding `tests/data` to sys.path in `tests/data/conftest.py`.
- Validation: `git diff --check` clean (PASS); new helper unit tests 32 passed
  (PASS); `python -m pytest tests/data -q` (deselecting the 8 dirty-tree
  guards) 1191 passed, 7 skipped (PASS, matches WO-001 baseline + 32 new
  tests); the 8 dirty-tree guards fail pre-commit only because this branch
  touches all 8 layer test folders at once (expected cross-layer dirty-tree
  behavior, documented in WO-001 background; they skip on a clean tree);
  `pnpm --filter web/api/@god-eyes/contracts build` PASS.
- Known issues: The 8 dirty-tree scope-guard failures are pre-commit-only and
  expected; they are not a regression (documented in HANDOFF_LOG.md caveat).
- Next: Reviewer Agent reviews WO-002. If PASS, user / decision-control layer
  may push, open a single PR, and merge per `PROJECT_CONTROL.md` Part 3. If
  FAIL, revise on the same branch.

## 2026-06-17 - API-COMPAT-001 Keep Old Paths as Compatibility Aliases

- Agent: Documentation / API Policy Agent
- Branch: docs/api-compat-001-keep-old-paths
- What changed: Locked the compatibility retention decision in the API endpoint path policy (Section 5.1): clean slug URLs (`/api/layers/<slug>/<resource>`) are the official public API; old layer-ID / legacy paths remain supported as compatibility aliases; old path removal is deferred and must only happen under a future explicit user / decision-control decision. Updated `tasks.md` and `plan.md` to mark the full migration sequence (API-IMP-001, API-URL-001, WEB-API-001, API-URL-002, WEB-API-002) as Done and API-COMPAT-001 as the selected decision. No source code changed. No endpoint removals. No frontend caller changes.
- Validation: branch clean (PASS); git diff --name-status shows 3 docs files (api-endpoint-path-policy.md, tasks.md, plan.md) plus 2 state docs (RECENT_CONTEXT.md, HANDOFF_LOG.md) (PASS); git diff --check clean (PASS); conflict-marker grep clean (PASS); forbidden change check clean (PASS, no apps/, services/, database/, packages/, docs/archive/, docs/control/, CURRENT_PROJECT_STATE, .specify/, .github/, .env, or lockfile paths); pnpm --filter api build PASS; pnpm --filter api test PASS (560/560); pnpm --filter web test PASS (64/64).
- Known issues: None
- Next: Reviewer Agent reviews API-COMPAT-001; do not PR yet unless user explicitly decides; after API-COMPAT-001 review, the next decision is PR/merge timing for the full stack (or another cleanup lane per user / decision-control direction).
