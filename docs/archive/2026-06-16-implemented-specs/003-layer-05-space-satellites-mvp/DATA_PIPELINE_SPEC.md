# Data Pipeline Specification: Layer 05 Space & Satellites

**Lane Owner**: MiniMax (Fetcher & Normalizer)  
**Status**: Specification (Not Implemented)

---

## Overview

The data pipeline for Space & Satellites consists of:

1. **Fetcher**: Retrieves raw orbital data from CelesTrak and Space-Track
2. **Normalizer**: Parses, validates, and classifies objects
3. **Database Sink**: Hands off normalized data to Codex (database agent)

Data flows: **Source → Raw Storage → Normalizer → Database**

---

## Data Sources

### Primary: CelesTrak

**Endpoint**: https://celestrak.org/  
**Data**: TLE sets, satellite catalogs, object metadata  
**Frequency**: Daily or every 6 hours  
**Authentication**: None (public data)

**Available Endpoints**:
- https://celestrak.org/data/satellites.json (all TLEs)
- https://celestrak.org/data/active.txt (active TLE list)
- https://celestrak.org/data/payloads.txt (payload TLE list)
- https://celestrak.org/data/debris.txt (debris TLE list)
- https://celestrak.org/data/rocketbodies.txt (rocket body TLE list)
- https://celestrak.org/satcat/formats/json/satcat.json (satellite catalog)

**Example Data**:
```
STARLINK-1001
1 44713U 20001A   26152.41667476  .00001234  00000-0  12345-4 0  9990
2 44713  53.0533 123.4567 0001234  45.6789 314.3210 15.06387234123456
```

---

### Secondary: Space-Track (Authenticated)

**Endpoint**: https://www.space-track.org/  
**Data**: High-precision TLE, object metadata, decay dates  
**Frequency**: Daily or on-demand  
**Authentication**: Username/password (environment variables only)

**Environment Variables** (never committed):
```
SPACE_TRACK_USERNAME=<username>
SPACE_TRACK_PASSWORD=<password>
```

**API Endpoints**:
- `/basicspacedata/query/class/satcat/` (satellite catalog)
- `/basicspacedata/query/class/tle/` (TLE queries)
- `/basicspacedata/query/class/tle_latest/` (latest TLE)

---

## Fetcher Responsibilities

### 1. Initialization

On startup (or scheduled):

```
1. Load source configuration (CelesTrak endpoints, Space-Track credentials)
2. Check local raw storage state (last fetch timestamps)
3. Determine which sources need updates (based on age)
4. Start fetch cycle
```

### 2. Fetch from CelesTrak

```python
def fetch_celestrak():
    """Fetch satellite data from CelesTrak."""
    
    sources = [
        {
            'name': 'active',
            'url': 'https://celestrak.org/data/active.txt',
            'type': 'tle',
            'object_type': 'PAYLOAD'
        },
        {
            'name': 'debris',
            'url': 'https://celestrak.org/data/debris.txt',
            'type': 'tle',
            'object_type': 'DEBRIS'
        },
        {
            'name': 'rocketbodies',
            'url': 'https://celestrak.org/data/rocketbodies.txt',
            'type': 'tle',
            'object_type': 'ROCKET BODY'
        },
        {
            'name': 'satcat',
            'url': 'https://celestrak.org/satcat/formats/json/satcat.json',
            'type': 'catalog',
            'object_type': None
        }
    ]
    
    for source in sources:
        try:
            response = requests.get(source['url'], timeout=30)
            response.raise_for_status()
            
            # Store raw data
            store_raw_data(
                source_id='celestrak',
                source_name=source['name'],
                data=response.text,
                timestamp=datetime.utcnow()
            )
            
            # Notify normalizer
            queue_normalization_job(
                source_id='celestrak',
                source_name=source['name'],
                object_type=source['object_type']
            )
            
        except Exception as e:
            log_error(f"Failed to fetch {source['name']}: {e}")
```

### 3. Fetch from Space-Track (Optional)

