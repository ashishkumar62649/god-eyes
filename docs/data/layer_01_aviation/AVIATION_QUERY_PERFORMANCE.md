# Aviation Query Performance

WO-009 measured `aviation_airports` readiness for viewport-aware map queries on 2026-05-14 UTC using the local Docker PostGIS database.

## Database State Tested

- Database: `god_eyes_dev`
- Table: `aviation_airports`
- Row count: 85,377
- Data source: real OurAirports data from `fetch_run_a011fea1694d4151850dd8a35dc256e7`
- Geometry repair performed during WO-009: reran the existing normalizer after preserving full coordinate precision in EWKT generation.

## Indexes Found

Existing migration/index state is sufficient for first-pass viewport and filter queries:

- `idx_aviation_airports_geom` - GiST on `geom`
- `idx_aviation_airports_category_normalized` - btree on `category_normalized`
- `idx_aviation_airports_iso_country` - btree on `iso_country`
- `idx_aviation_airports_ident` - btree on `ident`
- `idx_aviation_airports_iata_code` - partial btree on `iata_code`
- `aviation_airports_source_id_source_airport_id_key` - unique btree on source identity
- `idx_aviation_airports_source_id`
- `idx_aviation_airports_source_airport_id`
- `idx_aviation_airports_raw_object_id`
- `idx_aviation_airports_layer_id`

No new index migration was added in WO-009 because measured bbox, category, country, and combined filters used existing indexes.

## Queries Tested

The script [aviation_query_performance.py](../../../scripts/aviation_query_performance.py) measures:

- total airport count
- count by category
- count by country
- USA-like bbox: `minLon=-125, minLat=25, maxLon=-65, maxLat=50`
- Europe-like bbox: `minLon=-10, minLat=35, maxLon=30, maxLat=60`
- Dubai/UAE-like bbox: `minLon=54, minLat=23, maxLon=56.5, maxLat=26`
- category filter: `category_normalized = 'heliport'`
- country filter: `iso_country = 'US'`
- search: `Dubai` over `name`, `ident`, `iata_code`, `municipality`
- combined bbox + category
- combined bbox + country

BBox SQL uses parameterized PostGIS predicates:

```sql
geom IS NOT NULL
AND geom && ST_MakeEnvelope(%s, %s, %s, %s, 4326)
AND ST_Intersects(geom, ST_MakeEnvelope(%s, %s, %s, %s, 4326))
```

## EXPLAIN ANALYZE Summary

| Query | Count | Execution | Plan summary | Indexes |
|---|---:|---:|---|---|
| Total airports | 85,377 | 13.207 ms | Index Only Scan | `idx_aviation_airports_layer_id` |
| USA bbox | 34,276 | 15.821 ms | Bitmap Heap Scan + Bitmap Index Scan | `idx_aviation_airports_geom` |
| Europe bbox | 10,621 | 8.951 ms | Bitmap Heap Scan + Bitmap Index Scan | `idx_aviation_airports_geom` |
| Dubai/UAE bbox | 222 | 0.170 ms | Index Scan | `idx_aviation_airports_geom` |
| Category `heliport` | 22,980 | 5.529 ms | Bitmap Heap Scan + Bitmap Index Scan | `idx_aviation_airports_category_normalized` |
| Country `US` | 32,495 | 6.083 ms | Bitmap Heap Scan + Bitmap Index Scan | `idx_aviation_airports_iso_country` |
| Search `Dubai` | 20 | 39.769 ms | parallel Seq Scan | none |
| USA bbox + heliport | 8,437 | 11.518 ms | BitmapAnd over spatial + category indexes | `idx_aviation_airports_geom`, `idx_aviation_airports_category_normalized` |
| USA bbox + country `US` | 31,254 | 14.708 ms | BitmapAnd over spatial + country indexes | `idx_aviation_airports_geom`, `idx_aviation_airports_iso_country` |

## BBox Timing Summary

- BBox queries use the GiST geometry index.
- Large bboxes are expected to use bitmap scans because they touch many rows.
- No sequential scan appeared for measured bbox, bbox+category, or bbox+country queries.
- The USA bbox returns a large result set. API callers should keep using pagination, zoom-aware limits, or clustering.

## Category, Country, And Search Findings

Category distribution:

| Category | Count |
|---|---:|
| `small_airfield` | 42,616 |
| `heliport` | 22,980 |
| `closed_or_abandoned` | 13,181 |
| `regional_or_domestic_airport` | 4,095 |
| `water_landing_site` | 1,262 |
| `international_or_major_airport` | 1,182 |
| `balloonport` | 61 |

Top country counts:

| Country | Count |
|---|---:|
| `US` | 32,495 |
| `BR` | 7,913 |
| `JP` | 3,747 |
| `CA` | 3,313 |
| `AU` | 2,789 |
| `MX` | 2,694 |

Search findings:

- Simple `ILIKE` search over `name`, `ident`, `iata_code`, and `municipality` returned 20 Dubai matches in 39.769 ms.
- This is acceptable for local foundation verification, but it does use a sequential scan.
- Recommendation: keep the current simple search for the first API pass; create a future search-specific work order for `pg_trgm` or full-text search once query volume and UX requirements are clear.

## Clustering Readiness

Recommended first implementation:

1. API-side simple grid bucketing from `bbox` and `zoom`.
2. Return either raw points below a threshold or aggregate cluster cells above a threshold.
3. Keep cluster size tied to viewport/zoom, not hard-coded globally.

Database-side option:

- PostGIS grid bucketing is viable. WO-009 tested a simple 5-degree grid concept over the USA bbox and returned dense buckets up to 1,865 rows.
- SQL grid bucketing can use `floor((longitude_deg + 180) / cell_size)` and `floor((latitude_deg + 90) / cell_size)` for a first pass.

Future option:

- PostGIS density clustering functions such as `ST_ClusterDBSCAN` may help later, but they are more complex than needed for the first marker-clustering pass.

## Index Recommendations

No immediate migration is recommended for bbox, category, country, or combined filters.

Future measured task:

- Evaluate `pg_trgm` indexes for search fields if search latency becomes user-visible or if search is called repeatedly while typing.
- Candidate future indexes, only after measurement: trigram GIN indexes on `name`, `municipality`, and possibly `ident`/`iata_code`.

## Known Risks

- Large USA-like viewport queries return tens of thousands of rows. The API should not send all markers unclustered at low zoom.
- Simple search currently scans the airport table.
- Query timing was measured on local Docker, not production hardware.
- Existing indexes are safe, but future combined indexes should be justified with actual API query patterns.

## Next Recommended Tasks

- Claude/API: implement bbox/category/country/search endpoints using parameterized SQL and existing indexes.
- Claude/API: add threshold-based grid clustering or response limits for large bboxes.
- Future data task: measured trigram/full-text search work order after first API search behavior lands.
