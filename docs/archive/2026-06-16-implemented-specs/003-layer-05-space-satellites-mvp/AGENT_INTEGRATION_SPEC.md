# Agent Integration Specification: Layer 05 Space & Satellites

**Control Agent**: Kiro CLI  
**Status**: Specification (Not Implemented)

---

## Multi-Agent Workflow Overview

The Space & Satellites MVP is implemented by five specialized agents working in parallel:

| Agent | Role | Worktree | Branch | Owner |
|-------|------|----------|--------|-------|
| Kiro CLI | Control, integration, review coordination | E:\god-eyes | main (control) | Orchestrator |
| Codex | Database schema, migrations, storage | E:\god-eyes-db | agent/wo-xxx-database | Codex LLM |
| MiniMax | Fetcher/normalizer, data pipeline | E:\god-eyes-fetching | agent/wo-xxx-fetching | MiniMax LLM |
| DeepSeek | API endpoints, WebSocket, position computation | E:\god-eyes-api | agent/wo-xxx-api | DeepSeek LLM |
| Sonnet 4.6 | Frontend rendering, Cesium integration | E:\god-eyes-frontend | agent/wo-xxx-frontend | Sonnet 4.6 LLM |

**Review Agent**: Claude Haiku 4.5 (validates specifications and implementation)

---

## Work Order Decomposition

The feature is decomposed into five parallel work orders:

### WO-085A: Database Lane (Codex)

**Scope**:
- Create database schema for `orbital_objects` table
- Create supporting tables (`orbital_tle_history`, `orbital_positions_cache`)
- Create indexes for filtering performance
- Document schema design decisions
- Create migration SQL files in `database/migrations/layers/layer_05_space_satellites/`

**Deliverables**:
- `database/migrations/layers/layer_05_space_satellites/001_orbital_objects.sql`
- `database/migrations/layers/layer_05_space_satellites/002_orbital_tle_history.sql` (optional)
- `database/migrations/layers/layer_05_space_satellites/003_indexes.sql`
- Schema documentation with usage examples

**Success Criteria**:
- ✅ Schema supports required fields and constraints
- ✅ Indexes created for filtering (category, object_type, orbit_class)
- ✅ Migrations are idempotent and ordered
- ✅ UPSERT logic for duplicate handling

**Forbidden Folders**: Cannot modify API, frontend, fetcher code

**Dependencies**: None (can start immediately)

---

### WO-085B: Fetcher/Normalizer Lane (MiniMax)

**Scope**:
- Build fetcher to retrieve data from CelesTrak
- Build normalizer to parse TLEs and satellite catalog JSON
- Implement classification rules (Starlink, Comms, Navigation, etc.)
- Implement orbit class computation
- Handle Space-Track authenticated data (optional, environment variables)
- Store raw data locally before normalization
- Call database layer (Codex) with normalized objects

**Deliverables**:
- `services/fetch-orchestrator/` with CelesTrak fetcher
- `services/normalizer/` with TLE parser, classifier, orbit computations
- Configuration for fetch frequency (6-hour cycle)
- Error handling and retry logic
- Logging and monitoring hooks

**Success Criteria**:
- ✅ Successfully fetches from CelesTrak (public data)
- ✅ Parses TLE format correctly (validates NORAD ID, epoch, orbital elements)
- ✅ Classifies objects into correct categories
- ✅ Computes orbit class (VLEO/LEO/MEO/GEO/HEO)
- ✅ Computes semi-major axis and orbital velocity
- ✅ Handles errors gracefully (network failures, parse errors)
- ✅ No API keys exposed in logs or code
- ✅ Upserts normalized data to database successfully

**Forbidden Folders**: Cannot modify database migrations, API code, frontend code

**Dependencies**: WO-085A (database schema must exist)

---

### WO-085C: API Lane (DeepSeek)

**Scope**:
- Implement REST endpoints in `apps/api/`
  - `GET /api/layer-05/satellites` (list with filters)
  - `GET /api/layer-05/satellites/:id` (detail with position)
  - `GET /api/layer-05/position/:id` (lightweight position)
  - `GET /api/layer-05/positions` (bulk position)
  - `GET /api/layer-05/categories` (category stats)
  - `GET /api/layer-05/orbit-classes` (orbit class stats)
- Implement WebSocket endpoint `/ws/layer-05/positions` (streaming positions)
- Implement SGP4 position computation from TLE
- Add filtering, pagination, sorting
- Cache strategy for position computation
- Error handling and validation

**Deliverables**:
- `apps/api/src/routes/layer-05/` with endpoint implementations
- `apps/api/src/services/layer-05-satellite-service.ts` with business logic
- `apps/api/src/services/tle-propagator.ts` with SGP4 integration
- WebSocket handler for position streaming
- Input validation schemas
- API tests with mock data

**Success Criteria**:
- ✅ All endpoints implemented per API contract
- ✅ Responses match schema exactly
- ✅ Filtering works (category, altitude, type, operator)
- ✅ Pagination supports limit/offset
- ✅ WebSocket connects and streams positions every 5 seconds
- ✅ Position computation uses SGP4 (via skyfield or similar)
- ✅ Positions marked with "estimated" and data age
- ✅ Error responses return proper HTTP status codes
- ✅ No API keys exposed in responses

