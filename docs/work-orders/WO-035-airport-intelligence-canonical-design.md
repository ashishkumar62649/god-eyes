# WO-035 — Airport Intelligence Canonical Design

**Work order:** WO-035-G  
**Author:** Kiro (Main Guard / Architecture Owner)  
**Date:** 2026-05-19  
**Type:** Canonical design only — no implementation, no migrations, no code changes  
**Status:** CANONICAL — all implementation work orders must follow this document

---

## Purpose

This document is the single canonical reference for the Airport Intelligence
system. It resolves all open questions from the four research reports and makes
final decisions that implementation work orders must not override without a
design amendment.

Research inputs consumed:
- Qwen3: `API_AIRPORT_INTELLIGENCE_PLAN.md`
- Claude: `WO-035-claude-airport-intelligence-frontend-research.md`
- Codex: `AIRPORT_INTELLIGENCE_SCHEMA_PLAN.md`
- MiniMax: `WO-035-minimax-airport-intelligence-source-research.md`

---

## 1. Final Intelligence Sections

Seven canonical sections. All implementation must use these exact keys.

| Section key | Description | Source | Default open |
|---|---|---|---|
| `overview` | Name, codes, location, summary, image, opened date | OurAirports + Wikipedia/Wikidata (reuses public-profile cache) | Yes |
| `capability` | Capability badges, runway class, service tags | OurAirports runways + derived | Yes |
| `capacity` | Terminal count, gate count, runway count, longest runway, passenger/cargo design capacity | OurAirports runways + OSM + official sources | Yes if data exists |
| `traffic` | Annual passengers/movements/cargo with year labels, 5-year trend | Wikipedia extract + Wikidata P1589 + BTS/Eurostat | Yes if data exists |
| `infrastructure` | Runways, frequencies, navaids (existing sections) | `aviation_runways`, `aviation_navaids` tables | Closed |
| `sources` | Attribution, confidence, license, last-checked timestamps | Computed from all sections | Closed |
| `advanced_details` | Raw IDs, cache timestamps, source metadata, coordinates | Internal | Closed |

**Rule:** Never add an eighth section without a design amendment. Never rename
these keys in API responses or database columns.

---

## 2. Data Quality Rules

These rules are non-negotiable. Any implementation that violates them must be
rejected in review.

1. **Never guess passenger capacity.** If no authoritative source provides a
   number, the field is null. Do not estimate from runway count, gate count, or
   airport type.

2. **Never show passenger traffic without year and source.** Every traffic
   figure must be stored and displayed as `62.5M (2023, Wikipedia)` or
   equivalent. A bare number with no year is rejected.

3. **Never trust an IATA-only match without coordinate validation.** After any
   IATA-based Wikipedia or Wikidata lookup, verify that the matched entity's
   coordinates are within 50 km of the OurAirports coordinates. If the check
   fails, the match is rejected and confidence is set to `none`.

4. **If sources disagree, mark partial or low confidence.** When two sources
   provide different values for the same field (e.g., passenger count differs by
   more than 10%), store both values in metadata, expose the lower-confidence
   value with `confidence: low`, and set `low_confidence_reasons`.

5. **Never store uncertain numbers as truth.** Fields that cannot be verified
   must be null, not estimated. This applies to: passenger capacity, gate count,
   cargo capacity, operator, owner, slot coordination status, ILS category,
   runway declared distances.

6. **Never store full Wikipedia pages.** Only summary, short_description, and
   thumbnail are stored. The `extract` field is used for parsing only and is
   discarded after normalization.

7. **Never expose low-confidence data as authoritative.** Any section with
   `confidence_score < 0.5` must be marked `low_confidence` in the API response
   and shown with an amber warning in the frontend. The user must opt in to see
   the data.

---

## 3. Source Priority Order

### Fast path — allowed on user click (< 2 seconds)

