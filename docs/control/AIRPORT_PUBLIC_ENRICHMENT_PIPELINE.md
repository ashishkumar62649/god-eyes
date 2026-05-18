# AIRPORT_PUBLIC_ENRICHMENT_PIPELINE.md

WO-032G — Airport Public Facts / Wikipedia-Wikidata Enrichment Design
Layer: `layer_01_aviation`
Status: Canonical design document for WO-032 enrichment pipeline. No production code. No migrations. No API routes.
Author: Kiro CLI (Claude Sonnet 4.6) + WO-032G alignment
Created: 2026-05-17T22:52:49Z
Updated: 2026-05-18

---

## Canonical Decisions for WO-032 Implementation

This section is the authoritative registry of all binding decisions for the
WO-032 airport public enrichment pipeline. All agents must implement these
decisions exactly. No deviation is permitted without a Kiro CLI work order
amendment.

| Decision | Value |
|---|---|
| **Canonical endpoint** | `GET /api/airports/:airportId/public-profile` |
| **Canonical cache TTL** | 30 days |
| **Canonical source list (v1)** | English Wikipedia (REST API), Wikidata (REST/SPARQL) |
| **Canonical status names** | `ok`, `stale`, `fetching`, `no_profile_found`, `low_confidence_match`, `error` |
| **Canonical attribution** | Wikipedia content requires CC BY-SA 4.0 attribution displayed in UI |
| **Canonical no-paid-API rule** | Zero commercial APIs. No FlightAware, FlightRadar24, OAG, Cirium, or similar |
| **Canonical no-full-Wikipedia-page rule** | Only summary extract and short description stored. No HTML, wikitext, or full page |
| **Canonical implementation order** | WO-032B → WO-032C → WO-032D → WO-032E → WO-032F |

### Canonical Decisions Detail

**Canonical endpoint**
All client requests for airport public profiles MUST use `GET /api/airports/:airportId/public-profile`.
No alternative paths are permitted. The frontend MUST NOT call Wikipedia,
Wikidata, or any third-party API directly.

**Canonical cache TTL**
All successful profile fetches expire 30 days after `fetched_at`.
The `expires_at` column MUST be set to `fetched_at + INTERVAL '30 days'`.
The 30-day TTL applies to all profile states including `no_profile_found` and
`low_confidence_match` sentinels.

**Canonical source list (v1)**
Only two sources are permitted for v1:
1. English Wikipedia via `https://en.wikipedia.org/api/rest_v1/page/summary/{title}` — provides `extract`, `description`, `thumbnail`, `content_urls`
2. Wikidata via `https://www.wikidata.org/wiki/Special:EntityData/{QID}.json` or SPARQL — provides structured facts (P571, P137, P127, P856, P18, P239, P238, P625)

No other sources are permitted in v1. OpenSky, OurAirports (beyond identity linkage), and any commercial provider are explicitly out of scope.

**Canonical status names**
The `status` field in all API responses MUST use one of these exact values:
- `ok` — cached profile returned, not yet stale
- `stale` — cached profile returned but past expiry, background refresh queued
- `fetching` — no profile, fetch job is queued or in progress
- `no_profile_found` — fetch attempted, no Wikipedia or Wikidata match found
- `low_confidence_match` — match found but confidence too low to display facts
- `error` — fetch failed after all retries

**Canonical attribution requirements**
When Wikipedia content (`summary`, `short_description`, `imageUrl`) is displayed
in the frontend, the UI MUST render a visible attribution line:
"Source: Wikipedia (CC BY-SA 4.0) · Wikidata (CC0)"
Both "Wikipedia" and "Wikidata" must be hyperlinks to the source article/entity.
This is a hard requirement for CC BY-SA 4.0 compliance. No exceptions.

**Canonical no-paid-API rule**
This pipeline is prohibited from calling any commercial, rate-limited, or
API-key-gated service. This includes but is not limited to: FlightAware,
FlightRadar24, OAG, Cirium, AeroDataBox, aviationstack, airport-db, and any
similar paid data provider. The pipeline must function with zero API keys.

