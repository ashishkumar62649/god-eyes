# Aviation Object Intel Display Reference

WO-027 defines a practical display reference for Layer 1 aviation Object Intel
data. This is data/content guidance only. It does not implement frontend UI,
API routes, contracts, migrations, or new features.

The first Object Intel display should make airport identity and operational
context easy to scan, while keeping source traceability available without
crowding the user-facing panel.

## User-First Airport Fields

Show these airport fields first, in this order when available:

| Priority | Field | User-facing label | Display recommendation |
|---:|---|---|---|
| 1 | `name` | Airport name | Primary title. Use the source name exactly. |
| 2 | `ident` | Ident | Prominent short code near the title. |
| 3 | `iata_code` | IATA | Show only when present. Do not render a blank code. |
| 4 | `category_normalized` | Category | Show the human-readable label from this document. |
| 5 | `municipality`, `iso_country` | Location | Prefer `Municipality, Country code`; omit missing parts. |
| 6 | `latitude_deg`, `longitude_deg` | Coordinates | Show rounded to 5 or 6 decimal places. |
| 7 | `elevation_ft` | Elevation | Show as feet MSL when present. |
| 8 | `scheduled_service` | Scheduled service | Show `Yes` or `No` only when present. |
| 9 | detail counts | Runways / Frequencies / Nearby navaids | Use compact counts to set expectations before lists. |

Recommended overview order:

1. Airport name, ident, IATA if present.
2. Category and location.
3. Coordinates and elevation.
4. Detail counts.
5. Source/provenance summary.

Do not imply this data is live operational status. It is reference data from the
normalized Layer 1 aviation source.

## Collapsed Technical And Source Fields

Keep these fields available in a collapsed "Source and provenance" or
"Technical details" section. They are important for QA and support, but should
not compete with the main airport summary.

| Field | Why collapsed |
|---|---|
| `layer_id` | Internal layer routing value. |
| `source_id` | Source identity, usually `ourairports`. |
| `source_airport_id` / `source_object_id` | Stable source object selector for detail QA and API calls. |
| `type_source` | Original source category before normalization. |
| `raw_object_id` | Raw storage lineage, useful for debugging only. |
| `created_at`, `updated_at` | Pipeline metadata rather than user-facing airport context. |
| `geom` | Database geometry representation; users should see coordinates instead. |
| `continent`, `iso_region` | Secondary location context; show only if a design needs it. |
| `gps_code`, `local_code` | Secondary identifiers; keep below IATA/ident unless needed. |
| `home_link`, `wikipedia_link`, `keywords` | Source enrichment fields; do not dominate the core panel. |
| runway/frequency/navaid source ids | Detail-row lineage for QA, not primary display text. |

The collapsed section should be easy to copy from during QA because Kiro,
Claude/API, and Codex data checks use `source_id + source_object_id` as the
stable airport identity.

## Airport Category Labels

Display normalized categories with plain labels. Preserve the normalized value
in collapsed technical details for support and QA.

| `category_normalized` | Recommended label | Source values |
|---|---|---|
| `international_or_major_airport` | Major airport | `large_airport` |
| `regional_or_domestic_airport` | Regional airport | `medium_airport` |
| `small_airfield` | Small airfield | `small_airport` |
| `heliport` | Heliport | `heliport` |
| `water_landing_site` | Water landing site | `seaplane_base` |
| `balloonport` | Balloonport | `balloonport` |
| `closed_or_abandoned` | Closed or abandoned | `closed`, `closed_airport` |
| `unknown` | Unknown category | Unmapped or blank source type |

Closed or abandoned airports should be visibly labeled, but the display should
avoid implying live closure notices or NOTAM status.

## Runway Formatting Recommendations

Runway rows should be concise and ordered by the readiness recommendation from
WO-023: longest runway first, then endpoint identifiers and source runway id.

Recommended runway row format:

```text
09L / 27R - 13,000 x 150 ft - ASP - Lighted
```

Recommended fields:

