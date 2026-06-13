# API Planning - Layer 08 News & OSINT

## API Design Principles

1. **RESTful Design**: Standard HTTP methods and status codes
2. **Layer-Aware**: All endpoints scoped to layer_08_news_osint
3. **Filter-First**: Support rich filtering without over-fetching
4. **Pagination**: Consistent cursor-based pagination
5. **Rate Limiting**: Respect source limits and protect backend
6. **Caching**: Appropriate cache headers for different data freshness

## Base URL Structure

```
/api/v1/layer-08-news-osint/
```

## Endpoints

### 1. Get Latest News Items
**GET** `/api/v1/layer-08-news-osint/items`

**Purpose**: Fetch latest news items with filtering and pagination

**Query Parameters**:
- `category` (string): Filter by category (disaster, health, security, etc.)
- `severity` (string): Filter by severity (critical, high, medium, low)
- `source_id` (string): Filter by source (gdacs, gdelt, reliefweb, etc.)
- `country_code` (string): Filter by country (ISO 3166-1 alpha-2)
- `has_coordinates` (boolean): Only items with coordinates
- `published_after` (ISO timestamp): Items published after this time
- `published_before` (ISO timestamp): Items published before this time
- `search` (string): Full-text search in title and summary
- `limit` (integer, default 20, max 100): Number of items to return
- `cursor` (string): Pagination cursor from previous response
- `sort` (string, default "published_at"): Sort field (published_at, severity, category)
- `order` (string, default "desc"): Sort order (asc, desc)

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "source_id": "gdacs",
      "source_url": "https://...",
      "title": "Earthquake in Japan",
      "summary": "Magnitude 6.2 earthquake...",
      "content_type": "event",
      "published_at": "2026-06-10T12:00:00Z",
      "location": {
        "confidence": "exact_coordinate",
        "country_code": "JP",
        "country_name": "Japan",
        "latitude": 36.2048,
        "longitude": 138.2529
      },
      "category": "disaster",
      "subcategory": "earthquake",
      "severity": "high",
      "source_domain": "gdacs.org",
      "image_url": "https://...",
      "confidence_score": 0.85
    }
  ],
  "pagination": {
    "next_cursor": "abc123...",
    "has_more": true,
    "total_count": 1234
  },
  "meta": {
    "generated_at": "2026-06-10T12:05:00Z",
    "filters_applied": {
      "category": "disaster",
      "severity": "high"
    }
  }
}
```

### 2. Get Single News Item
**GET** `/api/v1/layer-08-news-osint/items/:id`

**Purpose**: Get full details of a specific news item

**Response**:
```json
{
  "data": {
    "id": "uuid",
    "source_id": "gdacs",
    "source_object_id": "12345",
    "source_url": "https://...",
    "title": "Earthquake in Japan",
    "summary": "Magnitude 6.2 earthquake...",
    "content_type": "event",
    "published_at": "2026-06-10T12:00:00Z",
    "updated_at": "2026-06-10T12:30:00Z",
    "fetched_at": "2026-06-10T12:05:00Z",
    "location": {
      "confidence": "exact_coordinate",
      "country_code": "JP",
      "country_name": "Japan",
      "region": "Asia",
      "latitude": 36.2048,
      "longitude": 138.2529,
      "geo_source": "provided"
    },
    "category": "disaster",
    "subcategory": "earthquake",
    "severity": "high",
    "source_domain": "gdacs.org",
    "source_language": "en",
    "source_country": "US",
    "image_url": "https://...",
    "confidence_score": 0.85,
    "first_seen_at": "2026-06-10T12:00:00Z",
    "last_seen_at": "2026-06-10T12:30:00Z"
  }
}
```

### 3. Get Map Markers
**GET** `/api/v1/layer-08-news-osint/markers`

**Purpose**: Optimized endpoint for globe markers (coordinates + minimal data)

**Query Parameters**:
- `bounds` (string): Bounding box "south,west,north,east"
- `category` (string): Filter by category
- `severity` (string): Filter by severity
- `time_range` (string): Time range (1h, 6h, 24h, 7d, 30d)
- `cluster` (boolean, default true): Enable clustering
- `cluster_distance` (integer, default 50): Cluster distance in pixels

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Earthquake in Japan",
      "category": "disaster",
      "subcategory": "earthquake",
      "severity": "high",
      "latitude": 36.2048,
      "longitude": 138.2529,
      "country_code": "JP",
      "published_at": "2026-06-10T12:00:00Z",
      "cluster_count": 1
    }
  ],
  "meta": {
    "total_markers": 456,
    "clustered_count": 123,
    "bounds": "35.0,137.0,37.0,139.0"
  }
}
```

