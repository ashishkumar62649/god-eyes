# API Planning: Layer 07 Weather MVP

## Overview

This document defines the REST API endpoints for the GOD EYES Weather layer.

---

## Planned Endpoints

### 1. GET /api/layers/layer_07_weather/objects

Returns weather observations within a bounding box or for specific criteria.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `bbox` | string | (required) | Bounding box: `minLon,minLat,maxLon,maxLat` |
| `limit` | int | 1000 | Max results (capped at 10000) |
| `offset` | int | 0 | Pagination offset |
| `temperature_min` | float | null | Minimum temperature filter (°C) |
| `temperature_max` | float | null | Maximum temperature filter (°C) |
| `wind_speed_min` | float | null | Minimum wind speed filter (km/h) |
| `wind_speed_max` | float | null | Maximum wind speed filter (km/h) |
| `weather_code` | int | null | Exact weather code filter |
| `include_stale` | bool | false | Include stale observations |
| `sort` | string | `temperature_c` | Sort field (temperature_c, wind_speed_kph, humidity_percent, fetched_at) |
| `sort_order` | string | `desc` | Sort direction (asc/desc) |

**Response Shape:**

```json
{
    "objects": [
        {
            "observation_id": "abc123",
            "layer_id": "layer_07_weather",
            "source_id": "open-meteo",
            "location_id": "def456",
            "requested_latitude": 52.52,
            "requested_longitude": 13.41,
            "resolved_latitude": 52.5,
            "resolved_longitude": 13.5,
            "elevation_m": 44.812,
            "temperature_c": 18.5,
            "apparent_temperature_c": 17.2,
            "wind_speed_kph": 12.3,
            "wind_direction_deg": 225,
            "wind_gust_kph": 18.7,
            "humidity_percent": 65,
            "pressure_hpa": 1013.2,
            "precipitation_mm": 0.0,
            "precipitation_probability_percent": 10,
            "cloud_cover_percent": 45,
            "weather_code": 2,
            "weather_label": "Partly Cloudy",
            "forecast_for": "2026-06-10T14:00:00Z",
            "fetched_at": "2026-06-10T12:00:00Z",
            "is_stale": false,
            "provider_metadata": {
                "surface_pressure_hpa": 1008.1,
                "generation_time_ms": 2.2119
            },
            "raw_evidence_uri": "raw/layer_07_weather/open-meteo/2026/06/10/run_20260610T120000Z/batch_001.json"
        }
    ],
    "metadata": {
        "count": 1,
        "limit": 1000,
        "offset": 0,
        "generatedAt": "2026-06-10T12:00:00Z",
        "layerId": "layer_07_weather",
        "bbox": "13.0,52.0,14.0,53.0"
    }
}
```

**Error Response (400):**

```json
{
    "error": true,
    "code": "INVALID_BBOX",
    "message": "bbox must be in format: minLon,minLat,maxLon,maxLat"
}
```

**Error Response (500):**

```json
{
    "error": true,
    "code": "INTERNAL_ERROR",
    "message": "An internal error occurred"
}
```

---

### 2. GET /api/layers/layer_07_weather/objects/:objectId

Returns detailed weather observation for a specific location.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `objectId` | string | Location ID or observation ID |

**Response Shape:**

```json
{
    "observation": {
        "observation_id": "abc123",
        "layer_id": "layer_07_weather",
        "source_id": "open-meteo",
        "location_id": "def456",
        "requested_latitude": 52.52,
        "requested_longitude": 13.41,
        "resolved_latitude": 52.5,
        "resolved_longitude": 13.5,
        "elevation_m": 44.812,
        "temperature_c": 18.5,
        "apparent_temperature_c": 17.2,
        "wind_speed_kph": 12.3,
        "wind_direction_deg": 225,
        "wind_gust_kph": 18.7,
        "humidity_percent": 65,
        "pressure_hpa": 1013.2,
        "precipitation_mm": 0.0,
        "precipitation_probability_percent": 10,
        "cloud_cover_percent": 45,
        "weather_code": 2,
        "weather_label": "Partly Cloudy",
        "forecast_for": "2026-06-10T14:00:00Z",
        "fetched_at": "2026-06-10T12:00:00Z",
        "is_stale": false,
        "provider_metadata": {
            "surface_pressure_hpa": 1008.1,
            "elevation_m": 44.812,
            "generation_time_ms": 2.2119,
            "timezone": "Europe/Berlin",
            "timezone_abbreviation": "CEST"
        },
        "raw_evidence_uri": "raw/layer_07_weather/open-meteo/2026/06/10/run_20260610T120000Z/batch_001.json",
        "source_attribution": "Weather data provided by Open-Meteo (https://open-meteo.com/) under CC-BY 4.0 licence."
    }
}
```

