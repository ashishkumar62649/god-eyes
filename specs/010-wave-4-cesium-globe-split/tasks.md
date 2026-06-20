# Tasks — Wave 4 CesiumGlobe Split

> **Agent:** Frontend Agent (implementation), Orchestrator Agent (review)
> **Lane:** Frontend / Refactor
> **Date:** 2026-06-20
> **Source spec:** `README.md` (this folder)
> **Source research:** Wave 4 Research Agent report on branch
>   `research/wave-4-cesium-globe-file-map` (review passed)

This file turns the Wave 4 CesiumGlobe split into **9 gated work
packages** (W4-A through W4-I). Each package is small enough to fit one
local commit behind one branch, following the Wave 3 pattern.

For every package, the following metadata is recorded:

* **Package ID** — `W4-X`
* **Title** — short imperative
* **Goal** — one-sentence summary
* **Branch name** — the suggested branch (matches the project convention
  `<role>/<work-order>/<short-name>`)
* **Lane / agent owner** — who picks it up
* **Files / folders allowed** — explicit allow list
* **Files / folders forbidden** — explicit deny list
* **Required tests** — exact commands
* **Review requirement** — the reviewer gate items
* **Notes** — additional context

---

## Status Legend

* **Pending** — package not yet started.
* **In progress** — package is currently being executed.
* **Done** — package's primary deliverable landed in a local commit on
  the named branch. May not yet be pushed, PR'd, or merged.
* **Blocked** — cannot start until an upstream package is done or a
  decision is made.

---

## Phased Package Status

| ID | Title | Status | Branch (actual) |
|---|---|---|---|
| W4-A | Planning docs + stale path correction | **Done** | `frontend/wave-4-cesium-globe-split` (commit `a66611b`) |
| W4-B | Picking-contract test | **Done** | `frontend/wave-4-cesium-globe-split` (commit `d895dfc`) |
| W4-C | Create CesiumGlobe folder + shim + render shell + pure helpers | **Done** | `frontend/wave-4-cesium-globe-split` (commit `1836be1`) |
| W4-D | Extract maritime bbox reporter | **Done** | `frontend/wave-4-cesium-globe-split` (commit `617c5e9`) |
| W4-E | Extract resident aviation cache | **Done** | `frontend/wave-4-cesium-globe-split` (commit `b674842`) |
| W4-F | Extract picking handler | **Done** | `frontend/wave-4-cesium-globe-split` (commit `ab4172f`) |
| W4-G | Extract live aircraft renderer | **Done** | `frontend/wave-4-cesium-globe-split` (commit `dd93421`) |
| W4-H | Extract viewer lifecycle | **Done** | `frontend/wave-4-cesium-globe-split` (commit `a01f878`) |
| W4-I | Final cleanup + state sync | **Done** | `frontend/wave-4-cesium-globe-split` (commit `<filled at commit time>`) |

### Note on per-package branch naming

The original planning README listed per-package branches (`frontend/wo-w4-...`) for tracking
the Wave 3 style (each package on its own branch, PR per package). The task brief for W4-B
through W4-H then specified the **important branch rule**: continue on the existing
`frontend/wave-4-cesium-globe-split` branch. All implementation packages therefore landed on
that single branch as sequential commits, instead of one branch per package. The commit
stack below preserves the per-package ordering.

### Final commit stack on `frontend/wave-4-cesium-globe-split` (most recent first)

```
a01f878 refactor(web): extract cesium globe viewer lifecycle                   (W4-H)
dd93421 refactor(web): extract cesium globe live aircraft renderer            (W4-G)
ab4172f refactor(web): extract cesium globe picking handler                    (W4-F)
b674842 refactor(web): extract cesium globe resident aviation cache             (W4-E)
617c5e9 refactor(web): extract cesium globe camera bbox reporter              (W4-D)
1836be1 refactor(web): introduce cesium globe module shell                     (W4-C)
d895dfc test(web): add cesium globe picking contract                          (W4-B)
f631de0 docs(state): trim recent context trailing blank line                  (state hygiene)
6819803 docs(state): repair recent context formatting                        (state hygiene)
a66611b docs(spec): plan wave 4 cesium globe split                            (W4-A)
6006454 docs(state): close wave 3 route split cleanup                         (base on main)
```

