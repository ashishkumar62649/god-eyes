# WO-035-MINIMAX — Airport Intelligence Source and Fetching Research

**Author:** MiniMax / Gemini research assistant
**Work order:** WO-035-MINIMAX-SOURCE-RESEARCH
**Layer:** `layer_01_aviation`
**Status:** Research only — no implementation, no code, no migrations
**Created:** 2026-05-19
**Branch:** `agent/fetching-airport-enrichment`

---

## 1. Executive Summary

We already enrich airports with Wikipedia summaries and Wikidata structured facts
(WO-032 pipeline). This research identifies sources for six new intelligence
categories: capacity, passenger traffic, growth trends, official sources, OSM
physical layout, and per-source confidence/TTL. It covers free/open sources
first, marks paid/limited sources clearly, and recommends a progressive fetch
strategy that keeps user clicks fast.

**Key findings:**
- Runway count/length/surface already exists in OurAirports — no new fetch needed.
- Wikipedia extracts already contain real passenger numbers (verified: Dubai 92M
  in 2024) — fast, free, immediately usable.
- Wikidata P1589 has passenger throughput; BTS (US) and Eurostat (Europe) are
  free but slower and require country-specific lookups.
- OSM Overpass API provides gate, terminal, taxiway, and apron geometry for free
  but is rate-limited and needs careful query scoping by bounding box.
- Official airport websites are slow and should be background-only with 90-day TTL.
- Annual reports from civil aviation authorities are the most authoritative source
  for capacity but require PDF parsing — background/backfill only.

---

## 2. Source Categories and Field Mapping

### 2.1 Capacity

**What we mean:** Runway count, runway dimensions, pavement surface, landing
capacity, terminal capacity (gates/stands), slot协调 capacity.

| Field | Best source | Free? | Speed | TTL |
|---|---|---|---|---|
| Runway count | OurAirports `runways.csv` | Yes | Already in DB | Permanent |
| Runway length/width | OurAirports `runways.csv` | Yes | Already in DB | Permanent |
| Runway surface | OurAirports `runways.csv` | Yes | Already in DB | Permanent |
| Runway PCN (pavement strength) | NOTAM / AIS — out of scope | — | — | — |
| Gate/stand count | OSM `aeroway=gate` count | Yes* | Medium | 30 days |
| Terminal count | OSM `aeroway=terminal` | Yes* | Medium | 30 days |
| Slot capacity | IATA Slot Registry | Paid | Slow | 90 days |
| Max passenger capacity | ACI / annual reports | Paid/limited | Slow | 90 days |

*OSM is community data — accuracy varies. Treat as indicative only.

**Recommendation:** Start with OurAirports runways (already in DB) and OSM gate
counts for gates. Do not claim precision on capacity — store as
`approximate_gate_count` with `source=osm` and `confidence=low`.

### 2.2 Passenger Traffic and Growth

| Field | Best source | Free? | Speed | TTL |
|---|---|---|---|---|
| Annual passengers (latest) | Wikipedia extract | Yes | Fast | 30 days |
| Annual passengers (structured) | Wikidata P1589 | Yes | Fast | 30 days |
| Annual passengers (US) | BTS Transtats `T-100` | Yes | Medium | 90 days |
| Annual passengers (EU) | Eurostat `avia_paoc` | Yes | Medium | 90 days |
| Monthly passengers | BTS Transtats (US) | Yes | Slow | 30 days |
| Cargo tonnage | Wikipedia extract, Wikidata P1589 | Yes | Fast | 30 days |
| Aircraft movements | Wikipedia extract, Wikidata P3878 | Yes | Fast | 30 days |
| Growth year-over-year | Computed from history | — | Fast | 30 days |
| Passenger rankings | ACI World Airport Traffic Report | Paid | Slow | 90 days |

**Wikipedia extract note:** The Wikimedia REST API `page/summary` endpoint
already contains current-year passenger figures. Verified: Dubai International
extract includes "92 million passengers (2024)". This is the fastest source —
no separate fetch needed beyond the WO-032 Wikipedia summary already fetched.
Extract the number using a regex pattern from `extract` text.

**Growth computation:** Store annual passenger figures in a
`airport_traffic_history` table (future WO). Compute growth as
`((current - prior) / prior) * 100`. Do not estimate growth from a single
data point.

### 2.3 Official Operator / Owner / Terminal / Gate Information