**Error Response (404):**

```json
{
    "error": true,
    "code": "OBJECT_NOT_FOUND",
    "message": "Weather observation not found for the given ID"
}
```

---

### 3. GET /api/layers/layer_07_weather/stats

Returns summary statistics for the Weather layer.

**Response Shape:**

```json
{
    "layerId": "layer_07_weather",
    "totalLocations": 2664,
    "activeLocations": 2500,
    "staleLocations": 164,
    "lastUpdated": "2026-06-10T12:00:00Z",
    "dataFreshnessSeconds": 3600,
    "sourceId": "open-meteo",
    "sourceAttribution": "Weather data provided by Open-Meteo under CC-BY 4.0 licence.",
    "temperatureRange": {
        "min": -35.2,
        "max": 48.7,
        "average": 15.3
    },
    "weatherConditions": [
        { "code": 0, "label": "Clear Sky", "count": 800 },
        { "code": 2, "label": "Partly Cloudy", "count": 650 },
        { "code": 3, "label": "Overcast", "count": 400 },
        { "code": 61, "label": "Slight Rain", "count": 200 }
    ],
    "generatedAt": "2026-06-10T12:00:00Z"
}
```

---

## Query Behavior

### Bbox Filter

The bbox parameter filters observations by the resolved coordinates of weather cells:

```sql
SELECT o.*, l.resolved_latitude, l.resolved_longitude
FROM weather_observations_latest o
JOIN weather_locations l ON o.location_id = l.location_id
WHERE o.is_stale = false
  AND ST_Within(
      ST_Point(l.resolved_longitude, l.resolved_latitude),
      ST_MakeEnvelope($1, $2, $3, $4, 4326)
  )
ORDER BY o.fetched_at DESC
LIMIT $5 OFFSET $6;
```

### Limit Behavior

- Default limit: 1000
- Maximum limit: 10000
- If requested limit > 10000, cap at 10000
- If requested limit < 1, use default 1000

### Temperature Filter

```sql
WHERE o.temperature_c >= $temp_min
  AND o.temperature_c <= $temp_max
```

### Weather Code Filter

```sql
WHERE o.weather_code = $weather_code
```

### Include Stale

- Default: exclude stale observations (`is_stale = false`)
- If `include_stale=true`: include all observations regardless of staleness
- Stale observations marked with `is_stale: true` in response

---

## Error Behavior

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Invalid query parameters |
| 404 | Object not found (detail endpoint) |
| 500 | Internal server error |

### Error Response Format

All errors follow the GOD EYES error schema:

```json
{
    "error": true,
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `INVALID_BBOX` | bbox format invalid |
| `INVALID_LIMIT` | limit out of range |
| `INVALID_QUERY` | Invalid query parameter |
| `OBJECT_NOT_FOUND` | Observation not found |
| `INTERNAL_ERROR` | Server error |

---

## No Fake Fallback Behavior

### Rules
1. If database is empty → return empty array, zero counts
2. If no observations match bbox → return empty array
3. If source is unavailable → return last known data (may be stale)
4. Never generate fake weather data to fill gaps
5. Never interpolate between grid points
6. Never return placeholder/mock data

### Empty Response

```json
{
    "objects": [],
    "metadata": {
        "count": 0,
        "limit": 1000,
        "offset": 0,
        "generatedAt": "2026-06-10T12:00:00Z",
        "layerId": "layer_07_weather",
        "bbox": "13.0,52.0,14.0,53.0"
    }
}
```

---

## Database Access Pattern

### Direct SQL (Existing Pattern)

Following the project's existing API pattern (seen in maritime layer):

```typescript
// Example route handler
async function getWeatherObjects(request, reply) {
    const { bbox, limit, offset, temperature_min, temperature_max } = request.query;
    
    // Validate bbox
    const bboxParts = bbox.split(',').map(Number);
    if (bboxParts.length !== 4 || bboxParts.some(isNaN)) {
        return reply.code(400).send({ error: true, code: 'INVALID_BBOX', message: '...' });
    }
    
    const [minLon, minLat, maxLon, maxLat] = bboxParts;
    
    // Query with parameterized SQL
    const result = await query<WeatherObject>(`
        SELECT o.*, l.resolved_latitude, l.resolved_longitude, l.elevation_m
        FROM weather_observations_latest o
        JOIN weather_locations l ON o.location_id = l.location_id
        WHERE o.is_stale = false
          AND ST_Within(
              ST_Point(l.resolved_longitude, l.resolved_latitude),
              ST_MakeEnvelope($1, $2, $3, $4, 4326)
          )
          AND ($5::float IS NULL OR o.temperature_c >= $5)
          AND ($6::float IS NULL OR o.temperature_c <= $6)
        ORDER BY o.fetched_at DESC
        LIMIT $7 OFFSET $8
    `, [minLon, minLat, maxLon, maxLat, temperature_min, temperature_max, cappedLimit, offset]);
    
    return { objects: result.rows, metadata: { ... } };
}
```

### SQL Parameterization
- All queries use `$N` parameterized queries
- No string interpolation
- No SQL injection risk

---

## Contracts Package

### Zod Schemas (to add to packages/contracts/src/index.ts)

```typescript
// Weather Object Schema
export const WeatherObjectSchema = z.object({
    observation_id: z.string(),
    layer_id: z.string(),
    source_id: z.string(),
    location_id: z.string(),
    requested_latitude: z.number(),
    requested_longitude: z.number(),
    resolved_latitude: z.number(),
    resolved_longitude: z.number(),
    elevation_m: z.number().nullable(),
    temperature_c: z.number(),
    apparent_temperature_c: z.number().nullable(),
    wind_speed_kph: z.number().nullable(),
    wind_direction_deg: z.number().nullable(),
    wind_gust_kph: z.number().nullable(),
    humidity_percent: z.number().int().nullable(),
    pressure_hpa: z.number().nullable(),
    precipitation_mm: z.number().nullable(),
    precipitation_probability_percent: z.number().int().nullable(),
    cloud_cover_percent: z.number().int().nullable(),
    weather_code: z.number().int().nullable(),
    weather_label: z.string().nullable(),
    forecast_for: z.string(), // ISO 8601
    fetched_at: z.string(), // ISO 8601
    is_stale: z.boolean(),
    provider_metadata: z.record(z.unknown()).nullable(),
    raw_evidence_uri: z.string().nullable(),
});

