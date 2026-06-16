# Specification: 005-Layer-06-Maritime-MVP

## Feature Identity
- **Spec ID**: 005-layer-06-maritime-mvp
- **Layer ID**: layer_06_maritime
- **Layer Name**: Maritime
- **Phase**: MVP
- **Status**: PLANNING
- **Layer Registry Status**: coming_soon (MVP_LAYER_REGISTRY.md line 19)

---

## Executive Summary

The Maritime / Live Ships layer enables users to visualize real vessel positions on the GOD EYES globe using live AIS (Automatic Identification System) data. This layer fetches actual ship position reports via AISStream WebSocket, normalizes them into a standard vessel/position schema, stores them in a PostGIS database, and renders them as heading-aware ship markers on the Cesium globe.

This is the first live maritime data layer in GOD EYES. The MVP focuses on proving that real AIS data is fetchable, inspectable, and renderable — not on comprehensive vessel intelligence.

---

## Layer Goal

Prove that real, live AIS vessel position data can be fetched from a public source, normalized, stored, queried via API, and rendered as interactive ship markers on the globe.

---

## User-Facing Outcome

Users can:
1. Enable the Maritime layer on the GOD EYES globe
2. See real ship positions as colored dots/markers on the ocean
3. See vessel heading/course direction on each marker
4. Click a ship marker to view a detail card (vessel name, MMSI, type, speed, course, destination)
5. Understand data currency (last updated timestamp)
6. Filter by vessel type (cargo, tanker, passenger, etc.)

---

## In Scope (MVP)

- AISStream WebSocket connection and raw message capture
- Proof mode: capture 60 seconds or 100 messages of real AIS data
- Raw message storage before normalization
- Normalization of AISStream PositionReport and ShipStaticData messages
- PostGIS database schema with latest-position upsert and position history
- REST API endpoints for vessel queries (bbox, vessel type, MMSI search)
- Frontend: ship markers with heading arrow, click card, source attribution
- Stale marker handling (vessels not updated in X minutes shown dimmed)
- All vessel types (cargo, tanker, passenger, fishing, etc.)

---

## Out of Scope (MVP)

- Historical playback / timeline scrubbing
- Voyage tracking / route history visualization
- Port database / port proximity alerts
- Vessel-to-vessel interaction analysis
- Weather overlay correlation
- AIS transponder-level data (AtoN, SAR, etc.)
- Multiple simultaneous AIS sources
- Real-time WebSocket/SSE push to frontend (REST polling first)
- Vessel risk scoring or anomaly detection
- Authentication/authorization for API beyond existing layer

---

## MVP Definition

The MVP is complete when:
1. A real AISStream WebSocket connection captures live AIS messages
2. Raw messages are saved to disk before any processing
3. Messages are normalized into a standard vessel + position schema
4. Data is stored in PostGIS with latest-position upsert
5. API returns vessel data that the frontend can query
6. Frontend renders real ship markers with heading direction
7. Click on a ship shows a detail card with vessel info
8. Data freshness / staleness is visible to the user
9. No fake or demo data is used anywhere

---

## Non-MVP Future Expansion

- Historical position trails / path rendering
- Port proximity markers and anchorage zones
- Voyage AIS (destination, ETA) trend analysis
- Vessel clustering at high zoom-out levels
- Speed heatmaps / traffic density overlays
- Multi-source AIS fusion (AISStream + BarentsWatch + others)
- AIS message type coverage (AtoN, weather, etc.)
- Mobile-optimized vessel tracking
- Vessel search by name/MMSI with autocomplete
- Export vessel positions as GeoJSON

---

## Source-First Rule

**No full fetcher/database/API/frontend implementation starts before fetch proof succeeds.**

WO-MAR-S may create the smallest possible proof script needed to connect to AISStream, capture real messages, and save raw proof files. Phase 1 (WO-MAR-R / WO-MAR-S) must succeed before any implementation work begins:
- Prove AISStream WebSocket connection works
- Prove real AIS messages are received
- Inspect raw message structure
- Confirm data fields match expected schema
- Document any discrepancies

---

## Raw-Data-First Rule

**Raw messages are always saved before normalization.**

The fetcher must write raw AIS messages to disk before the normalizer reads them. This ensures:
- Auditability: raw evidence is preserved
- Replay: normalization can be re-run from raw data
- Debugging: raw data is available when normalization fails

---

## No Fake Real-Time Rule

**The system must never fabricate vessel positions or simulate movement.**

- All displayed vessel data must originate from real AIS messages
- If the AISStream connection drops, markers become stale (not replaced with fake data)
- If no data is available, the layer shows an empty state — never placeholder markers
- Interpolation between position updates is explicitly not in scope for MVP

---

## Acceptance Criteria

### Data Pipeline
- [ ] AISStream WebSocket connects successfully with valid API key
- [ ] Raw AIS messages are received and counted
- [ ] Raw messages are saved to `raw/layer_06_maritime/aisstream/...`
- [ ] PositionReport messages are normalized to standard vessel position schema
- [ ] ShipStaticData messages are normalized to standard vessel static schema
- [ ] Position and static data are joined by MMSI
- [ ] PostGIS tables are created with correct schema
- [ ] Latest position upsert works correctly
- [ ] Position history is recorded

### API
- [ ] GET /api/layers/layer_06_maritime/objects returns vessel data
- [ ] bbox filter works
- [ ] vessel_type filter works
- [ ] MMSI search works
- [ ] Response includes coordinates, heading, speed, vessel info

### Frontend
- [ ] Maritime layer toggle appears in LayerPanel
- [ ] Ship markers render on globe at real positions
- [ ] Markers show heading/course direction
- [ ] Click on marker opens detail card
- [ ] Detail card shows: vessel name, MMSI, type, speed, course, destination, last updated
- [ ] Stale markers are visually distinct
- [ ] Source attribution displayed
- [ ] No console errors
- [ ] 60 FPS maintained

### Rules
- [ ] No API keys committed or printed
- [ ] No fake data used
- [ ] Raw data saved before normalization
- [ ] All work within allowed folders only

---

## Layer Status

**PLANNING** — Spec kit in progress. No implementation started.

| Phase | Status |
|-------|--------|
| Planning | In Progress |
| Source Research | Pending |
| Fetch Proof | Pending |
| Implementation | Pending |
| API | Pending |
| Frontend | Pending |
| Validation | Pending |

---

## References & Resources

- **AISStream**: https://aisstream.io/
- **AISStream API Docs**: https://aisstream.io/documentation
- **MVP_LAYER_REGISTRY.md**: Authoritative layer definitions
- **LAYER_ID_CONVENTIONS.md**: Naming and folder conventions
- **SOURCE_TO_FRONTEND_CONTRACT.md**: Source contract requirements
- **PIPELINE_HANDOFF_RULES.md**: Data flow between agents
- **DATA_LOCATION_RULES.md**: Where files go
- **GOD EYES AGENTS.md**: Multi-agent workflow rules

---

**Specification Status**: Planning (not implemented)
