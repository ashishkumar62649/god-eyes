# docs/archive

> **Classification:** ARCHIVE
> **Last updated:** 2026-06-14

This folder is for **old, superseded, duplicate, or historical documents** that should
not guide current work. It is the destination for documentation cleanup, not a
working area for active features.

---

## Rules

- **Nothing is archived automatically.** Archiving is a deliberate decision, made on
  a dedicated documentation cleanup branch and reviewed by the Orchestrator Agent.
- **Archive moves require a dedicated documentation cleanup task.** Do not move
  documents into `docs/archive/` as part of feature work, refactor work, or any other
  task. A doc moves to `docs/archive/` only when a cleanup work order explicitly
  directs it.
- **Archived docs are historical and not active instructions.** They are kept for
  context, traceability, and review history. They do not override `docs/control/`,
  `docs/state/`, `docs/audits/`, `docs/decisions/`, or `specs/`.
- **Do not edit archived docs** to keep them current. If an archived doc contains
  information that needs to be authoritative again, the right action is to create
  a new active document in the appropriate folder (control / state / decisions /
  audit) and reference the archived doc as historical evidence.
- **Naming and structure within `docs/archive/`** are freeform, but each archived
  item should be accompanied by a brief note explaining why it was archived
  (superseded by, replaced by, or historical record of) when it is moved.

---

## Why we archive instead of deleting

- Useful history is part of the project's memory. ADRs, audit reports, and handoff
  entries often refer back to historical documents.
- Deleting documents breaks links from older review reports, handoff log entries,
  and integration reviews.
- The archive folder makes it obvious, at a glance, which documents are not active.

---

## Related documents

- `docs/README.md` — documentation map and the `ARCHIVE` classification definition
- `docs/decisions/ADR-001-documentation-system.md` — the ADR that defines this
  archive folder
- `docs/control/ENGINEERING_STRUCTURE_RULES.md` — change process for control docs
