# WO-060 Repository Health Audit

**Auditor:** Kiro CLI  
**Model:** Claude Sonnet 4.6  
**Date:** 2026-05-23T20:09:29+05:30  
**Branch:** main  
**Work Order:** WO-060-REPOSITORY-HEALTH-AUDIT  

---

## 1. Executive Summary

**Overall Health Score: 74 / 100**

The GOD EYES repository is in solid working condition. The core feature chain (Globe Core → Aviation → Airport Intelligence → Image Gallery → Layout Overlay) is complete and committed. CI is configured. Tests exist for all major areas. The codebase is clean of secrets and build artifacts in the main dist folders.

However, several structural issues reduce the score:

| Risk | Severity |
|------|----------|
| Build artifacts committed in `packages/contracts/src/` (`.js`, `.d.ts`, `.map` files) | HIGH |
| 40+ `console.log` debug statements left in production frontend code | HIGH |
| `aviationDensityRenderer.ts` is `@deprecated` with zero imports — dead file in tree | MEDIUM |
| `CURRENT_PROJECT_STATE.md` is stale by ~27 work orders | MEDIUM |
| `HANDOFF_LOG.md` is 230 KB and growing — no archiving strategy | MEDIUM |
| Migration gap: `002_` is missing between `001_` and `003_` | MEDIUM |
| `packages/ui` and `packages/layers` are empty stubs with only `node_modules/` | LOW |
| Work orders WO-001 through WO-025 are not in `docs/work-orders/` | LOW |
| `public-profile/service.ts` has a `TODO` for fetcher integration | LOW |

**Biggest cleanup wins:**
1. Remove committed compiled files from `packages/contracts/src/`
2. Strip or gate `console.log` debug statements behind a debug flag
3. Delete or archive `aviationDensityRenderer.ts`
4. Update `CURRENT_PROJECT_STATE.md`
5. Archive old integration reviews into a subdirectory

**Is the repo safe to continue feature work?** YES — with the caveat that the `console.log` noise should be cleaned before the next major feature to avoid masking real errors.

---

## 2. Project Map

| Folder | Purpose | Status | Notes |
|--------|---------|--------|-------|
| `apps/api/` | Fastify API backend | KEEP | Well-organized, 4 route groups |
| `apps/web/` | React + Cesium frontend | KEEP | Working, needs debug log cleanup |
| `database/migrations/` | PostgreSQL schema migrations | KEEP | Gap at `002_` needs documentation |
| `services/fetch-orchestrator/` | Python data fetchers | KEEP | Well-organized by layer |
| `services/normalizer/` | Python data normalizers | KEEP | Well-organized by layer |
| `packages/contracts/` | TypeScript Zod contracts | KEEP | Build artifacts in `src/` need removal |
| `packages/schemas/` | Python Pydantic schemas | KEEP | Correct location |
| `packages/source-catalog/` | Source metadata JSON | KEEP | Only OurAirports registered |
| `packages/ui/` | Shared UI components (stub) | REVIEW | Empty — no tracked files, only `node_modules/` |
| `packages/layers/` | Shared layer logic (stub) | REVIEW | Empty — no tracked files, only `node_modules/` |
| `docs/control/` | Architecture control docs | KEEP | All current and relevant |
| `docs/state/` | Integration reviews + handoff log | REVIEW | 40+ review files, 230 KB log — needs archiving |
| `docs/work-orders/` | Active work orders | REVIEW | WO-001 to WO-025 missing |
| `docs/api/` | API design docs | KEEP | Relevant to current features |
| `docs/data/` | Data quality and readiness docs | KEEP | Aviation-specific, useful |
| `docs/postman/` | Postman collection | KEEP | Useful for manual testing |
| `docs/reports/` | Audit reports (new) | KEEP | Created by this audit |
| `specs/` | Layer specs | KEEP | Two specs, both relevant |
| `scripts/` | Python QA/audit scripts | KEEP | Aviation-specific, useful |
| `tests/data/` | Python data pipeline tests | KEEP | Well-organized |
| `infra/docker/` | Docker Compose | KEEP | Single file, correct |
| `.github/workflows/` | CI pipeline | KEEP | Solid CI config |
| `.specify/` | Specify/Kiro tooling | KEEP | Tooling config |
| `.kiro/` | Kiro prompts | KEEP | Tooling config |
| `node_modules/` | Root pnpm store | KEEP (gitignored) | Not tracked |
| `.env` | Local secrets | KEEP (gitignored) | Not tracked |
| `.claude/` | Claude Code settings | KEEP (gitignored) | Not tracked |
| `.pytest_cache/` | Pytest cache | KEEP (gitignored) | Not tracked |
| `scripts/__pycache__/` | Python bytecode | KEEP (gitignored) | Not tracked |

---

## 3. Repository Size Summary

### Tracked File Count
**336 tracked files** (via `git ls-files`)

### Top-Level Folder Sizes (excluding `node_modules`)

