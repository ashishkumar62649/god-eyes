# Work Orders: Maritime / Live Ships Layer

## Sequence Overview

Work orders are executed in strict sequence. Each WO must complete before the next begins.

| WO | Name | Lane | Depends On | Status |
|----|------|------|------------|--------|
| WO-MAR-P | Maritime Spec/Planning | Planning | None | In Progress |
| WO-MAR-R | Maritime Source Research | Fetching | WO-MAR-P | Pending |
| WO-MAR-S | AISStream Real Fetch Proof | Fetching | WO-MAR-R | Pending |
| WO-MAR-F | Fetcher Implementation | Fetching | WO-MAR-S | Pending |
| WO-MAR-N | Normalization Implementation | Fetching | WO-MAR-F | Pending |
| WO-MAR-D | Database Schema | Database | WO-MAR-N | Pending |
| WO-MAR-A | API Implementation | API | WO-MAR-D | Pending |
| WO-MAR-U | Frontend Integration | Frontend | WO-MAR-A | Pending |
| WO-MAR-V | Full Layer Validation | Review | WO-MAR-U | Pending |

---

## WO-MAR-P: Maritime Spec/Planning

### Lane
Planning Worker

### Goal
Create the complete Spec Kit planning package for the Maritime layer. Define all documents, source evaluation, architecture, and work orders.

### Allowed Files
- `specs/005-layer-06-maritime-mvp/` (all files)
- `docs/state/HANDOFF_LOG.md`

### Disallowed Files
- `services/` (no code)
- `apps/` (no code)
- `database/` (no migrations)
- `packages/` (no contracts)
- `.env` (no secret access)

### Inputs
- `AGENTS.md`
- `docs/control/MVP_LAYER_REGISTRY.md`
- `docs/control/LAYER_ID_CONVENTIONS.md`
- `docs/control/SOURCE_TO_FRONTEND_CONTRACT.md`
- `docs/control/PIPELINE_HANDOFF_RULES.md`
- `docs/control/DATA_LOCATION_RULES.md`
- `docs/state/CURRENT_PROJECT_STATE.md`
- Existing spec kits (001-004)

### Outputs
- `specs/005-layer-06-maritime-mvp/` (all planning documents)

### Acceptance Criteria
- [ ] All planning documents created
- [ ] Layer ID confirmed as `layer_06_maritime`
- [ ] AISStream identified as PRIMARY_MVP_SOURCE
- [ ] Work order sequence defined
- [ ] Open questions documented
- [ ] HANDOFF_LOG.md updated

### Validation Commands
```bash
git status --short --branch
git diff --stat
git diff --check
```

### Reviewer Checklist
- [ ] All documents complete
- [ ] Layer ID matches registry
- [ ] Source evaluation thorough
- [ ] Work orders properly sequenced
- [ ] No secrets touched
- [ ] No code files modified

### Handoff Requirements
- Update HANDOFF_LOG.md with WO-MAR-P completion
- State what is now available for next WO

---

## WO-MAR-R: Maritime Source Research

### Lane
Fetching Worker

### Goal
Verify AISStream API documentation, confirm WebSocket connection shape, confirm available fields, document any discrepancies from planning assumptions.

### Allowed Files
- `services/fetch-orchestrator/src/layers/layer_06_maritime/` (research notes only)
- `docs/state/HANDOFF_LOG.md`

### Disallowed Files
- `apps/` (no frontend)
- `database/` (no migrations)
- `packages/contracts/` (no API contracts)
- `.env` (no secret access)

