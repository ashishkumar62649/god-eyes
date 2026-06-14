# Documentation Archive Cleanup — 2026-06-14

> **Agent:** Documentation Agent
> **Lane:** Documentation
> **Work order:** documentation-archive-cleanup
> **Branch:** agent/documentation-system-spec-kit-alignment
> **Date:** 2026-06-14
> **Last updated:** 2026-06-14

This folder is a **one-time, dated archive** created by the documentation archive
cleanup work order. It contains clearly historical, superseded, or duplicate
documents that were moved out of the active `docs/` tree so the active folders are
easier to navigate. **Nothing in this folder is an active instruction.**

## How to read this index

| Column | Meaning |
|---|---|
| **Original path** | Path in the active `docs/` tree before the cleanup |
| **Archived path** | Path inside `docs/archive/2026-06-14-documentation-cleanup/` after the cleanup |
| **Reason** | Why the document was moved out of the active tree |
| **Referenced by active docs?** | Whether the file is referenced by an active control, state, or spec document. Active references (other than historical mentions) are kept intact; this column states what was checked. |

## Archive index

| Original path | Archived path | Reason | Referenced by active docs? |
|---|---|---|---|
| `docs/devlog/2026-06-04.md` | `docs/archive/2026-06-14-documentation-cleanup/devlog/2026-06-04.md` | Old daily devlog entry. Historical record only; superseded by `docs/state/HANDOFF_LOG.md` and current project state. | No active reference. |
| `docs/postman/GOD_EYES_LOCAL_API.postman_collection.json` | `docs/archive/2026-06-14-documentation-cleanup/misc/GOD_EYES_LOCAL_API.postman_collection.json` | Stale Postman collection snapshot from a much earlier local-API baseline. Not an active API contract; the contracts module (`packages/contracts/`) and `docs/control/SOURCE_TO_FRONTEND_CONTRACT.md` are authoritative. | No active reference. |
| `docs/reports/WO-060-repository-health-audit.md` | `docs/archive/2026-06-14-documentation-cleanup/reports/WO-060-repository-health-audit.md` | Old repository-health audit from WO-060. Superseded by `docs/audits/PROJECT_HEALTH_WORKFLOW_AUDIT.md` and the recent `docs/audits/ENGINEERING_STRUCTURE_COMPLIANCE_AUDIT.md`. | No active reference. |
| `docs/reports/WO-062-god-eyes-mvp-layer-architecture-plan.md` | `docs/archive/2026-06-14-documentation-cleanup/reports/WO-062-god-eyes-mvp-layer-architecture-plan.md` | Old MVP layer architecture plan. Superseded by `docs/control/MVP_LAYER_REGISTRY.md` and `docs/control/LAYER_ARCHITECTURE.md`. | No active reference. |
| `docs/reports/WO-063-mvp-layer-registry-control-report.md` | `docs/archive/2026-06-14-documentation-cleanup/reports/WO-063-mvp-layer-registry-control-report.md` | Old registry control report. Superseded by `docs/control/MVP_LAYER_REGISTRY.md` (alignment pass on `main`, 2026-06-14). | No active reference. |
| `docs/reports/WO-067-database-live-static-history-foundation.md` | `docs/archive/2026-06-14-documentation-cleanup/reports/WO-067-database-live-static-history-foundation.md` | Old database live/static/history foundation plan. Superseded by the engineering rules in `docs/control/ENGINEERING_STRUCTURE_RULES.md` Section 12 and the live-layer migrations. | No active reference. |
| `docs/reports/WO-069-mvp-live-source-research-and-catalog-plan.md` | `docs/archive/2026-06-14-documentation-cleanup/reports/WO-069-mvp-live-source-research-and-catalog-plan.md` | Old MVP live source research/catalog plan. Superseded by `docs/control/SOURCE_TO_FRONTEND_CONTRACT.md` and the implemented source catalog. | No active reference. |
| `docs/reports/WO-070-earth-events-layer-implementation-plan.md` | `docs/archive/2026-06-14-documentation-cleanup/reports/WO-070-earth-events-layer-implementation-plan.md` | Old earth-events implementation plan. Layer 03 is now implemented; current state lives in `docs/state/CURRENT_PROJECT_STATE.md` and the Layer 03 migrations. | No active reference. |
| `docs/reports/WO-071-earth-events-database-migration.md` | `docs/archive/2026-06-14-documentation-cleanup/reports/WO-071-earth-events-database-migration.md` | Old earth-events database migration report. The actual migrations are in `database/migrations/layers/layer_03_earth_events/`. | No active reference. |
| `docs/reports/WO-075-076-earth-events-closeout-and-borders-policy-plan.md` | `docs/archive/2026-06-14-documentation-cleanup/reports/WO-075-076-earth-events-closeout-and-borders-policy-plan.md` | Old closeout plan covering earth events and borders policy. Superseded by the implemented Layer 03 and the active borders policy docs in `docs/control/`. | No active reference. |
| `docs/reports/WO-076A-borders-boundaries-gate-and-source-review.md` | `docs/archive/2026-06-14-documentation-cleanup/reports/WO-076A-borders-boundaries-gate-and-source-review.md` | Old borders gate/source review report. Superseded by `docs/control/BORDERS_BOUNDARIES_POLICY_SOURCE_PLAN.md` and the natural-earth MVP plan. | No active reference. |
| `docs/reports/WO-077-borders-boundaries-database-schema.md` | `docs/archive/2026-06-14-documentation-cleanup/reports/WO-077-borders-boundaries-database-schema.md` | Old borders database schema report. The actual schema lives in `database/migrations/layers/layer_02_borders_boundaries/`. | No active reference. |
| `docs/reports/WO-078A-borders-source-license-clearance-kit.md` | `docs/archive/2026-06-14-documentation-cleanup/reports/WO-078A-borders-source-license-clearance-kit.md` | Old borders source license clearance kit report. The active control doc is `docs/control/BORDERS_BOUNDARIES_SOURCE_LICENSE_CLEARANCE_KIT.md`. | No active reference (the active control doc still exists in `docs/control/`). |
| `docs/reports/WO-078A1-borders-mvp-boundary-mode-decision.md` | `docs/archive/2026-06-14-documentation-cleanup/reports/WO-078A1-borders-mvp-boundary-mode-decision.md` | Old borders MVP boundary mode decision report. The active control doc is `docs/control/BORDERS_BOUNDARIES_MVP_BOUNDARY_MODE_DECISION.md`. | No active reference. |
| `docs/reports/WO-078B-borders-natural-earth-mvp-source-selection.md` | `docs/archive/2026-06-14-documentation-cleanup/reports/WO-078B-borders-natural-earth-mvp-source-selection.md` | Old borders natural-earth source selection report. The active control doc is `docs/control/BORDERS_BOUNDARIES_NATURAL_EARTH_MVP_SOURCE_SELECTION.md`. | No active reference. |
| `docs/reports/WO-078C-borders-natural-earth-mvp-ingestion.md` | `docs/archive/2026-06-14-documentation-cleanup/reports/WO-078C-borders-natural-earth-mvp-ingestion.md` | Old borders natural-earth ingestion report. The actual ingestion lives in `services/fetch-orchestrator/src/layers/layer_02_borders_boundaries/`. | No active reference. |
| `docs/reports/WO-078E-borders-boundaries-frontend.md` | `docs/archive/2026-06-14-documentation-cleanup/reports/WO-078E-borders-boundaries-frontend.md` | Old borders frontend report. The actual layer implementation lives in `apps/web/src/layers/borders/`. | No active reference. |
| `docs/reports/WO-083A-energy-infrastructure-contract-report.md` | `docs/archive/2026-06-14-documentation-cleanup/reports/WO-083A-energy-infrastructure-contract-report.md` | Old energy infrastructure contract report. The active contracts live in `docs/control/layer_10_energy_infrastructure_mvp_contract.md` and `packages/contracts/`. | No active reference. |

