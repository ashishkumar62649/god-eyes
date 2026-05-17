# API Aviation Density View

## WO-029C

### Overview

This document describes the API support for the Aviation Density View feature (v1). The existing API already supports density visualization through the points endpoint with marker profile.

---

## Usage

### Density-Optimized Query

```
GET /api/layers/layer_01_aviation/objects?
  objectType=airport
  &mode=points
  &fields=marker
  &bbox={viewport}
  &limit=1000
```

### Parameters

| Parameter | Required | Default | Max | Notes |
|-----------|----------|---------|-----|-------|
| `objectType` | Yes | — | — | Must be `airport` |
| `mode` | No | `points` | — | `points` or `clusters` |
| `fields` | No | `standard` | — | Use `marker` for density view |
| `bbox` | Recommended | — | — | Use viewport bounds for bounded results |
| `limit` | No | 500 | 1000 with bbox | Clamped to max |

### Response Fields (marker profile)

For density view, the marker profile returns lightweight objects:

- `id` — UUID
- `layerId` — Layer identifier
- `objectType` — Always `airport`
- `ident` — ICAO code
- `name` — Airport name
- `category` — Airport category
- `municipality` — City/municipality (nullable)
- `country` — ISO country code (nullable)
- `position.latitude` — Latitude
- `position.longitude` — Longitude
- `iataCode` — IATA code (nullable)
- `elevationFt` — Elevation in feet (nullable)
- `updatedAt` — Last updated timestamp (nullable)

**Note**: Marker profile does NOT include `sourceId`, `sourceObjectId`, `typeSource`, or `region` — this keeps the payload lightweight for rendering many dots.

---

## Category Filtering

Density view supports filtering by airport category to show/hide specific types:

### Available Categories

| Category | Description |
|----------|-------------|
| `international_or_major_airport` | Major international airports |
| `regional_or_domestic_airport` | Regional/domestic airports |
| `small_airfield` | Small airfields |
| `heliport` | Heliports |
| `water_landing_site` | Seaplane bases |
| `balloonport` | Balloonports |
| `closed_or_abandoned` | Closed/abandoned (hidden by default in frontend) |
| `unknown` | Unknown type |

### Excluding Closed/Historical

To exclude closed airports from density view:

```
GET /api/layers/layer_01_aviation/objects?
  objectType=airport
  &mode=points
  &fields=marker
  &category=heliport
  &bbox={viewport}
  &limit=1000
```

Frontends can filter out `closed_or_abandoned` by omitting it from category queries or using multiple queries for operational categories only.

---

## Safety Limits

### Current Limits

| Scenario | Limit |
|----------|-------|
| Without bbox (general list) | 500 |
| With bbox (viewport query) | 1000 |

### Why Limits Are Safe

1. **Bounded results**: Viewport queries return at most 1000 items
2. **No global 85k fetch**: Even with global bbox (-180,-90,180,90), results are capped at 1000
3. **Order by name**: Results are alphabetically ordered, not spatially
4. **Frontend caching**: Frontend should cache viewport data and fetch on pan/zoom

### Query Example (Global, Bounded)

```
GET /api/layers/layer_01_aviation/objects?
  objectType=airport
  &mode=points
  &fields=marker
  &bbox=-180,-90,180,90
  &limit=1000

Response: {
  "items": [...], // max 1000 items
  "pagination": {
    "limit": 1000,
    "offset": 0,
    "returned": 1000,
    "total": 85000  // actual total in DB (may vary)
  }
}
```

---

## Backend Implementation

### Existing Endpoints Used

The density view uses the existing points endpoint with marker profile:

- **Route**: `/api/layers/:layerId/objects`
- **Mode**: `mode=points` (default)
- **Fields**: `fields=marker` (payload profile)

### No New Endpoints Required

The existing API already supports all density view requirements:

1. ✅ Lightweight marker payload (13 fields vs 17)
2. ✅ Category filtering
3. ✅ Bounding box support
4. ✅ Limit clamping (500/1000)
5. ✅ Spatial coordinates
6. ✅ Metadata with fields profile

---

## Frontend Integration

### Recommended Query Pattern

```typescript
async function fetchDensityDots(viewport: BBox) {
  const response = await fetch(
    `/api/layers/layer_01_aviation/objects?` +
    `objectType=airport&` +
    `mode=points&` +
    `fields=marker&` +
    `bbox=${viewport.minLon},${viewport.minLat},${viewport.maxLon},${viewport.maxLat}&` +
    `limit=1000`
  );
  return response.json();
}
```

### Frontend Responsibilities

1. **Viewport management**: Always include bbox parameter
2. **Caching**: Cache fetched data, update on pan/zoom
3. **Category filtering**: Use category param to filter by type
4. **Rendering**: Use PointPrimitiveCollection for performance
5. **Fallback**: Use cluster mode as fallback for close zoom

---

## Backward Compatibility

- **Standard mode** (`fields=standard`): Still works, returns full payload with source fields
- **Cluster mode** (`mode=clusters`): Still works, returns spatial clusters
- **List response**: Both `LayerObjectsListResponseSchema` and `AirportMarkerObjectsListResponseSchema` are maintained

---

## Metadata

- **Work Order**: WO-029C
- **Agent**: Claude API 1
- **Role**: API/Contracts/Backend Implementation
- **Created**: 2026-05-17
- **Status**: Implemented (existing API support)