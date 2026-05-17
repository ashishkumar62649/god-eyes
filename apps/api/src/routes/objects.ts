// Re-export from modular objects route
export { objectRoutes } from './objects/index.js';
export { rowToAirportObject } from './objects/mapper.js';
export { VALID_CATEGORIES, MAX_LIST_LIMIT, MAX_VIEWPORT_LIMIT, MAX_PRELOAD_LIMIT, DEFAULT_LIMIT } from './objects/constants.js';
export type { ValidCategory } from './objects/constants.js';
export type { ParsedBBox, ValidationResult } from './objects/validation.js';
export type { AirportRow } from './objects/types.js';