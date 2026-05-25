# WO-069 MVP Live Source Research and Catalog Plan

## 1. Executive Summary

Based on research, the recommended first live layer is **Earth Events** (layer_03_earth_events). This layer provides:
- Public, safe, low-risk data sources
- High demo value with earthquakes, volcanoes, storms, and fires
- Easy to visualize with point/polygon markers
- Low rendering risk and 60 FPS safe
- Free and open data with clear licensing
- Multiple high-quality sources (USGS, NASA FIRMS, etc.)

## 2. Source Candidate Table

| Layer | Source | Static/Live | Format | Rate Limit | License Risk | Safety Risk | MVP Decision |
|-------|--------|-------------|--------|------------|--------------|-------------|--------------|
| layer_03_earth_events | USGS Earthquake Hazards Program | Live | GeoJSON, CSV, ATOM | None (public) | Public Domain | Very Low | **Use Now** |
| layer_03_earth_events | NASA FIRMS (Fire Information for Resource Management System) | Live | CSV, KML, SHP, WMS | None (public) | Public Domain | Very Low | **Use Now** |
| layer_03_earth_events | Smithsonian Global Volcanism Program | Live | Web API, KML | None (public) | Public Domain | Very Low | **Use Later** |
| layer_05_space_satellites | Space-Track.org (TLE data) | Live | JSON, TLE | Free account required | US Government | Low | **Use Later** |
| layer_06_maritime | VesselFinder | Live | Web API, Map | Free tier limited | Commercial | Medium | **Use Later** |
| layer_08_news_osint | GDELT Project | Live | BigQuery, CSV, API | None (public) | Public Domain | Medium | **Use Later** |
| layer_04_public_military_security | MilitaryBases.com | Static | Web pages | None | Public Domain | Low | **Use Later** |
| layer_04_public_military_security | GlobalSecurity.org | Static | Web pages | None | Public Domain | Low | **Use Later** |
| layer_02_borders_boundaries | Natural Earth Data | Static | Shapefile, GeoJSON | None (public) | Public Domain | Very Low | **Use Now** |

## 3. Recommended First Live Layer

**Earth Events (layer_03_earth_events)** should be implemented first because:

- **Public and Safe**: All sources are US government public domain with no licensing restrictions
- **Low Rendering Risk**: Events are points or simple polygons, easy to render at 60 FPS
- **High Demo Value**: Earthquakes, volcanoes, storms, and fires are visually compelling and relevant
- **Easy Implementation**: Multiple well-documented APIs with stable formats
- **Clear Safety**: No sensitive data, all events are publicly reported natural phenomena
- **Technical Simplicity**: Simple geometry types (points, circles, polygons) with moderate update frequency

## 4. Source Catalog Plan

For each approved source, create a JSON configuration file in `packages/source-catalog/layers/` following the pattern of `ourairports.json`:

```json
{
  "layer_id": "layer_03_earth_events",
  "source_id": "usgs_earthquakes",
  "source_name": "USGS Earthquake Hazards Program",
  "source_type": "earthquake_monitor",
  "owner": "Codex data pipeline",
  "license": {
    "name": "Public Domain",
    "attribution": "USGS Earthquake Hazards Program",
    "terms_url": "https://earthquake.usgs.gov"
  },
  "source_urls": {
    "geojson_summary": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",
    "csv_summary": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.csv"
  },
  "refresh_policy": {
    "cadence": "every_5_minutes",
    "manual_refresh_allowed": false,
    "schedule_note": "Updates every 5 minutes, 24/7"
  },
  "freshness_policy": {
    "fresh_for_days": 1,
    "stale_after_days": 2,
    "notes": "Live data stream, should be refreshed frequently"
  },
  "raw_storage": {
    "bucket": "god-eyes-raw",
    "path_pattern": "raw/layer_03_earth_events/usgs_earthquakes/{yyyy}/{mm}/{dd}/{fetch_run_id}/{filename}"
  },
  "expected_files": [
    {
      "filename": "all_day.geojson",
      "required_columns": ["mag", "place", "time", "updated", "tz", "url", "detail", "felt", "cdi", "mmi", "alert", "status", "tsunami", "sig", "net", "code", "ids", "sources", "types", "nst", "dmin", "rms", "gap", "magType", "type", "geometry"]
    }
  ],
  "collector": {
    "name": "usgs_earthquakes_collector",
    "path": "services/fetch-orchestrator/src/layers/layer_03_earth_events/usgs_earthquakes_collector.py",
    "manual_command": "python services/fetch-orchestrator/src/layers/layer_03_earth_events/usgs_earthquakes_collector.py"
  },
  "validator": {
    "name": "usgs_earthquakes_validator",
    "path": "packages/schemas/layers/layer_03_earth_events/usgs_earthquakes.py"
  },
  "normalizer": {
    "name": "usgs_earthquakes_normalizer",
    "path": "services/normalizer/src/layers/layer_03_earth_events/usgs_earthquakes_normalizer.py",
    "manual_command": "python services/normalizer/src/layers/layer_03_earth_events/usgs_earthquakes_normalizer.py --fetch-run-id <fetch_run_id>"
  },
  "target_tables": [
    "earth_events_earthquakes"
  ],
  "notes": [
    "Live earthquake data from USGS.",
    "Public domain with no restrictions.",
    "Geometry: Point with depth coordinate.",
    "Update frequency: Every 5 minutes."
  ]
}
```

