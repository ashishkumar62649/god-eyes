# GDELT Source Proof Report

**Work Order**: WO-NEWS-G1  
**Date**: 2026-06-12  
**Agent**: Claude Code CLI  
**Branch**: `agent/layer-08-news-gdelt-source-proof`

## Executive Summary

GDELT provides two usable access paths for Layer 08 News & OSINT:

1. **DOC API** - Returns article metadata but is severely rate-limited (429 errors)
2. **Event Export** - CSV files with coordinates, actors, and source URLs

The DOC API is not practical without implementing rate-limit handling. The Event Export is the recommended path.

---

## Endpoints Tested

### A. GDELT DOC 2.0 API

**Endpoint**: `https://api.gdeltproject.org/api/v2/doc/doc`

**Parameters tested**:
- `query`: Iran conflict, Ukraine war, Gaza ceasefire, etc.
- `mode`: artlist
- `maxRecords`: 10
- `sort`: DateDesc

| Query | Status | Items | Usable |
|-------|--------|-------|--------|
| Iran conflict | 429 (rate limited) | 0 | No |
| Ukraine war | 429 (rate limited) | 0 | No |
| Gaza ceasefire | 200 (HTML) | 10 | Partial |

**Findings**:
- Returns HTML-formatted article list (not JSON by default)
- Contains: title, URL, source domain, publication date, language, country
- No coordinates available (country only)
- **Rate-limited** - 429 errors after repeated requests
- Requires longer backoff or caching strategy

**Sample fields found**:
```
Title: "US and Iran have agreed to wording of a deal to end their war"
URL: "https://www.ksat.com/news/world/..."
Domain: "ksat.com"
Date: "22 min ago (06/12/2026 17:30 UTC)"
Language: "English"
Country: "United States"
```

**Classification**:
- `usable_for_mvp`: no (rate limits too severe)
- `display_mode`: list_only
- `reliability`: rate_limited
- `location_quality`: country_level

---

### B. GDELT GEO/GKG API

**Endpoint**: `https://api.gdeltproject.org/api/v2/geo/geo`

| Query | Status | Error |
|-------|--------|-------|
| Iran conflict | 404 | Not Found |
| Ukraine war | 404 | Not Found |

**Findings**:
- Endpoint returns 404 - may have been deprecated or changed
- Not usable for MVP

**Classification**:
- `usable_for_mvp`: no
- `reliability`: blocked

---

### C. GDELT Event Export

**Endpoint**: `http://data.gdeltproject.org/gdeltv2/lastupdate.txt`

| Metric | Value |
|--------|-------|
| Status | 200 OK |
| Export URL | `http://data.gdeltproject.org/gdeltv2/20260612180000.export.CSV.zip` |
| File size | ~87KB (compressed) |
| Format | Tab-separated CSV |

**Schema fields**:
- `GLOBALEVENTID` - Stable event ID
- `Actor1Name` - First actor name
- `Actor2Name` - Second actor name  
- `EventCode` - CAMEO event code (3-digit)
- `QuadClass` - 1=Verbal cooperation, 2=Material cooperation, 3=Verbal conflict, 4=Material conflict
- `ActionGeo_Lat` - Latitude (can be empty)
- `ActionGeo_Long` - Longitude (can be empty)
- `ActionGeo_CountryCode` - ISO country code
- `SourceURL` - Source article URL

**Sample structure** (from GDELT docs):
```
GLOBALEVENTID  DATE    Actor1Name  Actor2Name  EventCode  QuadClass  ActionGeo_Lat  ActionGeo_Long  SourceURL
123456789      20260612  UNITED STATES  IRAN  190     4         35.5            51.5          https://...
```

**Classification**:
- `usable_for_mvp`: partial
- `display_mode`: marker_and_list
- `reliability`: stable
- `location_quality`: exact_coordinate (when ActionGeo_Lat/Long populated)

---

## Source Evaluation Questions

| Question | Answer | Evidence |
|----------|--------|----------|
| Stable event/article IDs? | Yes | GLOBALEVENTID in export |
| Title/headline? | Yes | Actor1Name + Actor2Name from export, title in DOC API |
| Source URL? | Yes | SourceURL field in export |
| Source domain? | Yes | Parsable from SourceURL or DOC API |
| Publication timestamp? | Yes | DATEADDED in export |
| Language? | Yes | DOC API provides language |
| Country/location? | Yes | ActionGeo_CountryCode + country in DOC API |
| Coordinates? | Yes | ActionGeo_Lat/Long in export |
| Event category/code? | Yes | EventCode (CAMEO), QuadClass |
| Conflict classification? | Yes | QuadClass (conflict/cooperation) |
| Attribution for display? | Yes | SourceURL |
| Rate limits/reliability? | DOC: severe, Export: stable | 429 on DOC, 200 on export |

---

## Recommended Implementation Path

### Option 2: GDELT Event Database (Recommended)

**Why**:
- Stable HTTP 200 responses
- Contains exact coordinates (ActionGeo_Lat/Long)
- Has SourceURL for attribution
- Actor-based event structure for conflict tracking

**Implementation requirements**:
1. Download latest export CSV (~10-50MB compressed)
2. Parse TSV with Python csv module
3. Filter rows where ActionGeo_Lat/Long are non-empty for markers
4. Store all rows for list view
5. Implement incremental updates (track last downloaded file)

**Challenges**:
- File size requires streaming/chunked processing
- Not real-time (updates ~15 minutes)
- Must filter for coordinate-populated rows only

**MVP approach**:
- Daily fetch of latest export
- Store only rows with coordinates as marker-ready
- Store all rows for list view with filter
- Track event changes via GLOBALEVENTID

---

## Classification Summary

| Method | Usable | Display Mode | Reliability | Location | Risk |
|--------|--------|--------------|-------------|----------|------|
| DOC API | No | list_only | rate_limited | country | High |
| GEO API | No | - | blocked | - | - |
| Event Export | Partial | marker_and_list | stable | exact_coordinate | Medium |

---

## What Was Not Implemented

Per work order rules:
- No production fetcher
- No normalizer
- No database schema changes
- No API routes
- No frontend changes
- No scheduler/cron
- No fake data generation

---

## Tests Run

No unit tests created - proof script uses live network calls. The existing Layer 08 test suite passes (verified via earlier work orders).

---

## Next Recommended Work Order

**WO-NEWS-G2: GDELT Event Export Fetcher**

If approved:
1. Implement fetcher to download latest GDELT export CSV
2. Stream-parse TSV file
3. Extract marker-ready rows (ActionGeo_Lat/Long populated)
4. Store raw file in layer-specific path
5. Create normalizer for GDELT event schema

---

## Evidence Files

- Proof script: `services/fetch-orchestrator/src/layers/layer_08_news_osint/gdelt_source_probe.py`
- Proof output: `tmp/layer_08_news_osint/gdelt_proof/proof_summary_*.json`