```python
def fetch_space_track():
    """Fetch satellite data from Space-Track (authenticated)."""
    
    username = os.getenv('SPACE_TRACK_USERNAME')
    password = os.getenv('SPACE_TRACK_PASSWORD')
    
    if not username or not password:
        log_warning("Space-Track credentials not configured, skipping")
        return
    
    session = requests.Session()
    session.auth = (username, password)
    
    try:
        # Fetch satellite catalog
        response = session.get(
            'https://www.space-track.org/basicspacedata/query/class/satcat/',
            params={'format': 'json'},
            timeout=30
        )
        response.raise_for_status()
        
        store_raw_data(
            source_id='space-track',
            source_name='satcat',
            data=response.text,
            timestamp=datetime.utcnow()
        )
        
        queue_normalization_job(
            source_id='space-track',
            source_name='satcat',
            object_type=None
        )
        
    except Exception as e:
        log_error(f"Failed to fetch Space-Track data: {e}")
```

### 4. Raw Storage

Store fetched data locally before normalization:

```
raw/
  layer_05_space_satellites/
    celestrak/
      active/
        2026-05-31T10-00-00Z.txt
        2026-05-30T10-00-00Z.txt
      debris/
        2026-05-31T10-00-00Z.txt
      rocketbodies/
        2026-05-31T10-00-00Z.txt
      satcat/
        2026-05-31T10-00-00Z.json
    space-track/
      satcat/
        2026-05-31T10-00-00Z.json
```

**Retention**: Keep latest 7 days of raw data (optional).

---

## Normalizer Responsibilities

### 1. Input

Receives raw data from fetcher:
- TLE text files (two-line format)
- JSON satellite catalog

### 2. Parsing & Validation

#### TLE Parsing

```python
def parse_tle(tle_text):
    """
    Parse a Two-Line Element set.
    
    Format:
      Line 0: Satellite name (max 24 chars)
      Line 1: TLE line 1
      Line 2: TLE line 2
    """
    lines = tle_text.strip().split('\n')
    
    if len(lines) < 2:
        raise ValueError("Invalid TLE: requires at least 2 lines")
    
    name = lines[0].strip()
    tle_line_1 = lines[1].strip()
    tle_line_2 = lines[2].strip()
    
    # Validate format
    if not tle_line_1.startswith('1 '):
        raise ValueError("Invalid TLE line 1 format")
    if not tle_line_2.startswith('2 '):
        raise ValueError("Invalid TLE line 2 format")
    
    # Extract key fields
    try:
        norad_catalog_id = int(tle_line_1[2:7].strip())
        intl_designator = tle_line_1[9:17].strip()
        epoch_year = int(tle_line_1[18:20])
        epoch_day = float(tle_line_1[20:32])
        inclination = float(tle_line_2[8:16])
        eccentricity = float('0.' + tle_line_2[26:33])
        mean_motion = float(tle_line_2[52:63])
        
        # Compute epoch timestamp
        year = 2000 + epoch_year if epoch_year < 70 else 1900 + epoch_year
        epoch = datetime(year, 1, 1) + timedelta(days=epoch_day - 1)
        
        return {
            'name': name,
            'norad_catalog_id': norad_catalog_id,
            'international_designator': intl_designator,
            'tle_line_1': tle_line_1,
            'tle_line_2': tle_line_2,
            'tle_epoch': epoch,
            'inclination_degrees': inclination,
            'eccentricity': eccentricity,
            'mean_motion_revs_per_day': mean_motion
        }
    except (ValueError, IndexError) as e:
        raise ValueError(f"Failed to parse TLE fields: {e}")
```

#### Catalog Parsing

```python
def parse_satcat_json(satcat_json):
    """Parse CelesTrak or Space-Track satellite catalog."""
    
    catalog = json.loads(satcat_json)
    objects = []
    
    for item in catalog:
        obj = {
            'norad_catalog_id': int(item.get('NORAD_CAT_ID')),
            'name': item.get('SATNAME'),
            'international_designator': item.get('INTLDES'),
            'object_type': item.get('OBJECT_TYPE', 'UNKNOWN'),
            'country': item.get('COUNTRY_CODE'),
            'operator': item.get('OPERATOR'),
            'launch_date': item.get('LAUNCH_DATE'),
            'decay_date': item.get('DECAY_DATE')
        }
        objects.append(obj)
    
    return objects
```

