# Dead/Duplicate Code Investigation — 2026-06-19

Classification: AUDIT_EVIDENCE (investigation only, no production code changes)
Work order: DISC-1
Agent: Dead Code Audit Agent
Branch: `review/dead-code-investigation`
Worktree: `E:\god-eyes-worktrees\review-dead-code-investigation`
Base commit: `40718e9 Merge pull request #62 from ashishkumar62649/api/wo-3-1-centralize-type-date-utils` (latest `main`, includes WO-1-4 and WO-3-1)

---

## Context

This is an **investigation-only / docs-only** audit. Its goal is to verify, with
repo-level evidence, which suspected files are truly dead, duplicated,
deprecated-but-referenced, confusingly named, or actually in use. It does **not**
delete, refactor, or touch any production code. Each candidate is classified so a
later, separate work order can act on the findings.

Suspected candidates supplied by the work-order brief:

```text
packages/schemas/
apps/web/src/layers/layer_10_energy_infrastructure/infrastructure/energyInfrastructureApi.ts
apps/web/src/layers/layer_01_aviation/airports/aviationTileCache.ts
apps/web/src/layers/layer_01_aviation/airports/aviationTileLoader.ts
apps/web/src/globe/globeCamera.ts
apps/web/src/layers/layer_01_aviation/airports/globeCamera.ts
apps/web/src/layers/layer_01_aviation/aircraft/aircraftMarker.ts
```

Two additional candidates surfaced during investigation and are included
(`airportViewport.ts`, `aviationLayerRenderer.ts`) because they are in the same
aviation/airports folder as the suspected dead files and have the same evidence
profile. The investigation stayed focused on these candidates and did not expand
into a full architecture audit.

Classification vocabulary (used in the table and details below):

- **Confirmed dead / safe deletion candidate** — no references anywhere; removal has no caller impact.
- **Duplicate implementation / needs consolidation** — two or more modules implement overlapping behavior.
- **Confusing duplicate name / rename or documentation candidate** — name implies a duplicate that does not exist.
- **Deprecated but still referenced** — marked deprecated but still imported/called.
- **Currently used / do not remove** — actively imported and called.
- **Future/planned placeholder / needs product decision** — intentionally stubbed for future work.
- **Unknown / needs deeper dynamic-runtime check** — static evidence is insufficient.

---

## Executive Summary

- The single biggest surprise: **the suspected duplicate `apps/web/src/globe/globeCamera.ts` does not exist.** `git ls-files "**/globeCamera.*"` returns exactly one file: `apps/web/src/layers/layer_01_aviation/airports/globeCamera.ts`. That one file is itself dead (its exports have zero callers), but there is no duplication to resolve. This is a **confusing-name** finding, not a duplication finding.
- **`packages/schemas/` is NOT dead.** It is a Python Pydantic package with 6 active imports across `services/fetch-orchestrator`, `services/normalizer`, and `tests/data`. Do not remove.
- **The energy layer is wired in and live**, but its `energyInfrastructureApi.ts` mock helper is dead — `useEnergyInfrastructure.ts` builds its own `fetch()` and never calls `fetchEnergyInfrastructure()`. The mock is a **future/planned placeholder**.
- **Three whole frontend files are confirmed dead** (zero external references to any export): `aviationTileCache.ts`, `aviationTileLoader.ts`, `globeCamera.ts`. A fourth (`aviationLayerRenderer.ts`) is dead and appears superseded by `aviationGlobalRenderer.ts`.
- **Two more whole files are confirmed dead**: `airportViewport.ts` (aviation), and the energy `energyInfrastructureApi.ts` mock (never called).
- **`aircraftMarker.ts` is heavily used**, but it carries 3 dead exports: two `@deprecated` sprite functions (`getAircraftArrowSprite`, `getAircraftDotSprite`) and a legacy alias (`getAircraftColor`). The rest of the module is active.
- No production code was changed. No files were deleted. This audit only produces this document plus the two state-doc updates.

**Headline: 5 whole files and 3 individual exports are confirmed dead or superseded (≈730 lines of frontend code); 1 suspected duplicate does not exist; 1 suspected dead package is actively used.**

---

## Classification Table

