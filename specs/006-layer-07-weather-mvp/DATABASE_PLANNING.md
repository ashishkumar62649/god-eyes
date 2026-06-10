# Database Planning: Layer 07 Weather MVP

## Overview

This document defines the PostGIS database schema for the GOD EYES Weather layer.

---

## Proposed Tables

### 1. weather_sources

Tracks registered weather data sources.

```sql
CREATE TABLE weather_sources (
    source_id       TEXT PRIMARY KEY,          -- e.g., 'open-meteo'
    source_name     TEXT NOT NULL,             -- e.g., 'Open-Meteo'
    source_url      TEXT,                      -- e.g., 'https://open-meteo.com/'
    licence         TEXT,                      -- e.g., 'CC-BY 4.0'
    attribution     TEXT,                      -- Required attribution text
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

INSERT INTO weather_sources (source_id, source_name, source_url, licence, attribution)
VALUES (
    'open-meteo',
    'Open-Meteo',
    'https://open-meteo.com/',
    'CC-BY 4.0',
    'Weather data provided by Open-Meteo (https://open-meteo.com/) under CC-BY 4.0 licence. Based on weather model data from ECMWF, NOAA, DWD, and other national weather services.'
);
```

---

### 2. weather_fetch_runs

Tracks each fetch execution for auditing and debugging.

```sql
CREATE TABLE weather_fetch_runs (
    fetch_run_id    TEXT PRIMARY KEY,          -- e.g., 'run_20260610T120000Z'
    source_id       TEXT NOT NULL REFERENCES weather_sources(source_id),
    layer_id        TEXT NOT NULL DEFAULT 'layer_07_weather',
    grid_resolution TEXT NOT NULL,             -- e.g., '5deg'
    total_cells     INT NOT NULL,
    successful_cells INT NOT NULL DEFAULT 0,
    failed_cells    INT NOT NULL DEFAULT 0,
    fetch_started_at TIMESTAMPTZ NOT NULL,
    fetch_completed_at TIMESTAMPTZ,
    api_calls_made  INT DEFAULT 0,
    raw_storage_path TEXT,                     -- Path to raw response files
    status          TEXT DEFAULT 'running',    -- running, completed, failed
    error_message   TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_weather_fetch_runs_source ON weather_fetch_runs(source_id);
CREATE INDEX idx_weather_fetch_runs_started ON weather_fetch_runs(fetch_started_at DESC);
```

---

### 3. weather_locations

Dimension table for unique grid cell locations.

```sql
CREATE TABLE weather_locations (
    location_id         TEXT PRIMARY KEY,      -- Hash of requested lat/lon
    requested_latitude  DOUBLE PRECISION NOT NULL,
    requested_longitude DOUBLE PRECISION NOT NULL,
    resolved_latitude   DOUBLE PRECISION NOT NULL,
    resolved_longitude  DOUBLE PRECISION NOT NULL,
    elevation_m         DOUBLE PRECISION,
    grid_resolution     TEXT NOT NULL,         -- e.g., '5deg'
    cell_note           TEXT,                  -- e.g., 'Weather values represent grid cell average'
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_weather_locations_coords ON weather_locations(requested_latitude, requested_longitude);
CREATE INDEX idx_weather_locations_resolved ON weather_locations(resolved_latitude, resolved_longitude);

-- Spatial index for bbox queries
CREATE INDEX idx_weather_locations_geom ON weather_locations
    USING GIST (ST_Point(resolved_longitude, resolved_latitude));
```

**location_id generation:**
```python
import hashlib
location_id = hashlib.sha256(f"{requested_lat}:{requested_lon}".encode()).hexdigest()[:16]
```

---

### 4. weather_observations_latest

Latest weather observation per location (upserted on each fetch).

