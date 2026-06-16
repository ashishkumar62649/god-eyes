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
- `docs/control/PROJECT_RULES.md`
- `docs/control/LAYER_AND_DATA_CONTRACT.md`
- `docs/state/CURRENT_PROJECT_STATE.md`
- `docs/state/RECENT_CONTEXT.md`
- current task-specific specs/work orders

If an archived doc conflicts with an active doc, follow the active doc.

Do not restore archived content unless the user / decision-control layer explicitly asks.