### 3. Orbital Element Computation

```python
def compute_orbital_elements(tle_line_1, tle_line_2):
    """
    Extract and compute orbital elements from TLE.
    Uses SGP4 propagation library to derive additional parameters.
    """
    from skyfield.api import EarthSatellite, wgs84
    from datetime import datetime, timezone
    
    # Create satellite from TLE
    sat = EarthSatellite(tle_line_1, tle_line_2)
    
    # Compute at TLE epoch
    ts = skyfield.load.timescale()
    t = ts.utc(*sat.epoch.timetuple()[:6])
    
    # Propagate to get position/velocity
    geocentric = sat.at(t)
    
    # Extract orbital parameters
    position = geocentric.position.km
    velocity = geocentric.velocity.km_per_s
    
    # Compute semi-major axis
    # a = GM / (v^2 - 2*GM/r)
    r = np.linalg.norm(position)
    v = np.linalg.norm(velocity)
    
    mu = 398600.4418  # GM Earth (km^3/s^2)
    semi_major_axis = 1.0 / (2.0/r - v**2 / mu)
    
    # Earth's equatorial radius
    earth_radius = 6378.137
    altitude = semi_major_axis - earth_radius
    
    return {
        'semi_major_axis_km': semi_major_axis,
        'apogee_km': altitude,  # Simplified; real apogee uses eccentricity
        'perigee_km': altitude,  # Simplified
        'orbital_velocity_km_s': v
    }
```

### 4. Orbit Class Computation

```python
def compute_orbit_class(semi_major_axis_km):
    """Classify orbit by semi-major axis."""
    
    earth_radius = 6371
    altitude = semi_major_axis_km - earth_radius
    
    if altitude < 400:
        return 'VLEO'
    elif altitude < 2000:
        return 'LEO'
    elif altitude < 35786:
        return 'MEO'
    elif 35700 <= altitude <= 36000:
        return 'GEO'
    else:
        return 'HEO'
```

### 5. Category Classification

```python
def classify_object(obj_dict):
    """
    Classify object into category based on name, operator, mission.
    
    Priority rules:
    1. Starlink (name contains 'STARLINK' OR operator = 'SpaceX')
    2. Communications (category = 'COMMS' OR operator = 'Intelsat', etc.)
    3. Navigation (GPS, GALILEO, GLONASS, BEIDOU)
    4. Weather (NOAA, Meteosat, etc.)
    5. Earth Observation (Landsat, Sentinel, etc.)
    6. Science (Hubble, JWST, etc.)
    7. Crewed (ISS, space stations)
    8. Debris (object_type = 'DEBRIS')
    9. Rocket Body (object_type = 'ROCKET BODY')
    10. Inactive (object_type = 'UNKNOWN' OR no data)
    """
    
    name = obj_dict.get('name', '').upper()
    operator = obj_dict.get('operator', '').upper()
    object_type = obj_dict.get('object_type', 'UNKNOWN')
    
    # Rule 1: Starlink
    if 'STARLINK' in name or operator == 'SPACEX':
        return 'STARLINK', True if 'STARLINK' in name else False
    
    # Rule 2: Communications
    if operator in ['INTELSAT', 'SES', 'EUTELSAT', 'VIASAT']:
        return 'COMMUNICATIONS', False
    if 'COMSAT' in name or 'ASTRA' in name or 'INTELSAT' in name:
        return 'COMMUNICATIONS', False
    
    # Rule 3: Navigation
    if any(nav in name for nav in ['GPS', 'GALILEO', 'GLONASS', 'BEIDOU', 'NAVSTAR']):
        return 'NAVIGATION', False
    
    # Rule 4: Weather
    if any(weather in name for weather in ['NOAA', 'METEOSAT', 'GOES', 'HIMAWARI']):
        return 'WEATHER', False
    if operator in ['NOAA', 'EUMETSAT', 'JMA']:
        return 'WEATHER', False
    
    # Rule 5: Earth Observation
    if any(eo in name for eo in ['LANDSAT', 'SENTINEL', 'MODIS', 'AVIRIS']):
        return 'EARTH_OBSERVATION', False
    if operator in ['ESA', 'USGS', 'COPERNICUS']:
        return 'EARTH_OBSERVATION', False
    
    # Rule 6: Science
    if any(sci in name for sci in ['HUBBLE', 'JWST', 'CHANDRA', 'SWIFT']):
        return 'SCIENCE', True
    if operator == 'NASA' and 'SPACE TELESCOPE' in name:
        return 'SCIENCE', True
    
    # Rule 7: Crewed
    if 'ISS' in name or 'SPACE STATION' in name:
        return 'CREWED', True
    if operator in ['NASA', 'ROSCOSMOS'] and 'STATION' in name:
        return 'CREWED', True
    
    # Rule 8: Debris
    if object_type == 'DEBRIS':
        return 'DEBRIS', False
    
    # Rule 9: Rocket Body
    if object_type == 'ROCKET BODY':
        return 'ROCKET_BODY', False
    
    # Rule 10: Inactive or Unknown
    return 'UNKNOWN', False
```

