// Request validation helpers for the energy infrastructure route.
// parseBbox and parseLimit are centralized in apps/api/src/lib/requestValidation.ts.
// parseOffset is kept local because it does not clamp to MAX_OFFSET
// (unlike parseOffset in maritime, news, and weather which clamp to 10000).
import { ErrorCodes } from '@god-eyes/contracts';
import { parseBbox, parseLimit as sharedParseLimit } from '../../../lib/requestValidation.js';
import type { BBox } from './types.js';

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 10000;

type ParseResult<T> = { value: T; error: { code: string; message: string } | null };

export { MAX_LIMIT, parseBbox };

export function parseLimit(raw: string | undefined): ParseResult<number> {
  return sharedParseLimit(raw, DEFAULT_LIMIT, MAX_LIMIT);
}

export function parseOffset(raw: string | undefined): ParseResult<number> {
  if (raw === undefined || raw === '') return { value: 0, error: null };
  const n = Number(raw);
  if (isNaN(n) || !Number.isInteger(n) || n < 0)
    return { value: 0, error: { code: ErrorCodes.INVALID_QUERY, message: 'Offset must be a non-negative integer.' } };
  return { value: n, error: null };
}