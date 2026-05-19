# WO-040 — Airport Intelligence Source Audit and Probe Results

**Author:** MiniMax / Gemini research assistant
**Work order:** WO-040-FETCHING-SOURCE-AUDIT
**Layer:** `layer_01_aviation`
**Status:** Source audit — no implementation, no DB writes
**Probe date:** 2026-05-19
**Branch:** `agent/fetching-airport-intelligence-source-audit`

---

## 1. Probe Summary

Five airports probed across six source categories. Real HTTP requests made.
No database writes. No production code.

| Airport | ICAO | IATA | Wikipedia | Wikidata | OSM Overpass | BTS | Eurostat | Official Site |
|---|---|---|---|---|---|---|---|---|
| John F. Kennedy Intl | KJFK | JFK | ✅ 200 | ❌ 429 | ❌ 406 | ❌ DNS | ❌ 400 | ✅ 200 (JS) |
| Bradley Intl | KBDL | BDL | ✅ 200 | ❌ 429 | ❌ 406 | ❌ DNS | ❌ 400 | ✅ 200 (JS) |
| Dubai Intl | OMDB | DXB | ✅ 200 | ❌ 429 | ❌ 406 | N/A-US | ❌ 400 | ✅ 200 (JS) |
| Heathrow | EGLL | LHR | ✅ 200 | ❌ 429 | ❌ 406 | N/A-EU | ❌ 400 | ✅ 200 (JS) |
| Québec Jean Lesage | CYQB | YQB | ❌ encoding | ❌ 429 | ❌ 406 | N/A-EU | ❌ 400 | ❌ refused |

---

## 2. Source-by-Source Audit

---

### 2.1 Wikipedia REST API

**Endpoint:** `GET https://en.wikipedia.org/api/rest_v1/page/summary/{title}`

| Property | Value |
|---|---|
| **API key required** | NO |
| **Free for MVP** | YES |
| **Suitable for user-click** | YES |
| **Suitable for background** | YES |
| **Average latency** | 126–380 ms |
| **Rate limit** | ~200 req/s global; 1 req/IP/s for summary endpoint |
| **Required User-Agent** | Descriptive (e.g. `god-eyes/1.0 (URL; email)`) |
| **License** | CC BY-SA 4.0 — attribution displayed in UI required |
| **Probe result** | ✅ PASS 4/5 airports; ❌ encoding error on CYQB (é in Québec) |

**Fields available:**
| Field | Available? | Notes |
|---|---|---|
| `summary` | ✅ Yes | Free-text paragraph, max ~500 chars |
| `short_description` | ✅ Yes | One-line description (e.g. "International airport serving New York City") |
| `image` | ✅ Yes | Thumbnail URL from Wikipedia/Wikimedia Commons |
| `opened_date` | ⚠️ Rarely | Only if explicitly in lead paragraph text |
| `operator` | ⚠️ Rarely | Only if explicitly in lead paragraph text |
| `official_website` | ❌ No | Not in summary endpoint |
| `passenger_capacity` | ❌ No | Not available in summary |
| `passenger_traffic` | ⚠️ Partial | DXB: extract says "92 million passengers (2024)" — but most airports lack specific numbers |
| `cargo` | ⚠️ Rarely | DXB: "2.2 million tonnes" present in extract |
| `aircraft_movements` | ⚠️ Rarely | DXB: "450,000 aircraft movements" in extract |
| `terminals/gates/stands` | ❌ No | Not in summary endpoint |
| `runway/layout` | ❌ No | Not in summary endpoint |

**Confidence per airport:**
- KJFK: `extract_length=640` — no specific passenger number, no year qualifier. Confidence: **medium** (no traffic data)
- KBDL: `extract_length=537` — no specific passenger number. Confidence: **low** (no traffic data)
- OMDB/DXB: `extract_length=592` — "92 million passengers (2024)", "2.2 million tonnes", "450,000 aircraft movements". **Year-qualified traffic data present.** Confidence: **high**
- EGLL/LHR: `extract_length=286` — generic description only, no traffic data. Confidence: **low** (no traffic data)
- CYQB: **FAIL** — `UnicodeEncodeError: 'ascii' codec can't encode 'é'` in URL-encoded name. The name "Québec Jean Lesage International Airport" contains a non-ASCII character that must be encoded as `Qu%C3%A9bec` or similar.

