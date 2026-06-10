# Fetching Design: Layer 07 Weather MVP

## Overview

This document defines the fetch strategy for obtaining real weather data from Open-Meteo for the GOD EYES Weather layer.

---

## Open-Meteo Fetch Strategy

### API Endpoint

```
GET https://api.open-meteo.com/v1/forecast
```

### Authentication

- **No API key required** for non-commercial use
- Rate limits: 10,000 calls/day, 5,000/hour, 600/minute
- User-Agent header recommended but not enforced

### Request Parameters

| Parameter | Value | Notes |
|-----------|-------|-------|
| `latitude` | Grid latitudes (comma-separated) | Multiple coordinates supported |
| `longitude` | Grid longitudes (comma-separated) | Must match latitude count |
| `current` | Weather variables for current conditions | See below |
| `hourly` | Weather variables for hourly forecast | See below |
| `temperature_unit` | `celsius` | Standard metric |
| `wind_speed_unit` | `kmh` | Kilometers per hour |
| `precipitation_unit` | `mm` | Millimeters |
| `timeformat` | `iso8601` | ISO 8601 timestamps |
| `timezone` | `auto` | Automatic timezone detection |
| `forecast_days` | `3` | MVP: 3-day forecast |
| `cell_selection` | `land` | Prefer land grid cells |

### MVP Weather Variables

**Current Weather:**
```
temperature_2m, apparent_temperature, relative_humidity_2m, 
precipitation, weather_code, cloud_cover, pressure_msl, 
wind_speed_10m, wind_direction_10m, wind_gusts_10m
```

**Hourly Forecast:**
```
temperature_2m, apparent_temperature, relative_humidity_2m,
precipitation, precipitation_probability, weather_code,
cloud_cover, pressure_msl, surface_pressure,
wind_speed_10m, wind_direction_10m, wind_gusts_10m
```

### Sample Request Format (Do Not Execute)

```
GET https://api.open-meteo.com/v1/forecast
    ?latitude=52.52,48.85,40.71
    &longitude=13.41,2.35,-74.01
    &current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m
    &hourly=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,precipitation_probability,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m
    &temperature_unit=celsius
    &wind_speed_unit=kmh
    &precipitation_unit=mm
    &timeformat=iso8601
    &timezone=auto
    &forecast_days=3
    &cell_selection=land
```

### Sample Response Shape

```json
{
    "latitude": 52.52,
    "longitude": 13.419,
    "elevation": 44.812,
    "generationtime_ms": 2.2119,
    "utc_offset_seconds": 0,
    "timezone": "Europe/Berlin",
    "timezone_abbreviation": "CEST",
    "current": {
        "time": "2026-06-10T12:00",
        "interval": 900,
        "temperature_2m": 18.5,
        "apparent_temperature": 17.2,
        "relative_humidity_2m": 65,
        "precipitation": 0.0,
        "weather_code": 2,
        "cloud_cover": 45,
        "pressure_msl": 1013.2,
        "wind_speed_10m": 12.3,
        "wind_direction_10m": 225,
        "wind_gusts_10m": 18.7
    },
    "current_units": {
        "time": "iso8601",
        "interval": "s",
        "temperature_2m": "°C",
        "apparent_temperature": "°C",
        "relative_humidity_2m": "%",
        "precipitation": "mm",
        "weather_code": "wmo code",
        "cloud_cover": "%",
        "pressure_msl": "hPa",
        "wind_speed_10m": "km/h",
        "wind_direction_10m": "°",
        "wind_gusts_10m": "km/h"
    },
    "hourly": {
        "time": ["2026-06-10T00:00", "2026-06-10T01:00", "..."],
        "temperature_2m": [14.2, 13.8, "..."],
        "apparent_temperature": [13.1, 12.7, "..."],
        "relative_humidity_2m": [78, 80, "..."],
        "precipitation": [0.0, 0.0, "..."],
        "precipitation_probability": [10, 15, "..."],
        "weather_code": [3, 3, "..."],
        "cloud_cover": [65, 70, "..."],
        "pressure_msl": [1012.8, 1012.5, "..."],
        "surface_pressure": [1008.1, 1007.8, "..."],
        "wind_speed_10m": [8.2, 7.9, "..."],
        "wind_direction_10m": [210, 205, "..."],
        "wind_gusts_10m": [14.5, 13.8, "..."]
    },
    "hourly_units": {
        "time": "iso8601",
        "temperature_2m": "°C",
        "...": "..."
    }
}
```

