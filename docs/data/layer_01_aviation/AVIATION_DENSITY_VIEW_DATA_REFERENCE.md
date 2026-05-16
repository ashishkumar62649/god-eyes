# Aviation Density View Data Reference

WO-029B-DATA documents Layer 1 aviation data distribution for future density
rendering and frontend QA. This is data/database/docs support only. It does not
modify frontend code, API code, contracts, migrations, or source data.

Measured with:

```powershell
python scripts\aviation_density_view_data_reference.py --json --country-limit 20 --grid-limit 15 --cell-size-degrees 5
```

Environment:

- Local Docker PostGIS database: `god_eyes_dev`
- Table: `aviation_airports`
- Source: normalized OurAirports reference data
- Layer: `layer_01_aviation`
- Grid sample size: 5 degree longitude/latitude buckets

## Total Airport Count

| Metric | Count |
|---|---:|
| Total airport records | 85,377 |

This is a reference-data count, not a live operational count. All density-mode
planning should assume the full global table can fit in the database, but not
in a browser all-points viewport.

## Counts By Category

| Category | Count | Density implication |
|---|---:|---|
| `small_airfield` | 42,616 | Largest category; dominates global density and rural map noise. |
| `heliport` | 22,980 | Very large category; can create urban high-zoom clutter. |
| `closed_or_abandoned` | 13,181 | Important for historical/reference layers, but risky as a default density input. |
| `regional_or_domestic_airport` | 4,095 | Useful middle tier for practical airport coverage. |
| `water_landing_site` | 1,262 | Small but geographically clustered near coasts/lakes. |
| `international_or_major_airport` | 1,182 | Small enough for broad display, but incomplete for density context by itself. |
| `balloonport` | 61 | Very small category; not a density stressor. |

## Operational Versus Closed

For this reference, `closed_or_abandoned` is treated as closed/historical.
Everything else is treated as operational reference data because the source does
not provide live operational status.

| Status bucket | Count | Notes |
|---|---:|---|
| Operational reference | 72,196 | All non-closed normalized categories. Not proof of current operation. |
| Closed or historical | 13,181 | `closed_or_abandoned`; should usually be opt-in or visibly filtered. |

Closed/historical airports are about 15.4 percent of the table. Rendering them
by default in global density can make inactive sites look operational unless
the UI clearly separates them.

## Heliport Water Balloonport Unknown Counts

| Category | Count | Recommendation |
|---|---:|---|
| `heliport` | 22,980 | Provide a category filter because heliports can dominate dense urban views. |
| `water_landing_site` | 1,262 | Keep as a distinct filter for coastal and lake-heavy QA. |
| `balloonport` | 61 | Safe to include, but too small to drive density decisions. |
| `unknown` | 0 | No current unknown category rows in the measured local data. |

## Global Distribution

Top country counts show that density risk is not evenly global. The United
States alone contributes 32,495 rows, followed by Brazil, Japan, Canada,
Australia, and Mexico.

| Country | Count |
|---|---:|
| `US` | 32,495 |
| `BR` | 7,913 |
| `JP` | 3,747 |
| `CA` | 3,313 |
| `AU` | 2,789 |
| `MX` | 2,694 |
| `RU` | 1,807 |
| `FR` | 1,757 |
| `GB` | 1,593 |
| `DE` | 1,431 |
| `KR` | 1,418 |
| `IT` | 1,054 |
| `AR` | 977 |
| `VE` | 898 |
| `PH` | 859 |
| `CN` | 775 |
| `CO` | 736 |
| `ID` | 728 |
| `ZA` | 674 |
| `IN` | 649 |

Country filters are therefore useful for QA and user-facing density controls,
but they do not replace viewport-aware limits. `US` alone is too large for
unclustered low-zoom point rendering.

## Densest Bounding Boxes

The density script sampled global 5 degree grid cells. These cells are practical
stress examples for low/medium zoom map rendering.

| BBox lon/lat | Count | Practical reading |
|---|---:|---|
| `-100,30` to `-95,35` | 1,865 | Texas/Oklahoma region; strongest measured cell. |
| `-90,40` to `-85,45` | 1,658 | Upper Midwest/Great Lakes density. |
| `135,35` to `140,40` | 1,647 | Japan dense cell. |
| `-75,40` to `-70,45` | 1,636 | Northeast US corridor. |
| `-80,40` to `-75,45` | 1,503 | Pennsylvania/New York/Great Lakes edge. |
| `-80,35` to `-75,40` | 1,458 | Mid-Atlantic/Appalachian density. |
| `125,35` to `130,40` | 1,418 | Korea/Japan region. |
| `-85,40` to `-80,45` | 1,410 | Great Lakes region. |
| `-95,30` to `-90,35` | 1,359 | Gulf/South Central US. |
| `-120,30` to `-115,35` | 1,275 | Southern California/Nevada/Arizona pressure. |
| `-95,35` to `-90,40` | 1,264 | Central US. |
| `-50,-25` to `-45,-20` | 1,225 | Southeast Brazil. |
| `-100,25` to `-95,30` | 1,224 | Texas Gulf region. |
| `-90,35` to `-85,40` | 1,166 | Central/Eastern US. |
| `-85,35` to `-80,40` | 1,052 | Eastern US. |