**Canonical no-full-Wikipedia-page rule**
The `airport_public_profiles` table MUST NOT contain full Wikipedia HTML,
wikitext, or the complete article body. Only the following Wikipedia-derived
fields are stored: `summary`, `short_description`, `wikipedia_title`,
`wikipedia_url`, `wikipedia_revision_id`, `wikipedia_page_id`, `thumbnail`.

**Canonical implementation order**
The work orders must be executed in this exact sequence because each is
dependent on the prior deliverable being in place:
1. **WO-032B** (Codex) — Database schema: tables, columns, indexes
2. **WO-032C** (Claude/API) — API endpoint: lazy cache logic, response shapes
3. **WO-032D** (Codex) — Fetcher/normalizer: Wikipedia/Wikidata fetch, normalization
4. **WO-032E** (Gemini/frontend) — Frontend: Object Intel panel section
5. **WO-032F** (Kiro) — Integration review: compliance check, push to remote

---

## 1. Objective

Airport public facts enrichment adds publicly available background information
to aviation objects in GOD EYES. When a user clicks an airport, the Object Intel
panel can show a plain-language summary, notable facts, operator/owner, opening
date, official website, and attribution links — all sourced from open data.

This enrichment is **not**:

- Live flight schedules or departure/arrival boards.
- Real-time passenger counts or throughput statistics.
- NOTAM, METAR, TAF, or any operational aviation status.
- Paid commercial data from FlightAware, FlightRadar24, OAG, or similar.
- AI-generated facts stored as ground truth.

The goal is to give every one of the 85,377 aviation objects in the aviation
layer a richer public identity card, sourced entirely from free and open data,
fetched lazily on demand, cached in our database, and served from cache on
subsequent requests.

---

## 2. Data Sources

### 2.1 OurAirports — Identity and Base Source

OurAirports is and remains the authoritative identity source for all aviation
objects. It provides `ident` (ICAO), `iata_code`, `gps_code`, `name`,
`municipality`, `iso_country`, `latitude_deg`, `longitude_deg`, and critically
a `wikipedia_link` field that directly links many airports to their Wikipedia
article. This link is the highest-confidence starting point for enrichment.

OurAirports data is already normalized and stored in our database. No new
fetching from OurAirports is required for this pipeline.

### 2.2 English Wikipedia — Public Summaries

Wikipedia provides free plain-text summaries of airports via the
**Wikimedia REST API** (no API key required):

```
GET https://en.wikipedia.org/api/rest_v1/page/summary/{title}
```

This endpoint returns a `extract` (plain-text summary), `description`
(short one-line description), `thumbnail` (image URL), `content_urls`
(canonical page URL), and `revision` / `tid` identifiers for version tracking.

We store only the summary extract and short description. We do not store the
full Wikipedia page HTML or wikitext.

Attribution requirement: Wikipedia content is licensed under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Any display
of Wikipedia content must include attribution to Wikipedia and a link to the
source article. The `source_attribution_json` field stores this.

### 2.3 Wikidata — Structured Facts

Wikidata provides machine-readable structured facts via the
**Wikidata REST API** (no API key required):

```
GET https://www.wikidata.org/wiki/Special:EntityData/{QID}.json
```

Or via SPARQL for targeted property lookups:

```
GET https://query.wikidata.org/sparql?query=...&format=json
```

Useful Wikidata properties for airports:

| Property | Meaning |
|---|---|
| P571 | inception / opened date |
| P137 | operator |
| P127 | owned by |
| P856 | official website |
| P18 | image |
| P239 | ICAO airport code |
| P238 | IATA airport code |
| P625 | coordinate location (sanity check) |

Wikidata content is licensed under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) — no attribution
required, but we store source metadata for traceability.

### 2.4 No Paid APIs

This pipeline uses only free, open, unauthenticated public APIs. No API keys
are required or permitted. No commercial data providers (FlightAware,
FlightRadar24, OAG, Cirium, etc.) are used.

### 2.5 OpenSky — Out of Scope for This Work Order

OpenSky Network provides live aircraft position data. It is a candidate for a
future "live aircraft nearby" feature. It is **not** part of this work order
and must not be fetched in this pipeline.

---