---

## Grid / Cell Fetch Strategy

### MVP Grid: Low-Density Global Grid

**Recommended: 5° global grid (~2,592 cells)**

| Grid Option | Spacing | Cells (approx) | API Calls/Batch | Feasibility |
|-------------|---------|-----------------|-----------------|-------------|
| 5° global | 5° lat × 5° lon | ~2,592 | 26 (100 coords/batch) | **RECOMMENDED MVP** |
| 2.5° global | 2.5° lat × 2.5° lon | ~10,368 | 104 | Possible, higher API usage |
| 1° regional | 1° lat × 1° lon | Regional only | Regional | Future zoom refinement |
| Exact user lat/lon | User-requested | Dynamic | Per-request | Future interactive mode |

### Grid Cell Coordinates

The 5° global grid generates coordinates at:
- Latitude: -90, -85, -80, ..., 85, 90 (37 values)
- Longitude: -180, -175, -170, ..., 175, 180 (72 values)
- Total: 37 × 72 = 2,664 cells (excluding extreme poles if desired)

### Batch Fetch Strategy

Open-Meteo supports multiple coordinates in a single request:
- Comma-separated latitude and longitude values
- Recommended batch size: 50-100 coordinates per request
- Response is a JSON array (one object per coordinate)

**MVP fetch plan:**
1. Generate 5° grid coordinates
2. Batch into groups of 50
3. Fetch current + 3-day hourly for each batch
4. Rate limit: max 600 requests/minute (well within free tier)
5. Total API calls per full global fetch: ~54 calls (2,664 / 50)

### Bbox/Viewport Filtering for Frontend

The API supports bbox queries via the frontend:
- Frontend sends bbox (minLat, minLon, maxLat, maxLon)
- API filters stored observations by bounding box
- Only weather cells within viewport are returned
- Reduces payload size and improves render performance

### Future Zoom-Based Refinement

After MVP proves the pipeline:
- Zoom level 1-2: 5° grid (2,664 cells)
- Zoom level 3-4: 2.5° grid (~10K cells)
- Zoom level 5+: 1° regional grids (~variable)
- User click: exact lat/lon fetch (on-demand)

---

## Rate-Limit Protection

### Free Tier Limits
- 10,000 API calls/day
- 5,000 API calls/hour
- 600 API calls/minute

### Protection Strategy
1. **Fetch interval**: Full global refresh every 6 hours (4 fetches/day)
2. **Batch size**: 50 coordinates per request (54 calls per full fetch)
3. **Daily API usage**: ~216 calls (54 calls × 4 fetches/day) — well within 10K limit
4. **Concurrent requests**: Max 5 concurrent to avoid burst limits
5. **Backoff on 429/503**: Exponential backoff starting at 30 seconds
6. **Caching**: Store responses, re-fetch only stale data

### Stale Threshold Rules
- Current weather: stale after 1 hour
- Hourly forecast: stale after 3 hours (model update cycle)
- Daily forecast: stale after 6 hours
- All stale data flagged in database with `is_stale` boolean

---

## Retry / Failure Behavior

### Retry Strategy
1. **Timeout**: 30-second request timeout
2. **Retries**: 3 attempts with exponential backoff (30s, 60s, 120s)
3. **Rate limit (429)**: Wait 60 seconds, retry up to 3 times
4. **Server error (500/502/503)**: Retry up to 3 times
5. **Client error (400/404)**: Do NOT retry — log and skip