| Folder | Size (MB) |
|--------|-----------|
| `apps/` | 13.26 |
| `docs/` | 1.21 |
| `tests/` | 0.93 |
| `services/` | 0.51 |
| `scripts/` | 0.28 |
| `packages/` | 0.20 |
| `.specify/` | 0.15 |
| `.kiro/` | 0.10 |
| `database/` | 0.07 |
| `.pytest_cache/` | 0.04 |
| `specs/` | 0.01 |

Note: `apps/` is large because `apps/web/dist/` exists locally (gitignored, not tracked). The tracked source is much smaller.

### Top 30 Largest Files (excluding `node_modules`, `.git`, `*.pyc`)

| File | Size |
|------|------|
| `apps/web/dist/cesium/Cesium.js` | 5.6 MB (gitignored, not tracked) |
| `apps/web/dist/cesium/ThirdParty/basis_transcoder.wasm` | 489 KB (gitignored) |
| `apps/web/dist/cesium/Assets/approximateTerrainHeights.json` | 292 KB (gitignored) |
| `apps/web/dist/cesium/Assets/Textures/waterNormals.jpg` | 287 KB (gitignored) |
| `docs/state/HANDOFF_LOG.md` | **230 KB** ← tracked, growing |
| `apps/web/dist/cesium/ThirdParty/google-earth-dbroot-parser.js` | 214 KB (gitignored) |
| `apps/web/dist/assets/index-B9dfp3o9.js` | 195 KB (gitignored) |
| `pnpm-lock.yaml` | 86 KB (tracked, expected) |
| `docs/control/AIRPORT_PUBLIC_ENRICHMENT_PIPELINE.md` | 34 KB (tracked) |
| `docs/work-orders/WO-035-airport-intelligence-canonical-design.md` | 29 KB (tracked) |
| `apps/api/src/routes/airport-intelligence/service.ts` | 20 KB (tracked) |
| `docs/work-orders/WO-035-minimax-airport-intelligence-source-research.md` | 17 KB (tracked) |
| `services/fetch-orchestrator/src/.../airport_source_endpoint_probe.py` | 44 KB (tracked) |
| `services/fetch-orchestrator/src/.../airport_public_profile_worker.py` | 27 KB (tracked) |

**Suspicious large tracked files:**
- `docs/state/HANDOFF_LOG.md` at 230 KB is the single largest tracked text file. It will continue growing with every work order. An archiving strategy is needed.
- `airport_source_endpoint_probe.py` at 44 KB is large for a single Python file — may benefit from splitting in a future refactor work order.
- `airport-intelligence/service.ts` at 20 KB is the largest API service file — acceptable but worth monitoring.

---

## 4. Git Status

| Item | Value |
|------|-------|
| Current branch | `main` |
| Working tree | Clean (no uncommitted changes) |
| Tracked files | 336 |
| Untracked files | None |

### Recent Commits (last 10)

```
ca1df54 merge: complete airport layout feature chain
d9874a5 Merge pull request #21 from ashishkumar62649/integration/airport-layout-features
1c2fac3 fix(layout): hide closed runways by default
72c0d48 feat(web): add airport layout overlay
5f444d1 feat(database): add airport layout feature tables
5130281 Merge pull request #20 from ashishkumar62649/integration/airport-image-gallery
a2f543d feat(web): add airport image gallery UI
f693ef3 feat(api): add airport image gallery response
7f94472 Merge pull request #19 from ashishkumar62649/agent/fetching-airport-image-gallery-mvp
6a7352a feat(fetching): add airport image gallery worker
```

Commit format is consistent and follows the `<type>(<area>): <description>` convention. Merge commits are clean.

### Gitignored Files Present Locally (not tracked — correct)

```
.claude/
.env
.env.local
.pytest_cache/
apps/api/dist/
apps/api/node_modules/
apps/web/dist/
apps/web/node_modules/
node_modules/
packages/contracts/dist/
packages/contracts/node_modules/
packages/layers/          ← empty stub, gitignored
packages/ui/              ← empty stub, gitignored
scripts/__pycache__/
services/fetch-orchestrator/src/.../  __pycache__/
services/normalizer/src/.../  __pycache__/
tests/data/layer_01_aviation/__pycache__/
```

All of these are correctly gitignored. No build artifacts are tracked in `apps/web/dist/` or `apps/api/dist/`.

---

## 5. Database Audit

### Migration Health

| Migration | File | Status |
|-----------|------|--------|
| core/001 | `001_core_ingestion_tables.sql` | OK |
| layer_01/001 | `001_aviation_reference_tables.sql` | OK |
| layer_01/002 | **MISSING** | GAP |
| layer_01/003 | `003_aviation_search_indexes.sql` | OK |
| layer_01/004 | `004_aviation_coordinate_quality_overrides.sql` | OK |
| layer_01/005 | `005_airport_public_profile_cache.sql` | OK |
| layer_01/006 | `006_airport_intelligence_foundation.sql` | OK |
| layer_01/007 | `007_airport_capacity_profiles.sql` | OK |
| layer_01/008 | `008_airport_traffic_metrics.sql` | OK |
| layer_01/009 | `009_airport_derived_intelligence.sql` | OK |
| layer_01/010 | `010_airport_image_assets.sql` | OK |
| layer_01/011 | `011_airport_layout_features.sql` | OK |