1. **OurAirports DB** — identity, runways, coordinates, IATA/ICAO, homepage field. Already in DB. No fetch.
2. **Wikipedia REST API** — summary, extract (for traffic parsing), thumbnail. Already fetched in WO-032.
3. **Wikidata REST** — P1589 (passengers), P137 (operator), P127 (owner), P856 (website), P239 (ICAO), P238 (IATA). Already fetched in WO-032.

### Medium path — background fetch only (< 10 seconds)

4. **OSM Overpass API** — gate count, terminal count, runway geometry, apron count. Bounding-box scoped. Not on user click.
5. **BTS Transtats** — US annual passenger/movement statistics (T-100 dataset). Background only.
6. **Eurostat** — EU annual passenger/cargo statistics. Background only.

### Slow path — backfill only (no user waiting)

7. **Official airport websites** — homepage, annual report links. Background/backfill only. 90-day TTL.
8. **FAA / Eurocontrol** — US/ECAC official statistics. Background/backfill only.
9. **Annual reports (PDF)** — Store URL link only in v1. Do not parse PDFs in v1.

### Explicitly out of MVP

- IATA Slot Registry (paid)
- ACI World Airport Traffic Report (paid)
- FlightRadar24 / FlightAware (paid)
- OAG / Cirium (paid)
- ICAO paid statistics

**Rule:** No paid source may be added to the fetch pipeline without a design
amendment and explicit approval.

---

## 4. Source Licensing Rules

### OurAirports
- License: Creative Commons Attribution 4.0 (CC BY 4.0)
- Attribution required: "Data from OurAirports.com"
- Caching: Allowed. Store indefinitely.
- Display: Allowed without restriction.

### Wikipedia
- License: Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0)
- Attribution required: Link to Wikipedia article title.
- License link required: Link to CC BY-SA 4.0 license.
- Caching: Allowed. Store summary, short_description, thumbnail only.
- Display: Allowed with attribution and license link visible.
- **Do not store full article text.**

### Wikidata
- License: Creative Commons CC0 1.0 (public domain dedication)
- Attribution: Optional but recommended. "Data from Wikidata."
- Caching: Allowed. Store structured facts.
- Display: Allowed without restriction.

### OSM / Overpass
- License: Open Database License (ODbL) 1.0
- Attribution required: "© OpenStreetMap contributors"
- **ODbL policy decision (canonical):**
  - Gate counts, terminal counts, and geometry counts derived from OSM **may be
    cached internally** as derived statistics.
  - Raw OSM geometry (way coordinates, relation members) **must not be stored**
    in the database unless the entire derived dataset is published under ODbL.
  - Displaying derived counts (e.g., "~12 gates") with OSM attribution is
    allowed.
  - Displaying raw OSM geometry on a public map requires ODbL compliance for
    the full dataset.
  - For v1: store counts and bounding box only. Do not store raw OSM geometry.
  - If PostGIS geometry is added later, a separate ODbL compliance review is
    required before that data is exposed publicly.

### BTS (US Bureau of Transportation Statistics)
- License: US Government public domain
- Attribution: "Source: Bureau of Transportation Statistics, T-100 dataset"
- Caching: Allowed.
- Display: Allowed.

### Eurostat
- License: Creative Commons Attribution 4.0 (CC BY 4.0)
- Attribution: "Source: Eurostat"
- Caching: Allowed.
- Display: Allowed with attribution.

### Official airport websites
- License: Varies. Assume all rights reserved unless stated otherwise.
- Caching: Store URL link only. Do not cache page content.
- Display: Link to source only. Do not reproduce text.

### Annual reports
- License: Varies. Assume all rights reserved.
- v1 policy: Store URL link only. Do not parse or cache content.
- Display: Link to source only.

---

## 5. Rate Limits and Polite Fetching

### User-Agent requirement (mandatory for all HTTP fetches)

```
god-eyes/1.0 (https://github.com/anomalyco/god-eyes; god-eyes@example.com) <FetcherName>/1.0
```

Every fetcher must set this header. Requests without a User-Agent are rejected
in code review.

### Per-source timeout and retry policy

