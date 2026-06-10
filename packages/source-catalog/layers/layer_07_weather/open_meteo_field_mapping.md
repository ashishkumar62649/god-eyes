# Open-Meteo Field Mapping

## Overview

Field-by-field mapping from Open-Meteo API response fields to GOD EYES normalized weather observation schema.

---

## Current Weather Field Mapping

| Open-Meteo Field | GOD EYES Field | Type | Unit | Required | Notes |
|------------------|----------------|------|------|----------|-------|
| `current.time` | `forecast_for` | ISO 8601 | — | Yes | Time the forecast is valid for |
| `current.temperature_2m` | `temperature_c` | float | °C | Yes | Air temperature at 2m |
| `current.apparent_temperature` | `apparent_temperature_c` | float | °C | No | Feels-like temperature |
| `current.wind_speed_10m` | `wind_speed_kph` | float | km/h | No | Wind speed at 10m |
| `current.wind_direction_10m` | `wind_direction_deg` | float | ° | No | Wind direction (0-360) |
| `current.wind_gusts_10m` | `wind_gust_kph` | float | km/h | No | Wind gusts at 10m (preceding hour max) |
| `current.relative_humidity_2m` | `humidity_percent` | int | % | No | Relative humidity at 2m |
| `current.pressure_msl` | `pressure_hpa` | float | hPa | No | Mean sea level pressure |
| `current.precipitation` | `precipitation_mm` | float | mm | No | Precipitation (preceding hour sum) |
| `current.weather_code` | `weather_code` | int | WMO code | No | Weather interpretation code |
| `current.weather_code` | `weather_label` | string | — | No | Mapped from WMO code |
| `current.cloud_cover` | `cloud_cover_percent` | int | % | No | Total cloud cover |
| (not provided in current) | `precipitation_probability_percent` | int | % | No | NULL — only available in hourly |
| `current.surface_pressure` | `provider_metadata.surface_pressure_hpa` | float | hPa | No | Surface pressure (metadata) |

---

## Hourly Weather Field Mapping

Each hourly timestamp produces a separate normalized observation.

| Open-Meteo Field | GOD EYES Field | Type | Unit | Required | Notes |
|------------------|----------------|------|------|----------|-------|
| `hourly.time[i]` | `forecast_for` | ISO 8601 | — | Yes | Specific hour forecast is for |
| `hourly.temperature_2m[i]` | `temperature_c` | float | °C | Yes | Temperature at hour |
| `hourly.apparent_temperature[i]` | `apparent_temperature_c` | float | °C | No | Apparent temp at hour |
| `hourly.wind_speed_10m[i]` | `wind_speed_kph` | float | km/h | No | Wind speed at hour |
| `hourly.wind_direction_10m[i]` | `wind_direction_deg` | float | ° | No | Wind direction at hour |
| `hourly.wind_gusts_10m[i]` | `wind_gust_kph` | float | km/h | No | Wind gusts at hour |
| `hourly.relative_humidity_2m[i]` | `humidity_percent` | int | % | No | Humidity at hour |
| `hourly.pressure_msl[i]` | `pressure_hpa` | float | hPa | No | Sea level pressure at hour |
| `hourly.surface_pressure[i]` | `provider_metadata.surface_pressure_hpa` | float | hPa | No | Surface pressure (metadata) |
| `hourly.precipitation[i]` | `precipitation_mm` | float | mm | No | Precipitation at hour |
| `hourly.precipitation_probability[i]` | `precipitation_probability_percent` | int | % | No | Precip probability at hour |
| `hourly.weather_code[i]` | `weather_code` | int | WMO code | No | Weather code at hour |
| `hourly.weather_code[i]` | `weather_label` | string | — | No | Mapped from WMO code |
| `hourly.cloud_cover[i]` | `cloud_cover_percent` | int | % | No | Cloud cover at hour |

---

## Coordinate Fields

| Source | GOD EYES Field | Type | Notes |
|--------|----------------|------|-------|
| Request parameter | `requested_latitude` | float | Original requested latitude |
| Request parameter | `requested_longitude` | float | Original requested longitude |
| Response `latitude` | `resolved_latitude` | float | Grid cell center latitude |
| Response `longitude` | `resolved_longitude` | float | Grid cell center longitude |
| Response `elevation` | `elevation_m` | float | 90m DEM elevation (meters) |

---

## Metadata Fields

