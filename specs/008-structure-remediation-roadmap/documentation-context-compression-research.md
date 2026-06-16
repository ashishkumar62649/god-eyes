# Documentation Context Compression Research

> **Agent:** Documentation Research Agent
> **Branch:** research/documentation-context-compression
> **Date:** 2026-06-16
> **Scope:** Research and discovery only. No files moved, renamed, merged, deleted, or
> restructured. No code changes. No PRs.

---

## Scope

This document analyses all documentation and spec folders in the GOD EYES repository to
design a smaller, cleaner, LLM-friendly documentation architecture. The goal is to reduce
mandatory agent context from the current ~163–176k tokens down to a target of 8k–15k
without losing any information.

---

## Problem Statement

Worker agents are currently instructed to read the following before any task begins
(from `docs/README.md` §2 and `ENGINEERING_STRUCTURE_RULES.md` §2):

1. `AGENTS.md`
2. `docs/control/ENGINEERING_STRUCTURE_RULES.md`
3. `docs/state/CURRENT_PROJECT_STATE.md`
4. `docs/state/HANDOFF_LOG.md`
5. `docs/README.md`
6. `docs/control/MVP_LAYER_REGISTRY.md`
7. Task-specific spec or work order

Items 1–6 alone total **~176,192 tokens** because `HANDOFF_LOG.md` is a 600 KB
append-only log of 29 work sessions (6,949 lines). A worker agent reading that before
every task consumes roughly 150k tokens of context on history it does not need.

Even without the handoff log, the required reads total **~25,991 tokens** — approaching
the practical limit for leaving context headroom for actual work. The 10 control docs in
`docs/control/` add another **~23,479 tokens** if all are read as implied by several
cross-references.

The project is also accumulating structural debt: 9 separate control docs contain
significant rule duplication (the Normalizer Location Rule appears in 4 of them), three
audit reports in `docs/audits/` total ~164k bytes / ~41k tokens but are not mandatory,
and specs 001–007 are all implemented layers whose spec files serve no active planning
purpose.

**Core problem:** The documentation system was designed for a single human reading a
folder tree. It was not designed for repeated LLM context loading. The result is a
~176k-token "required" reading list that leaves little room for actual work.

---

## Current Folder Inventory

### docs/ top-level subdirectories

| Folder | Type | Contents | Status | Recommendation |
|--------|------|----------|--------|----------------|
| `docs/control/` | ACTIVE_RULE | 10 files (9 rule docs + template). 29–3KB each. | Active | Keep. Consolidate into fewer files. |
| `docs/state/` | CURRENT_STATE / LOG | 2 files: `CURRENT_PROJECT_STATE.md` (4.9KB) + `HANDOFF_LOG.md` (600KB). | Active | Keep both. Change reading policy for log. |
| `docs/audits/` | AUDIT_REPORT | 3 files: ESC audit 80KB, health findings 50KB, workflow audit 33KB. | Active evidence | Keep. Remove from mandatory reads. |
| `docs/decisions/` | DECISION_RECORD | 2 ADRs: 7.6KB + 6.2KB. | Active | Keep. Not mandatory for workers. |
| `docs/archive/` | ARCHIVE | 147 files across 3 dated batch subdirs (~2026-06-14). | Historical | Keep. Enforce strict "do not read unless asked" policy. |
| `docs/work-orders/` | WORK_ORDER | 1 file: `README.md` (646B, empty). No active work orders. | Empty | Keep stub. Clarify policy: active WOs go here; completed go to archive. |
| `docs/api/` | API_REFERENCE | 1 file: `README.md` (607B). Reserved. | Empty stub | Keep stub. |
| `docs/data/` | DATA_REFERENCE | 1 file: `README.md` (650B). Reserved. | Empty stub | Keep stub. |
| `docs/README.md` | MAP | 11.9KB documentation map. | Active | Keep. Reduce to index/policy only; strip duplicated rule content. |

### docs/archive/ subdirectories (all historical)

| Batch | Files | Size range | Risk of accidental reading |
|-------|-------|-----------|---------------------------|
| `2026-06-14-documentation-cleanup/` | ~20 files | 215B–39KB | Medium — no index prominently warning agents |
| `2026-06-14-final-docs-structure/` | ~110 files | 2KB–74KB | High — very large; many files look like active docs by name |
| `2026-06-14-spec-kit-alignment/` | ~17 files | 800B–26KB | Medium |

### specs/ subdirectories

| Spec | Layer | Status per CURRENT_PROJECT_STATE | Active for agents? |
|------|-------|----------------------------------|--------------------|
| `001-layer-zero-globe-core/` | Globe Core | Implemented (active) | No — 2 files, 5.3KB total. Historical only. |
| `002-layer-one-aviation/` | Aviation | Implemented (active) | No — 1 file, 3.1KB. Historical only. |
| `003-layer-05-space-satellites-mvp/` | Space & Satellites | Implemented (active) | No — "Spec complete, not implemented" is outdated. 10 files, ~162KB. Historical. |
| `004-layer-10-energy-infrastructure-mvp/` | Energy Infrastructure | Implemented (active) | No — 3 files, ~29KB. Historical. |
| `005-layer-06-maritime-mvp/` | Maritime | Implemented (active) | No — 8 files, ~80KB. Historical. |
| `006-layer-07-weather-mvp/` | Weather | Implemented (active) | No — 9 files, ~108KB. Historical. |
| `007-layer-08-news-osint-mvp/` | News & OSINT | Implemented (active) | No — 12 files, ~103KB. Historical. |
| `008-structure-remediation-roadmap/` | Code structure | Active — SR-001 through SR-018 in progress | YES — 7 files, ~181KB. Worker-required for SR-NNN tasks only. |

---

## Current Mandatory Reading Burden

### As prescribed by `docs/README.md` §2 (Agent First-Read) and `ENGINEERING_STRUCTURE_RULES.md` §2

| File | Bytes | Est. tokens | Mandatory? | Notes |
|------|-------|-------------|------------|-------|
| `AGENTS.md` | 9,200 | ~2,300 | Yes | Entry point. Layer table, rules, workflow. |
| `docs/control/ENGINEERING_STRUCTURE_RULES.md` | 29,085 | ~7,271 | Yes | Master rulebook (19 sections). |
| `docs/state/CURRENT_PROJECT_STATE.md` | 4,942 | ~1,236 | Yes | Phase, layers, API surface. Excellent. |
| `docs/state/HANDOFF_LOG.md` | 600,804 | **~150,201** | Listed as mandatory | **Root cause of the problem.** 6,949 lines, 29 sessions. |
| `docs/README.md` | 11,905 | ~2,976 | Yes | Documentation map. Partially duplicates AGENTS.md. |
| `docs/control/MVP_LAYER_REGISTRY.md` | 11,444 | ~2,861 | Yes | Layer IDs, status, order. |
| **Subtotal (without log)** | | **~16,644** | | Well within target if log removed. |
| **Subtotal (with log)** | | **~166,845** | | ~11× over target. |