// Weather Objects List Response
export const WeatherObjectsResponseSchema = z.object({
    objects: z.array(WeatherObjectSchema),
    metadata: z.object({
        count: z.number(),
        limit: z.number(),
        offset: z.number(),
        generatedAt: z.string(),
        layerId: z.string(),
        bbox: z.string(),
    }),
});

// Weather Object Detail Response
export const WeatherDetailResponseSchema = z.object({
    observation: WeatherObjectSchema.extend({
        source_attribution: z.string(),
    }),
});

// Weather Stats Response
export const WeatherStatsResponseSchema = z.object({
    layerId: z.string(),
    totalLocations: z.number(),
    activeLocations: z.number(),
    staleLocations: z.number(),
    lastUpdated: z.string().nullable(),
    dataFreshnessSeconds: z.number().nullable(),
    sourceId: z.string(),
    sourceAttribution: z.string(),
    temperatureRange: z.object({
        min: z.number(),
        max: z.number(),
        average: z.number(),
    }),
    weatherConditions: z.array(z.object({
        code: z.number(),
        label: z.string(),
        count: z.number(),
    })),
    generatedAt: z.string(),
});
```

---

## Route Registration

### In apps/api/src/index.ts

```typescript
import { weatherRoutes } from './routes/weather';

// Register weather routes
fastify.register(weatherRoutes, { prefix: '/api/layers/layer_07_weather' });
```

### Route Module Structure

```typescript
// apps/api/src/routes/weather.ts
export async function weatherRoutes(fastify: FastifyInstance) {
    fastify.get('/objects', getWeatherObjects);
    fastify.get('/objects/:objectId', getWeatherDetail);
    fastify.get('/stats', getWeatherStats);
}
```

---

## Test Expectations

### Test Cases (similar to maritime layer)

1. Route registration (objects, detail, stats endpoints respond)
2. Objects list returns weather objects with all fields
3. Bbox filter (validates SQL contains ST_MakeEnvelope)
4. Temperature filters (min/max)
5. Weather code filter
6. Limit/offset (capped at MAX, correct SQL params)
7. Include stale parameter
8. Sort parameter
9. Invalid bbox rejection (400 INVALID_BBOX)
10. Invalid limit rejection (400 INVALID_LIMIT)
11. Object detail by location ID (200 with full data)
12. Object detail 404 (OBJECT_NOT_FOUND)
13. Stats endpoint with temperature range and condition breakdown
14. Empty database (objects, stats — zero counts, empty arrays)
15. No external network calls (fetch spy)
16. No frontend imports in route source
17. SQL parameterized (contains $1)
18. No secrets exposed
19. Internal error on DB failure (500 INTERNAL_ERROR, no SQL leak)