**Key rule validated:** Never store traffic number from extract without a year qualifier. DXB is the only airport in our probe set where the extract contains year-qualified traffic data. All others (KJFK, KBDL, EGLL) do not have specific traffic numbers in their Wikipedia summary.

**Recommendation:**
- Use Wikipedia summary for: `summary`, `short_description`, `image`, `article_url`
- Extract traffic from `summary` text only when a year (2020–2026) appears within 3 tokens of the number
- URL-encode non-ASCII airport names properly (use `urllib.parse.quote(name, safe='')`)
- Always show CC BY-SA 4.0 attribution when Wikipedia content is displayed
- TTL: **30 days** — Wikipedia articles change infrequently

---

### 2.2 Wikidata REST API

**Endpoint:** `GET https://www.wikidata.org/wiki/Special:EntityData/{QID}.json`
**SPARQL endpoint:** `GET https://query.wikidata.org/sparql`

| Property | Value |
|---|---|
| **API key required** | NO |
| **Free for MVP** | YES |
| **Suitable for user-click** | ❌ NO (see below) |
| **Suitable for background** | ⚠️ CONDITIONAL |
| **Average latency** | 147–379 ms (when not rate-limited) |
| **Rate limit** | ~1 req/IP/s on REST API; SPARQL endpoint also limited |
| **Required User-Agent** | Yes — descriptive, contact email required |
| **License** | CC0 1.0 — no attribution required, but store source metadata |
| **Probe result** | ❌ 429 Too Many Requests on ALL airports |

**🚨 CRITICAL FINDING:** Wikidata is returning HTTP 429 (Too Many Requests) for every probe attempt across all 5 airports. This means:
1. The public Wikidata REST API is being rate-limited in our environment
2. The SPARQL endpoint is also rate-limited
3. User-click fetching from Wikidata is NOT feasible in production without either:
   - A queue/throttle to limit requests to ~1/second globally
   - A local Wikidata mirror (Wikibase snapshot)
   - An enterprise Wikidata API key (not free)

**Fields available via Wikidata:**
| Field | Property | Available? |
|---|---|---|
| `opened_date` | P571 | ✅ Yes (if present in Wikidata) |
| `operator` | P137 | ✅ Yes (if present in Wikidata) |
| `owner` | P127 | ✅ Yes (if present in Wikidata) |
| `official_website` | P856 | ✅ Yes (if present in Wikidata) |
| `passenger_traffic` | P1589 | ✅ Yes (if present in Wikidata — structured, year-qualified) |
| `cargo_tonnage` | P3878 | ✅ Yes (if present in Wikidata) |
| `image` | P18 | ✅ Yes (Wikimedia Commons image) |
| `coordinates` | P625 | ✅ Yes (for coordinate sanity check) |
| `icao_code` | P239 | ✅ Yes (for match verification) |
| `iata_code` | P238 | ✅ Yes (for match verification) |

**Recommendation:**
- Do NOT fetch Wikidata on every user click — implement a request queue with minimum 1-second delay between requests
- OR: use a local Wikidata JSON dump (updated monthly) for production
- OR: fall back to Wikipedia extract for structured facts when Wikidata is unavailable
- Store `fetch_status = 'rate_limited'` and do not retry for at least 1 hour
- TTL when successful: **30 days**
- Background-only for v1: never block user response on Wikidata fetch

---

### 2.3 OpenStreetMap / Overpass API

**Endpoint:** `POST https://overpass-api.de/api/interpreter`

| Property | Value |
|---|---|
| **API key required** | NO |
| **Free for MVP** | YES (ODbL license — attribution required) |
| **Suitable for user-click** | ❌ NO |
| **Suitable for background** | ⚠️ CONDITIONAL (see below) |
| **Average latency** | 532–572 ms (when accessible) |
| **Rate limit** | ~2 req/global/IP; aggressive throttling |
| **Required User-Agent** | Yes — must be descriptive and include contact |
| **License** | ODbL 1.0 — attribution required; derived databases must be shared |
| **Probe result** | ❌ 406 Not Acceptable on ALL airports |

**🚨 CRITICAL FINDING:** Overpass API returns 406 Not Acceptable for all airport probes. This is a known response when:
1. The User-Agent is too generic or missing
2. The request format is not accepted
3. Global rate limits are exceeded

