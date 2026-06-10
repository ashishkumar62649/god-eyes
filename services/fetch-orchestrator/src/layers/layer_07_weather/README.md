# Layer 07 Weather — Open-Meteo Fetcher

Fetches real weather data from Open-Meteo for the GOD EYES Weather layer.

---

## Module Purpose

Implements the full fetch pipeline for `layer_07_weather`:

- **open_meteo_client.py** — HTTP client with retry/backoff
- **weather_grid.py** — 5° global grid generation and batching
- **weather_raw_storage.py** — saves raw responses to disk before any normalization
- **weather_fetcher.py** — orchestration (proof, dry-run, fetch modes)
- **weather_cli.py** — CLI entry point
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
