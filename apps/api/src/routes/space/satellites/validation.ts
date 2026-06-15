import { ErrorCodes } from '@god-eyes/contracts';

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 75000;

export { MAX_LIMIT };

type ParseResult<T> = { value: T; error: { code: string; message: string; details: Record<string, unknown> } | null };

export function parseLimit(raw: string | undefined): ParseResult<number> {
  if (raw === undefined || raw === '') return { value: DEFAULT_LIMIT, error: null };
  const n = Number(raw);
  if (isNaN(n) || !Number.isInteger(n) || n < 1)
    return { value: DEFAULT_LIMIT, error: { code: ErrorCodes.INVALID_LIMIT, message: 'Limit must be a positive integer.', details: { provided: raw } } };
  return { value: Math.min(n, MAX_LIMIT), error: null };
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