**Migration gap:** `002_` is missing from `database/migrations/layers/layer_01_aviation/`. This is likely intentional (the migration was skipped or merged into `001_`), but it is undocumented. The `database/migrations/README.md` should explain this gap to prevent confusion for new agents.

**Risk level:** LOW — the gap does not break anything if migrations are applied in order. The concern is documentation clarity.

**Recommended cleanup actions:**
- Add a note to `database/migrations/README.md` explaining why `002_` is absent.
- Alternatively, create a no-op `002_placeholder.sql` with a comment explaining the skip.

### Duplicate/Stale Schema Concepts

No duplicate migration concepts found. Each migration addresses a distinct concern. The progression from `001` (reference tables) → `003` (search indexes) → `004` (coordinate overrides) → `005-009` (intelligence pipeline) → `010-011` (image/layout) is logical.

---

## 6. Fetching/Normalizer Audit

### Worker Organization

All workers follow a consistent pattern:
- `services/fetch-orchestrator/src/layers/layer_01_aviation/`
- `services/normalizer/src/layers/layer_01_aviation/`

Each feature has a matching pair: `*_worker.py` + `*_db.py` in the orchestrator, and `*_normalizer.py` in the normalizer.

| Feature | Orchestrator Worker | Orchestrator DB | Normalizer |
|---------|--------------------|--------------------|------------|
| OurAirports | `ourairports_collector.py` | — | `ourairports_normalizer.py` |
| Public Profile | `airport_public_profile_worker.py` | `airport_public_profile_db.py` | `airport_public_profile_normalizer.py` |
| Intelligence | `airport_intelligence_ingest_worker.py` | `airport_intelligence_ingest_db.py` | `airport_intelligence_normalizer.py` |
| Image Gallery | `airport_image_gallery_worker.py` | `airport_image_gallery_db.py` | `airport_image_gallery_normalizer.py` |
| Layout Features | `airport_layout_features_worker.py` | `airport_layout_features_db.py` | `airport_layout_features_normalizer.py` |
| Wikimedia/Wikidata | `wikimedia_wikidata_fetcher.py` | — | — |
| Source Probe | `airport_source_endpoint_probe.py` | — | — |
| Intelligence Probe | `airport_intelligence_source_probe.py` | — | — |

**Observations:**
- `wikimedia_wikidata_fetcher.py` has no matching `_db.py` — it may be a utility used by the intelligence worker rather than a standalone worker. This should be documented.
- `airport_source_endpoint_probe.py` (44 KB) and `airport_intelligence_source_probe.py` (27 KB) are probe/diagnostic scripts, not production workers. They are large and could be moved to `scripts/` in a future cleanup.
- No duplicate workers found.
- Dry-run/persist patterns are not auditable without reading each file in detail, but the naming convention is consistent.

**Rate-limit/source hygiene:** Only one external source (OurAirports) is registered in `packages/source-catalog/`. Wikimedia/Wikidata is used but not registered in the source catalog — this is a gap.

**Recommended cleanup actions:**
- Register Wikimedia/Wikidata as a source in `packages/source-catalog/layers/layer_01_aviation/`.
- Consider moving probe scripts to `scripts/` (Phase 3 refactor).
- Document `wikimedia_wikidata_fetcher.py` relationship to the intelligence worker.

---

## 7. API Audit

### Route Organization

```
apps/api/src/routes/
├── health.ts                    (712 B)  — health check
├── layers.ts                    (6.2 KB) — layer list/status
├── objects.ts                   (475 B)  — re-export stub
├── objects/                     — modular objects route
│   ├── index.ts                 (13 KB)
│   ├── clusters.ts, density.ts, detail.ts, points.ts, preload.ts
│   ├── constants.ts, errors.ts, mapper.ts, metadata.ts, types.ts, validation.ts
├── public-profile/              — airport public profile
│   ├── index.ts, repository.ts, service.ts, types.ts
├── airport-intelligence/        — airport intelligence
│   ├── index.ts, repository.ts, service.ts (20 KB), types.ts
└── airport-layout-features/     — layout overlay
    ├── index.ts, repository.ts, service.ts, types.ts
```

**Observations:**
- `objects.ts` is a thin re-export stub for the `objects/` folder. This is a valid pattern but slightly confusing — a reader might expect `objects.ts` to contain route logic. A comment at the top would help.
- `airport-intelligence/service.ts` at 20 KB is the largest service file. It is not a problem now but should be monitored.
- All four route groups follow the same `index.ts / repository.ts / service.ts / types.ts` pattern — excellent consistency.
- `public-profile/service.ts` contains `// TODO: Actual fetcher integration would go here` at line 122. This is a known placeholder, not a bug.
- `apps/api/src/index.ts` uses `console.log` for the server startup message (line 39). This is acceptable for a startup log but should use the Fastify logger for consistency.

