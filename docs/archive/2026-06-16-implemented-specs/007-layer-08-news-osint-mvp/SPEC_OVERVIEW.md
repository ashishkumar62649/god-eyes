# Layer 08 News & OSINT MVP Specification

## Layer Identification

- **Layer ID**: `layer_08_news_osint`
- **Layer Name**: News & OSINT
- **Layer Order**: 8 (follows Layer 07 Weather)

## MVP Goal

To provide global situational-awareness news and public OSINT-style events on the globe and in a list view, enabling users to monitor disasters, humanitarian crises, health outbreaks, infrastructure disruptions, and public safety events worldwide.

## Non-Goals

- Real-time news ingestion or live streaming updates
- Social media monitoring or private data sources
- Paywalled or subscription-only news sources
- City-level or hyper-local filtering for MVP
- Sentiment analysis or advanced NLP on news content
- User-generated content or reporting

## Source Families (Build Order)

1. **GDACS** (Global Disaster Alert and Coordination System) - Priority 1
   - Official disaster alerts with coordinates
   - No authentication required
   - High quality structured data

2. **GDELT** (Global Database of Events, Language, and Tone) - Priority 2
   - Global news discovery and monitoring
   - No API key required for DOC 2.0 API
   - Wide coverage but requires location extraction

3. **ReliefWeb** (UN OCHA) - Priority 3
   - Humanitarian reports and disaster updates
   - Requires pre-approved appname
   - High quality curated content

4. **Curated RSS/Atom Feeds** - Priority 4
   - Official institutional feeds (UN, WHO, etc.)
   - No authentication required
   - Supplementary situational awareness content

## Expected Frontend Behavior

### Globe View
- Display disaster markers on 3D globe with appropriate icons
- Color-coded markers by severity/category
- Clustering for dense regions
- Click markers to view event details
- Filter by source, category, severity, time

### List View
- Chronological news feed with source attribution
- Category tags (disaster, health, security, etc.)
- Country/region tags
- Severity indicators
- Links to original sources
- Search and filter capabilities

### Detail View
- Full event information when available
- Source attribution and links
- Related events or updates
- Location confidence indicator

## Quality & Safety Rules

1. **No fake data**: All displayed data must come from real sources
2. **Source attribution**: Every item must show its source and link to original
3. **No API keys in code**: Keys must be in environment variables
4. **No raw data commits**: Raw proof output stored locally only
5. **Graceful degradation**: Source failures should not crash the system
6. **Rate limit compliance**: Respect all source rate limits
7. **Data freshness**: Prioritize recent events (24-72 hours)
8. **Location accuracy**: Show confidence level for geocoded locations

## Implementation Phases

### Phase 1: Source Research & Proof (Current)
- Research official documentation
- Create planning documents
- Write and run global source proof script
- Validate source availability and data quality

### Phase 2: Data Pipeline
- Design source registry
- Implement per-source fetchers
- Create normalization layer
- Design database schema

### Phase 3: API Layer
- Design RESTful endpoints
- Implement filtering and pagination
- Add caching and rate limiting

### Phase 4: Frontend Integration
- Globe marker rendering
- News list display
- Filter controls
- Source attribution display

## Success Criteria

- All four source families return usable data
- GDACS provides coordinates for globe markers
- GDELT provides article metadata for news list
- ReliefWeb provides humanitarian reports (if appname available)
- RSS feeds provide supplementary situational awareness
- No production code changes during proof phase
- All proof output stored locally only