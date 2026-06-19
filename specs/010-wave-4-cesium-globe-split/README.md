# Spec 010 — Wave 4 CesiumGlobe Split

Classification: SPEC_WORKSPACE
Status: **Planning complete, awaiting Orchestrator Agent review**
Owner: Orchestrator Agent (planning) / Frontend Agent (implementation)
Last updated: 2026-06-20 (Wave 4 CesiumGlobe Planning Agent)

## Purpose

This spec is the **active planning artifact** for Wave 4 — the frontend
CesiumGlobe split. It is the single source of truth for the target structure,
shim strategy, picking-contract test requirement, sequenced implementation
packages, risks, and validation plan. Implementation agents execute the
packages in `tasks.md` after this planning spec has been reviewed and approved.

Wave 4 is a **frontend-only, sequential, structural refactor** that does not
change Cesium behavior, public component API, or any external contracts. The
sole consumer of `CesiumGlobe` (`apps/web/src/App.tsx`) keeps the same import
path through a compatibility shim, so no other frontend files need to change.

## Verified Research Facts

All facts below were verified by the Wave 4 CesiumGlobe Research Agent on
branch `research/wave-4-cesium-globe-file-map` (research phase complete,
review passed).

### Target path correction (BLOCKING drift)

| | Path | Status |
|---|---|---|
| **Correct** | `apps/web/src/CesiumGlobe.tsx` | **The real file path** |
| **Stale (incorrect)** | `apps/web/src/components/CesiumGlobe.tsx` | **Does not exist; never has** |

The stale `apps/web/src/components/CesiumGlobe.tsx` path appears in:

- `docs/state/CURRENT_PROJECT_STATE.md` (lines 101, 232)
- `docs/state/HANDOFF_LOG.md` (many historical references — preserved verbatim per append-only rule)
- `docs/state/RECENT_CONTEXT.md` (line 47 in the Wave 3 closeout entry)
- `specs/008-structure-remediation-roadmap/` (multiple files: `README.md`,
  `plan.md`, `tasks.md`, `repository-skeleton.md`,
  `frontend-layer-canonicalization-plan.md`, `api-endpoint-path-policy.md`)
- `docs/audits/DEAD_DUPLICATE_CODE_INVESTIGATION_2026-06-19.md`
- `docs/audits/ENGINEERING_STRUCTURE_COMPLIANCE_AUDIT.md`
- Spec 006 and Spec 007 planning docs (archived under
  `docs/archive/2026-06-16-implemented-specs/`)

