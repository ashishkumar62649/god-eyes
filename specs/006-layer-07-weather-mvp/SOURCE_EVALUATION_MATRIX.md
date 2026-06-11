# Source Evaluation Matrix: Layer 07 Weather MVP

## Overview

This document evaluates weather data sources for the GOD EYES Weather layer MVP. The primary goal is to find a source that provides real, global weather data with minimal friction (no API keys, free usage, permissive license).

---

## Evaluated Sources

### 1. Open-Meteo

| Attribute | Value |
|-----------|-------|
| **Purpose** | Primary MVP source |
| **Documentation URL** | https://open-meteo.com/en/docs |
| **Terms URL** | https://open-meteo.com/en/terms |
| **Licence URL** | https://open-meteo.com/en/licence |
| **API Key Required** | No (free tier) / Yes (commercial use only) |
| **Free Usage Limits** | 10,000 calls/day, 5,000/hour, 600/minute |
| **Commercial Use** | Requires paid subscription (API Standard/Professional/Enterprise) |
| **Licence** | CC-BY 4.0 (data), MIT (open-source code) |
| **Coverage** | Global (all lat/lon coordinates) |
| **Data Type** | Weather forecast (current, hourly, daily), historical, marine, air quality |
| **Coordinate Support** | WGS84 lat/lon, multiple coordinates in single request |
| **Current Weather** | Yes — temperature, humidity, wind, pressure, cloud cover, weather code |
| **Hourly Forecast** | Yes — up to 16 days, all weather variables |
| **Daily Forecast** | Yes — up to 16 days, aggregated values |
| **Weather Models** | ECMWF, GFS, DWD ICON, Météo-France, JMA, MET Norway, and 15+ more |
| **Model Metadata** | Response includes latitude/longitude of grid cell center, elevation, generation time |
| **Batch/Multiple Coordinates** | Yes — comma-separated lat/lon in single request |
| **Rate Limit Protection** | Fair-use policy, 10K/day free tier |
| **Attribution Required** | CC-BY 4.0 attribution to Open-Meteo |
| **MVP Status** | **PRIMARY_MVP_SOURCE** |
| **Risks** | Free tier limited to non-commercial use; 10K calls/day may constrain high-density grids |
| **Recommendation** | **APPROVED as PRIMARY_MVP_SOURCE** |

**Key Advantages:**
- No API key required for free non-commercial use
- Global coverage with multiple weather models
- Rich weather variable set (all MVP fields available)
- Batch request support (multiple coordinates per call)
- Open-source codebase (GitHub)
- Well-documented API with clear response format
- Elevation-based downscaling for improved accuracy
- Cell selection options (land/sea/nearest)

**Key Limitations:**
- Free tier: 10,000 API calls/day
- Non-commercial use only on free tier
- Grid-cell resolution varies by model (9-25 km typical)
- No real-time observation data (forecast model output only)

---

### 2. MET Norway / api.met.no

| Attribute | Value |
|-----------|-------|
| **Purpose** | Secondary/future forecast source |
| **Documentation URL** | https://api.met.no/weatherapi/locationforecast/2.0/documentation |
| **API Key Required** | No |
| **User-Agent Required** | Yes — mandatory unique User-Agent header (403 Forbidden if missing/generic) |
| **Licence** | CC-BY 4.0 |
| **Coverage** | Global (best accuracy in Nordic region, 1 km resolution) |
| **Data Type** | Weather forecast (compact/complete JSON, legacy XML) |
| **Coordinate Support** | lat/lon/altitude parameters |
| **Rate Limits** | Fair-use, must identify with unique User-Agent |
| **Forecast Length** | Up to 9 days |
| **MVP Status** | **FUTURE_SOURCE** / **BACKUP_SOURCE** |
| **Risks** | User-Agent enforcement may cause 403 errors if misconfigured; Nordic focus for high resolution |
| **Recommendation** | Reserve as backup/future source. Not needed for MVP if Open-Meteo works. |

**Key Notes:**
- Excellent for Nordic/European high-resolution weather
- Requires proper User-Agent identification (no generic agents like "okhttp")
- Compact endpoint provides essential variables only
- Complete endpoint provides all variables
- Historical forecast data available via thredds.met.no (NetCDF, Nordic/Arctic only)

---

### 3. RainViewer

| Attribute | Value |
|-----------|-------|
| **Purpose** | Future radar/rain overlay source |
| **Documentation URL** | https://www.rainviewer.com/api.html |
| **API Key Required** | No |
| **Licence** | Free for personal/educational use, attribution required |
| **Coverage** | Global (1,200+ radars in 150+ countries) |
| **Data Type** | Radar tile images (past precipitation), NOT point weather data |
| **Tile Format** | XYZ raster tiles (PNG), 256x256 px |
| **Update Frequency** | Every 5 minutes |
| **Historical Data** | Past radar frames available (varies by radar) |
| **MVP Status** | **FUTURE_OVERLAY_SOURCE** |
| **Risks** | Provides radar imagery tiles, not numerical weather data; tile rendering complexity; no temperature/wind/humidity data |
| **Recommendation** | NOT suitable for MVP weather data. Future integration for radar precipitation overlay only. |

