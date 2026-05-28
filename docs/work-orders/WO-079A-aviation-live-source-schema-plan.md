# WO-079A — Aviation Live-Data Source, Database, and API Architecture Plan

**Work Order:** WO-079A-AVIATION-LIVE-SOURCE-SCHEMA-PLAN  
**Layer:** layer_01_aviation  
**Status:** PLANNING COMPLETE — Ready for implementation work orders  
**Created:** 2026-05-28T06:52:02Z  
**Author:** Kiro CLI (Claude Sonnet 4.5)  
**Branch:** agent/aviation-live-source-schema-plan

---

## 1. Objective

Design the MVP architecture for live aircraft tracking and time-series storage for the GOD EYES Aviation layer (layer_01_aviation). This document covers source selection, database schema, fetch strategy, normalization, API endpoints, and frontend render plan.

**This is a planning document only. No implementation is included.**

---

## 2. Source Selection

### 2.1 Live Source: Airplanes.live Official REST API

**Source:** https://airplanes.live/api-guide/  
**Base URL:** `http://api.airplanes.live/v2/`  
**License:** Non-commercial use only. No SLA. No uptime guarantee.  
**Rate Limit:** 1 request per second (documented).  
**Auth:** None currently required (may change in future).

#### Available Endpoints (from official docs)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/hex/[hex]` | GET | Aircraft by ICAO hex id (up to 1000) |
| `/callsign/[callsign]` | GET | Aircraft by callsign (up to 1000) |
| `/reg/[reg]` | GET | Aircraft by registration (up to 1000) |
| `/type/[type]` | GET | Aircraft by ICAO type code |
| `/squawk/[squawk]` | GET | Aircraft by squawk code |
| `/mil` | GET | **All aircraft tagged as military (global)** |
| `/ladd` | GET | **All aircraft tagged as LADD (global)** |
| `/pia` | GET | **All aircraft tagged as PIA (global)** |
| `/point/[lat]/[lon]/[radius]` | GET | Aircraft within radius up to 250 nm |

#### Critical Finding: No Global Endpoint

**There is NO global "all aircraft" endpoint in the Airplanes.live official API.**

The `/mil`, `/ladd`, and `/pia` endpoints return global results for their respective categories. There is no endpoint that returns all civil/commercial aircraft globally. The only way to retrieve civil aircraft is via `/point/[lat]/[lon]/[radius]` (max 250 nm radius).

This is a hard architectural constraint for MVP.

### 2.2 Historical Source: OpenSky Network (Future Only)

**Source:** https://openskynetwork.github.io/opensky-api/trino.html  
**Access:** Trino SQL interface — requires application and approval.  
**Eligibility:** University-affiliated researchers, governmental organisations, aviation authorities. Private/commercial entities must contact for licence.  
**Table:** `state_vectors_data4` — unlimited retention.  
**REST API:** Exists but heavily rate-limited for anonymous users (not suitable for live MVP).

**Decision:** OpenSky is NOT used for MVP live tracking. It is documented here for future timeline/backfill use only. Do not block MVP on OpenSky access.

---

## 3. MVP Fetch Strategy

### 3.1 Constraint Analysis

- Rate limit: 1 req/sec = max 1 endpoint call per second
- No global civil aircraft endpoint
- `/mil`, `/ladd`, `/pia` each return global results for their category
- `/point` covers up to 250 nm radius per call

### 3.2 Recommended MVP Fetch Scope

**Do NOT attempt to tile the globe with hundreds of `/point` calls every 5 seconds.** That would require ~500+ calls to cover the globe and violate the 1 req/sec limit.

**MVP fetch strategy — 3 global special-category calls + 1 camera-region call:**

```
Cycle (target: every 5 seconds, 1 req/sec hard limit):

Second 0: GET /v2/mil        → all military aircraft globally
Second 1: GET /v2/ladd       → all LADD aircraft globally
Second 2: GET /v2/pia        → all PIA aircraft globally
Second 3: GET /v2/point/{lat}/{lon}/250  → camera center, 250 nm radius (civil)
Second 4: idle / buffer
```

