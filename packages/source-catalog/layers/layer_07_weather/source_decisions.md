# Source Decisions: Layer 07 Weather

## Overview

Final source decisions for the GOD EYES Weather layer MVP.

---

## Source Decision Table

| Source | Status | Reason |
|--------|--------|--------|
| **Open-Meteo** | **PRIMARY_MVP_SOURCE** | No API key, global, rich variables, batch support, CC-BY 4.0 |
| **MET Norway** | **FUTURE_SOURCE** / **BACKUP_SOURCE** | Nordic focus, User-Agent requirement, good backup if Open-Meteo fails |
| **RainViewer** | **FUTURE_OVERLAY_SOURCE** | Radar tiles only, not point weather data, future overlay |
| **NOAA/NWS** | **FUTURE_ALERT_SOURCE** | US-only, alerts focus, not global forecast data |
| **OpenWeather** | **REJECT_FOR_MVP** | API key required, limited free tier (1K/day), commercial |
| **WeatherAPI** | **REJECT_FOR_MVP** | API key required, limited free tier, commercial |

---

## Open-Meteo: PRIMARY_MVP_SOURCE

### Decision

**Open-Meteo is APPROVED as the PRIMARY_MVP_SOURCE for Layer 07 Weather.**

### Rationale

1. **No API key required** for free non-commercial use
2. **Global coverage** with WGS84 coordinate support
3. **All MVP weather variables confirmed available** (temperature, wind, humidity, pressure, precipitation, cloud cover, weather code)
4. **Batch request support** confirmed (multiple coordinates per call)
5. **CC-BY 4.0 licence** (permissive, attribution required)
6. **Well-documented API** with clear response format
7. **Multiple weather model support** with automatic "Best Match" selection
8. **Elevation-based downscaling** included (90m DEM)
9. **Cell selection options** (land/sea/nearest)
10. **Open-source codebase** (AGPLv3 on GitHub)

### Key Limitations

- Free tier: 10,000 API calls/day (sufficient for 5° grid MVP)
- Non-commercial use only on free tier
- Grid-cell resolution varies by model (9-25 km)
- No real-time observation data (forecast model output only)
- API-call accounting not fully documented

### Attribution Requirement

Must include link to Open-Meteo with attribution text:
```
Weather data provided by Open-Meteo (https://open-meteo.com/) under CC-BY 4.0 licence.
```

---

## MET Norway: FUTURE_SOURCE / BACKUP_SOURCE

### Decision

**MET Norway is reserved as a FUTURE_SOURCE and BACKUP_SOURCE. Not needed for MVP if Open-Meteo works.**

### Rationale

- Excellent for Nordic/European high-resolution weather (1 km resolution)
- No API key required
- CC-BY 4.0 licence
- Requires proper User-Agent identification (mandatory, 403 if missing)
- Up to 9 days forecast (vs Open-Meteo 16 days)
- Global coverage but best accuracy in Nordic region

### When to Use

- If Open-Meteo experiences extended outage
- If GOD EYES needs Nordic-specific high-resolution data
- If user demand for European weather accuracy increases

---

## RainViewer: FUTURE_OVERLAY_SOURCE

### Decision

**RainViewer is reserved as a FUTURE_OVERLAY_SOURCE for radar precipitation overlay. NOT suitable for MVP weather data.**

### Rationale

- Provides radar image tiles (XYZ raster tiles, PNG), not structured weather data
- Cannot extract temperature, humidity, wind, pressure from radar tiles
- Tile rendering requires map tile infrastructure (not simple API calls)
- 1,200+ radars in 150+ countries
- Updates every 5 minutes
- Free for personal/educational use, attribution required

### Why Not MVP

- MVP needs point/grid weather data, not radar imagery
- RainViewer data is fundamentally different from forecast model output
- Future overlay: RainViewer radar tiles on top of weather markers

---

## NOAA/NWS: FUTURE_ALERT_SOURCE

### Decision

**NOAA/NWS is reserved as a FUTURE_ALERT_SOURCE for US weather alerts. NOT suitable for global MVP.**

### Rationale

- Coverage limited to United States and territories
- No API key required
- Public domain (US government data)
- 40 requests/minute recommended rate limit
- Provides forecasts, observations, alerts, warnings

### Why Not MVP

- GOD EYES requires global weather data
- Alert/warning focus does not match MVP need for global forecast data
- Future use: US-specific severe weather alerts overlay

---

## OpenWeather: REJECT_FOR_MVP

### Decision

**OpenWeather is REJECTED for MVP.**

### Rationale

- API key required (adds complexity and secret management)
- Free tier only 1,000 calls/day (insufficient for grid strategy)
- Commercial licensing terms
- Open-Meteo provides equivalent data without API key

---

## WeatherAPI: REJECT_FOR_MVP

### Decision

**WeatherAPI is REJECTED for MVP.**

### Rationale

- API key required (adds complexity and secret management)
- Free tier limited to 100,000 calls/month (~3,333/day)
- Commercial licensing terms
- Open-Meteo provides equivalent data without API key

---

## Final Source Decision

### Primary Source

**Open-Meteo** — PRIMARY_MVP_SOURCE

### Backup Source

**MET Norway** — FUTURE_SOURCE / BACKUP_SOURCE

### Future Overlays

- **RainViewer** — radar precipitation overlay (separate imagery layer)
- **NOAA/NWS** — US weather alerts (separate alert layer)

### Rejected for MVP

- **OpenWeather** — API key required, limited free tier
- **WeatherAPI** — API key required, limited free tier

---

## Implementation Implications

### Fetcher

- HTTP client for `GET https://api.open-meteo.com/v1/forecast`
- No API key configuration needed
- Batch request support (comma-separated lat/lon)
- Rate-limit protection (10K/day, 5K/hour, 600/min)

### Normalizer

- WMO weather code to label mapping (29 codes)
- Coordinate precision handling (requested vs resolved)
- Provider metadata extraction (generation_time_ms, timezone, elevation)

### Database

- `weather_sources` table with Open-Meteo source record
- CC-BY 4.0 attribution stored in source record

### Frontend

- "Powered by Open-Meteo" attribution in layer panel
- Link to https://open-meteo.com/ in UI
