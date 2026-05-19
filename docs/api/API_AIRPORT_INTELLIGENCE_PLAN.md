# Airport Intelligence API Design Plan

## Work Order
WO-035-QWEN3-API-RESEARCH

## Date
2026-05-18

---

## 1. Endpoint Strategy

### Recommendation: New Endpoint
Create `GET /api/airports/:airportId/intelligence` as a **separate endpoint** rather than extending `public-profile`.

**Rationale:**
- Backward compatibility: existing `public-profile` consumers are unaffected
- Progressive loading: frontend can call `public-profile` for fast initial render, then `intelligence` for enriched data
- Independent caching: each endpoint has different TTL and refresh policies
- Clear separation: `public-profile` = basic identity + summary; `intelligence` = enriched multi-module data
- Future-proof: intelligence modules can evolve without impacting public profile contract

### Alternative Considered
Extending `public-profile` with optional `?modules=overview,capacity,traffic` query parameter. Rejected because it couples basic and enriched data lifecycles.

---

## 2. Canonical Endpoint

```
GET /api/airports/:airportId/intelligence
```

### Optional Query Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `sections` | string | Comma-separated list of sections to return. Default: all. |
| `freshness` | string | `any` (default), `fresh-only`, `no-stale`. Controls stale data behavior. |
| `timeout` | number | Max milliseconds to wait for cached sections. Default: 0 (return immediately). |

### Examples
```
GET /api/airports/99592da8-c66d-4522-8af9-54be9ee0635c/intelligence
GET /api/airports/:id/intelligence?sections=overview,capacity
GET /api/airports/:id/intelligence?freshness=fresh-only
```

---

## 3. Response Shape

### Top-Level Structure
```json
{
  "airportId": "string",
  "generatedAt": "2026-05-18T12:00:00Z",
  "overallStatus": "partial|complete|error",
  "sections": {
    "overview": { ... },
    "capability": { ... },
    "capacity": { ... },
    "traffic": { ... },
    "infrastructure": { ... },
    "sources": { ... }
  }
}
```

### Section Schema (applies to all sections)
```json
{
  "status": "ok|stale|fetching|no_data|error",
  "data": { ... } | null,
  "fetchedAt": "2026-05-18T12:00:00Z" | null,
  "expiresAt": "2026-05-18T12:00:00Z" | null,
  "confidence": "high|medium|low|none",
  "confidenceScore": 0.95,
  "sourceSummary": {
    "sources": ["OurAirports", "en.wikipedia.org"],
    "lastRefresh": "2026-05-18T12:00:00Z",
    "refreshCount": 3
  },
  "error": {
    "code": "string",
    "message": "string"
  } | null
}
```

---

## 4. Section Definitions

### 4.1 Overview
Basic airport identity and summary.

**Status:** `ok` when public-profile cache exists.
**Data shape:**
```json
{
  "id": "string",
  "name": "string",
  "iataCode": "string | null",
  "icaoCode": "string | null",
  "location": {
    "latitude": number,
    "longitude": number,
    "city": "string | null",
    "country": "string | null"
  },
  "summary": "string | null",
  "category": "string",
  "elevationFt": number | null
}
```
**Source:** `airport_public_profiles` table (reuses public-profile cache).
**TTL:** 30 days.

### 4.2 Capability
Operational capabilities and service tags.

**Status:** `ok` when capability tags are cached.
**Data shape:**
```json
{
  "tags": ["international", "customs", "night_landing", "instrument_approach"],
  "services": ["fuel", "maintenance", "passenger_terminal", "cargo"],
  "restrictions": ["ppr_required", "military_civilian_joint"],
  "operatingHours": "string | null",
  "runwayCount": number,
  "longestRunwayFt": number | null
}
```
**Source:** OurAirports runway/facility data, normalized tags.
**TTL:** 30 days.

### 4.3 Capacity
Airport capacity metrics (static/semi-static).

**Status:** `ok` when capacity data is available.
**Data shape:**
```json
{
  "terminalCapacity": number | null,
  "annualPassengerCapacity": number | null,
  "cargoCapacityTons": number | null,
  "aircraftMovementCapacity": number | null,
  "gateCount": number | null,
  "parkingStands": number | null,
  "notes": "string | null"
}
```
**Source:** Wikipedia infobox, official airport websites (future fetcher).
**TTL:** 90 days (capacity changes rarely).

