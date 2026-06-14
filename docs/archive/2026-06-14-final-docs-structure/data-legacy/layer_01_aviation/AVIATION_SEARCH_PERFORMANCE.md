# Aviation Search Performance

WO-011 benchmarked aviation airport search performance on the local Docker PostGIS database.

## Database State Tested

- Database: `god_eyes_dev`
- Table: `aviation_airports`
- Row count: 85,377
- Existing search-related fields reviewed: `name`, `ident`, `iata_code`, `municipality`, `iso_country`, `category_normalized`
- Existing btree indexes before WO-011: `ident`, partial `iata_code`, `iso_country`, `category_normalized`, `layer_id`, source identity indexes

## Baseline Search Results

The baseline broad search shape was:

```sql
name ILIKE %term%
OR ident ILIKE %term%
OR iata_code ILIKE %term%
OR municipality ILIKE %term%
OR iso_country ILIKE %term%
OR category_normalized ILIKE %term%
```

This shape does not use the existing btree indexes for substring searches and produced parallel sequential scans.

| Term | Count | Execution | Scan type |
|---|---:|---:|---|
| `Dubai` | 20 | 52.892 ms | Seq Scan |
| `London` | 70 | 51.853 ms | Seq Scan |
| `New York` | 19 | 52.210 ms | Seq Scan |
| `Tokyo` | 577 | 51.103 ms | Seq Scan |
| `KR` | 2,023 | 46.916 ms | Seq Scan |
| `heliport` | 24,400 | 50.151 ms | Seq Scan |
| `small_airfield` | 42,616 | 65.004 ms | Seq Scan |

## Index Options Evaluated

### Current btree indexes

Current btree indexes are good for exact values:

- `iso_country = 'KR'` used existing btree indexes and returned 1,418 rows in 0.251 ms after the migration run.
- `category_normalized = 'heliport'` used existing btree indexes and returned 22,980 rows in 5.506 ms.
- `category_normalized = 'small_airfield'` used existing btree indexes and returned 42,616 rows in 8.455 ms.

Btree indexes do not help `%term%` substring search.

### `lower(name)` btree

A `lower(name)` btree can help prefix-only search in some query shapes, but it does not support `%term%` contains search. It is not the right first production index for airport search.

### `pg_trgm` GIN indexes

The measured candidate added trigram GIN indexes for free-text fields:

- `lower(name)`
- `lower(ident)`
- `lower(iata_code)`
- `lower(municipality)`

Recommended query shape:

```sql
lower(name) LIKE %term%
OR lower(ident) LIKE %term%
OR lower(iata_code) LIKE %term%
OR lower(municipality) LIKE %term%
```

Measured results after candidate indexes:

| Term | Count | Execution | Scan type | Indexes |
|---|---:|---:|---|---|
| `Dubai` | 20 | 0.097 ms | Bitmap index scans | trigram GIN |
| `London` | 70 | 0.355 ms | Bitmap index scans | trigram GIN |
| `New York` | 19 | 0.152 ms | Bitmap index scans | trigram GIN |
| `Tokyo` | 577 | 0.580 ms | Bitmap index scans | trigram GIN |
| `KR` | 1,731 | 28.048 ms | Seq Scan | not useful for two-character contains |
| `heliport` | 18,448 | 13.956 ms | Bitmap index scans | trigram GIN |
| `small_airfield` | 0 | 0.465 ms | Bitmap index scans | trigram GIN |

Two-character terms are a poor fit for trigram contains search. Use exact country/code logic for `KR`-style searches.

### Full-text search

Full-text search is not recommended yet. Airport search needs substring behavior for codes, city names, and partial airport names. `pg_trgm` is a simpler and better fit for this phase.

## Migration Added

Migration added:

```text
database/migrations/layers/layer_01_aviation/003_aviation_search_indexes.sql
```

It only adds:

- `CREATE EXTENSION IF NOT EXISTS pg_trgm`
- GIN trigram indexes on `lower(name)`, `lower(ident)`, `lower(iata_code)`, and `lower(municipality)`

It does not change table shapes, drop data, or rewrite existing migrations.

## Recommended Search Strategy

Use a two-part search strategy:

1. Exact field matching for structured fields:
   - `iso_country = upper(term)`
   - `ident = upper(term)`
   - `iata_code = upper(term)`
   - `category_normalized = lower(term)`
2. Trigram free-text matching for text fields:
   - `lower(name) LIKE lower('%term%')`
   - `lower(ident) LIKE lower('%term%')`
   - `lower(iata_code) LIKE lower('%term%')`
   - `lower(municipality) LIKE lower('%term%')`

Keep `iso_country` and `category_normalized` out of trigram free-text search. Their exact btree filters are more predictable and cheaper.

## Risks And Limitations

- Local Docker timings are not production hardware timings.
- GIN trigram indexes add storage and write overhead, but OurAirports is reference data and not high-write.
- Two-character contains searches, such as `KR`, do not benefit from trigram contains search. Treat country/IATA/ident-like terms as exact matches first.
- Very broad category terms should use exact category filters, not free-text contains search.
- API routes were not changed in WO-011; Claude/API must opt into the recommended query shape to benefit from the migration.

## Next Safe Task

Claude/API can update airport search SQL to combine exact structured-field matching with trigram free-text matching, then verify endpoint behavior with this benchmark script.
