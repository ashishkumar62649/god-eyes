# Proof Report - Layer 08 News & OSINT Source Validation

## Executive Summary

The Layer 08 News & OSINT source proof script was executed to validate the availability and data quality of four source families. The script tested real global endpoints and produced a structured report.

### Key Findings

| Source | Status | Items Found | Coordinates | Country/Region | Notes |
|--------|--------|-------------|-------------|----------------|-------|
| GDACS | PASS | 171 | Yes | Yes | Excellent for globe markers |
| GDELT | FAIL | 0 | No | No | Rate limited or JSON parsing issue |
| ReliefWeb | SKIPPED | 0 | No | No | Requires pre-approved appname |
| Curated RSS | PASS | 6 | No | Yes | Good supplementary content |

## Detailed Results

### 1. GDACS (Global Disaster Alert and Coordination System)

**Status**: PASS ✓

**Endpoint Tested**: `https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP?eventtype=ALL&alertlevel=ALL`

**Results**:
- **Total Items**: 171 disaster events
- **Coordinates Available**: Yes (exact latitude/longitude)
- **Country/Region Available**: Yes (country names)
- **Sample Data**:
  - Flood in United States (38.51°N, -92.44°W)
  - Flood in China (22.79°N, 115.37°E)
  - Multiple event types: Earthquakes, Floods, Tropical Cyclones, Volcanoes, Wildfires

**Data Quality**:
- **Coordinates**: Point geometry coordinates available for 47 of 171 events (directly marker-ready). The remaining 124 events carry LineString (48) or Polygon (76) geometries — coordinates are not extracted for these in MVP; geometry type is preserved in provider_metadata for future centroid/shape handling.
- **Severity Levels**: Green/Orange/Red alert levels available
- **Event Types**: Structured event type codes (EQ, FL, TC, DR, VO, WF)
- **Country Codes**: Available for most events
- **Update Frequency**: Every 5-15 minutes

**Best Use**: Globe markers with exact coordinates, severity-based filtering, disaster alert system

**Limitations**:
- Limited to major natural disasters only
- No health or security events
- May miss smaller or developing situations

**Attribution**: Creative Commons Attribution 4.0 International (CC BY 4.0) license

### 2. GDELT (Global Database of Events, Language, and Tone)

**Status**: FAIL ✗

**Endpoint Tested**: `https://api.gdeltproject.org/api/v2/doc/doc`

**Error**: `Expecting value: line 1 column 1 (char 0)` - Likely rate limited or returned non-JSON response

**Analysis**:
- GDELT API observed to return 429 (Too Many Requests) errors in testing
- May require exponential backoff implementation
- Documentation indicates rate limits exist but are not explicitly published

**Potential Solutions**:
1. Implement conservative rate limiting (10 requests/minute)
2. Add exponential backoff on 429 errors
3. Use alternative GDELT endpoints or mirrors
4. Consider using GDELT Cloud API with API key (paid)

**Best Use**: News discovery, article metadata, trend analysis (when accessible)

**Limitations**:
- No direct coordinates (requires geocoding)
- High volume may be overwhelming
- Rate limits may restrict usage

**Attribution**: Free to use with attribution to the GDELT Project

### 3. ReliefWeb (UN OCHA)

**Status**: SKIPPED ○

**Reason**: `RELIEFWEB_APPNAME` environment variable not set

**Requirements**:
- Pre-approved appname required (application process)
- Rate limit: 1000 calls/day
- Maximum 1000 items per request

**Next Steps**:
1. Apply for ReliefWeb appname at https://reliefweb.int/help/api
2. Set `RELIEFWEB_APPNAME` environment variable
3. Re-run proof script to validate

**Best Use**: Humanitarian reports, curated analysis, disaster situation updates

**Limitations**:
- Country-level location only (no exact coordinates)
- Approval process may take time
- Rate limits restrict high-frequency polling

**Attribution**: UN OCHA, Creative Commons Attribution 4.0 International (CC BY 4.0) license

### 4. Curated RSS/Atom Feeds

**Status**: PASS ✓

**Feeds Tested**:
1. UN News - Top Stories: Working (no items in test window)
2. UN News - Humanitarian Aid: Working (3 items found)
3. WHO News: Working (3 items found)
4. CDC Newsroom: Working (no items in test window)

