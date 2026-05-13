# GOD EYES Data Migrations

WO-002 uses plain SQL files only.

Start local infrastructure:

```powershell
docker compose -f infra/docker/docker-compose.yml up -d
```

Run migrations against the local PostGIS container:

```powershell
Get-Content database/migrations/core/*.sql, database/migrations/layers/layer_01_aviation/*.sql |
  docker exec -i god-eyes-postgis psql -U god_eyes -d god_eyes_dev
```

Stop local infrastructure:

```powershell
docker compose -f infra/docker/docker-compose.yml down
```

Run the OurAirports collector:

```powershell
python services/fetch-orchestrator/src/layers/layer_01_aviation/ourairports_collector.py
```

Run the normalizer after replacing the fetch run ID printed by the collector:

```powershell
python services/normalizer/src/layers/layer_01_aviation/ourairports_normalizer.py --fetch-run-id <fetch_run_id>
```

Run data tests:

```powershell
python -m pytest tests/data/layer_01_aviation -q
```

Do not commit downloaded CSV files, MinIO data, Postgres volumes, or local `.env` files.
