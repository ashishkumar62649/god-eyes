# Database Planning: Maritime / Live Ships Layer

## Overview

Plan the database schema for Layer 06 Maritime. This document defines table structures, indexing strategy, and upsert logic.

**Do not write migrations yet.** Database schema will be finalized after real fetch proof confirms actual AISStream fields.

---

## Tables

### 1. `maritime_sources`

Tracks configured AIS data sources.

```sql
CREATE TABLE maritime_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layer_id VARCHAR(64) NOT NULL DEFAULT 'layer_06_maritime',
    source_id VARCHAR(64) NOT NULL UNIQUE,       -- 'aisstream'
    source_type VARCHAR(32) NOT NULL,             -- 'websocket', 'api', 'download'
    display_name VARCHAR(256) NOT NULL,
    base_url TEXT,
    coverage VARCHAR(32),                         -- 'global', 'regional'
    is_active BOOLEAN DEFAULT TRUE,
    config_json JSONB,                            -- non-secret config
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_maritime_sources_layer ON maritime_sources(layer_id);
CREATE UNIQUE INDEX idx_maritime_sources_source_id ON maritime_sources(source_id);
```

### 2. `maritime_fetch_runs`

Records each fetcher run (proof, capture, continuous).

```sql
CREATE TABLE maritime_fetch_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layer_id VARCHAR(64) NOT NULL DEFAULT 'layer_06_maritime',
    source_id VARCHAR(64) NOT NULL,
    run_id VARCHAR(128) NOT NULL,                 -- 'run_20260609T120000Z'
    run_mode VARCHAR(32) NOT NULL,                -- 'proof', 'raw_capture', 'continuous'
    started_at TIMESTAMP NOT NULL,
    ended_at TIMESTAMP,
    duration_seconds FLOAT,
    total_messages INT DEFAULT 0,
    position_messages INT DEFAULT 0,
    static_messages INT DEFAULT 0,
    other_messages INT DEFAULT 0,
    unique_mmsi_count INT DEFAULT 0,
    reconnect_count INT DEFAULT 0,
    errors_json JSONB,
    messages_per_second FLOAT,
    raw_path TEXT,                                -- path to raw storage
    status VARCHAR(32) DEFAULT 'running',         -- 'running', 'completed', 'failed'
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_maritime_fetch_runs_source ON maritime_fetch_runs(source_id);
CREATE INDEX idx_maritime_fetch_runs_started ON maritime_fetch_runs(started_at);
```

### 3. `maritime_raw_messages`

Stores raw AIS messages (for audit trail). Partitioned by date for manageability.

```sql
CREATE TABLE maritime_raw_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layer_id VARCHAR(64) NOT NULL DEFAULT 'layer_06_maritime',
    source_id VARCHAR(64) NOT NULL,
    fetch_run_id UUID REFERENCES maritime_fetch_runs(id),
    mmsi BIGINT,                                  -- extracted for query convenience
    message_type VARCHAR(64) NOT NULL,            -- 'PositionReport', 'ShipStaticData', etc.
    raw_json JSONB NOT NULL,                      -- complete raw message
    received_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_maritime_raw_messages_mmsi ON maritime_raw_messages(mmsi);
CREATE INDEX idx_maritime_raw_messages_type ON maritime_raw_messages(message_type);
CREATE INDEX idx_maritime_raw_messages_received ON maritime_raw_messages(received_at);
CREATE INDEX idx_maritime_raw_messages_run ON maritime_raw_messages(fetch_run_id);
```

### 4. `maritime_vessels`

Master vessel record (latest known state per MMSI).

```sql
CREATE TABLE maritime_vessels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layer_id VARCHAR(64) NOT NULL DEFAULT 'layer_06_maritime',
    source_id VARCHAR(64) NOT NULL,
    mmsi BIGINT NOT NULL,
    imo BIGINT,
    callsign VARCHAR(16),
    vessel_name VARCHAR(128),
    vessel_type VARCHAR(64),
    vessel_type_code INT,
    length_meters FLOAT,
    width_meters FLOAT,
    draught_meters FLOAT,
    destination VARCHAR(128),
    eta TIMESTAMP,
    last_position_at TIMESTAMP,                  -- last received position timestamp
    last_received_at TIMESTAMP,                  -- last time we received any message
    is_active BOOLEAN DEFAULT TRUE,              -- has recent position data
    raw_evidence_uri TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT unique_vessel_per_source UNIQUE (source_id, mmsi)
);

CREATE INDEX idx_maritime_vessels_mmsi ON maritime_vessels(mmsi);
CREATE INDEX idx_maritime_vessels_type ON maritime_vessels(vessel_type);
CREATE INDEX idx_maritime_vessels_active ON maritime_vessels(is_active);
CREATE INDEX idx_maritime_vessels_last_position ON maritime_vessels(last_position_at);
```

### 5. `maritime_positions_latest`

Latest known position per vessel (upserted on each position report).

```sql
CREATE TABLE maritime_positions_latest (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layer_id VARCHAR(64) NOT NULL DEFAULT 'layer_06_maritime',
    source_id VARCHAR(64) NOT NULL,
    mmsi BIGINT NOT NULL,
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    speed_over_ground FLOAT,                      -- knots
    course_over_ground FLOAT,                     -- degrees
    true_heading INT,                             -- degrees (0-359)
    navigation_status INT,
    navigation_status_text VARCHAR(64),
    position_accuracy BOOLEAN,
    timestamp_utc TIMESTAMP NOT NULL,             -- AIS transmission time
    received_at TIMESTAMP NOT NULL,               -- when we received it
    raw_evidence_uri TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT unique_latest_position_per_vessel UNIQUE (source_id, mmsi)
);

CREATE INDEX idx_maritime_latest_mmsi ON maritime_positions_latest(mmsi);
CREATE INDEX idx_maritime_latest_bbox ON maritime_positions_latest USING gist (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
);
CREATE INDEX idx_maritime_latest_type ON maritime_positions_latest(layer_id);
```

