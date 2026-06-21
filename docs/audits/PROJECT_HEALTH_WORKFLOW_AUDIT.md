# GOD EYES — Project Health / Workflow Audit

## Audit Metadata

- **Agent:** Repository Health / Workflow Audit Agent
- **Lane:** Research / Audit
- **Working directory:** `E:\god-eyes`
- **Branch:** `audit/project-health-workflow-review`
- **Base branch (HEAD):** `main` (same commit — `5fea8f2`, alignment merge)
- **Start time (UTC+5:30):** 2026-06-14T15:16:00+05:30
- **End time (UTC+5:30):** 2026-06-14T15:31:00+05:30
- **Worktree clean before audit:** YES (`git status` — clean, no uncommitted changes)

---

## 1. Pre-Audit Command Results

```
git status --short --branch
  ## audit/project-health-workflow-review
  (no output — clean worktree)

git log --oneline --decorate -n 8
  5fea8f2 (HEAD -> audit/project-health-workflow-review, origin/main, origin/HEAD, main)
            Merge pull request #40 from ashishkumar62649/alignment/project-docs-code-registry-fix
  e4305b1 (origin/alignment/project-docs-code-registry-fix, alignment/project-docs-code-registry-fix)
            docs(alignment): add alignment fix review report
  398f711  docs(alignment): record verified clean-tree data-test result
  29e2c49  fix(alignment): align project registries docs and config
  2fe2367  Merge pull request #39 from ashishkumar62649/integration/layer-08-news-osint-complete
  e6f5601  test: install PostgreSQL driver for data tests
  2c0e90e  test(ci): configure Python path for data tests
  8f95ffa  merge Layer 08 News OSINT GDACS and GDELT pipeline

git ls-files .env .env.example apps/web/.env apps/web/.env.example
  .env.example
  apps/web/.env.example

git check-ignore .env apps/web/.env tmp raw .pytest_cache __pycache__ node_modules
  .gitignore:13:.env  → .env (IGNORED)
  .gitignore:16:apps/*/.env  → apps/web/.env (IGNORED)
  .gitignore:34:tmp/  → tmp (IGNORED)
  .gitignore:33:raw/  → raw (IGNORED)
  .gitignore:28:.pytest_cache/  → .pytest_cache (IGNORED)
  .gitignore:2:node_modules/  → node_modules (IGNORED)
  [__pycache__ matches .gitignore:26 globally]

pnpm --filter @god-eyes/contracts build   →  PASS (tsc, no errors)
pnpm --filter api build                   →  PASS (tsc, no errors)
pnpm --filter api test                    →  PASS — 503 tests / 17 files
pnpm --filter web test                    →  PASS — 64 tests / 3 files
pnpm --filter web build                   →  PASS — built in 819ms
python -m pytest tests/data -q (before)  →  PASS — 1159 passed, 15 skipped, 0 failed
```

---

## 2. Files / Areas Inspected

### Core Control / State Documents

- `AGENTS.md`
- `docs/state/CURRENT_PROJECT_STATE.md`
- `docs/state/HANDOFF_LOG.md`
- `docs/control/the legacy layer-registry filename (now retired; canonical is docs/control/PROJECT_CONTROL.md Part 2 �4)`
- `docs/control/LAYER_ARCHITECTURE.md`
- `docs/control/LAYER_ID_CONVENTIONS.md`
- `docs/control/LLM_OWNERSHIP_MATRIX.md`
- `docs/control/PIPELINE_HANDOFF_RULES.md`
- `docs/control/GIT_WORKFLOW_POLICY.md`
- `docs/control/DATA_LOCATION_RULES.md`
- `docs/control/SOURCE_TO_FRONTEND_CONTRACT.md`
- `docs/control/BORDERS_BOUNDARIES_POLICY_SOURCE_PLAN.md`
- `docs/control/BORDERS_BOUNDARIES_IMPLEMENTATION_GATE_REVIEW.md`
- `docs/control/AIRPORT_PUBLIC_ENRICHMENT_PIPELINE.md`
- `docs/control/EARTH_EVENTS_LAYER_PLAN.md` (directory listing)
- `docs/control/the legacy layer-05 contract filename (now archived)`
- `docs/control/the legacy layer-10 contract filename (now archived)`

### Recent Alignment / Audit Docs