| Candidate | Classification | Evidence Strength | Risk if removed now | Recommended Next WO |
|-----------|----------------|-------------------|---------------------|---------------------|
| `packages/schemas/` | Currently used / do not remove | Strong (6 imports) | High — breaks fetcher, normalizer, tests | None — keep |
| `apps/web/src/globe/globeCamera.ts` | N/A — file does not exist | Strong (ls-files) | N/A | None — premise is wrong |
| `apps/web/src/layers/layer_01_aviation/airports/globeCamera.ts` | Confirmed dead / safe deletion candidate | Strong (0 refs) | Low | DISC-1C |
| `apps/web/src/layers/layer_01_aviation/airports/aviationTileCache.ts` | Confirmed dead / safe deletion candidate | Strong (0 refs) | Low | DISC-1B |
| `apps/web/src/layers/layer_01_aviation/airports/aviationTileLoader.ts` | Duplicate impl + dead (superseded by `lib/api.ts`) | Strong (0 refs) | Low | DISC-1B |
| `apps/web/src/layers/layer_10_energy_infrastructure/infrastructure/energyInfrastructureApi.ts` | Future/planned placeholder / needs product decision | Strong (mock never called) | Low | DISC-1E |
| `aircraftMarker.ts` — `getAircraftArrowSprite`, `getAircraftDotSprite` | Deprecated and unreferenced (dead) | Strong (0 refs) | Low | DISC-1D |
| `aircraftMarker.ts` — `getAircraftColor` alias | Deprecated-style legacy alias, unreferenced (dead) | Strong (0 refs) | Low | DISC-1D |
| `aircraftMarker.ts` — rest of module | Currently used / do not remove | Strong (5+ call sites in CesiumGlobe) | High | None — keep |
| `apps/web/src/layers/layer_01_aviation/airports/airportViewport.ts` (additional) | Confirmed dead / safe deletion candidate | Strong (0 refs) | Low | DISC-1F |
| `apps/web/src/layers/layer_01_aviation/airports/aviationLayerRenderer.ts` (additional) | Duplicate impl + dead (superseded by `aviationGlobalRenderer.ts`) | Strong (0 refs) | Low | DISC-1F |

---

## Detailed Findings

### packages/schemas/

- **Classification: Currently used / do not remove.**
- **Evidence commands run:**
  - `git ls-files "packages/schemas/**"` → 5 tracked files (`__init__.py` × 3, `airport_public_profile.py`, `ourairports.py`).
  - `git grep -n -E "from packages\.schemas|import packages\.schemas|packages\.schemas" -- "*.py" ":(exclude)docs/archive/**"` → **6 active Python imports**:
    - `services/fetch-orchestrator/src/layers/layer_01_aviation/ourairports_collector.py:26`
    - `services/fetch-orchestrator/src/layers/layer_01_aviation/wikimedia_wikidata_fetcher.py:51`
    - `services/normalizer/src/layers/layer_01_aviation/airport_public_profile_normalizer.py:40`
    - `services/normalizer/src/layers/layer_01_aviation/ourairports_normalizer.py:20`
    - `tests/data/layer_01_aviation/test_airport_public_profile_normalizer.py:22`
    - `tests/data/layer_01_aviation/test_ourairports_foundation.py:7`
- **Evidence summary:** This is the canonical Python Pydantic schemas package owned by the Database Agent (`AGENTS.md` ownership matrix). It is imported by both fetcher and normalizer services and by data tests. It is also referenced as a build target in `python -m compileall packages/schemas ...` commands across many integration reviews.
- **Risk if removed now:** High — fetcher and normalizer services fail to import, and `tests/data` normalizer tests fail.
- **Recommended follow-up WO:** None. Keep as-is. (If the premise was "is this package dead because the TS contracts live in `packages/contracts/`?", the answer is no — the Python pipeline and the TS API/frontend are two different consumers.)
- **Safe next action:** None. Document this finding and move on.

---

### energyInfrastructureApi.ts

Path: `apps/web/src/layers/layer_10_energy_infrastructure/infrastructure/energyInfrastructureApi.ts` (20 lines).

