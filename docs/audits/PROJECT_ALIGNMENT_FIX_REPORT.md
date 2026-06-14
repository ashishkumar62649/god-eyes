# Project Alignment Fix Report

## Branch

`alignment/project-docs-code-registry-fix`

## Commit Hash Before Work

`2fe2367f80e4fd120e3de264491e9027747e7ac9` (branch created from `main`)

## Objective

Align documentation, layer registries (API + frontend), CI/dependency files, environment
examples, route documentation, status documents, and workflow/control documents with the
current working code on `main`. No layer business logic was redesigned.

## Canonical Decisions Applied

- `layer_07_weather` is the canonical Layer 07. `layer_07_infrastructure` removed from all
  active registries and active layer-order docs.
- Energy infrastructure is `layer_10_energy_infrastructure`, now present in all active
  registries and layer-order docs.
- Active implemented layers: `layer_00_globe_core`, `layer_01_aviation`,
  `layer_02_borders_boundaries`, `layer_03_earth_events`, `layer_05_space_satellites`,
  `layer_06_maritime`, `layer_07_weather`, `layer_08_news_osint`,
  `layer_10_energy_infrastructure`.
- Active unimplemented layers (status `coming_soon`): `layer_04_public_military_security`,
  `layer_09_user_shapes`.
- Live layers (Space, Maritime, Weather, News) are active/implemented but their UI toggle
  defaults OFF (matches existing frontend tests).

## Files Changed

### Code / registries
- `apps/api/src/routes/layers.ts`
- `apps/web/src/lib/useLayerRegistry.ts`

### Control / state docs
- `AGENTS.md`
- `docs/control/MVP_LAYER_REGISTRY.md`
- `docs/control/LAYER_ARCHITECTURE.md`
- `docs/control/LAYER_ID_CONVENTIONS.md`
- `docs/control/LLM_OWNERSHIP_MATRIX.md`
- `docs/control/PIPELINE_HANDOFF_RULES.md`
- `docs/control/GIT_WORKFLOW_POLICY.md`
- `docs/control/DATA_LOCATION_RULES.md`
- `docs/control/SOURCE_TO_FRONTEND_CONTRACT.md`
- `docs/control/layer_05_space_satellites_mvp_contract.md`
- `docs/control/BORDERS_BOUNDARIES_POLICY_SOURCE_PLAN.md`
- `docs/state/CURRENT_PROJECT_STATE.md`
- `docs/state/HANDOFF_LOG.md` (appended one neutral entry)

### Config / dependency
- `.github/workflows/ci.yml`
- `requirements-data.txt`
- `.env.example`

### Audit
- `docs/audits/PROJECT_ALIGNMENT_REPORT.md` (carried from the prior audit; short follow-up note added)
- `docs/audits/PROJECT_ALIGNMENT_FIX_REPORT.md` (this file)

`apps/web/.env.example` and `packages/contracts/src/index.ts` were inspected and required
**no** change (already aligned with the code).

## Findings Fixed (by report ID)

| Finding | Fix |
|---------|-----|
| ALIGN-001 | `layers.ts` registry entry 7 changed from `layer_07_infrastructure` to `layer_07_weather`. |
| ALIGN-002 | `layer_10_energy_infrastructure` added to the API registry (now 11 entries, 00–10). |
| ALIGN-003 | API registry corrected so the frontend merge cannot produce a duplicate Layer 7; merge already dedupes by `layerId`. |
| ALIGN-004 | Statuses aligned across MVP registry, API registry, and frontend registry (02/03 active; 05/06/07/08/10 active). |
| ALIGN-005 | `CURRENT_PROJECT_STATE.md` rewritten to current reality (implemented layers, capabilities, manual workers, alignment-in-progress). |
| ALIGN-006 | `LAYER_ID_CONVENTIONS.md` status table corrected (02/03/05/06/07/08/10 active). |
| ALIGN-007 | `LAYER_ARCHITECTURE.md` "Layer 7: Infrastructure" prose replaced with Weather; table statuses corrected; Layer 10 section added. |
| ALIGN-009 | Confirmed frontend code + `apps/web/.env.example` use `VITE_CESIUM_ION_ACCESS_TOKEN`; root `.env.example` clarified to point at the frontend Vite vars (no Cesium var name conflict in tracked files). |
| ALIGN-010 | CI now runs `pnpm --filter web test`. |
| ALIGN-011 | CI installs from `requirements-data.txt`; that file now lists the actually-imported deps. |
| ALIGN-014 | News source rule updated to GDACS + GDELT in the registry. |
| ALIGN-018 | Registry route cells for space/weather/news updated to the actual implemented route families (non-generic). |
| ALIGN-020 | MVP registry statuses for 05/06/07/08/10 set to active. |
| ALIGN-021 | State doc no longer presents implemented layers as planned. |
| ALIGN-024 | `AGENTS.md` Layer Order table now includes `layer_10_energy_infrastructure`. |
| ALIGN-026 | `/api/layers` now derives from the full `LAYER_REGISTRY` (no longer only globe_core + aviation). |
| ALIGN-027 | `/api/layers/:layerId/status` returns a contract-valid status for every registered layer; 404 only for unregistered IDs. |
| ALIGN-017 | Frontend Layer 09 changed from `no_data` to `coming_soon`. |
| Naming (cross-cutting) | All active control/workflow docs neutralized to role names (Orchestrator/Frontend/API/Fetcher/Normalizer/Database/Review/Integration/Contract Agent). |

