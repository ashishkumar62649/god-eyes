# Documentation Architecture Compression Plan

> **Agent:** Documentation Planning Agent
> **Branch:** plan/documentation-architecture-compression
> **Date:** 2026-06-16
> **Scope:** Planning only. No files moved, merged, deleted, or restructured.
> No code changes. No PRs.
> **Input:** `specs/008-structure-remediation-roadmap/documentation-context-compression-research.md`

---

## Scope

This plan defines the exact steps to reconstruct the `docs/` folder and its files into a
smaller, cleaner architecture that reduces mandatory agent context from ~176k tokens to a
target of ~11k tokens without losing any information. It covers folder decisions, file
consolidation, the HANDOFF_LOG / RECENT_CONTEXT dual-log strategy, specs archival, and
phase-by-phase implementation with branch names, file lists, and validation commands.

---

## Design Goals

1. Mandatory agent reads ≤ 15k tokens total (target ~11k).
2. No information lost — every rule, contract, and ID must exist in exactly one canonical
   location after consolidation.
3. Fewer files — reduce 10 control docs to 3 active ones (+ GIT_WORKFLOW_POLICY +
   WORK_ORDER_TEMPLATE which are reference-only).
4. Fewer folders — collapse empty stubs and redundant containers; target 5 active
   subfolders under `docs/` instead of 8.
5. Clear reading tiers — always / task-specific / search-only / never — written
   explicitly in AGENTS.md so every agent knows what to load.
6. HANDOFF_LOG preserved intact — full history never deleted; not mandatory to read.
7. RECENT_CONTEXT provides "last session" signal at ≤ 2KB.
8. Archive stays but is clearly fenced off — never a source of active instructions.

---

## Current Problems

| Problem | Impact |
|---------|--------|
| HANDOFF_LOG.md (603KB / ~150k tokens) listed as mandatory reading | 90%+ of all context cost |
| 10 control docs with 6 major content duplications | 25k+ tokens of overlapping rules |
| Normalizer Location Rule in 4 separate files | Agents may follow the wrong copy |
| Layer list in 4 documents | Drift risk; agents confused about canonical source |
| `docs/api/`, `docs/data/`, `docs/work-orders/` are near-empty stubs consuming folder slots | Visual noise; misleads agents about structure |
| Specs 001–007 (~487KB) are implemented-layer history sitting in the active `specs/` workspace | Agents may read them thinking they are current plans |
| "Required First Read" defined in 3 separate places | Inconsistency risk when one is updated but not the others |
| `docs/audits/` (164KB) not mandatory but visually adjacent to control docs | Agents sometimes load them thinking they are rules |

---

## Target Reading Model

### Always read (every agent, every session) — target ~11k tokens

| # | File | Est. tokens |
|---|------|-------------|
| 1 | `AGENTS.md` | ~2,300 |
| 2 | `docs/control/PROJECT_RULES.md` | ~4,000 |
| 3 | `docs/control/LAYER_AND_DATA_CONTRACT.md` | ~2,500 |
| 4 | `docs/state/CURRENT_PROJECT_STATE.md` | ~1,236 |
| 5 | `docs/state/RECENT_CONTEXT.md` | ~500 |
| **Total** | | **~10,536** |

### Task-specific read (load only for the relevant task)

| File | When to read |
|------|-------------|
| `docs/control/GIT_WORKFLOW_POLICY.md` | User/decision layer before any push/PR/review; workers when uncertain about commit format |
| `docs/control/WORK_ORDER_TEMPLATE.md` | When creating a new work order |
| `specs/008/.../tasks.md` (relevant SR-NNN section only) | Agent picking up an SR-NNN task |
| `specs/008/.../plan.md` (relevant phase section only) | Same |
| `specs/008/.../repository-skeleton.md` | Any SR-NNN implementation agent |
| `docs/decisions/ADR-*.md` | When making a relevant architectural decision |
| Active spec for the current feature | Responsible worker and reviewer for that feature |

### Search-only (never load full file into context)

| File | Access pattern |
|------|---------------|
| `docs/state/HANDOFF_LOG.md` | Search for specific session or WO history only |
| `docs/audits/**` | Search when investigating a specific health finding |
| `docs/README.md` | Read when onboarding or when the doc structure itself is in question |
| `specs/001–007/**` (after archival) | Search if original layer spec is needed |

### Never read unless explicitly instructed

| Location | Policy |
|----------|--------|
| `docs/archive/**` | Historical only. Cannot override active control docs. |



---

## Target Folder Architecture

