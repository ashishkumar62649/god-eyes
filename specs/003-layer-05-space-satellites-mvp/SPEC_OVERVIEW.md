# Specification: 003-Layer-05-Space-Satellites-MVP

## Feature Identity
- **Spec ID**: 003-layer-05-space-satellites-mvp
- **Layer ID**: layer_05_space_satellites
- **Layer Name**: Space & Satellites
- **Phase**: MVP
- **Status**: Specification (not implemented)

---

## Executive Summary

The Space & Satellites MVP enables users to visualize public orbital objects (satellites, debris, rocket bodies) around Earth with real-time position estimation, category-based filtering, and object metadata. This layer leverages public orbital data from CelesTrak and optional enrichment from Space-Track to provide a global view of space traffic.

---

## Primary User Value Proposition

Users can:
1. **Enable the Space & Satellites layer** on the GOD EYES globe
2. **See all public orbital objects** categorized as satellites, debris, or rocket bodies
3. **Distinguish object types visually**—satellites as colored dots, debris/rocket bodies as colored triangles
4. **Filter and search** by category (Starlink, communications, navigation, weather, Earth observation, science, crewed, etc.)
5. **Click on any object** to view its metadata: name, NORAD catalog ID, object type, altitude, speed estimate, orbit class, last updated time, and data freshness
6. **Toggle constellation features** (Starlink neighbor links, if enabled) with clear "estimated" labels
7. **Understand data currency**—see when orbital data was last updated and whether positions are estimated

---

## Feature Goals

### Must-Have (MVP)
- ✅ Render public satellites and orbital objects on Cesium globe
- ✅ Display satellites as colored dots
- ✅ Display debris/rocket bodies as colored triangles
- ✅ Estimate current positions from public orbital elements (TLE data)
- ✅ Color objects by altitude class or mission category
- ✅ Support category filters (Starlink, comms, navigation, weather, Earth obs, science, crewed, debris, rocket body, inactive, unknown)
- ✅ Highlight important satellites (larger, glow, or special color)
- ✅ Show object metadata in click panel (name, NORAD ID, type, category, altitude, speed, lat/lon, source, data age, last updated)
- ✅ Store orbital and catalog data in local database
- ✅ Provide API endpoints for frontend queries
- ✅ Support WebSocket updates for position refreshes
- ✅ Use CelesTrak as primary data source
- ✅ Support Space-Track authenticated data (secondary, environment variable only)
- ✅ Include manual browser verification tests

### Nice-to-Have (Post-MVP)
- Starlink constellation neighbor links (labeled "estimated")
- Historical playback UI
- Advanced collision prediction analytics
- High-precision ephemeris calculations
- Mobile-optimized satellite tracking

### Explicitly Out of Scope
- ❌ Confirmed live satellite-to-satellite communication claims
- ❌ Confirmed live ground-station/user-terminal communication claims
- ❌ Classified or non-public military orbital data
- ❌ Real-time ADS-B style sensor tracking
- ❌ Historical playback

---

## Movement Truth Rule

**Satellite movement is estimated from public orbital elements, not live sensor tracking.**

- Positions are derived from Two-Line Element (TLE) sets and standard propagation (SGP4/SDP4)
- UI may label positions as "estimated current position" or "live estimated position"
- **Never claim** confirmed live communication or real-time sensor links
- Data age/freshness is always displayed to set user expectations

---

## Visual Design Rules

### Marker Shapes
| Object Type | Shape | Color Pool |
|-------------|-------|-----------|
| Satellite | Dot (circle) | All except black/white |
| Debris | Triangle (△) | All except black/white |
| Rocket Body | Triangle (△) | All except black/white |
| Important Satellite | Large dot + glow/highlight | Emphasis color (non-black/white) |

### Altitude-Based Color Scheme
| Altitude Range | Label | Suggested Color |
|---|---|---|
| < 400 km | VLEO (Very Low Earth Orbit) | Cyan |
| 400–2,000 km | LEO (Low Earth Orbit) | Blue |
| 2,000–35,786 km | MEO (Medium Earth Orbit) | Green |
| ≈ 35,786 km | GEO (Geostationary Orbit) | Red |
| > 35,786 km | HEO (High/Elliptical Orbit) | Orange |
| Unknown/Stale | Unknown | Gray |

