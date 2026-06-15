# Spec 008 — Structure Remediation Roadmap

> **Agent:** Documentation Agent
> **Lane:** Documentation / Planning
> **Branch:** `spec/structure-remediation-roadmap`
> **Status:** Planning spec only — no code changes in this branch.
> **Date:** 2026-06-15

---

## What this spec is

This is the **master remediation roadmap** for the GOD EYES codebase/file/folder
structure. It defines **how** the project will fix the grandfathered structural
inconsistencies catalogued in the
[Engineering Structure Compliance Audit](../../audits/ENGINEERING_STRUCTURE_COMPLIANCE_AUDIT.md)
and the
[Project Health Findings Explained](../../audits/PROJECT_HEALTH_FINDINGS_EXPLAINED.md)
audits, and **in what order**, behind strict safety rules.

It does not perform the remediation. It defines the work packages (tasks), the
order in which they should be tackled, the safety rules that apply to every
work package, and the reviewer gates that must pass before a work package is
merged.

---

## Why it exists

After the 2026-06-14 documentation cleanup (`dbfcf39`, `4515ab0`, `fdcfc2f`,
`66507e2`), the documentation tree is clean and aligned with the
`docs/control/` rules. The remaining structural debt is in **code, fetcher,
normalizer, and database** files.

The compliance audit (ESA-001 through ESA-030) confirmed:

* The rulebook is well-aligned with current code.
* A small number of **grandfathered** oversized files (5 large API routes, 2
  large frontend panels, 1 oversized contracts module) and **grandfathered**
  non-canonical frontend layer folder names exist.
* All other structure rules are compliant.
* The project is **structurally safe to continue** while remediation proceeds
  in dedicated work packages.

This roadmap makes that remediation **explicit, ordered, scoped, and reviewable**
so that no agent silently refactors unrelated code, no broad cleanup branch is
created, and no behaviour changes are introduced unless a work package
explicitly says so.

---

## Files in this spec folder

| File | Role |
|---|---|
| `README.md` (this file) | What this spec is, why it exists, file inventory. |
| `spec.md` | Problem statement, current pain points, target principles, non-goals, safety rules, success criteria, agent workflow, review rules. |
| `research.md` | Current findings from the repo inspection and prior audits. |
| `plan.md` | The recommended remediation order: 9 phases (Phase 0 through Phase 8). |
| `tasks.md` | The 18 ordered work packages (`SR-001` through `SR-018`) that implement the plan. |

No `contracts/` or `quickstart.md` is required because this spec introduces no
runtime behaviour, no new endpoints, and no new data shapes.

---

## Planning only

**This branch is a planning spec only.** No application code, frontend code,
API code, fetcher/normalizer code, database migration, or test code is
modified by this branch. No files are moved or renamed by this branch. No
folders are created or deleted by this branch. The only folders and files
touched are:

* `specs/008-structure-remediation-roadmap/` (new — this spec folder).
* `docs/state/HANDOFF_LOG.md` (one appended handoff entry — append only, do not
  rewrite older entries).

All actual remediation work is deferred to the **per-package branches** defined
in `tasks.md`. Each of those branches will be created later by the responsible
worker agent, reviewed by the Orchestrator Agent, and merged per the
[`docs/control/GIT_WORKFLOW_POLICY.md`](../../control/GIT_WORKFLOW_POLICY.md).

---

## Relationship to other specs and rules

* `docs/control/ENGINEERING_STRUCTURE_RULES.md` — the **master rulebook** that
  this roadmap enforces.
* `docs/control/MVP_LAYER_REGISTRY.md` — **authoritative** for layer IDs and
  statuses. All folder renames in this roadmap use these IDs.
* `docs/audits/ENGINEERING_STRUCTURE_COMPLIANCE_AUDIT.md` — the source audit
  for the issues addressed by this roadmap.
* `docs/audits/PROJECT_HEALTH_FINDINGS_EXPLAINED.md` — additional evidence
  (HEALTH-002, HEALTH-010) for specific items.
* `docs/state/CURRENT_PROJECT_STATE.md` — current project phase and
  implemented layers. All roadmap phases assume the current state on
  `main` at 2026-06-15.
* `specs/README.md` — Spec Kit workspace conventions; this spec follows them.

---

## How to use this spec

* The **Orchestrator Agent** uses `plan.md` to sequence the work packages in
  `tasks.md` against new feature work and the current project phase.
* The **responsible worker agent** (Frontend, API, Fetcher, Database, etc.)
  picks up a `SR-NNN` task by its lane. They read the matching section in
  `plan.md`, follow the acceptance criteria, and produce a local commit on
  the work-package branch.
* The **Reviewer Agent** reviews every work-package branch against the
  `plan.md` acceptance criteria, the reviewer checks, and the safety rules
  in `spec.md`.
* The **user** is the only role that pushes branches, opens PRs, merges, or
  deletes branches, per the Git workflow policy.

---

## Out of scope for this spec

* Implementation of any SR-NNN task. The work happens in subsequent branches.
* Architectural decisions on auth, deployment, or time-series storage. These
  are open questions in the compliance audit; this spec only plans the
  remediation of the structure, not the resolution of those questions.
* New layers. `layer_04_public_military_security` and `layer_09_user_shapes`
  remain `coming_soon` and are not affected by this roadmap.
* Renaming of any folder or file. No folder or file is renamed in this
  branch.