```
E:\god-eyes\
├── AGENTS.md                              ← always read (revised)
│
├── docs/
│   ├── README.md                          ← onboarding map; not mandatory for workers
│   │
│   ├── control/                           ← ACTIVE RULES (3 live docs + 2 reference)
│   │   ├── PROJECT_RULES.md               ← always read  [NEW — consolidated]
│   │   ├── LAYER_AND_DATA_CONTRACT.md     ← always read  [NEW — consolidated]
│   │   ├── GIT_WORKFLOW_POLICY.md         ← reference (user/decision layer + workers)
│   │   ├── WORK_ORDER_TEMPLATE.md         ← task-specific (creating WOs)
│   │   └── _retired/                      ← pointer stubs for old filenames [NEW]
│   │       ├── ENGINEERING_STRUCTURE_RULES.md   (→ PROJECT_RULES.md)
│   │       ├── MVP_LAYER_REGISTRY.md            (→ LAYER_AND_DATA_CONTRACT.md)
│   │       ├── DATA_LOCATION_RULES.md           (→ PROJECT_RULES.md)
│   │       ├── LAYER_ARCHITECTURE.md            (→ LAYER_AND_DATA_CONTRACT.md)
│   │       ├── LAYER_ID_CONVENTIONS.md          (→ LAYER_AND_DATA_CONTRACT.md)
│   │       ├── LLM_OWNERSHIP_MATRIX.md          (→ LAYER_AND_DATA_CONTRACT.md)
│   │       ├── PIPELINE_HANDOFF_RULES.md        (→ PROJECT_RULES.md)
│   │       └── SOURCE_TO_FRONTEND_CONTRACT.md   (→ LAYER_AND_DATA_CONTRACT.md)
│   │
│   ├── state/                             ← CURRENT STATE + LOGS
│   │   ├── CURRENT_PROJECT_STATE.md       ← always read (keep as-is)
│   │   ├── RECENT_CONTEXT.md              ← always read  [NEW — rolling 3-5 sessions]
│   │   └── HANDOFF_LOG.md                 ← append-only; search-only; full history
│   │
│   ├── archive/                           ← HISTORY ONLY — never active instructions
│   │   ├── README.md                      ← warning + index
│   │   ├── _DO_NOT_READ.md                ← explicit agent warning  [NEW]
│   │   ├── 2026-06-14-documentation-cleanup/
│   │   ├── 2026-06-14-final-docs-structure/
│   │   └── 2026-06-14-spec-kit-alignment/
│   │
│   ├── audits/                            ← EVIDENCE — search-only
│   │   ├── ENGINEERING_STRUCTURE_COMPLIANCE_AUDIT.md
│   │   ├── PROJECT_HEALTH_FINDINGS_EXPLAINED.md
│   │   └── PROJECT_HEALTH_WORKFLOW_AUDIT.md
│   │
│   └── decisions/                         ← ADRs — reference only
│       ├── ADR-001-documentation-system.md
│       └── ADR-002-aviation-live-source.md
│
│   [REMOVED folders — merged or eliminated:]
│   ✗ docs/api/          (stub only → content folded into PROJECT_RULES.md §API, stub deleted)
│   ✗ docs/data/         (stub only → content folded into PROJECT_RULES.md §data, stub deleted)
│   ✗ docs/work-orders/  (stub only → policy in AGENTS.md; folder kept only if active WO exists)
│
├── specs/
│   ├── README.md                          ← spec workspace guide
│   └── 008-structure-remediation-roadmap/ ← ACTIVE spec
│       ├── README.md
│       ├── spec.md
│       ├── plan.md
│       ├── tasks.md
│       ├── research.md
│       ├── repository-skeleton.md
│       ├── graphify-findings.md
│       ├── api-remaining-route-review.md
│       ├── documentation-context-compression-research.md
│       └── documentation-architecture-compression-plan.md  ← this file
│
│   [Archived to docs/archive/2026-06-16-implemented-specs/:]
│   ├── 001-layer-zero-globe-core/
│   ├── 002-layer-one-aviation/
│   ├── 003-layer-05-space-satellites-mvp/
│   ├── 004-layer-10-energy-infrastructure-mvp/
│   ├── 005-layer-06-maritime-mvp/
│   ├── 006-layer-07-weather-mvp/
│   └── 007-layer-08-news-osint-mvp/
```

**Folder count: docs/ goes from 8 subfolders to 5 active subfolders.**
(`control/`, `state/`, `archive/`, `audits/`, `decisions/`).
`api/`, `data/`, `work-orders/` stubs removed (policy moves to AGENTS.md).

---

## Target Core File Set