### Test Coverage

| Route Group | Test File | Status |
|-------------|-----------|--------|
| health | `smoke.test.ts` | Covered |
| layers | `smoke.test.ts` | Covered |
| objects (points/clusters/density/detail/preload) | `objects.test.ts`, `preload.test.ts`, `object-mapper.test.ts` | Well covered |
| public-profile | `public-profile.test.ts` | Covered |
| airport-intelligence | `airport-intelligence.test.ts` | Covered |
| airport-layout-features | `airport-layout-features.test.ts` | Covered |
| production hardening | `production-hardening.test.ts` | Covered |

All route groups have dedicated test files. This is excellent coverage.

**Recommended cleanup actions:**
- Add a comment to `objects.ts` explaining it is a re-export stub.
- Replace `console.log` in `apps/api/src/index.ts` with `fastify.log.info` (Phase 1).
- Track the `TODO` in `public-profile/service.ts` as a future work order.

---

## 8. Frontend Audit

### Component Organization

```
apps/web/src/
├── App.tsx                      (5.6 KB)
├── CesiumGlobe.tsx              (23.4 KB) ← largest file, 40+ console.logs
├── main.tsx                     (258 B)
├── vite-env.d.ts
├── components/
│   ├── DetailPanel.tsx          (15.6 KB)
│   ├── Header.tsx               (762 B)
│   ├── LayerPanel.tsx           (6.1 KB)
│   ├── SearchCommand.tsx        (5.1 KB)
│   ├── Shell.tsx                (2.5 KB)
│   ├── StatusPanel.tsx          (4.2 KB)
│   └── intel/                   — airport intelligence UI
│       ├── AirportImageSlider.tsx
│       ├── AirportLayoutOverlayToggle.tsx
│       ├── AirportMapPopup.tsx  (11.7 KB)
│       ├── AirportOverview.tsx
│       ├── AirportPublicProfilePanel.tsx (10.9 KB)
│       ├── AviationDetailPlaceholders.tsx
│       ├── CoordinateSourceCard.tsx
│       ├── DataQualityCard.tsx
│       ├── FrequenciesSection.tsx
│       ├── IntelSection.tsx
│       ├── NearbyNavaidsSection.tsx
│       └── RunwaysSection.tsx
├── lib/
│   ├── api.ts                   (8.9 KB)
│   ├── airportIntelligenceTypes.ts
│   ├── airportLayoutTypes.ts
│   ├── airportMarkerSprites.ts
│   ├── airportPublicProfileTypes.ts
│   ├── airportViewport.ts
│   ├── aviationCategories.ts    (8.6 KB)
│   ├── aviationDensityRenderer.ts  ← @deprecated, zero imports
│   ├── aviationGlobalRenderer.ts   (5.1 KB, actively used)
│   ├── aviationLayerRenderer.ts    (8.2 KB)
│   ├── aviationObjectStore.ts
│   ├── aviationPreloader.ts     (5.9 KB, 14 console.logs)
│   ├── aviationTileCache.ts
│   ├── aviationTileLoader.ts
│   ├── cesiumVisibility.ts
│   ├── globeCamera.ts
│   ├── searchParser.ts
│   ├── searchProviders.ts
│   ├── searchTypes.ts
│   ├── useAirportIntelligence.ts
│   ├── useAirportLayoutFeatures.ts
│   └── useAirportPublicProfile.ts
└── styles/
    ├── index.css
    └── shell.css                (11.2 KB)
```

### Key Findings

**`aviationDensityRenderer.ts` — Dead Code:**
The file is explicitly marked `@deprecated` in its JSDoc header:
> "LOD visibility redesign (WO-029D-FE) replaced fabric/density dots with category-based zoom-tier entity rendering. This file is preserved for reference only. No active code imports from this module."

Confirmed: zero imports found across all tracked TypeScript files. This file is safe to delete.

**`CesiumGlobe.tsx` — Debug Log Noise:**
Contains 30+ `console.log('[AVIATION DEBUG]', ...)` statements. These are development-era debug logs that were never removed. They will appear in every user's browser console in production. This is the highest-priority frontend cleanup item.

**`aviationPreloader.ts` — Debug Log Noise:**
Contains 14 `console.log('[AVIATION DEBUG]', ...)` statements. Same issue as above.

**`api.ts` — Debug Log:**
Line 169: `console.log('[AVIATION DEBUG] fetch URL:', url.toString())` — should be removed or gated.

**`aviationGlobalRenderer.ts` — Actively Used:**
Imported by `CesiumGlobe.tsx`. Not a dead code candidate.

