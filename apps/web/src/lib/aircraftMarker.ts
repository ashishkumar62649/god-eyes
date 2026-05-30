import type { AircraftLatest } from '@god-eyes/contracts';

// WO-080C7: Aircraft type icons + altitude color scale.
// SVGs live in /aircraft-icons/svg/<name>.svg (public folder, served at runtime).
// Tinting: replace fill="#FFFFFF" with altitude color in SVG text, cache as data URL.

// ---------------------------------------------------------------------------
// Type designator → icon name mapping (subset from icon-mapping.json).
// Full mapping loaded lazily from /aircraft-icons/icon-mapping.json.
// ---------------------------------------------------------------------------

interface IconMapping {
  TypeDesignatorIcons: Record<string, [string, number]>;
  TypeDescriptionIcons: Record<string, [string, number]>;
}

let iconMapping: IconMapping | null = null;
let iconMappingPromise: Promise<IconMapping> | null = null;

function loadIconMapping(): Promise<IconMapping> {
  if (iconMapping) return Promise.resolve(iconMapping);
  if (iconMappingPromise) return iconMappingPromise;
  iconMappingPromise = fetch('/aircraft-icons/icon-mapping.json')
    .then((r) => r.json())
    .then((data) => { iconMapping = data as IconMapping; return iconMapping!; })
    .catch(() => {
      // Fallback empty mapping — will use 'unknown' for everything.
      iconMapping = { TypeDesignatorIcons: {}, TypeDescriptionIcons: {} };
      return iconMapping!;
    });
  return iconMappingPromise;
}

// Pre-load mapping eagerly so it's ready before first aircraft arrives.
loadIconMapping();

// ---------------------------------------------------------------------------
// Altitude color scale
// ---------------------------------------------------------------------------

const ALT_COLORS: Array<[number, string]> = [
  [2_000,  '#ff8c00'],
  [5_000,  '#ffd000'],
  [10_000, '#80ff00'],
  [20_000, '#00d5ff'],
  [30_000, '#0077ff'],
  [40_000, '#8a2be2'],
  [Infinity, '#ff2d55'],
];
const COLOR_GROUND   = '#7a7f85';
const COLOR_UNKNOWN  = '#00e5ff'; // cyan fallback

export function getAircraftAltitudeColor(ac: AircraftLatest): string {
  if (ac.onGround) return COLOR_GROUND;
  const altFt = typeof (ac as any).altitudeFt === 'number' ? (ac as any).altitudeFt
    : typeof ac.altitudeBaroFt === 'number' ? ac.altitudeBaroFt : null;
  if (altFt === null || altFt === undefined) return COLOR_UNKNOWN;
  for (const [threshold, color] of ALT_COLORS) {
    if (altFt < threshold) return color;
  }
  return '#ff2d55';
}

// ---------------------------------------------------------------------------
// Icon name resolver
// ---------------------------------------------------------------------------

export function resolveAircraftIconName(ac: AircraftLatest): string {
  if (!iconMapping) return 'unknown';

  const type = ((ac as any).aircraftType ?? ac.aircraftType ?? '').toString().toUpperCase().trim();

  if (type) {
    const hit = iconMapping.TypeDesignatorIcons[type];
    if (hit) return hit[0];
  }

  // Helicopter category fallback
  const cat = ((ac as any).category ?? '').toString().toUpperCase();
  if (cat === 'A7' || cat.startsWith('H') || type.startsWith('H')) {
    const descHit = iconMapping.TypeDescriptionIcons['H'];
    if (descHit) return descHit[0];
  }

  if (ac.onGround) return 'ground_unknown';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// SVG cache: key = "iconName|color"
// ---------------------------------------------------------------------------

// Synchronous cache: data URL strings once resolved.
const svgCache = new Map<string, string>();
// In-flight fetch promises to avoid duplicate requests.
const svgFetchCache = new Map<string, Promise<string>>();

/**
 * Returns a data URL for the given icon tinted with the given color.
 * Returns a fallback canvas data URL synchronously if SVG not yet loaded.
 * Triggers async load and populates cache for next call.
 */
export function getAircraftMarkerImage(iconName: string, color: string): string {
  const key = `${iconName}|${color}`;
  const cached = svgCache.get(key);
  if (cached) return cached;

  // Trigger async load if not already in flight.
  if (!svgFetchCache.has(key)) {
    const p = fetch(`/aircraft-icons/svg/${iconName}.svg`)
      .then((r) => {
        if (!r.ok) throw new Error(`404: ${iconName}`);
        return r.text();
      })
      .then((svgText) => {
        // Tint: replace fill="#FFFFFF" with altitude color.
        const tinted = svgText.replace(/fill="#FFFFFF"/gi, `fill="${color}"`);
        const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(tinted)}`;
        svgCache.set(key, dataUrl);
        return dataUrl;
      })
      .catch(() => {
        // On error, fall back to canvas dot and cache it.
        const fallback = buildFallbackDataUrl(color);
        svgCache.set(key, fallback);
        return fallback;
      });
    svgFetchCache.set(key, p);
  }

  // Return synchronous fallback while async load is in flight.
  return buildFallbackDataUrl(color);
}

/**
 * Async version: resolves to the final data URL (waits for SVG fetch).
 * Use this in snapshot/delta handlers to get the real icon.
 */
export function getAircraftMarkerImageAsync(iconName: string, color: string): Promise<string> {
  const key = `${iconName}|${color}`;
  const cached = svgCache.get(key);
  if (cached) return Promise.resolve(cached);

  // Trigger or reuse in-flight fetch.
  if (!svgFetchCache.has(key)) {
    getAircraftMarkerImage(iconName, color); // triggers fetch
  }
  return svgFetchCache.get(key)!;
}

// ---------------------------------------------------------------------------
// Fallback canvas dot (used while SVG loads or on error)
// ---------------------------------------------------------------------------

const fallbackCache = new Map<string, string>();

function buildFallbackDataUrl(color: string): string {
  const cached = fallbackCache.get(color);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 16; canvas.height = 16;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(8, 8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  const url = canvas.toDataURL();
  fallbackCache.set(color, url);
  return url;
}

// ---------------------------------------------------------------------------
// Heading helpers (preserved from previous implementation)
// ---------------------------------------------------------------------------

/** Heading in degrees clockwise from north, or null if unknown. */
export function getAircraftHeadingDeg(ac: AircraftLatest): number | null {
  const h = ac.trackDeg ?? (ac as any).headingDeg ?? ac.headingTrueDeg ?? ac.headingMagDeg;
  return typeof h === 'number' && !isNaN(h) ? h : null;
}

/**
 * Cesium billboard rotation is counter-clockwise in radians; compass heading
 * is clockwise from north. Negate to align the north-pointing icon with heading.
 */
export function headingToBillboardRotation(headingDeg: number): number {
  return -(headingDeg * Math.PI) / 180;
}

// ---------------------------------------------------------------------------
// Legacy exports kept for any remaining callers
// ---------------------------------------------------------------------------

export { getAircraftAltitudeColor as getAircraftColor };

/** @deprecated Use getAircraftMarkerImageAsync instead */
export function getAircraftArrowSprite(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 16; canvas.height = 16;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.moveTo(8, 1); ctx.lineTo(14, 14); ctx.lineTo(8, 11); ctx.lineTo(2, 14);
    ctx.closePath(); ctx.fill();
  }
  return canvas;
}

/** @deprecated Use getAircraftMarkerImageAsync instead */
export function getAircraftDotSprite(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 16; canvas.height = 16;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.arc(8, 8, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

export const AIRCRAFT_BILLBOARD_SCALE = 1.5;
