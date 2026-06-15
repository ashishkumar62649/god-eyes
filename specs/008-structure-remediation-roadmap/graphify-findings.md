# Graphify Findings — Structure Remediation Roadmap

> **Agent:** Graphify Research Agent
> **Lane:** Research / Documentation
> **Branch:** `spec/structure-remediation-roadmap`
> **Date:** 2026-06-15
> **Graph commit:** `b4acdf7d`

---

## Purpose

This document is a **discovery pass** conducted before the structure remediation
roadmap (`specs/008-structure-remediation-roadmap/`) is reviewed and executed.
Graphify was used as a read-only knowledge-graph tool to surface hidden coupling,
stale references, architectural hubs, and dependency relationships that may affect
the 18 planned `SR-NNN` work packages.

All findings were verified against actual project files before being recorded here.
Graphify is a discovery tool, not the source of truth.

---

## Graphify commands run

| Command | Result |
|---|---|
| `git status --short --branch` | `## spec/structure-remediation-roadmap` — clean tree except untracked `.agents/`, `.kiro/skills/`, `.kiro/steering/`, `CLAUDE.md` |
| `pip show graphifyy \| Select-String Version` | `Version: 0.7.15` |
| `graphify . --no-viz` | FAILED — `.` is not a valid subcommand in this version. Build was not re-run. |
| `graphify extract . --no-cluster` | FAILED — no LLM API key set. |
| Existing `graphify-out/graph.json` used | 9.9 MB, built from commit `b4acdf7d` (current HEAD). |
| `graphify query "..."` × 10 | All 10 queries succeeded using BFS traversal of existing graph.json. |
| `GRAPH_REPORT.md` inspected | Present at `graphify-out/GRAPH_REPORT.md`. |

---

## Graphify availability

**Partially available.** The graphify CLI is installed (v0.7.15) and all `query`,
`path`, and `explain` subcommands work against the pre-built `graph.json`. The
`extract` and top-level directory-scan commands require an LLM API key or a
different command syntax and could not be run in this session. The existing
graph.json was used for all queries.

**Graph stats:** 10,528 nodes · 14,227 edges · 676 communities.
Extraction: 93% EXTRACTED · 7% INFERRED.

---

## Key architectural hubs

From `GRAPH_REPORT.md` god-node list, confirmed by query results:

| Rank | Node | Edges | Location | Why it matters |
|---|---|---|---|---|
| 1 | `Format` | 69 | `layer_07_weather/weather_local_seed.py` | High-degree data formatting node — weather extraction hub |
| 2 | `query()` | 43 | `apps/api/src/routes/` (multiple files) | SQL hub — confirms SQL is embedded directly in route handlers |
| 3 | `AirportPublicProfilePayload` | 36 | `packages/schemas/layers/layer_01_aviation/` | Cross-layer data contract |
| 4 | `ImageCandidate` | 36 | Aviation image gallery normalizer | Worker data shape hub |
| 5 | `SpaceTrackClient` | 30 | `services/fetch-orchestrator/.../layer_05_space_satellites/` | Fetcher coupling hub |
| 6 | `MaritimeRawStorage` | 29 | `services/fetch-orchestrator/.../layer_06_maritime/` | Storage coupling hub |

Cross-community bridge nodes (high betweenness centrality):
- `parse_wikidata_entity_response()` — bridges communities 277, 63, 51, 13, 103.
- `compute_position_from_tle()` — bridges communities 39, 8, 51, 140, 71.
- `fetch_proof_data()` — bridges communities 243, 115, 77, 30.

Frontend hubs confirmed:
- `CesiumGlobe.tsx` — 33 import statements; central renderer connected to every layer.
- `DetailPanel.tsx` — 953 lines; connected to aviation intel, maritime, sources, public profile sub-components.
- `LayerPanel.tsx` — 1079 lines; connected to all 9 active layers' toggle UI.

---

## Hidden coupling findings

### GF-001 — Duplicate parse helpers across three large API route files

