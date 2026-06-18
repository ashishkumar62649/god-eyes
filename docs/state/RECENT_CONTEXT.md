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

## 2026-06-17 - WO-001 Documentation Ownership Matrix Alignment + Spec 009 Placeholder

- Agent: Orchestrator Agent
- Branch: orchestrator/wo-001/docs-ownership-cleanup
- What changed: Marked `packages/ui/`, `packages/layers/`, and `packages/auth/` as **planned / future, not currently present** in `AGENTS.md`, `.specify/memory/constitution.md`, and `docs/control/PROJECT_CONTROL.md` (Parts 1, 2 §8, 2 §15, 3). Created `specs/009-future-scaling-architecture/README.md` as a placeholder stub. Updated `specs/README.md` to list Spec 009 as reserved. Updated `docs/state/CURRENT_PROJECT_STATE.md` with a "Currently-Present Package Folders" section and a "Specs" section. SR-016 docs closure branch status verified: branch `docs/sr-016/frontend-closure-alignment` exists **locally only** (not on `origin`); this is unchanged from before this WO. **No code, no API contracts, no fetcher/normalizer, no migration, no test changes.** No source-code edits of any kind.
- Validation: pre-edit clean (PASS); post-edit diff scoped to `AGENTS.md`, `.specify/memory/constitution.md`, `docs/control/PROJECT_CONTROL.md`, `specs/README.md`, `specs/008-structure-remediation-roadmap/repository-skeleton.md`, `specs/009-future-scaling-architecture/README.md` (added), `docs/state/CURRENT_PROJECT_STATE.md`, `docs/state/RECENT_CONTEXT.md`, `docs/state/HANDOFF_LOG.md` (9 files total: 8 modified, 1 added); no `apps/`, `services/`, `database/`, `packages/`, `docs/archive/`, `docs/audits/`, lockfile, `.env*`, or test-file changes (PASS); `git diff --check` clean (PASS); conflict-marker grep clean (PASS); `pnpm --filter web build` PASS; `pnpm --filter api build` PASS; `pnpm --filter @god-eyes/contracts build` PASS; `python -m pytest tests/data -q` PASS (1159 passed, 15 skipped); `pnpm --filter web test` PASS (64/64); `pnpm --filter api test` PASS (560/560).
- Known issues: None.
- Next: Reviewer Agent reviews WO-001. If PASS, user / decision-control layer may push, open a single PR, and merge per `PROJECT_CONTROL.md` Part 3. If FAIL, revise on the same branch. Recommended next WO after WO-001 lands: SR-016 docs closure alignment review (existing branch `docs/sr-016/frontend-closure-alignment`, local-only, not yet on origin), per the Spec 008 remaining-work queue.

## 2026-06-17 - API-COMPAT-001 Keep Old Paths as Compatibility Aliases

- Agent: Documentation / API Policy Agent
- Branch: docs/api-compat-001-keep-old-paths
- What changed: Locked the compatibility retention decision in the API endpoint path policy (Section 5.1): clean slug URLs (`/api/layers/<slug>/<resource>`) are the official public API; old layer-ID / legacy paths remain supported as compatibility aliases; old path removal is deferred and must only happen under a future explicit user / decision-control decision. Updated `tasks.md` and `plan.md` to mark the full migration sequence (API-IMP-001, API-URL-001, WEB-API-001, API-URL-002, WEB-API-002) as Done and API-COMPAT-001 as the selected decision. No source code changed. No endpoint removals. No frontend caller changes.
- Validation: branch clean (PASS); git diff --name-status shows 3 docs files (api-endpoint-path-policy.md, tasks.md, plan.md) plus 2 state docs (RECENT_CONTEXT.md, HANDOFF_LOG.md) (PASS); git diff --check clean (PASS); conflict-marker grep clean (PASS); forbidden change check clean (PASS, no apps/, services/, database/, packages/, docs/archive/, docs/control/, CURRENT_PROJECT_STATE, .specify/, .github/, .env, or lockfile paths); pnpm --filter api build PASS; pnpm --filter api test PASS (560/560); pnpm --filter web test PASS (64/64).
- Known issues: None
- Next: Reviewer Agent reviews API-COMPAT-001; do not PR yet unless user explicitly decides; after API-COMPAT-001 review, the next decision is PR/merge timing for the full stack (or another cleanup lane per user / decision-control direction).

