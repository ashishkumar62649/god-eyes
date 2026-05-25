# GOD EYES — Borders & Boundaries Policy and Source Plan

**Layer ID:** `layer_02_borders_boundaries`
**Status:** Policy/planning only. No implementation started.
**Author:** Kiro CLI (WO-075-076)
**Last updated:** 2026-05-26

---

## 1. Purpose

This document defines the official policy, approved source hierarchy, compliance rules, and
implementation gate checklist for the Borders & Boundaries layer (`layer_02_borders_boundaries`).

No implementation work may begin until all gates in Section 9 are cleared and a Kiro-approved
work order exists for each implementation phase.

---

## 2. Layer ID

`layer_02_borders_boundaries`

Registered in `docs/control/MVP_LAYER_REGISTRY.md`.

---

## 3. Scope

This layer covers:

- **International boundaries** — sovereign state borders, coastlines, exclusive economic zones (EEZ)
- **India national boundary compliance** — India's full official boundary per Survey of India /
  Government of India depiction, including Jammu & Kashmir, Ladakh, and all disputed/occupied areas
- **Indian state and UT boundaries** — if planned in a future work order, must follow the same
  Survey of India compliance rules as the national boundary
- **Non-India boundaries** — all other country and territory boundaries using approved public sources
- **Disputed regions handling** — any boundary segment that is contested between two or more
  parties must be handled per the rules in Section 8

---

## 4. India Compliance Policy

**This is a hard rule. It cannot be overridden by any agent, work order, or convenience argument.**

1. India's political boundary display must follow the Survey of India / Government of India
   standard at all times.
2. The Survey of India published maps and Survey of India digital boundary data are the source
   of truth for India boundaries where available and licensed.
3. India depiction must include the Indian official treatment of Jammu & Kashmir and Ladakh,
   including Pakistan-occupied Jammu & Kashmir (PoK) and Chinese-occupied areas such as Aksai Chin.
4. Natural Earth, OpenStreetMap, third-party GeoJSON, or generic global datasets must NOT be
   used for India boundaries if they conflict with Indian official depiction.
5. Google Maps data and styling must NOT be copied or used as a data source. Google Maps may
   be used only as a visual sanity reference.
6. India's boundary must not be shown in a way that cuts off or contradicts the Indian official
   depiction of PoK or Aksai Chin.
7. Any disputed boundary segment adjacent to India must be handled consistently with the India
   compliance rule — not with the depiction of the opposing party.
8. If official Survey of India vector boundary data is not available or licensing is unclear,
   implementation must STOP and the gap must be documented before any code is written.
9. India boundary data must not be "fixed" using random hand-drawn or unofficial data.

---

## 5. Approved India Source Hierarchy

Sources are listed in priority order. A lower-priority source may only be used if all
higher-priority sources are unavailable or unlicensed.

| Priority | Source | URL | Notes |
|----------|--------|-----|-------|
| 1 | Survey of India — Geospatial Guidelines | https://onlinemaps.surveyofindia.gov.in/GeospatialGuidelines.aspx | Authoritative compliance reference. Must be reviewed before any India boundary work. |
| 2 | Survey of India — Political Map of India | https://surveyofindia.gov.in/pages/political-map-of-india | Official political map. Use as visual and spatial reference. |
| 3 | Survey of India — English Political Map 2026 PDF | https://surveyofindia.gov.in/UserFiles/files/POLMAP_ENGLISH-2026.pdf | Latest published edition. Use for boundary verification. |
| 4 | Ministry of Home Affairs — J&K and Ladakh 2019 map release | https://www.mha.gov.in/sites/default/files/PressRelease_NoteonUTofJK%26Ladakh_04112019.pdf | Official MHA release on UT of J&K and Ladakh boundary. Required reference for that region. |
| 5 | Survey of India licensed digital vector data | Contact Survey of India for licensing | If available and licensed, preferred over PDF-derived data. Requires explicit licensing confirmation before use. |

**Before using any India boundary data source not listed above, a new work order must be raised
and approved by Kiro.**

---

## 6. Rejected India Source Types

The following source types are explicitly rejected for India boundary data:

- Natural Earth (conflicts with Indian official depiction of J&K, Aksai Chin)
- OpenStreetMap (community-edited, not authoritative for India boundaries)
- Generic GeoJSON files from GitHub or third-party repositories
- Google Maps data or exports
- Bing Maps data or exports
- Any dataset that does not explicitly state compliance with Survey of India / Government of India depiction
- Any dataset that shows PoK as part of Pakistan without showing Indian claim
- Any dataset that shows Aksai Chin as part of China without showing Indian claim
- Hand-drawn or manually adjusted boundary data without Survey of India approval

---

## 7. Non-India Source Policy

For all boundaries outside India:

1. Use public, legal, attribution-safe data only.
2. Source must be documented in this file before use.
3. Licensing must be documented and confirmed before use.
4. Disputed territories must not be presented carelessly — each disputed segment must be
   reviewed individually.
5. If a general public dataset such as Natural Earth is used for non-India boundaries, it must
   be reviewed for India conflicts and must not override India official depiction for any
   India-adjacent boundary.
6. Attribution must be included in the app UI or data credits wherever required by the license.

**Candidate non-India sources (to be evaluated in WO-078):**

| Source | License | Notes |
|--------|---------|-------|
| Natural Earth (non-India boundaries only) | Public domain | Must be clipped/replaced for India. Requires India conflict review. |
| UN Cartographic Section boundaries | UN terms of use | Review required. May have restrictions on disputed territory depiction. |
| GADM (non-India) | Non-commercial / academic | License must be confirmed for this application's use case. |

