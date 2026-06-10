# Normalization Design: Layer 07 Weather MVP

## Overview

This document defines how raw Open-Meteo API responses are normalized into the standard GOD EYES weather observation schema.

---

## Raw Open-Meteo Response Shape → Normalized Object Mapping

### Current Weather Normalization

| Open-Meteo Field | Normalized Field | Type | Notes |
|------------------|------------------|------|-------|
| `current.time` | `forecast_for` | ISO 8601 | Time the forecast is valid for |
| `current.temperature_2m` | `temperature_c` | float | Air temperature at 2m (°C) |
| `current.apparent_temperature` | `apparent_temperature_c` | float | Feels-like temperature (°C) |
| `current.wind_speed_10m` | `wind_speed_kph` | float | Wind speed at 10m (km/h) |
| `current.wind_direction_10m` | `wind_direction_deg` | float | Wind direction in degrees (0-360) |
| `current.wind_gusts_10m` | `wind_gust_kph` | float | Wind gusts at 10m (km/h) |
| `current.relative_humidity_2m` | `humidity_percent` | int | Relative humidity (%) |
| `current.pressure_msl` | `pressure_hpa` | float | Mean sea level pressure (hPa) |
| `current.precipitation` | `precipitation_mm` | float | Precipitation amount (mm) |
| `current.weather_code` | `weather_code` | int | WMO weather interpretation code |
| `current.weather_code` | `weather_label` | string | Human-readable weather description |
| `current.cloud_cover` | `cloud_cover_percent` | int | Total cloud cover (%) |
| (not provided) | `precipitation_probability_percent` | int | NULL for current (not available in current) |
| `latitude` (response) | `resolved_latitude` | float | Grid cell center latitude |
| `longitude` (response) | `resolved_longitude` | float | Grid cell center longitude |
| `elevation` | `elevation_m` | float | Grid cell elevation (m) |
| (requested) | `requested_latitude` | float | Original requested latitude |
| (requested) | `requested_longitude` | float | Original requested longitude |
| (system) | `fetched_at` | ISO 8601 | When GOD EYES fetched the data |
| (system) | `source_id` | string | "open-meteo" |
| (system) | `raw_evidence_uri` | string | Path to raw response file |

### Hourly Forecast Normalization

Each hourly timestamp produces a separate normalized observation:

| Open-Meteo Field | Normalized Field | Type | Notes |
|------------------|------------------|------|-------|
| `hourly.time[i]` | `forecast_for` | ISO 8601 | Specific hour forecast is for |
| `hourly.temperature_2m[i]` | `temperature_c` | float | Temperature at hour |
| `hourly.apparent_temperature[i]` | `apparent_temperature_c` | float | Apparent temp at hour |
| `hourly.wind_speed_10m[i]` | `wind_speed_kph` | float | Wind speed at hour |
| `hourly.wind_direction_10m[i]` | `wind_direction_deg` | float | Wind direction at hour |
| `hourly.wind_gusts_10m[i]` | `wind_gust_kph` | float | Wind gusts at hour |
| `hourly.relative_humidity_2m[i]` | `humidity_percent` | int | Humidity at hour |
| `hourly.pressure_msl[i]` | `pressure_hpa` | float | Pressure at hour |
| `hourly.surface_pressure[i]` | `provider_metadata.surface_pressure_hpa` | float | Surface pressure (metadata) |
| `hourly.precipitation[i]` | `precipitation_mm` | float | Precipitation at hour |
| `hourly.precipitation_probability[i]` | `precipitation_probability_percent` | int | Precip probability at hour |
| `hourly.weather_code[i]` | `weather_code` | int | WMO code at hour |
| `hourly.weather_code[i]` | `weather_label` | string | Human-readable label |
| `hourly.cloud_cover[i]` | `cloud_cover_percent` | int | Cloud cover at hour |
| `latitude` (response) | `resolved_latitude` | float | Grid cell center latitude |
| `longitude` (response) | `resolved_longitude` | float | Grid cell center longitude |
| `elevation` | `elevation_m` | float | Grid cell elevation |
| (requested) | `requested_latitude` | float | Original requested latitude |
| (requested) | `requested_longitude` | float | Original requested longitude |
| (system) | `fetched_at` | ISO 8601 | Fetch timestamp |
| (system) | `source_id` | string | "open-meteo" |
| (system) | `raw_evidence_uri` | string | Raw file path |

---

## Weather Code to Weather Label Strategy

### WMO Weather Interpretation Codes

Open-Meteo uses WMO standard weather codes. The normalizer must map these to human-readable labels:

