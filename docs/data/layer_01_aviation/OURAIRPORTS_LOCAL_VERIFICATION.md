# OurAirports Local Verification

WO-005 verified the real local Layer 1 aviation data pipeline on 2026-05-14 using Docker, PostgreSQL/PostGIS, MinIO, the real OurAirports CSV files, the existing collector, the existing normalizer, and the Fastify API.

## Docker Infrastructure

Start local infrastructure:

```powershell
docker compose -f infra/docker/docker-compose.yml up -d
```

Verification commands:

```powershell
docker ps
docker compose -f infra/docker/docker-compose.yml logs --tail=80
docker exec god-eyes-postgis psql -U god_eyes -d god_eyes_dev -c "SELECT version();"
docker exec god-eyes-postgis psql -U god_eyes -d god_eyes_dev -c "SELECT PostGIS_Version();"
Invoke-WebRequest -UseBasicParsing http://localhost:9000/minio/health/live
```

Result:

- `god-eyes-postgis` healthy on port `5432`
- `god-eyes-minio` healthy on ports `9000` and `9001`
- PostgreSQL 16.4 reachable
- PostGIS 3.4 reachable
- MinIO health endpoint returned HTTP 200

## MinIO Bucket

Bucket:

```text
god-eyes-raw
```

The compose bucket bootstrap container created the bucket and set anonymous access to private.

Bucket verification command:

```powershell
docker run --rm --network docker_default --entrypoint /bin/sh minio/mc:RELEASE.2025-04-16T18-13-26Z -c "mc alias set local http://minio:9000 god_eyes_minio_dev replace_with_dev_secret >/dev/null && mc stat local/god-eyes-raw"
```

## Migrations

Migration command:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/apply_migrations.ps1
```

The script applies, in order:

1. `database/migrations/core/001_core_ingestion_tables.sql`
2. `database/migrations/layers/layer_01_aviation/001_aviation_reference_tables.sql`

Verification query:

```powershell
docker exec god-eyes-postgis psql -U god_eyes -d god_eyes_dev -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('fetch_runs','raw_objects','aviation_airports','aviation_runways','aviation_navaids','aviation_airport_frequencies','aviation_countries','aviation_regions') ORDER BY table_name;"
```

Result: all 8 expected tables exist.

## Collector

Collector command:

```powershell
python services/fetch-orchestrator/src/layers/layer_01_aviation/ourairports_collector.py
```

Local dependency setup used before running the collector:

```powershell
python -m pip install -r requirements-data.txt
```

Result:

```text
fetch_run_a011fea1694d4151850dd8a35dc256e7
```

The collector downloaded and stored these real OurAirports files:

- `airports.csv`
- `runways.csv`
- `navaids.csv`
- `airport-frequencies.csv`
- `countries.csv`
- `regions.csv`

Fetch run verification:

```text
id                                           status     record_count  file_count
fetch_run_a011fea1694d4151850dd8a35dc256e7  completed  178804        6
```

Raw objects written:

| Filename | Validation | Rows | Bytes |
|---|---:|---:|---:|
| `airport-frequencies.csv` | valid | 30275 | 1296474 |
| `airports.csv` | valid | 85377 | 12625714 |
| `countries.csv` | valid | 249 | 24583 |
| `navaids.csv` | valid | 11010 | 1525245 |
| `regions.csv` | valid | 3982 | 484601 |
| `runways.csv` | valid | 47911 | 3946633 |

Raw storage example path:

```text
raw/layer_01_aviation/ourairports/2026/05/14/fetch_run_a011fea1694d4151850dd8a35dc256e7/airports.csv
```

MinIO object verification:

```powershell
docker run --rm --network docker_default --entrypoint /bin/sh minio/mc:RELEASE.2025-04-16T18-13-26Z -c "mc alias set local http://minio:9000 god_eyes_minio_dev replace_with_dev_secret >/dev/null && mc ls --recursive local/god-eyes-raw/raw/layer_01_aviation/ourairports/2026/05/14/fetch_run_a011fea1694d4151850dd8a35dc256e7"
```

## Normalizer

Normalizer command:

```powershell
python services/normalizer/src/layers/layer_01_aviation/ourairports_normalizer.py --fetch-run-id fetch_run_a011fea1694d4151850dd8a35dc256e7
```

Result:

| Table | Rows |
|---|---:|
| `aviation_airport_frequencies` | 30275 |
| `aviation_airports` | 85377 |
| `aviation_countries` | 249 |
| `aviation_navaids` | 11010 |
| `aviation_regions` | 3982 |
| `aviation_runways` | 47911 |

The normalizer was run a second time against the same `fetch_run_id`; counts remained unchanged, verifying idempotent upserts.

Compatibility fix made during verification:

- Cast PostGIS EWKT parameters to `text` in airport and navaid upserts so psycopg/PostgreSQL can infer parameter types.

## API Verification

Start API:

```powershell
pnpm --filter api dev
```

Required endpoint checks:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:4000/api/health
Invoke-WebRequest -UseBasicParsing http://localhost:4000/api/layers
Invoke-WebRequest -UseBasicParsing http://localhost:4000/api/layers/layer_01_aviation/status
Invoke-WebRequest -UseBasicParsing "http://localhost:4000/api/layers/layer_01_aviation/objects?objectType=airport&limit=10"
Invoke-WebRequest -UseBasicParsing "http://localhost:4000/api/layers/layer_01_aviation/objects?objectType=airport&search=Dubai&limit=10"
```

