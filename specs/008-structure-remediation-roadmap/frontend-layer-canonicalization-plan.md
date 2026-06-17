# Frontend Layer Folder Canonicalization Plan

Classification: SPEC_WORKSPACE
Status: **Completed** (post-SR-016 docs closure)
Owner: Documentation Planning Agent
Branch: plan/frontend-layer-canonicalization
Date: 2026-06-16

> **Completion banner.** This plan was implemented end to end. The
> per-layer renames were completed by **SR-010, SR-010S, SR-011,
> SR-013, SR-012, SR-014, and SR-009**, and the temporary old-name
> shim folders plus the missing Weather/News `index.ts` files were
> finalized by the frontend shape cleanup on branch
> `frontend/sr-015/final-layer-shape-cleanup` (commit `09bfc27`).
> The detailed planning content below is preserved as the audit
> trail. The "Current Frontend Layer Folders" and "Target Canonical
> Folders" tables now show the final state, with old folders
> marked as **Removed** and new folders marked as **Active** rather
> than **Rename needed**. Validation passed: `pnpm --filter web
> build`, `pnpm --filter web test`, `pnpm --filter api build`,
> `pnpm --filter api test`, and `python -m pytest tests/data -q`
> on a clean tree. The user reported real backend and database
> runtime validation passed after the frontend closure cleanup. No
> push, PR, merge, or branch deletion has been performed.

## Purpose

This planning document defines the implementation strategy for canonicalizing frontend layer folder names under `apps/web/src/layers/`. The goal is to rename grandfathered short-name folders to match the canonical `layer_id` pattern defined in `docs/control/PROJECT_CONTROL.md`.

## Current Frontend Layer Folders (final state)

The following directories exist under `apps/web/src/layers/` (final
state after the frontend shape cleanup):

| Current Folder | Contents | Canonical Target |
|----------------|----------|------------------|
| `layer_01_aviation/` | `aircraft/`, `airports/`, `index.ts` | **Active** (was `aviation/`) |
| `layer_02_borders_boundaries/` | `useBordersBoundaries.ts`, `index.ts` | **Active** (was `borders/`) |
| `layer_03_earth_events/` | `useEarthEvents.ts`, `index.ts` | **Active** (was `earth-events/`) |
| `layer_05_space_satellites/` | `satellites/`, `index.ts` | **Active** (was `space/`) |
| `layer_06_maritime/` | `maritimeApi.ts`, `MaritimeLayer.tsx`, `useMaritime.ts`, `vesselMarker.ts`, `__tests__/`, `index.ts` | **Active** (was `maritime/`) |
| `layer_07_weather/` | `useWeather.ts`, `weatherTypes.ts`, `weatherDetail.ts`, `weatherMarker.ts`, `weatherApi.ts`, `WeatherLayer.tsx`, `__tests__/`, `index.ts` | **Active** (already canonical; `index.ts` added in the frontend shape cleanup) |
| `layer_08_news_osint/` | `useNews.ts`, `newsTypes.ts`, `newsDetail.ts`, `newsMarker.ts`, `newsApi.ts`, `NewsLayer.tsx`, `__tests__/`, `index.ts` | **Active** (already canonical; `index.ts` added in the frontend shape cleanup) |
| `layer_10_energy_infrastructure/` | `infrastructure/`, `index.ts` | **Active** (was `energy/`) |
| `aviation/`, `borders/`, `earth-events/`, `space/`, `maritime/`, `energy/` | — | **Removed** in the frontend shape cleanup |
| `layer_04_public_military_security/`, `layer_09_user_shapes/` | — | **Intentionally not created** (future inactive layers; created only when implementation starts) |

## Target Canonical Folders (final state)

| Current | Target | Status |
|---------|--------|--------|
| `aviation/` | `layer_01_aviation/` | **Done** (renamed in SR-009) |
| `borders/` | `layer_02_borders_boundaries/` | **Done** (renamed in SR-010/SR-010S) |
| `earth-events/` | `layer_03_earth_events/` | **Done** (renamed in SR-011) |
| `space/` | `layer_05_space_satellites/` | **Done** (renamed in SR-012) |
| `maritime/` | `layer_06_maritime/` | **Done** (renamed in SR-013) |
| `energy/` | `layer_10_energy_infrastructure/` | **Done** (renamed in SR-014) |
| `layer_07_weather/` | `layer_07_weather/` | **Active** (already canonical; `index.ts` added in shape cleanup) |
| `layer_08_news_osint/` | `layer_08_news_osint/` | **Active** (already canonical; `index.ts` added in shape cleanup) |
| Old shim folders (`aviation/`, `borders/`, `earth-events/`, `space/`, `maritime/`, `energy/`) | — | **Removed** in the frontend shape cleanup |

**Out of scope (confirmed final):**
- `layer_04_public_military_security` (coming_soon; not created)
- `layer_09_user_shapes` (coming_soon; not created)

## Import Impact Analysis

### aviation (35 imports)

**App entry/rendering files:**
- `apps/web/src/CesiumGlobe.tsx` (8 imports)
- `apps/web/src/App.tsx` (3 imports)