### 4. Get News Sources
**GET** `/api/v1/layer-08-news-osint/sources`

**Purpose**: List available news sources and their status

**Response**:
```json
{
  "data": [
    {
      "source_id": "gdacs",
      "display_name": "Global Disaster Alert and Coordination System",
      "source_family": "disaster_alert",
      "enabled": true,
      "last_fetched_at": "2026-06-10T12:00:00Z",
      "last_fetch_status": "success",
      "item_count": 1234,
      "update_frequency_minutes": 15
    }
  ]
}
```

### 5. Get Fetch Runs
**GET** `/api/v1/layer-08-news-osint/fetch-runs`

**Purpose**: Monitor fetch operations for debugging

**Query Parameters**:
- `source_id` (string): Filter by source
- `status` (string): Filter by status (success, failed, running)
- `limit` (integer, default 10): Number of runs to return

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "source_id": "gdacs",
      "started_at": "2026-06-10T12:00:00Z",
      "completed_at": "2026-06-10T12:00:05Z",
      "status": "success",
      "item_count": 42,
      "new_items": 3,
      "updated_items": 2,
      "duration_ms": 5000
    }
  ]
}
```

### 6. Get Statistics
**GET** `/api/v1/layer-08-news-osint/stats`

**Purpose**: Get aggregate statistics for monitoring

**Response**:
```json
{
  "data": {
    "total_items": 12345,
    "active_items": 1234,
    "items_by_category": {
      "disaster": 456,
      "health": 123,
      "security": 789
    },
    "items_by_severity": {
      "critical": 12,
      "high": 45,
      "medium": 123,
      "low": 456
    },
    "items_by_source": {
      "gdacs": 234,
      "gdelt": 567,
      "reliefweb": 123,
      "rss_un_news": 45
    },
    "last_updated_at": "2026-06-10T12:05:00Z"
  }
}
```

## Authentication & Authorization

### Current (MVP)
- **No authentication required** for read-only endpoints
- Public API for public data

### Future Considerations
- API key authentication for write operations
- Rate limiting by API key
- Admin endpoints for source management

## Rate Limiting

### Global Limits
- **100 requests per minute** per IP
- **1000 requests per hour** per IP
- **10000 requests per day** per IP

### Endpoint-Specific Limits
- **/markers**: 30 requests per minute (heavy query)
- **/items**: 60 requests per minute
- **/stats**: 10 requests per minute (cached)

### Rate Limit Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1623345600
```

## Caching Strategy

### Cache Headers
- **/items**: `Cache-Control: public, max-age=300` (5 minutes)
- **/markers**: `Cache-Control: public, max-age=60` (1 minute)
- **/sources**: `Cache-Control: public, max-age=3600` (1 hour)
- **/stats**: `Cache-Control: public, max-age=300` (5 minutes)

### Conditional Requests
- Support `If-Modified-Since` and `ETag` headers
- Return 304 Not Modified when appropriate

## Error Handling