### Category-Based Color Scheme (Alternative/Complementary)
| Category | Suggested Color |
|----------|---|
| Starlink / Broadband | Light Blue |
| Communications | Purple |
| Navigation (GPS/GLONASS/Galileo) | Yellow-Green |
| Weather | Light Green |
| Earth Observation | Dark Green |
| Science | Orange |
| Crewed / Stations | White-ish / Bright Accent |
| Debris | Red |
| Rocket Body | Dark Red |
| Inactive / Dead Payload | Gray |
| Unknown / Other | Dim Purple |

**Constraint**: Do not use pure black or pure white as primary marker colors.

---

## Data Model Overview

### Core Entity: Orbital Object

An orbital object represents a trackable item in orbit.

```
OrbitalObject {
  id: uuid
  layer_id: 'layer_05_space_satellites'
  source_id: 'celestrak' | 'space-track' | ...
  source_object_id: string  // NORAD catalog number or source-specific ID
  
  // Identification
  name: string
  norad_catalog_id: int
  international_designator: string  // e.g., "2023-001A"
  object_type: 'PAYLOAD' | 'ROCKET BODY' | 'DEBRIS' | 'UNKNOWN'
  
  // Category & Classification
  category: string  // e.g., 'STARLINK', 'COMMUNICATIONS', 'NAVIGATION', ...
  operator: string  // e.g., 'SpaceX', 'Intelsat', ...
  mission: string  // e.g., 'Starlink-1234', ...
  importance_flag: boolean  // highlight in UI?
  
  // Orbital Elements (TLE-based)
  tle_line_1: string
  tle_line_2: string
  tle_epoch: timestamp  // when TLE was effective
  semi_major_axis_km: float
  apogee_km: float
  perigee_km: float
  inclination_degrees: float
  eccentricity: float
  mean_motion_revs_per_day: float
  
  // Current State (computed from latest TLE)
  estimated_altitude_km: float  // at last position update
  orbit_class: string  // 'VLEO' | 'LEO' | 'MEO' | 'GEO' | 'HEO'
  estimated_speed_km_s: float  // at last position update
  last_position_update: timestamp
  
  // Data Provenance
  created_at: timestamp
  updated_at: timestamp
  source_last_refreshed: timestamp  // when we last fetched from CelesTrak/Space-Track
  data_age_hours: int  // computed: now - source_last_refreshed
}
```

### Estimated Position (Real-Time)

Positions are **not stored** in database. They are **computed in backend** on each API request using SGP4 propagation.

```
EstimatedPosition {
  orbital_object_id: uuid
  timestamp: timestamp  // position valid at this time
  latitude: float
  longitude: float
  altitude_km: float
  speed_km_s: float
  heading_degrees: float  // optional
  tle_age_hours: int  // how old is the TLE?
  computation_timestamp: timestamp
}
```

---

## API Contract Overview

### Primary Endpoints

#### 1. GET /api/layer-05/satellites
Fetch all orbital objects with optional filters.

**Query Parameters**:
- `category` (optional, multi-value): Filter by category (e.g., ?category=STARLINK&category=COMMUNICATIONS)
- `object_type` (optional): PAYLOAD | DEBRIS | ROCKET_BODY
- `min_altitude_km` (optional): Minimum altitude
- `max_altitude_km` (optional): Maximum altitude
- `importance` (optional): true | false
- `limit` (optional): Max records, default 1000
- `offset` (optional): Pagination offset, default 0