This gives:
- Complete global coverage of military, LADD, and PIA aircraft (all publicly available)
- Regional civil coverage around the current camera view
- 4 requests per 5-second cycle = compliant with 1 req/sec limit
- Camera bbox changes trigger updated `/point` coordinates on next cycle

**Civil aircraft outside the camera 250 nm radius are NOT shown in MVP.** This is acceptable and must be documented in the UI.

### 3.3 Staleness Thresholds

| State | Threshold | Behaviour |
|-------|-----------|-----------|
| Active | seen ≤ 30s | Show at full opacity |
| Fading | 30s < seen ≤ 90s | Show at reduced opacity |
| Stale | seen > 90s | Hide from globe |
| Purge from latest | seen > 300s | Remove from `aviation_aircraft_latest` |

These thresholds are configurable via environment variables.

---

## 4. Database Schema Plan

All tables belong to `layer_01_aviation`. All use `source_id` and `source_object_id` per AGENTS.md conventions.

### 4.1 `aviation_aircraft_sources`

Source metadata, license, and refresh policy registry.

```sql
CREATE TABLE aviation_aircraft_sources (
    source_id           TEXT PRIMARY KEY,           -- e.g. 'airplanes_live_v2'
    display_name        TEXT NOT NULL,
    base_url            TEXT NOT NULL,
    license_type        TEXT NOT NULL,              -- 'non_commercial', 'research', etc.
    license_caveat      TEXT,                       -- full caveat text
    rate_limit_per_sec  INTEGER NOT NULL DEFAULT 1,
    refresh_interval_s  INTEGER NOT NULL DEFAULT 5,
    is_live             BOOLEAN NOT NULL DEFAULT TRUE,
    is_historical       BOOLEAN NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Seed rows:**
- `airplanes_live_v2`: live source, non-commercial, 1 req/sec, 5s refresh
- `opensky_trino`: historical source, research/university only, not active for MVP

### 4.2 `aviation_aircraft_latest`

Fast live globe state. One row per source + aircraft. Updated only when incoming `observed_at` is newer.

```sql
CREATE TABLE aviation_aircraft_latest (
    id                  BIGSERIAL PRIMARY KEY,
    source_id           TEXT NOT NULL REFERENCES aviation_aircraft_sources(source_id),
    source_object_id    TEXT NOT NULL,              -- ICAO hex (e.g. 'a1b2c3')
    layer_id            TEXT NOT NULL DEFAULT 'layer_01_aviation',

    -- Identity
    callsign            TEXT,                       -- flight field from source
    registration        TEXT,                       -- r field
    aircraft_type       TEXT,                       -- t field (ICAO type code)

    -- Classification flags (parsed from dbFlags bitfield)
    db_flags            INTEGER,                    -- raw dbFlags value
    is_military         BOOLEAN NOT NULL DEFAULT FALSE,  -- dbFlags & 1
    is_interesting      BOOLEAN NOT NULL DEFAULT FALSE,  -- dbFlags & 2
    is_pia              BOOLEAN NOT NULL DEFAULT FALSE,  -- dbFlags & 4
    is_ladd             BOOLEAN NOT NULL DEFAULT FALSE,  -- dbFlags & 8

    -- Source message type
    source_message_type TEXT,                       -- type field (adsb_icao, mlat, etc.)

    -- Position
    lat                 DOUBLE PRECISION,
    lon                 DOUBLE PRECISION,
    geom                GEOGRAPHY(Point, 4326),     -- PostGIS point, derived from lat/lon

    -- Altitude
    altitude_baro_ft    DOUBLE PRECISION,           -- alt_baro (may be 'ground')
    altitude_geom_ft    DOUBLE PRECISION,           -- alt_geom
    on_ground           BOOLEAN,                    -- true if alt_baro = 'ground'

    -- Velocity
    ground_speed_kt     DOUBLE PRECISION,           -- gs
    track_deg           DOUBLE PRECISION,           -- track (true track over ground)
    heading_mag_deg     DOUBLE PRECISION,           -- mag_heading
    heading_true_deg    DOUBLE PRECISION,           -- true_heading
    vertical_rate_fpm   DOUBLE PRECISION,           -- baro_rate
    geom_rate_fpm       DOUBLE PRECISION,           -- geom_rate

    -- Transponder
    squawk              TEXT,                       -- 4-digit octal
    emergency           TEXT,                       -- none/general/lifeguard/etc.

    -- Timing
    seen_seconds        DOUBLE PRECISION,           -- seen (seconds since last message)
    seen_pos_seconds    DOUBLE PRECISION,           -- seen_pos (seconds since last position)
    observed_at         TIMESTAMPTZ NOT NULL,       -- derived: now - seen_seconds
    received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    stale_after         TIMESTAMPTZ,                -- observed_at + staleness threshold

    -- Lifecycle
    first_seen_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Raw
    raw_json            JSONB,                      -- full source aircraft object

    UNIQUE (source_id, source_object_id)
);

