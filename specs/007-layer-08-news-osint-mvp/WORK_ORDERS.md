# Work Orders - Layer 08 News & OSINT

## WO-NEWS-R: Source Research & Probe
**Status**: ✅ COMPLETE (Current Work Order)

**Objective**: Research official documentation and validate source availability

**Tasks**:
- [x] Research GDACS documentation and API
- [x] Research GDELT DOC 2.0 API documentation
- [x] Research ReliefWeb API documentation
- [x] Research curated RSS/Atom feeds
- [x] Create source evaluation matrix
- [x] Write global source proof script
- [x] Run proof script and document results
- [x] Create PROOF_REPORT.md with findings

**Deliverables**:
- `specs/007-layer-08-news-osint-mvp/` folder with all planning docs
- `tools/layer_08_news_source_probe.py` proof script
- `tmp/layer_08_news_probe/source_probe_report.json` proof results
- `specs/007-layer-08-news-osint-mvp/PROOF_REPORT.md` summary

**Acceptance Criteria**:
- All four source families researched
- Proof script runs without crashing
- Proof report generated with real data
- No production code changes
- No raw data committed

---

## WO-NEWS-F1: GDACS Fetcher + Raw Proof
**Status**: ✅ COMPLETE

**Objective**: Implement GDACS fetcher module and run live raw proof

**Branch**: `agent/layer-08-news-gdacs-fetcher`

**Tasks**:
- [x] Implement `layers/layer_08_news_osint/__init__.py`
- [x] Implement `layers/layer_08_news_osint/news_source_types.py`
- [x] Implement `layers/layer_08_news_osint/gdacs_client.py` (urllib + curl fallback)
- [x] Implement `layers/layer_08_news_osint/gdacs_fetcher.py`
- [x] Implement `layers/layer_08_news_osint/gdacs_raw_storage.py`
- [x] Implement `layers/layer_08_news_osint/__main__.py` CLI proof command
- [x] Add retry/backoff for transient network failures and 5xx responses
- [x] Add curl fallback for Windows TLS/IPv6 issues
- [x] Write unit tests (35/35 passing, no live network)
- [x] Add `tmp/` to `.gitignore`
- [x] Run live proof command — PASS

**Live Proof Results** (2026-06-11):
- Items fetched: 171
- Items with coordinates: 47
- Alert levels: Green: 167, Orange: 4
- Event types: DR: 16, EQ: 34, FL: 9, TC: 108, WF: 4
- Raw output: `tmp/layer_08_news_osint/gdacs/2026/06/11/run_*/` (gitignored)

**Deliverables**:
- `services/fetch-orchestrator/src/layers/layer_08_news_osint/` package
- `tests/data/layer_08_news_osint/test_gdacs_fetcher.py` (35 tests)
- `.gitignore` updated with `tmp/`

**Acceptance Criteria**: All met
- Tests pass (35/35)
- Live proof fetch succeeds (171 events)
- Raw proof output untracked (`tmp/` gitignored)

---

## WO-NEWS-F: Fetcher Implementation (remaining sources)
**Status**: PENDING (WO-NEWS-F1 GDACS complete; GDELT/ReliefWeb/RSS pending)

**Objective**: Implement remaining per-source fetchers for raw data ingestion

**Prerequisites**:
- WO-NEWS-F1 complete ✅
- Source registry design finalized
- Raw storage paths defined

**Tasks**:
- [x] Implement GDACS fetcher (done in WO-NEWS-F1)
- [ ] Implement GDELT fetcher
- [ ] Implement ReliefWeb fetcher (if appname available)
- [ ] Implement RSS fetcher
- [ ] Add rate limiting
- [ ] Write unit tests for remaining sources

**Estimated Effort**: 2-4 days (remaining after WO-NEWS-F1)

---

## WO-NEWS-N1: GDACS Normalizer Proof
**Status**: ✅ COMPLETE

**Objective**: Implement GDACS normalizer and run live normalized proof

**Branch**: `agent/layer-08-news-gdacs-normalizer`

**Tasks**:
- [x] Implement `gdacs_normalizer.py` with `normalize_gdacs_feature` and `normalize_gdacs_payload`
- [x] Event type mapping: EQ/FL/TC/DR/VO/WF → subcategory
- [x] Alert level mapping: Red/Orange/Green → critical/high/medium
- [x] Point-only coordinate extraction; no fake coords for LineString/Polygon
- [x] Title fallback chain implemented
- [x] Stable dedupe_key: `gdacs:{eventid}:{episodeid}:{eventtype}:{geometry_type}:{coord_hash}`
- [x] Updated `gdacs_raw_storage.py` with `save_normalized_events` / `save_normalized_summary`
- [x] Updated `__main__.py` with `--normalize` flag
- [x] Write unit tests (45 normalizer tests; total 80/80 passing)
- [x] Fixed PROOF_REPORT.md overclaim (coordinates not available for all events)
- [x] Run live proof with --normalize — PASS