### Additional implied reads (cross-referenced in control docs)

| File | Bytes | Est. tokens | Currently implied? |
|------|-------|-------------|-------------------|
| `docs/control/GIT_WORKFLOW_POLICY.md` | 9,729 | ~2,432 | Yes (AGENTS.md links it) |
| `docs/control/DATA_LOCATION_RULES.md` | 6,398 | ~1,600 | Implied for Fetcher/Normalizer/DB agents |
| `docs/control/LAYER_ARCHITECTURE.md` | 6,188 | ~1,547 | Implied — duplicates MVP_LAYER_REGISTRY content |
| `docs/control/SOURCE_TO_FRONTEND_CONTRACT.md` | 4,527 | ~1,132 | Implied for API/Frontend agents |
| `docs/control/LLM_OWNERSHIP_MATRIX.md` | 4,056 | ~1,014 | Implied for all — ownership table |
| `docs/control/PIPELINE_HANDOFF_RULES.md` | 3,410 | ~852 | Implied for Fetcher/Normalizer/DB/API agents |
| `docs/control/LAYER_ID_CONVENTIONS.md` | 3,081 | ~770 | Implied — duplicates MVP_LAYER_REGISTRY folders |
| **Subtotal all control docs** | | **~23,479** | |
| **Grand total all current mandatory** | | **~176,192** | ~12× target |

---

## Largest Context-Cost Files (Top 20 by token estimate)

| Rank | File | Bytes | Est. tokens | Category |
|------|------|-------|-------------|----------|
| 1 | `docs/state/HANDOFF_LOG.md` | 600,804 | ~150,201 | State / log |
| 2 | `docs/audits/ENGINEERING_STRUCTURE_COMPLIANCE_AUDIT.md` | 80,307 | ~20,077 | Audit |
| 3 | `docs/archive/.../PROJECT_ALIGNMENT_REPORT.md` | 74,855 | ~18,714 | Archive |
| 4 | `docs/audits/PROJECT_HEALTH_FINDINGS_EXPLAINED.md` | 50,700 | ~12,675 | Audit |
| 5 | `docs/audits/PROJECT_HEALTH_WORKFLOW_AUDIT.md` | 33,484 | ~8,371 | Audit |
| 6 | `docs/control/ENGINEERING_STRUCTURE_RULES.md` | 29,085 | ~7,271 | Control — mandatory |
| 7 | `specs/008/.../repository-skeleton.md` | 36,814 | ~9,204 | Spec 008 — task-specific |
| 8 | `specs/008/.../tasks.md` | 34,211 | ~8,553 | Spec 008 — task-specific |
| 9 | `specs/008/.../plan.md` | 32,720 | ~8,180 | Spec 008 — task-specific |
| 10 | `specs/008/.../research.md` | 25,882 | ~6,471 | Spec 008 — task-specific |
| 11 | `specs/007/.../WORK_ORDERS.md` | 22,717 | ~5,679 | Historical spec |
| 12 | `specs/003/.../SPEC_OVERVIEW.md` | 22,532 | ~5,633 | Historical spec |
| 13 | `specs/004/.../spec.md` | 21,287 | ~5,322 | Historical spec |
| 14 | `docs/control/MVP_LAYER_REGISTRY.md` | 11,444 | ~2,861 | Control — mandatory |
| 15 | `docs/README.md` | 11,905 | ~2,976 | Map — mandatory |
| 16 | `docs/control/GIT_WORKFLOW_POLICY.md` | 9,729 | ~2,432 | Control — git rules |
| 17 | `AGENTS.md` | 9,200 | ~2,300 | Entry point — mandatory |
| 18 | `docs/control/DATA_LOCATION_RULES.md` | 6,398 | ~1,600 | Control — lane-specific |
| 19 | `docs/control/LAYER_ARCHITECTURE.md` | 6,188 | ~1,547 | Control — duplicates registry |
| 20 | `docs/control/SOURCE_TO_FRONTEND_CONTRACT.md` | 4,527 | ~1,132 | Control — lane-specific |



---

## Folder-by-Folder Analysis

### `docs/control/` — Active Rules

**Purpose:** Authoritative rules for all engineering, structure, data, git, and pipeline
decisions. Only the Orchestrator Agent may modify.

**Actual contents and findings:**

| File | Tokens | Core content | Overlap found |
|------|--------|--------------|---------------|
| `ENGINEERING_STRUCTURE_RULES.md` | ~7,271 | 19 sections: naming, folders, file-size limits, frontend, API, fetcher, DB, migration, time-series, transport, jobs, raw data, imports, refactor. | Contains Normalizer Location Rule (HEALTH-004). Contains "Required First Read" list. Contains layer folder structure (also in LAYER_ARCHITECTURE + MVP_LAYER_REGISTRY). |
| `MVP_LAYER_REGISTRY.md` | ~2,861 | Layer ID table, status, definitions, product rules, change process. | Layer list also appears in AGENTS.md, LAYER_ARCHITECTURE.md, LAYER_ID_CONVENTIONS.md. |
| `GIT_WORKFLOW_POLICY.md` | ~2,432 | Worker/Orchestrator split, commit format, pre-push checklist, branch naming, PR/merge policy, rollback. | Key git rules summarised in AGENTS.md. Full detail only needed by Orchestrator. |
| `DATA_LOCATION_RULES.md` | ~1,600 | Directory structure, raw path pattern, Normalizer Location Rule, gitignore. | Normalizer Location Rule also in ENGINEERING_STRUCTURE_RULES, PIPELINE_HANDOFF_RULES, LLM_OWNERSHIP_MATRIX. Raw path pattern also in ENGINEERING_STRUCTURE_RULES §15 and LAYER_ID_CONVENTIONS. |
| `LAYER_ARCHITECTURE.md` | ~1,547 | Layer concept, full layer list with descriptions. | Layer list fully duplicated from MVP_LAYER_REGISTRY. Layer descriptions add narrative only. |
| `SOURCE_TO_FRONTEND_CONTRACT.md` | ~1,132 | Required fields per source, source families, "adding a new source" steps. | Relevant for API Agent and Frontend Agent only. Not needed by DB/Fetcher/Normalizer agents. |
| `LLM_OWNERSHIP_MATRIX.md` | ~1,014 | File ownership table per agent, git rules, Normalizer Location Rule (again), shared read access. | Ownership summary also in AGENTS.md. Git rules also in GIT_WORKFLOW_POLICY. Normalizer Location Rule — 4th copy. |
| `PIPELINE_HANDOFF_RULES.md` | ~852 | Data flow diagram, handoff points, Normalizer Location Rule (again), forbidden patterns. | Normalizer Location Rule — 3rd copy. Data flow implied by LAYER_ARCHITECTURE + ENGINEERING_STRUCTURE_RULES. |
| `LAYER_ID_CONVENTIONS.md` | ~770 | Naming pattern, registered IDs, folder conventions per agent, API route pattern. | Layer ID table duplicates MVP_LAYER_REGISTRY. Folder conventions duplicated in ENGINEERING_STRUCTURE_RULES §4 and §9. |
| `WORK_ORDER_TEMPLATE.md` | ~293 | Single WO template (metadata + sections). | Only needed when creating a new work order. |