- `docs/audits/PROJECT_ALIGNMENT_REPORT.md`
- `docs/audits/PROJECT_ALIGNMENT_FIX_REPORT.md`
- `docs/audits/PROJECT_ALIGNMENT_FIX_REVIEW.md`

### Code Registry Surfaces

- `apps/api/src/routes/layers.ts`
- `apps/web/src/lib/useLayerRegistry.ts`
- `packages/contracts/src/index.ts`

### CI / Config / Dependencies

- `.github/workflows/ci.yml`
- `package.json`
- `pnpm-workspace.yaml`
- `requirements-data.txt`
- `pytest.ini`
- `.env.example`
- `apps/web/.env.example`
- `.gitignore`

### Layer Folder Structures

- `apps/web/src/layers/` (full listing)
- `apps/api/src/routes/` (full listing)
- `services/fetch-orchestrator/src/layers/` (full listing)
- `services/normalizer/src/layers/` (full listing)
- `database/migrations/layers/` (full listing)
- `database/ingestion/layers/` (full listing)
- `tests/data/` (full listing)

### Additional

- `docs/work-orders/` and `docs/reports/` listings
- `docs/state/INTEGRATION_REVIEW_*.md` listing (50+ files)

---

## 3. Validation Summary

| Check | Command | Result |
|-------|---------|--------|
| contracts build | `pnpm --filter @god-eyes/contracts build` | **PASS** |
| api build | `pnpm --filter api build` | **PASS** |
| api test | `pnpm --filter api test` | **PASS** — 503/503, 17 files |
| web test | `pnpm --filter web test` | **PASS** — 64/64, 3 files |
| web build | `pnpm --filter web build` | **PASS** — 819ms |
| data tests (before report) | `python -m pytest tests/data -q` | **PASS** — 1159 passed, 15 skipped |
| git diff --check | (run after commit) | TBD |

---

## 4. Findings

### Critical Findings — NONE

No critical findings remain after the alignment merge. All ALIGN-001 through ALIGN-027
findings from the alignment audit were resolved or accounted for in the prior alignment
pass. The layer registry (API, frontend, docs) is now consistent. All CI gates pass.

---

### High Findings — NONE

No high-severity findings remain. The alignment merge resolved:
- Layer 07 dual identity (ALIGN-001) — fixed
- API registry omitting layer_10 (ALIGN-002) — fixed
- Frontend merge duplicate Layer 7 (ALIGN-003) — fixed
- Layer status divergence (ALIGN-004) — fixed
- `/api/layers` vs `/api/layers/registry` mismatch (ALIGN-026) — fixed
- Status endpoint 404 for non-aviation layers (ALIGN-027) — fixed
- CURRENT_PROJECT_STATE.md stale (ALIGN-005) — fixed

---

### Medium Findings

---

#### HEALTH-001

- **Severity:** MEDIUM
- **Category:** Frontend client configuration
- **File:** `apps/web/src/layers/energy/infrastructure/useEnergyInfrastructure.ts` (line 53)
- **What is wrong:** The energy infrastructure frontend client constructs its API URL with a
  relative path (`/api/energy/infrastructure...`) instead of prepending
  `import.meta.env.VITE_API_BASE_URL`. All other layer clients (weather, news, maritime,
  space, aviation, borders, earth-events) use `VITE_API_BASE_URL` as the base.
- **Why it matters:** When the API is not at the same origin as the Vite dev server (any
  non-localhost deployment, a staging host, or running the frontend standalone), energy
  infrastructure requests will silently hit the wrong origin while all other layers work
  correctly. This inconsistency will confuse a future Frontend Agent implementing or
  debugging energy infrastructure.
- **Recommended action:** Change line 53 of `useEnergyInfrastructure.ts` to:
  `const base = import.meta.env.VITE_API_BASE_URL ?? ''; const url = \`${base}/api/energy/infrastructure${...}\`;`
  matching the pattern in `weatherApi.ts:5` and `newsApi.ts:11`.
- **Blocks next planning/build:** NO (works correctly in local dev via Vite proxy; only
  breaks in non-proxy deployments)

---

#### HEALTH-002

