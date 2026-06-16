# GOD EYES Documentation Map

Classification: CURRENT_DOC_MAP
Last updated: 2026-06-16

This is the human and agent map for repository documentation. It explains what each
document area owns, what agents should read, and where new documentation belongs.

## Read This First

### Humans

1. `docs/README.md` - this map
2. `docs/state/CURRENT_PROJECT_STATE.md` - current phase, layers, API surface, and gaps
3. `AGENTS.md` - agent roles, hard rules, and workflow
4. `.specify/memory/constitution.md` - Spec Kit project principles
5. `docs/control/PROJECT_CONTROL.md` - single active project control file

### Agents

1. `AGENTS.md`
2. `.specify/memory/constitution.md`
3. `docs/control/PROJECT_CONTROL.md`
4. `docs/state/CURRENT_PROJECT_STATE.md`
5. `docs/state/RECENT_CONTEXT.md`
6. The task-specific spec or work order

Search `docs/state/HANDOFF_LOG.md` only for a specific work order or session. Do not
load the whole file as routine context.

## Spec Kit Workflow

GOD EYES follows the GitHub Spec Kit model for new layers, large features, and broad
refactors:

1. Constitution: project principles in `.specify/memory/constitution.md`
2. Specify: feature intent in `specs/<NNN>-<feature>/spec.md`
3. Clarify: open questions resolved before planning
4. Plan: approach in `plan.md`, with `research.md`, `contracts/`, `data-model.md`, and `quickstart.md` when needed
5. Tasks: ordered task breakdown in `tasks.md`
6. Analyze/checklist: consistency and quality checks before implementation
7. Implement: agents execute tasks and record validation

The templates and prompt packs under `.specify/` and `.kiro/` support this workflow.
They are tooling assets, not active GOD EYES control rules. The one exception is
`.specify/memory/constitution.md`, which is an active principles document.

## Directory Ownership

| Path | Classification | Purpose | Edit rule |
|------|----------------|---------|-----------|
| `AGENTS.md` | ENTRY_POINT | Reading policy, neutral role list, hard rules, workflow | Decided by the user / decision-control layer; read by all |
| `.specify/memory/constitution.md` | ACTIVE_PRINCIPLES | Spec Kit project principles and governance | Decided by the user / decision-control layer |
| `.specify/templates/` | TOOL_TEMPLATE | Spec Kit templates | Updated when the Spec Kit workflow itself changes |
| `.kiro/` | TOOL_PROMPT_PACK | Local prompt/tooling assets | Local tool changes only |
| `.claude/` | TOOL_ADAPTER | Local Claude Code adapter config | Local tool changes only |
| `.agents/` | TOOL_SKILLS | Local skills directory loaded by opencode and similar tools | Local tool changes only |
| `docs/control/` | ACTIVE_RULE | Single active project control file | Decided by the user / decision-control layer; read by all |
| `docs/state/CURRENT_PROJECT_STATE.md` | CURRENT_STATE | Current implementation and project phase | Updated after each completed phase or work package (see G6) |
| `docs/state/HANDOFF_LOG.md` | APPEND_ONLY_LOG | Full project history | Append-only by all contributors |
| `docs/state/RECENT_CONTEXT.md` | ROLLING_CONTEXT | Last 3-5 completed sessions | Append-only by all contributors; max 5 entries (drop oldest) |
| `docs/audits/` | AUDIT_REPORT | Evidence, findings, and recommendations | New reports added through a dedicated work order; do not rewrite old evidence casually |
| `docs/decisions/` | DECISION_RECORD | Architecture decisions (ADRs) | New ADRs added through a dedicated work order; supersede with a new ADR, never rewrite an old one |
| `docs/archive/` | ARCHIVE | Historical/superseded material | Read only; archive moves require a dedicated cleanup work order with user approval (see Archive Policy) |
| `specs/` | SPEC_WORKSPACE | Spec Kit feature/refactor packages | Created by the user / decision-control layer; updated within spec scope |
| `packages/source-catalog/` | SOURCE_REFERENCE | Source research and catalog files by layer | Owned by the fetcher track |
| `services/**/README.md` | LOCAL_REFERENCE | Service-local operating notes | Owned by the corresponding service |
| `database/**/README.md` | LOCAL_REFERENCE | Database/migration operating notes | Owned by the database track |
| `tests/**/fixtures/**/*.md` | TEST_FIXTURE | Test evidence or fixture reports | Owned by the corresponding test area |

## Active Control Document