**Live Proof Results** (2026-06-11):
- Total features: 171
- Normalized items: 171 (0 skipped)
- Marker-ready (Point): 47
- Geometry: Point: 47, LineString: 48, Polygon: 76
- Severity: Green: 167, Orange: 4
- Event types: DR: 16, EQ: 34, FL: 9, TC: 108, WF: 4

**Acceptance Criteria**: All met

---

## WO-NEWS-N: Normalizer Implementation (remaining sources)
**Status**: PENDING (WO-NEWS-N1 GDACS complete; GDELT/ReliefWeb/RSS pending)

**Objective**: Transform raw source data into normalized format

**Prerequisites**:
- WO-NEWS-F complete
- WO-NEWS-N1 complete ✅
- Normalization design finalized

**Tasks**:
- [x] Implement GDACS normalizer (done in WO-NEWS-N1)
- [ ] Implement GDELT normalizer
- [ ] Implement ReliefWeb normalizer
- [ ] Implement RSS normalizer
- [ ] Write unit tests for remaining normalizers

**Estimated Effort**: 2-4 days (remaining after WO-NEWS-N1)

---

## WO-NEWS-D1: GDACS Database Schema
**Status**: COMPLETE

**Objective**: Create database tables for news data storage

**Prerequisites**:
- WO-NEWS-N1 complete
- Database planning finalized
- Table schemas defined

**Tasks**:
- [x] Create news_sources table migration
- [x] Create news_fetch_runs table migration
- [x] Create news_items_latest table migration
- [x] Create news_item_history table migration
- [x] Create news_raw_message_refs table migration
- [x] Add indexes for common queries
- [x] Add partial spatial index for marker-ready Point geometry
- [x] Seed GDACS source configuration and attribution
- [x] Write migration and local PostGIS integration tests

**Deliverables**:
- `database/migrations/layers/layer_08_news_osint/001_news_tables.sql`
- GDACS source seed
- `tests/data/layer_08_news_osint/test_news_database_schema.py`

**Storage decision**:
- Store all normalized items, not only marker-ready items.
- Create Point geometry only for marker-ready rows.
- Preserve LineString and Polygon geometry types without fake coordinates.
- Keep source IDs and source families open for future GDELT, ReliefWeb, and RSS work.

**Estimated Effort**: 2-3 days

---

## WO-NEWS-I1: GDACS Database Ingestion Proof
**Status**: ✅ COMPLETE

**Objective**: Implement local proof ingestion workflow that takes real GDACS data through fetch → normalize → database

**Branch**: `agent/layer-08-news-gdacs-ingestion`

**Prerequisites**:
- WO-NEWS-F1 complete
- WO-NEWS-N1 complete
- WO-NEWS-D1 complete

**Tasks**:
- [x] Create `database/ingestion/layers/layer_08_news_osint/gdacs_db_ingestion.py`
- [x] Implement `create_fetch_run()` — insert running fetch run row
- [x] Implement `complete_fetch_run()` — update run to success/partial/failed
- [x] Implement `upsert_latest_item()` — deduplicated upsert into `news_items_latest`
- [x] Implement `append_history()` — version-tracked history with change detection
- [x] Implement `insert_raw_ref()` — raw evidence reference per item per run
- [x] Implement `ingest_gdacs_items()` — atomic batch ingestion with rollback
- [x] Implement validation: marker_ready requires Point + coordinates, no fake coords
- [x] Implement idempotency: dedupe_key upsert preserves item_id and first_seen_at
- [x] Update `__main__.py` with `--ingest-db` flag
- [x] Create `tests/data/layer_08_news_osint/test_gdacs_db_ingestion.py`
- [x] Unit tests cover fetch runs, upserts, history, raw refs, validation, idempotency

**Deliverables**:
- `database/ingestion/layers/layer_08_news_osint/__init__.py`
- `database/ingestion/layers/layer_08_news_osint/gdacs_db_ingestion.py`
- `tests/data/layer_08_news_osint/test_gdacs_db_ingestion.py`
- Updated `services/fetch-orchestrator/src/layers/layer_08_news_osint/__main__.py`

