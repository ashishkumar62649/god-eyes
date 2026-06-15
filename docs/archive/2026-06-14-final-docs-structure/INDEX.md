# Archive Index — 2026-06-14 Final Documentation Structure Cleanup

> **Classification:** ARCHIVE
> **Created:** 2026-06-14
> **Agent:** Documentation Agent

## Summary

Moved historical layer-specific control docs, old integration reviews, completed work orders,
legacy API/data notes, and superseded audits into archive. Preserved for traceability.

## Archive Folders

| Folder | Contents |
|--------|----------|
| `control-layer-docs/` | Layer-specific plans, contracts, gate reviews from `docs/control/` |
| `state-integration-reviews/` | Integration review records from `docs/state/` |
| `work-orders/` | Completed work orders from `docs/work-orders/` |
| `api-legacy/` | Historical API reference docs from `docs/api/` |
| `data-legacy/` | Historical data reference docs from `docs/data/` |
| `audits/` | Superseded audit reports from `docs/audits/` |

## Moved Files

### Control Layer Docs (11 files)

| Original path | New path (relative) | Reason |
|---|---|---|
| `docs/control/AIRPORT_PUBLIC_ENRICHMENT_PIPELINE.md` | `control-layer-docs/layer_01_aviation/AIRPORT_PUBLIC_ENRICHMENT_PIPELINE.md` | Layer-specific historical plan |
| `docs/control/EARTH_EVENTS_LAYER_PLAN.md` | `control-layer-docs/layer_03_earth_events/EARTH_EVENTS_LAYER_PLAN.md` | Layer-specific historical plan |
| `docs/control/layer_05_space_satellites_mvp_contract.md` | `control-layer-docs/layer_05_space_satellites/layer_05_space_satellites_mvp_contract.md` | Layer-specific historical contract |
| `docs/control/layer_10_energy_infrastructure_mvp_contract.md` | `control-layer-docs/layer_10_energy_infrastructure/layer_10_energy_infrastructure_mvp_contract.md` | Layer-specific historical contract |
| `docs/control/BORDERS_BOUNDARIES_IMPLEMENTATION_GATE_REVIEW.md` | `control-layer-docs/layer_02_borders_boundaries/BORDERS_BOUNDARIES_IMPLEMENTATION_GATE_REVIEW.md` | Layer-specific gate review |
| `docs/control/BORDERS_BOUNDARIES_MVP_BOUNDARY_MODE_DECISION.md` | `control-layer-docs/layer_02_borders_boundaries/BORDERS_BOUNDARIES_MVP_BOUNDARY_MODE_DECISION.md` | Layer-specific decision |
| `docs/control/BORDERS_BOUNDARIES_NATURAL_EARTH_MVP_SOURCE_SELECTION.md` | `control-layer-docs/layer_02_borders_boundaries/BORDERS_BOUNDARIES_NATURAL_EARTH_MVP_SOURCE_SELECTION.md` | Layer-specific source selection |
| `docs/control/BORDERS_BOUNDARIES_POLICY_SOURCE_PLAN.md` | `control-layer-docs/layer_02_borders_boundaries/BORDERS_BOUNDARIES_POLICY_SOURCE_PLAN.md` | Layer-specific policy plan |
| `docs/control/BORDERS_BOUNDARIES_SOURCE_LICENSE_CLEARANCE_KIT.md` | `control-layer-docs/layer_02_borders_boundaries/BORDERS_BOUNDARIES_SOURCE_LICENSE_CLEARANCE_KIT.md` | Layer-specific license kit |
| `docs/control/BORDERS_BOUNDARIES_SOURCE_REVIEW_TRACKER.md` | `control-layer-docs/layer_02_borders_boundaries/BORDERS_BOUNDARIES_SOURCE_REVIEW_TRACKER.md` | Layer-specific review tracker |
| `docs/control/BORDERS_BOUNDARIES_SURVEY_OF_INDIA_REQUEST_TEMPLATE.md` | `control-layer-docs/layer_02_borders_boundaries/BORDERS_BOUNDARIES_SURVEY_OF_INDIA_REQUEST_TEMPLATE.md` | Layer-specific request template |