**Key finding:** The 9 rule docs have four distinct responsibility areas. They could be
reorganised into 3 files without losing content:

1. **Engineering rules** — code structure, naming, file sizes, imports, refactor policy
   (currently spread across ENGINEERING_STRUCTURE_RULES + partial overlap from LAYER_ID,
   DATA_LOCATION, SOURCE_TO_FRONTEND)
2. **Layer and data contract** — layer registry, folder conventions, data flow, ownership,
   raw path, source contract, Normalizer Location Rule (single authoritative copy)
3. **Git and workflow** — git rules, commit format, branch naming, PR policy, work order
   template (currently split across GIT_WORKFLOW_POLICY + AGENTS.md + LLM_OWNERSHIP_MATRIX)

---

### `docs/state/` — Current State

**CURRENT_PROJECT_STATE.md (4.9KB / ~1,236 tokens):** Excellent. Concise, well-structured,
covers phase, implemented layers, API surface, live workers, what does not exist yet, and
workflow pointer. This is a model document. Keep as-is. Mandatory.

**HANDOFF_LOG.md (600KB / ~150,201 tokens):** An append-only log of 29 work sessions
going back to the start of the project. Each entry follows the required format (work order,
agent, branch, summary, files changed, commands, results, known issues, review status).
The log itself is correct and valuable as history. The problem is its size and its listing
as mandatory reading. The last 2 entries (visible in tail) cover the SR-006A/B panel splits
from 2026-06-15. That is all an agent needs to know "what happened last."

**Finding:** HANDOFF_LOG must not be mandatory reading. Agents need "last session context"
only. A rolling RECENT_CONTEXT.md capped at the last 3–5 sessions would serve that need
at ~3–5k tokens instead of 150k.

---

### `docs/audits/` — Audit Evidence

| File | Tokens | Purpose | Current mandatory? |
|------|--------|---------|-------------------|
| `ENGINEERING_STRUCTURE_COMPLIANCE_AUDIT.md` | ~20,077 | Full ESA audit: folder findings, file-size violations, grandfathered items. Source for spec 008. | No — but referenced in spec 008 README and elsewhere. |
| `PROJECT_HEALTH_FINDINGS_EXPLAINED.md` | ~12,675 | Deep evidence for HEALTH-001 through HEALTH-012. Source for the Normalizer Location Rule and other adopted controls. | No — evidence doc, not active instructions. |
| `PROJECT_HEALTH_WORKFLOW_AUDIT.md` | ~8,371 | Workflow audit: validation summary, HEALTH-001 to HEALTH-012 findings. | No — evidence doc. |

**Finding:** None are mandatory reading for worker agents. They are evidence that led to
control doc decisions. Those decisions are already captured in the control docs. The audits
should be in `docs/audits/` (they already are) and explicitly flagged as search-only.

---

### `docs/archive/` — Historical Documents

147 files across 3 dated cleanup batches. All from 2026-06-14. Includes:
- Old work orders (WO-001 through WO-079A)
- Integration reviews (60+ files)
- Legacy API docs, control-layer-docs, data-legacy docs
- Old audit copies, deferred decisions, devlog entries

**Finding:** Archive is correctly structured with INDEX.md files for each batch. The main
risk is that agents doing grep/search may inadvertently pull archive content if searching
without scoping to `docs/control/` or `docs/state/`. The archive does not appear in any
mandatory-read list, which is correct. The policy should be hardened: "never read archive
unless explicitly asked by the Orchestrator."

---

### `docs/work-orders/` — Active Work Orders

Contains only `README.md` (646B). No active work orders. All historical WOs have been
archived. The spec 008 `tasks.md` is the current active task list.

**Finding:** Folder is correctly empty of active WOs. The README should clarify that new
small cross-cutting repairs go here as WO files; large features go to `specs/`. No
structural change needed.

---

### `docs/decisions/` — Architecture Decision Records

- `ADR-001-documentation-system.md` (7.6KB) — documents the docs folder structure decision.
- `ADR-002-aviation-live-source.md` (6.2KB) — aviation live source architecture decision.

**Finding:** Correct placement, not mandatory for workers. Should be read only when making
decisions that affect the documented area. No change needed.

---

### `docs/api/`, `docs/data/` — Reserved Stubs

Both contain only a `README.md` stub. Not in any mandatory-read path. No change needed.

---

### `specs/` — Specification Workspace

| Spec | Files | Total size | Active? | Agent action needed |
|------|-------|-----------|---------|---------------------|
| `001-layer-zero-globe-core/` | 1 | 2.2KB | No — implemented | Move to `docs/archive/` in a future cleanup task. |
| `002-layer-one-aviation/` | 1 | 3.1KB | No — implemented | Move to archive. |
| `003-layer-05-space-satellites-mvp/` | 10 | ~162KB | No — implemented. README says "spec complete, not implemented" but CURRENT_PROJECT_STATE says active. Status label outdated. | Move to archive. Update status label first. |
| `004-layer-10-energy-infrastructure-mvp/` | 3 | ~29KB | No — implemented | Move to archive. |
| `005-layer-06-maritime-mvp/` | 8 | ~80KB | No — implemented | Move to archive. |
| `006-layer-07-weather-mvp/` | 9 | ~108KB | No — implemented | Move to archive. |
| `007-layer-08-news-osint-mvp/` | 12 | ~103KB | No — implemented | Move to archive. |
| `008-structure-remediation-roadmap/` | 7 | ~181KB | **YES** — SR-001 through SR-018 active | Keep. Worker agents doing SR-NNN tasks must read task-specific files only. |

**Finding:** Specs 001–007 are all historical (implemented layers). They add ~487KB /
~122k tokens to the specs/ tree but serve no active planning purpose. They should be
moved to `docs/archive/` in a dedicated cleanup task. The `specs/README.md` (5.8KB) is
the workspace guide and should stay.

---

## Document-by-Document Mandatory-Read Analysis

