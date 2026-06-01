// satelliteFilters.ts — WO-082E
// Filter state and helpers for Layer 05 Space & Satellites.

import type { SatelliteFrontendItem } from './satelliteTypes';

export interface SatelliteFilters {
  showSatellites: boolean;
  showDebris: boolean;
  showRocketBodies: boolean;
  showStarlink: boolean;
  importantOnly: boolean;
}

export const DEFAULT_SATELLITE_FILTERS: SatelliteFilters = {
  showSatellites: true,
  showDebris: true,
  showRocketBodies: true,
  showStarlink: true,
  importantOnly: false,
};

export function satellitePassesFilter(sat: SatelliteFrontendItem, filters: SatelliteFilters): boolean {
  if (filters.importantOnly && !sat.important) return false;

  const type = sat.objectType;
  if (type === 'satellite' || type === 'inactive_payload' || type === 'unknown') {
    if (!filters.showSatellites) return false;
  } else if (type === 'debris') {
    if (!filters.showDebris) return false;
  } else if (type === 'rocket_body') {
    if (!filters.showRocketBodies) return false;
  }

  if (!filters.showStarlink && sat.category.toLowerCase().includes('starlink')) return false;

  return true;
}