**Response**:
```json
{
  "objects": [
    {
      "id": "uuid",
      "name": "STARLINK-1001",
      "norad_catalog_id": 44713,
      "object_type": "PAYLOAD",
      "category": "STARLINK",
      "operator": "SpaceX",
      "orbit_class": "LEO",
      "estimated_altitude_km": 550.2,
      "estimated_speed_km_s": 7.64,
      "importance_flag": false,
      "tle_epoch": "2026-05-31T10:00:00Z",
      "data_age_hours": 2,
      "source": "celestrak",
      "last_updated": "2026-05-31T10:00:00Z"
    }
  ],
  "total": 5000,
  "offset": 0,
  "limit": 100
}
```

#### 2. GET /api/layer-05/satellites/:id
Fetch detailed metadata and estimated current position for a single object.

**Response**:
```json
{
  "id": "uuid",
  "name": "STARLINK-1001",
  "norad_catalog_id": 44713,
  "international_designator": "2020-001A",
  "object_type": "PAYLOAD",
  "category": "STARLINK",
  "operator": "SpaceX",
  "mission": "Starlink-1001",
  "orbit_class": "LEO",
  "apogee_km": 550,
  "perigee_km": 548,
  "inclination_degrees": 53.05,
  "eccentricity": 0.0001,
  "semi_major_axis_km": 6928.14,
  "estimated_position": {
    "latitude": 45.2231,
    "longitude": -122.6765,
    "altitude_km": 550.2,
    "speed_km_s": 7.64,
    "timestamp": "2026-05-31T13:45:30Z",
    "tle_age_hours": 2
  },
  "estimated_speed_km_s": 7.64,
  "estimated_altitude_km": 550.2,
  "importance_flag": false,
  "source": "celestrak",
  "data_age_hours": 2,
  "last_updated": "2026-05-31T10:00:00Z",
  "tle_line_1": "1 44713U 20001A   26152.41667476  .00001234  00000-0  12345-4 0  9990",
  "tle_line_2": "2 44713  53.0533 123.4567 0001234  45.6789 314.3210 15.06387234123456"
}
```

#### 3. GET /api/layer-05/position/:id
Fetch only the estimated current position (lightweight).

**Query Parameters**:
- `timestamp` (optional): Request position at specific time (ISO 8601)

**Response**:
```json
{
  "object_id": "uuid",
  "name": "STARLINK-1001",
  "latitude": 45.2231,
  "longitude": -122.6765,
  "altitude_km": 550.2,
  "speed_km_s": 7.64,
  "timestamp": "2026-05-31T13:45:30Z",
  "tle_age_hours": 2,
  "orbit_class": "LEO"
}
```

#### 4. WebSocket: /ws/layer-05/positions
Stream position updates for selected objects.

**Subscription Message** (client → server):
```json
{
  "action": "subscribe",
  "object_ids": ["uuid-1", "uuid-2", "uuid-3"],
  "update_interval_ms": 5000
}
```

**Position Update Message** (server → client, every 5 seconds):
```json
{
  "type": "position_update",
  "timestamp": "2026-05-31T13:45:30Z",
  "positions": [
    {
      "object_id": "uuid-1",
      "name": "STARLINK-1001",
      "latitude": 45.2231,
      "longitude": -122.6765,
      "altitude_km": 550.2,
      "speed_km_s": 7.64,
      "orbit_class": "LEO"
    }
  ]
}
```

#### 5. GET /api/layer-05/categories
Fetch list of available categories and counts.

**Response**:
```json
{
  "categories": [
    { "name": "STARLINK", "count": 4000 },
    { "name": "COMMUNICATIONS", "count": 300 },
    { "name": "NAVIGATION", "count": 150 },
    { "name": "WEATHER", "count": 80 },
    { "name": "EARTH_OBSERVATION", "count": 200 },
    { "name": "SCIENCE", "count": 100 },
    { "name": "CREWED", "count": 5 },
    { "name": "DEBRIS", "count": 20000 },
    { "name": "ROCKET_BODY", "count": 2000 },
    { "name": "INACTIVE", "count": 5000 },
    { "name": "UNKNOWN", "count": 1000 }
  ]
}
```

---

## Frontend (Cesium) Requirements

### Layer Toggle & Visibility
- Add "Space & Satellites" to layer list
- Enable/disable rendering all satellites/debris
- Load satellite catalog on layer enable

