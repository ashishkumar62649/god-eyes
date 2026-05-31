# API Contract Specification: Layer 05 Space & Satellites

**Lane Owner**: DeepSeek  
**Status**: Specification (Not Implemented)

---

## Overview

The Space & Satellites API provides RESTful and WebSocket endpoints for querying orbital objects, fetching position estimates, and streaming real-time position updates.

**Base URL**: `/api/layer-05`

**Primary Consumers**: Frontend (Cesium globe), desktop tools, mobile apps

---

## REST Endpoints

### 1. GET `/api/layer-05/satellites`

Fetch paginated list of orbital objects with filtering and sorting.

**Method**: `GET`

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `category` | string[] | No | (none) | Filter by category (multi-select, repeatable: `?category=STARLINK&category=COMMS`) |
| `object_type` | string | No | (none) | Filter by object type: `PAYLOAD`, `DEBRIS`, `ROCKET_BODY` |
| `orbit_class` | string | No | (none) | Filter by orbit class: `VLEO`, `LEO`, `MEO`, `GEO`, `HEO` |
| `min_altitude_km` | number | No | 0 | Minimum altitude (km) |
| `max_altitude_km` | number | No | 1000000 | Maximum altitude (km) |
| `importance` | boolean | No | (none) | Filter by importance flag (true/false) |
| `search` | string | No | (none) | Free-text search on name (case-insensitive substring) |
| `operator` | string | No | (none) | Filter by operator (e.g., "SpaceX") |
| `sort_by` | string | No | `name` | Sort field: `name`, `altitude`, `speed`, `updated_at`, `category` |
| `sort_order` | string | No | `asc` | Sort order: `asc`, `desc` |
| `limit` | number | No | 100 | Max records per page (max 10000) |
| `offset` | number | No | 0 | Pagination offset |

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "objects": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "STARLINK-1001",
        "norad_catalog_id": 44713,
        "international_designator": "2020-001A",
        "object_type": "PAYLOAD",
        "category": "STARLINK",
        "operator": "SpaceX",
        "mission": "Starlink Batch 1",
        "orbit_class": "LEO",
        "estimated_altitude_km": 550.2,
        "estimated_speed_km_s": 7.64,
        "importance_flag": false,
        "tle_epoch": "2026-05-31T10:00:00Z",
        "data_age_hours": 2,
        "source": "celestrak",
        "last_updated": "2026-05-31T10:00:00Z"
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "name": "ISS (ZARYA)",
        "norad_catalog_id": 25544,
        "international_designator": "1998-067A",
        "object_type": "PAYLOAD",
        "category": "CREWED",
        "operator": "NASA/RSA",
        "mission": "International Space Station",
        "orbit_class": "LEO",
        "estimated_altitude_km": 408.5,
        "estimated_speed_km_s": 7.66,
        "importance_flag": true,
        "tle_epoch": "2026-05-31T12:00:00Z",
        "data_age_hours": 1,
        "source": "celestrak",
        "last_updated": "2026-05-31T11:00:00Z"
      }
    ],
    "pagination": {
      "total": 5000,
      "offset": 0,
      "limit": 100,
      "hasMore": true
    },
    "metadata": {
      "query_time_ms": 45,
      "server_time_utc": "2026-05-31T13:45:30Z"
    }
  }
}
```

**Error Response** (400 Bad Request):

```json
{
  "success": false,
  "error": {
    "code": "INVALID_FILTER",
    "message": "Invalid value for limit: 50000 (max 10000)",
    "details": {
      "parameter": "limit",
      "value": 50000,
      "constraint": "max 10000"
    }
  }
}
```

---

### 2. GET `/api/layer-05/satellites/:id`

Fetch detailed metadata for a single orbital object, including computed current position.

**Method**: `GET`

**Path Parameters**:
- `id` (UUID): Orbital object ID

**Query Parameters**:
- `timestamp` (ISO 8601, optional): Request position for specific time (defaults to now)

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "ISS (ZARYA)",
    "norad_catalog_id": 25544,
    "international_designator": "1998-067A",
    "object_type": "PAYLOAD",
    "category": "CREWED",
    "operator": "NASA/RSA",
    "mission": "International Space Station",
    "importance_flag": true,
    
    "orbital_elements": {
      "tle_line_1": "1 25544U 98067A   26152.41667476  .00012345  00000-0  12345-4 0  9990",
      "tle_line_2": "2 25544  51.6400  30.1234 0003456  45.6789 314.3210 15.54123456123456",
      "tle_epoch": "2026-05-31T12:00:00Z",
      "semi_major_axis_km": 6733.5,
      "apogee_km": 408.5,
      "perigee_km": 408.5,
      "inclination_degrees": 51.64,
      "eccentricity": 0.0003456,
      "mean_motion_revs_per_day": 15.54
    },
    
    "current_position": {
      "latitude": 45.2231,
      "longitude": -122.6765,
      "altitude_km": 408.5,
      "speed_km_s": 7.66,
      "heading_degrees": 45.2,
      "timestamp": "2026-05-31T13:45:30Z",
      "tle_age_hours": 1,
      "computation_method": "SGP4"
    },
    
    "orbit_analysis": {
      "orbit_class": "LEO",
      "orbital_period_minutes": 92.3,
      "ground_speed_km_h": 27600
    },
    
    "metadata": {
      "source": "celestrak",
      "source_last_refreshed": "2026-05-31T11:00:00Z",
      "data_age_hours": 1,
      "created_at": "2020-01-01T00:00:00Z",
      "updated_at": "2026-05-31T11:00:00Z"
    },
    
    "server_time_utc": "2026-05-31T13:45:30Z"
  }
}
```

