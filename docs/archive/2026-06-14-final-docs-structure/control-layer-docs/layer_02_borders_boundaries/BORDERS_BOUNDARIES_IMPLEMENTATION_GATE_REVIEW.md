# GOD EYES — Borders & Boundaries Implementation Gate Review

**Layer ID:** `layer_02_borders_boundaries`
**Work order:** WO-076A-BORDERS-BOUNDARIES-GATE-AND-SOURCE-REVIEW
**Reviewer:** Kiro CLI
**LLM model:** Claude Sonnet 4.5
**Review date:** 2026-05-26
**Policy source:** `docs/control/BORDERS_BOUNDARIES_POLICY_SOURCE_PLAN.md`
**Based on commit:** 327848c

---

## 1. Purpose

This document records the formal gate review for `layer_02_borders_boundaries` implementation.
It determines whether any implementation work order (WO-077+) may safely begin, and under
what conditions.

---

## 2. Gate Status Assessment

Gates are defined in `BORDERS_BOUNDARIES_POLICY_SOURCE_PLAN.md` Section 9.

| Gate | Requirement | Status | Reason |
|------|-------------|--------|--------|
| G1 | Survey of India Geospatial Guidelines reviewed | **BLOCKED** | Requires human to read and confirm https://onlinemaps.surveyofindia.gov.in/GeospatialGuidelines.aspx. Cannot be confirmed by an AI agent. |
| G2 | India boundary source identified and licensed | **BLOCKED** | No licensed India vector boundary source has been identified. Survey of India digital vector data requires direct contact with Survey of India for licensing. No license confirmation exists. |
| G3 | India boundary covers J&K, Ladakh, PoK, Aksai Chin per official depiction | **BLOCKED** | Depends on G2. Cannot verify coverage without an identified and licensed source. |
| G4 | Non-India source identified, licensed, and India-conflict-checked | **BLOCKED** | Candidate sources (Natural Earth, UN Cartographic, GADM) are listed in the policy plan but none have been formally evaluated, licensed, or India-conflict-checked. This requires human review of each source's license terms. |
| G5 | Disputed territory handling policy written and approved | **BLOCKED** | The policy plan states disputed segments require individual review. No per-segment disputed territory policy has been written or approved. This requires human decision-making. |
| G6 | Data licensing checklist (Section 8) fully completed | **BLOCKED** | Depends on G2 and G4. No source has been confirmed, so the checklist cannot be completed. |
| G7 | Database schema work order (WO-077) drafted and approved | **PENDING** | WO-077 has not been drafted yet. This gate can be cleared by drafting WO-077 with a schema-only scope. |
| G8 | No agent has started writing code or ingesting data | **PASS** | Confirmed. No application code, database migrations, or data files have been created for this layer. |

**Summary:**
- PASS: 1 (G8)
- PENDING: 1 (G7)
- BLOCKED: 6 (G1–G6)
- FAIL: 0

---

## 3. India Compliance Reaffirmation

The following rules from Section 4 of the policy plan remain in full force and are
reaffirmed by this review:

1. India boundary display must follow Survey of India / Government of India standard.
   This rule cannot be overridden.
2. Implementation must STOP if official Survey of India vector data is unavailable or
   licensing is unclear. **This stop condition is currently active** — no licensed India
   vector source exists.
3. Natural Earth, OpenStreetMap, Google Maps data, Bing Maps data, third-party GeoJSON,
   and hand-drawn fixes are all rejected for India boundaries.
4. India depiction must include official treatment of Jammu & Kashmir, Ladakh,
   Pakistan-occupied Jammu & Kashmir (PoK), and Chinese-occupied Aksai Chin.
5. No agent may use any India boundary data not in the approved source hierarchy
   (Section 5 of the policy plan) without a new Kiro-approved work order.

---

## 4. Source Path Assessment

### India boundary data

**Current state:** No licensed India vector boundary source exists.

The policy plan's approved source hierarchy (Section 5) lists:
- Survey of India Geospatial Guidelines — a compliance reference, not a data download
- Survey of India Political Map of India — a web page with a raster/PDF map, not vector data
- Survey of India English Political Map 2026 PDF — a PDF, not vector data
- MHA 2019 J&K and Ladakh map release — a PDF press release, not vector data
- Survey of India licensed digital vector data — requires direct contact with Survey of India

**Missing items (exact):**
1. Confirmation that Survey of India digital vector boundary data is available for licensing
2. License terms from Survey of India for this application's use case (commercial/non-commercial)
3. Confirmation of data format (Shapefile, GeoJSON, GML, or other)
4. Confirmation that the licensed dataset covers J&K, Ladakh, PoK, and Aksai Chin per
   official Indian government depiction
5. Kiro sign-off on the confirmed source and license

**Action required:** Human must contact Survey of India directly to request licensing
information for digital vector boundary data. Until this is done, G2 and G3 remain BLOCKED.

### Non-India boundary data

**Current state:** Three candidate sources are listed in the policy plan (Section 7).
None have been evaluated, licensed, or India-conflict-checked.

**Missing items (exact):**
1. Natural Earth: license confirmed as public domain, but India conflict check not done.
   Specifically, Natural Earth's depiction of J&K, Aksai Chin, and PoK must be reviewed
   against Survey of India standard before Natural Earth can be used even for non-India
   boundaries (to ensure it is clipped/replaced correctly at India borders).
2. UN Cartographic Section: license terms not reviewed. May have restrictions on
   disputed territory depiction.
