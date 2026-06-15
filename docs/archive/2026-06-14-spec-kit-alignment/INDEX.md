# Documentation Structure Cleanup — 2026-06-14 (Spec Kit Alignment)

> **Agent:** Documentation Agent
> **Lane:** Documentation
> **Work order:** documentation-structure-cleanup-pass-2
> **Branch:** agent/documentation-system-spec-kit-alignment
> **Date:** 2026-06-14
> **Last updated:** 2026-06-14

This folder is a **one-time, dated archive batch** created by the
documentation structure cleanup pass that follows the 2026-06-14 spec-kit
alignment. It contains clearly historical, superseded, or misfiled documents
that were moved out of the active `docs/` tree. **Nothing in this folder is an
active instruction.**

This batch sits alongside the earlier 2026-06-14-documentation-cleanup batch
in `docs/archive/`. The two batches are dated and named differently on purpose
so they can be reverted, retained, or merged in a future cleanup.

## How to read this index

| Column | Meaning |
|---|---|
| **Original path** | Path in the active `docs/` tree before the cleanup |
| **New path** | New path inside `docs/archive/2026-06-14-spec-kit-alignment/` (or, for promoted docs, the new active path) |
| **Action** | What we did: `git mv` (archive), `rename` (re-home), or `in-place edit` (reference fix) |
| **Reason** | Why the document was moved or re-homed |
| **Reference safety** | Whether the file is referenced by an active control, state, or spec document. Active references were checked before each move. |

## Archive / restructure index

| Original path | New path | Action | Reason | Reference safety |
|---|---|---|---|---|
| `docs/audits/PROJECT_ALIGNMENT_REPORT.md` | `docs/archive/2026-06-14-spec-kit-alignment/audits/PROJECT_ALIGNMENT_REPORT.md` | git mv (archive) | Pre-alignment state report. Superseded by `docs/audits/PROJECT_ALIGNMENT_FIX_REPORT.md` and `docs/audits/PROJECT_ALIGNMENT_FIX_REVIEW.md`. | No active reference (only the protected audit family; this doc is not on the protected list and the alignment pass on `main` 2026-06-14 has its own follow-up reports). |
| `docs/api/API_AVIATION_CATEGORY_AUDIT_WO-029E.md` | `docs/archive/2026-06-14-spec-kit-alignment/audits/API_AVIATION_CATEGORY_AUDIT_WO-029E.md` | git mv (archive) | Historical aviation category audit/feasibility evidence, not an active API reference. Superseded by the implemented aviation categories in the active code and the corresponding integration review record. | No active reference. The WO-029E work is closed; outcomes are in the integration review record. |
| `docs/api/API_AVIATION_DENSITY_VIEW_FEASIBILITY.md` | `docs/archive/2026-06-14-spec-kit-alignment/audits/API_AVIATION_DENSITY_VIEW_FEASIBILITY.md` | git mv (archive) | Historical aviation density view feasibility study. Aviation density rendering is implemented in the current code. | No active reference. |
| `docs/data/layer_01_aviation/AVIATION_CATEGORY_AUDIT_WO-029E.md` | `docs/archive/2026-06-14-spec-kit-alignment/audits/AVIATION_CATEGORY_AUDIT_WO-029E.md` | git mv (archive) | Duplicate of the WO-029E category audit that lived in `docs/api/`. Both files are historical. The active aviation categories live in the implemented code. | No active reference. |
| `docs/api/API_AVIATION_PRELOAD_WO-030A.md` | `docs/archive/2026-06-14-spec-kit-alignment/old-work-orders/WO-030A-aviation-preload.md` | git mv (archive) | Work-order-style API design document for WO-030A aviation preload. The endpoint is implemented; the doc is historical. | No active reference. |
| `docs/state/AVIATION_LIVE_SOURCE_DECISION.md` | `docs/decisions/ADR-002-aviation-live-source.md` | rename (re-home) | It is a decision record, not current state. The two earlier `HANDOFF_LOG.md` references to the old path are historical (the file was created by the WO-079A work). Promoting it to the decisions folder matches the new documentation system. | Handled: only the historical `HANDOFF_LOG.md` lines reference the old path; those are append-only historical entries and the move is the documented "decision" classification per `docs/README.md`. No active file points to the old path. |
| `docs/work-orders/WORK_ORDER_TEMPLATE.md` | `docs/control/WORK_ORDER_TEMPLATE.md` | rename (re-home) | It is a reusable template / control document, not an actual work order. The path is now in the active control folder alongside other reusable templates. | No active reference. The template is referenced only as a doc that an agent copies from; no active doc path-points to it. |
| `docs/control/layer_10_energy_infrastructure_mvp_contract.md` | `docs/control/layer_10_energy_infrastructure_mvp_contract.md` (in-place edit) | in-place edit (reference fix) | Fixed a broken Layer 10 spec reference: `specs/004-layer-06-energy-infrastructure-mvp/{spec,plan,tasks}.md` → `specs/004-layer-10-energy-infrastructure-mvp/{spec,plan,tasks}.md`. The actual folder on disk is `specs/004-layer-10-energy-infrastructure-mvp/`. | The fix improves the contract; it does not break any reference. No other file in the active tree pointed to the old (broken) path. |