**Error Response** (404 Not Found):

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Orbital object not found",
    "details": {
      "id": "550e8400-e29b-41d4-a716-446655440999"
    }
  }
}
```

---

### 3. GET `/api/layer-05/position/:id`

Lightweight endpoint for fetching only the current position of an object.

**Method**: `GET`

**Path Parameters**:
- `id` (UUID): Orbital object ID

**Query Parameters**:
- `timestamp` (ISO 8601, optional): Request position for specific time (defaults to now)

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "object_id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "ISS (ZARYA)",
    "norad_catalog_id": 25544,
    "latitude": 45.2231,
    "longitude": -122.6765,
    "altitude_km": 408.5,
    "speed_km_s": 7.66,
    "heading_degrees": 45.2,
    "orbit_class": "LEO",
    "timestamp": "2026-05-31T13:45:30Z",
    "tle_age_hours": 1,
    "server_time_utc": "2026-05-31T13:45:30Z"
  }
}
```

---

### 4. GET `/api/layer-05/positions`

Bulk position fetch for multiple objects.

**Method**: `GET`

**Query Parameters**:
- `ids` (UUID[], required): Comma-separated list of object IDs (max 100)
- `timestamp` (ISO 8601, optional): Request positions for specific time

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "positions": [
      {
        "object_id": "550e8400-e29b-41d4-a716-446655440001",
        "name": "ISS (ZARYA)",
        "latitude": 45.2231,
        "longitude": -122.6765,
        "altitude_km": 408.5,
        "speed_km_s": 7.66,
        "timestamp": "2026-05-31T13:45:30Z"
      },
      {
        "object_id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "STARLINK-1001",
        "latitude": 10.5432,
        "longitude": 25.1234,
        "altitude_km": 550.2,
        "speed_km_s": 7.64,
        "timestamp": "2026-05-31T13:45:30Z"
      }
    ],
    "server_time_utc": "2026-05-31T13:45:30Z"
  }
}
```

---

### 5. GET `/api/layer-05/categories`

Fetch list of available categories and object counts.

**Method**: `GET`

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "name": "STARLINK",
        "count": 4000,
        "icon": "dot_blue"
      },
      {
        "name": "COMMUNICATIONS",
        "count": 300,
        "icon": "dot_purple"
      },
      {
        "name": "NAVIGATION",
        "count": 150,
        "icon": "dot_yellow_green"
      },
      {
        "name": "WEATHER",
        "count": 80,
        "icon": "dot_light_green"
      },
      {
        "name": "EARTH_OBSERVATION",
        "count": 200,
        "icon": "dot_dark_green"
      },
      {
        "name": "SCIENCE",
        "count": 100,
        "icon": "dot_orange"
      },
      {
        "name": "CREWED",
        "count": 5,
        "icon": "dot_bright_accent"
      },
      {
        "name": "DEBRIS",
        "count": 20000,
        "icon": "triangle_red"
      },
      {
        "name": "ROCKET_BODY",
        "count": 2000,
        "icon": "triangle_dark_red"
      },
      {
        "name": "INACTIVE",
        "count": 5000,
        "icon": "dot_gray"
      },
      {
        "name": "UNKNOWN",
        "count": 1000,
        "icon": "dot_dim_purple"
      }
    ],
    "total_objects": 33435,
    "server_time_utc": "2026-05-31T13:45:30Z"
  }
}
```

---

### 6. GET `/api/layer-05/orbit-classes`

Fetch orbit class statistics.

**Method**: `GET`

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "orbit_classes": [
      {
        "class": "VLEO",
        "count": 500,
        "altitude_range_km": "< 400",
        "color": "cyan"
      },
      {
        "class": "LEO",
        "count": 20000,
        "altitude_range_km": "400 - 2000",
        "color": "blue"
      },
      {
        "class": "MEO",
        "count": 5000,
        "altitude_range_km": "2000 - 35786",
        "color": "green"
      },
      {
        "class": "GEO",
        "count": 3000,
        "altitude_range_km": "~35786",
        "color": "red"
      },
      {
        "class": "HEO",
        "count": 2000,
        "altitude_range_km": "> 35786",
        "color": "orange"
      },
      {
        "class": "UNKNOWN",
        "count": 2935,
        "altitude_range_km": "unknown",
        "color": "gray"
      }
    ],
    "total_objects": 33435,
    "server_time_utc": "2026-05-31T13:45:30Z"
  }
}
```

---

## WebSocket Endpoint

### WS `/ws/layer-05/positions`

Real-time position streaming for selected objects.

**Connection URL**: `wss://api.god-eyes.local/ws/layer-05/positions`  
(Use `ws://` for local development)