## 3. Lazy Fetch Behavior

Public profiles are fetched on demand, not pre-fetched for all 85,377 airports.
This avoids hammering Wikimedia/Wikidata APIs and keeps infrastructure costs
near zero for airports that are never clicked.

### 3.1 Runtime Flow

```
User clicks airport in GOD EYES
  → Frontend calls: GET /api/airports/:airportId/public-profile
  → API checks airport_public_profiles table

  CASE: Profile exists AND expires_at > now()
    → Return cached profile immediately (cache hit)

  CASE: Profile does not exist
    → Return 202 Accepted with { status: "fetching" }
    → Queue background fetch job for this airport
    → Fetcher calls Wikimedia REST API and/or Wikidata API
    → Fetcher normalizes response into profile fields
    → Fetcher saves profile to airport_public_profiles
    → Fetcher saves snapshot to airport_public_profile_versions
    → Fetcher saves run metadata to airport_public_profile_fetch_runs
    → Frontend polls or waits for profile to become available

  CASE: Profile exists AND expires_at <= now() (stale)
    → Return stale cached profile immediately (stale-while-revalidate)
    → Queue background refresh job (if not already queued)
    → On next request after refresh completes, return fresh profile

  CASE: Fetch attempted but no Wikipedia/Wikidata match found
    → Save a "no profile" sentinel record with fetch metadata
    → Return { status: "no_profile_found" }
    → Do not re-fetch for 30 days (same TTL as a successful profile)

  CASE: Fetch attempted but confidence is low
    → Save a "low confidence" sentinel record
    → Return { status: "low_confidence_match" }
    → Do not save unconfirmed facts as airport truth
```

### 3.2 Deduplication

If two users click the same airport within seconds of each other while a fetch
is in progress, the second request must not trigger a second fetch. The
`airport_public_profile_fetch_runs` table tracks in-progress fetches. Before
queuing a fetch, the API checks for an active run for that airport. If one
exists, the second request returns `{ status: "fetching" }` and waits.

---

## 4. Cache Policy

| Parameter | Value |
|---|---|
| Cache TTL | 30 days |
| Stale-while-revalidate | Yes — return stale immediately, refresh in background |
| Fetch on every click | No — only fetch when missing or expired |
| Delete old versions | No — keep all versions for history |
| Store fetch errors | Yes — in `airport_public_profile_fetch_runs` |
| Duplicate fetch prevention | Yes — check for active run before queuing |

### 4.1 TTL Rationale

Wikipedia airport articles change infrequently. A 30-day TTL balances
freshness against API load. For 85,377 airports, even if all were cached, the
maximum refresh load would be ~2,845 fetches per day spread across the month —
well within Wikimedia's rate limits.

### 4.2 Stale-While-Revalidate

When a profile is stale, the user receives the cached data immediately with no
perceived latency. The background refresh runs asynchronously. The user sees
a `fetched_at` timestamp so they know the data age. This pattern avoids
blocking the UI on a network fetch to a third-party API.

### 4.3 No Deletion Policy

Old profile versions are never deleted. This supports future AI analysis of
how airport descriptions, operators, and facts change over time. Storage cost
is low because we store summaries, not full pages.

---

## 5. Data We Store

The `airport_public_profiles` table stores one current profile per airport.
Fields are designed to be sparse — most will be null for small airfields.

