// Pure request-validation helpers shared across API routes.
//
// Centralizes duplicated parseBbox / parseLimit / parseOffset / isValidIsoDatetime
// logic without changing endpoint behavior, bounds, defaults, error messages,
// HTTP status codes, or response shapes.
//
// Every helper here is a pure function: no Fastify imports, no database, no env
// reads, no route registration, no side effects.
//
// Helpers intentionally NOT centralized (left local):
//   - objects/validation.ts parseBBox   — parseFloat, no trim, no bounds check;
//                                         separate validateBBox step; different
//                                         architecture from strict parseBbox.
//   - objects/validation.ts validateCategory / validateMode — unique to objects.
//   - objects/validation.ts all other validators — none are duplicated.
//   - news/validation.ts parseLimit wrapper — special default-value logic tied
//                                         to MAX_MARKER_LIMIT vs MAX_LIMIT;
//                                         wrapped locally atop the shared parseLimit.
//   - Route-specific constants (DEFAULT_LIMIT, MAX_LIMIT, etc.) — these differ
//                                         per route and stay local.

import { ErrorCodes } from '@god-eyes/contracts';

// ---- Types ----------------------------------------------------------------

export interface BBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export interface ValidationError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ParseResult<T> {
  value: T;
  error: ValidationError | null;
}

// ---- Fallback constants (used only when routes don't supply their own) -----

export const DEFAULT_OFFSET = 0;
export const DEFAULT_MAX_OFFSET = 10000;

// ---- parseBbox (strict — identical across 6 route files) ------------------

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

// ---- parseLimit (configurable defaults / max / details) -------------------

export function parseLimit(
  raw: string | undefined,
  defaultLimit: number,
  maxLimit: number,
  withDetails?: boolean,
): ParseResult<number> {
  if (raw === undefined || raw === '') {
    return { value: defaultLimit, error: null };
  }

  const n = Number(raw);
  if (isNaN(n) || !Number.isInteger(n) || n < 1) {
    const err: ValidationError = {
      code: ErrorCodes.INVALID_LIMIT,
      message: 'Limit must be a positive integer.',
    };
    if (withDetails) err.details = { provided: raw };
    return { value: defaultLimit, error: err };
  }

  return { value: Math.min(n, maxLimit), error: null };
}

// ---- parseOffset (configurable details — defaults 0 / max 10000) ----------

export function parseOffset(
  raw: string | undefined,
  withDetails?: boolean,
): ParseResult<number> {
  if (raw === undefined || raw === '') {
    return { value: DEFAULT_OFFSET, error: null };
  }

  const n = Number(raw);
  if (isNaN(n) || !Number.isInteger(n) || n < 0) {
    const err: ValidationError = {
      code: ErrorCodes.INVALID_QUERY,
      message: 'Offset must be a non-negative integer.',
    };
    if (withDetails) err.details = { provided: raw };
    return { value: DEFAULT_OFFSET, error: err };
  }

  return { value: Math.min(n, DEFAULT_MAX_OFFSET), error: null };
}

// ---- isValidIsoDatetime (strict — 'T' separator only) ---------------------

export function isValidIsoDatetime(raw: string): boolean {
  const d = new Date(raw);
  return d instanceof Date && !isNaN(d.getTime()) && raw.includes('T');
}

// ---- isValidIsoDatetimeLoose ('T' or space separator) ---------------------

export function isValidIsoDatetimeLoose(raw: string): boolean {
  const d = new Date(raw);
  return d instanceof Date && !isNaN(d.getTime()) && (raw.includes('T') || raw.includes(' '));
}