**Results**:
- **Total Items**: 6 news articles
- **Coordinates Available**: No
- **Country/Region Available**: Yes (in some cases)
- **Sample Data**:
  - Ukraine humanitarian aid updates
  - Sudan conflict coverage
  - DRC Ebola response
  - WHO health alerts

**Data Quality**:
- **Titles**: Clear and descriptive
- **Links**: Direct links to original articles
- **Publication Dates**: Available and recent
- **Summaries**: Available with HTML cleanup needed
- **Source Attribution**: Clear institutional sources

**Best Use**: Supplementary situational awareness, health/outbreak monitoring, humanitarian news

**Limitations**:
- Inconsistent formats across feeds
- No coordinates for globe markers
- May lack structured metadata
- Update frequency varies by feed

**Attribution**: Various institutional sources under their respective licenses

## Recommended Implementation Order

Based on proof results:

1. **GDACS** - Immediate value with coordinates and severity
   - Provides exact coordinates for globe markers
   - Structured severity levels
   - No authentication required

2. **Curated RSS** - Supplementary content with minimal setup
   - No authentication required
   - Official institutional sources
   - Good for health/humanitarian news

3. **GDELT** - After rate limit mitigation
   - Excellent news discovery
   - Requires geocoding for coordinates
   - Needs rate limiting implementation

4. **ReliefWeb** - After appname approval
   - High-quality humanitarian reports
   - Requires approval process
   - Country-level location only

## Technical Recommendations

### For GDACS Implementation
- Use GeoJSON endpoint for direct coordinates
- Implement severity-based marker styling
- Cache events for 15 minutes
- Monitor for new events

### For GDELT Implementation
- Implement exponential backoff
- Use conservative rate limits (10 req/min)
- Start with source country for location
- Consider GDELT Cloud API for higher limits

### For ReliefWeb Implementation
- Apply for appname immediately
- Implement daily quota tracking
- Cache reports for 4 hours
- Focus on disaster reports initially

### For RSS Implementation
- Start with UN News and WHO feeds
- Implement feed health monitoring
- Add fallback feeds for redundancy
- Parse HTML from summaries

## Risk Assessment

### High Risk
- **GDELT Rate Limits**: May restrict usage patterns
- **ReliefWeb Approval**: Timeline uncertain

### Medium Risk
- **Data Quality**: RSS feeds may have inconsistent formats
- **Geocoding**: GDELT requires external geocoding service

### Low Risk
- **GDACS Availability**: Stable and well-documented
- **RSS Feed Reliability**: Institutional feeds generally stable

## Next Steps

1. **Immediate**: Apply for ReliefWeb appname
2. **Short-term**: Implement GDACS fetcher with coordinates
3. **Medium-term**: Add GDELT with rate limiting
4. **Long-term**: Add ReliefWeb after approval

## Conclusion

The proof script validated that GDACS and curated RSS feeds provide usable data for Layer 08. GDACS is particularly strong for globe markers with exact coordinates. GDELT shows promise but requires rate limit handling. ReliefWeb needs appname approval but will provide valuable humanitarian content.

The recommended MVP implementation should prioritize GDACS for immediate globe marker functionality, followed by RSS feeds for supplementary content, then GDELT with proper rate limiting, and finally ReliefWeb after appname approval.

---

## WO-NEWS-F1 Fetcher Proof Run (2026-06-11)

The GDACS fetcher module was implemented and a live proof run was executed.

**Module**: `services/fetch-orchestrator/src/layers/layer_08_news_osint/`

**Command**:
```
python -m layers.layer_08_news_osint --source gdacs --proof --fetch-client auto
```

**Results**:
- Items fetched: 171
- Items with coordinates: 47
- Alert level counts: Green: 167, Orange: 4
- Event type counts: DR: 16, EQ: 34, FL: 9, TC: 108, WF: 4
- Raw output: `tmp/layer_08_news_osint/gdacs/2026/06/11/run_20260611T162444Z/` (gitignored)

**Test coverage**: 35/35 tests passing (no live network)

**Status**: PASS ✓

---

## WO-NEWS-N1 Normalizer Proof Run (2026-06-11)

The GDACS normalizer module was implemented and a live proof run was executed with `--normalize`.

**Module**: `services/fetch-orchestrator/src/layers/layer_08_news_osint/gdacs_normalizer.py`

