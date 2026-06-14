# Aviation Preload API — Resident Cache Mode (WO-030A)

## Overview

The preload endpoint enables the frontend to fetch all aviation airports by category in a single request, suitable for resident cache mode. Instead of tile-wise bbox fetching, the frontend loads all airports once per category and renders from local cache.

## Endpoint

```
GET /api/layers/:layerId/objects?objectType=airport&mode=preload&category=<category>
```

## Parameters

| Parameter | Required | Type | Description |
|-----------|----------|------|-------------|
| `objectType` | Yes | `string` | Must be `airport` |
| `mode` | Yes | `string` | Must be `preload` |
| `category` | Yes | `string` | Aviation category (see below) |
| `limit` | No | `number` | Max records to return (default: 100000, max: 100000) |

## Supported Categories

| Category Key | Description |
|--------------|-------------|
| `international_or_major_airport` | Large international and major airports |
| `regional_or_domestic_airport` | Regional and domestic airports |
| `small_airfield` | Small airfields and local airports |
| `heliport` | Heliports |
| `water_landing_site` | Seaplane bases and water landing sites |
| `balloonport` | Balloonports |
| `closed_or_abandoned` | Closed or abandoned airports |
| `unknown` | Unclassified airports |

## Response Format

```json
{
  "items": [
    {
      "id": "uuid",
      "ident": "KJFK",
      "name": "John F Kennedy International Airport",
      "category": "international_or_major_airport",
      "latitude": 40.639751,
      "longitude": -73.778925,
      "country": "US",
      "region": "US-NY",
      "municipality": "New York",
      "iataCode": "JFK",
      "gpsCode": "KJFK",
      "elevationFt": 13,
      "status": "large_airport"
    }
  ],
  "metadata": {
    "mode": "preload",
    "category": "international_or_major_airport",
    "returnedCount": 1182,
    "totalCount": 1182,
    "generatedAt": "2026-05-17T12:00:00.000Z",
    "summary": [
      { "category": "small_airfield", "count": 42616 },
      { "category": "heliport", "count": 22980 },
      { "category": "closed_or_abandoned", "count": 13181 },
      { "category": "regional_or_domestic_airport", "count": 4095 },
      { "category": "water_landing_site", "count": 1262 },
      { "category": "international_or_major_airport", "count": 1182 },
      { "category": "balloonport", "count": 61 }
    ]
  }
}
```

## Response Fields (Lightweight)

Each item contains only fields required for map rendering and Object Intel lookup:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | UUID for Object Intel lookup |
| `ident` | `string` | Airport identifier (e.g., KJFK) |
| `name` | `string` | Airport name |
| `category` | `string` | Normalized category |
| `latitude` | `number \| null` | Latitude |
| `longitude` | `number \| null` | Longitude |
| `country` | `string \| null` | ISO country code |
| `region` | `string \| null` | ISO region code |
| `municipality` | `string \| null` | City/municipality |
| `iataCode` | `string \| null` | IATA code |
| `gpsCode` | `string \| null` | GPS/FAA code |
| `elevationFt` | `number \| null` | Elevation in feet |
| `status` | `string \| null` | Source type (large_airport, etc.) |

**Excluded heavy fields:** `sourceId`, `sourceObjectId`, `typeSource`, `layerId`, `objectType`, `createdAt`, `updatedAt`, raw metadata.

## Metadata Fields

| Field | Type | Description |
|-------|------|-------------|
| `mode` | `"preload"` | Always "preload" |
| `category` | `string` | Requested category |
| `returnedCount` | `number` | Number of items returned |
| `totalCount` | `number` | Total matching records in database |
| `generatedAt` | `string` | ISO timestamp |
| `summary` | `array` | Category counts for all categories (useful for UI badges) |

## Protection Mechanisms

1. **Explicit mode required:** Only activates when `mode=preload` is specified
2. **Category required:** Returns 400 if category is missing
3. **Category validation:** Returns 400 for invalid categories
4. **Limit cap:** Maximum 100,000 records (suitable for full dataset)
5. **Lightweight projection only:** No heavy metadata fields returned

## Example curl Commands

```bash
# Fetch all international airports
curl "http://localhost:4000/api/layers/layer_01_aviation/objects?objectType=airport&mode=preload&category=international_or_major_airport"

# Fetch all heliports
curl "http://localhost:4000/api/layers/layer_01_aviation/objects?objectType=airport&mode=preload&category=heliport"

# Fetch all small airfields with custom limit
curl "http://localhost:4000/api/layers/layer_01_aviation/objects?objectType=airport&mode=preload&category=small_airfield&limit=50000"

# Invalid category (returns 400)
curl "http://localhost:4000/api/layers/layer_01_aviation/objects?objectType=airport&mode=preload&category=invalid"

# Missing category (returns 400)
curl "http://localhost:4000/api/layers/layer_01_aviation/objects?objectType=airport&mode=preload"
```

## Frontend Integration Pattern

```typescript
// Fetch all categories once at layer initialization
const CATEGORIES = [
  'international_or_major_airport',
  'regional_or_domestic_airport',
  'small_airfield',
  'heliport',
  'water_landing_site',
  'balloonport',
  'closed_or_abandoned',
  'unknown',
];

async function preloadAviationCategory(category: string) {
  const response = await fetch(
    `${API_BASE}/api/layers/layer_01_aviation/objects?objectType=airport&mode=preload&category=${category}`
  );
  const data = await response.json();
  return data.items; // Store in local cache
}

// Load all categories in parallel
const allAirports = await Promise.all(
  CATEGORIES.map(cat => preloadAviationCategory(cat))
);
const flatAirports = allAirports.flat();
```

## Backward Compatibility

- Existing `mode=points` endpoint: **Unchanged**
- Existing `mode=clusters` endpoint: **Unchanged**
- Existing `mode=density` endpoint: **Unchanged**
- Existing `fields=marker` endpoint: **Unchanged**
- Existing bbox/tile queries: **Unchanged**
- Existing detail endpoint: **Unchanged**

## Limit Behavior

| Mode | Default Limit | Max Limit |
|------|--------------|-----------|
| Standard (no bbox) | 500 | 500 |
| Viewport (with bbox) | 500 | 1,000 |
| **Preload** | **100,000** | **100,000** |

## Known Limitations

- Preload mode does not support bbox filtering (returns all records for category)
- Preload mode does not support country/search filters (category only)
- Preload mode does not support pagination (single request returns all up to limit)
- Full dataset fetch may take several seconds for large categories (small_airfield: ~42k records)
- Not suitable for real-time data; designed for initial cache load