**Utility files:**
- `apps/web/src/lib/api.ts` (3 imports)

**Components:**
- `apps/web/src/components/StatusPanel.tsx` (1 import)
- `apps/web/src/components/Shell.tsx` (3 imports)
- `apps/web/src/components/intel/AirportLayoutOverlayToggle.tsx` (1 import)
- `apps/web/src/components/intel/AirportImageSlider.tsx` (1 import)
- `apps/web/src/components/intel/AirportOverview.tsx` (1 import)
- `apps/web/src/components/intel/AirportMapPopup.tsx` (2 imports)
- `apps/web/src/components/intel/AirportPublicProfilePanel.tsx` (1 import)
- `apps/web/src/components/detail-panel/SourcesSection.tsx` (1 import)
- `apps/web/src/components/detail-panel/detailTypes.ts` (1 import)
- `apps/web/src/components/detail-panel/DetailPanelRoot.tsx` (2 imports)
- `apps/web/src/components/detail-panel/AviationDetail.tsx` (3 imports)
- `apps/web/src/components/layer-panel/AviationControls.tsx` (2 imports)
- `apps/web/src/components/layer-panel/layerPanelTypes.ts` (2 imports)

### borders (5 imports)

**App entry/rendering files:**
- `apps/web/src/App.tsx` (1 import)

**Components:**
- `apps/web/src/components/StatusPanel.tsx` (1 import)
- `apps/web/src/components/Shell.tsx` (1 import)
- `apps/web/src/components/layer-panel/layerPanelTypes.ts` (1 import)
- `apps/web/src/components/layer-panel/LayerPanelRoot.tsx` (1 import)

### earth-events (5 imports)

**App entry/rendering files:**
- `apps/web/src/App.tsx` (1 import)

**Components:**
- `apps/web/src/components/StatusPanel.tsx` (1 import)
- `apps/web/src/components/Shell.tsx` (1 import)
- `apps/web/src/components/layer-panel/LayerPanelRoot.tsx` (1 import)
- `apps/web/src/components/layer-panel/layerPanelTypes.ts` (1 import)

### space (16 imports)

**App entry/rendering files:**
- `apps/web/src/CesiumGlobe.tsx` (4 imports)
- `apps/web/src/App.tsx` (4 imports)

**Components:**
- `apps/web/src/components/StatusPanel.tsx` (1 import)
- `apps/web/src/components/Shell.tsx` (2 imports)
- `apps/web/src/components/overlays/SatelliteInfoOverlay.tsx` (1 import)
- `apps/web/src/components/layer-panel/SpaceControls.tsx` (2 imports)
- `apps/web/src/components/layer-panel/layerPanelTypes.ts` (2 imports)

### maritime (3 imports)

**App entry/rendering files:**
- `apps/web/src/App.tsx` (2 imports)
- `apps/web/src/CesiumGlobe.tsx` (1 import)

### energy (10 imports)

**App entry/rendering files:**
- `apps/web/src/CesiumGlobe.tsx` (2 imports)
- `apps/web/src/App.tsx` (2 imports)

**Components:**
- `apps/web/src/components/Shell.tsx` (2 imports)
- `apps/web/src/components/detail-panel/EnergyDetail.tsx` (1 import)
- `apps/web/src/components/layer-panel/layerPanelTypes.ts` (1 import)
- `apps/web/src/components/detail-panel/detailTypes.ts` (1 import)
- `apps/web/src/components/layer-panel/EnergyControls.tsx` (1 import)

### Import Impact Summary

| Layer | Import Count | Files Affected | Complexity |
|-------|-------------|----------------|------------|
| aviation | 35 | 15 | High |
| space | 16 | 7 | Medium |
| energy | 10 | 7 | Medium |
| borders | 5 | 5 | Low |
| earth-events | 5 | 5 | Low |
| maritime | 3 | 2 | Low |

**Total:** 74 imports across 29 unique files.

### No imports found in:
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

## Implementation Sequence

Recommended order from lowest to highest risk:

### Phase 1: Low-risk layers (1 commit each)
1. **borders** - Simplest; 5 imports, single hook file
2. **earth-events** - Similar complexity to borders; 5 imports
3. **maritime** - 3 imports but more files; self-contained

### Phase 2: Medium-risk layers (1 commit each)
4. **space** - 16 imports; has `satellites/` subfolder
5. **energy** - 10 imports; has `infrastructure/` subfolder

### Phase 3: High-risk layer (1 commit)
6. **aviation** - Most complex; 35 imports, multiple subfolders

**Alternative grouped approach:**
- Commit 1: borders + earth-events (both low-risk, small files)
- Commit 2: maritime
- Commit 3: space
- Commit 4: energy
- Commit 5: aviation

## Compatibility Strategy

### Re-export Shims

For each renamed folder, create a compatibility re-export at the old path:

```typescript
// apps/web/src/layers/aviation/index.ts (shim)
export * from '../layer_01_aviation';
```

Or for folders without an index.ts:

```typescript
// apps/web/src/layers/aviation.ts (shim)
export * from './layer_01_aviation';
```