| Field | Type | Description |
|---|---|---|
| `airport_id` | integer | FK to our aviation objects table |
| `icao_code` | text | ICAO ident at time of fetch (for traceability) |
| `iata_code` | text | IATA code at time of fetch |
| `wikipedia_title` | text | Exact Wikipedia page title used |
| `wikipedia_url` | text | Canonical Wikipedia article URL |
| `wikidata_qid` | text | Wikidata entity ID, e.g. `Q123456` |
| `summary` | text | Plain-text extract from Wikipedia (max ~500 chars) |
| `short_description` | text | One-line description from Wikipedia |
| `interesting_facts_json` | jsonb | Array of notable facts extracted from Wikidata or summary |
| `opened_date` | text | Inception/opening date (P571), stored as text to handle partial dates |
| `operator` | text | Airport operator (P137) |
| `owner` | text | Airport owner (P127) |
| `official_website` | text | Official website URL (P856) |
| `image_url` | text | Thumbnail image URL from Wikipedia or Wikidata P18 |
| `source_attribution_json` | jsonb | Attribution metadata: source name, license, URL, retrieved date |
| `match_method` | text | How the Wikipedia/Wikidata match was found (see Section 7) |
| `match_confidence` | text | `high`, `medium`, `low`, or `none` |
| `fetch_status` | text | `ok`, `no_profile_found`, `low_confidence`, `error` |
| `fetched_at` | timestamptz | When this profile was last successfully fetched |
| `expires_at` | timestamptz | When this profile should be refreshed (fetched_at + 30 days) |
| `wikipedia_revision_id` | bigint | Wikipedia page revision ID at time of fetch |
| `wikipedia_page_id` | bigint | Wikipedia page ID (stable across renames) |
| `wikidata_last_modified` | timestamptz | Wikidata entity last-modified timestamp |
| `change_hash` | text | SHA-256 of key fields; used to detect meaningful changes between versions |
| `raw_snapshot_pointer` | text | Optional path to raw API response in object storage (not in main table) |

### 5.1 interesting_facts_json Shape

```json
[
  { "fact": "Opened in 1960", "source": "wikidata", "property": "P571" },
  { "fact": "Operated by Dubai Airports", "source": "wikidata", "property": "P137" }
]
```

### 5.2 source_attribution_json Shape

```json
{
  "wikipedia": {
    "title": "Dubai International Airport",
    "url": "https://en.wikipedia.org/wiki/Dubai_International_Airport",
    "license": "CC BY-SA 4.0",
    "license_url": "https://creativecommons.org/licenses/by-sa/4.0/",
    "retrieved_at": "2026-05-17T22:52:49Z",
    "revision_id": 1234567890
  },
  "wikidata": {
    "qid": "Q44426",
    "url": "https://www.wikidata.org/wiki/Q44426",
    "license": "CC0 1.0",
    "retrieved_at": "2026-05-17T22:52:49Z"
  }
}
```

---

## 6. Data We Do Not Store

- Full Wikipedia page HTML or wikitext.
- Large raw API dumps in the main `airport_public_profiles` table. Raw
  responses may be stored in object storage (S3/R2) with a pointer, but never
  inline in the profile row.
- Paid or commercial flight schedule data.
- Exact real-time passenger counts or throughput statistics.
- AI-generated facts presented as stored ground truth. If AI summarization is
  used in a future version, the summary must be clearly labeled as AI-generated
  and stored separately from source-attributed facts.
- Personal data or PII of any kind.
- Content from non-English Wikipedia in the first version.

---

## 7. Matching Strategy

Matching an airport to its Wikipedia/Wikidata entity is the most error-prone
step. A wrong match is worse than no match. The pipeline uses a priority chain
and assigns a confidence score.

### 7.1 Match Priority

1. **OurAirports `wikipedia_link`** — If the OurAirports record has a
   `wikipedia_link`, extract the page title from the URL and use it directly.
   This is the highest-confidence path. Confidence: `high`.

2. **Wikidata ICAO code lookup** — Query Wikidata SPARQL for entities where
   P239 (ICAO airport code) equals our `ident`. If exactly one result is
   returned, use it. Confidence: `high`.

3. **Wikidata IATA code lookup** — Query Wikidata SPARQL for entities where
   P238 (IATA airport code) equals our `iata_code`. Only use if `iata_code` is
   present and the result is unique. Confidence: `high`.

4. **Wikipedia title search** — Search Wikipedia for
   `{airport name} airport {country}`. Use only if the top result's title
   closely matches and the article's coordinates (from Wikidata P625) are
   within 50 km of our airport coordinates. Confidence: `medium`.

5. **Coordinate proximity + name similarity** — If a Wikidata SPARQL query
   returns multiple candidates, rank by coordinate distance and name similarity
   score. Use only the top candidate if its score exceeds a threshold.
   Confidence: `medium` if score is high, `low` if borderline.