**This spec corrects the active state docs (`CURRENT_PROJECT_STATE.md`,
`RECENT_CONTEXT.md`, `HANDOFF_LOG.md`'s NEW planning entry only).** Historical
handoff entries are append-only and **must not be rewritten**. Archived
material under `docs/archive/` is also out of scope for this spec.

### Verified file facts

- **Path:** `apps/web/src/CesiumGlobe.tsx`
- **Lines:** 1436
- **Bytes:** 57 144
- **Size class per `PROJECT_CONTROL.md` §16:** exceeds the 800-line hard
  limit for new work; must split
- **Default export:** `CesiumGlobe` (`React.FC<CesiumGlobeProps>`)
- **Named exports:** none
- **Imports:** 26 total (3 from `cesium`, 1 side-effect CSS, 1 React default, 21 local)

### Verified hook profile

- `useState`: **7**
- `useRef`: **34**
- `useEffect`: **16**
- `useMemo`: **0**
- `useCallback`: **0**
- `useImperativeHandle`: **0**

The complete absence of `useMemo` / `useCallback` is itself a finding: the
file avoids memoization and relies on `useRef`-mirrored props to dodge stale
closures. Any extracted hook must follow the same pattern.

### Verified dependency profile

- **Single runtime consumer:** `apps/web/src/App.tsx`
  (`import CesiumGlobe from './CesiumGlobe';`, mounted at line 204 with
  26 props).
- **One comment-only reference:** `apps/web/src/layers/layer_08_news_osint/NewsLayer.tsx`
  line 19 (no code import).
- **Direct test coverage:** **zero**. All 8 frontend layer test files
  (`apps/web/src/layers/**/__tests__/**`) cover layer modules, not CesiumGlobe.
- **Already-extracted helpers (5):** `apps/web/src/globe/{cesiumVisibility,
  configureViewerScene, setupCesiumToken, useFpsCounter, viewerOptions}.ts`
- **Already-extracted overlays (4):** `apps/web/src/components/overlays/
  {AircraftInfoOverlay, EarthquakeInfoOverlay, SatelliteInfoOverlay,
  TokenWarningOverlay}.tsx`
- **Layer subcomponents already mounted from CesiumGlobe (4):**
  `EnergyInfrastructureLayer`, `MaritimeLayer`, `WeatherLayer`, `NewsLayer`.

### Hidden picking contract (CRITICAL — see "Picking-contract test plan")

CesiumGlobe's click handler reads these string field names from picked-object
`id` values. They are produced by the layer subcomponents:

| Field | Producer (where written) | Consumer (where read in CesiumGlobe) |
|---|---|---|
| `_aircraftData` | CesiumGlobe itself (lines 949, 957, 1098, 1106) | CesiumGlobe click handler line 573 |
| `_vesselData` | `MaritimeLayer.tsx:90,94` | CesiumGlobe click handler line 579 |
| `_weatherData` | `WeatherLayer.tsx:79,82` | CesiumGlobe click handler line 585 |
| `_newsData` | `NewsLayer.tsx:70,73` | CesiumGlobe click handler line 591 |
| `_satelliteData` | CesiumGlobe satellite effect line 1285 | CesiumGlobe click handler |
| `earthquakeData` | CesiumGlobe earthquake effect line 860 | CesiumGlobe click handler line 614 |
| `satelliteData` | CesiumGlobe satellite effect line 1300 | CesiumGlobe click handler line 621 |
| `rawData` | `EnergyInfrastructureLayer.tsx:53` (as `properties.rawData`) | CesiumGlobe click handler line 635 |

**The five layer-produced fields** (`_vesselData`, `_weatherData`, `_newsData`,
plus `_aircraftData` and `_satelliteData` for CesiumGlobe's own billboards,
plus `earthquakeData`, `satelliteData`, `rawData` for CesiumGlobe's own
entities) form a **duck-typed contract** between layer subcomponents and the
CesiumGlobe click handler. There is **no type-level check** and **no test**.

This contract is the single highest-risk hidden coupling in the file. **Any
extraction that moves the picking logic out of CesiumGlobe must preserve
these exact field names.** A Vitest test pinning them must land **before**
the picking logic is extracted.

## Target Folder Decision

**Chosen target folder: `apps/web/src/CesiumGlobe/`**

### Options evaluated

| Option | Pros | Cons |
|---|---|---|
| **`apps/web/src/CesiumGlobe/`** (chosen) | Same conceptual level as current file; no Vite import path change for the shim; clear ownership ("the CesiumGlobe module lives here"); 1-line shim at `apps/web/src/CesiumGlobe.tsx` re-exports from `./CesiumGlobe/index.js`; `apps/web/src/globe/` stays a pure helper folder | One extra folder at `apps/web/` root |
| `apps/web/src/globe/CesiumGlobe/` | Sits next to the 5 already-extracted helpers | Adds another layer of nesting (was `CesiumGlobe.tsx`, becomes `globe/CesiumGlobe/index.tsx`); `globe/` was a helpers-only folder, mixing orchestration in dilutes its purpose; longer shim path |
| `apps/web/src/components/CesiumGlobe/` | Would match the **stale (wrong) doc path** | `apps/web/src/components/` is for presentational components (`Header`, `Shell`, `LayerPanel`, `DetailPanel`, `intel/`, `overlays/`) per `PROJECT_CONTROL.md §6`; CesiumGlobe is the orchestration root, not a presentational component |

### Rationale

`PROJECT_CONTROL.md §5` lists the canonical frontend folder pattern. There
is no canonical rule for the CesiumGlobe orchestration root specifically.
Following the existing convention (`apps/web/src/globe/` for helpers,
`apps/web/src/components/` for presentational components), and keeping the
top-level `CesiumGlobe.tsx` shim at the same path-level as today, is the
lowest-churn option. The 1-line shim is identical in shape to the Wave 3
shims (`apps/api/src/routes/aviation-aircraft.ts`,
`apps/api/src/routes/earth-events.ts`,
`apps/api/src/routes/borders-boundaries.ts`).

## Compatibility Shim Decision

**Keep `apps/web/src/CesiumGlobe.tsx` as a 1-line compatibility shim.**

The shim must be exactly:

```ts
// apps/web/src/CesiumGlobe.tsx — compatibility shim (Wave 4)
// Canonical implementation: apps/web/src/CesiumGlobe/index.tsx
export { default } from './CesiumGlobe/index.js';
```

This preserves the only existing import path (`App.tsx:2`) without any
change. **No `App.tsx` edit is required.** All consumers, all current tests,
and the entire Vite build graph continue to resolve identically.

The shim is **not** deleted at the end of Wave 4. It is the long-term import
path that follows the Wave 3 precedent. A future work order may decide to
delete the shim (and update the single `App.tsx` import), but that is out of
scope here.

## Proposed Target Structure

```text
apps/web/src/CesiumGlobe/
  index.tsx                       # orchestrator (the actual React component, default export)
  CesiumGlobeView.tsx             # presentational render shell (container + 5 overlays + 4 layer subcomponent mounts)
  types.ts                        # AviationStats, CesiumGlobeProps, internal AircraftRecord
  constants.ts                    # AIRCRAFT_ICON_VIEW_HEIGHT_METERS, CHUNK_SIZE, DR_MAX_SECS, etc.
  helpers.ts                      # airportFlyHeight, emitStats, applyFiltersToDots,
                                  #   shouldShowAircraftIcons, getAircraftVisualImage,
                                  #   updateAircraftVisualMode (pure-ish, no Cesium-side effects)
  picking.ts                      # usePickingHandler: takes ScreenSpaceEventHandler,
                                  #   viewer, ref-bridges; reads the 8 picking fields.
                                  #   Behavior-preserving extraction of the lines-543-637 click branch tree.
  useCesiumViewer.ts              # the viewer-init effect extracted: token, viewer,
                                  #   scene, 5 data sources, 2 primitives, FPS,
                                  #   camera.changed/moveEnd, click-handler registration,
                                  #   full unmount cleanup. Returns
                                  #   { viewer, viewerReady, aviationDataSource, ... }.
  useResidentAviationCache.ts     # aviation layer ON/OFF + preload + filter change
                                  #   (the lines-389-459 + 671-716 surface). Owns
                                  #   residentCacheActiveRef, preloadingRef, dotsCreatedRef,
                                  #   abortControllerRef.
  useLiveAircraftRenderer.ts      # the snapshot + delta + DR loop extracted
                                  #   (lines 873-1211). Owns aircraftMapRef,
                                  #   pendingSnapshotRef, applyingRef, applyRafRef,
                                  #   drRafRef. Reads/writes the 3 callback refs
                                  #   populated by App.tsx.
  useCameraBboxReporter.ts        # the maritime bbox reporting effect
                                  #   (lines 1309-1364).
  useLayoutFeatures.ts            # runway polylines effect (lines 756-791).
  useEarthquakes.ts               # earthquake entities effect (lines 827-863).
  useBordersPolylines.ts          # borders polylines effect (lines 794-824).
  useSatellites.ts                # satellites + debris effect (lines 1218-1306).
```

A few notes on the proposed structure:

- **`picking.ts` and `useCesiumViewer.ts`** are deliberately coupled: the
  viewer hook owns the `ScreenSpaceEventHandler` allocation and registers the
  picking handler; the picking hook reads the picking fields and dispatches
  to callbacks. Splitting them keeps the contract test surface narrow
  (see "Picking-contract test plan").
- **Five `useXxx` per-layer hooks** (runways, earthquakes, borders, satellites,
  layout features) replace the five "data-source-fill" effects. They take
  the relevant `CustomDataSource` from `useCesiumViewer` plus the per-layer
  data prop and the layer-active flag. Each is < 60 lines.
- **`helpers.ts`** contains the pure-ish helpers (no `useEffect`, no
  Cesium-side effects) and is fully unit-testable.
- **`types.ts`** is the only place `AircraftRecord` and `CesiumGlobeProps`
  are defined; the sub-hooks import what they need from here.
- **`constants.ts`** is split out so `CHUNK_SIZE` / `DR_MAX_SECS` /
  `AIRCRAFT_ICON_VIEW_HEIGHT_METERS` are testable in isolation.

The current `apps/web/src/globe/` helpers (5 files, all already extracted)
are **unchanged**. Layer subcomponents
(`MaritimeLayer`, `WeatherLayer`, `NewsLayer`, `EnergyInfrastructureLayer`)
are **unchanged** in Wave 4.

## Picking-Contract Test Plan

**Land before any picking-logic extraction (W4-B, before W4-C).**

### Test location

```
apps/web/src/CesiumGlobe/__tests__/pickingContract.test.ts
```

This test lives next to the source it pins, matching the existing
`apps/web/src/layers/**/__tests__/**` pattern.

### Pinned contracts

The test must assert, at minimum:

1. **`_vesselData`** — the contract: `MaritimeLayer.tsx` writes
   `_vesselData: MaritimeVesselObject` on every billboard `id` object it
   creates or updates. CesiumGlobe's click handler reads
   `pickedObject.id._vesselData` and dispatches to
   `onObjectSelectRef.current(vessel)` after an `isPositionVisible` check.
2. **`_weatherData`** — `WeatherLayer.tsx` writes
   `_weatherData: WeatherRenderItem`; CesiumGlobe click handler reads
   `pickedObject.id._weatherData` and dispatches to
   `onWeatherSelectRef.current?.(item)`.
3. **`_newsData`** — `NewsLayer.tsx` writes
   `_newsData: NewsRenderMarker`; CesiumGlobe click handler reads
   `pickedObject.id._newsData` and dispatches to
   `onNewsSelectRef.current?.(item)`.
4. **`_aircraftData`** — written inside CesiumGlobe (lines 949, 957, 1098,
   1106) on `billboard.id`; CesiumGlobe click handler reads
   `pickedObject.id._aircraftData` and dispatches to `setSelectedAircraft(ac)`
   after `isPositionVisible`. (This contract is internal to CesiumGlobe
   before extraction; the test pins it anyway so the picking hook extraction
   cannot silently break it.)
5. **`_satelliteData`** — written inside CesiumGlobe (line 1285) on
   `point.id`; CesiumGlobe click handler reads `pickedObject.id._satelliteData`.
6. **`earthquakeData`** — written inside CesiumGlobe (line 860) as
   `(entity as any).properties = { earthquakeData: new ConstantProperty(event) }`;
   CesiumGlobe click handler reads
   `entity.properties.earthquakeData.getValue()`.
7. **`satelliteData`** — written inside CesiumGlobe (line 1300) as
   `(entity as any).properties = { satelliteData: new ConstantProperty(satItem) }`;
   CesiumGlobe click handler reads
   `entity.properties.satelliteData.getValue()`.
8. **`rawData`** — written inside
   `apps/web/src/layers/layer_10_energy_infrastructure/infrastructure/EnergyInfrastructureLayer.tsx:53`
   as `properties: { rawData: feature }`; CesiumGlobe click handler reads
   `entity.properties.rawData.getValue()`.

### Implementation approach (test code outline, not yet committed)

Two acceptable shapes:

- **Lightweight contract test (preferred):** import the layer subcomponents
  and a small `pickingFields` exported helper from
  `apps/web/src/CesiumGlobe/picking.ts`. The test calls a tiny "render to
  picking-id" factory function for each layer and asserts the expected
  `_xxxData` field is present with the expected type. This avoids jsdom +
  Cesium mocking entirely. ~80 lines.
- **Cesium-coupled integration test (heavier):** actually instantiate a
  `BillboardCollection`, populate it, run `scene.pick`, and assert
  CesiumGlobe's click-handler callback path. Requires jsdom + a Cesium mock.
  **Not recommended for W4-B** because it duplicates the Cesium-coupled
  test design that Wave 4 explicitly tries to avoid.

### Validation commands

```powershell
git diff --check
git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- . ":(exclude)docs/archive/**"

pnpm --filter web test
```

Target: 153/153 + 8 picking-contract assertions = 161/161 web tests passing.
If a picking-contract test fails, **stop and fix before proceeding** to
W4-C.

## Phased Implementation Plan

Implementation is **strictly sequential** (no parallel agents, no parallel
commits in one branch). Each package is one work-package behind a single
branch with the Wave 3 branch-name convention.

### W4-A — Planning docs + stale path correction (THIS PACKAGE)

- Branch: `frontend/wave-4-cesium-globe-split` (current)
- Allowed paths: `specs/010-wave-4-cesium-globe-split/**`,
  `docs/state/{CURRENT_PROJECT_STATE,RECENT_CONTEXT,HANDOFF_LOG}.md`
- **No source code change.**
- Validation: docs-only checks; no `pnpm` runs needed.

### W4-B — Picking-contract test

- Branch: `frontend/wo-w4-b-picking-contract-test`
- Allowed paths: `apps/web/src/CesiumGlobe/__tests__/pickingContract.test.ts`
  (new file)
- May also add: `apps/web/src/CesiumGlobe/pickingFields.ts` (a small pure
  helper that produces picking-id objects; ~20 lines, fully testable).
- Forbidden: `apps/web/src/CesiumGlobe.tsx`, `apps/web/src/App.tsx`,
  `apps/web/src/layers/**` (production code), `apps/api/**`.
- Required: `pnpm --filter web build` PASS, `pnpm --filter web test` PASS
  (153 existing + 8 new picking-contract assertions).
- Reviewer gate: every field name is asserted; no real Cesium scene is
  instantiated.

### W4-C — Create CesiumGlobe folder + shim + render shell + pure helpers

- Branch: `frontend/wo-w4-c-cesium-globe-folder-shim-shell-helpers`
- Allowed paths:
  - new `apps/web/src/CesiumGlobe/` (folder)
  - new `apps/web/src/CesiumGlobe/index.tsx` (orchestrator that re-exports
    the existing `CesiumGlobe` component from the shim, **first as the
    unchanged component for diff-minimization**)
  - new `apps/web/src/CesiumGlobe/CesiumGlobeView.tsx` (render shell)
  - new `apps/web/src/CesiumGlobe/helpers.ts` (pure helpers)
  - new `apps/web/src/CesiumGlobe/types.ts`
  - new `apps/web/src/CesiumGlobe/constants.ts`
  - modified `apps/web/src/CesiumGlobe.tsx` → 1-line shim
    `export { default } from './CesiumGlobe/index.js';`
- Forbidden: layer subcomponents, `apps/api/**`, `services/**`, `database/**`,
  `packages/**`, lockfiles, env files.
- Required: `pnpm --filter web build` PASS, `pnpm --filter web test` PASS.
- Reviewer gate: `App.tsx` unchanged, `git grep -n "CesiumGlobe" -- apps/web/src`
  returns only `App.tsx` import, `CesiumGlobe.tsx` (the shim), the new
  `CesiumGlobe/` folder, and `NewsLayer.tsx:19` (comment-only).

> **Sub-step inside W4-C:** for diff minimization, the first commit can
> simply **copy** the existing component into
> `apps/web/src/CesiumGlobe/index.tsx` and replace the original with the
> shim. This is **not** an extraction yet; it is a **rename** that
> preserves all behavior. Then W4-D onwards extract sub-hooks from
> `index.tsx` one at a time.

### W4-D — Extract maritime bbox reporter (lowest-risk extraction)

- Branch: `frontend/wo-w4-d-camera-bbox-reporter`
- Allowed paths:
  - new `apps/web/src/CesiumGlobe/useCameraBboxReporter.ts`
  - modified `apps/web/src/CesiumGlobe/index.tsx` (replaces the inline
    `useEffect` at lines 1309–1364 with a hook call)
- The hook takes `(viewer, viewerReady, maritimeLayerActive, onMaritimeBboxChange)`.
- Required: `pnpm --filter web build` PASS, `pnpm --filter web test` PASS.
- Reviewer gate: behavior identical — bbox validation chain, dateline-crossing
  rejection, fallback to `null`.

### W4-E — Extract resident aviation cache

- Branch: `frontend/wo-w4-e-resident-aviation-cache`
- Allowed paths:
  - new `apps/web/src/CesiumGlobe/useResidentAviationCache.ts`
  - modified `apps/web/src/CesiumGlobe/index.tsx`
- The hook owns the 3 resident-cache refs (`residentCacheActiveRef`,
  `preloadingRef`, `dotsCreatedRef`) plus `abortControllerRef`. It reads
  `globalDotCollectionRef` (which lives in `useCesiumViewer`) and
  `aviationFiltersRef` (which is still in `index.tsx` at this point — passed
  in by prop or ref).
- Cross-hook contract: `globalDotCollectionRef` must be created by
  `useCesiumViewer` **before** `useResidentAviationCache` reads it. This
  means `useCesiumViewer` runs first in the component body. **A test pin**
  for this order will be added in W4-H if `useCesiumViewer` is extracted
  later; until then, the order is enforced by call-site placement.
- Required: `pnpm --filter web build` PASS, `pnpm --filter web test` PASS.

### W4-F — Extract picking handler

- Branch: `frontend/wo-w4-f-picking-handler`
- Allowed paths:
  - new `apps/web/src/CesiumGlobe/picking.ts` (the `usePickingHandler` hook)
  - new `apps/web/src/CesiumGlobe/pickingFields.ts` (small helper to produce
    picking-id objects, already shipped in W4-B's test scope)
  - modified `apps/web/src/CesiumGlobe/index.tsx` (replaces the inline
    `ScreenSpaceEventHandler` setup + click-handler closure with a hook call)
- **Requires W4-B (picking-contract test) to be green first.**
- The hook takes `viewer`, `screenSpaceEventHandler` (or installs its own),
  and the 4 selection setters / callbacks
  (`setSelectedAircraft`, `setSelectedEarthquake`, `setSelectedSatellite`,
  `onObjectSelectRef`, `onWeatherSelectRef`, `onNewsSelectRef`,
  `onEnergyFeatureSelect`).
- Picking-contract test continues to pass — that is the gate.
- Required: `pnpm --filter web build` PASS, `pnpm --filter web test` PASS,
  **all 8 picking-contract assertions green**.

### W4-G — Extract live aircraft renderer (highest internal state)

- Branch: `frontend/wo-w4-g-live-aircraft-renderer`
- Allowed paths:
  - new `apps/web/src/CesiumGlobe/useLiveAircraftRenderer.ts`
  - modified `apps/web/src/CesiumGlobe/index.tsx`
- The hook owns `aircraftMapRef`, `pendingSnapshotRef`, `applyingRef`,
  `applyRafRef`, `drRafRef`, `aircraftCollectionRef` (passed in), the
  AircraftRecord type, and the rAF loops (snapshot apply + delta handler +
  DR).
- It reads the 3 callback refs from `App.tsx`
  (`onSnapshotCbRef`, `onDeltaCbRef`, `onGetBboxRef`) and the 3 setter
  refs (`onAircraftSnapshotRef`, `onAircraftDeltaRef`,
  `onAircraftRenderedRef`) **which must remain populated by the parent**.
- Required: `pnpm --filter web build` PASS, `pnpm --filter web test` PASS.
- Reviewer gate: same-rAF-cancel ordering as the inline version; same
  async-SVG-swap condition (`shouldShowAircraftIcons()`); same `CHUNK_SIZE`,
  same `RENDER_CAP`.

### W4-H — Extract viewer lifecycle

- Branch: `frontend/wo-w4-h-viewer-lifecycle`
- Allowed paths:
  - new `apps/web/src/CesiumGlobe/useCesiumViewer.ts`
  - modified `apps/web/src/CesiumGlobe/index.tsx` (final orchestrator —
    should now be < 250 lines)
- The hook owns the viewer-init effect: token check, `new Viewer`,
  `configureViewerScene`, 5 data sources, 2 scene primitives, FPS, camera
  listeners, click-handler registration, full unmount cleanup.
- Returns: `{ viewer, viewerReady, aviationDataSource, layoutDataSource,
  earthEventsDataSource, energyInfrastructureDataSource,
  satelliteDotCollection, satelliteEntityDataSource,
  screenSpaceEventHandler, globalDotCollection, abortControllerRef }`.
- **Behavior-preservation checklist** is enforced by the test suite. The
  data-source Cesium-side names (`'aviation'`, `'airport-layout'`,
  `'earth-events'`, `'energy-infrastructure'`, `'space-satellites'`) are
  preserved exactly.
- Required: `pnpm --filter web build` PASS, `pnpm --filter web test` PASS.
- Reviewer gate: `index.tsx` < 250 lines (per `PROJECT_CONTROL.md §16`);
  cleanup ordering identical.

### W4-I — Final cleanup + state sync

- Branch: `docs/wave-4-cesium-globe-split-closeout`
- Allowed paths: `docs/state/**`
- Updates `CURRENT_PROJECT_STATE.md` "Wave 4 outcomes (all complete)"
  subsection; updates `RECENT_CONTEXT.md` rolling window; prepends the
  final handoff entry to `HANDOFF_LOG.md`. **No source code.**
- The implementation agents from W4-B through W4-H already wrote their own
  per-package `RECENT_CONTEXT.md` and `HANDOFF_LOG.md` entries; W4-I
  consolidates them in `CURRENT_PROJECT_STATE.md` and trims the rolling
  window (matching the Wave 3 closeout pattern).
- Required: docs-only checks; no `pnpm` runs needed.

## Risks and Mitigations

| ID | Risk | Mitigation |
|---|---|---|
| **R1** | Picking contract silently breaks during extraction | **W4-B pinning test lands first**; gate every later extraction on the test passing |
| **R2** | Viewer lifecycle cleanup order is fragile (8 ordered steps in current cleanup) | **W4-H review gate** explicitly checks cleanup ordering; helper-level unit tests if feasible |
| **R3** | rAF cancellation duplicated in cleanup + per-hook cleanup | **Each per-hook cleanup is the single source of truth**; the orchestrator does NOT double-cancel; review gate asserts single cancellation site |
| **R4** | Ref-population timing for `onSnapshotCbRef`, `onDeltaCbRef`, `onGetBboxRef` | These refs are populated inside `useLiveAircraftRenderer`; documented contract: the refs are populated **after `viewerReady === true`**, which is the same gate `App.tsx` already waits on. W4-G review gate asserts this |
| **R5** | Stale `apps/web/src/components/CesiumGlobe.tsx` path in active state docs | **W4-A fixes the active state docs.** Historical handoff entries preserved verbatim per append-only rule. Archived `docs/archive/` references intentionally left |
| **R6** | Layer subcomponent picking-id field renames break the contract | **Picking-contract test pins all 8 field names.** Any rename must be intentional and accompanied by both the test update and the contract doc update |
| **R7** | Bundle size regression | Before/after `pnpm --filter web build` size compared; today 304.14 kB JS / 86.65 kB gzip (per prior HANDOFF_LOG). Tolerated delta: ±5 kB |
| **R8** | Cesium mock / jsdom test fragility | **No Cesium-coupled tests added in Wave 4.** All new tests are pure-field-name contract tests. Cesium-coupled testing is out of scope and explicitly deferred to a future work order if ever authorized |
| **R9** | Hidden coupling: `bordersDataSourceRef` cleanup is inside the viewer-init effect today | When W4-H extracts the viewer hook, the borders cleanup moves to `useBordersPolylines.ts` (or stays in the viewer cleanup if cleaner). Decision logged at W4-H review |
| **R10** | `apps/web/src/CesiumGlobe.tsx` shim path is referenced by historical audit docs | The shim preserves the path, so no audit doc becomes wrong. Future audits should reference `apps/web/src/CesiumGlobe/` (the new folder) |

## Test and Validation Plan

### Per-package validation

Every implementation package (W4-B through W4-H) must run:

```powershell
git diff --check
git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- . ":(exclude)docs/archive/**"

pnpm --filter web build
pnpm --filter web test
```

Pass criteria:

- `git diff --check` — no whitespace errors
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)"` — 0 hits (no conflict markers)
- `pnpm --filter web build` — exit 0, no `tsc` errors, no Vite errors
- `pnpm --filter web test` — 153/153 + new picking-contract assertions PASS
  (target: 161/161 by W4-F; further growth depends on whether W4-C onwards
  add new test coverage for extracted hooks)

`python -m pytest tests/data -q` is **not** required per package (Wave 4 is
frontend-only). The 11 pre-existing dirty-tree scope-guard failures will be
ignored per established precedent.

### Targeted tests after W4-B

The picking-contract test (`apps/web/src/CesiumGlobe/__tests__/pickingContract.test.ts`)
is the single new test artifact. It is the gate for every extraction
package from W4-C onwards.

### Targeted tests after W4-C (recommended, optional)

If the planning agent recommends, W4-C may also add unit tests for
`helpers.ts` (pure functions: `airportFlyHeight`, `shouldShowAircraftIcons`,
`getAircraftVisualImage`). ~10–20 assertions, no Cesium.

### V8 cleanup crash

The pre-existing `V8 FatalError: v8::ToLocalChecked Empty MaybeLocal` after
all 153 web tests pass (known Node.js/Vitest issue, documented in prior
HANDOFF_LOG entries) is **expected**. It is not a Wave 4 regression. Tests
"pass" by counting green assertions before the crash.

## Rollback Strategy

Wave 4 is **mechanically reversible** because every package preserves the
compatibility shim. A bad package can be reverted by:

```powershell
git revert <package-commit>
git log -3 --oneline
```

Reverting W4-H (the viewer-lifecycle extraction) would re-inflate
`apps/web/src/CesiumGlobe/index.tsx` to ~1436 lines and remove the
`useCesiumViewer.ts` file. The shim continues to work. The bundle returns
to its prior size. No external API changes.

A reverted package can then be re-attempted after fixing the issue. The
shim-based pattern means **Wave 4 has no irreversible state**.

## Spec Kit Position

This spec follows the Spec Kit pattern used by Spec 008:

- `README.md` — overview, decisions, structure, plan, risks (this file)
- `tasks.md` — gated phase checklist
- **No** `spec.md` / `plan.md` / `contracts/` / `data-model.md` /
  `quickstart.md` — Wave 4 is structural-only, no runtime behavior change,
  no new API/data shape

Cross-references:

- `AGENTS.md` — agent roles and reading policy
- `.specify/memory/constitution.md`
- `docs/control/PROJECT_CONTROL.md` Part 1 §16 (size limits), Part 2 §8
  (Frontend Agent ownership), Part 3 (Git workflow)
- `specs/008-structure-remediation-roadmap/` — predecessor remediation
  roadmap; this spec is its successor for the CesiumGlobe line item
- `docs/state/CURRENT_PROJECT_STATE.md` — current state pointer

## Status Banner

> **Wave 4 CesiumGlobe Split — Planning complete.**
> The single planning artifact is `specs/010-wave-4-cesium-globe-split/`.
> `apps/web/src/CesiumGlobe.tsx` is the real target file path; the
> `apps/web/src/components/CesiumGlobe.tsx` path referenced in some
> historical and active docs is **stale and incorrect**. The 1436-line
> file will be split into `apps/web/src/CesiumGlobe/` behind a 1-line
> compatibility shim, with sequential work packages W4-A through W4-I.
> Implementation requires the picking-contract test (W4-B) before any
> picking-logic extraction. No push, PR, merge, or branch deletion by
> any agent.
