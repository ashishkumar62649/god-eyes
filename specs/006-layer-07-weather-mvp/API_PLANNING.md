# API Planning: Layer 07 Weather MVP

## Overview

This document defines the REST API endpoints for the GOD EYES Weather layer.

---

## Implemented Endpoints

### 1. GET /api/layers/layer_07_weather/weather/latest

Returns latest weather observations from weather_observations_latest.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `bbox` | string | none | Bounding box: `minLon,minLat,maxLon,maxLat` |
| `observation_type` | string | none | `current` or `hourly` |
| `source_id` | string | none | Source ID (default: open-meteo) |
| `forecast_from` | string | none | ISO 8601 timestamp (inclusive) |
| `forecast_to` | string | none | ISO 8601 timestamp (inclusive) |
| `limit` | int | 200 | Max results (capped at 5000) |
| `offset` | int | 0 | Pagination offset |

**Response Shape:**

```json
{
    "data": [
        {
            "observation_id": "abc123",
            "observation_type": "current",
            "layer_id": "layer_07_weather",
            "source_id": "open-meteo",
            "location_id": "def456",
            "coordinates": {
                "requested": {"latitude": 52.52, "longitude": 13.41},
                "resolved": {"latitude": 52.5, "longitude": 13.5},
                "elevation_m": 44.812
            },
            "weather": {
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
                "weather_label": "Partly Cloudy"
            },
            "forecast_for": "2026-06-10T14:00:00Z",
            "fetched_at": "2026-06-10T12:00:00Z",
            "is_stale": false,
            "raw_evidence_uri": "raw/layer_07_weather/open-meteo/2026/06/10/run_20260610T120000Z/batch_001.json",
            "provider_metadata": {
                "surface_pressure_hpa": 1008.1,
                "generation_time_ms": 2.2119
            },
            "attribution": "Weather data provided by Open-Meteo under CC-BY 4.0 licence."
        }
    ],
    "meta": {
        "layer_id": "layer_07_weather",
        "count": 1,
        "limit": 200,
        "offset": 0,
        "source_id": "open-meteo",
        "attribution": "Weather data provided by Open-Meteo under CC-BY 4.0 licence."
    }
}
```

---

### 2. GET /api/layers/layer_07_weather/weather/current

Convenience endpoint for observation_type=current.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `bbox` | string | none | Bounding box |
| `source_id` | string | none | Source ID filter |
| `limit` | int | 200 | Max results (capped at 5000) |
| `offset` | int | 0 | Pagination offset |

**Response:** Same shape as `/weather/latest` but filtered to `observation_type: "current"`.

---

### 3. GET /api/layers/layer_07_weather/weather/hourly

Convenience endpoint for observation_type=hourly.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `bbox` | string | none | Bounding box |
| `source_id` | string | none | Source ID filter |
| `forecast_from` | string | none | ISO 8601 timestamp (inclusive) |
| `forecast_to` | string | none | ISO 8601 timestamp (inclusive) |
| `limit` | int | 200 | Max results (capped at 5000) |
| `offset` | int | 0 | Pagination offset |

**Response:** Same shape as `/weather/latest` but filtered to `observation_type: "hourly"`.

---

### 4. GET /api/layers/layer_07_weather/weather/nearby

Returns nearest weather observations to a point using PostGIS spatial distance.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `lat` | float | (required) | Latitude (-90 to 90) |
| `lon` | float | (required) | Longitude (-180 to 180) |
| `radius_km` | float | 200 | Search radius in km (max 1000) |
| `observation_type` | string | none | `current` or `hourly` |
| `source_id` | string | none | Source ID filter |
| `limit` | int | 50 | Max results (capped at 5000) |

**Response:** Same shape as `/weather/latest` with additional `distance_km` field per item, and `lat`, `lon`, `radius_km` in meta.

---

### 5. GET /api/layers/layer_07_weather/weather/sources

Returns active weather_sources rows with attribution.

**Response Shape:**

```json
{
    "data": [
        {
            "source_id": "open-meteo",
            "source_name": "Open-Meteo",
            "source_url": "https://open-meteo.com/",
            "licence": "CC-BY 4.0",
            "attribution": "Weather data provided by Open-Meteo under CC-BY 4.0 licence.",
            "is_active": true
        }
    ],
    "meta": {
        "count": 1,
        "layer_id": "layer_07_weather"
    }
}
```