| Field | Best source | Free? | Speed | TTL |
|---|---|---|---|---|
| Operator name | Wikidata P137 | Yes | Fast | 30 days |
| Owner name | Wikidata P127 | Yes | Fast | 30 days |
| Official website | Wikidata P856, OurAirports `homepage` | Yes | Fast | 30 days |
| Terminal list | OSM `aeroway=terminal` | Yes* | Medium | 30 days |
| Gate list | OSM `aeroway=gate` | Yes* | Medium | 30 days |
| Contact info | Official website only | Varies | Slow | 90 days |
| Social media | Official website only | Varies | Slow | 90 days |

**Important:** Never guess operator or owner from name analysis. Always source
from Wikidata or Wikipedia. If neither source has it, leave null.

### 2.4 Physical Layout (OSM)

OSM uses the Overpass API (`https://overpass-api.de/api/interpreter`) with
OpenStreetMap data tagged by aeroway type.

| OSM tag | Meaning | Geometry type |
|---|---|---|
| `aeroway=runway` | Runway centerline | Way/LineString |
| `aeroway=taxiway` | Taxiway | Way/LineString |
| `aeroway=apron` | Aircraft apron/parking | Way/Polygon |
| `aeroway=terminal` | Passenger terminal building | Way/Polygon |
| `aeroway=gate` | Gate/stand position | Node/Point |
| `aeroway=hangar` | Hangar | Way/Polygon |
| `aeroway=control_tower` | Control tower | Way/Node/Point |
| `building=terminal` | Terminal building outline | Way/Polygon |
| `landuse=runway` | Runway area (larger zone) | Way/Polygon |
| `boundary=airport` | Airport boundary | Way/Polygon |

**Coordinate bounding box:** All OSM queries MUST be scoped to a bounding box
derived from OurAirports `latitude_deg` / `longitude_deg` with a ±0.05 degree
buffer (~5 km). This prevents querying the entire world for airports not in OSM.

**Overpass API note:** This service is free but rate-limited (~2 requests per
second globally). Queries must be small and targeted. A bounding-box scoped query
for a single airport should complete in <5 seconds. Include a descriptive
User-Agent: `god-eyes/1.0 (https://github.com/anomalyco/god-eyes;
god-eyes@example.com) OSMLayoutFetcher/1.0`

**OSM data is community-maintained.** Gate counts from OSM may differ from
official counts. Always store `source=osm` and a `data_version` timestamp.

### 2.5 Official Sources (Annual Reports, Civil Aviation Authorities)

| Authority | Coverage | Data available | Access |
|---|---|---|---|
| FAA (US) | US airports | Aircraft movements, passenger counts | `faa.gov/airports_airways` — free |
| Eurocontrol (ECAC) | Europe | Movements, delays, slot data | `eurocontrol.int` — free for basic |
| ACI World | Global | Passenger rankings, traffic reports | Paid/members-only |
| Eurostat | EU+ | Passenger/cargo statistics | Free, bulk download |
| BTS (US) | US | T-100 traffic, O&D survey | Free API, requires query building |
| DGAC (France) | France | French airport stats | Free |
| CCAC (China) | China | Chinese airport stats | Varies, often in Mandarin |
| IATA | Global | Schedules, slot registry | Paid |
| ICAO | Global | Accident/incident data, stats | Paid/limited |

**Strategy:** Use free sources for US and EU airports. Treat official reports
(DFS, DGAC, CCAC) as background/backfill data. Do not require them for user-click
enrichment.

---

## 3. Source Priority Order

### Fast path (user click, <2s):
1. **OurAirports runways** — already in DB, no fetch needed
2. **Wikipedia summary** — already fetched in WO-032, extract traffic from text
3. **Wikidata** — already fetched in WO-032, read P1589, P137, P127, P856
4. **OurAirports homepage field** — already in DB

### Medium path (background fetch, <10s):
5. **OSM Overpass** — gate count, terminal geometry, runway centerlines
6. **BTS Transtats API** — US passenger traffic (T-100 dataset)
7. **Eurostat** — EU passenger statistics

### Slow path (background/backfill, no user waiting):
8. **Official airport websites** — homepage, annual reports (PDF parse)
9. **FAA/Eurocontrol** — US/ECAC official statistics
10. **Annual reports PDF** — operator name, capacity claims, terminal expansion plans

---

## 4. Recommended TTL Per Source

