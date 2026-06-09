# Open Questions: Maritime / Live Ships Layer

## Confirmed Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Layer ID | `layer_06_maritime` | Already registered in MVP_LAYER_REGISTRY.md (line 19) |
| Spec folder number | 005 | Next sequential after 004 (energy infrastructure) |
| Primary MVP source | AISStream | Free API key, WebSocket real-time, global coverage |
| MVP scope | All vessel types | Start broad, filter later |
| First visual target | Ship dots + heading + click card | Per user decision |
| Source-first rule | Enforced | No full implementation before fetch proof succeeds |

---

## Questions Requiring Decision

### 1. Global Bbox / Subscription Strategy

**Question**: Does AISStream free tier support global subscription (all vessels worldwide), or must we use geographic bounding boxes?

**Impact**: If global subscription exceeds free tier limits, we need to define initial bounding boxes.

**Options**:
- A) Subscribe to all vessels globally (simplest, may exceed limits)
- B) Define 3-5 major shipping region bounding boxes (e.g., Strait of Malacca, English Channel, US East Coast, Suez Canal, Panama Canal)
- C) Start with single bounding box, expand as needed

**Recommendation**: Start with option A (global). If rate-limited, fall back to option B.

**Status**: TBD — resolve in WO-MAR-S (fetch proof)

---

### 2. Proof Run Duration

**Question**: Should the initial proof run be limited by time (60 seconds) or message count (100 messages)?

**Impact**: Determines how much data we capture for initial inspection.

**Options**:
- A) 60 seconds OR 100 messages (whichever first) — fast iteration
- B) 60 seconds OR 500 messages — more data for inspection
- C) 5 minutes OR 1000 messages — thorough proof

**Recommendation**: Option A for first proof. Can re-run with longer duration if needed.

**Status**: TBD — resolve in WO-MAR-S

---

### 3. Are All Vessels Too Many for First Viewport?

**Question**: When zoomed out to global view, will all AIS vessels overwhelm the renderer?

**Impact**: If too many markers, FPS drops. Need viewport limiting or clustering strategy.

**Current estimate**: ~300,000+ active AIS vessels globally. Cesium can handle ~5,000-10,000 markers at 60 FPS.

**Options**:
- A) Load all vessels globally (may be too many)
- B) Viewport-based loading (only load what's visible)
- C) Global cap (e.g., 5000 vessels max, priority by vessel type)
- D) Combination: viewport at high zoom, cap at low zoom

**Recommendation**: Option D. Viewport-based at detailed zoom, cap at global zoom.

**Status**: TBD — resolve in WO-MAR-U (frontend)

---

### 4. Database Retention Strategy

**Question**: How long should position history be retained?

**Impact**: Database growth rate. 300k vessels × 1 position/minute = ~432M rows/day.

**Options**:
- A) Keep all history (unlimited growth)
- B) Retain 7 days, auto-delete older
- C) Retain 30 days, partition by month
- D) Keep latest position only (no history)

**Recommendation**: Option D for MVP (latest position only). Add history retention later.

**Status**: TBD — resolve in WO-MAR-D

---

### 5. Frontend Marker Density Strategy

**Question**: How should the frontend handle dense vessel areas (major ports, straits)?

**Impact**: Visual clutter, performance.

**Options**:
- A) Show all markers regardless of density
- B) Cluster markers at low zoom levels
- C) Limit markers by zoom level
- D) Show aggregate count at low zoom

**Recommendation**: Option C for MVP (limit by zoom level), add clustering later.

**Status**: TBD — resolve in WO-MAR-U

---

### 6. Fallback Sources if AISStream Fails

**Question**: If AISStream free tier is insufficient or unreliable, what's the backup?

**Impact**: Layer availability if primary source fails.

**Options**:
- A) No fallback (MVP accepts single source risk)
- B) BarentsWatch (regional fallback)
- C) AISHub (requires data contribution)
- D) Pre-recorded data for demo (violates no-fake-data rule — rejected)

**Recommendation**: Option A for MVP. Document fallback sources for future WOs.

**Status**: TBD — acceptable risk for MVP

---

### 7. API Key Handling

**Question**: Should the AISStream API key be stored in `.env` only, or also in a secrets manager?

**Impact**: Security posture.

**Current state**: API key is already in local `.env` (not committed).

**Recommendation**: `.env` only for MVP. Secrets manager for production.

**Status**: Confirmed — `.env` only

---

### 8. Refresh / Update Limits

**Question**: What's the maximum data refresh rate for the frontend?

**Impact**: API load, data freshness.

**Options**:
- A) 30-second polling (conservative)
- B) 10-second polling (more responsive)
- C) 60-second polling (minimal load)

**Recommendation**: Option A (30 seconds) for MVP.

**Status**: TBD — resolve in WO-MAR-U

---

### 9. AISStream Message Types to Subscribe To

**Question**: Which AISStream message types should we subscribe to?

**Impact**: Data completeness.

**Expected types**:
- PositionReport (Type 1/2/3) — essential
- ShipStaticData (Type 5) — essential for vessel identity
- StandardClassBCSPositionReport (Type 18) — smaller vessels
- LongRangeIntervalMessage (Type 27) — ocean passages

**Recommendation**: Subscribe to all available types. Filter during normalization.

**Status**: TBD — resolve in WO-MAR-S

---

### 10. Vessel Type Filtering Granularity

**Question**: How granular should vessel type filtering be?

**Impact**: UI complexity.

**Options**:
- A) High-level only (cargo, tanker, passenger, fishing, other)
- B) Medium granularity (cargo, tanker, passenger, fishing, tug, military, pleasure, other)
- C) Full AIS ship type codes (20+ categories)

**Recommendation**: Option B for MVP.

**Status**: TBD — resolve in WO-MAR-U

---

## Resolved During Planning

| Question | Resolution |
|----------|------------|
| Layer ID | `layer_06_maritime` (confirmed from registry) |
| Spec number | 005 (next sequential) |
| Primary source | AISStream (free, WebSocket, global) |
| Source-first rule | Enforced — no full implementation before fetch proof |
| Raw-data-first rule | Enforced — raw saved before normalization |
| No fake data rule | Enforced — empty state if no data |

---

## Questions for Fetch Proof (WO-MAR-S)

These questions will be answered by the actual fetch proof:

1. What is the exact JSON message shape for PositionReport?
2. What is the exact JSON message shape for ShipStaticData?
3. What is the actual field list (are there extra or missing fields)?
4. What is the free tier rate limit?
5. Can we subscribe globally or need bounding boxes?
6. How many messages per second on free tier?
7. Is there a connection timeout?
8. Does AISStream send ping/pong?
9. What happens when the connection drops?
10. Are there any fields we didn't expect?

---

**Status**: Planning complete. Questions documented. Resolution deferred to appropriate work orders.
