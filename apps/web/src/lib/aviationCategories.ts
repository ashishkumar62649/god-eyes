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
    color: '#00d2ff',
    markerColor: '#00d2ff',
    dimColor: '#006680',
    defaultVisible: true,
  },
  heliport: {
    id: 'heliport',
    label: 'Heliports',
    shortLabel: 'Heliport',
    color: '#00e676',
    markerColor: '#00e676',
    dimColor: '#006633',
    defaultVisible: true,
  },
  seaplane_base: {
    id: 'seaplane_base',
    label: 'Seaplane Bases',
    shortLabel: 'Seaplane',
    color: '#ffab00',
    markerColor: '#ffab00',
    dimColor: '#805500',
    defaultVisible: true,
  },
  closed: {
    id: 'closed',
    label: 'Closed / Historical',
    shortLabel: 'Closed',
    color: '#666666',
    markerColor: '#666666',
    dimColor: '#444444',
    defaultVisible: false,
  },
  unknown: {
    id: 'unknown',
    label: 'Other',
    shortLabel: 'Other',
    color: '#888888',
    markerColor: '#888888',
    dimColor: '#555555',
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

export function getAviationDisplayCategory(
  airport: { category: string; typeSource: string }
): AviationDisplayCategory {
  const cat = (airport.category || '').toLowerCase().trim();
  const source = (airport.typeSource || '').toLowerCase().trim();

  if (cat === 'closed') return 'closed';
  if (cat === 'heliport') return 'heliport';
  if (cat === 'seaplane_base') return 'seaplane_base';

  if (source === 'closed' || source.includes('abandoned')) return 'closed';

  if (
    cat === 'large_airport' ||
    cat === 'medium_airport' ||
    cat === 'small_airport'
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