6. **No match** — If no candidate passes the confidence threshold, record
   `fetch_status = 'no_profile_found'` and `match_confidence = 'none'`.
   Do not save unverified facts.

### 7.2 Coordinate Sanity Check

For any match found via methods 4 or 5, verify that the Wikipedia/Wikidata
entity's coordinate location (P625) is within 50 km of our airport's
`latitude_deg` / `longitude_deg`. If the distance exceeds 50 km, downgrade
confidence to `low` and do not save as confirmed.

### 7.3 Low Confidence Behavior

If `match_confidence` is `low`:
- Save the fetch run record with confidence and reason.
- Do not populate `summary`, `interesting_facts_json`, or other content fields.
- Return `{ status: "low_confidence_match" }` to the frontend.
- Frontend shows "No public profile found" fallback.
- Retry after 30 days in case source data improves.

---

## 8. Database Design Proposal

This section proposes table structures. No migrations are created here.
Codex owns schema implementation in WO-032B.

### 8.1 `airport_public_profiles`

**Purpose:** Stores the current enriched public profile for each airport.
One row per airport. Upserted on each successful fetch.

**Recommended columns:** All fields listed in Section 5.

**Indexing ideas:**
- Primary key on `airport_id`.
- Index on `expires_at` for the background refresh job to find stale profiles.
- Index on `fetch_status` to quickly find airports with errors or no profile.
- Index on `wikidata_qid` for deduplication checks.

**Why it helps future AI:** The current profile is the fast-path read for the
API. Keeping `change_hash`, `fetched_at`, and `match_confidence` here lets
future AI quickly assess data quality without scanning the versions table.

### 8.2 `airport_public_profile_versions`

**Purpose:** Stores every historical snapshot of a profile. One row per fetch
that produced a changed profile (detected via `change_hash` diff). Never
deleted.

**Recommended columns:**
- `id` — serial primary key
- `airport_id` — FK to aviation objects
- `version_number` — incrementing integer per airport
- `change_hash` — hash of this version's content
- `summary` — snapshot of summary at this version
- `interesting_facts_json` — snapshot of facts
- `opened_date`, `operator`, `owner`, `official_website`, `image_url`
- `wikipedia_revision_id`, `wikidata_last_modified`
- `source_attribution_json`
- `match_method`, `match_confidence`
- `fetched_at` — when this version was captured
- `diff_summary` — optional text describing what changed from previous version

**Indexing ideas:**
- Index on `(airport_id, fetched_at DESC)` for history queries.
- Index on `change_hash` to detect duplicate snapshots.

**Why it helps future AI:** A complete version history lets future AI models
analyze how airport descriptions, operators, and facts evolve over time. The
`diff_summary` field can be populated by a future AI enrichment step.

### 8.3 `airport_public_profile_fetch_runs`

**Purpose:** Tracks every fetch attempt, including failures, in-progress runs,
and no-match results. Used for deduplication, error monitoring, and retry logic.

**Recommended columns:**
- `id` — serial primary key
- `airport_id` — FK to aviation objects
- `status` — `in_progress`, `ok`, `no_profile_found`, `low_confidence`, `error`
- `match_method` — which matching strategy was used
- `match_confidence` — confidence level of the match
- `error_message` — error detail if status is `error`
- `wikipedia_url_tried` — URL attempted
- `wikidata_qid_tried` — QID attempted
- `started_at` — when the fetch job started
- `completed_at` — when the fetch job finished
- `duration_ms` — fetch duration for performance monitoring
- `http_status_wikipedia` — HTTP status code from Wikipedia API
- `http_status_wikidata` — HTTP status code from Wikidata API
- `triggered_by` — `user_click`, `background_refresh`, `admin_manual`

**Indexing ideas:**
- Index on `(airport_id, started_at DESC)` for recent run lookups.
- Index on `status = 'in_progress'` for deduplication checks.
- Index on `started_at` for monitoring dashboards.

**Why it helps future AI:** Fetch run history lets future AI identify airports
that consistently fail to match, airports with frequent data changes, and
patterns in API reliability over time.

---

## 9. API Design Proposal

This section proposes endpoint shapes. No API code is created here.
Claude/API owns implementation in WO-032C.