### 6. Normalization Output

Output normalized object:

```python
def normalize_object(tle_dict, catalog_dict):
    """Combine TLE and catalog data into normalized object."""
    
    category, importance = classify_object({
        'name': tle_dict.get('name'),
        'operator': catalog_dict.get('operator'),
        'object_type': catalog_dict.get('object_type', 'UNKNOWN')
    })
    
    orbital_elements = compute_orbital_elements(
        tle_dict['tle_line_1'],
        tle_dict['tle_line_2']
    )
    
    orbit_class = compute_orbit_class(
        orbital_elements['semi_major_axis_km']
    )
    
    normalized = {
        'name': tle_dict['name'],
        'norad_catalog_id': tle_dict['norad_catalog_id'],
        'international_designator': tle_dict['international_designator'],
        'object_type': catalog_dict.get('object_type', 'UNKNOWN'),
        'category': category,
        'operator': catalog_dict.get('operator'),
        'mission': None,  # Optional: infer from name
        'importance_flag': importance,
        'tle_line_1': tle_dict['tle_line_1'],
        'tle_line_2': tle_dict['tle_line_2'],
        'tle_epoch': tle_dict['tle_epoch'],
        'semi_major_axis_km': orbital_elements['semi_major_axis_km'],
        'apogee_km': orbital_elements['apogee_km'],
        'perigee_km': orbital_elements['perigee_km'],
        'inclination_degrees': tle_dict['inclination_degrees'],
        'eccentricity': tle_dict['eccentricity'],
        'mean_motion_revs_per_day': tle_dict['mean_motion_revs_per_day'],
        'estimated_altitude_km': orbital_elements['apogee_km'],
        'estimated_speed_km_s': orbital_elements['orbital_velocity_km_s'],
        'orbit_class': orbit_class,
        'source_id': 'celestrak',  # or 'space-track'
        'source_last_refreshed': datetime.utcnow()
    }
    
    return normalized
```

### 7. Handoff to Database