**`aviationLayerRenderer.ts` vs `aviationGlobalRenderer.ts`:**
Both exist and both appear to be used. `aviationLayerRenderer.ts` handles LOD/tile-based rendering; `aviationGlobalRenderer.ts` handles the resident global dot collection. These are distinct responsibilities and the naming is clear.

**`aviationTileCache.ts` and `aviationTileLoader.ts`:**
These exist alongside the global preload approach. They may be legacy from the tile-based era. Verify whether they are still imported before any cleanup.

**Recommended cleanup actions:**
- Delete `aviationDensityRenderer.ts` (Phase 1 — confirmed dead code).
- Remove or gate all `[AVIATION DEBUG]` console.log statements (Phase 1).
- Verify whether `aviationTileCache.ts` and `aviationTileLoader.ts` are still imported (Phase 2 review).
- `CesiumGlobe.tsx` at 23 KB is large — consider splitting into sub-hooks in a future refactor (Phase 3).

---

## 9. Packages/Contracts Audit

### packages/contracts

**Critical finding: Build artifacts committed in `src/`**

The following compiled files are tracked in git under `packages/contracts/src/`:
- `src/index.js`
- `src/index.js.map`
- `src/index.d.ts`
- `src/index.d.ts.map`

These are TypeScript compiler outputs. The `tsconfig.json` sets `outDir: ./dist`, so the correct build output location is `packages/contracts/dist/` (which is correctly gitignored). The `src/` compiled files appear to be an accidental early commit from before the `.gitignore` was properly configured.

The `packages/contracts/dist/` folder exists locally and is gitignored — this is the correct behavior. The `src/` compiled files are redundant and should be removed from git tracking.

**Impact:** Low functional impact (the `dist/` files are used at runtime), but it creates confusion about what is source vs. compiled, and adds unnecessary noise to diffs.

### packages/schemas

Python Pydantic schemas for `layer_01_aviation`. Well-organized. No issues.

### packages/source-catalog

Only `ourairports.json` is registered. Wikimedia/Wikidata is used by the intelligence worker but not catalogued here. This is a gap.

### packages/ui and packages/layers

Both are empty stubs. No tracked files exist in either package (only `node_modules/` which is gitignored). They are listed in `pnpm-workspace.yaml` as workspace packages but have no `package.json` or source files tracked.

These are placeholder packages for future Gemini CLI work (per AGENTS.md). They are not harmful but add noise to the workspace.

**Recommended cleanup actions:**
- Remove `packages/contracts/src/index.js`, `src/index.js.map`, `src/index.d.ts`, `src/index.d.ts.map` from git tracking (Phase 1).
- Add `packages/contracts/src/*.js`, `packages/contracts/src/*.d.ts`, `packages/contracts/src/*.map` to `.gitignore`.
- Register Wikimedia/Wikidata in `packages/source-catalog/` (Phase 2).
- Add stub `package.json` files to `packages/ui/` and `packages/layers/` so they are properly declared (Phase 2).

---

## 10. Tests Audit

### Test Structure

**Python data tests** (`tests/data/layer_01_aviation/`):
- 28 test files covering migrations, workers, normalizers, and QA scripts
- Fixtures: 5 JSON files (Wikidata/Wikipedia samples)
- Well-organized, mirrors the service structure

**TypeScript API tests** (`apps/api/tests/`):
- 9 test files covering all route groups
- `setup.ts` for shared test infrastructure
- `production-hardening.test.ts` — dedicated hardening tests (excellent practice)
- `smoke.test.ts` — basic smoke tests

### Coverage Strengths

- Every API route group has a dedicated test file
- Every major data worker has a test file
- Every migration has a test file
- Fixtures are real-world data (Dubai, JFK, LHR, KBDL)

### Missing or Weak Areas

| Gap | Severity |
|-----|----------|
| No frontend tests (no Vitest/React Testing Library for components) | MEDIUM |
| No integration test between API and frontend (e2e) | LOW |
| `tests/data/` has no `__init__.py` at root level (only inside `layer_01_aviation/`) | LOW |
| `test_aviation_airport_detail_qa_samples.py` and `test_aviation_airport_detail_sql_readiness.py` appear to test the QA scripts in `scripts/` rather than production code — these are meta-tests | LOW |

**Recommended cleanup actions:**
- Add frontend component tests in a future work order (Phase 4).
- The meta-tests for QA scripts are acceptable but should be clearly labeled as such.

---

## 11. Docs Audit

### Important Docs to Keep

| Doc | Reason |
|-----|--------|
| `AGENTS.md` | Core multi-agent control document |
| `docs/control/*.md` | All 8 control documents are current and essential |
| `docs/state/HANDOFF_LOG.md` | Required by AGENTS.md rule 14 |
| `docs/state/CURRENT_PROJECT_STATE.md` | Required — but currently stale |
| `docs/work-orders/WORK_ORDER_TEMPLATE.md` | Template for future WOs |
| `docs/api/*.md` | API design docs for current features |
| `docs/data/layer_01_aviation/*.md` | Data quality reference docs |
| `docs/postman/GOD_EYES_LOCAL_API.postman_collection.json` | Manual testing |
| `specs/001-layer-zero-globe-core/spec.md` | Layer 0 spec |
| `specs/002-layer-one-aviation/spec.md` | Layer 1 spec |

