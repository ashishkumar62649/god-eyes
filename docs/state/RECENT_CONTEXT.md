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

## 2026-06-16 - Documentation Context Compression Research

- Agent: Documentation Research Agent
- Branch: research/documentation-context-compression
- What changed: Created documentation-context-compression-research.md - full analysis showing HANDOFF_LOG alone costs ~150k tokens of the ~176k mandatory read burden
- Validation: 1159 data tests PASS, research-only
- Known issues: None
- Next: Documentation Planning Agent creates architecture compression plan

## 2026-06-16 - Documentation Architecture Compression Plan

- Agent: Documentation Planning Agent
- Branch: plan/documentation-architecture-compression
- What changed: Created documentation-architecture-compression-plan.md - 6-phase plan targeting ~11k token mandatory read set (down from ~176k)
- Validation: 1159 data tests PASS, planning-only
- Known issues: None
- Next: Phase 1 - create RECENT_CONTEXT.md, update reading policy

## 2026-06-16 - Phase 1 Documentation Context Reduction

- Agent: Documentation Implementation Agent
- Branch: docs/fix/recent-context-and-reading-policy
- What changed: Created RECENT_CONTEXT.md; updated reading policy in AGENTS.md, docs/README.md, ENGINEERING_STRUCTURE_RULES.md to replace mandatory HANDOFF_LOG read with RECENT_CONTEXT
- Validation: 1159 data tests PASS, git diff --check PASS
- Known issues: None
- Next: Phase 2 - create PROJECT_RULES.md consolidated engineering rulebook

## 2026-06-16 - Phase 2 Consolidated Project Rules

- Agent: Documentation Implementation Agent
- Branch: docs/fix/recent-context-and-reading-policy
- What changed: Created docs/control/PROJECT_RULES.md - consolidated rulebook merging ENGINEERING_STRUCTURE_RULES + DATA_LOCATION_RULES + PIPELINE_HANDOFF_RULES + LAYER_ID_CONVENTIONS (single Normalizer Location Rule copy; source files not yet retired)
- Validation: 1159 data tests PASS, git diff --check PASS
- Known issues: Source files not retired yet - Phase 4 responsibility
- Next: Reviewer Agent reviews PROJECT_RULES.md against source files before Phase 3
