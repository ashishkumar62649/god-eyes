# Open Questions: Layer 07 Weather MVP

## Overview

This document captures questions that should be resolved before or during implementation.

---

## Confirmed Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Primary MVP source? | Open-Meteo | No API key, global, CC-BY 4.0, rich variables |
| API key required? | No | Free tier for non-commercial use |
| Grid strategy? | Low-density 5° global grid | ~2,664 cells, ~54 API calls per full fetch |
| Weather data type? | Grid/model forecast data | Not street-level exact, not radar tiles |
| No fake data? | Confirmed | Empty state if source unavailable |
| Source-first rule? | Confirmed | Fetch proof before implementation |
| Raw-data-first? | Confirmed | Raw responses saved before normalization |
| Fetch proof succeeded? | Confirmed | 7 coordinates, HTTP 200, all fields present |
| Rate-limit headers observed? | **No** | No rate-limit headers in response |
| Multiple-coordinate response shape? | Confirmed | JSON array of objects (one per coordinate) |
| Current + hourly in single call? | Confirmed | Both blocks returned in single response |
| Safe batch size? | **50 coords** | 7 coords worked; 50 recommended for full fetch |

---

## Open Questions

### 1. Exact Grid Density for First Fetch Proof

**Question:** What grid resolution should be used for the initial fetch proof (WO-WEATHER-S)?

**Options:**
- 5° global (~2,664 cells) — full grid proof
- 10° global (~648 cells) — minimal proof
- 5 test coordinates — absolute minimum proof

**Recommendation:** Start with 5 test coordinates for the proof, then scale to 5° grid for full fetch implementation.

**Status:** RESOLVED — 7 test coordinates used in WO-WEATHER-S proof. Proof succeeded.

---

### 2. How Many Global Cells in MVP

**Question:** How many grid cells should the MVP fetch and maintain?

**Options:**
- 5° grid: ~2,664 cells (26 API calls at 100/call)
- 2.5° grid: ~10,368 cells (104 API calls)
- 1° grid: ~64,800 cells (648 API calls) — too many for free tier

**Recommendation:** 5° grid (~2,664 cells) for MVP. ~216 API calls/day estimate (4 fetches × 54 calls) well within 10K limit. **Note:** This is a planning estimate. Actual Open-Meteo API-call accounting must be verified during WO-WEATHER-R and WO-WEATHER-S. Requests with many variables, `forecast_days`, or multiple coordinates may count differently.

**Status:** RESOLVED — 5° grid used in WO-WEATHER-F. Actual coordinate count is **2664** (37 lat × 72 lon; longitude −180 inclusive to +175, +180 excluded as duplicate meridian). 54 batches at 50 coords/batch.

---

### 3. Whether to Include current_weather or Hourly Variables First

**Question:** Should the MVP fetch current weather only, or both current and hourly forecast?

**Options:**
- Current weather only — simplest, fewer fields, faster
- Current + hourly (3 days) — more complete, future-proof
- Hourly only (no current) — more data, current is derived

**Recommendation:** Current + hourly (3 days). The API returns both in a single call. Hourly data enables future timeline features.

**Status:** RESOLVED — WO-WEATHER-S proof confirmed both current and hourly returned in single API call.

---

### 4. Weather Code Labeling Source

**Question:** Where should the weather code to label mapping come from?

**Options:**
- WMO standard codes (from Open-Meteo docs) — standard, authoritative
- Custom mapping — more control, but maintenance burden
- Open-Meteo specific codes — provider-specific

**Recommendation:** Use WMO standard codes as documented by Open-Meteo. They are the international standard and well-documented.

**Status:** RESOLVED — WMO standard codes used, implemented in `weather_codes.py`. All 28 codes mapped (0–99). Unknown codes return "Unknown".

---

### 5. Stale Threshold

**Question:** How old must data be before it's considered stale?

**Options:**
- 1 hour — very aggressive, may show many stale markers
- 3 hours — moderate, matches model update cycle
- 6 hours — lenient, fewer stale markers but more outdated data

**Recommendation:** 1 hour for current weather, 3 hours for hourly forecast. The fetcher refreshes every 6 hours, so most data will be < 3 hours old.

**Status:** OPEN — decision needed before WO-WEATHER-D

---

### 6. API Cache Strategy

**Question:** Should the API layer implement its own caching, or rely on database freshness?

**Options:**
- Database-only: query latest table, no API cache — simple, always fresh
- In-memory cache: cache API responses for 60 seconds — reduces DB load
- Redis cache: distributed cache — overkill for MVP

**Recommendation:** Database-only for MVP. The latest table is the cache. Add in-memory caching later if performance requires it.

**Status:** OPEN — decision needed before WO-WEATHER-A

---

### 7. Future Overlay Split with RainViewer

**Question:** How should RainViewer radar overlay be integrated in the future?

**Options:**
- Separate layer (layer_07_weather_radar) — clean separation
- Sub-layer of weather (weather.radar) — tighter coupling
- Imagery layer (not a data layer) — different rendering approach

**Recommendation:** Future RainViewer integration should be a separate imagery layer (not a data layer). Radar tiles are fundamentally different from point weather data. Consider `layer_07_weather` for point data and a separate imagery layer for radar tiles.

**Status:** OPEN — future decision (not MVP)