- **Classification: Future/planned placeholder / needs product decision** (the mock function is dead, but the layer itself is live).
- **Evidence commands run:**
  - `git grep -n "fetchEnergyInfrastructure" -- . ":(exclude)docs/archive/**" ":(exclude)docs/state/**" ":(exclude)docs/audits/**"` → **1 hit, the definition itself** (line 6). Zero call sites.
  - `git grep -n "from '\./layers/layer_10_energy_infrastructure'" -- apps/web/src` → **0 hits**. The layer barrel `index.ts` (which re-exports `fetchEnergyInfrastructure`) is itself never imported as a barrel.
  - `git grep -n "layer_10_energy_infrastructure\|EnergyInfrastructureLayer\|useEnergyInfrastructure\|fetchEnergyInfrastructure" -- apps/web/src` → the layer is **heavily wired**: `App.tsx`, `CesiumGlobe.tsx` (renders `<EnergyInfrastructureLayer>`), `Shell.tsx`, `LayerPanelRoot.tsx`, `EnergyControls.tsx`, `EnergyDetail.tsx`, `useLayerRegistry.ts`.
- **Evidence summary:** `energyInfrastructureApi.ts` defines a single mock `fetchEnergyInfrastructure()` that resolves an empty `EnergyInfrastructureResponse`. The actual data path is `useEnergyInfrastructure.ts`, which builds its own `fetch(\`${API_BASE_URL}/api/layers/${ENERGY_PUBLIC_SLUG}/infrastructure?...\`)` and never calls the mock. The mock is re-exported by the layer barrel `index.ts`, but that barrel is never imported (all consumers import the specific `infrastructure/*` files directly), so the mock is unreachable. The mock appears to be a leftover from when the layer was scaffolded before the real hook existed.
- **Risk if removed now:** Low for runtime (no caller). Minor risk: removing the file requires also removing its `export *` line in `index.ts`, or the barrel build breaks. This is a product/architecture decision, not a pure deletion — the mock may be intentionally kept as a documented "no real client-side helper yet" placeholder mirroring the server-side TODO pattern noted in WO-003.
- **Recommended follow-up WO:** DISC-1E — Remove or document the `energyInfrastructureApi.ts` mock and drop the dead `export *` from `index.ts`. Needs a small product call: keep as documented stub vs. delete.
- **Safe next action:** Leave in place. Flag for DISC-1E.

---

### aviationTileCache.ts vs aviationTileLoader.ts

Paths (same folder `apps/web/src/layers/layer_01_aviation/airports/`):
- `aviationTileCache.ts` (163 lines)
- `aviationTileLoader.ts` (237 lines)

- **Classification:**
  - `aviationTileCache.ts` — **Confirmed dead / safe deletion candidate.**
  - `aviationTileLoader.ts` — **Duplicate implementation + dead** (superseded; the live path is `lib/api.ts` → `fetchAviationLayerObjects`).
- **Evidence commands run:**
  - `git grep -n "aviationTileCache" -- apps/web/src` → **0 hits**.
  - `git grep -n "aviationTileLoader" -- apps/web/src` → **0 hits**.
  - Repo-wide (excluding docs): `git grep -n "aviationTileCache"` and `git grep -n "aviationTileLoader"` → both **0 hits**.
  - Per-export check: `git grep -n "clearTileCache|generateGlobalTiles|fetchInterleavedCategoryTiles|fetchCategoryTiles|generateAllTileIds|bboxToTileIds|tileIdToBbox|getTileCacheStats|makeTileKey" -- apps/web/src` → every match is **inside one of the two files itself**. No external caller for any export.
  - `git grep -n "fetchAviationLayerObjects" -- apps/web/src` → the **live** data path is `lib/api.ts` (defines it) called by `lib/searchProviders.ts` and (only) by `aviationTileLoader.ts`. The dead loader calls the live helper but nothing calls the dead loader.
  - Barrel check: `git show HEAD:apps/web/src/layers/layer_01_aviation/index.ts` → the aviation barrel does **not** re-export `aviationTileCache` or `aviationTileLoader`. They are orphan modules.
- **Evidence summary:** Both files are entirely unreferenced. They also overlap in behavior — each defines its own `tileCache`/`TileCacheEntry`, its own `clearTileCache`, and its own global-tile generator (`generateAllTileIds` in cache vs `generateGlobalTiles` in loader). Neither is the active aviation loading path; `CesiumGlobe.tsx` consumes `aviationPreloader` / `aviationGlobalRenderer` / `aviationObjectStore`, not these tile modules. These look like an earlier tile-loading design that was replaced by the preloader/renderer/object-store design plus direct `fetchAviationLayerObjects` calls.
- **Risk if removed now:** Low — no callers. They are not exported by the aviation barrel.
- **Recommended follow-up WO:** DISC-1B — Delete `aviationTileCache.ts` and `aviationTileLoader.ts` together (they are a matched dead pair). Confirm no dynamic/conditional import via a build before merge.
- **Safe next action:** Leave in place. Flag for DISC-1B.