**Database tables written**:
- `news_fetch_runs` (one row per run)
- `news_items_latest` (upserted by dedupe_key)
- `news_item_history` (version snapshots, only on change)
- `news_raw_message_refs` (one ref per item per run)

**Idempotency**:
- `news_items_latest` deduplicated by `dedupe_key` (unique index)
- `item_id` and `first_seen_at` preserved on re-ingestion
- `last_seen_at` updated on every run
- History versions only created when tracked fields change
- Raw refs accumulate per-run evidence references
- Fetch runs always add a new row

**Estimated Effort**: 2-3 days

---

## WO-NEWS-I: Ingestion Pipeline
**Status**: IN PROGRESS (WO-NEWS-I1 GDACS proof complete; full pipeline pending)

**Objective**: Orchestrate fetch → normalize → store pipeline for all sources

**Prerequisites**:
- WO-NEWS-F complete
- WO-NEWS-N complete
- WO-NEWS-D1 complete
- WO-NEWS-I1 complete ✅

**Tasks**:
- [x] Design ingestion workflow (done in WO-NEWS-I1)
- [x] Implement GDACS database ingestion (done in WO-NEWS-I1)
- [ ] Implement fetch orchestrator integration for scheduled runs
- [ ] Add monitoring and metrics
- [ ] Add alerting for failures
- [ ] Add manual trigger capability
- [ ] Write integration tests for full pipeline

**Deliverables**:
- `database/ingestion/layers/layer_08_news_osint/` folder
- Ingestion pipeline implementation
- Monitoring dashboard
- Integration tests

**Estimated Effort**: 3-4 days

---

## WO-NEWS-A1: GDACS API Endpoints
**Status**: ✅ COMPLETE

**Objective**: Expose stored Layer 08 GDACS data through API endpoints

**Prerequisites**:
- WO-NEWS-D1 complete ✅
- WO-NEWS-I1 complete ✅
- API planning finalized ✅

**Branch**: `agent/layer-08-news-gdacs-api`
**Base branch**: `origin/agent/layer-08-news-gdacs-ingestion`

**Tasks**:
- [x] Add Zod response schemas to `@god-eyes/contracts`
- [x] Implement `GET /api/layers/layer_08_news_osint/news/items`
- [x] Implement `GET /api/layers/layer_08_news_osint/news/markers`
- [x] Implement `GET /api/layers/layer_08_news_osint/news/sources`
- [x] Implement `GET /api/layers/layer_08_news_osint/news/fetch-runs`
- [x] Implement `GET /api/layers/layer_08_news_osint/news/stats`
- [x] Add filtering (source_id, category, subcategory, severity, country_code, marker_ready, has_coordinates, geometry_type, published_after, published_before, search)
- [x] Add pagination (limit/offset)
- [x] Add parameterized SQL queries
- [x] Add Zod response validation
- [x] Add error handling (400 validation, 503 DB offline, 500 internal)
- [x] Write API tests (43 tests, all passing)
- [x] Update API_PLANNING.md, WORK_ORDERS.md, HANDOFF_LOG.md

**Deliverables**:
- `packages/contracts/src/index.ts` — 17 News/OSINT Zod schemas added
- `apps/api/src/routes/news.ts` — 5 endpoints implemented
- `apps/api/src/index.ts` — route registration
- `apps/api/tests/layer_08_news_osint.test.ts` — 43 API tests

**Endpoints**:

1. `GET /news/items` — Filterable list from `news_items_latest`
2. `GET /news/markers` — Marker-ready Point items (enforces `marker_ready=TRUE` + `geom IS NOT NULL`)
3. `GET /news/sources` — Source metadata from `news_sources` (no `auth_env_var`)
4. `GET /news/fetch-runs` — Run history from `news_fetch_runs` (no `raw_output_uri`)
5. `GET /news/stats` — Aggregate counts including `fake_coordinate_risk_count`

**Safety**:
- No raw provider metadata or raw evidence content exposed
- No auth/env secrets exposed
- No fake coordinates exposed
- LineString/Polygon rows excluded from markers
- Frontend, scheduler, additional source work: not added

**Test results**: 43/43 passing, full suite 486/486 passing

---

## WO-NEWS-U: Frontend Implementation
**Status**: PENDING

**Objective**: Create frontend UI for news display

**Prerequisites**:
- WO-NEWS-A complete
- Frontend planning finalized
- UI components designed

**Tasks**:
- [ ] Implement globe markers component
- [ ] Implement sidebar list component
- [ ] Implement detail card component
- [ ] Implement filter controls
- [ ] Implement source attribution display
- [ ] Implement location confidence display
- [ ] Implement timeline view
- [ ] Add responsive design
- [ ] Add accessibility features
- [ ] Write component tests