- **Severity:** MEDIUM
- **Category:** API contract mismatch (layer status schema)
- **File:** `packages/contracts/src/index.ts` (lines 46–62) — `LayerStatusResponseSchema`
- **What is wrong:** `LayerStatusResponseSchema.objectCounts` declares fields that are
  specific to aviation: `airports`, `runways`, `navaids`, `airportFrequencies`, `countries`,
  `regions`. This schema is validated against the response of
  `GET /api/layers/:layerId/status` for **all 11 layers**. For non-aviation layers, the
  API correctly returns all zeros (see `routes/layers.ts` bottom branch), but the contract
  field names communicate aviation concepts even for maritime, weather, energy, etc.
- **Why it matters:** Any future agent consuming `/api/layers/:layerId/status` for non-aviation
  layers will receive a contract with aviation field names populated with zeros, which is
  structurally misleading. When a layer-specific status schema is needed (e.g., vessel_count
  for maritime), the existing contract must be extended or replaced. An agent following the
  contract blindly could misread `airports: 0` as meaningful for maritime or energy.
- **Recommended action:** The API Agent should plan a follow-up work order to either:
  (a) replace `objectCounts` in the shared contract with a generic `objectCount: number`
  and a `details: Record<string, number>` map, or
  (b) return the aviation-specific block for aviation only and a generic block for all others.
  For now, the API comment in `routes/layers.ts` documents this as structural/not fake data.
- **Blocks next planning/build:** NO (all tests pass; no consumer reads these zero fields)

---

#### HEALTH-003

- **Severity:** MEDIUM
- **Category:** Workflow gap — missing integration reviews for Layer 07 and Layer 08
- **File:** `docs/state/` directory (no `INTEGRATION_REVIEW_WO-NEWS-*.md` or
  `INTEGRATION_REVIEW_WO-WEATHER-*.md` exists)
- **What is wrong:** The `AGENTS.md` workflow policy requires the Orchestrator Agent to
  create `docs/state/INTEGRATION_REVIEW_[WO].md` for every work order before pushing the
  branch to remote. Layer 07 weather and Layer 08 news/OSINT work (including multiple
  sub-work-orders: WO-NEWS-G1, G1.5, G2, G3, A1, A2, U1, U2) was merged to main without
  integration review documents in `docs/state/`. The most recent review in `docs/state/`
  is `INTEGRATION_REVIEW_WO-079B.md` which covers aviation live source work.
- **Why it matters:** Future agents reading `docs/state/` to understand what has been
  reviewed and pushed will find no review record for the two most recently merged layers.
  This creates ambiguity about whether layer 07/08 work was reviewed at all before merge.
  It also breaks the audit trail that allows future agents to replay decisions.
- **Recommended action:** The Orchestrator Agent should create
  `docs/state/INTEGRATION_REVIEW_LAYER07_WEATHER_COMPLETE.md` and
  `docs/state/INTEGRATION_REVIEW_LAYER08_NEWS_OSINT_COMPLETE.md` documenting the
  retrospective review of these layers (tests pass, code merged to main, no blocking issues).
- **Blocks next planning/build:** NO (code is tested and merged; only the review trail is absent)

---

#### HEALTH-004

- **Severity:** MEDIUM
- **Category:** Normalizer coverage gap
- **File:** `services/normalizer/src/layers/` (only contains `layer_01_aviation/`)
- **What is wrong:** The Normalizer Agent's canonical folder (`services/normalizer/src/layers/`)
  contains only `layer_01_aviation`. Layers 02, 03, 05, 06, 07, 08, and 10 all embed their
  normalizer logic directly inside the fetch-orchestrator layer folder (e.g.,
  `services/fetch-orchestrator/src/layers/layer_07_weather/weather_normalizer.py`).
  `AGENTS.md` and `PIPELINE_HANDOFF_RULES.md` define the Normalizer Agent as owning
  `services/normalizer/`, but all post-aviation normalizer work has been placed under the
  Fetcher Agent's ownership path.
- **Why it matters:** A future Normalizer Agent following `LLM_OWNERSHIP_MATRIX.md` will
  look in `services/normalizer/src/layers/` and find only aviation, creating confusion
  about whether normalizers for other layers need to be written. A future Fetcher Agent
  refactoring a layer may not realize it is touching normalizer logic owned by a different
  agent. There is no active bug, but the ownership boundary as documented does not match
  the actual code structure.
- **Recommended action:** The Orchestrator Agent should decide and document one of:
  (a) Accept colocation of fetcher+normalizer under `services/fetch-orchestrator/` for all
      layers except aviation, and update `LLM_OWNERSHIP_MATRIX.md` and `PIPELINE_HANDOFF_RULES.md`
      to reflect this pattern; or
  (b) Create a work order for the Normalizer Agent to extract normalizers from
      fetch-orchestrator into `services/normalizer/src/layers/<layer_id>/` for each
      non-aviation layer.
  Either decision is acceptable; the ambiguity is the risk.
