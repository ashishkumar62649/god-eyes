# GOD EYES Documentation Map

> **Agent:** Documentation Agent
> **Lane:** Documentation
> **Last updated:** 2026-06-14

This file explains which documents are **active rules**, which are **current state**,
which are **audits / evidence**, which are **specs** (planned feature/refactor work),
which are **decisions**, and which are **archive**. It is the entry point for both
humans and agents navigating the documentation tree.

If you read only one document under `docs/`, read this one. It tells you where to read
next.

---

## 1. Human First-Read

If you are a human contributor joining the project, read these in order:

1. `docs/README.md` — this file (the documentation map)
2. `docs/state/CURRENT_PROJECT_STATE.md` — current phase, implemented layers, next steps
3. `docs/control/PROJECT_RULES.md` — the master engineering rulebook
4. `docs/control/LAYER_AND_DATA_CONTRACT.md` — authoritative layer IDs, order, status, ownership

---

## 2. Agent First-Read

If you are an agent (worker or orchestrator) starting a task, read these in order:

1. `AGENTS.md` — entry point: roles, layer registry, hard rules, workflow, git rules
2. `docs/control/PROJECT_RULES.md` — file/folder/DB/API structure rules
3. `docs/state/CURRENT_PROJECT_STATE.md` — what phase we are in, what is implemented
4. `docs/state/RECENT_CONTEXT.md` — last 3–5 session summaries (replaces full HANDOFF_LOG read)
5. The task-specific spec or work order referenced by the work order
6. `docs/control/LAYER_AND_DATA_CONTRACT.md` — layer IDs, statuses, ownership, and source contract

`docs/state/HANDOFF_LOG.md` is the full append-only project history. Do not load it in
full. Search it only when you need to investigate a specific past session or work order.

---

<<<<<<< Updated upstream
## 3. Reviewer First-Read
=======
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
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes

If you are reviewing a pull request or a branch:

1. `AGENTS.md` — roles, hard rules, workflow, git rules
2. `docs/control/PROJECT_RULES.md` — what the change should conform to
3. The changed files (the diff itself)
4. The related spec / plan / tasks document
5. `docs/state/HANDOFF_LOG.md` — what the agent reported (search or read the relevant
   entry only; do not load the full file)

---

## 4. Directory Meaning