| Source | TTL | Reason |
|---|---|---|
| Wikipedia REST API | 30 days | Infrequently changes |
| Wikidata | 30 days | Structured data is stable |
| OSM Overpass | 30 days | Layout changes rarely |
| BTS Transtats | 90 days | Monthly/annual aggregates |
| Eurostat | 90 days | Annual publications |
| Official airport websites | 90 days | Stable unless redesign |
| Annual reports (PDF) | 365 days | Annual publication cycle |
| ACI paid reports | 365 days | Annual — just track existence |

---

## 5. Matching Strategy

### 5.1 Primary matching for OurAirports airports

All airports in our DB have an OurAirports identity. Use it:

1. **OurAirports `wikipedia_link`** → Wikipedia title (highest confidence, `high`)
2. **OurAirports `ident` (ICAO)** → Wikidata P239 lookup → QID (high confidence)
3. **OurAirports `iata_code`** → Wikidata P238 lookup → QID (medium, may have collisions)
4. **OurAirports coordinates + Wikipedia/Wikidata coordinates** → distance check (50 km threshold, medium)
5. **Name + country fuzzy match** → Wikipedia search → coordinate sanity check (low)

### 5.2 OSM matching

- Use OurAirports `latitude_deg` + `longitude_deg` to build a bounding box:
  `bbox = (lon - 0.05, lat - 0.05, lon + 0.05, lat + 0.05)`
- Query OSM Overpass for all aeroway elements within that bbox.
- If the bounding box returns no elements, the airport may not be mapped in OSM.
  Do not fall back to a wider search — store `osm_mapped: false` and skip.
- Store the OSM query timestamp as `osm_fetched_at`.

### 5.3 Wrong-match prevention

| Risk | Prevention |
|---|---|
| Two airports share same IATA code (rare but real) | Always verify coordinates within 50 km after IATA-only lookup |
| Airport renamed in Wikipedia but OurAirports link is stale | Use Wikipedia page ID (stable) not title for deduplication |
| OSM element belongs to a different nearby airport | Apply 50 km bounding box from OurAirports coords |
| Wikidata QID collision via ICAO lookup | Verify `P239` value matches our `ident` before accepting |
| Passenger number from Wikipedia is from wrong year | Store `extract_retrieved_at` and verify number has year qualifier |
| Wikipedia extract contains multiple airports (hub text) | Only trust numbers from the lead paragraph; flag if extract is longer than 500 chars and contains no year |

**Never store a number from a text that doesn't include a year qualifier.**
If the Wikipedia extract says "millions of passengers" with no figure, do not
store a number.

---

## 6. Fields We Must Never Guess

The following fields must only be stored when sourced from an actual data point.
If the source does not provide the field, leave it null. Do not estimate,
interpolate, or derive from other fields.

| Field | Reason not to guess |
|---|---|
| Annual passenger count | Public reporting standards require precise figures |
| Capacity (gates, stands) | Officially regulated/slotted; wrong numbers are misleading |
| Operator / Owner | Legal entity information must be accurate |
| Airport boundary coordinates | Legally significant; use OSM only when verified |
| Runway declared distances (TORA, TODA, LDA) | Requires official AIS NOTAM |
| Elevation / threshold coordinates | Instrument approach safety critical |
| ILS categories | Pilot safety critical |
| Slot coordination status | Regulatory |

---

## 7. Major vs. Small Airport Prioritization

### Large/international airports (>10M passengers/year):
- Full enrichment: Wikipedia summary + Wikidata + OSM gate/terminal layout + BTS/Eurostat traffic
- Wikipedia extract likely to contain traffic figures and description
- OSM likely to be well-mapped
- Consider fetching BTS for US airports, Eurostat for EU airports

### Medium airports (1M–10M passengers/year):
- Wikipedia summary + Wikidata + OurAirports runways
- OSM mapping quality varies — check but don't fail if missing
- Official sources (annual reports) as backfill if available

### Small airports (<1M passengers/year):
- OurAirports identity + Wikipedia summary (if Wikipedia link exists)
- No OSM enrichment needed (likely not mapped)
- Wikidata likely sparse or missing

---

## 8. Source Confidence Matrix

| Source | Accuracy | Completeness | Stability | Freshness | Overall confidence |
|---|---|---|---|---|---|
| OurAirports runways | High | High | High | High (monthly refresh) | **High** |
| Wikipedia extract | High (published facts) | Medium (not all airports) | High | Medium (30-day TTL) | **High** |
| Wikidata P1589 | Medium (reported values) | Medium | Medium | Medium | **Medium** |
| OSM gates/terminals | Medium (community) | Varies | Medium | Low (unknown update freq) | **Low** |
| BTS T-100 | High (official) | High (US only) | High | High (monthly) | **High** |
| Eurostat | High (official) | High (EU only) | High | Medium (annual) | **High** |
| Official websites | High (primary source) | High | High | Medium | **Medium-High** |
| Annual reports | High | Medium | High | Low (annual) | **Medium** |

