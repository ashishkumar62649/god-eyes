import { VALID_CATEGORIES, ValidCategory, MAX_LIST_LIMIT, MAX_VIEWPORT_LIMIT, DEFAULT_LIMIT } from './constants.js';
import { PayloadProfiles, PayloadProfile, CoordinateModes, CoordinateMode } from '@god-eyes/contracts';

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

// Density mode constants
export const DEFAULT_CELL_SIZE_DEGREES = 2.0;
export const MIN_CELL_SIZE_DEGREES = 0.5;
export const MAX_CELL_SIZE_DEGREES = 10.0;

export function validateMode(mode: string | undefined): ValidationResult<'points' | 'clusters' | 'density'> {
  if (!mode || mode === 'points') return { value: 'points', valid: true, error: null };
  if (mode === 'clusters') return { value: 'clusters', valid: true, error: null };
  if (mode === 'density') return { value: 'density', valid: true, error: null };
  return { value: 'points', valid: false, error: "mode must be 'points', 'clusters', or 'density'" };
}

export function validateCellSizeDegrees(cellSizeStr: string | undefined): ValidationResult<number> {
  if (!cellSizeStr) {
    return { value: DEFAULT_CELL_SIZE_DEGREES, valid: true, error: null };
  }

  const parsed = parseFloat(cellSizeStr);
  if (isNaN(parsed) || parsed <= 0) {
    return { value: parsed, valid: false, error: 'cellSizeDegrees must be a positive number' };
  }
  if (parsed < MIN_CELL_SIZE_DEGREES) {
    return { value: MIN_CELL_SIZE_DEGREES, valid: true, error: null }; // clamp to min
  }
  if (parsed > MAX_CELL_SIZE_DEGREES) {
    return { value: MAX_CELL_SIZE_DEGREES, valid: true, error: null }; // clamp to max
  }
  return { value: parsed, valid: true, error: null };
}

export function validateIncludeClosed(includeClosedStr: string | undefined): ValidationResult<boolean> {
  if (!includeClosedStr) {
    return { value: false, valid: true, error: null }; // default: exclude closed
  }
  if (includeClosedStr === 'true' || includeClosedStr === '1') {
    return { value: true, valid: true, error: null };
  }
  if (includeClosedStr === 'false' || includeClosedStr === '0') {
    return { value: false, valid: true, error: null };
  }
  return { value: false, valid: false, error: "includeClosed must be 'true' or 'false'" };
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

export function validateFields(fieldsStr: string | undefined): ValidationResult<PayloadProfile> {
  if (!fieldsStr || fieldsStr === PayloadProfiles.STANDARD) {
    return { value: PayloadProfiles.STANDARD, valid: true, error: null };
  }
  if (fieldsStr === PayloadProfiles.MARKER) {
    return { value: PayloadProfiles.MARKER, valid: true, error: null };
  }
  return { value: PayloadProfiles.STANDARD, valid: false, error: "fields must be 'standard' or 'marker'" };
}

export function validateCoordinates(coordinatesStr: string | undefined): ValidationResult<CoordinateMode> {
  if (!coordinatesStr || coordinatesStr === CoordinateModes.SOURCE) {
    return { value: CoordinateModes.SOURCE, valid: true, error: null };
  }
  if (coordinatesStr === CoordinateModes.EFFECTIVE) {
    return { value: CoordinateModes.EFFECTIVE, valid: true, error: null };
  }
  return { value: CoordinateModes.SOURCE, valid: false, error: "coordinates must be 'source' or 'effective'" };
}

// Default and max values for nearby navaids
export const DEFAULT_NAVAID_RADIUS_KM = 100;
export const MAX_NAVAID_RADIUS_KM = 250;
export const DEFAULT_NAVAID_LIMIT = 20;
export const MAX_NAVAID_LIMIT = 50;

export function validateNavaidRadius(radiusStr: string | undefined): ValidationResult<number> {
  if (!radiusStr) {
    return { value: DEFAULT_NAVAID_RADIUS_KM, valid: true, error: null };
  }

  const parsed = parseInt(radiusStr, 10);
  if (isNaN(parsed) || parsed < 1) {
    return { value: parsed, valid: false, error: 'navaidRadiusKm must be a positive integer' };
  }
  if (parsed > MAX_NAVAID_RADIUS_KM) {
    return { value: MAX_NAVAID_RADIUS_KM, valid: true, error: null }; // clamp to max
  }
  return { value: parsed, valid: true, error: null };
}

export function validateNavaidLimit(limitStr: string | undefined): ValidationResult<number> {
  if (!limitStr) {
    return { value: DEFAULT_NAVAID_LIMIT, valid: true, error: null };
  }

  const parsed = parseInt(limitStr, 10);
  if (isNaN(parsed) || parsed < 1) {
    return { value: parsed, valid: false, error: 'navaidLimit must be a positive integer' };
  }
  if (parsed > MAX_NAVAID_LIMIT) {
    return { value: MAX_NAVAID_LIMIT, valid: true, error: null }; // clamp to max
  }
  return { value: parsed, valid: true, error: null };
}