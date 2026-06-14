# GOD EYES — Borders & Boundaries Source License Clearance Kit

**Layer ID:** `layer_02_borders_boundaries`
**Work order:** WO-078A-BORDERS-SOURCE-LICENSE-CLEARANCE-KIT
**Author:** Kiro CLI
**Last updated:** 2026-05-26

---

## 1. Purpose

This document is the official source license clearance kit for the Borders & Boundaries
layer. It defines the workflow, required human actions, approval states, and stop conditions
that must be satisfied before any boundary data may be ingested into the project.

No boundary data may be downloaded, committed, or ingested until the clearance workflow
in this document is completed by a human and evidence is saved in the project docs.

---

## 2. Layer ID

`layer_02_borders_boundaries`

---

## 3. Current Status

| Component | Status |
|-----------|--------|
| Policy plan | COMPLETE — `docs/control/BORDERS_BOUNDARIES_POLICY_SOURCE_PLAN.md` |
| Gate review | COMPLETE — `docs/control/BORDERS_BOUNDARIES_IMPLEMENTATION_GATE_REVIEW.md` |
| Database schema | COMPLETE — WO-077, commit 08bd985 |
| Source clearance kit | COMPLETE — this document (WO-078A) |
| India data ingestion | **BLOCKED** — G1, G2, G3, G6 not cleared |
| Non-India data ingestion | **BLOCKED** — G4, G5, G6 not cleared |
| API endpoints | **BLOCKED** — depends on ingestion |
| Frontend layer | **BLOCKED** — depends on API |
| Layer status in registry | `coming_soon` — not active |

---

## 4. Source Clearance Workflow

```
Human reads Survey of India Geospatial Guidelines (G1)
        ↓
Human contacts Survey of India for vector data licensing (G2)
        ↓
Human receives response and saves evidence in docs/
        ↓
Human confirms coverage: J&K, Ladakh, PoK, Aksai Chin (G3)
        ↓
Human reviews non-India source licenses (G4)
        ↓
Human writes disputed territory handling policy (G5)
        ↓
Human completes data licensing checklist (G6)
        ↓
Kiro reviews evidence and approves sources
        ↓
WO-078B ingestion plan work order created
        ↓
WO-078 ingestion begins
```

No step may be skipped. No agent may perform the human steps.

---

## 5. India Source Clearance Workflow

1. **Human reads Survey of India Geospatial Guidelines**
   URL: https://onlinemaps.surveyofindia.gov.in/GeospatialGuidelines.aspx
   Required: Confirm what the guidelines require for digital map applications.
   Clears: G1

2. **Human contacts Survey of India for digital vector boundary data licensing**
   Use the template in `docs/control/BORDERS_BOUNDARIES_SURVEY_OF_INDIA_REQUEST_TEMPLATE.md`.
   Required: Send inquiry and await response.
   Clears: G2 (partial — requires response)

3. **Human confirms data availability**
   Required: Confirm whether Survey of India digital vector boundary data is available
   for licensing to private software applications.
   If not available: India ingestion is permanently blocked until an alternative
   official source is identified and approved by Kiro.

4. **Human confirms license terms**
   Required: Obtain written license terms. Confirm:
   - Commercial use permitted or restricted
   - Attribution requirements
   - Derivative works / simplification allowed
   - Redistribution restrictions
   - Display restrictions
   Clears: G2 (full)

5. **Human confirms data format**
   Required: Confirm available formats (Shapefile, GeoJSON, GML, or other).

6. **Human confirms coverage**
   Required: Confirm the licensed dataset includes India's official depiction of:
   - Jammu & Kashmir (full extent per Indian government)
   - Ladakh (as Union Territory)
   - Pakistan-occupied Jammu & Kashmir (PoK)
   - Chinese-occupied Aksai Chin
   Clears: G3

7. **Human saves evidence**
   Required: Save the Survey of India response text (email, letter, or web confirmation)
   as a plain text or markdown file in `docs/data/layer_02_borders_boundaries/` before
   any ingestion work starts. File must be committed to the repository.

8. **India ingestion remains blocked until steps 1–7 are complete.**

---

## 6. Non-India Source Clearance Workflow

For each candidate non-India source (Natural Earth, UN Cartographic, GADM):

1. **Human reviews license terms**
   Confirm: license type, commercial use, attribution, derivative works, redistribution.

2. **Human performs India conflict check**
   Confirm: the source's depiction of India's boundary, J&K, Ladakh, PoK, and Aksai Chin
   does not conflict with Survey of India / Government of India official depiction.
   If conflict found: the source must be clipped/replaced at India borders before use,
   or rejected entirely.

3. **Human reviews disputed territory handling**
   Confirm: how the source handles all disputed boundaries globally. Document any
   segments that require special handling.
   Clears: G5 (partial — per source)

4. **Human records decision in source review tracker**
   Update `docs/control/BORDERS_BOUNDARIES_SOURCE_REVIEW_TRACKER.md` with findings.

5. **Human completes data licensing checklist**
   Complete Section 8 of `docs/control/BORDERS_BOUNDARIES_POLICY_SOURCE_PLAN.md`
   for each approved source.
   Clears: G4, G6 (when all sources reviewed)

6. **Non-India ingestion remains blocked until steps 1–5 are complete for at least
   one approved non-India source.**

---

## 7. Required Human Actions