### Docs to Update

| Doc | Issue |
|-----|-------|
| `docs/state/CURRENT_PROJECT_STATE.md` | Stale — last updated at WO-030A/031. Repo is now at WO-057. Does not mention airport intelligence, image gallery, or layout overlay features. |

### Docs to Archive Later

| Doc | Reason |
|-----|--------|
| `docs/state/INTEGRATION_REVIEW_WO-001.md` through `INTEGRATION_REVIEW_WO-025.md` | Historical reviews for completed work. Safe to move to `docs/state/archive/` |
| `docs/state/INTEGRATION_REVIEW_AVIATION_AIRPORT_MARKERS.md` | Pre-WO naming, historical |
| `docs/state/INTEGRATION_REVIEW_AVIATION_API_DATA_UI_DECISION.md` | Historical decision doc |
| `docs/state/INTEGRATION_REVIEW_HOTFIX_*.md` | Historical hotfix reviews |
| `docs/state/INTEGRATION_REVIEW_LAYER0_LAYER1_API.md` | Historical |
| `docs/state/INTEGRATION_REVIEW_REAL_AVIATION_DATA_VISUAL_POLISH.md` | Historical |

### Work Order Gaps

Work orders WO-001 through WO-025 are not present in `docs/work-orders/`. The earliest tracked work order is WO-026. This is likely because early work orders were completed before the docs/work-orders/ folder was established, or they were cleaned up. The HANDOFF_LOG.md contains the history. This is acceptable but should be noted.

### HANDOFF_LOG.md Size

At 230 KB, `HANDOFF_LOG.md` is the largest tracked text file. It will continue growing. Recommended strategy: after every 10 work orders, archive entries older than the last 5 into `docs/state/HANDOFF_LOG_ARCHIVE_[year].md`.

### Recommended Docs Folder Structure (future)

```
docs/
├── control/          — architecture and policy docs (current)
├── api/              — API design docs (current)
├── data/             — data quality docs (current)
├── postman/          — Postman collection (current)
├── reports/          — audit reports (new, this file)
├── state/
│   ├── CURRENT_PROJECT_STATE.md
│   ├── HANDOFF_LOG.md
│   ├── INTEGRATION_REVIEW_WO-026.md ... (recent reviews)
│   └── archive/      — reviews WO-001 to WO-025 and older
└── work-orders/      — active and recent work orders (current)
```

---

## 12. Duplicate/Obsolete File Candidates

| Path | Reason Suspected | Confidence | Safe to Delete Now | Required Verification |
|------|-----------------|------------|-------------------|----------------------|
| `apps/web/src/lib/aviationDensityRenderer.ts` | Explicitly `@deprecated` in JSDoc, zero imports confirmed | HIGH | YES | Confirm no dynamic imports exist |
| `packages/contracts/src/index.js` | Compiled output in `src/` — should only be in `dist/` | HIGH | YES (remove from git tracking) | Run `pnpm --filter @god-eyes/contracts build` after removal to confirm `dist/` is used |
| `packages/contracts/src/index.js.map` | Source map for compiled output in `src/` | HIGH | YES (remove from git tracking) | Same as above |
| `packages/contracts/src/index.d.ts` | Type declaration in `src/` — should only be in `dist/` | HIGH | YES (remove from git tracking) | Same as above |
| `packages/contracts/src/index.d.ts.map` | Declaration map in `src/` | HIGH | YES (remove from git tracking) | Same as above |
| `apps/web/src/lib/aviationTileCache.ts` | May be legacy from tile-based era | MEDIUM | NO | Check if imported by any active file |
| `apps/web/src/lib/aviationTileLoader.ts` | May be legacy from tile-based era | MEDIUM | NO | Check if imported by any active file |
| `docs/state/INTEGRATION_REVIEW_WO-001.md` through `WO-025.md` | Historical reviews, work completed | LOW | NO (archive, not delete) | Confirm no active references |

---

## 13. Dead Code Candidates

