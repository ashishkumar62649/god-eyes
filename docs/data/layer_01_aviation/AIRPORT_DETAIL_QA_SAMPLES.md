# Airport Detail QA Samples

WO-025 creates a production-safe QA sample set for future Airport Detail API v1
and Object Intel testing. This work is data/database QA only: no API routes,
frontend files, contracts, migrations, source data, raw CSVs, or generated
output dumps were changed.

## Purpose

Airport Detail API and Object Intel need stable examples that cover both rich
and sparse aviation detail states. The sample script selects airports from the
local normalized OurAirports database and reports stable source identity plus
detail counts for runways, frequencies, and nearby navaids.

Script:

```powershell
python scripts\aviation_airport_detail_qa_samples.py --json --limit 10
```

The script is read-only and uses the same relationship model documented in
WO-020 and WO-023:

- airport identity: `source_id + source_airport_id`
- runway attachment: `layer_id + source_id + airport_ident`
- frequency attachment: `layer_id + source_id + airport_ident`
- nearby navaids: bounded spatial lookup from airport `geom`

## Output Fields

Each sample includes:

- `label`
- `source_id`
- `source_object_id`
- `ident`
- `iataCode`
- `name`
- `municipality`
- `iso_country`
- `category`
- `latitude`
- `longitude`
- `runway_count`
- `frequency_count`
- `nearby_navaid_count_100km`
- `notes`

The JSON output also includes `type_source`,
`missing_runway_endpoint_count`, and `complete_runway_endpoint_count` to help
QA exercise runway-coordinate edge cases.

## Selected Sample Airports

Local Docker database: `god_eyes_dev`

Nearby navaid radius: 100 km

| Label | Ident | Source object id | IATA | Name | Place | Category | Runways | Frequencies | Navaids 100 km | Why useful |
|---|---|---:|---|---|---|---|---:|---:|---:|---|
| `major_international_rich_detail` | `OMDB` | `5235` | `DXB` | Dubai International Airport | Dubai, AE | `international_or_major_airport` | 2 | 6 | 4 | Exercises overview, runways, frequencies, and nearby navaids for a major airport. |
| `runways_no_frequencies` | `KNHU` | `300162` |  | Norfolk Naval Station Airport | Norfolk, US | `heliport` | 10 | 0 | 19 | Verifies runway display while frequency section is empty. |
| `has_frequencies` | `KCVG` | `3471` | `CVG` | Cincinnati Northern Kentucky International Airport | Cincinnati / Covington, US | `international_or_major_airport` | 4 | 31 | 22 | Stresses frequency list rendering and ordering. |
| `sparse_no_runway_or_frequency` | `00AA` | `323361` |  | Aero B Ranch Airport | Leoti, US | `small_airfield` | 0 | 0 | 6 | Verifies empty detail sections are not treated as errors. |
| `heliport` | `JRA` | `18256` | `JRA` | West 30th Street Heliport | New York, US | `heliport` | 9 | 0 | 35 | Verifies heliport category and non-airport object behavior. |
| `small_airfield` | `KNRQ` | `20654` |  | Spencer Nolf Airport | Pace, US | `small_airfield` | 8 | 1 | 12 | Verifies lower-detail airport behavior with some supporting details. |
| `many_nearby_navaids` | `1OH8` | `8583` |  | Lisbon Airfield | South Charleston, US | `small_airfield` | 1 | 0 | 40 | Verifies bounded nearby navaid list behavior in dense airspace. |
| `few_or_no_nearby_navaids` | `01A` | `6576` |  | Purkeypile Airport | Purkeypile, US | `small_airfield` | 1 | 0 | 0 | Verifies nearby navaid empty state. |
| `missing_runway_endpoint_coordinates` | `1LA9` | `8413` |  | Chevron Intracoastal Heliport | Intracoastal City, US | `closed_or_abandoned` | 8 | 0 | 7 | Verifies runway UI does not require endpoint coordinates. |
| `complete_runway_endpoint_coordinates` | `KORD` | `3754` | `ORD` | Chicago O'Hare International Airport | Chicago, US | `international_or_major_airport` | 11 | 9 | 22 | Verifies runway endpoint-coordinate display path with a rich major airport. |

## What Each Sample Tests

- `OMDB`: major airport overview, source coordinates, runways, frequencies, and
  navaids all present.
- `KNHU`: runway-heavy case with no frequencies.
- `KCVG`: high frequency count for API and panel list handling.
- `00AA`: sparse airport with no runway or frequency details.
- `JRA`: heliport category and marker-to-detail continuity.
- `KNRQ`: small airfield with runway and frequency details.
- `1OH8`: dense nearby navaid set, so API limits and frontend clipping can be
  checked.
- `01A`: zero nearby navaids within 100 km.
- `1LA9`: missing runway endpoint-coordinate case.
- `KORD`: complete runway endpoint-coordinate case with rich supporting data.

## Claude/API Usage

Claude/API should use `source_id` and `source_object_id` as the stable detail
selector in endpoint tests. For each sample, verify:

- overview fields return source identity, ident, IATA where present, name,
  category, municipality/country, latitude, longitude, and provenance
- runways join by `layer_id + source_id + airport_ident`
- frequencies join by `layer_id + source_id + airport_ident`
- nearby navaids use a bounded spatial query, defaulting to 100 km for these
  QA checks
- sparse sections return empty arrays or explicit empty states, not endpoint
  failures
- runway endpoint coordinates remain optional

## Gemini/frontend Usage

Gemini/frontend should use these samples for Object Intel manual QA after the
API contract lands. The panel should be checked for:

- clear overview rendering for major airports, heliports, and small airfields
- runway list display with and without endpoint coordinates
- frequency list display for dense and empty cases
- nearby navaid list display for dense and zero-result cases
- empty-state handling without layout collapse
- source/provenance fields that do not imply live operational data

Frontend must continue to consume API responses only and must not query the
database directly.

## Kiro/manual QA Usage

Kiro/manual QA can run:

```powershell
python scripts\aviation_airport_detail_qa_samples.py --json --limit 10
```

Then use the returned `source_id + source_object_id` pairs against the Airport
Detail API once available. The selected idents are intentionally human-readable
so map and Object Intel behavior can also be spot-checked visually.

## Refresh Process When Data Changes

1. Refresh or re-normalize Layer 1 aviation data through the approved pipeline.
2. Run `python scripts\aviation_airport_detail_qa_samples.py --json --limit 10`.
3. Compare selected labels and counts with this document.
4. Update this document only if the source data selection materially changes.
5. Keep the committed document concise; do not commit JSON dumps or raw query
   output files.

## Known Limitations

- The selected samples reflect the current local Docker database state and are
  not production SLAs.
- OurAirports reference data is not live operational data.
- No NOTAM, METAR, TAF, or live aircraft data is included.
- Some runway endpoint coordinates are missing by source design; this is a QA
  case, not a data repair.
- Navaid proximity is spatial and radius-bound; it is not an official
  operational association.
- Airport categories and detail counts may change after a future source refresh.
- This work order does not implement API endpoints, contracts, frontend display,
  indexes, or migrations.

## Next Safe Task

Claude/API can use these samples as endpoint QA fixtures while implementing
Airport Detail API v1. After that, Gemini/frontend can use the same samples for
Object Intel panel QA against API responses.