| File | Owns |
|------|------|
| `docs/control/PROJECT_CONTROL.md` | Engineering rules, layer registry, ownership, source/data contract, Git workflow, validation checklist, and work-order template |

## Active State Documents

| File | Use |
|------|-----|
| `docs/state/CURRENT_PROJECT_STATE.md` | Current implementation and project phase |
| `docs/state/RECENT_CONTEXT.md` | Last three to five completed sessions |
| `docs/state/HANDOFF_LOG.md` | Full append-only history; search-only by default |

## Spec Workspace

Use `specs/` for new layers, large multi-agent features, and broad refactors. Current
rules are in `specs/README.md`.

Active spec:

- `specs/008-structure-remediation-roadmap/`

Archived implemented specs:

- `docs/archive/2026-06-16-implemented-specs/`

Archived placeholder and evidence docs:

- `docs/archive/2026-06-16-docs-pruned/`

New specs start at `009`.

## Archive Policy

Archived documents are historical. They may contain stale layer names, old role names,
old model/tool metadata, outdated work orders, and superseded architecture. They are
useful for evidence, but they never override active control docs.

Read `docs/archive/_DO_NOT_READ.md` before using archived files.

### When to archive (triggers)

An active file or folder must be moved into `docs/archive/` when **any** of the
following triggers fires. These are the only four valid triggers; no other reason
justifies an archive move.

| # | Trigger | Example |
|---|---------|---------|
| 1 | **Supersession** — an active rule or document supersedes an older one. The older version is moved to archive. | The single-control-file consolidation replaced `PROJECT_RULES.md`, `LAYER_AND_DATA_CONTRACT.md`, `GIT_WORKFLOW_POLICY.md`, and `WORK_ORDER_TEMPLATE.md` with one `PROJECT_CONTROL.md`. The old files (if preserved) go to archive. |
| 2 | **Completion** — a spec, work order, or large feature is fully completed and is no longer needed in the active tree. | A spec folder under `specs/009-…` is finished; its folder is moved to `docs/archive/<date>-spec-009-…/`. |
| 3 | **Cleanup** — a dedicated documentation cleanup work order is approved and historical material is being moved out of the active tree. | The 2026-06-14 documentation cleanup work order moved 97 historical files to `docs/archive/2026-06-14-documentation-cleanup/`. |
| 4 | **Retirement** — a control doc, spec, or evidence file is no longer relevant because its content has been folded into a new location. | A legacy API contract doc is replaced by `packages/contracts/` schemas and the old doc is archived. |

### How to archive (procedure)

When one of the four triggers above fires, follow these five steps in order. Do not
skip steps. Do not archive files outside this procedure.

1. **Pick or create the archive folder.** The convention is
   `docs/archive/<YYYY-MM-DD>-<topic>/`. Date is the archive date (UTC). Topic is a
   short kebab-case name (e.g. `docs/archive/2026-06-16-docs-pruned/`). If a
   matching archive folder already exists, reuse it; otherwise create it.
2. **Move the file or folder using `git mv`.** Use `git mv <source> <destination>`
   to preserve git history. Never use plain copy + delete — that loses the
   file's commit trail. Example:
   `git mv docs/control/OLD_FILE.md docs/archive/2026-06-16-docs-pruned/OLD_FILE.md`.
3. **Add or update the archive fence.** If a new top-level archive folder was
   created in step 1, add `_DO_NOT_READ.md` inside it (copy from
   `docs/archive/_DO_NOT_READ.md` and update the "Active docs are …" list to point
   to the current active control file). If an existing archive folder is reused,
   verify its fence still points to the current active control file and update
   it if not.
4. **Append a handoff entry** to `docs/state/HANDOFF_LOG.md`. The entry must
   state: (a) the trigger from the table above, (b) the source path, (c) the
   destination path, (d) the date, (e) the user who approved the move (if
   approval was required). The entry follows the standard handoff format in
   `docs/state/RECENT_CONTEXT.md`.
5. **Update `docs/README.md` and any cross-references.** If the archived file was
   listed in the "Active Control Document", "Active State Documents", "Active
   Specs", "Directory Ownership" table, or any other section of `docs/README.md`,
   remove the entry. Search the rest of the active docs (using `git grep`) for
   references to the old path and update them — except for the archived file
   itself, which is allowed to keep its old path as a stable reference. See
   the cross-file change map in the "Documentation Governance" section for
   the most common co-update requirements.

### Restore from archive (un-archive)

Archived material **must not** be moved back into the active tree on a contributor's
initiative. Restoring is a high-trust action because it implies the archived material
is once again authoritative for active work.

