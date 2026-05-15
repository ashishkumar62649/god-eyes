import { VALID_CATEGORIES, ValidCategory, MAX_LIST_LIMIT, MAX_VIEWPORT_LIMIT, DEFAULT_LIMIT } from './constants.js';

// Bounding box parsed from string
export interface ParsedBBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export interface ValidationResult<T> {
  value: T;
  valid: boolean;
  error: string | null;
}

export function parseBBox(bboxStr: string): ParsedBBox | null {
  const parts = bboxStr.split(',');
  if (parts.length !== 4) return null;

  const [minLon, minLat, maxLon, maxLat] = parts.map((p) => parseFloat(p.trim()));
  if ([minLon, minLat, maxLon, maxLat].some((v) => isNaN(v))) return null;

  return { minLon, minLat, maxLon, maxLat };
}

export function validateBBox(bbox: ParsedBBox): string | null {
  if (bbox.minLon < -180 || bbox.minLon > 180) return 'minLon must be between -180 and 180';
  if (bbox.maxLon < -180 || bbox.maxLon > 180) return 'maxLon must be between -180 and 180';
  if (bbox.minLat < -90 || bbox.minLat > 90) return 'minLat must be between -90 and 90';
  if (bbox.maxLat < -90 || bbox.maxLat > 90) return 'maxLat must be between -90 and 90';
  if (bbox.minLon >= bbox.maxLon) return 'minLon must be less than maxLon';
  if (bbox.minLat >= bbox.maxLat) return 'minLat must be less than maxLat';
  return null;
}

export function validateCategory(category: string): string | null {
  if (!VALID_CATEGORIES.includes(category as ValidCategory)) {
    return `Invalid category. Allowed: ${VALID_CATEGORIES.join(', ')}`;
  }
  return null;
}

export function validateLimit(limitStr: string | undefined, maxLimit: number = MAX_LIST_LIMIT): ValidationResult<number> {
  if (limitStr === undefined) {
    return { value: DEFAULT_LIMIT, valid: true, error: null };
  }

  const parsed = parseInt(limitStr, 10);
  if (isNaN(parsed) || parsed < 1) {
    return { value: parsed, valid: false, error: 'limit must be a positive integer' };
  }
  if (parsed > maxLimit) {
    return { value: maxLimit, valid: true, error: null }; // clamp to max
  }
  return { value: parsed, valid: true, error: null };
}

export function validateOffset(offsetStr: string | undefined): ValidationResult<number> {
  const parsed = parseInt(offsetStr || '0', 10);
  if (isNaN(parsed) || parsed < 0) {
    return { value: parsed, valid: false, error: 'offset must be a non-negative integer' };
  }
  return { value: parsed, valid: true, error: null };
}

export function validateMode(mode: string | undefined): ValidationResult<'points' | 'clusters'> {
  if (!mode || mode === 'points') return { value: 'points', valid: true, error: null };
  if (mode === 'clusters') return { value: 'clusters', valid: true, error: null };
  return { value: 'points', valid: false, error: "mode must be 'points' or 'clusters'" };
}

export function validateZoom(zoomStr: string | undefined): ValidationResult<number | null> {
  if (!zoomStr) return { value: null, valid: true, error: null };

  const parsed = parseInt(zoomStr, 10);
  if (isNaN(parsed) || parsed < 0 || parsed > 22) {
    return { value: parsed, valid: false, error: 'zoom must be a number between 0 and 22' };
  }
  return { value: parsed, valid: true, error: null };
}

export function getEffectiveMaxLimit(hasBBox: boolean): number {
  return hasBBox ? MAX_VIEWPORT_LIMIT : MAX_LIST_LIMIT;
}

export function clampBBoxToWorld(bbox: ParsedBBox): { minLon: number; maxLon: number; minLat: number; maxLat: number } {
  return {
    minLon: Math.max(bbox.minLon, -180),
    maxLon: Math.min(bbox.maxLon, 180),
    minLat: Math.max(bbox.minLat, -90),
    maxLat: Math.min(bbox.maxLat, 90),
  };
}