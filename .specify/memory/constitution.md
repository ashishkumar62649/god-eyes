# GOD EYES Constitution

This Constitution defines the non-negotiable principles that govern all code, configuration, data, and agent behavior in the GOD EYES project. It supersedes ad-hoc decisions. The authoritative source of truth for layer IDs and layer order remains `docs/control/PROJECT_CONTROL.md` Part 2 §4.

Classification: ACTIVE_PRINCIPLES
Version: 1.3.0
Ratified: 2026-06-05
Last Amended: 2026-06-16
Docs-only clarification applied 2026-06-17 (WO-001): §II rewritten to mark `packages/ui/`, `packages/layers/`, `packages/auth/` as planned/future, not currently present. No principle changed; no version bump.

### Amendment History

- **1.3.0 (2026-06-16) — Structure consolidation.** All engineering rules,
  layer registry, ownership matrix, source/data contract, Git workflow, and
  work-order template were merged into a single active project control file
  at `docs/control/PROJECT_CONTROL.md` (4 parts). The earlier active control
  filenames (`PROJECT_RULES.md`, `LAYER_AND_DATA_CONTRACT.md`,
  `GIT_WORKFLOW_POLICY.md`, `WORK_ORDER_TEMPLATE.md`, the legacy layer-registry filename (now retired),
  `LAYER_ID_CONVENTIONS.md`, `LAYER_ARCHITECTURE.md`, `LLM_OWNERSHIP_MATRIX.md`,
  `SOURCE_TO_FRONTEND_CONTRACT.md`, `ENGINEERING_STRUCTURE_RULES.md`,
  `DATA_LOCATION_RULES.md`, `PIPELINE_HANDOFF_RULES.md`) are retired. `AGENTS.md`
  was de-duplicated to a pure entry-point pointer. Principle VIII (Human and
  Agent Readability) was strengthened by removing duplicate active rules.
- **1.2.0 (2026-06-16) — Spec Kit alignment.** Constitution rewritten in the
  Spec Kit principles/governance form.
- **1.1.0 and earlier** — pre-Spec-Kit governance and engineering rulebook
  drafts. Preserved in Git history.

## Authority

## Preamble — Current Implementation Focus

The current project phase is the **initial implementation** build. The goal: take data from a **provider or organization** that has the data, **fetch and store** it in the database, **normalize** it, expose it through the **API**, and render it on the **frontend**. Not everything is organized yet. The current build must just work. The Constitution applies to all layers in principle; layers that are already implemented will be brought into compliance **after the current implementation phase**.

---

## Core Principles

### I. Layer Integrity (NON-NEGOTIABLE)
Every entity in GOD EYES — data source, database table, API route, frontend component, fetch job, normalizer — must declare which `layer_id` it belongs to. No orphans. Every layer has a unique `layer_id` and authoritative entry in the layer registry. The layer order in `docs/control/PROJECT_CONTROL.md` Part 2 §4 is binding; if any document or code disagrees with the registry, the registry wins.

### II. Strict Agent Boundaries (NON-NEGOTIABLE)
Frontend code lives in `apps/web/`. API code lives in `apps/api/`, `packages/contracts/`. Data pipeline lives in `services/`, `packages/source-catalog/`, `packages/schemas/`. Database lives in `database/`. The following package folders are referenced historically but are **planned / future, not currently present** in the repository: `packages/ui/`, `packages/layers/` (planned for Frontend Agent), `packages/auth/` (planned for API Agent). See `AGENTS.md` and `docs/control/PROJECT_CONTROL.md` Part 2 §8 for the authoritative ownership matrix. **Frontend never connects directly to the database** — it must call the API. The API is the only component that talks to the database.

### III. Data Provenance and Pipeline Order
Fetchers always store **raw data first** (path includes `layer_id` and `source_id` per the canonical data-location rules in `docs/control/PROJECT_CONTROL.md` Part 1 §13), then normalizers read raw object metadata (never random files) to produce normalized records. Raw storage is immutable; normalization is reproducible. For the current implementation phase, this means: pull from provider → write raw to disk → normalize → write to DB.

### IV. Secrets and Configuration Safety
Real API keys and credentials **must never be committed**. `.env.example` files contain placeholders only. Production secrets are injected at runtime via environment variables or secret managers. BYOK (Bring Your Own Key) sources require user-provided keys at runtime, never in code.