CREATE INDEX idx_aircraft_latest_geom ON aviation_aircraft_latest USING GIST (geom);
CREATE INDEX idx_aircraft_latest_observed ON aviation_aircraft_latest (observed_at DESC);
CREATE INDEX idx_aircraft_latest_stale ON aviation_aircraft_latest (stale_after);
CREATE INDEX idx_aircraft_latest_military ON aviation_aircraft_latest (is_military) WHERE is_military = TRUE;
```

**Upsert rule:** `ON CONFLICT (source_id, source_object_id) DO UPDATE` only when `EXCLUDED.observed_at > aviation_aircraft_latest.observed_at`. Preserve `first_seen_at`. Update `last_seen_at`.

### 4.3 `aviation_aircraft_observations`

Append-only time-series history. Every valid position observation is inserted here for future timeline use.

```sql
CREATE TABLE aviation_aircraft_observations (
    id                  BIGSERIAL PRIMARY KEY,
    source_id           TEXT NOT NULL,
    source_object_id    TEXT NOT NULL,              -- ICAO hex
    layer_id            TEXT NOT NULL DEFAULT 'layer_01_aviation',

    -- Position snapshot
    lat                 DOUBLE PRECISION,
    lon                 DOUBLE PRECISION,
    geom                GEOGRAPHY(Point, 4326),

    altitude_baro_ft    DOUBLE PRECISION,
    altitude_geom_ft    DOUBLE PRECISION,
    on_ground           BOOLEAN,
    ground_speed_kt     DOUBLE PRECISION,
    track_deg           DOUBLE PRECISION,
    vertical_rate_fpm   DOUBLE PRECISION,

    -- Identity snapshot (denormalized for query convenience)
    callsign            TEXT,
    squawk              TEXT,
    emergency           TEXT,
    is_military         BOOLEAN,
    is_pia              BOOLEAN,
    is_ladd             BOOLEAN,

    -- Timing
    observed_at         TIMESTAMPTZ NOT NULL,
    received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (source_id, source_object_id, observed_at)
);

-- Partition by month for future scalability (document intent; implement when volume warrants)
CREATE INDEX idx_observations_source_obj_time
    ON aviation_aircraft_observations (source_id, source_object_id, observed_at DESC);