## Documents intentionally kept active (NOT moved)

The following documents were intentionally **not** moved by this cleanup. They are
either explicitly protected by the work order or are actively referenced.

### Active rules (kept in `docs/control/`)
* `docs/control/ENGINEERING_STRUCTURE_RULES.md`
* `docs/control/MVP_LAYER_REGISTRY.md`
* `docs/control/LAYER_ARCHITECTURE.md`
* `docs/control/LAYER_ID_CONVENTIONS.md`
* `docs/control/LLM_OWNERSHIP_MATRIX.md`
* `docs/control/PIPELINE_HANDOFF_RULES.md`
* `docs/control/DATA_LOCATION_RULES.md`
* `docs/control/SOURCE_TO_FRONTEND_CONTRACT.md`
* `docs/control/GIT_WORKFLOW_POLICY.md`
* `docs/control/AIRPORT_PUBLIC_ENRICHMENT_PIPELINE.md`
* `docs/control/EARTH_EVENTS_LAYER_PLAN.md`
* `docs/control/BORDERS_BOUNDARIES_IMPLEMENTATION_GATE_REVIEW.md`
* `docs/control/BORDERS_BOUNDARIES_MVP_BOUNDARY_MODE_DECISION.md`
* `docs/control/BORDERS_BOUNDARIES_NATURAL_EARTH_MVP_SOURCE_SELECTION.md`
* `docs/control/BORDERS_BOUNDARIES_POLICY_SOURCE_PLAN.md`
* `docs/control/BORDERS_BOUNDARIES_SOURCE_LICENSE_CLEARANCE_KIT.md`
* `docs/control/BORDERS_BOUNDARIES_SOURCE_REVIEW_TRACKER.md`
* `docs/control/BORDERS_BOUNDARIES_SURVEY_OF_INDIA_REQUEST_TEMPLATE.md`
* `docs/control/layer_05_space_satellites_mvp_contract.md`
* `docs/control/layer_10_energy_infrastructure_mvp_contract.md`

