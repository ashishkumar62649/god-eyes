# Source Catalog: Layer 07 Weather / Live Weather

## Overview

Source catalog for the GOD EYES Weather layer. Documents all verified weather data sources and their API contracts.

---

## Layer Identity

| Attribute | Value |
|-----------|-------|
| Layer ID | `layer_07_weather` |
| Layer Name | Weather / Live Weather |
| Phase | MVP |
| Status | SOURCE_RESEARCH |

---

## Primary MVP Source

| Source | Status | Documentation |
|--------|--------|---------------|
| **Open-Meteo** | **PRIMARY_MVP_SOURCE** | [open_meteo_source.md](./open_meteo_source.md) |

---

## Source Files

| File | Purpose |
|------|---------|
| [open_meteo_source.md](./open_meteo_source.md) | Full source identity, endpoint, auth, licence, limits, variables, response shape |
| [open_meteo_field_mapping.md](./open_meteo_field_mapping.md) | Field-by-field mapping from Open-Meteo to GOD EYES normalized schema |
| [open_meteo_request_plan.md](./open_meteo_request_plan.md) | Recommended MVP proof and full fetch request configurations |
| [open_meteo_research_summary.md](./open_meteo_research_summary.md) | Final findings, confirmed/corrected assumptions, recommendations |
| [source_decisions.md](./source_decisions.md) | Source decision table and rationale |

---

## Quick Reference

- **Endpoint:** `GET https://api.open-meteo.com/v1/forecast`
- **API Key:** Not required for free non-commercial use
- **Licence:** CC-BY 4.0 (attribution required)
- **Free Limits:** 10,000 calls/day, 5,000/hour, 600/minute
- **Batch Support:** Yes (comma-separated lat/lon)
- **Default Model:** Best match (auto-selected per location)

---

**Last Updated:** 2026-06-10
**Research Agent:** Fetching Worker (WO-WEATHER-R)
