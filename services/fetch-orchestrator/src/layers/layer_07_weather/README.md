# Layer 07 Weather — Open-Meteo Fetcher

Fetches real weather data from Open-Meteo for the GOD EYES Weather layer.

---

## Module Purpose

Implements the full fetch and normalization pipeline for `layer_07_weather`:

- **open_meteo_client.py** — HTTP client with retry/backoff
- **weather_grid.py** — 5° global grid generation and batching
- **weather_raw_storage.py** — saves raw responses to disk before any normalization
- **weather_fetcher.py** — orchestration (proof, dry-run, fetch modes)
- **weather_cli.py** — fetch CLI entry point
- **weather_codes.py** — WMO weather code → human-readable label mapping
- **weather_normalizer.py** — normalizes raw Open-Meteo responses to GOD EYES schema
- **open_meteo_proof.py** — WO-WEATHER-S proof script (preserved)

---

## No API Key Required

Open-Meteo is a free open weather API. No API key, no `.env` dependency.

---

## Commands

### Proof mode

Fetches the 7 WO-WEATHER-S proof cities with `forecast_days=1`.

```
python -m layers.layer_07_weather.weather_cli proof
```

### Dry-run mode

Generates grid and batches, prints summary. **No API calls. No files written.**

```
python -m layers.layer_07_weather.weather_cli dry-run --grid-spacing 5 --batch-size 50
```

### Fetch mode

Fetch proof coordinates only:

```
python -m layers.layer_07_weather.weather_cli fetch --proof --forecast-days 1
```

Safe partial fetch (1 batch, no confirmation required):

```
python -m layers.layer_07_weather.weather_cli fetch --grid-spacing 5 --batch-size 50 --forecast-days 3 --max-batches 1
```

Full global grid (requires explicit flag):

```
python -m layers.layer_07_weather.weather_cli fetch --grid-spacing 5 --batch-size 50 --forecast-days 3 --allow-full-grid
```

Without `--allow-full-grid` or `--max-batches`, a full-grid fetch is **refused**.

### Inspect-cache mode

Lists recent fetch runs and their summaries.

```
python -m layers.layer_07_weather.weather_cli inspect-cache
```

---

## Safety Rules

- Full global grid fetch **must use `--allow-full-grid`** explicitly.
- Raw files are written to `raw/layer_07_weather/open-meteo/` — **never commit these**.
- No API key is used or required.
- No `.env` file is read.
- No normalization or database writes happen here.
- Fake data is never generated.

---

## Raw Output Path

```
raw/layer_07_weather/open-meteo/{yyyy}/{mm}/{dd}/{fetch_run_id}/
    metadata.json
    batches/batch_001.json
    batches/batch_002.json
    preview.json
    observed_fields.json
    fetch_report.md
```

> **WARNING: Raw files must not be committed to git.**
> Add `raw/` to `.gitignore` and verify with `git ls-files raw/`.

---

## Recommended Batch Size

**50 coordinates per request.** Balances response size against API call count.
Supported values: 25, 50, 100.

---

## Grid Summary (5° default)

| Parameter | Value |
|-----------|-------|
| Latitude range | −90 to +90 inclusive (37 values) |
| Longitude range | −180 inclusive to +175 (72 values; +180 excluded — same meridian as −180) |
| Total coordinates | **37 × 72 = 2664** |
| Batch count (50/batch) | **54 batches** |
| Planned API calls | 54 per full global fetch |

---

## forecast_days

- Full fetcher default: **3** (72 hourly timestamps per coordinate)
- Proof mode: **1**

---

## API-Call Accounting

Open-Meteo does **not** expose rate-limit or quota headers. All accounting is
client-side: count HTTP requests. Assume 1 HTTP request = 1 API call.
Monitor for HTTP 429 as the actual rate-limit signal.

---

## location_id Preservation

Open-Meteo returns a `location_id` integer per coordinate in the response.
This is preserved in raw storage. During normalization (WO-WEATHER-N),
`location_id` should be stored in `provider_metadata.location_id`.

---

## Source Attribution

Weather data provided by [Open-Meteo](https://open-meteo.com/) under CC-BY 4.0 licence.


---

## Normalizer

### Purpose

`weather_normalizer.py` converts raw Open-Meteo batch JSON files into structured GOD EYES weather observation dicts. No database writes occur here.

### Normalized Object Shape (summary)

```python
{
    "observation_id": str,          # sha256[:24] of location_id|source|forecast_for
    "layer_id": "layer_07_weather",
    "source_id": "open-meteo",
    "location_id": str,             # sha256[:16] of layer|source|grid|lat|lon
    "requested_latitude": float,    # original requested coordinate
    "requested_longitude": float,
    "resolved_latitude": float,     # Open-Meteo grid cell center
    "resolved_longitude": float,
    "elevation_m": float | None,
    "observation_type": "current" | "hourly",
    "forecast_for": str,            # ISO 8601 — time data is valid for
    "fetched_at": str,              # ISO 8601 — when GOD EYES fetched
    "temperature_c": float,
    "apparent_temperature_c": float | None,
    "wind_speed_kph": float | None,
    "wind_direction_deg": float | None,
    "wind_gust_kph": float | None,
    "humidity_percent": int | None,
    "pressure_hpa": float | None,
    "precipitation_mm": float | None,
    "precipitation_probability_percent": int | None,  # None for current
    "cloud_cover_percent": int | None,
    "weather_code": int | None,
    "weather_label": str | None,
    "raw_evidence_uri": str | None,
    "provider_metadata": { ... },
}
```

### Current vs Hourly Behavior

- **current**: one observation per response item; `precipitation_probability_percent` is always `None` (not available in current block).
- **hourly**: one observation per hourly timestamp per response item; `precipitation_probability_percent` is available.

### Requested vs Resolved Coordinates

`requested_latitude/longitude` are the coordinates passed to the normalizer (from the fetcher batch). `resolved_latitude/longitude` are the grid-cell-center coordinates returned by Open-Meteo. These may differ by 3–21 km due to model grid resolution.

### provider_metadata.location_id

Open-Meteo returns a `location_id` integer per coordinate. It is preserved in `provider_metadata.location_id` for reference. The GOD EYES `location_id` is a separate deterministic hash of the requested coordinates.

### No Database Writes

The normalizer produces Python dicts only. Database ingestion is handled in a later work order (WO-WEATHER-D).
