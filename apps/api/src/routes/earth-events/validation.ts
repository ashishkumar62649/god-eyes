import { ErrorCodes } from '@god-eyes/contracts';
import {
  parseBbox as sharedParseBbox,
  parseLimit as sharedParseLimit,
  isValidIsoDatetime,
  type BBox as SharedBBox,
  type ValidationError,
} from '../../lib/requestValidation.js';

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

type ParseResult<T> = { value: T; error: ValidationError | null };

export { isValidIsoDatetime };
export type { SharedBBox as BBox };

export function parseBbox(raw: string): SharedBBox | null {
  return sharedParseBbox(raw);
}

export function parseLimit(raw: string | undefined): ParseResult<number> {
  return sharedParseLimit(raw, DEFAULT_LIMIT, MAX_LIMIT, true);
}