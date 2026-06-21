# GOD EYES — Project Health Findings: Deep Evidence Explanation

## Document Purpose

This document provides evidence-level explanation for every Medium and Low finding
identified in `docs/audits/PROJECT_HEALTH_WORKFLOW_AUDIT.md`. It is written for the
Planning Agent so future repair work orders can be scoped with confidence.

- **Branch:** `research/project-health-workflow-audit`
- **Audit base:** `docs/audits/PROJECT_HEALTH_WORKFLOW_AUDIT.md`
- **Agent:** Research Agent
- **Date:** 2026-06-14

---

## Medium Findings

---

### HEALTH-001

**Finding ID:** HEALTH-001
**Severity:** MEDIUM
**Category:** Frontend runtime risk — API client configuration

**Primary files:**
- `apps/web/src/layers/energy/infrastructure/useEnergyInfrastructure.ts` (line 53)

**Related files:**
- `apps/web/src/layers/layer_07_weather/weatherApi.ts` (line 3 — correct pattern)
- `apps/web/src/layers/layer_08_news_osint/newsApi.ts` (line 7 — correct pattern)
- `apps/web/src/layers/maritime/maritimeApi.ts` (line 5 — correct pattern)
- `apps/web/vite.config.ts` (dev proxy config)
- `apps/web/.env.example` (VITE_API_BASE_URL)

**Current evidence:**

`useEnergyInfrastructure.ts` line 53:
```typescript
const url = `/api/energy/infrastructure${queryString ? `?${queryString}` : ''}`;
```

This is a bare relative path string with no base URL. The `fetch()` call at line 62 uses
this URL directly:
```typescript
const response = await fetch(url, { signal: ... });
```

Every other layer client prefixes the configured base URL. Pattern from `weatherApi.ts`:
```typescript
const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:4000';
// ...
const url = new URL(`${API_BASE_URL}${WEATHER_CURRENT_PATH}`);
```

Pattern from `newsApi.ts`:
```typescript
const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:4000';
```

Pattern from `maritimeApi.ts`:
```typescript
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:4000';
```

Why it works in dev: `apps/web/vite.config.ts` configures a dev proxy:
```typescript
proxy: {
  '/api': {
    target: 'http://localhost:4000',
    changeOrigin: true,
  },
},
```
In local dev, the browser calls `http://localhost:5174/api/energy/...` and Vite silently
forwards it to `http://localhost:4000/api/energy/...`. The energy layer works correctly
because the proxy bridges the relative path.

`apps/web/.env.example` documents:
```
VITE_API_BASE_URL=http://localhost:4000
```

**Why it matters:**
Any deployment that serves the frontend from a different origin than the API (staging
environments, Docker Compose with separate containers, CDN-hosted frontend) will see
energy requests fail with network errors or CORS rejections. A future Frontend Agent
following the established pattern to build a new layer will either copy this inconsistent
file as a reference or notice the divergence and be confused about which pattern is
canonical. The inconsistency also means that `VITE_API_BASE_URL` is silently ignored for
energy infrastructure in all environments.

**Impact:** Frontend runtime risk

**Is this truly worth fixing?** Yes. It is a one-line change with zero test risk, and it
aligns the energy layer with all other implemented layers.

**Recommended decision:** Fix now before next feature

**Recommended owner:** Frontend Agent

**Suggested repair shape:**
In `useEnergyInfrastructure.ts`, before line 53, add:
```typescript
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:4000';
```
Then change line 53 from:
```typescript
const url = `/api/energy/infrastructure${queryString ? `?${queryString}` : ''}`;
```
to:
```typescript
const url = `${API_BASE_URL}/api/energy/infrastructure${queryString ? `?${queryString}` : ''}`;
```
No other files need to change.

**Suggested verification:**
- `pnpm --filter web test` — 64/64 must still pass (energy test mocks fetch, not URL construction)
- `pnpm --filter web build` — must complete without TypeScript errors
- Manual: set `VITE_API_BASE_URL=http://api.example.com` in `apps/web/.env`, start web
  dev server, open browser devtools, toggle the energy layer — verify the network request
  goes to `http://api.example.com/api/energy/...` not `http://localhost:5174/api/energy/...`

**Blocks next planning:** NO
**Blocks next build:** NO

---

### HEALTH-002

**Finding ID:** HEALTH-002
**Severity:** MEDIUM
**Category:** Contract/API risk — aviation-specific schema used generically

**Primary files:**
- `packages/contracts/src/index.ts` (lines 46–62)
- `apps/api/src/routes/layers.ts` (the non-aviation status branch, lines ~310–340)

**Related files:**
- `apps/api/tests/smoke.test.ts` (tests only aviation status shape; no non-aviation test)

**Current evidence:**

`packages/contracts/src/index.ts` lines 46–62:
```typescript
export const LayerStatusResponseSchema = z.object({
  layerId: z.string(),
  status: z.enum(['ok', 'degraded', 'not_configured']),
  sourceId: z.string().nullable(),
  objectCounts: z.object({
    airports: z.number(),
    runways: z.number(),
    navaids: z.number(),
    airportFrequencies: z.number(),
    countries: z.number(),
    regions: z.number(),
  }),
  database: z.object({
    status: z.enum(['connected', 'offline']),
  }),
});
```

This schema is the only declared contract for `GET /api/layers/:layerId/status`. It
defines `objectCounts` with six aviation-specific field names. The API uses this schema to
validate and shape the response for **all 11 layers** via
`LayerStatusResponseSchema.parse(...)` in `routes/layers.ts`.

The non-aviation fallback branch in `routes/layers.ts` returns all zeros:
```typescript
objectCounts: {
  airports: 0,
  runways: 0,
  navaids: 0,
  airportFrequencies: 0,
  countries: 0,
  regions: 0,
},
```

A comment in the code states *"objectCounts in the shared contract are aviation-specific;
for non-aviation layers they are reported as zero (structural, not fake data)"*.

The `smoke.test.ts` test only asserts `body.objectCounts` is defined for
`layer_01_aviation`. No test calls `/api/layers/layer_06_maritime/status` and asserts the
shape, so no test would catch if the contract were extended.

