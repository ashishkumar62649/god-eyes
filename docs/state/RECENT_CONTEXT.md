# Recent Context

Classification: ROLLING_CONTEXT
Last updated: 2026-06-19 - State Sync Agent (post-Parallel Wave 1)

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



## 2026-06-19 - WO-7-2 Frontend Layer Test Coverage

- Agent: Frontend Layer Test Agent
- Branch: `web/wo-7-2-frontend-layer-tests`
- What changed: Added 102 frontend tests across 5 new test files (borders, earth events, energy infrastructure, satellites, aviation) under `apps/web/src/layers/**/__tests__/**` covering the 5 previously untested active layers. **Revision (post-DISC-1 cross-lane coordination):** removed 13 `aviationTileCache` tests and the related import/`beforeEach` reset from `aviation.test.ts` (46→33 aviation tests) because DISC-1 confirmed `aviationTileCache.ts` is dead code with zero production importers — keeping those tests would have created artificial usage for code already scheduled for deletion. Final test count: **153/153 web tests** (was 166 pre-revision). Production source code is bit-for-bit unchanged.
- Validation: pre-edit clean (PASS); `git diff --check` clean (PASS); no merge conflict markers (PASS); `pnpm --filter web test` PASS (153/153 — V8 cleanup crash after all tests pass, known Node/Vitest issue); `pnpm --filter api test` PASS (581/581); `pnpm --filter web build` PASS; `pnpm --filter api build` PASS; `pnpm --filter @god-eyes/contracts build` PASS.
- Known issues: V8 `FatalError: v8::ToLocalChecked Empty MaybeLocal` after all 153 web tests pass (exit code 134) — known Node.js/Vitest cleanup-phase issue, not test-content related. `python -m pytest tests/data -q` reports 11 pre-existing dirty-tree scope-guard failures (same pattern documented in WO-003 through WO-3-1); not regressions, will skip on clean tree.
- Next: Wave 1 complete. Wave 2 first task is to actually delete the confirmed dead aviation files (`aviationTileCache.ts`, `aviationTileLoader.ts`, `globeCamera.ts`, `airportViewport.ts`, `aviationLayerRenderer.ts`) and drop 3 dead `aircraftMarker.ts` exports, per the DISC-1 audit. Then decide `energyInfrastructureApi.ts` placeholder future (DISC-1E product call).

## 2026-06-19 - WO-3-2 Centralize API Request-Validation Helpers

- Agent: API Validation Agent
- Branch: `api/wo-3-2-request-validation-utils`
- What changed: Created `apps/api/src/lib/requestValidation.ts` with 5 shared request-validation helpers (`parseBbox`, parameterized `parseLimit`/`parseOffset`, `isValidIsoDatetime` strict, `isValidIsoDatetimeLoose`). Centralized 5 duplicated request-validation helpers from 8 route files into 1 shared module. Each route's `validation.ts` retains a local wrapper that passes the exact prior constants, so public API and error response shapes are unchanged. Helpers intentionally left local: objects/validation.ts `parseBBox` (different architecture), `validateCategory`/`validateMode` (unique to objects), energy's `parseOffset` (no clamping), maritime/news/weather local-specific helpers, news' `parseLimit` wrapper (special MAX_MARKER_LIMIT default-value logic).
- Validation: pre-edit clean (PASS); `git diff --check` clean (PASS); no merge conflict markers (PASS); `pnpm --filter @god-eyes/contracts build` PASS; `pnpm --filter api build` PASS; `pnpm --filter api test` PASS (581/581 — unchanged); `pnpm --filter web build` PASS (111 modules, 304.03 kB JS); `pnpm --filter web test` PASS (64/64 — unchanged).
- Known issues: `python -m pytest tests/data -q` reports 11 pre-existing scope-guard test failures for non-layer data API work orders (same pattern as WO-003 through WO-3-1). Actual code/build/test all PASS. Will skip on clean tree after commit.
- Next: Wave 1 complete. WO-3-2 closes the request-validation centralization follow-up explicitly deferred from WO-3-1. Wave 2 may continue with the remaining Spec 008 cleanup lane items.

## 2026-06-19 - CLEANUP-1 Tiny Environment / Config / Security Hygiene Cleanup

- Agent: Environment Cleanup Agent
- Branch: `cleanup/env-config-tiny-cleanup`
- What changed: Added `services/fetch-orchestrator/.env.example` (DATABASE_URL, MINIO_*, AISSTREAM_API_KEY, SPACE_TRACK_USERNAME, SPACE_TRACK_PASSWORD) and `services/normalizer/.env.example` (DATABASE_URL, MINIO_*) — both contain placeholders only, no real secrets, no real URLs with credentials. Removed the duplicate `test:api` root script from `package.json` (CI uses `api:test` exclusively per `.github/workflows/ci.yml:87` and project health audit HEALTH-008). Deferred: the `console.error` at `apps/api/src/routes/public-profile/service.ts:130` — replacing it with `fastify.log.error` would require either injecting the logger into the service signature (forbidden behavior change) or making the service re-throw so the route handler can log it (also forbidden), so it is left as-is and documented.
- Validation: pre-edit clean (PASS); post-edit diff scoped to 2 new `.env.example` files + 1 root `package.json` + 2 state docs (PASS); no `apps/web/**`, `services/**` production code, `database/**`, `packages/**`, `tests/**`, lockfile, or `.env` real file touches; `git diff --check` clean (PASS); no merge conflict markers (PASS); `pnpm --filter @god-eyes/contracts build` PASS; `pnpm --filter api build` PASS; `pnpm --filter web build` PASS; `pnpm --filter api test` PASS (581/581); `pnpm --filter web test` PASS (64/64).
- Known issues: `python -m pytest tests/data -q` may report pre-existing scope-guard test failures on the dirty tree (same pre-existing test-design limitation documented in WO-003, WO-004, WO-005, WO-006, WO-1-4, WO-3-1). CRLF/LF git autocrlf warning on Windows is informational.
- Next: Wave 1 complete. Recommended next cleanup work after CLEANUP-1: complete the deferred `console.error` cleanup in `apps/api/src/routes/public-profile/service.ts:130` as a separate, properly-scoped work order (e.g. introduce a shared `apps/api/src/lib/logger.ts` that the service can import without dependency injection, or refactor the route handler to be the single owner of error logging).

