// Request validation and query parameter parsing for the news route.
import { ErrorCodes } from '@god-eyes/contracts';

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;
export const MAX_MARKER_LIMIT = 500;
export const DEFAULT_OFFSET = 0;
export const MAX_OFFSET = 10000;

type ParseResult<T> = { value: T; error: { code: string; message: string; details: Record<string, unknown> } | null };

export function parseLimit(raw: string | undefined, maxLimit = MAX_LIMIT): ParseResult<number> {
  if (raw === undefined || raw === '') {
    return { value: maxLimit === MAX_MARKER_LIMIT ? MAX_MARKER_LIMIT : DEFAULT_LIMIT, error: null };
  }
  const n = Number(raw);
  if (isNaN(n) || !Number.isInteger(n) || n < 1) {
    return { value: DEFAULT_LIMIT, error: { code: ErrorCodes.INVALID_LIMIT, message: 'Limit must be a positive integer.', details: { provided: raw } } };
  }
  return { value: Math.min(n, maxLimit), error: null };
}

export function parseOffset(raw: string | undefined): ParseResult<number> {
  if (raw === undefined || raw === '') return { value: DEFAULT_OFFSET, error: null };
  const n = Number(raw);
  if (isNaN(n) || !Number.isInteger(n) || n < 0) {
    return { value: DEFAULT_OFFSET, error: { code: ErrorCodes.INVALID_QUERY, message: 'Offset must be a non-negative integer.', details: { provided: raw } } };
  }
  return { value: Math.min(n, MAX_OFFSET), error: null };
}

export function isValidIsoDatetime(raw: string): boolean {
  const d = new Date(raw);
  return d instanceof Date && !isNaN(d.getTime()) && (raw.includes('T') || raw.includes(' '));
}
