# Work Order: WO-063-MVP-LAYER-REGISTRY-CONTROL

**Assigned to:** Kiro CLI
**Layer:** cross-layer (all layers)
**Created:** 2026-05-25
**Status:** complete

## Objective

Create the official GOD EYES MVP layer registry and implementation rules as the single source of truth for all layer definitions.

## Layer Context

- Layer ID: All layers (layer_00 through layer_09)
- Relevant specs: LAYER_ARCHITECTURE.md, LAYER_ID_CONVENTIONS.md, SOURCE_TO_FRONTEND_CONTRACT.md

## Inputs

- Existing layer architecture: LAYER_ARCHITECTURE.md (old 7-layer system)
- Existing layer ID conventions: LAYER_ID_CONVENTIONS.md
- Current project state: CURRENT_PROJECT_STATE.md
- Source-to-frontend contract: SOURCE_TO_FRONTEND_CONTRACT.md
- Work order template: WORK_ORDER_TEMPLATE.md

## Outputs

- `docs/control/MVP_LAYER_REGISTRY.md` — new authoritative layer registry (10 layers)
- `docs/work-orders/WO-063-mvp-layer-registry-control.md` — this work order
- `docs/reports/WO-063-mvp-layer-registry-control-report.md` — completion report (optional)

## Files Modified

- `docs/control/LAYER_ARCHITECTURE.md` — update layer list from 7 to 10 layers
- `docs/control/LAYER_ID_CONVENTIONS.md` — update registered layer IDs
- `docs/state/CURRENT_PROJECT_STATE.md` — reflect new layer registry

## Acceptance Criteria

1. All 10 MVP layers are defined with `layer_id`, display name, MVP status, static/live type, source rule, database rule, API rule, frontend rendering rule, and safety notes.
2. Layer 0 (Globe Core) and Layer 1 (Aviation) are the only `active` layers.
3. All other layers are `coming_soon`.
4. Layer 4 (Public Military/Security) is marked public-only, static-only for MVP.
5. Live layer database requirements (snapshot + history tables) are documented.
6. 60 FPS frontend safety rule is included.
7. Generic layer API recommendation is included.
8. No application code directories are touched.
9. Git diff is clean of whitespace errors.

## Constraints

- Must follow rules in AGENTS.md
- Must not modify files outside allowed list: docs/control/, docs/reports/, docs/work-orders/, docs/state/CURRENT_PROJECT_STATE.md
- Forbidden: apps/, services/, database/migrations/, packages/, tests/, infra/ and any application code

## Dependencies

- Existing control documents in docs/control/

---

## Layer Registry Summary

| # | Layer ID | Display Name | MVP Status | Type |
|---|----------|-------------|------------|------|
| 0 | `layer_00_globe_core` | Globe Core | active | static |
| 1 | `layer_01_aviation` | Aviation | active | live |
| 2 | `layer_02_borders_boundaries` | Borders & Boundaries | coming_soon | static |
| 3 | `layer_03_earth_events` | Earth Events | coming_soon | live |
| 4 | `layer_04_public_military_security` | Public Military & Security | coming_soon | static (MVP) |
| 5 | `layer_05_space_satellites` | Space & Satellites | coming_soon | live |
| 6 | `layer_06_maritime` | Maritime | coming_soon | live |
| 7 | `layer_07_infrastructure` | Infrastructure | coming_soon | static |
| 8 | `layer_08_news_osint` | News & OSINT | coming_soon | live |
| 9 | `layer_09_user_shapes` | User Shapes | coming_soon | static |

## Key Product Rules

1. Aviation is the only fully active data layer.
2. All other layers show "Coming Soon" or "No data yet" in UI.
3. No fake demo data.
4. Public Military/Security is public-only, static-only for MVP.
5. Live layers need snapshot + history database tables.
6. Frontend must stay 60 FPS safe.
7. Generic layer API: `GET /api/layers`, `GET /api/layers/:layerId/objects`.