| Code | Label | Description |
|------|-------|-------------|
| 0 | Clear Sky | Clear sky |
| 1 | Mainly Clear | Mainly clear |
| 2 | Partly Cloudy | Partly cloudy |
| 3 | Overcast | Overcast |
| 45 | Foggy | Fog |
| 48 | Depositing Rime Fog | Depositing rime fog |
| 51 | Light Drizzle | Light drizzle |
| 53 | Moderate Drizzle | Moderate drizzle |
| 55 | Dense Drizzle | Dense drizzle |
| 56 | Light Freezing Drizzle | Light freezing drizzle |
| 57 | Dense Freezing Drizzle | Dense freezing drizzle |
| 61 | Slight Rain | Slight rain |
| 63 | Moderate Rain | Moderate rain |
| 65 | Heavy Rain | Heavy rain |
| 66 | Light Freezing Rain | Light freezing rain |
| 67 | Heavy Freezing Rain | Heavy freezing rain |
| 71 | Slight Snow Fall | Slight snow fall |
| 73 | Moderate Snow Fall | Moderate snow fall |
| 75 | Heavy Snow Fall | Heavy snow fall |
| 77 | Snow Grains | Snow grains |
| 80 | Slight Rain Showers | Slight rain showers |
| 81 | Moderate Rain Showers | Moderate rain showers |
| 82 | Violent Rain Showers | Violent rain showers |
| 85 | Slight Snow Showers | Slight snow showers |
| 86 | Heavy Snow Showers | Heavy snow showers |
| 95 | Thunderstorm | Thunderstorm |
| 96 | Thunderstorm with Slight Hail | Thunderstorm with slight hail |
| 99 | Thunderstorm with Heavy Hail | Thunderstorm with heavy hail |

### Implementation Strategy

```python
WMO_WEATHER_CODES = {
    0: "Clear Sky",
    1: "Mainly Clear",
    2: "Partly Cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Depositing Rime Fog",
    51: "Light Drizzle",
    53: "Moderate Drizzle",
    55: "Dense Drizzle",
    56: "Light Freezing Drizzle",
    57: "Dense Freezing Drizzle",
    61: "Slight Rain",
    63: "Moderate Rain",
    65: "Heavy Rain",
    66: "Light Freezing Rain",
    67: "Heavy Freezing Rain",
    71: "Slight Snow Fall",
    73: "Moderate Snow Fall",
    75: "Heavy Snow Fall",
    77: "Snow Grains",
    80: "Slight Rain Showers",
    81: "Moderate Rain Showers",
    82: "Violent Rain Showers",
    85: "Slight Snow Showers",
    86: "Heavy Snow Showers",
    95: "Thunderstorm",
    96: "Thunderstorm with Slight Hail",
    99: "Thunderstorm with Heavy Hail",
}

def weather_code_to_label(code: int) -> str:
    return WMO_WEATHER_CODES.get(code, f"Unknown ({code})")
```

---

## Unit Normalization

### Input Units (from Open-Meteo)
- Temperature: °C (when `temperature_unit=celsius`)
- Wind speed: km/h (when `wind_speed_unit=kmh`)
- Precipitation: mm (when `precipitation_unit=mm`)
- Pressure: hPa
- Humidity: %
- Cloud cover: %
- Wind direction: degrees (0-360)

### Output Units (normalized)
All values stored in the database use the same units as Open-Meteo returns:
- `temperature_c` — °C
- `apparent_temperature_c` — °C
- `wind_speed_kph` — km/h
- `wind_direction_deg` — degrees
- `wind_gust_kph` — km/h
- `humidity_percent` — %
- `pressure_hpa` — hPa
- `precipitation_mm` — mm
- `precipitation_probability_percent` — %
- `cloud_cover_percent` — %

**No unit conversion needed** for MVP. The fetcher requests metric units and stores them directly.

---

## Handling Missing Fields

### Strategy
1. If a field is missing from Open-Meteo response → store as NULL
2. If a field is present but null → store as NULL
3. If a field is present but wrong type → log warning, store as NULL
4. If precipitation_probability is not available for current weather → NULL (only available in hourly)
5. If wind_gusts is not available → NULL

### Required vs Optional Fields

**Required (must be present for valid observation):**
- `temperature_c` — if missing, observation is invalid
- `forecast_for` — if missing, observation is invalid
- `requested_latitude` / `requested_longitude` — always present
- `resolved_latitude` / `resolved_longitude` — from response
- `fetched_at` — system-generated
- `source_id` — always "open-meteo"

**Optional (can be NULL):**
- `apparent_temperature_c`
- `wind_speed_kph`
- `wind_direction_deg`
- `wind_gust_kph`
- `humidity_percent`
- `pressure_hpa`
- `precipitation_mm`
- `precipitation_probability_percent`
- `cloud_cover_percent`
- `weather_code`
- `weather_label`
- `raw_evidence_uri`
- `provider_metadata`

---

## Handling Coordinate Precision

### Requested vs Resolved Coordinates

