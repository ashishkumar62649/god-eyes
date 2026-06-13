import { NEWS_SEVERITY_COLORS } from './newsTypes';
import type { NewsRenderMarker } from './newsTypes';

export const NEWS_BILLBOARD_SCALE = 0.55;

/** Gets the fill colour for a news item by severity. */
export function getNewsMarkerColor(severity: string): string {
  return NEWS_SEVERITY_COLORS[severity.toLowerCase()] ?? NEWS_SEVERITY_COLORS.unknown;
}

// Cache data URLs to avoid DOM thrashing.
const spriteCache = new Map<string, string>();

function darken(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.max(0, Math.round(((n >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((n >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round((n & 0xff) * (1 - amount)));
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Generates a severity-coloured diamond marker as a data URL.
 * Diamond shape visually distinguishes Layer 08 from circles (weather) and
 * other layer sprites.
 */
export function getNewsMarkerImage(item: NewsRenderMarker): string {
  const color = getNewsMarkerColor(item.severity);
  const cached = spriteCache.get(color);
  if (cached) return cached;

  const size = 24;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = size / 2;
    const cy = size / 2;
    const r = 9;
    // Diamond shape.
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = darken(color, 0.3);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  const url = canvas.toDataURL();
  spriteCache.set(color, url);
  return url;
}
