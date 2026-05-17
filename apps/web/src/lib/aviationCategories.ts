export type AviationDisplayCategory =
  | 'major'
  | 'regional'
  | 'local'
  | 'heliport'
  | 'seaplane'
  | 'balloonport'
  | 'unknown'
  | 'closed';

export interface AviationCategoryInfo {
  id: AviationDisplayCategory;
  label: string;
  shortLabel: string;
  color: string;
  markerColor: string;
  dimColor: string;
  defaultVisible: boolean;
}

export const AVIATION_CATEGORIES: Record<AviationDisplayCategory, AviationCategoryInfo> = {
  major: {
    id: 'major',
    label: 'Major / International',
    shortLabel: 'Major',
    color: '#00E5FF',
    markerColor: '#00E5FF',
    dimColor: '#006688',
    defaultVisible: true,
  },
  regional: {
    id: 'regional',
    label: 'Regional / Domestic',
    shortLabel: 'Regional',
    color: '#00B2FF',
    markerColor: '#00B2FF',
    dimColor: '#004e72',
    defaultVisible: true,
  },
  local: {
    id: 'local',
    label: 'Local / Small Airfields',
    shortLabel: 'Local',
    color: '#7DEBFF',
    markerColor: '#7DEBFF',
    dimColor: '#2a5e66',
    defaultVisible: true,
  },
  heliport: {
    id: 'heliport',
    label: 'Heliports',
    shortLabel: 'Heliport',
    color: '#FFB000',
    markerColor: '#FFB000',
    dimColor: '#885500',
    defaultVisible: true,
  },
  seaplane: {
    id: 'seaplane',
    label: 'Water / Seaplane',
    shortLabel: 'Seaplane',
    color: '#00FFD1',
    markerColor: '#00FFD1',
    dimColor: '#007a66',
    defaultVisible: true,
  },
  balloonport: {
    id: 'balloonport',
    label: 'Balloonports',
    shortLabel: 'Balloonport',
    color: '#C084FC',
    markerColor: '#C084FC',
    dimColor: '#5b22a8',
    defaultVisible: true,
  },
  unknown: {
    id: 'unknown',
    label: 'Unknown / Unclassified',
    shortLabel: 'Unknown',
    color: '#B8F7FF',
    markerColor: '#B8F7FF',
    dimColor: '#3e757a',
    defaultVisible: true,
  },
  closed: {
    id: 'closed',
    label: 'Closed / Historical',
    shortLabel: 'Closed',
    color: '#6B7280',
    markerColor: '#6B7280',
    dimColor: '#3a3f4a',
    defaultVisible: false,
  },
};

export interface AviationFilters {
  major: boolean;
  regional: boolean;
  local: boolean;
  heliport: boolean;
  seaplane: boolean;
  balloonport: boolean;
  unknown: boolean;
  closed: boolean;
}

export const DEFAULT_AVIATION_FILTERS: AviationFilters = {
  major: true,
  regional: true,
  local: true,
  heliport: true,
  seaplane: true,
  balloonport: true,
  unknown: true,
  closed: false,
};

export const OPERATIONAL_CATEGORIES: (keyof AviationFilters)[] = [
  'major',
  'regional',
  'local',
  'heliport',
  'seaplane',
  'balloonport',
  'unknown',
];

// API category_normalized values
export const API_CATEGORY_LARGE = 'international_or_major_airport';
export const API_CATEGORY_REGIONAL = 'regional_or_domestic_airport';
export const API_CATEGORY_SMALL = 'small_airfield';
export const API_CATEGORY_HELIPORT = 'heliport';
export const API_CATEGORY_WATER = 'water_landing_site';
export const API_CATEGORY_BALLOONPORT = 'balloonport';
export const API_CATEGORY_CLOSED = 'closed_or_abandoned';
export const API_CATEGORY_UNKNOWN = 'unknown';

// Smart LOD mode: true when all 7 operational categories are ON
export function isSmartLODMode(filters: AviationFilters): boolean {
  return OPERATIONAL_CATEGORIES.every((k) => filters[k]);
}

// Map display category filter keys to backend API category values
export const DISPLAY_TO_BACKEND_MAP: Record<keyof AviationFilters, string> = {
  major: API_CATEGORY_LARGE,
  regional: API_CATEGORY_REGIONAL,
  local: API_CATEGORY_SMALL,
  heliport: API_CATEGORY_HELIPORT,
  seaplane: API_CATEGORY_WATER,
  balloonport: API_CATEGORY_BALLOONPORT,
  unknown: API_CATEGORY_UNKNOWN,
  closed: API_CATEGORY_CLOSED,
};