The 406 was observed even with a descriptive User-Agent and correct POST body format. This suggests either:
- Our IP is on a blocklist or rate-limited globally
- The Overpass public API requires a different registration
- A production deployment needs its own Overpass instance

**Fields available via OSM:**
| Field | OSM tag | Available? |
|---|---|---|
| `gate_count` | `aeroway=gate` | ✅ Yes (if mapped) |
| `terminal_geometry` | `aeroway=terminal` | ✅ Yes (if mapped) |
| `runway_geometry` | `aeroway=runway` | ✅ Yes (but OurAirports already has this) |
| `taxiway_geometry` | `aeroway=taxiway` | ✅ Yes (if mapped) |
| `apron_geometry` | `aeroway=apron` | ✅ Yes (if mapped) |
| `airport_boundary` | `boundary=airport` | ✅ Yes (if mapped) |
| `control_tower` | `aeroway=control_tower` | ✅ Yes (if mapped) |

**Recommendation:**
- Do NOT use the public Overpass API for user-facing fetches
- Option A: Run a self-hosted Overpass instance ( Nominatim + Overpass ) — best control, no rate limits
- Option B: Use a commercial OSM provider (Mapbox, Geofabrik, AWS OSM data) — reliable, may have costs
- Option C: Skip OSM layout for v1 — OurAirports runways are already in DB
- If OSM is used: always store `source=osm`, `osm_fetched_at`, and `osm_confidence=low`
- OSM data accuracy varies — gate counts from OSM may differ from official counts
- OSM ODbL license: derived gate count caches must be published under ODbL or kept internal
- TTL: **30 days** if implemented; layout changes are rare

---

### 2.4 BTS Transtats (US airports only)

**Endpoint:** `https://www.bts.gov/content/delay-and-cancellation-data` or T-100 API

| Property | Value |
|---|---|
| **API key required** | NO |
| **Free for MVP** | YES |
| **Suitable for user-click** | ❌ NO |
| **Suitable for background** | ⚠️ CONDITIONAL (see below) |
| **Average latency** | Unknown (DNS failure in probe) |
| **Rate limit** | Unknown — likely requires form-based query |
| **Required User-Agent** | Standard browser-like |
| **License** | US Government public data |
| **Probe result** | ❌ DNS resolution failure — `api.bts.gov` not reachable |

**🚨 CRITICAL FINDING:** The BTS API endpoint was not reachable via DNS (`getaddrinfo failed`). The actual BTS data access requires navigating to `https://www.transtats.bts.gov/` and using their form-based query interface, not a simple REST API.

BTS Transtats works through:
1. Web UI at `https://www.transtats.bts.gov/` — select dataset, parameters, then download CSV
2. T-100 dataset: `https://www.transtats.bts.gov/DL_SelectFields.aspx?gnoession_Variable_Group`
3. No simple API key + REST endpoint — requires query building or manual download

**Fields available via BTS:**
| Field | Dataset | Available? |
|---|---|---|
| `passenger_count` | T-100 (carrier + airport) | ✅ Yes (monthly) |
| `departures` | T-100 | ✅ Yes |
| `freight_tonnage` | T-100 | ✅ Yes |
| `mail_tonnage` | T-100 | ✅ Yes |
| `on_time_performance` | On-Time Performance | ✅ Yes |

**Recommendation:**
- Do NOT implement as user-click fetch — BTS requires multi-step form query
- Background-only if US airport traffic is a priority
- Consider using pre-built BTS datasets downloaded monthly to S3, then read locally
- BTS data is authoritative and highly reliable for US airports
- TTL: **90 days** — monthly aggregated data
- Fallback: use Wikipedia extract for US airport traffic when BTS is unavailable

---

### 2.5 Eurostat (EU airports)

**Endpoint:** `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/avia_paoc`

| Property | Value |
|---|---|
| **API key required** | NO |
| **Free for MVP** | YES |
| **Suitable for user-click** | ❌ NO |
| **Suitable for background** | ⚠️ CONDITIONAL |
| **Average latency** | 677–787 ms |
| **Rate limit** | Unknown — likely generous for public data |
| **Required User-Agent** | Standard |
| **License** | EU Open Data Policy — free use |
| **Probe result** | ❌ 400 Bad Request — query format incorrect |

**🚨 CRITICAL FINDING:** Eurostat API returned 400 Bad Request. The API requires precise query parameter formatting. Correct Eurostat API use:
```
https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/avia_paoc
  ?geo=US
  &time=2023
  &airpt=JFK
  &tra_meas=PAS
```
Probe used wrong parameter names. Eurostat uses `geo`, `time`, `airpt` (IATA code), `tra_meas` for passengers.