CREATE INDEX idx_observations_geom ON aviation_aircraft_observations USING GIST (geom);
CREATE INDEX idx_observations_time ON aviation_aircraft_observations (observed_at DESC);
```

**Insert rule:** Insert only when `lat` and `lon` are present (valid position). Deduplicate by `(source_id, source_object_id, observed_at)`.

### 4.4 `aviation_aircraft_raw_batches`

Raw response evidence for debugging and audit. Stores batch metadata; optionally stores compressed payload sample.

```sql
CREATE TABLE aviation_aircraft_raw_batches (
    id                  BIGSERIAL PRIMARY KEY,
    source_id           TEXT NOT NULL,
    endpoint            TEXT NOT NULL,              -- e.g. '/mil', '/point/...'
    fetch_params        JSONB,                      -- lat/lon/radius or other params
    fetched_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    http_status         INTEGER,
    aircraft_count      INTEGER,
    source_now_ts       DOUBLE PRECISION,           -- 'now' field from response
    source_ctime_ts     DOUBLE PRECISION,           -- 'ctime' field from response
    source_ptime_ms     DOUBLE PRECISION,           -- 'ptime' field from response
    raw_sample          JSONB,                      -- first 5 aircraft objects (debug sample)
    error_message       TEXT                        -- if fetch failed
);

CREATE INDEX idx_raw_batches_fetched ON aviation_aircraft_raw_batches (fetched_at DESC);
CREATE INDEX idx_raw_batches_source ON aviation_aircraft_raw_batches (source_id, fetched_at DESC);
```

**Note:** Full raw payloads are NOT stored by default (too large). Only metadata + a 5-aircraft sample for debugging. Full payload storage can be enabled per-batch for incident investigation.

### 4.5 `aviation_aircraft_identity` (Optional — Future)

Identity enrichment for aircraft model/type/registration mapping. Not built for MVP.

```sql
-- FUTURE TABLE — do not create in MVP migration
-- CREATE TABLE aviation_aircraft_identity (
--     source_object_id    TEXT PRIMARY KEY,          -- ICAO hex
--     registration        TEXT,
--     aircraft_type       TEXT,
--     manufacturer        TEXT,
--     model               TEXT,
--     operator            TEXT,
--     country_of_reg      TEXT,
--     enrichment_source   TEXT,
--     enriched_at         TIMESTAMPTZ
-- );
```

---

## 5. Normalization: Airplanes.live → Internal Schema

### 5.1 Field Mapping

| Airplanes.live field | Internal column | Notes |
|---------------------|-----------------|-------|
| `hex` | `source_object_id` | ICAO 24-bit hex |
| `r` | `registration` | From database |
| `t` | `aircraft_type` | ICAO type code |
| `dbFlags` | `db_flags` | Raw integer |
| `dbFlags & 1` | `is_military` | Boolean |
| `dbFlags & 2` | `is_interesting` | Boolean |
| `dbFlags & 4` | `is_pia` | Boolean |
| `dbFlags & 8` | `is_ladd` | Boolean |
| `type` | `source_message_type` | adsb_icao, mlat, etc. |
| `flight` | `callsign` | Strip trailing spaces |
| `alt_baro` | `altitude_baro_ft` | If numeric; set `on_ground=true` if `"ground"` |
| `alt_geom` | `altitude_geom_ft` | |
| `gs` | `ground_speed_kt` | |
| `track` | `track_deg` | True track over ground |
| `mag_heading` | `heading_mag_deg` | |
| `true_heading` | `heading_true_deg` | |
| `baro_rate` | `vertical_rate_fpm` | |
| `geom_rate` | `geom_rate_fpm` | |
| `squawk` | `squawk` | |
| `emergency` | `emergency` | |
| `lat` | `lat` | |
| `lon` | `lon` | |
| `seen` | `seen_seconds` | |
| `seen_pos` | `seen_pos_seconds` | |
| `now - seen` | `observed_at` | Derived timestamp |
| `messages` | (not stored in latest) | |
| `rssi` | (not stored in latest) | |

### 5.2 `observed_at` Derivation

```python
# response_now is the 'now' field from the API response (Unix seconds float)
# aircraft['seen'] is seconds since last message
observed_at = datetime.utcfromtimestamp(response_now - aircraft.get('seen', 0))
```

### 5.3 `stale_after` Derivation

```python
STALE_HIDE_THRESHOLD_S = int(os.getenv('AIRCRAFT_STALE_HIDE_S', '90'))
stale_after = observed_at + timedelta(seconds=STALE_HIDE_THRESHOLD_S)
```

### 5.4 dbFlags Parsing

```python
db_flags = aircraft.get('dbFlags', 0) or 0
is_military    = bool(db_flags & 1)
is_interesting = bool(db_flags & 2)
is_pia         = bool(db_flags & 4)
is_ladd        = bool(db_flags & 8)
```

---

## 6. Fetch Cadence Algorithm

```
RATE_LIMIT = 1 req/sec (hard, from official docs)
TARGET_CYCLE_S = 5