| Action | Clears Gate | Owner | Status |
|--------|-------------|-------|--------|
| Read Survey of India Geospatial Guidelines | G1 | Human | NOT STARTED |
| Contact Survey of India for vector data licensing | G2 | Human | NOT STARTED |
| Confirm India data coverage (J&K, Ladakh, PoK, Aksai Chin) | G3 | Human | NOT STARTED |
| Review Natural Earth license and India-conflict | G4 (partial) | Human | NOT STARTED |
| Review UN Cartographic license | G4 (partial) | Human | NOT STARTED |
| Confirm GADM license compatibility | G4 (partial) | Human | NOT STARTED |
| Write disputed territory handling policy | G5 | Human + Kiro | NOT STARTED |
| Complete data licensing checklist for all confirmed sources | G6 | Human + Kiro | NOT STARTED |
| Save Survey of India response evidence in docs/ | G2 prerequisite | Human | NOT STARTED |

---

## 8. Approval Decision States

Each source in the source review tracker may be in one of these states:

| State | Meaning |
|-------|---------|
| `not_started` | No review has begun |
| `in_contact` | Human has contacted the source provider; awaiting response |
| `license_received` | License terms received; under review |
| `approved` | Human review complete, Kiro sign-off given, source may be used |
| `rejected` | Source rejected — license incompatible, India conflict, or other reason |
| `blocked` | Review cannot proceed without additional information |

**No source may be used for ingestion until its state is `approved`.**
Approval requires both human review completion and Kiro sign-off in a work order.

---

## 9. Required Evidence Before Approval

Before any source may be marked `approved`, the following evidence must exist in the
project repository:

**For India sources:**
- Survey of India response text saved in `docs/data/layer_02_borders_boundaries/`
- License terms documented in the source review tracker
- Coverage confirmation (J&K, Ladakh, PoK, Aksai Chin) documented
- Kiro sign-off in a work order

**For non-India sources:**
- License type and terms documented in the source review tracker
- India conflict check result documented
- Disputed territory handling documented
- Attribution requirements documented
- Kiro sign-off in a work order

---

## 10. Stop Conditions

All stop conditions from `BORDERS_BOUNDARIES_POLICY_SOURCE_PLAN.md` Section 13 remain
in force. Additional stop conditions for this clearance kit:

1. **Evidence not saved** — any agent attempts to start WO-078B ingestion without
   Survey of India response evidence committed to the repository.
2. **Approval claimed without evidence** — any document or work order claims a source
   is approved without the required evidence existing in the repository.
3. **India conflict not checked** — any non-India source is used without an India
   conflict check being documented.
4. **Human steps skipped** — any agent attempts to perform the human steps in Sections
   5 or 6 (e.g., by fabricating a Survey of India response or guessing license terms).
5. **Ingestion started before G1–G6 cleared** — any WO-078 ingestion work begins
   before all six blocked gates are cleared.

---

## 11. What Agents May Do

- Read this document and the policy plan.
- Update the source review tracker with information provided by the human.
- Draft WO-078B ingestion plan work order once human provides approval evidence.
- Create schema tests or documentation that does not ingest real boundary data.
- Ask the human for clarification on source review findings.

---

## 12. What Agents May Not Do

- Download any boundary dataset (Survey of India, Natural Earth, UN, GADM, OSM, or other).
- Commit any GeoJSON, shapefile, KML, CSV, or other boundary data file.
- Claim any source is approved without human review and Kiro sign-off.
- Fabricate or guess Survey of India license terms or responses.
- Start WO-078 ingestion before G1–G6 are cleared.
- Weaken the India compliance policy.
- Use Natural Earth, OSM, Google Maps, Bing Maps, or random GeoJSON for India boundaries.

---

## 13. What Human / Final Boss Must Do

1. Read Survey of India Geospatial Guidelines.
2. Send the Survey of India request (use template in
   `docs/control/BORDERS_BOUNDARIES_SURVEY_OF_INDIA_REQUEST_TEMPLATE.md`).
3. Save the Survey of India response as a file in `docs/data/layer_02_borders_boundaries/`.
4. Review Natural Earth, UN Cartographic, and GADM licenses.
5. Perform India conflict checks for each non-India source.
6. Update `docs/control/BORDERS_BOUNDARIES_SOURCE_REVIEW_TRACKER.md` with findings.
7. Confirm disputed territory handling decisions.
8. Notify Kiro when all human steps are complete so a Kiro review and WO-078B can proceed.

---

## 14. Next Possible Outcomes

| Outcome | Condition | Next Step |
|---------|-----------|-----------|
| India source approved | Survey of India response received, license confirmed, coverage confirmed, Kiro sign-off | Create WO-078B ingestion plan for India boundaries |
| India source rejected | Survey of India data unavailable, license incompatible, or coverage insufficient | Layer remains schema-only for India; document reason |
| India source unclear | Response received but license terms ambiguous | Stay blocked; seek legal clarification |
| Non-India source approved | License confirmed, India conflict checked, Kiro sign-off | Create WO-078B ingestion plan for non-India boundaries |
| Non-India source rejected | License incompatible or India conflict unresolvable | Source rejected; find alternative or stay blocked |
| All sources blocked | No source clears review | Layer remains schema-only; revisit in future work order |

---

## 15. Reviewer Checklist

Before approving any WO-078B ingestion work order:

- [ ] Survey of India response evidence exists in `docs/data/layer_02_borders_boundaries/`
- [ ] India source license terms are documented in the source review tracker
- [ ] India coverage (J&K, Ladakh, PoK, Aksai Chin) is confirmed
- [ ] At least one non-India source has completed license review
- [ ] India conflict check is documented for all non-India sources used
- [ ] Disputed territory handling policy is written and approved
- [ ] Data licensing checklist (Section 8 of policy plan) is complete
- [ ] All approved sources are in `approved` state in the source review tracker
- [ ] No rejected source type (Section 6 of policy plan) is used for India data
- [ ] Kiro sign-off exists in the WO-078B work order
- [ ] No boundary data was committed without approval