### 4.4 Traffic
Historical and trend traffic data.

**Status:** `ok` when traffic metrics are cached.
**Data shape:**
```json
{
  "annualPassengers": {
    "2025": 45000000,
    "2024": 42000000,
    "2023": 38000000
  },
  "annualMovements": {
    "2025": 320000,
    "2024": 305000
  },
  "annualCargo": {
    "2025": 1200000,
    "2024": 1150000
  },
  "trend": {
    "passengerGrowth": "+7.1%",
    "movementGrowth": "+4.9%",
    "period": "2024-2025"
  },
  "peakMonth": "July",
  "notes": "string | null"
}
```
**Source:** Official statistics, Wikipedia references (future fetcher).
**TTL:** 365 days (annual data).

### 4.5 Infrastructure
Runway, navaid, and navigation support details.

**Status:** `ok` when infrastructure data is cached.
**Data shape:**
```json
{
  "runways": [
    {
      "id": "string",
      "designation": "09L/27R",
      "lengthFt": number,
      "widthFt": number,
      "surface": "ASP",
      "lighted": true,
      "closed": false
    }
  ],
  "navaids": [
    {
      "id": "string",
      "type": "VOR-DME",
      "ident": "ABC",
      "frequency": "114.30",
      "rangeNm": 130
    }
  ],
  "approachTypes": ["ILS", "RNAV", "VOR"],
  "lightingSystems": ["HIRL", "PAPI", "REIL"],
  "fuelTypes": ["100LL", "JET-A"]
}
```
**Source:** `aviation_runways`, `aviation_navaids` tables (already exist).
**TTL:** 30 days.

### 4.6 Sources
Metadata about data sources and freshness across all sections.

**Status:** Always `ok` (computed from other sections).
**Data shape:**
```json
{
  "totalSources": 3,
  "sources": [
    {
      "name": "OurAirports",
      "type": "identity",
      "sections": ["overview", "capability", "infrastructure"],
      "lastFetched": "2026-05-18T12:00:00Z",
      "confidence": "high"
    },
    {
      "name": "en.wikipedia.org",
      "type": "summary",
      "sections": ["overview"],
      "lastFetched": "2026-05-18T12:00:00Z",
      "confidence": "medium"
    }
  ],
  "overallConfidence": "high",
  "dataCompleteness": 0.75
}
```

---

## 5. Section Status Definitions

| Status | Meaning | Frontend Action |
|--------|---------|-----------------|
| `ok` | Fresh cached data available | Display normally |
| `stale` | Cached data exists but past TTL | Display with stale indicator, auto-refresh queued |
| `fetching` | No cache, background fetch initiated | Show loading state, poll for updates |
| `no_data` | No data available from any source | Show "not available" state |
| `error` | Fetch failed with error | Show error state, retry available |

---

## 6. Overall Status Logic

| Condition | `overallStatus` |
|-----------|-----------------|
| All sections `ok` or `no_data` | `complete` |
| At least one section `ok`, others `stale`/`fetching` | `partial` |
| All sections `fetching` or `error` | `error` |

---

## 7. Polling Strategy

### Recommended: Client-Side Polling with Section Awareness

1. **Initial call**: `GET /api/airports/:id/intelligence`
2. **Response**: Returns immediately with whatever is cached
3. **Frontend checks**: Which sections have `status: "fetching"` or `status: "stale"`
4. **Polling**: Frontend polls same endpoint every 2-5 seconds for sections still `fetching`
5. **Stop condition**: All sections reach terminal state (`ok`, `no_data`, `error`) or max polls reached (e.g., 30 polls = 60-150 seconds)

### Optimization: Section-Targeted Polling
```
GET /api/airports/:id/intelligence?sections=capacity,traffic
```
Frontend can poll only the sections that are still fetching, reducing payload size.

### Future: Server-Sent Events (SSE)
```
GET /api/airports/:id/intelligence/stream
```
Server pushes section updates as they become available. Not required for MVP.

---