| Target file | Purpose | Source files that feed into it | Required reader | Target size | Update policy |
|-------------|---------|-------------------------------|-----------------|-------------|---------------|
| `AGENTS.md` | Entry point: roles, hard rules, layer summary, workflow, git key rules, reading policy tiers | Current AGENTS.md + reading policy section added; git rules from LLM_OWNERSHIP_MATRIX removed (they stay in GIT_WORKFLOW_POLICY) | Every agent, every session | ≤10KB / ~2,500t | User/decision layer only; Hard Rules require a change request |
| `docs/control/PROJECT_RULES.md` | Master engineering rulebook: naming, folder structure, file-size limits, API structure, DB rules, fetcher/normalizer rules, import boundaries, refactor policy, raw path pattern, gitignore, generated folders, Normalizer Location Rule (single canonical copy) | ENGINEERING_STRUCTURE_RULES.md (all 19 sections), DATA_LOCATION_RULES.md (directory tree, gitignore, generated folders), PIPELINE_HANDOFF_RULES.md (handoff protocol, forbidden imports, data flow diagram), LAYER_ID_CONVENTIONS.md (folder convention examples per lane) | Every agent before any code-touching task | ≤18KB / ~4,500t | User/decision layer only via change request |
| `docs/control/LAYER_AND_DATA_CONTRACT.md` | Layer registry (authoritative), agent ownership matrix, source-to-frontend contract, folder conventions per lane, data flow summary | MVP_LAYER_REGISTRY.md (full registry table, status definitions, product rules, change process), LAYER_ARCHITECTURE.md (layer descriptions — keep concise), LLM_OWNERSHIP_MATRIX.md (ownership table; remove git rules section), SOURCE_TO_FRONTEND_CONTRACT.md (required fields + implemented sources table), LAYER_ID_CONVENTIONS.md (registered layer IDs table) | Every agent | ≤12KB / ~3,000t | User/decision layer only; layer status changes follow registry change process |
| `docs/control/GIT_WORKFLOW_POLICY.md` | Full Git workflow: worker/decision-layer split, commit format, pre-push checklist, branch naming, PR/merge policy, rollback | Current GIT_WORKFLOW_POLICY.md (keep as-is; only update role name from "Orchestrator Agent" to "user/decision layer" in future pass) | User/decision layer (full); workers (commit format reference) | ≤10KB / ~2,500t | User/decision layer only |
| `docs/control/WORK_ORDER_TEMPLATE.md` | Single WO template | Current WORK_ORDER_TEMPLATE.md (keep as-is) | User/decision layer when creating WOs | ≤1.5KB / ~375t | Rarely changes |
| `docs/state/CURRENT_PROJECT_STATE.md` | Current phase, implemented layers, API surface, live workers, what doesn't exist yet | Current CURRENT_PROJECT_STATE.md (keep as-is — already excellent) | Every agent | ≤6KB / ~1,500t | Rewritten in place by user/decision layer after each phase change |
| `docs/state/RECENT_CONTEXT.md` | Rolling last 3–5 session summaries; replaces mandatory HANDOFF_LOG read | Last entries extracted from HANDOFF_LOG.md | Every agent | ≤2KB / ~500t | Appended by every agent after completing work; capped at 5 entries |
| `docs/state/HANDOFF_LOG.md` | Full append-only history of every work session | All agent handoff entries (append only; never rewritten) | Search-only; never mandatory | Grows unbounded (current 603KB) | Append only; archived in batches when it exceeds ~1MB |
| `docs/archive/README.md` | Archive policy and index of batches | Current README + explicit agent warning added | Reference only | ≤3KB | Updated when new batch added |
| `docs/archive/_DO_NOT_READ.md` | Machine-readable fence warning | New file | Agents discovering archive | ≤0.5KB | Immutable |
| `specs/README.md` | Spec workspace guide | Current specs/README.md | Orchestrator, Planning Agent, worker agents | ≤6KB | Updated when spec conventions change |
| `specs/008-structure-remediation-roadmap/` | Active remediation roadmap (SR-001–SR-018) | Current 8 files in spec 008 | SR-NNN agents (task-specific files only) | ~181KB total (read only relevant sections) | Updated per SR-NNN completion |

---

## Current Folder Decisions