### Final validation snapshot (at W4-I time)

- `pnpm --filter @god-eyes/contracts build` → PASS
- `pnpm --filter web build` → PASS (120 modules, 306.84 kB JS / 87.24 kB gzip)
- `pnpm --filter web test` → PASS (170/170 across 9 test files)
- `pnpm --filter web test -- pickingContract.test.ts` → PASS (17/17)
- `git diff --check` → clean
- `git grep` conflict markers → 0 hits
- No production layer files (`apps/web/src/layers/**`, `apps/web/src/globe/**`,
  `apps/web/src/components/**`) modified

---

## Gated Phase Checklist

### Phase 1 — Research

- [x] **Research complete** — Wave 4 CesiumGlobe Research Agent finished
      the read-only file map on branch `research/wave-4-cesium-globe-file-map`.
- [x] **Research review passed** — research report verified target path
      (`apps/web/src/CesiumGlobe.tsx`), 1436-line file size, hidden picking
      contract, and all dependency facts.

### Phase 2 — Planning

- [x] **Planning complete** — `specs/010-wave-4-cesium-globe-split/`
      created with `README.md` + `tasks.md`. Target folder decided
      (`apps/web/src/CesiumGlobe/`). Shim strategy decided. Picking-contract
      test required before any extraction. Sequential W4-B → W4-I plan
      documented.
- [x] **Planning review passed** — Orchestrator Agent confirmed target
      folder, shim strategy, picking-contract plan, and W4-B → W4-I
      sequence. No source code changes in W4-A.

### Phase 3 — Implementation

- [x] **W4-B — Picking-contract test** landed (commit `d895dfc`).
- [x] **W4-C — CesiumGlobe folder + shim + shell + helpers** landed (commit `1836be1`).
- [x] **W4-D — maritime bbox reporter** extracted (commit `617c5e9`).
- [x] **W4-E — resident aviation cache** extracted (commit `b674842`).
- [x] **W4-F — picking handler** extracted (commit `ab4172f`).
- [x] **W4-G — live aircraft renderer** extracted (commit `dd93421`).
- [x] **W4-H — viewer lifecycle** extracted (commit `a01f878`).
- [x] **W4-I — final cleanup + state sync** consolidates (this commit).

### Phase 4 — Integration Review

- [ ] **Implementation review** — Orchestrator Agent review of each
      implementation package on the consolidated branch
      (`docs/state/INTEGRATION_REVIEW_W4-{B..H}.md`).
      Reviewer gate items per package are listed below.

### Phase 5 — State Sync

- [ ] **State sync** — `docs/state/CURRENT_PROJECT_STATE.md` updated with
      "Wave 4 outcomes (all complete)" subsection; rolling window trimmed
      in `RECENT_CONTEXT.md`; final handoff entry prepended to
      `HANDOFF_LOG.md`.

---

## W4-A — Planning docs + stale path correction

* **Status:** **Done** on this branch.
* **Title:** Create Wave 4 planning spec + correct stale path in active state docs.
* **Goal:** Land `specs/010-wave-4-cesium-globe-split/{README.md,tasks.md}`
  and update the three active state docs so the **real** target path
  (`apps/web/src/CesiumGlobe.tsx`) is recorded and the **stale** path
  (`apps/web/src/components/CesiumGlobe.tsx`) is no longer cited as the
  active Wave 4 target.
* **Phase:** 2 — Planning.
* **Branch name:** `frontend/wave-4-cesium-globe-split`
  (the current branch).
* **Lane / agent owner:** Orchestrator Agent (planning).
* **Files / folders allowed:**
  * `specs/010-wave-4-cesium-globe-split/README.md` (new)
  * `specs/010-wave-4-cesium-globe-split/tasks.md` (new)
  * `docs/state/CURRENT_PROJECT_STATE.md` (modified)
  * `docs/state/RECENT_CONTEXT.md` (modified)
  * `docs/state/HANDOFF_LOG.md` (prepended planning entry only)