- **Blocks next planning/build:** NO (all tests pass; the code works as-is)

---

### Low Findings

---

#### HEALTH-005

- **Severity:** LOW
- **Category:** Active doc — residual tool/product name references
- **File:** `docs/control/the legacy layer-registry filename (now retired; canonical is docs/control/PROJECT_CONTROL.md Part 2 �4)` — Safety Notes column, row 4
  (`layer_04_public_military_security`)
- **What is wrong:** The safety notes cell for layer 04 reads: *"Any new source requires
  explicit Kiro approval."* All other active control documents were neutralized to role names
  in the alignment pass; this one cell was not changed.
- **Why it matters:** Agents reading the registry safety notes will encounter a product name
  where they expect a neutral role. The safety intent is clear (no new sources without
  review), but the actor named is a tool, not a role.
- **Recommended action:** Change "explicit Kiro approval" to "explicit Orchestrator Agent
  approval" in the safety notes column for layer 04.
- **Blocks next planning/build:** NO

---

#### HEALTH-006

- **Severity:** LOW
- **Category:** Active doc — residual tool/product name references
- **File:** `docs/control/BORDERS_BOUNDARIES_POLICY_SOURCE_PLAN.md`
  (lines 85, 142, 161, 218, 229, 244–246)
- **What is wrong:** The body text of the Borders & Boundaries policy plan still contains
  references to a tool/product name ("Kiro") in procedural gates and sign-off requirements
  (e.g., "explicit Kiro approval", "Kiro sign-off recorded"). The document header was
  updated to "Orchestrator Agent" in the alignment pass, but the body was not fully
  neutralized.
- **Why it matters:** Agents following the procedural gates in this document to unlock
  production use of borders data will encounter a mix of neutral role names and product
  names. This is stylistically inconsistent and violates the AGENTS.md rule that active
  control documents use neutral role names only.
- **Recommended action:** Replace all occurrences of "Kiro" / "Kiro CLI" / "Kiro sign-off"
  in the body of this document with "Orchestrator Agent" in a future cleanup pass. The
  compliance rules and production-gate logic must NOT be weakened.
- **Blocks next planning/build:** NO

---

#### HEALTH-007

- **Severity:** LOW
- **Category:** Frontend registry — minor source description staleness
- **File:** `apps/web/src/lib/useLayerRegistry.ts` — layer 08 `sourceRule` field
- **What is wrong:** The layer 08 (`layer_08_news_osint`) entry in `LOCAL_LAYER_REGISTRY`
  has `sourceRule: 'GDACS'`. The implemented source family includes both GDACS and GDELT
  Event Export. The API registry in `routes/layers.ts` correctly reads
  `sourceRule: 'GDACS and GDELT event/news source families...'`. Since the frontend
  falls back to local registry values when the API is offline, an offline user would see
  "GDACS" as the only source for a layer that also ingests GDELT.
- **Why it matters:** Misleading source attribution to end users in offline mode; also
  misleads future Frontend Agents reading the local registry.
- **Recommended action:** Update `sourceRule` for layer 08 in `LOCAL_LAYER_REGISTRY` to
  `'GDACS and GDELT Event Export'` to match the API registry entry.
- **Blocks next planning/build:** NO

---

#### HEALTH-008

- **Severity:** LOW
- **Category:** Duplicate npm script
- **File:** `package.json` (root)
- **What is wrong:** Two scripts perform identical work:
  `"api:test": "pnpm --filter api test"` and `"test:api": "pnpm --filter api test"`.
  CI uses `api:test`; `test:api` is a leftover alias.
- **Why it matters:** Minor confusion for agents choosing which script to use; both work,
  creating no functional risk but adding noise.
- **Recommended action:** Remove `test:api` and keep `api:test` (CI reference) in a future
  cleanup pass.
- **Blocks next planning/build:** NO

---

#### HEALTH-009

- **Severity:** LOW
- **Category:** Documentation completeness
- **File:** Repository root — no `README.md` tracked
- **What is wrong:** There is no root `README.md`. The repository entry point for new
  agents and contributors is `AGENTS.md`, which is functional but not the convention
  expected at repo root.