### State Integration Reviews (49 files)

| Original path | New path (relative) | Reason |
|---|---|---|
| `docs/state/INTEGRATION_REVIEW_AVIATION_AIRPORT_MARKERS.md` | `state-integration-reviews/layer_01_aviation/INTEGRATION_REVIEW_AVIATION_AIRPORT_MARKERS.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_AVIATION_API_DATA_UI_DECISION.md` | `state-integration-reviews/layer_01_aviation/INTEGRATION_REVIEW_AVIATION_API_DATA_UI_DECISION.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_HOTFIX_AIRPORT_DETAIL_RUNTIME.md` | `state-integration-reviews/layer_01_aviation/INTEGRATION_REVIEW_HOTFIX_AIRPORT_DETAIL_RUNTIME.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_HOTFIX_MARKER_PAYLOAD_MAIN.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_HOTFIX_MARKER_PAYLOAD_MAIN.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_LAYER_07_WEATHER_COMPLETE.md` | `state-integration-reviews/layer_07_weather/INTEGRATION_REVIEW_LAYER_07_WEATHER_COMPLETE.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_LAYER_08_NEWS_OSINT_COMPLETE.md` | `state-integration-reviews/layer_08_news_osint/INTEGRATION_REVIEW_LAYER_08_NEWS_OSINT_COMPLETE.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_LAYER0_LAYER1_API.md` | `state-integration-reviews/layer_00_globe_core/INTEGRATION_REVIEW_LAYER0_LAYER1_API.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_REAL_AVIATION_DATA_VISUAL_POLISH.md` | `state-integration-reviews/layer_01_aviation/INTEGRATION_REVIEW_REAL_AVIATION_DATA_VISUAL_POLISH.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-001.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-001.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-002.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-002.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-003.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-003.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-004.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-004.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-005.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-005.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-006.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-006.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-007.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-007.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-008.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-008.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-009.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-009.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-011.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-011.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-012.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-012.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-014.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-014.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-015.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-015.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-016.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-016.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-017_TO_WO-021.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-017_TO_WO-021.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-017.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-017.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-018.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-018.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-019.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-019.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-020.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-020.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-021.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-021.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-022_AND_WO-022A.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-022_AND_WO-022A.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-022_TO_WO-025.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-022_TO_WO-025.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-023.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-023.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-024A.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-024A.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-025.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-025.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-026_TO_WO-028.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-026_TO_WO-028.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-026.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-026.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-027.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-027.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-028.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-028.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-029A.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-029A.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-029B_API_FEASIBILITY.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-029B_API_FEASIBILITY.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-029B_DATA.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-029B_DATA.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-029B_FRONTEND_FEASIBILITY.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-029B_FRONTEND_FEASIBILITY.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-029B_PLANNING.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-029B_PLANNING.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-029C_API.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-029C_API.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-029D_API.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-029D_API.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-029E_API_CATEGORY_AUDIT.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-029E_API_CATEGORY_AUDIT.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-029E_DATA_CATEGORY_AUDIT.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-029E_DATA_CATEGORY_AUDIT.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-029E_TO_WO-029F.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-029E_TO_WO-029F.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-029F_FE.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-029F_FE.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-030A_WO-031-FE_HOTFIX-2.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-030A_WO-031-FE_HOTFIX-2.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-078D.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-078D.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-078E_FINAL.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-078E_FINAL.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-078E.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-078E.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-078E1.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-078E1.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-079A_A1.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-079A_A1.md` | Historical integration review |
| `docs/state/INTEGRATION_REVIEW_WO-079B.md` | `state-integration-reviews/cross_project/INTEGRATION_REVIEW_WO-079B.md` | Historical integration review |

### Work Orders (17 files)