| Source | Timeout | Retries | Backoff | Max concurrent |
|---|---|---|---|---|
| Wikipedia REST | 10s | 2 | 1s base, exponential | 3 |
| Wikidata REST | 10s | 2 | 1s base, exponential | 3 |
| OSM Overpass | 15s | 1 | 5s fixed | 1 |
| BTS Transtats | 20s | 2 | 5s base, exponential | 1 |
| Eurostat | 20s | 2 | 5s base, exponential | 1 |
| Official websites | 15s | 1 | 10s fixed | 1 |

### OSM Overpass specific rules
- Maximum 1 concurrent Overpass request globally (not per worker).
- Minimum 2 seconds between Overpass requests.
- Bounding box must be ≤ 0.1 degree on each side (~11 km).
- If Overpass returns HTTP 429 or 503, back off for 60 seconds before retry.
- Production consideration: if Overpass rate limits become a problem, evaluate
  a self-hosted Overpass instance or a commercial OSM provider. This is a
  future decision, not v1.

### Background-only sources
The following sources must never be called on a user click:
- OSM Overpass
- BTS Transtats
- Eurostat
- Official airport websites
- FAA / Eurocontrol

### Backfill throttling
- Maximum 10 airports per minute during backfill.
- Minimum 6 seconds between airport fetches.
- Backfill must respect per-source concurrency limits above.
- Backfill must be pausable and resumable without data loss.

---

## 6. Observability

All workers and the API must emit the following metrics and logs.

### Metrics (counters and gauges)

| Metric | Type | Description |
|---|---|---|
| `intelligence.queue.depth` | Gauge | Current count of queued fetch_runs |
| `intelligence.jobs.completed` | Counter | Jobs completed successfully |
| `intelligence.jobs.failed` | Counter | Jobs failed |
| `intelligence.source.timeout.<source>` | Counter | Timeouts per source |
| `intelligence.fetch.duration_ms.<source>` | Histogram | Fetch duration per source |
| `intelligence.confidence.low_count` | Gauge | Modules with confidence < 0.5 |
| `intelligence.confidence.no_data_count` | Gauge | Modules with status no_data |
| `intelligence.modules.stale_count` | Gauge | Modules past stale_at |
| `intelligence.backfill.progress_pct` | Gauge | Backfill completion percentage |
| `intelligence.backfill.items_remaining` | Gauge | Backfill items not yet completed |

### Structured log fields (required on every fetch event)

```json
{
  "event": "fetch_completed|fetch_failed|fetch_timeout",
  "airport_id": "uuid",
  "airport_ident": "KJFK",
  "module_key": "capacity",
  "source": "osm",
  "duration_ms": 1234,
  "confidence_score": 0.75,
  "run_type": "click_fetch|scheduled_refresh|backfill",
  "error_code": null
}
```

### Alerting thresholds (recommended)
- Queue depth > 500: warning
- Job failure rate > 10% over 5 minutes: alert
- Any source timeout rate > 20% over 5 minutes: alert
- Backfill stalled (no progress for 30 minutes): alert

---

## 7. Freshness and TTL Strategy

TTLs are stored in `airport_intelligence_modules.cache_ttl_seconds` and must
not be hardcoded in application logic.

| Module | TTL | Stale-while-revalidate window | Reason |
|---|---|---|---|
| `overview` | 30 days | 15 days | Reuses public-profile cache TTL |
| `capability` | 30 days | 15 days | Runway/facility data changes slowly |
| `capacity` | 90 days | 30 days | Terminal/gate counts change rarely |
| `traffic` (annual) | 180 days | 60 days | Annual statistics published yearly |
| `traffic` (monthly) | 30 days | 10 days | Monthly data refreshed more often |
| `infrastructure` | 30 days | 15 days | Runway/navaid data changes slowly |
| `sources` | Computed | — | Derived from other sections |
| `source_links` | 180 days | 60 days | Source URLs change rarely |
| `layout` (OSM) | 30 days | 15 days | OSM community updates vary |

