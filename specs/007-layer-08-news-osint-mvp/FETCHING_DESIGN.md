# Fetching Design - Layer 08 News & OSINT

## Source Registry Design

### Source Configuration Schema
```typescript
interface SourceConfig {
  source_id: string;           // e.g., "gdacs", "gdelt", "reliefweb", "rss_un_news"
  source_family: string;       // e.g., "disaster_alert", "news_api", "humanitarian", "rss"
  display_name: string;        // e.g., "Global Disaster Alert and Coordination System"
  endpoint_url: string;        // Base URL or feed URL
  auth_type: 'none' | 'api_key' | 'appname';
  auth_env_var?: string;       // Environment variable for auth
  rate_limit: {
    requests_per_day: number;
    requests_per_minute: number;
  };
  update_frequency_minutes: number;
  raw_storage_path: string;    // e.g., "raw/layer_08/{source_id}/"
  enabled: boolean;
}
```

### Source Registry Store
- Location: `packages/source-catalog/sources/layer_08_news_osint.json`
- Format: JSON array of SourceConfig objects
- Updated by: Planning Worker during source research
- Read by: Fetch orchestrator and normalizers

## Per-Source Fetcher Design

### Common Fetcher Interface
```typescript
interface NewsFetcher {
  source_id: string;
  
  // Core fetch method
  fetchLatest(): Promise<RawNewsItem[]>;
  
  // Health check
  isAvailable(): Promise<boolean>;
  
  // Rate limit compliance
  getRateLimitStatus(): Promise<RateLimitStatus>;
}

interface RawNewsItem {
  source_id: string;
  source_object_id: string;    // Unique ID from source
  raw_data: any;              // Original response data
  fetched_at: string;         // ISO timestamp
  fetch_run_id: string;       // UUID for this fetch run
}
```

### GDACS Fetcher
- **Endpoint**: `https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP`
- **Method**: GET with query parameters
- **Parameters**: 
  - `eventtype`: ALL, EQ, FL, TC, DR, VO, WF
  - `alertlevel`: ALL, GREEN, ORANGE, RED
- **Response**: GeoJSON with coordinates
- **Rate Limit**: No documented limits (be conservative)
- **Storage**: `raw/layer_08/gdacs/` with date partitions

### GDELT DOC 2.0 Fetcher
- **Endpoint**: `https://api.gdeltproject.org/api/v2/doc/doc`
- **Method**: GET with query parameters
- **Parameters**:
  - `query`: Search terms (disaster/humanitarian keywords)
  - `mode`: ArtList (for article metadata)
  - `format`: JSON
  - `maxrecords`: Up to 250
  - `timespan`: 1d, 1w, etc.
- **Response**: JSON with article metadata
- **Rate Limit**: Documented 429 errors, implement backoff
- **Storage**: `raw/layer_08/gdelt/` with date partitions

### ReliefWeb Fetcher
- **Endpoint**: `https://api.reliefweb.int/v2/reports`
- **Method**: GET or POST with query parameters
- **Parameters**:
  - `appname`: Required pre-approved appname
  - `limit`: Up to 1000
  - `offset`: For pagination
  - `filter[field]`: For specific filters
- **Response**: JSON with report metadata
- **Rate Limit**: 1000 calls/day
- **Storage**: `raw/layer_08/reliefweb/` with date partitions

### RSS/Atom Fetcher
- **Endpoint**: Various feed URLs
- **Method**: GET with Accept header for XML
- **Parameters**: None (feed-based)
- **Response**: XML (RSS/Atom)
- **Rate Limit**: Varies by provider
- **Storage**: `raw/layer_08/rss/{feed_id}/` with date partitions

## Raw Storage Design

### Directory Structure
```
raw/layer_08/
├── gdacs/
│   ├── 2026-06-10/
│   │   ├── fetch_run_abc123.json
│   │   └── events_abc123.json
│   └── ...
├── gdelt/
│   ├── 2026-06-10/
│   │   ├── fetch_run_def456.json
│   │   └── articles_def456.json
│   └── ...
├── reliefweb/
│   ├── 2026-06-10/
│   │   ├── fetch_run_ghi789.json
│   │   └── reports_ghi789.json
│   └── ...
└── rss/
    ├── un_news/
    │   ├── 2026-06-10/
    │   │   ├── fetch_run_jkl012.json
    │   │   └── feed_jkl012.xml
    │   └── ...
    └── ...
```