These boxes are useful for automated and manual stress testing because they
fit into a single viewport more naturally than global counts.

## QA Regions

Recommended frontend QA regions:

| Region | BBox lon/lat | Count | Why test it |
|---|---|---:|---|
| Contiguous United States | `-125,25` to `-65,50` | 34,276 | Largest single-country stress region and broad mixed category coverage. |
| Core Europe | `-10,35` to `30,60` | 10,621 | Dense multi-country region with many medium and small airports. |
| Brazil | `-75,-35` to `-30,6` | 9,839 | Large southern-hemisphere count and sparse-to-dense interior mix. |
| Japan and Korea | `125,30` to `146,46` | 5,239 | Compact East Asia density and island/peninsula viewport behavior. |
| Northeast United States | `-80,38` to `-66,47` | 4,624 | Dense urban corridor and high marker overlap risk. |
| California and Nevada | `-125,32` to `-114,43` | 3,177 | Western US dense viewport with heliport and small-airfield pressure. |
| Dubai and UAE | `54,23` to `56.5,26` | 222 | Low-count sanity check with known sample airport `OMDB`. |

QA should include both broad regional views and close zooms inside the densest
cells. A density mode that only works for Dubai or one city-level viewport is
not ready for global aviation use.

## Category Filter Implications

- `small_airfield` is the largest category, so hiding or aggregating it has the
  biggest effect on visual clutter.
- `heliport` is the second largest category and is often urban; it should be a
  first-class filter for browser stress and user readability.
- `closed_or_abandoned` should be visually separated or disabled by default for
  operational-looking views because it represents 13,181 records.
- `international_or_major_airport` is small enough for broad display, but a
  major-airport-only view is not a density test.
- `water_landing_site` and `balloonport` are small filters, but they help verify
  category styling and edge-case category toggles.
- Country filters can still return very large result sets; `US` returns 32,495
  records and should not bypass clustering/limits.

## Density Mode Limit Recommendations

Recommended first-pass density behavior:

1. Do not render global all-points output in the browser.
2. Use clusters, server-side grid cells, or capped point responses at low zoom.
3. Use viewport bounding boxes for every density request.
4. Keep category and country filters compatible with the same density limits.
5. Use the densest 5 degree cells above as stress cases for cell aggregation.
6. Switch from aggregate density to individual points only at close zoom or
   after the response count is below a measured browser-safe threshold.
7. Treat `closed_or_abandoned` as opt-in for operational-looking density views.

Practical threshold guidance:

| Response shape | Suggested ceiling | Rationale |
|---|---:|---|
| Raw points in one browser response | 1,000 to 2,000 | Comparable to one dense 5 degree cell; useful before performance tuning. |
| Cluster/grid cells | 500 cells or fewer | Keeps visual parsing and DOM/canvas work bounded. |
| Category-filtered broad regions | Same as raw/cluster limits | Category filters reduce data, but some still return tens of thousands of rows. |
| Global view | Aggregates only | Full table is 85,377 rows. |

Exact limits should be tuned by frontend performance testing, but the data
distribution strongly argues against unbounded point rendering.

## Global All-Point Rendering Warning

Global all-point rendering would send 85,377 airport markers before any future
detail data. That is risky for browser memory, frame rate, interaction latency,
hit testing, and label/marker readability.

The risk is concentrated:

- The contiguous US viewport returns 34,276 rows.
- The top 15 measured 5 degree cells each return 1,052 to 1,865 rows.
- Dense urban heliport areas may overlap heavily even when total count looks
  manageable.
- Closed/historical records can make a density map look operationally active
  when it is only showing reference data.

## Known Limitations

- Counts reflect the local Docker database state at the time of WO-029B-DATA.
- OurAirports is reference data, not live aviation operations data.
- Operational reference means "not normalized as closed", not verified open.
- No NOTAM, METAR, TAF, airport delay, airport closure, or live aircraft data is
  included.
- The 5 degree grid is a simple planning approximation, not a final clustering
  algorithm.
- Bounding boxes are axis-aligned and do not handle antimeridian-spanning
  regions in this reference script.
- Density counts can change after source refreshes.
- Browser-safe thresholds require frontend measurement on target hardware.
- This work order does not implement API density endpoints or frontend
  rendering.

## Regeneration

To refresh this reference after a source update, run:

```powershell
python scripts\aviation_density_view_data_reference.py --json --country-limit 20 --grid-limit 15 --cell-size-degrees 5
```

Update this document only when the source distribution materially changes. Do
not commit generated JSON dumps.
