# GOD EYES — Borders & Boundaries Source Review Tracker

**Layer ID:** `layer_02_borders_boundaries`
**Work order:** WO-078A-BORDERS-SOURCE-LICENSE-CLEARANCE-KIT
**Last updated:** 2026-05-26
**Updated by:** Kiro CLI

---

## How to Use This Tracker

This tracker records the review status of every boundary data source candidate.
A source must reach `approved` status before it may be used in any ingestion work order.

**Approval requires:**
1. Human review of license terms
2. India conflict check completed
3. Disputed territory handling reviewed
4. Evidence saved in `docs/data/layer_02_borders_boundaries/`
5. Kiro sign-off in a work order

**No agent may change a source status to `approved` without human review evidence
and Kiro sign-off.**

---

## Decision States

| State | Meaning |
|-------|---------|
| `not_started` | No review has begun |
| `in_contact` | Human has contacted provider; awaiting response |
| `license_received` | License terms received; under review |
| `approved` | Human review complete + Kiro sign-off; may be used |
| `rejected` | Rejected — incompatible license, India conflict, or policy violation |
| `blocked` | Cannot proceed without additional information |

---

## 1. India Source — Survey of India

| Field | Value |
|-------|-------|
| Source name | Survey of India — Official Digital Vector Boundary Data |
| Source URL | https://surveyofindia.gov.in |
| Geospatial Guidelines URL | https://onlinemaps.surveyofindia.gov.in/GeospatialGuidelines.aspx |
| Political Map URL | https://surveyofindia.gov.in/pages/political-map-of-india |
| 2026 PDF reference | https://surveyofindia.gov.in/UserFiles/files/POLMAP_ENGLISH-2026.pdf |
| MHA J&K reference | https://www.mha.gov.in/sites/default/files/PressRelease_NoteonUTofJK%26Ladakh_04112019.pdf |
| Intended use | India national boundary (authoritative, compliant with GoI depiction) |
| License reviewed | NO |
| Attribution required | UNKNOWN |
| Commercial use allowed | UNKNOWN |
| India conflict checked | N/A — this IS the India authoritative source |
| Disputed territory reviewed | NO |
| Approved for India | NO |
| Approved for non-India | N/A |
| Decision status | `blocked` — human contact required; production contact deferred to deployment stage (WO-078A1) |
| Human reviewer | NOT ASSIGNED |
| Review date | — |
| Evidence location | None yet. Save to: `docs/data/layer_02_borders_boundaries/SOI_RESPONSE_[YYYYMMDD].md` |
| Notes | Human must contact Survey of India using template in `BORDERS_BOUNDARIES_SURVEY_OF_INDIA_REQUEST_TEMPLATE.md`. Must confirm coverage of J&K, Ladakh, PoK, Aksai Chin per official Indian government depiction. |

---

## 2. Non-India Source — Natural Earth

| Field | Value |
|-------|-------|
| Source name | Natural Earth |
| Source URL | https://www.naturalearthdata.com |
| Intended use | Non-India international boundaries only (if India conflict resolved) |
| License reviewed | NO |
| Attribution required | UNKNOWN (likely not required — public domain, but must confirm) |
| Commercial use allowed | UNKNOWN (likely yes — public domain, but must confirm) |
| India conflict checked | NO — Natural Earth is known to conflict with Indian official depiction of J&K and Aksai Chin. Must be reviewed and clipped/replaced at India borders before any use. |
| Disputed territory reviewed | NO |
| Approved for India | NO — rejected per policy plan Section 6 |
| Approved for non-India | NO — pending India conflict check and license review |
| Decision status | `not_started` |
| Human reviewer | NOT ASSIGNED |
| Review date | — |
| Evidence location | None yet |
| Notes | Natural Earth is public domain but its India boundary depiction conflicts with Survey of India standard. If used for non-India boundaries, it must be clipped/replaced at India borders. India conflict check is mandatory before any use. |

---

## 3. Non-India Source — UN Cartographic Section

| Field | Value |
|-------|-------|
| Source name | UN Cartographic Section — World Boundaries |
| Source URL | https://www.un.org/geospatial/mapsgeo/generalmaps |
| Intended use | Non-India international boundaries (if license permits) |
| License reviewed | NO |
| Attribution required | UNKNOWN — UN terms of use must be reviewed |
| Commercial use allowed | UNKNOWN — UN terms may restrict commercial use |
| India conflict checked | NO |
| Disputed territory reviewed | NO — UN maps may use UN-specific depictions of disputed territories that differ from Indian government position |
| Approved for India | NO |
| Approved for non-India | NO — pending license review |
| Decision status | `not_started` |
| Human reviewer | NOT ASSIGNED |
| Review date | — |
| Evidence location | None yet |
| Notes | UN Cartographic may have restrictions on use in private applications. UN depiction of disputed territories (including Kashmir) may differ from Indian government position. Full review required before any use. |

---

## 4. Non-India Source — GADM

| Field | Value |
|-------|-------|
| Source name | GADM — Database of Global Administrative Areas |
| Source URL | https://gadm.org |
| Intended use | Non-India administrative boundaries (if license permits) |
| License reviewed | NO |
| Attribution required | UNKNOWN |
| Commercial use allowed | UNKNOWN — GADM license is described as non-commercial/academic; may not be compatible with this application |
| India conflict checked | NO |
| Disputed territory reviewed | NO |
| Approved for India | NO |
| Approved for non-India | NO — pending license review; commercial use likely incompatible |
| Decision status | `not_started` |
| Human reviewer | NOT ASSIGNED |
| Review date | — |
| Evidence location | None yet |
| Notes | GADM license is typically non-commercial/academic. Must confirm whether this application's use case is permitted. If commercial use is not allowed, GADM must be rejected. |

---

## 5. Rejected Sources

The following sources are explicitly rejected and may not be used for Borders &
Boundaries ingestion. These decisions are final unless a new Kiro-approved work order
explicitly revisits a specific source with new evidence.

| Source | Rejected For | Reason | Decision |
|--------|-------------|--------|----------|
| OpenStreetMap (OSM) | India boundaries | Community-edited; not authoritative for India boundaries; conflicts with Survey of India depiction | `rejected` |
| Google Maps data | Any boundaries | Not a licensable data source; terms of service prohibit data extraction | `rejected` |
| Bing Maps data | Any boundaries | Not a licensable data source; terms of service prohibit data extraction | `rejected` |
| Random GeoJSON / GitHub datasets | India boundaries | Unofficial, unverified, no authoritative source chain | `rejected` |
| Hand-drawn / manually adjusted India boundary data | India boundaries | Not approved by Survey of India; violates India compliance policy | `rejected` |
| Any dataset showing PoK as part of Pakistan without Indian claim | India boundaries | Conflicts with Government of India official depiction | `rejected` |
| Any dataset showing Aksai Chin as part of China without Indian claim | India boundaries | Conflicts with Government of India official depiction | `rejected` |

---

## 6. Other Source Candidates

If a new source is identified in the future, add a row here before any review begins.
A source must be added to this tracker and reviewed before it may be used.

| Source name | Source URL | Intended use | Decision status | Notes |
|-------------|------------|-------------|-----------------|-------|
| (none yet) | — | — | — | — |

---

## Tracker Change Log

| Date | Changed by | Change |
|------|-----------|--------|
| 2026-05-26 | Kiro CLI (WO-078A) | Initial tracker created. All sources set to initial status. |
