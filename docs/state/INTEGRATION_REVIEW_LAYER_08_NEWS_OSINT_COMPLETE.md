# INTEGRATION_REVIEW_LAYER_08_NEWS_OSINT_COMPLETE — Retrospective Review

**Review Type:** Retrospective integration review (post-merge audit-trail completion)
**Layer Reviewed:** `layer_08_news_osint` (News & OSINT)
**Review Date:** 2026-06-14
**Reviewer:** Orchestrator Agent (Documentation Agent lane)
**Status:** PASS — Audit-trail gap closed; no code change required

---

## 1. Purpose

The `AGENTS.md` workflow policy requires the Orchestrator Agent to create
`docs/state/INTEGRATION_REVIEW_[WO].md` for every work order before the branch is
pushed to remote. Layer 08 News & OSINT was implemented and merged to `main`
across several work orders (e.g. WO-NEWS-G1, G1.5, G2, G3, A1, A2, U1, U2 — see
`specs/007-layer-08-news-osint-mvp/WORK_ORDERS.md` and the entries in
`docs/state/HANDOFF_LOG.md`) without a companion review document in
`docs/state/`. This retrospective review closes that audit-trail gap.

This review **does not rewrite history**. It is a point-in-time record that, as
of 2026-06-14, the Layer 08 work on `main` is reviewed and accepted, with the
limitations and assumptions documented below. Earlier
`INTEGRATION_REVIEW_*.md` records for prior work orders are immutable; this
document does not modify them.

---

## 2. Evidence Sources

The verdict below is based on three independent, reconcilable sources:

1. **Handoff log entries** — `docs/state/HANDOFF_LOG.md` records each worker
   agent's sub-work-order handoff (GDACS + GDELT fetchers, normalizers, API,
   frontend, data tests) for the news/OSINT layer, including commands run and
   per-handoff validation results.
2. **Merged code on `main`** — all code under
   `services/fetch-orchestrator/src/layers/layer_08_news_osint/`,
   `apps/api/src/routes/layers/layer_08_news_osint*` (or its `news/*` route
   family), `apps/web/src/layers/layer_08_news_osint/`, and
   `database/migrations/layers/layer_08_news_osint/` is tracked and present in
   the branch base (`origin/main`, commit `5d0c724`).
3. **Project health audit** — `docs/audits/PROJECT_HEALTH_WORKFLOW_AUDIT.md`
   (Sections 3 and 7) and `docs/audits/PROJECT_HEALTH_FINDINGS_EXPLAINED.md`
   record the full build/test sweep run on the merged code on 2026-06-14.

All three sources agree on the implementation scope, layer ID
(`layer_08_news_osint`), the dual-source pattern (GDACS for disaster alerts,
GDELT Event Export for event/news), and that the five required CI gates
(contracts build, API build, API test, web test, web build) and the data-test
gate pass on a clean tree.

---

## 3. Layer Scope Reviewed

| Aspect | Status |
|--------|--------|
| `layer_id` canonical | `layer_08_news_osint` |
| Source families | GDACS (disaster alerts) **and** GDELT Event Export (event/news) — both implemented |
| Fetcher paths | `services/fetch-orchestrator/src/layers/layer_08_news_osint/` (GDACS and GDELT fetchers) |
| Normalizer paths | `gdacs_normalizer.py`, `gdelt_event_export_normalizer.py` (colocated under the fetcher per documented colocated pattern) |
| API surface | `GET /api/layers/layer_08_news_osint/news/{items,markers,sources,fetch-runs,stats}` (`news/*` sub-resource family) |
| Frontend | `apps/web/src/layers/layer_08_news_osint/` |
| Database | `database/migrations/layers/layer_08_news_osint/` plus `news_*` tables with `layer_id`, `source_id`, `source_object_id` |
| Default UI toggle | OFF (active layer, default OFF) |
| Source attribution | Every item carries source attribution in the API response and the UI (registry requirement) |

---

## 4. Test / Build Sweep (Project Health Audit, 2026-06-14)

The following results come from the project health audit run on a clean tree
based on `origin/main` (commit `5d0c724`). They are reproduced here as the
authoritative evidence for this retrospective review.

| Gate | Command | Result |
|------|---------|--------|
| Contracts build | `pnpm --filter @god-eyes/contracts build` | **PASS** |
| API build | `pnpm --filter api build` | **PASS** |
| API test | `pnpm --filter api test` | **PASS** — 503/503 tests, 17 files |
| Web test | `pnpm --filter web test` | **PASS** — 64/64 tests, 3 files |
| Web build | `pnpm --filter web build` | **PASS** |
| Data tests | `python -m pytest tests/data -q` | **PASS** — 1159 passed, 15 skipped |

These results match the pre-merge per-handoff entries in
`docs/state/HANDOFF_LOG.md` for the Layer 08 sub-work-orders, including the
GDACS-G1/G2/G3 and GDELT A1/A2/U1/U2 worker handoffs.

