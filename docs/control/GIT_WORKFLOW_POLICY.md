# Git Workflow Policy

## Overview

GOD EYES uses a controlled Git workflow where worker agents (Gemini, Codex, Claude Code) create local commits, and Kiro CLI reviews and pushes to remote after verification.

## Worker Agents (Gemini, Codex, Claude Code)

### Allowed Actions

- Inspect repository (read-only)
- Edit only allowed folders per `LLM_OWNERSHIP_MATRIX.md`
- Run required build/test checks
- Update `docs/state/HANDOFF_LOG.md`
- Create one local commit after completing assigned work

### Forbidden Actions

- Push to remote
- Push to main
- Modify protected branches
- Commit secrets, API keys, or tokens
- Commit `node_modules/`, `.env`, `.venv/`, `__pycache__/`
- Touch forbidden folders
- Mix unrelated work into one commit

### Commit Message Format

```
<type>(<area>): <short description>

Agent: <agent name>
Work order: <WO-NNN>
LLM model: <model name or "not reported">
Tool/CLI used: <tool name>
Branch: <branch name>
Start time UTC: <YYYY-MM-DDTHH:MM:SSZ or "unknown">
End time UTC: <YYYY-MM-DDTHH:MM:SSZ or "unknown">
Summary: <what was done>
Commands run: <build, test, etc.>
Known issues: <any blockers>
Forbidden folders touched: yes/no
```

**Examples:**

```
feat(web): add minimal Cesium globe foundation

Agent: Gemini CLI
Work order: WO-001
Summary: Created Vite + React + CesiumJS app with token error handling
Commands run: pnpm install, pnpm build, pnpm dev
Known issues: Tailwind CSS not installed (acceptable for MVP)
Forbidden folders touched: no
```

```
feat(data): add OurAirports collector and normalizer

Agent: Codex
Work order: WO-002
Summary: Python collector for OurAirports CSV, Pydantic Airport model, airports table migration
Commands run: pytest, alembic upgrade head
Known issues: None
Forbidden folders touched: no
```

## Kiro CLI — Review & Push Gatekeeper

### Responsibilities

- Review all agent work
- Run integration checks
- Verify security/privacy
- Create `docs/state/INTEGRATION_REVIEW_[WO].md`
- Push approved branches to remote
- Update `HANDOFF_LOG.md` with push record

### Pre-Push Verification Checklist

#### 1. Git Status

```bash
git status
```

Verify:
- [ ] No unexpected files
- [ ] No `node_modules/`
- [ ] No `.env` files
- [ ] No `.venv/` or `__pycache__/`
- [ ] No secrets in staged changes
- [ ] Only expected files from work order

#### 2. Folder Boundaries

- [ ] Gemini only edited: `apps/web/`, `packages/ui/`, `packages/layers/`
- [ ] Codex only edited: `services/`, `packages/source-catalog/`, `packages/schemas/`, `database/`, `tests/data/`
- [ ] Claude Code only edited: `apps/api/`, `packages/contracts/`, `packages/auth/`, `tests/api/`
- [ ] Kiro only edited: `docs/`, `specs/` (unless explicitly asked)

#### 3. Required Checks

**Frontend (Gemini):**
```bash
pnpm --filter web build
pnpm --filter web test  # if available
```

**API (Claude Code):**
```bash
pnpm --filter api build  # if available
pnpm --filter api test   # if available
```

**Data/Database (Codex):**
```bash
pytest                   # if available
alembic upgrade head     # if available
```

#### 4. Security/Privacy Check

- [ ] No real API keys committed
- [ ] No Cesium token committed
- [ ] No `.env` committed
- [ ] No secrets in docs or logs
- [ ] No credentials in commit messages
- [ ] No private raw data committed

#### 5. Review Document

Create: `docs/state/INTEGRATION_REVIEW_[WORK_ORDER].md`

Include:
- PASS / FAIL / NEEDS REVIEW status
- Commands run and results
- Files reviewed
- Folder boundary verification
- Security/privacy verification
- Known issues
- Final decision

### Push Rules

**If Review = PASS:**

1. Verify branch name: `git branch`
2. Push to origin: `git push origin <branch-name>`
3. Include branch name in review document
4. Append to `HANDOFF_LOG.md`:
   ```
   ### [DATE] Kiro CLI — Pushed [WORK_ORDER]
   - Branch: <branch-name>
   - Commit: <hash>
   - Review: docs/state/INTEGRATION_REVIEW_[WO].md
   - Checks passed: [list]
   - Remaining risks: [list or none]
   ```

**If Review = FAIL or NEEDS REVIEW:**

1. Do NOT push
2. Write clear issues in review document
3. Provide fix instructions
4. Return to agent for revision

