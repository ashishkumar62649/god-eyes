# WO-046-CI-GITHUB-ACTIONS — Add GitHub Actions CI Checks

## Overview
Add GitHub Actions CI workflow to automatically verify the repository on every push and pull request targeting main.

## Scope
- CI only (no deployment, no CD, no secrets)
- Automated test and build verification
- Beginner-readable workflow with clear step names

## Implementation

### Workflow File
- **Location:** `.github/workflows/ci.yml`
- **Triggers:**
  - `pull_request` targeting main
  - `push` to main
  - `workflow_dispatch` (manual trigger)

### CI Checks Included
1. Checkout repository
2. Setup Node.js 20 with pnpm caching
3. Setup pnpm package manager
4. Install JS dependencies with frozen lockfile
5. Setup Python 3.11 with pip caching
6. Install Python test dependencies (pytest, psycopg)
7. Run Python Layer 1 aviation tests: `python -m pytest tests/data/layer_01_aviation -q`
8. Build contracts: `pnpm --filter @god-eyes/contracts build`
9. Build API: `pnpm --filter api build`
10. Build web: `pnpm --filter web build`
11. Run API tests: `pnpm run api:test`
12. Check whitespace: `git diff --check`

### GitHub Actions Used
- `actions/checkout@v4` — Clone repository
- `actions/setup-node@v4` — Setup Node.js with pnpm caching
- `pnpm/action-setup@v2` — Setup pnpm package manager
- `actions/setup-python@v5` — Setup Python with pip caching

## Local Validation Results

All checks pass locally:

```
✓ pnpm --filter @god-eyes/contracts build
✓ pnpm --filter api build
✓ pnpm --filter web build
✓ pnpm run api:test (168 tests passed)
✓ python -m pytest tests/data/layer_01_aviation -q (251 tests passed)
✓ git diff --check (clean)
```

## Design Decisions

1. **Single job approach:** Kept workflow simple with one job instead of matrix for clarity
2. **No database service:** Tests use mocks/fixtures; no live PostgreSQL needed
3. **Frozen lockfile:** Ensures reproducible builds across environments
4. **Python 3.11:** Matches project requirements
5. **Ubuntu runner:** Standard, widely-supported environment
6. **Clear step names:** Each step has descriptive name for readability

## Files Created
- `.github/workflows/ci.yml` — Main CI workflow

## Files Modified
- None

## Known Limitations
- No Docker/Postgres service (not needed for current tests)
- No matrix testing (can be added later if needed)
- No deployment or CD (out of scope)
- No secrets management (not required for CI checks)

## Next Steps
1. Push branch to origin
2. Create pull request to main
3. Verify workflow runs successfully
4. Merge when all checks pass
5. Monitor workflow runs on subsequent pushes

## Related Work Orders
- WO-045-MAIN-FINAL-BOSS-CHECKPOINT — Airport Intelligence Integration Review (completed)
- WO-047-FRONTEND-MAP-POPUP — Frontend Map Popup implementation (next)