**Why it matters:**
A future API Agent or Contract Agent adding a layer-specific status endpoint (e.g., vessel
counts for maritime, event counts for earth events) will find a schema that only makes
sense for aviation. They will either:
(a) add a second `LayerStatusResponseSchema` creating a naming inconsistency, or
(b) modify the existing schema in a breaking way for aviation consumers, or
(c) leave it and return misleadingly named zeroed fields forever.

A future Frontend Agent consuming `/api/layers/layer_10_energy_infrastructure/status`
would receive `{ airports: 0, runways: 0, ... }` and have to special-case the energy
layer to make sense of it.

No current consumer reads these zero fields for non-aviation layers. The risk is
forward-looking — it will become a real problem as future layers grow their status APIs.

**Impact:** Contract/API risk

**Is this truly worth fixing?** Yes, but not urgently. The current behavior is documented
and no consumer is broken. Worth planning before the next layer that needs a meaningful
status response.

**Recommended decision:** Include in next planning cycle

**Recommended owner:** API Agent (contract change) + Contract Agent (schema versioning)

**Suggested repair shape:**
Two options for the Planning Agent to choose between:

Option A — Generic field rename (non-breaking for current consumers that only read
aviation status):
```typescript
objectCounts: z.object({
  total: z.number(),
  details: z.record(z.number()),
})
```
For aviation, `total` = airport count, `details` = {airports, runways, navaids, ...}. For
all other layers, `total` = 0, `details` = {}. This is a breaking change for any consumer
reading `airports`, `runways`, etc. on aviation status.

Option B — Layer-type-aware union (preferred for future-proofing):
```typescript
objectCounts: z.union([
  z.object({ airports: z.number(), runways: z.number(), ... }),   // aviation
  z.object({ count: z.number() }),                               // generic
])
```
The Planning Agent should make the API design decision; the Research Agent does not
prescribe it.

**Suggested verification:**
- `pnpm --filter @god-eyes/contracts build` — TypeScript must compile
- `pnpm --filter api test` — all 503 API tests must pass
- Add a new test to `smoke.test.ts` that calls `/api/layers/layer_07_weather/status` and
  asserts the response shape matches the updated contract

**Blocks next planning:** NO
**Blocks next build:** NO

---

### HEALTH-003

**Finding ID:** HEALTH-003
**Severity:** MEDIUM
**Category:** Workflow risk — missing audit trail for merged layers

**Primary files:**
- `docs/state/` directory (no INTEGRATION_REVIEW files for weather or news)

**Related files:**
- `docs/state/HANDOFF_LOG.md` (contains work entries for WO-NEWS-G1, G1.5, G2, G3, A1, A2, U1, U2 but no review companion)
- `docs/state/INTEGRATION_REVIEW_WO-079B.md` (most recent review — for aviation)
- `docs/archive/2026-06-16-implemented-specs/006-layer-07-weather/` (weather spec dir — no companion review in docs/state/)
- `docs/archive/2026-06-16-implemented-specs/007-layer-08-news-osint/` (news spec dir — no companion review in docs/state/)
- `AGENTS.md` (workflow section, step 7: "The Orchestrator Agent reviews and creates `docs/state/INTEGRATION_REVIEW_[WO].md`")

**Current evidence:**

`docs/state/` directory listing confirms no integration review exists for Layer 07
(weather) or Layer 08 (news/OSINT). The most recent integration review file is
`INTEGRATION_REVIEW_WO-079B.md`, which covers Layer 01 aviation live source schema.

`AGENTS.md` workflow step 7:
> The Orchestrator Agent reviews and creates `docs/state/INTEGRATION_REVIEW_[WO].md`.

`AGENTS.md` step 8:
> If PASS: the Orchestrator Agent pushes the branch to origin.

The Layer 07 weather implementation (Open-Meteo fetcher, normalizer, DB tables, API
endpoints, frontend) and Layer 08 news/OSINT implementation (GDACS + GDELT fetcher,
normalizer, DB tables, API endpoints, frontend, 7+ sub-work-orders) were all merged to
main without Orchestrator review documents in `docs/state/`.

The `docs/state/HANDOFF_LOG.md` contains individual worker agent entries for every
sub-work-order of layers 07 and 08. The work was done and committed. The alignment fix
review (`PROJECT_ALIGNMENT_FIX_REVIEW.md` in `docs/audits/`) verified the merged code
passes all tests, but that review covered the alignment pass, not the original layer
implementations.

**Why it matters:**
Future agents reading `docs/state/` to understand what was reviewed and approved before
merging to main will find a complete audit trail up through Layer 02 (WO-079B for aviation
schema planning), but nothing for the entire Layer 07 and Layer 08 implementation. An
agent asked to modify weather or news API behavior cannot look up whether any design
decision was formally reviewed. The handoff log alone does not constitute a review —
handoff entries are self-reported by worker agents, while integration reviews are
Orchestrator-produced PASS/FAIL decisions.

This is also a workflow compliance gap: `AGENTS.md` requires a review document per work
order before pushing. The layers were merged without these documents, which means future
Orchestrator-cycle work may reference this gap when deciding whether further merges are
appropriate.

**Impact:** Workflow risk

**Is this truly worth fixing?** Yes. Retrospective reviews are acceptable, and the code
itself is tested and working. The fix is documentation only — no code changes needed.

**Recommended decision:** Fix now before next feature

**Recommended owner:** Orchestrator Agent (documentation only — create retrospective
integration review documents)

**Suggested repair shape:**
Create two retrospective review documents:
- `docs/state/INTEGRATION_REVIEW_LAYER_07_WEATHER_COMPLETE.md`
- `docs/state/INTEGRATION_REVIEW_LAYER_08_NEWS_OSINT_COMPLETE.md`

Each document should follow the standard integration review format and state:
- PASS verdict
- All test commands run and results (1159 data tests pass, 503 API tests pass, 64 web tests pass)
- Summary of what was implemented (based on handoff log entries)
- Known remaining issues (e.g., workers still run manually)
- No secrets added, no security issues

**Suggested verification:**
- After creating the files, run `git ls-files docs/state/INTEGRATION_REVIEW_LAYER_07*`
  and `git ls-files docs/state/INTEGRATION_REVIEW_LAYER_08*` to confirm they are tracked
- No build or test commands are needed — this is documentation only