**Why Not MVP:**
- RainViewer provides radar image tiles, not structured weather data
- Cannot extract temperature, humidity, wind, pressure from radar tiles
- Tile rendering requires map tile infrastructure (not simple API calls)
- MVP needs point/grid weather data, not radar imagery
- Future overlay: RainViewer radar tiles on top of weather markers

---

### 4. NOAA / NWS (National Weather Service)

| Attribute | Value |
|-----------|-------|
| **Purpose** | Future weather alerts and US-focused weather source |
| **Documentation URL** | https://www.weather.gov/documentation/services-web-api |
| **API Key Required** | No |
| **Licence** | Public domain (US government data) |
| **Coverage** | United States only (including territories) |
| **Data Type** | Weather forecasts, observations, alerts, warnings |
| **Coordinate Support** | lat/lon, grid points |
| **Rate Limits** | Fair-use, 40 requests/minute recommended |
| **MVP Status** | **FUTURE_ALERT_SOURCE** |
| **Risks** | US-only coverage; not suitable for global weather layer |
| **Recommendation** | NOT suitable for global MVP. Future integration for US weather alerts. |

**Why Not MVP:**
- Coverage limited to United States and territories
- GOD EYES requires global weather data
- Alert/warning focus does not match MVP need for global forecast data
- Future use: US-specific severe weather alerts overlay

---

### 5. OpenWeather

| Attribute | Value |
|-----------|-------|
| **Purpose** | Evaluate and reject for MVP |
| **Documentation URL** | https://openweathermap.org/api |
| **API Key Required** | Yes |
| **Free Tier** | 1,000 calls/day (very limited) |
| **Paid Plans** | Developer ($40/mo), Professional ($180/mo), Enterprise (custom) |
| **Coverage** | Global |
| **Data Type** | Current, forecast, historical, air quality, maps |
| **Licence** | Proprietary (commercial terms) |
| **MVP Status** | **NOT_MVP** / **REJECT_FOR_MVP** |
| **Risks** | API key required; very limited free tier (1K calls/day); commercial licensing; rate limits |
| **Recommendation** | REJECT for MVP. API key requirement and limited free tier make it unsuitable. |

**Why Reject:**
- API key required (adds complexity and secret management)
- Free tier only 1,000 calls/day (insufficient for grid strategy)
- Commercial licensing terms
- Open-Meteo provides equivalent data without API key

---

### 6. WeatherAPI.com

| Attribute | Value |
|-----------|-------|
| **Purpose** | Evaluate and reject for MVP |
| **Documentation URL** | https://www.weatherapi.com/docs/ |
| **API Key Required** | Yes |
| **Free Tier** | 100,000 calls/month (~3,333/day) |
| **Paid Plans** | Starter ($7/mo), Pro+ ($25/mo), Business ($65/mo) |
| **Coverage** | Global |
| **Data Type** | Current, forecast, historical, marine, air quality |
| **Licence** | Proprietary (commercial terms) |
| **MVP Status** | **NOT_MVP** / **REJECT_FOR_MVP** |
| **Risks** | API key required; limited free tier; commercial licensing |
| **Recommendation** | REJECT for MVP. API key required and better alternatives exist. |

**Why Reject:**
- API key required (adds complexity and secret management)
- Free tier limited to 100K calls/month
- Commercial licensing terms
- Open-Meteo provides equivalent data without API key

---

## Source Decision Summary

| Source | Status | Reason |
|--------|--------|--------|
| **Open-Meteo** | **PRIMARY_MVP_SOURCE** | No API key, global, rich variables, batch support, CC-BY 4.0 |
| **MET Norway** | **FUTURE_SOURCE** / **BACKUP_SOURCE** | Nordic focus, User-Agent requirement, good backup if Open-Meteo fails |
| **RainViewer** | **FUTURE_OVERLAY_SOURCE** | Radar tiles only, not point weather data, future overlay |
| **NOAA/NWS** | **FUTURE_ALERT_SOURCE** | US-only, alerts focus, not global forecast data |
| **OpenWeather** | **REJECT_FOR_MVP** | API key required, limited free tier, commercial |
| **WeatherAPI** | **REJECT_FOR_MVP** | API key required, limited free tier, commercial |

---

## Final Source Decision

**PRIMARY_MVP_SOURCE: Open-Meteo**

Rationale:
1. No API key required for non-commercial use
2. Global coverage with WGS84 coordinate support
3. All MVP weather variables available (temperature, wind, humidity, pressure, precipitation, cloud cover, weather code)
4. Batch request support (multiple coordinates per call)
5. CC-BY 4.0 license (permissive)
6. Open-source codebase
7. Well-documented API
8. Multiple weather model support
9. Elevation-based downscaling
10. Cell selection options (land/sea/nearest)

**Attribution Requirement:** CC-BY 4.0 requires attribution to Open-Meteo. Must include "Powered by Open-Meteo" or equivalent in UI and documentation.

---

## Attribution Template

For CC-BY 4.0 compliance, the following attribution must appear in:
- API response metadata
- Frontend UI (weather layer panel)
- Documentation

```
Weather data provided by Open-Meteo (https://open-meteo.com/) under CC-BY 4.0 licence.
Based on weather model data from ECMWF, NOAA, and other national weather services.
```