Results:

- `/api/health`: HTTP 200, `status: ok`, database connected
- `/api/layers`: HTTP 200, Layer 0 and Layer 1 returned
- `/api/layers/layer_01_aviation/status`: HTTP 200, `status: ok`, real aviation counts returned
- `/api/layers/layer_01_aviation/objects?objectType=airport&limit=10`: HTTP 200, real airport records returned
- `/api/layers/layer_01_aviation/objects?objectType=airport&search=Dubai&limit=10`: HTTP 200, Dubai airport records returned, including `Dubai International Airport` / `OMDB`

API status response counts:

```json
{
  "airports": 85377,
  "runways": 47911,
  "navaids": 11010,
  "airportFrequencies": 30275,
  "countries": 249,
  "regions": 3982
}
```

Compatibility fix made during verification:

- Convert `pg` timestamp `Date` values to ISO datetime strings in the airport object mapper before contract validation.

The existing Postman collection can also be used:

```text
docs/postman/GOD_EYES_LOCAL_API.postman_collection.json
```

## Tests And Builds

Commands run:

```powershell
python -m pytest tests/data/layer_01_aviation -q
python -m compileall packages/schemas services/fetch-orchestrator services/normalizer tests/data/layer_01_aviation
pnpm --filter api build
pnpm --filter api test
pnpm --filter @god-eyes/contracts build
docker compose -f infra/docker/docker-compose.yml config --quiet
```

Results:

- Data tests: 20 passed
- Python compile: passed
- API build: passed
- API tests: 7 passed
- Contracts build: passed
- Docker Compose config: passed

## Known Issues

None remaining for WO-005 verification.

The local Python environment initially lacked `psycopg`/`boto3`; installing `requirements-data.txt` resolved it.

## Safe Rerun

To rerun without committing generated data:

```powershell
docker compose -f infra/docker/docker-compose.yml up -d
powershell -ExecutionPolicy Bypass -File scripts/apply_migrations.ps1
python -m pip install -r requirements-data.txt
python services/fetch-orchestrator/src/layers/layer_01_aviation/ourairports_collector.py
python services/normalizer/src/layers/layer_01_aviation/ourairports_normalizer.py --fetch-run-id <fetch_run_id>
pnpm --filter api dev
```

Do not commit `.env`, Docker volumes, MinIO data, Postgres data, downloaded CSV files, `node_modules`, or `__pycache__`.