| Field | Display guidance |
|---|---|
| `le_ident`, `he_ident` | Render as `LE / HE`; if one side is missing, show the available ident. |
| `length_ft`, `width_ft` | Render as `length x width ft`; omit unknown dimensions instead of showing zero. |
| `surface` | Display the source value plainly, for example `ASP`, `TURF`, `CONC`. Do not normalize surface labels until a separate approved task adds normalized surface data. |
| `lighted` | Show `Lighted` or `Unlighted` when known. |
| `closed` | Add a visible `Closed runway` status when true. |
| `le_heading_degT`, `he_heading_degT` | If shown, label as true heading, for example `09L heading: 89.7 deg true`. |
| endpoint coordinates | Optional. Show only when both latitude and longitude exist for that endpoint. |
| endpoint elevation and displaced threshold | Secondary; place in expanded runway details. |

Do not require endpoint coordinates for runway display. WO-020 found many
runway endpoint coordinates missing by source design, while the runway itself
can still be useful.

## Frequency Formatting Recommendations

Order frequencies by `type`, then `frequency_mhz`, then source frequency id.
Use the source type codes because they are familiar to aviation users and are
already present in the source data.

Recommended frequency row format:

```text
TWR - Tower - 118.700 MHz
```

Recommended fields:

| Field | Display guidance |
|---|---|
| `type` | Show first as a compact code, for example `TWR`, `CTAF`, `GND`, `ATIS`, `APP`. |
| `description` | Show after type when present. |
| `frequency_mhz` | Format to 3 decimal places with `MHz`, trimming only if a design system already has a consistent aviation-frequency formatter. |
| invalid or missing `frequency_mhz` | Keep the row only if type or description is useful; show `Frequency unavailable`. |
| `airport_ident` | Omit from the main row because it repeats the selected airport. Keep in expanded details if needed. |

Do not synthesize operational meanings beyond the source type and description.
For example, a `TWR` row is a tower frequency reference, not proof that a tower
is currently open.

## Navaid Formatting Recommendations

Nearby navaids should be presented as spatially nearby references, not official
airport-owned facilities. WO-020 and WO-023 recommend a bounded spatial lookup
from airport `geom` to navaid `geom`.

Recommended navaid row format:

```text
ORD - VOR-DME - Chicago O'Hare - 8.4 km
```

Recommended fields:

| Field | Display guidance |
|---|---|
| `ident` | Show first as the short navaid code. |
| `type` | Show next, preserving source values such as `NDB`, `VOR-DME`, `VORTAC`, `TACAN`, `VOR`, `DME`, `NDB-DME`. |
| `name` | Show as the readable navaid name when present. |
| computed distance | Show in kilometers with one decimal place. |
| `frequency_khz` | If displayed, label as `kHz`; do not convert silently unless API/frontend contract explicitly provides converted units. |
| DME fields | Keep DME channel, DME coordinates, and DME elevation in expanded details. |
| `associated_airport` | Show only as supporting metadata, not as the primary association. |

Recommended v1 bounds for Object Intel QA:

- Default radius: 100 km.
- Maximum radius: 250 km.
- Default limit: 20.
- Maximum limit: 50.
- Sort by computed distance ascending.

## Data Quality And Provenance Formatting

Use a compact provenance summary near the bottom of the overview and a more
complete collapsed section for support/debugging.

Recommended visible summary:

```text
Source: OurAirports reference data
Layer: Aviation
Object id: ourairports / 5235
```

Recommended provenance details:

| Item | Display guidance |
|---|---|
| source name | `OurAirports reference data`. |
| `layer_id` | Show as `layer_01_aviation` in collapsed details. |
| `source_id` | Show as `ourairports`. |
| source object id | Show airport `source_airport_id`; for API payloads this may be named `source_object_id`. |
| raw lineage | Include `raw_object_id` only in collapsed details. |
| coordinates | Label as source coordinates unless an API explicitly exposes effective override coordinates. |
| coordinate overrides | If an API later exposes them, label as an effective coordinate projection and preserve source coordinates separately. |
| quality warnings | Use calm, factual copy such as `Runway endpoint coordinates are partially unavailable from source data.` |

Data quality states should not look like application errors. Missing detail
records are normal for many heliports, small airfields, closed sites, and sparse
source records.

## Empty-State Text

