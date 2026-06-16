# Archive Read Fence

This folder is historical.

Do not read files under `docs/archive/` by default.

Use archive files only when:

- the user explicitly asks for historical context
- a task-specific work order says to inspect an archived file
- a reviewer is verifying archival integrity
- an active document points to a specific archived file as evidence

Archived files do not override active docs.

Active docs are:

- `AGENTS.md`
- `docs/control/PROJECT_CONTROL.md` (single active project control file;
  engineering rules, layer registry, ownership, source/data contract, Git workflow,
  and work-order template)
- `docs/state/CURRENT_PROJECT_STATE.md`
- `docs/state/RECENT_CONTEXT.md`
- current task-specific specs/work orders

Earlier active control filenames (`PROJECT_RULES.md`, `LAYER_AND_DATA_CONTRACT.md`,
`GIT_WORKFLOW_POLICY.md`, `WORK_ORDER_TEMPLATE.md`, `MVP_LAYER_REGISTRY.md`,
`LAYER_ID_CONVENTIONS.md`, `LAYER_ARCHITECTURE.md`, `LLM_OWNERSHIP_MATRIX.md`,
`SOURCE_TO_FRONTEND_CONTRACT.md`, `ENGINEERING_STRUCTURE_RULES.md`,
`DATA_LOCATION_RULES.md`, `PIPELINE_HANDOFF_RULES.md`) are retired and were
consolidated into `docs/control/PROJECT_CONTROL.md` on 2026-06-16. They must not be
referenced as active.

If an archived doc conflicts with an active doc, follow the active doc.

Do not restore archived content unless the user / decision-control layer explicitly asks.
