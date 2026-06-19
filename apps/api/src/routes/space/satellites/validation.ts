// Request validation helpers for the space/satellites route.
// parseLimit is centralized in apps/api/src/lib/requestValidation.ts.
// parseBoolean, parseNumeric, parseCommaList are unique to space and kept local.
import { parseLimit as sharedParseLimit, type ValidationError } from '../../../lib/requestValidation.js';

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 75000;

export { MAX_LIMIT };

type ParseResult<T> = { value: T; error: ValidationError | null };

export function parseLimit(raw: string | undefined): ParseResult<number> {
  return sharedParseLimit(raw, DEFAULT_LIMIT, MAX_LIMIT, true);
}

export function parseBoolean(raw: string | undefined): boolean | undefined {
  if (raw === undefined || raw === '') return undefined;
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return undefined;
}

export function parseNumeric(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === '') return undefined;
  const n = Number(raw);
  return isNaN(n) ? undefined : n;
}

export function parseCommaList(raw: string | undefined): string[] | undefined {
  if (raw === undefined || raw === '') return undefined;
  return raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
}