Use explicit empty states so sparse source data does not look like a broken
panel.

| Section | Empty-state text |
|---|---|
| Runways | `No runway records are available from the current aviation reference source.` |
| Frequencies | `No airport frequency records are available from the current aviation reference source.` |
| Nearby navaids | `No nearby navaids were found within the selected radius.` |
| Runway endpoint coordinates | `Endpoint coordinates are not available for this runway in the source data.` |
| IATA code | Omit the IATA field rather than showing `None`, `null`, or a blank badge. |
| Elevation | Omit the elevation field when absent. |

Avoid empty-state copy that blames the user or implies a failed fetch unless the
API request actually failed.

## WO-025 QA Airport Samples

Use the WO-025 samples to verify that Object Intel display handles rich,
sparse, dense, and missing-detail states. Counts are from the local Docker
database documented in `AIRPORT_DETAIL_QA_SAMPLES.md` and may change after a
future source refresh.

| Label | Ident | Source object id | Category | Detail counts | Display behavior to verify |
|---|---|---:|---|---|---|
| `major_international_rich_detail` | `OMDB` | `5235` | Major airport | 2 runways, 6 frequencies, 4 navaids | Full overview, runway list, frequency list, navaid list, and provenance all render together. |
| `runways_no_frequencies` | `KNHU` | `300162` | Heliport | 10 runways, 0 frequencies, 19 navaids | Runway-heavy display works and frequency empty state is clear. |
| `has_frequencies` | `KCVG` | `3471` | Major airport | 4 runways, 31 frequencies, 22 navaids | Dense frequency list remains readable and ordered. |
| `sparse_no_runway_or_frequency` | `00AA` | `323361` | Small airfield | 0 runways, 0 frequencies, 6 navaids | Sparse airport does not look broken; runway and frequency empty states render. |
| `heliport` | `JRA` | `18256` | Heliport | 9 runways, 0 frequencies, 35 navaids | Heliport label and non-airport behavior remain clear. |
| `small_airfield` | `KNRQ` | `20654` | Small airfield | 8 runways, 1 frequency, 12 navaids | Lower-detail airfield still has useful supporting details. |
| `many_nearby_navaids` | `1OH8` | `8583` | Small airfield | 1 runway, 0 frequencies, 40 navaids | Navaid limit/clipping behavior is obvious and distance order is preserved. |
| `few_or_no_nearby_navaids` | `01A` | `6576` | Small airfield | 1 runway, 0 frequencies, 0 navaids | Nearby navaid empty state appears without collapsing other sections. |
| `missing_runway_endpoint_coordinates` | `1LA9` | `8413` | Closed or abandoned | 8 runways, 0 frequencies, 7 navaids | Runways render without endpoint coordinates; closed/abandoned category is visible. |
| `complete_runway_endpoint_coordinates` | `KORD` | `3754` | Major airport | 11 runways, 9 frequencies, 22 navaids | Rich runway display can show endpoint-coordinate details when present. |

QA should confirm that each sample keeps source/provenance details available,
does not expose raw database geometry as user-facing text, and does not imply
live operational data.

## Known Limitations

- This reference is display guidance only; it does not define or change an API
  contract.
- OurAirports data is aviation reference data, not live operational data.
- No NOTAM, METAR, TAF, airport delay, airport closure, or live aircraft data is
  included.
- Runway surfaces and frequency/navaid types are source-derived values and are
  not fully normalized.
- Many airports legitimately have no runway or frequency records in the source.
- Runway endpoint coordinates are often missing from source data.
- Nearby navaids are selected by bounded spatial proximity, not official
  facility ownership.
- QA sample counts reflect the documented local Docker database state and may
  change after a future source refresh.
- Coordinate override presentation is future-facing and should only be shown
  after an API explicitly exposes effective coordinate fields.
- Frontend must continue to consume API responses only and must not query the
  database directly.

## Next Safe Use

Claude/API can use this reference while shaping response labels and provenance
fields for Airport Detail API work. Gemini/frontend can use it later for Object
Intel display QA after the API contract is available. Codex/data should update
this document only when aviation source fields, QA samples, or data-quality
findings materially change.