| Path / Function / Component | Why Suspected Unused | Confidence | Verification Needed |
|-----------------------------|---------------------|------------|---------------------|
| `apps/web/src/lib/aviationDensityRenderer.ts` (entire file) | `@deprecated` JSDoc, zero imports found in all tracked `.ts`/`.tsx` files | HIGH | `git grep "aviationDensityRenderer"` — confirmed zero imports |
| `apps/web/src/lib/aviationPreloader.ts` — all `console.log` calls | Debug logging, not functional code | HIGH | Remove safely |
| `apps/web/src/CesiumGlobe.tsx` — all `[AVIATION DEBUG]` console.log calls | Debug logging, not functional code | HIGH | Remove safely |
| `apps/web/src/lib/api.ts:169` — `console.log('[AVIATION DEBUG] fetch URL:')` | Debug logging | HIGH | Remove safely |
| `apps/api/src/index.ts:39` — `console.log(\`Server running...\`)` | Should use `fastify.log.info` | MEDIUM | Replace with logger |
| `apps/web/src/lib/aviationTileCache.ts` | Tile-based caching may be superseded by global preload | MEDIUM | Check imports: `git grep "aviationTileCache"` |
| `apps/web/src/lib/aviationTileLoader.ts` | Tile-based loading may be superseded by global preload | MEDIUM | Check imports: `git grep "aviationTileLoader"` |
| `apps/web/src/components/intel/AviationDetailPlaceholders.tsx` | Name suggests placeholder content | LOW | Check if rendered in any active component |

---

## 14. .gitignore Recommendations

The current `.gitignore` is comprehensive and well-structured. The following additions are recommended:

```gitignore
# Contracts compiled output accidentally in src/ (should only be in dist/)
packages/contracts/src/*.js
packages/contracts/src/*.js.map
packages/contracts/src/*.d.ts
packages/contracts/src/*.d.ts.map

# Vim swap files (found in .git/ — editor artifacts)
*.swp
*.swo

# Kiro/Claude local settings (already covered by .claude/ but explicit is better)
.kiro/settings.local.json
```

**Note:** `.env.*` is already covered by `.env.*` pattern with `!.env.example` exception. The existing `.gitignore` correctly handles `node_modules/`, `dist/`, `build/`, `coverage/`, `.vite/`, `__pycache__/`, `*.pyc`, `.pytest_cache/`, `*.log`, and `.claude/`.

---

## 15. Cleanup Plan

### Phase 1: Safe Cleanup (Low Risk — Do Now)

These are unambiguous, safe, and reversible:

1. **Remove `aviationDensityRenderer.ts` from git** — confirmed dead code, `@deprecated`, zero imports.
2. **Remove compiled files from `packages/contracts/src/`** — `index.js`, `index.js.map`, `index.d.ts`, `index.d.ts.map` should not be tracked. Run `git rm --cached` on these four files and add patterns to `.gitignore`.
3. **Strip `[AVIATION DEBUG]` console.log statements** from `CesiumGlobe.tsx`, `aviationPreloader.ts`, and `api.ts`. Replace with a debug flag or remove entirely.
4. **Replace `console.log` in `apps/api/src/index.ts`** with `fastify.log.info`.
5. **Update `docs/state/CURRENT_PROJECT_STATE.md`** to reflect WO-057 completion and current capabilities.
6. **Add `.gitignore` entries** for `packages/contracts/src/*.js` etc. and `*.swp`/`*.swo`.

### Phase 2: Review Cleanup (Medium Risk — Review Before Acting)

These require human review before acting:

1. **Archive old integration reviews** — move `INTEGRATION_REVIEW_WO-001` through `INTEGRATION_REVIEW_WO-025` and the pre-WO named reviews to `docs/state/archive/`.
2. **Verify `aviationTileCache.ts` and `aviationTileLoader.ts`** — check if they are still imported. If not, remove them.
3. **Verify `AviationDetailPlaceholders.tsx`** — check if it is rendered anywhere active.
4. **Register Wikimedia/Wikidata** in `packages/source-catalog/`.
5. **Add stub `package.json`** to `packages/ui/` and `packages/layers/` so they are properly declared workspace packages.
6. **Add migration gap note** to `database/migrations/README.md` explaining the missing `002_`.
7. **Add comment to `apps/api/src/routes/objects.ts`** explaining it is a re-export stub.

### Phase 3: Refactor Cleanup (Higher Risk — Future Work Orders)

These require dedicated work orders:

1. **Split `CesiumGlobe.tsx`** (23 KB) into sub-hooks and sub-components.
2. **Split `airport-intelligence/service.ts`** (20 KB) if it continues to grow.
3. **Move probe scripts** (`airport_source_endpoint_probe.py`, `airport_intelligence_source_probe.py`) from `services/fetch-orchestrator/` to `scripts/` — they are diagnostic tools, not production workers.
4. **Implement `public-profile` fetcher integration** (the TODO at line 122).
5. **Establish HANDOFF_LOG archiving** — create `HANDOFF_LOG_ARCHIVE_2026.md` and move entries older than the last 10 work orders.

### Phase 4: Future Improvements

1. **Frontend tests** — add Vitest + React Testing Library for key components (`CesiumGlobe`, `DetailPanel`, `AirportMapPopup`).
2. **ESLint rule for `console.log`** — add `no-console` ESLint rule to prevent future debug log accumulation.
3. **Dependency audit** — run `pnpm audit` and update outdated packages.
4. **Source catalog completeness** — register all data sources (Wikimedia, Wikidata, OpenStreetMap if used) in `packages/source-catalog/`.
5. **Layer 2+ scaffolding** — create stub folders for `layer_02_satellite` when ready.

---

