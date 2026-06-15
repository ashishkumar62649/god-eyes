import { ErrorCodes } from '@god-eyes/contracts';
import type { BBox } from './types.js';

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 10000;

type ParseResult<T> = { value: T; error: { code: string; message: string } | null };

export { MAX_LIMIT };

export function parseBbox(raw: string): BBox | null {
  const parts = raw.split(',').map((p) => p.trim());
  if (parts.length !== 4) return null;
  const [minLon, minLat, maxLon, maxLat] = parts.map(Number);
  if (
    isNaN(minLon) || isNaN(minLat) || isNaN(maxLon) || isNaN(maxLat) ||
    minLon < -180 || minLon > 180 || maxLon < -180 || maxLon > 180 ||
    minLat < -90 || minLat > 90 || maxLat < -90 || maxLat > 90 ||
    minLon >= maxLon || minLat >= maxLat
  ) return null;
  return { minLon, minLat, maxLon, maxLat };
}

export function parseLimit(raw: string | undefined): ParseResult<number> {
  if (raw === undefined || raw === '') return { value: DEFAULT_LIMIT, error: null };
  const n = Number(raw);
  if (isNaN(n) || !Number.isInteger(n) || n < 1)
    return { value: DEFAULT_LIMIT, error: { code: ErrorCodes.INVALID_LIMIT, message: 'Limit must be a positive integer.' } };
  return { value: Math.min(n, MAX_LIMIT), error: null };
}

export function parseOffset(raw: string | undefined): ParseResult<number> {
  if (raw === undefined || raw === '') return { value: 0, error: null };
  const n = Number(raw);
  if (isNaN(n) || !Number.isInteger(n) || n < 0)
    return { value: 0, error: { code: ErrorCodes.INVALID_QUERY, message: 'Offset must be a non-negative integer.' } };
  return { value: n, error: null };
}