* **Files / folders forbidden:**
  * Any source file in `apps/`, `services/`, `database/`, `packages/`,
    `tests/`, `specs/008-structure-remediation-roadmap/`,
    `specs/009-future-scaling-architecture/`, `docs/control/`,
    `docs/audits/`, `docs/archive/`.
  * Lockfile, env files, `apps/web/src/CesiumGlobe.tsx`,
    `apps/web/src/CesiumGlobe/`, `apps/web/src/App.tsx`,
    any layer subcomponent.
* **Required tests:**
  * No build or test runs required (docs-only).
  * `git diff --check` — clean.
  * `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- . ":(exclude)docs/archive/**"`
    — 0 hits.
  * `git diff --name-only` — must show only the 5 allowed files.
* **Review requirement:**
  * `README.md` and `tasks.md` exist and match the spec layout.
  * `CURRENT_PROJECT_STATE.md` "Phase" header updated to "Wave 4 Planning"
    and the "Wave 4 outcomes (planning)" subsection references the real
    path `apps/web/src/CesiumGlobe.tsx`.
  * `RECENT_CONTEXT.md` top entry is the W4-A planning entry; rolling
    window stays at 3–5 entries.
  * `HANDOFF_LOG.md` has exactly one prepended W4-A planning entry; all
    historical entries preserved verbatim.
  * No source file in the post-edit `git diff --name-only`.
  * No secrets.
  * Handoff entry written.
* **Notes:**
  * Historical `apps/web/src/components/CesiumGlobe.tsx` references in
    pre-existing handoff entries are intentionally preserved per the
    append-only rule. The correction is in the new top entry + the
    `CURRENT_PROJECT_STATE.md` update only.
  * This package does **not** start any implementation. W4-B is the
    first implementation package.

---

## W4-B — Picking-contract test

* **Status:** Pending.
* **Title:** Pin the 8-field picking contract with a Vitest test.
* **Goal:** Add `apps/web/src/CesiumGlobe/__tests__/pickingContract.test.ts`
  that asserts all 8 picking field names and types are produced by the
  expected producers. **No Cesium-coupled testing.**
* **Phase:** 3 — Implementation (first package).
* **Branch name:** `frontend/wo-w4-b-picking-contract-test`
* **Lane / agent owner:** Frontend Agent.
* **Files / folders allowed:**
  * `apps/web/src/CesiumGlobe/__tests__/pickingContract.test.ts` (new)
  * `apps/web/src/CesiumGlobe/pickingFields.ts` (new, optional helper)
* **Files / folders forbidden:**
  * `apps/web/src/CesiumGlobe.tsx`, `apps/web/src/CesiumGlobe/`,
    `apps/web/src/App.tsx`, `apps/web/src/layers/**` (production code).
  * `apps/api/**`, `services/**`, `database/**`, `packages/**`.
  * Lockfile, env files.
* **Required tests:**
  * `git diff --check` — clean.
  * `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- . ":(exclude)docs/archive/**"`
    — 0 hits.
  * `pnpm --filter web build` — PASS.
  * `pnpm --filter web test` — PASS with all 8 picking-contract assertions
    green.
* **Review requirement:**
  * All 8 field names asserted: `_aircraftData`, `_vesselData`,
    `_weatherData`, `_newsData`, `_satelliteData`, `earthquakeData`,
    `satelliteData`, `rawData`.
  * No Cesium scene instantiated; no jsdom + Cesium mock used.
  * Forbidden folders untouched.
  * Handoff log appended.
  * No secrets.
* **Notes:**
  * This test is the **gate** for W4-F (picking handler extraction). No
    later package may break the picking contract without an explicit
    test + commit-message rationale.
  * The test file path follows the existing pattern
    `apps/web/src/layers/**/__tests__/**` (note the `apps/web/src/`
    prefix; there is no `tests/` folder at the workspace root).

---

## W4-C — Create CesiumGlobe folder + shim + render shell + pure helpers