**Deliverables**:
- `apps/web/components/layer-08/` folder
- Frontend component implementations
- Style guidelines
- Component tests

**Estimated Effort**: 5-7 days

---

## WO-NEWS-QA: Integration Review
**Status**: PENDING

**Objective**: Verify end-to-end functionality and quality

**Prerequisites**:
- WO-NEWS-U complete
- All previous work orders complete

**Tasks**:
- [ ] Test end-to-end data flow
- [ ] Verify all sources working
- [ ] Verify all endpoints working
- [ ] Verify frontend display
- [ ] Test error scenarios
- [ ] Test performance under load
- [ ] Test accessibility
- [ ] Document known issues
- [ ] Create release notes

**Deliverables**:
- Test results documentation
- Performance benchmarks
- Known issues list
- Release notes

**Estimated Effort**: 2-3 days

---

## Work Order Dependencies

```
WO-NEWS-R (Complete)
    ↓
WO-NEWS-F → WO-NEWS-N → WO-NEWS-D1 → WO-NEWS-I → WO-NEWS-A → WO-NEWS-U → WO-NEWS-QA
```

## Timeline Estimate

- **WO-NEWS-R**: ✅ Complete
- **WO-NEWS-F**: 3-5 days
- **WO-NEWS-N**: 3-5 days (can overlap with WO-NEWS-F)
- **WO-NEWS-D1**: Complete
- **WO-NEWS-I**: 3-4 days
- **WO-NEWS-A**: 3-4 days
- **WO-NEWS-U**: 5-7 days
- **WO-NEWS-QA**: 2-3 days

**Total Estimated**: 21-31 days (with parallel work)

## Risk Factors

1. **ReliefWeb appname availability** - May delay WO-NEWS-F
2. **GDELT rate limits** - May require additional handling
3. **Geocoding complexity** - May extend WO-NEWS-N
4. **Frontend performance** - May require optimization
5. **Data quality issues** - May require additional normalization

## Success Criteria

1. All four source families successfully integrated
2. GDACS provides coordinates for globe markers
3. GDELT provides article metadata for news list
4. ReliefWeb provides humanitarian reports (if available)
5. RSS feeds provide supplementary content
6. API endpoints perform within acceptable limits
7. Frontend displays data correctly on all devices
8. No production incidents during rollout

---

## WO-NEWS-U1 — Frontend GDACS Globe Markers + Sidebar

**Status**: COMPLETE
**Branch**: `agent/layer-08-news-gdacs-frontend`
**Base**: `origin/agent/layer-08-news-gdacs-api`

**Deliverables completed**:
- Globe markers for marker-ready Point records via `/news/markers`
- Sidebar/list panel with all items (including LineString/Polygon) via `/news/items`
- Detail card with source attribution, severity, country, coordinates
- Stats display (total, marker-ready, by_severity, fake_coordinate_risk_count)
- Severity + marker-ready-only filters backed by API query params
- Loading/error/empty states distinguishing layer failure from API failure
- 25 new frontend tests covering all key behaviors
- No raw provider_metadata or raw JSON exposed
- No direct frontend calls to GDACS

**Validation**: 59/59 web tests, 486/486 API tests, build clean

---

## WO-NEWS-G1 — GDELT Source Proof

**Status**: ✅ COMPLETE
**Branch**: `agent/layer-08-news-gdelt-source-proof`
**Base**: `origin/agent/layer-08-news-gdacs-frontend`

**Goal**: Prove whether GDELT can be used as next Layer 08 source for broader global news/events beyond natural disasters.

**Deliverables completed**:
- Proof script: `services/fetch-orchestrator/src/layers/layer_08_news_osint/gdelt_source_probe.py`
- Proof report: `specs/007-layer-08-news-osint-mvp/GDELT_SOURCE_PROOF.md`
- Updated SOURCE_EVALUATION_MATRIX.md with GDELT findings

**Source evaluation**:
- **GDELT DOC API**: Tested with queries (Iran, Ukraine, Gaza). Returns HTML article lists with title, URL, source, country. BLOCKED by severe rate limiting (429 errors).
- **GDELT GEO API**: Tested - returns 404 (not available).
- **GDELT Event Export**: Verified. CSV files with ActionGeo_Lat/Long coordinates, Actor names, EventCode, SourceURL. Stable HTTP 200.

**Recommendation**: Use GDELT Event Export path (Option 2). DOC API is not usable due to rate limits.

**Source proof rules followed**:
- No production fetcher/normalizer/API/frontend changes
- No fake data or coordinates
- No secrets committed
- No large raw outputs committed

