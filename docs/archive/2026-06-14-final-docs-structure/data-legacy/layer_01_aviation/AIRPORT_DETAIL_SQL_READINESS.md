# Airport Detail SQL Readiness

WO-023 benchmarks the read-only SQL patterns expected for Airport Detail API v1
and future Object Intel sections. This work order does not implement API routes,
frontend UI, contracts, migrations, or source data changes.

## Purpose

The future airport detail endpoint needs production-safe SQL for:

- airport overview and source/provenance fields
- runways
- airport frequencies
- nearby navaids
- source coordinates and optional active coordinate override compatibility

The benchmark script is `scripts/aviation_airport_detail_sql_readiness.py`.

## Database State Tested

- Environment: local Docker PostGIS, database `god_eyes_dev`
- Source: normalized Layer 1 OurAirports data
- Command: `python scripts\aviation_airport_detail_sql_readiness.py --json --limit 5`
- Coordinate override tables present: yes
- Data mutation: none

## Queries Benchmarked

The script benchmarks these parameterized query shapes:

- Airport overview by `layer_id + source_id + source_airport_id`
- Airport overview by `layer_id + ident`
- Runways by `layer_id + source_id + airport_ident`
- Frequencies by `layer_id + source_id + airport_ident`
- Effective coordinates with optional active override left join
- Nearby navaids using airport `geom`, navaid `geom`, `ST_DWithin`, radius, and
  limit

Nearby navaid cases:

- 100 km, limit 20
- 100 km, limit 50
- 250 km, limit 20
- 250 km, limit 50

## Sample Airports Used

| Ident | Name | Type | Why included |
|---|---|---|---|
| `OMDB` | Dubai International Airport | large airport | major international airport |
| `KORD` | Chicago O'Hare International Airport | large airport | large US airport with rich details |
| `00A` | Total RF Heliport | heliport | heliport case |
| `00AA` | Aero B Ranch Airport | small airport | sparse/missing detail case |
| `KDFW` | Dallas Fort Worth International Airport | large airport | large airport with runways/frequencies |

The script accepts `--airport-ident` and will include that airport first when it
exists, then gracefully fills remaining samples from preferred and fallback
categories.

## Timing Results From Local Docker

Representative `EXPLAIN ANALYZE` execution times from the required command:

| Airport | Overview source | Overview ident | Runways | Frequencies | Effective coordinate |
|---|---:|---:|---:|---:|---:|
| `OMDB` | 0.028 ms | 0.022 ms | 0.040 ms | 0.025 ms | 0.047 ms |
| `KORD` | 0.041 ms | 0.023 ms | 0.031 ms | 0.026 ms | 0.036 ms |
| `00A` | 0.025 ms | 0.021 ms | 0.022 ms | 0.022 ms | 0.028 ms |
| `00AA` | 0.024 ms | 0.021 ms | 0.020 ms | 0.016 ms | 0.026 ms |
| `KDFW` | 0.019 ms | 0.021 ms | 0.029 ms | 0.023 ms | 0.026 ms |

Nearby navaid execution times:

| Airport | 100 km / 20 | 100 km / 50 | 250 km / 20 | 250 km / 50 |
|---|---:|---:|---:|---:|
| `OMDB` | 0.204 ms | 0.080 ms | 0.147 ms | 0.146 ms |
| `KORD` | 0.143 ms | 0.241 ms | 0.370 ms | 0.387 ms |
| `00A` | 0.179 ms | 0.176 ms | 0.473 ms | 0.606 ms |
| `00AA` | 0.097 ms | 0.079 ms | 0.181 ms | 0.175 ms |
| `KDFW` | 0.143 ms | 0.147 ms | 0.378 ms | 0.407 ms |

These are local Docker measurements, not production SLAs.

## EXPLAIN / Plan Observations

- Airport overview by source object used `idx_aviation_airports_source_airport_id`
  and returned one row.
- Airport overview by ident used `idx_aviation_airports_ident`.
- Runway lookups used `idx_aviation_runways_airport_ident`.
- Frequency lookups used `idx_aviation_airport_frequencies_airport_ident`.
- Effective coordinate lookup used `idx_aviation_airports_source_airport_id` plus
  `idx_aviation_coordinate_overrides_one_active_per_source`.