| Original path | New path (relative) | Reason |
|---|---|---|
| `docs/work-orders/WO-026-opencode-airport-detail-integration.md` | `work-orders/project_infrastructure/WO-026-opencode-airport-detail-integration.md` | Completed historical work order |
| `docs/work-orders/WO-029A-opencode-aviation-marker-categories-filters.md` | `work-orders/project_infrastructure/WO-029A-opencode-aviation-marker-categories-filters.md` | Completed historical work order |
| `docs/work-orders/WO-029B-aviation-density-view-frontend-plan.md` | `work-orders/project_infrastructure/WO-029B-aviation-density-view-frontend-plan.md` | Completed historical work order |
| `docs/work-orders/WO-029C-opencode-aviation-density-view-frontend.md` | `work-orders/project_infrastructure/WO-029C-opencode-aviation-density-view-frontend.md` | Completed historical work order |
| `docs/work-orders/WO-029D-opencode-global-aviation-fabric-frontend.md` | `work-orders/project_infrastructure/WO-029D-opencode-global-aviation-fabric-frontend.md` | Completed historical work order |
| `docs/work-orders/WO-029G-opencode-aviation-persistent-tile-cache.md` | `work-orders/project_infrastructure/WO-029G-opencode-aviation-persistent-tile-cache.md` | Completed historical work order |
| `docs/work-orders/WO-032-ux-source-review.md` | `work-orders/project_infrastructure/WO-032-ux-source-review.md` | Completed historical work order |
| `docs/work-orders/WO-032E-airport-public-profile-ui-plan.md` | `work-orders/project_infrastructure/WO-032E-airport-public-profile-ui-plan.md` | Completed historical work order |
| `docs/work-orders/WO-035-airport-intelligence-canonical-design.md` | `work-orders/project_infrastructure/WO-035-airport-intelligence-canonical-design.md` | Completed historical work order |
| `docs/work-orders/WO-035-claude-airport-intelligence-frontend-research.md` | `work-orders/project_infrastructure/WO-035-claude-airport-intelligence-frontend-research.md` | Completed historical work order |
| `docs/work-orders/WO-035-minimax-airport-intelligence-source-research.md` | `work-orders/project_infrastructure/WO-035-minimax-airport-intelligence-source-research.md` | Completed historical work order |
| `docs/work-orders/WO-040-airport-intelligence-source-audit.md` | `work-orders/project_infrastructure/WO-040-airport-intelligence-source-audit.md` | Completed historical work order |
| `docs/work-orders/WO-043-airport-intelligence-ingest-mvp.md` | `work-orders/project_infrastructure/WO-043-airport-intelligence-ingest-mvp.md` | Completed historical work order |
| `docs/work-orders/WO-047-frontend-map-popup.md` | `work-orders/project_infrastructure/WO-047-frontend-map-popup.md` | Completed historical work order |
| `docs/work-orders/WO-051-airport-image-gallery-mvp.md` | `work-orders/project_infrastructure/WO-051-airport-image-gallery-mvp.md` | Completed historical work order |
| `docs/work-orders/WO-053-frontend-airport-image-gallery.md` | `work-orders/project_infrastructure/WO-053-frontend-airport-image-gallery.md` | Completed historical work order |
| `docs/work-orders/WO-057-frontend-airport-layout-overlay.md` | `work-orders/project_infrastructure/WO-057-frontend-airport-layout-overlay.md` | Completed historical work order |

### API Legacy (5 files)

| Original path | New path (relative) | Reason |
|---|---|---|
| `docs/api/API_AIRPORT_DETAIL.md` | `api-legacy/layer_01_aviation/API_AIRPORT_DETAIL.md` | Historical layer-specific API reference |
| `docs/api/API_AIRPORT_INTELLIGENCE_PLAN.md` | `api-legacy/layer_01_aviation/API_AIRPORT_INTELLIGENCE_PLAN.md` | Historical layer-specific API reference |
| `docs/api/API_AIRPORT_PUBLIC_PROFILE_PLAN.md` | `api-legacy/layer_01_aviation/API_AIRPORT_PUBLIC_PROFILE_PLAN.md` | Historical layer-specific API reference |
| `docs/api/API_AVIATION_DENSITY_VIEW.md` | `api-legacy/layer_01_aviation/API_AVIATION_DENSITY_VIEW.md` | Historical layer-specific API reference |
| `docs/api/API_AVIATION_FABRIC_DENSITY.md` | `api-legacy/layer_01_aviation/API_AVIATION_FABRIC_DENSITY.md` | Historical layer-specific API reference |

