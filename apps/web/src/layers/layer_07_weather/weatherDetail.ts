import type { WeatherRenderItem } from './weatherTypes';

const CARDINALS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];

/** Converts a compass bearing in degrees to a 16-point cardinal direction. */
export function degreesToCardinal(deg: number | null | undefined): string {
  if (deg === null || deg === undefined || !Number.isFinite(deg)) return '—';
  const normalized = ((deg % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % 16;
  return CARDINALS[index];
}

/** Formats a numeric weather value with a unit, or em dash if missing. */
export function formatMeasurement(
  value: number | null | undefined,
  unit: string,
  digits = 1
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)} ${unit}`;
}

/** Formats wind direction as "225° (SW)" or em dash. */
export function formatWindDirection(deg: number | null | undefined): string {
  if (deg === null || deg === undefined || !Number.isFinite(deg)) return '—';
  return `${Math.round(deg)}° (${degreesToCardinal(deg)})`;
}

/** Formats an ISO timestamp into a locale string, defensively. */
export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

/** Human-readable condition label, falling back to the weather code or em dash. */
export function formatCondition(item: WeatherRenderItem): string {
  if (item.weatherLabel && item.weatherLabel.trim().length > 0) {
    return item.weatherLabel;
  }
  if (item.weatherCode !== null) {
    return `Code ${item.weatherCode}`;
  }
  return '—';
}
