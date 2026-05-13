# Work Order Template

Copy this file to create a new work order: `docs/work-orders/WO-{NNN}-{agent}-{short-name}.md`

---

## Work Order: WO-{NNN}

**Assigned to:** [Agent name]
**Layer:** [layer_id or "cross-layer"]
**Created:** [Date]
**Status:** draft | active | complete | blocked

## Objective

[One sentence: what must be built.]

## Layer Context

- Layer ID: [e.g., layer_01_aviation]
- Relevant spec: [e.g., specs/002-layer-one-aviation/spec.md]

## Inputs

- [What this agent can read/use to do the work]

## Outputs

- [Files to create or modify]
- [Tests to pass]

## Acceptance Criteria

1. [Specific, testable condition]
2. [Specific, testable condition]

## Constraints

- Must follow rules in AGENTS.md
- Must not modify files outside ownership
- Must use layer-aware folder structure from LAYER_ID_CONVENTIONS.md
- Must update HANDOFF_LOG.md when done

## Dependencies

- [What must exist before this work can start]