---

### duplicate globeCamera.ts files

- **Classification: Confusing duplicate name / premise is wrong** (no duplicate exists; the single file that does exist is dead).
- **Evidence commands run:**
  - `git ls-files "**/globeCamera.ts" "**/globeCamera.tsx" "**/globeCamera.*"` → **exactly one** file: `apps/web/src/layers/layer_01_aviation/airports/globeCamera.ts`. There is **no** `apps/web/src/globe/globeCamera.ts`.
  - `git ls-files "apps/web/src/globe/**"` → `cesiumVisibility.ts`, `configureViewerScene.ts`, `setupCesiumToken.ts`, `useFpsCounter.ts`, `viewerOptions.ts`. All five are actively imported by `CesiumGlobe.tsx` (verified). None is named `globeCamera`.
- **Evidence summary:** The work-order brief suspected two `globeCamera.ts` files (one in `apps/web/src/globe/`, one in the aviation airports folder). Only the aviation one exists. The `apps/web/src/globe/` folder has no camera module at all. So there is **no duplication to consolidate** — the premise is incorrect.

#### The single globeCamera.ts that does exist

Path: `apps/web/src/layers/layer_01_aviation/airports/globeCamera.ts` (27 lines). Exports: `FlyToOptions` (interface), `flyToLocation`, `flyToSearchResult`.

- **Sub-classification: Confirmed dead / safe deletion candidate.**
- **Evidence commands run:**
  - `git grep -n "globeCamera|GlobeCamera" -- apps/web/src` → **0 hits** (no import of the module).
  - `git grep -n "flyToLocation|flyToSearchResult|FlyToOptions" -- . ":(exclude)docs/archive/**" ":(exclude)docs/state/**" ":(exclude)docs/audits/**"` → only self-references inside `globeCamera.ts`.
  - Barrel check: the aviation `index.ts` does **not** re-export `globeCamera`. Orphan module.
- **Evidence summary:** The file exports two camera-fly helpers but nothing imports them. CesiumGlobe handles camera movement inline. The file is dead.
- **Risk if removed now:** Low — no callers, not in barrel.
- **Recommended follow-up WO:** DISC-1C — Delete `apps/web/src/layers/layer_01_aviation/airports/globeCamera.ts`. Note in the WO that the suspected `apps/web/src/globe/globeCamera.ts` duplicate does not exist.
- **Safe next action:** Leave in place. Flag for DISC-1C.

---

### aircraftMarker deprecated functions

Path: `apps/web/src/layers/layer_01_aviation/aircraft/aircraftMarker.ts`. The **module itself is heavily used**; only specific exports are dead.

- **Classification:** Module = **Currently used / do not remove.** Three exports inside it = **deprecated and unreferenced (dead)**.
- **Evidence commands run:**
  - `git grep -nE "deprecated|TODO|FIXME|unused|dead code" -- apps packages services docs/state` → only two `@deprecated` markers in this repo's active code, both at `aircraftMarker.ts:226` and `aircraftMarker.ts:240`.
  - `git grep -n "getAircraftArrowSprite|getAircraftDotSprite" -- . ":(exclude)docs/archive/**" ":(exclude)docs/state/**" ":(exclude)docs/audits/**"` → **2 hits, both definitions**. Zero callers.
  - `git grep -n "getAircraftColor\b|getAircraftAltitudeColor" -- . ":(exclude)docs/archive/**" ":(exclude)docs/state/**" ":(exclude)docs/audits/**"` → the real `getAircraftAltitudeColor` is used 3× in `CesiumGlobe.tsx` (lines 374, 918, 1069). The alias `getAircraftColor` (exported at `aircraftMarker.ts:224` as `export { getAircraftAltitudeColor as getAircraftColor }`) has **0 external references**.
  - `git grep -n "AIRCRAFT_BILLBOARD_SCALE|headingToBillboardRotation|getAircraftHeadingDeg|getAircraftMarkerImage|getAircraftMarkerImageAsync" -- apps/web/src` → these active exports have **multiple call sites in `CesiumGlobe.tsx`** (e.g. `getAircraftMarkerImageAsync` at 379, 952, 982, 1101, 1125). The module is alive.