---

### 8. Licensing / Attribution Requirements

**Question:** What exactly must be displayed for CC-BY 4.0 compliance?

**Options:**
- Full attribution text in UI — verbose but compliant
- Short attribution with link — cleaner UI
- Attribution in footer/about page only — minimal UI impact

**Recommendation:** Short attribution in layer panel ("Powered by Open-Meteo") with link to https://open-meteo.com/. Full attribution in API response metadata and documentation.

**Status:** OPEN — decision needed before WO-WEATHER-U

---

### 9. Grid Cell Selection Strategy

**Question:** Which `cell_selection` parameter should be used?

**Options:**
- `land` (default) — prefers land grid cells, good for general use
- `nearest` — nearest grid cell regardless of land/sea
- `sea` — prefers ocean grid cells

**Recommendation:** `land` for MVP. Most users are on land. Future: allow user to toggle or use `nearest` for coastal areas.

**Status:** RESOLVED — `land` confirmed working in WO-WEATHER-S proof. Coordinate resolution differences observed (3–21 km from requested, expected behavior).

---

### 10. Forecast Days for MVP

**Question:** How many forecast days should the MVP include?

**Options:**
- 1 day (current only) — simplest
- 3 days — moderate, good for planning
- 7 days (default) — more data, more API usage
- 16 days (max) — most data, highest API usage

**Recommendation:** 3 days. Balances useful forecast range with API efficiency. 7-day forecast uses more API calls but may be worthwhile.

**Status:** RESOLVED — Proof used `forecast_days=1` successfully. 3 days recommended for full fetcher (72 hourly timestamps per coordinate).

---

## Resolved During Planning

| Question | Resolution |
|----------|------------|
| Layer ID assignment | `layer_07_weather` (user-approved) |
| Primary source | Open-Meteo (evaluated, approved) |
| Grid strategy | 5° global grid (evaluated, recommended) |
| Data type | Point/grid weather data (not radar, not alerts) |
| MVP scope | Current + forecast (not historical, not radar) |
| Coordinate precision | Requested vs resolved documented |
| No fake data | Confirmed |
| Source-first rule | Confirmed |
| Raw-data-first | Confirmed |

---

## Questions for Implementation Phases

### WO-WEATHER-R (Source Research)
- Confirm all MVP weather variables are available in Open-Meteo
- Confirm batch request support (multiple coordinates)
- Document any field name discrepancies
- Confirm CC-BY 4.0 attribution requirements

### WO-WEATHER-S (Fetch Proof)
- ~~Test with real coordinates~~ — DONE (7 coordinates, HTTP 200)
- ~~Validate response structure~~ — DONE (array of objects, all fields present)
- ~~Confirm grid cell resolution~~ — DONE (coordinate differences 3–21 km observed)
- ~~Test rate limits in practice~~ — DONE (no rate-limit headers observed; client-side tracking needed)
- **NEW:** `location_id` field present in response — not in planning docs, add to field mapping

### WO-WEATHER-F (Fetcher)
- ~~Optimal batch size~~ — RESOLVED: **50 coordinates per batch** (confirmed safe in full fetcher)
- ~~Concurrent request limit~~ — RESOLVED: sequential with retry/backoff; max 3 consecutive failures before abort
- ~~Retry backoff timing~~ — RESOLVED: exponential backoff, BACKOFF_BASE=30s × 2^attempt
- ~~Raw storage format finalization~~ — RESOLVED: metadata.json + batches/batch_NNN.json + preview.json + observed_fields.json + fetch_report.md
- **API-call accounting** — CONFIRMED NOT EXPOSED: Open-Meteo returns no rate-limit/quota headers. All tracking is client-side. Assume 1 HTTP request = 1 API call. Monitor for HTTP 429.
- **location_id** — CONFIRMED PRESENT in response. Preserved in raw storage. Must be stored in `provider_metadata.location_id` during WO-WEATHER-N normalization.

### WO-WEATHER-N (Normalization)
- Handle null fields gracefully
- Weather code mapping completeness
- Timestamp timezone handling
- Provider metadata schema

### WO-WEATHER-D (Database)
- Spatial index performance — RESOLVED: stored location geometry with GiST index
- Upsert strategy finalization — RESOLVED: location primary-key upsert; latest conflict target is location/source/type/forecast time; history is idempotent append-only
- Current/hourly observation identity collision — RESOLVED: ingestion uses a type-aware database observation ID and preserves the normalizer ID in provider metadata
- History table partitioning — DEFERRED: not required for MVP volume
- Stale threshold finalization

### WO-WEATHER-A (API)
- Response schema finalization — RESOLVED: nested coordinates + weather structure with `data`/`meta` envelope matching project conventions
- Filter combination behavior — RESOLVED: filters combine with AND; all optional; parameters use parameterized SQL
- Pagination strategy — RESOLVED: offset-based pagination, default limit 200, max limit 5000, max offset 10000
- Error message wording — RESOLVED: follows existing error pattern (code + message + details object)

### WO-WEATHER-U (Frontend)
- Marker size optimization
- Color scale refinement
- Detail card layout
- Stale visual treatment
- Performance under load

---

**Last Updated:** 2026-06-10
**Status:** 5 open questions, 12 confirmed decisions (5 resolved during WO-WEATHER-S proof)
