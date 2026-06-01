// satelliteColors.ts — WO-082E
// Altitude-based color scale and object-type color helpers for Layer 05.
// Matches the spec: 8-band altitude scale, no black/white primary colors.

import type { SatelliteFrontendItem, SatelliteObjectType } from './satelliteTypes';

// Altitude bands (km): [maxAltKm, color]
const ALT_BANDS: Array<[number, string]> = [
  [200,    '#ff8c00'],  // LEO low: orange
  [500,    '#ffd000'],  // LEO mid: yellow
  [2000,   '#80ff00'],  // LEO high: lime
  [5000,   '#00e5ff'],  // MEO low: cyan
  [20000,  '#0077ff'],  // MEO: blue
  [36000,  '#8a2be2'],  // GEO: purple
  [50000,  '#ff2d55'],  // HEO: red
  [Infinity, '#ff6b6b'], // deep space: light red
];

const COLOR_UNKNOWN = '#00e5ff';

// Per-type fallback colors when backend visualColor is absent/invalid.
const TYPE_COLORS: Record<SatelliteObjectType, string> = {
  satellite:       '#00e5ff',
  debris:          '#ff6b35',
  rocket_body:     '#ffd166',
  inactive_payload:'#a8dadc',
  unknown:         '#aaaaaa',
};

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function isValidColor(c: string): boolean {
  return HEX_COLOR_RE.test(c);
}

export function getSatelliteColor(sat: SatelliteFrontendItem): string {
  // Use backend color if valid.
  if (sat.visualColor && isValidColor(sat.visualColor)) return sat.visualColor;

  // Altitude-based fallback.
  if (sat.altitudeKm !== null && sat.altitudeKm !== undefined) {
    for (const [maxAlt, color] of ALT_BANDS) {
      if (sat.altitudeKm < maxAlt) return color;
    }
  }

  // Object-type fallback.
  return TYPE_COLORS[sat.objectType] ?? COLOR_UNKNOWN;
}

export function getSatellitePixelSize(sat: SatelliteFrontendItem): number {
  if (sat.important) return 8;
  if (sat.visualShape === 'triangle') return 6;
  return 4;
}