- **Why it matters:** Onboarding friction for new agents. GitHub shows `AGENTS.md` instead
  of a `README.md` as the landing document.
- **Recommended action:** Add a minimal `README.md` at root pointing to `AGENTS.md` and
  `docs/control/the legacy layer-registry filename (now retired; canonical is docs/control/PROJECT_CONTROL.md Part 2 �4)` as authoritative entry documents.
- **Blocks next planning/build:** NO

---

#### HEALTH-010

- **Severity:** LOW
- **Category:** Migration sequence gap
- **File:** `database/migrations/layers/layer_01_aviation/` — no `002_*.sql` file
- **What is wrong:** Aviation migration files jump from `001_aviation_reference_tables.sql`
  to `003_aviation_search_indexes.sql`. No `002_*.sql` exists in this folder. This
  numbering gap is pre-existing and was present before the alignment merge.
- **Why it matters:** Minor confusion for agents writing or applying migrations who expect
  a contiguous numbered sequence. Not a functional issue (migration scripts are applied
  once; the gap does not affect the running DB).
- **Recommended action:** Add a comment in `database/migrations/README.md` noting that
  aviation migration `002` was intentionally removed/replaced (or create a `002_placeholder.sql`
  with a comment explaining the gap).
- **Blocks next planning/build:** NO

---

#### HEALTH-011

- **Severity:** LOW
- **Category:** Gitignore — tool-specific entries
- **File:** `.gitignore` (lines 64–65, 78–80)
- **What is wrong:** `.gitignore` contains entries for local tooling artifacts of specific
  tool products: `.kiro/settings.local.json`, `.m3-session-memory.md`, `.opencode/`. These
  reference specific CLI/product names. None of these paths or files exist in the working
  tree (verified); they are purely precautionary gitignore entries.
- **Why it matters:** These entries do not affect the tracked codebase or agent workflow.
  The rule in `AGENTS.md` prohibits tool/product names in *active control documents*;
  `.gitignore` is an infrastructure file, not a control document. However, if a future
  Orchestrator Agent audits `.gitignore` for neutrality, these entries will be noticed.
- **Recommended action:** No immediate action required. These entries are harmless and
  prevent accidental commits of local session files. Acceptable as-is.
- **Blocks next planning/build:** NO

---

#### HEALTH-012

- **Severity:** LOW
- **Category:** Work-order / spec folder location gap
- **File:** `docs/work-orders/` — no work orders for layers 05–10
- **What is wrong:** The canonical work-order location per `AGENTS.md` is `docs/work-orders/`.
  The most recent work order in that folder is `WO-079A` (aviation live source). All Layer 05,
  06, 07, 08, and 10 work was tracked through spec files in `specs/003-*/` through
  `specs/007-*/` rather than through formal `docs/work-orders/` entries. Both conventions
  are in use simultaneously.
- **Why it matters:** Future agents reading `docs/work-orders/` for work history will not
  find any record of the five most recently implemented layers. Agents following `AGENTS.md`
  step 1 ("Orchestrator Agent creates work orders in `docs/work-orders/`") will create new
  WOs in that folder, while all recent work used `specs/`.
- **Recommended action:** The Orchestrator Agent should clarify the canonical location for
  new work orders in `AGENTS.md` or create a bridging note in `docs/work-orders/` pointing
  to the `specs/` pattern for layers 05–10.
- **Blocks next planning/build:** NO

---

### Archive / Ignore Files

The following files are old, historical, or pre-implementation documents. They do not
affect current agents operating under the current layer registry and workflow. They should
not be modified unless explicitly tasked. Modifying them without cause risks introducing
confusion or weakening compliance rules.

---

**`docs/control/AIRPORT_PUBLIC_ENRICHMENT_PIPELINE.md`**
- Reason it is historical: This is an implementation-phase pipeline design document for
  the aviation airport public enrichment pipeline (WO-032 series). It was created before
  the current neutral-role-name policy and contains tool/model names in author fields and
  work-order owner lines (e.g., "Author: Kiro CLI", "Claude/API", "Gemini/frontend").
- Why agents do not need to change it: The aviation enrichment pipeline it describes is
  fully implemented and in production. No current work order requires changes to this file.
  The tool/model names appear only as historical ownership/attribution, not as active
  instructions. Future agents working on aviation do not need to follow this document;
  they follow the current API contracts, tests, and work orders.

