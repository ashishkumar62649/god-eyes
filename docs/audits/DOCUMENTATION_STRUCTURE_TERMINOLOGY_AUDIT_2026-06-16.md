# Documentation Structure and Terminology Audit - 2026-06-16

## Classification

AUDIT_REPORT

## Post-Phase 6 Status (2026-06-16)

> **This audit was written before the single-control-file consolidation.**
> Most P1 findings reference filenames that no longer exist as active docs.
> Use the post-Phase 6 status below when triaging the remaining items.

| Audit finding | Post-Phase 6 status |
|---------------|---------------------|
| P1: Active authority drift (PROJECT_RULES.md, LAYER_AND_DATA_CONTRACT.md, GIT_WORKFLOW_POLICY.md, WORK_ORDER_TEMPLATE.md, the legacy layer-registry filename (now retired), LAYER_ID_CONVENTIONS.md, LAYER_ARCHITECTURE.md, LLM_OWNERSHIP_MATRIX.md, SOURCE_TO_FRONTEND_CONTRACT.md referenced as active) | **RESOLVED.** All of the above were merged into `docs/control/PROJECT_CONTROL.md` (4 parts). The `docs/control/` directory now contains only that one active file. |
| P1: Work-order template conflicts with neutral metadata rules | **RESOLVED.** The template is now in `docs/control/PROJECT_CONTROL.md` Part 4. It does not request `LLM model` or `Tool/CLI used`; it requires neutral fields (Agent, Work Order, Branch, Summary, Commands, Known Issues, Forbidden Folders, Secrets Added). |
| P1: Neutral role terminology inconsistent (Documentation Agent, Reviewer Agent, Planning Agent, Contract Agent) | **PARTIALLY RESOLVED.** `AGENTS.md` was de-duplicated to a pure entry-point pointer and now lists only the six neutral roles. Remaining occurrences are in archived `RECENT_CONTEXT.md` history (replace on next 6th-entry rotation) and the Spec 008 evidence folder. New entries must use the six neutral roles. |
| P2: Spec 008 is structurally useful but stale after Phase 4-6 | **PARTIALLY RESOLVED.** A "Status after Phase 6" banner was added to `specs/008-structure-remediation-roadmap/README.md`. Pre-consolidation research/plan files in Spec 008 remain as historical evidence per the spec README. |
| P2: Layer 06 maritime source docs do not declare layer identity | **RESOLVED.** `packages/source-catalog/layers/layer_06_maritime/README.md` and `source_decisions.md` now include a canonical layer/source identity table (see audit Step 9 re-check). |
| P2: Exact duplicate files (retired pointer stubs) | **ACCEPTED.** Retired pointer stubs were removed from `docs/control/`; only `PROJECT_CONTROL.md` remains. Archive evidence retains the prior state. |
| P2: `docs/state/HANDOFF_LOG.md` contains historical encoding corruption | **ACCEPTED.** Append-only history must not be rewritten. New entries use ASCII or clean UTF-8 only. |
| P3: Classification is path-based, not self-declared | **PARTIALLY RESOLVED.** Classification lines were added to the active state docs (`CURRENT_PROJECT_STATE.md`, `RECENT_CONTEXT.md`, `HANDOFF_LOG.md`). Other active docs already carry classification lines. |
| P3: Spelling drift (normalise vs normalize) | **OPEN (low risk).** Some archived evidence and the constitution still use `normalise`/`normalised`. New entries use `normalize`/`normalized`. Sweep is non-urgent and out of scope for this pass. |

The remaining "open" items are low-risk housekeeping. They do not block new layer
work. They can be picked up by a future documentation cleanup work order.

## Scope

This audit reviewed tracked project document files visible to `git ls-files` on branch
`docs/fix/recent-context-and-reading-policy`.

Included file types:

| Type | Count |
|------|------:|
| Markdown (`.md`) | 270 |
| Text (`.txt`) | 1 |
| DOCX/PDF/RST/ADOC/MDX | 0 |
| **Total** | **271** |

Directory distribution:

