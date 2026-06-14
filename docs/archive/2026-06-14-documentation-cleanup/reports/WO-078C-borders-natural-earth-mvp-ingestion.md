# WO-078C Borders Natural Earth MVP Ingestion Report

LLM model: Codex
CLI / tool: Codex CLI
Working directory: E:\god-eyes-mvp-database
Branch: agent/borders-natural-earth-ingestion
Work order: WO-078C-BORDERS-NATURAL-EARTH-MVP-INGESTION
Role: Database/data ingestion engineer
Task type: Natural Earth MVP ingestion implementation only. No API. No frontend.

---

## Summary

Implemented MVP/local/dev ingestion for Natural Earth Admin-0 Countries 1:50m into the existing `layer_02_borders_boundaries` schema.

The worker defaults to dry-run and requires `--persist` for database writes. Runtime downloads are cached under `raw/layer_02_borders_boundaries/natural_earth_admin0_50m`, which is not committed. The script also supports `--input-zip` for local replay.

No API, frontend, service scheduler, database migration, or full raw Natural Earth dataset was added.

---

## Source And Terms Verification

- Dataset page: `https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries-2/`
- Download URL used by the worker: `https://naturalearth.s3.amazonaws.com/50m_cultural/ne_50m_admin_0_countries.zip`
- Terms URL recorded in source metadata: `https://www.naturalearthdata.com/about/terms-of-use/`
- Natural Earth terms identify the map data as public domain and note that downloads are hosted by Amazon Web Services.

The legacy Natural Earth WordPress download path returned HTTP 500 during validation, so the worker uses the Natural Earth AWS-hosted object instead of an unofficial mirror.

---

## Implementation

Created:

- `services/fetch-orchestrator/src/layers/layer_02_borders_boundaries/__init__.py`
- `services/fetch-orchestrator/src/layers/layer_02_borders_boundaries/natural_earth_admin0_ingest.py`
- `tests/data/layer_02_borders_boundaries/test_natural_earth_admin0_ingest.py`
- `docs/work-orders/WO-078C-borders-natural-earth-mvp-ingestion.md`
- `docs/reports/WO-078C-borders-natural-earth-mvp-ingestion.md`

Modified:

- `docs/state/HANDOFF_LOG.md`

The ingestion worker:

- Parses Natural Earth DBF attributes and polygon/multipolygon SHP geometry.
- Builds `MULTIPOLYGON` WKT and inserts geometry with `ST_GeomFromText(..., 4326)`, `ST_MakeValid`, and `ST_Multi`.
- Inserts/upserts the `border_boundary_sources` row for `natural_earth_admin0_50m`.
- Inserts/upserts `border_boundaries` rows on `(source_id, source_object_id)`.
- Uses parameterized SQL through `psycopg`.
- Removes DBF NUL padding before database writes.
- Stores invalid Natural Earth ISO display codes such as `CN-TW` as JSON source properties while leaving constrained ISO columns nullable.

---

## Compliance Controls

Source metadata:

- `source_id = natural_earth_admin0_50m`
- `source_name = Natural Earth Admin-0 Countries 1:50m`
- `approved_for_india = false`
- `approved_for_non_india = false`
- `india_conflict_checked = false`
- `approval_notes = MVP/local/dev only; not production-approved; not India-compliant; Natural Earth uses de facto boundaries and must not replace Survey of India review.`

Boundary rows:

- `layer_id = layer_02_borders_boundaries`
- `boundary_type = country_boundary`
- `boundary_level = admin0`
- `admin_level = 0`
- India-sensitive rows use `india_compliance_status = requires_soi_review`.
- Non-India-sensitive rows use `india_compliance_status = not_applicable`.

No row or source metadata is marked `soi_approved`.

---

## Local PostGIS Smoke Results

Commands run against local `god-eyes-postgis`:

```powershell
python services/fetch-orchestrator/src/layers/layer_02_borders_boundaries/natural_earth_admin0_ingest.py
python services/fetch-orchestrator/src/layers/layer_02_borders_boundaries/natural_earth_admin0_ingest.py --persist
python services/fetch-orchestrator/src/layers/layer_02_borders_boundaries/natural_earth_admin0_ingest.py --persist
docker exec god-eyes-postgis psql -U god_eyes -d god_eyes_dev -tAc "SELECT (SELECT count(*) FROM border_boundary_sources WHERE source_id='natural_earth_admin0_50m') AS source_rows, (SELECT count(*) FROM border_boundaries WHERE source_id='natural_earth_admin0_50m') AS boundary_rows, (SELECT count(*) FROM border_boundaries WHERE source_id='natural_earth_admin0_50m' AND india_compliance_status='soi_approved') AS soi_approved_rows, (SELECT count(*) FROM border_boundaries WHERE source_id='natural_earth_admin0_50m' AND india_sensitive) AS india_sensitive_rows;"
docker exec god-eyes-postgis psql -U god_eyes -d god_eyes_dev -tAc "SELECT approved_for_india, approved_for_non_india, india_conflict_checked, approval_notes FROM border_boundary_sources WHERE source_id='natural_earth_admin0_50m';"
```

Results:

- Dry-run features parsed: 242
- Dry-run boundaries normalized: 242
- Persist source rows written/upserted: 1
- Persist boundary rows written/upserted: 242
- Source rows after second persist: 1
- Boundary rows after second persist: 242
- India-sensitive rows: 3
- `soi_approved` rows: 0
- Source approval flags: `approved_for_india = false`, `approved_for_non_india = false`, `india_conflict_checked = false`

---

## Validation

```powershell
git diff --check
python -m pytest tests/data/layer_02_borders_boundaries -q
python -m pytest tests/data/layer_03_earth_events -q
python -m compileall services tests/data/layer_02_borders_boundaries
```

Validation results:

- `python -m pytest tests/data/layer_02_borders_boundaries -q`: 20 passed
- `python -m pytest tests/data/layer_03_earth_events -q`: 16 passed
- `python -m compileall services tests/data/layer_02_borders_boundaries`: passed
- `git diff --check`: passed

---

## Safety Outcome

- Natural Earth official source used: YES
- Dry-run default: YES
- Persist requires explicit flag: YES
- Source metadata inserted: YES, with local PostGIS persist
- Boundary rows inserted: YES, with local PostGIS persist
- Idempotent persist: YES
- Rows inserted count: 242
- Source row count: 1
- No production approval claimed: YES
- No India compliance claimed: YES
- No `soi_approved` rows: YES
- Raw full dataset committed: NO
- API touched: NO
- Frontend touched: NO
- Database migration touched: NO
- Tests added: YES