---

## 5. Security / Secrets Check

| Check | Result |
|-------|--------|
| No real secrets in any tracked file | **PASS** — only placeholders in `.env.example` and `apps/web/.env.example` |
| No `.env` committed | **PASS** — `.env` paths gitignored |
| No raw fetch output committed | **PASS** — `raw/` and `tmp/` are gitignored |
| No generated or cache files committed | **PASS** — no `__pycache__/`, `*.pyc`, `node_modules/`, `dist/` in tracked tree |
| Source vetting | **PASS** — only public, vetted, attribution-bearing source families (GDACS, GDELT) are ingested; no fake-news or propaganda sources |
| No tool/product names in new active control docs | **PASS** — neutral role names used |

---

## 6. Known Limitations

The following limitations are **not blocking** and are recorded so future agents
do not misread the layer as fully production-automated:

1. **Live workers are still run manually.** The GDACS and GDELT fetchers for
   `layer_08_news_osint` are invoked manually or by an external scheduler. A
   unified worker runner is deferred to a future work order. When no worker
   has run recently, the API returns an empty state (which is the documented
   behavior — no fake/demo data).
2. **UI default toggle is OFF.** The news/OSINT layer is `active` in the
   registry but defaults to OFF in the UI to limit visual density and FPS
   impact. The layer is user-toggleable.
3. **Frontend offline registry has a one-word staleness** in the local
   `sourceRule` for layer 08 (`'GDACS'` only). The API registry correctly
   lists `'GDACS and GDELT Event Export'`. The local entry is only visible
   when the API is unreachable. This is recorded as `HEALTH-007` (low
   severity) in the project health audit and is not a defect of the layer
   itself; it is a stale fallback field. A future Frontend Agent may resolve
   `HEALTH-007` in a separate task; it is out of scope for this retrospective
   review.
4. **OSINT source curation is continuous.** The registry Safety Notes state
   that OSINT sources must be vetted, must respect copyright/fair use, and
   must include source attribution. The current source list (GDACS + GDELT)
   meets that bar; adding new sources requires Orchestrator-level review per
   the registry and per `AGENTS.md` workflow.

These limitations do not invalidate the verdict below; they are pre-existing
characteristics of the implementation as merged.

---

## 7. Verdict

**PASS** — Layer 08 News & OSINT is reviewed, accepted, and present on `main`.
The absence of a per-work-order integration review at push time is a workflow
compliance gap, **not** a code or runtime defect. The retroactive review above
documents the as-merged state and the known limitations so future agents have
the same audit trail they would have had if a review had been filed at the
time of the original merge.

---

## 8. What This Review Closes

- **Audit trail:** `docs/state/INTEGRATION_REVIEW_*.md` now contains a
  retrospective review for the two most recently merged live-data layers
  (Layer 07 and Layer 08), as well as the historical `INTEGRATION_REVIEW_*.md`
  records that already cover Layers 00–02, WO-079A, and WO-079B.
- **Workflow compliance:** the gap flagged in `HEALTH-003` of
  `docs/audits/PROJECT_HEALTH_WORKFLOW_AUDIT.md` is closed for Layer 08.
- **Discoverability:** any agent reading `docs/state/` to understand the
  review history of `layer_08_news_osint` will now find an explicit PASS
  record with evidence and known limitations.

---

## 9. What This Review Does Not Do

- It does **not** modify any earlier `INTEGRATION_REVIEW_*.md` file. Earlier
  records are immutable point-in-time artifacts.
- It does **not** modify the original Layer 08 work-order handoff entries in
  `docs/state/HANDOFF_LOG.md`. The handoff log is append-only.
- It does **not** change any code, contract, migration, fetcher, normalizer,
  API, or frontend file. The implementation on `main` is unchanged.
- It does **not** resolve `HEALTH-007` (frontend offline registry
  `sourceRule` staleness for layer 08). That is a frontend-local-registry
  edit and is out of scope for this documentation-only retrospective
  review.
- It does **not** authorize any new work or relax any safety rule.

---

## 10. Related Documents

- `docs/audits/PROJECT_HEALTH_WORKFLOW_AUDIT.md` (HEALTH-003 source)
- `docs/audits/PROJECT_HEALTH_FINDINGS_EXPLAINED.md` (HEALTH-003 deep explanation)
- `specs/007-layer-08-news-osint-mvp/` (planning spec — spec/overview, contract
  details, work orders, test plan, open questions, final report)
- `docs/control/MVP_LAYER_REGISTRY.md` (Layer 08 row)
- `docs/state/HANDOFF_LOG.md` (per-handoff entries for Layer 08 sub-work-orders)

---

**Last updated:** 2026-06-14
**Authored by:** Documentation Agent (Orchestrator-role retrospective review)
**Maintained by:** Orchestrator Agent
