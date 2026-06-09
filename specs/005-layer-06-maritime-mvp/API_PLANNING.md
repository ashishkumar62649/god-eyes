# API Planning: Maritime / Live Ships Layer

## Overview

Plan the API layer for Layer 06 Maritime. API endpoints expose vessel position data and vessel metadata to the frontend via REST (and optionally WebSocket/SSE later).

**Follows the generic layer API pattern from MVP_LAYER_REGISTRY.md:**
```
GET /api/layers
GET /api/layers/:layerId/status
GET /api/layers/:layerId/objects
GET /api/layers/:layerId/objects/:objectId
```

---

## Endpoints

### 1. GET /api/layers/layer_06_maritime/objects

Returns vessel positions (latest known position for each vessel).

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `bbox` | string | none | Bounding box: `minLon,minLat,maxLon,maxLat` |
| `vessel_type` | string | none | Filter by vessel type (cargo, tanker, passenger, etc.) |
| `min_speed` | float | none | Minimum speed over ground (knots) |
| `max_speed` | float | none | Maximum speed over ground (knots) |
| `updated_since` | ISO8601 | none | Only vessels with position updated since this time |
| `mmsi` | int | none | Exact MMSI match |
| `search` | string | none | Search vessel name, MMSI, or callsign (partial match) |
| `limit` | int | 1000 | Max results |
| `offset` | int | 0 | Pagination offset |

**Response:**

```json
{
  "objects": [
    {
      "id": "uuid",
      "mmsi": 123456789,
      "imo": 9876543,
      "callsign": "ABCD",
      "vessel_name": "CARGO SHIP ONE",
      "vessel_type": "cargo",
      "latitude": 37.7749,
      "longitude": -122.4194,
      "speed_over_ground": 12.5,
      "course_over_ground": 180.0,
      "true_heading": 178,
      "navigation_status": "under_way_using_engine",
      "destination": "USLAX",
      "eta": "2026-06-12T08:00:00Z",
      "timestamp_utc": "2026-06-09T12:00:00Z",
      "received_at": "2026-06-09T12:00:01Z",
      "data_age_seconds": 120,
      "data_age_display": "2 minutes ago",
      "source": "aisstream",
      "layer_id": "layer_06_maritime"
    }
  ],
  "metadata": {
    "total": 1250,
    "count": 1250,
    "limit": 1000,
    "offset": 0,
    "layerId": "layer_06_maritime",
    "activeFilters": {},
    "generatedAt": "2026-06-09T12:05:00Z"
  }
}
```

### 2. GET /api/layers/layer_06_maritime/objects/:objectId

Returns detailed vessel information (vessel record + latest position).

**:objectId** is the MMSI value (as string).

**Response:**

```json
{
  "id": "uuid",
  "mmsi": 123456789,
  "imo": 9876543,
  "callsign": "ABCD",
  "vessel_name": "CARGO SHIP ONE",
  "vessel_type": "cargo",
  "vessel_type_code": 70,
  "length_meters": 200,
  "width_meters": 30,
  "draught_meters": 12.5,
  "destination": "USLAX",
  "eta": "2026-06-12T08:00:00Z",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "speed_over_ground": 12.5,
  "course_over_ground": 180.0,
  "true_heading": 178,
  "navigation_status": "under_way_using_engine",
  "position_accuracy": true,
  "timestamp_utc": "2026-06-09T12:00:00Z",
  "received_at": "2026-06-09T12:00:01Z",
  "data_age_seconds": 120,
  "data_age_display": "2 minutes ago",
  "source": "aisstream",
  "layer_id": "layer_06_maritime",
  "last_position_at": "2026-06-09T12:00:00Z",
  "is_active": true
}
```

### 3. GET /api/layers/layer_06_maritime/stats

Returns summary statistics for the maritime layer.

**Response:**