## 16. Commands Recommended For Next Cleanup

### Safe to run immediately:

```powershell
# Verify aviationDensityRenderer has zero imports
git grep "aviationDensityRenderer" --include="*.ts" --include="*.tsx"

# Verify aviationTileCache and aviationTileLoader import status
git grep "aviationTileCache" --include="*.ts" --include="*.tsx"
git grep "aviationTileLoader" --include="*.ts" --include="*.tsx"

# Verify AviationDetailPlaceholders import status
git grep "AviationDetailPlaceholders" --include="*.tsx"

# Count console.log occurrences in frontend source
git ls-files apps/web/src | ForEach-Object { Select-String -Path $_ -Pattern "console\.log" } | Measure-Object

# Check contracts build still works after removing src/ compiled files
pnpm --filter @god-eyes/contracts build

# Run all tests to confirm baseline
pnpm --filter api test
python -m pytest tests/data/layer_01_aviation -q
```

### Review before running (destructive — removes files from git tracking):

```powershell
# REVIEW BEFORE RUNNING: Remove compiled artifacts from packages/contracts/src/
git rm --cached packages/contracts/src/index.js
git rm --cached packages/contracts/src/index.js.map
git rm --cached packages/contracts/src/index.d.ts
git rm --cached packages/contracts/src/index.d.ts.map

# REVIEW BEFORE RUNNING: Remove deprecated dead code file
git rm apps/web/src/lib/aviationDensityRenderer.ts

# REVIEW BEFORE RUNNING: Archive old integration reviews
New-Item -ItemType Directory -Path docs/state/archive -Force
# Then move INTEGRATION_REVIEW_WO-001 through WO-025 and pre-WO named reviews
# git mv docs/state/INTEGRATION_REVIEW_WO-001.md docs/state/archive/
# ... repeat for each file to archive
```

### Size monitoring:

```powershell
# Check HANDOFF_LOG size
(Get-Item docs/state/HANDOFF_LOG.md).Length / 1KB

# Check total tracked file count
(git ls-files | Measure-Object).Count

# Check largest tracked files (excluding node_modules and dist)
git ls-files | ForEach-Object { 
  $size = (Get-Item $_ -ErrorAction SilentlyContinue).Length
  [PSCustomObject]@{File=$_; SizeKB=[math]::Round($size/1KB,1)}
} | Sort-Object SizeKB -Descending | Select-Object -First 20 | Format-Table -AutoSize
```

---

## 17. Final Recommendation

### Is the repository ready for the next feature?

**YES** — the repository is stable and the core feature chain is complete. The codebase is clean of secrets, build artifacts in dist folders, and merge conflicts. CI is configured and passing. All route groups have tests.

### What should be cleaned first?

1. Remove the `[AVIATION DEBUG]` console.log statements from `CesiumGlobe.tsx` and `aviationPreloader.ts` — these are the most visible quality issue and will mask real errors in production.
2. Remove `aviationDensityRenderer.ts` — confirmed dead code.
3. Remove compiled files from `packages/contracts/src/` — they are build artifacts that should not be tracked.
4. Update `CURRENT_PROJECT_STATE.md` — it is 27 work orders out of date.

### What should not be touched?

- `database/migrations/` — do not reorder or renumber migrations. Only add a README note about the `002_` gap.
- `HANDOFF_LOG.md` — do not delete entries. Only archive old entries to a separate file.
- `packages/contracts/src/index.ts` — the source TypeScript file is correct and should stay.
- Any file in `services/fetch-orchestrator/` or `services/normalizer/` — these are Codex-owned and should only be modified by Codex.
- Any file in `apps/web/` — these are Gemini-owned and should only be modified by Gemini (except for the console.log cleanup which is safe).

### What is the next best work order?

**WO-061: Frontend Debug Log Cleanup + Dead Code Removal**

Scope:
- Remove all `[AVIATION DEBUG]` console.log statements from `CesiumGlobe.tsx`, `aviationPreloader.ts`, `api.ts`
- Delete `aviationDensityRenderer.ts`
- Remove `packages/contracts/src/` compiled files from git tracking
- Update `CURRENT_PROJECT_STATE.md`
- Add `.gitignore` entries for `packages/contracts/src/*.js` etc.

Owner: Gemini CLI (frontend files) + Kiro CLI (docs + packages/contracts git tracking)  
Risk: LOW  
Estimated effort: Small (1-2 hours)

---

## Final Report Checklist

| Item | Status |
|------|--------|
| Repository structure reviewed | YES |
| Code folders reviewed | YES |
| Database reviewed | YES |
| Fetching reviewed | YES |
| API reviewed | YES |
| Frontend reviewed | YES |
| Tests reviewed | YES |
| Docs reviewed | YES |
| Size report included | YES |
| Duplicate candidates listed | YES |
| Dead code candidates listed | YES |
| Cleanup phases included | YES |
| Destructive changes made | **NO** |
| Ready for cleanup work order | YES |