**When to restore:** Only when the user / decision-control layer explicitly asks for
restoration, in writing, in a work order or a discussion note. Implicit restoration
(reading an archived file and treating it as active) is **never** allowed — that
violates the active-doc rule.

**How to restore (when approved):**

1. **Confirm the approval.** The user / decision-control layer approval must be
   recorded in a handoff entry. If the approval is only verbal, write it down in
   the handoff first.
2. **Move the file back using `git mv`** to preserve history:
   `git mv <archive-path> <active-path>`. The active path is the location the file
   had before it was archived (or a new canonical path if the user specifies one).
3. **Remove the entry from the archive fence.** Update
   `docs/archive/_DO_NOT_READ.md` and the per-folder fences under
   `docs/archive/<date-topic>/` to drop the restored file from their
   "Active docs are …" lists.
4. **Re-add the file to `docs/README.md`.** Put it back into the
   "Active Control Document", "Active State Documents", "Active Specs", or
   "Directory Ownership" table as appropriate.
5. **Append a handoff entry** to `docs/state/HANDOFF_LOG.md` stating: (a) the
   approval reference, (b) the source archive path, (c) the destination active
   path, (d) the date, (e) any co-update requirements applied per the cross-file
   change map.

**What cannot be restored:** Files that were archived because their content was
folded into a new location (Trigger 4: Retirement) cannot be restored — the new
location is now the source of truth. To re-introduce the old content, create a new
ADR or update the active doc directly, do not restore the archive.

---

## Documentation Governance

This section is the single source of truth for **when** each active doc must be
updated, **who** is allowed to update it, and which other docs must be co-updated
when one doc changes. If two docs disagree about any of the rules below, this
section wins.

### When to update `docs/state/CURRENT_PROJECT_STATE.md`

Update `CURRENT_PROJECT_STATE.md` in the same change set whenever **any** of the
following happens. Each bullet is a single trigger; multiple triggers in the same
change set require a single update covering all of them.

1. A work package, spec, or phase is **completed**. The "Last Updated" line and
   the "Phase" line must reflect the new state. A short note describing the
   phase change is added under "Last Updated".
2. A new layer is added, removed, or has its status changed (`coming_soon` →
   `active`, `active` → `active (default OFF)`, etc.). The "Implemented Layers"
   or "Coming Soon Layers" table must be updated in the same commit as the layer
   registry change in `docs/control/PROJECT_CONTROL.md`.
3. The API surface changes (a new endpoint, a new WebSocket, a deprecation).
   The "API Surface (implemented)" list must reflect the change. Coordinate with
   the API ownership so the registry and the contracts package stay in sync.
4. A new capability within an existing layer is delivered (e.g. a new source
   added, a new worker, a new detail panel). The "Current Capabilities by Layer"
   section must be updated.
5. A new gap is identified or an existing gap is closed (e.g. auth implemented,
   data export added, live-worker runner shipped). The "What Does Not Exist Yet"
   section must be updated.