| Area | Count | Notes |
|------|------:|-------|
| `docs/archive/` | 193 | Historical/superseded content; should not override active docs. |
| `.kiro/` | 14 | Tool prompt pack; outside project documentation map. |
| `.specify/` | 12 | Spec Kit/tooling templates; outside project documentation map. |
| `docs/control/` | 12 | Active rules plus retired pointer stubs. |
| `packages/source-catalog/` | 11 | Layer-local source catalog documentation. |
| `specs/008-structure-remediation-roadmap/` | 10 | Active spec workspace. |
| `docs/state/` | 3 | Current state, recent context, append-only log. |
| `docs/audits/` | 3 | Active audit evidence. |
| `docs/decisions/` | 2 | ADRs. |
| Other root/code-adjacent docs | 11 | `AGENTS.md`, `CLAUDE.md`, `requirements-data.txt`, database/service/test docs, stub READMEs. |

Commands used:

- `git ls-files`
- `rg --files -g "*.md" -g "*.mdx" -g "*.txt" -g "*.docx" -g "*.pdf" -g "*.rst" -g "*.adoc"`
- Targeted `rg -n` scans for authority drift, retired control docs, stale layer IDs, model/tool names, non-neutral roles, and spelling drift
- Python scripts for duplicate-content hashes, near-duplicate shingle similarity, heading/classification checks, and source-catalog metadata checks

`docs/state/HANDOFF_LOG.md` was not loaded as a mandatory source document. It was scanned only for specific evidence, consistent with the active reading policy.

## Executive Verdict

The documentation set is partly correct and much better organized than a raw historical pile, but it is not fully clean yet.

The current structure has a sound target architecture:

- Active rules are intended to live in `docs/control/`.
- Current state is intended to live in `docs/state/`.
- Audit evidence is intended to live in `docs/audits/`.
- Historical documents are largely fenced under `docs/archive/`.
- Active large refactor work is concentrated in `specs/008-structure-remediation-roadmap/`.

However, the repo still has several active-document inconsistencies:

1. Some active docs still call retired control files authoritative.
2. Some active docs use role names that are not in the neutral role table in `AGENTS.md`.
3. The work-order template still asks for model/tool metadata, conflicting with the current neutral-control rule.
4. Active Spec 008 still contains pre-consolidation assumptions about retired control docs.
5. Some layer-local source catalog docs imply layer identity through path only, instead of explicitly declaring `layer_id` and `source_id`.

These are documentation governance issues, not evidence of a broken code/data layer implementation.

## Findings

### P1 - Active authority drift remains after control-doc consolidation

`AGENTS.md` and `docs/control/LAYER_AND_DATA_CONTRACT.md` say the authoritative layer registry is now `docs/control/LAYER_AND_DATA_CONTRACT.md`.

But these active files still point readers back to retired files:

| File | Evidence | Issue |
|------|----------|-------|
| `docs/control/PROJECT_RULES.md` | Lines 58, 67, 93 | Still says or implies `the legacy layer-registry filename (now retired)` is authoritative/canonical for layer IDs. |
| `docs/state/CURRENT_PROJECT_STATE.md` | Line 9 | Says `docs/control/the legacy layer-registry filename (now retired)` is authoritative. |
| `docs/control/GIT_WORKFLOW_POLICY.md` | Line 18 | Says folder ownership comes from `LLM_OWNERSHIP_MATRIX.md`, now retired. |
| `docs/control/WORK_ORDER_TEMPLATE.md` | Constraint section | Still points to `LAYER_ID_CONVENTIONS.md`, now retired as an active source. |
| `specs/008-structure-remediation-roadmap/README.md` | Line 108 | Says `the legacy layer-registry filename (now retired)` is authoritative. |
| `specs/008-structure-remediation-roadmap/spec.md` | Lines 324-327 | Lists `the legacy layer-registry filename (now retired)`, `LAYER_ID_CONVENTIONS.md`, `LAYER_ARCHITECTURE.md`, and `LLM_OWNERSHIP_MATRIX.md` as active source docs. |
| `specs/008-structure-remediation-roadmap/repository-skeleton.md` | Lines 206-209 | Marks retired control docs as `[KEEP]` authoritative/active files. |

Recommendation:

- Replace active authority references to `the legacy layer-registry filename (now retired)`, `LLM_OWNERSHIP_MATRIX.md`, `LAYER_ID_CONVENTIONS.md`, `LAYER_ARCHITECTURE.md`, and `SOURCE_TO_FRONTEND_CONTRACT.md` with `docs/control/LAYER_AND_DATA_CONTRACT.md` or `docs/control/PROJECT_RULES.md`, depending on the topic.
- Leave the retired files themselves as pointer stubs unless the decision-control layer wants them moved to archive.

### P1 - Work-order template conflicts with neutral metadata rules