| Directory | Type | Purpose | Who reads it | Can agents edit it? | Notes |
|---|---|---|---|---|---|
| `docs/control/` | ACTIVE_RULE | **Global constitutions, rules, policies, registries, templates, and cross-project contracts only.** Layer-specific historical plans, contracts, and gate reviews do NOT belong here. | All agents and humans | Only Orchestrator Agent (read-only for others) | Authoritative instructions. Do not modify without a change request. |
| `docs/state/` | CURRENT_STATE / APPEND_ONLY_LOG | **Current working state and append-only handoff timeline only.** Old integration reviews do NOT belong here. | All agents and humans | Orchestrator Agent owns state doc; **all agents may append** to `HANDOFF_LOG.md` | `CURRENT_PROJECT_STATE.md` is rewritten to reflect the current state. `HANDOFF_LOG.md` is append-only. |
| `docs/audits/` | AUDIT_REPORT | Active audit evidence (current health, compliance, workflow audits). Superseded audits are archived. | All agents and humans | Only Research / Documentation Agent, and only as new audit reports | Audits are evidence, not active control rules, unless a control doc explicitly adopts something from them. |
| `docs/decisions/` | DECISION_RECORD | Architecture Decision Records (ADRs) | All agents and humans | Only Orchestrator Agent (and Documentation Agent) | New ADRs are added; existing ADRs are not rewritten. |
| `docs/archive/` | ARCHIVE | Old, superseded, duplicate, or historical documents. Organized by cleanup batch and by layer/work area. | All agents and humans | Only Documentation Agent, and only through a dedicated cleanup task | Archived docs are historical and not active instructions. Nothing is archived automatically. See `docs/archive/README.md`. |
| `docs/work-orders/` | WORK_ORDER | **Active/future work orders only.** Completed work orders are archived. Use `docs/control/WORK_ORDER_TEMPLATE.md` for new work orders. | Workers and Orchestrator | Only Orchestrator Agent (read-only for workers) | See `docs/work-orders/README.md`. |
| `docs/devlog/` | DEV_LOG | Engineering/devlog notes | All agents and humans | Only authors of each entry | Historical and reference material. |
| `docs/api/` | API_REFERENCE | **Reserved for future active API documentation.** Historical API notes are archived. | All agents and humans | Read-only for most agents | See `docs/api/README.md`. Current API contracts live in code/contracts and specs. |
| `docs/postman/` | API_COLLECTION | Postman collection assets | All agents and humans | Read-only for most agents | API test/exploration collections. |
| `docs/reports/` | REPORT | Generated reports | All agents and humans | Only report authors | Generated or periodic reports. |
| `docs/data/` | DATA_REFERENCE | **Reserved for future active data documentation.** Historical data notes are archived. | All agents and humans | Read-only for most agents | See `docs/data/README.md`. Current data rules live in `docs/control/PROJECT_RULES.md`. |
| `specs/` | SPEC_WORKSPACE | Spec Kit feature/refactor work packages | Orchestrator, Planning Agent, worker agents, Reviewer | Orchestrator Agent creates spec dirs; worker agents edit their scope within the spec | Each spec dir is the source of truth for that feature. |
| `AGENTS.md` | ENTRY_POINT | Multi-agent roles, hard rules, workflow, git rules | All agents and humans | Only Orchestrator Agent | Entry point for all work. |
| `apps/`, `packages/`, `services/`, `database/`, `tests/` | CODE | Application code (out of scope of this document) | Owning agents | Owning agents per `docs/control/LAYER_AND_DATA_CONTRACT.md` | Subject to `docs/control/PROJECT_RULES.md`. |

---

## 5. Document Classification

Every document under `docs/` and `specs/` falls into exactly one classification. The
classification determines how it is read, edited, and superseded.

| Classification | Meaning | Read by | Edit rule | Example files |
|---|---|---|---|---|
| **ACTIVE_RULE** | Authoritative, current rules. Agents must follow these. | All agents and humans | Only user / decision-control layer may modify. Changes follow the rule's own change process. | `docs/control/PROJECT_RULES.md`, `docs/control/LAYER_AND_DATA_CONTRACT.md`, `docs/control/GIT_WORKFLOW_POLICY.md` |
| **CURRENT_STATE** | A snapshot of the current project state. May be rewritten in place. | All agents and humans | Only Orchestrator Agent may rewrite. | `docs/state/CURRENT_PROJECT_STATE.md` |
| **APPEND_ONLY_LOG** | A timeline that must only be appended to, never rewritten. | All agents and humans | All agents may append. Do not prepend, do not rewrite older entries. | `docs/state/HANDOFF_LOG.md` |
| **AUDIT_REPORT** | Research and audit evidence. Findings, severity, recommendations. | All agents and humans | Only Research / Documentation Agent may add a new audit report. Existing audits are not rewritten; corrections go in a new audit or a handoff log note. | `docs/audits/PROJECT_HEALTH_WORKFLOW_AUDIT.md`, `docs/audits/PROJECT_HEALTH_FINDINGS_EXPLAINED.md`, `docs/audits/ENGINEERING_STRUCTURE_COMPLIANCE_AUDIT.md` |
| **DECISION_RECORD** | Architecture Decision Record. Captures context, decision, consequences. | All agents and humans | New ADRs may be added. Existing ADRs are not rewritten; superseding decisions are a new ADR. | `docs/decisions/ADR-001-documentation-system.md` |
| **SPEC_WORKSPACE** | A folder containing a single Spec Kit feature/refactor work package. | Orchestrator, Planning Agent, worker agents, Reviewer | Orchestrator Agent creates the spec folder. Worker agents edit their lane's content within the spec's `plan.md` / `tasks.md` / `contracts/`. | `specs/008-structure-remediation-roadmap/` (active). Specs 001–007 are archived in `docs/archive/2026-06-16-implemented-specs/`. |
| **SPEC** | A `spec.md` file inside a Spec Kit spec folder. Describes the what and why of the work. | All agents | Worker agents and Orchestrator Agent may update during the spec lifecycle. | `specs/<NNN>-<feature>/spec.md` |
| **PLAN** | A `plan.md` file inside a Spec Kit spec folder. Describes the selected technical approach. | All agents | Worker agents and Orchestrator Agent may update. | `specs/<NNN>-<feature>/plan.md` |
| **TASK_LIST** | A `tasks.md` file inside a Spec Kit spec folder. Ordered implementation tasks. | All agents | Worker agents and Orchestrator Agent may update. Implementation agents must follow `tasks.md` and must not invent scope. | `specs/<NNN>-<feature>/tasks.md` |
| **REVIEW_REPORT** | An integration review record per work order or per spec. New reviews are written to `docs/state/` during active work; completed reviews are archived. | All agents | Orchestrator / Reviewer Agent writes the review. | `specs/<NNN>-<feature>/review.md` |
| **ARCHIVE** | A historical or superseded document. Not active instructions. | Optional, for context only | Only Documentation Agent may add, and only through a dedicated cleanup task. | `docs/archive/**` |

