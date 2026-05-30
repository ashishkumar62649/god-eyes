import { Color } from 'cesium';
import type { AircraftLatest } from '@god-eyes/contracts';

// Marker visuals for live aircraft (WO-079E).
// Sprites are drawn WHITE so they can be tinted per-aircraft via billboard color.

const ARROW_PX = 16; // canvas px; on-screen size set via billboard scale (~7px)
export const AIRCRAFT_BILLBOARD_SCALE = 0.5; // 16px * 0.5 = 8px on screen

function buildArrowSprite(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = ARROW_PX;
  canvas.height = ARROW_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const c = ARROW_PX / 2;
  // Chevron / arrow pointing UP (north). Tip at top, two base corners, notch at bottom.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(c, 1); // tip (north)
  ctx.lineTo(ARROW_PX - 2, ARROW_PX - 2); // bottom-right
  ctx.lineTo(c, ARROW_PX - 5); // center notch
  ctx.lineTo(2, ARROW_PX - 2); // bottom-left
  ctx.closePath();
  ctx.fill();
  return canvas;
}

function buildDotSprite(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = ARROW_PX;
  canvas.height = ARROW_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const c = ARROW_PX / 2;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(c, c, ARROW_PX * 0.28, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}

// Lazily-created shared sprites (reused by every billboard).
let arrowSprite: HTMLCanvasElement | null = null;
let dotSprite: HTMLCanvasElement | null = null;

export function getAircraftArrowSprite(): HTMLCanvasElement {
  if (!arrowSprite) arrowSprite = buildArrowSprite();
  return arrowSprite;
}

export function getAircraftDotSprite(): HTMLCanvasElement {
  if (!dotSprite) dotSprite = buildDotSprite();
  return dotSprite;
}

const COLOR_EMERGENCY = Color.fromCssColorString('#ff3d00'); // red
const COLOR_MILITARY = Color.fromCssColorString('#ffd600'); // amber
const COLOR_NEUTRAL = Color.fromCssColorString('#00e5ff'); // cyan

function hasEmergency(ac: AircraftLatest): boolean {
  return !!ac.emergency && ac.emergency !== 'none';
}

export function getAircraftColor(ac: AircraftLatest): Color {
  if (hasEmergency(ac)) return COLOR_EMERGENCY;
  if (ac.isMilitary) return COLOR_MILITARY;
  return COLOR_NEUTRAL;
}

/** Heading in degrees clockwise from north, or null if unknown. */
export function getAircraftHeadingDeg(ac: AircraftLatest): number | null {
  const h = ac.trackDeg ?? (ac as any).headingDeg ?? ac.headingTrueDeg ?? ac.headingMagDeg;
  return typeof h === 'number' && !isNaN(h) ? h : null;
}

/**
 * Cesium billboard rotation is counter-clockwise in radians; compass heading
 * is clockwise from north. Negate to align the north-pointing arrow with heading.
 */
export function headingToBillboardRotation(headingDeg: number): number {
  return -(headingDeg * Math.PI) / 180;
}