### Import Update Strategy

1. **Atomic rename** - Rename folder first
2. **Create shim** - Add compatibility re-export at old path
3. **Update imports** - Change all importers to use new path
4. **Verify build** - Ensure no broken imports
5. **Remove shim** - After all imports updated (can be done in same commit or deferred)

### Recommendation

Given that all imports are within `apps/web/src/` and no external packages reference these paths, **re-export shims are optional but recommended** for safety. They allow gradual migration and prevent breakage if any imports are missed.

For this implementation, **use shims during the transition** and remove them once all imports are verified updated.

## Validation Plan

### Pre-Implementation
- [ ] `git status --short --branch` shows clean state
- [ ] `git diff --check` passes

### Per-Layer Validation
After each layer rename:
1. **Web build:**
   ```bash
   pnpm --filter web build
   ```

2. **Web tests:**
   ```bash
   pnpm --filter web test
   ```

3. **Import grep checks:**
   ```bash
   rg "from ['\"].*layers/OLD_NAME['\"]" apps packages tests
   rg "layers/OLD_NAME" apps packages tests specs docs --glob '!docs/archive/**'
   ```

4. **Verify new path exists:**
   ```bash
   Get-ChildItem apps/web/src/layers -Directory | Select-Object Name
   ```

5. **Verify old path removed (or shim in place):**
   ```bash
   Test-Path "apps/web/src/layers/OLD_NAME"
   ```

### Post-Implementation (all layers)
1. **Full web build:**
   ```bash
   pnpm --filter web build
   ```

2. **Full web tests:**
   ```bash
   pnpm --filter web test
   ```

3. **Data tests:**
   ```bash
   python -m pytest tests/data -q
   ```

4. **Final import grep:**
   ```bash
   rg "layers/(aviation|borders|earth-events|space|maritime|energy)" apps packages tests --glob '!*.md'
   ```

5. **Git diff check:**
   ```bash
   git diff --check
   ```

## Reviewer Checklist

After implementation, Reviewer Agent must verify:

### File Placement
- [ ] All renamed folders match canonical `layer_id` from `PROJECT_CONTROL.md`
- [ ] No folders created for `coming_soon` layers (04, 09)
- [ ] Existing canonical folders (07, 08) unchanged

### Folder Naming
- [ ] `layer_01_aviation` exists
- [ ] `layer_02_borders_boundaries` exists
- [ ] `layer_03_earth_events` exists
- [ ] `layer_05_space_satellites` exists
- [ ] `layer_06_maritime` exists
- [ ] `layer_10_energy_infrastructure` exists
- [ ] Old folders removed or have re-export shims

### Import Updates
- [ ] `git grep "layers/aviation"` returns only shim (if present)
- [ ] `git grep "layers/borders"` returns only shim (if present)
- [ ] `git grep "layers/earth-events"` returns only shim (if present)
- [ ] `git grep "layers/space"` returns only shim (if present)
- [ ] `git grep "layers/maritime"` returns only shim (if present)
- [ ] `git grep "layers/energy"` returns only shim (if present)
- [ ] All imports use new canonical paths

### Build & Tests
- [ ] `pnpm --filter web build` passes
- [ ] `pnpm --filter web test` passes
- [ ] `python -m pytest tests/data -q` passes

### Security
- [ ] No secrets added
- [ ] No `.env` files committed
- [ ] No `node_modules/` committed

### Documentation
- [ ] `HANDOFF_LOG.md` appended
- [ ] `RECENT_CONTEXT.md` updated
- [ ] No changes to `docs/control/`, `docs/archive/`, `specs/` (except this plan)

## Stop Conditions

The implementation agent must stop and request review if:

1. **Build fails** after any folder rename
2. **Tests fail** and failures are not pre-existing
3. **Import grep** finds references to old paths outside of shims
4. **Ambiguity** about where a file belongs after rename
5. **Cross-boundary imports** discovered (frontend importing from services/api)
6. **Missing files** in renamed folder
7. **TypeScript errors** related to path resolution
8. **Vite config** references old paths (would require config update)

## Known Issues

None at planning stage.

## Commit Strategy

### Commit Message Format
```
refactor(web): rename LAYER_NAME to canonical LAYER_ID

Agent: Frontend Agent
Work order: SR-0XX
Branch: frontend/sr-0XX/layer-name-canonical-folder
Summary: Renamed apps/web/src/layers/OLD_NAME to NEW_NAME; added re-export shim; updated all importers
Commands run: pnpm --filter web build, pnpm --filter web test, python -m pytest tests/data -q
Known issues: none
Forbidden folders touched: no
Secrets added: no
```

### Per-Commit Scope
- One layer per commit (preferred for clean history)
- Or grouped low-risk layers in one commit

## Recommended Next Step

Reviewer Agent should review this plan before implementation begins. After review approval, Frontend Agent should execute SR-009 through SR-014 tasks in the recommended sequence.

---

**Last updated:** 2026-06-16
**Author:** Documentation Planning Agent
**Maintained by:** Orchestrator Agent
