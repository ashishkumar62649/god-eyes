# Database Schema Specification: Layer 05 Space & Satellites

**Lane Owner**: Codex  
**Status**: Specification (Not Implemented)

---

## Overview

The database schema for Space & Satellites MVP stores:
1. **Orbital object catalog** (satellites, debris, rocket bodies)
2. **Orbital elements** (TLE data, apogee/perigee, inclination, etc.)
3. **Metadata** (categories, operators, importance flags)
4. **Temporal tracking** (when data was fetched, last updated)

Positions are **computed on-the-fly** from TLE data using SGP4, not stored in database.

---

## Schema Design Principles

1. **Single Source of Truth**: One `orbital_objects` table holds canonical orbital data
2. **Immutable TLE History** (optional): Archive old TLEs in separate table for historical queries
3. **Layer-aware**: All tables include `layer_id = 'layer_05_space_satellites'`
4. **Source-agnostic**: Support multiple data sources (CelesTrak, Space-Track, future sources)
5. **Efficient Filtering**: Indexes on `category`, `object_type`, `orbit_class` for fast queries
6. **No Position Storage**: Positions computed on demand via API using SGP4

---

## Core Tables

### 1. `orbital_objects` (Main Catalog)

Stores metadata and orbital elements for each tracked object.

```sql
CREATE TABLE layer_05_space_satellites.orbital_objects (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Layer & Source
  layer_id VARCHAR(64) NOT NULL DEFAULT 'layer_05_space_satellites',
  source_id VARCHAR(64) NOT NULL,  -- e.g., 'celestrak', 'space-track', 'norad'
  source_object_id VARCHAR(256) NOT NULL,  -- NORAD catalog number or source-specific ID
  
  -- Identification
  name VARCHAR(256) NOT NULL,  -- e.g., 'STARLINK-1001', 'ISS', 'DEBRIS-2023-001'
  norad_catalog_id INT UNIQUE,  -- NORAD Catalog Number (official identifier)
  international_designator VARCHAR(32),  -- e.g., '2020-001A'
  object_type VARCHAR(32) NOT NULL,  -- 'PAYLOAD', 'ROCKET BODY', 'DEBRIS', 'UNKNOWN'
  
  -- Categorization
  category VARCHAR(64),  -- e.g., 'STARLINK', 'COMMUNICATIONS', 'NAVIGATION', 'WEATHER', 'EARTH_OBSERVATION', 'SCIENCE', 'CREWED', 'DEBRIS', 'ROCKET_BODY', 'INACTIVE', 'UNKNOWN'
  operator VARCHAR(256),  -- e.g., 'SpaceX', 'Intelsat', 'NOAA', 'ESA', 'JAXA'
  mission VARCHAR(256),  -- e.g., 'Starlink Batch 1', 'ASTRA-1H', 'GPS IIF-7'
  importance_flag BOOLEAN DEFAULT FALSE,  -- highlight in UI (ISS, major operators, etc.)
  
  -- Orbital Elements (TLE Line 1 & 2)
  tle_line_1 TEXT,  -- SGP4 Line 1 (required for propagation)
  tle_line_2 TEXT,  -- SGP4 Line 2 (required for propagation)
  tle_epoch TIMESTAMP,  -- When this TLE set was valid (Epoch of TLE)
  
  -- Derived Orbital Parameters
  semi_major_axis_km FLOAT,  -- In kilometers
  apogee_km FLOAT,  -- Apogee altitude (km above sea level)
  perigee_km FLOAT,  -- Perigee altitude (km above sea level)
  inclination_degrees FLOAT,  -- Orbital inclination (0–180°)
  eccentricity FLOAT,  -- Eccentricity (0=circular, 1=parabolic)
  mean_motion_revs_per_day FLOAT,  -- Revolutions per day (from TLE)
  
  -- Current State (Computed at Last Update)
  estimated_altitude_km FLOAT,  -- Average altitude at last compute time
  orbit_class VARCHAR(16),  -- 'VLEO' (< 400km), 'LEO' (400–2000km), 'MEO' (2000–35786km), 'GEO' (~35786km), 'HEO' (> 35786km), 'UNKNOWN'
  estimated_speed_km_s FLOAT,  -- Average orbital speed at last compute time
  last_position_update TIMESTAMP,  -- When we last computed position
  
  -- Provenance & Freshness
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  source_last_refreshed TIMESTAMP,  -- When we fetched this from CelesTrak/Space-Track
  
  -- Unique Constraint
  UNIQUE KEY uk_source_object (source_id, source_object_id),
  
  -- Indexes for Fast Filtering
  INDEX idx_layer_id (layer_id),
  INDEX idx_source_id (source_id),
  INDEX idx_norad_catalog_id (norad_catalog_id),
  INDEX idx_name (name),
  INDEX idx_category (category),
  INDEX idx_object_type (object_type),
  INDEX idx_orbit_class (orbit_class),
  INDEX idx_operator (operator),
  INDEX idx_importance_flag (importance_flag),
  INDEX idx_updated_at (updated_at),
  
  -- Foreign Key (optional, if layer registry exists)
  -- FOREIGN KEY (layer_id) REFERENCES layer_registry(layer_id)
  
  CONSTRAINT ck_object_type CHECK (object_type IN ('PAYLOAD', 'ROCKET BODY', 'DEBRIS', 'UNKNOWN')),
  CONSTRAINT ck_eccentricity CHECK (eccentricity >= 0 AND eccentricity <= 1),
  CONSTRAINT ck_inclination CHECK (inclination_degrees >= 0 AND inclination_degrees <= 180)
);
```