## 8. Queue Trigger Strategy

### Automatic Queue on Read
When the intelligence endpoint is called:
1. For each section, check cache status
2. If cache is missing or stale:
   - Queue a background refresh for that section
   - Return section status as `fetching` or `stale`
3. Do NOT wait for the refresh to complete

### Queue Priority
| Section | Priority | Rationale |
|---------|----------|-----------|
| overview | Highest | Required for all other sections |
| capability | High | Core operational data |
| infrastructure | High | Already in DB, fast to serve |
| capacity | Medium | Semi-static, low priority |
| traffic | Low | Annual data, rarely changes |
| sources | Computed | Derived from other sections |

### Idempotency
- Each section refresh is idempotent
- Duplicate queue entries are deduplicated by `(airportId, section, run_type)`
- Fetch runs use `in_progress_key` to prevent concurrent fetches for same section

---

## 9. Stale Data Strategy

### Serve Stale Immediately
- If a section has stale data, return it with `status: "stale"`
- Queue background refresh automatically
- Frontend displays stale data with visual indicator (e.g., timestamp, "updated X days ago")

### TTL by Section
| Section | TTL | Rationale |
|---------|-----|-----------|
| overview | 30 days | Reuses public-profile cache |
| capability | 30 days | Operational data changes slowly |
| capacity | 90 days | Rarely changes |
| traffic | 365 days | Annual data |
| infrastructure | 30 days | Runway/navaid data changes slowly |

### Freshness Override
Client can request `?freshness=fresh-only` to exclude stale sections:
- Stale sections return `status: "fetching"` instead of stale data
- Useful for admin/refresh workflows

---

## 10. Error Strategy

### Section-Scoped Errors
Each section has its own `error` field. Errors in one section do not affect others.

```json
{
  "sections": {
    "overview": {
      "status": "ok",
      "data": { ... },
      "error": null
    },
    "traffic": {
      "status": "error",
      "data": null,
      "error": {
        "code": "SOURCE_UNAVAILABLE",
        "message": "Traffic statistics source is temporarily unavailable"
      }
    }
  }
}
```

### Error Codes
| Code | Meaning | Retry |
|------|---------|-------|
| `SOURCE_UNAVAILABLE` | External source down | Yes, with backoff |
| `PARSE_ERROR` | Data parsing failed | Yes, manual review may be needed |
| `NO_MATCH` | No matching data found | No |
| `RATE_LIMITED` | Source rate limit hit | Yes, with backoff |
| `TIMEOUT` | Fetch timed out | Yes |

### Overall Response Status
- Always returns `200 OK` unless the airport itself is not found (`404`)
- Section errors are contained within section objects
- `overallStatus` reflects aggregate health

---

## 11. Backward Compatibility

### No Breaking Changes to Existing Endpoints
- `GET /api/airports/:airportId/public-profile` remains unchanged
- Intelligence endpoint is additive
- Both endpoints can coexist indefinitely

### Shared Cache Layer
- Intelligence `overview` section reads from same `airport_public_profiles` table as public-profile
- No duplicate caching logic
- Consistent TTL and refresh behavior

### Migration Path
- Frontend can gradually adopt intelligence endpoint
- Start with `?sections=overview` to validate
- Add sections incrementally
- Fall back to public-profile if intelligence endpoint fails

---

## 12. Non-Blocking Design

### Key Principle: Return What You Have
1. Check cache for each section independently
2. Return immediately with cached data
3. Queue missing/stale sections for background refresh
4. Never block the response on slow sources

### Implementation Pattern
```
1. Parse request (airportId, sections filter)
2. For each requested section:
   a. Check cache (airport_public_profiles or section-specific cache)
   b. If fresh: return cached data with status "ok"
   c. If stale: return cached data with status "stale", queue refresh
   d. If missing: queue fetch, return status "fetching"
3. Assemble response
4. Return 200 immediately
5. Background workers process queued fetches
```

### Timeout Handling
- Each cache check has a 100ms timeout
- If cache check times out, section returns `status: "fetching"`
- Does not block other sections

---

## 13. Confidence Representation

### Two-Tier Confidence
1. **`confidence`** (string): `high`, `medium`, `low`, `none`
2. **`confidenceScore`** (number): 0.0 to 1.0

