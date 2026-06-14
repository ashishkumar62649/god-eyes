# API Aviation Fabric Density

## WO-029D

### Overview

This document describes the API support for the Aviation Fabric Density feature (v1). This is the Global Aviation Fabric - a density view that shows aggregated airport nodes/cells instead of individual airports.

---

## Usage

### Fabric Density Query

```
GET /api/layers/layer_01_aviation/objects?
  objectType=airport
  &mode=density
  &bbox={viewport}
  &cellSizeDegrees=2.0
  &includeClosed=false
  &limit=1000
```

### Parameters

| Parameter | Required | Default | Max | Notes |
|-----------|----------|---------|-----|-------|
| `objectType` | Yes | — | — | Must be `airport` |
| `mode` | No | `points` | — | Use `density` for fabric view |
| `bbox` | Yes* | — | — | *Required for density mode |
| `cellSizeDegrees` | No | 2.0 | 0.5-10 | Grid cell size in degrees |
| `includeClosed` | No | false | — | Include closed/historical airports |
| `category` | No | — | — | Filter by airport category |
| `limit` | No | 500 | 1000 with bbox | Clamped to max |

### Response Fields

The density response returns aggregated cells, not individual airports:

```json
{
  "items": [
    {
      "id": "density:40:-120",
      "layerId": "layer_01_aviation",
      "objectType": "airport_density",
      "count": 47,
      "position": {
        "latitude": 40.5,
        "longitude": -119.8
      },
      "bbox": {
        "minLongitude": -120,
        "minLatitude": 40,
        "maxLongitude": -119,
        "maxLatitude": 41
      }
    }
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "returned": 15,
    "total": 42
  },
  "mode": "density",
  "metadata": {
    "filtersApplied": {
      "bbox": true,
      "category": "heliport",
      "includeClosed": false
    }
  }
}
```

---

## Cell Size Guidelines

| Value | Use Case | Approximate Cells (Global) |
|-------|----------|----------------------------|
| 0.5 | Very dense regions | ~50,000 cells (too many) |
| 1.0 | Dense regions | ~12,500 cells |
| **2.0** | **Default - Global view** | ~3,100 cells |
| 5.0 | Continental overview | ~500 cells |
| 10.0 | Very coarse | ~125 cells |

**Recommendation**: Use `cellSizeDegrees=2.0` for global view, adjust based on zoom level in frontend.

---

## Behavior

### Default Behavior (includeClosed=false)
- Excludes `closed_or_abandoned` airports from count
- Shows only operational airports (international, regional, small airfields, heliports, seaplane bases, balloonports)

### Include Closed (includeClosed=true)
- Includes `closed_or_abandoned` airports in the cell counts
- Use sparingly - historical airports may not represent current aviation network

### Category Filtering
- Filter by specific airport category: `category=heliport`
- Useful for showing specific airport types (operational only by default)

### Grid Aggregation
- Uses `FLOOR(latitude_deg / cellSizeDegrees)` for grid cells
- Each cell returns count and centroid position
- Results sorted by count descending (densest cells first)

---

## Safety Limits

| Scenario | Limit |
|----------|-------|
| Without bbox | Not allowed (density requires bbox) |
| With bbox | 1000 cells max |
| cellSizeDegrees | 0.5 (min) to 10.0 (max), clamped |

### Why This Is Safe
1. **Bounded cells**: Returns aggregated cells, not raw airports
2. **Max 1000 cells**: Even at global scale with 2° cells (~3k cells), capped at 1000
3. **No 85k fetch**: Never returns all 85k airports individually
4. **Closed excluded by default**: Shows only operational airports

---

## SQL Implementation

```sql
SELECT
  'density:' || FLOOR(latitude_deg / 2.0) * 2.0 || ':' ||
    FLOOR(longitude_deg / 2.0) * 2.0 as cell_id,
  COUNT(*) as airport_count,
  AVG(latitude_deg) as avg_latitude,
  AVG(longitude_deg) as avg_longitude,
  MIN(latitude_deg) as min_lat,
  MAX(latitude_deg) as max_lat,
  MIN(longitude_deg) as min_lon,
  MAX(longitude_deg) as max_lon
FROM aviation_airports
WHERE longitude_deg BETWEEN $1 AND $2
  AND latitude_deg BETWEEN $3 AND $4
  AND category_normalized != 'closed_or_abandoned'
GROUP BY
  FLOOR(latitude_deg / 2.0) * 2.0,
  FLOOR(longitude_deg / 2.0) * 2.0
ORDER BY airport_count DESC
LIMIT $5 OFFSET $6
```

---

## Frontend Integration

### Recommended Query Pattern

```typescript
async function fetchFabricCells(viewport: BBox, zoom: number) {
  // Adjust cell size based on zoom
  const cellSize = zoom > 8 ? 1.0 : zoom > 4 ? 2.0 : 5.0;

  const response = await fetch(
    `/api/layers/layer_01_aviation/objects?` +
    `objectType=airport&` +
    `mode=density&` +
    `bbox=${viewport.minLon},${viewport.minLat},${viewport.maxLon},${viewport.maxLat}&` +
    `cellSizeDegrees=${cellSize}&` +
    `limit=1000`
  );
  return response.json();
}
```

### Rendering Guidance

1. **PointPrimitiveCollection**: Use for rendering many density dots
2. **Node brightness**: Map `count` to pixel intensity
3. **Node size**: Keep small - don't create large consumer-map bubbles
4. **No clusters needed**: Density mode is already aggregated
5. **Viewport updates**: Fetch on pan/zoom with appropriate cell size

---

## Backward Compatibility

- **points mode**: Still works (returns individual airports)
- **clusters mode**: Still works (returns spatial clusters)
- **fields=marker**: Still works for points mode
- **detail endpoint**: Still works

---

## Metadata

- **Work Order**: WO-029D
- **Agent**: Claude API 1
- **Role**: API/Backend Implementation
- **Created**: 2026-05-17
- **Status**: Implemented