### Failure Behavior
- If fetch fails for specific coordinates: skip those, log error
- If entire batch fails: log error, continue with next batch
- If API is completely unavailable: mark all observations stale, continue
- **Never crash the fetcher** — graceful degradation

---

## No-Fake-Data Behavior

### Rules
1. If Open-Meteo API returns error → log error, skip coordinates
2. If API is unreachable → mark all data stale, do NOT generate fake values
3. If partial response → use only valid fields, null out missing
4. If rate limited → wait and retry, do NOT fabricate data
5. If API response contains unexpected fields → log warning, use only expected fields

### Validation
- Reject response if `error: true` in JSON
- Validate required fields present (latitude, longitude, current/hourly)
- Log any field type mismatches
- Never interpolate between grid points

---

## Raw Response Storage Path Design

### Directory Structure

```
raw/layer_07_weather/open-meteo/{yyyy}/{mm}/{dd}/{fetch_run_id}/
    metadata.json
    batch_001.json
    batch_002.json
    ...
    preview.json
    proof_report.md
```

### File Formats

**metadata.json:**
```json
{
    "source_id": "open-meteo",
    "layer_id": "layer_07_weather",
    "fetch_run_id": "run_20260610T120000Z",
    "fetch_started_at": "2026-06-10T12:00:00Z",
    "fetch_completed_at": "2026-06-10T12:02:15Z",
    "grid_resolution": "5deg",
    "total_cells": 2664,
    "total_batches": 54,
    "successful_batches": 54,
    "failed_batches": 0,
    "api_endpoint": "https://api.open-meteo.com/v1/forecast",
    "request_parameters": {
        "temperature_unit": "celsius",
        "wind_speed_unit": "kmh",
        "precipitation_unit": "mm",
        "forecast_days": 3,
        "cell_selection": "land"
    },
    "current_weather_variables": ["temperature_2m", "..."],
    "hourly_weather_variables": ["temperature_2m", "..."]
}
```

**batch_NNN.json:** Raw Open-Meteo response for batch N (array of coordinate responses)

**preview.json:** Summary of first 5 coordinates with all fields

**proof_report.md:** Human-readable fetch report

### Raw Storage Rules
- Raw data stored in `raw/` directory outside repo (per DATA_LOCATION_RULES.md)
- Never commit raw data to git
- Each fetch run gets unique directory with timestamp
- Metadata captured before, during, and after fetch
- Preview extracted for quick inspection

---

## Fetcher Implementation Architecture

### Components

1. **open_meteo_client.py** — HTTP client for Open-Meteo API
   - `fetch_weather_batch(latitudes, longitudes, params)` → response array
   - Handles retries, timeouts, rate limiting
   - Returns raw JSON responses

2. **weather_raw_storage.py** — Raw response storage
   - `create_run_directory()` → run path
   - `save_batch(batch_number, response)` → file path
   - `save_metadata(metadata)` → file path
   - `save_preview(data)` → file path

3. **weather_fetcher.py** — Orchestrator
   - `generate_grid(resolution)` → coordinate list
   - `batch_coordinates(coords, batch_size)` → batched list
   - `run_fetch(grid_resolution, forecast_days)` → result summary
   - `run_proof(num_cells)` → proof mode (limited cells)

4. **weather_cli.py** — CLI interface
   - `proof` — fetch proof (limited cells, 1 batch)
   - `fetch` — full grid fetch
   - `inspect-cache` — inspect existing raw data

### Fetch Modes

1. **proof**: Fetch 5-10 cells, 1 batch, save raw, produce report
2. **fetch**: Full grid fetch, all batches, save raw, produce report
3. **incremental**: Fetch only stale cells (future optimization)

---

## Source Attribution

All raw storage metadata must include:
```json
{
    "source_attribution": "Weather data provided by Open-Meteo (https://open-meteo.com/) under CC-BY 4.0 licence.",
    "source_licence": "CC-BY 4.0",
    "source_url": "https://open-meteo.com/",
    "model_data_from": "ECMWF, NOAA, DWD, and other national weather services"
}
```
