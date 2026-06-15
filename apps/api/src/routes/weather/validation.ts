// Request validation and query parameter parsing for the weather route.
import { ErrorCodes } from '@god-eyes/contracts';
import type { BBox } from './types.js';

export const DEFAULT_LIMIT = 200;
export const MAX_LIMIT = 5000;
export const DEFAULT_OFFSET = 0;
export const MAX_OFFSET = 10000;
export const NEARBY_DEFAULT_RADIUS_KM = 200;
export const NEARBY_MAX_RADIUS_KM = 1000;
export const NEARBY_DEFAULT_LIMIT = 50;

type ParseResult<T> = { value: T; error: { code: string; message: string; details: Record<string, unknown> } | null };

export function parseBbox(raw: string): BBox | null {
  const parts = raw.split(',').map((p) => p.trim());
  if (parts.length !== 4) return null;

  const [minLon, minLat, maxLon, maxLat] = parts.map(Number);

  if (
    isNaN(minLon) || isNaN(minLat) || isNaN(maxLon) || isNaN(maxLat) ||
    minLon < -180 || minLon > 180 ||
    maxLon < -180 || maxLon > 180 ||
    minLat < -90 || minLat > 90 ||
    maxLat < -90 || maxLat > 90 ||
    minLon >= maxLon || minLat >= maxLat
  ) {
    return null;
  }

  return { minLon, minLat, maxLon, maxLat };
}

export function parseLimit(raw: string | undefined): ParseResult<number> {
  if (raw === undefined || raw === '') return { value: DEFAULT_LIMIT, error: null };
  const n = Number(raw);
  if (isNaN(n) || !Number.isInteger(n) || n < 1) {
    return { value: DEFAULT_LIMIT, error: { code: ErrorCodes.INVALID_LIMIT, message: 'Limit must be a positive integer.', details: { provided: raw } } };
  }
  return { value: Math.min(n, MAX_LIMIT), error: null };
}

export function parseOffset(raw: string | undefined): ParseResult<number> {
  if (raw === undefined || raw === '') return { value: DEFAULT_OFFSET, error: null };
  const n = Number(raw);
  if (isNaN(n) || !Number.isInteger(n) || n < 0) {
    return { value: DEFAULT_OFFSET, error: { code: ErrorCodes.INVALID_QUERY, message: 'Offset must be a non-negative integer.', details: { provided: raw } } };
  }
  return { value: Math.min(n, MAX_OFFSET), error: null };
}

export function parseNearbyLimit(raw: string | undefined): ParseResult<number> {
  if (raw === undefined || raw === '') return { value: NEARBY_DEFAULT_LIMIT, error: null };
  const n = Number(raw);
  if (isNaN(n) || !Number.isInteger(n) || n < 1 || n > MAX_LIMIT) {
    return { value: NEARBY_DEFAULT_LIMIT, error: { code: ErrorCodes.INVALID_LIMIT, message: `Limit must be an integer between 1 and ${MAX_LIMIT}.`, details: { provided: raw } } };
  }
  return { value: n, error: null };
}

export function isValidIsoDatetime(raw: string): boolean {
  const d = new Date(raw);
  return d instanceof Date && !isNaN(d.getTime()) && (raw.includes('T') || raw.includes(' '));
}
