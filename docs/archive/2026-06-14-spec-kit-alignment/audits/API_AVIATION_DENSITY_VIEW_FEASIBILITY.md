# API Aviation Density View Feasibility Review

## WO-029B

### Executive Summary

The existing API can support a density-dot view primarily through the points endpoint with `fields=marker` profile. However, a full global density view without bbox constraints is unsafe and would return unbounded results. The recommended approach is **frontend-only** with viewport-constrained bbox queries.

---

## 1. Can Frontend Density Mode Be Safely Built with Existing Points/Marker Endpoint?

**Yes, with bbox constraints.**

The points endpoint supports `mode=points` (default) with `fields=marker` profile which returns lightweight marker objects:

```
GET /api/layers/layer_01_aviation/objects?objectType=airport&mode=points&fields=marker&bbox=-180,-90,180,90
```

This returns:
- id, layerId, objectType, name, ident, iataCode, category, municipality, country, position, elevationFt, updatedAt

The marker profile is already optimized for frontend rendering (13 fields vs 17 in standard).

**Safety**: Requires bbox parameter to limit results. Without bbox, returns up to 500 items (MAX_LIST_LIMIT) from the full 85k+ dataset — unpredictable which 500 are returned.

---

## 2. What Happens if Frontend Requests Global BBox with High Limit?

**Global bbox (-180,-90,180,90) with limit=1000:**

- Backend clamps limit to MAX_VIEWPORT_LIMIT (1000)
- SQL query uses `WHERE longitude_deg BETWEEN -180 AND 180 AND latitude_deg BETWEEN -90 AND 90`
- Returns 1000 airports from the entire global dataset
- Order is alphabetical by name (no spatial ordering)
- User sees random subset of 1000 airports on initial load
- Panning/zooming may reveal gaps (missing airports in current viewport)

**Risk**: If frontend shows all 1000 dots without spatial awareness, user perceives incomplete data. Cluster mode is designed to solve this — points mode alone cannot.

---

## 3. Are Current Limits Safe for Density View?

**Partially safe.**

Current limits:
- `MAX_LIST_LIMIT = 500` (general list, no bbox)
- `MAX_VIEWPORT_LIMIT = 1000` (with bbox)

For density view:
- **500 dots** — fine for small regions, insufficient for global
- **1000 dots** — barely adequate for continental view, not for global
- **Without bbox** — returns random 500, not useful for density

**Verdict**: Limits are safe but insufficient for true global density visualization. Need server-side density/binning or viewport-only approach.

---

## 4. Does API Support Category Filters?

**Yes.**

From `index.ts` line 152-158 and `points.ts` line 110-114:

```typescript
if (params.category) {
  sql += ` AND category_normalized = $${paramIndex}`;
  queryParams.push(params.category);
  paramIndex++;
}
```

Valid categories (from `constants.ts`):
- `international_or_major_airport`
- `regional_or_domestic_airport`
- `small_airfield`
- `heliport`
- `water_landing_site`
- `balloonport`
- `closed_or_abandoned`
- `unknown`

Frontend can filter by category for density view.

---

## 5. Does Cluster Endpoint Support Category Filters?

**No.** Cluster endpoint does not accept category parameter.

From `clusters.ts` line 68-129, the cluster SQL groups by spatial grid and category_normalized internally, returning category breakdowns per cluster:

```typescript
SUM(CASE WHEN category_normalized = 'heliport' THEN airport_count ELSE 0 END)
```

But the endpoint signature in `index.ts` line 214-219 only passes:
- `bbox` (required)
- `zoom` (optional)
- `limit`

No `category` filter exists for clusters.

---

## 6. Minimal Backend Support Needed for Density Mode

**Option A: Frontend-only (Recommended)**
- Use points endpoint with `fields=marker`
- Frontend caches viewport data on pan/zoom
- No backend changes

**Option B: Viewport-Only Points (No New Endpoint)**
- Same as Option A but enforce bbox requirement
- Already works

**Option C: Server-Side Density Grid (Requires New Endpoint)**
- New `mode=density` that returns binned counts per grid cell
- Grid size based on zoom level
- Returns count per cell, not individual airports
- Minimal SQL change: add `GROUP BY floor(lon/grid), floor(lat/grid)`

---

## 7. Should We Add a `fields=density` Profile?

**No.** Not recommended for this phase.

Reason: The `fields` parameter controls payload size per item (standard vs marker). Density view needs aggregated counts, not individual items. A new `mode=density` or separate endpoint is cleaner than overloading `fields`.

Current profiles:
- `standard` — 17 fields (full airport object)
- `marker` — 13 fields (lightweight)

Adding `density` doesn't fit this pattern.

---

## 8. Should We Add Server-Side Category Filtering?

**Already supported for points mode.**

Category filtering works for `mode=points`. Not available for `mode=clusters`.

If frontend needs cluster-level category filtering, would need enhancement to cluster endpoint.

---

## 9. Should We Add a Density/Grid/Binned Endpoint?

