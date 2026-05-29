-- WO-080A: Live Aircraft Snapshot Publisher
-- Table: aviation_aircraft_live_snapshots
-- Purpose: Store compact latest live aircraft snapshots for WebSocket/API consumption

CREATE TABLE IF NOT EXISTS aviation_aircraft_live_snapshots (
    source_id TEXT PRIMARY KEY,
    source_name TEXT NOT NULL,
    snapshot_id TEXT NOT NULL,
    snapshot_time TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    aircraft_count INTEGER NOT NULL,
    valid_position_count INTEGER NOT NULL,
    aircraft_json JSONB NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT aviation_aircraft_live_snapshots_source_id_check
        CHECK (btrim(source_id) <> ''),
    CONSTRAINT aviation_aircraft_live_snapshots_aircraft_count_check
        CHECK (aircraft_count >= 0),
    CONSTRAINT aviation_aircraft_live_snapshots_valid_position_count_check
        CHECK (valid_position_count >= 0)
);

-- Index for querying by snapshot_time
CREATE INDEX IF NOT EXISTS idx_aviation_aircraft_live_snapshots_snapshot_time
    ON aviation_aircraft_live_snapshots (snapshot_time DESC);

-- Index for metadata queries
CREATE INDEX IF NOT EXISTS idx_aviation_aircraft_live_snapshots_metadata
    ON aviation_aircraft_live_snapshots USING GIN (metadata);

-- Enable NOTIFY for this table
-- (PostgreSQL NOTIFY doesn't require special setup, just pg_notify() calls)