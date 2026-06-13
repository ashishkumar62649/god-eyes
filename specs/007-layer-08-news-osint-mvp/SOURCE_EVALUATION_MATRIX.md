# Source Evaluation Matrix - Layer 08 News & OSINT

| Source | Auth Requirement | Global Coverage | Update Frequency | Coordinates Available | Country/Region Available | Severity Available | Best Use | Risks | MVP Decision |
|--------|------------------|-----------------|------------------|----------------------|--------------------------|-------------------|----------|-------|--------------|
| **GDACS** | None | Global | Every 5-15 minutes | Yes (exact lat/lon) | Yes (country codes) | Yes (alert levels: Green/Orange/Red) | Globe markers for disasters, severity-based filtering | Data limited to major disasters only | **Priority 1** - Core disaster alerts |
| **GDELT Event Export** | None | Global | Every 15 minutes | Yes (ActionGeo_Lat/Long) | Yes (ActionGeo_CountryCode) | No (QuadClass: conflict/cooperation) | Conflict events, protest tracking, diplomatic events | Large file downloads (~10-50MB), requires filtering for coordinate rows | **Priority 2** - Event Database (PROVEN) |
| **GDELT DOC 2.0 API** | None (rate limited) | Global (65 languages) | Near real-time | No | Yes (source country) | No | News discovery (BLOCKED - rate limits) | Heavy rate limiting (429 errors), HTML response format | **Not Recommended** - Rate limited |
| **GDELT GEO API** | None | - | - | - | - | - | - | Returns 404 (deprecated/not available) | **Not Available** |
| **ReliefWeb** | Pre-approved appname required | Global (humanitarian focus) | Daily to weekly | No (country level only) | Yes (country codes) | Yes (disaster types) | Humanitarian reports, curated analysis | Appname approval process, rate limits (1000/day) | **Priority 3** - Humanitarian intelligence |
| **Curated RSS/Atom** | None | Varies by feed | Varies | No (usually country/region) | Varies | No | Supplementary situational awareness | Inconsistent formats, may lack coordinates | **Priority 4** - Supplementary feeds |

## Detailed Analysis

### GDACS (Global Disaster Alert and Coordination System)

**Strengths:**
- No authentication required
- Direct coordinates for all events
- Structured severity levels (Green/Orange/Red)
- Official UN/EU source with high credibility
- Regular updates (5-15 minutes)
- GeoJSON format available

**Weaknesses:**
- Limited to major natural disasters
- No health or security events
- May miss smaller or developing situations

**Best For:** Globe markers with exact coordinates, severity-based filtering

### GDELT DOC 2.0 API

**Strengths:**
- Massive global coverage (65 languages)
- No API key required
- Near real-time updates
- Article metadata (title, URL, language, source country)
- Historical data back to 2017

**Weaknesses:**
- No direct coordinates (requires geocoding)
- High volume may be overwhelming
- Rate limits (429 errors observed)
- Requires complex query construction

**Best For:** News discovery, article metadata, trend analysis

### ReliefWeb

**Strengths:**
- Curated humanitarian content
- Official UN OCHA source
- Structured disaster reports
- Country-level tagging

**Weaknesses:**
- Requires pre-approved appname
- Rate limits (1000 calls/day)
- No exact coordinates (country level only)
- Approval process may take time

**Best For:** Humanitarian reports, situation analysis

### Curated RSS/Atom Feeds

**Strengths:**
- No authentication required
- Official institutional sources
- Simple parsing
- Wide variety of topics

**Weaknesses:**
- Inconsistent formats across sources
- Usually no coordinates
- May lack structured metadata
- Update frequency varies

**Best For:** Supplementary situational awareness, specific topics (health, UN news)

## Recommended Implementation Order

1. **GDACS** - Immediate value with coordinates and severity
2. **GDELT** - High volume news discovery (after geocoding design)
3. **ReliefWeb** - After appname approval (if available)
4. **RSS Feeds** - Supplementary content

## Key Decisions Needed

1. ReliefWeb appname availability and approval timeline
2. GDELT geocoding strategy (extract from text or use country mentions)
3. RSS feed allowlist for MVP
4. Severity mapping across sources
5. Deduplication thresholds