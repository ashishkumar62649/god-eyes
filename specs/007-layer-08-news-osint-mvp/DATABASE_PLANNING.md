# Database Planning - Layer 08 News & OSINT

## Database Schema Design

### Table: news_sources
Stores configuration for each news source.

```sql
CREATE TABLE news_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id VARCHAR(50) UNIQUE NOT NULL,
    source_family VARCHAR(50) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    endpoint_url TEXT NOT NULL,
    auth_type VARCHAR(20) NOT NULL DEFAULT 'none',
    auth_env_var VARCHAR(100),
    rate_limit_requests_per_day INT,
    rate_limit_requests_per_minute INT,
    update_frequency_minutes INT,
    raw_storage_path TEXT,
    enabled BOOLEAN DEFAULT true,
    last_fetched_at TIMESTAMP,
    last_error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for enabled sources
CREATE INDEX idx_news_sources_enabled ON news_sources(enabled);
```

### Table: news_fetch_runs
Tracks each fetch operation for monitoring and debugging.

```sql
CREATE TABLE news_fetch_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id VARCHAR(50) NOT NULL REFERENCES news_sources(source_id),
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'running', -- running, success, partial, failed
    item_count INT DEFAULT 0,
    new_items INT DEFAULT 0,
    updated_items INT DEFAULT 0,
    error_message TEXT,
    raw_file_path TEXT,
    duration_ms INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for monitoring recent runs
CREATE INDEX idx_news_fetch_runs_source_time ON news_fetch_runs(source_id, started_at DESC);
CREATE INDEX idx_news_fetch_runs_status ON news_fetch_runs(status);
```

### Table: news_items_latest
Current/latest version of each news item (deduplicated).

```sql
CREATE TABLE news_items_latest (
    id UUID PRIMARY KEY,
    source_id VARCHAR(50) NOT NULL,
    source_object_id VARCHAR(255) NOT NULL,
    source_url TEXT NOT NULL,
    
    -- Content
    title VARCHAR(500) NOT NULL,
    summary TEXT,
    content_type VARCHAR(20) NOT NULL,
    
    -- Timing
    published_at TIMESTAMP,
    updated_at TIMESTAMP,
    fetched_at TIMESTAMP NOT NULL,
    
    -- Location
    location_confidence VARCHAR(20) NOT NULL,
    country_code CHAR(2),
    country_name VARCHAR(100),
    region VARCHAR(100),
    city VARCHAR(100),
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    geo_source VARCHAR(20),
    
    -- Categorization
    category VARCHAR(20) NOT NULL,
    subcategory VARCHAR(50),
    severity VARCHAR(20) NOT NULL DEFAULT 'unknown',
    
    -- Source metadata
    source_domain VARCHAR(255),
    source_language CHAR(2),
    source_country CHAR(2),
    
    -- Media
    image_url TEXT,
    
    -- Quality
    duplicate_of UUID,
    confidence_score DECIMAL(3, 2),
    
    -- Metadata
    first_seen_at TIMESTAMP NOT NULL,
    last_seen_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint per source
    UNIQUE(source_id, source_object_id)
);

-- Indexes for common queries
CREATE INDEX idx_news_items_latest_published ON news_items_latest(published_at DESC);
CREATE INDEX idx_news_items_latest_category ON news_items_latest(category);
CREATE INDEX idx_news_items_latest_severity ON news_items_latest(severity);
CREATE INDEX idx_news_items_latest_country ON news_items_latest(country_code);
CREATE INDEX idx_news_items_latest_source ON news_items_latest(source_id);
CREATE INDEX idx_news_items_latest_active ON news_items_latest(is_active, published_at DESC);

-- Spatial index for globe queries
CREATE INDEX idx_news_items_latest_coords ON news_items_latest(latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
```

### Table: news_item_history
Complete history of all versions of news items.

```sql
CREATE TABLE news_item_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL, -- References news_items_latest.id
    version INT NOT NULL,
    
    -- Snapshot of item at this version
    title VARCHAR(500) NOT NULL,
    summary TEXT,
    severity VARCHAR(20),
    location_confidence VARCHAR(20),
    country_code CHAR(2),
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    
    -- Change metadata
    changed_fields TEXT[], -- Array of field names that changed
    changed_at TIMESTAMP NOT NULL,
    fetch_run_id UUID REFERENCES news_fetch_runs(id),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for version history
CREATE INDEX idx_news_item_history_item ON news_item_history(item_id, version DESC);
CREATE INDEX idx_news_item_history_time ON news_item_history(changed_at DESC);
```