```sql
CREATE TABLE weather_observations_latest (
    observation_id              TEXT PRIMARY KEY,
    layer_id                    TEXT NOT NULL DEFAULT 'layer_07_weather',
    source_id                   TEXT NOT NULL REFERENCES weather_sources(source_id),
    location_id                 TEXT NOT NULL REFERENCES weather_locations(location_id),
    
    -- Weather data
    temperature_c               DOUBLE PRECISION NOT NULL,
    apparent_temperature_c      DOUBLE PRECISION,
    wind_speed_kph              DOUBLE PRECISION,
    wind_direction_deg          DOUBLE PRECISION,
    wind_gust_kph               DOUBLE PRECISION,
    humidity_percent            INT,
    pressure_hpa                DOUBLE PRECISION,
    precipitation_mm            DOUBLE PRECISION,
    precipitation_probability_percent INT,
    cloud_cover_percent         INT,
    weather_code                INT,
    weather_label               TEXT,
    
    -- Timestamps
    forecast_for                TIMESTAMPTZ NOT NULL,
    fetched_at                  TIMESTAMPTZ NOT NULL,
    is_stale                    BOOLEAN DEFAULT false,
    
    -- Metadata
    provider_metadata           JSONB,
    raw_evidence_uri            TEXT,
    
    created_at                  TIMESTAMPTZ DEFAULT now(),
    updated_at                  TIMESTAMPTZ DEFAULT now()
);

-- Unique constraint: one latest observation per location per source
CREATE UNIQUE UNIQUE idx_weather_latest_location_source
    ON weather_observations_latest(location_id, source_id);

-- Indexes for common queries
CREATE INDEX idx_weather_latest_forecast ON weather_observations_latest(forecast_for DESC);
CREATE INDEX idx_weather_latest_fetched ON weather_observations_latest(fetched_at DESC);
CREATE INDEX idx_weather_latest_stale ON weather_observations_latest(is_stale) WHERE is_stale = false;
CREATE INDEX idx_weather_latest_temp ON weather_observations_latest(temperature_c);
CREATE INDEX idx_weather_latest_weather ON weather_observations_latest(weather_code);

-- Spatial index for bbox queries
CREATE INDEX idx_weather_latest_geom ON weather_observations_latest
    USING GIST (ST_Point(
        (SELECT resolved_longitude FROM weather_locations WHERE location_id = weather_observations_latest.location_id),
        (SELECT resolved_latitude FROM weather_locations WHERE location_id = weather_observations_latest.location_id)
    ));
```

---

### 5. weather_observation_history

Historical weather observations (append-only, for trend analysis).

```sql
CREATE TABLE weather_observation_history (
    observation_id              TEXT PRIMARY KEY,
    layer_id                    TEXT NOT NULL DEFAULT 'layer_07_weather',
    source_id                   TEXT NOT NULL REFERENCES weather_sources(source_id),
    location_id                 TEXT NOT NULL REFERENCES weather_locations(location_id),
    
    -- Weather data (same as latest)
    temperature_c               DOUBLE PRECISION NOT NULL,
    apparent_temperature_c      DOUBLE PRECISION,
    wind_speed_kph              DOUBLE PRECISION,
    wind_direction_deg          DOUBLE PRECISION,
    wind_gust_kph               DOUBLE PRECISION,
    humidity_percent            INT,
    pressure_hpa                DOUBLE PRECISION,
    precipitation_mm            DOUBLE PRECISION,
    precipitation_probability_percent INT,
    cloud_cover_percent         INT,
    weather_code                INT,
    weather_label               TEXT,
    
    -- Timestamps
    forecast_for                TIMESTAMPTZ NOT NULL,
    fetched_at                  TIMESTAMPTZ NOT NULL,
    
    -- Metadata
    provider_metadata           JSONB,
    raw_evidence_uri            TEXT,
    
    created_at                  TIMESTAMPTZ DEFAULT now()
);

-- Indexes for history queries
CREATE INDEX idx_weather_history_location ON weather_observation_history(location_id);
CREATE INDEX idx_weather_history_forecast ON weather_observation_history(forecast_for DESC);
CREATE INDEX idx_weather_history_fetched ON weather_observation_history(fetched_at DESC);

-- Spatial index for bbox queries on history
CREATE INDEX idx_weather_history_geom ON weather_observation_history
    USING GIST (ST_Point(
        (SELECT resolved_longitude FROM weather_locations WHERE location_id = weather_observation_history.location_id),
        (SELECT resolved_latitude FROM weather_locations WHERE location_id = weather_observation_history.location_id)
    ));
```

---

### 6. weather_raw_message_refs

References to raw API response files (NOT raw data blobs).

```sql
CREATE TABLE weather_raw_message_refs (
    raw_ref_id      TEXT PRIMARY KEY,
    fetch_run_id    TEXT NOT NULL REFERENCES weather_fetch_runs(fetch_run_id),
    source_id       TEXT NOT NULL REFERENCES weather_sources(source_id),
    batch_number    INT NOT NULL,
    file_path       TEXT NOT NULL,             -- Relative path to raw file
    file_size_bytes BIGINT,
    cell_count      INT,                       -- Number of cells in this batch
    checksum        TEXT,                      -- SHA-256 of file
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_weather_raw_refs_run ON weather_raw_message_refs(fetch_run_id);
```

---

## Unique Keys

| Table | Unique Key | Purpose |
|-------|------------|---------|
| weather_sources | `source_id` | One record per source |
| weather_fetch_runs | `fetch_run_id` | One record per fetch run |
| weather_locations | `location_id` | One record per unique location |
| weather_observations_latest | `(location_id, source_id)` | One latest observation per location per source |
| weather_observation_history | `observation_id` | One record per historical observation |
| weather_raw_message_refs | `raw_ref_id` | One record per raw file reference |

---

## Dedupe Strategy

### Latest Table
- **UPSERT** on `(location_id, source_id)`
- If observation exists for location+source → update all fields
- If new location+source → insert
- Uses `ON CONFLICT (location_id, source_id) DO UPDATE`