| Document | Size | Tokens | Currently mandatory? | Recommended status | Reason |
|----------|------|--------|---------------------|--------------------|--------|
| `AGENTS.md` | 9.2KB | ~2,300 | Yes | **Always read** | Entry point. Roles, hard rules, layer table, workflow. |
| `docs/state/CURRENT_PROJECT_STATE.md` | 4.9KB | ~1,236 | Yes | **Always read** | Phase, layers, API. Concise. Irreplaceable. |
| `docs/control/ENGINEERING_STRUCTURE_RULES.md` | 29KB | ~7,271 | Yes | **Always read** (after consolidation, target ≤4k tokens) | Master rulebook. Can be tightened by removing duplicate content. |
| `docs/control/MVP_LAYER_REGISTRY.md` | 11.4KB | ~2,861 | Yes | **Always read** | Authoritative layer IDs. Currently contains repeated layer narratives that could be trimmed. |
| `docs/state/HANDOFF_LOG.md` | 600KB | ~150,201 | Listed as mandatory | **Never mandatory. Search-only.** | Too large. Replace with RECENT_CONTEXT.md for "last N sessions." |
| `docs/README.md` | 11.9KB | ~2,976 | Yes | **Reference only** (not mandatory for workers) | Documentation map. Valuable for onboarding. Workers need the rules, not the map. |
| `docs/control/GIT_WORKFLOW_POLICY.md` | 9.7KB | ~2,432 | Implied | **Orchestrator-mandatory; worker reference** | Orchestrator needs full detail. Workers need commit format only (already in AGENTS.md). |
| `docs/control/LAYER_ARCHITECTURE.md` | 6.2KB | ~1,547 | Implied | **Archive candidate** after content merge | Duplicates MVP_LAYER_REGISTRY layer list. Narrative descriptions not needed daily. |
| `docs/control/DATA_LOCATION_RULES.md` | 6.4KB | ~1,600 | Implied | **Lane-specific** (Fetcher/Normalizer/DB) | Normalizer Location Rule to be consolidated into one canonical location. |
| `docs/control/SOURCE_TO_FRONTEND_CONTRACT.md` | 4.5KB | ~1,132 | Implied | **Lane-specific** (API Agent, Frontend Agent) | |
| `docs/control/LLM_OWNERSHIP_MATRIX.md` | 4.1KB | ~1,014 | Implied | **Reference only** | Ownership summary duplicated in AGENTS.md. Normalizer Location Rule is the 4th copy. |
| `docs/control/PIPELINE_HANDOFF_RULES.md` | 3.4KB | ~852 | Implied | **Lane-specific** (Fetcher/API/DB) | Normalizer Location Rule is the 3rd copy. Data flow overview useful but duplicated. |
| `docs/control/LAYER_ID_CONVENTIONS.md` | 3.1KB | ~770 | Implied | **Merge candidate** | Duplicates MVP_LAYER_REGISTRY folder conventions. |
| `docs/control/WORK_ORDER_TEMPLATE.md` | 1.2KB | ~293 | No | **Task-specific** (only when creating a WO) | |
| `docs/audits/*.md` (3 files) | ~164KB | ~41,123 | No | **Search-only** | Historical evidence, not active instructions. |
| `docs/decisions/ADR-*.md` (2 files) | ~13.8KB | ~3,450 | No | **Reference only** | Read when making relevant architectural decisions. |
| `specs/001–007/**` | ~487KB | ~121,750 | No | **Archive** | All layers are implemented. Historical. |
| `specs/008/**` (7 files) | ~181KB | ~45,250 | Yes for SR-NNN tasks | **Task-specific** | Workers doing SR-NNN tasks read their task's section in plan.md + tasks.md + repository-skeleton.md. |
| `docs/archive/**` (147 files) | ~1.2MB+ | ~300k+ | No | **Never read unless asked** | Historical. |



---

## Duplicate and Overlapping Information

### 1. Normalizer Location Rule (HEALTH-004) — 4 copies

The rule appears verbatim or near-verbatim in:

1. `docs/control/ENGINEERING_STRUCTURE_RULES.md` §9
2. `docs/control/DATA_LOCATION_RULES.md` §3
3. `docs/control/LLM_OWNERSHIP_MATRIX.md` §4
4. `docs/control/PIPELINE_HANDOFF_RULES.md` §1.1

**Resolution:** One canonical copy in ENGINEERING_STRUCTURE_RULES.md. All other docs
reference it with a section link. No rule content is lost.

---

### 2. Layer List — 4 copies

The 11-layer registry (layer_00 through layer_10) appears in:

1. `docs/control/MVP_LAYER_REGISTRY.md` — canonical source
2. `AGENTS.md` — abbreviated copy (names + statuses)
3. `docs/control/LAYER_ARCHITECTURE.md` — full copy with narrative descriptions
4. `docs/control/LAYER_ID_CONVENTIONS.md` — IDs only

**Resolution:** MVP_LAYER_REGISTRY.md remains canonical. AGENTS.md keeps its summary
table (agents need it daily). LAYER_ARCHITECTURE.md narrative descriptions can be merged
into MVP_LAYER_REGISTRY or archived. LAYER_ID_CONVENTIONS.md folder conventions can be
merged into MVP_LAYER_REGISTRY or ENGINEERING_STRUCTURE_RULES.

---

### 3. Git Rules — 3 sources

Commit format, branch naming, push/PR rules appear in:

1. `docs/control/GIT_WORKFLOW_POLICY.md` — full detail
2. `AGENTS.md` §Git Workflow — summary + key rules
3. `docs/control/LLM_OWNERSHIP_MATRIX.md` §Git Rules — partial copy

**Resolution:** GIT_WORKFLOW_POLICY.md remains the canonical source for full detail.
LLM_OWNERSHIP_MATRIX git section should link to it, not duplicate it.

---

### 4. Agent Ownership — 2 sources

Agent file ownership table appears in:

1. `AGENTS.md` — roles table (authoritative)
2. `docs/control/LLM_OWNERSHIP_MATRIX.md` — expanded version with git rules

**Resolution:** AGENTS.md is the authoritative entry point. LLM_OWNERSHIP_MATRIX.md
adds folder-level detail not in AGENTS.md. Keep both but remove the duplicate git rules
section from LLM_OWNERSHIP_MATRIX.

---

### 5. Raw Storage Path Pattern — 3 sources

The `raw/<layer_id>/<source_id>/...` path pattern appears in:

1. `docs/control/ENGINEERING_STRUCTURE_RULES.md` §15
2. `docs/control/DATA_LOCATION_RULES.md` §2
3. `docs/control/LAYER_ID_CONVENTIONS.md` §Raw Storage Path Pattern

**Resolution:** One canonical copy in ENGINEERING_STRUCTURE_RULES.md §15. Others
reference it.

---

### 6. "Required First Read" Lists — 3 sources

Lists of documents agents must read appear in:

1. `ENGINEERING_STRUCTURE_RULES.md` §2 — lists 6 docs including HANDOFF_LOG
2. `docs/README.md` §2 — lists same 6 docs
3. `AGENTS.md` §Hard Rule 0 — "every agent must read AGENTS.md before starting"

**Resolution:** One canonical reading policy in AGENTS.md. Other docs reference it.
HANDOFF_LOG must be removed from the mandatory list.

---

### 7. Folder Conventions — 2 sources

