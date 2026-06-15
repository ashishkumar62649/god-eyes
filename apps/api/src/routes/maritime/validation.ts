import { ErrorCodes } from '@god-eyes/contracts';
import type { BBox } from './types.js';

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 10000;
const DEFAULT_OFFSET = 0;
const MAX_OFFSET = 10000;

type ParseResult<T> = { value: T; error: { code: string; message: string; details?: Record<string, unknown> } | null };

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
    return { value: DEFAULT_LIMIT, error: { code: ErrorCodes.INVALID_LIMIT, message: 'Limit must be a positive integer.', details: { provided: raw } } };
  return { value: Math.min(n, MAX_LIMIT), error: null };
}

export function parseOffset(raw: string | undefined): ParseResult<number> {
  if (raw === undefined || raw === '') return { value: DEFAULT_OFFSET, error: null };
  const n = Number(raw);
  if (isNaN(n) || !Number.isInteger(n) || n < 0)
    return { value: DEFAULT_OFFSET, error: { code: ErrorCodes.INVALID_QUERY, message: 'Offset must be a non-negative integer.', details: { provided: raw } } };
  return { value: Math.min(n, MAX_OFFSET), error: null };
}

export function parseNumeric(raw: string | undefined): number | null {
  if (raw === undefined || raw === '') return null;
  const n = Number(raw);
  return isNaN(n) ? null : n;
}

export function parseMmsi(raw: string | undefined): number | null {
  if (raw === undefined || raw === '') return null;
  const n = Number(raw);
  if (isNaN(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

export function parseHours(raw: string | undefined): ParseResult<number> {
  if (raw === undefined || raw === '') return { value: 24, error: null };
  const n = Number(raw);
  if (isNaN(n) || !Number.isInteger(n) || n < 1 || n > 168)
    return { value: 24, error: { code: ErrorCodes.INVALID_QUERY, message: 'Hours must be an integer between 1 and 168.' } };
  return { value: n, error: null };
}

export function parseHistoryLimit(raw: string | undefined): ParseResult<number> {
  if (raw === undefined || raw === '') return { value: 500, error: null };
  const n = Number(raw);
  if (isNaN(n) || !Number.isInteger(n) || n < 1 || n > 5000)
    return { value: 500, error: { code: ErrorCodes.INVALID_LIMIT, message: 'Limit must be an integer between 1 and 5000.' } };
  return { value: n, error: null };
}

export function isValidIsoDatetime(raw: string): boolean {
  const d = new Date(raw);
  return d instanceof Date && !isNaN(d.getTime()) && (raw.includes('T') || raw.includes(' '));
}
