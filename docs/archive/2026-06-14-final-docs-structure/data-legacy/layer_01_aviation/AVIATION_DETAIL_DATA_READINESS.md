# Aviation Detail Data Readiness

WO-020 reviewed Layer 1 aviation detail data readiness for a future airport
Object Intel endpoint and panel. This is analysis only; no source data, API
routes, or frontend files were changed.

## Database State Tested

- Environment: local Docker PostGIS database `god_eyes_dev`
- Source: normalized OurAirports aviation reference data
- Script: `scripts/aviation_detail_data_readiness.py`
- Command: `python scripts\aviation_detail_data_readiness.py --json --limit 5`

## Current Row Counts

| Table | Count |
|---|---:|
| `aviation_airports` | 85,377 |
| `aviation_runways` | 47,911 |
| `aviation_airport_frequencies` | 30,275 |
| `aviation_navaids` | 11,010 |

## Runway Readiness

Runways are ready for a first airport detail endpoint when joined by
`layer_id`, `source_id`, and `airport_ident`.

| Check | Count |
|---|---:|
| Airports with at least one runway | 40,835 |
| Airports with no runway | 44,542 |
| Orphaned runways by `airport_ident` | 0 |
| Missing runway endpoint coordinates | 32,464 |
| Invalid runway endpoint coordinates | 0 |

Runway length distribution:

| Bucket | Count |
|---|---:|
| `2000_3999_ft` | 19,187 |
| `<2000_ft` | 15,405 |
| `4000_6999_ft` | 8,340 |
| `7000_9999_ft` | 3,093 |
| `10000_ft_plus` | 1,600 |
| `<blank>` | 286 |

Top runway surface values are mixed-code source values. Examples include `ASP`,
`TURF`, `CON`, `CONC`, `GRS`, `ASPH`, `GRE`, and source-case variants such as
`Turf` and `Grass`. A future UI should display the source value plainly unless a
separate normalized runway surface field is added later.

## Frequency Readiness

Frequencies are ready for a first airport detail endpoint when joined by
`layer_id`, `source_id`, and `airport_ident`.

| Check | Count |
|---|---:|
| Airports with at least one frequency | 11,148 |
| Airports with no frequency | 74,229 |
| Orphaned frequencies by `airport_ident` | 0 |
| Missing or invalid frequency MHz values | 7 |

Top frequency types:

| Type | Count |
|---|---:|
| `TWR` | 3,424 |
| `CTAF` | 3,206 |
| `UNIC` | 2,940 |
| `MISC` | 2,215 |
| `APP` | 1,857 |
| `A/D` | 1,724 |
| `GND` | 1,656 |
| `ATIS` | 1,584 |

The seven missing or invalid frequency rows should be handled defensively by a
future endpoint. They should not block basic detail readiness.

## Navaid Readiness

Navaids are not directly keyed to airports in the same way runways and
frequencies are. The recommended first association is spatial: query nearby
`aviation_navaids.geom` from the airport `geom`, with optional use of
`associated_airport` as supporting metadata rather than the primary join key.

Navaid type distribution:

| Type | Count |
|---|---:|
| `NDB` | 6,611 |
| `VOR-DME` | 2,601 |
| `VORTAC` | 744 |
| `TACAN` | 442 |
| `VOR` | 308 |
| `DME` | 167 |
| `NDB-DME` | 137 |

The existing GiST index on `aviation_navaids.geom` is suitable for measured
nearby-navaid work. The readiness script keeps its navaid sample bounded by
first choosing a small airport seed set, then running nearby lookup per seed.

## Relationship Model

- Airports: source identity is `source_id + source_airport_id`.
- Runways: stable detail identity is `source_id + source_runway_id`; airport
  attachment uses `airport_ident` plus matching `source_id` and `layer_id`.
- Frequencies: stable detail identity is `source_id + source_frequency_id`;
  airport attachment uses `airport_ident` plus matching `source_id` and
  `layer_id`.
- Navaids: stable detail identity is `source_id + source_navaid_id`; airport
  attachment should be spatial proximity from airport `geom` to navaid `geom`.
- Countries and regions support context joins through airport `iso_country` and
  `iso_region`, but they are not required for first detail readiness.

## Data Quality Findings

- Runway and frequency orphan counts are 0, so the current source relationship
  fields are internally consistent for those detail sections.
- Many airports have no runway or frequency records. This is expected for many
  heliports, small fields, closed sites, and sparse source records.
- Runway endpoint coordinates are often missing, but runway length, width,
  surface, lighting, closed status, and endpoint labels can still be useful.
- No invalid runway endpoint coordinate ranges were found.
- Frequency values are mostly usable, with only 7 missing or non-positive MHz
  values.
- Source surface/type values are not fully normalized and should be displayed as
  source-derived values unless a separate normalization task is approved.

## Recommended Future API Shape

A future airport detail endpoint can use `source_id + source_airport_id` as the
stable airport selector, then return:

- airport overview fields from `aviation_airports`
- runways ordered by length and runway identifiers
- airport frequencies ordered by type and frequency
- nearby navaids within a bounded radius, ordered by distance
- source/provenance fields including `source_id`, source object ids, and raw
  object traceability where appropriate
- coordinate quality fields later, once override consumption is explicitly added

Recommended first query approach:

- Runways: `WHERE layer_id = $layer AND source_id = $source AND airport_ident = $ident`
- Frequencies: same airport-ident shape
- Navaids: `ST_DWithin(airport.geom::geography, navaid.geom::geography, radius)`
  with a limit and distance ordering

Do not make the frontend query the database directly. API routes should own the
detail query and response contract.

## Recommended Future Object Intel Sections

- Airport Overview
- Runways
- Frequencies
- Nearby Navaids
- Source / Provenance
- Coordinate Quality later

## Index Notes

Existing indexes are enough for analysis and first measured design:

- `idx_aviation_runways_airport_ident`
- `idx_aviation_airport_frequencies_airport_ident`
- `idx_aviation_navaids_geom`
- airport source identity and ident indexes

Future measured work may consider composite indexes on
`(layer_id, source_id, airport_ident)` for runways and frequencies if endpoint
EXPLAIN plans show avoidable scans. This work order does not add indexes because
the API query shape has not been implemented or benchmarked yet.

## Known Risks And Limitations

- Local Docker timings and counts are not production hardware measurements.
- This task did not implement the airport detail API endpoint.
- This task did not implement frontend Object Intel display.
- No source data was mutated and no generated output dump was committed.
- Navaid proximity requires a clear API radius and limit policy to avoid noisy
  results near dense airspace.
- Missing detail records should be represented as empty sections, not as errors.

## Next Safe Tasks

- Claude/API: design a read-only airport detail endpoint contract using the
  relationship model above.
- Data/API: benchmark the exact endpoint SQL with EXPLAIN before adding indexes.
- Frontend/Gemini later: display Object Intel sections only after contracts land.