### Inputs
- AISStream documentation (https://aisstream.io/documentation)
- `specs/005-layer-06-maritime-mvp/SOURCE_EVALUATION_MATRIX.md`

### Outputs
- Research notes confirming actual AISStream message shapes
- Documented field availability per message type
- Any discrepancies from planning assumptions

### Acceptance Criteria
- [ ] AISStream WebSocket connection shape documented
- [ ] Actual message types and fields confirmed
- [ ] Discrepancies from planning noted
- [ ] HANDOFF_LOG.md updated

### Validation Commands
```bash
git status --short --branch
git diff --stat
git diff --check
```

### Reviewer Checklist
- [ ] Research notes complete
- [ ] No live network calls (documentation review only)
- [ ] No secrets accessed

### Handoff Requirements
- Document confirmed message shapes
- Feed confirmed fields into WO-MAR-S and WO-MAR-D

---

## WO-MAR-S: AISStream Real Fetch Proof

### Lane
Fetching Worker

### Goal
Prove AISStream delivers real AIS data. Create a minimal proof script that connects to WebSocket, receives messages, saves raw data to disk, and inspects message structure. 60 seconds or 100 messages.

**WO-MAR-S scope is minimal proof only:**
- May: connect to AISStream, read AISSTREAM_API_KEY from environment only, capture 60 seconds or 100 real messages, save raw_messages.jsonl, save metadata.json, save preview.json, produce a proof report
- Must not: normalize, write to database, create API, create frontend, print or store API key

### Allowed Files
- `services/fetch-orchestrator/src/layers/layer_06_maritime/` (minimal proof script only)
- `raw/layer_06_maritime/aisstream/` (raw data output)
- `docs/state/HANDOFF_LOG.md`

### Disallowed Files
- `apps/` (no frontend)
- `database/` (no migrations)
- `packages/contracts/` (no API contracts)
- `.env` (read only, never print)
- `tests/` (no test files for proof script)

### Inputs
- AISStream API key from environment variable
- `specs/005-layer-06-maritime-mvp/FETCHING_DESIGN.md`

### Outputs
- Minimal proof script (single file or small module)
- Raw AIS messages saved to `raw/layer_06_maritime/aisstream/{yyyy}/{mm}/{dd}/run_{timestamp}/`
- `raw_messages.jsonl` with real AIS data
- `metadata.json` with run summary
- `preview.json` with first 10 messages
- Proof report (message count, types, fields observed)

### Acceptance Criteria
- [ ] AISStream WebSocket connection succeeds
- [ ] At least 100 real AIS messages received
- [ ] Raw messages saved to disk
- [ ] PositionReport messages observed
- [ ] ShipStaticData messages observed
- [ ] Actual message fields documented
- [ ] API key never printed or stored in raw files
- [ ] HANDOFF_LOG.md updated

### Validation Commands
```bash
git status --short --branch
git diff --stat
git diff --check
# Verify raw data exists
dir raw\layer_06_maritime\aisstream\
```

### Reviewer Checklist
- [ ] Real data received (not mocked)
- [ ] API key not leaked
- [ ] Raw files saved correctly
- [ ] Message structure matches (or differs from) planning assumptions
- [ ] No database writes during proof

### Handoff Requirements
- Provide raw message samples for normalization planning
- Confirm actual field names and types
- Feed into WO-MAR-F, WO-MAR-N, WO-MAR-D

---

## WO-MAR-F: Fetcher Implementation

### Lane
Fetching Worker

### Goal
Implement the full AISStream fetcher with proof mode, raw capture mode, and normalize-from-cache mode. Based on confirmed raw data structure from WO-MAR-S.

### Allowed Files
- `services/fetch-orchestrator/src/layers/layer_06_maritime/` (all fetcher files)
- `tests/data/layer_06_maritime/` (fetcher tests)
- `docs/state/HANDOFF_LOG.md`

### Disallowed Files
- `apps/` (no frontend)
- `database/` (no migrations)
- `packages/contracts/` (no API contracts)
- `raw/` (read only — raw data from WO-MAR-S)

### Inputs
- Raw data samples from WO-MAR-S
- Confirmed message shapes from WO-MAR-R
- `specs/005-layer-06-maritime-mvp/FETCHING_DESIGN.md`

### Outputs
- `aisstream_client.py` — WebSocket connection, message receive loop
- `ais_message_parser.py` — Parse raw AIS JSON
- `maritime_fetcher.py` — Orchestrates fetch run, manages modes
- `maritime_raw_storage.py` — Write/read raw messages to disk
- Tests for all fetcher modules

### Acceptance Criteria
- [ ] Fetcher connects to AISStream WebSocket
- [ ] Proof mode captures 60s/100 messages
- [ ] Raw capture mode works for longer durations
- [ ] Normalize-from-cache mode reads raw and outputs normalized
- [ ] API key read from environment only
- [ ] No secret leakage
- [ ] All tests pass
- [ ] HANDOFF_LOG.md updated

### Validation Commands
```bash
python -m pytest tests/data/layer_06_maritime -q
python -m compileall services/fetch-orchestrator/src/layers/layer_06_maritime
git diff --check
```

### Reviewer Checklist
- [ ] All fetcher modules implemented
- [ ] Tests comprehensive
- [ ] No secrets in code or output
- [ ] Raw storage follows project conventions
- [ ] CLI modes work as designed

### Handoff Requirements
- Provide fetcher for normalization integration
- Document any runtime issues

---

## WO-MAR-N: Normalization Implementation

### Lane
Fetching Worker

### Goal
Implement normalization of raw AIS messages into standard vessel/position schema. Join PositionReport and ShipStaticData by MMSI.

### Allowed Files
- `services/fetch-orchestrator/src/layers/layer_06_maritime/` (normalizer files)
- `services/normalizer/src/layers/layer_06_maritime/` (if project convention separates normalizer)
- `tests/data/layer_06_maritime/` (normalizer tests)
- `docs/state/HANDOFF_LOG.md`

### Disallowed Files
- `apps/` (no frontend)
- `database/` (no migrations)
- `packages/contracts/` (no API contracts)

### Inputs
- Fetcher output (raw messages)
- Confirmed message shapes from WO-MAR-S
- `specs/005-layer-06-maritime-mvp/NORMALIZATION_DESIGN.md`

### Outputs
- Normalized vessel/position objects
- Tests for normalization logic
- Verified field mapping

### Acceptance Criteria
- [ ] PositionReport normalized to standard schema
- [ ] ShipStaticData normalized to standard schema
- [ ] Join by MMSI produces complete vessel objects
- [ ] Partial data handled (position without static, static without position)
- [ ] Navigation status codes mapped to text
- [ ] Ship type codes mapped to human-readable strings
- [ ] All tests pass
- [ ] HANDOFF_LOG.md updated

### Validation Commands
```bash
python -m pytest tests/data/layer_06_maritime -q
python -m compileall services/fetch-orchestrator/src/layers/layer_06_maritime
git diff --check
```

### Reviewer Checklist
- [ ] All fields match confirmed raw data
- [ ] No invented fields
- [ ] Partial data handling robust
- [ ] Tests comprehensive

### Handoff Requirements
- Provide normalized object schema for database and API design
- Feed field list into WO-MAR-D and WO-MAR-A

---

## WO-MAR-D: Database Schema

### Lane
Database Worker

### Goal
Create PostGIS database schema for maritime data. Tables for sources, fetch runs, raw messages, vessels, latest positions, position history.

### Allowed Files
- `database/migrations/layers/layer_06_maritime/` (migration files)
- `tests/data/layer_06_maritime/` (schema tests)
- `docs/state/HANDOFF_LOG.md`

### Disallowed Files
- `apps/` (no frontend)
- `services/fetch-orchestrator/` (no fetcher changes)
- `packages/contracts/` (no API contracts)

### Inputs
- Confirmed normalized object schema from WO-MAR-N
- `specs/005-layer-06-maritime-mvp/DATABASE_PLANNING.md`

### Outputs
- Database migration files
- Schema tests
- Verified table structures

### Acceptance Criteria
- [ ] All tables created (maritime_sources, maritime_fetch_runs, maritime_raw_messages, maritime_vessels, maritime_positions_latest, maritime_position_history)
- [ ] PostGIS geometry columns and spatial indexes
- [ ] MMSI uniqueness constraints
- [ ] Latest position upsert logic works
- [ ] Indexes for bbox, vessel type, MMSI queries
- [ ] All tests pass
- [ ] HANDOFF_LOG.md updated

### Validation Commands
```bash
python -m pytest tests/data/layer_06_maritime -q
# Database migration test
git diff --check
```

### Reviewer Checklist
- [ ] Schema matches planning document
- [ ] PostGIS spatial indexes correct
- [ ] Upsert logic handles conflicts
- [ ] No data leaks in migration

### Handoff Requirements
- Provide schema for API implementation
- Feed table/column names into WO-MAR-A

---

## WO-MAR-A: API Implementation

### Lane
API Worker

### Goal
Implement REST API endpoints for maritime data. Vessel listing, detail, stats, bbox queries.

### Allowed Files
- `apps/api/src/routes/layers/layer_06_maritime/` (route files)
- `packages/contracts/` (maritime API contracts)
- `tests/api/` (API tests)
- `docs/state/HANDOFF_LOG.md`

### Disallowed Files
- `services/` (no fetcher changes)
- `apps/web/` (no frontend)
- `database/` (no migration changes)

### Inputs
- Database schema from WO-MAR-D
- Normalized object schema from WO-MAR-N
- `specs/005-layer-06-maritime-mvp/API_PLANNING.md`

### Outputs
- REST API endpoints
- TypeScript contracts
- API tests

### Acceptance Criteria
- [ ] GET /api/layers/layer_06_maritime/objects works
- [ ] bbox filter works
- [ ] vessel_type filter works
- [ ] MMSI search works
- [ ] GET /api/layers/layer_06_maritime/objects/:id works
- [ ] GET /api/layers/layer_06_maritime/stats works
- [ ] Response schema matches planning
- [ ] All tests pass
- [ ] HANDOFF_LOG.md updated

### Validation Commands
```bash
pnpm --filter api test
pnpm --filter api build
pnpm --filter @god-eyes/contracts build
git diff --check
```

### Reviewer Checklist
- [ ] All endpoints implemented per contract
- [ ] Response schema matches planning
- [ ] Filters work correctly
- [ ] Error responses proper
- [ ] No secrets in responses

### Handoff Requirements
- Provide API contracts for frontend
- Feed endpoint URLs into WO-MAR-U

---

## WO-MAR-U: Frontend Integration

### Lane
Frontend Worker

### Goal
Implement Cesium globe rendering for maritime vessels. Ship markers with heading, click card, source attribution, layer toggle.

### Allowed Files
- `apps/web/src/layers/layer_06_maritime/` (all frontend files)
- `docs/state/HANDOFF_LOG.md`

### Disallowed Files
- `services/` (no fetcher)
- `database/` (no migrations)
- `apps/api/` (no API changes)
- `packages/contracts/` (read only — consume existing contracts)

### Inputs
- API contracts from WO-MAR-A
- `specs/005-layer-06-maritime-mvp/FRONTEND_PLANNING.md`

### Outputs
- Maritime layer Cesium components
- Vessel markers with heading
- Click card
- Layer toggle
- Source attribution

### Acceptance Criteria
- [ ] Maritime layer toggle in LayerPanel
- [ ] Vessel markers render at real positions
- [ ] Markers show heading direction
- [ ] Color matches vessel type
- [ ] Click marker opens detail card
- [ ] Detail card shows all required fields
- [ ] Stale markers visually dimmed
- [ ] Data refreshes via REST polling
- [ ] Source attribution visible
- [ ] No console errors
- [ ] 60 FPS maintained
- [ ] Existing layers unaffected
- [ ] HANDOFF_LOG.md updated

### Validation Commands
```bash
pnpm --filter web build
pnpm --filter @god-eyes/contracts build
git diff --check
```

### Reviewer Checklist
- [ ] Markers render at correct positions
- [ ] Heading arrow visible
- [ ] Click card functional
- [ ] No fake data
- [ ] Performance acceptable

### Handoff Requirements
- Provide frontend for full layer validation

---

## WO-MAR-V: Full Layer Validation

### Lane
Review Worker

### Goal
End-to-end validation of the Maritime layer. Verify data pipeline, API, frontend integration. Manual browser verification.

### Allowed Files
- `docs/state/HANDOFF_LOG.md` (review notes)
- `docs/state/INTEGRATION_REVIEW_WO-MAR*.md`

### Disallowed Files
- No code changes (review only)

### Inputs
- All WO-MAR-* outputs
- `specs/005-layer-06-maritime-mvp/` (all spec documents)

### Outputs
- Integration review document
- Validation report
- Pass/fail determination

### Acceptance Criteria
- [ ] Real AIS data flows end-to-end
- [ ] API returns real vessel data
- [ ] Frontend renders real vessels on globe
- [ ] Click card shows real vessel info
- [ ] No fake data anywhere
- [ ] Performance targets met
- [ ] No security issues
- [ ] Documentation complete

### Validation Commands
```bash
# Full build and test
pnpm --filter @god-eyes/contracts build
pnpm --filter api build
pnpm --filter api test
pnpm --filter web build
python -m pytest tests/data/layer_06_maritime -q
git status --short --branch
git diff --stat
git diff --check
```

### Reviewer Checklist
- [ ] End-to-end data flow verified
- [ ] Real data confirmed (not mocked)
- [ ] All acceptance criteria met
- [ ] No regressions in other layers

### Handoff Requirements
- If PASS: Kiro pushes to origin
- If FAIL: Document issues, create follow-up WOs