6. The project phase changes (e.g. "Repository Alignment In Progress" → "Layer
   Expansion Phase"). The "Phase:" line and the prose under it must be updated.

**Permission:** Updating `CURRENT_PROJECT_STATE.md` is decided by the user /
decision-control layer, typically as part of a work-package handoff. A
contributor may propose a change in `HANDOFF_LOG.md`, but the file itself is not
edited in a contributor's local commit without explicit approval.

### When to update `docs/README.md`

Update `docs/README.md` in the same change set whenever **any** of the following
happens.

1. **Folder structure changes.** A new top-level docs folder is added
   (e.g. a new `docs/runbooks/`), an existing folder is renamed, or an
   existing folder is moved. The "Directory Ownership" table must be updated in
   the same change set.
2. **New doc type or classification is introduced.** A new kind of document
   (e.g. a new `RUNBOOK` classification) is added to the project. The
   "Directory Ownership" table and the "Where New Documents Go" table must both
   be updated.
3. **Ownership of an area changes.** The owner of `apps/web/`, `services/`,
   `database/`, `packages/source-catalog/`, or any other tracked path is
   reassigned. The "Directory Ownership" table must be updated.
4. **An active doc is added to or removed from the active set.** A new ADR is
   added; an old spec is archived; a new audit is published. The "Active
   Control Document", "Active State Documents", "Active Specs", and the
   "Directory Ownership" table must reflect the change.
5. **The reading policy changes.** A new "always read" or "search-only" doc is
   added; a "task-specific read" doc is reclassified. The "Read This First"
   section must be updated to point at the new map.
6. **The Archive Policy or Documentation Governance rules change.** Any update
   to the "Archive Policy" or "Documentation Governance" sections must be made
   in `docs/README.md` itself, in the same change set as the change being
   documented (this is the dogfooding rule for this file).
7. **The "Where New Documents Go" routing table is incomplete.** A new kind of
   document is being created but no row covers it. Add a row in the same
   commit as the new document.

**Permission:** Updating `docs/README.md` is decided by the user /
decision-control layer, because this file is the documentation map and is read
at session start by every contributor. Proposed changes are recorded in
`HANDOFF_LOG.md`; the file is not edited in a contributor's local commit without
explicit approval.

### When to update `.specify/memory/constitution.md`

Update the constitution in the same change set whenever **any** of the following
happens. Every amendment requires a version bump, an entry in the constitution's
"Amendment History" section, and a handoff log entry. Use the version scheme
defined inside the constitution (MAJOR for principle or governance changes,
MINOR for authority / workflow / structure changes, PATCH for wording fixes
that do not change meaning).

1. **A principle is added, removed, or modified.** The eight principles (Layer
   Integrity, Boundary Discipline, Provenance Before Presentation, Secrets Stay
   Out, Spec-Driven Development, Testable Reviewable Work, Append-Only History,
   Human and Agent Readability) define the durable values of the project. Any
   change to their text or numbering is a MAJOR amendment.
2. **A new project-wide policy is introduced.** A new rule that applies across
   multiple lanes (frontend, API, fetcher, normalizer, database) and that is
   not already covered by an existing principle. Add it as a new principle
   (MAJOR) or as a sub-rule of an existing principle (MINOR).
3. **Authority or governance structure changes.** The set of neutral role
   names changes, the responsibilities of a role change, or the relationship
   between the user / decision-control layer and the lanes changes. This is a
   MAJOR amendment.
4. **Workflow or structure rules change.** The Spec Kit sequence changes, the
   required reading order changes, the handoff protocol changes, or the
   directory ownership model changes. This is a MINOR amendment.
5. **A wording fix is needed that does not change meaning.** A typo, an
   outdated cross-reference, or a clarification that does not alter the
   principle's intent. This is a PATCH amendment.
6. **A new ADR explicitly adopts a constitution change.** ADRs may reference
   a future or recent constitution amendment. The constitution must be
   amended in the same change set as the ADR if the ADR depends on it.

**Permission:** Amending the constitution is decided by the user /
decision-control layer. Amendments are recorded with: (a) version bump in the
header, (b) Amendment History entry inside the constitution, (c) a handoff log
entry in `docs/state/HANDOFF_LOG.md`, and (d) if the amendment is project-wide,
a new ADR in `docs/decisions/` that explains the rationale.

**Review gate:** A constitution amendment is not valid until the user /
decision-control layer has reviewed the new text, confirmed the version bump,
and confirmed that the corresponding handoff and (if needed) ADR exist. Do not
amend the constitution inside a feature branch without this review.

### Cross-file change map

When one of the docs in the left column changes, also update the docs in the
right column in the **same change set** (same branch, same commit or
same-day coordinated commits). This is the rule that prevents the kind of drift
that required the 2026-06-16 single-control-file consolidation and the
post-Phase 6 documentation cleanup.

| When this changes | Also update (in the same change set) |
|-------------------|--------------------------------------|
| `docs/control/PROJECT_CONTROL.md` Part 2 §4 (Canonical Layer Table) | `docs/state/CURRENT_PROJECT_STATE.md` (Implemented Layers + Coming Soon Layers tables); `docs/archive/_DO_NOT_READ.md` (Active docs list); the API registry at `apps/api/src/routes/layers.ts`; the frontend fallback registry at `apps/web/src/lib/useLayerRegistry.ts`; any `packages/contracts/src/layers/<layer_id>.ts` schema affected by the change |
| `docs/control/PROJECT_CONTROL.md` Part 2 §8 (Agent and Folder Ownership Matrix) | `AGENTS.md` (Agent roles table); `docs/README.md` (Directory Ownership table) |
| `docs/control/PROJECT_CONTROL.md` Part 3 (Git Workflow Policy) | `AGENTS.md` (Git Workflow summary section); any commit-message / branch-name template if introduced |
| `docs/control/PROJECT_CONTROL.md` Part 4 (Work Order Template) | `AGENTS.md` (Cycle steps) if the cycle changes; `specs/README.md` (Spec Kit Sequence) if the spec lifecycle changes |
| `AGENTS.md` (Hard Rules section body) | Should never be a body — must remain a pointer to `docs/control/PROJECT_CONTROL.md` Part 1 §3, Part 2 §8, and Part 2 §15. If a Hard Rule is being added or removed, also update those PROJECT_CONTROL.md sections. |
| `AGENTS.md` (Agent roles table) | `docs/control/PROJECT_CONTROL.md` Part 2 §8 (full ownership matrix); `docs/README.md` (Directory Ownership table) |
| `AGENTS.md` (Agent Reading Policy) | `docs/README.md` (Read This First section); the constitution (Authority section) if the entry-point structure changes |
| `docs/state/CURRENT_PROJECT_STATE.md` (Implemented Layers table) | `docs/control/PROJECT_CONTROL.md` Part 2 §4 (if layer status changed); `docs/audits/` (if a finding references the old state); a new RECENT_CONTEXT entry describing the phase change |
| `docs/state/CURRENT_PROJECT_STATE.md` (Last Updated line) | A new RECENT_CONTEXT entry summarising the change; a new HANDOFF_LOG entry describing the work |
| `.specify/memory/constitution.md` (any amendment) | Version bump in the header; Amendment History entry inside the constitution; a new ADR in `docs/decisions/` if the change is project-wide; a HANDOFF_LOG entry explaining the rationale; any cross-references in `AGENTS.md` and `docs/README.md` that point to the amended section |
| `specs/README.md` (File Roles table) | `docs/README.md` (Spec Workspace section); any active spec that uses a newly-added file role |
| `docs/audits/` (new audit added) | `docs/README.md` (Directory Ownership table mention); a HANDOFF_LOG entry; any cross-references in active docs that should now point to the new audit |
| `docs/decisions/ADR-*.md` (new ADR added) | `docs/README.md` (Directory Ownership table mention); a HANDOFF_LOG entry; any active docs whose decisions are now superseded and must point to the new ADR |
| Any archive move (per the Archive Policy procedure) | The source doc is removed from `docs/README.md` active lists (Directory Ownership + any section that listed it); `docs/archive/_DO_NOT_READ.md` and the per-folder fences are updated; a HANDOFF_LOG entry is appended |
| Any restore from archive (per the un-archive rule) | The file is re-added to `docs/README.md` active lists; archive fences are updated to drop it; a HANDOFF_LOG entry is appended |
| Any layer status change (`coming_soon` → `active`, `active` → `active (default OFF)`, etc.) | `docs/control/PROJECT_CONTROL.md` Part 2 §4; `docs/state/CURRENT_PROJECT_STATE.md`; the API registry; the frontend fallback registry; a new RECENT_CONTEXT entry |
| Any layer source addition or removal (per `PROJECT_CONTROL.md` Part 2 §14) | The source contract in `PROJECT_CONTROL.md` Part 2 §9 (Source-to-Frontend Contract); `packages/source-catalog/layers/<layer_id>/`; the fetcher code in `services/fetch-orchestrator/src/layers/<layer_id>/`; the normalizer code (colocated or in `services/normalizer/`) |
| Any ownership change (a role / area reassignment) | `docs/control/PROJECT_CONTROL.md` Part 2 §8; `AGENTS.md` (Agent roles table); `docs/README.md` (Directory Ownership table) |
| `.specify/templates/` (template changed) | `specs/README.md` (file roles) if the new template is referenced; a HANDOFF_LOG entry; no ADR needed (templates are tooling) |
| `.kiro/`, `.claude/`, `.agents/` (tooling config changed) | A HANDOFF_LOG entry if the change affects how work is done; no ADR needed (tooling is not project governance) |

## Where New Documents Go

| Need | Location |
|------|----------|
| New active rule or changed governance | `docs/control/PROJECT_CONTROL.md` |
| Current phase/status update | `docs/state/CURRENT_PROJECT_STATE.md` |
| Completed work log | `docs/state/HANDOFF_LOG.md` and `docs/state/RECENT_CONTEXT.md` |
| Research or audit evidence | `docs/audits/` |
| Architecture decision | `docs/decisions/ADR-###-topic.md` |
| Small active work order | `docs/work-orders/WO-###-topic.md` (create the folder only when needed) |
| Large feature/refactor | `specs/<NNN>-<feature>/` |
| Source research/catalog | `packages/source-catalog/layers/<layer_id>/` |
| Historical/superseded docs | `docs/archive/<date-topic>/` |

## Cleanup Rule

Do not duplicate active rules. If two active documents contain the same instruction:

1. Keep the detailed version in the document that owns that topic.
2. Replace the duplicate with a short pointer.
3. Record the change in `HANDOFF_LOG.md` and `RECENT_CONTEXT.md`.