---

**`docs/control/BORDERS_BOUNDARIES_IMPLEMENTATION_GATE_REVIEW.md`**
- Reason it is historical: This is a gate review document produced during the Layer 02
  borders implementation planning phase. It contains a "Reviewer: Kiro CLI" header and
  one "LLM model: Claude Sonnet 4.5" line, and several "Kiro sign-off" references in the
  compliance checklist.
- Why agents do not need to change it: The gate review is a historical decision record.
  Its compliance requirements (India boundary compliance, disputed territory policy) remain
  valid and are enforced through `BORDERS_BOUNDARIES_POLICY_SOURCE_PLAN.md`. The tool/model
  names are attribution metadata. No active layer work depends on this specific file.

---

**`docs/control/the legacy borders-source-selection filename (now archived)`**
**`docs/control/the legacy borders-boundary-mode-decision filename (now archived)`**
**`docs/control/BORDERS_BOUNDARIES_SOURCE_LICENSE_CLEARANCE_KIT.md`**
**`docs/control/BORDERS_BOUNDARIES_SOURCE_REVIEW_TRACKER.md`**
**`docs/control/BORDERS_BOUNDARIES_SURVEY_OF_INDIA_REQUEST_TEMPLATE.md`**
- Reason they are historical: These are source evaluation and compliance planning documents
  produced during the WO-076 through WO-078 series for Layer 02. They contain author
  attributions referencing a tool/product name. The decisions they document (Natural Earth
  as initial-build source, production compliance deferred) are already encoded in the active
  `BORDERS_BOUNDARIES_POLICY_SOURCE_PLAN.md` and `the legacy layer-registry filename (now retired; canonical is docs/control/PROJECT_CONTROL.md Part 2 �4)`.
- Why agents do not need to change them: The Layer 02 source decision is settled. These
  files serve as historical background and compliance evidence, not active instructions.
  The production compliance gates are enforced by the policy plan, not these decision docs.

---

**`docs/control/EARTH_EVENTS_LAYER_PLAN.md`**
- Reason it is historical: An early planning document for Layer 03 Earth Events. Layer 03
  is fully implemented (USGS worker, DB tables, API, frontend). The plan may contain
  aspirational source lists ("NASA EONET, GDACS") that do not match the implemented
  USGS-only worker.
- Why agents do not need to change it: A new agent building upon Layer 03 should read
  the current code, migrations, and API tests, not this early planning document. It does
  not block any active work.

---

**`docs/control/the legacy layer-05 contract filename (now archived)`**
- Reason it is historical/completed: The alignment pass added a status note at the top of
  this file marking it as "historical/completed". Layer 05 is fully implemented.
- Why agents do not need to change it: Active agents read `the legacy layer-registry filename (now retired; canonical is docs/control/PROJECT_CONTROL.md Part 2 �4)` and
  current code/contracts, not this lane contract. The document is self-labeled historical.

---

**`docs/control/the legacy layer-10 contract filename (now archived)`**
- Reason it is historical/completed: Layer 10 is fully implemented. This contract document
  was the planning-phase spec.
- Why agents do not need to change it: Same as layer 05 contract above. Active API
  contracts are in `packages/contracts/src/index.ts`.

---

**`docs/state/INTEGRATION_REVIEW_WO-001.md` through `INTEGRATION_REVIEW_WO-079B.md`**
(~50 files in `docs/state/`)
- Reason they are historical: Each file is an immutable review record for a completed work
  order. They were created as PASS/FAIL verdicts by the Orchestrator Agent at push time and
  are not meant to be updated.
- Why agents do not need to change them: They are append-once historical artifacts. Future
  agents create new `INTEGRATION_REVIEW_[WO].md` files for new work orders; they never
  modify existing reviews.

---

**`docs/work-orders/WO-001` through `WO-079A` (38 files in `docs/work-orders/`)**
- Reason they are historical: Completed work orders for layers 00 through 02/aviation
  enrichment. The work they specified has been done.
- Why agents do not need to change them: They serve as a historical record. New work uses
  new work-order files. The specs folder (`specs/003-*` through `specs/007-*`) covers
  layers 05–08.

---

