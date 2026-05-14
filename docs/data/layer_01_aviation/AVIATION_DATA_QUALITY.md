# Aviation Data Quality

WO-009 measured normalized Layer 1 aviation airport data quality on 2026-05-14 UTC using the local PostGIS database.

## Data Quality Summary

- Table: `aviation_airports`
- Total airport records: 85,377
- Source: OurAirports public domain reference data
- Raw source preservation: raw CSV files remain the source of truth and must not be overwritten.
- Normalized coordinate precision fix: `build_point_wkt` now preserves parsed coordinate precision instead of rounding EWKT to six significant digits.
- Existing normalized rows were refreshed by rerunning the normalizer for `fetch_run_a011fea1694d4151850dd8a35dc256e7`.

## Coordinate Quality

| Check | Count |
|---|---:|
| Missing latitude or longitude | 0 |
| Invalid latitude/longitude range | 0 |
| Null `geom` | 0 |
| Latitude/longitude disagree with `geom` | 0 |
| Suspicious zero coordinates | 0 |

The quality script checks `latitude_deg`, `longitude_deg`, and `geom` agreement with a tolerance of `0.000001` degrees.

Low coordinate precision is not reliably detectable after normalization because the original source coordinate string precision is not stored separately from the normalized double precision columns. A future raw CSV audit can add this if needed.

## Identifier Quality

| Check | Result |
|---|---:|
| Duplicate `ident` values | 0 duplicate values |
| Duplicate non-empty `iata_code` values | 0 duplicate values |

The database uses `source_id + source_airport_id` as the idempotent source identity. `ident` and `iata_code` are useful query/display fields, not source-of-truth primary keys.

## Category Distribution

| Category | Count |
|---|---:|
| `small_airfield` | 42,616 |
| `heliport` | 22,980 |
| `closed_or_abandoned` | 13,181 |
| `regional_or_domestic_airport` | 4,095 |
| `water_landing_site` | 1,262 |
| `international_or_major_airport` | 1,182 |
| `balloonport` | 61 |

Source type distribution matches the normalized categories:

| Source type | Count |
|---|---:|
| `small_airport` | 42,616 |
| `heliport` | 22,980 |
| `closed` | 13,181 |
| `medium_airport` | 4,095 |
| `seaplane_base` | 1,262 |
| `large_airport` | 1,182 |
| `balloonport` | 61 |

## Notable Counts

- Closed or abandoned airports: 13,181
- Heliports: 22,980
- Seaplane/water landing sites: 1,262
- Scheduled service `yes`: 4,429
- Scheduled service `no`: 80,948

## Heliport Coordinate Precision Limitation

At high zoom, some heliport markers may appear offset from visible rooftop helipad imagery by tens of meters. This is likely source-coordinate precision, source-record placement, imagery alignment, or rooftop-level ambiguity, not necessarily a frontend rendering bug.

Do not manually edit normalized coordinates to make a marker visually line up with imagery in this task. The source coordinates must remain traceable.

## Manual Override Strategy Recommendation

Future coordinate corrections should use a separate manual override table rather than overwriting source-derived coordinates.

Recommended future table behavior:

- Keep original OurAirports latitude/longitude and raw CSV unchanged.
- Store override latitude/longitude separately.
- Include reviewer, source/provenance, reason, timestamp, precision/confidence score, and approval status.
- Allow API/frontend to prefer verified override coordinates when available.
- Preserve a clear audit trail from source record to override record.
- Make rollback safe by disabling/removing the override, not by mutating raw or normalized source fields.

This manual override strategy is documentation-only for WO-009; no override table was implemented.

## Source-Data Preservation Rule

- Raw CSV files are never committed.
- Raw source data is not edited.
- Normalization may improve derived geometry generation, but it must remain reproducible from raw source fields.
- Any future correction workflow must preserve source provenance and reviewer accountability.

## Next Recommended Tasks

- Add source-coordinate string precision auditing only if high-zoom visual QA shows a recurring precision class problem.
- Add manual override schema in a dedicated work order after API/frontend consumers agree on correction workflow.
- Keep heliport precision limitations visible in API/frontend QA notes.