## Old work orders archived (completed / superseded)

The following old work orders were completed and superseded. Their outcomes are
represented by integration review records, current state, specs, control docs,
code, and audits. They are moved here for tidy active folders.

* `docs/work-orders/WO-046-ci-github-actions.md` → `docs/archive/2026-06-14-spec-kit-alignment/old-work-orders/WO-046-ci-github-actions.md`
* `docs/work-orders/WO-061-repository-safe-cleanup.md` → `docs/archive/2026-06-14-spec-kit-alignment/old-work-orders/WO-061-repository-safe-cleanup.md`
* `docs/work-orders/WO-063-MVP-LAYER-REGISTRY-CONTROL.md` → `docs/archive/2026-06-14-spec-kit-alignment/old-work-orders/WO-063-MVP-LAYER-REGISTRY-CONTROL.md`
* `docs/work-orders/WO-067-database-live-static-history-foundation-review.md` → `docs/archive/2026-06-14-spec-kit-alignment/old-work-orders/WO-067-database-live-static-history-foundation-review.md`
* `docs/work-orders/WO-069-mvp-live-source-research-and-catalog-plan.md` → `docs/archive/2026-06-14-spec-kit-alignment/old-work-orders/WO-069-mvp-live-source-research-and-catalog-plan.md`
* `docs/work-orders/WO-070-earth-events-layer-implementation-plan.md` → `docs/archive/2026-06-14-spec-kit-alignment/old-work-orders/WO-070-earth-events-layer-implementation-plan.md`
* `docs/work-orders/WO-071-earth-events-database-migration.md` → `docs/archive/2026-06-14-spec-kit-alignment/old-work-orders/WO-071-earth-events-database-migration.md`
* `docs/work-orders/WO-075-076-earth-events-closeout-and-borders-policy-plan.md` → `docs/archive/2026-06-14-spec-kit-alignment/old-work-orders/WO-075-076-earth-events-closeout-and-borders-policy-plan.md`
* `docs/work-orders/WO-076A-borders-boundaries-gate-and-source-review.md` → `docs/archive/2026-06-14-spec-kit-alignment/old-work-orders/WO-076A-borders-boundaries-gate-and-source-review.md`
* `docs/work-orders/WO-077-borders-boundaries-database-schema.md` → `docs/archive/2026-06-14-spec-kit-alignment/old-work-orders/WO-077-borders-boundaries-database-schema.md`
* `docs/work-orders/WO-078A-borders-source-license-clearance-kit.md` → `docs/archive/2026-06-14-spec-kit-alignment/old-work-orders/WO-078A-borders-source-license-clearance-kit.md`
* `docs/work-orders/WO-078A1-borders-mvp-boundary-mode-decision.md` → `docs/archive/2026-06-14-spec-kit-alignment/old-work-orders/WO-078A1-borders-mvp-boundary-mode-decision.md`
* `docs/work-orders/WO-078B-borders-natural-earth-mvp-source-selection.md` → `docs/archive/2026-06-14-spec-kit-alignment/old-work-orders/WO-078B-borders-natural-earth-mvp-source-selection.md`
* `docs/work-orders/WO-078C-borders-natural-earth-mvp-ingestion.md` → `docs/archive/2026-06-14-spec-kit-alignment/old-work-orders/WO-078C-borders-natural-earth-mvp-ingestion.md`
* `docs/work-orders/WO-078E-borders-boundaries-frontend.md` → `docs/archive/2026-06-14-spec-kit-alignment/old-work-orders/WO-078E-borders-boundaries-frontend.md`
* `docs/work-orders/WO-079A-aviation-live-source-schema-plan.md` → `docs/archive/2026-06-14-spec-kit-alignment/old-work-orders/WO-079A-aviation-live-source-schema-plan.md`