| Current folder | Decision | Future purpose | Reason | Risk |
|----------------|----------|----------------|--------|------|
| `docs/control/` | **Keep, reduce file count** | 3 live docs + 2 reference + `_retired/` subdirectory for pointer stubs | Heart of the rulebook. Cannot remove. Consolidating 10 files → 5 files reduces confusion. | Medium — consolidation must not drop any rule content. Reviewer gate required. |
| `docs/state/` | **Keep as-is, add RECENT_CONTEXT.md** | 3 files: CURRENT_PROJECT_STATE, RECENT_CONTEXT, HANDOFF_LOG | Perfect fit. State + rolling context + full log. | Low |
| `docs/archive/` | **Keep, add fence files** | Full historical archive; never active instructions | Cannot remove — 147 files of irreplaceable history. Add `_DO_NOT_READ.md` warning. | Low — risk is accidental reading, not data loss |
| `docs/audits/` | **Keep, enforce search-only** | Evidence docs for specific health findings | 3 files, 164KB. Not mandatory today. Need explicit policy statement in AGENTS.md. | Low |
| `docs/decisions/` | **Keep, enforce reference-only** | ADR records | 2 ADRs. Correct location. Not mandatory. | Low |
| `docs/work-orders/` | **Remove stub; policy moves to AGENTS.md** | Eliminate folder when no active WOs exist | Currently only a README stub. Work order policy belongs in AGENTS.md. If a new active WO is ever created, recreate the folder then. | Low — policy is preserved; only the empty folder is gone |
| `docs/api/` | **Remove stub** | Eliminate | 607B README stub. API contract policy is in LAYER_AND_DATA_CONTRACT.md. Nothing useful here. | None |
| `docs/data/` | **Remove stub** | Eliminate | 650B README stub. Data rules are in PROJECT_RULES.md. Nothing useful here. | None |
| `specs/001–007/` | **Archive to `docs/archive/2026-06-16-implemented-specs/`** | Historical layer specs; not active planning | All 7 layers are implemented. Specs serve no current planning purpose. ~487KB removed from active workspace. | Medium — search for cross-references first; add pointer README in archived location |
| `specs/008/` | **Keep active** | Current SR-001–SR-018 remediation roadmap | Active work in progress. Must stay in specs/. | Low |
| `docs/README.md` | **Keep, scope to onboarding only** | Human onboarding map; not agent-mandatory | Still useful for humans. Remove from agent mandatory-read list. Trim content that duplicates the reading policy in AGENTS.md. | Low |

---

## Current File Consolidation Map

| Current file | Decision | Target file or location | Notes |
|--------------|----------|------------------------|-------|
| `ENGINEERING_STRUCTURE_RULES.md` | **Primary source → PROJECT_RULES.md** | `docs/control/PROJECT_RULES.md` | All 19 sections migrate. Pointer stub remains at original path. |
| `DATA_LOCATION_RULES.md` | **Merge unique content → PROJECT_RULES.md** | `docs/control/PROJECT_RULES.md` | Unique: directory tree diagram, gitignore requirements, generated folders list. Normalizer Location Rule and raw path pattern are de-duplicated (one copy in PROJECT_RULES). Pointer stub remains. |
| `PIPELINE_HANDOFF_RULES.md` | **Merge unique content → PROJECT_RULES.md** | `docs/control/PROJECT_RULES.md` | Unique: data flow ASCII diagram, handoff protocol steps, forbidden imports list. Normalizer Location Rule de-duplicated. Pointer stub remains. |
| `LAYER_ID_CONVENTIONS.md` | **Merge into both targets** | Folder convention examples → `PROJECT_RULES.md`; layer ID table → `LAYER_AND_DATA_CONTRACT.md` | Naming pattern section and folder examples go to PROJECT_RULES. Registered IDs table goes to LAYER_AND_DATA_CONTRACT (merged with MVP_LAYER_REGISTRY). Pointer stub remains. |
| `MVP_LAYER_REGISTRY.md` | **Primary source → LAYER_AND_DATA_CONTRACT.md** | `docs/control/LAYER_AND_DATA_CONTRACT.md` | Full registry table, status definitions, product rules, change process all migrate. This remains the authoritative source — just in the new consolidated file. Pointer stub remains. |
| `LAYER_ARCHITECTURE.md` | **Merge layer descriptions → LAYER_AND_DATA_CONTRACT.md** | `docs/control/LAYER_AND_DATA_CONTRACT.md` | Layer descriptions (unique narrative per layer) merge under the registry table. Layer rules section merges. Redundant layer ID table dropped. Pointer stub remains. |
| `LLM_OWNERSHIP_MATRIX.md` | **Merge ownership table → LAYER_AND_DATA_CONTRACT.md; drop git rules section** | `docs/control/LAYER_AND_DATA_CONTRACT.md` | Ownership table and Shared Read Access section migrate. Git Rules section is already fully covered by GIT_WORKFLOW_POLICY.md — drop it (not archive, just omit as duplicate). Normalizer Location Rule de-duplicated. Pointer stub remains. |
| `SOURCE_TO_FRONTEND_CONTRACT.md` | **Merge → LAYER_AND_DATA_CONTRACT.md** | `docs/control/LAYER_AND_DATA_CONTRACT.md` | Required Fields table + Implemented Sources table + Adding a New Source steps + Layer 0 Exception all migrate. No content dropped. Pointer stub remains. |
| `GIT_WORKFLOW_POLICY.md` | **Keep as-is (reference doc)** | `docs/control/GIT_WORKFLOW_POLICY.md` | Full detail needed by user/decision layer. No content change in this task. Role name "Orchestrator Agent" → "user/decision layer" deferred to a future pass. |
| `WORK_ORDER_TEMPLATE.md` | **Keep as-is** | `docs/control/WORK_ORDER_TEMPLATE.md` | Small, task-specific. No change needed. |