---

### 6. GET /api/layers/layer_07_weather/weather/fetch-runs

Returns recent weather_fetch_runs for admin/debug visibility.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `source_id` | string | none | Source ID filter |
| `status` | string | none | Filter by status (running/completed/failed/partial) |
| `limit` | int | 200 | Max results |
| `offset` | int | 0 | Pagination offset |

**Response Shape:**

```json
{
    "data": [
        {
            "fetch_run_id": "run_20260610T120000Z",
            "source_id": "open-meteo",
            "layer_id": "layer_07_weather",
            "grid_resolution": "5deg",
            "total_cells": 2664,
            "successful_cells": 2664,
            "failed_cells": 0,
            "fetch_started_at": "2026-06-10T12:00:00Z",
            "fetch_completed_at": "2026-06-10T12:05:00Z",
            "api_calls_made": 54,
            "raw_storage_path": "raw/layer_07_weather/open-meteo/2026/06/10/run_20260610T120000Z/",
            "status": "completed",
            "error_message": null
        }
    ],
    "meta": {
        "count": 1,
        "limit": 200,
        "offset": 0,
        "layer_id": "layer_07_weather"
    }
}
```

---

## Query Behavior

### Bbox Filter

The bbox parameter filters observations by the geometry of weather locations:

```sql
SELECT o.*, l.resolved_latitude, l.resolved_longitude
FROM weather_observations_latest o
JOIN weather_locations l ON o.location_id = l.location_id
JOIN weather_sources s ON o.source_id = s.source_id
WHERE o.layer_id = $1
  AND l.geom && ST_MakeEnvelope($2, $3, $4, $5, 4326)
ORDER BY o.forecast_for DESC, o.fetched_at DESC
LIMIT $6 OFFSET $7;
```

### Nearby Spatial Query

Uses ST_DWithin with geography cast for radius search and ST_DistanceSphere for distance calculation:

```sql
SELECT sub.*, ST_DistanceSphere(sub.geom, ST_SetSRID(ST_MakePoint($lon, $lat), 4326)) / 1000.0 AS distance_km
FROM (
  SELECT o.*, l.geom, s.attribution
  FROM weather_observations_latest o
  JOIN weather_locations l ON o.location_id = l.location_id
  JOIN weather_sources s ON o.source_id = s.source_id
  WHERE o.layer_id = $1
    AND ST_DWithin(l.geom::geography, ST_SetSRID(ST_MakePoint($lon, $lat), 4326)::geography, $radius_meters)
) sub
ORDER BY distance_km ASC
LIMIT $n;
```

### Limit Behavior
- Default limit: 200
- Maximum limit: 5000
- If requested limit > 5000, cap at 5000
- If requested limit < 1, use default 200

### Ordering
- Latest/current: `forecast_for DESC, fetched_at DESC`
- Hourly: `forecast_for DESC, fetched_at DESC`
- Nearby: `distance_km ASC`
- Fetch-runs: `fetch_started_at DESC`

### Provider Metadata Exposure

Only a safe subset of provider_metadata is exposed:
- `surface_pressure_hpa` (number, nullable)
- `generation_time_ms` (number, nullable)

Full JSONB metadata is not exposed to prevent leaking internal fields.

---

## Validation Rules

| Parameter | Validation |
|-----------|------------|
| `bbox` | Exactly 4 comma-separated numbers; lon [-180,180], lat [-90,90]; minLon < maxLon; minLat < maxLat |
| `lat` | -90 to 90 |
| `lon` | -180 to 180 |
| `radius_km` | Positive, max 1000 |
| `observation_type` | Must be `current` or `hourly` |
| `status` | Must be `running`, `completed`, `failed`, or `partial` |
| `forecast_from` / `forecast_to` | Valid ISO 8601 datetime; forecast_from <= forecast_to |
| `limit` | Positive integer, capped at 5000 |
| `offset` | Non-negative integer, capped at 10000 |

---

## Error Behavior

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Invalid query parameters |
| 500 | Internal server error |
| 503 | Database offline |

### Error Response Format