Fetch cycle (runs in background worker):

  t=0s: fetch /v2/mil
        → normalize + upsert latest + append observations + log batch
        sleep 1s

  t=1s: fetch /v2/ladd
        → normalize + upsert latest + append observations + log batch
        sleep 1s

  t=2s: fetch /v2/pia
        → normalize + upsert latest + append observations + log batch
        sleep 1s

  t=3s: fetch /v2/point/{camera_lat}/{camera_lon}/250
        → normalize + upsert latest + append observations + log batch
        sleep 1s

  t=4s: idle (buffer / housekeeping)
        → purge stale rows from aviation_aircraft_latest (seen > 300s)

  t=5s: repeat

Camera coordinates: updated from API state (last known camera center).
If no camera position known: use default seed point (e.g. 0.0, 0.0 or configurable).
```

**Never issue more than 1 request per second. Never tile the globe.**

---

## 7. Latest Upsert Algorithm

```sql
INSERT INTO aviation_aircraft_latest (
    source_id, source_object_id, layer_id,
    callsign, registration, aircraft_type,
    db_flags, is_military, is_interesting, is_pia, is_ladd,
    source_message_type,
    lat, lon, geom,
    altitude_baro_ft, altitude_geom_ft, on_ground,
    ground_speed_kt, track_deg, heading_mag_deg, heading_true_deg,
    vertical_rate_fpm, geom_rate_fpm,
    squawk, emergency,
    seen_seconds, seen_pos_seconds,
    observed_at, received_at, stale_after,
    first_seen_at, last_seen_at,
    raw_json
)
VALUES (...)
ON CONFLICT (source_id, source_object_id) DO UPDATE SET
    callsign            = EXCLUDED.callsign,
    registration        = EXCLUDED.registration,
    aircraft_type       = EXCLUDED.aircraft_type,
    db_flags            = EXCLUDED.db_flags,
    is_military         = EXCLUDED.is_military,
    is_interesting      = EXCLUDED.is_interesting,
    is_pia              = EXCLUDED.is_pia,
    is_ladd             = EXCLUDED.is_ladd,
    source_message_type = EXCLUDED.source_message_type,
    lat                 = EXCLUDED.lat,
    lon                 = EXCLUDED.lon,
    geom                = EXCLUDED.geom,
    altitude_baro_ft    = EXCLUDED.altitude_baro_ft,
    altitude_geom_ft    = EXCLUDED.altitude_geom_ft,
    on_ground           = EXCLUDED.on_ground,
    ground_speed_kt     = EXCLUDED.ground_speed_kt,
    track_deg           = EXCLUDED.track_deg,
    heading_mag_deg     = EXCLUDED.heading_mag_deg,
    heading_true_deg    = EXCLUDED.heading_true_deg,
    vertical_rate_fpm   = EXCLUDED.vertical_rate_fpm,
    geom_rate_fpm       = EXCLUDED.geom_rate_fpm,
    squawk              = EXCLUDED.squawk,
    emergency           = EXCLUDED.emergency,
    seen_seconds        = EXCLUDED.seen_seconds,
    seen_pos_seconds    = EXCLUDED.seen_pos_seconds,
    observed_at         = EXCLUDED.observed_at,
    received_at         = EXCLUDED.received_at,
    stale_after         = EXCLUDED.stale_after,
    last_seen_at        = EXCLUDED.last_seen_at,
    raw_json            = EXCLUDED.raw_json
    -- first_seen_at is NOT updated (preserve original)