Per-agent folder naming conventions appear in:

1. `docs/control/LAYER_ID_CONVENTIONS.md` — frontend, fetcher, normalizer, source
   catalog, DB migrations, raw storage per agent
2. `docs/control/ENGINEERING_STRUCTURE_RULES.md` §4 (Layer Folder Structure) and §9
   (Fetcher/Normalizer Structure Rules)

**Resolution:** Merge LAYER_ID_CONVENTIONS.md content into ENGINEERING_STRUCTURE_RULES
§4 and §9, or into a dedicated section in a consolidated rules doc.

---

## Proposed Core Documentation Set

The goal is a **mandatory reading list of 4 documents** totalling 8k–15k tokens.

### Proposed Core Doc 1: `AGENTS.md` (keep, revise)

| Field | Value |
|-------|-------|
| **Proposed path** | `AGENTS.md` (unchanged) |
| **Purpose** | Entry point: agent roles, hard rules, layer registry summary, workflow cycle, git key rules, reading policy. |
| **Max target size** | 10KB / ~2,500 tokens |
| **Feeds from** | Current AGENTS.md. Remove duplication from LLM_OWNERSHIP_MATRIX git section. |
| **Who reads it** | Every agent, every session. |
| **When required** | Always. First document read. |
| **Changes needed** | Add explicit `## Agent Reading Policy` section. Update mandatory list (remove HANDOFF_LOG; add RECENT_CONTEXT). |

---

### Proposed Core Doc 2: `docs/control/PROJECT_RULES.md` (new consolidated)

| Field | Value |
|-------|-------|
| **Proposed path** | `docs/control/PROJECT_RULES.md` |
| **Purpose** | Single engineering rulebook: naming, folder structure, file-size limits, API structure, DB rules, fetcher/normalizer rules, import boundaries, refactor policy. One canonical copy of Normalizer Location Rule, raw path pattern, folder conventions. |
| **Max target size** | 18KB / ~4,500 tokens (current ENGINEERING_STRUCTURE_RULES is 29KB; target is to remove duplicate sections and tighten language) |
| **Feeds from** | `ENGINEERING_STRUCTURE_RULES.md` (all 19 sections). Absorbs unique content from `DATA_LOCATION_RULES.md`, `PIPELINE_HANDOFF_RULES.md`, `LAYER_ID_CONVENTIONS.md` (removes duplicates, not information). |
| **Who reads it** | Every agent before any code-touching task. |
| **When required** | Always (except documentation-only tasks). |
| **Changes needed** | New file created from consolidation. Old files either archived or reduced to single-line pointer to new file. |

---

### Proposed Core Doc 3: `docs/control/LAYER_AND_DATA_CONTRACT.md` (new consolidated)

| Field | Value |
|-------|-------|
| **Proposed path** | `docs/control/LAYER_AND_DATA_CONTRACT.md` |
| **Purpose** | Authoritative layer registry (IDs, statuses, order), folder conventions per agent lane, source-to-frontend contract, ownership matrix summary, data flow overview. |
| **Max target size** | 10KB / ~2,500 tokens |
| **Feeds from** | `MVP_LAYER_REGISTRY.md` (registry table, status definitions, product rules). `LAYER_ARCHITECTURE.md` (layer descriptions — keep concise, discard repeated table). `SOURCE_TO_FRONTEND_CONTRACT.md` (source contract fields). `LLM_OWNERSHIP_MATRIX.md` (ownership table — keep; remove git rules which move to AGENTS.md). |
| **Who reads it** | Every agent. Layer-touching agents especially. |
| **When required** | Always. |
| **Changes needed** | New file created from consolidation. Old source files archived or reduced to pointers. |

---

### Proposed Core Doc 4: `docs/state/RECENT_CONTEXT.md` (new)

| Field | Value |
|-------|-------|
| **Proposed path** | `docs/state/RECENT_CONTEXT.md` |
| **Purpose** | Rolling summary of the last 3–5 work sessions. What was just done, what is in progress, what is next, any known issues from the last session. |
| **Max target size** | 3KB / ~750 tokens |
| **Feeds from** | Most recent 3–5 entries in HANDOFF_LOG.md. |
| **Who reads it** | Every agent at session start. Replaces mandatory HANDOFF_LOG read. |
| **When required** | Always. Updated by every agent after completing work. Policy: keep only last 5 sessions; older sessions stay in HANDOFF_LOG (search-only). |
| **Update policy** | Each agent appends a short summary entry (not the full handoff format — just 5–8 lines: date, work order, what changed, what is next). When >5 entries exist, oldest entry is removed from RECENT_CONTEXT (it already exists in full in HANDOFF_LOG). |

---

### Supporting docs (keep but not mandatory for most agents)

| Document | Keep as? | Who reads it |
|----------|----------|-------------|
| `docs/control/GIT_WORKFLOW_POLICY.md` | Reference — Orchestrator mandatory | Orchestrator Agent for full policy; all agents for commit format reference. |
| `docs/state/CURRENT_PROJECT_STATE.md` | Mandatory (keep, already excellent) | All agents. |
| `docs/README.md` | Reference / onboarding only | Humans onboarding, Documentation Agent. |
| `docs/state/HANDOFF_LOG.md` | Search-only, append-only | Never mandatory. Read only when history investigation is requested. |
| `docs/audits/**` | Search-only | Research/Documentation Agent on audit tasks only. |
| `docs/decisions/ADR-*.md` | Reference | Read when making relevant architectural decisions. |

---

## Proposed Folder Architecture

The folder tree needs minimal structural change. The primary fix is within `docs/control/`
(file consolidation) and a new file in `docs/state/`. No folders need to be created or
deleted.