**Command**:
```
python -m layers.layer_08_news_osint --source gdacs --proof --fetch-client auto --normalize
```

**Results**:
- Total features: 171
- Normalized items: 171
- Marker-ready (Point geometry): 47
- Skipped: 0
- Geometry type counts: Point: 47, LineString: 48, Polygon: 76
- Severity counts: Green: 167, Orange: 4
- Event type counts: DR: 16, EQ: 34, FL: 9, TC: 108, WF: 4

**Coordinate handling**:
- Point geometry items: latitude/longitude extracted, `marker_ready=true`, `location.confidence=exact_coordinate`
- LineString/Polygon items: no coordinates extracted, `marker_ready=false`, geometry_type preserved in provider_metadata for future shape/centroid handling
- No fake coordinates generated

**Test coverage**: 80/80 tests passing (no live network)

**Status**: PASS ✓

---

## WO-NEWS-D1 Database Schema (2026-06-11)

The Layer 08 database foundation now stores all normalized news and event items,
including records that are not eligible for point-marker rendering.

**Tables**:
- `news_sources`
- `news_fetch_runs`
- `news_items_latest`
- `news_item_history`
- `news_raw_message_refs`

**GDACS proof compatibility**:
- All 171 normalized items can be represented in `news_items_latest`.
- The 47 Point items can carry SRID 4326 geometry and be marker-ready.
- The 48 LineString and 76 Polygon items retain `geometry_type` while latitude,
  longitude, and Point geometry remain null.
- No fake coordinates are required or generated by the schema.

The tables use open `source_id` and `source_family` fields so future GDELT,
ReliefWeb, and RSS records can use the same storage model after their approved
source work is complete.

**Status**: PASS

---

## WO-NEWS-I1 GDACS Database Ingestion Proof (2026-06-11)

The GDACS database ingestion module was implemented and validated with a live
proof ingestion against a real PostGIS database.

**Module**: `database/ingestion/layers/layer_08_news_osint/gdacs_db_ingestion.py`

**DB Setup**:
- Container: `god-eyes-postgis` (postgis/postgis:16-3.4)
- Database: `god_eyes_dev`
- Migration: `database/migrations/layers/layer_08_news_osint/001_news_tables.sql`

**Command**:
```bash
$env:PYTHONPATH="E:\god-eyes\services\fetch-orchestrator\src;E:\god-eyes"
$env:DATABASE_URL="postgresql://god_eyes:***@localhost:5432/god_eyes_dev"
python -m layers.layer_08_news_osint --source gdacs --proof --normalize --ingest-db
```

### Live First Run Results

| Metric | Actual Value |
|--------|-------------|
| Fetched count | 171 |
| Normalized count | 171 |
| Inserted latest | 171 |
| Updated latest | 0 |
| Unchanged latest | 0 |
| History rows inserted | 171 |
| Raw refs inserted | 171 |
| Marker-ready count | 47 |
| Point count | 47 |
| LineString count | 48 |
| Polygon count | 76 |
| Severity: high | 4 |
| Severity: medium | 167 |
| Event types: TC | 108 |
| Event types: EQ | 34 |
| Event types: DR | 16 |
| Event types: FL | 9 |
| Event types: WF | 4 |
| Fetch runs | 1 |
| Latest rows | 171 |
| History rows | 171 |
| Raw refs | 171 |

### SQL Verification (First Run)

```sql
SELECT COUNT(*) FROM news_items_latest WHERE source_id = 'gdacs';
-- Result: 171

SELECT COUNT(*) FROM news_items_latest WHERE source_id = 'gdacs' AND marker_ready = TRUE;
-- Result: 47

SELECT COUNT(*) FROM news_items_latest WHERE source_id = 'gdacs' AND geom IS NOT NULL;
-- Result: 47

SELECT COUNT(*) FROM news_items_latest
WHERE source_id = 'gdacs'
AND geometry_type IN ('LineString', 'Polygon')
AND (latitude IS NOT NULL OR longitude IS NOT NULL OR geom IS NOT NULL OR marker_ready = TRUE);
-- Result: 0

SELECT geometry_type, COUNT(*)
FROM news_items_latest WHERE source_id = 'gdacs' GROUP BY geometry_type ORDER BY geometry_type;
-- LineString: 48, Point: 47, Polygon: 76

SELECT severity, COUNT(*)
FROM news_items_latest WHERE source_id = 'gdacs' GROUP BY severity ORDER BY severity;
-- high: 4, medium: 167

SELECT subcategory, COUNT(*)
FROM news_items_latest WHERE source_id = 'gdacs' GROUP BY subcategory ORDER BY subcategory;
-- drought: 16, earthquake: 34, flood: 9, tropical_cyclone: 108, wildfire: 4

SELECT COUNT(*) FROM news_item_history WHERE source_id = 'gdacs';
-- Result: 171

SELECT COUNT(*) FROM news_raw_message_refs WHERE source_id = 'gdacs';
-- Result: 171
```