### 6. `maritime_position_history`

Historical position records (append-only, for trail/path rendering later).

```sql
CREATE TABLE maritime_position_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layer_id VARCHAR(64) NOT NULL DEFAULT 'layer_06_maritime',
    source_id VARCHAR(64) NOT NULL,
    mmsi BIGINT NOT NULL,
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    speed_over_ground FLOAT,
    course_over_ground FLOAT,
    true_heading INT,
    navigation_status INT,
    timestamp_utc TIMESTAMP NOT NULL,
    received_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_maritime_history_mmsi ON maritime_position_history(mmsi);
CREATE INDEX idx_maritime_history_time ON maritime_position_history(timestamp_utc);
CREATE INDEX idx_maritime_history_bbox ON maritime_position_history USING gist (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
);
```

### 7. `maritime_vessel_static_data` (Optional)

Stores latest static vessel data separately for clarity.

```sql
CREATE TABLE maritime_vessel_static_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layer_id VARCHAR(64) NOT NULL DEFAULT 'layer_06_maritime',
    source_id VARCHAR(64) NOT NULL,
    mmsi BIGINT NOT NULL,
    imo BIGINT,
    callsign VARCHAR(16),
    vessel_name VARCHAR(128),
    vessel_type VARCHAR(64),
    vessel_type_code INT,
    length_meters FLOAT,
    width_meters FLOAT,
    draught_meters FLOAT,
    destination VARCHAR(128),
    eta TIMESTAMP,
    timestamp_utc TIMESTAMP,
    received_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT unique_static_per_vessel UNIQUE (source_id, mmsi)
);

CREATE INDEX idx_maritime_static_mmsi ON maritime_vessel_static_data(mmsi);
```

---

## PostGIS Geometry

The `maritime_positions_latest` and `maritime_position_history` tables use PostGIS geometry points for spatial queries.

```sql
-- Add geometry column (if not done in table definition)
ALTER TABLE maritime_positions_latest
    ADD COLUMN geom GEOMETRY(POINT, 4326);

-- Update geometry from lat/lon
UPDATE maritime_positions_latest
    SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326);

-- Spatial index
CREATE INDEX idx_maritime_latest_geom ON maritime_positions_latest USING gist (geom);
```

---

## MMSI Uniqueness

- MMSI is unique per vessel globally
- Within a single source, MMSI is the primary deduplication key
- Composite unique constraint: `(source_id, mmsi)`
- Future multi-source support: same MMSI from different sources → separate rows

---

## Latest Position Upsert Strategy

On each new PositionReport:

```sql
-- Upsert latest position
INSERT INTO maritime_positions_latest (mmsi, source_id, latitude, longitude, speed_over_ground, course_over_ground, true_heading, navigation_status, timestamp_utc, received_at, raw_evidence_uri, layer_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'layer_06_maritime')
ON CONFLICT (source_id, mmsi)
DO UPDATE SET
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    speed_over_ground = EXCLUDED.speed_over_ground,
    course_over_ground = EXCLUDED.course_over_ground,
    true_heading = EXCLUDED.true_heading,
    navigation_status = EXCLUDED.navigation_status,
    navigation_status_text = EXCLUDED.navigation_status_text,
    position_accuracy = EXCLUDED.position_accuracy,
    timestamp_utc = EXCLUDED.timestamp_utc,
    received_at = EXCLUDED.received_at,
    raw_evidence_uri = EXCLUDED.raw_evidence_uri,
    updated_at = NOW();

-- Also update vessel record
UPDATE maritime_vessels
SET last_position_at = $1, last_received_at = $2, updated_at = NOW()
WHERE source_id = $3 AND mmsi = $4;
```

---

## Position History Retention

**MVP**: Keep all position history. No automatic deletion.

**Future consideration**:
- Retain positions for 30 days (configurable)
- Partition by month for efficient cleanup
- Archive older data to cold storage

---

## Indexing Strategy

| Query Pattern | Index |
|---------------|-------|
| Bbox spatial query | GiST on `geom` (lat/lon point) |
| Filter by vessel type | B-tree on `vessel_type` |
| Search by MMSI | B-tree on `mmsi` |
| Search by vessel name | GIN on `vessel_name` (trigram, future) |
| Recent positions | B-tree on `timestamp_utc` / `received_at` |
| Active vessels | B-tree on `is_active` |
| Layer/source filter | B-tree on `layer_id`, `source_id` |

---

## Handling Partial Data

### PositionReport without ShipStaticData

- Vessel gets a position marker with MMSI as display name
- `vessel_name`, `vessel_type` are NULL
- When ShipStaticData arrives, vessel record is updated

### ShipStaticData without PositionReport

- Vessel record is created/updated with static info
- No position marker until a PositionReport is received
- `last_position_at` remains NULL

### Missing fields in either message

- NULL values are allowed for optional fields
- API and frontend must handle NULL gracefully

---

## Raw Evidence Reference

Every position and vessel record includes `raw_evidence_uri` pointing to the raw JSONL file where the data originated.

Format:
```
raw/layer_06_maritime/aisstream/2026/06/09/run_20260609T120000Z/raw_messages.jsonl
```

---

## Database Design Timing

This schema is planned based on expected AISStream fields. The final schema will be confirmed after:

1. Fetch proof (WO-MAR-S) validates actual message structure
2. Normalization proof confirms field availability
3. Any discrepancies between planned and actual fields are resolved

**Migrations will be created in WO-MAR-D after schema confirmation.**
