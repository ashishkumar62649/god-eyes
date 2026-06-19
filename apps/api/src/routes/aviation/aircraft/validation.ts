// Request validation helpers for the aviation aircraft route.
// parseBbox and parseLimit are centralized in apps/api/src/lib/requestValidation.ts.
// parseIncludeStale is unique to aviation and kept local.
import {
  parseBbox,
  parseLimit as sharedParseLimit,
  type BBox,
  type ValidationError,
} from '../../../lib/requestValidation.js';

export const DEFAULT_LIMIT = 1000;
export const MAX_LIMIT = 20000;

type ParseResult<T> = { value: T; error: ValidationError | null };

export { parseBbox };
export type { BBox };

export function parseLimit(raw: string | undefined): ParseResult<number> {
  return sharedParseLimit(raw, DEFAULT_LIMIT, MAX_LIMIT, true);
}

export function parseIncludeStale(raw: string | undefined): boolean {
  if (raw === undefined || raw === '') return false;
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return false;
}