// satelliteFilters.ts — WO-082E / WO-082E3
// Filter state and helpers for Layer 05 Space & Satellites.

import type { SpaceSatelliteItem } from '@god-eyes/contracts';

/** Safe default render cap when extreme mode is OFF. */
export const SAFE_RENDER_CAP = 10_000;

export interface SatelliteFilters {
  showSatellites: boolean;
  showDebris: boolean;
  showRocketBodies: boolean;
  showStarlink: boolean;
  showInactive: boolean;
  importantOnly: boolean;
  sourceFilter: 'all' | 'celestrak' | 'space-track';
  extremeMode: boolean;
}

export const DEFAULT_SATELLITE_FILTERS: SatelliteFilters = {
  showSatellites: true,
  showDebris: true,
  showRocketBodies: true,
  showStarlink: true,
  showInactive: true,
  importantOnly: false,
  sourceFilter: 'all',
  extremeMode: false,
};

export function satellitePassesFilter(
  sat: Pick<SpaceSatelliteItem, 'objectType' | 'important' | 'category' | 'sourceId'>,
  filters: SatelliteFilters,
): boolean {
  if (filters.importantOnly && !sat.important) return false;

  const type = sat.objectType;
  if (type === 'satellite' || type === 'unknown') {
    if (!filters.showSatellites) return false;
  } else if (type === 'inactive_payload') {
    if (!filters.showInactive) return false;
  } else if (type === 'debris') {
    if (!filters.showDebris) return false;
  } else if (type === 'rocket_body') {
    if (!filters.showRocketBodies) return false;
  }

  if (!filters.showStarlink && sat.category.toLowerCase().includes('starlink')) return false;

  if (filters.sourceFilter !== 'all') {
    const sid = (sat.sourceId ?? '').toLowerCase();
    if (filters.sourceFilter === 'celestrak' && !sid.includes('celestrak')) return false;
    if (filters.sourceFilter === 'space-track' && !sid.includes('space')) return false;
  }

  return true;
}

/**
 * Apply category filters and (when extremeMode is OFF) the safe render cap.
 * Important objects are prioritised first within the cap.
 */
export function getFilteredSatellites(
  satellites: SpaceSatelliteItem[],
  filters: SatelliteFilters,
): SpaceSatelliteItem[] {
  const filtered = satellites.filter((s) => satellitePassesFilter(s, filters));
  if (filters.extremeMode) return filtered;

  // Prioritise important objects so they always appear within the cap.
  const prioritised = [...filtered].sort(
    (a, b) => (b.important ? 1 : 0) - (a.important ? 1 : 0),
  );
  return prioritised.slice(0, SAFE_RENDER_CAP);
}
