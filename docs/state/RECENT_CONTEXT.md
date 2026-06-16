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

## 2026-06-16 - Phase 4 Retire Source Control Docs

- Agent: Documentation Implementation Agent
- Branch: docs/fix/recent-context-and-reading-policy
- What changed: Replaced 8 old source control docs with pointer stubs; updated AGENTS.md and docs/README.md to use PROJECT_RULES.md + LAYER_AND_DATA_CONTRACT.md; removed "planned" qualifiers from PROJECT_RULES.md and LAYER_AND_DATA_CONTRACT.md
- Validation: 1159 data tests PASS, git diff --check PASS
- Known issues: One stale docs/work-orders comment in code (out of scope)
- Next: Reviewer Agent reviews Phase 4 before Phase 5 (specs archival)

## 2026-06-16 - Phase 5 Archive Implemented Layer Specs

- Agent: Documentation Implementation Agent
- Branch: docs/fix/recent-context-and-reading-policy
- What changed: Moved specs/001-007 to docs/archive/2026-06-16-implemented-specs/ via git mv; created INDEX.md; updated specs/README.md and docs/README.md; specs/ now contains only spec 008
- Validation: 1159 data tests PASS, git diff --check PASS
- Known issues: None
- Next: Reviewer Agent reviews Phase 5; then Phase 6 archive fence hardening

## 2026-06-16 - Phase 6 Archive Fence Hardening

- Agent: Documentation Implementation Agent
- Branch: docs/fix/recent-context-and-reading-policy
- What changed: Created docs/archive/_DO_NOT_READ.md (explicit read fence); updated docs/archive/README.md (added active-doc pointers, implemented-specs note, fence reference, fixed ESR reference)
- Validation: 1159 data tests PASS, git diff --check PASS
- Known issues: None
- Next: Reviewer Agent full final review of the entire docs/fix branch before push/PR