- Nearby navaid lookups used `idx_aviation_airports_source_airport_id` and
  `idx_aviation_navaids_geom`.
- Measured endpoint-shaped cases did not show sequential scans.

## Airport Overview Lookup Readiness

Airport overview lookup is ready for the first API implementation.

Recommended selector:

```sql
WHERE layer_id = $1
  AND source_id = $2
  AND source_airport_id = $3
```

The overview query returns source coordinate fields (`latitude_deg`,
`longitude_deg`) and `geom`, so the API can expose both source-derived
coordinates and future effective coordinates without mutating source data.

Ident lookup is also fast, but `source_id + source_airport_id` is the better
stable API identity because `ident` is a display/search field.

## Runway Join Readiness

Runway lookup is ready using:

```sql
WHERE layer_id = $1
  AND source_id = $2
  AND airport_ident = $3
```

The benchmark orders runways by `length_ft DESC NULLS LAST`, then endpoint
identifiers and source runway id. This is a practical first ordering for Object
Intel. Runway endpoint coordinates are often missing in the source data, so the
API should not require them for runway display.

## Frequency Join Readiness

Frequency lookup is ready using:

```sql
WHERE layer_id = $1
  AND source_id = $2
  AND airport_ident = $3
```

The benchmark orders frequencies by `type`, `frequency_mhz`, and source
frequency id. Future API code should defensively handle the small number of
missing or invalid frequency values documented in WO-020.

## Nearby Navaid Spatial Lookup Readiness

Nearby navaid lookup is ready with a bounded spatial query.

Recommended first API behavior:

- default radius: 100 km
- maximum radius for v1: 250 km
- default limit: 20
- maximum limit: 50
- return computed distance in kilometers

The measured query uses:

- selected airport `geom`
- navaid `geom`
- bounding-box prefilter with `ST_Expand`
- `ST_DWithin(...::geography, ...::geography, radius)`
- ordered distance

This kept the local plan on the navaid GiST index and avoided sequential scans.

## Effective Coordinate Compatibility

The coordinate override tables are present in this local database. The benchmark
measured an optional active override left join and found it used the active
override source index.

The API can safely start with source coordinates only, then add an effective
coordinate projection:

- source latitude/longitude from `aviation_airports`
- effective latitude/longitude from active override when present
- `coordinate_overridden` boolean
- override provenance fields when appropriate

This must remain a read-only API projection. Overrides must never be written
back into `aviation_airports`.

## Current Indexes Observed

Relevant existing indexes:

- `aviation_airports_source_id_source_airport_id_key`
- `idx_aviation_airports_source_airport_id`
- `idx_aviation_airports_ident`
- `idx_aviation_runways_airport_ident`
- `idx_aviation_airport_frequencies_airport_ident`
- `idx_aviation_navaids_geom`
- `idx_aviation_coordinate_overrides_one_active_per_source`

Search trigram indexes from WO-011 are present but not needed for exact detail
lookups.

## Index Recommendation

No new index migration is recommended from this benchmark.

The measured first-pass endpoint SQL uses existing indexes and returned
sub-millisecond execution times in local Docker. Composite indexes on
`(layer_id, source_id, airport_ident)` for runways/frequencies can remain a
future measured option only if the implemented API's EXPLAIN plans show a clear
need under realistic traffic and data volume.

## Limitations

- Local Docker timings are not production hardware measurements.
- Benchmark results are not production SLAs.
- Runway endpoint coordinates are often missing due to source data.
- No live operational data is included.
- No NOTAM, METAR, or TAF data is included.
- No live aircraft data is included.
- API endpoint implementation is outside this work order.

## Next Safe API Task

Claude/API can implement Airport Detail API v1 using the measured SQL shapes:

- select airport by `layer_id + source_id + source_airport_id`
- query runways/frequencies by `layer_id + source_id + airport_ident`
- query nearby navaids with bounded radius and limit
- expose source coordinate provenance, with optional effective coordinate fields
  only as a read-only projection

After implementation, run endpoint-specific EXPLAIN plans before considering
new database indexes.
