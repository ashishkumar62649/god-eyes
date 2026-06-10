import type { WeatherRenderItem } from './weatherTypes';

export type TemperatureBucket =
  | 'cold'
  | 'cool'
  | 'mild'
  | 'warm'
  | 'hot'
  | 'extreme';

/**
 * Temperature buckets (°C) per WO-WEATHER-U:
 *   <= 0   : cold
 *   1–10   : cool
 *   11–20  : mild
 *   21–30  : warm
 *   31–40  : hot
 *   > 40   : extreme
 */
export function getTemperatureBucket(tempC: number): TemperatureBucket {
  if (!Number.isFinite(tempC)) return 'mild';
  if (tempC <= 0) return 'cold';
  if (tempC <= 10) return 'cool';
  if (tempC <= 20) return 'mild';
  if (tempC <= 30) return 'warm';
  if (tempC <= 40) return 'hot';
  return 'extreme';
}

/** Simple, consistent colours aligned with the project palette. */
export const TEMPERATURE_BUCKET_COLORS: Record<TemperatureBucket, string> = {
  cold: '#3b82f6', // blue
  cool: '#60a5fa', // light blue
  mild: '#22c55e', // green
  warm: '#eab308', // yellow
  hot: '#f97316', // orange
  extreme: '#ef4444', // red
};

export const TEMPERATURE_BUCKET_LABELS: Record<TemperatureBucket, string> = {
  cold: '≤ 0°C',
  cool: '1–10°C',
  mild: '11–20°C',
  warm: '21–30°C',
  hot: '31–40°C',
  extreme: '> 40°C',
};

/** Ordered legend definition (cold → extreme). */
export const TEMPERATURE_LEGEND: Array<{
  bucket: TemperatureBucket;
  color: string;
  label: string;
}> = (
  ['cold', 'cool', 'mild', 'warm', 'hot', 'extreme'] as TemperatureBucket[]
).map((bucket) => ({
  bucket,
  color: TEMPERATURE_BUCKET_COLORS[bucket],
  label: TEMPERATURE_BUCKET_LABELS[bucket],
}));

export function getTemperatureColor(tempC: number): string {
  return TEMPERATURE_BUCKET_COLORS[getTemperatureBucket(tempC)];
}

function darken(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  const r = Math.max(0, Math.round(((num >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((num >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round((num & 0xff) * (1 - amount)));
  return `rgb(${r}, ${g}, ${b})`;
}

// Cache generated marker data URLs to avoid DOM thrashing on re-render.
const spriteCache = new Map<string, string>();

/**
 * Generates a temperature-coloured circular marker as a data URL.
 * Stale markers are drawn grey with a darker outline.
 */
export function getWeatherMarkerImage(item: WeatherRenderItem): string {
  const color = item.isStale ? '#888888' : getTemperatureColor(item.temperatureC);
  const cacheKey = `${color}-${item.isStale ? 's' : 'f'}`;
  const cached = spriteCache.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 24;
  canvas.height = 24;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.beginPath();
    ctx.arc(12, 12, 9, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = item.isStale ? '#666666' : darken(color, 0.25);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  const url = canvas.toDataURL();
  spriteCache.set(cacheKey, url);
  return url;
}

// 24px source -> ~12px on screen.
export const WEATHER_BILLBOARD_SCALE = 0.5;
