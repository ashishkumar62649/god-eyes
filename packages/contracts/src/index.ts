// Compatibility barrel re-export.
// All schemas and types are defined in per-layer / per-domain modules
// under `./common/` and `./layers/`. This barrel re-exports them so that
// existing imports from `@god-eyes/contracts` continue to work unchanged.
//
// SR-007 — Contracts Package Split (refactor, no behaviour change).

export * from './common/errors.js';
export * from './common/pagination.js';
export * from './common/layer-status.js';
export * from './layers/layer_01_aviation.js';
export * from './layers/layer_02_borders_boundaries.js';
export * from './layers/layer_03_earth_events.js';
export * from './layers/layer_05_space_satellites.js';
export * from './layers/layer_06_maritime.js';
export * from './layers/layer_07_weather.js';
export * from './layers/layer_08_news_osint.js';
export * from './layers/layer_10_energy_infrastructure.js';