| Source | GOD EYES Field | Type | Notes |
|--------|----------------|------|-------|
| System clock | `fetched_at` | ISO 8601 | When GOD EYES fetched the data |
| Constant | `source_id` | string | Always "open-meteo" |
| Storage path | `raw_evidence_uri` | string | Path to raw response file |
| Response `generationtime_ms` | `provider_metadata.generation_time_ms` | float | API generation time |
| Response `utc_offset_seconds` | `provider_metadata.utc_offset_seconds` | int | Timezone offset |
| Response `timezone` | `provider_metadata.timezone` | string | Timezone identifier |
| Response `timezone_abbreviation` | `provider_metadata.timezone_abbreviation` | string | Timezone abbreviation |
| Request `cell_selection` | `provider_metadata.cell_selection` | string | land/sea/nearest |
| Request `models` | `provider_metadata.model_name` | string | Selected model |

---

## Weather Code to Label Mapping

Open-Meteo returns numeric WMO codes only. GOD EYES must map them to human-readable labels.

| WMO Code | Open-Meteo Description | GOD EYES Label |
|----------|------------------------|----------------|
| 0 | Clear sky | Clear Sky |
| 1 | Mainly clear | Mainly Clear |
| 2 | Partly cloudy | Partly Cloudy |
| 3 | Overcast | Overcast |
| 45 | Fog | Foggy |
| 48 | Depositing rime fog | Depositing Rime Fog |
| 51 | Light drizzle | Light Drizzle |
| 53 | Moderate drizzle | Moderate Drizzle |
| 55 | Dense drizzle | Dense Drizzle |
| 56 | Light freezing drizzle | Light Freezing Drizzle |
| 57 | Dense freezing drizzle | Dense Freezing Drizzle |
| 61 | Slight rain | Slight Rain |
| 63 | Moderate rain | Moderate Rain |
| 65 | Heavy rain | Heavy Rain |
| 66 | Light freezing rain | Light Freezing Rain |
| 67 | Heavy freezing rain | Heavy Freezing Rain |
| 71 | Slight snow fall | Slight Snow Fall |
| 73 | Moderate snow fall | Moderate Snow Fall |
| 75 | Heavy snow fall | Heavy Snow Fall |
| 77 | Snow grains | Snow Grains |
| 80 | Slight rain showers | Slight Rain Showers |
| 81 | Moderate rain showers | Moderate Rain Showers |
| 82 | Violent rain showers | Violent Rain Showers |
| 85 | Slight snow showers | Slight Snow Showers |
| 86 | Heavy snow showers | Heavy Snow Showers |
| 95 | Thunderstorm | Thunderstorm |
| 96 | Thunderstorm with slight hail | Thunderstorm with Slight Hail |
| 99 | Thunderstorm with heavy hail | Thunderstorm with Heavy Hail |

**Note:** Open-Meteo does NOT provide text labels — only numeric codes. GOD EYES must implement the mapping.

---

## Field Availability by Request Type

| Field | Available in `current` | Available in `hourly` | Available in `daily` |
|-------|----------------------|---------------------|---------------------|
| temperature_2m | Yes | Yes | Yes (max/min/mean) |
| apparent_temperature | Yes | Yes | Yes (max/min/mean) |
| relative_humidity_2m | Yes | Yes | Yes (max/min/mean) |
| precipitation | Yes | Yes | Yes (sum) |
| precipitation_probability | **No** | Yes | Yes (max) |
| weather_code | Yes | Yes | Yes |
| cloud_cover | Yes | Yes | Yes (max/min/mean) |
| pressure_msl | Yes | Yes | Yes (max/min/mean) |
| surface_pressure | Yes | Yes | Yes (max/min/mean) |
| wind_speed_10m | Yes | Yes | Yes (max/mean) |
| wind_direction_10m | Yes | Yes | Yes (dominant) |
| wind_gusts_10m | Yes | Yes | Yes (max) |

---

## Unit Preservation

**No unit conversion needed for MVP.** The fetcher requests metric units (celsius, km/h, mm) and stores them directly. Open-Meteo returns values in the requested units.

| Requested Unit | Open-Meteo Returns | GOD EYES Stores |
|----------------|-------------------|-----------------|
| `temperature_unit=celsius` | °C | °C |
| `wind_speed_unit=kmh` | km/h | km/h |
| `precipitation_unit=mm` | mm | mm |
| (default) pressure | hPa | hPa |
| (default) humidity | % | % |
| (default) cloud cover | % | % |
| (default) wind direction | ° | ° |

---

## Missing Field Handling

| Scenario | GOD EYES Behavior |
|----------|-------------------|
| Field missing from response | Store as NULL |
| Field present but null | Store as NULL |
| Field present but wrong type | Log warning, store as NULL |
| `precipitation_probability` in current | NULL (not available in current block) |
| `wind_gusts` not available | Store as NULL |
| `surface_pressure` not requested | Store as NULL in `provider_metadata` |