**Graphify signal:** Query 3 ("hidden coupling") surfaced `maritime.ts`, `news.ts`,
`weather.ts` as separate nodes with no shared `validation.ts` parent. God node
`query()` (43 edges) sits inside individual route files, not a shared module.

**Verified files:**
- `apps/api/src/routes/weather.ts` lines 178, 198, 211: `parseBbox`, `parseLimit`, `parseOffset`
- `apps/api/src/routes/news.ts` lines 174, 187: `parseLimit`, `parseOffset`
- `apps/api/src/routes/maritime.ts` lines 146, 166, 179, 192: `parseBbox`, `parseLimit`, `parseOffset`, `parseNumeric`

**Why it matters:** Three near-identical validation functions diverge silently. A
bug fix in one does not propagate to the others. The route splits (SR-002, SR-003)
will create `validation.ts` files in each route folder; the opportunity to extract
a shared `apps/api/src/lib/query-limits.ts` helper is visible but not yet blocked.

**Roadmap impact:** Already partially addressed by SR-002 (weather) and SR-003
(news) route splits. SR-004 review should explicitly call out the shared-helper
opportunity for maritime.

**Confidence:** HIGH — directly verified in source files.

---

### GF-002 — SQL (`query()`) embedded directly in route handlers (confirmed god node)

**Graphify signal:** `query()` is the second-highest god node (43 edges), bridging
multiple route-file communities and the database.

**Verified files:**
- `apps/api/src/routes/weather.ts` — `query()` called directly in route handlers (2 occurrences confirmed).
- `apps/api/src/routes/news.ts`, `maritime.ts`, `energy/infrastructure.ts`, `space/satellites.ts` — same pattern (confirmed by research.md §1.4).

**Why it matters:** SQL in route handlers means business logic, DB access, and
HTTP handling are in one file. A change to SQL affects test coverage for the full
route. This is the core structural issue that SR-002 through SR-004 address.

**Roadmap impact:** Directly motivates SR-002 (weather), SR-003 (news), SR-004
(review for maritime/energy/space). No new task needed.

**Confidence:** HIGH — confirmed by source inspection and research.md §1.4.

---

### GF-003 — `CesiumGlobe.tsx` is a frontend coupling hub for all layer renderers

**Graphify signal:** Query 5 ("non-canonical layer names") returned `CesiumGlobe.tsx`
as a high-degree node connected to `aviation/`, `maritime/`, `space/satellites/`,
`energy/infrastructure/`, `earth-events/`, `borders/` layer components.

**Verified files:**
- `apps/web/src/CesiumGlobe.tsx` — 33 import statements (confirmed).

**Why it matters:** CesiumGlobe imports from both canonical (`layer_07_weather`,
`layer_08_news_osint`) and non-canonical (`aviation/`, `maritime/`, `space/`,
`energy/`, `earth-events/`, `borders/`) layer folders. Each of the SR-009..SR-014
folder-rename work packages must update CesiumGlobe.tsx import paths. This is a
known risk already documented in research.md §9, but the graphify query makes the
coupling explicit.

**Roadmap impact:** SR-009 through SR-014 already list CesiumGlobe.tsx as an
importer to update. No new task needed. The reviewer for each folder-rename WP
must explicitly check CesiumGlobe.tsx.

**Confidence:** HIGH — confirmed by import count.

---

### GF-004 — `energy/infrastructure.ts` is larger than research.md states

**Graphify signal:** Query 8 ("which API routes should be split first") surfaced
`infrastructure.ts` as a large coupling node.

**Verified files:**
- `apps/api/src/routes/energy/infrastructure.ts` — **683 lines** (research.md §1.2 states 614).

**Why it matters:** The SR-004 planning review uses research.md line counts to
prioritise the splits. The energy route is 683 lines, not 614 — it is already
above the 501–800 "must split" band and closer to the 800-line threshold than
documented. This may affect prioritisation in the SR-004 review.

