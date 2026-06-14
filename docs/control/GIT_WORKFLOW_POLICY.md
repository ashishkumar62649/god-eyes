# Git Workflow Policy

## Overview

GOD EYES uses a controlled Git workflow where worker agents create local commits, and the
Orchestrator Agent reviews and pushes to remote after verification. The cycle is:
**Build → Review/Test → Push → Next.**

Neutral role names used throughout this document:
Orchestrator Agent, Frontend Agent, API Agent, Fetcher Agent, Normalizer Agent,
Database Agent, Review Agent, Integration Agent, Contract Agent, Worker Agent.

## Worker Agents

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

Agent: <neutral role name>
Work order: <WO-NNN or "alignment">
Branch: <branch name>
Summary: <what was done>
Commands run: <build, test, etc.>
Known issues: <any blockers or "none">
Forbidden folders touched: yes/no
Secrets added: yes/no
```

Do not record model, provider, assistant, or tool product names in commit messages.
Use neutral role names only.

**Example:**

```
feat(web): add minimal Cesium globe foundation

Agent: Frontend Agent
Work order: WO-001
Branch: frontend/wo-001/layer-00-globe-core
Summary: Vite + React + CesiumJS app with token error handling
Commands run: pnpm install, pnpm --filter web build
Known issues: none
Forbidden folders touched: no
Secrets added: no
```

## Orchestrator Agent — Review & Push Gatekeeper

### Responsibilities

- Review all agent work
- Run integration checks
- Verify security/privacy
- Create `docs/state/INTEGRATION_REVIEW_[WO].md` during active work.
  Completed reviews are archived under `docs/archive/`.
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

- [ ] Frontend Agent only edited: `apps/web/`, `packages/ui/`, `packages/layers/`
- [ ] Fetcher Agent only edited: `services/fetch-orchestrator/`, `packages/source-catalog/`
- [ ] Normalizer Agent only edited: `services/normalizer/`
- [ ] Database Agent only edited: `database/`, `packages/schemas/`, `tests/data/`
- [ ] API Agent only edited: `apps/api/`, `packages/contracts/`, `packages/auth/`, `tests/api/`
- [ ] Orchestrator Agent only edited: `docs/`, `specs/` (unless explicitly asked)

#### 3. Required Checks

**Frontend:**
```bash
pnpm --filter web build
pnpm --filter web test
```

**API + Contracts:**
```bash
pnpm --filter @god-eyes/contracts build
pnpm --filter api build
pnpm --filter api test
```

**Data/Database:**
```bash
python -m pytest tests/data -q
```

#### 4. Security/Privacy Check

- [ ] No real API keys committed
- [ ] No Cesium token committed
- [ ] No `.env` committed
- [ ] No secrets in docs or logs
- [ ] No credentials in commit messages
- [ ] No private raw data committed

#### 5. Review Document

Create: `docs/state/INTEGRATION_REVIEW_[WORK_ORDER].md` (completed reviews are archived)

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
4. Append a push record to `HANDOFF_LOG.md` (branch, commit hash, review file, checks, risks).

**If Review = FAIL or NEEDS REVIEW:**

1. Do NOT push
2. Write clear issues in the review document
3. Provide fix instructions
4. Return to the worker agent for revision

**Protected Rule:**

- Never push directly to `main` unless the project owner explicitly approves.
- Always push to a feature/agent branch first.
- Require review before any main merge.

## Branch Naming Convention

```
<role>/<work-order>/<short-name>
```

Examples:
- `frontend/wo-001/layer-00-globe-core`
- `fetcher/wo-002/aviation-airports`
- `api/wo-003/fastify-api-scaffold`
- `orchestrator/review/wo-001-integration`

## Workflow Diagram

```
Worker Agent creates local commit
    ↓
Worker Agent updates HANDOFF_LOG.md
    ↓
Orchestrator Agent reviews work
    ↓
Orchestrator Agent creates INTEGRATION_REVIEW_[WO].md (archived after completion)
    ↓
