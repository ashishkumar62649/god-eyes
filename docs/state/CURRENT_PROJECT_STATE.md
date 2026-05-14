# Current Project State

## Phase: 0 — Layered Foundation

## Goal

Prepare the repository so GOD EYES can be built layer by layer, starting with Layer 0 Globe Core and Layer 1 Aviation.

## Status

Control layer restructured to layer-based architecture. No app code yet.

## What Exists

- [x] AGENTS.md (layer-based)
- [x] docs/control/LAYER_ARCHITECTURE.md
- [x] docs/control/LAYER_ID_CONVENTIONS.md
- [x] docs/control/LLM_OWNERSHIP_MATRIX.md
- [x] docs/control/PIPELINE_HANDOFF_RULES.md
- [x] docs/control/DATA_LOCATION_RULES.md
- [x] docs/control/SOURCE_TO_FRONTEND_CONTRACT.md
- [x] docs/state/CURRENT_PROJECT_STATE.md
- [x] docs/state/HANDOFF_LOG.md
- [x] docs/work-orders/WORK_ORDER_TEMPLATE.md
- [x] specs/001-layer-zero-globe-core/spec.md
- [x] specs/002-layer-one-aviation/spec.md

## What Does Not Exist Yet

- [ ] Any app code
- [ ] Any dependencies installed
- [ ] Any database
- [ ] Any API
- [ ] Any frontend
- [ ] Any fetchers or normalizers

## Next Safe Steps

1. Gemini: build Layer 0 globe frontend shell and layer registry UI.
2. Codex: create Layer 1 aviation source catalog, raw storage rules, database schema draft.
3. Claude Code: create layer-aware API contracts and health endpoint scaffold.
4. Kiro: review whether frontend, API, data, and database contracts connect correctly.

## Last Updated

2026-05-14 — Kiro CLI (Git workflow policy established)
