# GOD EYES — Borders & Boundaries Natural Earth MVP Source Selection

**Layer ID:** `layer_02_borders_boundaries`
**Work order:** WO-078B-BORDERS-NATURAL-EARTH-MVP-SOURCE-SELECTION
**Author:** Kiro CLI
**Date:** 2026-05-26

---

## 1. Decision

**Natural Earth Admin-0 Countries 1:50m is selected as the MVP/local-dev country
boundary source for `layer_02_borders_boundaries`.**

This selection is for MVP/local/dev use only. It is not production-approved.
It is not Survey of India / Government of India compliant.

---

## 2. Why Selected

- Public domain — no permission needed, no license fee
- Commercial use allowed
- Simple Admin-0 country-level polygons — right scope for MVP globe display
- Lightweight at 1:50m scale — manageable for initial ingestion
- Easier to work with than UN Cartographic (permission complexity), GADM
  (commercial use risk), or OSM (ODbL complexity)

---

## 3. Source Details

| Field | Value |
|-------|-------|
| Source name | Natural Earth |
| Official website | https://www.naturalearthdata.com |
| Dataset | Admin-0 Countries |
| Scale | 1:50m |
| Format (for future ingestion) | Shapefile or GeoJSON |
| Geometry type | Polygon / MultiPolygon |
| Expected DB table | `border_boundaries` (schema from WO-077) |
| Attribution | Not required; "Made with Natural Earth" may be shown as courtesy |

---

## 4. License Summary

- **License:** Public domain
- **Permission required:** No
- **Commercial use:** Allowed
- **Attribution:** Not required (courtesy attribution recommended)
- **Derivative works / simplification:** Allowed
- **Redistribution:** Allowed

*Verify these facts against https://www.naturalearthdata.com/about/terms-of-use/
during WO-078C implementation before ingestion begins.*

---

## 5. India Caveat

**This caveat is mandatory and must not be removed.**

- Natural Earth uses de facto boundaries, not Survey of India / Government of India
  official depiction.
- Natural Earth's depiction of Jammu & Kashmir, Ladakh, PoK, and Aksai Chin does
  not follow Indian official depiction.
- This source is acceptable for MVP/local/dev display only.
- Local/dev display must be clearly marked as MVP/not-for-production.
- Production India compliance remains deferred per WO-078A1.
- No production deployment may use Natural Earth India boundaries without Survey of
  India compliance review.

---

## 6. Sources Not Selected for MVP

| Source | Reason not selected |
|--------|-------------------|
| GADM | Commercial/use restrictions unclear; risky for MVP |
| OSM | Community-edited; ODbL license complexity |
| Google Maps | Rejected as data source (terms prohibit extraction) |
| Bing Maps | Rejected as data source |
| Random GitHub GeoJSON | Rejected — no authoritative source chain |
| UN Cartographic | Permission/terms complexity; not MVP-practical |

---

## 7. Next Implementation Step

**WO-078C: Natural Earth MVP Ingestion**

Scope:
- Download Natural Earth 1:50m Admin-0 Countries from official source
- Keep source metadata (source name, URL, scale, download date)
- Insert into `border_boundary_sources` and `border_boundaries` tables
- Mark source as `mvp_local_dev` — not production-approved
- Do not mark source as India-compliant
- Add migration tests
- No API or frontend work in WO-078C

---

## 8. Stop Conditions

WO-078C must STOP if:

1. Natural Earth license facts cannot be verified at the official URL.
2. Dataset cannot be processed safely into the existing schema.
3. Implementation attempts to mark the source as production-approved.
4. Implementation claims India compliance.
5. Frontend work is started before DB and API are ready.