No non-India source is approved for use until WO-078 source evaluation is complete.

---

## 8. Data Licensing Checklist

Before any boundary dataset is ingested, the following must be confirmed and documented:

- [ ] Source name and URL recorded
- [ ] License type identified (public domain / CC / proprietary / government open data)
- [ ] Commercial use permitted (if applicable to this project)
- [ ] Attribution requirement documented
- [ ] India boundary conflict check completed
- [ ] Disputed territory handling reviewed
- [ ] Survey of India compliance confirmed for India-adjacent data
- [ ] Kiro sign-off recorded in the relevant work order

---

## 9. Implementation Gate Checklist

**All gates must be PASS before any implementation work order (WO-077+) is started.**

| Gate | Requirement | Status |
|------|-------------|--------|
| G1 | Survey of India Geospatial Guidelines reviewed | **BLOCKED** — requires human review |
| G2 | India boundary source identified and licensed | **BLOCKED** — requires human to contact Survey of India |
| G3 | India boundary covers J&K, Ladakh, PoK, Aksai Chin per official depiction | **BLOCKED** — depends on G2 |
| G4 | Non-India source identified, licensed, and India-conflict-checked | **BLOCKED** — requires human license review |
| G5 | Disputed territory handling policy written and approved | **BLOCKED** — requires human decision |
| G6 | Data licensing checklist (Section 8) fully completed | **BLOCKED** — depends on G2 and G4 |
| G7 | Database schema work order (WO-077) drafted and approved | PENDING — can be cleared by drafting WO-077 schema-only |
| G8 | No agent has started writing code or ingesting data | **PASS** — confirmed by WO-076A review |

*Gate statuses last reviewed: 2026-05-26 by Kiro CLI (WO-076A). See
`docs/control/BORDERS_BOUNDARIES_IMPLEMENTATION_GATE_REVIEW.md` for full assessment.*

---

## 10. Future Work Order Sequence

Implementation must follow this sequence. No work order may begin before its predecessor is
complete and reviewed.

| Work Order | Title | Depends On |
|------------|-------|------------|
| WO-077 | Borders & Boundaries database schema | Gates G1–G6 cleared |
| WO-078 | Borders source ingestion and conversion | WO-077 complete |
| WO-079 | Borders API endpoint | WO-078 complete |
| WO-080 | Borders frontend globe layer | WO-079 complete |
| WO-081 | Borders verification and compliance review | WO-080 complete |

**WO-081 is mandatory.** No Borders layer may be marked `active` in the MVP Layer Registry
without a completed compliance review.

---

## 11. Known Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Survey of India vector data not publicly available or unlicensed | HIGH | Stop gate G2. Do not proceed without licensed India data. |
| Natural Earth India boundary conflicts with official depiction | HIGH | Natural Earth is rejected for India. Use only for non-India boundaries after conflict check. |
| OSM India boundary inaccuracies | HIGH | OSM rejected for India boundaries. |
| Disputed territory rendering causing legal/political issues | HIGH | All disputed segments require individual review and explicit policy decision before rendering. |
| Non-India dataset license incompatible with commercial use | MEDIUM | Confirm license before WO-078. |
| Frontend rendering performance with large polygon datasets | MEDIUM | Address in WO-080 design. Consider simplification levels per zoom. |
| India state/UT boundary data availability | MEDIUM | Separate work order required. Do not bundle with national boundary work. |

---

## 12. Reviewer Checklist

Before approving any Borders & Boundaries work order (WO-077 through WO-081):

- [ ] India compliance policy (Section 4) has not been weakened or bypassed
- [ ] Approved India source hierarchy (Section 5) was followed
- [ ] No rejected source type (Section 6) was used for India data
- [ ] Non-India source policy (Section 7) was followed
- [ ] Data licensing checklist (Section 8) is complete for all sources used
- [ ] Implementation gates (Section 9) were all PASS before work started
- [ ] No code was written before WO-077 was approved
- [ ] No GeoJSON, shapefiles, or boundary data files were committed to the repository
  without explicit approval in the relevant work order
- [ ] Stop conditions (Section 13) were not triggered, or if triggered, work was halted

---

## 13. Stop Conditions

**If any of the following conditions are triggered, all Borders & Boundaries implementation
work must STOP immediately. The condition must be documented and escalated to Kiro before
any further work proceeds.**

1. **India official source cannot be verified** — the Survey of India source for India
   boundaries cannot be confirmed as authentic, current, or licensed.
2. **Source licensing is unclear** — any boundary dataset's license cannot be confirmed
   as permitting this application's use case.
3. **Dataset conflicts with Survey of India / Government of India depiction** — any dataset
   shows India's boundary in a way that contradicts the official Indian government position,
   including for J&K, Ladakh, PoK, or Aksai Chin.
4. **Agent uses unapproved India GeoJSON** — any agent attempts to use a random or
   third-party India boundary GeoJSON file without explicit Kiro approval and source
   documentation.
5. **Implementation would imply a disputed boundary position inconsistent with Indian
   government depiction** — any rendering choice, data selection, or API response would
   present a disputed boundary in a way that contradicts the Indian official position.
6. **Implementation gate not cleared** — any agent begins WO-077 or later without all
   gates in Section 9 being PASS.
7. **Compliance review (WO-081) skipped** — any attempt to mark the layer `active` without
   completing WO-081.

---

## Change Process

To modify this policy document:
1. Create a work order for Kiro CLI.
2. Changes to Sections 4, 5, 6, or 13 require explicit justification and Kiro sign-off.
3. No agent may weaken the India compliance policy without a Kiro-approved work order.