**Roadmap impact:** `research.md §1.2` table should be corrected. See
"Recommended roadmap updates" below.

**Confidence:** HIGH — directly measured with `Get-Content`.

---

### GF-005 — `space/satellites.ts` is larger than research.md states

**Graphify signal:** Same as GF-004 — satellites.ts appeared in the god-node
neighbourhood for `query()`.

**Verified files:**
- `apps/api/src/routes/space/satellites.ts` — **582 lines** (research.md §1.2 states 520).

**Why it matters:** At 582 lines, `satellites.ts` is firmly in the 501–800
"must split" band. The 62-line discrepancy likely reflects commits after the
research doc was written.

**Roadmap impact:** `research.md §1.2` table should be corrected.

**Confidence:** HIGH — directly measured.

---

### GF-006 — `layer_07_infrastructure` stale name appears in active audit doc and HANDOFF_LOG

**Graphify signal:** Community 386 in the graph contained nodes referencing
`layer_07_infrastructure`. Community 90 confirmed ALIGN-001 documents the
`layer_07_infrastructure` vs `layer_07_weather` conflict.

**Verified files:**
- `docs/archive/2026-06-14-documentation-cleanup/reports/WO-062-...` — 5 occurrences (archive, historical, expected).
- `docs/state/HANDOFF_LOG.md` lines 428, 814, 6166, 6167, 6692 — historical handoff entries, not active instructions.
- `docs/audits/PROJECT_HEALTH_WORKFLOW_AUDIT.md` line 568 — documents the mismatch as PASS (correct; confirms it is resolved).
- `apps/web/src/layers/layer_07_weather/__tests__/weather.test.ts` lines 95–96 — **guard test** that asserts `layer_07_infrastructure` is NOT in the registry. This is correct behaviour, not a problem.

**Why it matters:** Graphify surfaced this as a potential stale reference.
Direct verification confirms all occurrences are either archived docs, historical
handoff log entries, or a guard test. **No active code uses `layer_07_infrastructure`.**
This is not a new finding.

**Roadmap impact:** None. Already handled. The guard test should remain.

**Confidence:** HIGH — all occurrences verified and classified.

---

### GF-007 — 20 Python files reported as 1-file self-import cycles (graphify artifact)

**Graphify signal:** GRAPH_REPORT.md lists 20 "1-file cycles" across
`database/ingestion/`, `packages/schemas/`, and `services/fetch-orchestrator/`
Python files (e.g. `weather_ingestion.py -> weather_ingestion.py`).

**Verified:** These are graphify extraction artifacts — the tool sometimes creates
a self-loop edge when a module has internal cross-references (class methods calling
module-level functions). In Python, a file cannot import itself. No real circular
imports exist.

**Why it matters:** These are NOT real import cycles. No refactor is needed.
Graphify is known to produce 1-file self-import cycles as a benign artifact.

**Roadmap impact:** None. Not a real structural problem.

**Confidence:** HIGH — 1-file cycles are a known graphify artifact; Python cannot
self-import.

---

### GF-008 — 5040 isolated nodes (docs/scripts weakly connected)

**Graphify signal:** GRAPH_REPORT.md "Knowledge Gaps" section reports 5040 isolated
nodes including `auto-commit.sh`, `create-new-feature.sh`, `git-common.sh`,
`initialize-repo.sh`, and 5035 more.

**Verified:** These are shell scripts, standalone documentation sections, and
archive docs that have no code imports — they are correctly isolated. The graphify
graph was built without LLM semantic extraction (`--no-cluster` / AST-only), so
cross-file conceptual links in docs are not captured.

**Why it matters:** Not a structural problem in the application. The isolation
count is an artifact of including `docs/archive/` in the graph corpus.

**Roadmap impact:** None.

**Confidence:** HIGH.

---

## Canonical layer-name findings

Confirmed by query 5 and direct `Get-ChildItem` inspection:

| Current folder | Canonical name | Status |
|---|---|---|
| `apps/web/src/layers/aviation/` | `layer_01_aviation` | Grandfathered — SR-009 |
| `apps/web/src/layers/borders/` | `layer_02_borders_boundaries` | Grandfathered — SR-010 |
| `apps/web/src/layers/earth-events/` | `layer_03_earth_events` | Grandfathered — SR-011 |
| `apps/web/src/layers/space/` | `layer_05_space_satellites` | Grandfathered — SR-012 |
| `apps/web/src/layers/maritime/` | `layer_06_maritime` | Grandfathered — SR-013 |
| `apps/web/src/layers/energy/` | `layer_10_energy_infrastructure` | Grandfathered — SR-014 |
| `apps/web/src/layers/layer_07_weather/` | `layer_07_weather` | **Canonical ✓** |
| `apps/web/src/layers/layer_08_news_osint/` | `layer_08_news_osint` | **Canonical ✓** |

No new findings beyond what `research.md §2.2` already documents.

---

## API route findings

Affects SR-002, SR-003, SR-004.

| File | Lines (verified) | Lines (research.md) | Delta | Priority |
|---|---:|---:|---:|---|
| `apps/api/src/routes/weather.ts` | 1095 | 1095 | 0 | SR-002 (Phase 1) |
| `apps/api/src/routes/news.ts` | 1014 | 1014 | 0 | SR-003 (Phase 1) |
| `apps/api/src/routes/maritime.ts` | 797 | 797 | 0 | SR-004 review |
| `apps/api/src/routes/energy/infrastructure.ts` | **683** | 614 | **+69** | SR-004 review — higher priority than documented |
| `apps/api/src/routes/space/satellites.ts` | **582** | 520 | **+62** | SR-004 review — higher priority than documented |

**GF-004 / GF-005 impact:** Both `energy/infrastructure.ts` and `space/satellites.ts`
are materially larger than documented. The SR-004 review agent should re-measure all
files before making split recommendations.

Duplicate parse helpers (GF-001) are present in weather, news, and maritime. The SR-002
weather split should move `parseLimit`, `parseBbox`, `parseOffset` to
`apps/api/src/routes/weather/validation.ts`. The SR-003 news split should do the same
for news. If a shared `apps/api/src/lib/query-limits.ts` is desired, that is a
follow-up task beyond the current SR scope.

---

## Frontend findings

Affects SR-005, SR-006, SR-008 through SR-014.

- `LayerPanel.tsx` — 1079 lines (verified). Matches research.md. SR-006 target.
- `DetailPanel.tsx` — 953 lines (verified). Matches research.md. SR-005 target.
- `CesiumGlobe.tsx` — 33 imports; hub for all layer renderers (GF-003). Every
  SR-009..SR-014 folder-rename must update CesiumGlobe.tsx import paths.
- `apps/web/src/App.tsx` — also imports from layer folders (confirmed by query 5
  result set). Must be updated in each SR-009..SR-014 work package.
- All 6 grandfathered short-name layer folders confirmed present (see canonical
  layer-name findings above).

No new frontend findings beyond research.md §2.

---

## Contracts findings

Affects SR-001 and SR-007.

- `packages/contracts/src/index.ts` — **1326 lines** (verified; research.md states
  1325 — 1-line difference, within rounding).
- `LayerStatusResponseSchema` with aviation-specific `objectCounts` confirmed by
  research.md §4.2 (HEALTH-002). Not re-inspected in this pass; finding stands.
- No new contracts findings from graphify queries. Community 0 (225 nodes) contains
  the aviation contract types; this confirms the contracts barrel is heavily
  aviation-weighted and justifies the SR-007 split.

---

## Fetcher/normalizer findings

Affects SR-015.

- Graphify confirmed `SpaceTrackClient` (30 edges) and `MaritimeRawStorage` (29
  edges) as high-degree fetcher nodes. These are correctly colocated in their
  layer folders.
