# GOD EYES — Borders & Boundaries MVP Boundary Mode Decision

**Layer ID:** `layer_02_borders_boundaries`
**Work order:** WO-078A1-BORDERS-MVP-BOUNDARY-MODE-DECISION
**Author:** Kiro CLI
**Date:** 2026-05-26

---

## 1. Purpose

This document records the project owner's decision on how to proceed with Borders &
Boundaries during the MVP/local-development phase, given that Survey of India
licensing contact is deferred to the production/deployment compliance stage.

This document does not approve any data source. It does not claim legal permission.
It does not weaken India compliance for production. It only defines the boundary
between MVP/dev work and production compliance requirements.

---

## 2. Layer ID

`layer_02_borders_boundaries`

---

## 3. Owner Decision

The project owner has decided:

1. **Survey of India email/contact is deferred** until the production/deployment
   compliance stage. It will not be sent during MVP/local development.
2. **MVP work may continue** only as local/dev source evaluation and planning.
3. **No boundary data is downloaded or ingested in this work order.**
4. **No source is approved by this decision.**
5. **No India production compliance is claimed.**

---

## 4. Production Rule (Unchanged)

**This rule is not weakened by the MVP decision.**

- Production/deployed India boundary display still requires Survey of India /
  Government of India compliance review before any public deployment.
- No production deployment may use unverified India boundary data.
- Survey of India contact and licensing must be completed before any India boundary
  data is served to end users in a deployed environment.
- The stop conditions in `BORDERS_BOUNDARIES_POLICY_SOURCE_PLAN.md` Section 13
  remain in full force for production.

---

## 5. MVP / Local Development Rule

During MVP/local development only:

- Country-boundary sources may be evaluated for license, attribution, and India
  conflict risk.
- A recommended MVP/dev source path may be documented.
- Local development may use a source for visual testing only, provided:
  - The source license permits local/non-commercial use.
  - The source is not committed as production-approved data.
  - India boundary display in local dev is clearly marked as non-compliant /
    not-for-production.
  - No claim is made that the source meets Survey of India / Government of India
    standard.
- MVP/local development must NOT:
  - Mark any India source as approved.
  - Mark the Borders layer as production-ready.
  - Claim official legal boundary accuracy.
  - Serve India boundary data to end users without Survey of India compliance.

---

## 6. Still Forbidden in This Work Order

- No data download
- No GeoJSON, shapefiles, KML, CSV, or PDF boundary files
- No API work
- No frontend work
- No source ingestion
- No fake boundary records
- No claim that Survey of India approved anything
- No claim that email/contact is not legally required
- No claim that any source meets production compliance

---

## 7. Next Allowed Step

**WO-078B: Country Boundary Source Evaluation**

WO-078B is the next safe work order. It may proceed under the scope defined in
Section 8 below.

---

## 8. WO-078B Allowed Scope

WO-078B may:

- Review public country-boundary sources (Natural Earth, UN Cartographic, GADM,
  or other candidates).
- Review license terms and attribution requirements for each source.
- Review India conflict risk for each source.
- Recommend one MVP/dev source path with documented caveats.
- Document what clipping/replacement would be needed at India borders.
- Update `docs/control/BORDERS_BOUNDARIES_SOURCE_REVIEW_TRACKER.md` with findings.

WO-078B may NOT:

- Download or commit any boundary data.
- Approve any source for production use.
- Start ingestion, API, or frontend work.
- Claim India compliance.
- Skip the India conflict check for any source.

WO-078B output is a recommendation document only. Ingestion requires a separate
approved work order after WO-078B findings are reviewed by Kiro.

---

## 9. Stop Conditions

WO-078B and any subsequent work must STOP if:

1. Source license is unclear or does not permit the intended use.
2. Source conflicts with India official depiction and no safe MVP handling
   (clipping/replacement strategy) is defined.
3. Source terms forbid use in this application.
4. Any agent attempts to mark a source as approved without human review evidence
   and Kiro sign-off.
5. Any agent attempts to start ingestion, API, or frontend work before a separate
   ingestion work order is approved.

---

## 10. Reviewer Checklist

Before approving WO-078B or any subsequent Borders work order:

- [ ] This decision document has not been modified to weaken production India compliance
- [ ] WO-078B scope is limited to source evaluation only
- [ ] No boundary data was committed
- [ ] No source was marked approved without evidence
- [ ] India conflict check is documented for any source evaluated
- [ ] Production compliance rule (Section 4) remains intact