**Pointer stub format** (for files in `docs/control/_retired/`):

```markdown
# [Original filename] — Retired

This document has been consolidated. All content is preserved in:

→ [target file path]

Do not edit this file. Do not use it as a reference. Read the target file above.
```



---

## Handoff + Recent Context Strategy

### Dual-log design

| File | Role | Size | Mandatory? | Update rule |
|------|------|------|------------|-------------|
| `docs/state/HANDOFF_LOG.md` | Full permanent history | Grows unbounded (603KB now) | **Never mandatory. Search-only.** | Append one full entry per work session per current Hard Rules 14–15 |
| `docs/state/RECENT_CONTEXT.md` | Rolling short summary | Capped at 5 entries / ≤2KB | **Always read** | Append one short entry per work session; drop oldest when 6th entry would be added |

### RECENT_CONTEXT.md entry template

Each entry is a fixed-width block of ≤8 lines:

```
## [Date UTC] — [Work Order or Task ID]

- Agent: [neutral role name]
- Branch: [branch name]
- Done: [one line — what was completed]
- Changed: [comma-separated list of files or folders touched]
- Next: [one line — what the next agent should do]
- Issues: [one line or "None"]
```

Example entry:

```
## 2026-06-16 — SR-006A/B True Split

- Agent: Frontend Structure Agent
- Branch: api/contracts-and-api-structure
- Done: Split DetailPanel.tsx (860→8 lines) and LayerPanel.tsx (966→8 lines) into focused sub-components
- Changed: apps/web/src/components/detail-panel/, apps/web/src/components/layer-panel/
- Next: Reviewer Agent reviews SR-006A/B split; then SR-007 Contracts Split
- Issues: None
```

### Rotation policy

- Cap: maximum 5 entries in RECENT_CONTEXT.md at any time.
- When a 6th entry is appended, the oldest (first) entry is deleted from RECENT_CONTEXT.
- Deleted entries are **not** lost — they already exist in full in HANDOFF_LOG.md.
- The file must not grow beyond 2KB. If an entry would push it over, summarise it further.

### HANDOFF_LOG.md search instructions

When an agent needs history older than the 5 most recent sessions:

1. Search HANDOFF_LOG.md with `rg "keyword"` or `Select-String "keyword"` — do not load the full file.
2. Use heading patterns: `rg "^## " docs/state/HANDOFF_LOG.md` to list all session headings.
3. Read only the matching section using line offsets.

### HANDOFF_LOG.md archiving (future — not in this plan)

When HANDOFF_LOG.md exceeds ~1MB: the user/decision layer creates a dedicated cleanup
branch, moves sessions older than 90 days to
`docs/archive/handoff-log-YYYY-MM/HANDOFF_LOG_archive.md`, and updates HANDOFF_LOG.md to
contain only recent sessions. The archive file is append-only history; it is never read by
default.

---

## Specs Strategy

| Spec | Status | Decision | Timing | Notes |
|------|--------|----------|--------|-------|
| `specs/001-layer-zero-globe-core/` | Implemented. 2 files, 5.3KB. | **Archive** | Phase 5 | Move to `docs/archive/2026-06-16-implemented-specs/` |
| `specs/002-layer-one-aviation/` | Implemented. 1 file, 3.1KB. | **Archive** | Phase 5 | Same batch |
| `specs/003-layer-05-space-satellites-mvp/` | Implemented (status label outdated). 10 files, ~162KB. | **Archive** | Phase 5 | Update status label before archiving OR note in archive INDEX.md |
| `specs/004-layer-10-energy-infrastructure-mvp/` | Implemented. 3 files, ~29KB. | **Archive** | Phase 5 | Same batch |
| `specs/005-layer-06-maritime-mvp/` | Implemented. 8 files, ~80KB. | **Archive** | Phase 5 | Same batch |
| `specs/006-layer-07-weather-mvp/` | Implemented. 9 files, ~108KB. | **Archive** | Phase 5 | Same batch |
| `specs/007-layer-08-news-osint-mvp/` | Implemented. 12 files, ~103KB. | **Archive** | Phase 5 | Same batch |
| `specs/008-structure-remediation-roadmap/` | Active — SR-001–SR-018 in progress. | **Keep** | Until all SR tasks complete | Move to archive only after all 18 work packages are merged |
| `specs/README.md` | Active workspace guide. | **Keep** | — | Update to remove references to 001–007 after Phase 5 |

**Before archiving any spec:**
1. Run `rg "specs/00[1-7]" docs/ AGENTS.md` to find all cross-references.
2. For each reference: update it to point to `docs/archive/2026-06-16-implemented-specs/<spec-dir>/` or replace with a note "implemented; see CURRENT_PROJECT_STATE.md."
3. Add `docs/archive/2026-06-16-implemented-specs/INDEX.md` describing all 7 archived specs.