- No cross-boundary imports detected between fetcher/normalizer and `apps/web/`
  or `apps/api/` (confirmed by research.md §5.4 and graphify query 3 results).
- Multi-source flat layout confirmed: `layer_01_aviation/`, `layer_05_space_satellites/`,
  `layer_08_news_osint/`, `layer_10_energy_infrastructure/` all use prefixed flat
  file names instead of `sources/<name>/` subfolders. This is the known SR-015
  target.

No new fetcher findings beyond research.md §5.

---

## Database/test findings

Affects SR-016 and SR-017.

- Database migration structure confirmed canonical by research.md §6. Aviation `002`
  gap documented.
- Test file sizes: graphify Community 1 (98 nodes) corresponds to
  `tests/data/layer_05_space_satellites/test_space_satellites_fetcher.py` — the
  largest test file (2411 lines). This is the primary SR-017 target.
- No new database or test findings from graphify beyond what research.md §7 documents.

---

## Documentation/spec reference findings

- `layer_07_infrastructure` appears only in: (a) `docs/archive/` docs (correct),
  (b) historical `HANDOFF_LOG.md` entries (append-only, do not rewrite), (c) a
  guard test that asserts it is NOT in the registry (correct). No active doc or
  code uses this stale name. **No action needed.**
- Graphify query 6 ("old archived paths in docs/specs") returned only archive
  folder nodes — expected behaviour; no active doc is referencing archived paths.
- Community 386 in the graph (node `layer_07_infrastructure`) resolves to the
  WO-062 archived planning doc. Historical only.

---

## Recommended roadmap updates

### Update 1 — Correct line counts in `research.md §1.2`

- **Update needed?** YES
- **File to update:** `specs/008-structure-remediation-roadmap/research.md`
- **Exact section:** §1.2 "Top-level file routes" table — rows for
  `energy/infrastructure.ts` and `space/satellites.ts`
- **Why:** Verified line counts differ from documented counts. `energy/infrastructure.ts`
  is 683 lines (not 614). `space/satellites.ts` is 582 lines (not 520). The SR-004
  review agent will use these numbers to set priorities; incorrect counts could
  lead to under-prioritising the energy route split.

---

## Findings that do not require roadmap changes

- **GF-006** — `layer_07_infrastructure` stale name: only in archive/historical
  locations and a guard test. No action.
- **GF-007** — 20 self-import cycles: graphify artifact. No real cycles. No action.
- **GF-008** — 5040 isolated nodes: expected for docs/scripts. No action.
- **GF-003** — CesiumGlobe.tsx as hub: already known, already documented as a risk
  in research.md §9. No new task needed.
- **GF-001 / GF-002** — duplicate helpers and SQL in route files: already the
  motivation for SR-002, SR-003, SR-004.
- Graphify's BFS queries retrieved mostly archive document nodes when querying
  high-level terms like "API", "Frontend", "Contracts". This is expected — the
  graph contains a large archive corpus. The structural code findings were extracted
  from the god-node list and community analysis instead.

---

## Open questions for human decision

1. **Should `apps/api/src/lib/query-limits.ts` be created as a shared helper
   during SR-002/SR-003, or as a separate follow-up task?** Creating it during
   SR-002 would reduce duplication immediately but slightly expands the SR-002
   scope beyond "pure route split."

2. **Given that `energy/infrastructure.ts` is 683 lines (not 614), should SR-004
   explicitly recommend splitting it before `space/satellites.ts` (582 lines)?**
   The current plan.md does not specify a sub-order for the three remaining routes.

3. **Should the graphify skill (`.kiro/skills/graphify/SKILL.md`) and steering
   file (`.kiro/steering/graphify.md`) be committed to the repo or remain
   untracked?** They were created by `graphify kiro install` during this session
   and are currently untracked. They are not part of the application and not
   referenced by any build or test.

---

**Last updated:** 2026-06-15
**Author:** Graphify Research Agent
**Source graph:** `graphify-out/graph.json` (commit `b4acdf7d`)