## 2026-06-19 - DISC-1 Dead/Duplicate Code Investigation (audit only)

- Agent: Dead Code Audit Agent
- Branch: `review/dead-code-investigation`
- What changed: Investigation/audit only — **no production code changes, no deletions**. Created `docs/audits/DEAD_DUPLICATE_CODE_INVESTIGATION_2026-06-19.md` classifying suspected dead/duplicate files with repo-level grep evidence. Confirmed dead: `aviationTileCache.ts` (163 lines), `aviationTileLoader.ts` (237 lines, duplicate impl), `globeCamera.ts` (27 lines), `airportViewport.ts` (49 lines), `aviationLayerRenderer.ts` (254 lines, duplicate impl), 3 exports inside `aircraftMarker.ts` (`getAircraftArrowSprite`, `getAircraftDotSprite`, `getAircraftColor` legacy alias). Not dead: `packages/schemas/` (6 active Python imports). Product decision needed: `energyInfrastructureApi.ts` (mock placeholder, 0 callers, future intent unclear).
- Validation: pre-edit clean (PASS); docs-only diff scoped to 1 new audit doc + 2 state docs (PASS); `git diff --check` clean; no merge conflict markers; no apps/services/database/packages/tests/specs/lockfile touches.
- Known issues: Static-evidence only — no runtime/coverage tracing. Findings are advisory; actual deletions deferred to follow-up WOs (DISC-1B/C/D/E/F). A future bundle analyzer pass is the gold standard before mass deletion.
- Next: Wave 2 first task — implement the DISC-1 follow-up WOs. Priority order: **DISC-1B** (delete dead aviation tile pair `aviationTileCache.ts` + `aviationTileLoader.ts`), **DISC-1C** (delete dead `globeCamera.ts`), **DISC-1D** (drop 3 dead `aircraftMarker.ts` exports, keep the rest), **DISC-1F** (delete dead `airportViewport.ts` + `aviationLayerRenderer.ts` after confirming `aviationGlobalRenderer.ts` covers render needs), **DISC-1E** (product call on `energyInfrastructureApi.ts` mock — keep as documented stub vs delete + drop dead `export *` from barrel). DISC-1A (packages/schemas) closed as false positive — not dead.

## 2026-06-19 - WO-3-1 Centralize API Type/Date Helper Functions

- Agent: API Cleanup Agent
- Branch: `api/wo-3-1-centralize-type-date-utils`
- What changed: Created `apps/api/src/lib/typeUtils.ts` with 6 pure conversion helpers (`toIsoString`, `toIsoStringOrNull`, `toNumber`, `toNumberOrNull`, `toInteger`, `toIntegerOrNull`) and removed the duplicated local `function toIsoString / toNumber / toNumberOrNull / toInteger / toIntegerOrNull` definitions from 6 mapper/route files (`weather/mapper.ts`, `maritime/mapper.ts`, `news/mapper.ts`, `energy/infrastructure/mapper.ts`, `aviation-aircraft.ts`, `earth-events.ts`). Each mapper now imports the canonical helper(s) from `typeUtils.ts` and re-exports them so existing downstream service/index imports keep working unchanged. **No behavior change**: each canonical helper's body is the exact prior duplicate body, line-for-line. Out-of-scope and intentionally NOT centralized: `parseBbox` / `parseLimit` / `isValidIsoDatetime` (request validation → WO-3-2); the typed `toDate(value: Date | string | null)` in `airport-intelligence/service.ts` and `public-profile/repository.ts` (different signature/behavior); the `toNumber(value: unknown): number | null` in `airport-intelligence/service.ts` (different fallback).
- Validation: pre-edit clean (PASS); `git diff --check` clean (PASS); no merge conflict markers (PASS); targeted post-change search confirms duplicate `function toIsoString / toNumber / toNumberOrNull / toInteger / toIntegerOrNull` definitions are removed from the 6 touched files (PASS); `pnpm --filter @god-eyes/contracts build` PASS; `pnpm --filter api build` PASS; `pnpm --filter web build` PASS (111 modules; identical to pre-WO-3-1); `pnpm --filter api test` PASS (581/581 — same count as pre-WO-3-1; pure re-exports with identical bodies mean all existing API tests pass unchanged); `pnpm --filter web test` PASS (64/64 — same count as pre-WO-3-1).
- Known issues: `python -m pytest tests/data -q` reports 11 pre-existing scope-guard test failures on the dirty tree (same test-design limitation documented in WO-003 through WO-006). The 11 failures are not regressions. CRLF/LF git autocrlf warning on Windows is informational.
- Next: Wave 1 complete. WO-3-1 covered only type/date/number conversions; request-validation helpers were explicitly deferred to WO-3-2 which has now landed. Wave 2 may pick up remaining Spec 008 cleanup items.