**Not recommended for current phase.**

The existing cluster endpoint already provides spatial aggregation. Consider reusing cluster data for density visualization instead of creating a new endpoint.

If cluster data is too heavy (returns full airport metadata per cluster), a lightweight density endpoint could be added later with payload like:
```json
{
  "cells": [
    { "lat": 40.5, "lon": -74.0, "count": 47, "categories": { "heliport": 5, "small_airfield": 42 } }
  ]
}
```

**Recommendation**: Start with frontend-only approach using points+marker. Add density endpoint only if performance proves inadequate.

---

## 10. How to Keep Queries Bounded and Production-Safe

Current safeguards already in place:

| Protection | Current Value | Status |
|------------|---------------|--------|
| Default limit | 500 | ✅ |
| List max limit | 500 | ✅ |
| Viewport max limit | 1000 | ✅ |
| BBox required for clusters | yes | ✅ |
| Category validation | allowlist | ✅ |
| Coordinate bounds clamp | -180/180, -90/90 | ✅ |
| Query timeout | (not configured) | ⚠️ Add |

**Recommendations for production**:
1. Add query timeout at Fastify level (30s)
2. Add rate limiting per IP
3. Add slow-query logging
4. Frontend should always send bbox — reject requests without bbox for points mode
5. Consider adding `minBBoxArea` check to prevent degenerate bboxes (e.g., 0.0001 degree area)

---

## 11. What Indexes Already Support This

From database migrations:

| Index | Purpose | Used in Density? |
|-------|---------|------------------|
| `idx_aviation_airports_geom` (GIST) | Spatial queries | Yes, for bbox |
| `idx_aviation_airports_category_normalized` | Category filter | Yes, for points |
| `idx_aviation_airports_iso_country` | Country filter | Yes, for points |
| `idx_aviation_airports_ident` | Lookup | Yes |
| `idx_aviation_airports_iata_code` | Lookup | Yes |
| Search GIN indexes (name, ident, iata_code, municipality) | Search mode | Not for density |

**Spatial index exists** — good for bbox queries.

**Missing**: Composite index for (category, longitude_deg, latitude_deg) — would speed filtered density queries.

---

## 12. Tests Needed

### Unit Tests
- `validation.ts`: test bbox validation edge cases
- `validation.ts`: test category validation with valid/invalid inputs
- `validation.ts`: test limit clamping

### Integration Tests
- `GET /api/layers/layer_01_aviation/objects?mode=points&fields=marker` — returns 500
- `GET /api/layers/layer_01_aviation/objects?mode=points&fields=marker&bbox=-180,-90,180,90&limit=1000` — returns 1000
- `GET /api/layers/layer_01_aviation/objects?mode=points&category=heliport` — filtered results
- `GET /api/layers/layer_01_aviation/objects?mode=clusters&bbox=-180,-90,180,90` — clusters without category filter

### Performance Tests
- Global bbox query response time (target: <500ms)
- 85k row count query timing
- Concurrent request handling

---

## Recommendation: Frontend-Only vs API Support

### Recommendation: **Frontend-Only Approach**

Use existing points endpoint with marker profile and viewport-constrained bbox.

**Implementation**:
```
Frontend fetches: GET /api/layers/layer_01_aviation/objects?
  objectType=airport
  &mode=points
  &fields=marker
  &bbox={currentViewport}
  &limit=1000
```

**Why Frontend-Only Works**:
1. Marker profile already lightweight (13 fields)
2. Viewport-constrained bbox keeps query bounded
3. No API changes required
4. Cluster endpoint already provides spatial aggregation if needed

**Why Not Add New Endpoint Now**:
1. Premature optimization — cluster mode may serve density needs
2. Complexity cost of new endpoint
3. Frontend can cache/viewport-manage for good UX

**When to Revisit**:
- If viewport queries exceed 1000 items (zoom level too high)
- If pan/zoom feels slow due to API latency
- If user feedback indicates gaps in coverage

---

## Appendix: Current API Parameters Summary

| Parameter | Required | Default | Max | Notes |
|-----------|----------|---------|-----|-------|
| `objectType` | yes | — | — | Must be `airport` |
| `mode` | no | `points` | — | `points` or `clusters` |
| `bbox` | no* | — | — | *Required for clusters |
| `limit` | no | 500 | 1000 with bbox | Clamped to max |
| `offset` | no | 0 | — | |
| `category` | no | — | — | 8 valid values |
| `country` | no | — | — | ISO code |
| `search` | no | — | — | ILIKE on name/ident/iata |
| `fields` | no | `standard` | — | `standard` or `marker` |
| `coordinates` | no | `source` | — | `source` or `effective` |
| `zoom` | no | null | — | Affects cluster grid size |

---

## Metadata

- **Work Order**: WO-029B
- **Agent**: Claude API 1
- **Role**: API/Contracts Architecture Planning
- **Created**: 2026-05-17
- **Review Scope**: Existing API capabilities for density visualization