**Forbidden Folders**: Cannot modify database schema, frontend code, fetcher code

**Dependencies**: WO-085A (database must exist with sample data)

---

### WO-085D: Frontend Lane (Sonnet 4.6)

**Scope**:
- Build Cesium globe integration for Space & Satellites layer in `apps/web/`
- Implement satellite rendering (dots) and debris rendering (triangles)
- Implement color schemes (by altitude or category)
- Implement filter panel (category, type, altitude range, operator)
- Implement detail panel (click to show object metadata)
- Implement WebSocket integration for real-time position updates
- Implement layer toggle to enable/disable layer
- Responsive design for desktop

**Deliverables**:
- `apps/web/src/layers/layer-05-space-satellites/` directory structure
- `SpaceSatellitesLayer.tsx` (main layer component)
- `SatelliteRenderer.tsx` (Cesium entity rendering)
- `FilterPanel.tsx` (filter controls)
- `DetailPanel.tsx` (metadata display)
- `WebSocketManager.ts` (position streaming)
- Color palette configuration
- Tests with mock API responses

**Success Criteria**:
- ✅ Layer appears in layer list and can be toggled on/off
- ✅ Satellites render as colored dots
- ✅ Debris renders as colored triangles
- ✅ Important satellites highlighted (larger/glow)
- ✅ Filters apply correctly (refresh entities)
- ✅ Detail panel shows all required fields
- ✅ WebSocket connects and updates positions smoothly
- ✅ Color schemes match spec (no black/white primary colors)
- ✅ No console errors or warnings (clean logs)
- ✅ Works on desktop at various zoom levels

**Forbidden Folders**: Cannot modify database schema, API code, fetcher code

**Dependencies**: WO-085C (API must exist with endpoints and WebSocket)

---

### WO-085E: Integration & Testing (Kiro CLI)

**Scope**:
- Review all four lanes for completeness and correctness
- Create integration test suite (`tests/integration/layer-05/`)
- Manual browser verification checklist
- Performance testing (load 5000+ objects, WebSocket throughput)
- Documentation audit
- Create final INTEGRATION_REVIEW document
- Coordinate with all agents for any fixes

**Deliverables**:
- `tests/integration/layer-05/full-stack.test.ts`
- Integration test scenarios:
  - Fetch satellites → normalize → store → API query → frontend render
  - Filter → API returns correct subset → frontend updates
  - Click satellite → detail panel shows correct data
  - WebSocket subscription → receive updates → positions update
- Manual verification checklist (browser tests)
- Performance report (load times, memory usage, WebSocket latency)
- `docs/state/INTEGRATION_REVIEW_WO-085.md`
- README in `specs/003-layer-05-space-satellites-mvp/` summarizing completion

**Success Criteria**:
- ✅ All integration tests pass
- ✅ Manual verification checklist 100% complete
- ✅ No blocking issues remain
- ✅ Performance meets targets
- ✅ All specs match implementation
- ✅ Code review sign-offs from all agents

---

## Work Order Structure

Each work order follows this template:

```
docs/work-orders/WO-085<X>-layer-05-<lane>.md

# WO-085<X>: Layer 05 Space & Satellites — <Lane>

## Objective
[Lane-specific goal]

## Scope
[What is included]
[What is NOT included]

## Acceptance Criteria
[Success metrics]

## Deliverables
[Files/code to produce]

## Implementation Notes
[Technical decisions, blockers, dependencies]

## Start Date
[UTC timestamp]

## Estimated Effort
[Hours or story points]
```

---

## Branch & Commit Strategy

Each agent follows `GIT_WORKFLOW_POLICY.md`:

**Branch Naming**:
- `agent/wo-085a-database-layer-05`
- `agent/wo-085b-fetching-layer-05`
- `agent/wo-085c-api-layer-05`
- `agent/wo-085d-frontend-layer-05`
- `agent/wo-085e-integration-layer-05`

**Commit Format**:
```
feat(layer-05): Brief description

Agent: [Codex/MiniMax/DeepSeek/Sonnet 4.6]
Work Order: WO-085[X]
LLM Model: [Claude/GPT/etc.]
Tool/CLI: [VSCode/vim/etc.]
Branch: agent/wo-085[x]-*
Start Time UTC: 2026-05-31T10:00:00Z
End Time UTC: 2026-05-31T14:00:00Z
Summary: [Detailed summary]
Commands Run: [Key commands]
Known Issues: [Any blockers or follow-up work]
Forbidden Folders: [Confirm no violations]
```

**One Commit Per Agent**: Each agent creates exactly one commit per work order (squash if needed before handing to Kiro).

---

## Handoff Log Entry

After each agent completes their work, they update `docs/state/HANDOFF_LOG.md`:

