// Request validation and query parameter parsing for the news route.
// parseLimit, parseOffset, and isValidIsoDatetime are centralized
// in apps/api/src/lib/requestValidation.ts.
// parseLimit has a special default-value rule (when maxLimit === MAX_MARKER_LIMIT,
// the default equals MAX_MARKER_LIMIT instead of DEFAULT_LIMIT) that is preserved
// via a local wrapper atop the shared helper.
import { ErrorCodes } from '@god-eyes/contracts';
import {
  parseLimit as sharedParseLimit,
  parseOffset as sharedParseOffset,
  isValidIsoDatetimeLoose,
  type ValidationError,
} from '../../lib/requestValidation.js';

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;
export const MAX_MARKER_LIMIT = 500;
export const DEFAULT_OFFSET = 0;
export const MAX_OFFSET = 10000;

type ParseResult<T> = { value: T; error: ValidationError | null };

export function parseLimit(raw: string | undefined, maxLimit = MAX_LIMIT): ParseResult<number> {
  const defaultLimit = maxLimit === MAX_MARKER_LIMIT ? MAX_MARKER_LIMIT : DEFAULT_LIMIT;
  return sharedParseLimit(raw, defaultLimit, maxLimit, true);
}

export function parseOffset(raw: string | undefined): ParseResult<number> {
  return sharedParseOffset(raw, true);
}

// News uses the loose datetime check (accepts 'T' or space separator)
export { isValidIsoDatetimeLoose as isValidIsoDatetime };