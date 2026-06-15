# SR-004 — API Remaining Route Split Review

**Agent:** API Route Planning Agent
**Work order:** SR-004
**Branch:** api/contracts-and-api-structure
**Date:** 2026-06-15

---

## Route Inventory

| Route file | Lines | SQL query calls | rowTo* mappers | parse* helpers | Risk |
|---|---|---|---|---|---|
| `apps/api/src/routes/maritime.ts` | 797 | 6 | 5 | 15 | Medium |
| `apps/api/src/routes/energy/infrastructure.ts` | 683 | 6 | 3 | 6 | Medium |
| `apps/api/src/routes/space/satellites.ts` | 582 | 6 | 5 | 13 | High |
| `apps/api/src/routes/layers.ts` | 523 | 19 | 0 | 19 | High |
| `apps/api/src/routes/aviation-aircraft.ts` | 386 | 2 | 6 | 6 | Low |

All five files are in the 301–800 "warning / must-split" band per ENGINEERING_STRUCTURE_RULES.md §6.

---

## Per-File Analysis and Recommendation

### 1. `maritime.ts` (797 lines) — SPLIT IN NEXT MILESTONE

**Endpoints:** vessel objects list, single object, stats, position history by MMSI.
**Pattern:** 6 SQL calls, 5 mappers (`rowToVesselObject`, `rowToVesselDetail`, `rowToStats`,
`rowToPositionHistory`, `rowToVesselMarker`), 15 parse helpers (bbox, limit, offset, mmsi,
vessel_type, speed filters, `updated_since`).
**Split target:** `apps/api/src/routes/maritime/` with the standard 6-file pattern.
**Risk:** Medium. The bbox + geospatial ST_DWithin queries require careful parameterization
review during split. Position history query returns a large window. No WebSocket dependency.
**Decision:** SPLIT in SR-005A (next milestone). Does not need to land in this milestone.
**Proposed branch:** `api/sr-005a/maritime-route-split`

---

### 2. `energy/infrastructure.ts` (683 lines) — SPLIT IN NEXT MILESTONE

**Endpoints:** features list, single feature detail, categories, sources.
**Pattern:** 6 SQL calls, 3 mappers (`rowToFeature`, `rowToFeatureDetail`, `rowToCategory`),
6 parse helpers (limit, category, feature_type, source_id, bbox).
**Split target:** `apps/api/src/routes/energy/infrastructure/` — folder alongside the existing
`energy/infrastructure.ts` flat file, following the same pattern used for `space/satellites/`.
**Risk:** Medium. No WebSocket. Sources list is statically hardcoded (not DB-driven) — this
stays in `service.ts`.
**Decision:** SPLIT in SR-005B (next milestone).
**Proposed branch:** `api/sr-005b/energy-route-split`

---

### 3. `space/satellites.ts` (582 lines) — SPLIT IN NEXT MILESTONE, HIGHEST CARE

**Endpoints:** satellites list, single satellite detail, categories, WebSocket broadcaster
attach.
**Pattern:** 6 SQL calls, 5 mappers, 13 parse helpers. Additionally, the file imports and
wires the `SpaceSatellitesBroadcaster` class from `space-satellites-broadcaster.ts`. The
WebSocket broadcaster export (`attachSpaceSatellitesWebSocket`) is re-exported from this
file and consumed in `apps/api/src/index.ts`.
**Split target:** `apps/api/src/routes/space/satellites/` — the broadcaster stays at its
current path; only the REST handlers split.
**Risk:** High. The WebSocket broadcaster import and re-export must be preserved exactly
in the new `index.ts`. Any import path change in `apps/api/src/index.ts` must be tested.
**Decision:** SPLIT in SR-005C (next milestone), tackled last of the three due to WS risk.
**Proposed branch:** `api/sr-005c/space-satellites-route-split`

---

### 4. `layers.ts` (523 lines) — DEFER

**Endpoints:** layer registry listing, single layer, layer status endpoints (11 layers).
**Pattern:** 19 SQL calls (one per layer for status), 0 dedicated mappers (inline mapping),
19 parse-like constructions. The high SQL count is structural — each layer status endpoint
queries its own tables.
**Risk:** High. The per-layer status logic is tightly coupled to the layer registry. A split
would push 11 small status query functions into `repository.ts`, which would be large but
safe. However, adding a per-layer repository function requires understanding each layer's
schema. A refactor here is lower ROI than the three routes above.
**Decision:** DEFER. Revisit only if the file grows above 600 lines or if a dedicated
layer-status work order is created (e.g., SR-001 follow-up for layer status counts).
**Proposed future task ID:** SR-006 (layers.ts split) — deferred, not scheduled.

---

### 5. `aviation-aircraft.ts` (386 lines) — DEFER

**Endpoints:** aircraft latest list, single aircraft by source_object_id.
**Pattern:** 2 SQL calls, 6 mappers (`rowToAircraftObject`, `rowToAircraftDetail`, etc.),
6 parse helpers. File is in the 301–500 "warning band" but just barely. The aircraft
endpoints are already thin — most logic lives in the `airport-intelligence/` split.
**Risk:** Low. Splitting 386 lines buys minimal readability gain.
**Decision:** DEFER. Split only if future aviation work adds new endpoints that push the
file above 500 lines.
**Proposed future task ID:** SR-007 (aviation-aircraft split) — deferred, not scheduled.

---

## Recommended Split Order for Next Milestone

| Priority | Task ID | File | Lines | Reason |
|---|---|---|---|---|
| 1 | SR-005A | `maritime.ts` | 797 | Largest file; standard split pattern; no WS dependency |
| 2 | SR-005B | `energy/infrastructure.ts` | 683 | Second largest; simple split; static sources stay in service |
| 3 | SR-005C | `space/satellites.ts` | 582 | Third; requires WS re-export preservation |
| Defer | SR-006 | `layers.ts` | 523 | High SQL density but structural; low ROI now |
| Defer | SR-007 | `aviation-aircraft.ts` | 386 | Warning band only; defer until aviation expands |

---

## Split Pattern (same as SR-002 / SR-003)

Target folder structure for each "SPLIT" route:

```
apps/api/src/routes/<name>/
  index.ts        ← HTTP handlers only; no SQL
  service.ts      ← business logic; calls repository
  repository.ts   ← all SQL; parameterized queries
  mapper.ts       ← DB row → API response shape
  validation.ts   ← query param parsing helpers
  types.ts        ← route-local TypeScript types
```

Old flat file (`maritime.ts`, `infrastructure.ts`, `satellites.ts`) becomes a 3-line
compatibility re-export shim pointing to the new `index.ts`.

---

## No Code Changed

This is a planning document only. No source files were modified.

```
git diff --check: PASS (no source changes)
git status: no staged or modified source files
```