* **Status:** Pending.
* **Title:** Create `apps/web/src/CesiumGlobe/` and replace
  `apps/web/src/CesiumGlobe.tsx` with a 1-line compatibility shim.
* **Goal:** Establish the target folder and the shim. Move the pure
  helpers and the render shell to their own files. Move the existing
  CesiumGlobe component body into `apps/web/src/CesiumGlobe/index.tsx`
  as the **orchestrator** (still 1436 lines at this point — this is a
  rename, not an extraction).
* **Phase:** 3 — Implementation.
* **Branch name:** `frontend/wo-w4-c-cesium-globe-folder-shim-shell-helpers`
* **Lane / agent owner:** Frontend Agent.
* **Files / folders allowed:**
  * `apps/web/src/CesiumGlobe/index.tsx` (new — full copy of the
    current `CesiumGlobe.tsx` content, exports `default CesiumGlobe`)
  * `apps/web/src/CesiumGlobe/CesiumGlobeView.tsx` (new — pure
    render shell extracted from lines 1382–1433; takes the orchestrator's
    state as props)
  * `apps/web/src/CesiumGlobe/helpers.ts` (new — pure helpers from lines
    174–186 and 318–387: `airportFlyHeight`, `emitStats`,
    `applyFiltersToDots`, `shouldShowAircraftIcons`,
    `getAircraftVisualImage`, `updateAircraftVisualMode`)
  * `apps/web/src/CesiumGlobe/types.ts` (new — `AviationStats`,
    `CesiumGlobeProps`, internal `AircraftRecord`)
  * `apps/web/src/CesiumGlobe/constants.ts` (new —
    `AIRCRAFT_ICON_VIEW_HEIGHT_METERS`, `CHUNK_SIZE`, `DR_MAX_SECS`,
    `FRAME_INTERVAL`, `KNOTS_TO_MPS`, `FPM_TO_MPS`, `R` (Earth radius),
    `DOT_HEIGHT_METERS`, etc.)
  * `apps/web/src/CesiumGlobe.tsx` (modified — 1-line shim
    `export { default } from './CesiumGlobe/index.js';`)
* **Files / folders forbidden:**
  * `apps/web/src/App.tsx`, `apps/web/src/main.tsx`, all layer subcomponents.
  * `apps/web/src/components/{Header,Shell,LayerPanel,DetailPanel,SearchCommand,StatusPanel}.tsx`.
  * `apps/web/src/globe/**` (already-extracted helpers — untouched).
  * `apps/api/**`, `services/**`, `database/**`, `packages/**`.
  * Lockfile, env files.
* **Required tests:**
  * `git diff --check` — clean.
  * `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- . ":(exclude)docs/archive/**"`
    — 0 hits.
  * `pnpm --filter web build` — PASS (bundle size delta: ≤ ±5 kB).
  * `pnpm --filter web test` — PASS (153/153 + W4-B's new picking-contract
    assertions).