### Stale-while-revalidate behavior (canonical)
1. If `fetched_at + TTL > now`: return with `status: ok`.
2. If `fetched_at + TTL ≤ now` and `fetched_at + TTL + stale_window > now`:
   return with `status: stale`, queue background refresh.
3. If `fetched_at + TTL + stale_window ≤ now`: return with `status: stale`,
   queue high-priority refresh.
4. If no data: return with `status: fetching`, queue fetch.
5. If `no_data` sentinel exists and `fetched_at + 90 days > now`: return
   `status: no_data`, do not re-fetch.

---

## 8. Bulk Backfill Strategy

### Priority order

Backfill must process airports in this order. Do not skip tiers.

| Tier | Criteria | Estimated count |
|---|---|---|
| 1 | `type = large_airport` | ~600 |
| 2 | `type = medium_airport` | ~4,500 |
| 3 | `scheduled_service = yes` (small airports) | ~3,000 |
| 4 | `type = small_airport` (no scheduled service) | ~30,000 |
| 5 | `type = heliport`, `seaplane_base`, `closed` | ~40,000 |

### Backfill modes (CLI flags, canonical)

| Flag | Behavior |
|---|---|
| `--country <iso>` | Process airports in one country only |
| `--category <type>` | Process airports of one type only |
| `--source <source>` | Process one source module only (e.g., `osm`) |
| `--limit <n>` | Process at most N airports |
| `--resume` | Resume from last saved cursor in `airport_backfill_runs` |
| `--dry-run` | Print what would be processed, no DB writes |
| `--tier <1-5>` | Process one priority tier only |

### Backfill safety rules
- Backfill must never overwrite a fresh module (status `ok` within TTL).
- Backfill must be idempotent: re-running with same flags produces same result.
- Backfill must store progress in `airport_backfill_runs` and
  `airport_backfill_run_items` so it can be paused and resumed.
- Backfill must respect all rate limits defined in Section 5.

---

## 9. API Design

### Canonical endpoint

```
GET /api/airports/:airportId/intelligence
```

### Backward compatibility
- `GET /api/airports/:airportId/public-profile` is **unchanged**.
- The intelligence endpoint is additive. Both coexist indefinitely.
- The intelligence `overview` section reads from the same
  `airport_public_profiles` table as the public-profile endpoint.

### Query parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `sections` | string | all | Comma-separated section keys to return |
| `freshness` | string | `any` | `any`, `fresh-only`, `no-stale` |

### Response shape (canonical)

```json
{
  "airportId": "uuid",
  "generatedAt": "ISO8601",
  "overallStatus": "complete|partial|error",
  "sections": {
    "<section_key>": {
      "status": "ok|stale|fetching|no_data|error",
      "data": { ... } | null,
      "fetchedAt": "ISO8601" | null,
      "expiresAt": "ISO8601" | null,
      "confidence": "high|medium|low|none",
      "confidenceScore": 0.0,
      "sourceSummary": {
        "sources": ["string"],
        "lastRefresh": "ISO8601"
      },
      "error": { "code": "string", "message": "string" } | null
    }
  }
}
```

### HTTP status codes
- `200 OK` — always, unless airport not found
- `404 Not Found` — airport does not exist in `aviation_airports`
- `503 Service Unavailable` — database offline

### Section-level error codes

| Code | Meaning | Retry |
|---|---|---|
| `SOURCE_UNAVAILABLE` | External source down | Yes, with backoff |
| `PARSE_ERROR` | Data parsing failed | Yes |
| `NO_MATCH` | No matching data found | No |
| `RATE_LIMITED` | Source rate limit hit | Yes, with backoff |
| `TIMEOUT` | Fetch timed out | Yes |
| `LOW_CONFIDENCE` | Data exists but confidence < 0.5 | No |

### Queue trigger strategy
- On each API call, for each section with missing or stale data:
  - Queue a background fetch job (idempotent, deduplicated by `in_progress_key`)
  - Return immediately with current cache state
- Never block the API response on a fetch

### Polling strategy
- Client polls same endpoint every 2–5 seconds while any section has
  `status: fetching`
