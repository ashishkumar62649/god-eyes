# Final Report — Frontend Layer Canonicalization Plan

**Agent:** Documentation Planning Agent

**Branch:** plan/frontend-layer-canonicalization

**Scope:** Planning only

## Files Created

- `specs/008-structure-remediation-roadmap/frontend-layer-canonicalization-plan.md`
- `specs/008-structure-remediation-roadmap/frontend-layer-canonicalization-plan-report.md` (this file)

## Files Modified

- `docs/state/RECENT_CONTEXT.md` (added entry, removed oldest)
- `docs/state/HANDOFF_LOG.md` (appended entry)

## Current Folders Found

- `apps/web/src/layers/aviation/` (contains `aircraft/`, `airports/`, `.gitkeep`)
- `apps/web/src/layers/borders/` (contains `useBordersBoundaries.ts`, `.gitkeep`)
- `apps/web/src/layers/earth-events/` (contains `useEarthEvents.ts`, `.gitkeep`)
- `apps/web/src/layers/space/` (contains `satellites/`)
- `apps/web/src/layers/maritime/` (contains `maritimeApi.ts`, `MaritimeLayer.tsx`, `useMaritime.ts`, `vesselMarker.ts`, `__tests__/`)
- `apps/web/src/layers/energy/` (contains `infrastructure/`)
- `apps/web/src/layers/layer_07_weather/` (already canonical)
- `apps/web/src/layers/layer_08_news_osint/` (already canonical)

## Target Folders

| Current | Target | Status |
|---------|--------|--------|
| `aviation/` | `layer_01_aviation/` | Rename needed |
| `borders/` | `layer_02_borders_boundaries/` | Rename needed |
| `earth-events/` | `layer_03_earth_events/` | Rename needed |
| `space/` | `layer_05_space_satellites/` | Rename needed |
| `maritime/` | `layer_06_maritime/` | Rename needed |
| `energy/` | `layer_10_energy_infrastructure/` | Rename needed |
| `layer_07_weather/` | `layer_07_weather/` | Already canonical |
| `layer_08_news_osint/` | `layer_08_news_osint/` | Already canonical |

## Import Impact Summary

| Layer | Import Count | Files Affected | Risk Level |
|-------|-------------|----------------|------------|
| aviation | 35 | 15 | High |
| space | 16 | 7 | Medium |
| energy | 10 | 7 | Medium |
| borders | 5 | 5 | Low |
| earth-events | 5 | 5 | Low |
| maritime | 3 | 2 | Low |

**Total:** 74 imports across 29 unique files.

**No imports found in:**
- `packages/` directory
- `tests/` directory
- Configuration files (`tsconfig.json`, `vite.config.ts`)

## Risk Classification

### Low Risk
- **borders** - 5 imports, small hook file, minimal dependencies
- **earth-events** - 5 imports, small hook file, minimal dependencies
- **maritime** - 3 imports, self-contained layer with clear boundaries

### Medium Risk
- **space** - 16 imports, has `satellites/` subfolder with multiple type/hook files
- **energy** - 10 imports, has `infrastructure/` subfolder with multiple type/hook files

### High Risk
- **aviation** - 35 imports across many files, has `aircraft/` and `airports/` subfolders, most complex layer

## Recommended Implementation Order

### Phase 1: Low-risk layers (1 commit each)
1. **borders** - Simplest; 5 imports, single hook file
2. **earth-events** - Similar complexity to borders; 5 imports
3. **maritime** - 3 imports but more files; self-contained

### Phase 2: Medium-risk layers (1 commit each)
4. **space** - 16 imports; has `satellites/` subfolder
5. **energy** - 10 imports; has `infrastructure/` subfolder

### Phase 3: High-risk layer (1 commit)
6. **aviation** - Most complex; 35 imports, multiple subfolders

## Validation Plan

### Pre-Implementation
- [x] `git status --short --branch` shows clean state
- [x] `git diff --check` passes (CRLF warnings only)

### Per-Layer Validation (for implementation agent)
1. Web build: `pnpm --filter web build`
2. Web tests: `pnpm --filter web test`
3. Import grep checks
4. Verify new path exists
5. Verify old path removed (or shim in place)

### Post-Implementation (all layers)
1. Full web build: `pnpm --filter web build`
2. Full web tests: `pnpm --filter web test`
3. Data tests: `python -m pytest tests/data -q`
4. Final import grep
5. Git diff check

## Reviewer Checklist

- [ ] All renamed folders match canonical `layer_id` from `PROJECT_CONTROL.md`
- [ ] No folders created for `coming_soon` layers (04, 09)
- [ ] Existing canonical folders (07, 08) unchanged
- [ ] Old folders removed or have re-export shims
- [ ] All imports use new canonical paths
- [ ] `pnpm --filter web build` passes
- [ ] `pnpm --filter web test` passes
- [ ] `python -m pytest tests/data -q` passes
- [ ] No secrets added
- [ ] `HANDOFF_LOG.md` appended
- [ ] `RECENT_CONTEXT.md` updated

## Commit

**Latest commit:** `72e39de` chore(gitignore): untrack .kiro/ local steering and skills

**Planning document commit:** Not yet committed (local only)

## Push Status

Local only / NOT pushed

## Known Issues

1. **Pre-existing scope-guard test failures:** 8 data tests fail because they detect documentation changes outside their allowed paths. These are pre-existing scope-guard tests that are expected to fail when there are documentation changes. They are not caused by this planning work.

2. **CRLF warnings:** `git diff --check` shows CRLF warnings for `docs/state/HANDOFF_LOG.md`. This is a line-ending issue, not a content issue.

## Ready for Reviewer Agent

YES

## Recommended Next Step

Reviewer Agent reviews the plan before implementation. After review approval, Frontend Agent should execute SR-009 through SR-014 tasks in the recommended sequence.

---

**Last updated:** 2026-06-16
**Author:** Documentation Planning Agent
**Branch:** plan/frontend-layer-canonicalization