- **Evidence summary:** The two `@deprecated` canvas-sprite helpers and the `getAircraftColor` alias are dead — no caller anywhere. They sit under a `// Legacy exports kept for any remaining callers` comment, but there are no remaining callers. Everything else in `aircraftMarker.ts` (`getAircraftMarkerImage`, `getAircraftMarkerImageAsync`, `getAircraftAltitudeColor`, `getAircraftHeadingDeg`, `headingToBillboardRotation`, `AIRCRAFT_BILLBOARD_SCALE`) is actively used by `CesiumGlobe.tsx` and must stay.
- **Risk if removed now:** Low for the three dead exports. Do **not** touch the rest of the module.
- **Recommended follow-up WO:** DISC-1D — Remove `getAircraftArrowSprite`, `getAircraftDotSprite`, and the `getAircraftColor` alias export from `aircraftMarker.ts`. Leave all other exports. Confirm `pnpm --filter web build` and `pnpm --filter web test` pass.
- **Safe next action:** Leave in place. Flag for DISC-1D.

---

## Additional Candidates Found

During the per-export sweep of the aviation `airports/` folder, two more whole
files surfaced with the same dead profile. They are documented here because they
are in the same folder as the suspected dead tile modules and have identical
evidence; acting on them can ride along with DISC-1B/D without expanding scope.

### apps/web/src/layers/layer_01_aviation/airports/airportViewport.ts (49 lines)

- **Classification: Confirmed dead / safe deletion candidate.**
- **Evidence:** `git grep -n "airportViewport|getViewportFromCamera|ViewportData" -- . ":(exclude)docs/**"` → only self-references (definition lines 3 and 8). Not re-exported by the aviation barrel. Zero callers.
- **Risk if removed now:** Low.
- **Recommended follow-up WO:** DISC-1F (delete alongside the tile modules).

### apps/web/src/layers/layer_01_aviation/airports/aviationLayerRenderer.ts (254 lines)

- **Classification: Duplicate implementation + dead (superseded).**
- **Evidence:**
  - `git grep -n "aviationLayerRenderer" -- . ":(exclude)docs/archive/**" ":(exclude)docs/state/**" ":(exclude)docs/audits/**"` → **0 hits** (no import anywhere).
  - Single export is `renderAviationObjects` (line 88) → 0 callers.
  - By contrast `aviationGlobalRenderer.ts` (148 lines) **is** imported by `CesiumGlobe.tsx:67`.
  - Both files import from `aviationCategories` and `airportMarkerSprites`, so `aviationLayerRenderer.ts` looks like an earlier renderer design superseded by `aviationGlobalRenderer.ts`.
- **Risk if removed now:** Low — no callers, not in barrel.
- **Recommended follow-up WO:** DISC-1F (delete alongside the tile modules; confirm `aviationGlobalRenderer.ts` covers all current render needs first).

---

## Recommended Follow-Up Work Orders

In priority order (lowest-risk, highest-evidence first):

1. **DISC-1B — Delete dead aviation tile modules.** Remove `aviationTileCache.ts` and `aviationTileLoader.ts` (matched dead pair, ≈400 lines). They are not exported by the aviation barrel and have zero callers. Run `pnpm --filter web build` + `pnpm --filter web test` to confirm.
2. **DISC-1C — Delete dead `globeCamera.ts`.** Remove `apps/web/src/layers/layer_01_aviation/airports/globeCamera.ts` (27 lines). Explicitly record that the suspected `apps/web/src/globe/globeCamera.ts` duplicate does **not** exist, so future audits stop chasing it.
3. **DISC-1D — Remove dead `aircraftMarker.ts` exports.** Delete `getAircraftArrowSprite`, `getAircraftDotSprite`, and the `getAircraftColor` alias. Keep every other export. Verify build/test.
4. **DISC-1F — Delete dead aviation helpers `airportViewport.ts` and `aviationLayerRenderer.ts`** (≈300 lines). Confirm `aviationGlobalRenderer.ts` is the sole live renderer first.
5. **DISC-1E — Decide on `energyInfrastructureApi.ts` mock.** Product/architecture call: keep as a documented stub or delete it and drop the dead `export *` from the layer barrel `index.ts`. Lower priority because it is a placeholder, not dead-by-accident.