### 3D Rendering
- Use Cesium `Entity` with `point` graphics for satellites
- Use Cesium `Entity` with custom graphics (or model) for debris/triangles
- Color by altitude class or category (user configurable)
- Update positions via WebSocket every 5 seconds
- Show satellite name as label on hover
- Allow click to open detail panel

### Detail Panel
Display when user clicks a satellite. Show:
- Name
- NORAD Catalog ID
- Object Type (Payload / Debris / Rocket Body)
- Category (Starlink / Communications / etc.)
- Operator
- Mission
- Orbit Class (VLEO / LEO / MEO / GEO / HEO)
- Altitude (km)
- Speed (km/s)
- Apogee / Perigee (km)
- Inclination (degrees)
- Latitude / Longitude
- Data Source (CelesTrak / Space-Track)
- Data Age / Freshness
- Last Updated Time
- Importance Flag

### Filters & Controls
- **Category Filter**: Multi-select (Starlink, Comms, Navigation, Weather, Earth Obs, Science, Crewed, Debris, Rocket Body, Inactive, Unknown)
- **Object Type Filter**: Satellite / Debris / Rocket Body
- **Altitude Range Slider**: Min/Max altitude in km
- **Color By**: Altitude Class OR Category
- **Show Labels**: Toggle satellite name labels
- **Show Debris**: Toggle debris visibility
- **Show Importance Only**: Toggle to highlight important satellites only

### Movement
- Satellite positions update via WebSocket (every 5 seconds)
- Smooth interpolation between position updates (optional, MVP may use discrete jumps)
- Path trail optional (post-MVP)

---

## Database Schema Overview

### Core Tables

#### `orbital_objects` (main catalog)
```sql
CREATE TABLE layer_05_space_satellites.orbital_objects (
  id UUID PRIMARY KEY,
  layer_id VARCHAR(64) DEFAULT 'layer_05_space_satellites',
  source_id VARCHAR(64) NOT NULL,  -- 'celestrak', 'space-track', etc.
  source_object_id VARCHAR(256) NOT NULL UNIQUE,  -- NORAD ID or source ID
  
  -- Identification
  name VARCHAR(256) NOT NULL,
  norad_catalog_id INT,
  international_designator VARCHAR(32),
  object_type VARCHAR(32),  -- 'PAYLOAD', 'ROCKET BODY', 'DEBRIS', 'UNKNOWN'
  
  -- Category
  category VARCHAR(64),
  operator VARCHAR(256),
  mission VARCHAR(256),
  importance_flag BOOLEAN DEFAULT FALSE,
  
  -- Orbital Elements (TLE)
  tle_line_1 TEXT,
  tle_line_2 TEXT,
  tle_epoch TIMESTAMP,
  semi_major_axis_km FLOAT,
  apogee_km FLOAT,
  perigee_km FLOAT,
  inclination_degrees FLOAT,
  eccentricity FLOAT,
  mean_motion_revs_per_day FLOAT,
  
  -- Current State
  estimated_altitude_km FLOAT,
  orbit_class VARCHAR(16),  -- 'VLEO', 'LEO', 'MEO', 'GEO', 'HEO'
  estimated_speed_km_s FLOAT,
  last_position_update TIMESTAMP,
  
  -- Provenance
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  source_last_refreshed TIMESTAMP,
  
  -- Indexes
  INDEX idx_layer_id (layer_id),
  INDEX idx_source_id (source_id),
  INDEX idx_category (category),
  INDEX idx_object_type (object_type),
  INDEX idx_orbit_class (orbit_class),
  UNIQUE KEY uk_source_object (source_id, source_object_id)
);
```