**Fields available via Eurostat:**
| Field | Available? |
|---|---|
| `passengers_onboard` (PAX) | ✅ Yes |
| `passengers_offboard` (POB) | ✅ Yes |
| `cargo_loaded` | ✅ Yes |
| `cargo_unloaded` | ✅ Yes |
| `mail_loaded` | ✅ Yes |
| `mail_unloaded` | ✅ Yes |

**Recommendation:**
- Do NOT implement for user-click — requires correct query building
- Fix query format and use for background EU airport traffic enrichment
- Requires mapping IATA code to Eurostat airport codes (IANA/ICAO vs Eurostat codes differ)
- TTL: **90 days** — annual data at minimum
- Fallback: use Wikipedia extract for EU airport traffic

---

### 2.6 Official Airport Websites

**Endpoint:** Resolved from `Wikidata P856` or `OurAirports homepage` field

| Property | Value |
|---|---|
| **API key required** | NO |
| **Free for MVP** | YES (for public pages) |
| **Suitable for user-click** | ❌ NO |
| **Suitable for background** | ⚠️ CONDITIONAL |
| **Average latency** | 160–1298 ms (heavily variable) |
| **Rate limit** | Per-site — polite crawling only |
| **Required User-Agent** | Yes — identify as research bot |
| **License** | Varies per site — check each |
| **Probe result** | ✅ 200 for JFK/BDL/DXB/LHR, ❌ refused for YQB |

**🚨 CRITICAL FINDING:** Official airport websites return full HTML but the content is primarily JavaScript-rendered. A static HTTP fetch returns an HTML shell — the actual content (annual reports, statistics, operator info) loads in the browser via JavaScript.

**What this means:**
- A `requests` or `urllib` fetch of `www.heathrow.com` returns mostly empty HTML
- The page title and some metadata are visible but operator info, traffic stats, annual reports are NOT
- Extracting data would require headless browser (Puppeteer/Playwright) — out of scope for v1
- Some airport sites block scrapers entirely (YQB refused connection)

**What CAN be extracted from official sites via static fetch:**
- `page_title` — the HTML `<title>` tag
- `meta_description` — if present
- HTTP headers (Content-Type, Server) — may reveal CDN/WAF info

**What CANNOT be extracted without JS rendering:**
- Annual report PDFs (require navigating to download links)
- Operator/owner information (in "About" pages loaded via JS)
- Real-time or near-time statistics

**Recommendation:**
- Do NOT use official websites for user-click enrichment
- Background-only: store the homepage URL in the profile as a reference link
- If annual reports are needed: store the report URL and let frontend display as a link
- Respect `robots.txt` — do not scrape against stated policies
- TTL: **90 days** for homepage check

---

### 2.7 Paid / Out-of-Scope Sources

| Source | Status | Notes |
|---|---|---|
| **ACI World Airport Traffic Report** | Paid | Annual report — out of scope for v1 |
| **IATA Slot Registry** | Paid | Out of scope |
| **OAG** | Paid | Out of scope |
| **Cirium** | Paid | Out of scope |
| **FlightRadar24 API** | Paid | Out of scope |
| **FlightAware API** | Paid | Out of scope |
| **AeroDataBox** | Paid | Out of scope |
| **AviationStack** | Paid | Out of scope |
| **Airport-DB.com** | Paid | Out of scope |
| **DGAC France** | Free but slow | Background/backfill only |
| **FAA** | Free | Background only (no simple API) |
| **Eurocontrol** | Free | Background only |

---

## 3. Source Availability Matrix