### V. Two-Phase Review (NON-NEGOTIABLE)
No code reaches the main `E:\god-eyes\` folder or the GitHub remote without:
1. A **local commit by the worker agent** in a cloned worktree, following the commit format with full handoff metadata
2. A **review by Mimo V2.5** in a second VS Code terminal opened in the same worktree folder
3. A **merge into the main folder** (local)
4. **Kiro CLI pushes to GitHub** after integration review

Worker agents do not push. Mimo does not commit worker code. Kiro does not author code.

### VI. Handoff Traceability
Every work order produces a handoff entry in `docs/state/HANDOFF_LOG.md` with: Work order ID, Agent, LLM model, Tool/CLI used, Branch, Start time UTC, End time UTC, Commit hash, Push status, Files changed, Commands run, Review status. The handoff log is the audit trail of GOD EYES. No work is "done" until its handoff is logged.

### VII. Spec-Driven Development
New features and layers use the Spec-Kit workflow: `constitution` → `specify` → `clarify` → `plan` → `tasks` → `analyze` → `implement`. Specifications live in `specs/NNN-feature-name/` and contain `spec.md`, `plan.md`, `tasks.md` at minimum. The `NNN` prefix is a zero-padded sequential number.

### VIII. Test-First and Scope-Guard Discipline (NON-NEGOTIABLE)
Tests are written before or alongside implementation. Scope-guard tests verify that a worker's changes do not bleed outside its assigned folder. Pre-merge diff checks must pass. Failing tests or scope-guard violations block the merge, not the commit. The current build adopts the **progressive integration workflow** (see Section 3) where each lane is tested in isolation before merge, and the full system is tested after all merges.

### IX. Source and Safety Discipline
Every data source is registered in the source catalog with a layer assignment. Sources that handle user-generated content (news, OSINT) must implement: source attribution, content moderation rules, no private data, no doxxing, no targeting. Sources are open-source-first; BYOK is the optional path for premium sources.

---

## Section 2: Tooling Governance

- **Approved agent frameworks**: Kiro CLI (orchestrator), Mimo V2.5 (reviewer), worker CLIs running their assigned models (Gemini 3.5 Flash, Sonnet 4.6, DeepSeek V4, MiniMax M3). Tools that auto-install hooks, MCP servers, agents, or configuration files into the repo root are **not approved** without an explicit work order and review.
- **Approved MCP servers** (no cap on count): graphify (knowledge graph), Context7 (live library docs), Filesystem (structured file ops with allowed paths). Others require work-order approval.
- **Approved skills**: graphify, spec-kit extensions. New skills require work-order approval.
- **MCP configs live in user-level `~/.config/opencode/opencode.jsonc`**, never in the project's `.opencode/opencode.json`. Reason: a project's `opencode.json` is auto-executed on clone by anyone who runs opencode in that folder, which is a security risk for any `mcp.command` array.
- **Approved version control**: Git, pnpm workspaces, Docker Compose. No new infrastructure tools without a work order.

---

## Section 3: Development Workflow

### Per-Lane Work Order Lifecycle (Progressive Integration)

The current build uses a **progressive integration** workflow. Each lane is tested in isolation, merged to the local main folder, and then the full system is tested after all lanes merge.

1. Kiro creates a work order in `docs/work-orders/WO-XXX-{name}.md` listing scope, allowed folders, deliverables, and worker assignment.
2. The assigned worker opens a cloned worktree (e.g. `E:\god-eyes-{lane}\`) on a branch `agent/wo-XXX-{lane}-{name}`.
3. The worker does the work in **terminal 1** of VS Code, restricted to its assigned folders, writes tests (Test-First), then writes the implementation.
4. The worker runs the per-lane tests. If tests pass, the worker makes a **local commit** with the required commit message format.
5. The worker opens **terminal 2 in the same worktree** (split in VS Code) and runs **Mimo V2.5** to review the diff, the tests, and the handoff log.
6. After Mimo approves, the worker **merges the worktree branch into the main `E:\god-eyes\` folder** (local — not GitHub).
7. The next lane repeats steps 1–6.

### Full Integration Test (After All Lanes Merge)

8. After all lanes are merged, the user (or Kiro) runs a **full integration test** of the combined system in the local main folder.
9. **If the full test passes**: Kiro runs the integration review, creates `docs/state/INTEGRATION_REVIEW_WO-XXX.md`, and pushes to GitHub. The handoff log entry is the final closure artifact.
10. **If the full test fails**:
    - **Localize the failure** to a specific lane (e.g., "database is not working properly in the main folder").
    - **Return to the individual lane worktree** (e.g., `E:\god-eyes-db\`).
    - **Patch the bug** in the worktree, re-run the per-lane tests, re-commit, re-merge to main.
    - **Re-run the full integration test**.
    - **If still failing**: investigate cross-lane synchronization (contract mismatches, schema mismatches, integration points). Get a report. Patch the specific layer; if the issue is cross-cutting and not in any lane's scope, it can be patched directly in the main root folder.

### Commit Message Format
`<type>(<area>): <description>`
Required footer fields: Agent, Work Order, LLM model, Tool/CLI used, Branch, Start time UTC, End time UTC, Summary, Commands, Known Issues, Forbidden Folders.

### Time Standard
All handoff and commit timestamps are in **UTC**. Local time is for humans only.

---

## Section 4: Quality Gates and Review

- **Pre-commit**: Worker self-checks diff is within allowed folders (per scope-guard tests).
- **Pre-merge**: Mimo review must produce a clear PASS / FAIL verdict with reasons.
- **Pre-push**: Kiro integration review must produce `INTEGRATION_REVIEW_WO-XXX.md` and verify handoff log completeness.
- **Post-merge**: Cross-lane consistency check (layer IDs, source IDs, contract types align).
- **Mimo's review uses both formats**:
  - `/speckit.analyze` for spec-level consistency (does the implementation match the spec?)
  - `docs/state/INTEGRATION_REVIEW_WO-XXX.md` for the final integration review (verdict, files checked, issues found, recommendation)

---

## Section 5: Migration Path For Existing Layers

The Constitution applies to all layers, including those already implemented (Layers 00–04 and any others). Existing layers will be brought into compliance **after the current implementation phase**, in a dedicated work order series. The current build focuses on the **data ingestion pipeline** (provider → fetcher → DB → normalizer → API → frontend) and is not blocked on retrofitting existing layers.

---

## Governance

- This Constitution supersedes all other practices, including individual work orders, except where a work order explicitly grants a documented exception.
- Amendments require: (1) a written proposal, (2) review by Mimo V2.5, (3) approval by the project lead, (4) version bump in the footer, (5) a `Last Amended` date update.
- All PRs and reviews must verify compliance with this Constitution.
- Complexity must be justified in the relevant spec or work order.