### Error Response Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid category parameter",
    "details": {
      "field": "category",
      "value": "invalid_category",
      "allowed_values": ["disaster", "health", "security", "humanitarian", "infrastructure", "environment", "other"]
    }
  }
}
```

### HTTP Status Codes
- **200**: Success
- **304**: Not Modified (caching)
- **400**: Bad Request (invalid parameters)
- **404**: Not Found (item doesn't exist)
- **429**: Too Many Requests (rate limit)
- **500**: Internal Server Error

### Error Codes
- `VALIDATION_ERROR`: Invalid request parameters
- `NOT_FOUND`: Resource not found
- `RATE_LIMITED`: Rate limit exceeded
- `SOURCE_UNAVAILABLE`: News source temporarily unavailable
- `INTERNAL_ERROR`: Server error

## Pagination

### Cursor-Based Pagination
```json
{
  "data": [...],
  "pagination": {
    "next_cursor": "abc123...",
    "has_more": true,
    "total_count": 1234
  }
}
```

### Usage
- First request: No cursor parameter
- Subsequent requests: Use `next_cursor` from response
- End of results: `has_more: false`

## Versioning

### Current Version
- **v1**: Initial version
- Backward compatible changes only

### Versioning Strategy
- **Breaking changes**: New version (v2)
- **Additive changes**: v1 with documentation
- **Deprecation**: 6-month notice with headers

## OpenAPI Specification

### Location
`/api/v1/layer-08-news-osint/openapi.json`

### Generation
- Auto-generated from code annotations
- Updated with each deployment
- Published to API documentation portal

---

## Implementation Notes (WO-NEWS-A1)

### API routes implemented in `apps/api/src/routes/news.ts`

All routes use the project's existing Fastify pattern with parameterized SQL, Zod response validation, and the `{ data, meta }` response shape.

### Actual implemented endpoints (following existing `apps/api` conventions):

| Endpoint | File | Purpose |
|---|---|---|
| `GET /api/layers/layer_08_news_osint/news/items` | `apps/api/src/routes/news.ts` | List news items with filters |
| `GET /api/layers/layer_08_news_osint/news/markers` | `apps/api/src/routes/news.ts` | Globe marker-ready Point items |
| `GET /api/layers/layer_08_news_osint/news/sources` | `apps/api/src/routes/news.ts` | Layer 08 news sources |
| `GET /api/layers/layer_08_news_osint/news/fetch-runs` | `apps/api/src/routes/news.ts` | Fetch/ingestion run history |
| `GET /api/layers/layer_08_news_osint/news/stats` | `apps/api/src/routes/news.ts` | Aggregate statistics |

### Items endpoint query params

`source_id`, `category`, `subcategory`, `severity`, `country_code`, `marker_ready`, `has_coordinates`, `geometry_type`, `published_after`, `published_before`, `search` (ILIKE title/summary), `limit` (default 50, max 100), `offset` (max 10000), `order` (desc/asc)

### Markers endpoint query params

`source_id`, `category`, `subcategory`, `severity`, `country_code`, `published_after`, `published_before`, `limit` (default 500, max 500)

Always enforces `marker_ready = TRUE` and `geom IS NOT NULL`.

### Sources endpoint

Returns `source_id`, `layer_id`, `source_family`, `display_name`, `endpoint_url`, `auth_type`, `attribution`, `license`, `enabled`, `last_fetched_at`, `last_error`, `update_frequency_minutes`.
Does NOT expose `auth_env_var`.

### Fetch-runs endpoint query params

`source_id`, `status`, `limit`, `offset`. Does NOT expose `raw_output_uri` or `normalized_output_uri`.

### Stats endpoint

Returns `total_items`, `marker_ready_items`, `items_with_geom`, `by_source`, `by_category`, `by_subcategory`, `by_severity`, `by_geometry_type`, `latest_fetch_run`, `fake_coordinate_risk_count`.

### Data sources

- Items: `news_items_latest` table
- Sources: `news_sources` table
- Fetch runs: `news_fetch_runs` table
- Stats: all tables with aggregate queries

### Safety

- No raw provider metadata or raw evidence content exposed
- No auth/env secrets exposed
- No fake coordinates exposed
- LineString/Polygon rows excluded from markers endpoint
- Frontend, scheduler, and additional source work not implemented