// Get the list of backend category values to fetch for the given mode/tier/filters
// API supports only ONE category per request, so each entry must be fetched separately
export function getBackendCategoriesToFetch(
  tier: number,
  filters: AviationFilters
): string[] {
  const smartMode = isSmartLODMode(filters);

  if (smartMode) {
    switch (tier) {
      case 0:
        return [API_CATEGORY_LARGE];
      case 1:
        return [API_CATEGORY_LARGE, API_CATEGORY_REGIONAL];
      case 2:
        return [
          API_CATEGORY_LARGE,
          API_CATEGORY_REGIONAL,
          API_CATEGORY_SMALL,
          API_CATEGORY_HELIPORT,
          API_CATEGORY_WATER,
          API_CATEGORY_BALLOONPORT,
        ];
      case 3: {
        const cats = [
          API_CATEGORY_LARGE,
          API_CATEGORY_REGIONAL,
          API_CATEGORY_SMALL,
          API_CATEGORY_HELIPORT,
          API_CATEGORY_WATER,
          API_CATEGORY_BALLOONPORT,
          API_CATEGORY_UNKNOWN,
        ];
        if (filters.closed) cats.push(API_CATEGORY_CLOSED);
        return cats;
      }
      default:
        return [API_CATEGORY_LARGE];
    }
  }

  // Explicit filter mode: return backend categories for each enabled display category
  const cats: string[] = [];
  for (const [displayCat, backendCat] of Object.entries(DISPLAY_TO_BACKEND_MAP)) {
    if (filters[displayCat as keyof AviationFilters]) {
      cats.push(backendCat);
    }
  }
  return cats;
}

// Map API airport data to a display category
export function getAviationDisplayCategory(
  airport: { category: string; typeSource: string }
): AviationDisplayCategory {
  const cat = (airport.category || '').toLowerCase().trim();
  const source = (airport.typeSource || '').toLowerCase().trim();

  if (cat === 'closed' || cat === API_CATEGORY_CLOSED) return 'closed';
  if (source === 'closed' || source.includes('abandoned')) return 'closed';

  if (cat === 'heliport' || cat === API_CATEGORY_HELIPORT) return 'heliport';
  if (source === 'heliport') return 'heliport';

  if (cat === API_CATEGORY_BALLOONPORT) return 'balloonport';

  if (cat === API_CATEGORY_WATER) return 'seaplane';
  if (source === 'seaplane_base' || source === 'floatplane' || source === 'water') return 'seaplane';

  if (cat === API_CATEGORY_LARGE || cat === 'large_airport') return 'major';
  if (source === 'large_airport') return 'major';

  if (cat === API_CATEGORY_REGIONAL || cat === 'medium_airport') return 'regional';
  if (source === 'medium_airport') return 'regional';

  if (cat === API_CATEGORY_SMALL || cat === 'small_airport') return 'local';
  if (source === 'small_airport' || source === 'airport' || source === 'airfield') return 'local';

  return 'unknown';
}

export function getCategoryInfo(
  airport: { category: string; typeSource: string }
): AviationCategoryInfo {
  return AVIATION_CATEGORIES[getAviationDisplayCategory(airport)];
}

export function getCategoryLabel(
  airport: { category: string; typeSource: string }
): string {
  return getCategoryInfo(airport).shortLabel;
}

// LOD tier thresholds with hysteresis (in meters)
// Tier 0 (global, >12M): major only
// Tier 1 (regional, 4M-12M): major + regional
// Tier 2 (wide state, 1M-4M): all operational
// Tier 3 (local, <1M): all

export const LOD_TIER_THRESHOLDS = {
  DOWN_0_TO_1: 10_000_000,
  UP_1_TO_0: 12_000_000,
  DOWN_1_TO_2: 3_500_000,
  UP_2_TO_1: 4_000_000,
  DOWN_2_TO_3: 800_000,
  UP_3_TO_2: 1_000_000,
};

export function getZoomTierFromHeight(height: number, previousTier: number): number {
  switch (previousTier) {
    case 0:
      if (height < LOD_TIER_THRESHOLDS.DOWN_0_TO_1) return 1;
      return 0;
    case 1:
      if (height >= LOD_TIER_THRESHOLDS.UP_1_TO_0) return 0;
      if (height < LOD_TIER_THRESHOLDS.DOWN_1_TO_2) return 2;
      return 1;
    case 2:
      if (height >= LOD_TIER_THRESHOLDS.UP_2_TO_1) return 1;
      if (height < LOD_TIER_THRESHOLDS.DOWN_2_TO_3) return 3;
      return 2;
    case 3:
      if (height >= LOD_TIER_THRESHOLDS.UP_3_TO_2) return 2;
      return 3;
    default:
      return 0;
  }
}

export const ZOOM_TIER_LABELS: Record<number, string> = {
  0: 'GLOBAL',
  1: 'REGIONAL',
  2: 'STATE',
  3: 'LOCAL',
};

export const MODE_LABELS: Record<string, string> = {
  smart: 'SMART LOD',
  explicit: 'EXPLICIT',
};

// Bbox rounding precision per zoom tier (in degrees)
// Tier 0 (global, >12M): 10 deg — tiny camera moves at this range are irrelevant
// Tier 1 (regional, 4M-12M): 2 deg — country-level
// Tier 2 (state, 1M-4M): 0.5 deg — province/state level
// Tier 3 (local, <1M): 0.1 deg — city/area level
export const BBOX_ROUNDING: Record<number, number> = {
  0: 10,
  1: 2,
  2: 0.5,
  3: 0.1,
};

export function getBboxRoundingForTier(tier: number): number {
  return BBOX_ROUNDING[tier] ?? 0.1;
}