**Protected Rule:**

- Never push directly to `main` unless project owner explicitly approves
- Always push to feature/agent branch first
- Require review before any main merge

## Commit Message Examples

### Frontend

```
feat(web): add minimal Cesium globe foundation

Agent: Gemini CLI
Work order: WO-001
LLM model: Gemini 2.0
Tool/CLI used: kiro-cli chat
Branch: agent/gemini-layer0-globe
Start time UTC: 2026-05-14T10:00:00Z
End time UTC: 2026-05-14T11:30:00Z
Summary: Initialized Vite + React + CesiumJS app with token error handling and minimal UI
Commands run: pnpm install, pnpm --filter web build, pnpm --filter web dev
Known issues: Tailwind CSS not installed (acceptable for MVP), version pinning uses ^ (will fix)
Forbidden folders touched: no
```

### Data Pipeline

```
feat(data): add OurAirports collector and airports table

Agent: Codex
Work order: WO-002
LLM model: Claude 3.5 Sonnet
Tool/CLI used: kiro-cli chat
Branch: agent/codex-ourairports-collector
Start time UTC: 2026-05-14T12:00:00Z
End time UTC: 2026-05-14T14:15:00Z
Summary: Python collector for OurAirports CSV, Pydantic Airport model, Alembic migration for airports table
Commands run: pytest, alembic upgrade head
Known issues: None
Forbidden folders touched: no
```

### API

```
feat(api): add Fastify health endpoint and layer routes

Agent: Claude Code CLI
Work order: WO-003
LLM model: Claude 3.5 Sonnet
Tool/CLI used: kiro-cli chat
Branch: agent/claude-fastify-api
Start time UTC: 2026-05-14T15:00:00Z
End time UTC: 2026-05-14T16:45:00Z
Summary: Fastify server scaffold with health endpoint, layer list, and airport endpoint contracts
Commands run: pnpm --filter api build, pnpm --filter api test
Known issues: No real database connection (mock/stub only)
Forbidden folders touched: no
```

### Kiro Review & Push

```
docs(kiro): review and push WO-001 Layer 0 globe foundation

Agent: Kiro CLI
Work order: WO-001
LLM model: Claude 3.5 Sonnet
Tool/CLI used: kiro-cli chat
Branch: agent/gemini-layer0-globe
Review start time UTC: 2026-05-14T17:00:00Z
Review end time UTC: 2026-05-14T17:30:00Z
Commit reviewed: abc1234
Push decision: PASS
Branch pushed: agent/gemini-layer0-globe
Summary: Reviewed Gemini Layer 0 output, verified stack compliance, token safety, folder boundaries. Approved for push.
Commands run: pnpm --filter web build, git status, security scan
Known issues: Version pinning uses ^ (must fix before merge)
Forbidden folders touched: no
```

## Branch Naming Convention

```
<agent>/<work-order>/<short-name>
```

Examples:
- `gemini/wo-001/layer-00-globe-core`
- `codex/wo-002/aviation-airports`
- `claude/wo-003/fastify-api-scaffold`
- `kiro/review/wo-001-integration`

## Workflow Diagram

```
Agent creates local commit
    ↓
Agent updates HANDOFF_LOG.md
    ↓
Kiro reviews work
    ↓
Kiro creates INTEGRATION_REVIEW_[WO].md
    ↓
Review = PASS?
    ├─ YES → Kiro pushes branch to origin
    │         Kiro updates HANDOFF_LOG.md with push record
    │         ✅ Complete
    │
    └─ NO → Kiro documents issues
            Kiro returns to agent for fixes
            Agent revises and commits again
            Loop back to review
```

## Security Checklist

Before every push, Kiro must verify:

- [ ] No `.env` files committed
- [ ] No real API keys in code
- [ ] No Cesium token in code
- [ ] No credentials in commit messages
- [ ] No secrets in docs
- [ ] No `node_modules/` committed
- [ ] No `.venv/` or `__pycache__/` committed
- [ ] No private raw data committed
- [ ] All changes are from assigned work order
- [ ] No unrelated changes mixed in

## Rollback Procedure

If a pushed commit introduces critical issues:

1. Kiro identifies the issue
2. Kiro creates a revert commit: `git revert <commit-hash>`
3. Kiro pushes the revert: `git push origin <branch>`
4. Kiro documents in `HANDOFF_LOG.md`
5. Agent is notified to fix and re-submit

## Questions or Clarifications

If any agent is unclear about Git workflow:

1. Write a question in `HANDOFF_LOG.md`
2. Do NOT guess or proceed without clarity
3. Wait for Kiro to respond
4. Kiro updates this policy if needed