WHERE EXCLUDED.observed_at > aviation_aircraft_latest.observed_at;
```

---

## 8. API Endpoint Plan

All endpoints are served by the GOD EYES API (`apps/api/`). No direct frontend calls to Airplanes.live.

### 8.1 MVP Endpoints

```
GET /api/aviation/aircraft/latest
  → Returns all non-stale aircraft from aviation_aircraft_latest
  → Default: exclude rows where stale_after < NOW()
  → Response: { source_id, source_object_id, callsign, registration, aircraft_type,
                is_military, is_pia, is_ladd, lat, lon, altitude_baro_ft,
                ground_speed_kt, track_deg, heading_true_deg, squawk, emergency,
                observed_at, stale_after }
  → Max rows: configurable cap (default 5000)

GET /api/aviation/aircraft/latest?bbox=minLon,minLat,maxLon,maxLat
  → Same as above, filtered to bbox using PostGIS ST_Within
  → Useful for frontend LOD: only fetch what's in view

GET /api/aviation/aircraft/:sourceObjectId
  → Single aircraft detail by ICAO hex
  → Returns full row including raw_json
```

### 8.2 Future Timeline Endpoints (Not MVP — Schema Ready)

```
GET /api/aviation/aircraft/history?from=ISO&to=ISO&bbox=minLon,minLat,maxLon,maxLat
  → Query aviation_aircraft_observations for time range + bbox
  → Requires from/to params (max range TBD)

GET /api/aviation/aircraft/:sourceObjectId/history?from=ISO&to=ISO
  → Full observation history for one aircraft
```

### 8.3 Response Shape (MVP Latest)

```typescript
// From @god-eyes/contracts
interface AircraftLiveObject {
  sourceId: string;
  sourceObjectId: string;       // ICAO hex
  callsign: string | null;
  registration: string | null;
  aircraftType: string | null;
  isMilitary: boolean;
  isPia: boolean;
  isLadd: boolean;
  lat: number;
  lon: number;
  altitudeBaroFt: number | null;
  onGround: boolean;
  groundSpeedKt: number | null;
  trackDeg: number | null;
  headingTrueDeg: number | null;
  squawk: string | null;
  emergency: string | null;
  observedAt: string;           // ISO 8601
  staleAfter: string;           // ISO 8601
}

