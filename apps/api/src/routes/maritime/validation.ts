// Request validation helpers for the maritime route.
// parseBbox, parseLimit, parseOffset, and isValidIsoDatetime are centralized
// in apps/api/src/lib/requestValidation.ts.
// parseNumeric, parseMmsi, parseHours, parseHistoryLimit are unique to maritime
// and kept local.
import { ErrorCodes } from '@god-eyes/contracts';
import {
  parseBbox,
  parseLimit as sharedParseLimit,
  parseOffset as sharedParseOffset,
  isValidIsoDatetimeLoose,
} from '../../lib/requestValidation.js';

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 10000;
const DEFAULT_OFFSET = 0;
const MAX_OFFSET = 10000;

type ParseResult<T> = { value: T; error: { code: string; message: string; details?: Record<string, unknown> } | null };

export { parseBbox };

export function parseLimit(raw: string | undefined): ParseResult<number> {
  return sharedParseLimit(raw, DEFAULT_LIMIT, MAX_LIMIT, true);
}

export function parseOffset(raw: string | undefined): ParseResult<number> {
  return sharedParseOffset(raw, true);
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

// Maritime uses the loose datetime check (accepts 'T' or space separator)
export { isValidIsoDatetimeLoose as isValidIsoDatetime };