```json
{
  "layer_id": "layer_06_maritime",
  "total_vessels": 1250,
  "active_vessels": 1100,
  "stale_vessels": 150,
  "by_vessel_type": {
    "cargo": 400,
    "tanker": 200,
    "passenger": 50,
    "fishing": 300,
    "other": 300
  },
  "last_updated": "2026-06-09T12:00:00Z",
  "data_freshness_seconds": 300,
  "source": "aisstream",
  "layer_id": "layer_06_maritime",
  "generatedAt": "2026-06-09T12:05:00Z"
}
```

### 4. GET /api/layers/layer_06_maritime/vessels/:mmsi/positions

Returns recent position history for a specific vessel (for path rendering later).

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `hours` | int | 24 | Hours of history to return |
| `limit` | int | 500 | Max positions |

**Response:**

```json
{
  "mmsi": 123456789,
  "vessel_name": "CARGO SHIP ONE",
  "positions": [
    {
      "latitude": 37.7749,
      "longitude": -122.4194,
      "speed_over_ground": 12.5,
      "course_over_ground": 180.0,
      "true_heading": 178,
      "timestamp_utc": "2026-06-09T12:00:00Z"
    }
  ],
  "count": 1,
  "layer_id": "layer_06_maritime"
}
```

### 5. WebSocket / SSE (Future)

**Not in MVP scope.** Planned for live updates:

```
WebSocket: /ws/layers/layer_06_maritime/positions
SSE: GET /api/layers/layer_06_maritime/stream
```

Would stream position updates as vessels move. MVP uses REST polling.

---

## SQL Query Patterns

### Bbox Query

```sql
SELECT v.*, p.latitude, p.longitude, p.speed_over_ground, p.course_over_ground, p.true_heading
FROM maritime_vessels v
JOIN maritime_positions_latest p ON v.source_id = p.source_id AND v.mmsi = p.mmsi
WHERE v.layer_id = 'layer_06_maritime'
  AND v.is_active = true
  AND ST_Within(
    p.geom,
    ST_MakeEnvelope($minLon, $minLat, $maxLon, $maxLat, 4326)
  )
ORDER BY p.timestamp_utc DESC
LIMIT $limit OFFSET $offset;
```

### Vessel Type Filter

```sql
... AND v.vessel_type = $vessel_type
```

### Search by MMSI/Name

```sql
... AND (v.mmsi::text = $search OR v.vessel_name ILIKE '%' || $search || '%' OR v.callsign ILIKE '%' || $search || '%')
```

### Updated Since

```sql
... AND p.timestamp_utc >= $updated_since
```

---

## Layer API Pattern Compliance

Following the generic layer API pattern from MVP_LAYER_REGISTRY.md:

| Pattern | Endpoint | Status |
|---------|----------|--------|
| List layers | GET /api/layers | Already exists |
| Layer status | GET /api/layers/:layerId/status | To implement |
| Layer objects | GET /api/layers/:layerId/objects | To implement |
| Object detail | GET /api/layers/:layerId/objects/:objectId | To implement |

Maritime-specific endpoints (vessels/:mmsi, stats) are extensions of the generic pattern.

---

## Error Responses

```json
{
  "error": "Bad Request",
  "message": "Invalid bbox format. Expected: minLon,minLat,maxLon,maxLat",
  "statusCode": 400
}
```

```json
{
  "error": "Not Found",
  "message": "Vessel with MMSI 123456789 not found",
  "statusCode": 404
}
```

---

## Authentication

MVP: No additional authentication beyond existing GOD EYES API auth layer.

Future: Rate limiting per API key if needed.

---

## Rate Limiting

MVP: No explicit rate limiting on maritime endpoints. REST polling from frontend is bounded by frontend update interval.

Future: Consider rate limiting if API is exposed externally.

---

## Response Performance Targets

| Endpoint | Target |
|----------|--------|
| GET /objects (1000 vessels) | < 500ms |
| GET /objects/:id | < 100ms |
| GET /stats | < 200ms |
| GET /vessels/:mmsi/positions | < 300ms |