### Raw File Schema
```json
{
  "fetch_run_id": "uuid",
  "source_id": "gdacs",
  "started_at": "ISO timestamp",
  "completed_at": "ISO timestamp",
  "status": "success | partial | failed",
  "item_count": 42,
  "raw_file_path": "raw/layer_08/gdacs/2026-06-10/events_abc123.json",
  "error_message": null
}
```

## Retry & Timeout Policy

### Common Settings
- **Connection Timeout**: 10 seconds
- **Read Timeout**: 30 seconds
- **Max Retries**: 3
- **Backoff Strategy**: Exponential with jitter
- **Initial Delay**: 1 second
- **Max Delay**: 30 seconds

### Source-Specific Overrides
- **GDACS**: No retries (stable API)
- **GDELT**: 5 retries with longer backoff (rate limited)
- **ReliefWeb**: 3 retries (quota limited)
- **RSS**: 2 retries (feed may be down)

## Rate Limit Policy

### GDACS
- **Conservative Limit**: 100 requests/hour
- **No documented limits** but be respectful
- **Implementation**: Token bucket with 1 request/minute

### GDELT
- **Documented**: Rate limited (429 errors observed)
- **Conservative Limit**: 10 requests/minute
- **Implementation**: Sliding window counter
- **Backoff**: Double delay on 429, up to 5 minutes

### ReliefWeb
- **Documented**: 1000 calls/day
- **Implementation**: Daily counter with reset
- **Warning**: Alert at 80% usage (800 calls)

### RSS Feeds
- **Conservative Limit**: 1 request per feed per 15 minutes
- **Implementation**: Per-feed timestamp tracking

## Global Fetch Strategy

### Fetch Schedule
- **GDACS**: Every 15 minutes (disaster alerts need freshness)
- **GDELT**: Every hour (news cycle)
- **ReliefWeb**: Every 4 hours (humanitarian reports are less frequent)
- **RSS Feeds**: Every 2-6 hours (varies by feed)

### Fetch Orchestration
1. **Source Health Check**: Verify API availability before fetch
2. **Rate Limit Check**: Ensure quota available
3. **Raw Data Fetch**: Execute with timeout and retries
4. **Raw Data Store**: Save to dated partition
5. **Normalization Trigger**: Queue for normalizer
6. **Metrics Update**: Record fetch stats

### No City-Only Filtering
- All fetches must be global or regional
- City-level filtering happens in frontend
- Raw data must contain all available location info

## Error Handling

### Fetch Failures
- Log error with source_id and timestamp
- Mark source as unhealthy for 5 minutes
- Continue with other sources
- Alert if source fails 3 consecutive times

### Data Quality Issues
- Log warnings for missing required fields
- Skip items with critical missing data (no title, no source)
- Flag items needing manual review
- Continue processing other items

### Storage Failures
- Retry with exponential backoff
- Alert on persistent storage failures
- Fallback to in-memory queue if storage unavailable

---

## WO-NEWS-F1 Implementation Notes (2026-06-11)

GDACS fetcher implemented and proven. Implementation location follows the Layer 07 pattern:

- `services/fetch-orchestrator/src/layers/layer_08_news_osint/gdacs_client.py`
- `services/fetch-orchestrator/src/layers/layer_08_news_osint/gdacs_fetcher.py`
- `services/fetch-orchestrator/src/layers/layer_08_news_osint/gdacs_raw_storage.py`
- `services/fetch-orchestrator/src/layers/layer_08_news_osint/news_source_types.py`
- `services/fetch-orchestrator/src/layers/layer_08_news_osint/__main__.py`

Raw proof output path: `tmp/layer_08_news_osint/gdacs/YYYY/MM/DD/run_<timestamp>/` (gitignored via `tmp/` entry in `.gitignore`).