### History Table
- **INSERT only** — no updates
- Each fetch creates new history records
- Dedupe by `(location_id, source_id, forecast_for)` if needed
- Optional: partition by month for performance

### Location Table
- **UPSERT** on `location_id`
- If location exists → update `updated_at` only
- If new location → insert

---

## Indexes Summary

### weather_observations_latest
- Primary key: `observation_id`
- Unique: `(location_id, source_id)`
- Forecast time: `forecast_for DESC`
- Fetch time: `fetched_at DESC`
- Stale flag: `is_stale` (partial index WHERE is_stale = false)
- Temperature: `temperature_c`
- Weather code: `weather_code`
- Spatial: GIST on resolved lat/lon

### weather_observation_history
- Primary key: `observation_id`
- Location: `location_id`
- Forecast time: `forecast_for DESC`
- Fetch time: `fetched_at DESC`
- Spatial: GIST on resolved lat/lon

### weather_locations
- Primary key: `location_id`
- Requested coords: `(requested_latitude, requested_longitude)`
- Resolved coords: `(resolved_latitude, resolved_longitude)`
- Spatial: GIST on resolved lat/lon

---

## Spatial / Geography Strategy

### PostGIS Geometry
- Use `geometry(Point, 4326)` for spatial queries
- Store as `ST_Point(longitude, latitude)` — note longitude first
- Use GIST index for efficient bbox queries

### Bbox Query Pattern
```sql
SELECT o.*, l.resolved_latitude, l.resolved_longitude
FROM weather_observations_latest o
JOIN weather_locations l ON o.location_id = l.location_id
WHERE o.is_stale = false
  AND ST_Within(
      ST_Point(l.resolved_longitude, l.resolved_latitude),
      ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)
  )
ORDER BY o.fetched_at DESC;
```

### Future: PostGIS Geography
- For distance calculations, consider `geography(Point, 4326)`
- MVP uses geometry (sufficient for bbox queries)

---

## Latest vs History Logic

### Latest Table Purpose
- Fast reads for frontend rendering
- One row per location per source
- UPSERT on each fetch run
- Always contains the most recent observation

### History Table Purpose
- Trend analysis and time-series queries
- Append-only (no updates)
- Each fetch adds new rows
- Can be partitioned by month for performance

### Data Flow
```
Fetch Run → Normalize → UPSERT into latest → INSERT into history
```

### Query Patterns
- **Frontend globe**: Query latest table (fast, one row per location)
- **Detail card**: Query latest by location_id
- **Time series**: Query history by location_id + time range
- **Staleness check**: Query latest where fetched_at < threshold

---

## Stale Data Rule

### Staleness Definition
An observation is stale if `fetched_at` is older than the stale threshold:

| Data Type | Stale Threshold | Rationale |
|-----------|-----------------|-----------|
| Current weather | 1 hour | Model updates hourly |
| Hourly forecast | 3 hours | Model updates every 3-6 hours |
| Daily forecast | 6 hours | Model updates every 6-12 hours |

### Staleness Check (computed, not stored)
```sql
-- Mark stale observations
UPDATE weather_observations_latest
SET is_stale = (fetched_at < NOW() - INTERVAL '1 hour')
WHERE source_id = 'open-meteo';
```

### Stale Display
- Stale markers shown with reduced opacity on globe
- Detail card shows "Data may be outdated" warning
- Stats endpoint returns stale count

---

## Raw References, Not Raw Blobs

### Rule
- Raw API response files stored on filesystem (`raw/` directory)
- Database stores ONLY references (file path, checksum, size)
- Never store raw JSON blobs in PostgreSQL

### Benefits
- Database stays small and fast
- Raw data preserved for auditing/debugging
- Raw data can be re-processed independently
- Filesystem handles large files efficiently

### Reference Fields
- `raw_evidence_uri` in observation tables → relative file path
- `file_path` in raw_message_refs → relative file path
- `checksum` → SHA-256 for integrity verification

---

## Migration Strategy

### Phase 1: MVP Schema
1. Create `weather_sources` table
2. Create `weather_fetch_runs` table
3. Create `weather_locations` table
4. Create `weather_observations_latest` table
5. Create `weather_observation_history` table
6. Create `weather_raw_message_refs` table
7. Insert default Open-Meteo source record

### Phase 2: Future Enhancements
- Add materialized views for common queries
- Add partitioning for history table
- Add additional indexes based on query patterns
- Add full-text search on weather labels

---

## Connection to Other Layers

- `layer_id` = 'layer_07_weather' in all tables (layer-aware per AGENTS.md)
- `source_id` = 'open-meteo' (source-aware per AGENTS.md)
- Follows same patterns as maritime layer (latest + history + raw refs)
- Compatible with existing API route patterns (`GET /api/layers/:layerId/objects`)