---

## 9. Stale-While-Revalidate Strategy

For all sources except OurAirports (already in DB):

- **Fresh cache** (< 30 days): return immediately to user
- **Stale cache** (30–90 days): return stale immediately, queue background refresh
- **Missing data**: do not pre-fetch for all airports; lazy fetch on first request
- **No-profile found**: store a sentinel with `fetch_status = 'no_data_found'` and
  re-fetch after 90 days. Do not re-try more frequently.

---

## 10. Progressive Fetch Architecture (Design Only)

```
User clicks airport
  │
  ├─ OurAirports identity → already in DB (runways, coordinates, IATA/ICAO)
  │
  ├─ Wikipedia summary → already fetched WO-032
  │    └─ extract passenger number + growth from text
  │
  ├─ Wikidata → already fetched WO-032
  │    └─ operator, owner, website, P1589 traffic
  │
  ├─ [BACKGROUND] OSM gate/terminal count
  │    └─ bounding-box query, store count + geometry links
  │
  ├─ [BACKGROUND] BTS/Eurostat (US/EU airports only)
  │    └─ store annual passengers + movements
  │
  └─ [BACKGROUND] Official website annual report
       └─ extract operator statements, capacity claims
```

No code implementation in this work order.

---

## 11. Known Limitations and Open Questions

1. **OSM Overpass rate limiting:** The Overpass API has a global rate limit.
   Concurrent requests may be rejected. Should we run our own Overpass instance
   (Nominatim + Overpass) or use a commercial OSM provider (Mapbox, Geofabrik)?
   **Decision needed.**

2. **Wikipedia passenger number extraction:** Extracting structured numbers from
   free text is fragile. Should we store the raw extract and let the frontend
   render the number, or store the parsed number in a separate field?
   **Decision needed.**

3. **BTS API complexity:** The BTS T-100 API requires multi-step queries
   (dataset → carrier → airport). This is non-trivial to implement. Is BTS
   high enough priority to justify the complexity in WO-036?
   **Decision needed.**

4. **OSM boundary data:** OSM `boundary=airport` polygons may not exist for all
   airports. Should we treat OSM boundary as optional and not block on it?
   **Decision needed.**

5. **Annual report parsing:** PDF extraction is out of scope for v1. Should we
   store a URL link to the annual report and let the frontend display it as a
   link rather than parse it?
   **Decision needed.**

6. **Wikidata P1589 vs Wikipedia extract:** Which should take priority for
   passenger numbers when both are available? P1589 is structured but may lag
   the Wikipedia extract. **Decision needed.**

7. **OSM data licensing:** OSM data is licensed under ODbL 1.0. Any derived
   datasets (e.g., gate count caches) must be published under ODbL or kept
   internal. **Decision needed for any public data products.**

---

## 12. Source Summary Table

| Source | Type | Free | Speed | TTL | User click? | Background? |
|---|---|---|---|---|---|---|
| OurAirports | DB existing | Yes | Instant | Permanent | Yes | No |
| Wikipedia REST API | HTTP | Yes | Fast | 30d | Yes (WO-032) | Yes |
| Wikidata REST/SPARQL | HTTP | Yes | Fast | 30d | Yes (WO-032) | Yes |
| OSM Overpass API | HTTP | Yes* | Medium | 30d | No | Yes |
| BTS Transtats | HTTP | Yes | Slow | 90d | No | Yes |
| Eurostat | HTTP/bulk | Yes | Slow | 90d | No | Yes |
| Official airport websites | HTTP | Yes | Slow | 90d | No | Yes |
| FAA/Eurocontrol | HTTP | Yes | Slow | 90d | No | Yes |
| Annual reports (PDF) | HTTP | Yes | Very slow | 365d | No | Yes |
| IATA Slot Registry | HTTP | **No** | Slow | 90d | No | No |
| ACI World Report | Web | **Paid** | Slow | 365d | No | No |
| FlightRadar24 / FlightAware | API | **No** | — | — | No | No |
| OAG / Cirium | API | **No** | — | — | No | No |

*OSM is free but ODbL licensing requires attribution. See Section 11, item 7.

---

*End of WO-035-MINIMAX source research document.*
*Research only — no implementation, no code, no migrations.*
*Ready for WO-036 design work order.*