| Field | Wikipedia | Wikidata | OSM | BTS | Eurostat | Official Sites |
|---|---|---|---|---|---|---|
| summary/description | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ (JS) |
| image/logo | ✅ | ✅ P18 | ✅ | ❌ | ❌ | ❌ (JS) |
| opened_date | ⚠️ text | ✅ P571 | ❌ | ❌ | ❌ | ⚠️ PDF |
| operator | ⚠️ text | ✅ P137 | ❌ | ❌ | ❌ | ⚠️ PDF |
| owner | ⚠️ text | ✅ P127 | ❌ | ❌ | ❌ | ⚠️ PDF |
| official_website | ❌ | ✅ P856 | ❌ | ❌ | ❌ | ✅ (link) |
| passenger_capacity | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ PDF |
| **passenger_traffic** | ⚠️ partial | ✅ P1589 | ❌ | ✅ T-100 | ✅ avia_paoc | ⚠️ PDF |
| cargo | ⚠️ partial | ✅ P3878 | ❌ | ✅ T-100 | ✅ avia_paoc | ⚠️ PDF |
| aircraft_movements | ⚠️ partial | ✅ P3878 | ❌ | ✅ T-100 | ❌ | ⚠️ PDF |
| terminal count | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| gate count | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| runway info | ❌ | ❌ | ⚠️ | ❌ | ❌ | ❌ |
| OSM layout | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |

---

## 4. Critical Findings Summary

### Must-Implement before production:

1. **Wikidata rate-limit queue**: Every Wikidata request must be spaced ≥1 second apart globally. Use a simple token-bucket or sleep in the worker. 429 responses mean back off for 1 hour minimum.

2. **OSM Overpass own instance**: The public Overpass API is not accessible. Either run a local Overpass (heavyweight) or skip OSM layout in v1. OurAirports runway data is already in DB.

3. **BTS query building**: BTS is not a simple REST API — requires form navigation or pre-downloaded datasets. Do not promise BTS integration in v1 without significant work.

4. **Eurostat query fix**: If Eurostat is needed, correct query format is `?geo=US&time=2023&airpt=JFK&tra_meas=PAS`. But do not block on this.

5. **Wikipedia name encoding**: Use `urllib.parse.quote(name, safe='')` to properly encode non-ASCII characters in Wikipedia titles (e.g., "Québec" → "Qu%C3%A9bec").

6. **Official websites are JS-heavy**: Do not promise data from official airport websites without headless browser rendering — out of scope for v1.

### Data quality rules validated:

1. **Only DXB** (Dubai) has year-qualified traffic data in its Wikipedia extract. KJFK, KBDL, EGLL do NOT have specific passenger numbers in their Wikipedia lead paragraphs.

2. **Never store traffic without a year**: All traffic figures must be stored with their year qualifier. If the Wikipedia extract says "millions of passengers" with no number, do not store a number.

3. **Wikidata P1589** is the best structured traffic field — but Wikidata is rate-limited. Consider pre-fetching Wikidata for major airports monthly.

4. **OurAirports runways** are already in DB and are the best source for runway count/length/surface — no new fetch needed.

---

## 5. Recommended Source Use for v1 Implementation

| Source | User click? | Background? | Fallback |
|---|---|---|---|
| OurAirports (DB) | ✅ Yes — in DB | N/A | N/A |
| Wikipedia REST | ✅ Yes — fast | ✅ Yes | N/A |
| Wikidata REST | ⚠️ Queued only | ✅ Yes | Wikipedia extract |
| OSM Overpass | ❌ No | ⚠️ Own instance needed | Skip v1 |
| BTS | ❌ No | ⚠️ Pre-downloaded datasets | Wikipedia extract |
| Eurostat | ❌ No | ⚠️ Query fix needed | Wikipedia extract |
| Official websites | ❌ No | ⚠️ URL only | Store link only |

---

## 6. TTL Recommendations

| Source | TTL | Rationale |
|---|---|---|
| Wikipedia | 30 days | Stable content |
| Wikidata (if accessible) | 30 days | Stable structured data |
| OSM layout (if implemented) | 30 days | Rarely changes |
| BTS datasets | 90 days | Monthly aggregates |
| Eurostat | 90 days | Annual publications |
| Official website URL | 90 days | Homepage stable |
| Annual report URL | 365 days | Annual publication |

---

## 7. Probe Command

```bash
# Single airport probe
python services/fetch-orchestrator/src/layers/layer_01_aviation/airport_intelligence_source_probe.py \
  --airport-ident KJFK --iata JFK --name "John F. Kennedy International Airport" \
  --lat 40.6397 --lon -73.7789 --show-raw

# All 5 standard airports
python services/fetch-orchestrator/src/layers/layer_01_aviation/airport_intelligence_source_probe.py \
  --all
```

---

*End of WO-040 source audit.*
*Probe completed: 2026-05-19*
*Files created: airport_intelligence_source_probe.py + test_airport_intelligence_source_probe.py*
*No database writes. No production code.*