## 5. Database Pattern Recommendation

### For Earth Events Layer

**Latest Table:**
```sql
CREATE TABLE earth_events_earthquakes (
    id SERIAL PRIMARY KEY,
    layer_id VARCHAR(50) NOT NULL,
    source_id VARCHAR(50) NOT NULL,
    event_id VARCHAR(100) NOT NULL,
    mag DECIMAL(3,1),
    place VARCHAR(500),
    time BIGINT,
    updated BIGINT,
    tz INTEGER,
    url VARCHAR(500),
    detail VARCHAR(500),
    felt INTEGER,
    cdi DECIMAL(3,1),
    mmi DECIMAL(3,1),
    alert VARCHAR(50),
    status VARCHAR(50),
    tsunami BOOLEAN,
    sig INTEGER,
    net VARCHAR(50),
    code VARCHAR(50),
    ids VARCHAR(200),
    sources VARCHAR(200),
    types VARCHAR(200),
    nst INTEGER,
    dmin DECIMAL(10,6),
    rms DECIMAL(3,1),
    gap DECIMAL(5,2),
    mag_type VARCHAR(20),
    event_type VARCHAR(50),
    geometry GEOMETRY(Point, 4326),
    geometry_depth GEOMETRY(Point, 4326), -- For depth
    fetched_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(layer_id, source_id, event_id)
);
```

**History Table (later):**
```sql
CREATE TABLE earth_events_earthquakes_history (
    id SERIAL PRIMARY KEY,
    layer_id VARCHAR(50) NOT NULL,
    source_id VARCHAR(50) NOT NULL,
    event_id VARCHAR(100) NOT NULL,
    mag DECIMAL(3,1),
    place VARCHAR(500),
    time BIGINT,
    updated BIGINT,
    -- ... other fields ...
    geometry GEOMETRY(Point, 4326),
    fetched_at TIMESTAMP,
    created_at TIMESTAMP,
    UNIQUE(layer_id, source_id, event_id, created_at)
);
```

**Fetch Runs Table:**
```sql
CREATE TABLE fetch_runs (
    id SERIAL PRIMARY KEY,
    layer_id VARCHAR(50) NOT NULL,
    source_id VARCHAR(50) NOT NULL,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    status VARCHAR(20),
    records_fetched INTEGER,
    errors TEXT
);
```

**Geometry/Index Requirements:**
- Use PostGIS for spatial queries
- Create GIST index on geometry column
- Consider BRIN index for time-based queries
- For earthquakes, spatial queries by magnitude radius are common

### For Other Layers (similar patterns)

## 6. API Pattern Recommendation

### For Earth Events Layer

**Endpoint Idea:**
```
GET /api/v1/earth-events/earthquakes
```

**Query Parameters:**
- `bbox`: Bounding box coordinates (minLon,minLat,maxLon,maxLat)
- `limit`: Maximum number of events (default: 100, max: 1000)
- `since`: Timestamp in milliseconds (fetch events updated after this time)
- `minmag`: Minimum magnitude filter
- `maxmag`: Maximum magnitude filter

**Payload Limits:**
- Default limit: 100 events
- Maximum limit: 1000 events
- Cache TTL: 30 seconds for live data