### Confidence Calculation
| Score | Label | Criteria |
|-------|-------|----------|
| 0.8-1.0 | high | Multiple authoritative sources agree |
| 0.5-0.79 | medium | Single authoritative source or multiple sources with minor discrepancies |
| 0.2-0.49 | low | Unverified sources or significant discrepancies |
| 0.0-0.19 | none | No reliable source available |

### Source-Level Confidence
Each source in `sourceSummary` has its own confidence:
- OurAirports: `high` (authoritative for airport identity)
- Wikipedia: `medium` (community-edited, requires verification)
- Wikidata: `medium` (structured but may be incomplete)
- Official websites: `high` (primary source)

---

## 14. Traffic/Growth Representation

### Time-Series Approach
Traffic data is stored as yearly snapshots with computed trends:
```json
{
  "annualPassengers": { "2025": 45000000, "2024": 42000000 },
  "trend": { "passengerGrowth": "+7.1%", "period": "2024-2025" }
}
```

### Growth Metrics
- Year-over-year percentage change
- 3-year compound annual growth rate (CAGR)
- Pre/post event comparisons (e.g., pandemic recovery)

### Data Availability
- Not all airports have traffic data
- Small airports may have `no_data` status
- Confidence is `low` for estimated/reconstructed data

---

## 15. Future Admin Endpoint

```
POST /api/airports/:airportId/intelligence/refresh
```

### Request Body
```json
{
  "sections": ["capacity", "traffic"],
  "priority": "high",
  "force": true
}
```

### Response
```json
{
  "status": "accepted",
  "queuedSections": ["capacity", "traffic"],
  "estimatedCompletionSeconds": 30
}
```

### Behavior
- Forces refresh of specified sections
- Bypasses cache TTL
- Returns 202 Accepted immediately
- Frontend can poll intelligence endpoint for completion

---

## 16. Database Schema Considerations

### New Tables (Future Migration)
```
airport_intelligence_sections
- id UUID
- airport_id UUID
- section_name TEXT (overview, capability, capacity, traffic, infrastructure)
- section_data JSONB
- status TEXT
- confidence TEXT
- confidence_score FLOAT
- fetched_at TIMESTAMPTZ
- expires_at TIMESTAMPTZ
- source_summary JSONB

UNIQUE(airport_id, section_name)
```

### Reuse Existing Tables
- `airport_public_profiles` for overview section
- `aviation_runways` for infrastructure section
- `aviation_navaids` for infrastructure section

---

## 17. Open Questions

1. **Should `overview` section be a direct mirror of `public-profile` response, or a transformed subset?**
   - Recommendation: Transformed subset to avoid duplicating the full public-profile shape.

2. **Should sections support versioning (e.g., `traffic_v1`, `traffic_v2`)?**
   - Recommendation: Not for MVP. Add when schema changes require it.

3. **How should the frontend handle partial responses during initial page load?**
   - Recommendation: Show skeleton loaders for `fetching` sections, display `ok` sections immediately.

4. **Should there be a maximum response size limit?**
   - Recommendation: Yes, 500KB per response. If exceeded, return `error` for largest sections.

5. **Should intelligence endpoint support ETag/If-None-Match for caching?**
   - Recommendation: Yes, but only when all sections are `ok`. Partial responses should not be cached by CDNs.

---

## 18. Summary

| Aspect | Decision |
|--------|----------|
| Endpoint | `GET /api/airports/:airportId/intelligence` (new, not extending public-profile) |
| Response shape | Modular sections, each with status/data/timestamps/confidence |
| Section statuses | `ok`, `stale`, `fetching`, `no_data`, `error` |
| Polling | Client-side, section-targeted, 2-5s interval |
| Queue trigger | Automatic on read, per-section, deduplicated |
| Stale data | Served immediately with `stale` status, background refresh queued |
| Errors | Section-scoped, overall response always 200 (except 404 for missing airport) |
| Backward compatibility | public-profile unchanged, intelligence is additive |
| Non-blocking | Return what you have, never wait for slow sources |
| Confidence | Two-tier: string label + numeric score, per-section and per-source |