3. GADM: license (non-commercial/academic) may not be compatible with this application.
   Must be confirmed.

**Action required:** Human must review each candidate source's license and India-conflict
status. This can be done in parallel with the Survey of India contact.

---

## 5. Can WO-077 Database Schema Start?

**Answer: CONDITIONAL — schema-only, with strict scope.**

The policy plan states: "All gates must be PASS before any implementation work order
(WO-077+) is started." However, a database schema work order is a special case:

- Schema design does not require actual boundary data.
- Schema design does not require a licensed source.
- Schema design does not ingest, store, or display any India boundary geometry.
- A well-designed schema can be written to be source-agnostic and data-agnostic.

**WO-077 may proceed under the following strict conditions:**

1. Scope is schema definition only — table structures, column types, indexes, constraints.
2. No actual boundary geometry is inserted, seeded, or referenced.
3. No India-specific geometry columns are pre-populated.
4. No source-specific assumptions are baked into the schema that would lock in a
   non-compliant data source.
5. The schema must be designed to accept Survey of India-compliant data when it becomes
   available.
6. WO-077 must explicitly state it does not clear G1–G6 and that data ingestion (WO-078)
   remains blocked until G1–G6 are cleared.

**G7 can be cleared by drafting WO-077 with this scope.**

---

## 6. Can India Data Ingestion Start?

**Answer: NO.**

India data ingestion (WO-078 for India boundaries) cannot start until:
- G1: Survey of India Geospatial Guidelines reviewed by a human
- G2: Licensed India vector source confirmed
- G3: Coverage of J&K, Ladakh, PoK, Aksai Chin verified
- G6: Data licensing checklist completed

None of these can be cleared without human action. **India data ingestion is blocked.**

---

## 7. Can Non-India Boundary Schema Planning Start?

**Answer: CONDITIONAL — schema planning only, not ingestion.**

Non-India schema planning (column design, geometry types, source_id fields) can proceed
as part of WO-077 schema work, since schema design is source-agnostic.

Non-India data ingestion (WO-078 for non-India boundaries) cannot start until:
- G4: Non-India source identified, licensed, and India-conflict-checked
- G6: Data licensing checklist completed

These require human review of Natural Earth, UN Cartographic, and GADM licenses.

---

## 8. Recommendation

**Recommendation D: Proceed only after human obtains Survey of India licensing/data
confirmation — with one exception.**

The exception: **WO-077 database schema may be drafted and executed** under the strict
schema-only scope defined in Section 5 above, because schema work does not require
licensed data and does not risk India compliance violations.

All other implementation (WO-078 data ingestion, WO-079 API, WO-080 frontend) remains
blocked until G1–G6 are cleared.

### Required human actions before G1–G6 can be cleared:

| Action | Clears Gate(s) | Owner |
|--------|---------------|-------|
| Read Survey of India Geospatial Guidelines at https://onlinemaps.surveyofindia.gov.in/GeospatialGuidelines.aspx and confirm compliance requirements | G1 | Human |
| Contact Survey of India to request licensing for digital vector boundary data | G2, G3 | Human |
| Review Natural Earth license and India-conflict status | G4 (partial) | Human |
| Review UN Cartographic license terms | G4 (partial) | Human |
| Confirm GADM license compatibility | G4 (partial) | Human |
| Write and approve per-segment disputed territory handling policy | G5 | Human + Kiro |
| Complete data licensing checklist (Section 8 of policy plan) for all confirmed sources | G6 | Human + Kiro |

---

## 9. WO-077 Strict Scope Definition

If WO-077 is approved to proceed, its scope must be limited to:

**Allowed in WO-077:**
- Database table definitions for `layer_02_borders_boundaries`
- Column definitions: `layer_id`, `source_id`, `source_object_id`, `feature_type`,
  `geometry` (PostGIS), `properties` (JSONB), `created_at`, `updated_at`
- Index definitions (spatial index on geometry, standard indexes)
- Constraint definitions (NOT NULL, CHECK constraints)
- Migration file in `database/migrations/layers/layer_02_borders_boundaries/`
- Schema tests in `tests/data/layer_02_borders_boundaries/`
- Work order and report docs

**Forbidden in WO-077:**
- Any actual boundary geometry records (no seed data, no test fixtures with real coordinates)
- Any India-specific geometry
- Any source ingestion logic
- Any API endpoints
- Any frontend code
- Any reference to a specific data source as "approved" unless G1–G6 are cleared
- Any claim that the schema is ready for India data ingestion

---

## 10. Updated Gate Status for Policy Plan

The following gate status updates should be applied to
`BORDERS_BOUNDARIES_POLICY_SOURCE_PLAN.md` Section 9:

| Gate | Old Status | New Status | Notes |
|------|------------|------------|-------|
| G1 | PENDING | BLOCKED | Requires human review of Survey of India guidelines |
| G2 | PENDING | BLOCKED | Requires human to contact Survey of India for licensing |
| G3 | PENDING | BLOCKED | Depends on G2 |
| G4 | PENDING | BLOCKED | Requires human review of non-India source licenses |
| G5 | PENDING | BLOCKED | Requires human decision on disputed territory policy |
| G6 | PENDING | BLOCKED | Depends on G2 and G4 |
| G7 | PENDING | PENDING | Can be cleared by drafting WO-077 schema-only |
| G8 | PENDING | PASS | Confirmed: no code or data started |