Findings ALIGN-008, ALIGN-012, ALIGN-013, ALIGN-016, ALIGN-019, ALIGN-022, ALIGN-023,
ALIGN-025 are documentation/structure observations outside the registry/status/config
alignment scope and were not changed in this pass (see Known Remaining Issues).

## Extra Misalignments Found and Fixed

- API registry `isEnabled` flags were initially set to `true` for the default-OFF live
  layers (05/06/07/08); corrected to `false` so the API registry matches the frontend
  "active, default OFF" product decision encoded in the web tests.
- `LAYER_ID_CONVENTIONS.md` folder-ownership headings contained tool/model names; neutralized.
- `requirements-data.txt` previously omitted `psycopg2-binary`, `websockets`, and `sgp4`
  that are imported by the weather seed, maritime AIS client, and space orbit modules; added.
  `requests` was intentionally NOT added because it is not imported anywhere in the code.

## Commands Run and Results

| Command | Result |
|---------|--------|
| `pnpm install` | OK (up to date) |
| `pnpm --filter @god-eyes/contracts build` | PASS (tsc, no errors) |
| `pnpm --filter api build` | PASS (tsc, no errors) |
| `pnpm --filter api test` | PASS — 503 passed / 17 files |
| `pnpm --filter web test` | PASS — 64 passed / 3 files |
| `pnpm --filter web build` | PASS (tsc + vite production build) |
| `python -m pip install -r requirements-data.txt` | OK |
| `python -m pytest tests/data -q` | Dirty worktree: 1152 passed, 7 skipped, 15 failed*. **After commit (clean tree): 1159 passed, 15 skipped, 0 failed** (verified). |

\* The 15 failures are all single-lane **work-order scope guardrail** tests
(`test_*_work_order_changes_stay_in_allowed_paths` and
`test_*_adds_no_raw_*/environment_files`). These tests read `git status --porcelain` and
assert that an uncommitted working tree only touches one layer's allowed folders and never
touches `.env*`/`apps/*`. They **skip or pass on a clean (committed) tree** — the
"stay in allowed paths" tests `pytest.skip` when there are no porcelain changes. They fire
here only because this is an intentionally cross-cutting alignment branch with an
uncommitted working tree at the time of the run (it edits `.env.example`, `apps/api/`,
`apps/web/`, multiple `docs/` files, CI, and dependencies). After committing, the working
tree is clean and these tests skip/pass, which is also how CI (clean checkout) evaluates
them. No functional, schema, fetcher, normalizer, or ingestion test failed.

## API Smoke Checks

Not performed: a local API server and database were not running, and the task forbids
starting live workers. The new `/api/layers`, `/api/layers/registry`,
`/api/layers/:layerId`, and `/api/layers/:layerId/status` behaviors are covered by the
passing API test suite (including `smoke.test.ts`).

## Known Remaining Issues

- The per-lane data guardrail tests assume single-lane work orders; a cross-cutting
  alignment branch trips them while the working tree is dirty. They were not modified
  (editing tests is out of scope). They pass/skip on a clean committed tree and in CI.
- Live-layer workers (space/maritime/weather/news/energy) are still run manually; a unified
  runner/scheduler is deferred to a later work order.
- Documentation-only observations from the audit (ALIGN-008, 012, 013, 016, 019, 022, 023,
  025) remain open as they are outside this alignment pass's registry/status/config scope.

## Confirmations

- Working layer business logic was **not** intentionally changed. Only registry data,
  endpoint list/lookup/status behavior (to recognize all registered layers), docs, config,
  and dependencies were aligned.
- **No** model, provider, assistant, or tool product names were introduced. Active control
  documents were neutralized to role names only.
- **No** secrets were added. `.env` was not modified. `.env.example` contains placeholders
  only. No raw/tmp/cache/database output was committed.
