export type AviationDisplayCategory =
  | 'airport'
  | 'heliport'
  | 'seaplane_base'
  | 'closed'
  | 'unknown';

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
  airport: {
    id: 'airport',
    label: 'Airports / Airfields',
    shortLabel: 'Airport',
    color: '#00E5FF',
    markerColor: '#00E5FF',
    dimColor: '#006688',
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
  seaplane_base: {
    id: 'seaplane_base',
    label: 'Seaplane Bases',
    shortLabel: 'Seaplane',
    color: '#00FFD1',
    markerColor: '#00FFD1',
    dimColor: '#007a66',
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
  unknown: {
    id: 'unknown',
    label: 'Other',
    shortLabel: 'Other',
    color: '#B8F7FF',
    markerColor: '#B8F7FF',
    dimColor: '#3e757a',
    defaultVisible: true,
  },
};

export interface AviationFilters {
  airports: boolean;
  heliports: boolean;
  seaplaneBases: boolean;
  closed: boolean;
}

export const DEFAULT_AVIATION_FILTERS: AviationFilters = {
  airports: true,
  heliports: true,
  seaplaneBases: true,
  closed: false,
};

// API category_normalized values
export const API_CATEGORY_LARGE = 'international_or_major_airport';
export const API_CATEGORY_REGIONAL = 'regional_or_domestic_airport';
export const API_CATEGORY_SMALL = 'small_airfield';
export const API_CATEGORY_HELIPORT = 'heliport';
export const API_CATEGORY_WATER = 'water_landing_site';
export const API_CATEGORY_BALLOONPORT = 'balloonport';
export const API_CATEGORY_CLOSED = 'closed_or_abandoned';
export const API_CATEGORY_UNKNOWN = 'unknown';

// Map display filter to API categories
export function displayFilterToApiCategories(filters: AviationFilters): string[] {
  const cats: string[] = [];
  if (filters.airports) cats.push(API_CATEGORY_LARGE, API_CATEGORY_REGIONAL, API_CATEGORY_SMALL);
  if (filters.heliports) cats.push(API_CATEGORY_HELIPORT);
  if (filters.seaplaneBases) cats.push(API_CATEGORY_WATER, API_CATEGORY_BALLOONPORT);
  return cats;
}

// Smart LOD mode: true when all normal operational categories are ON
export function isSmartLODMode(filters: AviationFilters): boolean {
  return filters.airports && filters.heliports && filters.seaplaneBases;
}

// Get API categories to fetch for the given LOD tier and filter mode
export function getFetchCategories(
  tier: number,
  filters: AviationFilters
): string[] {
  const smartMode = isSmartLODMode(filters);

  if (smartMode) {
    // Smart LOD: fetch only what's visible at this tier
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
          API_CATEGORY_UNKNOWN,
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

  // Explicit filter mode: fetch all selected categories globally
  const cats: string[] = [];
  if (filters.airports) cats.push(API_CATEGORY_LARGE, API_CATEGORY_REGIONAL, API_CATEGORY_SMALL);
  if (filters.heliports) cats.push(API_CATEGORY_HELIPORT);
  if (filters.seaplaneBases) cats.push(API_CATEGORY_WATER, API_CATEGORY_BALLOONPORT);
  if (filters.closed) cats.push(API_CATEGORY_CLOSED);
  return cats;
}

export function getAviationDisplayCategory(
  airport: { category: string; typeSource: string }
): AviationDisplayCategory {
  const cat = (airport.category || '').toLowerCase().trim();
  const source = (airport.typeSource || '').toLowerCase().trim();

  if (cat === 'closed' || cat === API_CATEGORY_CLOSED) return 'closed';
  if (cat === 'heliport' || cat === API_CATEGORY_HELIPORT) return 'heliport';
  if (cat === 'seaplane_base' || cat === API_CATEGORY_WATER) return 'seaplane_base';

  if (source === 'closed' || source.includes('abandoned')) return 'closed';

  if (
    cat === 'large_airport' ||
    cat === 'medium_airport' ||
    cat === 'small_airport' ||
    cat === API_CATEGORY_LARGE ||
    cat === API_CATEGORY_REGIONAL ||
    cat === API_CATEGORY_SMALL
  ) {
    return 'airport';
  }

  if (
    source === 'large_airport' ||
    source === 'medium_airport' ||
    source === 'small_airport' ||
    source === 'airport' ||
    source === 'airfield'
  ) {
    return 'airport';
  }
  if (source === 'heliport') return 'heliport';
  if (source === 'seaplane_base') return 'seaplane_base';

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
// Tier 0 (strategic/global, >10M): international major only
// Tier 1 (national/country, 3M-10M): + regional domestic
// Tier 2 (state/multi-state, 800K-3M): + small, heliport, seaplane, balloonport, unknown
// Tier 3 (local, <800K): all respecting filters

export const LOD_TIER_THRESHOLDS = {
  DOWN_0_TO_1: 8_000_000,
  UP_1_TO_0: 10_000_000,
  DOWN_1_TO_2: 2_500_000,
  UP_2_TO_1: 3_000_000,
  DOWN_2_TO_3: 600_000,
  UP_3_TO_2: 800_000,
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
  0: 'STRATEGIC',
  1: 'NATIONAL',
  2: 'STATE',
  3: 'LOCAL',
};

export const MODE_LABELS: Record<string, string> = {
  smart: 'SMART LOD',
  explicit: 'EXPLICIT',
};