## 2026-06-17 - WEB-API-002 Remaining Clean URL Migration

- Agent: Web/API Migration Agent
- Branch: web/web-api-002-remaining-clean-url-callers
- What changed: Migrated remaining frontend REST API callers to clean public slug URLs added in API-URL-002. 6 frontend caller paths updated: `fetchEarthEventsLatest`, `fetchBordersBoundariesCountries`, `fetchLiveAircraft`, `fetchAircraftDetail` in `apps/web/src/lib/api.ts` (4 paths); `fetchMaritimeObjects`, `fetchVesselDetail`, `fetchMaritimeStats` in `apps/web/src/layers/layer_06_maritime/maritimeApi.ts` (3 paths); `useEnergyInfrastructure` in `apps/web/src/layers/layer_10_energy_infrastructure/infrastructure/useEnergyInfrastructure.ts` (1 path). Each caller file introduced a local `*_PUBLIC_SLUG` constant matching the Weather/News pattern. Maritime test `maritime.test.ts` had 3 URL assertions updated to the clean slugs. Internal layer IDs preserved unchanged for folder identity, UI registration, registry keys, and data-shape fields. Space has no frontend REST caller (only WebSocket via `useSpaceSatellitesSocket.ts`, intentionally NOT touched). Aviation `/api/layers/layer_01_aviation/objects` paths left as-is (no clean alias was added in API-URL-002 for that endpoint; the work order scoped to the aircraft endpoints only). WebSocket paths unchanged. Backend route files not touched.
- Validation: web test suite 64/64 PASS (3 files, unchanged count); web tsc --noEmit exit 0; API build exit 0; full API test suite 560/560 PASS; backend diff 0 lines; services/database/packages/specs/docs/control/CURRENT_PROJECT_STATE diffs 0 lines; Weather/News folders diff 0 lines; WebSocket paths unchanged; old frontend REST paths gone from apps/web/src; clean slug paths present.
- Known issues: None
- Next: Reviewer Agent reviews WEB-API-002; do not PR yet unless user explicitly decides; after WEB-API-002 review, the next decision is the old-path policy: API-URL-003 (remove old compatibility paths after full frontend migration) or API-COMPAT-001 (formally keep old paths as compatibility aliases for now), per user / decision-control layer direction.

## 2026-06-17 - API-URL-002 Remaining Layer Slug Aliases

- Agent: API Implementation Agent
- Branch: api/api-url-002-remaining-slug-aliases
- What changed: Added clean public slug endpoint aliases for the remaining 6 endpoint groups (aviation, borders-boundaries, earth-events, space, maritime, energy) per API-POLICY-001. 12 new aliases in total. Each handler was extracted into a named const arrow function inside the corresponding route file, then registered under both the legacy path and the new clean slug path so old paths continue to work. `meta.layerId` continues to use the internal layer ID per the policy. The WebSocket broadcaster in `apps/api/src/routes/space/satellites.ts` was intentionally NOT touched. Aviation / borders / earth-events / maritime / energy support files (service / validation / mapper / types / repository) were not modified. Added 21 new alias tests across the 6 groups (aviation +3, borders +2, earth-events +2, space +4, maritime +5, energy +5). No frontend callers changed. No fetcher / normalizer / ingestion changes.
- Validation: API build exit 0; full API test suite 560/560 PASS (was 539; +21 alias); apps/web diff 0 lines; services diff 0 lines; database diff 0 lines; packages diff 0 lines; specs diff 0 lines; forbidden change check PASS; conflict marker grep PASS; git diff --check PASS; bad duplicate path grep (e.g. /api/layers/aviation/aviation/...) — only test-file references for negative assertions; no route registration produces them.
- Known issues: None
- Next: Reviewer Agent reviews API-URL-002; do not PR yet unless user explicitly decides; after API-URL-002 review, recommended next work is WEB-API-002 (frontend migration of the same 6 groups to clean slugs), per user / decision-control layer direction.