These are referenced by AGENTS.md and/or other active control docs. The borders
control docs in particular are referenced by `MVP_LAYER_REGISTRY.md` and the
engineering rules.

### Active state (kept in `docs/state/`)
* `docs/state/CURRENT_PROJECT_STATE.md`
* `docs/state/HANDOFF_LOG.md`

These are explicitly protected by the work order. `HANDOFF_LOG.md` is referenced
from many older entries and is the append-only agent handoff timeline.

### Active audit evidence (kept in `docs/audits/`)
* `docs/audits/ENGINEERING_STRUCTURE_COMPLIANCE_AUDIT.md`
* `docs/audits/PROJECT_HEALTH_WORKFLOW_AUDIT.md`
* `docs/audits/PROJECT_HEALTH_FINDINGS_EXPLAINED.md`
* `docs/audits/PROJECT_ALIGNMENT_REPORT.md`
* `docs/audits/PROJECT_ALIGNMENT_FIX_REPORT.md`
* `docs/audits/PROJECT_ALIGNMENT_FIX_REVIEW.md`

These are referenced as the project's recent audit evidence. Older alignment
reports are kept in `docs/audits/` because they document the alignment pass on
`main` (2026-06-14) and are the canonical evidence for the layer-registry and
config alignment. They may be revisited in a future cleanup.

### Active spec workspace (kept in `specs/`)
* `specs/README.md`
* `specs/001-layer-zero-globe-core/spec.md`
* `specs/002-layer-one-aviation/spec.md`
* `specs/003-layer-05-space-satellites-mvp/...`
* `specs/004-layer-10-energy-infrastructure-mvp/...`
* `specs/005-layer-06-maritime-mvp/...`
* `specs/006-layer-07-weather-mvp/...`
* `specs/007-layer-08-news-osint-mvp/...`

All seven existing spec folders are active.