```
E:\god-eyes\
├── AGENTS.md                          ← ALWAYS READ (revised: add reading policy section)
├── docs/
│   ├── README.md                      ← reference / onboarding (not mandatory for workers)
│   ├── control/
│   │   ├── PROJECT_RULES.md           ← ALWAYS READ (new: consolidates ESR + data/pipeline/id conventions)
│   │   ├── LAYER_AND_DATA_CONTRACT.md ← ALWAYS READ (new: consolidates registry + ownership + contract)
│   │   ├── GIT_WORKFLOW_POLICY.md     ← Orchestrator-mandatory; workers reference only
│   │   └── WORK_ORDER_TEMPLATE.md     ← task-specific (creating WOs only)
│   │
│   │   [ARCHIVED or reduced to pointers after consolidation:]
│   │   ├── ENGINEERING_STRUCTURE_RULES.md  → pointer to PROJECT_RULES.md
│   │   ├── MVP_LAYER_REGISTRY.md           → pointer to LAYER_AND_DATA_CONTRACT.md
│   │   ├── LAYER_ARCHITECTURE.md           → archive
│   │   ├── DATA_LOCATION_RULES.md          → pointer / archive
│   │   ├── PIPELINE_HANDOFF_RULES.md       → pointer / archive
│   │   ├── LLM_OWNERSHIP_MATRIX.md         → pointer / archive
│   │   ├── LAYER_ID_CONVENTIONS.md         → archive
│   │   └── SOURCE_TO_FRONTEND_CONTRACT.md  → pointer to LAYER_AND_DATA_CONTRACT.md
│   │
│   ├── state/
│   │   ├── CURRENT_PROJECT_STATE.md   ← ALWAYS READ (keep, excellent as-is)
│   │   ├── RECENT_CONTEXT.md          ← ALWAYS READ (new: rolling 3-5 session summary)
│   │   └── HANDOFF_LOG.md             ← append-only; NEVER mandatory; search-only
│   ├── audits/                        ← search-only; not mandatory
│   │   ├── ENGINEERING_STRUCTURE_COMPLIANCE_AUDIT.md
│   │   ├── PROJECT_HEALTH_FINDINGS_EXPLAINED.md
│   │   └── PROJECT_HEALTH_WORKFLOW_AUDIT.md
│   ├── decisions/                     ← reference only
│   │   ├── ADR-001-documentation-system.md
│   │   └── ADR-002-aviation-live-source.md
│   ├── archive/                       ← never read unless asked
│   │   ├── 2026-06-14-documentation-cleanup/
│   │   ├── 2026-06-14-final-docs-structure/
│   │   └── 2026-06-14-spec-kit-alignment/
│   ├── work-orders/                   ← active WOs only (currently empty)
│   │   └── README.md
│   ├── api/                           ← reserved stub
│   └── data/                          ← reserved stub
│
├── specs/
│   ├── README.md                      ← spec workspace guide
│   ├── 008-structure-remediation-roadmap/   ← ACTIVE spec (task-specific reads only)
│   │   ├── README.md
│   │   ├── spec.md
│   │   ├── plan.md
│   │   ├── tasks.md
│   │   ├── research.md
│   │   ├── repository-skeleton.md
│   │   ├── graphify-findings.md
│   │   └── api-remaining-route-review.md
│   │
│   [Move to docs/archive/ in dedicated cleanup task:]
│   ├── 001-layer-zero-globe-core/
│   ├── 002-layer-one-aviation/
│   ├── 003-layer-05-space-satellites-mvp/
│   ├── 004-layer-10-energy-infrastructure-mvp/
│   ├── 005-layer-06-maritime-mvp/
│   ├── 006-layer-07-weather-mvp/
│   └── 007-layer-08-news-osint-mvp/
```

**New mandatory token budget (target):**

| Document | Est. tokens after consolidation |
|----------|---------------------------------|
| `AGENTS.md` (revised) | ~2,500 |
| `docs/control/PROJECT_RULES.md` | ~4,500 |
| `docs/control/LAYER_AND_DATA_CONTRACT.md` | ~2,500 |
| `docs/state/CURRENT_PROJECT_STATE.md` | ~1,236 |
| `docs/state/RECENT_CONTEXT.md` | ~750 |
| **Total** | **~11,486 tokens** |

This is within the 8k–15k target. It is a ~93% reduction from the current 163k mandatory
read (without HANDOFF_LOG) / 176k (with).



---

## Proposed Agent Reading Policy

### Always Read (every agent, every session)

1. `AGENTS.md` — roles, hard rules, layer summary, workflow, reading policy
2. `docs/control/PROJECT_RULES.md` — engineering structure rules (consolidated)
3. `docs/control/LAYER_AND_DATA_CONTRACT.md` — layer registry, ownership, contracts
4. `docs/state/CURRENT_PROJECT_STATE.md` — current phase and layer status
5. `docs/state/RECENT_CONTEXT.md` — last 3–5 session summaries

Total: ~11,500 tokens.

### Task-Specific Read (read only for the relevant task type)

| Document | Read when |
|----------|-----------|
| `docs/control/GIT_WORKFLOW_POLICY.md` | Orchestrator Agent before any push/PR/review. Workers when uncertain about commit format. |
| `docs/control/WORK_ORDER_TEMPLATE.md` | Orchestrator Agent when creating a new work order. |
| `specs/008-structure-remediation-roadmap/tasks.md` | Any agent picking up an SR-NNN task. |
| `specs/008-structure-remediation-roadmap/plan.md` | Agent picking up an SR-NNN task (relevant phase section only). |
| `specs/008-structure-remediation-roadmap/repository-skeleton.md` | Agent picking up any SR-NNN implementation task (required per spec 008 README). |
| `specs/008-structure-remediation-roadmap/spec.md` | Agent or Reviewer needing safety rules and success criteria. |
| `docs/decisions/ADR-*.md` | Any agent or Orchestrator when making a relevant architectural decision. |
| Active spec for the current feature | The responsible worker agent and Reviewer for that feature. |

### Reference / Search-Only (do not load into context unless specific content is needed)

| Document | Access pattern |
|----------|---------------|
| `docs/state/HANDOFF_LOG.md` | Search for specific session or work order history only. Never load full file. |
| `docs/audits/**` | Search when investigating a specific health finding or compliance issue. |
| `docs/README.md` | Read when onboarding or when documentation structure itself is in question. |
| `specs/001–007/**` | Search if investigating an implemented layer's original specification. |

### Never Read Unless Explicitly Instructed

| Document | Policy |
|----------|--------|
| `docs/archive/**` | Do not read. Search only if a specific archived document is referenced by name in a task. |
| Any file in `docs/archive/` | Historical. Not active instructions. Cannot override active control docs. |

---

## Handoff Log Strategy

### Current state

`docs/state/HANDOFF_LOG.md` is 600KB / 6,949 lines / 29 work sessions / ~150,201 tokens.
It is correct, well-formatted, and append-only. It is listed as mandatory reading in two
places (`docs/README.md` §2 item 4, `ENGINEERING_STRUCTURE_RULES.md` §2 item 4). This is
the single largest context cost in the entire project.

### Recommended strategy

1. **Keep HANDOFF_LOG.md exactly as-is.** Append-only, full history, all sessions
   preserved. Do not restructure, split, or summarise the existing entries. They are
   irreplaceable audit history.

2. **Remove HANDOFF_LOG.md from mandatory reading lists.** Update both
   `ENGINEERING_STRUCTURE_RULES.md` §2 (or its successor `PROJECT_RULES.md`) and
   `docs/README.md` §2 to classify it as search-only / reference.

3. **Create `docs/state/RECENT_CONTEXT.md`.** A new file maintained by agents.
   - Format: up to 5 short session summaries (date, work order, what changed, what is
     next, known issues). Each entry ≤8 lines.
   - Max size cap: ~2KB / ~500 tokens.
   - Update policy: each agent appends one short entry after completing work. When 6th
     entry would be added, the oldest entry is dropped (it is already in HANDOFF_LOG).
   - This file replaces HANDOFF_LOG as the "what happened last" signal.