**`docs/state/HANDOFF_LOG.md` — historical entries containing tool/CLI names**
- Reason the old entries are acceptable: `AGENTS.md` requires the handoff log to be
  append-only. Historical entries from earlier in the project recorded tool/CLI names
  (e.g., "Tool/CLI used: opencode CLI", "Agent: Claude Code CLI") before the neutral-name
  policy was enforced. These cannot be retroactively altered without violating the
  append-only rule.
- Why agents do not need to change them: The entries are factually accurate records of
  past work. New entries follow the neutral-role-name convention. The old entries have no
  bearing on the current workflow.

---

**`docs/reports/WO-060-repository-health-audit.md`**
- Reason it is historical: An earlier repository health audit report from June 2026. It
  reflects the project state at an earlier snapshot. Its findings were addressed in
  subsequent work orders.
- Why agents do not need to change it: It is a point-in-time snapshot, superseded by the
  `PROJECT_ALIGNMENT_REPORT.md`, `PROJECT_ALIGNMENT_FIX_REPORT.md`, and this audit.

---

**`docs/postman/GOD_EYES_LOCAL_API.postman_collection.json`**
- Reason it is historical/supplementary: A Postman collection for manual local API testing.
  It may not include the newest routes (weather/news/energy).
- Why agents do not need to change it: It is a developer convenience artifact. No CI or
  workflow step depends on it. A future API Agent may choose to update it in a dedicated
  task.

---

## 5. Forbidden-Path Cross-Check

The following cross-cutting checks were performed to detect agent boundary violations:

| Check | Result |
|-------|--------|
| Frontend files importing from `services/`, `database/`, or `apps/api/` | NONE FOUND |
| API files importing from `apps/web/` or `services/` | NONE FOUND |
| Fetcher/normalizer importing from `apps/web/` or `apps/api/` | NONE FOUND |
| `.env` tracked by git | NOT TRACKED — PASS |
| `*.pyc` tracked by git | NOT TRACKED — PASS |
| `__pycache__` tracked by git | NOT TRACKED — PASS |
| `raw/` tracked by git | NOT TRACKED (gitignored) — PASS |
| `tmp/` tracked by git | NOT TRACKED (gitignored) — PASS |
| Real secrets in `.env.example` | NONE (placeholders only) — PASS |
| Real secrets in `apps/web/.env.example` | NONE (placeholders only) — PASS |

---

## 6. Layer Registry Cross-Check (Post-Alignment)

| Check | Result |
|-------|--------|
| `the legacy layer-registry filename (now retired; canonical is docs/control/PROJECT_CONTROL.md Part 2 �4)` has 11 rows (00–10) | PASS |
| `apps/api/src/routes/layers.ts` `LAYER_REGISTRY` has 11 entries | PASS |
| `apps/web/src/lib/useLayerRegistry.ts` `LOCAL_LAYER_REGISTRY` has 11 entries | PASS |
| All three registries agree on `layer_07_weather` (not `layer_07_infrastructure`) | PASS |
| All three registries include `layer_10_energy_infrastructure` | PASS |
| layer_04 and layer_09 are `coming_soon` everywhere | PASS |
| layer_00–03, 05–08, 10 are `active` everywhere | PASS |
| Frontend registry merge cannot produce duplicate Layer 7 | PASS — API and local both use `layer_07_weather` |
| `AGENTS.md` Layer Order table includes layer_10 | PASS (fixed in alignment) |
| `LAYER_ARCHITECTURE.md` layer 7 is Weather (not Infrastructure) | PASS (fixed in alignment) |
| `LAYER_ID_CONVENTIONS.md` statuses match registry | PASS (fixed in alignment) |

---

## 7. CI / Test Alignment Check (Post-Alignment)

| Check | Result |
|-------|--------|
| CI runs `pnpm --filter @god-eyes/contracts build` | PASS — present in ci.yml |
| CI runs `pnpm --filter api build` | PASS — present |
| CI runs `pnpm run api:test` | PASS — present |
| CI runs `pnpm --filter web test` | PASS — added in alignment fix (ALIGN-010) |
| CI runs `pnpm --filter web build` | PASS — present |
| CI runs `python -m pytest tests/data -q` | PASS — present |
| CI installs from `requirements-data.txt` | PASS — fixed in alignment (ALIGN-011) |
| `requirements-data.txt` contains boto3, psycopg[binary], psycopg2-binary, websockets, sgp4, pytest | PASS |
| Data tests pass locally (clean tree) | PASS — 1159 passed, 15 skipped |
| Scope-guard tests skip on clean committed tree | CONFIRMED (by alignment fix report) |

