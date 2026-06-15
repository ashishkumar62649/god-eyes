# WO-051: Airport Image Gallery Fetcher MVP

**Status:** Implementation
**Layer:** layer_01_aviation
**Agent:** Codex (Fetching and normalization implementation engineer)
**Date:** 2026-05-21

## Goal

Build the MVP airport image gallery fetcher that collects multiple source-backed airport images from Wikimedia/Wikipedia/Wikidata, normalizes them, ranks them, and persists them into the `airport_image_assets` table.

## Files Created

| File | Purpose |
|------|---------|
| `services/fetch-orchestrator/src/layers/layer_01_aviation/airport_image_gallery_worker.py` | Main worker CLI |
| `services/fetch-orchestrator/src/layers/layer_01_aviation/airport_image_gallery_db.py` | DB helper for airport_image_assets |
| `services/normalizer/src/layers/layer_01_aviation/airport_image_gallery_normalizer.py` | Image normalization and ranking |
| `tests/data/layer_01_aviation/test_airport_image_gallery_worker.py` | Unit and integration tests |

## Sources Used

1. **Local database**: `aviation_airports`, `airport_source_links` — for airport identity and existing Wikipedia/Wikidata source links
2. **Wikipedia REST API**: Page image list (`prop=images`) — discovers images referenced in Wikipedia articles
3. **Wikimedia Commons**: `imageinfo` endpoint — fetches file metadata including URLs, dimensions, license, attribution
4. **Wikimedia Commons category**: `categorymembers` endpoint — lists files in a Commons category (from Wikidata P373)
5. **Wikidata**: Entity data endpoint — extracts P18 (main image) and P373 (Commons category)

## Rate-Limit Strategy

- User-Agent: `GodEyes/0.1 (dev/test; https://github.com/anomalyco/god-eyes)`
- Default sleep between external requests: **1.5 seconds**
- Configurable via `--sleep-seconds` flag
- On 429 (rate limited): reads `Retry-After` header, backs off accordingly
- On 503 (service unavailable): exponential backoff (base * 2^attempt)
- Max retries: 2 per request
- No aggressive bulk jobs — MVP limited to small batch only

## Dry-Run vs Persist

- **Dry-run is the default** — no `--persist` flag means read-only mode
- `--persist` is **required** for any database writes
- Dry-run fetches, normalizes, ranks, and prints candidate images
- Persist mode upserts rows into `airport_image_assets`

## Test Batch

MVP is limited to these 10 airports:
- KBDL, KBOS, KPVD, KJFK, KLAX, EGLL, OMDB, VIDP, WSSS, RJTT

No all-airport backfill is performed.

## CLI Usage

```bash
# Dry-run single airport
python services/fetch-orchestrator/src/layers/layer_01_aviation/airport_image_gallery_worker.py \
  --icao KBDL \
  --database-url "postgresql://god_eyes:god_eyes_dev_password@localhost:5432/god_eyes_dev" \
  --show-raw

# Persist single airport
python services/fetch-orchestrator/src/layers/layer_01_aviation/airport_image_gallery_worker.py \
  --icao KBDL \
  --database-url "postgresql://god_eyes:god_eyes_dev_password@localhost:5432/god_eyes_dev" \
  --persist

# Batch dry-run
python services/fetch-orchestrator/src/layers/layer_01_aviation/airport_image_gallery_worker.py \
  --batch-test-airports \
  --max-airports 10 \
  --database-url "postgresql://god_eyes:god_eyes_dev_password@localhost:5432/god_eyes_dev"
```

## Image Classification (MVP keyword-based)

| Keyword | image_kind |
|---------|-----------|
| logo, emblem, badge, symbol, icon | logo |
| aerial, airfield, overview | aerial |
| runway, taxiway, apron | runway |
| terminal, concourse, gate | terminal |
| tower, control tower | tower |
| interior, inside, lobby | interior |
| map, diagram, layout | map |
| (default) | photo |

## Ranking

- Lower rank number = better
- Photo: -40, Aerial: -35, Terminal: -30, Runway: -25, Tower/Interior: -20
- Logo: +20 (penalized), Map: +10
- Large images (>=1000px): -10, Medium (>=600px): -5
- High confidence: -10, Medium: -5
- Wikimedia Commons source: -5

## Hero Selection

- Prefers non-logo images as hero
- If all candidates are logos, picks the first one
- Only one `is_hero=true` per airport (enforced by DB partial unique index)
- Previous hero flag is cleared before setting new hero

## Known Limitations

- MVP uses simple keyword-based image classification (no ML)
- Only Wikimedia/Wikipedia/Wikidata sources (no official sites, Flickr, etc.)
- No all-airport backfill — limited to test batch
- No image downloading/storage — only URL references
- No content-based deduplication (URL-based only)
- No image quality scoring beyond dimensions
- Wikidata QID resolution only from existing `airport_source_links` (no SPARQL lookup in worker)
- No automatic refresh/expiry management yet

## Dependencies

- Requires `airport_image_assets` table (WO-050 migration: `010_airport_image_assets.sql`)
- Requires `aviation_airports` table (migration `001_aviation_reference_tables.sql`)
- Requires `airport_source_links` table (migration `006_airport_intelligence_foundation.sql`)
- Python `psycopg` for database connectivity
- Python `urllib` for HTTP requests (no external HTTP library)

## Tests

Run:
```bash
python -m pytest tests/data/layer_01_aviation/test_airport_image_gallery_worker.py -q
python -m pytest tests/data/layer_01_aviation -q
```

Test coverage:
1. Normalizer maps Wikimedia imageinfo into DB-ready rows
2. Bad/tiny/placeholder image candidates are skipped
3. Ranking prefers real photo over logo
4. Only one hero image selected
5. Duplicate image URLs are deduped
6. Dry-run does not write to DB
7. --persist writes/upserts airport_image_assets rows
8. Missing table returns clear error
9. 429/503 response produces diagnostics/backoff behavior
10. No fake image inserted when no candidates found
11. License/attribution fields are preserved when present
12. Existing Layer 1 tests still pass