- Client stops polling when all sections reach terminal state
  (`ok`, `no_data`, `error`) or after 30 polls (max ~150 seconds)
- Optional: `?sections=capacity,traffic` to poll only fetching sections

### Response size limit
- Maximum 500 KB per response
- If exceeded, the largest section returns `status: error` with
  `code: RESPONSE_TOO_LARGE`

---

## 10. Database Design

### Existing tables — keep unchanged

| Table | Keep | Notes |
|---|---|---|
| `airport_public_profiles` | Yes | Public-profile cache, reused by overview section |
| `airport_public_profile_versions` | Yes | Version history |
| `airport_public_profile_fetch_runs` | Yes | Public-profile fetch audit |
| `aviation_airports` | Yes | Source of truth for airport identity |
| `aviation_runways` | Yes | Source for infrastructure and capacity |
| `aviation_navaids` | Yes | Source for infrastructure |

### New tables — staged migrations

**Stage 1 — Foundation (required before any other stage)**
- `airport_intelligence_modules` — per-airport, per-module status registry
- `airport_source_links` — source attribution, license, confidence
- `airport_intelligence_fetch_runs` — generalized fetch run tracking

**Stage 2 — Capacity module**
- `airport_capacity_profiles` — typed capacity columns

**Stage 3 — Traffic module**
- `airport_traffic_metrics` — time-series rows (annual first, monthly later)

**Stage 4 — Derived intelligence**
- `airport_derived_intelligence` — capability tags, operational scale

**Stage 5 — Layout module**
- `airport_layout_profiles` — OSM counts and bounding box (no raw geometry in v1)

**Stage 6 — Backfill orchestration**
- `airport_backfill_runs` — bulk run tracking
- `airport_backfill_run_items` — per-airport item tracking

### Typed columns vs JSONB (canonical rule)

**Use typed columns for:**
- All status fields
- All timestamp fields
- All numeric values used in queries, filters, or sorting
  (passenger counts, runway lengths, confidence scores, gate counts)
- All IDs used in joins
- Capability tags (TEXT[] with GIN index)
- Source names, license names

**Use JSONB only for:**
- Source-specific metadata not used in queries
- Footnotes and attribution details that vary by source
- Diagnostics and parser metadata
- Derived input hashes
- Backfill selection filter snapshots
- Worker configuration metadata

**Never use JSONB for:**
- Traffic values
- Capacity values
- Status fields
- Confidence scores
- Timestamps
- IDs used in joins

### Module status vocabulary (canonical)

| Status | Meaning |
|---|---|
| `ok` | Fresh cached data within TTL |
| `stale` | Cached data exists, past TTL, still servable |
| `fetching` | Fetch queued or running |
| `no_data` | Sources checked, no trustworthy data found |
| `low_confidence` | Data exists but confidence < 0.5 |
| `error` | Fetch failed, no usable data |

---

## 11. Frontend Design

### Panel layout (top to bottom, canonical)

```
┌─────────────────────────────────────────┐
│  [Hero image or dark ICAO placeholder]  │  100–120px, object-fit: cover
├─────────────────────────────────────────┤
│  AIRPORT NAME                           │  1.1rem, accent color
│  ICAO · IATA  ·  City, Country          │  0.75rem, mono, 60% opacity
│  Opened: 1948                           │  only if known
├─────────────────────────────────────────┤
│  [CAPABILITY BADGES]                    │  inline pills, max 5 visible
├─────────────────────────────────────────┤
│  Summary paragraph                      │  truncated at 280 chars
│  [Read more]                            │  toggle
├─────────────────────────────────────────┤
│  CAPACITY & TRAFFIC          [▾]        │  collapsible, open if data exists
│  Annual passengers  62.5M (2023)        │
│  Runways            4                   │
│  Gates              ~12 (OSM)           │
│  5-yr trend         [sparkline]         │
├─────────────────────────────────────────┤
│  INFRASTRUCTURE              [▾]        │  collapsible, closed by default
│  Runways / Frequencies / Navaids        │
├─────────────────────────────────────────┤
│  SOURCES & DETAILS           [▾]        │  collapsible, closed by default
│  Attribution, confidence, license       │
└─────────────────────────────────────────┘
```