interface AircraftLatestResponse {
  aircraft: AircraftLiveObject[];
  count: number;
  generatedAt: string;
  caveat: string;               // always present
}
```

---

## 9. Frontend Render Plan

### 9.1 Marker Style

- Tiny heading arrows (triangle/chevron pointing in `trackDeg` direction)
- Size: ~6–8px at normal zoom, scale slightly with altitude
- Color: white/light grey for civil, amber for military/LADD/PIA
- No labels by default
- Click to show detail panel

### 9.2 Polling

- Frontend polls `GET /api/aviation/aircraft/latest?bbox=...` every 5 seconds
- Uses current camera bbox as filter parameter
- No direct calls to Airplanes.live from frontend
- No render-loop fetches (use setInterval, not requestAnimationFrame)

### 9.3 Interpolation (No Dead Reckoning)

- When a new position arrives, interpolate visually between previous and new observed position
- Interpolation only between two real observed positions
- Do NOT extrapolate beyond the latest observed position
- Do NOT predict future position
- If no new position arrives within 2× poll interval, stop interpolating and show last known position

### 9.4 LOD / Cap

- Cap frontend render at 5000 aircraft (configurable)
- At high zoom: show all aircraft in bbox
- At low zoom (global): show only military/LADD/PIA + sampled civil
- Cluster dense regions if needed (future enhancement)

### 9.5 Caveat Display

Always show in UI when aviation layer is active:
> "Live aircraft data: Airplanes.live (non-commercial/no-SLA). Coverage limited to camera region for civil aircraft. Military/LADD/PIA shown globally. Not authoritative aviation data."

---

## 10. OpenSky Historical Plan (Future)

OpenSky Network provides historical ADS-B data via Trino SQL interface.

**Access requirements:**
- Must apply at https://opensky-network.org/ → My OpenSky → Request Data Access
- Eligibility: university-affiliated researchers, governmental organisations, aviation authorities
- Private/commercial entities must contact for licence
- Access is granted based on application review

**Table:** `state_vectors_data4`  
**Retention:** Unlimited  
**Key fields:** `time`, `icao24`, `lat`, `lon`, `velocity` (m/s), `heading`, `vertrate` (m/s), `callsign`, `baroaltitude` (metres), `geoaltitude` (metres), `squawk`, `onground`

**Unit conversion required:** OpenSky uses metres and m/s; internal schema uses feet and knots.

**Future use case:** Backfill `aviation_aircraft_observations` with historical tracks for timeline playback.

**MVP decision:** Do not implement OpenSky integration now. Do not block MVP on OpenSky access. Document for future work order.

---

## 11. Safety and Product Limits

| Limit | Status |
|-------|--------|
| Public data only | ✅ Airplanes.live is public ADS-B data |
| No website scraping | ✅ Official REST API only |
| No non-public enrichment | ✅ No enrichment in MVP |
| No tactical analysis features | ✅ Not planned |
| No route prediction for sensitive aircraft | ✅ No prediction at all in MVP |
| No "military aircraft near X" alerting | ✅ Not planned for MVP |
| No claims of complete coverage | ✅ Caveat required in UI |
| No claims of official/authoritative data | ✅ Caveat required in UI |
| No direct frontend calls to Airplanes.live | ✅ Backend fetcher only |
| Non-commercial use only | ✅ GOD EYES MVP is non-commercial/testing |
| Military/PIA/LADD included if publicly available | ✅ All three global endpoints used |

---

## 12. Known Limitations

1. **No global civil aircraft coverage.** Only civil aircraft within 250 nm of the camera center are fetched. This is a hard constraint of the Airplanes.live API.
2. **1 req/sec rate limit.** The fetch cycle is constrained to 4 active requests per 5-second window.
3. **No SLA.** Airplanes.live provides no uptime guarantee. The fetcher must handle failures gracefully.
4. **Non-commercial only.** If GOD EYES ever becomes commercial, a new data agreement is required.
5. **OpenSky historical access requires application.** Not available immediately.
6. **No dead reckoning.** Aircraft positions may appear to jump between observations.
7. **Coverage gaps.** ADS-B coverage is ground-receiver-dependent. Oceanic/polar gaps exist.
8. **dbFlags may be absent.** Not all aircraft have dbFlags set; default to 0.

---

## 13. Implementation Work Orders (Next Steps)

After this planning document is approved:

| Work Order | Owner | Description |
|------------|-------|-------------|
| WO-079B | Codex | Database migrations: create aviation_aircraft_sources, aviation_aircraft_latest, aviation_aircraft_observations, aviation_aircraft_raw_batches |
| WO-079C | Codex | Fetcher: Airplanes.live worker (/mil + /ladd + /pia + /point), normalization, upsert, observation append |
| WO-079D | Claude Code CLI | API: GET /api/aviation/aircraft/latest, bbox filter, single aircraft endpoint |
| WO-079E | Gemini CLI | Frontend: heading arrow markers, 5s poll, interpolation, caveat display |

---

## 14. References

- Airplanes.live API Guide: https://airplanes.live/api-guide/
- Airplanes.live Data Fields: https://airplanes.live/rest-api-adsb-data-field-descriptions/
- OpenSky Trino Docs: https://openskynetwork.github.io/opensky-api/trino.html
- AGENTS.md: Layer and ownership conventions
- docs/control/LAYER_ARCHITECTURE.md: Layer definitions