```python
def send_to_database(normalized_objects):
    """
    Send normalized objects to database lane (Codex).
    
    Options:
    1. Direct database connection (if configured)
    2. Message queue / event bus
    3. File dump + manual pickup
    """
    
    # Option 1: Direct connection (simplest for MVP)
    try:
        db = psycopg2.connect(
            host=os.getenv('DB_HOST'),
            database=os.getenv('DB_NAME'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD')
        )
        cursor = db.cursor()
        
        for obj in normalized_objects:
            cursor.execute("""
                INSERT INTO layer_05_space_satellites.orbital_objects
                (id, layer_id, source_id, source_object_id, name, norad_catalog_id, 
                 international_designator, object_type, category, operator, mission,
                 importance_flag, tle_line_1, tle_line_2, tle_epoch,
                 semi_major_axis_km, apogee_km, perigee_km, inclination_degrees,
                 eccentricity, mean_motion_revs_per_day, estimated_altitude_km,
                 estimated_speed_km_s, orbit_class, source_last_refreshed)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (source_id, source_object_id)
                DO UPDATE SET
                  tle_line_1 = EXCLUDED.tle_line_1,
                  tle_line_2 = EXCLUDED.tle_line_2,
                  tle_epoch = EXCLUDED.tle_epoch,
                  estimated_altitude_km = EXCLUDED.estimated_altitude_km,
                  estimated_speed_km_s = EXCLUDED.estimated_speed_km_s,
                  source_last_refreshed = EXCLUDED.source_last_refreshed,
                  updated_at = NOW()
            """, (
                uuid.uuid4(), 'layer_05_space_satellites', obj['source_id'],
                str(obj['norad_catalog_id']), obj['name'], obj['norad_catalog_id'],
                obj['international_designator'], obj['object_type'], obj['category'],
                obj['operator'], obj['mission'], obj['importance_flag'],
                obj['tle_line_1'], obj['tle_line_2'], obj['tle_epoch'],
                obj['semi_major_axis_km'], obj['apogee_km'], obj['perigee_km'],
                obj['inclination_degrees'], obj['eccentricity'],
                obj['mean_motion_revs_per_day'], obj['estimated_altitude_km'],
                obj['estimated_speed_km_s'], obj['orbit_class'],
                obj['source_last_refreshed']
            ))
        
        db.commit()
        cursor.close()
        db.close()
        
        log_info(f"Inserted/updated {len(normalized_objects)} objects")
        
    except Exception as e:
        log_error(f"Failed to send to database: {e}")
        raise
```

---

## Scheduling & Frequency

**Fetch Cycle**:
- Run every **6 hours** for CelesTrak (public data, stable)
- Run every **24 hours** for Space-Track (secondary, optional)

**Normalization**:
- Runs immediately after fetch
- Processes all new objects

**Database Update**:
- Runs immediately after normalization
- Upserts (insert or update on conflict)

---

## Error Handling & Retries

```python
def fetch_with_retry(url, max_retries=3, backoff_factor=2):
    """Fetch with exponential backoff."""
    
    for attempt in range(max_retries):
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            return response
        except requests.exceptions.RequestException as e:
            if attempt < max_retries - 1:
                wait_time = backoff_factor ** attempt
                log_warning(f"Fetch failed, retrying in {wait_time}s: {e}")
                time.sleep(wait_time)
            else:
                log_error(f"Fetch failed after {max_retries} attempts: {e}")
                raise
```

---

## Monitoring & Logging

Log key events:

```
[2026-05-31 10:00:00] Fetch cycle started
[2026-05-31 10:00:05] Fetched CelesTrak active.txt: 4000 objects
[2026-05-31 10:00:10] Fetched CelesTrak debris.txt: 20000 objects
[2026-05-31 10:00:20] Normalization started
[2026-05-31 10:00:45] Normalized 24000 objects (20000 new, 4000 updated)
[2026-05-31 10:01:00] Database upsert completed: 24000 objects
[2026-05-31 10:01:05] Fetch cycle completed
```

---

## Post-MVP Enhancements

1. **Message Queue**: Use Kafka/RabbitMQ for decoupling fetcher and normalizer
2. **Incremental Updates**: Only fetch TLEs that changed (digest-based)
3. **Schema Evolution**: Support new orbital element types as sources evolve
4. **Deduplication**: Detect duplicate objects across sources
5. **Historical Tracking**: Archive old TLEs for playback

---

**Data Pipeline Status**: ✅ Specification complete  
**Implementation Status**: ⏳ Pending (MiniMax lane)  
**Review Status**: ⏳ Pending (Claude Haiku 4.5)