**Response Format:**
```json
{
  "type": "FeatureCollection",
  "metadata": {
    "generated": 1715800000000,
    "url": "/api/v1/earth-events/earthquakes",
    "title": "USGS Earthquakes",
    "count": 50
  },
  "features": [
    {
      "type": "Feature",
      "properties": {
        "mag": 4.5,
        "place": "10km ENE of Fremont, California",
        "time": 1715799000000,
        "url": "https://earthquake.usgs.gov/earthquakes/eventpage/nn00123456",
        "detail": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/nn00123456.geojson",
        "alert": "green",
        "status": "automatic",
        "tsunami": 0,
        "sig": 385,
        "type": "earthquake"
      },
      "geometry": {
        "type": "Point",
        "coordinates": [-121.95, 37.55, 8.9]
      },
      "id": "nn00123456"
    }
  ]
}
```

## 7. Frontend Pattern Recommendation

### For Earth Events Layer

**Marker Type:**
- Use circle markers with size proportional to magnitude
- Color code based on alert level (green, yellow, orange, red)
- Add depth indicator (darker for deeper earthquakes)

**Clustering/LOD:**
- No clustering needed for earthquakes (sparse distribution)
- Use level-of-detail: show all events globally, but limit to 100 for performance
- For local views, show all events in the area

**60 FPS Risk:**
- Low risk: Simple circle markers, easy to render
- Use WebGL for large numbers (>1000 events)
- Debounce updates: only update markers when data changes significantly

**Detail Panel Fields:**
- Magnitude
- Location (with map link)
- Depth
- Time (relative: "X minutes ago")
- Event type
- Significance (sig)
- URL to USGS event page
- Aftershock probability if available

## 8. Safety Rules

### For Military/Security Layer (layer_04_public_military_security)

**Public-Only Data:**
- Only use sources that explicitly publish data in the public domain
- No classified, sensitive, or operational data
- Focus on permanent facilities: bases, airfields, administrative buildings
- No live tracking of personnel or equipment

**Static-Only for MVP:**
- Use static datasets (once compiled, rarely change)
- No live feeds or real-time updates
- Update frequency: quarterly or semi-annually
- Geometry: Points for bases, polygons for restricted zones

**Forbidden Data:**
- No tactical information
- No operational readiness data
- No troop movements or exercises
- No satellite positions or capabilities
- No intelligence gathering details

## 9. Implementation Work Orders

### WO-070: First Source Catalog Registration

**Tasks:**
1. Create `packages/source-catalog/layers/layer_03_earth_events/usgs_earthquakes.json`
2. Register source in system
3. Create database table `earth_events_earthquakes`
4. Write integration tests

**Dependencies:** None

### WO-071: First Live Earth Events Fetcher

**Tasks:**
1. Create `services/fetch-orchestrator/src/layers/layer_03_earth_events/usgs_earthquakes_collector.py`
2. Implement fetching from USGS GeoJSON feeds
3. Add error handling and retry logic
4. Write raw data to S3 bucket
5. Create unit tests

**Dependencies:** WO-070

### WO-072: Earth Events Latest Table

**Tasks:**
1. Create `earth_events_earthquakes` table in database
2. Implement validation schema
3. Create normalizer: `services/normalizer/src/layers/layer_03_earth_events/usgs_earthquakes_normalizer.py`
4. Add database migrations
5. Write integration tests

**Dependencies:** WO-071

### WO-073: Earth Events API

**Tasks:**
1. Create API endpoints in `apps/api/`:
   - `GET /api/v1/earth-events/earthquakes`
   - `GET /api/v1/earth-events/volcanoes` (later)
2. Implement query parameter filtering (bbox, limit, minmag)
3. Add caching layer (Redis)
4. Implement rate limiting
5. Write API tests

**Dependencies:** WO-072

### WO-074: Earth Events Frontend Markers

**Tasks:**
1. Create React components for earthquake markers
2. Implement magnitude-based sizing and color coding
3. Add detail panel with event information
4. Create map layer integration
5. Write frontend tests

**Dependencies:** WO-073

## 10. Final Recommendation

### Which live data source should be implemented first?
**USGS Earthquake Data** should be implemented first. It's public domain, freely available, has stable APIs, and provides immediate value with low implementation risk.

### Which should be avoided today?
**GDELT** and **Space-Track** should be avoided initially due to complexity and potential licensing considerations. Start with simpler, clearly licensed sources.

### Which need paid/commercial access?
- **VesselFinder**: Free tier limited, commercial API for full access
- **Space-Track**: Free account available but limited, professional access may require approval
- **FIRMS**: Free for research, but commercial use may require licensing

### Which are safe for manager demo?
**Earth Events (USGS + NASA FIRMS)** are absolutely safe for demos:
- All data is US government public domain
- No sensitive information
- Visually compelling and easy to understand
- Demonstrates real-time capabilities effectively