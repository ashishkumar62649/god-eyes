# Open Questions - Layer 08 News & OSINT

## Critical Decisions (Must Resolve Before Implementation)

### 1. ReliefWeb Appname Availability
**Question**: Do we have a pre-approved ReliefWeb appname, or do we need to apply for one?

**Impact**: 
- If available: Can use ReliefWeb API immediately
- If not available: Need to apply (may take days/weeks) or skip ReliefWeb for MVP

**Options**:
- A) Use existing appname if available
- B) Apply for new appname (timeline unknown)
- C) Skip ReliefWeb for MVP, add later
- D) Use alternative humanitarian data source

**Recommendation**: Check environment variables first, then decide

### 2. GDELT Geocoding Strategy
**Question**: How should we handle location data from GDELT?

**Impact**:
- GDELT doesn't provide coordinates directly
- Need to extract or infer location from text/country mentions

**Options**:
- A) Use source country only (simple, low accuracy)
- B) Extract country mentions from text (medium complexity)
- C) Use external geocoding service (high complexity, adds dependency)
- D) Skip GDELT until geocoding design is complete

**Recommendation**: Start with source country (Option A), enhance later

### 3. RSS Feed Allowlist
**Question**: Which specific RSS feeds should we include in MVP?

**Impact**:
- Need to select 2-4 high-quality, globally relevant feeds
- Must be official/institutional sources
- Should cover different topics (health, humanitarian, general)

**Potential Candidates**:
- UN News (news.un.org/feed/subscribe/en/news/all/rss.xml)
- WHO Disease Outbreak News (need to find RSS feed)
- ReliefWeb RSS (if available without appname)
- CDC Newsroom RSS
- Other official feeds

**Recommendation**: Research and document specific feeds in SOURCE_EVALUATION_MATRIX.md

## Important Decisions (Resolve Before Phase 2)

### 4. Country-Level Reports Display
**Question**: Should country-level reports (no coordinates) appear as country markers on globe or list-only?

**Impact**:
- Country markers could clutter the globe
- List-only might hide important events
- Need balance between visibility and usability

**Options**:
- A) Country markers with special styling (e.g., flags)
- B) List-only for country-level events
- C) Optional toggle to show/hide country markers
- D) Cluster country markers by region

**Recommendation**: Option C (user toggle) for flexibility

### 5. Deduplication Threshold
**Question**: How similar should items be to consider them duplicates?

**Impact**:
- Too strict: Show multiple versions of same event
- Too loose: Hide distinct but related events

**Options**:
- A) Exact URL match only
- B) URL + title similarity > 0.8
- C) Source + time window (1 hour) + title similarity
- D) Machine learning-based deduplication

**Recommendation**: Option B for MVP, enhance later

### 6. Severity Mapping Across Sources
**Question**: How do we normalize severity when sources use different scales?

**Impact**:
- GDACS: Green/Orange/Red
- GDELT: No severity (only tone)
- ReliefWeb: No severity
- RSS: No severity

**Options**:
- A) Only show severity for GDACS (others = unknown)
- B) Infer severity from event type/category
- C) Use tone metric from GDELT as severity proxy
- D) Manual severity assignment for curated sources

**Recommendation**: Option A for MVP, keep severity = unknown for other sources

## Nice-to-Have Decisions (Can Resolve Later)

### 7. Image Handling Strategy
**Question**: How should we handle images from different sources?

**Impact**:
- Some sources provide images (GDACS, GDELT)
- Some don't (ReliefWeb, RSS)
- Image quality and relevance varies

**Options**:
- A) Use images when available, placeholder otherwise
- B) Only show images from trusted sources
- C) Download and store images locally
- D) Use proxy URLs to avoid hotlinking

**Recommendation**: Option A for MVP, consider C for production

### 8. Real-time Updates
**Question**: Should we implement WebSocket updates for new events?

**Impact**:
- Adds complexity to frontend and backend
- May not be necessary for MVP
- Could be added later without breaking changes

**Options**:
- A) No real-time updates (poll every 5 minutes)
- B) WebSocket for critical events only
- C) WebSocket for all updates
- D) Server-sent events (simpler than WebSocket)

**Recommendation**: Option A for MVP, add real-time later

### 9. Historical Data Retention
**Question**: How long should we keep historical news items?

**Impact**:
- Storage costs
- Query performance
- User experience (old events cluttering view)

**Options**:
- A) 30 days rolling window
- B) 90 days rolling window
- C) 1 year rolling window
- D) Indefinite retention with archiving

**Recommendation**: Option B for MVP, archive older data

### 10. Mobile Performance
**Question**: How do we optimize for mobile devices?

**Impact**:
- Limited bandwidth
- Smaller screens
- Touch interactions
- Battery life

**Options**:
- A) Separate mobile API with reduced fields
- B) Progressive loading (basic → full)
- C) Offline support with service worker
- D) All of the above

**Recommendation**: Option B for MVP, add C later

## Research Questions (Need Investigation)

### 11. GDELT Rate Limits
**Question**: What are the actual rate limits for GDELT DOC 2.0 API?

**Status**: Observed 429 errors, but official limits undocumented

**Next Steps**:
- Test with controlled requests
- Document observed limits
- Implement conservative rate limiting

### 12. RSS Feed Reliability
**Question**: How reliable are the candidate RSS feeds?

**Status**: Need to test uptime and update frequency

**Next Steps**:
- Monitor feed availability
- Document update patterns
- Identify fallback feeds

### 13. ReliefWeb Data Quality
**Question**: How good is ReliefWeb data for our use case?

**Status**: Need API access to evaluate

**Next Steps**:
- Test with appname if available
- Evaluate data structure and quality
- Compare with other sources

## Technical Debt Questions

### 14. API Versioning Strategy
**Question**: Should we implement API versioning from the start?

**Impact**:
- Adds complexity
- Prevents breaking changes
- May not be needed for MVP

**Recommendation**: Start with v1, plan for versioning

### 15. Database Migration Strategy
**Question**: How do we handle schema changes in production?

**Impact**:
- Need rollback capability
- Zero-downtime migrations
- Data integrity

**Recommendation**: Use migration files with rollback scripts

## Decision Timeline

### Immediate (Before Proof Script)
1. ReliefWeb appname availability
2. RSS feed allowlist

### Before Phase 2 (Data Pipeline)
3. GDELT geocoding strategy
4. Country-level display decision
5. Deduplication threshold
6. Severity mapping

### Before Phase 3 (API)
7. Image handling strategy
8. Real-time updates decision
9. Historical data retention

### Before Phase 4 (Frontend)
10. Mobile performance strategy
11. API versioning approach