---

## 8. Security / Secrets Check

| Check | Result |
|-------|--------|
| `.env` tracked | NOT TRACKED — PASS |
| `apps/web/.env` tracked | NOT TRACKED — PASS |
| Real Cesium token in any tracked file | NOT FOUND — PASS |
| Real DB credentials in any tracked file | NOT FOUND (only placeholders in `.env.example`) — PASS |
| Real API keys (SpaceTrack, AISStream, Minio, etc.) in any tracked file | NOT FOUND — PASS |
| `raw/` committed | NOT COMMITTED — PASS |
| `node_modules/` committed | NOT COMMITTED — PASS |
| `__pycache__` / `*.pyc` committed | NOT COMMITTED — PASS |

---

## 9. Agent Ownership Clarity Check

| Check | Result |
|-------|--------|
| All active control docs use neutral role names | PASS (with LOW exceptions in HEALTH-005, HEALTH-006) |
| `LLM_OWNERSHIP_MATRIX.md` uses neutral role names | PASS |
| `PIPELINE_HANDOFF_RULES.md` uses neutral role names | PASS |
| `GIT_WORKFLOW_POLICY.md` uses neutral role names | PASS |
| Commit message format defined and followed in recent commits | PASS |
| Worker agents may not push to remote (documented) | PASS — confirmed in GIT_WORKFLOW_POLICY.md |
| Orchestrator Agent is push gatekeeper (documented) | PASS |
| Each layer has an owning agent via ownership matrix | PASS |
| Normalizer layer coverage ambiguity | MEDIUM — see HEALTH-004 |

---

## 10. Findings Summary

| Severity | Count | IDs |
|----------|-------|-----|
| **Critical** | **0** | — |
| **High** | **0** | — |
| **Medium** | **4** | HEALTH-001, HEALTH-002, HEALTH-003, HEALTH-004 |
| **Low** | **8** | HEALTH-005 through HEALTH-012 |
| **Archive / Ignore** | **11 groups** | see Section 4 |

---

## 11. Result Summary

| Dimension | Result |
|-----------|--------|
| **Workflow risk** | **PASS** — workflow cycle is intact; no agent rule contradictions in active docs |
| **Document alignment** | **PASS** — all 11 layers consistent across docs/API/frontend after alignment |
| **Layer registry alignment** | **PASS** — three registries agree on all layer IDs, statuses, and names |
| **Security / secrets** | **PASS** — no secrets tracked; all sensitive paths gitignored |
| **CI / test readiness** | **PASS** — all 5 CI gates pass locally; web tests now in CI |
| **Agent ownership clarity** | **PASS** (with MEDIUM normalizer coverage note — HEALTH-004) |
| **Does this block next planning work** | **NO** |

---

## 12. Recommended Next Steps

1. **Continue to next planning cycle.** No critical or high issues block the next layer
   planning work. The repository is structurally healthy.

2. **HEALTH-001 (Energy frontend relative path):** Assign a small Frontend Agent task to
   fix `useEnergyInfrastructure.ts` line 53 to use `VITE_API_BASE_URL`. Can be bundled
   with the next frontend work order.

3. **HEALTH-003 (Missing integration reviews for Layer 07/08):** The Orchestrator Agent
   should create retrospective integration review documents for the weather and news layers
   to complete the audit trail. This is a one-time documentation task, not new code.

4. **HEALTH-004 (Normalizer coverage policy):** The Orchestrator Agent should document the
   official pattern (colocation vs. separate normalizer service) and update
   `LLM_OWNERSHIP_MATRIX.md` to reflect actual code structure. Required before implementing
   a new layer that needs a normalizer.

5. **HEALTH-005 / HEALTH-006 (Residual tool names in active docs):** Bundle with the next
   Orchestrator Agent doc-cleanup pass. No build or runtime impact.

6. **HEALTH-002 (LayerStatusResponseSchema objectCounts):** The API Agent should plan a
   work order to generalize the status contract for non-aviation layers. Not urgent.

---

## 13. Commit Information

- **Report file created:** `docs/audits/PROJECT_HEALTH_WORKFLOW_AUDIT.md`
- **Files modified:** `docs/state/HANDOFF_LOG.md` (handoff entry appended)
- **Commit hash:** TBD (created after this report)
- **Push status:** Local only — NOT pushed
