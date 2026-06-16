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

## 2026-06-16 - SR-010 Borders Canonical Folder

- Agent: Frontend Agent
- Branch: frontend/sr-010/borders-canonical-folder
- What changed: Renamed apps/web/src/layers/borders to apps/web/src/layers/layer_02_borders_boundaries; added canonical index export; added a compatibility shim at the old borders path; updated active frontend imports.
- Validation: git grep old active imports passed (no output); git diff --check passed; pnpm --filter web build passed; pnpm --filter web test passed (64 tests).
- Known issues: tests/data pytest failed only on unrelated dirty-worktree work-order scope guards because apps/web files were dirty; expected and not blocking SR-010 frontend closeout.
- Next: User / decision-control layer pushes branch and opens a single PR for the SR-010 work package.

## 2026-06-16 - Phase 6 Archive Fence Hardening

- Agent: Orchestrator Agent
- Branch: docs/fix/recent-context-and-reading-policy
- What changed: Created docs/archive/_DO_NOT_READ.md (explicit read fence); updated docs/archive/README.md (added active-doc pointers, implemented-specs note, fence reference, fixed ESR reference)
- Validation: 1159 data tests PASS, git diff --check PASS
- Known issues: None
- Next: Orchestrator Agent full final review of the entire docs/fix branch before push/PR

## 2026-06-16 - Documentation Structure Audit

- Agent: Orchestrator Agent
- Branch: docs/fix/recent-context-and-reading-policy
- What changed: Added docs/audits/DOCUMENTATION_STRUCTURE_TERMINOLOGY_AUDIT_2026-06-16.md covering 271 tracked document files, structure drift, duplication, and terminology.
- Validation: git diff --check PASS
- Known issues: Audit found active authority drift, non-neutral role names, stale work-order template metadata, and Layer 06 source-doc identity gaps.
- Next: Orchestrator Agent should create cleanup work orders for the P1 findings before additional documentation consolidation.

## 2026-06-16 - Documentation Reorganization

- Agent: Orchestrator Agent
- Branch: docs/fix/recent-context-and-reading-policy
- What changed: Aligned active docs with Spec Kit flow; rewrote constitution/docs/spec guides; updated stale authority references; added documentation reorganization report; fixed Layer 06 source identity tables.
- Validation: git diff --check PASS; active terminology scan PASS with source-lineage/report-mapping exceptions only.
- Known issues: Historical HANDOFF_LOG/archive entries still contain old names by design; they remain search-only history.
- Next: Orchestrator Agent should review and push after validation if the branch passes.

## 2026-06-16 - Active Docs Pruned

- Agent: Orchestrator Agent
- Branch: docs/fix/recent-context-and-reading-policy
- What changed: Archived placeholder docs/api, docs/data, docs/work-orders folders and bulky Spec 008 evidence under docs/archive/2026-06-16-docs-pruned; active specs now keep only the compact spine.
- Validation: git diff --check PASS; active docs tree reduced to archive/audits/control/decisions/state plus README.
- Known issues: Historical archive/evidence paths remain search-only and may contain stale wording.
- Next: Orchestrator Agent should review the simplified docs tree before push.
