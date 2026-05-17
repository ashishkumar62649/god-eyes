// Valid airport categories
export const VALID_CATEGORIES = [
  'international_or_major_airport',
  'regional_or_domestic_airport',
  'small_airfield',
  'heliport',
  'water_landing_site',
  'balloonport',
  'closed_or_abandoned',
  'unknown',
] as const;

export type ValidCategory = (typeof VALID_CATEGORIES)[number];

// Limit policy (documented):
// - Default limit: 500
// - General list max: 500 (production safety guard from WO-012)
// - Viewport/query max (bbox present): 1000 (WO-008 spatial queries may need more)
// - Preload mode max: 100000 (WO-030A resident cache mode — full dataset fetch)
export const MAX_LIST_LIMIT = 500;
export const MAX_VIEWPORT_LIMIT = 1000;
export const MAX_PRELOAD_LIMIT = 100000;
export const DEFAULT_LIMIT = 500;

// Bounding box limits
export const BBOX_LON_MIN = -180;
export const BBOX_LON_MAX = 180;
export const BBOX_LAT_MIN = -90;
export const BBOX_LAT_MAX = 90;

// Supported layer
export const SUPPORTED_LAYER = 'layer_01_aviation';

// Supported object type
export const SUPPORTED_OBJECT_TYPE = 'airport';