`docs/control/WORK_ORDER_TEMPLATE.md` still requires:

- `LLM model`
- `Tool/CLI used`

This conflicts with the current `AGENTS.md` rule that active control documents and handoff entries should not record model/provider/tool product names.

Recommendation:

- Change the template metadata to neutral fields:
  - Agent
  - Work Order
  - Branch
  - Summary
  - Commands
  - Known Issues
  - Forbidden Folders
  - Secrets Added
- Remove model/tool fields from the template.

### P1 - Neutral role terminology is inconsistent in active docs

`AGENTS.md` defines these neutral roles:

- Orchestrator Agent
- Frontend Agent
- Fetcher Agent
- Normalizer Agent
- Database Agent
- API Agent

Active docs also use role names that are not in that table:

| Term | Example files |
|------|---------------|
| `Documentation Agent` | `docs/README.md`, `specs/008-structure-remediation-roadmap/*` |
| `Documentation Implementation Agent` | `docs/state/RECENT_CONTEXT.md` |
| `Documentation Planning Agent` | `specs/008-structure-remediation-roadmap/documentation-architecture-compression-plan.md` |
| `Reviewer Agent` | `docs/README.md`, `docs/state/RECENT_CONTEXT.md`, Spec 008 files |
| `Planning Agent` | `docs/README.md`, active audit/spec docs |
| `Research / Documentation Agent` | `docs/README.md`, `docs/decisions/ADR-001-documentation-system.md` |
| `Contract Agent` | active audits and Spec 008 |

This matters because `AGENTS.md` explicitly says neutral role names only. Either the role table is too small, or the docs are using stale/non-canonical roles.

Recommendation:

- Either add officially approved neutral roles to `AGENTS.md`, or normalize the active docs to the existing six-role table.
- For documentation/audit/spec work, the safest current mapping is `Orchestrator Agent` unless the user adds a dedicated Documentation role.

### P2 - Active Spec 008 is structurally useful but stale after Phase 4-6

`specs/008-structure-remediation-roadmap/` is still the active spec folder, but several files inside it describe the pre-consolidation world where old control docs were still long active documents.

Examples:

- `README.md` still says `the legacy layer-registry filename (now retired)` is authoritative.
- `spec.md` still lists old control docs as source documents.
- `repository-skeleton.md` still marks old control docs as `[KEEP]`.
- `documentation-context-compression-research.md` and `documentation-architecture-compression-plan.md` are useful historical planning evidence, but their recommendations have partly been implemented.

Recommendation:

- Add a short "Status after Phase 6" note to Spec 008 README.
- Mark the research/plan files as pre-consolidation evidence.
- Update the active implementation guidance in `spec.md`, `plan.md`, `tasks.md`, and `repository-skeleton.md` to point to `PROJECT_RULES.md` and `LAYER_AND_DATA_CONTRACT.md`.

### P2 - Source-catalog docs are mostly well placed, but Layer 06 does not explicitly declare layer identity

The source-catalog documents under `packages/source-catalog/layers/` are correctly colocated with source catalog ownership. Weather docs are stronger than maritime docs.

Layer 07 Weather source docs include explicit layer identity in the README:

- `packages/source-catalog/layers/layer_07_weather/README.md`

Layer 06 Maritime docs are in the correct folder, but the scanned Markdown files generally do not include an explicit `Layer ID | layer_06_maritime` metadata table. The path implies the layer, but the project hard rules say every source must declare which layer it belongs to.

Affected examples:

- `packages/source-catalog/layers/layer_06_maritime/README.md`
- `packages/source-catalog/layers/layer_06_maritime/source_decisions.md`
- `packages/source-catalog/layers/layer_06_maritime/message_field_mapping.md`
- `packages/source-catalog/layers/layer_06_maritime/sample_subscriptions.md`
- `packages/source-catalog/layers/layer_06_maritime/maritime_source_research_summary.md`

Recommendation:

- Add a small "Layer Identity" table to the Layer 06 README and source decision docs:
  - Layer ID: `layer_06_maritime`
  - Source ID: `aisstream`
  - Source family: AIS maritime source family
  - Status: current source decision/proof status

### P2 - Exact duplicate files exist, but most are intentional retired stubs

Exact duplicate normalized-content groups:

| Duplicate group | Assessment |
|-----------------|------------|
| `docs/control/DATA_LOCATION_RULES.md`, `docs/control/ENGINEERING_STRUCTURE_RULES.md`, `docs/control/PIPELINE_HANDOFF_RULES.md` | Intentional retired pointer stubs to `PROJECT_RULES.md`. Low risk, but repetitive. |
| `docs/control/LAYER_ARCHITECTURE.md`, `docs/control/LLM_OWNERSHIP_MATRIX.md`, `docs/control/the legacy layer-registry filename (now retired)`, `docs/control/SOURCE_TO_FRONTEND_CONTRACT.md` | Intentional retired pointer stubs to `LAYER_AND_DATA_CONTRACT.md`. Low risk, but repetitive. |

Near-duplicates:

- `.kiro/prompts/speckit.git.*.md` and `.specify/extensions/git/commands/speckit.git.*.md` have 0.88-0.92 shingle similarity for matching command files.

Assessment:

- The duplicate control stubs are acceptable if the team wants discoverable "do not use" pointers.
- The `.kiro`/`.specify` duplicates appear to be tool-template mirrors, not active project control docs.

Recommendation:

- Keep retired stubs for now.
- If context reduction is still a priority, consider moving retired stubs to archive after every active reference is fixed, but only through a dedicated documentation cleanup task.

### P2 - `docs/state/HANDOFF_LOG.md` contains historical encoding corruption

A codepoint scan for common mojibake markers found only three files with real suspicious codepoints:

| File | Count | Assessment |
|------|------:|------------|
| `docs/state/HANDOFF_LOG.md` | 1130 | Historical append-only log contains corrupted sequences from older entries. |
| `docs/archive/2026-06-14-documentation-cleanup/reports/WO-078E-borders-boundaries-frontend.md` | 9 | Archived historical report. |
| `docs/archive/2026-06-14-spec-kit-alignment/old-work-orders/WO-078E-borders-boundaries-frontend.md` | 1 | Archived historical work order. |

Assessment:

- Do not rewrite old `HANDOFF_LOG.md` entries just to repair encoding; the log is append-only.
- New entries should stay ASCII or clean UTF-8.

Recommendation:

- Add a future audit note if the historical log becomes hard to search.
- Avoid Unicode status glyphs in new handoff entries; use `PASS`, `FAIL`, `NEEDS REVIEW`.

### P3 - Classification is path-based, not consistently self-declared

`docs/README.md` defines document classifications, but many active docs do not include a self-declared `Classification:` field.

This is not necessarily a hard violation because classification can be inferred from path, but it makes audits harder.

Examples without explicit classification labels:

- `docs/control/PROJECT_RULES.md`
- `docs/control/LAYER_AND_DATA_CONTRACT.md`
- `docs/control/GIT_WORKFLOW_POLICY.md`
- `docs/state/CURRENT_PROJECT_STATE.md`
- `docs/state/RECENT_CONTEXT.md`
- active Spec 008 files except where indirectly described by the spec workspace guide

Recommendation:

- Add a standard one-line classification block to active docs over time:
  - `Classification: ACTIVE_RULE`
  - `Classification: CURRENT_STATE`
  - `Classification: APPEND_ONLY_LOG`
  - `Classification: SPEC`, `PLAN`, `TASK_LIST`, etc.

### P3 - Spelling drift: normalize vs normalise

The repo mostly uses American spelling in code and role names:

- Normalizer Agent
- normalizer
- normalization
- normalized

Active docs still include British spelling in a few places:

- `docs/control/PROJECT_RULES.md`: "Never normalise from an ephemeral stream."
- `docs/control/LAYER_AND_DATA_CONTRACT.md`: "Normalised data flows into the database."
- `specs/008-structure-remediation-roadmap/documentation-context-compression-research.md`: "normalising"

Recommendation:

- Standardize active docs on `normalize`, `normalized`, `normalizing`, and `normalization`.

## Structure Assessment by Area

### Root

Root-level docs are acceptable:

- `AGENTS.md` is the agent entry point.
- `CLAUDE.md` is a local adapter note, not an active control document.
- `requirements-data.txt` is a dependency list, not prose documentation.

Potential improvement:

- A root `README.md` could point humans to `docs/README.md` and `AGENTS.md`, but current project docs intentionally use `docs/README.md` as the human map.

### `docs/control/`

Mostly correct target structure, but needs cleanup.

Correct:

- `PROJECT_RULES.md` consolidates engineering rules.
- `LAYER_AND_DATA_CONTRACT.md` consolidates layer registry, ownership, and source contract.
- Old control files are short retired pointer stubs.