### Data Legacy (13 files)

| Original path | New path (relative) | Reason |
|---|---|---|
| `docs/data/layer_01_aviation/AIRPORT_DETAIL_QA_SAMPLES.md` | `data-legacy/layer_01_aviation/AIRPORT_DETAIL_QA_SAMPLES.md` | Historical layer-specific data reference |
| `docs/data/layer_01_aviation/AIRPORT_DETAIL_SQL_READINESS.md` | `data-legacy/layer_01_aviation/AIRPORT_DETAIL_SQL_READINESS.md` | Historical layer-specific data reference |
| `docs/data/layer_01_aviation/AIRPORT_INTELLIGENCE_SCHEMA_PLAN.md` | `data-legacy/layer_01_aviation/AIRPORT_INTELLIGENCE_SCHEMA_PLAN.md` | Historical layer-specific data reference |
| `docs/data/layer_01_aviation/AIRPORT_PUBLIC_PROFILE_SCHEMA_PLAN.md` | `data-legacy/layer_01_aviation/AIRPORT_PUBLIC_PROFILE_SCHEMA_PLAN.md` | Historical layer-specific data reference |
| `docs/data/layer_01_aviation/AVIATION_COORDINATE_MIGRATION_VERIFICATION.md` | `data-legacy/layer_01_aviation/AVIATION_COORDINATE_MIGRATION_VERIFICATION.md` | Historical layer-specific data reference |
| `docs/data/layer_01_aviation/AVIATION_COORDINATE_QUALITY_AND_OVERRIDES.md` | `data-legacy/layer_01_aviation/AVIATION_COORDINATE_QUALITY_AND_OVERRIDES.md` | Historical layer-specific data reference |
| `docs/data/layer_01_aviation/AVIATION_DATA_QUALITY.md` | `data-legacy/layer_01_aviation/AVIATION_DATA_QUALITY.md` | Historical layer-specific data reference |
| `docs/data/layer_01_aviation/AVIATION_DENSITY_VIEW_DATA_REFERENCE.md` | `data-legacy/layer_01_aviation/AVIATION_DENSITY_VIEW_DATA_REFERENCE.md` | Historical layer-specific data reference |
| `docs/data/layer_01_aviation/AVIATION_DETAIL_DATA_READINESS.md` | `data-legacy/layer_01_aviation/AVIATION_DETAIL_DATA_READINESS.md` | Historical layer-specific data reference |
| `docs/data/layer_01_aviation/AVIATION_OBJECT_INTEL_DISPLAY_REFERENCE.md` | `data-legacy/layer_01_aviation/AVIATION_OBJECT_INTEL_DISPLAY_REFERENCE.md` | Historical layer-specific data reference |
| `docs/data/layer_01_aviation/AVIATION_QUERY_PERFORMANCE.md` | `data-legacy/layer_01_aviation/AVIATION_QUERY_PERFORMANCE.md` | Historical layer-specific data reference |
| `docs/data/layer_01_aviation/AVIATION_SEARCH_PERFORMANCE.md` | `data-legacy/layer_01_aviation/AVIATION_SEARCH_PERFORMANCE.md` | Historical layer-specific data reference |
| `docs/data/layer_01_aviation/OURAIRPORTS_LOCAL_VERIFICATION.md` | `data-legacy/layer_01_aviation/OURAIRPORTS_LOCAL_VERIFICATION.md` | Historical layer-specific data reference |

### Audits (2 files)

| Original path | New path (relative) | Reason |
|---|---|---|
| `docs/audits/PROJECT_ALIGNMENT_FIX_REPORT.md` | `audits/PROJECT_ALIGNMENT_FIX_REPORT.md` | Superseded alignment audit |
| `docs/audits/PROJECT_ALIGNMENT_FIX_REVIEW.md` | `audits/PROJECT_ALIGNMENENT_FIX_REVIEW.md` | Superseded alignment audit |

## Total: 97 files moved to archive