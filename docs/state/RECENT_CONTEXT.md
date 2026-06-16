# Recent Context

Classification: ROLLING_CONTEXT
Last updated: 2026-06-16

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

## 2026-06-16 - SR-013 Maritime Canonicalization

- Agent: Frontend Structure Agent
- Branch: frontend/sr-013/maritime-canonical-folder
- What changed: Renamed the frontend maritime layer folder to `layer_06_maritime` via `git mv`; added canonical `index.ts`; recreated the `maritime/` shim folder with `index.ts` re-exporting from the canonical path; updated the 3 active frontend import sites (`App.tsx` × 2, `CesiumGlobe.tsx` × 1). Runtime strings preserved as intentional: `layer_06_maritime` layerId registry values (already canonical), `/api/layers/layer_06_maritime/...` API paths (owned by API Agent), and internal React state/prop names like `maritimeLayerActive` (JS identifiers, not file paths).
- Validation: old `layers/maritime` import grep PASS; canonical import grep PASS; runtime string review complete; pnpm --filter web build PASS; pnpm --filter web test PASS (64 tests including the relocated maritime test at `src/layers/layer_06_maritime/__tests__/maritime.test.ts`); conflict-marker grep PASS; git diff --check PASS
- Known issues: None
- Next: Reviewer Agent reviews SR-013; do not PR yet unless user explicitly decides; recommended next task after SR-013 review is SR-012 space canonicalization.

## 2026-06-16 - SR-011 Earth-Events Canonicalization

- Agent: Frontend Structure Agent
- Branch: frontend/sr-011/earth-events-canonical-folder
- What changed: Renamed the frontend earth-events layer folder to `layer_03_earth_events` via `git mv`; added canonical `index.ts`; recreated the `earth-events/` shim folder with `index.ts` re-exporting from the canonical path; updated the 5 active frontend import sites. Runtime strings (`CesiumGlobe.tsx` `new CustomDataSource('earth-events')` data source identifier; `lib/api.ts` `/api/earth-events/latest` API path) preserved as intentional.
- Validation: old `layers/earth-events` import grep PASS; canonical import grep PASS; runtime string review complete; pnpm --filter web build PASS; pnpm --filter web test PASS; conflict-marker grep PASS; git diff --check PASS
- Known issues: None
- Next: Reviewer Agent reviews SR-011; do not PR yet unless user explicitly decides; recommended next task after SR-011 review is SR-013 maritime canonicalization.

## 2026-06-16 - SR-021 Retry: Remove Redundant .gitkeep Files

- Agent: Structure Cleanup Agent
- Branch: chore/sr-021-retry-remove-redundant-gitkeep
- What changed: Removed exactly 7 redundant .gitkeep placeholder files from non-empty frontend folders: `apps/web/src/layers/.gitkeep`, `aviation/.gitkeep`, `aviation/aircraft/.gitkeep`, `aviation/airports/.gitkeep`, `earth-events/.gitkeep`, `layer_02_borders_boundaries/.gitkeep`, `globe/.gitkeep`. This retry was run after SR-010S created the canonical borders folder, so the previous blocker (canonical folder missing) is resolved.
- Validation: target gitkeep files no longer tracked; affected folders still contain tracked content; borders shim preserved; canonical export preserved; conflict-marker grep PASS; forbidden-area check PASS; source-code-change check PASS; git diff --check PASS
- Known issues: None
- Next: User / decision-control layer reviews local SR-021 commit and decides whether to push/open PR; recommended next task after SR-021 review is SR-011 earth-events canonicalization (lowest-risk per-layer move).

## 2026-06-16 - SR-010S Borders Restack

- Agent: Frontend Structure Agent
- Branch: frontend/sr-010s-restack-borders-canonical-folder
- What changed: Restacked the SR-010 borders canonical folder rename onto the active correction stack. Renamed `apps/web/src/layers/borders/` to `apps/web/src/layers/layer_02_borders_boundaries/` via `git mv`; added canonical `index.ts`; recreated the `borders/` shim folder with `index.ts` re-exporting from the canonical path; updated the 5 active frontend import sites.
- Validation: old `layers/borders` import grep PASS (no output); canonical folder + shim + coming-soon checks PASS; `pnpm --filter web build` PASS; `pnpm --filter web test` PASS; conflict-marker grep PASS; git diff --check PASS
- Known issues: None
- Next: Reviewer Agent reviews SR-010S; do not PR yet unless user explicitly decides; after SR-010S review, retry SR-021 redundant .gitkeep cleanup using the original 7-file allowed list (the canonical borders folder now exists).

## 2026-06-16 - SR-020 Spec 008 Status Refresh

- Agent: Documentation / Spec Agent
- Branch: docs/sr-020-refresh-spec-008-status
- What changed: Refreshed Spec 008 roadmap/status (`tasks.md`, `plan.md`, `README.md`) so completed SR items (SR-001..SR-008, SR-005A/B/C, SR-010) are clearly marked Done and remaining structure/naming work (SR-009, SR-011, SR-012, SR-013, SR-014, plus auxiliary cleanup items) is visibly pending. Detailed SR-NNN task descriptions preserved as the audit trail.
- Validation: conflict-marker grep PASS; status-wording grep PASS; SR-010 references verified in spec/state docs; git diff --check PASS
- Known issues: None
- Next: User / decision-control layer reviews the local SR-020 commit; reviewer Agent should review SR-020 before any next work; do not PR yet unless user explicitly decides; recommended next task after SR-020 review is to decide between redundant `.gitkeep` cleanup and the next low-risk frontend canonicalization (SR-011 earth-events).
