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

## WO-NEWS-F: Fetcher Implementation
**Status**: PENDING

**Objective**: Implement per-source fetchers for raw data ingestion

**Prerequisites**:
- WO-NEWS-R complete
- Source registry design finalized
- Raw storage paths defined

**Tasks**:
- [ ] Design source registry schema
- [ ] Implement GDACS fetcher
- [ ] Implement GDELT fetcher
- [ ] Implement ReliefWeb fetcher (if appname available)
- [ ] Implement RSS fetcher
- [ ] Add retry/timeout logic
- [ ] Add rate limiting
- [ ] Add error handling
- [ ] Write unit tests

**Deliverables**:
- `services/fetch-orchestrator/sources/layer_08/` folder
- Per-source fetcher implementations
- Source registry configuration
- Unit tests for each fetcher

**Estimated Effort**: 3-5 days

---

## WO-NEWS-N: Normalizer Implementation
**Status**: PENDING

**Objective**: Transform raw source data into normalized format

**Prerequisites**:
- WO-NEWS-F complete
- Normalization design finalized
- Common event shape defined

**Tasks**:
- [ ] Implement common normalization interface
- [ ] Implement GDACS normalizer
- [ ] Implement GDELT normalizer
- [ ] Implement ReliefWeb normalizer
- [ ] Implement RSS normalizer
- [ ] Add location confidence scoring
- [ ] Add severity normalization
- [ ] Add category normalization
- [ ] Add deduplication logic
- [ ] Write unit tests

**Deliverables**:
- `services/normalizer/sources/layer_08/` folder
- Per-source normalizer implementations
- Common normalization utilities
- Unit tests for each normalizer

**Estimated Effort**: 3-5 days

---

## WO-NEWS-D: Database Schema
**Status**: PENDING

**Objective**: Create database tables for news data storage

**Prerequisites**:
- WO-NEWS-N complete
- Database planning finalized
- Table schemas defined

**Tasks**:
- [ ] Create news_sources table migration
- [ ] Create news_fetch_runs table migration
- [ ] Create news_items_latest table migration
- [ ] Create news_item_history table migration
- [ ] Create news_raw_message_refs table migration
- [ ] Add indexes for common queries
- [ ] Add spatial indexes for coordinates
- [ ] Seed initial source configurations
- [ ] Write migration tests

**Deliverables**:
- `database/migrations/layer_08/` folder
- SQL migration files
- Seed data for source configurations
- Migration tests

**Estimated Effort**: 2-3 days

---

## WO-NEWS-I: Ingestion Pipeline
**Status**: PENDING

**Objective**: Orchestrate fetch → normalize → store pipeline

**Prerequisites**:
- WO-NEWS-F complete
- WO-NEWS-N complete
- WO-NEWS-D complete

**Tasks**:
- [ ] Design ingestion workflow
- [ ] Implement fetch orchestrator integration
- [ ] Implement normalizer integration
- [ ] Implement database writer
- [ ] Add monitoring and metrics
- [ ] Add alerting for failures
- [ ] Add manual trigger capability
- [ ] Write integration tests

**Deliverables**:
- `services/ingestion/layer_08/` folder
- Ingestion pipeline implementation
- Monitoring dashboard
- Integration tests

**Estimated Effort**: 3-4 days

---

## WO-NEWS-A: API Implementation
**Status**: PENDING

**Objective**: Create RESTful API endpoints for news data

**Prerequisites**:
- WO-NEWS-D complete
- WO-NEWS-I complete
- API planning finalized

**Tasks**:
- [ ] Design API routes
- [ ] Implement /items endpoint
- [ ] Implement /markers endpoint
- [ ] Implement /sources endpoint
- [ ] Implement /fetch-runs endpoint
- [ ] Implement /stats endpoint
- [ ] Add filtering and pagination
- [ ] Add rate limiting
- [ ] Add caching headers
- [ ] Add error handling
- [ ] Write API tests

**Deliverables**:
- `apps/api/routes/layer-08/` folder
- API endpoint implementations
- OpenAPI specification
- API tests

**Estimated Effort**: 3-4 days

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
WO-NEWS-F → WO-NEWS-N → WO-NEWS-D → WO-NEWS-I → WO-NEWS-A → WO-NEWS-U → WO-NEWS-QA
```

## Timeline Estimate

- **WO-NEWS-R**: ✅ Complete
- **WO-NEWS-F**: 3-5 days
- **WO-NEWS-N**: 3-5 days (can overlap with WO-NEWS-F)
- **WO-NEWS-D**: 2-3 days (can overlap with WO-NEWS-N)
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