4. **HANDOFF_LOG.md continues to be appended per current rules.** Agents still add full
   handoff entries as required by Hard Rule 14/15 in AGENTS.md. RECENT_CONTEXT.md is an
   additional lightweight file, not a replacement for the full handoff entries.

5. **Optional future: periodic HANDOFF_LOG archiving.** When HANDOFF_LOG reaches ~1MB,
   the Orchestrator can split it: archive sessions older than 90 days into
   `docs/archive/handoff-log-archive-YYYY-MM.md`, keeping only recent sessions in the
   live file. This is not required now but reduces long-term growth.

---

## Archive / Audit / Work-Order Strategy

### Archive (`docs/archive/`)

- **Current state:** 147 files / 3 dated batches. All historical. No active instructions.
- **Risk:** Files have names that look like active docs (e.g., `ENGINEERING_STRUCTURE_RULES`
  copies, `INTEGRATION_REVIEW` files, `control-layer-docs/`). Agents doing broad searches
  could accidentally surface these.
- **Recommended action:**
  1. Add a prominent warning to `docs/archive/README.md`: "Nothing in this directory is
     an active instruction. Do not read these files unless explicitly asked by the
     Orchestrator Agent."
  2. Add an `AGENTS_DO_NOT_READ.md` stub in each archive batch subdirectory to make the
     "not active" status machine-discoverable.
  3. In a future cleanup task: archive specs 001–007 here as well.
  4. No documents in archive should ever override active control docs. If an archived doc
     contradicts an active control doc, the active control doc wins.

### Audits (`docs/audits/`)

- **Current state:** 3 active audit files (~41k tokens total). Not mandatory.
- **Recommended action:**
  1. Keep all 3 files. They are evidence, not instructions.
  2. Explicitly add to AGENTS.md and/or PROJECT_RULES.md: "Audit reports in
     `docs/audits/` are evidence only. Do not treat them as active instructions unless a
     control doc explicitly adopts a finding."
  3. If an audit is superseded by a new audit, move the old one to `docs/archive/`.

### Work Orders (`docs/work-orders/`)

- **Current state:** Only `README.md` stub. No active WOs.
- **Recommended action:**
  1. Keep the folder and README.
  2. Clarify policy in the README: new small cross-cutting repairs → create a WO file
     here. Large features → create a spec under `specs/`. Completed WOs → move to archive.
  3. If/when a new WO is created, its existence is noted in RECENT_CONTEXT.md so agents
     know to check for it.

---

## Information That Must Not Be Lost

The following information exists in the current docs and must be preserved in full through
any consolidation:

1. **Normalizer Location Rule (HEALTH-004)** — whether normalizers are co-located with
   fetchers or separated. This is an active architectural decision. One canonical copy must
   remain in the consolidated engineering rules.

2. **Raw storage path pattern** — `raw/<layer_id>/<source_id>/<date>/...` — must remain
   in the consolidated engineering rules.

3. **Full layer registry table** — all 11 layers with IDs, names, and statuses. Must
   remain in LAYER_AND_DATA_CONTRACT.md.

4. **Agent ownership matrix** — which agent owns which folders. Must remain in
   AGENTS.md or LAYER_AND_DATA_CONTRACT.md.

5. **Commit message format** — `<type>(<area>): <description>` with required fields.
   Must remain in AGENTS.md (summary) and GIT_WORKFLOW_POLICY.md (full).

6. **Hard Rules 0–15 in AGENTS.md** — the 16 hard rules (layer membership, layer IDs,
   no direct DB from frontend, API owns DB, fetchers store before normalising, no keys
   committed, etc.). These must stay in AGENTS.md intact.

7. **File and function size limits** — TypeScript ≤500 lines new / ≤800 grandfathered,
   Python ≤500/≤700, functions ≤80 lines, React components ≤250 lines. Must stay in
   PROJECT_RULES.md.

8. **Import boundary rules** — which packages may import from which. Must stay in
   PROJECT_RULES.md.

9. **Spec 008 plan and tasks** — SR-001 through SR-018 are active work packages. Must
   not be archived until the remediation is complete.

10. **All HANDOFF_LOG entries** — full history of 29 sessions. Must stay in
    HANDOFF_LOG.md. Must not be deleted.

11. **ADRs** — both architectural decisions must remain accessible as permanent records.

12. **Source-to-frontend contract fields** — the required fields per source type that
    the Frontend Agent must not invent. Must stay in LAYER_AND_DATA_CONTRACT.md.

13. **Security rules** — no real API keys committed, secrets as placeholders only, no
    direct DB connection from frontend. Must stay prominent in AGENTS.md Hard Rules.

---

## Risks and Blockers

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Consolidation creates new inconsistencies** — if PROJECT_RULES.md is written carelessly, some rule detail from the 9 source files could be dropped or changed in meaning. | High | Create PROJECT_RULES.md by careful merge with explicit cross-check against each source file's unique content. Reviewer Agent validates before any source file is retired. |
| **Agents trained on old reading lists still load HANDOFF_LOG** — if AGENTS.md and ENGINEERING_STRUCTURE_RULES.md are not updated simultaneously, some agents will still load the log. | High | Phase 1 must update AGENTS.md first. Both mandatory-read lists updated in the same commit. |
| **Specs 001–007 archival breaks cross-references** — other docs may reference these spec paths. | Medium | Search for all cross-references before moving. Update or add redirects in the archived files. |
| **RECENT_CONTEXT.md update policy not followed** — if agents don't update it, it becomes stale or grows unbounded. | Medium | Make the update rule explicit in AGENTS.md Hard Rules (add Hard Rule 16 or amend Rule 14). Cap at 5 entries enforced by policy. |
| **LAYER_ARCHITECTURE.md archival confusion** — it is currently listed in AGENTS.md §Key Documents. Removing it without updating the reference creates a broken link. | Low | Update AGENTS.md §Key Documents list when LAYER_ARCHITECTURE.md is archived. |
| **HANDOFF_LOG.md continues to grow** — at ~29 sessions it is already 600KB; 100 sessions would be ~2MB. | Low (now) / High (future) | Implement periodic archiving policy (e.g., archive sessions >90 days old once per quarter). Not urgent today. |
| **Archive pollution of search results** — agents searching all of `docs/` will surface archive content. | Medium | Always scope searches to `docs/control/`, `docs/state/`, `docs/audits/`, `specs/008/` explicitly. Archive warning files help. |
| **Spec 008 itself is large** — the 7 files in spec 008 total ~181KB / ~45k tokens. Worker agents doing SR-NNN tasks must not load all 7. | Medium | Tasks.md reading policy: agent reads only the specific SR-NNN section + repository-skeleton.md + their phase in plan.md. The full spec 008 does not need to be read for any single task. |

---

## Recommended Implementation Phases

### Phase 1 — Create RECENT_CONTEXT.md and update mandatory reading lists (low risk, high value)