#### `orbital_positions_cache` (optional, for performance)
```sql
CREATE TABLE layer_05_space_satellites.orbital_positions_cache (
  id UUID PRIMARY KEY,
  orbital_object_id UUID NOT NULL REFERENCES orbital_objects(id),
  
  -- Snapshot of computed position
  latitude FLOAT,
  longitude FLOAT,
  altitude_km FLOAT,
  speed_km_s FLOAT,
  heading_degrees FLOAT,
  
  -- Metadata
  computed_at TIMESTAMP,
  tle_age_hours INT,
  
  FOREIGN KEY (orbital_object_id) REFERENCES orbital_objects(id) ON DELETE CASCADE,
  INDEX idx_object_id (orbital_object_id),
  INDEX idx_computed_at (computed_at)
);
```

---

## Data Pipeline Overview

### Fetcher Lane
**Owner**: MiniMax (fetching agent)

**Data Sources**:
1. **CelesTrak** (primary): Public orbital elements, satellite catalog
   - Endpoint: https://celestrak.org/
   - Data: TLE sets, satellite catalog JSON
   - Frequency: Daily or every 6 hours
   - No authentication required
   
2. **Space-Track** (secondary): Enhanced orbital data, object metadata
   - Endpoint: https://www.space-track.org/
   - Data: High-precision TLE, object details
   - Frequency: Daily or on-demand (authenticated, local env vars only)
   - Authentication: Username/password from environment variables (never committed)

**Fetcher Responsibilities**:
- Fetch latest TLE data from CelesTrak
- Optionally fetch supplemental data from Space-Track (if authenticated)
- Detect new objects and catalog updates
- Store raw data in local storage: `raw/layer_05_space_satellites/<source_id>/<object_id>`
- Call normalizer when new data arrives

### Normalizer Lane
**Owner**: MiniMax (same as fetcher)

**Normalizer Responsibilities**:
- Read raw orbital element files
- Parse TLE lines and satellite metadata
- Compute orbit class (VLEO/LEO/MEO/GEO/HEO) from semi-major axis
- Classify objects into categories (Starlink, Comms, Navigation, Weather, Obs, Science, Crewed, Debris, Rocket Body, Inactive, Unknown)
- Flag important objects (ISS, major operators, etc.)
- Call database lane (Codex) with normalized schema
- Store processed metadata in database

**Classification Rules** (examples):
```
IF name CONTAINS 'STARLINK' → category = 'STARLINK'
IF operator = 'SpaceX' AND category NOT SET → category = 'BROADBAND'
IF name CONTAINS 'ISS' OR name CONTAINS 'SPACE STATION' → importance_flag = TRUE, category = 'CREWED'
IF object_type = 'DEBRIS' → category = 'DEBRIS'
IF object_type = 'ROCKET BODY' → category = 'ROCKET_BODY'
...
```

### Database Lane
**Owner**: Codex (database agent)

**Responsibilities**:
- Create/migrate schema for `orbital_objects` table
- Ingest normalized objects from normalizer
- Maintain catalog; handle updates/deletions
- Support position queries (via API lane)
- Provide schema documentation

### API Lane
**Owner**: DeepSeek (API agent)

**Responsibilities**:
- Implement REST endpoints (GET /api/layer-05/satellites, /satellites/:id, /position/:id, /categories)
- Implement WebSocket endpoint for position streaming
- Query database for object metadata
- Compute current positions using SGP4 propagation library on each request
- Stream position updates to WebSocket clients
- Cache frequently accessed data (optional)
- Handle filtering, pagination, sorting

### Frontend Lane
**Owner**: Sonnet 4.6 (frontend agent)

**Responsibilities**:
- Build Cesium globe integration for Space & Satellites layer
- Render satellites as dots, debris as triangles
- Connect to API endpoints and WebSocket for real-time updates
- Implement filters (category, altitude, type, importance)
- Build detail panel for object metadata
- Color by altitude or category
- Support layer toggle

---

## Worktree & Branch Strategy

All agents work in parallel within their own worktrees and branches:

| Lane | Worktree | Branch | Owner |
|------|----------|--------|-------|
| Control/Integration | E:\god-eyes | main or feature/layer-05-* | Kiro CLI |
| Database | E:\god-eyes-db | agent/wo-xxx-database | Codex |
| Fetcher/Normalizer | E:\god-eyes-fetching | agent/wo-xxx-fetching | MiniMax |
| API | E:\god-eyes-api | agent/wo-xxx-api | DeepSeek |
| Frontend | E:\god-eyes-frontend | agent/wo-xxx-frontend | Sonnet 4.6 |
| Review | E:\god-eyes-review | agent/wo-xxx-review | Claude Haiku 4.5 |

Each agent:
- Creates one local commit per work order in their branch
- Updates `docs/state/HANDOFF_LOG.md` with metadata (Agent, LLM, Start/End UTC, Files changed, Commands, Known Issues)
- **Does NOT push** to remote
- **Kiro CLI** reviews, integrates, and pushes to main

---

## Testing & Verification Strategy

### Manual Browser Verification (MVP)
1. Enable Space & Satellites layer
2. Verify satellites render as dots on globe
3. Verify debris renders as triangles
4. Verify colors correspond to altitude classes
5. Click on a satellite, verify detail panel shows all required fields
6. Apply filters (category, altitude range), verify results update
7. Open WebSocket (browser DevTools → Network), verify position updates every 5 seconds
8. Verify "data age" displays correctly and updates as TLE ages
9. Verify API responses match schema

### Data Quality Checks (Fetcher)
- TLE format validation
- NORAD catalog ID range validation
- Orbit class computation verification
- Category classification consistency
- Data source freshness tracking

### API Contract Tests
- All endpoints return correct schema
- Filters work as documented
- Pagination limits work
- WebSocket connects, subscribes, and streams
- Error handling for invalid requests

---

## Post-MVP Enhancements

1. **Starlink Constellation Links**: Draw estimated neighbor links (labeled "estimated")
2. **Historical Playback**: Scrub time slider to see past positions
3. **Collision Prediction**: Alert if objects come within risk threshold
4. **Advanced Analytics**: Density heatmaps, orbit class distribution, operator breakdowns
5. **Mobile Optimization**: Touch-friendly filters and detail panels
6. **High-Precision Ephemeris**: Optional use of JPL Horizons or higher-order propagation
7. **User Annotations**: Save custom bookmarks or notes on objects

---

## Non-Functional Requirements

### Performance
- API responses for 5000+ objects < 500 ms
- WebSocket position updates streamed in < 100 ms
- Cesium rendering 1000+ satellites smoothly (60 FPS on modern hardware)
- Position computation via SGP4 < 10 ms per object

### Reliability
- Orbital data refreshed automatically every 6–24 hours
- Graceful degradation if Space-Track unavailable
- Positions recomputed fresh on each API request (no stale cached positions)
- Data age clearly communicated to user

### Security
- No API keys logged or printed
- Space-Track credentials stored only in environment variables
- No private/classified data exposed
- API authentication via existing GOD EYES auth layer

### Data Freshness
- Display "data age" to user (e.g., "TLE data is 3 hours old")
- Use latest TLE available, don't assume real-time sensors
- If TLE older than 7 days, flag as "stale"

---

## Success Criteria

✅ Layer renders on globe with correct visual design
✅ All objects load and display metadata correctly
✅ Filters work as designed
✅ WebSocket delivers position updates
✅ Detail panel shows all required fields
✅ API responses conform to schema
✅ Manual browser verification passes
✅ No API keys exposed
✅ Data age/freshness clearly communicated
✅ Spec completed without implementation

---

## References & Resources

- **CelesTrak**: https://celestrak.org/
- **Space-Track**: https://www.space-track.org/
- **SGP4/SDP4 Propagation**: https://github.com/skyfielders/python-skyfield or similar library
- **Cesium.js**: https://cesium.com/docs/cesiumjs-ref-doc/
- **NORAD Two-Line Element Set Format**: https://www.celestrak.org/NORAD/documentation/
- **GOD EYES AGENTS.md**: Control registry and multi-agent workflow
- **GOD EYES MVP_LAYER_REGISTRY.md**: Authoritative layer definitions

---

**Specification Status**: ✅ Complete (specification only, no implementation)