### 9.1 Endpoints

#### GET /api/airports/:airportId/public-profile

Returns the public enrichment profile for a single airport.

**Cache hit response (200):**
```json
{
  "status": "ok",
  "cached": true,
  "profile": {
    "airportId": 5235,
    "icaoCode": "OMDB",
    "iataCode": "DXB",
    "wikipediaTitle": "Dubai International Airport",
    "wikipediaUrl": "https://en.wikipedia.org/wiki/Dubai_International_Airport",
    "wikidataQid": "Q44426",
    "summary": "Dubai International Airport is the primary international airport...",
    "shortDescription": "International airport serving Dubai, UAE",
    "interestingFacts": [
      { "fact": "Opened in 1960", "source": "wikidata" },
      { "fact": "Operated by Dubai Airports", "source": "wikidata" }
    ],
    "openedDate": "1960",
    "operator": "Dubai Airports",
    "owner": null,
    "officialWebsite": "https://www.dubaiairports.ae",
    "imageUrl": "https://upload.wikimedia.org/...",
    "matchMethod": "ourairports_wikipedia_link",
    "matchConfidence": "high",
    "fetchedAt": "2026-05-17T22:52:49Z",
    "expiresAt": "2026-06-16T22:52:49Z",
    "attribution": {
      "wikipedia": {
        "title": "Dubai International Airport",
        "url": "https://en.wikipedia.org/wiki/Dubai_International_Airport",
        "license": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/"
      },
      "wikidata": {
        "qid": "Q44426",
        "url": "https://www.wikidata.org/wiki/Q44426",
        "license": "CC0 1.0"
      }
    }
  }
}
```

**Cache miss response (202) — fetch queued:**
```json
{
  "status": "fetching",
  "cached": false,
  "message": "Public profile is being fetched. Please retry in a few seconds."
}
```

**Stale cache response (200) — returns stale data, refresh queued:**
```json
{
  "status": "stale",
  "cached": true,
  "profile": { "...same shape as cache hit..." },
  "message": "Profile data is being refreshed in the background."
}
```

**No profile found response (200):**
```json
{
  "status": "no_profile_found",
  "cached": false,
  "message": "No public profile is available for this airport."
}
```

**Low confidence match response (200):**
```json
{
  "status": "low_confidence_match",
  "cached": false,
  "message": "A Wikipedia match was found but confidence is too low to display."
}
```

**Error response (500):**
```json
{
  "status": "error",
  "message": "Failed to fetch public profile. Please try again later."
}
```

#### POST /api/airports/:airportId/public-profile/refresh

Admin-only endpoint to force a refresh of a specific airport's profile,
bypassing the TTL. Intended for manual correction of bad matches or stale data.
Requires admin authentication. Not exposed to regular users.

Returns `202 Accepted` with `{ "status": "refresh_queued" }`.

### 9.2 Response Shape Notes

- The `profile` object is flat for easy frontend consumption.
- `interestingFacts` is an array, not a nested object, so the frontend can
  render it as a list without parsing.
- `attribution` is always present when `status` is `ok` or `stale`, to ensure
  CC BY-SA 4.0 compliance for Wikipedia content.
- `fetchedAt` and `expiresAt` are always ISO 8601 UTC strings.
- Null fields are included in the response (not omitted) so the frontend can
  render appropriate empty states without defensive null checks on every field.

---

## 10. Frontend Behavior Proposal

This section proposes Object Intel panel behavior. No frontend code is created
here. Gemini/frontend owns implementation in WO-032E.

### 10.1 Public Profile Section in Object Intel

The public profile section should appear below the existing airport identity
fields (name, ident, IATA, category, location) and above the technical/source
details section.

**When status is `ok` or `stale`:**

Show a "Public Profile" section containing:

| Field | Label | Notes |
|---|---|---|
| `summary` | Public Summary | Paragraph text. Truncate at ~300 chars with "Read more" link to Wikipedia. |
| `interestingFacts` | Interesting Facts | Bulleted list. Show max 5 facts. |
| `openedDate` | Opened / Built | Omit if null. |
| `operator` | Operator | Omit if null. |
| `owner` | Owner | Omit if null and operator is shown. |
| `officialWebsite` | Official Website | Render as clickable link. |
| `imageUrl` | — | Optional thumbnail. Show only if present. |
| `fetchedAt` | Last updated | Show as relative time, e.g. "3 days ago". |
| `attribution` | Source | Show "Wikipedia" and "Wikidata" as links. Required for CC BY-SA 4.0. |

If `status` is `stale`, show a subtle "Refreshing..." indicator but do not
block the display of existing data.

**When status is `fetching`:**

Show a loading skeleton or spinner in the Public Profile section with text:
"Loading public profile…"

Frontend should poll `GET /api/airports/:airportId/public-profile` every 3
seconds, up to 5 retries, then show the "no profile" fallback if still fetching.

**When status is `no_profile_found` or `low_confidence_match`:**

Show a calm fallback message:
> "No public profile is available for this airport."

Do not show an error state. This is normal for small airfields and heliports.

**When status is `error`:**

Show a non-alarming message:
> "Public profile could not be loaded. Try again later."

### 10.2 Attribution Display

Wikipedia content requires visible attribution. The attribution line must
always appear when Wikipedia content is shown:

```
Source: Wikipedia (CC BY-SA 4.0) · Wikidata (CC0)
```

Both "Wikipedia" and "Wikidata" should be hyperlinks to the source article/entity.

---

## 11. AI Future Use

The design choices in this pipeline are intentionally AI-friendly for future
intelligence analysis.

### 11.1 Version History

`airport_public_profile_versions` stores every meaningful change to an
airport's public profile. A future AI model can query this table to answer:
- "When did this airport change operators?"
- "Which airports have had the most description changes in the last year?"
- "What airports opened between 1950 and 1970?"

### 11.2 Source Attribution

`source_attribution_json` records exactly which Wikipedia revision and Wikidata
state was used for each profile. A future AI can cross-reference Wikipedia
revision IDs against Wikipedia's own edit history to understand what changed
and why.

### 11.3 change_hash

The `change_hash` field (SHA-256 of key content fields) lets the pipeline
detect whether a new fetch actually changed anything meaningful. This prevents
version table bloat from re-fetches that return identical content. It also
gives future AI a fast way to identify airports with high change frequency.

### 11.4 fetched_at Timestamps

Every profile and version row carries a `fetched_at` timestamp. Future AI can
build a timeline of when information was known, not just what the current state
is. This is important for historical analysis and for understanding data lag.

### 11.5 Profile Snapshots

`raw_snapshot_pointer` optionally points to the full raw API response stored in
object storage. Future AI models that need richer context than the normalized
fields can retrieve the original source response without re-fetching from
Wikipedia/Wikidata.

### 11.6 match_confidence and match_method

These fields let future AI identify which airports have uncertain enrichment
and prioritize them for manual review or improved matching algorithms.

---

## 12. Performance and Safety

### 12.1 Wikimedia Rate Limiting

The Wikimedia REST API and Wikidata SPARQL endpoint are free but rate-limited.
Wikimedia's policy requires:

- A descriptive `User-Agent` header identifying the application and contact:
  ```
  User-Agent: GOD-EYES/1.0 (https://github.com/your-org/god-eyes; contact@example.com)
  ```
- No more than ~200 requests per second to the REST API.
- SPARQL queries should be lightweight and targeted, not full-table scans.

Our lazy fetch model naturally limits load: we only fetch when a user clicks
an airport and the profile is missing or expired. At typical usage volumes,
this will be far below Wikimedia's limits.

### 12.2 Timeout and Retry Policy

| Parameter | Value |
|---|---|
| HTTP timeout per request | 10 seconds |
| Max retries on timeout/5xx | 2 retries with exponential backoff |
| Backoff base | 1 second, doubling each retry |
| Max total fetch time | ~30 seconds before marking as error |
| On persistent error | Save `fetch_status = 'error'`, return error response |

Do not retry on 404 (page not found) or 429 (rate limited without Retry-After).
On 429 with `Retry-After`, respect the header and retry after the specified delay.