```python
normalized = {
    # What the user/system requested
    "requested_latitude": 40.7128,
    "requested_longitude": -74.0060,
    
    # What Open-Meteo actually used (grid cell center)
    "resolved_latitude": 40.75,  # May differ from requested
    "resolved_longitude": -74.00,  # Grid cell center
    
    # Grid cell metadata
    "elevation_m": 44.812,  # From 90m DEM
    "grid_cell_note": "Weather values represent grid cell average, not exact point"
}
```

### Grid Cell Selection
- `cell_selection=land` (default): Prefers grid cells on land
- `cell_selection=sea`: Prefers grid cells on water
- `cell_selection=nearest`: Nearest grid cell regardless of land/sea
- MVP uses `land` for global weather grid

---

## Handling forecast_for vs fetched_at

### Timestamp Distinction

```python
normalized = {
    # When the weather data is VALID for
    "forecast_for": "2026-06-10T14:00:00Z",  # From Open-Meteo time array
    
    # When GOD EYES fetched the data
    "fetched_at": "2026-06-10T12:00:00Z",  # System clock
}
```

### Usage
- `forecast_for`: Used for display ("Weather at 2:00 PM"), filtering by time
- `fetched_at`: Used for staleness check, data freshness display
- `is_stale` = (`fetched_at` older than threshold)

---

## Raw Evidence URI Strategy

### Format
```
raw/layer_07_weather/open-meteo/{yyyy}/{mm}/{dd}/{fetch_run_id}/batch_{NNN}.json
```

### Example
```
raw/layer_07_weather/open-meteo/2026/06/10/run_20260610T120000Z/batch_001.json
```

### Implementation
- Store relative path in database (not absolute path)
- Backend resolves to actual filesystem path
- Used for debugging, auditing, re-normalization

---

## Provider Metadata Strategy

### Metadata Object

```json
{
    "provider_metadata": {
        "surface_pressure_hpa": 1008.1,
        "elevation_m": 44.812,
        "generation_time_ms": 2.2119,
        "timezone": "Europe/Berlin",
        "timezone_abbreviation": "CEST",
        "utc_offset_seconds": 0,
        "model_name": "best_match",
        "cell_selection": "land"
    }
}
```

### Model/Grid Resolution Storage

If Open-Meteo provides model name, model/grid resolution, elevation, timezone, generation time, utc_offset_seconds, or similar metadata, GOD EYES must preserve it in `provider_metadata`. Key metadata to capture:
- `elevation_m` — from response (90m DEM-based)
- `generation_time_ms` — API generation time
- `timezone` / `timezone_abbreviation` — resolved timezone
- `utc_offset_seconds` — timezone offset
- `model_name` — selected weather model (e.g., "best_match")
- `cell_selection` — land/sea/nearest preference

If model/grid resolution becomes consistently available and useful for display or debugging, a dedicated field such as `model_resolution_km` can be added to the database schema later.

### Purpose
- Store additional Open-Meteo response metadata
- Not displayed in UI (or displayed as expandable "Advanced" section)
- Useful for debugging and data quality assessment
- Stored as JSONB in PostgreSQL
- Preserves model/grid metadata when available from API response

---

## Normalized Object Schema

```python
@dataclass
class WeatherObservation:
    # Identity
    observation_id: str  # UUID
    layer_id: str  # "layer_07_weather"
    source_id: str  # "open-meteo"
    location_id: str  # Hash of requested lat/lon
    
    # Coordinates
    requested_latitude: float
    requested_longitude: float
    resolved_latitude: float
    resolved_longitude: float
    elevation_m: Optional[float]
    
    # Weather data
    temperature_c: float
    apparent_temperature_c: Optional[float]
    wind_speed_kph: Optional[float]
    wind_direction_deg: Optional[float]
    wind_gust_kph: Optional[float]
    humidity_percent: Optional[int]
    pressure_hpa: Optional[float]
    precipitation_mm: Optional[float]
    precipitation_probability_percent: Optional[int]
    cloud_cover_percent: Optional[int]
    weather_code: Optional[int]
    weather_label: Optional[str]
    
    # Timestamps
    forecast_for: datetime  # When data is valid for
    fetched_at: datetime  # When we fetched it
    
    # Metadata
    provider_metadata: Optional[dict]
    raw_evidence_uri: Optional[str]
    is_stale: bool  # Computed based on fetched_at
```

---

## Normalization Pipeline

```
Raw Open-Meteo Response (JSON)
    ↓
Parse current weather object
    ↓
Parse hourly weather arrays
    ↓
Map field names → normalized schema
    ↓
Map weather_code → weather_label
    ↓
Validate required fields (temperature_c, forecast_for)
    ↓
Set requested_latitude/longitude from request
    ↓
Set resolved_latitude/longitude from response
    ↓
Set fetched_at from system clock
    ↓
Set source_id = "open-meteo"
    ↓
Set raw_evidence_uri from storage path
    ↓
Compute is_stale based on fetched_at
    ↓
Store provider_metadata (extra fields)
    ↓
Output: Normalized WeatherObservation
```