**Notes**:
- `norad_catalog_id` is the official NORAD Catalog Number (unique worldwide)
- `source_object_id` may differ per source (some sources use alternate IDs)
- `tle_line_1` and `tle_line_2` are **required** for SGP4 propagation
- `estimated_altitude_km` and `estimated_speed_km_s` are **snapshots** at last update; real-time values computed on-demand in API
- `orbit_class` is computed from `semi_major_axis_km` using fixed ranges

---

### 2. `orbital_tle_history` (Optional, for Historical Queries)

Stores historical TLE snapshots for each object (enables future playback features).

```sql
CREATE TABLE layer_05_space_satellites.orbital_tle_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orbital_object_id UUID NOT NULL,
  
  -- TLE Snapshot
  tle_line_1 TEXT NOT NULL,
  tle_line_2 TEXT NOT NULL,
  tle_epoch TIMESTAMP NOT NULL,  -- Valid epoch of this TLE
  
  -- Derived Elements
  semi_major_axis_km FLOAT,
  apogee_km FLOAT,
  perigee_km FLOAT,
  inclination_degrees FLOAT,
  eccentricity FLOAT,
  mean_motion_revs_per_day FLOAT,
  
  -- Metadata
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  source_id VARCHAR(64),
  
  FOREIGN KEY (orbital_object_id) REFERENCES orbital_objects(id) ON DELETE CASCADE,
  INDEX idx_orbital_object_id (orbital_object_id),
  INDEX idx_tle_epoch (tle_epoch),
  INDEX idx_fetched_at (fetched_at)
);
```

**Purpose**: Archive old TLEs for future historical playback UI (post-MVP).

---

### 3. `orbital_positions_cache` (Optional, Performance Optimization)

Stores recently computed positions to reduce SGP4 computation on repeated queries.

```sql
CREATE TABLE layer_05_space_satellites.orbital_positions_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orbital_object_id UUID NOT NULL,
  
  -- Computed Position Snapshot
  latitude FLOAT NOT NULL,  -- -90 to +90
  longitude FLOAT NOT NULL,  -- -180 to +180
  altitude_km FLOAT,  -- Altitude above sea level (km)
  speed_km_s FLOAT,  -- Orbital velocity (km/s)
  heading_degrees FLOAT,  -- Direction of motion (0–360°, optional)
  
  -- Metadata
  computed_at TIMESTAMP NOT NULL,  -- When position was computed
  tle_age_hours INT,  -- Age of TLE used for computation
  
  FOREIGN KEY (orbital_object_id) REFERENCES orbital_objects(id) ON DELETE CASCADE,
  INDEX idx_orbital_object_id (orbital_object_id),
  INDEX idx_computed_at (computed_at)
);
```

**Strategy**:
- Cache positions for 5–10 seconds after compute
- Purge entries older than 1 hour
- Use cache to reduce redundant SGP4 calls within short time window
- Recompute if client requests position for different timestamp

---

## Derived/Computed Fields

These fields are **NOT stored raw** but computed when needed:

| Field | Computed From | When |
|-------|---|---|
| `orbit_class` | `semi_major_axis_km` (or apogee/perigee) | Insert/update of orbital_objects |
| `estimated_altitude_km`, `estimated_speed_km_s` | TLE + SGP4 propagation | On API request (fresh) |
| `data_age_hours` | `source_last_refreshed` vs current time | On API response |
| Position (lat/lon) | TLE + SGP4 propagation + time | On API request (fresh) |

---

## Orbit Class Computation

Map `semi_major_axis_km` to `orbit_class`:

```python
def compute_orbit_class(semi_major_axis_km: float) -> str:
    """
    Classify orbit by semi-major axis.
    SMA relates to altitude: altitude ≈ SMA - Earth_radius (6371 km)
    """
    # Earth radius + orbit altitude ranges
    earth_radius = 6371
    altitude = semi_major_axis_km - earth_radius
    
    if altitude < 400:
        return 'VLEO'  # Very Low Earth Orbit
    elif altitude < 2000:
        return 'LEO'   # Low Earth Orbit
    elif altitude < 35786:
        return 'MEO'   # Medium Earth Orbit (35786 is GEO height)
    elif 35700 <= altitude <= 36000:
        return 'GEO'   # Geostationary (within ~300 km)
    else:
        return 'HEO'   # High/Elliptical Orbit
```

---

## Category Classification Rules

Normalizer applies these rules (priority order):

