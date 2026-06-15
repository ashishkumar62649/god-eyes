# Deferred Documentation Decisions — 2026-06-14

> **Agent:** Documentation Agent
> **Lane:** Documentation
> **Work order:** documentation-structure-cleanup-pass-2
> **Branch:** agent/documentation-system-spec-kit-alignment
> **Date:** 2026-06-14
> **Last updated:** 2026-06-14

This file documents documentation moves that were **deferred** during the
2026-06-14 spec-kit alignment cleanup pass. Each entry explains:

* Why the document looked archival or unclear
* Why it was **not** moved in this pass
* What human decision is needed to unblock the move

These documents are **still active at their current locations**. Do not move
them based on guesses — follow the decision rules below.

---

## 1. `docs/control/layer_05_space_satellites_mvp_contract.md`

* **Why it looked archival or unclear:** The document explicitly self-labels as
  "historical/completed" in its status note (line 3). The Lane Contract format
  predates the current `specs/<NNN>-<feature>/spec.md` + `plan.md` + `tasks.md`
  pattern, and the spec workspace has a complete
  `specs/003-layer-05-space-satellites-mvp/` folder with `SPEC_OVERVIEW.md`,
  `AGENT_INTEGRATION_SPEC.md`, `API_CONTRACT_SPEC.md`, `DATABASE_SCHEMA_SPEC.md`,
  `DATA_PIPELINE_SPEC.md`, and `FRONTEND_CESIUM_SPEC.md`.
* **Why it was not moved in this pass:** The contract document is **explicitly
  protected by the cleanup work order** ("Do not move these risky control docs
  in this task" — this file is on the protected list). Even though it is
  marked historical, the question of whether to **retire it entirely**, **convert
  it to an ADR-style historical contract**, or **leave it as a reference under
  `docs/control/`** is a human decision, not a documentation agent decision. The
  doc may also be the authoritative reference for some older integration review
  records.
* **What human decision is needed:**
  1. Retire this contract entirely (move to archive) once the
     `specs/003-layer-05-space-satellites-mvp/` content is confirmed to be the
     single source of truth.
  2. Keep the contract as a historical lane contract in `docs/control/` (current
     state).
  3. Convert the contract into a `docs/decisions/ADR-NN-space-satellites-contract.md`
     if it is a true decision record.

## 2. `docs/control/EARTH_EVENTS_LAYER_PLAN.md`

* **Why it looked archival or unclear:** The document self-describes as
  "Planning complete. Ready for implementation work orders." with a creation
  date of 2026-05-25 and an author of "Kiro CLI (WO-070)". Layer 03 Earth
  Events is now implemented (current state per `docs/state/CURRENT_PROJECT_STATE.md`).
  The "Implementation Plan" format predates the `specs/<NNN>-<feature>/`
  pattern.
* **Why it was not moved in this pass:** The plan is the only Layer 03
  planning document of its kind in the active tree. It contains detailed
  per-WO (WO-071, WO-072) task sequencing that may still be referenced by
  older `INTEGRATION_REVIEW_*.md` records and by `HANDOFF_LOG.md` entries.
  It is also on the protected list of risky control docs.
* **What human decision is needed:**
  1. Move the plan to `docs/archive/2026-06-14-spec-kit-alignment/old-work-orders/`
     or a dedicated "old-plans" subfolder once a human confirms no integration
     review still references it as the current planning source.
  2. Convert it into a `docs/decisions/ADR-NN-earth-events-plan.md` if it is a
     true decision record.
  3. Leave it active as the canonical Layer 03 planning reference (current
     state).

## 3. `docs/control/AIRPORT_PUBLIC_ENRICHMENT_PIPELINE.md`

* **Why it looked archival or unclear:** The document self-labels as
  "WO-032G — Airport Public Facts / Wikipedia-Wikidata Enrichment Design" and
  "Canonical design document for WO-032 enrichment pipeline." It predates the
  current `specs/<NNN>-<feature>/spec.md` + `plan.md` + `tasks.md` pattern and
  is scoped to a single WO number that is now historical.
* **Why it was not moved in this pass:** The doc is on the protected list of
  risky control docs. The aviation airport public profile enrichment is
  **implemented** in the current code (per `docs/state/CURRENT_PROJECT_STATE.md`
  and the `docs/data/layer_01_aviation/AIRPORT_PUBLIC_PROFILE_SCHEMA_PLAN.md`
  reference), so the doc may still be the design source of truth for that
  pipeline even if it is dated. It is also possible the doc was a pre-implementation
  design that has been fully replaced by the implementation itself.
* **What human decision is needed:**
  1. Confirm whether the implementation still follows the design in this doc.
     If yes, keep the doc active.
  2. If the doc is fully superseded by the implementation, move it to archive
     and update any older integration review record that still cites it.
  3. If the doc has design rationale worth preserving as a decision, convert
     it to a `docs/decisions/ADR-NN-airport-public-enrichment.md`.

---

## General guidance for these deferred decisions

* The risk in moving any of these is breaking a reference in an
  `INTEGRATION_REVIEW_*.md` or a `HANDOFF_LOG.md` entry that still uses the
  path as the design or planning source.
* All three of these docs are in `docs/control/`, where the engineering
  rules require Orchestrator Agent approval to modify or remove. The
  documentation agent cannot make this decision unilaterally.
* The default action is **leave active** until a human decision is made.