### 12.3 Monthly Refresh

Profiles expire after 30 days (`expires_at = fetched_at + 30 days`). Refresh
is triggered lazily on the next user click after expiry (stale-while-revalidate).
A future background job (WO-032D scope) can proactively refresh high-traffic
airports before they expire, but this is not required for v1.

### 12.4 Stale-While-Revalidate

The stale-while-revalidate pattern ensures users never wait for a third-party
API call. Stale data is returned immediately. The background refresh is
fire-and-forget from the user's perspective.

### 12.5 Duplicate Fetch Prevention

Before queuing a fetch job, the API checks `airport_public_profile_fetch_runs`
for a row with `status = 'in_progress'` and `airport_id = :airportId`. If one
exists and `started_at` is within the last 5 minutes, no new job is queued.
This prevents thundering-herd problems when many users click the same airport
simultaneously (e.g., a major hub during a news event).

### 12.6 Safe Failure Behavior

If Wikipedia or Wikidata is unreachable:
- The API returns the stale cached profile if one exists.
- If no profile exists, the API returns `{ status: "no_profile_found" }`.
- The fetch run is recorded as `error` with the HTTP status and error message.
- The frontend shows the calm fallback message, not an error state.
- The system does not retry indefinitely. After 2 retries, the job is marked
  failed and will be retried on the next user click.

### 12.7 Future Background Queue

In v1, fetch jobs are triggered synchronously by the API and run in the
background. In a future version (WO-032D), a proper job queue (e.g., BullMQ,
pg-boss) should be used to:
- Limit concurrency to Wikimedia (e.g., max 5 concurrent fetches).
- Retry failed jobs with backoff.
- Schedule proactive monthly refreshes for high-traffic airports.
- Provide a monitoring dashboard for fetch health.

---

## 13. Work Order Breakdown

The following work orders implement this design. They must be executed in order
because each depends on the previous layer being in place.

### WO-032B — Database Schema for Airport Public Profile Cache

**Owner:** Codex
**Scope:** Create database migrations for:
- `airport_public_profiles` table
- `airport_public_profile_versions` table
- `airport_public_profile_fetch_runs` table

Follow the column and index proposals in Section 8 of this document.
No API code. No frontend code.

### WO-032C — API Lazy Cache Endpoint

**Owner:** Claude/API
**Scope:** Implement `GET /api/airports/:airportId/public-profile` and
`POST /api/airports/:airportId/public-profile/refresh` (admin only).
Follow the response shapes in Section 9 of this document.
Read from `airport_public_profiles`. Write fetch run records to
`airport_public_profile_fetch_runs`. Trigger background fetch when missing.
No fetcher implementation. No frontend code.

### WO-032D — Fetcher/Normalizer Implementation

**Owner:** Codex
**Scope:** Implement the Wikipedia/Wikidata fetcher and normalizer.
Follow the matching strategy in Section 7 and the stored fields in Section 5.
Implement the User-Agent, timeout, retry, and rate-limit policies in Section 12.
Write to `airport_public_profiles` and `airport_public_profile_versions`.
No API route changes. No frontend code.

### WO-032E — Frontend Object Intel Public Facts Section

**Owner:** Gemini/frontend
**Scope:** Add the Public Profile section to the Object Intel panel.
Consume `GET /api/airports/:airportId/public-profile` from the API.
Follow the display proposals in Section 10 of this document.
Implement loading state, stale indicator, no-profile fallback, and attribution.
No backend code. No database changes.

### WO-032F — Kiro Integration Review

**Owner:** Kiro CLI
**Scope:** Review all WO-032B through WO-032E deliverables for:
- Schema matches this design document.
- API response shapes match Section 9.
- Frontend consumes API only (no direct DB access).
- Attribution is displayed for Wikipedia content (CC BY-SA 4.0 compliance).
- No forbidden folders touched by any agent.
- No paid APIs introduced.
- All builds and tests pass.

---

*End of AIRPORT_PUBLIC_ENRICHMENT_PIPELINE.md*
*WO-032G — Canonical design complete. No production code created. No migrations created.*
*Ready for WO-032B (Codex — database schema).*