**Do first. Immediate 90% context reduction.**

1. Create `docs/state/RECENT_CONTEXT.md` with the last 3 work sessions extracted from
   HANDOFF_LOG.md (do not copy the full entries — write 5–8 line summaries per session).
2. Update `AGENTS.md` Hard Rule 14 (or add Rule 16) with RECENT_CONTEXT.md update policy.
3. Update `AGENTS.md` §Agent First-Read: replace HANDOFF_LOG item with RECENT_CONTEXT.md.
4. Update `docs/README.md` §2: same replacement.
5. Update `ENGINEERING_STRUCTURE_RULES.md` §2: same replacement.
6. Commit: `docs(policy): replace mandatory HANDOFF_LOG read with RECENT_CONTEXT`
7. **Result:** mandatory reads drop from ~176k to ~17k tokens.

---

### Phase 2 — Consolidate control docs (medium risk, medium value)

**Creates PROJECT_RULES.md and LAYER_AND_DATA_CONTRACT.md.**

1. Write `docs/control/PROJECT_RULES.md` by merging:
   - All 19 sections of ENGINEERING_STRUCTURE_RULES.md
   - Unique content from DATA_LOCATION_RULES.md (gitignore requirements, generated folders)
   - Unique content from PIPELINE_HANDOFF_RULES.md (handoff protocol, forbidden patterns)
   - Folder conventions from LAYER_ID_CONVENTIONS.md
   - Remove all duplicate copies of Normalizer Location Rule (keep one canonical)
   - Target: ≤18KB
2. Write `docs/control/LAYER_AND_DATA_CONTRACT.md` by merging:
   - Full layer registry from MVP_LAYER_REGISTRY.md
   - Layer descriptions from LAYER_ARCHITECTURE.md
   - Ownership table from LLM_OWNERSHIP_MATRIX.md (remove git rules section)
   - Source contract from SOURCE_TO_FRONTEND_CONTRACT.md
   - Target: ≤10KB
3. Reduce each retired source file to a single-line pointer:
   `This document has been merged into docs/control/PROJECT_RULES.md`
   Do not delete any file yet (preserve git history; deletion is a later cleanup).
4. Update AGENTS.md §Key Documents to reference new file names.
5. Reviewer Agent validates no rule content is lost before retiring source files.
6. Commit: `docs(control): consolidate control docs into PROJECT_RULES and LAYER_AND_DATA_CONTRACT`
7. **Result:** mandatory reads drop to ~11.5k tokens. All content preserved.

---

### Phase 3 — Update AGENTS.md reading policy (low risk)

1. Add `## Agent Reading Policy` section to AGENTS.md with explicit always/task-specific/
   search-only/never-read tiers.
2. Update §Key Documents list to reflect the new consolidated file names.
3. Add archive warning: "docs/archive/ is never active instruction material."
4. Commit: `docs(agents): add explicit agent reading policy`

---

### Phase 4 — Archive historical specs 001–007 (low risk, low urgency)

1. Search for all cross-references to specs/001–007 in all active docs.
2. For each reference, update it to point to the archive location or note "implemented."
3. Move specs/001–007 to `docs/archive/2026-06-16-implemented-layer-specs/` in a single
   dedicated cleanup branch.
4. Add an INDEX.md to the new archive batch.
5. Update `specs/README.md` to remove references to 001–007.
6. Commit: `docs(archive): move implemented layer specs 001-007 to archive`
7. **Result:** specs/ directory contains only spec 008 and the README. Cleaner for agents.

---

### Phase 5 — Harden archive policy (low risk, low urgency)

1. Update `docs/archive/README.md` with explicit "do not read unless asked" warning.
2. Add `_AGENTS_DO_NOT_READ.md` stub to each archive batch directory.
3. Consider a future HANDOFF_LOG archiving policy once it exceeds 1MB.

---

### Phase 6 — Validation and review

After each phase:
- `git status --short --branch` — verify only expected files changed
- `git diff --check` — no whitespace errors
- `python -m pytest tests/data -q` — data tests pass
- Reviewer Agent cross-checks the new consolidated docs against the source docs to confirm
  no rule was dropped or changed in meaning

---

## Recommended Next Planning Task

**Create a planning spec (or sub-task in spec 008) for Phase 1 and Phase 2 implementation.**

Specifically:
1. The Orchestrator Agent should create a work order or spec task for Phase 1
   (RECENT_CONTEXT.md + mandatory reading list update) on its own branch.
2. Phase 2 (doc consolidation into PROJECT_RULES.md + LAYER_AND_DATA_CONTRACT.md) is a
   larger writing task that should be a dedicated branch reviewed by the Reviewer Agent
   before any source file is retired.
3. Phases 3–5 can follow in sequence on separate branches.

A Reviewer Agent should review this research report before any planning or implementation
begins to catch errors in the analysis.

---

## Commands Run

```
git status --short --branch
git log --oneline --decorate -n 12
Get-ChildItem specs -Recurse -File | Select-Object FullName,Length | Sort-Object Length -Descending
Get-ChildItem docs -Recurse -File | Select-Object FullName,Length | Sort-Object Length -Descending
Get-ChildItem specs -Recurse -Directory | Select-Object FullName
Get-ChildItem docs -Recurse -Directory | Select-Object FullName
(Get-ChildItem docs -Recurse -Include *.md | Measure-Object).Count
(Get-ChildItem specs -Recurse -Include *.md | Measure-Object).Count
Select-String "^#" docs/control/ENGINEERING_STRUCTURE_RULES.md
Select-String "^#" docs/control/[each control doc]
Select-String "^#" docs/README.md
Select-String "^#" docs/state/CURRENT_PROJECT_STATE.md
Select-String "^#" docs/audits/[each audit file]
Select-String "^#" specs/008-structure-remediation-roadmap/[spec.md, plan.md, tasks.md]
Get-Content docs/state/HANDOFF_LOG.md -Tail 150
Get-Content docs/README.md
Get-Content docs/state/CURRENT_PROJECT_STATE.md
Get-Content specs/008-structure-remediation-roadmap/README.md
(Get-Content docs/state/HANDOFF_LOG.md | Measure-Object -Line).Lines     → 6949
(Select-String "^## " docs/state/HANDOFF_LOG.md | Measure-Object).Count  → 29
(Get-ChildItem docs/archive -Recurse -File | Measure-Object).Count       → 147
rg "HANDOFF_LOG|CURRENT_PROJECT_STATE|..." docs/control docs/README.md AGENTS.md -c
rg "Normalizer Location Rule" docs/control/ -l
rg "HEALTH-004|Normalizer Location" docs/control/ -c
[token burden calculation for all control + state docs]
```

---

## Validation

This section is completed after Phase 10 (commit) runs.

- `git status`: see below
- `git diff --check`: see below
- `python -m pytest tests/data -q`: see below