**Validation**: Live proof script executed successfully.

---

## WO-NEWS-G2 — GDELT Event Export Fetcher

**Status**: ✅ COMPLETE (fetcher, normalizer, ingestion all complete)
**Note**: API work completed in WO-NEWS-A2 below.

---

**Objective**: Implement fetcher to download and parse GDELT Event Export CSV files for marker-capable event records.

**Prerequisites**:
- WO-NEWS-G1 complete ✅

**Implementation approach**:
1. Fetch latest export list from `http://data.gdeltproject.org/gdeltv2/lastupdate.txt`
2. Download latest export CSV (~10-50MB compressed)
3. Stream-parse TSV with Python csv module
4. Filter rows where ActionGeo_Lat/Long are non-empty for marker-ready data
5. Store all rows for list view
6. Raw storage path: `tmp/layer_08_news_osint/gdelt/`

**Data fields to capture**:
- GLOBALEVENTID (stable event ID)
- Actor1Name, Actor2Name (conflict actors)
- EventCode (CAMEO code)
- QuadClass (1-4: cooperation/conflict classification)
- ActionGeo_Lat, ActionGeo_Long (exact coordinates)
- ActionGeo_CountryCode
- SourceURL (attribution)
- DATEADDED

**Database ingestion completion**:

- Work order: WO-NEWS-G4
- Status: COMPLETE - pending integration review
- Branch: `agent/layer-08-news-gdelt-ingestion`
- Base branch: `origin/agent/layer-08-news-gdelt-normalizer`
- Existing News tables reused without destructive schema changes.
- Active `gdelt_event_export` / `global_event` source seed added without changing GDACS.
- Atomic fetch-run, latest, change-only history, and raw-reference ingestion added.
- Dedupe identity: `gdelt_event_export:<global_event_id>`.
- Repeat ingestion preserves `first_seen_at`, advances `last_seen_at`, and does not
  duplicate latest or unchanged history rows.
- Marker-ready rows use the existing Point trigger; list-only geometry remains null.
- Current export proof: 504 fetched/normalized/stored, 350 marker-ready, 154 list-only.
- Identical second run: 0 latest inserts, 0 history inserts, 504 additional raw refs.
- Final latest/distinct dedupe: 504 / 504; geometry safety violations: 0.
- Next work order: GDELT API contract and endpoint review/implementation.

**MVP filtering**:
- Only rows with ActionGeo_Lat/Long populated → marker_ready=true
- Rows without coordinates → marker_ready=false (list only)

**Estimated Effort**: 2-3 days

---

## WO-NEWS-A2 — GDELT API Contract and Endpoint Verification

**Status**: ✅ COMPLETE

**Branch**: `agent/layer-08-news-gdelt-api`
**Base branch**: `origin/agent/layer-08-news-gdelt-ingestion`

**Goal**: Verify and extend Layer 08 API so GDELT Event Export records are correctly exposed.

**Finding**: Existing API endpoints were already source-flexible via `source_id` query parameter. No new routes or contract changes were needed — the source-agnostic design from WO-NEWS-A1 naturally supports GDELT.

**Deliverables completed**:
- Verified existing endpoints work for GDELT without code changes
- Added 17 GDELT-specific API tests (60 total Layer 08 tests, +17)
- Tests cover: items with source_id filter, marker_ready filter, list-only rows, markers exclusion, sources inclusion, fetch-runs, stats, no CSV/raw exposure, no fake coordinates, no secrets
- Live API proof executed against dev database (504 GDELT rows)
- Updated WORK_ORDERS.md and HANDOFF_LOG.md

**Live proof results**:
| Check | Result |
|---|---|
| Items `?source_id=gdelt_event_export` | 200, 504 rows |
| Markers `?source_id=gdelt_event_export` | 200, marker-ready only (350 rows) |
| Sources | 200, includes `gdelt_event_export` |
| Fetch-runs `?source_id=gdelt_event_export` | 200, 2 runs |
| Stats | 200, 504 GDELT items, 0 fake coordinate risk |

**Test results**: 503/503 passing (17 files), 60 Layer 08 tests

**Safety verified**:
- No raw CSV rows exposed (no global_event_id, ActionGeo_Lat, CAMEO codes)
- No auth/env secrets exposed
- No fake coordinate behavior
- No provider_metadata or raw_evidence_uri in responses

**What was not implemented**:
- No frontend changes (out of scope)
- No fetcher/normalizer/ingestion changes
- No scheduler/cron
- No Category B news/RSS/live work
- No new routes — existing source-flexible design reused
