// Request validation and query parameter parsing for the weather route.
// parseBbox, parseLimit, parseOffset, and isValidIsoDatetime are centralized
// in apps/api/src/lib/requestValidation.ts.
// parseNearbyLimit and weather-specific constants are kept local.
import { ErrorCodes } from '@god-eyes/contracts';
import {
  parseBbox,
  parseLimit as sharedParseLimit,
  parseOffset as sharedParseOffset,
  isValidIsoDatetimeLoose,
  type ValidationError,
} from '../../lib/requestValidation.js';

export const DEFAULT_LIMIT = 200;
export const MAX_LIMIT = 5000;
export const DEFAULT_OFFSET = 0;
export const MAX_OFFSET = 10000;
export const NEARBY_DEFAULT_RADIUS_KM = 200;
export const NEARBY_MAX_RADIUS_KM = 1000;
export const NEARBY_DEFAULT_LIMIT = 50;

type ParseResult<T> = { value: T; error: ValidationError | null };

export { parseBbox };

export function parseLimit(raw: string | undefined): ParseResult<number> {
  return sharedParseLimit(raw, DEFAULT_LIMIT, MAX_LIMIT, true);
}

export function parseOffset(raw: string | undefined): ParseResult<number> {
  return sharedParseOffset(raw, true);
}

export function parseNearbyLimit(raw: string | undefined): ParseResult<number> {
  if (raw === undefined || raw === '') return { value: NEARBY_DEFAULT_LIMIT, error: null };
  const n = Number(raw);
  if (isNaN(n) || !Number.isInteger(n) || n < 1 || n > MAX_LIMIT) {
    return { value: NEARBY_DEFAULT_LIMIT, error: { code: ErrorCodes.INVALID_LIMIT, message: `Limit must be an integer between 1 and ${MAX_LIMIT}.`, details: { provided: raw } } };
  }
  return { value: n, error: null };
}

// Weather uses the loose datetime check (accepts 'T' or space separator)
export { isValidIsoDatetimeLoose as isValidIsoDatetime };