> Note: the original brief used a placeholder name **DISC-1A — Verify and remove/deprecate packages/schemas**. That WO is **not recommended**: `packages/schemas/` is actively used (6 Python imports). DISC-1A should be closed as "no action — false positive".

---

## Things Not Safe To Delete Yet

- **`packages/schemas/`** — actively imported by fetcher, normalizer, and tests. NOT dead. Do not delete.
- **`energyInfrastructureApi.ts`** — dead mock, but the surrounding energy layer is live and wired. Removing the file also requires editing the layer barrel `index.ts`. Needs a deliberate DISC-1E decision, not a blind delete.
- **The non-deprecated parts of `aircraftMarker.ts`** — `getAircraftMarkerImage`, `getAircraftMarkerImageAsync`, `getAircraftAltitudeColor`, `getAircraftHeadingDeg`, `headingToBillboardRotation`, `AIRCRAFT_BILLBOARD_SCALE` are all actively used by `CesiumGlobe.tsx`. DISC-1D must remove **only** the three dead exports.
- **The aviation barrel `index.ts` itself** — it is effectively unused (consumers import specific `airports/*` paths directly), but it is a public-surface barrel; changing it is out of scope for a dead-code deletion and should be a separate cleanup decision.

---

## Commands Run

Initial verification:
- `git status --short --branch` → clean, on `review/dead-code-investigation`.
- `git branch --show-current` → `review/dead-code-investigation`.
- `git log -5 --oneline` → top is `40718e9 Merge pull request #62 ... wo-3-1-centralize-type-date-utils` (confirms WO-3-1 is in base).
- `git ls-files "packages/schemas/**"` → 5 files.
- `git ls-files "**/globeCamera.*"` → 1 file (aviation airports only; no `globe/globeCamera.ts`).
- `git ls-files "apps/web/src/layers/layer_10_energy_infrastructure/**"` → 5 files.
- `git ls-files "apps/web/src/layers/layer_01_aviation/**"` → 19 files.

Reference sweeps (key results):
- `git grep -n -E "from packages\.schemas|packages\.schemas" -- "*.py" ":(exclude)docs/archive/**"` → 6 active imports.
- `git grep -n "fetchEnergyInfrastructure" -- . ":(exclude)docs/**"` → definition only, 0 callers.
- `git grep -n "aviationTileCache|aviationTileLoader" -- . ":(exclude)docs/**"` → 0 hits.
- `git grep -n "flyToLocation|flyToSearchResult|FlyToOptions|globeCamera|GlobeCamera" -- . ":(exclude)docs/**"` → only self-references in `globeCamera.ts`.
- `git grep -n "getAircraftArrowSprite|getAircraftDotSprite|getAircraftColor\b" -- . ":(exclude)docs/**"` → definitions only, 0 callers.
- `git grep -n "aviationLayerRenderer|getViewportFromCamera|ViewportData|airportViewport" -- . ":(exclude)docs/**"` → self-references only.
- `git grep -n "aviationGlobalRenderer|aviationPreloader|aviationObjectStore" -- apps/web/src` → active use by `CesiumGlobe.tsx` (contrast for the dead modules).
- `git grep -n -E "deprecated|TODO|FIXME|unused|dead code" -- apps packages services docs/state` → only 2 `@deprecated` markers in active code (both in `aircraftMarker.ts`); remaining matches are in `HANDOFF_LOG.md`/`RECENT_CONTEXT.md` text.

---

## Final Recommendation

Treat the suspected list as **mostly correct in spirit, wrong on two premises**:

1. **`packages/schemas/` is not dead** — keep it. Close DISC-1A as a false positive.
2. **There is no `globeCamera.ts` duplication** — only one file exists, and it is dead on its own merits. Rename DISC-1C from "rename or document duplicate" to "delete the single dead `globeCamera.ts`".

Everything else the brief suspected is confirmed dead or a placeholder, and two
extra dead files (`airportViewport.ts`, `aviationLayerRenderer.ts`) were found in
the same folder. The follow-up WOs DISC-1B/C/D/F are low-risk deletions backed by
zero-reference evidence; DISC-1E is a small product decision. **None of these
actions belong in this audit branch** — this branch only records the findings.

No production code was changed. No files were deleted. The only artifacts this
branch adds are this audit document and the two state-doc updates
(`RECENT_CONTEXT.md`, `HANDOFF_LOG.md`).