### Other kept files
* `docs/api/` (whole folder) — the API reference material is referenced from
  `docs/README.md` (Directory Meaning table) as a live reference category. Files
  within `docs/api/` are all current per-WO design/contract documents and are
  referenced from the corresponding integration review records. They are kept in
  `docs/api/` for now; if a future cleanup confirms they are no longer referenced,
  they may be moved here.
* `docs/data/layer_01_aviation/` — the `docs/data/layer_01_aviation/` reference
  folder is referenced from `docs/control/BORDERS_BOUNDARIES_*` and from the active
  `docs/api/` files. The actual evidence files (e.g. `OURAIRPORTS_LOCAL_VERIFICATION.md`,
  `AVIATION_DATA_QUALITY.md`, `AVIATION_QUERY_PERFORMANCE.md`, etc.) are kept
  active.
* `docs/work-orders/` — work orders for small cross-cutting repairs and
  single-lane fixes. The folder is referenced as the active pattern by `AGENTS.md`
  (lines 95–97, 115, 167), `docs/README.md` (line 62), and
  `docs/control/LLM_OWNERSHIP_MATRIX.md` (line 13). Older work orders that
  correspond to completed/superseded work remain in `docs/work-orders/` for now;
  they are explicitly listed as "historical" by `AGENTS.md` and are kept so that
  older handoff entries and integration review records can still link to them.
  A future cleanup may decide to move the very old work orders into this archive.
* `docs/state/AVIATION_LIVE_SOURCE_DECISION.md` — a recent decision record
  (2026-05-28) referenced from Layer 01 spec/contracts. Kept in `docs/state/` as a
  `CURRENT_STATE` decision.
* `docs/state/INTEGRATION_REVIEW_*.md` — all integration review records are
  `REVIEW_REPORT` documents. They are referenced by `AGENTS.md` (lines 105, 123),
  `docs/README.md` (line 90), `docs/control/GIT_WORKFLOW_POLICY.md` (lines 73, 133,
  287), and from active spec docs. They are kept active.

## Reference safety

Active doc references to candidate paths were checked before each `git mv`:

* `docs/work-orders/` references in `AGENTS.md`, `docs/README.md`,
  `docs/control/LLM_OWNERSHIP_MATRIX.md`, and `specs/003-layer-05-space-satellites-mvp/`
  are pattern-style mentions (`docs/work-orders/`, `docs/work-orders/WO-085<X>-...`)
  that point to the **folder**, not specific old work-order files. The folder is
  kept active. No reference to a specific old work-order file inside
  `docs/work-orders/` was found in the active docs.
* `docs/reports/` references in `AGENTS.md` / `docs/README.md` mention the folder
  generically. The folder would otherwise be empty after this cleanup, but the
  references in the active docs are folder-level, so they remain valid. (The
  `docs/reports/` folder is left empty by this cleanup; a future cleanup may
  remove the empty folder or move the last few historical files. We did not delete
  the folder in this task.)
* `docs/api/` and `docs/data/` references in `docs/README.md` are
  folder-level, not file-level. The active content in those folders is referenced
  indirectly from the active control docs and the integration review records, so
  we left them in place.
* `docs/state/INTEGRATION_REVIEW_*.md` and `docs/state/AVIATION_LIVE_SOURCE_DECISION.md`
  are pattern-referenced from multiple active docs (AGENTS.md, README.md, the
  Git workflow policy, and active specs). They are kept in `docs/state/`.

No active reference was broken by this cleanup. No active reference was updated
because no file moved out of `docs/state/`, `docs/control/`, `docs/audits/`, or
`specs/`, and the protected top-level files (`AGENTS.md`, `docs/README.md`,
`docs/control/*`, `docs/state/CURRENT_PROJECT_STATE.md`,
`docs/state/HANDOFF_LOG.md`, `docs/archive/README.md`, `specs/README.md`) were not
moved.

## See also

* `docs/README.md` — the documentation map and the `ARCHIVE` classification
* `docs/archive/README.md` — archive rules
* `docs/decisions/ADR-001-documentation-system.md` — the ADR that defines this
  archive folder