Incorrect or stale:

- `PROJECT_RULES.md` still points to `the legacy layer-registry filename (now retired)`.
- `GIT_WORKFLOW_POLICY.md` still points to `LLM_OWNERSHIP_MATRIX.md`.
- `WORK_ORDER_TEMPLATE.md` still requests model/tool metadata.

### `docs/state/`

Correct structure overall:

- `CURRENT_PROJECT_STATE.md` is a current-state snapshot.
- `RECENT_CONTEXT.md` is a short rolling context.
- `HANDOFF_LOG.md` is append-only.

Issues:

- `CURRENT_PROJECT_STATE.md` has authority drift.
- `RECENT_CONTEXT.md` currently includes non-neutral role names from recent entries.
- `HANDOFF_LOG.md` has historical model/tool names and encoding corruption; because it is append-only, repair should be additive, not rewriting old entries.

### `docs/audits/`

Correct placement for audit evidence.

Issues:

- Existing active audits contain some stale references to retired docs and old role names. Since audits are evidence rather than active instructions, these are lower risk than control-doc drift.

### `docs/archive/`

Correctly used for historical/superseded content.

Notes:

- Archive contains many old model/tool names, old layer language, and old work-order formats. This is acceptable as historical evidence.
- The archive has a `_DO_NOT_READ.md` fence, which matches the active reading policy.

### `specs/`

Correct high-level structure:

- Only active spec is `specs/008-structure-remediation-roadmap/`.
- Implemented specs 001-007 are archived.

Issue:

- Spec 008 content needs a post-consolidation refresh.

### Layer-local docs in `packages/`, `services/`, `database/`, and `tests/`

Mostly acceptable.

Correct:

- Source-catalog docs live with `packages/source-catalog/layers/<layer_id>/`.
- Weather fetcher docs live with `services/fetch-orchestrator/src/layers/layer_07_weather/`.
- Test fixture report lives under `tests/data/layer_06_maritime/...`.

Needs improvement:

- Layer 06 maritime source docs should explicitly declare `layer_id` and source identity.

### `.kiro/` and `.specify/`

These are not covered by `docs/README.md` classifications. They appear to be tooling prompt/template packs, not project governance docs.

Recommendation:

- Leave them out of project documentation governance, or add a short note in `docs/README.md` that `.kiro/` and `.specify/` are tool/template directories and are not active GOD EYES control documents.

## Terminology Verdict

Correct canonical terms:

- `layer_00_globe_core`
- `layer_01_aviation`
- `layer_02_borders_boundaries`
- `layer_03_earth_events`
- `layer_04_public_military_security` as `coming_soon`
- `layer_05_space_satellites`
- `layer_06_maritime`
- `layer_07_weather`
- `layer_08_news_osint`
- `layer_09_user_shapes` as `coming_soon`
- `layer_10_energy_infrastructure`

Stale layer term:

- `layer_07_infrastructure` appears in active docs only as a negative/guard reference or in audit evidence, not as an active registry value. The historical append-only log still contains stale references.

Terminology needing correction:

- Replace retired authority names in active docs.
- Replace non-neutral role names or update the official role table.
- Remove model/tool metadata from active templates.
- Standardize `normalise/normalised/normalising` to `normalize/normalized/normalizing`.

## Recommended Cleanup Order

1. Fix P1 authority drift in `PROJECT_RULES.md`, `CURRENT_PROJECT_STATE.md`, `GIT_WORKFLOW_POLICY.md`, and `WORK_ORDER_TEMPLATE.md`.
2. Fix `WORK_ORDER_TEMPLATE.md` to remove model/tool metadata.
3. Decide whether `Reviewer Agent`, `Documentation Agent`, `Planning Agent`, and `Contract Agent` are official neutral roles. If yes, add them to `AGENTS.md`; if no, normalize active docs to the existing roles.
4. Refresh active Spec 008 files to reflect the current consolidated control docs.
5. Add explicit Layer Identity tables to Layer 06 maritime source-catalog docs.
6. Add classification lines to active docs over time.
7. Leave archive/historical documents untouched unless a dedicated cleanup task is approved.

## Bottom Line

The documentation system is directionally correct but not yet internally consistent.

The main problem is not document location. Most documents are in reasonable folders. The main problem is stale active language left behind after the control-doc consolidation. Fixing the P1 items would remove most agent-confusing drift without touching archived history or rewriting old logs.