**Blocks next planning:** NO
**Blocks next build:** NO

---

### HEALTH-004

**Finding ID:** HEALTH-004
**Severity:** MEDIUM
**Category:** Workflow risk — agent ownership boundary undocumented deviation

**Primary files:**
- `services/normalizer/src/layers/` (only contains `layer_01_aviation/`)
- `docs/control/LLM_OWNERSHIP_MATRIX.md` (declares `services/normalizer/` → Normalizer Agent)
- `docs/control/PIPELINE_HANDOFF_RULES.md` (declares Normalizer Agent reads raw, writes to DB)
- `docs/control/DATA_LOCATION_RULES.md` (shows tree with normalizer under `services/normalizer/src/layers/`)

**Related files (actual normalizer code in non-canonical location):**
- `services/fetch-orchestrator/src/layers/layer_02_borders_boundaries/natural_earth_admin0_ingest.py`
- `services/fetch-orchestrator/src/layers/layer_03_earth_events/usgs_earthquakes_worker.py` (contains both fetch and normalize logic)
- `services/fetch-orchestrator/src/layers/layer_05_space_satellites/space_track_normalizer.py`
- `services/fetch-orchestrator/src/layers/layer_06_maritime/maritime_normalizer.py`
- `services/fetch-orchestrator/src/layers/layer_07_weather/weather_normalizer.py`
- `services/fetch-orchestrator/src/layers/layer_08_news_osint/gdacs_normalizer.py`
- `services/fetch-orchestrator/src/layers/layer_08_news_osint/gdelt_event_export_normalizer.py`
- `services/fetch-orchestrator/src/layers/layer_10_energy_infrastructure/energy_normalizer.py`

**Current evidence:**

`services/normalizer/src/layers/` contains only one entry:
```
services/normalizer/src/layers/layer_01_aviation/
  ourairports_normalizer.py
  airport_public_profile_normalizer.py
  airport_layout_features_normalizer.py
  airport_intelligence_normalizer.py
  airport_image_gallery_normalizer.py
```

All layers implemented after aviation colocate their normalizer inside the fetch-orchestrator
service. Concrete examples:
- `services/fetch-orchestrator/src/layers/layer_07_weather/weather_normalizer.py` (17KB)
- `services/fetch-orchestrator/src/layers/layer_06_maritime/maritime_normalizer.py`
- `services/fetch-orchestrator/src/layers/layer_08_news_osint/gdacs_normalizer.py`
- `services/fetch-orchestrator/src/layers/layer_08_news_osint/gdelt_event_export_normalizer.py`

`LLM_OWNERSHIP_MATRIX.md` declares:
```
| services/normalizer/ | Normalizer Agent | — |
| services/fetch-orchestrator/ | Fetcher Agent | — |
```

`DATA_LOCATION_RULES.md` shows the documented tree with:
```
services/
  normalizer/           ← Normalizer Agent
    src/layers/
        layer_01_aviation/
```
...but does not list any other layer under normalizer.

`PIPELINE_HANDOFF_RULES.md` says:
> Fetcher Agent writes raw data → Normalizer Agent reads raw → Database Agent tables

The current reality is that the Fetcher Agent's folder (`services/fetch-orchestrator/`)
contains normalizer code for 7 out of 8 implemented layers. This means:
1. The Normalizer Agent has nothing to own for those 7 layers.
2. A Fetcher Agent is effectively performing both fetch and normalize steps.
3. `DATA_LOCATION_RULES.md` diagram is incomplete (shows only aviation under normalizer).

**Why it matters:**
A new layer implementation will inherit one of two patterns:
- Pattern A (aviation): separate normalizer in `services/normalizer/src/layers/<id>/`
- Pattern B (all others): colocated normalizer in `services/fetch-orchestrator/src/layers/<id>/`

Without a documented decision, a future worker agent may choose either pattern and be
wrong. If the Fetcher Agent implements normalizer code in fetch-orchestrator and the
Normalizer Agent's charter says it owns normalizers, there is an active agent boundary
conflict that cannot be resolved without Orchestrator clarification.

Concretely: if a future Normalizer Agent is given a work order to "add a normalizer for
layer 04 public military", it will look at `services/normalizer/src/layers/` (empty
except aviation) and create the file there, following the documented ownership. If a
Fetcher Agent is given the same work order as part of a combined fetch+normalize task, it
will colocate the normalizer with the fetcher in `services/fetch-orchestrator/`. Both
agents would be following their respective understanding of the docs.

**Impact:** Workflow risk

**Is this truly worth fixing?** Yes — the ownership ambiguity must be resolved before the
next layer (e.g., layer 04 public military security) is implemented. It is a documentation
decision, not a code refactor.

**Recommended decision:** Fix now before next feature (documentation decision only)

**Recommended owner:** Orchestrator Agent (update `LLM_OWNERSHIP_MATRIX.md`,
`PIPELINE_HANDOFF_RULES.md`, and `DATA_LOCATION_RULES.md` to reflect the actual
colocated pattern, OR create a work order for Normalizer Agent to extract existing
normalizers)

**Suggested repair shape:**
The Orchestrator Agent must choose one of two official patterns and document it:

Option A — Accept colocated pattern (lower cost, matches current code):
- Update `LLM_OWNERSHIP_MATRIX.md` to add a note: "Normalizer code for all layers except
  `layer_01_aviation` is colocated in `services/fetch-orchestrator/src/layers/<id>/`
  and is owned by the Fetcher Agent."
- Update `DATA_LOCATION_RULES.md` tree to show both locations.
- Update `PIPELINE_HANDOFF_RULES.md` to describe the colocated pattern as acceptable.
- No code changes needed.

Option B — Extract all normalizers to canonical location (higher cost, aligns docs):
- Create work orders for Normalizer Agent to move normalizer files from
  `services/fetch-orchestrator/src/layers/<id>/` to `services/normalizer/src/layers/<id>/`
  for each of the 7 layers.
- Update tests if any test imports reference the old paths.
- Risk: this changes the module import path for all colocated normalizers.

**Suggested verification:**
After the documentation decision is made:
- `pnpm --filter api test` and `python -m pytest tests/data -q` must still pass
- If Option B is chosen: verify all data tests for all affected layers still pass after
  path changes (each data test imports from `layers.<layer_id>.*`)