```markdown
## WO-085[X]: Layer 05 Space & Satellites — <Lane>

| Field | Value |
|-------|-------|
| Work Order | WO-085[X] |
| Agent | [Codex/MiniMax/DeepSeek/Sonnet 4.6] |
| LLM Model | [e.g., Claude Haiku 4.5] |
| Tool/CLI | VSCode |
| Branch | agent/wo-085[x]-... |
| Start Time UTC | 2026-05-31T10:00:00Z |
| End Time UTC | 2026-05-31T14:00:00Z |
| Commit Hash | abc123def456 |
| Push Status | Local (ready for Kiro review) |
| Files Changed | 12 files |
| Commands Run | git, npm, database migrations |
| Review Status | ⏳ Awaiting Kiro integration review |
```

---

## Integration Review Process

**Kiro CLI** performs integration review:

1. **Code Review**: Check all commits for:
   - Correctness per spec
   - No forbidden folder violations
   - No API keys exposed
   - Clean logs

2. **Merge Validation**: Ensure branches merge cleanly

3. **Integration Tests**: Run full-stack tests

4. **Performance Check**: Verify targets met

5. **Documentation**: Verify all specs match implementation

6. **Approval**: Create `docs/state/INTEGRATION_REVIEW_WO-085.md`

```markdown
# Integration Review: WO-085 (Layer 05 Space & Satellites)

## Status: ✅ PASS

### Database Lane (WO-085A)
- ✅ Schema correct
- ✅ Migrations idempotent
- ✅ Indexes created

### Fetcher Lane (WO-085B)
- ✅ CelesTrak fetch working
- ✅ TLE parsing correct
- ✅ Classification rules applied
- ⚠️ Space-Track optional (skipped for MVP)

### API Lane (WO-085C)
- ✅ All endpoints working
- ✅ WebSocket streaming
- ✅ Position computation correct

### Frontend Lane (WO-085D)
- ✅ Satellites render as dots
- ✅ Debris renders as triangles
- ✅ Filters functional
- ✅ Detail panel complete

### Integration (WO-085E)
- ✅ Full-stack tests pass
- ✅ Manual verification complete
- ✅ Performance targets met

## Issues Found: None

## Approved For Merge: YES
```

7. **Push to Main**: If PASS, Kiro pushes all branches to main

---

## Worktree Management

Each agent clones a dedicated worktree:

```bash
# Kiro setup
git clone https://github.com/ashishkumar62649/god-eyes.git E:\god-eyes

# Codex setup
git clone https://github.com/ashishkumar62649/god-eyes.git E:\god-eyes-db
cd E:\god-eyes-db
git checkout -b agent/wo-085a-database-layer-05

# MiniMax setup
git clone https://github.com/ashishkumar62649/god-eyes.git E:\god-eyes-fetching
cd E:\god-eyes-fetching
git checkout -b agent/wo-085b-fetching-layer-05

# DeepSeek setup
git clone https://github.com/ashishkumar62649/god-eyes.git E:\god-eyes-api
cd E:\god-eyes-api
git checkout -b agent/wo-085c-api-layer-05

# Sonnet 4.6 setup
git clone https://github.com/ashishkumar62649/god-eyes.git E:\god-eyes-frontend
cd E:\god-eyes-frontend
git checkout -b agent/wo-085d-frontend-layer-05

# Claude Haiku 4.5 setup (review)
git clone https://github.com/ashishkumar62649/god-eyes.git E:\god-eyes-review
cd E:\god-eyes-review
git checkout -b agent/wo-085e-integration-layer-05
```

---

## Parallel Execution Timeline

**Optimal Schedule** (all lanes start simultaneously):

```
Day 1 (Wed, May 31)
├─ 10:00 UTC: All agents start
├─ Codex: Database schema design & SQL (2-3 hours)
├─ MiniMax: Fetcher & normalizer setup (4-5 hours)
├─ DeepSeek: API endpoint scaffolding (4-5 hours)
├─ Sonnet 4.6: Frontend component structure (3-4 hours)

Day 2 (Thu, Jun 1)
├─ Codex: Migrations tested, documentation complete
├─ MiniMax: Full normalizer pipeline tested end-to-end
├─ DeepSeek: API endpoints returning mock data
├─ Sonnet 4.6: Cesium rendering working

Day 3 (Fri, Jun 2)
├─ All agents: Integration testing & fixes
├─ Claude Haiku 4.5: Full-stack verification
├─ Kiro: Merge review & push to main

Estimated Total Effort: 20-25 engineer-hours
```

---

## Communication Channels

- **Status Updates**: Daily standup (optional, via chat)
- **Blockers**: Immediate escalation to Kiro
- **Questions**: Ask in shared work order document
- **Review**: GitHub pull request comments (post-integration)

---

## Post-MVP Work

After Layer 05 Space & Satellites is merged:

1. **WO-086**: Starlink constellation links (estimated feature)
2. **WO-087**: Historical TLE playback
3. **WO-088**: Collision prediction alerts
4. **WO-089**: Mobile optimization

---

**Integration Spec Status**: ✅ Complete  
**All Five Lanes**: ⏳ Ready for parallel execution  
**Review Agent**: Claude Haiku 4.5 (ready to validate)

---

**Specification Complete**: ✅ All five specifications are finalized and ready for agent implementation.
