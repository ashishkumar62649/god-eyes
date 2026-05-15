# Aviation Coordinate Migration Verification

WO-017 applied and verified migration `004_aviation_coordinate_quality_overrides.sql`
against the local Docker PostGIS database.

## Migration Result

- Migration applied: yes
- Migration file:
  `database/migrations/layers/layer_01_aviation/004_aviation_coordinate_quality_overrides.sql`
- Database environment tested: local Docker Compose PostGIS service
  `god-eyes-postgis`, database `god_eyes_dev`, user `god_eyes`
- Apply command:

```powershell
Get-Content database\migrations\layers\layer_01_aviation\004_aviation_coordinate_quality_overrides.sql |
  docker exec -i god-eyes-postgis psql -v ON_ERROR_STOP=1 -U god_eyes -d god_eyes_dev
```

The migration completed with `CREATE TABLE` and `CREATE INDEX` results. The only
notice was that `pgcrypto` already existed.

## Commands Run

```powershell
git branch --show-current
git status
docker compose -f infra/docker/docker-compose.yml up -d
docker compose -f infra/docker/docker-compose.yml ps
docker compose -f infra/docker/docker-compose.yml config --quiet
Get-Content database\migrations\layers\layer_01_aviation\004_aviation_coordinate_quality_overrides.sql | docker exec -i god-eyes-postgis psql -v ON_ERROR_STOP=1 -U god_eyes -d god_eyes_dev
python scripts\aviation_coordinate_quality.py --json
python -m pytest tests/data/layer_01_aviation/test_aviation_coordinate_migration_verification.py -q
```

Additional verification SQL queried `information_schema.columns`, `pg_constraint`,
and `pg_indexes` for the new tables.

## Tables Verified

Tables verified in local PostGIS:

- `aviation_coordinate_quality_reviews`
- `aviation_coordinate_overrides`

Expected columns were present, including source identity fields, review fields,
original and override coordinates, confidence score, approval fields, active flag,
and timestamps.

## Constraints Verified

Constraints verified in local PostGIS:

- `original_latitude` between -90 and 90
- `override_latitude` between -90 and 90
- `original_longitude` between -180 and 180
- `override_longitude` between -180 and 180
- `confidence_score` null or between 0 and 1
- nonblank `override_reason`
- bounded quality review status values

Invalid insert attempts were executed inside a transaction and rolled back. The
database rejected all six invalid cases:

- latitude less than -90
- latitude greater than 90
- longitude less than -180
- longitude greater than 180
- confidence score less than 0
- confidence score greater than 1

The transaction printed `verified 6 invalid coordinate/confidence rows rejected`
and ended with `ROLLBACK`.

## Indexes Verified

Indexes verified in local PostGIS:

- `idx_aviation_coordinate_quality_reviews_source`
- `idx_aviation_coordinate_quality_reviews_airport_ident`
- `idx_aviation_coordinate_quality_reviews_status`
- `idx_aviation_coordinate_overrides_source`
- `idx_aviation_coordinate_overrides_airport_ident`
- `idx_aviation_coordinate_overrides_active`
- `idx_aviation_coordinate_overrides_one_active_per_source`

The active override lookup uses a partial unique index on
`source_id, source_object_id` where `active`.

## Coordinate Quality Script Output Summary

After migration apply, `python scripts\aviation_coordinate_quality.py --json`
reported:

| Metric | Count |
|---|---:|
| Total airports | 85,377 |
| Heliports | 22,980 |
| Closed/abandoned airports | 13,181 |
| Suspicious zero coordinates | 0 |
| Low coordinate precision candidates | 127 |
| Missing municipality or country candidates | 4,705 |
| Quality reviews | 0 |
| Active overrides | 0 |

The zero review and override counts are expected because verification inserts
were rolled back and no real manual override records exist yet.

## Source Data Preservation

Source data preservation result: passed.

Before migration:

- `aviation_airports` row count: 85,377
- Deterministic 25-row coordinate/geometry sample hash:
  `760dde5c03072db19d8b66c6369e6b46`

After migration and rollback verification:

- `aviation_airports` row count: 85,377
- Deterministic 25-row coordinate/geometry sample hash:
  `760dde5c03072db19d8b66c6369e6b46`

No override values were written back into `aviation_airports`. Raw/source-derived
coordinates remain preserved.

## Known Limitations

- Local Docker is not production hardware.
- Test inserts were intentionally rolled back.
- API routes do not consume coordinate overrides yet.
- No real manual coordinate review or override records exist yet.

## Next Safe Task

Create an API-owned, opt-in effective-coordinate query path that can prefer a
single active approved override while still exposing source-derived coordinates
and provenance for audit.