**Blocks next planning:** YES — must be decided before the next layer is implemented to
avoid conflicting patterns
**Blocks next build:** NO (current code works; only future new layers are at risk)

---

## Low Findings

---

### HEALTH-005

**Finding ID:** HEALTH-005
**Severity:** LOW
**Category:** Documentation clarity risk — residual tool name in active doc

**Primary files:**
- `docs/control/the legacy layer-registry filename (now retired; canonical layer registry is docs/control/PROJECT_CONTROL.md Part 2 �4)` (row 4, Safety Notes column)

**Related files:**
- `AGENTS.md` (rule: "No model, provider, assistant, or tool product names are used
  anywhere in active control documents")

**Current evidence:**

`the legacy layer-registry filename (now retired; canonical layer registry is docs/control/PROJECT_CONTROL.md Part 2 �4)` row 4 Safety Notes cell (exact text):
> **HIGH SAFETY:** Public-only. Static-only. No real-time tracking. No sensitive
> coordinate data. No drone/UAV paths. All data must be from open, published, verifiable
> sources. **Any new source requires explicit Kiro approval.** Must include disclaimer in
> UI: "Publicly available information only."

This is the only remaining occurrence of a tool/product name in any active control
document after the alignment pass. All other occurrences in `the legacy layer-registry filename (now retired; canonical layer registry is docs/control/PROJECT_CONTROL.md Part 2 �4)`,
`AGENTS.md`, `GIT_WORKFLOW_POLICY.md`, `LLM_OWNERSHIP_MATRIX.md`, and
`PIPELINE_HANDOFF_RULES.md` were removed in the alignment fix.

The safety intent is preserved and correct: no new public military source should be added
without Orchestrator-level review. The problem is only the actor named ("Kiro") rather
than the neutral role ("Orchestrator Agent").

**Why it matters:**
Minor. An agent reading the registry safety notes will encounter a product name where all
other references in the same document use neutral roles. This inconsistency could:
- Confuse an agent about whether "Kiro approval" means the same as "Orchestrator Agent
  approval"
- Violate the AGENTS.md hard rule on tool names in active control docs
The safety rule itself is not weakened — the important constraint ("no new source without
explicit approval") is clear regardless of the actor name.

**Impact:** Documentation clarity risk

**Is this truly worth fixing?** Yes — it is a single word change that takes 30 seconds.
Not worth deferring.

**Recommended decision:** Fix now before next feature (trivial doc edit)

**Recommended owner:** Orchestrator Agent

**Suggested repair shape:**
In `docs/control/the legacy layer-registry filename (now retired; canonical layer registry is docs/control/PROJECT_CONTROL.md Part 2 �4)`, row 4 Safety Notes column, change:
```
Any new source requires explicit Kiro approval.
```
to:
```
Any new source requires explicit Orchestrator Agent approval.
```
One word substitution in one cell. No other files need changing.

**Suggested verification:**
- `grep -ri "kiro" docs/control/the legacy layer-registry filename (now retired; canonical layer registry is docs/control/PROJECT_CONTROL.md Part 2 �4)` should return no matches after fix
- No build or test commands needed — documentation only

**Blocks next planning:** NO
**Blocks next build:** NO

---

### HEALTH-006

**Finding ID:** HEALTH-006
**Severity:** LOW
**Category:** Documentation clarity risk — residual tool names in active policy doc

**Primary files:**
- `docs/control/BORDERS_BOUNDARIES_POLICY_SOURCE_PLAN.md`

**Related files:**
- `AGENTS.md` (hard rule: no tool/product names in active control documents)

**Current evidence:**

Exact occurrences confirmed by search:

Line 85:
> Before using any India boundary data source not listed above, a new work order must be
> raised and approved by Kiro.

Line 142:
> - [ ] Kiro sign-off recorded in the relevant work order

Line 161:
> Gate statuses last reviewed: 2026-05-26 by Kiro CLI (WO-076A). See ...

Line 218:
> The condition must be documented and escalated to Kiro before any further work proceeds.

Line 229:
> any agent attempts to use a random or third-party India boundary GeoJSON file without
> explicit Kiro approval and source documentation.

Lines 244–246:
> 1. Create a work order for Kiro CLI.
> 2. Changes to Sections 4, 5, 6, or 13 require explicit justification and Kiro sign-off.
> 3. No agent may weaken the India compliance policy without a Kiro-approved work order.

The document header was updated to "Orchestrator Agent" in the alignment pass but the
body text was not touched. The compliance rules, production gates, and safety requirements
are all correct and intact — this is purely a naming consistency issue.

**Why it matters:**
This document is active — it is the authoritative gate policy for Layer 02 production
deployment (India boundary compliance). Future agents starting borders production work
will read it and encounter mixed naming: the header says "Orchestrator Agent" but the body
says "Kiro". An agent following instructions to escalate a compliance issue "to Kiro" (line
218) may be confused about how to do that since "Kiro" is a tool, not an agent role
defined in `AGENTS.md`.

The safety rules themselves are robust. The compliance gates (G1–G6 series) will prevent
wrong boundary data from reaching production regardless of who is named. This is a
documentation clarity risk only.

**Impact:** Documentation clarity risk

**Is this truly worth fixing?** Yes, but not urgently. The safety content is sound. Bundle
with the next Orchestrator documentation pass.

**Recommended decision:** Include in next planning cycle (bundle with next Orchestrator doc-cleanup work order)

**Recommended owner:** Orchestrator Agent

**Suggested repair shape:**
In `docs/control/BORDERS_BOUNDARIES_POLICY_SOURCE_PLAN.md`, replace all occurrences of:
- "Kiro" → "Orchestrator Agent"
- "Kiro CLI" → "Orchestrator Agent"
- "Kiro sign-off" → "Orchestrator Agent sign-off"
- "Kiro approval" → "Orchestrator Agent approval"
- "Kiro-approved work order" → "Orchestrator-approved work order"

Do NOT remove or weaken any compliance requirement, gate, or safety rule. This is a
find-and-replace exercise only. Total occurrences: 7–8.

**Suggested verification:**
- `Select-String -Path "docs/control/BORDERS_BOUNDARIES_POLICY_SOURCE_PLAN.md" -Pattern "kiro" -CaseSensitive:$false` should return no matches after fix
- Review the diff before committing to confirm no compliance language was accidentally
  altered

**Blocks next planning:** NO
**Blocks next build:** NO

---

### HEALTH-007

**Finding ID:** HEALTH-007
**Severity:** LOW
**Category:** Documentation clarity risk — frontend offline registry stale source description

**Primary files:**
- `apps/web/src/lib/useLayerRegistry.ts` (layer_08 entry, line ~121, `sourceRule` field)

**Related files:**
- `apps/api/src/routes/layers.ts` (layer_08 entry — correct description with both sources)
- `services/fetch-orchestrator/src/layers/layer_08_news_osint/` (GDACS + GDELT fetcher files)

**Current evidence:**

`useLayerRegistry.ts` layer_08 entry (lines ~120–133):
```typescript
{
  layerId: 'layer_08_news_osint',
  name: 'News & OSINT',
  category: 'intelligence',
  status: 'active',
  dataStatus: 'live',
  description: 'Geolocated disaster/news events from GDACS. Globe markers for Point records; list for all records.',
  sourceRule: 'GDACS',         // <-- only GDACS listed
  ...
}
```

`apps/api/src/routes/layers.ts` layer_08 entry:
```typescript
{
  layerId: 'layer_08_news_osint',
  sourceRule: 'GDACS and GDELT event/news source families. Standard fetcher/normalizer pattern. Live data requires the news worker to be running.',
  ...
}
```

`services/fetch-orchestrator/src/layers/layer_08_news_osint/` contains:
```
gdacs_fetcher.py         (GDACS source)
gdacs_normalizer.py
gdelt_event_export_fetcher.py    (GDELT source)
gdelt_event_export_normalizer.py
```

The frontend local registry is the **fallback** used when the API is offline. When the
API is online, the frontend merge function replaces the local entry with the API entry,
which has the correct source description. The discrepancy is only visible when the API is
unreachable.

**Why it matters:**
When the API is offline (startup delay, network error, development without backend), the
frontend displays "GDACS" as the only source for the news layer. This is factually
incorrect — GDELT is also an implemented source. A future Frontend Agent maintaining the
local registry could:
- See the GDACS-only description and assume GDELT was not added yet
- Remove GDELT-related UI code thinking it is future work

The `description` field also only mentions GDACS, reinforcing the impression.

**Impact:** Documentation clarity risk (low practical risk — API online is the normal state)

**Is this truly worth fixing?** Yes — minor but easy. Keeps local registry truthful.

**Recommended decision:** Fix now before next feature (trivial one-field update)

**Recommended owner:** Frontend Agent

**Suggested repair shape:**
In `apps/web/src/lib/useLayerRegistry.ts`, update the layer_08 entry:
```typescript
// Change:
description: 'Geolocated disaster/news events from GDACS. Globe markers for Point records; list for all records.',
sourceRule: 'GDACS',
// To:
description: 'Geolocated disaster/event and open-source intelligence items from GDACS and GDELT. Globe markers and list.',
sourceRule: 'GDACS and GDELT Event Export',
```

**Suggested verification:**
- `pnpm --filter web test` — 64/64 must still pass (web tests mock the API, so the
  sourceRule string change does not affect test assertions)
- `pnpm --filter web build` — must complete

**Blocks next planning:** NO
**Blocks next build:** NO

---

### HEALTH-008

**Finding ID:** HEALTH-008
**Severity:** LOW
**Category:** Documentation clarity risk — duplicate npm script

**Primary files:**
- `package.json` (root)

**Related files:**
- `.github/workflows/ci.yml` (uses `api:test`)

**Current evidence:**

`package.json` scripts section:
```json
{
  "scripts": {
    "api:test": "pnpm --filter api test",
    "test:api": "pnpm --filter api test"
  }
}
```

Both `api:test` and `test:api` execute exactly the same command. CI uses `api:test`:
```yaml
- name: Run API tests
  run: pnpm run api:test
```

`test:api` is an unused alias that was added at some point when the naming convention may
have been in flux. It does not appear in any CI step, any `AGENTS.md` instruction, or any
work order.

**Why it matters:**
A future worker agent running tests might call `pnpm run test:api` instead of
`pnpm run api:test` and get the same result, not knowing which is canonical. More
importantly, if the API test command ever changes (e.g., to add a flag), an agent
maintaining only the `api:test` entry would leave `test:api` stale — making one of them
wrong without any error. There is no functional bug today.

**Impact:** Low/no practical risk (both commands work identically today)

**Is this truly worth fixing?** Minor. Safe to remove `test:api`. No urgency.

**Recommended decision:** Backlog (bundle with next root-config cleanup)

**Recommended owner:** Orchestrator Agent (root config is not owned by a specific worker
agent; any agent can raise it)

**Suggested repair shape:**
Remove the `test:api` entry from `package.json`. Keep `api:test` as the canonical script
(matches CI).

**Suggested verification:**
- `pnpm run api:test` — must still pass after removal
- `pnpm run test:api` — should fail with "script not found" after removal (confirming it
  was removed)
- Verify `.github/workflows/ci.yml` still uses `api:test` (it does — no change needed)

**Blocks next planning:** NO
**Blocks next build:** NO

---

### HEALTH-009

**Finding ID:** HEALTH-009
**Severity:** LOW
**Category:** Documentation clarity risk — no root README

**Primary files:**
- Repository root (no `README.md` or `README` tracked)

**Related files:**
- `AGENTS.md` (functions as the landing document)
- `docs/control/the legacy layer-registry filename (now retired; canonical layer registry is docs/control/PROJECT_CONTROL.md Part 2 �4)` (authoritative registry)

**Current evidence:**

`git ls-files` at root returns no `README*` file. The repository root contains:
```
AGENTS.md          ← used as de-facto entry document
.env.example
package.json
pnpm-workspace.yaml
requirements-data.txt
pytest.ini
.gitignore
```

GitHub and most developer tooling display `README.md` as the default landing page. The
repo currently shows `AGENTS.md` as the landing document when browsed on GitHub. `AGENTS.md`
is comprehensive and well-maintained, but it is an agent-control document, not a
developer-facing introduction.

**Why it matters:**
Any external contributor or agent onboarding to the project for the first time sees a
dense agent-control rules document first. A human developer spinning up the project for
the first time needs to know how to run it locally — `AGENTS.md` does not contain setup
instructions (port numbers, environment variables, how to start the API and frontend, how
to run tests). The absence of a README creates a discoverability gap but does not break
any workflow.

**Impact:** Documentation clarity risk (low practical impact — no agent is broken)

**Is this truly worth fixing?** Yes but low priority. A minimal README pointing to
`AGENTS.md` and providing local setup commands would remove friction.

**Recommended decision:** Backlog

**Recommended owner:** Orchestrator Agent (root-level documentation)

**Suggested repair shape:**
Create `README.md` at repo root with:
- One-sentence project description
- "See AGENTS.md for multi-agent control rules and layer registry"
- Quick start: `pnpm install`, `pnpm api`, `pnpm dev`, `python -m pytest tests/data -q`
- Required `.env` vars: `DATABASE_URL`, `VITE_CESIUM_ION_ACCESS_TOKEN`, `VITE_API_BASE_URL`
- Link to `docs/control/the legacy layer-registry filename (now retired; canonical layer registry is docs/control/PROJECT_CONTROL.md Part 2 �4)`

Do not duplicate `AGENTS.md` content. The README is navigation only.

**Suggested verification:**
- `git ls-files README.md` confirms it is tracked
- `pnpm --filter web build` — no impact, but ensures nothing breaks

**Blocks next planning:** NO
**Blocks next build:** NO

---

### HEALTH-010

**Finding ID:** HEALTH-010
**Severity:** LOW
**Category:** Documentation clarity risk — migration sequence gap

**Primary files:**
- `database/migrations/layers/layer_01_aviation/` (directory)

**Related files:**
- `database/migrations/README.md` (if it documents ordering rules)

**Current evidence:**

Directory listing for `database/migrations/layers/layer_01_aviation/`:
```
001_aviation_reference_tables.sql      (exists)
002_*.sql                              (MISSING — no file)
003_aviation_search_indexes.sql        (exists)
004_aviation_coordinate_quality_overrides.sql
005_airport_public_profile_cache.sql
006_airport_intelligence_foundation.sql
007_airport_capacity_profiles.sql
008_airport_traffic_metrics.sql
009_airport_derived_intelligence.sql
010_airport_image_assets.sql
011_airport_layout_features.sql
012_aviation_live_aircraft_tables.sql
013_aviation_live_aircraft_snapshots.sql
```

Migrations `001` and `003` through `013` are present. `002` is absent. This is a
pre-existing gap that preceded the alignment merge. All other layer migration folders
(layer_02 through layer_10) have only a single `001_*.sql` file — none have a gap.

All files were last modified `Jun 09 10:19` (same timestamp, suggesting they were all
committed together in an initial import or reorganization). There is no `git log`
evidence of a deleted `002` file since the repository history on this branch begins at
that same date. The gap is consistent with either:
- A migration was intentionally removed/replaced during early aviation development
- The original file was numbered starting at 001 and then a gap was created during a
  refactoring that renumbered subsequent migrations

The gap has no functional runtime impact. No migration runner is present in the codebase
(migrations are applied manually via `psql` based on `database/migrations/README.md`).
The sequence is informational, not programmatically enforced.

**Why it matters:**
A future Database Agent applying migrations in sequence order could apply `001`, then
expect `002`, then find `003` and not know whether to skip or whether a file is missing.
This creates a one-time confusion that can be resolved by documentation. The gap does not
cause schema errors because all 12 existing migrations are idempotent and independent
(they use `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`).

**Impact:** Documentation clarity risk

**Is this truly worth fixing?** Minor. Adding a note to `database/migrations/README.md`
(or creating a placeholder `002_placeholder.sql` with a comment) would fully resolve this.
Not worth creating a dedicated work order.

**Recommended decision:** Backlog (bundle with next database documentation pass)

**Recommended owner:** Database Agent

**Suggested repair shape:**
Option A (preferred, lowest risk): Add a note to `database/migrations/README.md`
explaining the numbering gap: "Migration 002 for layer_01_aviation was intentionally
removed during early development. Migration 003 follows directly from 001."

Option B: Create an empty placeholder file
`database/migrations/layers/layer_01_aviation/002_REMOVED.sql` containing only a comment:
```sql
-- Migration 002 was removed during early aviation schema reorganization.
-- Sequence continues at 003_aviation_search_indexes.sql.
```

**Suggested verification:**
- `git ls-files database/migrations/layers/layer_01_aviation/` — confirms the new
  placeholder or README is tracked
- `python -m pytest tests/data -q` — 1159 passed, 15 skipped (no change expected)

**Blocks next planning:** NO
**Blocks next build:** NO

---

### HEALTH-011

**Finding ID:** HEALTH-011
**Severity:** LOW
**Category:** Documentation clarity risk — tool-specific entries in .gitignore

**Primary files:**
- `.gitignore` (lines 64–65, 77–81)

**Related files:**
- `AGENTS.md` (hard rule: no tool/product names in active control documents)

**Current evidence:**

`.gitignore` lines 64–65:
```
# Kiro local settings
.kiro/settings.local.json
```

`.gitignore` lines 77–81:
```
# MiniMax-M3 private session memory and local tooling
.m3-session-memory.md
.opencode/
graphify-out/
```

None of these paths exist in the working tree (confirmed: `Test-Path ".m3-session-memory.md"` = False, `Test-Path ".opencode"` = False). They are precautionary entries preventing accidental commit of local session files from tools that were used during project development.

**Whether AGENTS.md rule applies to .gitignore:**
`AGENTS.md` hard rule: "No model, provider, assistant, or tool product names are used
anywhere in active control documents." `.gitignore` is an infrastructure file, not a
control document. It does not communicate workflows to agents, it does not affect agent
behavior, and it is not listed in `AGENTS.md` "Key Documents" section. The strict reading
of the rule would require stripping these entries; the practical reading would say
`.gitignore` is exempt as a technical infrastructure file.

These entries do not protect secrets (they protect local session state files). They cause
no harm and serve a useful purpose: preventing accidental commit of tool-generated files.

**Why it matters:**
Low to no practical risk. If a strict neutral-naming audit is applied, these entries
would need to change. If the entries are removed without replacing them with neutral
alternatives, any tool session file with those names could be accidentally staged and
committed — which is a mild security/hygiene risk. The practical tradeoff favors keeping
them as-is.

**Impact:** Low/no practical risk

**Is this truly worth fixing?** No, not in isolation. The safety benefit of keeping these
entries outweighs the naming consistency benefit of removing them. If the project decides
to adopt a neutral convention like `.agent-session/` for all tool session files, this
can be updated then.

**Recommended decision:** Ignore/archive (document that .gitignore is exempt from the
neutral-name rule as a technical infrastructure file)

**Recommended owner:** No action

**Suggested repair shape:** None required. If desired, the comment lines could be changed
to neutral descriptions:
```
# Local agent session and tooling artifacts
.kiro/settings.local.json
.m3-session-memory.md
.opencode/
graphify-out/
```
This preserves the ignore patterns while removing product names from the comments.

**Suggested verification:**
- After any comment-only change: `git diff --check` should pass
- `python -m pytest tests/data -q` — no impact

**Blocks next planning:** NO
**Blocks next build:** NO

---

### HEALTH-012

**Finding ID:** HEALTH-012
**Severity:** LOW
**Category:** Workflow risk — dual work-order convention creates discoverability gap

**Primary files:**
- `docs/work-orders/` directory (newest: `WO-079A-aviation-live-source-schema-plan.md`)
- `docs/archive/2026-06-16-implemented-specs/003-layer-05-space-satellites/` through `docs/archive/2026-06-16-implemented-specs/007-layer-08-news-osint/`

**Related files:**
- `AGENTS.md` (workflow step 1: "The Orchestrator Agent creates work orders in `docs/work-orders/`")
- `docs/control/LLM_OWNERSHIP_MATRIX.md` (declares `docs/work-orders/` → Orchestrator Agent)

**Current evidence:**

`docs/work-orders/` newest file: `WO-079A-aviation-live-source-schema-plan.md` (dated
Jun 09 10:19 — same as all other files in this folder). There are no work orders for
layers 05, 06, 07, 08, or 10.

`specs/` directory:
```
specs/001-layer-zero-globe-core/
specs/002-layer-one-aviation/
docs/archive/2026-06-16-implemented-specs/003-layer-05-space-satellites/    ← layer 05 (no WO in docs/work-orders/)
docs/archive/2026-06-16-implemented-specs/004-layer-10-energy-infrastructure/  ← layer 10 (no WO)
docs/archive/2026-06-16-implemented-specs/005-layer-06-maritime/            ← layer 06 (no WO)
docs/archive/2026-06-16-implemented-specs/006-layer-07-weather/             ← layer 07 (no WO)
docs/archive/2026-06-16-implemented-specs/007-layer-08-news-osint/          ← layer 08 (no WO)
```

`AGENTS.md` step 1:
> The Orchestrator Agent creates work orders in `docs/work-orders/`.

The convention shift happened at some point between WO-079A (last aviation work order)
and spec 003 (first spec-tracked layer). Layers 01 and 02 used `docs/work-orders/`. Layers
03 and above used `specs/` for their planning documents. Layers 05–08 and 10 have no files
in `docs/work-orders/` at all.

Within each `specs/<n>-*/` directory there is typically a `WORK_ORDERS.md` file that
enumerates the sub-work-orders for that spec (e.g.,
`docs/archive/2026-06-16-implemented-specs/007-layer-08-news-osint/WORK_ORDERS.md` lists WO-NEWS-G1, G1.5, G2, A1, A2,
U1, U2). These are not in the format of `docs/work-orders/*.md` files.

**Why it matters:**
An agent reading `AGENTS.md` step 1 to understand where to find existing work orders will
look in `docs/work-orders/` and find nothing for the most recently implemented 5 layers.
Conversely, an agent creating a new work order for a layer 04 or layer 09 implementation
may create it in `docs/work-orders/` (following `AGENTS.md`), while the Orchestrator's
actual recent practice has been to create a `specs/` directory for new layers.

The inconsistency means future agents have two places to look and no documented rule about
which to use for a new layer. The `AGENTS.md` instruction is now out of sync with actual
practice.

**Impact:** Workflow risk (documentation clarity primarily)

**Is this truly worth fixing?** Yes — the `AGENTS.md` instruction should either point to
`specs/` for new layers or explicitly say both locations are valid. This is a
documentation-only fix.

**Recommended decision:** Fix now before next feature (documentation only — update AGENTS.md
before the next layer work order is created)

**Recommended owner:** Orchestrator Agent

**Suggested repair shape:**
Update `AGENTS.md` step 1 to reflect the actual dual convention:
```
1. The Orchestrator Agent creates work orders or specs for the new work:
   - New layer implementations: create a spec directory under `specs/<n>-<layer-name>/`
     containing `spec.md`, `tasks.md`, and `WORK_ORDERS.md`.
   - Cross-cutting or non-layer work orders: create a file in `docs/work-orders/`
     following the existing WO naming convention.
```

Alternatively, create summary stub files in `docs/work-orders/` for each spec-tracked
layer (e.g., `WO-LAYER05-space-satellites-see-specs.md` with a pointer to the spec dir).

**Suggested verification:**
- After updating `AGENTS.md`, confirm `grep -n "work-orders" AGENTS.md` shows the updated
  instruction
- No build or test commands needed

**Blocks next planning:** YES — should be clarified before the Planning Agent starts the
next layer work order so it knows where to create the document
**Blocks next build:** NO

---

## Archive Handling Rule

### Which files may retain old tool/model/provider names

The following files are **historical records** and must not be modified to remove tool
names. They exist as immutable evidence of past work and decisions:

| File / File Group | Reason names are acceptable |
|---|---|
| `docs/state/HANDOFF_LOG.md` — entries before 2026-06 | Append-only log. Historical entries recorded actual tool usage before the neutral-name policy was enforced. Cannot be retroactively altered without violating append-only rule. |
| `docs/state/INTEGRATION_REVIEW_WO-001.md` through `WO-079B.md` (~50 files) | Immutable per-WO review records. Each was written and finalized as a point-in-time artifact. Modifying them would corrupt the historical audit trail. |
| `docs/work-orders/WO-001` through `WO-079A` (38 files) | Completed work orders. Historical planning records. The work they describe is done. |
| `docs/control/AIRPORT_PUBLIC_ENRICHMENT_PIPELINE.md` | Historical aviation enrichment design doc. Contains tool names in authorship/WO-owner fields only. Implementation is complete. No active workflow depends on it. |
| `docs/control/BORDERS_BOUNDARIES_IMPLEMENTATION_GATE_REVIEW.md` | Historical gate review. Contains "Reviewer: Kiro CLI" header and model reference. Compliance requirements are enforced by the active policy plan. |
| `docs/control/the legacy borders-source-selection filename (now archived)` and related | Source decision docs with "Author: Kiro CLI" headers. Decisions are settled. Not active workflow instructions. |
| `docs/reports/` (all WO report files) | Historical work summaries. Same rationale as work orders. |
| `docs/audits/PROJECT_ALIGNMENT_REPORT.md` | Pre-alignment audit report produced before the neutral-name policy was fully applied. Contains agent name references as historical context. The alignment fix neutralized active docs. |

### Which active documents must use neutral role names only

Every file in this list must be kept neutral:

| File | Status |
|---|---|
| `AGENTS.md` | PASS — fully neutral |
| `docs/control/the legacy layer-registry filename (now retired; canonical layer registry is docs/control/PROJECT_CONTROL.md Part 2 �4)` | PARTIAL — one cell (HEALTH-005, one word change needed) |
| `docs/control/LAYER_ARCHITECTURE.md` | PASS — fully neutral |
| `docs/control/LAYER_ID_CONVENTIONS.md` | PASS — fully neutral |
| `docs/control/LLM_OWNERSHIP_MATRIX.md` | PASS — fully neutral |
| `docs/control/PIPELINE_HANDOFF_RULES.md` | PASS — fully neutral |
| `docs/control/GIT_WORKFLOW_POLICY.md` | PASS — fully neutral |
| `docs/control/DATA_LOCATION_RULES.md` | PASS — fully neutral |
| `docs/control/SOURCE_TO_FRONTEND_CONTRACT.md` | PASS — fully neutral |
| `docs/control/BORDERS_BOUNDARIES_POLICY_SOURCE_PLAN.md` | PARTIAL — body text has 7–8 occurrences (HEALTH-006, find-and-replace needed) |
| `docs/state/CURRENT_PROJECT_STATE.md` | PASS — fully neutral |
| `docs/state/HANDOFF_LOG.md` — new entries | PASS — new entries use neutral role names |
| All commit messages — new commits | PASS — enforced by GIT_WORKFLOW_POLICY.md |

**Rule summary:** If a file is listed in `AGENTS.md` "Key Documents" section, or if it
contains active workflow instructions that agents are expected to follow today, it must use
neutral role names. If a file is a completed historical record (review, report, old WO,
old handoff entry), old tool names in it are acceptable as-is.

---

## Branch Cleanup Recommendation

### Current branch state (as of this research commit)

```
git log --oneline -n 4:
  5b89062 (HEAD -> research/project-health-workflow-audit)  docs(audit): add project health workflow audit
  5fea8f2 (origin/main, origin/HEAD, main)                  Merge pull request #40 ...
```

```
git branch --merged main:
  main
  (research/project-health-workflow-audit is NOT in this list)
```

### Branches safe to delete locally (after merge to main)

| Branch | Status | Safe to delete? |
|---|---|---|
| `alignment/project-docs-code-registry-fix` | Merged to main (PR #40) | YES — safe to delete locally after confirming `origin/alignment/project-docs-code-registry-fix` is merged. `git branch -d alignment/project-docs-code-registry-fix` |

Confirmed: `git log` shows `5fea8f2` is tagged `origin/alignment/project-docs-code-registry-fix` AND is the merge commit to main. This branch is fully merged.

### Branches that must NOT be deleted

| Branch | Status | Reason |
|---|---|---|
| `research/project-health-workflow-audit` | Local only, NOT pushed, NOT merged | Contains 1 local commit (`5b89062`) with the audit report and this findings explanation. Must be reviewed by Orchestrator Agent before push. Deleting would lose the audit work. |
| `main` | Protected | Active base branch. Never delete. |

### When to delete `research/project-health-workflow-audit`

Delete only after the Orchestrator Agent:
1. Reviews this branch
2. Creates `docs/state/INTEGRATION_REVIEW_RESEARCH_HEALTH_WORKFLOW_AUDIT.md`
3. Pushes the branch to `origin/research/project-health-workflow-audit`
4. Merges or creates a PR to main
5. Confirms the merge is complete via `git branch --merged main`

**Do not** run `git branch -D research/project-health-workflow-audit` (force delete without
merge check) under any circumstances — this branch has audit content not yet on remote.

---

## Findings Priority Order for Planning Agent

| Priority | Finding | Effort | Owner | Why now |
|---|---|---|---|---|
| 1 | HEALTH-004 | Low (doc decision) | Orchestrator | Must decide before next layer build |
| 2 | HEALTH-012 | Low (1 doc edit) | Orchestrator | Must clarify before next layer WO |
| 3 | HEALTH-003 | Low (2 doc files) | Orchestrator | Closes workflow compliance gap |
| 4 | HEALTH-001 | Low (1 line code) | Frontend Agent | Fixes silent runtime bug |
| 5 | HEALTH-005 | Trivial (1 word) | Orchestrator | Neutral-name compliance |
| 6 | HEALTH-007 | Trivial (2 fields) | Frontend Agent | Accuracy in offline mode |
| 7 | HEALTH-006 | Low (7 replacements) | Orchestrator | Neutral-name compliance |
| 8 | HEALTH-002 | Medium (contract design) | API + Contract Agent | Plan before next status consumer |
| 9 | HEALTH-008 | Trivial | Orchestrator | Cleanup, backlog |
| 10 | HEALTH-009 | Low | Orchestrator | Onboarding, backlog |
| 11 | HEALTH-010 | Trivial | Database Agent | Note in README, backlog |
| 12 | HEALTH-011 | No action | — | Keep as-is |

---

**Last updated:** 2026-06-14
**Author:** Research Agent
**Maintained by:** Orchestrator Agent after review