```
1. IF name CONTAINS 'STARLINK' OR operator = 'SpaceX' → category = 'STARLINK'
2. IF category = 'COMMUNICATIONS' → category = 'COMMUNICATIONS'
3. IF category = 'NAVIGATION' OR 'GPS' OR 'GALILEO' OR 'GLONASS' → category = 'NAVIGATION'
4. IF category = 'WEATHER' OR mission CONTAINS 'NOAA' → category = 'WEATHER'
5. IF category = 'EARTH_OBSERVATION' OR mission CONTAINS 'LANDSAT' OR 'SENTINEL' → category = 'EARTH_OBSERVATION'
6. IF category = 'SCIENCE' OR mission CONTAINS 'HUBBLE' OR 'CHANDRA' → category = 'SCIENCE'
7. IF name CONTAINS 'ISS' OR 'SPACE STATION' → category = 'CREWED', importance_flag = TRUE
8. IF object_type = 'DEBRIS' → category = 'DEBRIS'
9. IF object_type = 'ROCKET BODY' → category = 'ROCKET_BODY'
10. IF object_type = 'UNKNOWN' OR category NOT SET → category = 'UNKNOWN'
11. IF object_status = 'INACTIVE' OR object_status = 'DECAYED' → category = 'INACTIVE'
```

---

## Importance Flag Rules

Set `importance_flag = TRUE` for:
- ISS (International Space Station)
- Major space stations (Mir, Tiangong, etc.)
- Early warning satellites (DSCS, SPACECOM, etc.)
- Ground-based radar tracking satellites
- Large debris clusters
- Notable research missions (Hubble, JWST, etc.)

---

## Indexing Strategy

**Critical Indexes** (must have):
- `idx_layer_id`: Layer filtering
- `idx_source_id`: Source filtering
- `idx_category`: Category-based queries (highest cardinality)
- `idx_object_type`: Type filtering
- `idx_orbit_class`: Altitude-based filtering
- `idx_updated_at`: Find recently changed objects

**Secondary Indexes** (optional):
- `idx_operator`: Operator filtering
- `idx_importance_flag`: Quick lookup of highlighted objects
- `idx_name`: Free-text satellite search

---

## Constraints & Validation

**Check Constraints**:
- `eccentricity` must be in [0, 1]
- `inclination_degrees` must be in [0, 180]
- `object_type` must be one of: PAYLOAD, ROCKET BODY, DEBRIS, UNKNOWN
- `apogee_km` >= `perigee_km` (apogee is always higher)

**Unique Constraints**:
- `(source_id, source_object_id)` unique: no duplicate source objects
- `norad_catalog_id` unique (if present): NORAD ID is worldwide unique

---

## Data Retention & Cleanup

- **Active Objects**: Retain indefinitely; update on each refresh cycle
- **Decayed Objects**: Mark in metadata, optionally flag with `category = 'INACTIVE'`; retain for history
- **Old TLE History**: Purge entries older than 1 year (optional, for MVP may keep all)
- **Position Cache**: Purge entries older than 1 hour (automatic)

---

## Migration & Deployment Strategy

**MVP Deployment**:
1. Create core table `orbital_objects`
2. Create indexes
3. Create supporting tables (`orbital_tle_history`, `orbital_positions_cache`) if space/performance permits
4. Seed with initial CelesTrak data fetch

**Post-MVP Enhancements**:
- Trigger for `updated_at` auto-update
- View for objects grouped by category
- Materialized view for frequently-queried statistics (e.g., count by category)
- Partitioning by `category` if table grows large (>1M rows)

---

## Example Queries

### Find all active Starlink satellites
```sql
SELECT id, name, norad_catalog_id, estimated_altitude_km, orbit_class
FROM layer_05_space_satellites.orbital_objects
WHERE category = 'STARLINK' AND object_type = 'PAYLOAD'
ORDER BY estimated_altitude_km DESC;
```

### Find all debris in LEO
```sql
SELECT id, name, estimated_altitude_km, perigee_km, apogee_km
FROM layer_05_space_satellites.orbital_objects
WHERE orbit_class = 'LEO' AND (object_type IN ('DEBRIS', 'ROCKET BODY') OR category = 'DEBRIS')
LIMIT 100;
```

### Find recently updated objects
```sql
SELECT id, name, category, updated_at
FROM layer_05_space_satellites.orbital_objects
WHERE updated_at > NOW() - INTERVAL '24 hours'
ORDER BY updated_at DESC;
```

### Count objects by category
```sql
SELECT category, COUNT(*) as count
FROM layer_05_space_satellites.orbital_objects
GROUP BY category
ORDER BY count DESC;
```

### Find important satellites
```sql
SELECT id, name, category, importance_flag
FROM layer_05_space_satellites.orbital_objects
WHERE importance_flag = TRUE
ORDER BY category;
```

---

## Performance Targets

- **Single-object lookup** by `id` or `norad_catalog_id`: < 10 ms
- **Category filter on 5000+ objects**: < 100 ms
- **Altitude range query**: < 200 ms
- **Count-by-category aggregation**: < 500 ms

---

**Schema Status**: ✅ Specification complete  
**Implementation Status**: ⏳ Pending (Codex lane)  
**Review Status**: ⏳ Pending (Claude Haiku 4.5)