---

## Archive / Audit / Decision / Work-Order Strategy

### Archive (`docs/archive/`)

- Keep all 3 existing batch subdirectories exactly as-is. Do not reorganise their contents.
- Add `docs/archive/_DO_NOT_READ.md` with the text:
  > This directory contains historical and superseded documents only. Nothing here is an
  > active instruction. Do not read these files unless the user/decision layer explicitly
  > asks you to consult a specific archived document. If an archived doc appears to
  > contradict an active control doc, the active control doc wins.
- Update `docs/archive/README.md` to add this same warning at the top.
- When new batches are added (e.g., implemented-specs archival), add the batch to the README index.

### Audits (`docs/audits/`)

- Keep all 3 audit files. They are irreplaceable evidence for HEALTH-001 through HEALTH-012.
- Add to AGENTS.md reading policy: "Audit reports in `docs/audits/` are evidence only.
  Do not treat them as active instructions unless a control doc explicitly adopts a finding."
- No README needed in audits/ — the files are self-describing.
- When an audit is superseded by a new audit covering the same area, move the old one to
  `docs/archive/` with a note in the archive INDEX.

### Decisions (`docs/decisions/`)

- Keep both ADRs. Not mandatory for workers.
- Add to AGENTS.md reading policy: "ADRs in `docs/decisions/` are read only when making
  an architectural decision in the relevant area."
- When a new ADR is added, also update docs/README.md §7.

### Work orders (`docs/work-orders/`)