The `docs/control/BORDERS_BOUNDARIES_*` documents in the active tree still
**mention** many of these WO numbers (e.g. "WO-077", "WO-078A", "WO-078B") as
historical references to the work that produced them. Those references are to
the WO **number**, not to the WO file path, and are therefore not broken by
this cleanup.

## Documents intentionally NOT moved (deferred or risky)

The following documents are explicitly **not** moved in this pass. They are
documented in `docs/archive/2026-06-14-spec-kit-alignment/deferred-decisions/DEFERRED_DECISIONS.md`.

* `docs/control/layer_05_space_satellites_mvp_contract.md` — self-labels
  historical; needs human decision (retire / keep / convert to ADR).
* `docs/control/EARTH_EVENTS_LAYER_PLAN.md` — older planning document with
  possible references in older integration review records.
* `docs/control/AIRPORT_PUBLIC_ENRICHMENT_PIPELINE.md` — older pipeline design
  for aviation airport public enrichment; needs human decision.

The other old work orders in `docs/work-orders/` (e.g. WO-026, WO-029A,
WO-029B, WO-029C, WO-029D, WO-029G, WO-032, WO-032E, WO-035, WO-040, WO-043,
WO-047, WO-051, WO-053, WO-057) are intentionally **left in
`docs/work-orders/`** because they are still actively referenced by their
matching `INTEGRATION_REVIEW_*.md` files and the recent `HANDOFF_LOG.md`
entries. A future cleanup may revisit them.

## Documents intentionally not moved (active)

* All active control docs in `docs/control/` (the protected list).
* `docs/state/CURRENT_PROJECT_STATE.md` and `docs/state/HANDOFF_LOG.md`
  (current state and append-only log).
* All `docs/audits/*` audit evidence (the three protected audits + the two
  alignment follow-up reports that the protected alignment report was
  superseded by).
* All `docs/data/layer_01_aviation/*` reference docs (active).
* All `docs/api/*` design docs that are still active references (kept).
* All `specs/*` and active spec folders (active).
* All `docs/state/INTEGRATION_REVIEW_*.md` files (active review records).
* `AGENTS.md`, `docs/README.md`, `docs/archive/README.md`, `specs/README.md`
  (protected entry-point docs).

## Reference safety

Active doc references to candidate paths were checked before each move using
`Select-String` over the protected active set (`AGENTS.md`, `docs/README.md`,
`docs/control/*.md`, `docs/state/CURRENT_PROJECT_STATE.md`,
`docs/state/HANDOFF_LOG.md`, `specs/**/*.md`).

* The protected control docs reference WO numbers (e.g. "WO-077",
  "WO-078B") as **historical mentions of the work**, not as file paths. Those
  references are not broken by moving the WO files.
* `docs/state/HANDOFF_LOG.md` is append-only and contains two historical
  references to the old `docs/state/AVIATION_LIVE_SOURCE_DECISION.md` path.
  These references are historical handoff entries; per the documentation
  system, `APPEND_ONLY_LOG` is rewritten only by appending, not by editing
  older entries. The active path is now
  `docs/decisions/ADR-002-aviation-live-source.md`. No active file
  path-points to the old path.
* The broken `specs/004-layer-06-energy-infrastructure-mvp/` reference in
  `docs/control/layer_10_energy_infrastructure_mvp_contract.md` was the only
  known broken reference in the active tree. It is fixed in place. No other
  file pointed to the broken path.

## See also

* `docs/README.md` — the documentation map
* `docs/archive/README.md` — archive rules
* `docs/archive/2026-06-14-documentation-cleanup/INDEX.md` — the earlier
  2026-06-14 cleanup batch
* `docs/decisions/ADR-001-documentation-system.md` — the documentation
  system ADR
* `docs/state/HANDOFF_LOG.md` — append-only agent handoff timeline