Review = PASS?
    ├─ YES → Orchestrator Agent pushes branch to origin
    │         Orchestrator Agent updates HANDOFF_LOG.md with push record
    │         Complete
    │
    └─ NO → Orchestrator Agent documents issues
            Returns to worker agent for fixes
            Worker agent revises and commits again
            Loop back to review
```

## Security Checklist

Before every push, the Orchestrator Agent must verify:

- [ ] No `.env` files committed
- [ ] No real API keys in code
- [ ] No Cesium token in code
- [ ] No credentials in commit messages
- [ ] No secrets in docs
- [ ] No `node_modules/` committed
- [ ] No `.venv/` or `__pycache__/` committed
- [ ] No private raw data committed
- [ ] All changes are from the assigned work order
- [ ] No unrelated changes mixed in

## PR / Merge Policy

This project does **not** create a PR for every small local correction. A single PR
represents one **completed work package** after the Reviewer Agent decision is PASS.
The user is the only role that pushes branches, opens PRs, merges PRs, and deletes
branches.

### Rules

1. Do not create a PR for every small local correction.
2. A branch may contain multiple local commits during one work package.
3. Required fixes after review should usually stay on the same branch and be
   re-checked by the Reviewer Agent.
4. Create one PR only when the full work package is complete and the Reviewer Agent
   decision is PASS.
5. A PR is required before anything reaches `main`.
6. A PR is required for completed features, refactors, audits, control-doc changes,
   database migrations, API contracts, and cross-lane work.
7. A PR is not required for small local corrections before the work package is
   complete.
8. Agents never push, open PRs, merge, or delete branches.
9. The user handles push, PR creation, merge, and branch deletion.

### Work package branch workflow

A work package branch typically looks like:

- local commit 1
- review
- required fix commit if needed
- reviewer re-check
- final PASS
- user pushes branch
- user opens one PR for the whole completed work package
- user merges after approval
- user deletes branch if desired

The "small local correction" rule is intentional: pushing and opening a PR is a
human-facing event. The user decides when a work package is ready to be exposed as a
PR. Agents must not bypass this rule by opening a PR "for convenience" or by pushing
a branch on their own.

### What this means for each role

- **Worker agents** (Frontend, API, Fetcher, Normalizer, Database, Contract, Research,
  Documentation, etc.) — create local commits on the work-package branch; update
  `HANDOFF_LOG.md`; do not push; do not open PRs; do not merge; do not delete
  branches.
- **Reviewer / Integration Agent** — review the branch; if PASS, hand off to the
  user; if FAIL or NEEDS REVIEW, request fixes on the same branch. The reviewer does
  not push, open, merge, or delete.
- **Orchestrator Agent** — coordinates the workflow and resolves cross-agent
  conflicts. The Orchestrator Agent does not push to `main` directly and does not
  bypass the user's PR/merge authority.
- **User** — the only role that pushes branches, opens PRs, merges PRs, and deletes
  branches after a reviewer PASS.

### PR scope

A single PR must cover one work package, not several unrelated changes. If a branch
has grown to cover more than one work package, split it into multiple branches and
multiple PRs, one per work package. The user will open a separate PR for each.

### What "completed work package" means

A work package is "complete" when:

- All worker-agent tasks are done.
- The Reviewer Agent decision is PASS (or PASS WITH REQUIRED FIXES that are already
  resolved on the same branch).
- All required build, test, and lint checks pass.
- `HANDOFF_LOG.md` has a complete entry for the work package.
- A `docs/state/INTEGRATION_REVIEW_*.md` (or equivalent review record, or archived review) exists with
  a PASS decision.

Only then may the user push, open a PR, and merge.

---

## Rollback Procedure

If a pushed commit introduces critical issues:

1. Identify the issue.
2. Create a revert commit: `git revert <commit-hash>`
3. Push the revert: `git push origin <branch>`
4. Document in `HANDOFF_LOG.md`.
5. Notify the responsible worker agent to fix and re-submit.

## Questions or Clarifications

If any agent is unclear about the Git workflow:

1. Write a question in `HANDOFF_LOG.md`.
2. Do NOT guess or proceed without clarity.
3. Wait for the Orchestrator Agent to respond.
4. The Orchestrator Agent updates this policy if needed.