---

## 6. Rules

The following rules apply to the entire documentation system:

- **Active rules live in `docs/control/`.** Authoritative instructions belong here.
- **Current state lives in `docs/state/`.** `CURRENT_PROJECT_STATE.md` is a snapshot
  that may be rewritten; `HANDOFF_LOG.md` is append-only.
- **Audits live in `docs/audits/`.** They are evidence, not active instructions.
- **Feature/refactor specs live in `specs/`.** Each medium or large feature or refactor
  gets a dedicated spec folder under `specs/`. Implementation agents must follow
  `tasks.md` and must not invent scope.
- **Architecture decisions live in `docs/decisions/`** as ADRs. Use ADRs for important
  project-wide decisions such as documentation hierarchy, API architecture, database
  strategy, deployment strategy, or large refactor strategy.
- **Old/superseded docs go to `docs/archive/`** by dedicated cleanup only. Nothing is
  archived automatically. Historical/superseded docs are archived under
  `docs/archive/`. The 2026-06-14 documentation-cleanup batch lives in
  `docs/archive/2026-06-14-documentation-cleanup/` and is documented by its
  `INDEX.md`. The 2026-06-14 spec-kit-alignment batch lives in
  `docs/archive/2026-06-14-spec-kit-alignment/` and is documented by its
  `INDEX.md` and its deferred-decisions log. The 2026-06-14 final-docs-structure
  batch lives in `docs/archive/2026-06-14-final-docs-structure/` and is documented
  by its `INDEX.md`.
- **Do not treat audit reports as active instructions** unless a control document
  explicitly adopts something from them.
- **Do not move or archive docs during feature work.** Archiving is a dedicated
  documentation cleanup task on its own branch.
- **Do not create random docs outside the defined folders.** Every new document must
  belong to a documented directory and classification.
- **PR and merge rules live in `docs/control/GIT_WORKFLOW_POLICY.md`.** Agents do not
  push, open PRs, merge, or delete branches; the user handles all of those after the
  Reviewer Agent decision is PASS. Do not create a PR for every small local
  correction.

---

## 7. Related Documents

<<<<<<< Updated upstream
- `AGENTS.md` — multi-agent control and entry point
- `docs/control/PROJECT_RULES.md` — master engineering rulebook
- `docs/control/LAYER_AND_DATA_CONTRACT.md` — layer registry, ownership, and source/data contract
- `docs/state/CURRENT_PROJECT_STATE.md` — current phase and status
- `docs/state/HANDOFF_LOG.md` — append-only agent handoff timeline
- `docs/decisions/ADR-001-documentation-system.md` — this documentation system as an ADR
- `docs/archive/README.md` — archive rules
- `specs/README.md` — Spec Kit workspace guide
=======
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
>>>>>>> Stashed changes
