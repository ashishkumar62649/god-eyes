// Request validation helpers for the borders-boundaries route.
// parseBbox and parseLimit are centralized in apps/api/src/lib/requestValidation.ts.
// parseSimplify is unique to borders-boundaries and kept local.
import { ErrorCodes } from '@god-eyes/contracts';
import {
  parseBbox,
  parseLimit as sharedParseLimit,
} from '../../lib/requestValidation.js';
import type { BBox } from './types.js';

const DEFAULT_LIMIT = 250;
const MAX_LIMIT = 500;

type ParseResult<T> = { value: T; error: { code: string; message: string; details?: Record<string, unknown> } | null };

export { parseBbox, type BBox };

export function parseLimit(raw: string | undefined): ParseResult<number> {
  return sharedParseLimit(raw, DEFAULT_LIMIT, MAX_LIMIT, true);
}

export function parseSimplify(raw: string | undefined): { value: number; error: { code: string; message: string } | null } {
  if (raw === undefined || raw === '') {
    return { value: 0.05, error: null };
  }

  const n = Number(raw);
  if (isNaN(n) || n < 0) {
    return { value: 0.05, error: { code: ErrorCodes.INVALID_QUERY, message: 'Simplify must be a non-negative number.' } };
  }

  return { value: Math.min(n, 1), error: null };
}