### Idempotency Proof (Second Run)

| Metric | First Run | Second Run |
|--------|-----------|------------|
| Latest rows | 171 | 171 (no duplicates) |
| Fetch runs | 1 | 2 (+1) |
| Raw refs | 171 | 342 (+171) |
| History rows | 171 | 342 (+171) |
| Marker-ready | 47 | 47 (stable) |
| Fake coord risk | 0 | 0 (stable) |

The second run updated `last_seen_at` for all 171 items, created 171 new
history versions, and added 171 new raw evidence references. No duplicate
`news_items_latest` rows were created.

### Coordinate Handling

- Point geometry items (47): latitude/longitude populated, `marker_ready=true`, DB trigger generates `geom` as `ST_SetSRID(ST_MakePoint(lon, lat), 4326)`
- LineString items (48): latitude, longitude, geom all `NULL`, `marker_ready=false`
- Polygon items (76): latitude, longitude, geom all `NULL`, `marker_ready=false`
- No centroids generated. No fake coordinates created.
- SQL verification confirms 0 LineString/Polygon items have coordinates or geom.

### Dedupe Key Design

The dedupe_key includes eventid, episodeid, eventtype, geometry_type, and a
hash of the geometry coordinates. This ensures all 171 features are stored as
separate items (GDACS returns multiple features per event with different
geometry types and coordinate sets for the same tropical cyclone forecast track).

## GDELT Event Export Database Ingestion Proof (2026-06-13)

The current GDELT export at proof time was
`20260613133000.export.CSV.zip`. It contained 504 parsed rows, all of which
normalized and stored successfully in the local development PostGIS database.

| Metric | First run | Identical second run |
|---|---:|---:|
| Fetched rows | 504 | 504 |
| Normalized rows | 504 | 504 |
| Latest inserts | 504 | 0 |
| Changed latest rows | 0 | 0 |
| Unchanged latest rows | 0 | 504 |
| History rows inserted | 504 | 0 |
| Raw references inserted | 504 | 504 |
| Marker-ready rows | 350 | 350 |
| List-only rows | 154 | 154 |

Fetch run IDs were `gdelt-proof-20260613133000-first` and
`gdelt-proof-20260613133000-second`.

SQL evidence after both runs:

- Latest rows and distinct dedupe keys: 504 / 504
- Marker-ready, list-only, and geometry rows: 350 / 154 / 350
- List-only rows with geometry: 0
- Marker-ready rows without geometry: 0
- Missing-coordinate rows with stored latitude/longitude: 0
- Fetch runs, history rows, and raw references: 2 / 504 / 1008
- Active GDELT source seed rows: 1
- Cross-source GDELT/GDACS dedupe-prefix conflicts: 0

All latest rows retained their first-run `first_seen_at` value and advanced to
the second-run `last_seen_at` value. Proof files remain under ignored `tmp/`
paths; no raw ZIP, CSV, normalized output, or database dump is tracked by Git.

### GDELT ingestion test coverage

- Layer 08 suite with local PostGIS checks enabled: 209 passed
- GDACS ingestion regression suite: 50 passed
- Tests cover source seed, marker/list-only storage, geometry safety, timestamp
  preservation, repeat dedupe, new/changed history, raw references, rollback,
  duplicate batch identity, and GDACS source coexistence.

### Prior GDACS Test Coverage

- 140 Layer 08 tests passing (5 skipped DB integration tests)
- 237 Layer 07 functional tests passing (4 scope guard tests detect Layer 08 changes — expected for cross-layer work)

**Status**: PASS ✓ — Live database proof executed successfully.