### Table: news_raw_message_refs
References to raw data files for debugging and reprocessing.

```sql
CREATE TABLE news_raw_message_refs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fetch_run_id UUID NOT NULL REFERENCES news_fetch_runs(id),
    source_id VARCHAR(50) NOT NULL,
    item_source_object_id VARCHAR(255),
    raw_file_path TEXT NOT NULL,
    raw_file_offset BIGINT, -- Byte offset in file for large files
    raw_file_line INT, -- Line number for line-delimited files
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for reprocessing queries
CREATE INDEX idx_news_raw_refs_run ON news_raw_message_refs(fetch_run_id);
CREATE INDEX idx_news_raw_refs_source ON news_raw_message_refs(source_id, item_source_object_id);
```

### Table: news_locations (Optional)
Dedicated location table for complex location scenarios.

```sql
CREATE TABLE news_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES news_items_latest(id),
    
    -- Location hierarchy
    country_code CHAR(2),
    country_name VARCHAR(100),
    region VARCHAR(100),
    city VARCHAR(100),
    
    -- Coordinates
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    
    -- Confidence
    confidence VARCHAR(20) NOT NULL,
    geo_source VARCHAR(20) NOT NULL,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Spatial index
    INDEX idx_news_locations_coords (latitude, longitude)
);

-- For MVP, we'll embed location in news_items_latest
-- This table is for future enhancement if needed
```

## Table Relationships

```
news_sources (1) ──< (many) news_fetch_runs
news_fetch_runs (1) ──< (many) news_raw_message_refs
news_items_latest (1) ──< (many) news_item_history
news_items_latest (1) ──< (0..1) news_items_latest (self-referencing for duplicate_of)
```

## Data Retention Policy

### Current Strategy
- **news_items_latest**: Keep indefinitely (current items only)
- **news_item_history**: Keep 90 days, then archive
- **news_fetch_runs**: Keep 30 days, then archive
- **news_raw_message_refs**: Keep 7 days, then delete

### Future Enhancements
- Move old items to archive tables
- Compress raw files after processing
- Implement tiered storage (hot/warm/cold)

## Query Patterns

### Common Queries

**1. Get latest news by category**
```sql
SELECT * FROM news_items_latest 
WHERE is_active = true 
  AND category = $1
ORDER BY published_at DESC 
LIMIT 20;
```

**2. Get globe markers with coordinates**
```sql
SELECT id, title, category, severity, latitude, longitude, 
       country_code, published_at
FROM news_items_latest 
WHERE is_active = true 
  AND latitude IS NOT NULL 
  AND longitude IS NOT NULL
  AND published_at > NOW() - INTERVAL '24 hours'
ORDER BY published_at DESC;
```

**3. Get news by country**
```sql
SELECT * FROM news_items_latest 
WHERE is_active = true 
  AND country_code = $1
ORDER BY published_at DESC 
LIMIT 50;
```

**4. Get source health status**
```sql
SELECT s.source_id, s.display_name, 
       r.status, r.item_count, r.started_at
FROM news_sources s
LEFT JOIN news_fetch_runs r ON s.source_id = r.source_id
WHERE s.enabled = true
ORDER BY r.started_at DESC;
```

**5. Get fetch run statistics**
```sql
SELECT source_id, 
       COUNT(*) as total_runs,
       SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
       AVG(duration_ms) as avg_duration_ms,
       AVG(item_count) as avg_items
FROM news_fetch_runs
WHERE started_at > NOW() - INTERVAL '24 hours'
GROUP BY source_id;
```

## Performance Considerations

### Indexing Strategy
- Primary indexes on frequently queried columns
- Spatial index for globe coordinate queries
- Partial indexes for active items only
- Composite indexes for common filter combinations

### Partitioning Strategy (Future)
- Partition news_item_history by month
- Partition news_fetch_runs by week
- Consider partitioning news_items_latest by category for large datasets

### Caching Strategy
- Cache source configurations in application memory
- Cache frequently accessed items (last 24 hours)
- Use Redis for session-level caching of list views

## Migration Strategy

### Initial Migration
1. Create all tables with proper indexes
2. Seed news_sources table with initial source configurations
3. Set up partitioning if needed

### Data Migration
- No existing data to migrate (new layer)
- Start fresh with proof data

### Rollback Plan
- Drop tables in reverse order
- Keep backup of source configurations
- Document all changes in migration files