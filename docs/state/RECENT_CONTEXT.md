# Recent Context

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

## 2026-06-16 - Phase 1 Documentation Context Reduction

- Agent: Documentation Implementation Agent
- Branch: docs/fix/recent-context-and-reading-policy
- What changed: Created RECENT_CONTEXT.md; updated reading policy in AGENTS.md, docs/README.md, ENGINEERING_STRUCTURE_RULES.md to replace mandatory HANDOFF_LOG read with RECENT_CONTEXT
- Validation: 1159 data tests PASS, git diff --check PASS
- Known issues: None
- Next: Phase 2 - create PROJECT_RULES.md consolidated engineering rulebook

## 2026-06-16 - Phase 2 Required Fix: Complete Project Rules Consolidation

- Agent: Documentation Implementation Agent
- Branch: docs/fix/recent-context-and-reading-policy
- What changed: Created docs/control/PROJECT_RULES.md (21 sections); added Time-Series/Live-Data, API Transport, Background Worker, and Exceptions/Grandfathering; fixed LAYER_AND_DATA_CONTRACT.md references
- Validation: 1159 data tests PASS, git diff --check PASS
- Known issues: None; source files not yet retired (Phase 4)
- Next: Phase 3 - create LAYER_AND_DATA_CONTRACT.md

## 2026-06-16 - Phase 3 Review: Layer and Data Contract

- Agent: Reviewer Agent
- Branch: docs/fix/recent-context-and-reading-policy
- What changed: Completed review of LAYER_AND_DATA_CONTRACT.md (294 lines, 15KB) against all 4 source docs. Verified all 11 layer IDs/statuses, ownership matrix, source contract fields, source families, change protocols. All commands PASS.
- Validation: 1159 data tests PASS, git diff --check PASS, Select-String keyword checks PASS
- Known issues: None. Source files not retired yet (Phase 4). Mandatory reading lists not yet updated (Phase 6).
- Next: Phase 4 - retire old source control docs with in-place pointer stubs

## 2026-06-16 - Phase 4 Retire Source Control Docs

- Agent: Documentation Implementation Agent
- Branch: docs/fix/recent-context-and-reading-policy
- What changed: Replaced 8 old source control docs with pointer stubs; updated AGENTS.md and docs/README.md to use PROJECT_RULES.md + LAYER_AND_DATA_CONTRACT.md; removed "planned" qualifiers from PROJECT_RULES.md and LAYER_AND_DATA_CONTRACT.md
- Validation: 1159 data tests PASS, git diff --check PASS
- Known issues: One stale docs/work-orders comment in code (out of scope)
- Next: Reviewer Agent reviews Phase 4 before Phase 5 (specs archival)