```json
{
    "error": {
        "code": "ERROR_CODE",
        "message": "Human-readable error message",
        "details": {}
    }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `INVALID_BBOX` | bbox format invalid |
| `INVALID_LIMIT` | limit out of range |
| `INVALID_QUERY` | Invalid query parameter |
| `INTERNAL_ERROR` | Server error (safe message, no SQL leak) |
| `DATABASE_OFFLINE` | Database unavailable |

---

## No Fake Fallback Behavior

1. If database is empty, return empty data array
2. If no observations match filters, return empty data array
3. Never generate fake weather data to fill gaps
4. Never interpolate between grid points
5. Never return placeholder/mock data

---

## Database Access Pattern

### Direct SQL (Existing Pattern)

Following the project's existing API pattern (TypeScript + Fastify + pg):

```typescript
const result = await query<WeatherObservationRow>(`
    SELECT ${OBSERVATION_SELECT_COLUMNS}
    FROM weather_observations_latest o
    JOIN weather_locations l ON o.location_id = l.location_id
    JOIN weather_sources s ON o.source_id = s.source_id
    WHERE o.layer_id = $1
      AND l.geom && ST_MakeEnvelope($2, $3, $4, $5, 4326)
    ORDER BY o.forecast_for DESC, o.fetched_at DESC
    LIMIT $6 OFFSET $7
`, sqlParams);
```

### SQL Parameterization
- All queries use `$N` parameterized queries
- No string interpolation
- No SQL injection risk

---

## Route Registration

### In apps/api/src/index.ts

```typescript
import { weatherRoutes } from './routes/weather.js';

// Register weather routes
await fastify.register(weatherRoutes);
```

### Route Module Structure

```typescript
// apps/api/src/routes/weather.ts
export async function weatherRoutes(fastify: FastifyInstance) {
    fastify.get('/api/layers/layer_07_weather/weather/latest', ...);
    fastify.get('/api/layers/layer_07_weather/weather/current', ...);
    fastify.get('/api/layers/layer_07_weather/weather/hourly', ...);
    fastify.get('/api/layers/layer_07_weather/weather/nearby', ...);
    fastify.get('/api/layers/layer_07_weather/weather/sources', ...);
    fastify.get('/api/layers/layer_07_weather/weather/fetch-runs', ...);
}
```

---

## Test Coverage

51 API tests implemented in `apps/api/tests/weather.test.ts`:

1. Route registration (all 6 endpoints respond)
2. Latest returns observations with full item shape
3. Provider metadata safe subset exposure
4. Null provider_metadata when no metadata available
5. Bbox filter SQL validation
6. Invalid bbox rejection (400 INVALID_BBOX)
7. Out of range bbox rejection
8. Current endpoint filters observation_type=current
9. Hourly endpoint filters observation_type=hourly
10. Current returns only current observations
11. Hourly returns only hourly observations
12. Hourly with forecast_from filter
13. Hourly with forecast_to filter
14. Nearby validates lat/lon
15. Nearby rejects lat out of range
16. Nearby rejects lon out of range
17. Nearby returns valid data with distance_km
18. Nearby SQL uses ST_DWithin
19. Nearby rejects invalid radius_km
20. Nearby rejects radius_km > max
21. Source_id filtering
22. Invalid observation_type rejection
23. Invalid timestamp rejection
24. forecast_from after forecast_to rejection
25. Limit/offset parsing
26. Empty result returns 200 with empty data
27. SQL parameterized (contains $1)
28. Weather sources endpoint returns attribution
29. Fetch runs endpoint returns run metadata
30. Fetch runs supports source_id filter
31. Fetch runs supports status filter
32. Fetch runs invalid status rejection
33. No external network calls
34. No frontend imports
35. No secrets exposed
36. Internal error on DB failure
37. Limit capped at MAX_LIMIT
38. Invalid limit returns 400
39. Invalid offset returns 400
40. Fetch runs ordering check
41. Sources endpoint empty handling
42. Fetch runs pagination
43. SQL joins weather_locations and weather_sources
44. Nearby supports observation_type filter
45. Hourly with both forecast_from and forecast_to
46. Ordering by forecast_for DESC, fetched_at DESC
47. Stale observations return is_stale: true
48. Numeric coercion from string to number
49. Null fields stay null
50. Zod validation with string numeric rows