**Protocol**: JSON over WebSocket

---

#### Subscription Message (Client → Server)

Subscribe to position updates for specific objects.

```json
{
  "action": "subscribe",
  "object_ids": ["550e8400-e29b-41d4-a716-446655440001", "550e8400-e29b-41d4-a716-446655440000"],
  "update_interval_ms": 5000
}
```

**Parameters**:
- `object_ids` (UUID[]): Objects to track
- `update_interval_ms` (number, default 5000): Update frequency in milliseconds

---

#### Position Update Message (Server → Client)

Sent at the requested interval.

```json
{
  "type": "position_update",
  "timestamp": "2026-05-31T13:45:30Z",
  "update_interval_ms": 5000,
  "positions": [
    {
      "object_id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "ISS (ZARYA)",
      "norad_catalog_id": 25544,
      "latitude": 45.2231,
      "longitude": -122.6765,
      "altitude_km": 408.5,
      "speed_km_s": 7.66,
      "heading_degrees": 45.2,
      "orbit_class": "LEO",
      "tle_age_hours": 1
    },
    {
      "object_id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "STARLINK-1001",
      "norad_catalog_id": 44713,
      "latitude": 10.5432,
      "longitude": 25.1234,
      "altitude_km": 550.2,
      "speed_km_s": 7.64,
      "heading_degrees": 123.5,
      "orbit_class": "LEO",
      "tle_age_hours": 2
    }
  ]
}
```

---

#### Unsubscribe Message (Client → Server)

```json
{
  "action": "unsubscribe",
  "object_ids": ["550e8400-e29b-41d4-a716-446655440001"]
}
```

---

#### Heartbeat Message (Server → Client)

Sent every 30 seconds to keep connection alive.

```json
{
  "type": "heartbeat",
  "timestamp": "2026-05-31T13:45:30Z",
  "active_subscriptions": 2
}
```

---

#### Error Message (Server → Client)

```json
{
  "type": "error",
  "code": "INVALID_OBJECT_ID",
  "message": "One or more object IDs not found",
  "details": {
    "invalid_ids": ["550e8400-e29b-41d4-a716-446655440999"]
  }
}
```

---

## Error Handling

### Standard Error Format

All errors return appropriate HTTP status codes with JSON body:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { /* optional context */ }
  }
}
```

### Common Error Codes

| HTTP Status | Code | Meaning |
|---|---|---|
| 400 | INVALID_PARAMETER | Invalid query parameter or request body |
| 400 | INVALID_FILTER | Invalid filter value |
| 400 | INVALID_SORT | Invalid sort field |
| 404 | NOT_FOUND | Resource not found |
| 422 | VALIDATION_ERROR | Request body fails validation |
| 429 | RATE_LIMITED | Too many requests |
| 500 | INTERNAL_ERROR | Server error |
| 503 | SERVICE_UNAVAILABLE | API temporarily unavailable |

---

## Rate Limiting

- **Authenticated**: 1000 requests/minute per API key
- **Unauthenticated**: 100 requests/minute per IP
- **WebSocket**: 1 connection per client, 100 messages/minute

Response headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1719799200
```

---

## Authentication

All endpoints require authentication via GOD EYES auth layer (existing):

**Header**: `Authorization: Bearer {token}`

For local development, a test token is provided. Space-Track credentials are retrieved from environment variables (never exposed in API).

---

## Performance Targets

- `/satellites` list: **< 500 ms** (5000+ objects)
- `/satellites/:id` detail: **< 100 ms**
- `/position/:id` lightweight: **< 50 ms**
- `/positions` bulk (100 objects): **< 200 ms**
- WebSocket update latency: **< 100 ms** from server compute to client

---

## Caching Strategy

- **Browser Cache**: 5-10 second cache on position endpoints
- **Server Cache**: In-memory position cache (5–10 second TTL) to reduce SGP4 recomputation
- **Static Data**: Category/orbit-class lists cached for 1 hour
- **Conditional Requests**: Support `If-Modified-Since` header for updates

---

## Future Enhancements (Post-MVP)

1. **Constellation Links**: `GET /api/layer-05/satellites/:id/neighbors` (Starlink constellation)
2. **Historical Positions**: `GET /api/layer-05/position/:id?timestamp=2026-05-30T12:00:00Z`
3. **Collision Alerts**: `GET /api/layer-05/collisions` (risk threshold)
4. **Statistics**: `GET /api/layer-05/stats` (density heatmaps, distribution charts)
5. **Advanced Search**: Full-text search, geometry-based queries (e.g., objects over a region)

---

**API Status**: ✅ Contract complete  
**Implementation Status**: ⏳ Pending (DeepSeek lane)  
**Review Status**: ⏳ Pending (Claude Haiku 4.5)