* **Review requirement:**
  * `App.tsx` unchanged. `git grep -n "CesiumGlobe" -- apps/web/src` returns
    only `App.tsx:2` (import), `CesiumGlobe.tsx` (the shim), the new
    `CesiumGlobe/` folder, and `NewsLayer.tsx:19` (comment-only).
  * The shim is exactly 1 effective line of code.
  * `CesiumGlobe/index.tsx` still exports the unchanged component
    (functionally identical to today's `CesiumGlobe.tsx`).
  * Bundle size delta is acceptable.
  * Handoff log appended.
  * No secrets.
* **Notes:**
  * **Diff-minimization trick:** for the first commit of W4-C, do not
    extract anything. Just copy the entire `CesiumGlobe.tsx` to
    `CesiumGlobe/index.tsx` and replace the original with the shim. This
    is the smallest possible W4-C commit and is **purely mechanical**.
    Subsequent commits in W4-C extract the helpers, types, constants,
    and shell in separate commits. Reviewing becomes easier and
    bisection-friendly.

---

## W4-D — Extract maritime bbox reporter

* **Status:** Pending.
* **Title:** Move the maritime bbox `useEffect` into
  `useCameraBboxReporter`.
* **Goal:** Replace the inline effect at lines 1309–1364 with a hook call
  inside `apps/web/src/CesiumGlobe/index.tsx`.
* **Phase:** 3 — Implementation.
* **Branch name:** `frontend/wo-w4-d-camera-bbox-reporter`
* **Lane / agent owner:** Frontend Agent.
* **Files / folders allowed:**
  * `apps/web/src/CesiumGlobe/useCameraBboxReporter.ts` (new)
  * `apps/web/src/CesiumGlobe/index.tsx` (modified — replace effect
    with hook call)
* **Files / folders forbidden:**
  * Same as W4-C.
* **Required tests:**
  * `git diff --check` — clean.
  * `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- . ":(exclude)docs/archive/**"`
    — 0 hits.
  * `pnpm --filter web build` — PASS.
  * `pnpm --filter web test` — PASS.
* **Review requirement:**
  * Behavior identical: bbox validation chain, dateline-crossing rejection,
    `null` fallback on any failure.
  * Cleanup ordering preserved: `viewer.camera.moveEnd.removeEventListener`.
  * `viewer.camera.computeViewRectangle()` call path unchanged.
  * Handoff log appended.
  * No secrets.
* **Notes:**
  * This is the **lowest-risk** extraction package. Use it to validate
    the extraction process end-to-end before attempting higher-risk
    extractions.

---

## W4-E — Extract resident aviation cache

* **Status:** Pending.
* **Title:** Move the aviation layer ON/OFF + preload + filter change
  effects into `useResidentAviationCache`.
* **Goal:** Replace the inline effects at lines 389–459 + 671–716 with
  one hook call inside `apps/web/src/CesiumGlobe/index.tsx`. The hook
  owns the 3 resident-cache refs (`residentCacheActiveRef`,
  `preloadingRef`, `dotsCreatedRef`) plus `abortControllerRef`.
* **Phase:** 3 — Implementation.
* **Branch name:** `frontend/wo-w4-e-resident-aviation-cache`
* **Lane / agent owner:** Frontend Agent.
* **Files / folders allowed:**
  * `apps/web/src/CesiumGlobe/useResidentAviationCache.ts` (new)
  * `apps/web/src/CesiumGlobe/index.tsx` (modified)
* **Files / folders forbidden:** Same as W4-C.
* **Required tests:**
  * `git diff --check` — clean.
  * `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- . ":(exclude)docs/archive/**"`
    — 0 hits.
  * `pnpm --filter web build` — PASS.
  * `pnpm --filter web test` — PASS.
* **Review requirement:**
  * Preload guard chain preserved (4-step: cache active → viewer ready →
    preloading → set flag).
  * `fetchAllAviationCategories` progress callback preserved (CACHE_READY,
    LOADING:..., ERROR:...).
  * Layer OFF clears dots but keeps cache; layer ON reuses cache.
  * `AbortController` lifecycle correct.
  * Handoff log appended.
* **Notes:**
  * Cross-hook contract: this hook reads `globalDotCollectionRef`, which
    is created inside the viewer-init effect (still inline in W4-E).
    The order is enforced by call-site placement. W4-H moves the
    viewer-init effect into `useCesiumViewer`; the call-site order must
    then be `useCesiumViewer` first, `useResidentAviationCache` second.

---

## W4-F — Extract picking handler

* **Status:** Pending.
* **Title:** Move the click-handler branch tree into `picking.ts`
  (`usePickingHandler`).
* **Goal:** Replace the inline `ScreenSpaceEventHandler` setup +
  click-handler closure at lines 543–637 with a hook call. The hook
  installs its own handler (or accepts one) and dispatches to the 8
  callbacks/read setters.
* **Phase:** 3 — Implementation.
* **Branch name:** `frontend/wo-w4-f-picking-handler`
* **Lane / agent owner:** Frontend Agent.
* **Files / folders allowed:**
  * `apps/web/src/CesiumGlobe/picking.ts` (new — `usePickingHandler`)
  * `apps/web/src/CesiumGlobe/pickingFields.ts` (new if not already
    created in W4-B)
  * `apps/web/src/CesiumGlobe/index.tsx` (modified)
* **Files / folders forbidden:** Same as W4-C.
* **Required tests:**
  * `git diff --check` — clean.
  * `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- . ":(exclude)docs/archive/**"`
    — 0 hits.
  * `pnpm --filter web build` — PASS.
  * `pnpm --filter web test` — PASS, **all 8 picking-contract assertions
    from W4-B still green**.
* **Review requirement:**
  * All 10 click-handler branches preserved (5 by string-keyed
    `_xxxData`, 3 by Cesium `Entity` properties, 1 by `id` prefix,
    1 by `rawData` property, plus the global-dot fly-to + `isPositionVisible`
    guard).
  * Field-name contract test still green.
  * `isPositionVisible` guard preserved.
  * `viewer.camera.flyTo` global-dot behavior preserved (`duration: 1.0`,
    `airportFlyHeight(viewer.camera.positionCartographic.height)`).
  * Handoff log appended.
* **Notes:**
  * **Gated on W4-B.** No extraction of picking logic may land before
    the picking-contract test is green.
  * This is the **highest behavioral risk** extraction because of the
    hidden picking contract.

---

## W4-G — Extract live aircraft renderer

* **Status:** Pending.
* **Title:** Move the snapshot + delta + DR loops into
  `useLiveAircraftRenderer`.
* **Goal:** Replace the inline effects at lines 873–1211 with one hook
  call. The hook owns `aircraftMapRef`, `pendingSnapshotRef`,
  `applyingRef`, `applyRafRef`, `drRafRef`, the `AircraftRecord` type,
  the snapshot apply loop, the delta handler, the DR rAF loop, the
  layer-OFF cleanup, and the bbox getter.
* **Phase:** 3 — Implementation.
* **Branch name:** `frontend/wo-w4-g-live-aircraft-renderer`
* **Lane / agent owner:** Frontend Agent.
* **Files / folders allowed:**
  * `apps/web/src/CesiumGlobe/useLiveAircraftRenderer.ts` (new)
  * `apps/web/src/CesiumGlobe/index.tsx` (modified)
* **Files / folders forbidden:** Same as W4-C.
* **Required tests:**
  * `git diff --check` — clean.
  * `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- . ":(exclude)docs/archive/**"`
    — 0 hits.
  * `pnpm --filter web build` — PASS.
  * `pnpm --filter web test` — PASS.
* **Review requirement:**
  * `CHUNK_SIZE = 500`, `RENDER_CAP` (from `useLiveAircraftSocket`)
    preserved.
  * Field-fallback chain preserved: `altitudeFt ?? altitudeBaroFt`;
    `speedKt ?? groundSpeedKt`;
    `trackDeg ?? headingDeg ?? headingTrueDeg ?? NaN`.
  * Apply-guard (`applyingRef`) preserved.
  * Async SVG-swap condition (`shouldShowAircraftIcons()`) preserved.
  * DR loop constants (`DR_MAX_SECS = 10`, `FRAME_INTERVAL = 50`) preserved.
  * Layer-OFF cleanup: `cancelAnimationFrame`, `rec.billboard.show = false`,
    `map.clear()`, `setSelectedAircraft(null)`.
  * `onAircraftRendered(map.size)` called after each apply.
  * `onSnapshotCbRef.current = snapshotHandler` AND
    `onAircraftSnapshotRef.current = snapshotHandler` both populated.
  * `onDeltaCbRef.current = deltaHandler` AND
    `onAircraftDeltaRef.current = deltaHandler` both populated.
  * Handoff log appended.
* **Notes:**
  * The hook reads the 3 callback refs from App.tsx
    (`onSnapshotCbRef`, `onDeltaCbRef`, `onGetBboxRef`). These refs must
    already be populated by App.tsx's hook order. Document this in the
    hook's JSDoc.
  * **Bundle size impact:** this hook will probably grow the bundle
    slightly because of the rAF loop bodies. Compare before/after.

---

## W4-H — Extract viewer lifecycle

* **Status:** Pending.
* **Title:** Move the viewer-init `useEffect` into `useCesiumViewer`.
* **Goal:** Replace the inline effect at lines 462–668 with one hook
  call. The orchestrator (`index.tsx`) is now **< 250 lines** per
  `PROJECT_CONTROL.md §16`.
* **Phase:** 3 — Implementation.
* **Branch name:** `frontend/wo-w4-h-viewer-lifecycle`
* **Lane / agent owner:** Frontend Agent.
* **Files / folders allowed:**
  * `apps/web/src/CesiumGlobe/useCesiumViewer.ts` (new)
  * `apps/web/src/CesiumGlobe/index.tsx` (modified)
  * Optionally: extract one or more of
    `apps/web/src/CesiumGlobe/useLayoutFeatures.ts`,
    `useEarthquakes.ts`, `useBordersPolylines.ts`, `useSatellites.ts`
    in the same branch if cleanup allows. Each must be its own commit.
* **Files / folders forbidden:** Same as W4-C.
* **Required tests:**
  * `git diff --check` — clean.
  * `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- . ":(exclude)docs/archive/**"`
    — 0 hits.
  * `pnpm --filter web build` — PASS.
  * `pnpm --filter web test` — PASS.
* **Review requirement:**
  * All 8 cleanup steps preserved in the same order: `stopFpsCounter`
    → `viewer.camera.changed.removeEventListener` →
    `viewer.camera.moveEnd.removeEventListener` → `viewer.destroy()` →
    `abortControllerRef.abort()` → `cancelAnimationFrame` × 2 →
    `aircraftMapRef.clear()` → null out `bordersDataSourceRef`.
  * 5 `CustomDataSource` Cesium-side names preserved exactly
    (`'aviation'`, `'airport-layout'`, `'earth-events'`,
    `'energy-infrastructure'`, `'space-satellites'`).
  * 2 scene primitive allocations preserved
    (`BillboardCollection` for aircraft, `PointPrimitiveCollection`
    for satellite dots).
  * `viewer.camera.percentageChanged = 0.05` preserved.
  * `index.tsx` < 250 lines.
  * Handoff log appended.
* **Notes:**
  * **Last extraction package.** After W4-H lands, the CesiumGlobe
    split is structurally complete. W4-I consolidates the state docs.
  * If `index.tsx` is still > 250 lines after the viewer-lifecycle
    extraction, one or more of the per-layer hooks
    (`useLayoutFeatures`, `useEarthquakes`, `useBordersPolylines`,
    `useSatellites`) must be extracted in the same branch, behind the
    same shim, before W4-I.

---

## W4-I — Final cleanup + state sync

* **Status:** **Done** (this commit).
* **Title:** Consolidate Wave 4 outcomes in state docs and trim the
  rolling context window.
* **Goal:** Mirror the Wave 3 closeout pattern. Add a "Wave 4 outcomes
  (all complete)" subsection to `CURRENT_PROJECT_STATE.md`. Trim
  `RECENT_CONTEXT.md` rolling window to a clean 3–5 entries.
  Prepend one final handoff entry to `HANDOFF_LOG.md`.
* **Phase:** 5 — State Sync.
* **Branch name:** `frontend/wave-4-cesium-globe-split` (continued —
  per the task brief's important branch rule; original planning listed
  `docs/wave-4-cesium-globe-split-closeout`).
* **Lane / agent owner:** Orchestrator Agent (state sync).
* **Files / folders allowed:**
  * `docs/state/CURRENT_PROJECT_STATE.md` (modified)
  * `docs/state/RECENT_CONTEXT.md` (modified)
  * `docs/state/HANDOFF_LOG.md` (prepended entry only)
  * `specs/010-wave-4-cesium-globe-split/README.md` (final outcome section)
  * `specs/010-wave-4-cesium-globe-split/tasks.md` (this file; package status)
* **Files / folders forbidden:** All source code, all specs (other than
  this one), all archive material, all package folders, all layer
  files, all CesiumGlobe production files.
* **Required tests:**
  * `pnpm --filter @god-eyes/contracts build` — PASS
  * `pnpm --filter web build` — PASS (120 modules, 306.84 kB / 87.24 kB gzip)
  * `pnpm --filter web test` — PASS (170/170)
  * `pnpm --filter web test -- pickingContract.test.ts` — PASS (17/17)
  * `git diff --check` — clean.
  * `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- . ":(exclude)docs/archive/**"`
    — 0 hits.
  * `git diff --name-only` — only the 5 allowed files.
* **Review requirement:**
  * `CURRENT_PROJECT_STATE.md` "Phase" header updated to "Wave 4 Complete".
  * "Wave 4 outcomes (all complete)" subsection lists W4-B through W4-H
    with branch names + commit hashes + picking-contract test results.
  * `RECENT_CONTEXT.md` has exactly 3–5 entries, with the W4 closeout
    entry on top.
  * `HANDOFF_LOG.md` has exactly one prepended closeout entry; all
    historical entries preserved verbatim.
  * No source code touched.
  * No secrets.
* **Notes:**
  * Each W4-B through W4-H package already wrote its own
    `RECENT_CONTEXT.md` and `HANDOFF_LOG.md` entry. W4-I consolidates
    them, matching the Wave 3 closeout pattern.

---

## Cross-Package Summary

| ID | Phase | Lane | Title | Risk | Gated on |
|---|---|---|---|---|---|
| W4-A | 2 Planning | Orchestrator | Planning docs + stale path correction | Low | — |
| W4-B | 3 Implementation | Frontend | Picking-contract test | Low | — |
| W4-C | 3 Implementation | Frontend | CesiumGlobe folder + shim + shell + helpers | Low | — |
| W4-D | 3 Implementation | Frontend | Maritime bbox reporter | Low | — |
| W4-E | 3 Implementation | Frontend | Resident aviation cache | Medium | — |
| W4-F | 3 Implementation | Frontend | Picking handler | **High** | **W4-B** |
| W4-G | 3 Implementation | Frontend | Live aircraft renderer | High | W4-E |
| W4-H | 3 Implementation | Frontend | Viewer lifecycle | High | W4-G |
| W4-I | 5 State Sync | Orchestrator | Final cleanup + state sync | Low | W4-H |

---

## Scope Guard (applies to every package)

The following paths are **forbidden** for every Wave 4 package unless a
later approved phase explicitly opens them:

```
apps/api/**
services/**
database/**
packages/**
docs/archive/**
specs/009-future-scaling-architecture/**
```

Additionally forbidden unless explicitly listed in a package's "Files /
folders allowed" section:

```
lockfiles (pnpm-lock.yaml, package-lock.json, yarn.lock, etc.)
.env, .env.example, .env.local, .env.*, env files in apps/
apps/web/src/App.tsx
apps/web/src/main.tsx
apps/web/src/components/overlays/**
apps/web/src/components/intel/**
apps/web/src/components/layer-panel/**
apps/web/src/components/detail-panel/**
apps/web/src/globe/**
apps/web/src/layers/** (production code; tests inside are OK in W4-B
                          because they live under __tests__/**)
apps/web/src/lib/** (unchanged)
apps/web/src/styles/**
```

Violations must be reported in the package's handoff entry and reverted
before the package is considered done.

---

## Push / PR / Merge Policy Reminder

Per `AGENTS.md` and `PROJECT_CONTROL.md` Part 3:

- Worker agents (Frontend, Orchestrator state-sync) create **local commits
  only**. They do **not** push to remote, open PRs, merge, or delete
  branches.
- The Orchestrator Agent reviews each branch and creates
  `docs/state/INTEGRATION_REVIEW_W4-*.md`.
- On reviewer PASS, the user / decision-control layer pushes the branch
  and opens one PR per completed work package.
- One PR per completed work package. Multiple local commits are allowed
  within one work-package branch (recommended for diff minimization in
  W4-C and W4-H).

No agent in Wave 4 is authorized to push, open a PR, merge, or delete a
branch. The user / decision-control layer is the only role authorized to
do these actions after reviewer PASS.