- The folder currently has only a README stub (646B).
- **Remove the folder as part of Phase 4.** The policy ("small cross-cutting repairs → WO
  file; large features → spec folder") moves into AGENTS.md §Workflow.
- If a new active work order is created in the future, recreate `docs/work-orders/` at
  that time. It is not useful as a permanent empty container.

---

## Implementation Phases

| Phase | Branch | Goal | Files touched | Risk | Validation | Reviewer focus |
|-------|--------|------|---------------|------|------------|----------------|
| **1** | `docs/fix/recent-context-and-reading-policy` | Create RECENT_CONTEXT.md; update mandatory reading lists to remove HANDOFF_LOG; add reading policy to AGENTS.md | `docs/state/RECENT_CONTEXT.md` (new), `AGENTS.md` (revised), `docs/README.md` (revised §2), `docs/control/ENGINEERING_STRUCTURE_RULES.md` (revised §2), `docs/state/HANDOFF_LOG.md` (entry appended) | **Low-medium.** AGENTS.md is a sensitive file — changes must be minimal and precise. | `git diff --check`; `python -m pytest tests/data -q`; verify HANDOFF_LOG is append-only; verify RECENT_CONTEXT has ≤5 entries | Confirm HANDOFF_LOG removed from mandatory list in all 3 places; confirm reading tiers match plan; confirm no rule content changed in AGENTS.md |
| **2** | `docs/consolidate/project-rules` | Write `PROJECT_RULES.md` by merging ESR + DATA_LOCATION + PIPELINE_HANDOFF + LAYER_ID folder conventions | `docs/control/PROJECT_RULES.md` (new), `docs/state/HANDOFF_LOG.md` (entry appended) | **Medium.** Must not drop any rule. | `git diff --check`; `python -m pytest tests/data -q`; manual cross-check each source section against new file | Line-by-line compare: every rule from ESR, DATA_LOCATION, PIPELINE_HANDOFF appears in PROJECT_RULES with identical meaning |
| **3** | `docs/consolidate/layer-and-data-contract` | Write `LAYER_AND_DATA_CONTRACT.md` by merging MVP_LAYER_REGISTRY + LAYER_ARCHITECTURE + LLM_OWNERSHIP_MATRIX + SOURCE_TO_FRONTEND + LAYER_ID layer table | `docs/control/LAYER_AND_DATA_CONTRACT.md` (new), `docs/state/HANDOFF_LOG.md` (entry appended) | **Medium.** Layer registry is safety-critical — must not alter any layer ID, status, or product rule. | `git diff --check`; verify all 11 layer IDs present with correct statuses; verify ownership table complete; verify source contract fields table complete | Registry table must match MVP_LAYER_REGISTRY exactly; ownership table must match LLM_OWNERSHIP_MATRIX ownership section exactly |
| **4** | `docs/retire/old-control-stubs` | Move old control docs to `docs/control/_retired/`; create pointer stubs; remove empty `docs/api/`, `docs/data/`, `docs/work-orders/` stubs; update AGENTS.md §Key Documents | `docs/control/_retired/**` (8 pointer stubs), `AGENTS.md` §Key Documents (updated), `docs/api/` (deleted), `docs/data/` (deleted), `docs/work-orders/` (deleted), `docs/state/HANDOFF_LOG.md` (entry appended) | **Medium.** Deleting `docs/api/`, `docs/data/`, `docs/work-orders/` removes folders from git — must confirm no code references them. | `rg "docs/api|docs/data|docs/work-orders" apps/ services/ packages/ database/` must return 0 results before deletion; `git diff --check`; `python -m pytest tests/data -q` | Confirm pointer stubs exist for all 8 retired files; confirm no broken references in active docs; confirm deleted folders had no non-stub content |
| **5** | `docs/archive/implemented-specs-001-007` | Move specs 001–007 to `docs/archive/2026-06-16-implemented-specs/`; add archive INDEX.md; update specs/README.md cross-references | `docs/archive/2026-06-16-implemented-specs/**` (7 spec dirs moved), `docs/archive/2026-06-16-implemented-specs/INDEX.md` (new), `specs/README.md` (updated), `AGENTS.md` §Key Documents (remove specs/001–007 refs if any), `docs/state/HANDOFF_LOG.md` (entry appended) | **Low.** Historical content only. | `rg "specs/00[1-7]" docs/ AGENTS.md` must return 0 results after update; `git diff --check`; `python -m pytest tests/data -q` | Confirm INDEX.md covers all 7 archived specs; confirm no remaining cross-refs to moved paths; confirm specs/README.md no longer points to 001–007 |
| **6** | `docs/harden/archive-fence` | Add `docs/archive/_DO_NOT_READ.md`; update `docs/archive/README.md` with agent warning; add audits/decisions reading-policy statements to AGENTS.md | `docs/archive/_DO_NOT_READ.md` (new), `docs/archive/README.md` (updated), `AGENTS.md` reading-policy section (updated), `docs/state/HANDOFF_LOG.md` (entry appended) | **Low.** No content moves; only policy text added. | `git diff --check`; `python -m pytest tests/data -q` | Confirm warning text is present and unambiguous; confirm AGENTS.md reading-policy section covers all 4 tiers |

**Phase order rationale:**
- Phase 1 first: immediate 90% context reduction with minimal risk.
- Phases 2–3 before Phase 4: create the consolidation targets before retiring the sources.
- Phase 4 before Phase 5: clean up the control folder before archiving specs (keeps the review surface small).
- Phase 6 last: fence hardening after all structural changes are stable.
- Each phase is one PR. No two phases combine in a single branch.

---

## First Implementation Task

**Phase 1: Create RECENT_CONTEXT.md and update mandatory reading lists.**

- Branch: `docs/fix/recent-context-and-reading-policy`
- Scope:
  1. Create `docs/state/RECENT_CONTEXT.md` with the last 3 sessions extracted from
     HANDOFF_LOG.md (one short entry per session using the template above).
  2. Edit `AGENTS.md` §Hard Rules: add Rule 16 (or amend Rule 14) to require every
     agent to append a RECENT_CONTEXT.md short entry after completing work, capped at 5
     entries.
  3. Edit `AGENTS.md` §Agent First-Read: replace HANDOFF_LOG.md item with
     RECENT_CONTEXT.md.
  4. Edit `AGENTS.md`: add an explicit `## Agent Reading Policy` section with the four
     tiers (always / task-specific / search-only / never).
  5. Edit `docs/README.md` §2: replace HANDOFF_LOG.md item with RECENT_CONTEXT.md.
  6. Edit `docs/control/ENGINEERING_STRUCTURE_RULES.md` §2: replace HANDOFF_LOG.md item
     with RECENT_CONTEXT.md.
  7. Append handoff entry to HANDOFF_LOG.md.
- Why first: removes ~150k tokens from mandatory context in a single small PR. Low risk.
  AGENTS.md and ENGINEERING_STRUCTURE_RULES.md changes are minimal (1–3 lines each).
- Estimated token reduction: from ~176k mandatory → ~17k mandatory (before Phase 2–3
  consolidation).

---

## Risks and Rollback

| Risk | Severity | Mitigation | Rollback |
|------|----------|-----------|----------|
| PROJECT_RULES.md drops a rule during consolidation | High | Reviewer does line-by-line comparison against source files before any source is retired | Revert the consolidation commit; source files are still in `_retired/` as pointer stubs pointing back |
| LAYER_AND_DATA_CONTRACT.md alters a layer ID or status | High | Registry table must be copied verbatim from MVP_LAYER_REGISTRY.md; reviewer verifies all 11 rows | Revert; source files not deleted |
| Pointer stubs cause confusion — agents read them as active rules | Medium | Pointer stubs go in `_retired/` subfolder; AGENTS.md explicitly says `_retired/` is not active | Add a `_RETIRED_README.md` to `_retired/` clarifying they are pointers only |
| Deleting `docs/api/`, `docs/data/`, `docs/work-orders/` breaks code references | Medium | Pre-deletion search: `rg "docs/api|docs/data|docs/work-orders" apps/ services/ packages/` must return 0 | Revert deletion commit; folders are tiny and easy to restore |
| RECENT_CONTEXT.md becomes stale | Medium | Rule in AGENTS.md; user/decision layer monitors | Update manually; the rule is clear |
| Specs 001–007 move breaks cross-references | Medium | Search all active docs for `specs/00[1-7]` before moving | Revert the archive commit; specs move is low-risk content-wise |
| HANDOFF_LOG.md grows unbounded | Low (now) | Plan for periodic archiving when it hits ~1MB; not needed yet | N/A |

---

## What Not to Do

1. **Do not delete any document.** Move to `_retired/` (control docs) or archive (specs).
   Deletion is permanent and irreversible. Pointer stubs preserve discoverability.

2. **Do not edit HANDOFF_LOG.md history.** It is append-only. Do not rewrite, summarise,
   or delete existing entries. RECENT_CONTEXT.md is the summary layer; HANDOFF_LOG is the
   immutable record.

3. **Do not combine Phase 2 and Phase 3 into one branch.** PROJECT_RULES.md and
   LAYER_AND_DATA_CONTRACT.md are independent consolidation targets. Separate PRs keep
   the review surface small and rollback clean.

4. **Do not move docs while doing feature work or code work.** Documentation restructure
   is its own branch series. Never mix with SR-NNN code fixes.

5. **Do not retire source files before their consolidation target is reviewed.** Pointer
   stubs must not be placed until the reviewer has confirmed the target file is complete.

6. **Do not add new subfolders to solve the "too many folders" problem.** Adding
   `docs/reference/` or `docs/core/` just shifts the clutter. Remove the empty stubs
   instead.

7. **Do not update AGENTS.md §Key Documents for retired files until Phase 4.** The key
   documents list should point to active files. Update it in Phase 4 when the retired stubs
   are placed and the consolidated files are live.

8. **Do not let the Normalizer Location Rule exist in more than one active file after
   Phase 2.** The canonical copy is in PROJECT_RULES.md. All other mentions in active docs
   must become cross-references (link + one-line summary), not full re-statements.

9. **Do not archive specs 001–007 while any SR-NNN task references them.** Run the
   cross-reference search first.

10. **Do not use the term "Orchestrator Agent" in new content.** Use "user/decision layer"
    or "decision-control layer." The existing docs still use "Orchestrator Agent" — that is
    fine to leave until an explicit role-name cleanup pass. Do not introduce it in new docs.

---

## Commands Run

```powershell
git checkout -b plan/documentation-architecture-compression
git status --short --branch
git log --oneline --decorate -n 15
Get-ChildItem docs/control -File | Select-Object Name,Length
Get-ChildItem docs/state -File | Select-Object Name,Length
Get-ChildItem docs/audits -File | Select-Object Name,Length
Get-ChildItem docs/decisions -File | Select-Object Name,Length
Get-ChildItem docs/work-orders -File | Select-Object Name,Length
Get-ChildItem docs/api -File | Select-Object Name,Length
Get-ChildItem docs/data -File | Select-Object Name,Length
Get-Content docs/state/HANDOFF_LOG.md -Tail 250
Select-String "^##" specs/008-structure-remediation-roadmap/documentation-context-compression-research.md
Get-Content docs/control/LLM_OWNERSHIP_MATRIX.md
Get-Content docs/control/PIPELINE_HANDOFF_RULES.md
Get-Content docs/control/LAYER_ARCHITECTURE.md
Get-Content docs/control/LAYER_ID_CONVENTIONS.md
Get-Content docs/control/DATA_LOCATION_RULES.md
Get-Content docs/control/SOURCE_TO_FRONTEND_CONTRACT.md
rg "ENGINEERING_STRUCTURE_RULES|MVP_LAYER_REGISTRY|..." AGENTS.md docs/README.md -c
rg "HANDOFF_LOG|RECENT_CONTEXT|..." AGENTS.md docs/README.md docs/control/ -c
rg "Orchestrator Agent" AGENTS.md docs/control/ -c
rg "Normalizer Location Rule|raw/<layer_id>" docs/control/ -c
rg "layer_00|layer_01|..." docs/control/ -c
rg "docs/control|docs/state|..." AGENTS.md -c
```

---

## Validation

Run after each phase commit:

```powershell
git status --short --branch
git diff --name-status
git diff --check
python -m pytest tests/data -q
```

Expected changed files for this planning task:

- `specs/008-structure-remediation-roadmap/documentation-architecture-compression-plan.md` (new)
- `docs/state/HANDOFF_LOG.md` (entry appended)

If any other file changes, stop and explain before committing.