### Image behavior (canonical)
- Use `facts.imageUrl` or `facts.image` if present → hero image
- On load error: silently hide (no broken icon)
- If no image: dark gradient placeholder with ICAO code in dim text, centered
- Future: small logo badge overlaid bottom-right of hero image

### Capability badges (canonical)
- Derive from `capability_tags` array from API (not client-side derivation)
- Max 5 visible; overflow as `[+N more]`
- Colors: international=cyan tint, cargo=amber tint, helipad=purple tint,
  closed=red tint with strikethrough name
- Omit row entirely if no capability data

### Capacity & Traffic section (canonical)
- Show only if section `status` is `ok` or `stale`
- Every traffic figure must include year: `62.5M (2023)` not `62.5M`
- 5-year sparkline: show only if ≥ 3 years of data exist; otherwise plain numbers
- Gate count from OSM: label as `~12 (OSM)` to indicate approximate/community source
- Hide section entirely if `status: no_data`; do not show empty rows or N/A

### Progressive loading behavior (canonical)
- Base data (name, codes, type) shows instantly — never waits for API
- Profile data (image, summary, badges) loads progressively
- Each section loads independently — no full-panel blocker
- `status: fetching` shows inline micro-indicator: `Building profile… ●`
- `status: stale` shows data with dim timestamp: `Updated 45 days ago`
- `status: error` shows one-line message with Retry button
- `status: no_data` hides the section entirely

### Source confidence display (canonical)
- Map numeric score to plain language:
  - 0.8–1.0 → "high confidence"
  - 0.5–0.79 → "partial match"
  - < 0.5 → "uncertain match" (amber warning, Show anyway toggle)
- Do not show numeric percentage to users
- Show match method in plain language: "exact IATA match", "name search"
- Attribution links: Wikipedia article title (linked), Wikidata QID (linked)

### No-data wording (canonical)

| State | Wording |
|---|---|
| No public profile | "No public profile available for this airport." |
| Profile building | "Building public profile…" (inline, small) |
| Profile error | "Public profile unavailable. [Retry]" |
| Low confidence | "⚠ Profile match uncertain — data may not correspond to this airport. [Show anyway]" |
| No capacity data | Omit section entirely |
| No image | Dark placeholder with ICAO code |
| API offline | "Offline — [section name] unavailable." (inside section only) |

---

## 12. Testing Strategy

All implementation work orders must include tests for the following scenarios.

### Wrong-match prevention
- IATA-only match without coordinate check must be rejected
- Coordinate distance > 50 km must set confidence to `none`
- Wikipedia page ID mismatch must reject the match
- OSM bounding box outside airport coordinates must return no data

### Source timeout handling
- Each source timeout must not block other sections
- Timed-out section must return `status: error` with `code: TIMEOUT`
- Worker must mark fetch_run as `failed` on timeout

### Stale data returned immediately
- Stale section must return data with `status: stale` without waiting for refresh
- Background refresh must be queued but not awaited

### Section-level error isolation
- Error in one section must not affect other sections
- Overall response must still be `200 OK`
- `overallStatus` must be `partial` not `error` if at least one section is `ok`

### Duplicate job prevention
- Two workers claiming same `in_progress_key` must result in exactly one
  proceeding
- Duplicate queue entries must be deduplicated before insert

### Backfill resume
- Pausing and resuming a backfill run must not re-process completed items
- Failed items must be retried up to `max_attempts` then marked `failed`
- `--dry-run` must not write any DB rows

### Frontend missing-data states
- `status: no_data` must hide the section, not show empty rows
- `status: fetching` must show micro-indicator, not full-panel spinner
- `status: error` must show retry button, not crash the panel
- Missing image must show placeholder, not broken icon

### Licensing and attribution
- Every API response section must include `sourceSummary.sources`
- Wikipedia sections must include CC BY-SA 4.0 license link
- OSM-derived data must include ODbL attribution
- Any section without attribution must fail the test

### API response size guard
- Response exceeding 500 KB must return `error` for the largest section
- Response must never exceed 500 KB total

---

## 13. Operational Command Direction (Future Only)

This section describes the intended future direction. Nothing here is
implemented in this work order.

**Goal:** One command to start all services for local development.

```bash
pnpm dev:all
```

Expected behavior:
- Start API on port 4000
- Start frontend on port 5174
- Start queue worker (public profile + intelligence)
- Start intelligence worker (capacity, traffic, layout)
- Watch for file changes and restart workers

**Implementation note:** This command does not exist yet. It should be designed
as a `pnpm` workspace script that runs all services in parallel using a process
manager (e.g., `concurrently` or `turbo`). The intelligence workers should
support `--watch` mode for continuous queue processing.

---

## 14. Open Questions (Resolved)

The following questions from research reports are resolved by this document.

| Question | Decision |
|---|---|
| New endpoint or extend public-profile? | New endpoint: `GET /api/airports/:airportId/intelligence` |
| Overview section: mirror or subset of public-profile? | Transformed subset. Reuses same DB table, different response shape. |
| Section versioning? | Not for MVP. Add when schema changes require it. |
| Wikidata P1589 vs Wikipedia extract for passengers? | Wikipedia extract takes priority if it contains a year-qualified number. Wikidata P1589 is fallback. Both stored in source_links. |
| OSM geometry in DB? | Counts and bounding box only in v1. No raw geometry. ODbL review required before geometry is exposed publicly. |
| OSM own instance vs commercial? | Use public Overpass API in v1 with strict rate limiting. Evaluate self-hosted if rate limits become a problem. |
| BTS API complexity? | BTS is medium priority. Implement after capacity and Wikipedia traffic extraction work. |
| Annual report PDF parsing? | Store URL link only in v1. No PDF parsing. |
| Sparkline library? | Pure CSS/SVG sparkline. No new dependency. |
| Capability badges: API or client-side? | API-side. `capability_tags` TEXT[] from `airport_derived_intelligence`. |
| Confidence threshold for hiding data? | `confidence_score < 0.5` → `low_confidence` status, amber warning, Show anyway toggle. |
| Monthly traffic in first migration? | Annual metrics first. Monthly metrics in a later work order. |
| ETag/If-None-Match support? | Yes, but only when all sections are `ok`. Not for partial responses. |

---

## 15. Implementation Order (Recommended)

Work orders should be created and executed in this order.

| Order | Work order | Description |
|---|---|---|
| 1 | WO-036-DB-FOUNDATION | Stage 1 migrations: `airport_intelligence_modules`, `airport_source_links`, `airport_intelligence_fetch_runs` |
| 2 | WO-037-DB-CAPACITY | Stage 2 migration: `airport_capacity_profiles` |
| 3 | WO-038-DB-TRAFFIC | Stage 3 migration: `airport_traffic_metrics` (annual only) |
| 4 | WO-039-API-INTELLIGENCE | API endpoint: `GET /api/airports/:airportId/intelligence` with overview + capability + infrastructure sections |
| 5 | WO-040-WORKER-CAPACITY | Capacity worker: OurAirports runways → capacity module |
| 6 | WO-041-WORKER-TRAFFIC | Traffic worker: Wikipedia extract + Wikidata P1589 → traffic module |
| 7 | WO-042-FRONTEND-INTELLIGENCE | Frontend: Capacity & Traffic section, capability badges, sparkline |
| 8 | WO-043-DB-DERIVED | Stage 4 migration: `airport_derived_intelligence` + capability tag derivation |
| 9 | WO-044-WORKER-OSM | OSM layout worker: gate/terminal counts (background only) |
| 10 | WO-045-BACKFILL | Stage 6 migrations + backfill CLI for tier 1 airports |

---

*End of WO-035 canonical design document.*  
*All implementation work orders must reference this document.*  
*Design amendments require a new WO-035-AMENDMENT-N document.*
